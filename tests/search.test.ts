import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import type { Book, TextBlock } from '../src/core/types'
import type { FixedDocument } from '../src/core/fixed-document'
import type { ReaderMark, Renderer } from '../src/core/renderer'
import { ReaderSession } from '../src/core/reader'
import { searchBook, searchContentUnits } from '../src/search'
import { EPUBParser } from '../src/parsers/epub'
import { NodeDOMAdapter, NodeURLFactory } from '../src/adapters/node'

const makeBook = (): Book => {
    const blocks: TextBlock[][] = [
        [
            { id: 'c1-title', type: 'chapter', segments: [{ text: 'Chapter One' }] },
            { id: 'c1-body', type: 'paragraph', segments: [{ text: 'Alpha beta gamma. Alpha appears twice.' }] },
            {
                id: 'c1-note',
                type: 'paragraph',
                segments: [{
                    text: '\uFFFC',
                    source: {
                        nodeType: 'img',
                        attrs: {
                            src: 'note.png',
                            'data-rebook-footnote-content': 'Hidden alpha note',
                        },
                    },
                }],
            },
        ],
        [
            { id: 'c2-title', type: 'chapter', segments: [{ text: 'Chapter Two' }] },
            { id: 'c2-body', type: 'paragraph', segments: [{ text: 'Beta only appears here.' }] },
        ],
    ]

    return {
        sections: blocks.map((sectionBlocks, index) => ({
            id: `chapter-${index + 1}.xhtml`,
            size: 100,
            load: () => '',
            getBlocks: () => sectionBlocks,
        })),
        toc: [
            { label: 'One', href: 'chapter-1.xhtml' },
            { label: 'Two', href: 'chapter-2.xhtml' },
        ],
        resolveHref: href => ({ index: href.includes('chapter-2') ? 1 : 0 }),
    }
}

const createNoopRenderer = (): Renderer => ({
    open: async () => {},
    goTo: async () => {},
    next: async () => {},
    prev: async () => {},
    goToFraction: async () => {},
    setStyles: () => {},
    setLayout: () => {},
    setSpread: () => {},
    setMark: () => {},
    removeMark: () => {},
    clearMarks: () => {},
    getMarks: () => [],
    getLocation: () => null,
    getSectionFractions: () => [],
    refresh: async () => {},
    on: () => {},
    off: () => {},
    destroy: () => {},
})

const createNoopRendererWithMarks = (marks: ReaderMark[]): Renderer => ({
    ...createNoopRenderer(),
    setMark: mark => {
        const index = marks.findIndex(item => item.id === mark.id)
        if (index >= 0) marks[index] = mark
        else marks.push(mark)
    },
    removeMark: id => {
        const index = marks.findIndex(item => item.id === id)
        if (index >= 0) marks.splice(index, 1)
    },
    clearMarks: kind => {
        if (kind === undefined) {
            marks.splice(0, marks.length)
            return
        }
        for (let index = marks.length - 1; index >= 0; index--) {
            if (marks[index].kind === kind) marks.splice(index, 1)
        }
    },
    getMarks: () => [...marks],
})

