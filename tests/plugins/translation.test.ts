import { describe, it, expect, vi } from 'vitest'
import { withProfessionalTranslation, withTranslation } from '../../src/plugins/translation'
import type { Book, Section, TextBlock } from '../../src/core/types'

type TestTranslationBook = Book & {
    requestBlockTranslations?: (sectionIndex: number, blockIds: readonly string[]) => void
    refreshTranslatedTOC?: () => void
    professionalTranslationStatus?: { phase: string, message: string }
}

const { generateTextMock, outputObjectMock, createTranslationResponse } = vi.hoisted(() => ({
    createTranslationResponse: async (options: any) => {
        const parsed = JSON.parse(options.prompt)
        const payload = parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.input
            ? parsed.input
            : parsed
        const translatedPayload = Object.fromEntries(
            Object.entries(payload).map(([key, text]) => [key, `[Translated] ${text}`])
        )
        return {
            output: translatedPayload
        }
    },
    generateTextMock: vi.fn(),
    outputObjectMock: vi.fn((options: any) => options)
}))

vi.mock('ai', () => ({
    generateText: generateTextMock,
    Output: {
        object: outputObjectMock
    },
    jsonSchema: (schema: any) => schema
}))

const mockModel = {}

const waitForUpdate = () => {
    let resolve!: (value: { sectionIndex: number; blocks: TextBlock[] }) => void
    const promise = new Promise<{ sectionIndex: number; blocks: TextBlock[] }>(res => {
        resolve = res
    })
    return { promise, resolve }
}

