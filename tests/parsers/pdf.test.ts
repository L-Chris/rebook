import { describe, expect, it } from 'vitest'
import { registry } from '../../src/core/parser'
import { PDFParser, pdf } from '../../src/parsers/pdf'
import { makeFlatePdf, makeOutlinePdf, makeSimplePdf } from '../fixtures/pdf-fixture'

describe('PDFParser', () => {
    it('detects PDF inputs by extension and header', async () => {
        const parser = new PDFParser()

        expect(await parser.canParse('book.pdf')).toBe(true)
        expect(await parser.canParse('book.epub')).toBe(false)
        expect(await parser.canParse(makeSimplePdf().buffer)).toBe(true)
    })

    it('parses a PDF into a fixed-document book', async () => {
        const parser = new PDFParser()
        const book = await parser.parse(makeSimplePdf().buffer)

        expect(book.sections).toHaveLength(0)
        expect(book.rendition?.layout).toBe('pre-paginated')
        expect(book.fixedDocument?.kind).toBe('fixed-document')
        expect(book.fixedDocument?.format).toBe('pdf')
        expect(book.fixedDocument?.pageCount).toBe(1)
        expect(book.pageList?.[0]).toEqual({ label: '1', href: 'pdf:page:0' })
        expect(book.metadata?.format).toBe('pdf')

        const page = await book.fixedDocument!.getPage(0)
        expect(page).toMatchObject({ index: 0, width: 300, height: 144 })

        const text = await book.fixedDocument!.getPageText?.(0)
        expect(text?.text).toContain('Hello Rebook PDF')
        expect(text?.runs[0]).toMatchObject({
            text: 'Hello Rebook PDF',
            fontSize: 18,
            transform: [18, 0, 0, 18, 48, 48],
        })
    })

    it('decodes compressed page content without external runtime dependencies', async () => {
        const parser = new PDFParser()
        const book = await parser.parse(makeFlatePdf().buffer)
        const text = await book.fixedDocument!.getPageText?.(0)

        expect(text?.text).toBe('Compressed Rebook PDF')
    })

    it('maps PDF outline destinations to page hrefs', async () => {
        const parser = new PDFParser()
        const book = await parser.parse(makeOutlinePdf().buffer)

        expect(book.toc?.[0]).toMatchObject({ label: 'Chapter 1', href: 'pdf:page:0' })
        expect(book.resolveHref?.(book.toc![0].href)).toEqual({ index: 0 })
    })

    it('opens through the parser registry', async () => {
        registry.register('pdf', pdf)
        const book = await registry.open(makeSimplePdf().buffer)

        expect(book.fixedDocument?.format).toBe('pdf')
    })

    it('rejects URL string parsing for now', async () => {
        await expect(new PDFParser().parse('https://example.com/book.pdf')).rejects.toThrow('provide a File, Blob, or ArrayBuffer')
    })
})
