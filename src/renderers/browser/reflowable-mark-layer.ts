import { resolveReflowableBlockMarks } from '../../core/mark-resolver'
import { isBookRange } from '../../core/location'
import type { PageSurfaceDecorator } from '../../core/page-surface'
import type { ReaderMark } from '../../core/renderer'
import type { TextBlock } from '../../core/pretext'
import type { BrowserPageSurface } from './compositor'
import {
    applyBrowserMarkDataset,
    getBrowserMarkClassNames,
    getBrowserMarkColor,
} from './mark-style'

export interface BrowserReflowableMarkLayerDecoratorConfig {
    readonly getMarks: () => readonly ReaderMark[]
}

export interface BrowserReflowableSurfaceMetadata extends Readonly<Record<string, unknown>> {
    readonly sectionIndex: number
    readonly blocks: readonly TextBlock[]
}

export class BrowserReflowableMarkLayerDecorator implements PageSurfaceDecorator<BrowserPageSurface> {
    readonly id = 'browser-reflowable-mark-layer'
    private readonly getMarks: () => readonly ReaderMark[]

    constructor(config: BrowserReflowableMarkLayerDecoratorConfig) {
        this.getMarks = config.getMarks
    }

    decorate(surface: BrowserPageSurface): BrowserPageSurface {
        const metadata = getReflowableMetadata(surface)
        if (!metadata) return surface
        const content = surface.layers.find(layer => layer.id === 'content')?.content
        if (!(content instanceof HTMLElement)) return surface

        for (const block of metadata.blocks) {
            const element = findBlockElement(content, block.id)
            if (!element) continue
            applyBlockMarks(element, block, metadata.sectionIndex, this.getMarks())
        }
        return surface
    }
}

function getReflowableMetadata(surface: BrowserPageSurface): BrowserReflowableSurfaceMetadata | null {
    const metadata = surface.metadata
    if (!metadata) return null
    if (typeof metadata.sectionIndex !== 'number' || !Array.isArray(metadata.blocks)) return null
    return metadata as BrowserReflowableSurfaceMetadata
}

function applyBlockMarks(
    element: HTMLElement,
    block: TextBlock,
    sectionIndex: number,
    marks: readonly ReaderMark[],
): void {
    const matching = resolveReflowableBlockMarks(marks, block, sectionIndex)
    const explicit = marks.filter(mark => getMarkBlockIds(mark).includes(block.id))
    const allMatching = Array.from(new Map([...matching, ...explicit].map(mark => [mark.id, mark])).values())
    if (!allMatching.length) return
    element.dataset.markIds = allMatching.map(mark => mark.id).join(' ')
    element.dataset.markKinds = allMatching.map(mark => mark.kind).filter(Boolean).join(' ')
    const textLength = Array.from(element.textContent ?? '').length
    for (const mark of allMatching) {
        const range = getMarkOffsets(mark, block.id, textLength)
        wrapTextRange(element, range.start, range.end, mark)
    }
}

function getMarkOffsets(mark: ReaderMark, blockId: string, textLength: number): { start: number; end: number } {
    const position = mark.location
    if (!isBookRange(position)) return { start: 0, end: textLength }
    const start = position.start.type === 'reflowable' ? position.start : null
    const end = position.end?.type === 'reflowable' ? position.end : start
    if (!start || !end) return { start: 0, end: textLength }
    if (start.blockId === blockId && end.blockId === blockId) {
        return normalizeOffsets(start.offset ?? 0, end.offset ?? textLength, textLength)
    }
    if (start.blockId === blockId) return normalizeOffsets(start.offset ?? 0, textLength, textLength)
    if (end.blockId === blockId) return normalizeOffsets(0, end.offset ?? textLength, textLength)
    return { start: 0, end: textLength }
}

function normalizeOffsets(start: number, end: number, textLength: number): { start: number; end: number } {
    const lower = Math.max(0, Math.min(textLength, Math.min(start, end)))
    const upper = Math.max(lower, Math.min(textLength, Math.max(start, end)))
    return { start: lower, end: upper }
}

function getMarkBlockIds(mark: ReaderMark): string[] {
    const value = mark.data?.blockIds
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function wrapTextRange(element: HTMLElement, start: number, end: number, mark: ReaderMark): void {
    if (end <= start) return
    const walker = element.ownerDocument.createTreeWalker(element, 4)
    const nodes: Text[] = []
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.nodeType === 3 && node.nodeValue) nodes.push(node as Text)
    }

    let cursor = 0
    for (const node of nodes) {
        const characters = Array.from(node.data)
        const nodeStart = cursor
        const nodeEnd = cursor + characters.length
        cursor = nodeEnd
        const overlapStart = Math.max(start, nodeStart)
        const overlapEnd = Math.min(end, nodeEnd)
        if (overlapEnd <= overlapStart) continue

        const before = characters.slice(0, overlapStart - nodeStart).join('')
        const selected = characters.slice(overlapStart - nodeStart, overlapEnd - nodeStart).join('')
        const after = characters.slice(overlapEnd - nodeStart).join('')
        const wrapper = element.ownerDocument.createElement('mark')
        wrapper.textContent = selected
        wrapper.dataset.markId = mark.id
        if (element.dataset.blockId) wrapper.dataset.blockId = element.dataset.blockId
        if (mark.kind) wrapper.dataset.markKind = mark.kind
        wrapper.classList.add(...getBrowserMarkClassNames(mark))
        applyBrowserMarkDataset(wrapper, mark)
        wrapper.style.backgroundColor = getBrowserMarkColor(mark)
        wrapper.style.color = 'inherit'
        wrapper.style.borderRadius = '4px'
        wrapper.style.cursor = 'pointer'
        const replacement = element.ownerDocument.createDocumentFragment()
        if (before) replacement.append(element.ownerDocument.createTextNode(before))
        replacement.append(wrapper)
        if (after) replacement.append(element.ownerDocument.createTextNode(after))
        node.replaceWith(replacement)
    }
}

function findBlockElement(content: HTMLElement, blockId: string): HTMLElement | null {
    const elements = content.querySelectorAll<HTMLElement>('[data-rebook-block="true"]')
    for (const element of elements) {
        if (element.dataset.blockId === blockId) return element
    }
    return null
}

export const createBrowserReflowableMarkLayerDecorator = (
    config: BrowserReflowableMarkLayerDecoratorConfig,
): BrowserReflowableMarkLayerDecorator =>
    new BrowserReflowableMarkLayerDecorator(config)
