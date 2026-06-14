import { describe, expect, it } from 'vitest'
import type { FixedPageTextLayer, FixedPageTextRun } from '../../src/core/fixed-document'
import {
    createFixedPageTextProvider,
    emptyFixedPageTextLayer,
    fixedPageTextChunks,
    fixedTextChunkMatchesRange,
    fixedTextRunRect,
} from '../../src/core/fixed-text-provider'

describe('fixed text provider', () => {
    it('maps fixed text runs to fixed locations and searchable chunks', async () => {
        const layer = createTextLayer('Fixed text provider')
        const provider = createFixedPageTextProvider(layer, 'pdf')

        const chunks = await provider.getText()
        const results = await provider.search!('provider')

        expect(chunks).toMatchObject([{
            id: 'pdf:4:text:0',
            text: 'Fixed text provider',
            location: {
                type: 'fixed',
                format: 'pdf',
                pageIndex: 4,
                rect: { x: 40, y: 56, width: 160, height: 16 },
            },
            rects: [{ x: 40, y: 56, width: 160, height: 16 }],
        }])
        expect(results[0].range.start).toMatchObject({
            type: 'fixed',
            format: 'pdf',
            pageIndex: 4,
        })
    })

    it('maps comic text runs to image locations', () => {
        const [chunk] = fixedPageTextChunks(createTextLayer('Comic text'), 'cbz')

        expect(chunk).toMatchObject({
            id: 'cbz:4:text:0',
            location: {
                type: 'image',
                pageIndex: 4,
                rect: { x: 40, y: 56, width: 160, height: 16 },
            },
        })
    })

    it('filters chunks by fixed or image book ranges', async () => {
        const layer = createTextLayer('Scoped fixed text')
        const [chunk] = fixedPageTextChunks(layer, 'pdf')
        const provider = createFixedPageTextProvider(layer, 'pdf')

        expect(fixedTextChunkMatchesRange(chunk, {
            start: { type: 'fixed', format: 'pdf', pageIndex: 4 },
        }, 'pdf', 4)).toBe(true)
        expect(await provider.getText({
            start: { type: 'fixed', format: 'pdf', pageIndex: 5 },
        })).toHaveLength(0)
        expect(fixedTextChunkMatchesRange(chunk, {
            start: { type: 'image', pageIndex: 4 },
        }, 'pdf', 4)).toBe(true)
    })

    it('creates empty text layers from fixed page info', () => {
        expect(emptyFixedPageTextLayer({ index: 8, width: 300, height: 400 })).toEqual({
            pageIndex: 8,
            width: 300,
            height: 400,
            runs: [],
            text: '',
        })
    })

    it('derives fallback run rects from text transforms', () => {
        expect(fixedTextRunRect(createRun('Fallback'))).toMatchObject({
            x: 40,
            y: 56,
            width: 160,
            height: 16,
        })
    })
})

function createTextLayer(text: string): FixedPageTextLayer {
    return {
        pageIndex: 4,
        width: 300,
        height: 144,
        text,
        runs: [createRun(text)],
    }
}

function createRun(text: string): FixedPageTextRun {
    return {
        text,
        transform: [16, 0, 0, 16, 40, 72],
        fontSize: 16,
        width: 160,
    }
}
