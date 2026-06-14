import { describe, expect, it } from 'vitest'
import {
    getLineReflowableTextRange,
    markMatchesReflowableRange,
    resolveFixedMarkRects,
    resolveReflowableLineMarks,
} from '../../src/core/mark-resolver'
import type { LineRange, TextBlock } from '../../src/core/pretext'
import type { ReaderMark } from '../../src/core/renderer'

describe('mark resolver', () => {
    it('resolves fixed and image mark rects for a page', () => {
        const marks: ReaderMark[] = [
            {
                id: 'pdf-mark',
                location: {
                    type: 'fixed',
                    format: 'pdf',
                    pageIndex: 2,
                    rect: { x: 10, y: 20, width: 30, height: 40 },
                },
            },
            {
                id: 'image-mark',
                location: {
                    type: 'image',
                    pageIndex: 2,
                    rect: { x: 1, y: 2, width: 3, height: 4 },
                },
            },
            {
                id: 'other-page',
                location: {
                    type: 'fixed',
                    format: 'pdf',
                    pageIndex: 3,
                    rect: { x: 0, y: 0, width: 1, height: 1 },
                },
            },
        ]

        expect(resolveFixedMarkRects(marks, { format: 'pdf', pageIndex: 2 })).toMatchObject([
            { mark: { id: 'pdf-mark' }, rect: { x: 10, y: 20, width: 30, height: 40 } },
            { mark: { id: 'image-mark' }, rect: { x: 1, y: 2, width: 3, height: 4 } },
        ])
        expect(resolveFixedMarkRects(marks, { pageIndex: 2 })).toMatchObject([
            { mark: { id: 'image-mark' }, rect: { x: 1, y: 2, width: 3, height: 4 } },
        ])
    })

    it('resolves reflowable line marks from the shared location model', () => {
        const line = createLine()
        const marks: ReaderMark[] = [
            {
                id: 'inside-line',
                location: {
                    start: { type: 'reflowable', sectionIndex: 1, blockId: 'p1', offset: 2 },
                    end: { type: 'reflowable', sectionIndex: 1, blockId: 'p1', offset: 5 },
                },
            },
            {
                id: 'other-block',
                location: { type: 'reflowable', sectionIndex: 1, blockId: 'p2' },
            },
        ]
        const range = getLineReflowableTextRange(line, 1)

        expect(range).toMatchObject({
            sectionIndex: 1,
            blockId: 'p1',
            startOffset: 0,
            endOffset: 10,
            offsetsReliable: true,
        })
        expect(markMatchesReflowableRange(marks[0], range)).toBe(true)
        expect(resolveReflowableLineMarks(marks, line, 1).map(mark => mark.id)).toEqual(['inside-line'])
    })
})

function createLine(): LineRange {
    const block: TextBlock = {
        id: 'p1',
        type: 'paragraph',
        segments: [{ text: 'Line text' }],
    }
    return {
        index: 0,
        kind: 'text',
        block,
        start: { segmentIndex: 0, cursor: { segmentIndex: 0, graphemeIndex: 0 } },
        end: { segmentIndex: 0, cursor: { segmentIndex: 0, graphemeIndex: 10 } },
        text: 'Line text',
        width: 80,
        top: 0,
        height: 20,
        segments: [{
            segmentIndex: 0,
            start: { segmentIndex: 0, graphemeIndex: 0 },
            end: { segmentIndex: 0, graphemeIndex: 10 },
            text: 'Line text',
            style: {},
            gapBefore: 0,
            occupiedWidth: 80,
        }],
    }
}
