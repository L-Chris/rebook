import type { PageCompositor, PageSurface, PageSurfaceLayer } from '../../core/page-surface'
import type { RendererStyles } from '../../core/renderer'
import { resolveRendererStyles } from '../../core/theme'

export interface BrowserPageSurfaceLayer extends PageSurfaceLayer<HTMLElement> {}

export interface BrowserPageSurface extends PageSurface<BrowserPageSurfaceLayer> {}

export interface BrowserSpreadPageSurface {
    readonly x: number
    readonly y: number
    readonly surface: BrowserPageSurface
}

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
    private readonly defaultPageBackground: string
    private readonly defaultPageShadow: string
    private pageBackground: string
    private pageShadow: string
    private currentSurface: BrowserPageSurface | null = null
    private currentFrame: HTMLElement | null = null

    constructor(config: BrowserPageCompositorConfig) {
        this.host = config.host
        this.defaultPageBackground = config.pageBackground ?? DEFAULT_PAGE_BACKGROUND
        this.defaultPageShadow = config.pageShadow ?? DEFAULT_PAGE_SHADOW
        this.pageBackground = this.defaultPageBackground
        this.pageShadow = this.defaultPageShadow
    }

    applyStyles(styles: RendererStyles): void {
        const resolved = resolveRendererStyles(styles)
        this.pageBackground = resolved.pageBackground ?? this.defaultPageBackground
        this.pageShadow = resolved.pageShadow ?? this.defaultPageShadow
        if (this.currentSurface && this.currentFrame) {
            this.applyFrameStyles(this.currentFrame, this.currentSurface)
        }
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
            background: transparent;
            box-shadow: none;
            overflow: hidden;
            flex: 0 0 auto;
        `

        if (surface.kind === 'spread') mountSpreadPages(frame, surface, this.pageBackground, this.pageShadow)

        for (const layer of surface.layers) {
            mountLayer(frame, surface, layer)
        }

        this.host.replaceChildren(frame)
        this.currentSurface = surface
        this.currentFrame = frame
        this.applyFrameStyles(frame, surface)
        return { frame, surface }
    }

    clear(): void {
        this.currentSurface?.destroy?.()
        this.currentSurface = null
        this.currentFrame = null
        this.host.replaceChildren()
    }

    destroy(): void {
        this.clear()
    }

    private applyFrameStyles(frame: HTMLElement, surface: BrowserPageSurface): void {
        const pageLike = surface.kind === 'fixed-page' || surface.kind === 'image-page'
        frame.style.background = pageLike ? this.pageBackground : 'transparent'
        frame.style.boxShadow = pageLike ? this.pageShadow : 'none'
        for (const pageFrame of frame.querySelectorAll<HTMLElement>('[data-rebook-spread-page="true"]')) {
            pageFrame.style.background = this.pageBackground
            pageFrame.style.boxShadow = this.pageShadow
        }
    }
}

function mountSpreadPages(frame: HTMLElement, surface: BrowserPageSurface, pageBackground: string, pageShadow: string): void {
    for (const item of getBrowserSpreadPages(surface)) {
        const pageFrame = document.createElement('div')
        pageFrame.dataset.rebookSpreadPage = 'true'
        if (item.surface.pageIndex !== undefined) pageFrame.dataset.pageIndex = String(item.surface.pageIndex)
        pageFrame.style.cssText = `
            position: absolute;
            left: ${item.x * surface.scale}px;
            top: ${item.y * surface.scale}px;
            width: ${item.surface.width * item.surface.scale}px;
            height: ${item.surface.height * item.surface.scale}px;
            background: ${pageBackground};
            box-shadow: ${pageShadow};
            overflow: hidden;
            box-sizing: border-box;
        `
        for (const layer of item.surface.layers) mountLayer(pageFrame, item.surface, layer)
        frame.append(pageFrame)
    }
}

function mountLayer(frame: HTMLElement, surface: BrowserPageSurface, layer: BrowserPageSurfaceLayer): void {
    const element = layer.content
    const preScaledRasterLayer = isPreScaledRasterLayer(layer)
    element.dataset.rebookSurfaceLayer = layer.id
    element.dataset.rebookSurfaceLayerKind = layer.kind
    element.dataset.rebookSurfaceLayerContent = layer.contentKind
    element.style.position = 'absolute'
    element.style.left = '0'
    element.style.top = '0'
    element.style.width = `${preScaledRasterLayer ? surface.width * surface.scale : surface.width}px`
    element.style.height = `${preScaledRasterLayer ? surface.height * surface.scale : surface.height}px`
    element.style.transform = preScaledRasterLayer ? element.style.transform : mergeScaleTransform(element.style.transform, surface.scale)
    element.style.transformOrigin = '0 0'
    element.style.zIndex = String(layer.zIndex ?? defaultLayerZIndex(layer.kind))
    element.style.pointerEvents = layer.pointerEvents ?? (layer.kind === 'content' ? 'none' : 'auto')
    element.style.userSelect = layer.selectable === false ? 'none' : 'text'
    if (layer.opacity !== undefined) element.style.opacity = String(layer.opacity)
    frame.append(element)
}

function isPreScaledRasterLayer(layer: BrowserPageSurfaceLayer): boolean {
    return layer.kind === 'content' && (
        layer.contentKind === 'canvas' ||
        layer.contentKind === 'image' ||
        layer.contentKind === 'texture'
    )
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

export function getBrowserSpreadPages(surface: BrowserPageSurface): readonly BrowserSpreadPageSurface[] {
    const pages = surface.metadata?.pages
    if (!Array.isArray(pages)) return []
    return pages.filter(isBrowserSpreadPageSurface)
}

function isBrowserSpreadPageSurface(value: unknown): value is BrowserSpreadPageSurface {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<BrowserSpreadPageSurface>
    return typeof candidate.x === 'number' &&
        typeof candidate.y === 'number' &&
        Boolean(candidate.surface)
}
