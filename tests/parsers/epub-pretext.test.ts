import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { EPUBParser } from '../../src/parsers/epub'
import { NodeDOMAdapter, NodeURLFactory } from '../../src/adapters/node'
import { layout, prepare, prepareBlocks, type TextSegment } from '../../src/core/pretext'
import { createTestEPUB } from '../fixtures/epub-fixture'

const structuredWritingFixture = 'data/Structured Writing Rhetoric and Process.epub'
const itWithStructuredWriting = existsSync(structuredWritingFixture) ? it : it.skip
const lolitaFixture = 'data/洛丽塔.epub'
const itWithLolita = existsSync(lolitaFixture) ? it : it.skip

function pngWithDimensions(width: number, height: number): Uint8Array {
    const bytes = new Uint8Array(24)
    bytes.set([0x89, 0x50, 0x4e, 0x47])
    writeUint32BE(bytes, 16, width)
    writeUint32BE(bytes, 20, height)
    return bytes
}

function writeUint32BE(bytes: Uint8Array, offset: number, value: number): void {
    bytes[offset] = (value >>> 24) & 0xff
    bytes[offset + 1] = (value >>> 16) & 0xff
    bytes[offset + 2] = (value >>> 8) & 0xff
    bytes[offset + 3] = value & 0xff
}

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

