/**
 * Browser renderer backed by the Pretext adapter.
 *
 * This renderer keeps the DOM small by rendering only visible line ranges.
 */

import type { BlockWindowEvent, Book, LinkEvent, LoadEvent, RelocateEvent, ResolvedNavigation, Section, TOCItem } from '../../core/types'
import type { LayoutMode, NavigationDirection, ReaderMark, RendererConfig, RendererStyles } from '../../core/renderer'
import { mergeRendererStyles, resolveRendererStyles, type ReaderThemeInput } from '../../core/theme'
import { debugRebook } from '../../core/debug'
import { getBlockWindowPrefetchPageCount } from '../../core/block-window'
import { RendererEventDispatcher } from '../../core/renderer-state'
import { flattenTOC } from '../../core/toc'
import { SectionProgress } from '../../utils/progress'
import {
    getAnchorIds,
    getLineHeightMultiplier,
    getPagePaddingBlock,
    getPagePaddingInline,
    getReadablePageCount,
    parseCSSPixels,
} from '../../core/renderer-utils'
import {
    clampReflowablePageIndex,
    findReadableReflowablePage,
    getReflowablePageIndexForScrollTop,
    getReflowablePageScrollTop,
    getReflowableScrollTopForFraction,
    getReflowableScrollTopForSourceTop,
    getReflowableSectionFraction,
    getReflowableSourceHeightForPages,
    getReflowableSourceScrollTop,
    getReflowableSourceViewport,
    getReflowableSourceViewportHeight,
    resolveReflowablePageGeometry,
    type ReflowableColumnLayout,
    type ReflowableViewportMetrics,
} from '../../core/reflowable-page-model'
import {
    getVisibleLines,
    layout as layoutText,
    prepare,
    prepareBlocks,
    type LineRange,
    type PreparedText,
    type TextBlock,
    type TextStyle,
} from '../../core/pretext'
import type { BrowserPageCompositor, BrowserPageSurface } from './compositor'
import {
    BrowserReflowableContentRenderer,
    type BrowserReflowableContentRenderContext,
} from './reflowable-content'
import { BrowserReflowableMarkLayerDecorator } from './reflowable-mark-layer'
import { BrowserSurfacePipeline } from './surface-pipeline'
import { BrowserSurfaceHost } from './surface-host'
import type { BrowserContentEngine } from './content-engine'

interface RendererEventMap {
    load: LoadEvent
    relocate: RelocateEvent
    link: LinkEvent
    'block-window': BlockWindowEvent
}

type Listener<T> = (event: T) => void

export interface BrowserRendererConfig extends RendererConfig {
    /** The browser element to render into. */
    container: HTMLElement
    reflowableContentRenderer?: BrowserReflowableContentRenderer
    pageCompositor?: BrowserPageCompositor
}

const RESIZE_DEBOUNCE_MS = 100
const DEFAULT_MARGIN = 32
const DEFAULT_COLUMN_GAP = 0
const DEFAULT_PAGE_PADDING_INLINE = 24
const DEFAULT_MIN_COLUMN_WIDTH = 360
const DEFAULT_MAX_COLUMN_WIDTH = 960

interface TOCPosition {
    index: number
    sourceTop: number
    order: number
    item: TOCItem
}

const debounce = <T extends (...args: unknown[]) => void>(fn: T, wait: number): T => {
    let timeout: ReturnType<typeof setTimeout>
    return ((...args: unknown[]) => {
        clearTimeout(timeout)
        timeout = setTimeout(() => fn(...args), wait)
    }) as T
}

