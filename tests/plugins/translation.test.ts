import { describe, it, expect, vi } from 'vitest'
import { withTranslation } from '../../src/plugins/translation'
import type { Book, Section, TextBlock } from '../../src/core/types'

vi.mock('ai', () => ({
    generateText: async (options: any) => {
        return {
            text: `[Translated] ${options.prompt}`
        }
    }
}))

const mockModel = {}

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
        const plugin = withTranslation({
            model: mockModel as any,
            targetLanguage: 'zh-CN',
            mode: 'bilingual'
        })

        const wrappedBook = await plugin(mockBook)
        const wrappedSection = wrappedBook.sections[0]
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
        const plugin = withTranslation({
            model: mockModel as any,
            targetLanguage: 'zh-CN',
            mode: 'replace'
        })

        const wrappedBook = await plugin(mockBook)
        const wrappedSection = wrappedBook.sections[0]
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
            mode: 'bilingual'
        })

        const wrappedBook = await plugin({ sections: [shortBlockSection] })
        const translatedBlocks = await wrappedBook.sections[0].getBlocks!()

        expect(translatedBlocks).toHaveLength(1)
        expect(translatedBlocks[0].id).toBe('b4')
    })
})
