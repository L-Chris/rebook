import { resolveReflowableBlockMarks } from '../../core/mark-resolver'
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
    if (!matching.length) return
    element.dataset.markIds = matching.map(mark => mark.id).join(' ')
    element.dataset.markKinds = matching.map(mark => mark.kind).filter(Boolean).join(' ')
    element.style.backgroundColor = getBrowserMarkColor(matching[0]!)
    element.style.borderRadius = '4px'
    for (const mark of matching) {
        element.classList.add(...getBrowserMarkClassNames(mark))
        applyBrowserMarkDataset(element, mark)
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