export class BrowserRenderer implements BrowserContentEngine {
    private readonly host: BrowserSurfaceHost
    private readonly scroller: HTMLElement
    private readonly spacer: HTMLElement
    private readonly content: HTMLElement
    private book: Book | null = null
    private sections: readonly Section[] = []
    private currentIndex = -1
    private prepared: PreparedText | null = null
    private lines: LineRange[] = []
    private readonly surfacePipeline: BrowserSurfacePipeline<BrowserReflowableContentRenderContext>
    private styles: RendererStyles
    private maxColumnCount: number
    private columnLayout: ReflowableColumnLayout = {
        margin: DEFAULT_MARGIN,
        gap: DEFAULT_COLUMN_GAP,
        columnWidth: 0,
        columns: 1,
        pageHeight: 0,
        pageFrameHeight: 0,
        pageFrameTop: 0,
        columnHeight: 0,
        pagePaddingInline: DEFAULT_PAGE_PADDING_INLINE,
        pagePaddingInlineStart: DEFAULT_PAGE_PADDING_INLINE,
        pagePaddingInlineEnd: DEFAULT_PAGE_PADDING_INLINE,
        pagePaddingBlock: 0,
        pagePaddingBlockStart: 0,
        pagePaddingBlockEnd: 0,
        pageFit: 'viewport',
        totalHeight: 0,
        pageCount: 1,
    }
    private layoutMode: LayoutMode
    private pageIndex = 0
    private progress: SectionProgress | null = null
    private lastLocation: RelocateEvent | null = null
    private readonly events = new RendererEventDispatcher<RendererEventMap>()
    private resizeObserver: ResizeObserver
    private activeLoadId = 0
    private tocPositions: TOCPosition[] = []
    private pendingTOCItem: TOCItem | null = null
    private suppressNextScrollRelocate = false
    private prefetchPageCount = 0
    private beforeNavigate: RendererConfig['beforeNavigate']

    constructor(config: BrowserRendererConfig) {
        this.styles = resolveRendererStyles(config.styles ?? {})
        this.maxColumnCount = config.maxColumnCount ?? 2
        this.layoutMode = config.layout ?? 'paginated'
        this.beforeNavigate = config.beforeNavigate

        this.host = new BrowserSurfaceHost({
            container: config.container,
            kind: 'reflowable',
            styles: this.styles,
            compositor: config.pageCompositor,
            pageBackground: 'transparent',
            pageShadow: 'none',
        })
        this.scroller = this.host.scroller
        this.spacer = this.host.scrollExtent
        this.content = this.host.surfaceHost
        this.applyOverflowMode()

        const contentRenderer = config.reflowableContentRenderer ?? new BrowserReflowableContentRenderer()
        this.surfacePipeline = new BrowserSurfacePipeline({
            contentRenderer,
            compositor: this.host.compositor,
            createDecorators: ({ getMarks }) => [
                new BrowserReflowableMarkLayerDecorator({
                    getMarks,
                }),
            ],
        })

        this.scroller.addEventListener('scroll', () => {
            this.renderVisibleLines()
            if (this.suppressNextScrollRelocate) {
                this.suppressNextScrollRelocate = false
                return
            }
            this.emitRelocate('scroll')
            this.emitBlockWindow('scroll')
        }, { passive: true })
        this.scroller.addEventListener('wheel', (event) => {
            if (this.layoutMode !== 'paginated') return
            event.preventDefault()
            if (Math.abs(event.deltaY) < 2) return
            void (event.deltaY > 0 ? this.next() : this.prev())
        }, { passive: false })

        this.resizeObserver = new ResizeObserver(debounce(() => {
            const fraction = this.getSectionFraction()
            this.relayout()
            this.restoreSectionFraction(fraction)
            this.emitRelocate('resize')
            this.emitBlockWindow('resize')
        }, RESIZE_DEBOUNCE_MS))
        this.resizeObserver.observe(config.container)
    }

    async open(book: Book): Promise<void> {
        this.book = book
        this.sections = book.sections
        this.progress = new SectionProgress(this.sections)
        this.tocPositions = []
        this.pendingTOCItem = null
        this.currentIndex = -1
        this.pageIndex = 0
        this.lastLocation = null
        this.prepared = null
        this.lines = []
        this.surfacePipeline.clear()
        this.host.resetScrollExtent()
        this.scroller.scrollTop = 0
        this.prefetchPageCount = getBlockWindowPrefetchPageCount(book)
    }

    async goTo(target: number | string): Promise<void> {
        if (typeof target === 'number') {
            this.pendingTOCItem = null
            await this.loadSection(target)
            return
        }

        const resolved = this.book?.resolveHref?.(target) ?? this.resolveHrefFallback(target)
        if (resolved) {
            this.pendingTOCItem = this.findTOCItem(target)
            await this.loadSection(resolved.index, resolved.anchor, 0, target)
        } else {
            this.pendingTOCItem = null
        }
    }

