import {
    createFixedPageViewport,
    type FixedDocument,
    type FixedPageInfo,
    type FixedPageViewport,
} from './fixed-document'
import type { LayoutMode, RendererStyles } from './renderer'
import { getColumnCount, parseCSSPixels } from './renderer-utils'

export interface FixedViewportMetrics {
    readonly inlineSize: number
    readonly blockSize: number
}

export interface FixedPageFitOptions {
    readonly margin?: RendererStyles['margin']
    readonly gap?: RendererStyles['gap']
    readonly minColumnWidth?: RendererStyles['minColumnWidth']
    readonly maxInlineSize?: RendererStyles['maxInlineSize']
    readonly maxColumnWidth?: RendererStyles['maxColumnWidth']
    readonly defaultMargin?: number
    readonly defaultGap?: number
    readonly defaultMinColumnWidth?: number
    readonly minScale?: number
    readonly maxScale?: number
    readonly devicePixelRatio?: number
}

export interface FixedPageFit {
    readonly margin: number
    readonly availableInlineSize: number
    readonly targetInlineSize: number
    readonly scale: number
    readonly viewport: FixedPageViewport
}

export interface FixedPageContentRenderContext {
    readonly document: FixedDocument
    readonly page: FixedPageInfo
    readonly scale: number
    readonly viewport: FixedPageViewport
    readonly styles: RendererStyles
}

export interface FixedSpreadFit {
    readonly margin: number
    readonly availableInlineSize: number
    readonly targetInlineSize: number
    readonly scale: number
    readonly gap: number
    readonly spreadWidth: number
    readonly spreadHeight: number
}

export interface FixedSpreadPageLayout {
    readonly page: FixedPageInfo
    readonly x: number
    readonly y: number
    readonly viewport: FixedPageViewport
}

export function resolveFixedPageFit(
    page: FixedPageInfo,
    metrics: FixedViewportMetrics,
    options: FixedPageFitOptions = {},
): FixedPageFit {
    const margin = parseCSSPixels(options.margin, options.defaultMargin ?? 0)
    const availableInlineSize = Math.max(1, metrics.inlineSize - margin * 2)
    const maxInlineSize = parseCSSPixels(
        options.maxInlineSize ?? options.maxColumnWidth,
        availableInlineSize,
    )
    const targetInlineSize = Math.max(1, Math.min(availableInlineSize, maxInlineSize))
    const unclampedScale = targetInlineSize / Math.max(1, page.width)
    const scale = clampScale(unclampedScale, options.minScale, options.maxScale)
    return {
        margin,
        availableInlineSize,
        targetInlineSize,
        scale,
        viewport: createFixedPageViewport(page, {
            scale,
            devicePixelRatio: normalizeDevicePixelRatio(options.devicePixelRatio),
        }),
    }
}

export function getFixedVisiblePageCount(
    layoutMode: LayoutMode,
    maxColumnCount: number,
    metrics: FixedViewportMetrics,
    options: FixedPageFitOptions = {},
): number {
    const margin = parseCSSPixels(options.margin, options.defaultMargin ?? 0)
    const gap = parseCSSPixels(options.gap, options.defaultGap ?? 0)
    const minColumnWidth = parseCSSPixels(options.minColumnWidth, options.defaultMinColumnWidth ?? 320)
    const availableInlineSize = Math.max(1, metrics.inlineSize - margin * 2)
    return getColumnCount(layoutMode, availableInlineSize, minColumnWidth, gap, maxColumnCount)
}

export function resolveFixedSpreadFit(
    pages: readonly FixedPageInfo[],
    metrics: FixedViewportMetrics,
    options: FixedPageFitOptions = {},
): FixedSpreadFit {
    const margin = parseCSSPixels(options.margin, options.defaultMargin ?? 0)
    const gap = parseCSSPixels(options.gap, options.defaultGap ?? 0)
    const availableInlineSize = Math.max(1, metrics.inlineSize - margin * 2)
    const maxInlineSize = parseCSSPixels(
        options.maxColumnWidth ?? options.maxInlineSize,
        availableInlineSize,
    )
    const pageCount = Math.max(1, pages.length)
    const availableForPages = Math.max(1, availableInlineSize - gap * (pageCount - 1))
    const targetPageInlineSize = Math.max(1, Math.min(maxInlineSize, availableForPages / pageCount))
    const unclampedScale = Math.min(...pages.map(page => targetPageInlineSize / Math.max(1, page.width)))
    const scale = clampScale(unclampedScale, options.minScale, options.maxScale)
    const unscaledGap = gap / Math.max(scale, 1e-6)
    const spreadWidth = pages.reduce((total, page, index) => total + page.width + (index > 0 ? unscaledGap : 0), 0)
    const spreadHeight = Math.max(1, ...pages.map(page => page.height))
    return {
        margin,
        availableInlineSize,
        targetInlineSize: spreadWidth * scale,
        scale,
        gap: unscaledGap,
        spreadWidth,
        spreadHeight,
    }
}

export function getFixedSpreadPageLayouts(
    pages: readonly FixedPageInfo[],
    fit: FixedSpreadFit,
    options: Pick<FixedPageFitOptions, 'devicePixelRatio'> = {},
): FixedSpreadPageLayout[] {
    let x = 0
    return pages.map(page => {
        const item: FixedSpreadPageLayout = {
            page,
            x,
            y: Math.max(0, (fit.spreadHeight - page.height) / 2),
            viewport: createFixedPageViewport(page, {
                scale: fit.scale,
                devicePixelRatio: normalizeDevicePixelRatio(options.devicePixelRatio),
            }),
        }
        x += page.width + fit.gap
        return item
    })
}

export function createFixedPageContentRenderContext(
    document: FixedDocument,
    page: FixedPageInfo,
    styles: RendererStyles,
    fit: FixedPageFit,
): FixedPageContentRenderContext {
    return {
        document,
        page,
        scale: fit.scale,
        viewport: fit.viewport,
        styles,
    }
}

function clampScale(scale: number, minScale?: number, maxScale?: number): number {
    const min = positiveFinite(minScale) ?? 0
    const max = positiveFinite(maxScale) ?? Number.POSITIVE_INFINITY
    const normalizedMax = Math.max(min, max)
    return Math.max(min, Math.min(normalizedMax, positiveFinite(scale) ?? 1))
}

function normalizeDevicePixelRatio(value: number | undefined): number {
    return positiveFinite(value) ?? 1
}

function positiveFinite(value: number | undefined): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}
