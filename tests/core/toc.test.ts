import { describe, expect, it } from 'vitest'
import {
    createSectionIndexLookup,
    findSectionIndex,
    findTOCItemForSection,
    flattenTOC,
    isSameTOCItem,
    normalizeBookPath,
    normalizeNavigationHref,
    resolveTOCSectionIndex,
} from '../../src/core/toc'
import type { Book } from '../../src/core/types'

describe('core TOC utilities', () => {
    it('flattens nested TOC items in reading order', () => {
        const items = flattenTOC([
            {
                label: 'Part',
                href: 'part.xhtml',
                subitems: [
                    { label: 'Chapter 1', href: 'chapter-1.xhtml' },
                    { label: 'Chapter 2', href: 'chapter-2.xhtml' },
                ],
            },
            { label: 'Appendix', href: 'appendix.xhtml' },
        ])

        expect(items.map(item => item.label)).toEqual(['Part', 'Chapter 1', 'Chapter 2', 'Appendix'])
    })

    it('normalizes TOC hrefs and book paths consistently', () => {
        expect(normalizeNavigationHref(' OEBPS/Text/chapter.xhtml#frag ')).toBe('OEBPS/Text/chapter.xhtml')
        expect(normalizeBookPath('/OEBPS/Text/../chapter.xhtml#frag')).toBe('OEBPS/chapter.xhtml')
        expect(normalizeBookPath('Text\\chapter.xhtml')).toBe('Text/chapter.xhtml')
    })

    it('resolves TOC section indexes through href, split href, and path suffixes', () => {
        const book: Book = {
            sections: [
                { id: 'OEBPS/Text/intro.xhtml', size: 1, load: () => '' },
                { id: 'OEBPS/Text/chapter.xhtml', size: 1, load: () => '' },
            ],
            toc: [
                { label: 'Intro', href: 'Text/intro.xhtml' },
                { label: 'Chapter', href: 'chapter.xhtml#start' },
            ],
            splitTOCHref(href) {
                return [`OEBPS/Text/${href.split('#')[0]}`, href.includes('#') ? href.split('#')[1] : null]
            },
        }
        const lookup = createSectionIndexLookup(book)

        expect(findSectionIndex(lookup, 'OEBPS/Text/chapter.xhtml')).toBe(1)
        expect(resolveTOCSectionIndex(book, 'Text/intro.xhtml', lookup)).toBe(0)
        expect(resolveTOCSectionIndex(book, 'chapter.xhtml#start', lookup)).toBe(1)
        expect(findTOCItemForSection(book, 1)?.label).toBe('Chapter')
    })

    it('matches active TOC items by normalized href', () => {
        expect(isSameTOCItem(
            { label: 'A', href: ' chapter.xhtml#frag ' },
            { label: 'B', href: 'chapter.xhtml#frag' },
        )).toBe(true)
        expect(isSameTOCItem(
            { label: 'A', href: 'chapter.xhtml#one' },
            { label: 'B', href: 'chapter.xhtml#two' },
        )).toBe(false)
    })
})
