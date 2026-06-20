import type { LineRange, VisibleLineWindow } from './pretext'
import { getVisibleLines } from './pretext'
import type { LayoutMode } from './renderer'
import { getLinePageIndex, getSourceColumnPosition } from './renderer-utils'
import { getSpreadVisibleItemCount } from './spread-layout'

export type ReflowablePageFitMode = 'auto' | 'paper' | 'viewport'

export interface ReflowableColumnLayout {
    margin: number
    gap: number
    columnWidth: number
    columns: number
    pageHeight: number
    pageFrameHeight?: number
    pageFrameTop?: number
    columnHeight: number
    pagePaddingInline: number
    pagePaddingInlineStart?: number
    pagePaddingInlineEnd?: number
    pagePaddingBlock: number
    pagePaddingBlockStart?: number
    pagePaddingBlockEnd?: number
    pageFit?: Exclude<ReflowablePageFitMode, 'auto'>
    totalHeight: number
    pageCount: number
}

export interface ReflowablePageGeometryOptions {
    readonly layoutMode: LayoutMode
    readonly maxColumnCount: number
    readonly availableInlineSize: number
    readonly availableBlockSize: number
    readonly gap: number
    readonly minColumnWidth: number
    readonly maxColumnWidth: number
    readonly pagePaddingInline: number
    readonly pagePaddingBlock: number
    readonly pageFit?: ReflowablePageFitMode
    readonly usePaperPadding?: boolean
}

export interface ReflowablePageGeometry {
    readonly columns: number
    readonly columnWidth: number
    readonly inlineSize: number
    readonly pageHeight: number
    readonly pageFrameHeight: number
    readonly pageFrameTop: number
    readonly pagePaddingInline: number
    readonly pagePaddingInlineStart: number
    readonly pagePaddingInlineEnd: number
    readonly pagePaddingBlock: number
    readonly pagePaddingBlockStart: number
    readonly pagePaddingBlockEnd: number
    readonly pageFit: Exclude<ReflowablePageFitMode, 'auto'>
}

export interface ReflowableViewportMetrics {
    readonly scrollTop: number
    readonly scrollHeight: number
    readonly clientHeight: number
}

export interface ReflowableSourceViewport {
    readonly sourceScrollTop: number
    readonly sourceViewportHeight: number
}

const PAPER_PAGE_RATIO = 148 / 210
const PAPER_SINGLE_INLINE_FRACTION = 0.94
const PAPER_SPREAD_INLINE_FRACTION = 0.96
const PAPER_BLOCK_FRACTION = 0.92
const PAPER_AUTO_MIN_INLINE_SIZE = 640
const PAPER_AUTO_MIN_BLOCK_SIZE = 520
const PAPER_PADDING_TOP_RATIO = 15 / 148
const PAPER_PADDING_BOTTOM_RATIO = 20 / 148
const PAPER_PADDING_OUTER_RATIO = 16 / 148
const PAPER_PADDING_INNER_RATIO = 22 / 148

export function resolveReflowablePageGeometry(options: ReflowablePageGeometryOptions): ReflowablePageGeometry {
    const gap = Math.max(0, options.gap)
    const availableInlineSize = Math.max(1, options.availableInlineSize)
    const availableBlockSize = Math.max(1, options.availableBlockSize)
    const minColumnWidth = Math.max(1, options.minColumnWidth)
    const maxColumnWidth = Math.max(1, options.maxColumnWidth)
    const columns = getSpreadVisibleItemCount(options.layoutMode, options.maxColumnCount, {
        inlineSize: availableInlineSize,
    }, {
        gap,
        minColumnWidth,
    })
    const pageFit = shouldUsePaperPageFit(
        options.pageFit ?? 'auto',
        options.layoutMode,
        availableInlineSize,
        availableBlockSize,
    ) ? 'paper' : 'viewport'

    if (pageFit === 'paper') {
        return resolvePaperPageGeometry({
            columns,
            availableInlineSize,
            availableBlockSize,
            gap,
            maxColumnWidth,
            pagePaddingInline: options.pagePaddingInline,
            pagePaddingBlock: options.pagePaddingBlock,
            usePaperPadding: options.usePaperPadding !== false,
        })
    }

    const rawColumnWidth = columns > 1
        ? (availableInlineSize - gap * (columns - 1)) / columns
        : availableInlineSize
    const columnWidth = Math.max(1, Math.min(maxColumnWidth, rawColumnWidth))
    const pagePaddingInline = Math.max(0, options.pagePaddingInline)
    const pagePaddingBlock = Math.max(0, options.pagePaddingBlock)
    return {
        columns,
        columnWidth,
        inlineSize: Math.max(1, columnWidth - pagePaddingInline * 2),
        pageHeight: availableBlockSize,
        pageFrameHeight: availableBlockSize,
        pageFrameTop: 0,
        pagePaddingInline,
        pagePaddingInlineStart: pagePaddingInline,
        pagePaddingInlineEnd: pagePaddingInline,
        pagePaddingBlock,
        pagePaddingBlockStart: pagePaddingBlock,
        pagePaddingBlockEnd: pagePaddingBlock,
        pageFit,
    }
}

