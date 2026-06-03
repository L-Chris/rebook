import { describe, expect, it } from 'vitest'
import type { Book } from '../../src/core/types'
import {
    canAccessTarget,
    estimateNextTotalFractionFromSnapshot,
    estimatePageLimitFraction,
    getAllowedTOCHrefs,
    getCurrentTOCAccessItem,
    getTargetStartFraction,
    getTOCAccessItems,
    getTotalFraction,
    getTrialPageStepFraction,
    normalizeBookPath,
    normalizeNavigationHref,
    resolveBookNavigation,
    willForwardExceedLimit,
} from '../../src/utils/reader'

const book = {
    metadata: {},
    sections: [
        { id: 'OEBPS/Text/cover.xhtml', format: 'xhtml', size: 1000, load: async () => '' },
        { id: 'OEBPS/Text/chapter-1.xhtml', format: 'xhtml', size: 4000, load: async () => '' },
        { id: 'OEBPS/Text/chapter-2.xhtml', format: 'xhtml', size: 5000, load: async () => '' },
    ],
    pageList: [],
    toc: [
        { label: 'Cover', href: 'Text/cover.xhtml' },
        {
            label: 'Part One',
            href: 'Text/chapter-1.xhtml#start',
            subitems: [
                { label: 'Chapter Two', href: 'Text/chapter-2.xhtml' },
            ],
        },
    ],
    resolveHref: (href: string) => {
        if (href === 'Text/chapter-1.xhtml#start') return { index: 1 }
        return null
    },
} as unknown as Book

describe('reader utilities', () => {
    it('normalizes navigation hrefs and book paths', () => {
        expect(normalizeNavigationHref('Text/chapter.xhtml#frag')).toBe('Text/chapter.xhtml')
        expect(normalizeBookPath('/OEBPS/Text/../Images/cover.jpg')).toBe('OEBPS/Images/cover.jpg')
    })

    it('resolves navigation through parser resolveHref or section path fallback', () => {
        expect(resolveBookNavigation(book, 'Text/chapter-1.xhtml#start')?.index).toBe(1)
        expect(resolveBookNavigation(book, '../Text/chapter-2.xhtml')?.index).toBe(2)
        expect(resolveBookNavigation(book, 'missing.xhtml')).toBeNull()
    })

    it('converts section progress to total progress', () => {
        expect(getTotalFraction({ index: 1, fraction: 0.5 }, [0, 0.1, 0.5, 1])).toBeCloseTo(0.3)
        expect(getTotalFraction({ index: 1, fraction: 0.5, totalFraction: 0.42 }, [0, 0.1, 0.5, 1])).toBe(0.42)
    })

    it('estimates trial limits and page steps', () => {
        expect(estimatePageLimitFraction(book, { maxPages: 2 })).toBeCloseTo(0.5)
        expect(getTrialPageStepFraction(book, { maxPages: 2 })).toBeCloseTo(0.25)
        expect(estimatePageLimitFraction(book)).toBe(1)
    })

    it('builds TOC access state and allowed hrefs', () => {
        const sectionFractions = [0, 0.1, 0.6, 1]
        const items = getTOCAccessItems(book, sectionFractions, 0.5)

        expect(items.map(item => ({
            label: item.label,
            depth: item.depth,
            sectionIndex: item.sectionIndex,
            disabled: item.disabled,
        }))).toEqual([
            { label: 'Cover', depth: 0, sectionIndex: 0, disabled: false },
            { label: 'Part One', depth: 0, sectionIndex: 1, disabled: false },
            { label: 'Chapter Two', depth: 1, sectionIndex: 2, disabled: true },
        ])
        expect(getAllowedTOCHrefs(book, sectionFractions, 0.5)).toEqual([
            'Text/cover.xhtml',
            'Text/chapter-1.xhtml',
        ])
    })

    it('checks target access and current TOC fallback', () => {
        const sectionFractions = [0, 0.1, 0.6, 1]
        const items = getTOCAccessItems(book, sectionFractions, 0.5)

        expect(getTargetStartFraction(book, sectionFractions, 'Text/chapter-1.xhtml#start')).toBe(0.1)
        expect(canAccessTarget(book, sectionFractions, 'Text/chapter-2.xhtml', 0.5)).toBe(false)
        expect(getCurrentTOCAccessItem(items, { index: 2, fraction: 0 })?.label).toBe('Chapter Two')
        expect(getCurrentTOCAccessItem(items, { index: 999, fraction: 0 })?.label).toBe('Chapter Two')
    })

    it('estimates forward navigation against a limit', () => {
        expect(estimateNextTotalFractionFromSnapshot({
            sectionIndex: 1,
            sectionCount: 3,
            pageIndex: 0,
            pageCount: 3,
            fraction: 0,
        }, [0, 0.2, 0.7, 1])).toBeCloseTo(0.45)

        expect(willForwardExceedLimit({ index: 1, fraction: 0.9 }, [0, 0.2, 0.7, 1], 0.7, 0.1)).toBe(true)
        expect(willForwardExceedLimit({ index: 1, fraction: 0.2 }, [0, 0.2, 0.7, 1], 0.7, 0.1)).toBe(false)
    })
})
