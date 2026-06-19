import { describe, expect, it } from 'vitest'
import {
    getReadableContentUnit,
    getReadableContentUnits,
    resolveReadableContentUnitIndex,
} from '../../src/core/readable-content'
import type { Book, Section, TOCItem } from '../../src/core/types'

describe('readable content', () => {
    it('builds section units with a cached linear TOC lookup', () => {
        const size = 500
        let resolveCalls = 0
        const sections: Section[] = Array.from({ length: size }, (_, index) => ({
            id: `Text/chapter_${index}.html`,
            size: 100,
            load: () => `chapter ${index}`,
        }))
        const toc: TOCItem[] = sections.map((section, index) => ({
            label: `Chapter ${index}`,
            href: String(section.id),
        }))
        const book: Book = {
            sections,
            toc,
            resolveHref: (href) => {
                resolveCalls++
                const index = sections.findIndex(section => section.id === href)
                return index >= 0 ? { index } : null
            },
        }

        const units = getReadableContentUnits(book)

        expect(units).toHaveLength(size)
        expect(units[123]?.title).toBe('Chapter 123')
        expect(resolveCalls).toBe(size)

        expect(getReadableContentUnit(book, 123)?.title).toBe('Chapter 123')
        expect(resolveReadableContentUnitIndex(book, 'Text/chapter_123.html')).toBe(123)
        expect(resolveCalls).toBe(size + 1)
    })
})
