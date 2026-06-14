/**
 * Browser renderer for page-native fixed documents.
 *
 * This renderer owns fixed-page navigation state. Format-aware content
 * renderers build PageSurface objects, then the browser compositor mounts
 * content, text, annotation, and overlay layers.
 */

import type {
    FixedDocument,
    FixedPageInfo,
    FixedPageRenderer,
} from '../../core/fixed-document'
import type { Book, LinkEvent, LoadEvent, RelocateEvent, TOCItem } from '../../core/types'
import type { EventListener, LayoutMode, ReaderMark, Renderer, RendererConfig, RendererStyles } from '../../core/renderer'
import { UnsupportedFormatError } from '../../core/errors'
import { parseCSSPixels } from '../../core/renderer-utils'
import { RendererEventDispatcher } from '../../core/renderer-state'
import type { BrowserPageCompositor, BrowserPageSurface } from './compositor'
import { BrowserFixedContentRenderer, type BrowserFixedContentRenderContext, type BrowserFixedVisualRenderer } from './fixed-content'
import { BrowserFixedMarkLayerDecorator } from './fixed-mark-layer'
import { BrowserSurfacePipeline } from './surface-pipeline'
import { BrowserSurfaceHost } from './surface-host'

interface RendererEventMap {
    load: LoadEvent
    relocate: RelocateEvent
    link: LinkEvent
}

type Listener<T> = (event: T) => void

export interface BrowserFixedRendererConfig extends RendererConfig {
    /** The browser element to render into. */
    container: HTMLElement
    /**
     * Optional visual page renderer. When omitted, PDF fixed documents use the
     * built-in 2D canvas renderer and other formats render their text layer only.
     */
    fixedPageRenderer?: FixedPageRenderer<HTMLCanvasElement>
    fixedContentRenderer?: BrowserFixedContentRenderer
    /** Custom fixed-page visual renderers evaluated before built-in image/PDF renderers. */
    fixedVisualRenderers?: readonly BrowserFixedVisualRenderer[]
    pageCompositor?: BrowserPageCompositor
    devicePixelRatio?: number | (() => number)
}

const DEFAULT_MARGIN = 32
const DEFAULT_TEXT_COLOR = '#111111'

export class BrowserFixedRenderer implements Renderer {
    private readonly host: BrowserSurfaceHost
    private readonly events = new RendererEventDispatcher<RendererEventMap>()
    private readonly beforeNavigate: RendererConfig['beforeNavigate']
    private readonly surfacePipeline: BrowserSurfacePipeline<BrowserFixedContentRenderContext>
    private readonly scroller: HTMLElement
    private readonly pageHost: HTMLElement
    private book: Book | null = null
    private document: FixedDocument | null = null
    private pages: readonly FixedPageInfo[] = []
    private styles: RendererStyles
    private layoutMode: LayoutMode
    private pageIndex = 0
    private lastLocation: RelocateEvent | null = null

    constructor(config: BrowserFixedRendererConfig) {
        this.styles = config.styles ?? {}
        this.layoutMode = config.layout ?? 'paginated'
        this.beforeNavigate = config.beforeNavigate

        this.host = new BrowserSurfaceHost({
            container: config.container,
            kind: 'fixed',
            styles: this.styles,
            defaultColor: DEFAULT_TEXT_COLOR,
            compositor: config.pageCompositor,
        })
        this.scroller = this.host.scroller
        this.pageHost = this.host.scrollExtent
        const contentRenderer = config.fixedContentRenderer ?? new BrowserFixedContentRenderer({
            fixedPageRenderer: config.fixedPageRenderer,
            visualRenderers: config.fixedVisualRenderers,
            devicePixelRatio: config.devicePixelRatio,
        })
        this.surfacePipeline = new BrowserSurfacePipeline({
            contentRenderer,
            compositor: this.host.compositor,
            createDecorators: ({ getMarks }) => [
                new BrowserFixedMarkLayerDecorator({
                    getMarks,
                }),
            ],
        })
    }

    async open(book: Book): Promise<void> {
        if (!book.fixedDocument) {
            throw new UnsupportedFormatError('BrowserFixedRenderer requires a fixedDocument book')
        }

        this.book = book
        this.document = book.fixedDocument
        this.pages = await readFixedPages(book.fixedDocument)
        this.pageIndex = 0
        await this.renderCurrentPage('open')
    }

    async goTo(target: number | string): Promise<void> {
        if (!this.document) return
        const pageIndex = typeof target === 'number'
            ? target
            : this.book?.resolveHref?.(target)?.index ?? parsePageHref(target)
        if (pageIndex == null) return
        this.pageIndex = clampPageIndex(pageIndex, this.pages.length)
        await this.renderCurrentPage('goto')
    }

    async next(): Promise<void> {
        if (!await this.canNavigate('next')) return
        if (this.pageIndex >= this.pages.length - 1) return
        this.pageIndex++
        await this.renderCurrentPage('page')
    }

    async prev(): Promise<void> {
        if (!await this.canNavigate('prev')) return
        if (this.pageIndex <= 0) return
        this.pageIndex--
        await this.renderCurrentPage('page')
    }

    async goToFraction(fraction: number): Promise<void> {
        if (!this.pages.length) return
        const safe = Math.max(0, Math.min(1, fraction))
        this.pageIndex = clampPageIndex(Math.round(safe * (this.pages.length - 1)), this.pages.length)
        await this.renderCurrentPage('fraction')
    }

