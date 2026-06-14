/**
 * Browser renderer for page-native fixed documents.
 *
 * This renderer owns fixed-page navigation state. Format-aware content
 * renderers build PageSurface objects, then the browser compositor mounts
 * content, text, annotation, and overlay layers.
 */

import type { FixedPageRenderer } from '../../core/fixed-document'
import { FixedPageSequence } from '../../core/fixed-page-sequence'
import {
    createFixedPageContentRenderContext,
    getFixedSpreadPageLayouts,
    getFixedVisiblePageCount,
    resolveFixedPageFit,
    resolveFixedSpreadFit,
    type FixedSpreadFit,
    type FixedViewportMetrics,
} from '../../core/fixed-page-model'
import type { FixedPageInfo } from '../../core/fixed-document'
import type { Book, LinkEvent, LoadEvent, RelocateEvent } from '../../core/types'
import type { EventListener, LayoutMode, ReaderMark, RendererConfig, RendererStyles } from '../../core/renderer'
import { UnsupportedFormatError } from '../../core/errors'
import { RendererEventDispatcher } from '../../core/renderer-state'
import type { BrowserPageCompositor, BrowserPageSurface } from './compositor'
import {
    BrowserFixedContentRenderer,
    type BrowserFixedContentRenderContext,
    type BrowserFixedSpreadPageRenderContext,
    type BrowserFixedVisualRenderer,
} from './fixed-content'
import { BrowserFixedMarkLayerDecorator } from './fixed-mark-layer'
import { BrowserSurfacePipeline } from './surface-pipeline'
import { BrowserSurfaceHost } from './surface-host'
import type { BrowserContentEngine } from './content-engine'

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
const DEFAULT_GAP = 32
const DEFAULT_MIN_COLUMN_WIDTH = 320

export class BrowserFixedRenderer implements BrowserContentEngine {
    private readonly host: BrowserSurfaceHost
    private readonly events = new RendererEventDispatcher<RendererEventMap>()
    private readonly beforeNavigate: RendererConfig['beforeNavigate']
    private readonly surfacePipeline: BrowserSurfacePipeline<BrowserFixedContentRenderContext>
    private readonly scroller: HTMLElement
    private readonly pageHost: HTMLElement
    private sequence: FixedPageSequence | null = null
    private styles: RendererStyles
    private layoutMode: LayoutMode
    private maxColumnCount: number
    private lastLocation: RelocateEvent | null = null
    private readonly devicePixelRatio?: number | (() => number)
    private wheelNavigationPending = false
    private visiblePageCount = 1

    constructor(config: BrowserFixedRendererConfig) {
        this.styles = config.styles ?? {}
        this.layoutMode = config.layout ?? 'paginated'
        this.maxColumnCount = config.maxColumnCount ?? 1
        this.beforeNavigate = config.beforeNavigate
        this.devicePixelRatio = config.devicePixelRatio

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
        this.scroller.addEventListener('wheel', this.handleWheel, { passive: false })
    }

    async open(book: Book): Promise<void> {
        if (!book.fixedDocument) {
            throw new UnsupportedFormatError('BrowserFixedRenderer requires a fixedDocument book')
        }

        this.sequence = await FixedPageSequence.fromBook(book)
        await this.renderCurrentPage('open')
    }

    async goTo(target: number | string): Promise<void> {
        if (!this.sequence?.goTo(target)) return
        await this.renderCurrentPage('goto')
    }

    async next(): Promise<void> {
        if (!await this.canNavigate('next')) return
        const step = this.getNavigationStep()
        const target = (this.sequence?.pageIndex ?? 0) + step
        if (!this.sequence || target >= this.sequence.pageCount || !this.sequence.goTo(target)) return
        await this.renderCurrentPage('page')
    }

    async prev(): Promise<void> {
        if (!await this.canNavigate('prev')) return
        const step = this.getNavigationStep()
        const target = Math.max(0, (this.sequence?.pageIndex ?? 0) - step)
        if (!this.sequence || target === this.sequence.pageIndex || !this.sequence.goTo(target)) return
        await this.renderCurrentPage('page')
    }

