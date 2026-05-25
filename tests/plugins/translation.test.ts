import { describe, it, expect, vi } from 'vitest'
import { withTranslation } from '../../src/plugins/translation'
import type { Book, Section, TextBlock } from '../../src/core/types'

vi.mock('ai', () => ({
    generateText: async (options: any) => {
        const payload = JSON.parse(options.prompt)
        const translatedPayload = payload.map((text: string) => `[Translated] ${text}`)
        return {
            output: translatedPayload
        }
    },
    Output: {
        array: (options: any) => options
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
        const wrappedSection = wrappedBook.sections[0]
        const initialBlocks = await wrappedSection.getBlocks!()

        expect(initialBlocks).toHaveLength(3)
        expect(initialBlocks[0].id).toBe('b1')
        expect(initialBlocks[0].segments[0].text).toBe('Hello world.')

        await update.promise
        const translatedBlocks = await wrappedSection.getBlocks!()

        // b1 (orig), b1-tr (trans), b2 (image), b3 (orig), b3-tr (trans)
        expect(translatedBlocks).toHaveLength(5)
        
        expect(translatedBlocks[0].id).toBe('b1')
        expect(translatedBlocks[0].segments[0].text).toBe('Hello world.')
        
        expect(translatedBlocks[1].id).toBe('b1-tr')
        expect(translatedBlocks[1].segments[0].text).toBe('[Translated] Hello world.')
        
        expect(translatedBlocks[2].id).toBe('b2') // Image untouched
        
        expect(translatedBlocks[3].id).toBe('b3')
        expect(translatedBlocks[3].segments[0].text).toBe('Title')
        
        expect(translatedBlocks[4].id).toBe('b3-tr')
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
        const wrappedSection = wrappedBook.sections[0]
        const initialBlocks = await wrappedSection.getBlocks!()

        expect(initialBlocks).toHaveLength(3)
        expect(initialBlocks[0].segments[0].text).toBe('Hello world.')

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
        const update = waitForUpdate()
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
            onUpdate: update.resolve
        })

        const wrappedBook = await plugin({ sections: [shortBlockSection] })
        const initialBlocks = await wrappedBook.sections[0].getBlocks!()

        expect(initialBlocks).toHaveLength(1)
        expect(initialBlocks[0].id).toBe('b4')

        await update.promise
        const translatedBlocks = await wrappedBook.sections[0].getBlocks!()

        expect(translatedBlocks).toHaveLength(1)
        expect(translatedBlocks[0].id).toBe('b4')
    })
})
