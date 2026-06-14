import { describe, expect, it } from 'vitest'
import {
    clampSpreadIndex,
    getNextSpreadIndex,
    getPreviousSpreadIndex,
    getSpreadItems,
    getSpreadNavigationStep,
    getSpreadVisibleItemCount,
} from '../../src/core/spread-layout'

describe('spread layout strategy', () => {
    it('resolves visible spread items from viewport, margin, gap, and layout mode', () => {
        expect(getSpreadVisibleItemCount('paginated', 2, {
            inlineSize: 900,
            blockSize: 700,
        }, {
            margin: 40,
            gap: 24,
            minColumnWidth: 360,
        })).toBe(2)

        expect(getSpreadVisibleItemCount('paginated', 2, {
            inlineSize: 760,
        }, {
            margin: 40,
            gap: 24,
            minColumnWidth: 360,
        })).toBe(1)

        expect(getSpreadVisibleItemCount('scrolled', 2, {
            inlineSize: 1200,
        }, {
            minColumnWidth: 320,
        })).toBe(1)
    })

    it('selects visible fixed-document items for PDF and CBZ spreads', () => {
        expect(getSpreadItems(['p0', 'p1', 'p2'], 0, 2)).toEqual(['p0', 'p1'])
        expect(getSpreadItems(['p0', 'p1', 'p2'], 2, 2)).toEqual(['p2'])
        expect(getSpreadItems(['p0', 'p1'], 8, 2)).toEqual(['p1'])
    })

    it('uses item navigation for fixed pages and spread navigation for reflowable pages', () => {
        expect(getSpreadNavigationStep(2, 'item')).toBe(2)
        expect(getSpreadNavigationStep(2, 'spread')).toBe(1)

        expect(getNextSpreadIndex(0, 5, 2, 'item')).toBe(2)
        expect(getPreviousSpreadIndex(4, 5, 2, 'item')).toBe(2)

        expect(getNextSpreadIndex(0, 5, 2, 'spread')).toBe(1)
        expect(getPreviousSpreadIndex(4, 5, 2, 'spread')).toBe(3)
    })

    it('returns null at navigation boundaries and clamps invalid indexes defensively', () => {
        expect(getNextSpreadIndex(4, 5, 2, 'item')).toBeNull()
        expect(getPreviousSpreadIndex(0, 5, 2, 'item')).toBeNull()
        expect(clampSpreadIndex(Number.NaN, 5)).toBe(0)
        expect(clampSpreadIndex(12, 5)).toBe(4)
        expect(clampSpreadIndex(-3, 5)).toBe(0)
    })
})
