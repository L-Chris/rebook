/**
 * WeChat Mini Program renderer backed by the Pretext adapter.
 *
 * The renderer has no DOM dependency. It produces a serializable snapshot that
 * Mini Program pages/components can feed into setData and render with WXML.
 */

import type { BlockWindowEvent, Book, LinkEvent, LoadEvent, RelocateEvent, ResolvedNavigation, Section, TOCItem } from '../../core/types'
import type { LayoutMode, Renderer, RendererStyles } from '../../core/renderer'
import { SectionProgress } from '../../utils/progress'
import {
    getAnchorIds,
    getColumnCount,
    getLineHeightMultiplier,
    getLinePageIndex,
    getPagePaddingBlock,
    getPluginPrefetchPageCount,
    getReadablePageCount,
    parseCSSPixels,
} from '../../core/renderer-utils'
import {
    getVisibleLines,
    installPretextMeasurementPolyfill,
    layout as layoutText,
    prepare,
    prepareBlocks,
    type LineRange,
    type LineSegmentRange,
    type PreparedText,
    type TextBlock,
    type TextImage,
    type TextStyle,
    type TextTable,
    type CanvasProviderLike,
} from '../../core/pretext'

interface RendererEventMap {
    load: LoadEvent
    relocate: RelocateEvent
    link: LinkEvent
    'block-window': BlockWindowEvent
    snapshot: WechatMiniProgramRendererSnapshot
}

type Listener<T> = (event: T) => void
type AnchorResolver = (doc: unknown) => unknown

export interface WechatMiniProgramRendererConfig {
    /** Viewport width in CSS pixels/rpx-equivalent layout units. */
    width: number
    /** Viewport height in CSS pixels/rpx-equivalent layout units. */
    height: number
    layout?: LayoutMode
    styles?: RendererStyles
    maxColumnCount?: number
    overscan?: number
    wx?: CanvasProviderLike
    /**
     * Called whenever the renderer snapshot changes. Pass page.setData or a
     * small wrapper such as snapshot => page.setData({ reader: snapshot }).
     */
    setData?: (snapshot: WechatMiniProgramRendererSnapshot) => void
    /**
     * Defaults to true. Set false when the host has installed a compatible
     * OffscreenCanvas global before constructing the renderer.
     */
    installPretextPolyfill?: boolean
}

export interface WechatMiniProgramRendererSnapshot {
    layout: LayoutMode
    width: number
    height: number
    contentWidth: number
    totalHeight: number
    scrollTop: number
    pageIndex: number
    pageCount: number
    sectionIndex: number
    sectionCount: number
    fraction: number
    lines: WechatMiniProgramLineNode[]
}

export type WechatMiniProgramLineNode =
    | WechatMiniProgramTextLineNode
    | WechatMiniProgramImageLineNode
    | WechatMiniProgramTableLineNode
    | WechatMiniProgramSeparatorLineNode
    | WechatMiniProgramPreLineNode

export interface WechatMiniProgramLineBase {
    key: string
    kind: LineRange['kind']
    blockId?: string
    blockType?: string
    style: Record<string, string | number>
}

export interface WechatMiniProgramTextLineNode extends WechatMiniProgramLineBase {
    kind: 'text'
    fragments: WechatMiniProgramTextFragment[]
}

export interface WechatMiniProgramPreLineNode extends WechatMiniProgramLineBase {
    kind: 'pre'
    text: string
}

export interface WechatMiniProgramSeparatorLineNode extends WechatMiniProgramLineBase {
    kind: 'separator'
}

export interface WechatMiniProgramImageLineNode extends WechatMiniProgramLineBase {
    kind: 'image'
    image: TextImage
}

export interface WechatMiniProgramTableLineNode extends WechatMiniProgramLineBase {
    kind: 'table'
    table: TextTable
    columns: string
}

export interface WechatMiniProgramTextFragment {
    key: string
    text: string
    style: Record<string, string | number>
    image?: {
        src: string
        alt?: string
        width: number
        height: number
    }
}

