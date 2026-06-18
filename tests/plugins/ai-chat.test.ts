import { describe, expect, it } from 'vitest'
import type { LanguageModel } from 'ai'
import type { Book, TextBlock } from '../../src/core/types'
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
        await expect(enhanced.aiChat.getSectionContent(0)).resolves.toMatchObject({
            sectionIndex: 0,
            title: 'One: The Basics',
        })
        expect(enhanced.aiChat.getTOC()).toEqual([
            { label: 'One: The Basics', href: 'section-1.xhtml', depth: 0, sectionIndex: 0 },
            { label: 'Two: Examples', href: 'section-2.xhtml', depth: 0, sectionIndex: 1 },
        ])
    })
})

describe('createAIChatTools', () => {
    it('creates bounded book tools that can read current context', async () => {
        const book = makeBook()
        const controller = createAIChatController(book, { model, maxContextChars: 80 })
        const context = await controller.getCurrentContext({ currentSectionIndex: 1, before: 1 })

        expect(context.currentSectionIndex).toBe(1)
        expect(context.sections.map(section => section.sectionIndex)).toEqual([0, 1])

        const tools = createAIChatTools(book, { model }, { currentSectionIndex: 1 })
        expect(Object.keys(tools).sort()).toEqual([
            'getBookMetadata',
            'getCurrentContext',
            'getSectionContent',
            'getTOC',
            'searchBook',
        ])

        const section = await tools.getSectionContent.execute?.({ maxChars: 120 }, {
            toolCallId: 'call-1',
            messages: [],
            abortSignal: new AbortController().signal,
        })
        expect(section).toMatchObject({
            sectionIndex: 1,
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
        const tools = createAIChatTools(book, { model }, { currentSectionIndex: 0 })
        const context = await tools.getCurrentContext.execute?.({}, {
            toolCallId: 'call-context',
            messages: [],
            abortSignal: new AbortController().signal,
        })

        expect(context.sections[0].text.length).toBeGreaterThan(19000)
        expect(context.sections[0].text.length).toBeLessThan(20500)
        expect(context.sections[0].truncated).toBe(true)
    })
})