export function getReflowableColumnInlinePadding(
    layout: ReflowableColumnLayout,
    columnIndex: number,
): { start: number; end: number } {
    const start = layout.pagePaddingInlineStart ?? layout.pagePaddingInline
    const end = layout.pagePaddingInlineEnd ?? layout.pagePaddingInline
    if (layout.columns > 1 && columnIndex % 2 === 1) {
        return { start: end, end: start }
    }
    return { start, end }
}

export function getReflowableColumnIndexForLeft(layout: ReflowableColumnLayout, left: number): number {
    const step = Math.max(1, layout.columnWidth + layout.gap)
    const column = Math.round(Math.max(0, left) / step)
    return Math.max(0, Math.min(Math.max(1, layout.columns) - 1, column))
}

export function getReflowableBlockPaddingStart(layout: ReflowableColumnLayout): number {
    return layout.pagePaddingBlockStart ?? layout.pagePaddingBlock
}

export function getReflowableBlockPaddingEnd(layout: ReflowableColumnLayout): number {
    return layout.pagePaddingBlockEnd ?? layout.pagePaddingBlock
}

export function getRenderedReflowableLinePosition(
    line: LineRange,
    layout: ReflowableColumnLayout,
    layoutMode: LayoutMode,
): { top: number; left: number } {
    const { columns, pageHeight, columnHeight, columnWidth, gap } = layout
    const pagePaddingBlockStart = getReflowableBlockPaddingStart(layout)
    if (layoutMode !== 'paginated') return { top: line.top + pagePaddingBlockStart, left: 0 }

    const safeColumnHeight = Math.max(1, columnHeight)
    const safeColumns = Math.max(1, columns)
    const { sourceColumn, offset } = getSourceColumnPosition(line.top, safeColumnHeight)
    const row = Math.floor(sourceColumn / safeColumns)
    const column = sourceColumn % safeColumns
    return {
        top: row * pageHeight + pagePaddingBlockStart + offset,
        left: column * (columnWidth + gap),
    }
}

export function getReflowableSourceViewport(
    layoutMode: LayoutMode,
    layout: ReflowableColumnLayout,
    metrics: ReflowableViewportMetrics,
    pageIndex: number,
): ReflowableSourceViewport {
    return {
        sourceScrollTop: getReflowableSourceScrollTop(layoutMode, layout, metrics, pageIndex),
        sourceViewportHeight: getReflowableSourceViewportHeight(layoutMode, layout, metrics),
    }
}

export function getReflowableSourceScrollTop(
    layoutMode: LayoutMode,
    layout: ReflowableColumnLayout,
    metrics: ReflowableViewportMetrics,
    pageIndex: number,
): number {
    if (layoutMode !== 'paginated') {
        return Math.max(0, metrics.scrollTop - getReflowableBlockPaddingStart(layout))
    }
    return clampReflowablePageIndex(pageIndex, layout) * layout.columnHeight * Math.max(1, layout.columns)
}

export function getReflowableSourceViewportHeight(
    layoutMode: LayoutMode,
    layout: ReflowableColumnLayout,
    metrics: ReflowableViewportMetrics,
): number {
    if (layoutMode !== 'paginated') {
        return metrics.clientHeight
            + getReflowableBlockPaddingStart(layout)
            + getReflowableBlockPaddingEnd(layout)
    }
    return layout.columnHeight * Math.max(1, layout.columns)
}