interface ColumnLayout {
    margin: number
    gap: number
    columnWidth: number
    columns: number
    pageHeight: number
    columnHeight: number
    pagePaddingBlock: number
    totalHeight: number
    pageCount: number
}

interface TOCPosition {
    index: number
    sourceTop: number
    order: number
    item: TOCItem
}

const DEFAULT_MARGIN = 32
const DEFAULT_GAP = 48

export class WechatMiniProgramRenderer implements Renderer {
    private width: number
    private height: number
    private styles: RendererStyles
    private layoutMode: LayoutMode
    private maxColumnCount: number
    private overscan: number
    private setData?: (snapshot: WechatMiniProgramRendererSnapshot) => void
    private book: Book | null = null
    private sections: readonly Section[] = []
    private currentIndex = -1
    private prepared: PreparedText | null = null
    private lines: LineRange[] = []
    private pageIndex = 0
    private scrollTop = 0
    private progress: SectionProgress | null = null
    private lastLocation: RelocateEvent | null = null
    private listeners = new Map<string, Set<Listener<unknown>>>()
    private activeLoadId = 0
    private prefetchPageCount = 0
    private tocPositions: TOCPosition[] = []
    private pendingTOCItem: TOCItem | null = null
    private columnLayout: ColumnLayout = {
        margin: DEFAULT_MARGIN,
        gap: DEFAULT_GAP,
        columnWidth: 0,
        columns: 1,
        pageHeight: 0,
        columnHeight: 0,
        pagePaddingBlock: 0,
        totalHeight: 0,
        pageCount: 1,
    }

    constructor(config: WechatMiniProgramRendererConfig) {
        if (config.installPretextPolyfill !== false) {
            installPretextMeasurementPolyfill(config.wx)
        }
        this.width = Math.max(1, config.width)
        this.height = Math.max(1, config.height)
        this.styles = config.styles ?? {}
        this.layoutMode = config.layout ?? 'paginated'
        this.maxColumnCount = config.maxColumnCount ?? 1
        this.overscan = config.overscan ?? 4
        this.setData = config.setData
    }

    async open(book: Book): Promise<void> {
        this.book = book
        this.sections = book.sections
        this.progress = new SectionProgress(this.sections)
        this.prefetchPageCount = getPluginPrefetchPageCount(book)
        this.tocPositions = []
        this.pendingTOCItem = null
        this.currentIndex = -1
        this.pageIndex = 0
        this.scrollTop = 0
        this.publishSnapshot()
    }

    async goTo(target: number | string): Promise<void> {
        if (typeof target === 'number') {
            this.pendingTOCItem = null
            await this.loadSection(target)
            return
        }

        const resolved = this.book?.resolveHref?.(target) ?? this.resolveHrefFallback(target)
        if (!resolved) return
        this.pendingTOCItem = this.findTOCItem(target)
        await this.loadSection(resolved.index, resolved.anchor)
    }

    async next(): Promise<void> {
        if (this.layoutMode === 'paginated') {
            const nextPage = this.findReadablePage(this.pageIndex + 1, 1)
            if (nextPage != null) {
                this.pageIndex = nextPage
                this.scrollTop = this.pageIndex * this.columnLayout.pageHeight
                this.publishPosition('page')
                return
            }
            if (this.currentIndex < this.sections.length - 1) await this.loadSection(this.currentIndex + 1)
            return
        }

        const maxScroll = this.getMaxScrollTop()
        if (this.scrollTop < maxScroll - 1) {
            this.scrollTop = Math.min(maxScroll, this.scrollTop + this.height)
            this.publishPosition('scroll')
            return
        }
        if (this.currentIndex < this.sections.length - 1) await this.loadSection(this.currentIndex + 1)
    }

