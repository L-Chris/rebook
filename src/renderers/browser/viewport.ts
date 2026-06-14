import type { LayoutMode, RendererStyles } from '../../core/renderer'

export type BrowserViewportHostKind = 'reflowable' | 'fixed'

export interface BrowserViewportHostConfig {
    readonly container: HTMLElement
    readonly kind: BrowserViewportHostKind
    readonly styles?: RendererStyles
    readonly defaultColor?: string
}

export class BrowserViewportHost {
    readonly container: HTMLElement
    readonly scroller: HTMLElement
    readonly scrollExtent: HTMLElement
    readonly surfaceHost: HTMLElement
    private readonly defaultColor: string

    constructor(config: BrowserViewportHostConfig) {
        this.container = config.container
        this.defaultColor = config.defaultColor ?? 'inherit'
        this.scroller = document.createElement('div')
        this.scroller.dataset.rebookViewportScroller = 'true'
        this.scroller.style.cssText = `
            width: 100%;
            height: 100%;
            overflow: auto;
            position: relative;
            box-sizing: border-box;
        `

        this.scrollExtent = document.createElement('div')
        this.surfaceHost = document.createElement('div')
        if (config.kind === 'fixed') {
            this.configureFixedHost()
        } else {
            this.configureReflowableHost()
        }

        this.applyStyles(config.styles ?? {})
        this.container.append(this.scroller)
    }

    applyStyles(styles: RendererStyles): void {
        this.scroller.style.color = styles.color ?? this.defaultColor
        this.scroller.style.background = styles.background ?? 'transparent'
    }

    setOverflowForLayout(mode: LayoutMode): void {
        this.scroller.style.overflow = mode === 'paginated' ? 'hidden' : 'auto'
    }

    resetScrollExtent(): void {
        this.scrollExtent.style.height = '100%'
    }

    setScrollExtentHeight(height: number): void {
        this.scrollExtent.style.height = `${Math.max(0, height)}px`
    }

    destroy(): void {
        this.scroller.remove()
    }

    private configureReflowableHost(): void {
        this.scrollExtent.style.cssText = 'position: relative; width: 100%; min-height: 100%;'
        this.surfaceHost.style.cssText = 'position: absolute; top: 0; left: 0; right: 0;'
        this.scrollExtent.append(this.surfaceHost)
        this.scroller.append(this.scrollExtent)
    }

    private configureFixedHost(): void {
        this.scrollExtent.style.cssText = `
            min-height: 100%;
            box-sizing: border-box;
            display: flex;
            align-items: flex-start;
            justify-content: center;
        `
        this.surfaceHost.style.cssText = 'display: contents;'
        this.scrollExtent.append(this.surfaceHost)
        this.scroller.append(this.scrollExtent)
    }
}

export const createBrowserViewportHost = (config: BrowserViewportHostConfig): BrowserViewportHost =>
    new BrowserViewportHost(config)