describe('Translation Plugin', () => {
    beforeEach(() => {
        generateTextMock.mockReset()
        generateTextMock.mockImplementation(createTranslationResponse)
        outputObjectMock.mockClear()
    })

    const mockBlocks: TextBlock[] = [
        {
            id: 'b1',
            type: 'paragraph',
            segments: [{ text: 'Hello world.' }]
        },
        {
            id: 'b2',
            type: 'image', // should not translate
            segments: [],
            image: { src: 'test.jpg' }
        },
        {
            id: 'b3',
            type: 'heading',
            segments: [{ text: 'Title' }]
        }
    ]

    const mockSection: Section = {
        id: 's1',
        size: 100,
        load: () => '',
        getBlocks: async () => [...mockBlocks]
    }

    const mockBook: Book = {
        sections: [mockSection]
    }

    it('translates text blocks in bilingual mode', async () => {
        const update = waitForUpdate()
        const plugin = withTranslation({
            model: mockModel as any,
            targetLanguage: 'zh-CN',
            mode: 'bilingual',
            onUpdate: update.resolve
        })

        const wrappedBook = await plugin(mockBook)
        const translationBook = wrappedBook as TestTranslationBook
        const wrappedSection = wrappedBook.sections[0]
        const initialBlocks = await wrappedSection.getBlocks!()

        expect(initialBlocks).toHaveLength(3)
        expect(initialBlocks[0].id).toBe('b1')
        expect(initialBlocks[0].segments[0].text).toBe('Hello world.')

        translationBook.requestBlockTranslations?.(0, ['b1', 'b3'])
        await update.promise
        const translatedBlocks = await wrappedSection.getBlocks!()

        expect(generateTextMock).toHaveBeenCalled()
        expect(generateTextMock.mock.calls[0][0].system).not.toContain('elements')
        expect(outputObjectMock).toHaveBeenCalled()
        expect(JSON.parse(generateTextMock.mock.calls[0][0].prompt)).toEqual({
            '0': 'Hello world.',
            '1': 'Title'
        })

        // b1 (orig), t0 (trans), b2 (image), b3 (orig), t2 (trans)
        expect(translatedBlocks).toHaveLength(5)
        
        expect(translatedBlocks[0].id).toBe('b1')
        expect(translatedBlocks[0].segments[0].text).toBe('Hello world.')
        
        expect(translatedBlocks[1].id).toBe('t0')
        expect(translatedBlocks[1].segments[0].text).toBe('[Translated] Hello world.')
        
        expect(translatedBlocks[2].id).toBe('b2') // Image untouched
        
        expect(translatedBlocks[3].id).toBe('b3')
        expect(translatedBlocks[3].segments[0].text).toBe('Title')
        
        expect(translatedBlocks[4].id).toBe('t2')
        expect(translatedBlocks[4].segments[0].text).toBe('[Translated] Title')
    })

    it('translates text blocks in replace mode', async () => {
        const update = waitForUpdate()
        const plugin = withTranslation({
            model: mockModel as any,
            targetLanguage: 'zh-CN',
            mode: 'replace',
            onUpdate: update.resolve
        })

        const wrappedBook = await plugin(mockBook)
        const translationBook = wrappedBook as TestTranslationBook
        const wrappedSection = wrappedBook.sections[0]
        const initialBlocks = await wrappedSection.getBlocks!()

        expect(initialBlocks).toHaveLength(3)
        expect(initialBlocks[0].segments[0].text).toBe('Hello world.')

        translationBook.requestBlockTranslations?.(0, ['b1', 'b3'])
        await update.promise
        const translatedBlocks = await wrappedSection.getBlocks!()

        // b1 (replaced), b2 (image), b3 (replaced)
        expect(translatedBlocks).toHaveLength(3)
        
        expect(translatedBlocks[0].id).toBe('b1')
        expect(translatedBlocks[0].segments[0].text).toBe('[Translated] Hello world.')
        
        expect(translatedBlocks[1].id).toBe('b2')
        
        expect(translatedBlocks[2].id).toBe('b3')
        expect(translatedBlocks[2].segments[0].text).toBe('[Translated] Title')
    })

    it('skips blocks that are too short', async () => {
        const shortBlockSection: Section = {
            id: 's2',
            size: 10,
            load: () => '',
            getBlocks: async () => [
                { id: 'b4', type: 'paragraph', segments: [{ text: 'A' }] }
            ]
        }
        
        const plugin = withTranslation({
            model: mockModel as any,
            mode: 'bilingual',
        })

        const wrappedBook = await plugin({ sections: [shortBlockSection] })
        const translationBook = wrappedBook as TestTranslationBook
        const initialBlocks = await wrappedBook.sections[0].getBlocks!()

        expect(initialBlocks).toHaveLength(1)
        expect(initialBlocks[0].id).toBe('b4')

        translationBook.requestBlockTranslations?.(0, ['b4'])
        await new Promise(resolve => setTimeout(resolve, 0))
        const translatedBlocks = await wrappedBook.sections[0].getBlocks!()

        expect(generateTextMock).not.toHaveBeenCalled()
        expect(translatedBlocks).toHaveLength(1)
        expect(translatedBlocks[0].id).toBe('b4')
    })

    it('skips blocks made only of numbers, whitespace, and punctuation', async () => {
        const nonTextBlocks: TextBlock[] = [
            { id: 'n1', type: 'paragraph', segments: [{ text: '12345' }] },
            { id: 'n2', type: 'paragraph', segments: [{ text: ' \t\n ' }] },
            { id: 'n3', type: 'paragraph', segments: [{ text: '.,?!，。！？' }] },
            { id: 'n4', type: 'paragraph', segments: [{ text: ' 123, 456.\t ' }] },
        ]
        const section: Section = {
            id: 's3',
            size: 20,
            load: () => '',
            getBlocks: async () => nonTextBlocks,
        }
        const plugin = withTranslation({
            model: mockModel as any,
            mode: 'bilingual',
        })

        const wrappedBook = await plugin({ sections: [section] })
        await wrappedBook.sections[0].getBlocks!()
        ;(wrappedBook as TestTranslationBook).requestBlockTranslations?.(0, nonTextBlocks.map(block => block.id))
        await new Promise(resolve => setTimeout(resolve, 0))

        expect(generateTextMock).not.toHaveBeenCalled()
        expect(await wrappedBook.sections[0].getBlocks!()).toEqual(nonTextBlocks)
    })

    it('retries once when structured translation output is invalid', async () => {
        const update = waitForUpdate()
        const formatError = Object.assign(new Error('No object generated: response did not match schema.'), {
            name: 'AI_NoObjectGeneratedError'
        })
        generateTextMock
            .mockRejectedValueOnce(formatError)
            .mockImplementationOnce(createTranslationResponse)

        const plugin = withTranslation({
            model: mockModel as any,
            mode: 'replace',
            onUpdate: update.resolve
        })

        const wrappedBook = await plugin(mockBook)
        await wrappedBook.sections[0].getBlocks!()
        ;(wrappedBook as TestTranslationBook).requestBlockTranslations?.(0, ['b1', 'b3'])
        await update.promise
        const translatedBlocks = await wrappedBook.sections[0].getBlocks!()

        expect(generateTextMock).toHaveBeenCalledTimes(2)
        expect(translatedBlocks[0].segments[0].text).toBe('[Translated] Hello world.')
    })

    it('retries once when translation output misses an input key', async () => {
        const update = waitForUpdate()
        generateTextMock
            .mockResolvedValueOnce({ output: { '0': '[Translated] Hello world.' } })
            .mockImplementationOnce(createTranslationResponse)

        const plugin = withTranslation({
            model: mockModel as any,
            mode: 'replace',
            onUpdate: update.resolve
        })

        const wrappedBook = await plugin(mockBook)
        await wrappedBook.sections[0].getBlocks!()
        ;(wrappedBook as TestTranslationBook).requestBlockTranslations?.(0, ['b1', 'b3'])
        await update.promise
        const translatedBlocks = await wrappedBook.sections[0].getBlocks!()

        expect(generateTextMock).toHaveBeenCalledTimes(2)
        expect(translatedBlocks[0].segments[0].text).toBe('[Translated] Hello world.')
        expect(translatedBlocks[2].segments[0].text).toBe('[Translated] Title')
    })

    it('keeps untranslated text when translation output still misses a key after retry', async () => {
        const update = waitForUpdate()
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        generateTextMock
            .mockResolvedValueOnce({ output: { '0': '[Translated] Hello world.' } })
            .mockResolvedValueOnce({ output: { '0': '[Translated] Hello world.' } })

        const plugin = withTranslation({
            model: mockModel as any,
            mode: 'replace',
            onUpdate: update.resolve
        })

        const wrappedBook = await plugin(mockBook)
        await wrappedBook.sections[0].getBlocks!()
        ;(wrappedBook as TestTranslationBook).requestBlockTranslations?.(0, ['b1', 'b3'])
        await update.promise
        const translatedBlocks = await wrappedBook.sections[0].getBlocks!()

        expect(generateTextMock).toHaveBeenCalledTimes(2)
        expect(translatedBlocks[0].segments[0].text).toBe('[Translated] Hello world.')
        expect(translatedBlocks[2].segments[0].text).toBe('Title')
        expect(warn).toHaveBeenCalledWith(
            'Translation output format was invalid; leaving untranslated text unchanged.',
            expect.objectContaining({ untranslatedTexts: ['Title'] })
        )
        warn.mockRestore()
    })

    it('translates table cells', async () => {
        const update = waitForUpdate()
        const tableBlock: TextBlock = {
            id: 'tbl',
            type: 'table',
            segments: [],
            table: {
                columnCount: 2,
                rowIndex: 0,
                rowCount: 1,
                rows: [{
                    cells: [
                        { text: 'Figure 1.1' },
                        { text: 'Terms in a synonym ring' },
                    ]
                }]
            }
        }
        const section: Section = {
            id: 'table-section',
            size: 10,
            load: () => '',
            getBlocks: async () => [tableBlock]
        }
        const plugin = withTranslation({
            model: mockModel as any,
            mode: 'bilingual',
            onUpdate: update.resolve
        })

        const wrappedBook = await plugin({ sections: [section] })
        await wrappedBook.sections[0].getBlocks!()
        ;(wrappedBook as TestTranslationBook).requestBlockTranslations?.(0, ['tbl'])
        await update.promise
        const translatedBlocks = await wrappedBook.sections[0].getBlocks!()

        expect(JSON.parse(generateTextMock.mock.calls[0][0].prompt)).toEqual({
            '0': 'Figure 1.1',
            '1': 'Terms in a synonym ring'
        })
        expect(translatedBlocks).toHaveLength(2)
        expect(translatedBlocks[0].table?.rows[0].cells[1].text).toBe('Terms in a synonym ring')
        expect(translatedBlocks[1].table?.rows[0].cells[0].text).toBe('[Translated] Figure 1.1')
        expect(translatedBlocks[1].table?.rows[0].cells[1].text).toBe('[Translated] Terms in a synonym ring')
    })

    it('updates rendered blocks after each translated batch', async () => {
        const updates: TextBlock[][] = []
        let resolveUpdates!: () => void
        const updatesPromise = new Promise<void>(resolve => {
            resolveUpdates = resolve
        })
        const plugin = withTranslation({
            model: mockModel as any,
            mode: 'bilingual',
            tokensPerBatch: 1,
            concurrency: 1,
            onUpdate: ({ blocks }) => {
                updates.push(blocks)
                if (updates.length === 2) resolveUpdates()
            }
        })

        const wrappedBook = await plugin(mockBook)
        await wrappedBook.sections[0].getBlocks!()
        ;(wrappedBook as TestTranslationBook).requestBlockTranslations?.(0, ['b1', 'b3'])
        await updatesPromise

        expect(generateTextMock).toHaveBeenCalledTimes(2)
        expect(updates[0]).toHaveLength(4)
        expect(updates[0][1].segments[0].text).toBe('[Translated] Hello world.')
        expect(updates[0][3].segments[0].text).toBe('Title')
        expect(updates[1]).toHaveLength(5)
        expect(updates[1][4].segments[0].text).toBe('[Translated] Title')
    })

    it('translates only block ids requested by the renderer window', async () => {
        const update = waitForUpdate()
        const plugin = withTranslation({
            model: mockModel as any,
            mode: 'bilingual',
            onUpdate: update.resolve
        })

        const wrappedBook = await plugin(mockBook)
        const wrappedSection = wrappedBook.sections[0]
        await wrappedSection.getBlocks!()

        ;(wrappedBook as TestTranslationBook).requestBlockTranslations?.(0, ['b1'])
        await update.promise
        const translatedBlocks = await wrappedSection.getBlocks!()

        expect(JSON.parse(generateTextMock.mock.calls[0][0].prompt)).toEqual({ '0': 'Hello world.' })
        expect(translatedBlocks).toHaveLength(4)
        expect(translatedBlocks[1].segments[0].text).toBe('[Translated] Hello world.')
        expect(translatedBlocks[3].segments[0].text).toBe('Title')
    })

    it('merges adjacent renderer window requests before translating', async () => {
        const update = waitForUpdate()
        const plugin = withTranslation({
            model: mockModel as any,
            mode: 'bilingual',
            onUpdate: update.resolve
        })

        const wrappedBook = await plugin(mockBook)
        const translationBook = wrappedBook as TestTranslationBook
        await wrappedBook.sections[0].getBlocks!()

        translationBook.requestBlockTranslations?.(0, ['b1'])
        translationBook.requestBlockTranslations?.(0, ['b3'])
        await update.promise

        expect(generateTextMock).toHaveBeenCalledTimes(1)
        expect(JSON.parse(generateTextMock.mock.calls[0][0].prompt)).toEqual({
            '0': 'Hello world.',
            '1': 'Title'
        })
    })

    it('switches display mode without requesting translations again', async () => {
        const update = waitForUpdate()
        let mode: 'bilingual' | 'replace' = 'bilingual'
        const plugin = withTranslation({
            model: mockModel as any,
            mode: () => mode,
            onUpdate: update.resolve
        })

        const wrappedBook = await plugin(mockBook)
        const wrappedSection = wrappedBook.sections[0]
        await wrappedSection.getBlocks!()
        ;(wrappedBook as TestTranslationBook).requestBlockTranslations?.(0, ['b1', 'b3'])
        await update.promise

        const bilingualBlocks = await wrappedSection.getBlocks!()
        expect(bilingualBlocks).toHaveLength(5)

        mode = 'replace'
        const replaceBlocks = await wrappedSection.getBlocks!()

        expect(generateTextMock).toHaveBeenCalledTimes(1)
        expect(replaceBlocks).toHaveLength(3)
        expect(replaceBlocks[0].segments[0].text).toBe('[Translated] Hello world.')

        mode = 'bilingual'
        const bilingualAgainBlocks = await wrappedSection.getBlocks!()

        expect(generateTextMock).toHaveBeenCalledTimes(1)
        expect(bilingualAgainBlocks).toHaveLength(5)
        expect(bilingualAgainBlocks[0].segments[0].text).toBe('Hello world.')
        expect(bilingualAgainBlocks[1].segments[0].text).toBe('[Translated] Hello world.')
    })

    it('translates table of contents labels when enabled', async () => {
        let resolveTOC!: (toc: Book['toc']) => void
        const tocPromise = new Promise<Book['toc']>(resolve => {
            resolveTOC = resolve
        })
        const plugin = withTranslation({
            model: mockModel as any,
            translateTOC: true,
            onTOCUpdate: resolveTOC
        })

        const wrappedBook = await plugin({
            sections: [mockSection],
            toc: [
                { label: 'Chapter One', href: 's1' },
                { label: 'Part Two', href: 's2', subitems: [{ label: 'Child', href: 's2#child' }] }
            ]
        })

        const translatedTOC = await tocPromise

        expect(translatedTOC?.[0].label).toBe('Chapter One / [Translated] Chapter One')
        expect(translatedTOC?.[1].subitems?.[0].label).toBe('Child / [Translated] Child')
        expect(wrappedBook.toc?.[0].label).toBe('Chapter One / [Translated] Chapter One')
    })

    it('toggles translated table of contents without requesting labels again', async () => {
        let translateTOC = true
        let mode: 'bilingual' | 'replace' = 'bilingual'
        let resolveTOC!: (toc: Book['toc']) => void
        const tocPromise = new Promise<Book['toc']>(resolve => {
            resolveTOC = resolve
        })
        const plugin = withTranslation({
            model: mockModel as any,
            translateTOC: () => translateTOC,
            mode: () => mode,
            onTOCUpdate: resolveTOC
        })

        const wrappedBook = await plugin({
            sections: [mockSection],
            toc: [{ label: 'Chapter One', href: 's1' }]
        })

        await tocPromise
        expect(wrappedBook.toc?.[0].label).toBe('Chapter One / [Translated] Chapter One')

        translateTOC = false
        wrappedBook.refreshTranslatedTOC?.()
        expect(wrappedBook.toc?.[0].label).toBe('Chapter One')

        translateTOC = true
        mode = 'replace'
        wrappedBook.refreshTranslatedTOC?.()
        expect(wrappedBook.toc?.[0].label).toBe('[Translated] Chapter One')
        expect(generateTextMock).toHaveBeenCalledTimes(1)
    })

    it('builds a professional pipeline profile before contextual translation', async () => {
        const update = waitForUpdate()
        const statuses: string[] = []
        let resolveReady!: () => void
        const readyPromise = new Promise<void>(resolve => {
            resolveReady = resolve
        })

        generateTextMock.mockImplementation(async (options: any) => {
            if (options.system.includes('senior translation editor')) {
                return {
                    output: {
                        bookType: 'technical textbook',
                        audience: 'software engineers',
                        styleGuide: 'Use precise technical Chinese.',
                        terminologyRules: ['Translate API as 应用程序接口 on first mention.'],
                        properNounRules: ['Keep product names in English.'],
                        terms: [{
                            source: 'API',
                            target: '应用程序接口',
                            category: 'abbreviation',
                            note: 'Core technical abbreviation.',
                        }],
                        chapterSummaries: [
                            { sectionIndex: 0, title: 'API Basics', summary: 'Introduces API concepts.' },
                            { sectionIndex: 1, title: 'Implementation Notes', summary: 'Explains code and tables.' },
                        ],
                    }
                }
            }
            return createTranslationResponse(options)
        })

        const professionalBlocks: TextBlock[] = [
            {
                id: 'api',
                type: 'paragraph',
                segments: [{ text: 'API design keeps client and server contracts stable.' }],
            },
            {
                id: 'code',
                type: 'pre',
                segments: [{ text: 'fetch("/api/books")' }],
            },
            {
                id: 'tbl',
                type: 'table',
                segments: [],
                table: {
                    columnCount: 2,
                    rowIndex: 0,
                    rowCount: 1,
                    rows: [{ cells: [{ text: 'API' }, { text: 'Contract' }] }],
                },
            },
            {
                id: 'note',
                type: 'paragraph',
                attrs: { 'data-rebook-footnote-content': 'An implementation note.' },
                segments: [{ text: '1' }],
            },
        ]
        const professionalBook: Book = {
            metadata: {
                title: 'API Design',
                author: 'Example Author',
                language: 'en',
            },
            toc: [
                { label: 'API Basics', href: 's1' },
                { label: 'Implementation Notes', href: 's2' },
            ],
            resolveHref: href => href === 's1' ? { index: 0 } as any : { index: 1 } as any,
            sections: [
                {
                    id: 's1',
                    size: 100,
                    load: () => '',
                    getBlocks: async () => professionalBlocks,
                },
                {
                    id: 's2',
                    size: 50,
                    load: () => '',
                    getBlocks: async () => [{
                        id: 'math',
                        type: 'paragraph',
                        attrs: { class: 'equation' },
                        segments: [{ text: '\\sum_i x_i' }],
                    }],
                },
            ],
        }

        const plugin = withProfessionalTranslation({
            model: mockModel as any,
            targetLanguage: 'zh-CN',
            mode: 'replace',
            onUpdate: update.resolve,
            pipeline: {
                onStatus: status => {
                    statuses.push(status.phase)
                    if (status.phase === 'ready') resolveReady()
                },
            },
        })

        const wrappedBook = await plugin(professionalBook)
        await readyPromise
        await wrappedBook.sections[0].getBlocks!()
        ;(wrappedBook as TestTranslationBook).requestBlockTranslations?.(0, ['api'])
        await update.promise

        const profileCall = generateTextMock.mock.calls.find((call: any[]) =>
            call[0].system.includes('senior translation editor')
        )
        expect(profileCall).toBeTruthy()
        const profilePrompt = JSON.parse(profileCall[0].prompt)
        expect(profilePrompt.analysis.toc).toEqual([
            { label: 'API Basics', depth: 0 },
            { label: 'Implementation Notes', depth: 0 },
        ])
        expect(profilePrompt.analysis.toc[0]).not.toHaveProperty('href')
        expect(profilePrompt.analysis.chapters[0]).toMatchObject({
            sectionIndex: 0,
            title: 'API Basics',
        })
        expect(profilePrompt.analysis.chapters[0]).not.toHaveProperty('blockCount')
        expect(profilePrompt.analysis.chapters[0]).not.toHaveProperty('wordCount')
        expect(profilePrompt.analysis.chapters[0]).not.toHaveProperty('structures')
        expect(profilePrompt.analysis.chapters[1]).toMatchObject({
            sectionIndex: 1,
            title: 'Implementation Notes',
        })
        expect(profilePrompt.analysis).not.toHaveProperty('features')
        expect(profilePrompt.analysis).not.toHaveProperty('structureSamples')
        expect(profilePrompt.analysis).not.toHaveProperty('termCandidates')

        const translationCall = generateTextMock.mock.calls.find((call: any[]) =>
            call[0].system.includes('multi-stage translation pipeline')
        )
        expect(translationCall).toBeTruthy()
        const translationPrompt = JSON.parse(translationCall[0].prompt)
        expect(translationPrompt.context).toMatchObject({
            bookType: 'technical textbook',
            audience: 'software engineers',
            chapter: { sectionIndex: 0, summary: 'Introduces API concepts.' },
            nextChapter: { sectionIndex: 1, summary: 'Explains code and tables.' },
        })
        expect(translationPrompt.context.glossary[0]).toMatchObject({
            source: 'API',
            target: '应用程序接口',
        })
        expect(translationPrompt.input).toEqual({
            '0': 'API design keeps client and server contracts stable.',
        })
        expect(statuses).toEqual(['analyzing', 'ready'])
        expect((wrappedBook as TestTranslationBook).professionalTranslationStatus?.phase).toBe('ready')
    })

    it('waits for the professional profile before translating the table of contents', async () => {
        let resolveProfile!: (value: any) => void
        const profilePromise = new Promise(resolve => {
            resolveProfile = resolve
        })
        let resolveTOC!: (toc: Book['toc']) => void
        const tocPromise = new Promise<Book['toc']>(resolve => {
            resolveTOC = resolve
        })
        generateTextMock.mockImplementation(async (options: any) => {
            if (options.system.includes('senior translation editor')) {
                return profilePromise
            }
            return createTranslationResponse(options)
        })

        const plugin = withProfessionalTranslation({
            model: mockModel as any,
            translateTOC: true,
            onTOCUpdate: resolveTOC,
        })

        const wrappedBook = await plugin({
            sections: [mockSection],
            toc: [{ label: 'Chapter One', href: 's1' }],
        })

        // Accessing TOC schedules translation, but professional mode must wait for the profile first.
        expect(wrappedBook.toc?.[0].label).toBe('Chapter One')
        await new Promise(resolve => setTimeout(resolve, 0))
        expect(generateTextMock).toHaveBeenCalledTimes(1)
        expect(generateTextMock.mock.calls[0][0].system).toContain('senior translation editor')

        resolveProfile({
            output: {
                bookType: 'book',
                audience: 'general readers',
                styleGuide: 'Clear Chinese.',
                terminologyRules: [],
                properNounRules: [],
                terms: [],
                chapterSummaries: [
                    { sectionIndex: 0, title: 'Chapter One', summary: 'Opening chapter.' },
                ],
            },
        })

        const translatedTOC = await tocPromise
        expect(generateTextMock).toHaveBeenCalledTimes(2)
        expect(generateTextMock.mock.calls[1][0].system).not.toContain('senior translation editor')
        expect(JSON.parse(generateTextMock.mock.calls[1][0].prompt)).toEqual({ '0': 'Chapter One' })
        expect(translatedTOC?.[0].label).toBe('Chapter One / [Translated] Chapter One')
    })
})