    async prev(): Promise<void> {
        if (this.layoutMode === 'paginated') {
            const previousPage = this.findReadablePage(this.pageIndex - 1, -1)
            if (previousPage != null) {
                this.pageIndex = previousPage
                this.scrollTop = this.pageIndex * this.columnLayout.pageHeight
                this.publishPosition('page')
                return
            }
            if (this.currentIndex > 0) {
                await this.loadSection(this.currentIndex - 1)
                this.pageIndex = this.columnLayout.pageCount - 1
                this.pageIndex = this.findReadablePage(this.pageIndex, 0) ?? this.pageIndex
                this.scrollTop = this.pageIndex * this.columnLayout.pageHeight
                this.publishPosition('page')
            }
            return
        }

        if (this.scrollTop > 1) {
            this.scrollTop = Math.max(0, this.scrollTop - this.height)
            this.publishPosition('scroll')
            return
        }
        if (this.currentIndex > 0) {
            await this.loadSection(this.currentIndex - 1)
            this.scrollTop = this.getMaxScrollTop()
            this.publishPosition('scroll')
        }
    }

    async goToFraction(fraction: number): Promise<void> {
        if (!this.progress) return
        const safe = clamp01(fraction)
        const [index, sectionFraction] = this.progress.getSection(safe)
        await this.loadSection(index)
        this.restoreSectionFraction(sectionFraction)
        this.publishPosition('fraction')
    }

    setStyles(styles: RendererStyles): void {
        const fraction = this.getSectionFraction()
        this.styles = { ...this.styles, ...styles }
        if (this.currentIndex >= 0) {
            void this.loadSection(this.currentIndex).then(() => {
                this.restoreSectionFraction(fraction)
                this.publishPosition('style')
            })
        } else {
            this.publishSnapshot()
        }
    }

    setLayout(mode: LayoutMode): void {
        if (this.layoutMode === mode) return
        const fraction = this.getSectionFraction()
        this.layoutMode = mode
        this.relayout()
        this.restoreSectionFraction(fraction)
        this.publishPosition('layout')
    }

    setSpread(maxColumns: number): void {
        const fraction = this.getSectionFraction()
        this.maxColumnCount = Math.max(1, Math.floor(maxColumns))
        this.relayout()
        this.restoreSectionFraction(fraction)
        this.publishPosition('spread')
    }

    setViewport(width: number, height: number): void {
        const fraction = this.getSectionFraction()
        this.width = Math.max(1, width)
        this.height = Math.max(1, height)
        this.relayout()
        this.restoreSectionFraction(fraction)
        this.publishPosition('resize')
    }

    setScrollTop(scrollTop: number): void {
        if (this.layoutMode === 'paginated') return
        this.scrollTop = Math.max(0, Math.min(scrollTop, this.getMaxScrollTop()))
        this.publishPosition('scroll')
    }

    getSnapshot(): WechatMiniProgramRendererSnapshot {
        const sourceScrollTop = this.getSourceScrollTop()
        const sourceViewportHeight = this.getSourceViewportHeight()
        const visible = getVisibleLines(this.lines, sourceScrollTop, sourceViewportHeight, this.overscan)
        const lines = visible.lines.map(line => this.createLineNode(line))
        return {
            layout: this.layoutMode,
            width: this.width,
            height: this.height,
            contentWidth: this.columnLayout.columnWidth * this.columnLayout.columns + this.columnLayout.gap * (this.columnLayout.columns - 1),
            totalHeight: this.columnLayout.totalHeight,
            scrollTop: this.scrollTop,
            pageIndex: this.layoutMode === 'paginated' ? this.pageIndex : 0,
            pageCount: this.columnLayout.pageCount,
            sectionIndex: this.currentIndex,
            sectionCount: this.sections.length,
            fraction: this.getSectionFraction(),
            lines,
        }
    }

    getLocation(): RelocateEvent | null {
        return this.lastLocation
    }

    getSectionFractions(): number[] {
        return this.progress?.getFractions() ?? []
    }

    async refresh(): Promise<void> {
        if (this.currentIndex < 0) return
        const fraction = this.getSectionFraction()
        await this.loadSection(this.currentIndex)
        this.restoreSectionFraction(fraction)
        this.publishPosition('refresh')
    }