    async next(): Promise<void> {
        if (!await this.canNavigate('next')) return

        if (this.layoutMode === 'paginated') {
            const nextPage = this.findReadablePage(this.pageIndex + 1, 1)
            if (nextPage != null) {
                this.pageIndex = nextPage
                this.applyPageScroll('page')
                return
            }
            if (this.currentIndex < this.sections.length - 1) {
                await this.loadSection(this.currentIndex + 1)
            }
            return
        }

        const maxScroll = this.scroller.scrollHeight - this.scroller.clientHeight
        if (this.scroller.scrollTop < maxScroll - 1) {
            this.scroller.scrollTop = Math.min(maxScroll, this.scroller.scrollTop + this.scroller.clientHeight)
            return
        }
        if (this.currentIndex < this.sections.length - 1) {
            await this.loadSection(this.currentIndex + 1)
        }
    }

    async prev(): Promise<void> {
        if (!await this.canNavigate('prev')) return

        if (this.layoutMode === 'paginated') {
            const previousPage = this.findReadablePage(this.pageIndex - 1, -1)
            if (previousPage != null) {
                this.pageIndex = previousPage
                this.applyPageScroll('page')
                return
            }
            if (this.currentIndex > 0) {
                await this.loadSection(this.currentIndex - 1)
                this.pageIndex = this.columnLayout.pageCount - 1
                this.applyPageScroll('page')
            }
            return
        }

        if (this.scroller.scrollTop > 1) {
            this.scroller.scrollTop = Math.max(0, this.scroller.scrollTop - this.scroller.clientHeight)
            return
        }
        if (this.currentIndex > 0) {
            await this.loadSection(this.currentIndex - 1)
            this.scroller.scrollTop = this.scroller.scrollHeight
        }
    }

    async goToFraction(fraction: number): Promise<void> {
        if (!this.progress) return
        const [index, sectionFraction] = this.progress.getSection(Math.max(0, Math.min(1, fraction)))
        await this.loadSection(index)
        if (this.layoutMode === 'paginated') {
            this.pageIndex = Math.min(
                this.columnLayout.pageCount - 1,
                Math.floor(sectionFraction * this.columnLayout.pageCount),
            )
            this.pageIndex = this.findReadablePage(this.pageIndex, 0) ?? this.pageIndex
            this.applyPageScroll('fraction')
            return
        }
        this.suppressNextScrollRelocate = true
        this.scroller.scrollTop = getReflowableScrollTopForFraction(
            this.layoutMode,
            this.columnLayout,
            this.getViewportMetrics(),
            sectionFraction,
        )
        this.renderVisibleLines()
        this.emitRelocate('fraction')
        this.emitBlockWindow('fraction')
    }

    setStyles(styles: RendererStyles): void {
        const fraction = this.getSectionFraction()
        this.styles = mergeRendererStyles(this.styles, styles)
        this.host.applyStyles(this.styles)
        if (this.currentIndex >= 0) {
            void this.loadSection(this.currentIndex, undefined, this.scrollTopForFraction(fraction))
        }
    }

    setTheme(theme: ReaderThemeInput): void {
        this.setStyles({ theme })
    }

    setLayout(mode: LayoutMode): void {
        if (this.layoutMode === mode) return
        const fraction = this.getSectionFraction()
        this.layoutMode = mode
        this.applyOverflowMode()
        this.relayout()
        this.restoreSectionFraction(fraction)
        this.emitRelocate('layout')
        this.emitBlockWindow('layout')
    }

    setSpread(maxColumns: number): void {
        const fraction = this.getSectionFraction()
        this.maxColumnCount = Math.max(1, maxColumns)
        this.relayout()
        this.restoreSectionFraction(fraction)
        this.emitRelocate('spread')
        this.emitBlockWindow('spread')
    }

    setMark(mark: ReaderMark): void {
        this.surfacePipeline.setMark(mark)
        this.renderVisibleLines()
    }

    removeMark(id: string): void {
        this.surfacePipeline.removeMark(id)
        this.renderVisibleLines()
    }

    clearMarks(kind?: string): void {
        this.surfacePipeline.clearMarks(kind)
        this.renderVisibleLines()
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
        return this.progress?.getFractions() ?? []
    }

