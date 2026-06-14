import { describe, expect, it } from 'vitest'
import {
    createReflowableTextProvider,
    lineMatchesReflowableBookRange,
    lineToReflowableBookRange,
    lineToReflowableTextChunkRecord,
} from '../../src/core/reflowable-text-provider'
import type { LineRange, TextBlock } from '../../src/core/pretext'

describe('reflowable text provider', () => {
    it('maps layout lines to text chunks, ranges, and rendered rects', () => {
        const line = createLine({
            index: 3,
            text: 'Hello reflowable core',
            blockId: 'p1',
            startOffset: 2,
            endOffset: 23,
            top: 40,
            left: 16,
            inlineOffset: 8,
            width: 180,
            height: 20,
        })

        const record = lineToReflowableTextChunkRecord(line, {
            sectionIndex: 7,
            getLinePosition: item => ({ top: item.top + 4, left: 16 }),
        })

        expect(record.range).toEqual(lineToReflowableBookRange(line, 7))
        expect(record.chunk).toMatchObject({
            id: 'reflowable:7:line:3',
            text: 'Hello reflowable core',
            location: { type: 'reflowable', sectionIndex: 7, blockId: 'p1', offset: 2 },
            rects: [{ x: 24, y: 44, width: 180, height: 20 }],
        })
    })

    it('filters and searches lines with the shared BookRange model', () => {
        const first = createLine({
            index: 0,
            text: 'Alpha line',
            blockId: 'p1',
            startOffset: 0,
            endOffset: 10,
            top: 0,
            left: 0,
        })
        const second = createLine({
            index: 1,
            text: 'Beta line',
            blockId: 'p2',
            startOffset: 0,
            endOffset: 9,
            top: 22,
            left: 0,
        })
        const provider = createReflowableTextProvider({
            sectionIndex: 2,
            getLinePosition: line => ({ top: line.top, left: 0 }),
        }, [first, second])
        const range = {
            start: { type: 'reflowable' as const, sectionIndex: 2, blockId: 'p2', offset: 0 },
            end: { type: 'reflowable' as const, sectionIndex: 2, blockId: 'p2', offset: 9 },
        }

        expect(lineMatchesReflowableBookRange(second, 2, range)).toBe(true)
        expect(provider.getText(range)).toMatchObject([{ text: 'Beta line' }])
        expect(provider.search?.('beta', range)).toMatchObject([{
            chunk: { text: 'Beta line' },
            range,
            score: 1,
        }])
    })
})

function createLine(options: {
    index: number
    text: string
    blockId: string
    startOffset: number
    endOffset: number
    top: number
    left: number
    inlineOffset?: number
    width?: number
    height?: number
}): LineRange {
    const block: TextBlock = {
        id: options.blockId,
        type: 'paragraph',
        segments: [{ text: options.text }],
    }
    return {
        index: options.index,
        kind: 'text',
        block,
        start: {
            segmentIndex: 0,
            cursor: { segmentIndex: 0, graphemeIndex: options.startOffset },
        },
        end: {
            segmentIndex: 0,
            cursor: { segmentIndex: 0, graphemeIndex: options.endOffset },
        },
        text: options.text,
        width: options.width ?? 120,
        top: options.top,
        height: options.height ?? 18,
        inlineOffset: options.inlineOffset,
        segments: [{
            segmentIndex: 0,
            start: { segmentIndex: 0, graphemeIndex: options.startOffset },
            end: { segmentIndex: 0, graphemeIndex: options.endOffset },
            text: options.text,
            style: {},
            gapBefore: 0,
            occupiedWidth: options.width ?? 120,
        }],
    }
}