    async goToFraction(fraction: number): Promise<void> {
        if (!this.sequence?.goToFraction(fraction)) return
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

    setSpread(maxColumns: number): void {
        this.maxColumnCount = Math.max(1, maxColumns)
        void this.renderCurrentPage('spread')
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
        return this.sequence?.getSectionFractions() ?? []
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
        this.scroller.removeEventListener('wheel', this.handleWheel)
        this.surfacePipeline.destroy()
        this.host.destroy({ compositor: false })
        this.events.clear()
        this.sequence = null
    }

    private async renderCurrentPage(reason: string): Promise<void> {
        const sequence = this.sequence
        const page = sequence?.currentPage
        if (!sequence || !page) return

        const renderPlan = this.createRenderPlan(sequence, page)
        const { fit } = renderPlan
        this.pageHost.style.padding = `${fit.margin}px`
        const rendered = await this.surfacePipeline.render(renderPlan.context)
        if (!rendered) return

        this.visiblePageCount = renderPlan.pageCount
        this.applyPageAlignment(renderPlan.blockSize, fit.margin)
        this.scroller.scrollTop = 0
        this.emit('load', { doc: getLoadDocument(rendered.surface), index: page.index })
        this.emitRelocate(reason)
    }

    private applyPageAlignment(pageHeight: number, margin: number): void {
        const totalBlockSize = pageHeight + margin * 2
        this.pageHost.style.alignItems = totalBlockSize <= Math.max(1, this.scroller.clientHeight)
            ? 'center'
            : 'flex-start'
    }

    private getViewportMetrics(): FixedViewportMetrics {
        return {
            inlineSize: this.scroller.clientWidth,
            blockSize: this.scroller.clientHeight,
        }
    }

    private createRenderPlan(sequence: FixedPageSequence, page: FixedPageInfo): FixedRenderPlan {
        const pages = this.getVisiblePages(sequence)
        if (pages.length <= 1) {
            const fit = resolveFixedPageFit(page, this.getViewportMetrics(), {
                margin: this.styles.margin,
                maxInlineSize: this.styles.maxInlineSize,
                maxColumnWidth: this.styles.maxColumnWidth,
                defaultMargin: DEFAULT_MARGIN,
                devicePixelRatio: this.getDevicePixelRatio(),
            })
            return {
                fit,
                context: createFixedPageContentRenderContext(sequence.document, page, this.styles, fit),
                blockSize: fit.viewport.cssHeight,
                pageCount: 1,
            }
        }

        const fit = this.resolveSpreadFit(pages)
        const contexts = this.createSpreadPageContexts(sequence, pages, fit)
        return {
            fit,
            context: {
                document: sequence.document,
                styles: this.styles,
                pages: contexts,
                width: fit.spreadWidth,
                height: fit.spreadHeight,
                scale: fit.scale,
            },
            blockSize: fit.spreadHeight * fit.scale,
            pageCount: pages.length,
        }
    }

    private getVisiblePages(sequence: FixedPageSequence): readonly FixedPageInfo[] {
        const page = sequence.currentPage
        if (!page || this.getRequestedColumnCount() < 2) return page ? [page] : []
        const nextPage = sequence.pages[sequence.pageIndex + 1]
        return nextPage ? [page, nextPage] : [page]
    }

    private getRequestedColumnCount(): number {
        return getFixedVisiblePageCount(this.layoutMode, this.maxColumnCount, this.getViewportMetrics(), {
            margin: this.styles.margin,
            gap: this.styles.gap,
            minColumnWidth: this.styles.minColumnWidth,
            defaultMargin: DEFAULT_MARGIN,
            defaultGap: DEFAULT_GAP,
            defaultMinColumnWidth: DEFAULT_MIN_COLUMN_WIDTH,
        })
    }

    private resolveSpreadFit(pages: readonly FixedPageInfo[]): FixedSpreadFit {
        return resolveFixedSpreadFit(pages, this.getViewportMetrics(), {
            margin: this.styles.margin,
            gap: this.styles.gap,
            maxInlineSize: this.styles.maxInlineSize,
            maxColumnWidth: this.styles.maxColumnWidth,
            defaultMargin: DEFAULT_MARGIN,
            defaultGap: DEFAULT_GAP,
            devicePixelRatio: this.getDevicePixelRatio(),
        })
    }

    private createSpreadPageContexts(
        sequence: FixedPageSequence,
        pages: readonly FixedPageInfo[],
        fit: FixedSpreadFit,
    ): BrowserFixedSpreadPageRenderContext[] {
        return getFixedSpreadPageLayouts(pages, fit, {
            devicePixelRatio: this.getDevicePixelRatio(),
        }).map(item => ({
            context: createFixedPageContentRenderContext(sequence.document, item.page, this.styles, {
                ...fit,
                viewport: item.viewport,
            }),
            x: item.x,
            y: item.y,
        }))
    }

    private getDevicePixelRatio(): number {
        const value = typeof this.devicePixelRatio === 'function'
            ? this.devicePixelRatio()
            : this.devicePixelRatio
        const fallback = globalThis.devicePixelRatio
        const resolved = value ?? (typeof fallback === 'number' ? fallback : 1)
        return Number.isFinite(resolved) && resolved > 0 ? resolved : 1
    }

    private emitRelocate(reason: string): void {
        const event = this.sequence?.getLocation(reason)
        if (!event) return
        this.lastLocation = event
        this.emit('relocate', event)
    }

    private emit<K extends keyof RendererEventMap>(event: K, payload: RendererEventMap[K]): void
    private emit(event: string, payload: unknown): void
    private emit(event: string, payload: unknown): void {
        this.events.emit(event, payload)
    }

    private async canNavigate(direction: 'next' | 'prev'): Promise<boolean> {
        return await this.beforeNavigate?.(direction) !== false
    }

    private readonly handleWheel = (event: WheelEvent): void => {
        if (Math.abs(event.deltaY) < 2) return
        event.preventDefault()
        if (this.wheelNavigationPending) return

        this.wheelNavigationPending = true
        const navigation = event.deltaY > 0 ? this.next() : this.prev()
        void navigation.finally(() => {
            this.wheelNavigationPending = false
        })
    }

    private getNavigationStep(): number {
        return Math.max(1, this.visiblePageCount)
    }
}

interface FixedRenderPlan {
    fit: FixedPageFitLike
    context: BrowserFixedContentRenderContext
    blockSize: number
    pageCount: number
}

interface FixedPageFitLike {
    margin: number
}

function getLoadDocument(surface: BrowserPageSurface): unknown {
    if (surface.metadata?.textLayer) return surface.metadata.textLayer
    const pages = surface.metadata?.pages
    if (Array.isArray(pages)) {
        const first = pages[0] as { surface?: BrowserPageSurface } | undefined
        return first?.surface?.metadata?.textLayer ?? surface
    }
    return surface
}

export const createBrowserFixedRenderer = (config: BrowserFixedRendererConfig): BrowserFixedRenderer =>
    new BrowserFixedRenderer(config)