    on<K extends keyof RendererEventMap>(event: K, listener: Listener<RendererEventMap[K]>): void
    on(event: string, listener: Listener<unknown>): void
    on(event: string, listener: Listener<unknown>): void {
        if (!this.listeners.has(event)) this.listeners.set(event, new Set())
        this.listeners.get(event)!.add(listener)
    }

    off<K extends keyof RendererEventMap>(event: K, listener: Listener<RendererEventMap[K]>): void
    off(event: string, listener: Listener<unknown>): void
    off(event: string, listener: Listener<unknown>): void {
        this.listeners.get(event)?.delete(listener)
    }

    destroy(): void {
        this.activeLoadId++
        this.listeners.clear()
        this.book = null
        this.sections = []
        this.prepared = null
        this.lines = []
        this.currentIndex = -1
        this.publishSnapshot()
    }

    private async loadSection(index: number, anchor?: ResolvedNavigation['anchor']): Promise<void> {
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
        this.pageIndex = 0
        this.scrollTop = 0
        this.relayout()

        const anchorTop = this.getAnchorSourceTop(anchor)
        if (anchorTop != null) this.scrollTop = this.getScrollTopForSourceTop(anchorTop)
        if (this.layoutMode === 'paginated') {
            this.pageIndex = Math.min(
                this.columnLayout.pageCount - 1,
                Math.floor(this.scrollTop / Math.max(1, this.columnLayout.pageHeight)),
            )
            this.pageIndex = this.findReadablePage(this.pageIndex, 0) ?? this.pageIndex
            this.scrollTop = this.pageIndex * this.columnLayout.pageHeight
        }

        this.emit('load', { doc: { lines: this.lines, segments }, index })
        this.publishPosition('snap')
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
        if (!this.prepared) {
            this.columnLayout = this.createEmptyLayout()
            return
        }
        const margin = parseCSSPixels(this.styles.margin, DEFAULT_MARGIN)
        const gap = parseCSSPixels(this.styles.gap, DEFAULT_GAP)
        const minColumnWidth = parseCSSPixels(this.styles.minColumnWidth, 320)
        const maxColumnWidth = parseCSSPixels(this.styles.maxColumnWidth ?? this.styles.maxInlineSize, 720)
        const availableWidth = Math.max(1, this.width - margin * 2)
        const columns = getColumnCount(this.layoutMode, availableWidth, minColumnWidth, gap, this.maxColumnCount)
        const rawWidth = columns > 1 ? (availableWidth - gap * (columns - 1)) / columns : availableWidth
        const inlineSize = Math.max(1, Math.min(maxColumnWidth, rawWidth))
        const pageHeight = Math.max(1, this.height)
        const pagePaddingBlock = getPagePaddingBlock(this.layoutMode, pageHeight, margin)
        const columnHeight = this.layoutMode === 'paginated'
            ? Math.max(this.getLineHeightPixels(), pageHeight - pagePaddingBlock * 2)
            : Number.POSITIVE_INFINITY

        this.lines = layoutText(this.prepared, {
            inlineSize,
            lineHeight: this.getLineHeightPixels(),
            blockGap: this.getLineHeightPixels() * 0.5,
            maxBlockHeight: this.layoutMode === 'paginated' ? columnHeight : undefined,
        })

        const contentHeight = this.getContentHeight()
        const pageCount = this.layoutMode === 'paginated'
            ? getReadablePageCount(this.lines, columnHeight, columns)
            : 1
        const totalHeight = this.layoutMode === 'paginated'
            ? pageCount * pageHeight
            : contentHeight + pagePaddingBlock * 2

        this.columnLayout = {
            margin,
            gap,
            columnWidth: inlineSize,
            columns,
            pageHeight,
            columnHeight,
            pagePaddingBlock,
            totalHeight,
            pageCount,
        }
        this.pageIndex = this.findReadablePage(Math.min(this.pageIndex, pageCount - 1), 0) ?? 0
        this.scrollTop = Math.min(this.scrollTop, this.getMaxScrollTop())
        this.rebuildTOCPositions()
    }