export function getReflowableSectionFraction(
    layoutMode: LayoutMode,
    layout: ReflowableColumnLayout,
    metrics: ReflowableViewportMetrics,
    pageIndex: number,
): number {
    if (layoutMode === 'paginated') {
        return layout.pageCount > 1
            ? clampReflowablePageIndex(pageIndex, layout) / (layout.pageCount - 1)
            : 0
    }

    const maxScroll = Math.max(0, metrics.scrollHeight - metrics.clientHeight)
    return maxScroll > 0 ? Math.max(0, Math.min(1, metrics.scrollTop / maxScroll)) : 0
}

export function getReflowableScrollTopForSourceTop(
    sourceTop: number,
    layoutMode: LayoutMode,
    layout: ReflowableColumnLayout,
): number {
    const safeSourceTop = Math.max(0, sourceTop)
    if (layoutMode === 'paginated') {
        const pageSourceHeight = Math.max(1, layout.columnHeight * Math.max(1, layout.columns))
        return Math.floor(safeSourceTop / pageSourceHeight) * layout.pageHeight
    }
    return safeSourceTop + getReflowableBlockPaddingStart(layout)
}

export function getReflowableScrollTopForFraction(
    layoutMode: LayoutMode,
    layout: ReflowableColumnLayout,
    metrics: ReflowableViewportMetrics,
    fraction: number,
): number {
    const safe = clampFraction(fraction)
    if (layoutMode === 'paginated') {
        return getReflowablePageScrollTop(
            layout,
            Math.round(safe * Math.max(0, layout.pageCount - 1)),
        )
    }
    const maxScroll = Math.max(0, metrics.scrollHeight - metrics.clientHeight)
    return maxScroll * safe
}

export function getReflowablePageIndexForScrollTop(
    layout: ReflowableColumnLayout,
    scrollTop: number,
): number {
    return Math.max(0, Math.floor(Math.max(0, scrollTop) / Math.max(1, layout.pageHeight)))
}

export function getReflowablePageScrollTop(
    layout: ReflowableColumnLayout,
    pageIndex: number,
): number {
    return clampReflowablePageIndex(pageIndex, layout) * layout.pageHeight
}

export function clampReflowablePageIndex(
    pageIndex: number,
    layout: ReflowableColumnLayout,
): number {
    const pageCount = Math.max(1, layout.pageCount)
    return Math.min(Math.max(0, Math.floor(pageIndex)), pageCount - 1)
}

export function findReadableReflowablePage(
    lines: readonly LineRange[],
    layoutMode: LayoutMode,
    layout: ReflowableColumnLayout,
    pageIndex: number,
    direction: -1 | 0 | 1,
): number | null {
    if (layoutMode !== 'paginated') return 0

    const pageCount = layout.pageCount
    if (pageCount <= 0) return null
    if (direction > 0 && pageIndex >= pageCount) return null
    if (direction < 0 && pageIndex < 0) return null

    const start = clampReflowablePageIndex(pageIndex, layout)
    if (hasReadableLinesOnReflowablePage(lines, layout, start)) return start

    if (direction > 0) {
        for (let page = start + 1; page < pageCount; page++) {
            if (hasReadableLinesOnReflowablePage(lines, layout, page)) return page
        }
        return null
    }

    if (direction < 0) {
        for (let page = start - 1; page >= 0; page--) {
            if (hasReadableLinesOnReflowablePage(lines, layout, page)) return page
        }
        return null
    }

    for (let distance = 1; distance < pageCount; distance++) {
        const previous = start - distance
        const next = start + distance
        if (previous >= 0 && hasReadableLinesOnReflowablePage(lines, layout, previous)) return previous
        if (next < pageCount && hasReadableLinesOnReflowablePage(lines, layout, next)) return next
    }
    return null
}

export function hasReadableLinesOnReflowablePage(
    lines: readonly LineRange[],
    layout: ReflowableColumnLayout,
    pageIndex: number,
): boolean {
    return lines.some(line =>
        line.height > 0
        && getLinePageIndex(line, layout.columnHeight, Math.max(1, layout.columns)) === pageIndex)
}

export function getReflowableSourceHeightForPages(
    layoutMode: LayoutMode,
    layout: ReflowableColumnLayout,
    metrics: ReflowableViewportMetrics,
    pageCount: number,
): number {
    const safePageCount = Math.max(1, pageCount)
    return layoutMode === 'paginated'
        ? layout.columnHeight * Math.max(1, layout.columns) * safePageCount
        : metrics.clientHeight * safePageCount
}

