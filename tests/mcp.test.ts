import { describe, expect, it } from 'vitest'
import type { Book } from '../src/core/types'
import { callBookMCPTool, createBookMCPTools } from '../src/mcp'

const book: Book = {
    sections: [
        {
            id: 'one.xhtml',
            size: 100,
            load: () => '',
            getBlocks: () => [{ id: 'one-body', type: 'paragraph', segments: [{ text: 'First chapter searchable text.' }] }],
        },
        {
            id: 'two.xhtml',
            size: 80,
            load: () => '',
            getBlocks: () => [{ id: 'two-body', type: 'paragraph', segments: [{ text: 'Second chapter has another match.' }] }],
        },
    ],
    toc: [
        { label: 'First', href: 'one.xhtml' },
        { label: 'Second', href: 'two.xhtml' },
    ],
    resolveHref: href => ({ index: href === 'two.xhtml' ? 1 : 0 }),
}

describe('createBookMCPTools', () => {
    it('creates list, search, and content text tools', async () => {
        const tools = createBookMCPTools(book)

        expect(tools.map(tool => tool.name)).toEqual([
            'list_content_units',
            'search_book',
            'get_content_text',
        ])

        const units = await callBookMCPTool(tools, 'list_content_units')
        expect(units.structuredContent).toEqual([
            { index: 0, id: 'one.xhtml', kind: 'section', title: 'First', href: 'one.xhtml', sectionIndex: 0, size: 100 },
            { index: 1, id: 'two.xhtml', kind: 'section', title: 'Second', href: 'two.xhtml', sectionIndex: 1, size: 80 },
        ])
    })

    it('searches all content units or one content unit through MCP handlers', async () => {
        const tools = createBookMCPTools(book)
        const all = await callBookMCPTool(tools, 'search_book', { query: 'chapter' })
        const one = await callBookMCPTool(tools, 'search_book', { query: 'chapter', unitIndex: 1 })

        expect((all.structuredContent as { results: unknown[] }).results).toHaveLength(2)
        expect((one.structuredContent as { results: Array<{ unitIndex: number }> }).results).toEqual([
            expect.objectContaining({ unitIndex: 1 }),
        ])
    })

    it('returns truncated content text', async () => {
        const tools = createBookMCPTools(book)
        const result = await callBookMCPTool(tools, 'get_content_text', {
            unitIndex: 0,
            maxChars: 5,
        })

        expect(result.structuredContent).toEqual({
            unitIndex: 0,
            unitId: 'one.xhtml',
            unitKind: 'section',
            unitTitle: 'First',
            sectionIndex: 0,
            pageIndex: undefined,
            truncated: true,
            text: 'First',
        })
    })
})
