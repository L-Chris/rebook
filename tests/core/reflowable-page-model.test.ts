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
})

function createLayout(overrides: Partial<ReflowableColumnLayout> = {}): ReflowableColumnLayout {
    return {
        margin: 16,
        gap: 24,
        columnWidth: 200,
        columns: 1,
        pageHeight: 120,
        columnHeight: 88,
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
