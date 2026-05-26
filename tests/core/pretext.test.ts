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

    it('extracts image blocks with sizing and cover metadata', () => {
        const blocks = extractDocumentBlocks([
            elementNode('p', {}, [
                elementNode('img', {
                    src: 'blob:test-cover',
                    'data-rebook-original-src': 'images/cover.jpg',
                    alt: 'Cover',
                    width: '600',
                    height: '900',
                    style: 'max-width: 320px; max-height: 420px; object-fit: contain; text-align: center',
                }),
            ]),
        ], {}, { coverImageSrcs: ['images/cover.jpg'] })

        expect(blocks.map(block => block.type)).toEqual(['image'])
        expect(blocks[0].image?.src).toBe('blob:test-cover')
        expect(blocks[0].image?.originalSrc).toBe('images/cover.jpg')
        expect(blocks[0].image?.isCover).toBe(true)
        expect(blocks[0].image?.style?.maxWidth).toBe(320)
        expect(blocks[0].image?.style?.maxHeight).toBe(420)

        const prepared = prepareBlocks(blocks, { baseStyle: { fontSize: 16, lineHeight: 1.5 } })
        const lines = layout(prepared, { inlineSize: 280, maxBlockHeight: 300 })
        expect(lines[0].kind).toBe('image')
        expect(lines[0].image?.isCover).toBe(true)
        expect(lines[0].height).toBeLessThanOrEqual(300)
    })

    it('extracts table rows as paginatable table blocks', () => {
        const blocks = extractDocumentBlocks([
            elementNode('table', {}, [
                elementNode('colgroup', {}, [
                    elementNode('col', { width: '25%' }),
                    elementNode('col', { width: '75%' }),
                ]),
                elementNode('tr', {}, [
                    elementNode('td', { class: 'center' }, [elementNode('b', {}, [textNode('Year')])]),
                    elementNode('td', {}, [textNode('Article count')]),
                ]),
                elementNode('tr', {}, [
                    elementNode('td', { class: 'center' }, [textNode('2000')]),
                    elementNode('td', {}, [textNode('92')]),
                ]),
            ]),
        ], { fontSize: 16, lineHeight: 1.5 })

        expect(blocks.map(block => block.type)).toEqual(['table', 'table'])
        expect(blocks[0].table?.columnCount).toBe(2)
        expect(blocks[0].table?.columnWeights).toEqual([25, 75])
        expect(blocks[0].table?.rows[0]?.cells.map(cell => cell.text)).toEqual(['Year', 'Article count'])
        expect(blocks[0].table?.rows[0]?.cells[0]?.header).toBe(true)
        expect(blocks[0].table?.rows[0]?.cells[0]?.align).toBe('center')

        const prepared = prepareBlocks(blocks, { baseStyle: { fontSize: 16, lineHeight: 1.5 } })
        const lines = layout(prepared, { inlineSize: 320, maxBlockHeight: 240 })
        expect(lines.map(line => line.kind)).toEqual(['table', 'table'])
        expect(lines[0].table?.rows[0]?.cells[1]?.text).toBe('Article count')
    })

    it('moves atomic image and table blocks to the next page column when they would overflow', () => {
        const blocks = extractDocumentBlocks([
            elementNode('p', {}, [
                elementNode('img', {
                    src: 'blob:figure',
                    width: '80',
                    height: '60',
                }),
            ]),
            elementNode('table', {}, [
                elementNode('tr', {}, [
                    elementNode('td', {}, [textNode('A long table cell that needs room')]),
                    elementNode('td', {}, [textNode('Value')]),
                ]),
            ]),
        ], { fontSize: 10, lineHeight: 1 })

        const prepared = prepareBlocks(blocks, { baseStyle: { fontSize: 10, lineHeight: 1 } })
        const imageLines = layout(prepared, { inlineSize: 120, blockStart: 55, maxBlockHeight: 100 })
        expect(imageLines[0].kind).toBe('image')
        expect(imageLines[0].top).toBe(100)

        const tableLines = layout(prepareBlocks([blocks[1]], { baseStyle: { fontSize: 10, lineHeight: 1 } }), {
            inlineSize: 120,
            blockStart: 82,
            maxBlockHeight: 100,
        })
        expect(tableLines[0].kind).toBe('table')
        expect(tableLines[0].top).toBe(100)
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