export function getReflowableVisibleLineWindow(
    lines: readonly LineRange[],
    layoutMode: LayoutMode,
    layout: ReflowableColumnLayout,
    metrics: ReflowableViewportMetrics,
    pageIndex: number,
    overscan = 0,
): VisibleLineWindow {
    const viewport = getReflowableSourceViewport(layoutMode, layout, metrics, pageIndex)
    return getVisibleLines(lines, viewport.sourceScrollTop, viewport.sourceViewportHeight, overscan)
}

function clampFraction(fraction: number): number {
    return Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0
}

function shouldUsePaperPageFit(
    fit: ReflowablePageFitMode,
    layoutMode: LayoutMode,
    availableInlineSize: number,
    availableBlockSize: number,
): boolean {
    if (layoutMode !== 'paginated') return false
    if (fit === 'paper') return true
    if (fit === 'viewport') return false
    return availableInlineSize >= PAPER_AUTO_MIN_INLINE_SIZE
        && availableBlockSize >= PAPER_AUTO_MIN_BLOCK_SIZE
}

function resolvePaperPageGeometry(options: {
    readonly columns: number
    readonly availableInlineSize: number
    readonly availableBlockSize: number
    readonly gap: number
    readonly maxColumnWidth: number
    readonly pagePaddingInline: number
    readonly pagePaddingBlock: number
    readonly usePaperPadding: boolean
}): ReflowablePageGeometry {
    const columns = Math.max(1, options.columns)
    const pageAreaRatio = PAPER_PAGE_RATIO * columns
    const maxSpreadWidth = options.maxColumnWidth * columns + options.gap * (columns - 1)
    const inlineFraction = columns > 1 ? PAPER_SPREAD_INLINE_FRACTION : PAPER_SINGLE_INLINE_FRACTION
    const spreadWidth = Math.max(1, Math.min(
        maxSpreadWidth,
        options.availableInlineSize * inlineFraction,
        options.availableBlockSize * PAPER_BLOCK_FRACTION * pageAreaRatio + options.gap * (columns - 1),
    ))
    const columnWidth = Math.max(1, (spreadWidth - options.gap * (columns - 1)) / columns)
    const pageFrameHeight = Math.min(options.availableBlockSize * PAPER_BLOCK_FRACTION, columnWidth / PAPER_PAGE_RATIO)
    const pageFrameTop = Math.max(0, (options.availableBlockSize - pageFrameHeight) / 2)
    const defaultInlinePadding = Math.max(0, options.pagePaddingInline)
    const outerPadding = options.usePaperPadding
        ? columnWidth * PAPER_PADDING_OUTER_RATIO
        : defaultInlinePadding
    const innerPadding = options.usePaperPadding
        ? columnWidth * PAPER_PADDING_INNER_RATIO
        : defaultInlinePadding
    const singlePagePadding = (outerPadding + innerPadding) / 2
    const pagePaddingInlineStart = columns > 1 ? outerPadding : singlePagePadding
    const pagePaddingInlineEnd = columns > 1 ? innerPadding : singlePagePadding
    const pagePaddingBlockStart = options.usePaperPadding
        ? pageFrameTop + columnWidth * PAPER_PADDING_TOP_RATIO
        : Math.max(0, options.pagePaddingBlock)
    const pagePaddingBlockEnd = options.usePaperPadding
        ? pageFrameTop + columnWidth * PAPER_PADDING_BOTTOM_RATIO
        : Math.max(0, options.pagePaddingBlock)
    const pagePaddingInline = (pagePaddingInlineStart + pagePaddingInlineEnd) / 2
    return {
        columns,
        columnWidth,
        inlineSize: Math.max(1, columnWidth - pagePaddingInlineStart - pagePaddingInlineEnd),
        pageHeight: options.availableBlockSize,
        pageFrameHeight,
        pageFrameTop,
        pagePaddingInline,
        pagePaddingInlineStart,
        pagePaddingInlineEnd,
        pagePaddingBlock: pagePaddingBlockStart,
        pagePaddingBlockStart,
        pagePaddingBlockEnd,
        pageFit: 'paper',
    }
}
