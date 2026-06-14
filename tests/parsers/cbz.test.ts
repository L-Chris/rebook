/**
 * CBZ Parser unit tests
 */

import { describe, it, expect, beforeAll, vi } from 'vitest'
import { CBZParser, cbz } from '../../src/parsers/cbz'
import { createTestCBZ, createTestCBZWithoutMetadata } from '../fixtures/cbz-fixture'
import { NodeDOMAdapter, NodeURLFactory } from '../../src/adapters/node'
import { AdapterRequiredError, UnsupportedInputError, ParseError } from '../../src/core/errors'

describe('CBZParser', () => {
    let parser: CBZParser
    let domAdapter: NodeDOMAdapter
    let urlFactory: NodeURLFactory

    beforeAll(() => {
        parser = new CBZParser()
        domAdapter = new NodeDOMAdapter()
        urlFactory = new NodeURLFactory()
    })

    const options = () => ({ domAdapter, urlFactory: new NodeURLFactory() })

    describe('canParse', () => {
        it('should return true for .cbz file extension', async () => {
            expect(await parser.canParse('comic.cbz')).toBe(true)
            expect(await parser.canParse('path/to/my-comic.cbz')).toBe(true)
        })

        it('should return false for non-cbz extensions', async () => {
            expect(await parser.canParse('book.epub')).toBe(false)
            expect(await parser.canParse('book.pdf')).toBe(false)
            expect(await parser.canParse('book.txt')).toBe(false)
        })

        it('should return true for CBZ ArrayBuffer with images', async () => {
            const buffer = await createTestCBZ()
            expect(await parser.canParse(buffer)).toBe(true)
        })

        it('should detect ArrayBuffer input when File and Blob globals are unavailable', async () => {
            const buffer = await createTestCBZ()

            vi.stubGlobal('File', undefined)
            vi.stubGlobal('Blob', undefined)
            try {
                await expect(parser.canParse(buffer)).resolves.toBe(true)
            } finally {
                vi.unstubAllGlobals()
            }
        })

        it('should return false for non-image zip ArrayBuffer', async () => {
            // Create a zip with no images (just text files)
            const { configure, ZipWriter, BlobWriter, TextReader } = await import('@zip.js/zip.js')
            configure({ useWebWorkers: false })
            const blobWriter = new BlobWriter()
            const zipWriter = new ZipWriter(blobWriter)
            await zipWriter.add('readme.txt', new TextReader('Hello'))
            await zipWriter.close()
            const blob = await blobWriter.getData()
            const buffer = await blob.arrayBuffer()
            expect(await parser.canParse(buffer)).toBe(false)
        })
    })

    describe('parse', () => {
        it('should parse a CBZ with metadata', async () => {
            const buffer = await createTestCBZ({
                title: 'Test Comic',
                writer: 'John Doe',
                series: 'Test Series',
                number: '5',
                count: '10',
                pages: 3,
            })
            const book = await parser.parse(buffer, options())

            expect(book).toBeDefined()
            expect(book.sections).toHaveLength(0)
            expect(book.fixedDocument?.kind).toBe('fixed-document')
            expect(book.fixedDocument?.format).toBe('cbz')
            expect(book.fixedDocument?.pageCount).toBe(3)
            expect(book.metadata?.title).toBe('Test Comic')
            // author is normalized to Contributor[]
            const authors = book.metadata?.author
            expect(Array.isArray(authors)).toBe(true)
            expect((authors as any[])[0]?.name).toBe('John Doe')
            expect(book.metadata?.belongsTo?.series?.name).toBe('Test Series')
            expect(book.metadata?.belongsTo?.series?.position).toBe('5')
            expect(book.metadata?.belongsTo?.series?.total).toBe('10')
        })

        it('should parse a CBZ without metadata', async () => {
            const buffer = await createTestCBZWithoutMetadata(2)
            const book = await parser.parse(buffer, options())

            expect(book).toBeDefined()
            expect(book.sections).toHaveLength(0)
            expect(book.fixedDocument?.pageCount).toBe(2)
            // No metadata from ComicInfo.xml
            expect(book.metadata?.title).toBeUndefined()
        })

        it('should have pre-paginated rendition', async () => {
            const buffer = await createTestCBZ({ pages: 2 })
            const book = await parser.parse(buffer, options())

            expect(book.rendition?.layout).toBe('pre-paginated')
        })

        it('should have a flat TOC with all pages', async () => {
            const buffer = await createTestCBZ({ pages: 4 })
            const book = await parser.parse(buffer, options())

            expect(book.toc).toHaveLength(4)
            expect(book.toc![0].label).toBe('page001.jpg')
            expect(book.toc![0].href).toBe('page001.jpg')
        })

        it('should sort image files alphabetically', async () => {
            const buffer = await createTestCBZ({ pages: 3 })
            const book = await parser.parse(buffer, options())

            const labels = (await book.fixedDocument!.getPages!()).map(page => page.label)
            expect(labels).toEqual(['page001.jpg', 'page002.jpg', 'page003.jpg'])
        })

        it('should load fixed page images as data URI surfaces', async () => {
            const opts = options()
            const buffer = await createTestCBZ({ pages: 1 })
            const book = await parser.parse(buffer, opts)

            const page = await book.fixedDocument!.getPage(0)
            const image = await book.fixedDocument!.getPageImage!(0)
            expect(page.width).toBe(1)
            expect(page.height).toBe(1)
            // Should be a data URI for image format
            expect(image.src.startsWith('data:image/')).toBe(true)
            expect(image.width).toBe(1)
            expect(image.height).toBe(1)
        })

        it('should cache fixed page images until destroy', async () => {
            const buffer = await createTestCBZ({ pages: 1 })
            const book = await parser.parse(buffer, options())

            const image = await book.fixedDocument!.getPageImage!(0)
            const image2 = await book.fixedDocument!.getPageImage!(0)
            expect(image2).toBe(image)

            book.destroy?.()
        })

        it('should return cover as first image blob', async () => {
            const buffer = await createTestCBZ({ pages: 2 })
            const book = await parser.parse(buffer, options())

            const cover = await book.getCover?.()
            expect(cover).toBeInstanceOf(Blob)
        })

        it('should resolve href to section index', async () => {
            const buffer = await createTestCBZ({ pages: 3 })
            const book = await parser.parse(buffer, options())

            const result = book.resolveHref?.('page002.jpg')
            expect(result?.index).toBe(1)
        })

        it('should return null for unknown href', async () => {
            const buffer = await createTestCBZ({ pages: 2 })
            const book = await parser.parse(buffer, options())

            const result = book.resolveHref?.('nonexistent.jpg')
            expect(result).toBeNull()
        })

        it('should cleanup URLs on destroy', async () => {
            const buffer = await createTestCBZ({ pages: 2 })
            const book = await parser.parse(buffer, options())

            await book.fixedDocument!.getPageImage!(0)
            await book.fixedDocument!.getPageImage!(1)

            // Should not throw
            book.destroy?.()
        })

        it('should throw ParseError if no images found', async () => {
            const { configure, ZipWriter, BlobWriter, TextReader } = await import('@zip.js/zip.js')
            configure({ useWebWorkers: false })
            const blobWriter = new BlobWriter()
            const zipWriter = new ZipWriter(blobWriter)
            await zipWriter.add('readme.txt', new TextReader('No images here'))
            await zipWriter.close()
            const blob = await blobWriter.getData()
            const buffer = await blob.arrayBuffer()

            await expect(parser.parse(buffer, options())).rejects.toThrow(ParseError)
            await expect(parser.parse(buffer, options())).rejects.toThrow('No image files found')
        })

        it('should throw UnsupportedInputError for string input', async () => {
            await expect(parser.parse('http://example.com/comic.cbz', options())).rejects.toThrow(UnsupportedInputError)
        })

        it('should throw AdapterRequiredError when domAdapter not provided', async () => {
            const buffer = await createTestCBZ({ pages: 1 })
            await expect(parser.parse(buffer)).rejects.toThrow(AdapterRequiredError)
            await expect(parser.parse(buffer, {})).rejects.toThrow(AdapterRequiredError)
            // urlFactory alone is not sufficient - domAdapter is required
            await expect(parser.parse(buffer, { urlFactory: new NodeURLFactory() })).rejects.toThrow(AdapterRequiredError)
        })

        it('should work with only domAdapter (urlFactory not required)', async () => {
            const buffer = await createTestCBZ({ pages: 1 })
            const book = await parser.parse(buffer, { domAdapter })
            expect(book.fixedDocument?.pageCount).toBeGreaterThan(0)
        })
    })

    describe('factory', () => {
        it('should create parser via factory function', () => {
            const p = cbz()
            expect(p).toBeInstanceOf(CBZParser)
        })
    })
})