    async refresh(): Promise<void> {
        if (this.currentIndex < 0) return
        const fraction = this.getSectionFraction()
        await this.loadSection(this.currentIndex, undefined, this.scrollTopForFraction(fraction))
    }

    on<K extends keyof RendererEventMap>(event: K, listener: Listener<RendererEventMap[K]>): void
    on(event: string, listener: Listener<unknown>): void
    on(event: string, listener: Listener<unknown>): void {
        this.events.on(event, listener)
    }

    off<K extends keyof RendererEventMap>(event: K, listener: Listener<RendererEventMap[K]>): void
    off(event: string, listener: Listener<unknown>): void
    off(event: string, listener: Listener<unknown>): void {
        this.events.off(event, listener)
    }

    destroy(): void {
        this.activeLoadId++
        this.resizeObserver.disconnect()
        this.surfacePipeline.destroy()
        this.host.destroy({ compositor: false })
        this.events.clear()
        this.book = null
    }

    private async loadSection(
        index: number,
        anchor?: ResolvedNavigation['anchor'],
        restoreScrollTop = 0,
        href?: string,
    ): Promise<void> {
        if (index < 0 || index >= this.sections.length) return
        const loadId = ++this.activeLoadId
        const section = this.sections[index]
        const blocks = await this.loadTextBlocks(section)
        if (loadId !== this.activeLoadId) return
        const segments = blocks.flatMap(block => block.segments)

        this.prepared = blocks.length > 0
            ? prepareBlocks(blocks, { baseStyle: this.getBaseTextStyle() })
            : prepare(segments, { baseStyle: this.getBaseTextStyle() })
        this.currentIndex = index
        this.pageIndex = this.layoutMode === 'paginated'
            ? getReflowablePageIndexForScrollTop(this.columnLayout, restoreScrollTop)
            : 0
        this.relayout()

        const anchorScrollTop = this.getAnchorScrollTop(anchor, href)
        const targetScrollTop = anchorScrollTop ?? restoreScrollTop
        if (this.layoutMode === 'paginated') {
            this.pageIndex = getReflowablePageIndexForScrollTop(this.columnLayout, targetScrollTop)
            this.pageIndex = clampReflowablePageIndex(this.pageIndex, this.columnLayout)
            this.pageIndex = this.findReadablePage(this.pageIndex, 0) ?? this.pageIndex
            this.suppressNextScrollRelocate = true
            this.scroller.scrollTop = getReflowablePageScrollTop(this.columnLayout, this.pageIndex)
        } else {
            this.suppressNextScrollRelocate = true
            this.scroller.scrollTop = targetScrollTop
        }

        this.renderVisibleLines()
        this.emit('load', { doc: { lines: this.lines, segments }, index })
        this.emitBlockWindow('load')
        this.emitRelocate('snap')
    }

    private async loadTextBlocks(section: Section): Promise<TextBlock[]> {
        if (section.getBlocks) return section.getBlocks()
        if (section.getSegments) {
            return [{
                id: `${section.id}-body`,
                type: 'container',
                segments: await section.getSegments(),
            }]
        }
        const text = section.loadText ? await section.loadText() : await section.load()
        return [{
            id: `${section.id}-body`,
            type: 'paragraph',
            segments: [{ text }],
        }]
    }

