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
            { id: 'one-extra-1', type: 'paragraph', segments: [{ text: 'Stocks accumulate over time.' }] },
            { id: 'one-extra-2', type: 'paragraph', segments: [{ text: 'Flows change stocks.' }] },
            { id: 'one-extra-3', type: 'paragraph', segments: [{ text: 'Boundaries shape what a system includes.' }] },
            { id: 'one-extra-4', type: 'paragraph', segments: [{ text: 'Delays can make behavior surprising.' }] },
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
        expect(enhanced.documentEdits).toBeTruthy()
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

    it('applies non-persistent document rewrites to rendered content', async () => {
        const events: unknown[] = []
        const enhanced = await withAIChat({
            model,
            onDocumentEdit: event => events.push(event),
        })(makeBook()) as AIChatBook

        const tools = enhanced.aiChat.createTools({ currentUnitIndex: 0 })
        expect(Object.keys(tools)).toEqual(expect.arrayContaining(['rewriteBlocks', 'clearRewrites', 'listRewrites']))

        const rewrite = await tools.rewriteBlocks.execute?.({
            rewrites: [{
                blockId: 'one-body',
                text: '系统思考可以先理解为：看清存量、流量和反馈回路怎样互相影响。',
            }],
        }, {
            toolCallId: 'rewrite-1',
            messages: [],
            abortSignal: new AbortController().signal,
        })
        expect(rewrite.edits).toHaveLength(1)
        expect(events).toHaveLength(1)

        await expect(enhanced.aiChat.getContent(0, { includeBlocks: true })).resolves.toMatchObject({
            text: expect.stringContaining('系统思考可以先理解为'),
            blocks: expect.arrayContaining([
                expect.objectContaining({
                    blockId: 'one-body',
                    text: '系统思考可以先理解为：看清存量、流量和反馈回路怎样互相影响。',
                }),
            ]),
        })
        await expect(enhanced.sections[0].getBlocks?.()).resolves.toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'one-body',
                segments: [expect.objectContaining({ text: expect.stringContaining('系统思考可以先理解为') })],
            }),
        ]))

        const clear = await tools.clearRewrites.execute?.({ unitIndex: 0 }, {
            toolCallId: 'clear-1',
            messages: [],
            abortSignal: new AbortController().signal,
        })
        expect(clear.edits).toHaveLength(1)
        await expect(enhanced.aiChat.getContent(0, { includeBlocks: true })).resolves.toMatchObject({
            text: expect.stringContaining('Systems thinking starts'),
        })
    })

    it('accepts stringified rewrite arrays from lenient tool callers', async () => {
        const enhanced = await withAIChat({ model })(makeBook()) as AIChatBook
        const tools = enhanced.aiChat.createTools({ currentUnitIndex: 0 })

        const result = await tools.rewriteBlocks.execute?.({
            unitIndex: 0,
            rewrites: JSON.stringify([{
                blockId: 'one-body',
                text: '系统思考从存量、流量和反馈回路开始理解。',
            }]),
        } as any, {
            toolCallId: 'rewrite-stringified',
            messages: [],
            abortSignal: new AbortController().signal,
        })

        expect(result).toMatchObject({
            count: 1,
            edits: [expect.objectContaining({ blockId: 'one-body' })],
        })
        await expect(enhanced.aiChat.getContent(0, { includeBlocks: true })).resolves.toMatchObject({
            text: expect.stringContaining('系统思考从存量'),
        })
    })

    it('repairs stringified rewrite arrays with unescaped quotes in text', async () => {
        const enhanced = await withAIChat({ model })(makeBook()) as AIChatBook
        const tools = enhanced.aiChat.createTools({ currentUnitIndex: 0 })

        const result = await tools.rewriteBlocks.execute?.({
            unitIndex: 0,
            rewrites: '[{"blockId":"one-body","text":"1993年，本书作者多内拉（大家叫她"达娜"）写完了初稿。"},{"blockId":"one-extra-1","text":"市面上讲"系统思维"的书不少。"}]',
        } as any, {
            toolCallId: 'rewrite-loose-json',
            messages: [],
            abortSignal: new AbortController().signal,
        })

        expect(result).toMatchObject({
            count: 2,
            edits: expect.arrayContaining([
                expect.objectContaining({ blockId: 'one-body' }),
                expect.objectContaining({ blockId: 'one-extra-1' }),
            ]),
        })
        await expect(enhanced.aiChat.getContent(0, { includeBlocks: true })).resolves.toMatchObject({
            text: expect.stringContaining('大家叫她"达娜"'),
            blocks: expect.arrayContaining([
                expect.objectContaining({ blockId: 'one-extra-1', text: '市面上讲"系统思维"的书不少。' }),
            ]),
        })
    })

    it('applies oversized rewrite batches without requiring regeneration', async () => {
        const enhanced = await withAIChat({ model })(makeBook()) as AIChatBook
        const tools = enhanced.aiChat.createTools({ currentUnitIndex: 0 })

        const result = await tools.rewriteBlocks.execute?.({
            unitIndex: 0,
            rewrites: [
                { blockId: 'one-title', text: '标题' },
                { blockId: 'one-body', text: '正文' },
                { blockId: 'one-extra-1', text: '额外一' },
                { blockId: 'one-extra-2', text: '额外二' },
                { blockId: 'one-extra-3', text: '额外三' },
                { blockId: 'one-extra-4', text: '额外四' },
            ],
        }, {
            toolCallId: 'rewrite-too-large',
            messages: [],
            abortSignal: new AbortController().signal,
        })

        expect(result).toMatchObject({
            count: 6,
            edits: expect.arrayContaining([
                expect.objectContaining({ blockId: 'one-title' }),
                expect.objectContaining({ blockId: 'one-body' }),
                expect.objectContaining({ blockId: 'one-extra-4' }),
            ]),
        })
        expect(result).not.toHaveProperty('hasMore')
        expect(result).not.toHaveProperty('skippedBlockIds')
        await expect(enhanced.aiChat.getContent(0, { includeBlocks: true })).resolves.toMatchObject({
            text: expect.stringContaining('标题'),
            blocks: expect.arrayContaining([
                expect.objectContaining({ blockId: 'one-body', text: '正文' }),
                expect.objectContaining({ blockId: 'one-extra-4', text: '额外四' }),
            ]),
        })
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
