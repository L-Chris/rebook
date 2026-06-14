import { describe, expect, it } from 'vitest'
import {
    bookPositionMatchesReflowableRange,
    getFixedPositionRects,
} from '../../src/core/location'

describe('location model', () => {
    it('extracts fixed and image rects for the requested page', () => {
        expect(getFixedPositionRects({
            type: 'fixed',
            format: 'pdf',
            pageIndex: 1,
            rect: { x: 10, y: 20, width: 30, height: 40 },
        }, { format: 'pdf', pageIndex: 1 })).toEqual([{ x: 10, y: 20, width: 30, height: 40 }])

        expect(getFixedPositionRects({
            type: 'fixed',
            format: 'pdf',
            pageIndex: 1,
            rect: { x: 10, y: 20, width: 30, height: 40 },
        }, { format: 'pdf', pageIndex: 0 })).toEqual([])

        expect(getFixedPositionRects({
            type: 'image',
            pageIndex: 0,
            rect: { x: 0, y: 0, width: 1, height: 1 },
        }, { format: 'cbz', pageIndex: 0 })).toEqual([{ x: 0, y: 0, width: 1, height: 1 }])
    })

    it('matches reflowable block locations and offset ranges', () => {
        const location = {
            start: { type: 'reflowable' as const, sectionIndex: 2, blockId: 'p3', offset: 10 },
            end: { type: 'reflowable' as const, sectionIndex: 2, blockId: 'p3', offset: 20 },
        }

        expect(bookPositionMatchesReflowableRange(location, {
            sectionIndex: 2,
            blockId: 'p3',
            startOffset: 12,
            endOffset: 18,
            offsetsReliable: true,
        })).toBe(true)

        expect(bookPositionMatchesReflowableRange(location, {
            sectionIndex: 2,
            blockId: 'p3',
            startOffset: 20,
            endOffset: 30,
            offsetsReliable: true,
        })).toBe(false)

        expect(bookPositionMatchesReflowableRange(location, {
            sectionIndex: 2,
            blockId: 'p4',
            startOffset: 12,
            endOffset: 18,
            offsetsReliable: true,
        })).toBe(false)
    })

    it('falls back to block-level matching when line offsets are unreliable', () => {
        expect(bookPositionMatchesReflowableRange({
            start: { type: 'reflowable', sectionIndex: 0, blockId: 'p1', offset: 10 },
            end: { type: 'reflowable', sectionIndex: 0, blockId: 'p1', offset: 20 },
        }, {
            sectionIndex: 0,
            blockId: 'p1',
            startOffset: 100,
            endOffset: 120,
            offsetsReliable: false,
        })).toBe(true)
    })

    it('matches ranges spanning multiple reflowable sections', () => {
        const position = {
            start: { type: 'reflowable' as const, sectionIndex: 1 },
            end: { type: 'reflowable' as const, sectionIndex: 3 },
        }

        expect(bookPositionMatchesReflowableRange(position, { sectionIndex: 2 })).toBe(true)
        expect(bookPositionMatchesReflowableRange(position, { sectionIndex: 4 })).toBe(false)
    })
})
