import { getFixedPositionRects, type Rect } from '../../core/location'
import type { PageSurfaceDecorator } from '../../core/page-surface'
import type { ReaderMark } from '../../core/renderer'
import type { BrowserPageSurface, BrowserPageSurfaceLayer } from './compositor'

export interface BrowserFixedMarkLayerDecoratorConfig {
    readonly getMarks: () => readonly ReaderMark[]
}

interface PageMarkRect {
    readonly mark: ReaderMark
    readonly rect: Rect
}

export class BrowserFixedMarkLayerDecorator implements PageSurfaceDecorator<BrowserPageSurface> {
    readonly id = 'browser-fixed-mark-layer'
    private readonly getMarks: () => readonly ReaderMark[]

    constructor(config: BrowserFixedMarkLayerDecoratorConfig) {
        this.getMarks = config.getMarks
    }

    decorate(surface: BrowserPageSurface): BrowserPageSurface {
        const annotationLayer = createMarkLayer(surface, this.getMarks())
        if (!annotationLayer) return surface
        const layers = [...surface.layers, annotationLayer]
        return {
            ...surface,
            layers,
            destroy() {
                annotationLayer.destroy?.()
                surface.destroy?.()
            },
        }
    }
}

function createMarkLayer(surface: BrowserPageSurface, marks: readonly ReaderMark[]): BrowserPageSurfaceLayer | null {
    const rects = getPageMarkRects(surface, marks)
    if (rects.length === 0) return null

    const layer = document.createElement('div')
    layer.dataset.rebookAnnotationLayer = 'true'
    layer.style.pointerEvents = 'none'
    layer.style.userSelect = 'none'

    for (const item of rects) {
        const element = document.createElement('div')
        element.dataset.rebookAnnotation = 'true'
        element.dataset.markId = item.mark.id
        if (item.mark.kind) element.dataset.markKind = item.mark.kind
        element.classList.add(...getMarkClassNames(item.mark))
        element.style.cssText = `
            position: absolute;
            left: ${item.rect.x}px;
            top: ${item.rect.y}px;
            width: ${item.rect.width}px;
            height: ${item.rect.height}px;
            background: ${getMarkColor(item.mark)};
            border-radius: 2px;
            pointer-events: none;
            box-sizing: border-box;
        `
        layer.append(element)
    }

    return {
        id: 'annotation',
        kind: 'annotation',
        contentKind: 'dom',
        content: layer,
        zIndex: 20,
        selectable: false,
        pointerEvents: 'none',
        destroy() {
            layer.remove()
        },
    }
}

function getPageMarkRects(surface: BrowserPageSurface, marks: readonly ReaderMark[]): PageMarkRect[] {
    const format = surface.location?.type === 'fixed' ? surface.location.format : undefined
    const pageIndex = surface.pageIndex
    if (format === undefined || pageIndex === undefined) return getImagePageMarkRects(surface, marks)

    const output: PageMarkRect[] = []
    for (const mark of marks) {
        for (const rect of getFixedPositionRects(mark.location, { format, pageIndex })) {
            output.push({ mark, rect })
        }
    }
    return output
}

function getImagePageMarkRects(surface: BrowserPageSurface, marks: readonly ReaderMark[]): PageMarkRect[] {
    const pageIndex = surface.location?.type === 'image' ? surface.location.pageIndex : surface.pageIndex
    if (pageIndex === undefined) return []

    const output: PageMarkRect[] = []
    for (const mark of marks) {
        for (const rect of getFixedPositionRects(mark.location, { format: '', pageIndex })) {
            output.push({ mark, rect })
        }
    }
    return output
}

function getMarkClassNames(mark: ReaderMark): string[] {
    const names = mark.className?.trim().split(/\s+/).filter(Boolean) ?? []
    if (mark.kind) names.push(`rebook-mark-${toKebabCase(mark.kind)}`)
    return names.length ? names : ['rebook-mark']
}

function getMarkColor(mark: ReaderMark): string {
    const color = mark.data?.color
    return typeof color === 'string' ? color : 'rgba(255, 214, 10, 0.35)'
}

function toKebabCase(value: string): string {
    return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase()
}

export const createBrowserFixedMarkLayerDecorator = (
    config: BrowserFixedMarkLayerDecoratorConfig,
): BrowserFixedMarkLayerDecorator =>
    new BrowserFixedMarkLayerDecorator(config)
