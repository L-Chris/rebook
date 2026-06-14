import type { PageCompositor, PageSurface, PageSurfaceLayer } from '../../core/page-surface'

export interface BrowserPageSurfaceLayer extends PageSurfaceLayer<HTMLElement> {}

export interface BrowserPageSurface extends PageSurface<BrowserPageSurfaceLayer> {}

export interface BrowserPageCompositorConfig {
    readonly host: HTMLElement
    readonly pageBackground?: string
    readonly pageShadow?: string
}

export interface BrowserPageComposeResult {
    readonly frame: HTMLElement
    readonly surface: BrowserPageSurface
}

const DEFAULT_PAGE_BACKGROUND = '#ffffff'
const DEFAULT_PAGE_SHADOW = '0 1px 4px rgba(0, 0, 0, 0.18)'

export class BrowserPageCompositor implements PageCompositor<BrowserPageSurface, undefined, BrowserPageComposeResult> {
    readonly id = 'browser-page-compositor'
    private readonly host: HTMLElement
    private readonly pageBackground: string
    private readonly pageShadow: string
    private currentSurface: BrowserPageSurface | null = null

    constructor(config: BrowserPageCompositorConfig) {
        this.host = config.host
        this.pageBackground = config.pageBackground ?? DEFAULT_PAGE_BACKGROUND
        this.pageShadow = config.pageShadow ?? DEFAULT_PAGE_SHADOW
    }

    compose(surface: BrowserPageSurface): BrowserPageComposeResult {
        this.currentSurface?.destroy?.()

        const frame = document.createElement('div')
        frame.dataset.rebookPageSurface = 'true'
        frame.dataset.rebookSurfaceKind = surface.kind
        if (surface.kind === 'fixed-page' || surface.kind === 'image-page') {
            frame.dataset.rebookFixedPage = 'true'
        }
        if (surface.pageIndex !== undefined) {
            frame.dataset.pageIndex = String(surface.pageIndex)
        }
        frame.style.cssText = `
            position: relative;
            width: ${surface.width * surface.scale}px;
            height: ${surface.height * surface.scale}px;
            background: ${this.pageBackground};
            box-shadow: ${this.pageShadow};
            overflow: hidden;
            flex: 0 0 auto;
        `

        for (const layer of surface.layers) {
            mountLayer(frame, surface, layer)
        }

        this.host.replaceChildren(frame)
        this.currentSurface = surface
        return { frame, surface }
    }

    clear(): void {
        this.currentSurface?.destroy?.()
        this.currentSurface = null
        this.host.replaceChildren()
    }

    destroy(): void {
        this.clear()
    }
}

function mountLayer(frame: HTMLElement, surface: BrowserPageSurface, layer: BrowserPageSurfaceLayer): void {
    const element = layer.content
    element.dataset.rebookSurfaceLayer = layer.id
    element.dataset.rebookSurfaceLayerKind = layer.kind
    element.dataset.rebookSurfaceLayerContent = layer.contentKind
    element.style.position = 'absolute'
    element.style.left = '0'
    element.style.top = '0'
    element.style.width = `${surface.width}px`
    element.style.height = `${surface.height}px`
    element.style.transform = mergeScaleTransform(element.style.transform, surface.scale)
    element.style.transformOrigin = '0 0'
    element.style.zIndex = String(layer.zIndex ?? defaultLayerZIndex(layer.kind))
    element.style.pointerEvents = layer.pointerEvents ?? (layer.kind === 'content' ? 'none' : 'auto')
    element.style.userSelect = layer.selectable === false ? 'none' : 'text'
    if (layer.opacity !== undefined) element.style.opacity = String(layer.opacity)
    frame.append(element)
}

function mergeScaleTransform(existing: string, scale: number): string {
    const ownScale = `scale(${scale})`
    return existing ? `${ownScale} ${existing}` : ownScale
}

function defaultLayerZIndex(kind: BrowserPageSurfaceLayer['kind']): number {
    switch (kind) {
        case 'content':
            return 0
        case 'text':
            return 10
        case 'annotation':
            return 20
        case 'overlay':
            return 30
        case 'interaction':
            return 40
        default:
            return 0
    }
}

export const createBrowserPageCompositor = (config: BrowserPageCompositorConfig): BrowserPageCompositor =>
    new BrowserPageCompositor(config)
