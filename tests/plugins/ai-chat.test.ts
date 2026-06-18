import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import type { LanguageModel } from 'ai'
import type { FixedDocument } from '../../src/core/fixed-document'
import type { Book, TextBlock } from '../../src/core/types'
import { nodePdfRuntime } from '../../src/pdf/runtime/node'
import { PDFParser } from '../../src/parsers/pdf'
import { createAIChatController, createAIChatTools, withAIChat, type AIChatBook } from '../../src/plugins/ai-chat'

const makeBook = (): Book => {
    const blocks: TextBlock[][] = [
        [
            { id: 'one-title', type: 'chapter', segments: [{ text: 'One: The Basics' }] },
            { id: 'one-body', type: 'paragraph', segments: [{ text: 'Systems thinking starts with stocks, flows, and feedback loops.' }] },
        ],
        [
            { id: 'two-title', type: 'chapter', segments: [{ text: 'Two: Examples' }] },
            { id: 'two-body', type: 'paragraph', segments: [{ text: 'A thermostat is a common feedback example.' }] },
        ],
    ]

    return {
        sections: blocks.map((sectionBlocks, index) => ({
            id: `section-${index + 1}.xhtml`,
            size: 100,
            load: () => '',
            getBlocks: () => sectionBlocks,
        })),
        toc: [
            { label: 'One: The Basics', href: 'section-1.xhtml' },
            { label: 'Two: Examples', href: 'section-2.xhtml' },
        ],
        metadata: {
            title: 'Thinking in Systems',
            author: 'Donella Meadows',
            language: 'en',
        },
        resolveHref: href => ({ index: href.includes('section-2') ? 1 : 0 }),
    }
}

const model = 'test-model' as LanguageModel

describe('withAIChat', () => {
    it('attaches an AI chat controller to a book', async () => {
        const enhanced = await withAIChat({ model })(makeBook()) as AIChatBook

        expect(enhanced.aiChat).toBeTruthy()
        await expect(enhanced.aiChat.search('feedback')).resolves.toHaveLength(2)
        await expect(enhanced.aiChat.getContent(0)).resolves.toMatchObject({
            unitIndex: 0,
            unitKind: 'section',
            title: 'One: The Basics',
        })
        expect(enhanced.aiChat.getTOC()).toEqual([
            { label: 'One: The Basics', href: 'section-1.xhtml', depth: 0, unitIndex: 0, unitKind: 'section' },
            { label: 'Two: Examples', href: 'section-2.xhtml', depth: 0, unitIndex: 1, unitKind: 'section' },
        ])
    })

    it('reads and searches fixed-document page text through content units', async () => {
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
                text: pageIndex === 0 ? 'Four thousand weeks begins here.' : 'Time management is a trap.',
            }),
        }
        const book: Book = {
            sections: [],
            pageList: [
                { label: '1', href: 'pdf:page:0' },
                { label: '2', href: 'pdf:page:1' },
            ],
            toc: [{ label: 'Start', href: 'pdf:page:0' }],
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
        const controller = createAIChatController(book, { model })

        await expect(controller.getContent(1, { includeBlocks: true })).resolves.toMatchObject({
            unitIndex: 1,
            unitKind: 'page',
            pageIndex: 1,
            text: 'Time management is a trap.',
            blocks: [
                expect.objectContaining({
                    citation: expect.objectContaining({
                        unitKind: 'page',
                        pageIndex: 1,
                    }),
                }),
            ],
        })
        await expect(controller.search('management')).resolves.toEqual([
            expect.objectContaining({
                unitIndex: 1,
                unitKind: 'page',
                pageIndex: 1,
            }),
        ])
    })

    it('reads real PDF page text for AI chat content tools', async () => {
        const data = await readFile('data/四千周.pdf')
        const book = await new PDFParser().parse(data.buffer.slice(
            data.byteOffset,
            data.byteOffset + data.byteLength,
        ), { runtime: nodePdfRuntime })
        const controller = createAIChatController(book, { model })

        expect(book.sections).toHaveLength(0)
        expect(book.fixedDocument?.pageCount).toBeGreaterThan(0)

        const context = await controller.getCurrentContext({ currentUnitIndex: 0, after: 8, maxChars: 8000 })
        const textUnit = context.units.find(unit => /[\p{L}\p{N}]/u.test(unit.text))
        expect(textUnit).toBeTruthy()
        expect(textUnit?.unitKind).toBe('page')

        const query = textUnit?.text.match(/[\p{Script=Han}]{2,}|[A-Za-z]{4,}/u)?.[0]
        expect(query).toBeTruthy()

        const results = await controller.search(query!, {
            scope: 'unit',
            unitIndex: textUnit!.unitIndex,
            maxResults: 3,
        })
        expect(results.length).toBeGreaterThan(0)
        expect(results[0]).toMatchObject({
            unitIndex: textUnit!.unitIndex,
            unitKind: 'page',
            pageIndex: textUnit!.pageIndex,
        })
    })
})

describe('createAIChatTools', () => {
    it('creates bounded book tools that can read current context', async () => {
        const book = makeBook()
        const controller = createAIChatController(book, { model, maxContextChars: 80 })
        const context = await controller.getCurrentContext({ currentUnitIndex: 1, before: 1 })

        expect(context.currentUnitIndex).toBe(1)
        expect(context.units.map(unit => unit.unitIndex)).toEqual([0, 1])

        const tools = createAIChatTools(book, { model }, { currentUnitIndex: 1 })
        expect(Object.keys(tools).sort()).toEqual([
            'getBookMetadata',
            'getContent',
            'getCurrentContext',
            'getTOC',
            'searchBook',
        ])

        const content = await tools.getContent.execute?.({ maxChars: 120 }, {
            toolCallId: 'call-1',
            messages: [],
            abortSignal: new AbortController().signal,
        })
        expect(content).toMatchObject({
            unitIndex: 1,
            unitKind: 'section',
            title: 'Two: Examples',
        })
    })

    it('uses a 20000 character default for current-context tools', async () => {
        const longText = `${'a'.repeat(12000)}\n${'b'.repeat(12000)}`
        const book: Book = {
            sections: [{
                id: 'long.xhtml',
                size: longText.length,
                load: () => '',
                loadText: () => longText,
            }],
            toc: [{ label: 'Long Chapter', href: 'long.xhtml' }],
            resolveHref: () => ({ index: 0 }),
        }
        const tools = createAIChatTools(book, { model }, { currentUnitIndex: 0 })
        const context = await tools.getCurrentContext.execute?.({}, {
            toolCallId: 'call-context',
            messages: [],
            abortSignal: new AbortController().signal,
        })

        expect(context.units[0].text.length).toBeGreaterThan(19000)
        expect(context.units[0].text.length).toBeLessThan(20500)
        expect(context.units[0].truncated).toBe(true)
    })
})
