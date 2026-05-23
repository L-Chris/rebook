import { beforeAll, describe, expect, it, vi } from 'vitest'
import { elementNode, textNode } from '../../src/core/document'
import {
    extractDocumentBlocks,
    extractDocumentSegments,
    getVisibleLines,
    layout,
    prepareBlocks,
    prepare,
} from '../../src/core/pretext'

beforeAll(() => {
    vi.stubGlobal('OffscreenCanvas', class {
        getContext() {
            return {
                font: '16px serif',
                measureText(text: string) {
                    const fontSize = Number(this.font.match(/([\d.]+)px/)?.[1] ?? 16)
                    const width = Array.from(text).reduce((sum, char) => {
                        if (char === ' ') return sum + fontSize * 0.32
                        if (/[\u4e00-\u9fff]/.test(char)) return sum + fontSize
                        return sum + fontSize * 0.54
                    }, 0)
                    return { width }
                },
            }
        }
    })
})

describe('Pretext pipeline', () => {
    it('extracts styled text segments from document nodes', () => {
        const segments = extractDocumentSegments([
            elementNode('p', {}, [
                textNode('Hello '),
                elementNode('strong', {}, [textNode('bold')]),
                textNode(' and '),
                elementNode('em', { style: 'color: #900' }, [textNode('italic')]),
            ]),
        ])

        expect(segments.map(segment => segment.text).join('')).toBe('Hello bold and italic')
        expect(segments.find(segment => segment.text === 'bold')?.style?.fontWeight).toBe('700')
        expect(segments.find(segment => segment.text === 'italic')?.style?.fontStyle).toBe('italic')
        expect(segments.find(segment => segment.text === 'italic')?.style?.color).toBe('#900')
    })

    it('extracts AST structural blocks with preset reading styles', () => {
        const blocks = extractDocumentBlocks([
            elementNode('section', {}, [
                elementNode('h1', { id: 'chapter-1' }, [textNode('第一章')]),
                elementNode('p', {}, [textNode('中文段落 '), elementNode('strong', {}, [textNode('bold')])]),
                elementNode('blockquote', {}, [elementNode('p', {}, [textNode('quoted')])]),
            ]),
        ], { fontSize: 18, lineHeight: 1.8 })

        expect(blocks.map(block => block.type)).toEqual(['chapter', 'paragraph', 'blockquote'])
        expect(blocks[0].id).toBe('chapter-1')
        expect(blocks[0].style?.fontWeight).toBe('700')
        expect(blocks[1].segments.map(segment => segment.text).join('')).toBe('中文段落 bold')
        expect(blocks[1].segments.some(segment => segment.style?.fontWeight === '700')).toBe(true)

        const prepared = prepareBlocks(blocks, { baseStyle: { fontSize: 18, lineHeight: 1.8 } })
        expect(prepared.blocks[0].block.type).toBe('chapter')
    })

    it('delegates preparation and line layout to Pretext while preserving segment ranges', () => {
        const segments = [
            { text: 'one two three four' },
        ]
        const prepared = prepare(segments, { baseStyle: { fontSize: 10, lineHeight: 2 } })

        const narrow = layout(prepared, { inlineSize: 45 })
        const wide = layout(prepared, { inlineSize: 200 })

        expect(narrow.map(line => line.text)).toEqual(['one two', 'three', 'four'])
        expect(wide).toHaveLength(1)
        expect(wide[0].start?.segmentIndex).toBe(0)
        expect(wide[0].end?.segmentIndex).toBe(0)
        expect(wide[0].segments[0].text).toBe('one two three four')
    })

    it('returns a virtualized visible line window', () => {
        const prepared = prepare([{ text: 'a b c d e f g h i j' }], { baseStyle: { fontSize: 10, lineHeight: 1 } })
        const lines = layout(prepared, { inlineSize: 12 })
        const visible = getVisibleLines(lines, 20, 20, 1)

        expect(visible.totalHeight).toBe(lines.length * 10)
        expect(visible.startIndex).toBe(1)
        expect(visible.lines[0]).toBe(lines[1])
    })
})