describe('EPUB Pretext segments', () => {
    it('does not recurse through XHTML navigation link metadata while loading blocks', async () => {
        const parser = new EPUBParser()
        const book = await parser.parse(await createTestEPUB({
            chapters: [
                {
                    id: 'chapter1',
                    title: 'Chapter 1',
                    content: '<html xmlns="http://www.w3.org/1999/xhtml"><head><link rel="stylesheet" href="style.css"/><link rel="next" href="chapter2.xhtml"/></head><body><p>First linked chapter.</p></body></html>',
                },
                {
                    id: 'chapter2',
                    title: 'Chapter 2',
                    content: '<html xmlns="http://www.w3.org/1999/xhtml"><head><link rel="prev" href="chapter1.xhtml"/></head><body><p>Second linked chapter.</p></body></html>',
                },
            ],
            resources: [{
                id: 'style',
                href: 'style.css',
                mediaType: 'text/css',
                data: 'p { color: red; }',
            }],
        }), {
            domAdapter: new NodeDOMAdapter(),
            urlFactory: new NodeURLFactory(),
        })

        const blocks = await Promise.race([
            book.sections[0].getBlocks?.(),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('getBlocks timed out')), 500)),
        ])
        const html = await book.sections[0].load()

        expect(blocks?.map(block => block.segments.map(segment => segment.text).join('')).join('\n')).toContain('First linked chapter.')
        expect(html).toContain('rel="next" href="chapter2.xhtml"')
        expect(html).toContain('rel="stylesheet"')
        expect(html).toContain('test://resource-')
    })

    it('exposes styled segments on EPUB sections', async () => {
        const parser = new EPUBParser()
        const book = await parser.parse(await createTestEPUB({
            chapters: [{
                id: 'styled',
                title: 'Styled',
                content: '<html xmlns="http://www.w3.org/1999/xhtml"><body><p>Plain <strong>bold</strong> <em style="color: red">red</em></p></body></html>',
            }],
        }), {
            domAdapter: new NodeDOMAdapter(),
            urlFactory: new NodeURLFactory(),
        })

        const segments = await book.sections[0].getSegments?.()
        expect(segments).toBeDefined()
        expect(segments?.map(segment => segment.text).join('')).toBe('Plain bold red')
        expect(segments?.some(segment => segment.style?.fontWeight === '700')).toBe(true)
        expect(segments?.some(segment => segment.style?.color === 'red')).toBe(true)

        const blocks = await book.sections[0].getBlocks?.()
        expect(blocks?.map(block => block.type)).toEqual(['paragraph'])
        expect(blocks?.[0].segments.some(segment => segment.style?.fontWeight === '700')).toBe(true)
    })

    it('preserves text alignment from linked EPUB stylesheets', async () => {
        const parser = new EPUBParser()
        const book = await parser.parse(await createTestEPUB({
            chapters: [{
                id: 'centered',
                title: 'Centered',
                content: '<html xmlns="http://www.w3.org/1999/xhtml"><head><link rel="stylesheet" href="style.css"/></head><body><p class="centered">Centered heading</p><p class="signature">Right signature</p></body></html>',
            }],
            resources: [{
                id: 'style',
                href: 'style.css',
                mediaType: 'text/css',
                data: 'p.centered { text-align: center; font-size: 20px; } p.signature { text-align: right; }',
            }],
        }), {
            domAdapter: new NodeDOMAdapter(),
            urlFactory: new NodeURLFactory(),
        })

        const blocks = await book.sections[0].getBlocks?.()
        expect(blocks?.map(block => block.segments.map(segment => segment.text).join(''))).toEqual([
            'Centered heading',
            'Right signature',
        ])
        expect(blocks?.[0].style?.textAlign).toBe('center')
        expect(blocks?.[0].style?.fontSize).toBe(20)
        expect(blocks?.[0].segments[0].style?.textAlign).toBe('center')
        expect(blocks?.[1].style?.textAlign).toBe('end')
    })

    it('rewrites inline style elements without adapter textContent errors', async () => {
        const parser = new EPUBParser()
        const book = await parser.parse(await createTestEPUB({
            chapters: [{
                id: 'styled-css',
                title: 'Styled CSS',
                content: '<html xmlns="http://www.w3.org/1999/xhtml"><head><style>body { background-image: url("images/bg.png"); }</style></head><body><p>Hello</p></body></html>',
            }],
            resources: [{
                id: 'bg-image',
                href: 'images/bg.png',
                mediaType: 'image/png',
                data: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
            }],
        }), {
            domAdapter: new NodeDOMAdapter(),
            urlFactory: new NodeURLFactory(),
        })

        const html = await book.sections[0].load()

        expect(html).toContain('background-image: url("test://resource-')
    })

    it('can prepare and layout a real EPUB from data/', async () => {
        const parser = new EPUBParser()
        const data = await readFile('data/1.epub')
        const book = await parser.parse(data.buffer.slice(
            data.byteOffset,
            data.byteOffset + data.byteLength,
        ), {
            domAdapter: new NodeDOMAdapter(),
            urlFactory: new NodeURLFactory(),
        })

        let segments: TextSegment[] = []
        for (const section of book.sections) {
            const candidate = await section.getSegments?.()
            if (candidate?.some(segment => segment.text.trim())) {
                segments = candidate
                break
            }
        }
        expect(segments?.length).toBeGreaterThan(0)

        const prepared = prepare(segments!, { baseStyle: { fontSize: 16, lineHeight: 1.5 } })
        const lines = layout(prepared, { inlineSize: 360 })

        expect(prepared.blocks.length).toBeGreaterThan(0)
        expect(lines.length).toBeGreaterThan(0)
        expect(lines[0].segments.length).toBeGreaterThan(0)
        expect(lines.every(line => line.width <= 360 || line.segments.length === 1)).toBe(true)
    })

    it('loads text blocks from data/4.epub', async () => {
        const parser = new EPUBParser()
        const data = await readFile('data/4.epub')
        const book = await parser.parse(data.buffer.slice(
            data.byteOffset,
            data.byteOffset + data.byteLength,
        ), {
            domAdapter: new NodeDOMAdapter(),
            urlFactory: new NodeURLFactory(),
        })

        let blockCount = 0
        for (const section of book.sections) {
            const blocks = await section.getBlocks?.()
            blockCount += blocks?.length ?? 0
        }

        expect(blockCount).toBeGreaterThan(0)
    })

    itWithStructuredWriting('keeps DocBook table-of-contents definition lists as list items', async () => {
        const parser = new EPUBParser()
        const data = await readFile(structuredWritingFixture)
        const book = await parser.parse(data.buffer.slice(
            data.byteOffset,
            data.byteOffset + data.byteLength,
        ), {
            domAdapter: new NodeDOMAdapter(),
            urlFactory: new NodeURLFactory(),
        })

        const tocSection = book.sections.find(section => String(section.id).endsWith('bk01-toc.html'))
        expect(tocSection).toBeDefined()

        const blocks = await tocSection!.getBlocks?.()
        const textBlocks = blocks?.filter(block => block.segments.some(segment => segment.text.trim())) ?? []
        const listBlocks = textBlocks.filter(block => block.type === 'listItem')
        expect(listBlocks.slice(0, 5).map(block => block.type)).toEqual([
            'listItem',
            'listItem',
            'listItem',
            'listItem',
            'listItem',
        ])
        expect(listBlocks[0].segments.map(segment => segment.text).join('')).toBe('Preface')
        expect(listBlocks[2].segments.map(segment => segment.text).join('')).toBe('I. Structured Writing Domains')

        const nested = listBlocks.find(block => block.segments.map(segment => segment.text).join('').includes('How Ideas Become Content'))
        expect(nested?.depth).toBe(1)
        expect(nested?.segments.map(segment => segment.text).join('')).toBe('1. How Ideas Become Content')

        const lines = layout(prepareBlocks(listBlocks.slice(0, 5), { baseStyle: { fontSize: 16, lineHeight: 1.5 } }), {
            inlineSize: 360,
        })
        expect(lines.find(line => line.text.includes('Preface'))?.inlineOffset).toBe(0)
        expect(lines.find(line => line.text.includes('How Ideas Become Content'))?.inlineOffset).toBeGreaterThan(0)
    })

    itWithStructuredWriting('keeps empty anchor ids on heading blocks for TOC navigation', async () => {
        const parser = new EPUBParser()
        const data = await readFile(structuredWritingFixture)
        const book = await parser.parse(data.buffer.slice(
            data.byteOffset,
            data.byteOffset + data.byteLength,
        ), {
            domAdapter: new NodeDOMAdapter(),
            urlFactory: new NodeURLFactory(),
        })

        const introduction = book.sections.find(section => String(section.id).endsWith('pr02.html'))
        expect(introduction).toBeDefined()

        const blocks = await introduction!.getBlocks?.()
        const complexity = blocks?.find(block =>
            block.segments.map(segment => segment.text).join('').includes('3.\u00a0Complexity')
        )

        expect(complexity?.id).toBe('d0e230')
        expect(complexity?.attrs?.id).toBe('d0e230')
    })

    itWithStructuredWriting('extracts the publisher logo image after the table of contents', async () => {
        const parser = new EPUBParser()
        const data = await readFile(structuredWritingFixture)
        const book = await parser.parse(data.buffer.slice(
            data.byteOffset,
            data.byteOffset + data.byteLength,
        ), {
            domAdapter: new NodeDOMAdapter(),
            urlFactory: new NodeURLFactory(),
        })

        const titlePage = book.sections.find(section => String(section.id).endsWith('index.html'))
        expect(titlePage).toBeDefined()

        const blocks = await titlePage!.getBlocks?.()
        const logo = blocks?.find(block => block.type === 'image' && block.image?.originalSrc?.endsWith('graphics/XML-Press-Logo-noURL-color.png'))

        expect(logo?.image?.src.startsWith('test://resource-')).toBe(true)
        expect(logo?.image?.alt).toBe('XML Press')
    })

    itWithStructuredWriting('keeps Structured Writing program listings preformatted', async () => {
        const parser = new EPUBParser()
        const data = await readFile(structuredWritingFixture)
        const book = await parser.parse(data.buffer.slice(
            data.byteOffset,
            data.byteOffset + data.byteLength,
        ), {
            domAdapter: new NodeDOMAdapter(),
            urlFactory: new NodeURLFactory(),
        })

        const chapter3 = book.sections.find(section => String(section.id).endsWith('ch03.html'))
        expect(chapter3).toBeDefined()

        const blocks = await chapter3!.getBlocks?.()
        const listing = blocks?.find(block =>
            block.type === 'pre'
            && block.segments.map(segment => segment.text).join('').includes('<p>Dogs</p>')
        )
        const text = listing?.segments.map(segment => segment.text).join('')

        expect(text).toContain('<ol>\n    <li>\n        <p>Dogs</p>')
        expect(text).toContain('            <li>Spot</li>')

        const prepared = prepareBlocks([listing!], { baseStyle: { fontSize: 10, lineHeight: 2 } })
        const lines = layout(prepared, { inlineSize: 1_000 })
        // Pre blocks are merged into a single kind='pre' line
        expect(lines).toHaveLength(1)
        expect(lines[0].kind).toBe('pre')
        const layoutText = lines[0].text
        expect(layoutText).toContain('<ol>')
        expect(layoutText).toContain('\u00a0\u00a0\u00a0\u00a0<li>')
        expect(layoutText).toContain('\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0<p>Dogs</p>')
        expect(layoutText).toContain('\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0<li>Spot</li>')
    })

    it('moves preformatted blocks to a fresh page when the current page has insufficient space', () => {
        const paragraph = Array.from({ length: 90 }, (_, index) => `word${index}`).join(' ')
        const code = [
            '<ol>',
            '    <li>',
            '        <p>Dogs</p>',
            '        <ol>',
            '            <li>Spot</li>',
            '        </ol>',
            '    </li>',
            '</ol>',
        ].join('\n')
        const prepared = prepareBlocks([
            {
                id: 'paragraph',
                type: 'paragraph',
                segments: [{ text: paragraph }],
            },
            {
                id: 'code',
                type: 'pre',
                segments: [{ text: code }],
            },
        ], { baseStyle: { fontSize: 16, lineHeight: 1.5 } })

        const lines = layout(prepared, {
            inlineSize: 260,
            lineHeight: 24,
            maxBlockHeight: 200,
        })
        const preLine = lines.find(line => line.kind === 'pre')

        expect(preLine?.top).toBeGreaterThanOrEqual(200)
        expect((preLine?.top ?? 0) % 200).toBe(0)
        expect(preLine?.height).toBeLessThanOrEqual(200)
    })

    it('wraps PDF explained program listings in Building the Elements', async () => {
        const parser = new EPUBParser()
        const data = await readFile('data/PDF explained.epub')
        const book = await parser.parse(data.buffer.slice(
            data.byteOffset,
            data.byteOffset + data.byteLength,
        ), {
            domAdapter: new NodeDOMAdapter(),
            urlFactory: new NodeURLFactory(),
        })

        const section = book.sections.find(item => String(item.id).endsWith('ch02s03.html'))
        expect(section).toBeDefined()

        const blocks = await section!.getBlocks?.()
        const listing = blocks?.find(block =>
            block.type === 'pre'
            && block.segments.map(segment => segment.text).join('').includes('/MediaBox [0 0 612 792]')
        )
        expect(listing).toBeDefined()

        const prepared = prepareBlocks([listing!], { baseStyle: { fontSize: 16, lineHeight: 1.5 } })
        const narrow = layout(prepared, { inlineSize: 260, lineHeight: 24 })
        const wide = layout(prepared, { inlineSize: 1000, lineHeight: 24 })

        expect(narrow[0].kind).toBe('pre')
        expect(narrow[0].text.split('\n').length).toBeGreaterThan(wide[0].text.split('\n').length)
        expect(narrow[0].height).toBeGreaterThan(wide[0].height)
        expect(narrow[0].width).toBeLessThanOrEqual(260)
    })

    it('infers compact content-weighted columns for PDF explained version summary tables', async () => {
        const parser = new EPUBParser()
        const data = await readFile('data/PDF explained.epub')
        const book = await parser.parse(data.buffer.slice(
            data.byteOffset,
            data.byteOffset + data.byteLength,
        ), {
            domAdapter: new NodeDOMAdapter(),
            urlFactory: new NodeURLFactory(),
        })

        const section = book.sections.find(item => String(item.id).endsWith('ch01.html'))
        expect(section).toBeDefined()

        const blocks = await section!.getBlocks?.()
        const tableRows = blocks?.filter(block => block.type === 'table' && block.table?.columnCount === 4) ?? []
        const header = tableRows.find(block =>
            block.table?.rows[0]?.cells.some(cell => cell.text === 'PDF version')
        )
        expect(header).toBeDefined()

        const weights = header!.table!.columnWeights
        expect(weights).toHaveLength(4)
        expect(weights![3]).toBeGreaterThan(weights![0] + weights![1] + weights![2])

        const prepared = prepareBlocks(tableRows, { baseStyle: { fontSize: 16, lineHeight: 1.5 } })
        const lines = layout(prepared, { inlineSize: 720, lineHeight: 24 })
        const totalHeight = lines.reduce((sum, line) => sum + line.height, 0)
        const extensionLevel3 = lines.find(line =>
            line.table?.rows[0]?.cells[0]?.text === '1.7 Extension Level 3'
        )

        expect(lines).toHaveLength(12)
        expect(extensionLevel3?.height).toBeGreaterThanOrEqual(59)
        expect(totalHeight).toBeLessThan(720)
    })

    it('extracts tables and figure blocks from The Accidental Taxonomist', async () => {
        const parser = new EPUBParser()
        const data = await readFile('data/The Accidental Taxonomist.epub')
        const book = await parser.parse(data.buffer.slice(
            data.byteOffset,
            data.byteOffset + data.byteLength,
        ), {
            domAdapter: new NodeDOMAdapter(),
            urlFactory: new NodeURLFactory(),
        })

        const chapter1 = book.sections.find(section => String(section.id).endsWith('Chapter01.xhtml'))
        const figuresAndTables = book.sections.find(section => String(section.id).endsWith('List.xhtml'))
        expect(chapter1).toBeDefined()
        expect(figuresAndTables).toBeDefined()

        const chapterBlocks = await chapter1!.getBlocks?.()
        const listBlocks = await figuresAndTables!.getBlocks?.()
        const chapterTableRows = chapterBlocks?.filter(block => block.type === 'table') ?? []
        const listTableRows = listBlocks?.filter(block => block.type === 'table') ?? []
        const chapterImages = chapterBlocks?.filter(block => block.type === 'image') ?? []

        expect(chapterTableRows.length).toBeGreaterThan(5)
        expect(chapterTableRows[0].table?.columnCount).toBe(4)
        expect(chapterTableRows[0].table?.columnWeights).toEqual([25, 25, 25, 25])
        expect(chapterTableRows[0].table?.rows[0]?.cells.map(cell => cell.text)).toEqual([
            'Year',
            '“taxonomies” in article titles',
            '“taxonomies” in article text',
            '“controlled vocabularies” Subject',
        ])

        expect(listTableRows.length).toBeGreaterThan(20)
        expect(listTableRows[0].table?.columnCount).toBe(2)
        expect(listTableRows[0].table?.columnWeights).toEqual([20, 80])
        expect(listTableRows[0].table?.rows[0]?.cells.map(cell => cell.text)).toEqual([
            'Figure 1.1',
            'Terms in a synonym ring',
        ])

        const alphaNumericImage = chapterImages.find(block => block.image?.originalSrc?.endsWith('f0011-01.jpg'))
        expect(alphaNumericImage?.image?.width).toBe(297)
        expect(alphaNumericImage?.image?.height).toBe(330)

        const prepared = prepareBlocks([
            ...chapterTableRows.slice(0, 2),
            alphaNumericImage!,
        ], { baseStyle: { fontSize: 16, lineHeight: 1.5 } })
        const lines = layout(prepared, { inlineSize: 360, maxBlockHeight: 420 })
        expect(lines.some(line => line.kind === 'table')).toBe(true)
        expect(lines.some(line => line.kind === 'image')).toBe(true)
        expect(lines.every(line => (line.top % 420) + line.height <= 420)).toBe(true)
    })

    it('exposes image blocks with renderable URLs and cover hints', async () => {
        const parser = new EPUBParser()
        const urlFactory = new NodeURLFactory()
        const book = await parser.parse(await createTestEPUB({
            chapters: [{
                id: 'cover',
                title: 'Cover',
                content: '<html xmlns="http://www.w3.org/1999/xhtml"><body><p><img src="images/cover.png" alt="Cover image" width="600" height="900" style="max-width: 320px; object-fit: contain"/></p></body></html>',
            }],
            resources: [{
                id: 'cover-image',
                href: 'images/cover.png',
                mediaType: 'image/png',
                properties: 'cover-image',
                data: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
            }],
        }), {
            domAdapter: new NodeDOMAdapter(),
            urlFactory,
        })

        const blocks = await book.sections[0].getBlocks?.()
        const image = blocks?.find(block => block.type === 'image')

        expect(image?.image?.src.startsWith('test://resource-')).toBe(true)
        expect(image?.image?.originalSrc).toBe('OEBPS/images/cover.png')
        expect(image?.image?.isCover).toBe(true)
        expect(image?.image?.alt).toBe('Cover image')
        expect(image?.image?.width).toBe(600)
        expect(image?.image?.height).toBe(900)
        expect(image?.image?.style?.maxWidth).toBe(320)
        expect(urlFactory.hasURL(image!.image!.src)).toBe(true)
    })

    it('preserves raster aspect ratio for EPUB images with only one declared dimension', async () => {
        const parser = new EPUBParser()
        const book = await parser.parse(await createTestEPUB({
            chapters: [{
                id: 'wide-image',
                title: 'Wide Image',
                content: '<html xmlns="http://www.w3.org/1999/xhtml"><body><p><img src="images/wide.png" alt="wide" width="400"/></p><p><img src="images/tall.png" alt="tall" height="160"/></p></body></html>',
            }],
            resources: [
                {
                    id: 'wide',
                    href: 'images/wide.png',
                    mediaType: 'image/png',
                    data: pngWithDimensions(800, 200),
                },
                {
                    id: 'tall',
                    href: 'images/tall.png',
                    mediaType: 'image/png',
                    data: pngWithDimensions(300, 600),
                },
            ],
        }), {
            domAdapter: new NodeDOMAdapter(),
            urlFactory: new NodeURLFactory(),
        })

        const blocks = await book.sections[0].getBlocks?.()
        const images = blocks?.filter(block => block.type === 'image') ?? []
        const prepared = prepareBlocks(images, { baseStyle: { fontSize: 16, lineHeight: 1.5 } })
        const lines = layout(prepared, { inlineSize: 500, maxBlockHeight: 700 })

        expect(images[0]?.image).toMatchObject({
            width: 400,
            height: 100,
            aspectRatio: 4,
        })
        expect(images[1]?.image).toMatchObject({
            width: 80,
            height: 160,
            aspectRatio: 0.5,
        })
        expect(lines.find(line => line.block?.id === images[0]?.id)?.height).toBe(100)
        expect(lines.find(line => line.block?.id === images[1]?.id)?.height).toBe(160)
    })

    it('applies linked CSS class dimensions before extracting image blocks', async () => {
        const parser = new EPUBParser()
        const book = await parser.parse(await createTestEPUB({
            chapters: [{
                id: 'css-sized-image',
                title: 'CSS Sized Image',
                content: '<html xmlns="http://www.w3.org/1999/xhtml"><head><link href="styles/book.css" rel="stylesheet" type="text/css"/></head><body><p><img class="height-12em framed" src="images/pic.png" alt="pic"/></p></body></html>',
            }],
            resources: [
                {
                    id: 'css',
                    href: 'styles/book.css',
                    mediaType: 'text/css',
                    data: '.height-12em { height: 12em; } img.framed { max-width: 10em; }',
                },
                {
                    id: 'pic',
                    href: 'images/pic.png',
                    mediaType: 'image/png',
                    data: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
                },
            ],
        }), {
            domAdapter: new NodeDOMAdapter(),
            urlFactory: new NodeURLFactory(),
        })

        const blocks = await book.sections[0].getBlocks?.()
        const image = blocks?.find(block => block.type === 'image')?.image
        expect(image?.style?.height).toBe(192)
        expect(image?.style?.maxWidth).toBe(160)
    })

    it('keeps image blocks when corrupt archives cannot extract referenced resources', async () => {
        const parser = new EPUBParser()
        const data = await readFile('data/1.epub')
        const book = await parser.parse(data.buffer.slice(
            data.byteOffset,
            data.byteOffset + data.byteLength,
        ), {
            domAdapter: new NodeDOMAdapter(),
            urlFactory: new NodeURLFactory(),
        })

        const section = book.sections.find(section => String(section.id).endsWith('p-012.xhtml'))
        expect(section).toBeDefined()

        const blocks = await section!.getBlocks?.()
        const missingArchiveImage = blocks?.find(block => block.type === 'image' && block.image?.originalSrc?.endsWith('p168.jpg'))
        const readableImage = blocks?.find(block => block.type === 'image' && block.image?.originalSrc?.endsWith('p191.jpg'))

        expect(missingArchiveImage?.image?.src).toBe('item/image/p168.jpg')
        expect(readableImage?.image?.src.startsWith('test://resource-')).toBe(true)
    })

    it('does not promote footnote marker images from Gui Women to block images', async () => {
        const parser = new EPUBParser()
        const data = await readFile('data/归我们未来经济社会的行动指南.epub')
        const book = await parser.parse(data.buffer.slice(
            data.byteOffset,
            data.byteOffset + data.byteLength,
        ), {
            domAdapter: new NodeDOMAdapter(),
            urlFactory: new NodeURLFactory(),
        })

        const firstChapter = book.sections.find(section => String(section.id).endsWith('Section0002.xhtml'))
        expect(firstChapter).toBeDefined()

        const blocks = await firstChapter!.getBlocks?.()
        const footnoteImages = blocks?.filter(block =>
            block.type === 'image' && block.image?.role?.includes('epub-footnote')
        ) ?? []
        const inlineFigure = blocks?.find(block =>
            block.type === 'image' && block.image?.originalSrc?.endsWith('image_010.jpg')
        )
        const inlineFootnoteMarkers = blocks?.flatMap(block => block.segments).filter(segment =>
            segment.source?.nodeType === 'img'
            && segment.source.attrs?.class?.includes('epub-footnote')
        ) ?? []
        const visibleText = blocks?.flatMap(block => block.segments).map(segment => segment.text).join('') ?? ''

        expect(footnoteImages).toHaveLength(0)
        expect(inlineFootnoteMarkers.length).toBeGreaterThan(0)
        expect(inlineFootnoteMarkers[0].source?.attrs?.['data-rebook-inline-image-width']).toBe('11')
        expect(inlineFootnoteMarkers[0].source?.attrs?.['data-rebook-footnote-content']).toContain('Locked In, Logged Out')
        expect(visibleText).not.toContain('Locked In, Logged Out')
        expect(inlineFigure?.image?.width).toBe(150)
    })

    itWithLolita('marks real EPUB note references and note paragraphs semantically', async () => {
        const parser = new EPUBParser()
        const data = await readFile(lolitaFixture)
        const book = await parser.parse(data.buffer.slice(
            data.byteOffset,
            data.byteOffset + data.byteLength,
        ), {
            domAdapter: new NodeDOMAdapter(),
            urlFactory: new NodeURLFactory(),
        })

        const chapter = book.sections.find(section => String(section.id).endsWith('part0370.xhtml'))
        expect(chapter).toBeDefined()

        const blocks = await chapter!.getBlocks?.()
        const noterefSegments = blocks?.flatMap(block => block.segments).filter(segment =>
            segment.source?.attrs?.['data-rebook-role'] === 'noteref'
        ) ?? []
        const footnoteBlocks = blocks?.filter(block =>
            block.attrs?.['data-rebook-role'] === 'footnote'
        ) ?? []

        expect(noterefSegments.map(segment => segment.text)).toContain('[1]')
        expect(footnoteBlocks.some(block =>
            block.segments.map(segment => segment.text).join('').includes('“洛丽塔”这个名字')
        )).toBe(true)
    })
})