    setStyles(styles: RendererStyles): void {
        this.styles = { ...this.styles, ...styles }
        this.host.applyStyles(this.styles)
        void this.renderCurrentPage('styles')
    }

    setLayout(mode: LayoutMode): void {
        if (this.layoutMode === mode) return
        this.layoutMode = mode
        void this.renderCurrentPage('layout')
    }

    setSpread(_maxColumns: number): void {
        // Fixed renderer currently presents one page at a time.
    }

    setMark(mark: ReaderMark): void {
        this.surfacePipeline.setMark(mark)
        void this.renderCurrentPage('mark')
    }

    removeMark(id: string): void {
        this.surfacePipeline.removeMark(id)
        void this.renderCurrentPage('mark')
    }

    clearMarks(kind?: string): void {
        this.surfacePipeline.clearMarks(kind)
        void this.renderCurrentPage('mark')
    }

    getMarks(): ReaderMark[] {
        return this.surfacePipeline.getMarks()
    }

    getLocation(): RelocateEvent | null {
        return this.lastLocation
    }

    getCurrentSurface(): BrowserPageSurface | null {
        return this.surfacePipeline.getCurrentSurface()
    }

    getSectionFractions(): number[] {
        if (!this.pages.length) return []
        if (this.pages.length === 1) return [0, 1]
        return this.pages.map((_, index) => index / (this.pages.length - 1))
    }

    async refresh(): Promise<void> {
        await this.renderCurrentPage('refresh')
    }

    on<K extends keyof RendererEventMap>(event: K, listener: Listener<RendererEventMap[K]>): void
    on(event: string, listener: EventListener): void
    on(event: string, listener: Listener<unknown>): void {
        this.events.on(event, listener)
    }

    off<K extends keyof RendererEventMap>(event: K, listener: Listener<RendererEventMap[K]>): void
    off(event: string, listener: EventListener): void
    off(event: string, listener: Listener<unknown>): void {
        this.events.off(event, listener)
    }

    destroy(): void {
        this.surfacePipeline.destroy()
        this.host.destroy({ compositor: false })
        this.events.clear()
        this.book = null
        this.document = null
        this.pages = []
    }

    private async renderCurrentPage(reason: string): Promise<void> {
        const fixedDocument = this.document
        const page = this.pages[this.pageIndex]
        if (!fixedDocument || !page) return

        const margin = parseCSSPixels(this.styles.margin, DEFAULT_MARGIN)
        const scale = this.getPageScale(page, margin)
        this.pageHost.style.padding = `${margin}px`
        const rendered = await this.surfacePipeline.render({
            document: fixedDocument,
            page,
            scale,
            styles: this.styles,
        })
        if (!rendered) return

        this.scroller.scrollTop = 0
        this.emit('load', { doc: rendered.surface.metadata?.textLayer ?? rendered.surface, index: page.index })
        this.emitRelocate(reason)
    }

    private getPageScale(page: FixedPageInfo, margin: number): number {
        const availableWidth = Math.max(1, this.scroller.clientWidth - margin * 2)
        const maxInline = parseCSSPixels(this.styles.maxInlineSize, availableWidth)
        const targetWidth = Math.max(1, Math.min(availableWidth, maxInline))
        return targetWidth / Math.max(1, page.width)
    }

    private emitRelocate(reason: string): void {
        if (!this.pages.length) return
        const fraction = this.pages.length > 1 ? this.pageIndex / (this.pages.length - 1) : 0
        const pageItem = this.book?.pageList?.[this.pageIndex] ?? null
        const event: RelocateEvent = {
            index: this.pageIndex,
            fraction,
            totalFraction: fraction,
            pageItem,
            tocItem: this.getCurrentTOCItem(),
            reason,
        }
        this.lastLocation = event
        this.emit('relocate', event)
    }

    private getCurrentTOCItem(): TOCItem | null {
        const items = flattenTOC(this.book?.toc ?? [])
        let current: TOCItem | null = null
        for (const item of items) {
            const index = this.book?.resolveHref?.(item.href)?.index
            if (typeof index === 'number' && index <= this.pageIndex) current = item
        }
        return current
    }

    private emit<K extends keyof RendererEventMap>(event: K, payload: RendererEventMap[K]): void
    private emit(event: string, payload: unknown): void
    private emit(event: string, payload: unknown): void {
        this.events.emit(event, payload)
    }

    private async canNavigate(direction: 'next' | 'prev'): Promise<boolean> {
        return await this.beforeNavigate?.(direction) !== false
    }
}

export const createBrowserFixedRenderer = (config: BrowserFixedRendererConfig): BrowserFixedRenderer =>
    new BrowserFixedRenderer(config)

async function readFixedPages(document: FixedDocument): Promise<readonly FixedPageInfo[]> {
    if (document.getPages) return document.getPages()
    const pages: FixedPageInfo[] = []
    for (let index = 0; index < document.pageCount; index++) {
        pages.push(await document.getPage(index))
    }
    return pages
}

function parsePageHref(href: string): number | null {
    const match = href.match(/^pdf:page:(\d+)$/)
    return match ? Number(match[1]) : null
}

function clampPageIndex(index: number, pageCount: number): number {
    return Math.max(0, Math.min(Math.max(0, pageCount - 1), Math.trunc(index)))
}

function flattenTOC(items: readonly TOCItem[]): TOCItem[] {
    return items.flatMap(item => item.subitems?.length ? [item, ...flattenTOC(item.subitems)] : [item])
}
