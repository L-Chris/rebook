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
import { getRenderedReflowableLinePosition } from '../../src/core/reflowable-page-model'

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
        expect(blocks[1].blockGapBefore).toBe(18 * 0.75)
        expect(blocks[1].blockGapAfter).toBe(18 * 0.75)
        expect(blocks[1].segments.map(segment => segment.text).join('')).toBe('中文段落 bold')
        expect(blocks[1].segments.some(segment => segment.style?.fontWeight === '700')).toBe(true)

        const prepared = prepareBlocks(blocks, { baseStyle: { fontSize: 18, lineHeight: 1.8 } })
        expect(prepared.blocks[0].block.type).toBe('chapter')
    })

    it('applies paragraph gaps before and after ordinary paragraphs', () => {
        const blocks = extractDocumentBlocks([
            elementNode('p', {}, [textNode('First paragraph')]),
            elementNode('p', {}, [textNode('Second paragraph')]),
        ], { fontSize: 16, lineHeight: 1.5 })

        expect(blocks[0].blockGapBefore).toBe(12)
        expect(blocks[0].blockGapAfter).toBe(12)

        const lines = layout(prepareBlocks(blocks, { baseStyle: { fontSize: 16, lineHeight: 1.5 } }), {
            inlineSize: 320,
            lineHeight: 24,
        })
        expect(lines[0].top).toBe(0)
        expect(lines[1].top).toBe(48)
    })

    it('preserves block text alignment from inline styles', () => {
        const blocks = extractDocumentBlocks([
            elementNode('p', { style: 'text-align: center; font-size: 20px' }, [
                textNode('Centered title'),
            ]),
            elementNode('p', { style: 'text-align: right' }, [
                textNode('Right signature'),
            ]),
            elementNode('p', { align: 'right' }, [
                textNode('Right attribute'),
            ]),
            elementNode('blockquote', { height: '0pt' }, [
                elementNode('blockquote', { width: '2em', align: 'justify' }, [
                    textNode('Nested quote'),
                ]),
            ]),
        ])

        expect(blocks.map(block => block.style?.textAlign)).toEqual(['center', 'end', 'end', 'justify'])
        expect(blocks[0].style?.fontSize).toBe(20)
        expect(blocks[0].segments[0].style?.textAlign).toBe('center')
        expect(blocks[0].segments[0].style?.fontSize).toBe(20)
        expect(blocks[3].type).toBe('blockquote')
        expect(blocks[3].attrs?.width).toBe('2em')
        expect(blocks[3].blockGapBefore).toBe(0)
        expect(blocks[3].blockGapAfter).toBe(0)

        const lines = layout(prepareBlocks(blocks, { baseStyle: { fontSize: 16, lineHeight: 1.5 } }), {
            inlineSize: 320,
        })
        expect(lines[0].block?.style?.textAlign).toBe('center')
        expect(lines.find(line => line.text.includes('Right signature'))?.block?.style?.textAlign).toBe('end')
        expect(lines.find(line => line.text.includes('Right attribute'))?.block?.style?.textAlign).toBe('end')
        expect(lines.find(line => line.text.includes('Nested quote'))?.block?.style?.textAlign).toBe('justify')
        expect(lines.find(line => line.text.includes('Nested quote'))?.inlineOffset).toBe(32)
    })

    it('keeps anchors inside inline-only containers as link segments', () => {
        const blocks = extractDocumentBlocks([
            elementNode('div', { class: 'calibre3' }, [
                textNode('本书由“'),
                elementNode('a', { class: 'calibre1', href: 'http://epubw.com' }, [textNode('ePUBw.COM')]),
                textNode('”整理'),
            ]),
        ])

        expect(blocks.map(block => block.type)).toEqual(['paragraph'])
        expect(blocks[0].segments.map(segment => segment.text).join('')).toBe('本书由“ePUBw.COM”整理')
        const link = blocks[0].segments.find(segment => segment.text === 'ePUBw.COM')
        expect(link?.source?.attrs?.href).toBe('http://epubw.com')
        expect(link?.source?.attrs?.class).toBe('calibre1')
    })

    it('extracts definition lists as nested list item blocks', () => {
        const blocks = extractDocumentBlocks([
            elementNode('dl', { class: 'toc' }, [
                elementNode('dt', {}, [
                    elementNode('span', { class: 'part' }, [textNode('I. '), elementNode('a', { href: 'pt01.html' }, [textNode('Part One')])]),
                ]),
                elementNode('dd', {}, [
                    elementNode('dl', {}, [
                        elementNode('dt', {}, [
                            elementNode('span', { class: 'chapter' }, [textNode('1. '), elementNode('a', { href: 'ch01.html' }, [textNode('Chapter One')])]),
                        ]),
                        elementNode('dt', {}, [
                            elementNode('span', { class: 'chapter' }, [textNode('2. '), elementNode('a', { href: 'ch02.html' }, [textNode('Chapter Two')])]),
                        ]),
                    ]),
                ]),
            ]),
        ])

        expect(blocks.map(block => block.type)).toEqual(['listItem', 'listItem', 'listItem'])
        expect(blocks.map(block => block.depth)).toEqual([0, 1, 1])
        expect(blocks.map(block => block.segments.map(segment => segment.text).join(''))).toEqual([
            'I. Part One',
            '1. Chapter One',
            '2. Chapter Two',
        ])
    })

    it('preserves explicit break and separator blocks', () => {
        const blocks = extractDocumentBlocks([
            elementNode('p', {}, [elementNode('br')]),
            elementNode('hr', { id: 'rule' }),
        ], { fontSize: 10, lineHeight: 2 })

        expect(blocks.map(block => block.type)).toEqual(['break', 'separator'])
        expect(blocks[1].id).toBe('rule')

        const lines = layout(prepareBlocks(blocks, { baseStyle: { fontSize: 10, lineHeight: 2 } }), {
            inlineSize: 100,
        })
        expect(lines.map(line => line.kind)).toEqual(['text', 'separator'])
        expect(lines[0].height).toBe(20)
        expect(lines[1].width).toBe(100)
    })

    it('preserves inline br elements inside text blocks', () => {
        const blocks = extractDocumentBlocks([
            elementNode('p', {}, [
                textNode('献词'),
                elementNode('br'),
                textNode('献给世界的复杂性'),
            ]),
        ])

        expect(blocks).toHaveLength(1)
        expect(blocks[0].type).toBe('paragraph')
        expect(blocks[0].segments.map(segment => segment.text).join('')).toBe('献词\n献给世界的复杂性')
        expect(blocks[0].segments.some(segment => segment.source?.nodeType === 'br')).toBe(true)
    })

    it('trims structural newlines from nested block containers', () => {
        const blocks = extractDocumentBlocks([
            elementNode('blockquote', {}, [
                elementNode('blockquote', {}, [
                    elementNode('blockquote', {}, [
                        textNode('戴安娜·莱特'),
                    ]),
                ]),
            ]),
        ])

        expect(blocks).toHaveLength(1)
        expect(blocks[0].type).toBe('blockquote')
        expect(blocks[0].segments.map(segment => segment.text).join('')).toBe('戴安娜·莱特')
    })

    it('applies superscript and subscript inline styles', () => {
        const blocks = extractDocumentBlocks([
            elementNode('p', {}, [
                textNode('H'),
                elementNode('sub', {}, [textNode('2')]),
                textNode('O'),
                elementNode('sup', {}, [textNode('1')]),
            ]),
        ], { fontSize: 20, lineHeight: 1.5 })

        const sub = blocks[0].segments.find(segment => segment.text === '2')
        const sup = blocks[0].segments.find(segment => segment.text === '1')
        expect(sub?.style?.fontSize).toBe(15)
        expect(sub?.style?.verticalAlign).toBe('sub')
        expect(sup?.style?.fontSize).toBe(15)
        expect(sup?.style?.verticalAlign).toBe('super')
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

    it('keeps images with text siblings as inline image segments using CSS sizing', () => {
        const blocks = extractDocumentBlocks([
            elementNode('p', {}, [
                textNode('公式\n\t'),
                elementNode('span', {}, [
                    elementNode('img', {
                        src: 'blob:formula',
                        'data-rebook-original-src': 'images/formula.jpg',
                        width: '140',
                        height: '60',
                        style: 'width: 14px; height: 6px; vertical-align: middle',
                    }),
                ]),
                textNode(' 继续说明。'),
            ]),
        ], { fontSize: 16, lineHeight: 1.5 })

        expect(blocks.map(block => block.type)).toEqual(['paragraph'])
        const imageSegment = blocks[0].segments.find(segment => segment.source?.nodeType === 'img')
        expect(blocks[0].segments[0]?.text).toBe('公式 ')
        expect(imageSegment?.text).toBe('\uFFFC')
        expect(imageSegment?.extraWidth).toBe(14)
        expect(imageSegment?.source?.attrs?.['data-rebook-inline-image-width']).toBe('14')
        expect(imageSegment?.source?.attrs?.['data-rebook-inline-image-height']).toBe('6')
        expect(imageSegment?.source?.attrs?.['data-rebook-inline-image-vertical-align']).toBe('middle')
    })

    it('extracts images nested inside layout tables', () => {
        const blocks = extractDocumentBlocks([
            elementNode('table', { class: 'borderless' }, [
                elementNode('tr', {}, [
                    elementNode('td', {}, [
                        elementNode('div', { class: 'mediaobject' }, [
                            elementNode('img', {
                                src: 'blob:publisher-logo',
                                'data-rebook-original-src': 'graphics/logo.png',
                                alt: 'Publisher logo',
                                width: '200',
                                height: '80',
                            }),
                        ]),
                    ]),
                ]),
            ]),
        ])

        expect(blocks.map(block => block.type)).toEqual(['image'])
        expect(blocks[0].image?.src).toBe('blob:publisher-logo')
        expect(blocks[0].image?.originalSrc).toBe('graphics/logo.png')
        expect(blocks[0].image?.alt).toBe('Publisher logo')
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

    it('infers wider columns for dense unweighted table content', () => {
        const blocks = extractDocumentBlocks([
            elementNode('table', {}, [
                elementNode('tr', {}, [
                    elementNode('th', {}, [textNode('PDF version')]),
                    elementNode('th', {}, [textNode('Acrobat Reader version')]),
                    elementNode('th', {}, [textNode('Launched')]),
                    elementNode('th', {}, [textNode('Summary of new features')]),
                ]),
                elementNode('tr', {}, [
                    elementNode('td', {}, [textNode('1.7 (later ISO 32000-1:2008)')]),
                    elementNode('td', {}, [textNode('8.0')]),
                    elementNode('td', {}, [textNode('2006')]),
                    elementNode('td', {}, [textNode('XFA 2.4, new kinds of string, extensions to public-key architecture.')]),
                ]),
            ]),
        ], { fontSize: 16, lineHeight: 1.5 })

        const weights = blocks[0].table?.columnWeights

        expect(weights).toHaveLength(4)
        expect(weights?.[3]).toBeGreaterThan((weights?.[0] ?? 0) * 1.8)
        expect(weights?.[3]).toBeGreaterThan(weights?.[1] ?? 0)
        expect(weights?.[3]).toBeGreaterThan(weights?.[2] ?? 0)
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

    it('keeps image blocks with following captions when checking page column overflow', () => {
        const blocks = extractDocumentBlocks([
            elementNode('p', {}, [
                elementNode('img', {
                    src: 'blob:figure',
                    width: '80',
                    height: '30',
                }),
            ]),
            elementNode('p', { class: 'caption' }, [textNode('Figure 1. Caption')]),
        ], { fontSize: 10, lineHeight: 1 })

        const lines = layout(prepareBlocks(blocks, { baseStyle: { fontSize: 10, lineHeight: 1 } }), {
            inlineSize: 120,
            blockStart: 60,
            maxBlockHeight: 100,
        })

        expect(lines[0].kind).toBe('image')
        expect(lines[0].top).toBe(100)
        expect(lines[1].text).toBe('Figure 1. Caption')
        expect(lines[1].top).toBeGreaterThan(lines[0].top + lines[0].height)
    })

    it('keeps image captions visually adjacent after paginated column mapping', () => {
        const blocks = extractDocumentBlocks([
            elementNode('p', {}, [
                elementNode('img', {
                    src: 'blob:figure',
                    width: '80',
                    height: '20',
                }),
            ]),
            elementNode('p', { class: 'caption' }, [
                textNode('Figure 1. Caption wraps onto another rendered line.'),
            ]),
        ], { fontSize: 10, lineHeight: 1 })

        const lines = layout(prepareBlocks(blocks, { baseStyle: { fontSize: 10, lineHeight: 1 } }), {
            inlineSize: 120,
            blockStart: 65,
            maxBlockHeight: 100,
        })
        const imageLine = lines[0]
        const captionLine = lines[1]
        const layoutModel = {
            margin: 0,
            gap: 20,
            columnWidth: 120,
            columns: 2,
            pageHeight: 120,
            columnHeight: 100,
            pagePaddingInline: 0,
            pagePaddingBlock: 0,
            totalHeight: 120,
            pageCount: 1,
        }

        const imagePosition = getRenderedReflowableLinePosition(imageLine, layoutModel, 'paginated')
        const captionPosition = getRenderedReflowableLinePosition(captionLine, layoutModel, 'paginated')

        expect(imageLine.kind).toBe('image')
        expect(imageLine.top).toBe(100)
        expect(captionLine.text).toContain('Figure 1. Caption')
        expect(captionLine.top).toBeGreaterThanOrEqual(imageLine.top + imageLine.height)
        expect(captionLine.top - (imageLine.top + imageLine.height)).toBeLessThan(20)
        expect(captionPosition.left).toBe(imagePosition.left)
        expect(captionPosition.top).toBeGreaterThan(imagePosition.top)
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

    it('prepares many simple CJK paragraphs without per-block rich-inline overhead', () => {
        const text = '这是一个用于模拟中文电子书正文的段落，内容足够长，可以覆盖常见的换行场景。'
        const blocks = Array.from({ length: 3_000 }, (_, index) => ({
            id: `paragraph-${index}`,
            type: 'paragraph' as const,
            segments: [{ text }],
        }))

        const start = performance.now()
        const prepared = prepareBlocks(blocks, { baseStyle: { fontSize: 16, lineHeight: 1.7 } })
        const elapsed = performance.now() - start
        const lines = layout(prepared, { inlineSize: 320, lineHeight: 27.2 })

        expect(elapsed).toBeLessThan(800)
        expect(prepared.blocks).toHaveLength(3_000)
        expect(lines.length).toBeGreaterThan(3_000)
        expect(lines[0].segments[0].text).toContain('这是一个')
    })

    it('preserves preformatted newlines and indentation during layout', () => {
        const blocks = extractDocumentBlocks([
            elementNode('pre', { class: 'programlisting' }, [
                textNode('\n<ol>\n    <li>Dogs</li>\n    <li>Cats</li>\n</ol>\n'),
            ]),
        ], { fontSize: 10, lineHeight: 2 })

        expect(blocks[0].segments.map(segment => segment.text).join('')).toBe('<ol>\n    <li>Dogs</li>\n    <li>Cats</li>\n</ol>')

        const prepared = prepareBlocks(blocks, { baseStyle: { fontSize: 10, lineHeight: 2 } })
        const lines = layout(prepared, { inlineSize: 300 })
        // Pre blocks are now merged into a single kind='pre' line with embedded newlines
        expect(lines).toHaveLength(1)
        expect(lines[0].kind).toBe('pre')
        const indent = '\u00a0\u00a0\u00a0\u00a0'
        expect(lines[0].text).toBe(`<ol>\n${indent}<li>Dogs</li>\n${indent}<li>Cats</li>\n</ol>`)
    })

    it('wraps long preformatted lines into the measured block height', () => {
        const blocks = extractDocumentBlocks([
            elementNode('pre', {}, [
                textNode('BT  /F0 36. Tf Select /F0 font at 36pt and then place a deliberately long PDF operator comment that must wrap'),
            ]),
        ], { fontSize: 16, lineHeight: 1.5 })

        const prepared = prepareBlocks(blocks, { baseStyle: { fontSize: 16, lineHeight: 1.5 } })
        const lines = layout(prepared, { inlineSize: 220, lineHeight: 24 })
        const preLine = lines[0]

        expect(preLine.kind).toBe('pre')
        expect(preLine.text.split('\n').length).toBeGreaterThan(1)
        expect(preLine.height).toBeGreaterThan(24 * 2)
        expect(preLine.width).toBeLessThanOrEqual(220)
    })

    it('returns a visible line window', () => {
        const prepared = prepare([{ text: 'a b c d e f g h i j' }], { baseStyle: { fontSize: 10, lineHeight: 1 } })
        const lines = layout(prepared, { inlineSize: 12 })
        const visible = getVisibleLines(lines, 20, 20, 1)

        expect(visible.totalHeight).toBe(lines.length * 10)
        expect(visible.startIndex).toBe(0)
        expect(visible.lines[0]).toBe(lines[0])
    })
})
