/**
 * Browser renderer for page-native fixed documents.
 *
 * This renderer owns browser page layout and layer composition. A format-aware
 * FixedPageRenderer can paint the visual page into canvas while the DOM text
 * layer stays available for selection and copying.
 */

import type {
    FixedDocument,
    FixedPageInfo,
    FixedPageRenderer,
    FixedPageTextLayer,
    FixedPageTextRun,
} from '../../core/fixed-document'
import type { Book, LinkEvent, LoadEvent, RelocateEvent, TOCItem } from '../../core/types'
import type { EventListener, LayoutMode, ReaderMark, Renderer, RendererConfig, RendererStyles } from '../../core/renderer'
import { UnsupportedFormatError } from '../../core/errors'
import { parseCSSPixels } from '../../core/renderer-utils'
import { isPdfFixedDocument } from '../../pdf/fixed-document'
import { BrowserPdfCanvasRenderer } from './pdf-canvas'

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
    devicePixelRatio?: number | (() => number)
}

const DEFAULT_MARGIN = 32
const DEFAULT_PAGE_BACKGROUND = '#ffffff'
const DEFAULT_TEXT_COLOR = '#111111'
const DEFAULT_FONT_FAMILY = 'sans-serif'
const DEFAULT_ASCENT_RATIO = 0.8

export class BrowserFixedRenderer implements Renderer {
    private readonly container: HTMLElement
    private readonly listeners = new Map<string, Set<Listener<unknown>>>()
    private readonly marks = new Map<string, ReaderMark>()
    private readonly beforeNavigate: RendererConfig['beforeNavigate']
    private readonly configuredFixedPageRenderer?: FixedPageRenderer<HTMLCanvasElement>
    private readonly defaultPdfPageRenderer = new BrowserPdfCanvasRenderer()
    private readonly devicePixelRatio?: number | (() => number)
    private scroller: HTMLElement
    private pageHost: HTMLElement
    private book: Book | null = null
    private document: FixedDocument | null = null
    private pages: readonly FixedPageInfo[] = []
    private styles: RendererStyles
    private layoutMode: LayoutMode
    private pageIndex = 0
    private lastLocation: RelocateEvent | null = null
    private renderToken = 0
    private readonly measureTextWidth = createCanvasTextMeasurer()
    private readonly measureFontAscentRatio = createCanvasFontAscentRatioMeasurer()

    constructor(config: BrowserFixedRendererConfig) {
        this.container = config.container
        this.styles = config.styles ?? {}
        this.layoutMode = config.layout ?? 'paginated'
        this.beforeNavigate = config.beforeNavigate
        this.configuredFixedPageRenderer = config.fixedPageRenderer
        this.devicePixelRatio = config.devicePixelRatio

        this.scroller = document.createElement('div')
        this.scroller.style.cssText = `
            width: 100%;
            height: 100%;
            overflow: auto;
            position: relative;
            box-sizing: border-box;
            color: ${this.styles.color ?? DEFAULT_TEXT_COLOR};
            background: ${this.styles.background ?? 'transparent'};
        `

        this.pageHost = document.createElement('div')
        this.pageHost.style.cssText = `
            min-height: 100%;
            box-sizing: border-box;
            display: flex;
            align-items: flex-start;
            justify-content: center;
        `

        this.scroller.append(this.pageHost)
        this.container.append(this.scroller)
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
        this.scroller.style.color = this.styles.color ?? DEFAULT_TEXT_COLOR
        this.scroller.style.background = this.styles.background ?? 'transparent'
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
        this.marks.set(mark.id, mark)
    }

    removeMark(id: string): void {
        this.marks.delete(id)
    }

    clearMarks(kind?: string): void {
        if (kind === undefined) {
            this.marks.clear()
            return
        }
        for (const [id, mark] of this.marks) {
            if (mark.kind === kind) this.marks.delete(id)
        }
    }

    getMarks(): ReaderMark[] {
        return Array.from(this.marks.values())
    }

    getLocation(): RelocateEvent | null {
        return this.lastLocation
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
        if (!this.listeners.has(event)) this.listeners.set(event, new Set())
        this.listeners.get(event)!.add(listener)
    }