    private relayout(): void {
        if (!this.prepared) return
        const margin = parseCSSPixels(this.styles.margin, DEFAULT_MARGIN)
        const gap = DEFAULT_COLUMN_GAP
        const pagePaddingInline = getPagePaddingInline(this.styles.pagePaddingInline, this.styles.gap, DEFAULT_PAGE_PADDING_INLINE)
        const minColumnWidth = parseCSSPixels(this.styles.minColumnWidth, DEFAULT_MIN_COLUMN_WIDTH)
        const maxColumnWidth = parseCSSPixels(this.styles.maxColumnWidth ?? this.styles.maxInlineSize, DEFAULT_MAX_COLUMN_WIDTH)
        const availableWidth = Math.max(1, this.scroller.clientWidth - margin * 2)
        const availableHeight = Math.max(1, this.scroller.clientHeight)
        const geometry = resolveReflowablePageGeometry({
            layoutMode: this.layoutMode,
            maxColumnCount: this.maxColumnCount,
            availableInlineSize: availableWidth,
            availableBlockSize: availableHeight,
            gap,
            minColumnWidth,
            maxColumnWidth,
            pagePaddingInline,
            pagePaddingBlock: this.getPagePaddingBlock(availableHeight, margin),
            pageFit: this.styles.reflowablePageFit,
            usePaperPadding: this.styles.pagePaddingInline == null && this.styles.gap == null,
        })
        const columns = geometry.columns
        const pageInlineSize = geometry.columnWidth
        const inlineSize = geometry.inlineSize
        const pageHeight = geometry.pageHeight
        const pagePaddingBlockStart = geometry.pagePaddingBlockStart
        const pagePaddingBlockEnd = geometry.pagePaddingBlockEnd
        const columnHeight = this.layoutMode === 'paginated'
            ? Math.max(this.getLineHeightPixels(), pageHeight - pagePaddingBlockStart - pagePaddingBlockEnd)
            : Number.POSITIVE_INFINITY
        this.lines = layoutText(this.prepared, {
            inlineSize,
            lineHeight: this.getLineHeightPixels(),
            blockGap: this.getLineHeightPixels() * 0.5,
            maxBlockHeight: this.layoutMode === 'paginated' ? columnHeight : undefined,
        })
        const contentHeight = this.lines[this.lines.length - 1]?.top + this.lines[this.lines.length - 1]?.height || 0
        const pageCount = this.layoutMode === 'paginated'
            ? getReadablePageCount(this.lines, columnHeight, columns)
            : 1
        const totalHeight = columns > 1
            ? pageCount * pageHeight
            : this.layoutMode === 'paginated'
                ? pageCount * pageHeight
                : contentHeight + pagePaddingBlockStart + pagePaddingBlockEnd

        this.columnLayout = {
            margin,
            gap,
            columnWidth: pageInlineSize,
            columns,
            pageHeight,
            pageFrameHeight: geometry.pageFrameHeight,
            pageFrameTop: geometry.pageFrameTop,
            columnHeight,
            pagePaddingInline: geometry.pagePaddingInline,
            pagePaddingInlineStart: geometry.pagePaddingInlineStart,
            pagePaddingInlineEnd: geometry.pagePaddingInlineEnd,
            pagePaddingBlock: geometry.pagePaddingBlock,
            pagePaddingBlockStart,
            pagePaddingBlockEnd,
            pageFit: geometry.pageFit,
            totalHeight,
            pageCount,
        }
        this.pageIndex = this.findReadablePage(Math.min(this.pageIndex, pageCount - 1), 0) ?? 0
        const contentWidth = pageInlineSize * columns + gap * (columns - 1)
        const contentLeft = Math.max(0, (this.scroller.clientWidth - contentWidth) / 2)
        this.host.setScrollExtentHeight(totalHeight)
        this.content.style.marginInline = '0'
        this.content.style.maxWidth = ''
        this.content.style.left = `${contentLeft}px`
        this.content.style.right = 'auto'
        this.content.style.width = `${contentWidth}px`
        this.rebuildTOCPositions()
        this.renderVisibleLines()
    }

    private renderVisibleLines(): void {
        const layout = this.columnLayout
        if (!this.prepared || this.currentIndex < 0) {
            this.surfacePipeline.clear()
            return
        }

        const viewport = getReflowableSourceViewport(
            this.layoutMode,
            layout,
            this.getViewportMetrics(),
            this.pageIndex,
        )
        const surfaceWidth = Math.max(1, layout.columnWidth * layout.columns + layout.gap * (layout.columns - 1))
        this.surfacePipeline.render({
            sectionIndex: this.currentIndex,
            pageIndex: this.pageIndex,
            layoutMode: this.layoutMode,
            layout,
            lines: this.lines,
            prepared: this.prepared,
            styles: this.styles,
            baseTextStyle: this.getBaseTextStyle(),
            lineHeightPixels: this.getLineHeightPixels(),
            sourceScrollTop: viewport.sourceScrollTop,
            sourceViewportHeight: viewport.sourceViewportHeight,
            surfaceWidth,
            surfaceHeight: Math.max(1, layout.totalHeight),
        })
    }

