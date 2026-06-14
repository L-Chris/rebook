import {
    createFixedPageViewport,
    type FixedDocument,
    type FixedPageInfo,
    type FixedPageViewport,
} from './fixed-document'
import type { RendererStyles } from './renderer'
import { parseCSSPixels } from './renderer-utils'

export interface FixedViewportMetrics {
    readonly inlineSize: number
    readonly blockSize: number
}

export interface FixedPageFitOptions {
    readonly margin?: RendererStyles['margin']
    readonly maxInlineSize?: RendererStyles['maxInlineSize']
    readonly maxColumnWidth?: RendererStyles['maxColumnWidth']
    readonly defaultMargin?: number
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