    off<K extends keyof RendererEventMap>(event: K, listener: Listener<RendererEventMap[K]>): void
    off(event: string, listener: EventListener): void
    off(event: string, listener: Listener<unknown>): void {
        this.listeners.get(event)?.delete(listener)
    }

    destroy(): void {
        this.renderToken++
        this.scroller.remove()
        this.listeners.clear()
        this.marks.clear()
        this.book = null
        this.document = null
        this.pages = []
    }

    private async renderCurrentPage(reason: string): Promise<void> {
        const fixedDocument = this.document
        const page = this.pages[this.pageIndex]
        if (!fixedDocument || !page) return

        const token = ++this.renderToken
        const margin = parseCSSPixels(this.styles.margin, DEFAULT_MARGIN)
        const scale = this.getPageScale(page, margin)
        const frame = document.createElement('div')
        frame.dataset.pageIndex = String(page.index)
        frame.dataset.rebookFixedPage = 'true'
        frame.style.cssText = `
            position: relative;
            width: ${page.width * scale}px;
            height: ${page.height * scale}px;
            background: ${DEFAULT_PAGE_BACKGROUND};
            box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
            overflow: hidden;
            flex: 0 0 auto;
        `

        const textPromise = fixedDocument.getPageText
            ? fixedDocument.getPageText(page.index)
            : Promise.resolve(emptyTextLayer(page))
        const visualPromise = this.renderVisualLayer(fixedDocument, frame, page, scale)
        const [text, visualRendered] = await Promise.all([textPromise, visualPromise])
        if (token !== this.renderToken) return

        this.pageHost.replaceChildren()
        this.pageHost.style.padding = `${margin}px`

        const layer = document.createElement('div')
        layer.dataset.rebookFixedTextLayer = 'true'
        layer.style.cssText = `
            position: absolute;
            left: 0;
            top: 0;
            width: ${page.width}px;
            height: ${page.height}px;
            transform: scale(${scale});
            transform-origin: 0 0;
            user-select: text;
            z-index: 1;
        `

        renderTextLayer(layer, text, {
            color: visualRendered ? 'transparent' : this.styles.color ?? DEFAULT_TEXT_COLOR,
            fontFamily: this.styles.fontFamily,
            measureTextWidth: this.measureTextWidth,
            measureFontAscentRatio: this.measureFontAscentRatio,
        })

        frame.append(layer)
        this.pageHost.append(frame)
        this.scroller.scrollTop = 0
        this.emit('load', { doc: text, index: page.index })
        this.emitRelocate(reason)
    }

    private async renderVisualLayer(
        fixedDocument: FixedDocument,
        frame: HTMLElement,
        page: FixedPageInfo,
        scale: number,
    ): Promise<boolean> {
        const renderer = this.getFixedPageRenderer(fixedDocument)
        if (!renderer) return false

        const canvas = document.createElement('canvas')
        canvas.dataset.rebookFixedCanvas = 'true'
        canvas.style.cssText = `
            position: absolute;
            left: 0;
            top: 0;
            width: ${page.width * scale}px;
            height: ${page.height * scale}px;
            z-index: 0;
        `
        frame.append(canvas)
        try {
            await renderer.renderPage(fixedDocument, canvas, page.index, {
                scale,
                devicePixelRatio: this.getDevicePixelRatio(),
                intent: 'display',
                textLayer: false,
            })
            return true
        } catch {
            canvas.remove()
            return false
        }
    }

    private getFixedPageRenderer(fixedDocument: FixedDocument): FixedPageRenderer<HTMLCanvasElement> | undefined {
        if (this.configuredFixedPageRenderer) return this.configuredFixedPageRenderer
        return isPdfFixedDocument(fixedDocument) ? this.defaultPdfPageRenderer : undefined
    }

    private getDevicePixelRatio(): number {
        const configured = typeof this.devicePixelRatio === 'function'
            ? this.devicePixelRatio()
            : this.devicePixelRatio
        const ratio = configured ?? globalThis.devicePixelRatio ?? 1
        return Number.isFinite(ratio) && ratio > 0 ? ratio : 1
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
        for (const listener of this.listeners.get(event) ?? []) listener(payload)
    }

