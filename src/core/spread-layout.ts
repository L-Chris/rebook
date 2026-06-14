import type { LayoutMode, RendererStyles } from './renderer'
import { getColumnCount, parseCSSPixels } from './renderer-utils'

export interface SpreadViewportMetrics {
    readonly inlineSize: number
    readonly blockSize?: number
}

export interface SpreadLayoutOptions {
    readonly margin?: RendererStyles['margin']
    readonly gap?: RendererStyles['gap']
    readonly minColumnWidth?: RendererStyles['minColumnWidth']
    readonly defaultMargin?: number
    readonly defaultGap?: number
    readonly defaultMinColumnWidth?: number
}

export type SpreadNavigationUnit = 'item' | 'spread'

export function getSpreadVisibleItemCount(
    layoutMode: LayoutMode,
    maxItemCount: number,
    metrics: SpreadViewportMetrics,
    options: SpreadLayoutOptions = {},
): number {
    const margin = parseCSSPixels(options.margin, options.defaultMargin ?? 0)
    const gap = parseCSSPixels(options.gap, options.defaultGap ?? 0)
    const minColumnWidth = parseCSSPixels(options.minColumnWidth, options.defaultMinColumnWidth ?? 320)
    const availableInlineSize = Math.max(1, metrics.inlineSize - margin * 2)
    return getColumnCount(layoutMode, availableInlineSize, minColumnWidth, gap, maxItemCount)
}

export function getSpreadItems<T>(
    items: readonly T[],
    startIndex: number,
    visibleItemCount: number,
): readonly T[] {
    if (!items.length) return []
    const start = clampSpreadIndex(startIndex, items.length)
    const count = Math.max(1, Math.trunc(visibleItemCount))
    return items.slice(start, Math.min(items.length, start + count))
}

export function getSpreadNavigationStep(
    visibleItemCount: number,
    unit: SpreadNavigationUnit,
): number {
    return unit === 'item' ? Math.max(1, Math.trunc(visibleItemCount)) : 1
}

export function getNextSpreadIndex(
    currentIndex: number,
    itemCount: number,
    visibleItemCount: number,
    unit: SpreadNavigationUnit,
): number | null {
    const target = clampSpreadIndex(currentIndex, itemCount) + getSpreadNavigationStep(visibleItemCount, unit)
    return target < itemCount ? target : null
}

export function getPreviousSpreadIndex(
    currentIndex: number,
    itemCount: number,
    visibleItemCount: number,
    unit: SpreadNavigationUnit,
): number | null {
    const current = clampSpreadIndex(currentIndex, itemCount)
    const target = Math.max(0, current - getSpreadNavigationStep(visibleItemCount, unit))
    return target === current ? null : target
}

export function clampSpreadIndex(index: number, itemCount: number): number {
    const normalized = Number.isFinite(index) ? Math.trunc(index) : 0
    return Math.max(0, Math.min(Math.max(0, itemCount - 1), normalized))
}