    private emitRelocate(reason: string): void {
        if (this.currentIndex < 0) return
        const metrics = this.getViewportMetrics()
        const fraction = getReflowableSectionFraction(
            this.layoutMode,
            this.columnLayout,
            metrics,
            this.pageIndex,
        )
        const viewport = getReflowableSourceViewport(
            this.layoutMode,
            this.columnLayout,
            metrics,
            this.pageIndex,
        )
        const range = getVisibleLines(
            this.lines,
            viewport.sourceScrollTop,
            viewport.sourceViewportHeight,
            0,
        )
        const tocItem = this.pendingTOCItem ?? this.getCurrentTOCItem()
        const totalFraction = this.progress?.getProgress(this.currentIndex, fraction).fraction
        const event: RelocateEvent = {
            range,
            index: this.currentIndex,
            fraction,
            totalFraction,
            tocItem,
            reason,
        }
        debugRebook('browser', 'relocate', {
            reason,
            index: this.currentIndex,
            pageIndex: this.layoutMode === 'paginated' ? this.pageIndex : undefined,
            pageCount: this.layoutMode === 'paginated' ? this.columnLayout.pageCount : undefined,
            fraction,
            totalFraction,
            tocLabel: tocItem?.label,
            tocHref: tocItem?.href,
            tocPositions: this.tocPositions.length,
            sourceTop: viewport.sourceScrollTop,
            sourceHeight: viewport.sourceViewportHeight,
        })
        this.lastLocation = event
        this.emit('relocate', event)
        this.pendingTOCItem = null
    }

    private emitBlockWindow(reason: string): void {
        if (this.currentIndex < 0 || this.prefetchPageCount <= 0) return
        const blockIds = this.getPrefetchBlockIds()
        if (!blockIds.length) return
        this.emit('block-window', {
            index: this.currentIndex,
            blockIds,
            pageIndex: this.layoutMode === 'paginated' ? this.pageIndex : undefined,
            pageCount: this.prefetchPageCount,
            reason,
        })
    }

    private getPrefetchBlockIds(): string[] {
        const ids: string[] = []
        const seen = new Set<string>()
        const metrics = this.getViewportMetrics()
        const sourceStart = this.getSourceScrollTop()
        const sourceEnd = sourceStart + this.getSourceViewportHeight() + this.getSourceHeightForPages(this.prefetchPageCount, metrics)

        for (const line of this.lines) {
            if (line.top + line.height < sourceStart) continue
            if (line.top > sourceEnd) break
            const blockId = line.block?.id
            if (!blockId || seen.has(blockId)) continue
            seen.add(blockId)
            ids.push(blockId)
        }

        return ids
    }

    private getSourceHeightForPages(pageCount: number, metrics = this.getViewportMetrics()): number {
        return getReflowableSourceHeightForPages(this.layoutMode, this.columnLayout, metrics, pageCount)
    }

    private resolveHrefFallback(href: string): ResolvedNavigation | null {
        const [path, fragment] = href.split('#')
        const index = this.sections.findIndex(section =>
            String(section.id) === path
            || (typeof section.id === 'string' && section.id.endsWith(path)))
        if (index >= 0) return { index, anchor: fragment }

        const sectionIndex = Number(path)
        if (Number.isInteger(sectionIndex) && sectionIndex >= 0 && sectionIndex < this.sections.length) {
            return { index: sectionIndex, anchor: fragment }
        }

        return null
    }

    private rebuildTOCPositions(): void {
        this.tocPositions = []
        if (!this.book?.toc) return

        for (const [order, item] of flattenTOC(this.book.toc).entries()) {
            const resolved = this.book.resolveHref?.(item.href)
            const index = resolved?.index ?? this.getTOCSectionIndex(item.href)
            if (index == null || index < 0) continue
            let sourceTop = 0
            if (index === this.currentIndex) {
                if (resolved?.anchor == null && !this.getTOCFragment(item.href)) {
                    sourceTop = 0
                } else {
                    const anchorTop = this.getAnchorSourceTop(resolved?.anchor, item.href)
                    if (anchorTop == null) continue
                    sourceTop = anchorTop
                }
            }
            this.tocPositions.push({ index, sourceTop, order, item })
        }
        this.tocPositions.sort(compareTOCPosition)
    }