describe('searchBook', () => {
    it('searches full text across chapters with chapter metadata', async () => {
        const results = await searchBook(makeBook(), 'beta')

        expect(results).toHaveLength(2)
        expect(results.map(result => result.unitIndex)).toEqual([0, 1])
        expect(results[0].unitTitle).toBe('One')
        expect(results[1].unitTitle).toBe('Two')
        expect(results[0].excerpt).toContain('Alpha beta gamma')
    })

    it('searches within a selected readable unit', async () => {
        const results = await searchBook(makeBook(), 'alpha', {
            scope: 'unit',
            unitIndex: 0,
        })

        expect(results).toHaveLength(2)
        expect(results.every(result => result.unitIndex === 0)).toBe(true)
    })

    it('does not search hidden footnote content extracted from inline markers', async () => {
        const results = await searchBook(makeBook(), 'Hidden alpha note')

        expect(results).toHaveLength(0)
    })

    it('searches fixed-document page text through the same readable unit API', async () => {
        const fixedDocument: FixedDocument = {
            kind: 'fixed-document',
            format: 'pdf',
            pageCount: 2,
            getPage: pageIndex => ({ index: pageIndex, width: 600, height: 800 }),
            getPageText: pageIndex => ({
                pageIndex,
                width: 600,
                height: 800,
                runs: [],
                text: pageIndex === 0 ? 'Four thousand weeks is a short life.' : 'Attention shapes time.',
            }),
        }
        const book: Book = {
            sections: [],
            pageList: [
                { label: '1', href: 'pdf:page:0' },
                { label: '2', href: 'pdf:page:1' },
            ],
            toc: [{ label: 'Page 1', href: 'pdf:page:0' }],
            fixedDocument,
            resolveHref: href => {
                const match = href.match(/^pdf:page:(\d+)$/)
                return match ? { index: Number(match[1]) } : null
            },
            splitTOCHref: href => {
                const match = href.match(/^pdf:page:(\d+)$/)
                return [match ? Number(match[1]) : href, null]
            },
        }

        const results = await searchBook(book, 'attention')

        expect(results).toHaveLength(1)
        expect(results[0]).toMatchObject({
            unitIndex: 1,
            unitKind: 'page',
            unitTitle: '2',
            pageIndex: 1,
        })
    })
})

describe('searchContentUnits', () => {
    it('groups search results by readable content unit', async () => {
        const groups = await searchContentUnits(makeBook(), 'beta')

        expect(groups).toHaveLength(2)
        expect(groups[0].unitTitle).toBe('One')
        expect(groups[0].results).toHaveLength(1)
        expect(groups[1].unitTitle).toBe('Two')
    })
})

describe('ReaderSession search', () => {
    it('searches the current book without making search a plugin', async () => {
        const reader = new ReaderSession({
            createRenderer: createNoopRenderer,
        })

        expect(await reader.search('beta')).toHaveLength(0)

        await reader.openBook(makeBook())
        const results = await reader.search('beta')
        const groups = await reader.searchContentUnits('beta')

        expect(results.map(result => result.unitIndex)).toEqual([0, 1])
        expect(groups).toHaveLength(2)
        expect(groups[0].unitTitle).toBe('One')

        reader.destroy()
    })

    it('forwards transient reader marks to the renderer', () => {
        const marks: ReaderMark[] = []
        const reader = new ReaderSession({
            createRenderer: () => createNoopRendererWithMarks(marks),
        })

        reader.setMark({
            id: 'tts-current',
            kind: 'tts',
            location: { type: 'reflowable', sectionIndex: 0, blockId: 'p1' },
            className: 'is-current',
        })

        expect(reader.getMarks()).toHaveLength(1)
        reader.clearMarks('tts')
        expect(reader.getMarks()).toHaveLength(0)
        reader.destroy()
    })
})

describe('searchBook with real EPUB content', () => {
    it('searches all sections and can limit results to one parsed chapter', async () => {
        const parser = new EPUBParser()
        const data = await readFile('data/归我们未来经济社会的行动指南.epub')
        const book = await parser.parse(data.buffer.slice(
            data.byteOffset,
            data.byteOffset + data.byteLength,
        ), {
            domAdapter: new NodeDOMAdapter(),
            urlFactory: new NodeURLFactory(),
        })

        const allResults = await searchBook(book, 'CabNet', { maxResults: 5 })
        const firstChapterResults = await searchBook(book, 'CabNet', {
            scope: 'unit',
            unitIndex: 1,
            maxResults: 5,
        })
        const secondChapterResults = await searchBook(book, 'CabNet', {
            scope: 'unit',
            unitIndex: 2,
            maxResults: 5,
        })

        expect(allResults.length).toBeGreaterThan(0)
        expect(allResults[0].unitTitle).toBe('第一章 另一条路')
        expect(firstChapterResults.length).toBeGreaterThan(0)
        expect(firstChapterResults.every(result => result.unitIndex === 1)).toBe(true)
        expect(secondChapterResults).toHaveLength(0)
    })
})
