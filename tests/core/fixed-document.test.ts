import { describe, expect, it } from 'vitest'
import {
    assertFixedPageIndex,
    createFixedPageViewport,
    isFixedDocument,
    type FixedDocument,
} from '../../src/core/fixed-document'

describe('fixed document core', () => {
    it('identifies fixed document implementations', () => {
        const document: FixedDocument = {
            kind: 'fixed-document',
            format: 'pdf',
            pageCount: 1,
            getPage: () => ({ index: 0, width: 600, height: 800 }),
        }

        expect(isFixedDocument(document)).toBe(true)
        expect(isFixedDocument({ kind: 'fixed-document', format: 'pdf', pageCount: -1 })).toBe(false)
        expect(isFixedDocument(null)).toBe(false)
    })

    it('validates page indexes', () => {
        expect(() => assertFixedPageIndex({ pageCount: 3 }, 2)).not.toThrow()
        expect(() => assertFixedPageIndex({ pageCount: 3 }, 3)).toThrow(RangeError)
        expect(() => assertFixedPageIndex({ pageCount: 3 }, 1.5)).toThrow(RangeError)
    })

    it('creates a high-DPI viewport without changing CSS page size', () => {
        const viewport = createFixedPageViewport(
            { index: 0, width: 600, height: 800 },
            { scale: 1.25, devicePixelRatio: 2 },
        )

        expect(viewport).toMatchObject({
            pageIndex: 0,
            scale: 1.25,
            devicePixelRatio: 2,
            rotation: 0,
            cssWidth: 750,
            cssHeight: 1000,
            pixelWidth: 1500,
            pixelHeight: 2000,
            pixelScaleX: 2,
            pixelScaleY: 2,
            transform: [1.25, 0, 0, 1.25, 0, 0],
        })
    })

    it('rotates page geometry and transform consistently', () => {
        const viewport = createFixedPageViewport(
            { index: 2, width: 600, height: 800 },
            { rotation: 90 },
        )

        expect(viewport.cssWidth).toBe(800)
        expect(viewport.cssHeight).toBe(600)
        expect(viewport.transform).toEqual([0, 1, -1, 0, 800, 0])
    })

    it('rejects invalid page geometry and viewport options', () => {
        expect(() => createFixedPageViewport({ index: 0, width: 0, height: 800 })).toThrow(RangeError)
        expect(() => createFixedPageViewport({ index: -1, width: 600, height: 800 })).toThrow(RangeError)
        expect(() => createFixedPageViewport({ index: 0, width: 600, height: 800 }, { scale: 0 })).toThrow(RangeError)
        expect(() => createFixedPageViewport({ index: 0, width: 600, height: 800 }, { rotation: 45 as 0 })).toThrow(RangeError)
    })
})