    private getTOCSectionIndex(href: string): number | null {
        const result = this.book?.splitTOCHref?.(href)
        if (!result) return null
        const [id] = result
        const index = this.sections.findIndex(section => section.id === id)
        return index >= 0 ? index : null
    }

    private getTOCFragment(href: string): string | number | null {
        const result = this.book?.splitTOCHref?.(href)
        if (result) return result[1]
        return href.includes('#') ? href.split('#')[1] : null
    }

    private findTOCItem(href: string): TOCItem | null {
        if (!this.book?.toc) return null
        return flattenTOC(this.book.toc).find(item => item.href === href) ?? null
    }

    private async canNavigate(direction: NavigationDirection): Promise<boolean> {
        return await this.beforeNavigate?.(direction) !== false
    }

    private getCurrentTOCItem(): TOCItem | null {
        if (!this.tocPositions.length || this.currentIndex < 0) return null
        const sourceStart = this.getSourceScrollTop()
        const sourceEnd = sourceStart + this.getSourceViewportHeight()
        if (this.layoutMode === 'paginated') {
            const visible = this.tocPositions.find(position =>
                position.index === this.currentIndex
                && position.sourceTop > sourceStart + 1
                && position.sourceTop < sourceEnd - 1)
            if (visible) return visible.item
        }

        const sourceTop = sourceStart + this.getLineHeightPixels() * 0.5
        let active: TOCPosition | null = null

        for (const position of this.tocPositions) {
            if (position.index > this.currentIndex) break
            if (position.index === this.currentIndex && position.sourceTop > sourceTop) break
            active = position
        }

        return active?.item ?? null
    }

    private getAnchorScrollTop(anchor?: ResolvedNavigation['anchor'], href?: string): number | null {
        if (anchor == null && !href) return null
        if (typeof anchor === 'number') return anchor

        const sourceTop = this.getAnchorSourceTop(anchor, href)
        return sourceTop == null ? null : this.getScrollTopForSourceTop(sourceTop)
    }

    private getAnchorSourceTop(anchor?: ResolvedNavigation['anchor'], href?: string): number | null {
        if (anchor == null && !href) return null
        if (typeof anchor === 'number') return anchor

        const value = anchor == null ? null : this.resolveAnchorValue(anchor)
        if (typeof value === 'number') return value

        const anchorIds = this.getAnchorIds(value, href)
        if (!anchorIds.length) return null

        const line = this.lines.find(item => {
            const block = item.block
            if (!block) return false
            return anchorIds.some(id =>
                block.id === id
                || block.attrs?.id === id
                || block.attrs?.name === id)
        })

        return line?.top ?? this.getFileposSourceTop(anchorIds)
    }

    private getAnchorIds(value: unknown, href?: string): string[] {
        const ids = getAnchorIds(value)
        if (ids.length) return ids
        const fragment = href ? this.getTOCFragment(href) : null
        return fragment == null ? [] : [String(fragment)]
    }

    private getFileposSourceTop(anchorIds: readonly string[]): number | null {
        const id = anchorIds.find(value => /^filepos\d+$/.test(value))
        if (!id || this.currentIndex < 0) return null

        const filepos = Number(id.slice('filepos'.length))
        const sectionStart = this.sections
            .slice(0, this.currentIndex)
            .reduce((sum, section) => sum + Math.max(0, section.size ?? 0), 0)
        const sectionSize = Math.max(1, this.sections[this.currentIndex]?.size ?? 1)
        const fraction = Math.max(0, Math.min(1, (filepos - sectionStart) / sectionSize))
        return fraction * this.getContentHeight()
    }

    private getContentHeight(): number {
        const last = this.lines[this.lines.length - 1]
        return last ? last.top + last.height : 0
    }

    private resolveAnchorValue(anchor: ResolvedNavigation['anchor']): unknown {
        if (typeof anchor !== 'function') return anchor
        try {
            return anchor({
                getElementById: (id: string) => id,
                querySelector: (selector: string) => selector,
            })
        } catch {
            return null
        }
    }

    private getScrollTopForSourceTop(sourceTop: number): number {
        return getReflowableScrollTopForSourceTop(sourceTop, this.layoutMode, this.columnLayout)
    }

