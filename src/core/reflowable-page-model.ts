import type { LineRange, VisibleLineWindow } from './pretext'
import { getVisibleLines } from './pretext'
import type { LayoutMode } from './renderer'
import { getLinePageIndex } from './renderer-utils'

export interface ReflowableColumnLayout {
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

export interface ReflowableViewportMetrics {
    readonly scrollTop: number
    readonly scrollHeight: number
    readonly clientHeight: number
}

export interface ReflowableSourceViewport {
    readonly sourceScrollTop: number
    readonly sourceViewportHeight: number
}

export function getRenderedReflowableLinePosition(
    line: LineRange,
    layout: ReflowableColumnLayout,
    layoutMode: LayoutMode,
): { top: number; left: number } {
    const { columns, pageHeight, columnHeight, columnWidth, gap, pagePaddingBlock } = layout
    if (layoutMode !== 'paginated') return { top: line.top + pagePaddingBlock, left: 0 }

    const safeColumnHeight = Math.max(1, columnHeight)
    const safeColumns = Math.max(1, columns)
    const sourceColumn = Math.floor(Math.max(0, line.top) / safeColumnHeight)
    const row = Math.floor(sourceColumn / safeColumns)
    const column = sourceColumn % safeColumns
    return {
        top: row * pageHeight + pagePaddingBlock + (Math.max(0, line.top) % safeColumnHeight),
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
        return Math.max(0, metrics.scrollTop - layout.pagePaddingBlock)
    }
    return clampReflowablePageIndex(pageIndex, layout) * layout.columnHeight * Math.max(1, layout.columns)
}

export function getReflowableSourceViewportHeight(
    layoutMode: LayoutMode,
    layout: ReflowableColumnLayout,
    metrics: ReflowableViewportMetrics,
): number {
    if (layoutMode !== 'paginated') {
        return metrics.clientHeight + layout.pagePaddingBlock * 2
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
    return safeSourceTop + layout.pagePaddingBlock
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
