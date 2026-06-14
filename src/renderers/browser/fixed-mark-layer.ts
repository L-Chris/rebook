import { resolveFixedMarkRects, type ResolvedMarkRect } from '../../core/mark-resolver'
import type { PageSurfaceDecorator } from '../../core/page-surface'
import type { ReaderMark } from '../../core/renderer'
import { getBrowserSpreadPages, type BrowserPageSurface, type BrowserPageSurfaceLayer } from './compositor'
import {
    applyBrowserMarkDataset,
    getBrowserMarkClassNames,
    getBrowserMarkColor,
} from './mark-style'

export interface BrowserFixedMarkLayerDecoratorConfig {
    readonly getMarks: () => readonly ReaderMark[]
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
        applyBrowserMarkDataset(element, item.mark)
        element.dataset.markId = item.mark.id
        if (item.mark.kind) element.dataset.markKind = item.mark.kind
        element.classList.add(...getBrowserMarkClassNames(item.mark))
        element.style.cssText = `
            position: absolute;
            left: ${item.rect.x}px;
            top: ${item.rect.y}px;
            width: ${item.rect.width}px;
            height: ${item.rect.height}px;
            background: ${getBrowserMarkColor(item.mark)};
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

function getPageMarkRects(surface: BrowserPageSurface, marks: readonly ReaderMark[]): ResolvedMarkRect[] {
    if (surface.kind === 'spread') return getSpreadMarkRects(surface, marks)

    const format = surface.location?.type === 'fixed' ? surface.location.format : undefined
    const pageIndex = surface.pageIndex
    if (format === undefined || pageIndex === undefined) return getImagePageMarkRects(surface, marks)

    return resolveFixedMarkRects(marks, { format, pageIndex })
}

function getImagePageMarkRects(surface: BrowserPageSurface, marks: readonly ReaderMark[]): ResolvedMarkRect[] {
    const pageIndex = surface.location?.type === 'image' ? surface.location.pageIndex : surface.pageIndex
    if (pageIndex === undefined) return []

    return resolveFixedMarkRects(marks, { pageIndex })
}

function getSpreadMarkRects(surface: BrowserPageSurface, marks: readonly ReaderMark[]): ResolvedMarkRect[] {
    const rects: ResolvedMarkRect[] = []
    for (const page of getBrowserSpreadPages(surface)) {
        const pageSurface = page.surface
        const pageIndex = pageSurface?.pageIndex
        const format = pageSurface?.location?.type === 'fixed' ? pageSurface.location.format : undefined
        if (pageIndex === undefined) continue
        const pageRects = format === undefined
            ? getImagePageMarkRects(pageSurface, marks)
            : resolveFixedMarkRects(marks, { format, pageIndex })
        for (const resolved of pageRects) {
            rects.push({
                ...resolved,
                rect: {
                    ...resolved.rect,
                    x: resolved.rect.x + page.x,
                    y: resolved.rect.y + page.y,
                },
            })
        }
    }
    return rects
}

export const createBrowserFixedMarkLayerDecorator = (
    config: BrowserFixedMarkLayerDecoratorConfig,
): BrowserFixedMarkLayerDecorator =>
    new BrowserFixedMarkLayerDecorator(config)