    private createEmptyLayout(): ColumnLayout {
        return {
            margin: parseCSSPixels(this.styles.margin, DEFAULT_MARGIN),
            gap: parseCSSPixels(this.styles.gap, DEFAULT_GAP),
            columnWidth: Math.max(1, this.width - parseCSSPixels(this.styles.margin, DEFAULT_MARGIN) * 2),
            columns: 1,
            pageHeight: this.height,
            columnHeight: this.height,
            pagePaddingBlock: 0,
            totalHeight: this.height,
            pageCount: 1,
        }
    }

    private createLineNode(line: LineRange): WechatMiniProgramLineNode {
        const position = this.getRenderedLinePosition(line)
        const style = this.getLineStyle(line, position)
        const base = {
            key: `line-${this.currentIndex}-${line.index}`,
            blockId: line.block?.id,
            blockType: line.block?.type,
            style,
        }

        if (line.kind === 'image' && line.image) {
            return { ...base, kind: 'image', image: line.image }
        }
        if (line.kind === 'table' && line.table) {
            return { ...base, kind: 'table', table: line.table, columns: getTableColumns(line.table) }
        }
        if (line.kind === 'separator') {
            return { ...base, kind: 'separator' }
        }
        if (line.kind === 'pre') {
            return { ...base, kind: 'pre', text: line.text }
        }
        return {
            ...base,
            kind: 'text',
            fragments: line.segments.map((fragment, index) => this.createTextFragment(fragment, index)),
        }
    }

    private getLineStyle(line: LineRange, position: { top: number; left: number }): Record<string, string | number> {
        const inlineOffset = line.inlineOffset ?? 0
        const left = position.left + inlineOffset
        const width = Math.max(1, line.kind === 'image' ? line.width : this.columnLayout.columnWidth - inlineOffset)
        return {
            position: 'absolute',
            top: `${position.top}px`,
            left: `${left}px`,
            width: `${width}px`,
            height: `${line.height}px`,
            lineHeight: `${line.height}px`,
            color: this.styles.color ?? 'inherit',
        }
    }

    private createTextFragment(fragment: LineSegmentRange, index: number): WechatMiniProgramTextFragment {
        const sourceAttrs = fragment.source?.attrs
        const style = getTextFragmentStyle({ ...this.getBaseTextStyle(), ...fragment.style }, fragment.gapBefore)
        if (fragment.source?.nodeType === 'img' && sourceAttrs?.src) {
            return {
                key: `fragment-${fragment.segmentIndex}-${index}`,
                text: '',
                style,
                image: {
                    src: sourceAttrs.src,
                    alt: sourceAttrs.alt,
                    width: parseCSSPixels(sourceAttrs['data-rebook-inline-image-width'], 11),
                    height: parseCSSPixels(sourceAttrs['data-rebook-inline-image-height'], 11),
                },
            }
        }
        return {
            key: `fragment-${fragment.segmentIndex}-${index}`,
            text: fragment.text,
            style,
        }
    }

    private publishPosition(reason: string): void {
        this.publishSnapshot()
        this.emitRelocate(reason)
        this.emitBlockWindow(reason)
    }

    private publishSnapshot(): void {
        const snapshot = this.getSnapshot()
        this.setData?.(snapshot)
        this.emit('snapshot', snapshot)
    }