    private getBaseTextStyle(): TextStyle {
        return {
            fontFamily: this.styles.fontFamily ?? 'system-ui, -apple-system, "Noto Serif CJK SC", "Noto Serif SC", Georgia, serif',
            fontSize: parseCSSPixels(this.styles.fontSize, 16),
            lineHeight: getLineHeightMultiplier(this.styles.lineHeight, parseCSSPixels(this.styles.fontSize, 16)),
            color: this.styles.color,
        }
    }

    private getSourceScrollTop(): number {
        return getReflowableSourceScrollTop(
            this.layoutMode,
            this.columnLayout,
            this.getViewportMetrics(),
            this.pageIndex,
        )
    }

    private getSourceViewportHeight(): number {
        return getReflowableSourceViewportHeight(this.layoutMode, this.columnLayout, this.getViewportMetrics())
    }

    private getViewportMetrics(): ReflowableViewportMetrics {
        return {
            scrollTop: this.scroller.scrollTop,
            scrollHeight: this.scroller.scrollHeight,
            clientHeight: this.scroller.clientHeight,
        }
    }

    private applyPageScroll(reason: string): void {
        if (this.layoutMode === 'paginated') {
            this.pageIndex = this.findReadablePage(this.pageIndex, 0) ?? this.pageIndex
            this.pageIndex = clampReflowablePageIndex(this.pageIndex, this.columnLayout)
            this.suppressNextScrollRelocate = true
            this.scroller.scrollTop = getReflowablePageScrollTop(this.columnLayout, this.pageIndex)
        }
        this.renderVisibleLines()
        this.emitRelocate(reason)
        this.emitBlockWindow(reason)
    }

    private applyOverflowMode(): void {
        this.host.setOverflowForLayout(this.layoutMode)
    }

    private getPagePaddingBlock(pageHeight: number, margin: number): number {
        return getPagePaddingBlock(this.layoutMode, pageHeight, margin)
    }

    private getSectionFraction(): number {
        return this.currentIndex < 0
            ? 0
            : getReflowableSectionFraction(
                this.layoutMode,
                this.columnLayout,
                this.getViewportMetrics(),
                this.pageIndex,
            )
    }

    private restoreSectionFraction(fraction: number): void {
        const safe = Math.max(0, Math.min(1, fraction))
        if (this.layoutMode === 'paginated') {
            this.pageIndex = Math.min(
                this.columnLayout.pageCount - 1,
                Math.round(safe * Math.max(0, this.columnLayout.pageCount - 1)),
            )
            this.pageIndex = this.findReadablePage(this.pageIndex, 0) ?? this.pageIndex
            this.suppressNextScrollRelocate = true
            this.scroller.scrollTop = getReflowablePageScrollTop(this.columnLayout, this.pageIndex)
        } else {
            this.suppressNextScrollRelocate = true
            this.scroller.scrollTop = this.scrollTopForFraction(safe)
        }
        this.renderVisibleLines()
    }

    private scrollTopForFraction(fraction: number): number {
        return getReflowableScrollTopForFraction(
            this.layoutMode,
            this.columnLayout,
            this.getViewportMetrics(),
            fraction,
        )
    }

    private getLineHeightPixels(): number {
        const fontSize = parseCSSPixels(this.styles.fontSize, 16)
        const lineHeight = this.styles.lineHeight
        if (typeof lineHeight === 'string' && lineHeight.trim().endsWith('px')) {
            return parseCSSPixels(lineHeight, fontSize * 1.6)
        }
        return fontSize * getLineHeightMultiplier(lineHeight, fontSize)
    }

    private findReadablePage(pageIndex: number, direction: -1 | 0 | 1): number | null {
        return findReadableReflowablePage(this.lines, this.layoutMode, this.columnLayout, pageIndex, direction)
    }

    private emit<K extends keyof RendererEventMap>(event: K, data: RendererEventMap[K]): void {
        this.events.emit(event, data)
    }
}

export const createBrowserRenderer = (config: BrowserRendererConfig): BrowserContentEngine => {
    return new BrowserRenderer(config)
}

function compareTOCPosition(a: TOCPosition, b: TOCPosition): number {
    return a.index - b.index
        || a.sourceTop - b.sourceTop
        || a.order - b.order
}