    private async canNavigate(direction: 'next' | 'prev'): Promise<boolean> {
        return await this.beforeNavigate?.(direction) !== false
    }
}

export const createBrowserFixedRenderer = (config: BrowserFixedRendererConfig): BrowserFixedRenderer =>
    new BrowserFixedRenderer(config)

interface TextLayerRenderOptions {
    color: string
    fontFamily?: string | number
    measureTextWidth?: ReturnType<typeof createCanvasTextMeasurer>
    measureFontAscentRatio?: ReturnType<typeof createCanvasFontAscentRatioMeasurer>
}

function renderTextLayer(target: HTMLElement, layer: FixedPageTextLayer, options: TextLayerRenderOptions): void {
    target.replaceChildren()
    for (const run of layer.runs) {
        const span = document.createElement('span')
        const matrix = run.transform
        const fontSize = run.fontSize ?? Math.max(Math.abs(matrix[0]), Math.abs(matrix[3]), 1)
        const fontFamily = String(options.fontFamily ?? run.fontFamily ?? DEFAULT_FONT_FAMILY)
        const fontStyle = run.fontStyle ?? 'normal'
        const fontWeight = run.fontWeight ?? 'normal'
        const x = matrix[4]
        const y = matrix[5]
        const ascentRatio = options.measureFontAscentRatio?.(fontSize, fontFamily, fontStyle, fontWeight) ?? DEFAULT_ASCENT_RATIO
        const ascent = fontSize * ascentRatio

        span.textContent = run.text
        span.style.position = 'absolute'
        span.style.whiteSpace = 'pre'
        span.style.left = `${x}px`
        span.style.top = `${y - ascent}px`
        span.style.fontSize = `${fontSize}px`
        span.style.fontFamily = fontFamily
        span.style.fontStyle = fontStyle
        span.style.fontWeight = fontWeight
        span.style.lineHeight = '1'
        span.style.transformOrigin = '0 0'
        span.style.color = options.color
        span.style.userSelect = 'text'

        if (run.width !== undefined) {
            const measured = options.measureTextWidth?.(run.text, fontSize, fontFamily, fontStyle, fontWeight)
            if (measured && measured > 0) span.style.transform = `scaleX(${run.width / measured})`
            else span.style.width = `${run.width}px`
        }

        target.append(span)
    }
}

function emptyTextLayer(page: FixedPageInfo): FixedPageTextLayer {
    return {
        pageIndex: page.index,
        width: page.width,
        height: page.height,
        runs: [],
        text: '',
    }
}

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

function createCanvasFontAscentRatioMeasurer(): ((fontSize: number, fontFamily: string, fontStyle?: string, fontWeight?: string) => number) | undefined {
    const canvas = document.createElement('canvas') as HTMLCanvasElement
    const context = canvas.getContext?.('2d')
    if (!context) return undefined
    const cache = new Map<string, number>()
    return (fontSize, fontFamily, fontStyle = 'normal', fontWeight = 'normal') => {
        const key = `${fontStyle}/${fontWeight}/${fontFamily}`
        const cached = cache.get(key)
        if (cached !== undefined) return cached
        context.font = `${fontStyle} ${fontWeight} ${Math.max(1, fontSize)}px ${fontFamily}`
        const metrics = context.measureText('')
        const ascent = metrics.fontBoundingBoxAscent
        const descent = Math.abs(metrics.fontBoundingBoxDescent)
        const ratio = ascent > 0 && ascent + descent > 0 ? ascent / (ascent + descent) : DEFAULT_ASCENT_RATIO
        cache.set(key, ratio)
        return ratio
    }
}

function createCanvasTextMeasurer(): ((text: string, fontSize: number, fontFamily: string, fontStyle?: string, fontWeight?: string) => number) | undefined {
    const canvas = document.createElement('canvas') as HTMLCanvasElement
    const context = canvas.getContext?.('2d')
    if (!context) return undefined
    return (text, fontSize, fontFamily, fontStyle = 'normal', fontWeight = 'normal') => {
        context.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`
        return context.measureText(text).width
    }
}
