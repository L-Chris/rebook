import type { LayoutMode, RendererStyles } from '../../core/renderer'
import type { BrowserPageComposeResult, BrowserPageSurface } from './compositor'
import { BrowserPageCompositor } from './compositor'
import {
    BrowserViewportHost,
    type BrowserViewportHostKind,
} from './viewport'

export interface BrowserSurfaceHostConfig {
    readonly container: HTMLElement
    readonly kind: BrowserViewportHostKind
    readonly styles?: RendererStyles
    readonly defaultColor?: string
    readonly compositor?: BrowserPageCompositor
    readonly pageBackground?: string
    readonly pageShadow?: string
}

export class BrowserSurfaceHost {
    readonly viewport: BrowserViewportHost
    readonly compositor: BrowserPageCompositor

    constructor(config: BrowserSurfaceHostConfig) {
        this.viewport = new BrowserViewportHost({
            container: config.container,
            kind: config.kind,
            styles: config.styles,
            defaultColor: config.defaultColor,
        })
        this.compositor = config.compositor ?? new BrowserPageCompositor({
            host: this.viewport.surfaceHost,
            pageBackground: config.pageBackground,
            pageShadow: config.pageShadow,
        })
    }

    get scroller(): HTMLElement {
        return this.viewport.scroller
    }

    get scrollExtent(): HTMLElement {
        return this.viewport.scrollExtent
    }

    get surfaceHost(): HTMLElement {
        return this.viewport.surfaceHost
    }

    applyStyles(styles: RendererStyles): void {
        this.viewport.applyStyles(styles)
    }

    setOverflowForLayout(mode: LayoutMode): void {
        this.viewport.setOverflowForLayout(mode)
    }

    resetScrollExtent(): void {
        this.viewport.resetScrollExtent()
    }

    setScrollExtentHeight(height: number): void {
        this.viewport.setScrollExtentHeight(height)
    }

    compose(surface: BrowserPageSurface): BrowserPageComposeResult {
        return this.compositor.compose(surface)
    }

    clear(): void {
        this.compositor.clear()
    }

    destroy(): void {
        this.compositor.destroy()
        this.viewport.destroy()
    }
}

export const createBrowserSurfaceHost = (config: BrowserSurfaceHostConfig): BrowserSurfaceHost =>
    new BrowserSurfaceHost(config)
