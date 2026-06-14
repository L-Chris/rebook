import { bookPositionMatchesReflowableRange } from '../../core/location'
import type { PageSurfaceDecorator } from '../../core/page-surface'
import type { ReaderMark } from '../../core/renderer'
import type { LineRange } from '../../core/pretext'
import type { BrowserPageSurface } from './compositor'

export interface BrowserReflowableMarkLayerDecoratorConfig {
    readonly getMarks: () => readonly ReaderMark[]
}

export interface BrowserReflowableSurfaceMetadata extends Readonly<Record<string, unknown>> {
    readonly sectionIndex: number
    readonly lines: readonly LineRange[]
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

        for (const line of metadata.lines) {
            const element = content.querySelector(`[data-rebook-line-index="${String(line.index)}"]`) as HTMLElement | null
            if (!element) continue
            applyLineMarks(element, line, metadata.sectionIndex, this.getMarks())
        }
        return surface
    }
}

function getReflowableMetadata(surface: BrowserPageSurface): BrowserReflowableSurfaceMetadata | null {
    const metadata = surface.metadata
    if (!metadata) return null
    if (typeof metadata.sectionIndex !== 'number' || !Array.isArray(metadata.lines)) return null
    return metadata as BrowserReflowableSurfaceMetadata
}

function applyLineMarks(
    element: HTMLElement,
    line: LineRange,
    sectionIndex: number,
    marks: readonly ReaderMark[],
): void {
    const matching = marks.filter(mark => markMatchesLine(mark, line, sectionIndex))
    if (!matching.length) return
    element.dataset.markIds = matching.map(mark => mark.id).join(' ')
    element.dataset.markKinds = matching.map(mark => mark.kind).filter(Boolean).join(' ')
    for (const mark of matching) {
        element.classList.add(...getMarkClassNames(mark))
        for (const [key, value] of Object.entries(mark.data ?? {})) {
            element.dataset[`mark${toPascalCase(key)}`] = String(value)
        }
    }
}

function markMatchesLine(mark: ReaderMark, line: LineRange, sectionIndex: number): boolean {
    return bookPositionMatchesReflowableRange(mark.location, {
        sectionIndex,
        blockId: line.block?.id,
        startOffset: line.start?.cursor.graphemeIndex,
        endOffset: line.end?.cursor.graphemeIndex,
        offsetsReliable: (line.block?.segments.length ?? 0) === 1,
    })
}

function getMarkClassNames(mark: ReaderMark): string[] {
    const names = mark.className?.trim().split(/\s+/).filter(Boolean) ?? []
    if (mark.kind) names.push(`rebook-mark-${toKebabCase(mark.kind)}`)
    return names.length ? names : ['rebook-mark']
}

function toKebabCase(value: string): string {
    return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase()
}

function toPascalCase(value: string): string {
    return value
        .replace(/[^a-zA-Z0-9]+(.)/g, (_, char: string) => char.toUpperCase())
        .replace(/^[a-z]/, char => char.toUpperCase())
}

export const createBrowserReflowableMarkLayerDecorator = (
    config: BrowserReflowableMarkLayerDecoratorConfig,
): BrowserReflowableMarkLayerDecorator =>
    new BrowserReflowableMarkLayerDecorator(config)
