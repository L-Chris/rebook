import { bookPositionMatchesReflowableRange } from '../../core/location'
import type { PageSurfaceDecorator } from '../../core/page-surface'
import type { ReaderMark } from '../../core/renderer'
import type { LineRange } from '../../core/pretext'
import type { BrowserPageSurface } from './compositor'
import {
    applyBrowserMarkDataset,
    getBrowserMarkClassNames,
} from './mark-style'

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
        element.classList.add(...getBrowserMarkClassNames(mark))
        applyBrowserMarkDataset(element, mark)
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

export const createBrowserReflowableMarkLayerDecorator = (
    config: BrowserReflowableMarkLayerDecoratorConfig,
): BrowserReflowableMarkLayerDecorator =>
    new BrowserReflowableMarkLayerDecorator(config)