    private emitRelocate(reason: string): void {
        if (this.currentIndex < 0) return
        const fraction = this.getSectionFraction()
        const event: RelocateEvent = {
            range: getVisibleLines(this.lines, this.getSourceScrollTop(), this.getSourceViewportHeight(), 0),
            index: this.currentIndex,
            fraction,
            totalFraction: this.progress?.getProgress(this.currentIndex, fraction).fraction,
            tocItem: this.pendingTOCItem ?? this.getCurrentTOCItem(),
            reason,
        }
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
        const sourceStart = this.getSourceScrollTop()
        const sourceEnd = sourceStart + this.getSourceViewportHeight() + this.getSourceHeightForPages(this.prefetchPageCount)
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

    private getSourceHeightForPages(pageCount: number): number {
        return this.layoutMode === 'paginated'
            ? this.columnLayout.columnHeight * this.columnLayout.columns * Math.max(1, pageCount)
            : this.height * Math.max(1, pageCount)
    }

    private resolveHrefFallback(href: string): ResolvedNavigation | null {
        const [path] = href.split('#')
        const index = this.sections.findIndex(section =>
            typeof section.id === 'string' && (section.id === path || section.id.endsWith(path)))
        return index < 0 ? null : { index }
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
                    const anchorTop = this.getAnchorSourceTop(resolved?.anchor)
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

    private getAnchorSourceTop(anchor?: ResolvedNavigation['anchor']): number | null {
        if (anchor == null) return null
        if (typeof anchor === 'number') return anchor
        const value = typeof anchor === 'function'
            ? this.resolveAnchorValue(anchor as AnchorResolver)
            : anchor
        const anchorIds = getAnchorIds(value)
        if (!anchorIds.length) return null
        const line = this.lines.find(item => {
            const block = item.block
            return block && anchorIds.some(id => block.id === id || block.attrs?.id === id || block.attrs?.name === id)
        })
        return line?.top ?? null
    }

    private resolveAnchorValue(anchor: AnchorResolver): unknown {
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
        const safeSourceTop = Math.max(0, sourceTop)
        if (this.layoutMode === 'paginated') {
            const pageSourceHeight = Math.max(1, this.columnLayout.columnHeight * this.columnLayout.columns)
            return Math.floor(safeSourceTop / pageSourceHeight) * this.columnLayout.pageHeight
        }
        return safeSourceTop + this.columnLayout.pagePaddingBlock
    }

    private getRenderedLinePosition(line: LineRange): { top: number; left: number } {
        const { columns, pageHeight, columnHeight, columnWidth, gap, pagePaddingBlock } = this.columnLayout
        if (this.layoutMode !== 'paginated') return { top: line.top + pagePaddingBlock, left: 0 }
        const sourceColumn = Math.floor(line.top / columnHeight)
        const row = Math.floor(sourceColumn / columns)
        const column = sourceColumn % columns
        return {
            top: (row - this.pageIndex) * pageHeight + pagePaddingBlock + (line.top % columnHeight),
            left: column * (columnWidth + gap),
        }
    }

    private getSourceScrollTop(): number {
        if (this.layoutMode !== 'paginated') return Math.max(0, this.scrollTop - this.columnLayout.pagePaddingBlock)
        return this.pageIndex * this.columnLayout.columnHeight * this.columnLayout.columns
    }

    private getSourceViewportHeight(): number {
        if (this.layoutMode !== 'paginated') return this.height + this.columnLayout.pagePaddingBlock * 2
        return this.columnLayout.columnHeight * this.columnLayout.columns
    }

    private getSectionFraction(): number {
        if (this.currentIndex < 0) return 0
        if (this.layoutMode === 'paginated') {
            return this.columnLayout.pageCount > 1
                ? this.pageIndex / (this.columnLayout.pageCount - 1)
                : 0
        }
        const maxScroll = this.getMaxScrollTop()
        return maxScroll > 0 ? this.scrollTop / maxScroll : 0
    }

    private restoreSectionFraction(fraction: number): void {
        const safe = clamp01(fraction)
        if (this.layoutMode === 'paginated') {
            this.pageIndex = Math.min(
                this.columnLayout.pageCount - 1,
                Math.round(safe * Math.max(0, this.columnLayout.pageCount - 1)),
            )
            this.pageIndex = this.findReadablePage(this.pageIndex, 0) ?? this.pageIndex
            this.scrollTop = this.pageIndex * this.columnLayout.pageHeight
            return
        }
        this.scrollTop = this.getMaxScrollTop() * safe
    }

    private getMaxScrollTop(): number {
        return Math.max(0, this.columnLayout.totalHeight - this.height)
    }

    private getContentHeight(): number {
        const last = this.lines[this.lines.length - 1]
        return last ? last.top + last.height : 0
    }

    private getBaseTextStyle(): TextStyle {
        const fontSize = parseCSSPixels(this.styles.fontSize, 16)
        return {
            fontFamily: this.styles.fontFamily ?? 'system-ui, "Noto Serif CJK SC", "Noto Serif SC", Georgia, serif',
            fontSize,
            lineHeight: getLineHeightMultiplier(this.styles.lineHeight, fontSize),
            color: this.styles.color,
        }
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
        if (this.layoutMode !== 'paginated') return 0
        const pageCount = this.columnLayout.pageCount
        if (pageCount <= 0) return null
        if (direction > 0 && pageIndex >= pageCount) return null
        if (direction < 0 && pageIndex < 0) return null
        const start = Math.min(Math.max(0, pageIndex), pageCount - 1)
        if (this.hasReadableLinesOnPage(start)) return start

        if (direction > 0) {
            for (let page = start + 1; page < pageCount; page++) {
                if (this.hasReadableLinesOnPage(page)) return page
            }
            return null
        }

        if (direction < 0) {
            for (let page = start - 1; page >= 0; page--) {
                if (this.hasReadableLinesOnPage(page)) return page
            }
            return null
        }

        for (let distance = 1; distance < pageCount; distance++) {
            const previous = start - distance
            const next = start + distance
            if (previous >= 0 && this.hasReadableLinesOnPage(previous)) return previous
            if (next < pageCount && this.hasReadableLinesOnPage(next)) return next
        }
        return null
    }

    private hasReadableLinesOnPage(pageIndex: number): boolean {
        const { columns, columnHeight } = this.columnLayout
        return this.lines.some(line => getLinePageIndex(line, columnHeight, columns) === pageIndex)
    }

    private emit<K extends keyof RendererEventMap>(event: K, data: RendererEventMap[K]): void {
        this.listeners.get(event)?.forEach(fn => fn(data))
    }
}

export const createWechatMiniProgramRenderer = (config: WechatMiniProgramRendererConfig): WechatMiniProgramRenderer => {
    return new WechatMiniProgramRenderer(config)
}

function flattenTOC(items: readonly TOCItem[]): TOCItem[] {
    return items.flatMap(item =>
        item.subitems?.length
            ? [item, ...flattenTOC(item.subitems)]
            : [item]
    )
}

function compareTOCPosition(a: TOCPosition, b: TOCPosition): number {
    return a.index - b.index
        || a.sourceTop - b.sourceTop
        || a.order - b.order
}

function getTextFragmentStyle(style: TextStyle, gapBefore: number): Record<string, string | number> {
    return {
        ...(gapBefore > 0 ? { marginLeft: `${gapBefore}px` } : {}),
        ...(style.fontFamily ? { fontFamily: style.fontFamily } : {}),
        ...(style.fontSize ? { fontSize: `${style.fontSize}px` } : {}),
        ...(style.fontWeight ? { fontWeight: style.fontWeight } : {}),
        ...(style.fontStyle ? { fontStyle: style.fontStyle } : {}),
        ...(style.fontVariant ? { fontVariant: style.fontVariant } : {}),
        ...(style.color ? { color: style.color } : {}),
        ...(style.textDecoration ? { textDecoration: style.textDecoration } : {}),
        ...(style.verticalAlign ? { verticalAlign: style.verticalAlign } : {}),
        ...(style.letterSpacing ? { letterSpacing: `${style.letterSpacing}px` } : {}),
    }
}

function getTableColumns(table: TextTable): string {
    const weights = table.columnWeights?.length === table.columnCount
        ? table.columnWeights
        : Array.from({ length: table.columnCount }, () => 1)
    return weights.map(weight => `${Math.max(0.1, weight)}fr`).join(' ')
}

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, value))
}
