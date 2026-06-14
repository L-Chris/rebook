import { describe, expect, it } from 'vitest'
import {
    assertFixedPageIndex,
    createFixedPageViewport,
    isFixedDocument,
    type FixedDocument,
} from '../../src/core/fixed-document'
import { FixedPageSequence, parseFixedPageHref } from '../../src/core/fixed-page-sequence'

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

    it('tracks fixed page sequence progress and location metadata', async () => {
        const book = {
            sections: [],
            pageList: [
                { label: 'i', href: 'pdf:page:0' },
                { label: '1', href: 'pdf:page:1' },
                { label: '2', href: 'pdf:page:2' },
            ],
            toc: [
                { label: 'Cover', href: 'pdf:page:0' },
                { label: 'Chapter', href: 'pdf:page:2' },
            ],
            fixedDocument: {
                kind: 'fixed-document' as const,
                format: 'pdf' as const,
                pageCount: 3,
                getPage: (index: number) => ({ index, width: 600, height: 800 }),
            },
            resolveHref: (href: string) => {
                const index = parseFixedPageHref(href)
                return index == null ? null : { index }
            },
        }
        const sequence = await FixedPageSequence.fromBook(book)

        expect(sequence.currentPage?.index).toBe(0)
        expect(sequence.getSectionFractions()).toEqual([0, 0.5, 1])
        expect(sequence.goTo('pdf:page:2')).toBe(true)
        expect(sequence.getLocation('goto')).toMatchObject({
            index: 2,
            fraction: 1,
            totalFraction: 1,
            pageItem: { label: '2', href: 'pdf:page:2' },
            tocItem: { label: 'Chapter', href: 'pdf:page:2' },
            reason: 'goto',
        })
        expect(sequence.goToFraction(0.5)).toBe(true)
        expect(sequence.currentPage?.index).toBe(1)
        expect(sequence.next()).toBe(true)
        expect(sequence.next()).toBe(false)
    })

    it('resolves fixed page sequence targets through book href handlers', async () => {
        const book = {
            sections: [],
            toc: [
                { label: 'page001.jpg', href: 'page001.jpg' },
                { label: 'page002.jpg', href: 'page002.jpg' },
            ],
            pageList: [
                { label: 'page001.jpg', href: 'page001.jpg' },
                { label: 'page002.jpg', href: 'page002.jpg' },
            ],
            fixedDocument: {
                kind: 'fixed-document' as const,
                format: 'cbz' as const,
                pageCount: 2,
                getPages: () => [
                    { index: 0, width: 320, height: 480 },
                    { index: 1, width: 320, height: 480 },
                ],
                getPage: (index: number) => ({ index, width: 320, height: 480 }),
            },
            resolveHref: (href: string) => {
                const index = href === 'page001.jpg' ? 0 : href === 'page002.jpg' ? 1 : -1
                return index >= 0 ? { index } : null
            },
        }
        const sequence = await FixedPageSequence.fromBook(book)

        expect(sequence.goTo('page002.jpg')).toBe(true)
        expect(sequence.getLocation('goto')).toMatchObject({
            index: 1,
            fraction: 1,
            pageItem: { label: 'page002.jpg', href: 'page002.jpg' },
            tocItem: { label: 'page002.jpg', href: 'page002.jpg' },
        })
    })
})
