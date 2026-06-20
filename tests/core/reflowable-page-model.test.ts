import { describe, expect, it } from 'vitest'
import type { LineRange } from '../../src/core/pretext'
import {
    findReadableReflowablePage,
    getRenderedReflowableLinePosition,
    getReflowableScrollTopForFraction,
    getReflowableScrollTopForSourceTop,
    getReflowableSectionFraction,
    getReflowableSourceHeightForPages,
    getReflowableSourceViewport,
    getReflowableVisibleLineWindow,
    getReflowableColumnInlinePadding,
    resolveReflowablePageGeometry,
    type ReflowableColumnLayout,
} from '../../src/core/reflowable-page-model'

describe('reflowable page model', () => {
    it('projects source lines into paginated spread coordinates', () => {
        const layout = createLayout({
            columns: 2,
            pageHeight: 140,
            columnHeight: 100,
            pagePaddingBlock: 20,
            pageCount: 3,
        })

        expect(getRenderedReflowableLinePosition(createLine(0, 130), layout, 'paginated'))
            .toEqual({ top: 50, left: 224 })
        expect(getRenderedReflowableLinePosition(createLine(1, 250), layout, 'paginated'))
            .toEqual({ top: 210, left: 0 })

        expect(getReflowableSourceViewport('paginated', layout, {
            scrollTop: 0,
            scrollHeight: 420,
            clientHeight: 140,
        }, 2)).toEqual({
            sourceScrollTop: 400,
            sourceViewportHeight: 200,
        })
    })

    it('keeps source column offset stable on floating point column boundaries', () => {
        const layout = createLayout({
            columns: 2,
            pageHeight: 1174,
            columnHeight: 898.4594594594594,
            pagePaddingBlock: 0,
            pagePaddingBlockStart: 124.93513513513521,
            pagePaddingBlockEnd: 150.60540540540546,
            columnWidth: 760,
            gap: 24,
        })
        const imageTop = 17070.729729729726
        const captionTop = imageTop + 181

        const imagePosition = getRenderedReflowableLinePosition(createLine(0, imageTop), layout, 'paginated')
        const captionPosition = getRenderedReflowableLinePosition(createLine(1, captionTop), layout, 'paginated')

        expect(imagePosition.left).toBe(784)
        expect(captionPosition.left).toBe(784)
        expect(imagePosition.top).toBeCloseTo(10690.935135135135)
        expect(captionPosition.top).toBeCloseTo(imagePosition.top + 181)
    })

    it('calculates scrolled source viewport, fraction, and scroll targets', () => {
        const layout = createLayout({ pagePaddingBlock: 16 })
        const metrics = { scrollTop: 70, scrollHeight: 500, clientHeight: 100 }

        expect(getReflowableSourceViewport('scrolled', layout, metrics, 0)).toEqual({
            sourceScrollTop: 54,
            sourceViewportHeight: 132,
        })
        expect(getReflowableSectionFraction('scrolled', layout, metrics, 0)).toBeCloseTo(0.175)
        expect(getReflowableScrollTopForSourceTop(24, 'scrolled', layout)).toBe(40)
        expect(getReflowableScrollTopForFraction('scrolled', layout, metrics, 0.5)).toBe(200)
    })

    it('finds readable paginated pages independently of a browser scroller', () => {
        const layout = createLayout({ columns: 2, columnHeight: 100, pageHeight: 120, pageCount: 3 })
        const lines = [
            createLine(0, 0),
            createLine(1, 420),
        ]

        expect(findReadableReflowablePage(lines, 'paginated', layout, 1, 1)).toBe(2)
        expect(findReadableReflowablePage(lines, 'paginated', layout, 1, -1)).toBe(0)
        expect(findReadableReflowablePage(lines, 'paginated', layout, 1, 0)).toBe(0)
        expect(findReadableReflowablePage(lines, 'paginated', layout, 3, 1)).toBeNull()
        expect(findReadableReflowablePage(lines, 'scrolled', layout, 8, 1)).toBe(0)
    })

    it('derives visible line windows and prefetch source heights from core inputs', () => {
        const layout = createLayout({ columns: 2, columnHeight: 100, pageHeight: 120, pageCount: 3 })
        const lines = [
            createLine(0, 0),
            createLine(1, 96),
            createLine(2, 220),
            createLine(3, 420),
        ]
        const metrics = { scrollTop: 0, scrollHeight: 360, clientHeight: 120 }

        const window = getReflowableVisibleLineWindow(lines, 'paginated', layout, metrics, 1)

        expect(window.startIndex).toBe(2)
        expect(window.endIndex).toBe(3)
        expect(window.lines.map(line => line.index)).toEqual([2])
        expect(getReflowableSourceHeightForPages('paginated', layout, metrics, 2)).toBe(400)
        expect(getReflowableSourceHeightForPages('scrolled', layout, metrics, 2)).toBe(240)
    })

    it('keeps viewport fitting on narrow auto viewports', () => {
        const geometry = resolveReflowablePageGeometry({
            layoutMode: 'paginated',
            maxColumnCount: 2,
            availableInlineSize: 390,
            availableBlockSize: 800,
            gap: 0,
            minColumnWidth: 360,
            maxColumnWidth: 960,
            pagePaddingInline: 24,
            pagePaddingBlock: 32,
            pageFit: 'auto',
        })

        expect(geometry.pageFit).toBe('viewport')
        expect(geometry.columns).toBe(1)
        expect(geometry.columnWidth).toBe(390)
        expect(geometry.inlineSize).toBe(342)
        expect(geometry.pagePaddingBlockStart).toBe(32)
        expect(geometry.pageHeight).toBe(800)
        expect(geometry.pageFrameHeight).toBe(800)
        expect(geometry.pageFrameTop).toBe(0)
    })

    it('fits larger auto viewports to paper-like page proportions', () => {
        const geometry = resolveReflowablePageGeometry({
            layoutMode: 'paginated',
            maxColumnCount: 2,
            availableInlineSize: 1128,
            availableBlockSize: 800,
            gap: 0,
            minColumnWidth: 360,
            maxColumnWidth: 960,
            pagePaddingInline: 24,
            pagePaddingBlock: 32,
            pageFit: 'auto',
        })

        expect(geometry.pageFit).toBe('paper')
        expect(geometry.columns).toBe(2)
        expect(geometry.columnWidth).toBeCloseTo(518.7, 1)
        expect(geometry.inlineSize).toBeCloseTo(385.5, 1)
        expect(geometry.pageHeight).toBe(800)
        expect(geometry.pageFrameHeight).toBeCloseTo(736, 1)
        expect(geometry.pageFrameTop).toBeCloseTo(32, 1)
        expect(geometry.pagePaddingInlineStart).toBeLessThan(geometry.pagePaddingInlineEnd)
        expect(geometry.pagePaddingBlockStart).toBeGreaterThan(80)
        expect(geometry.pagePaddingBlockEnd).toBeGreaterThan(100)

        expect(getReflowableColumnInlinePadding({
            ...createLayout(),
            columns: geometry.columns,
            columnWidth: geometry.columnWidth,
            pagePaddingInline: geometry.pagePaddingInline,
            pagePaddingInlineStart: geometry.pagePaddingInlineStart,
            pagePaddingInlineEnd: geometry.pagePaddingInlineEnd,
        }, 0)).toEqual({
            start: geometry.pagePaddingInlineStart,
            end: geometry.pagePaddingInlineEnd,
        })
        expect(getReflowableColumnInlinePadding({
            ...createLayout(),
            columns: geometry.columns,
            columnWidth: geometry.columnWidth,
            pagePaddingInline: geometry.pagePaddingInline,
            pagePaddingInlineStart: geometry.pagePaddingInlineStart,
            pagePaddingInlineEnd: geometry.pagePaddingInlineEnd,
        }, 1)).toEqual({
            start: geometry.pagePaddingInlineEnd,
            end: geometry.pagePaddingInlineStart,
        })
    })
})

function createLayout(overrides: Partial<ReflowableColumnLayout> = {}): ReflowableColumnLayout {
    return {
        margin: 16,
        gap: 24,
        columnWidth: 200,
        columns: 1,
        pageHeight: 120,
        columnHeight: 88,
        pagePaddingInline: 0,
        pagePaddingBlock: 16,
        totalHeight: 120,
        pageCount: 1,
        ...overrides,
    }
}

function createLine(index: number, top: number, height = 20): LineRange {
    return {
        index,
        kind: 'text',
        text: `line ${index}`,
        top,
        height,
        width: 80,
        segments: [],
    }
}
