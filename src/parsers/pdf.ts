/**
 * Native PDF parser.
 *
 * This parser returns a normal Book with a page-native fixedDocument payload.
 * The PDF engine code lives inside rebook under src/pdf; rebook-pdf remains a
 * prototype/reference package and is not a runtime dependency.
 */

import type { Book, BookMetadata, TOCItem } from '../core/types'
import type { FixedPageInfo, FixedPageTextLayer, FixedPageTextRun } from '../core/fixed-document'
import type { Parser, ParserInput, ParserOptions } from '../core/parser'
import { ParseError, UnsupportedInputError } from '../core/errors'
import { getInputName, isBlobLike } from '../core/binary'
import { RebookPdfDocument } from '../pdf/engine/document'
import type { PdfFixedDocument } from '../pdf/fixed-document'
import { getBrowserPdfRuntime } from '../pdf/platform/browser'
import type { PdfMatrix, PdfOutlineItem, PdfPageInfo, PdfPageText, PdfRuntime, PdfTextRun } from '../pdf/types'

const PDF_HEADER = '%PDF-'

export interface PDFParserOptions extends ParserOptions {
    /**
     * Keep decoded page resources and text in memory. Defaults to true because
     * readers often revisit visible pages while scrolling or selecting text.
     */
    cache?: boolean
    runtime?: PdfRuntime
    embeddedFonts?: boolean
}

export class PDFParser implements Parser {
    readonly priority = 20

    async canParse(input: ParserInput): Promise<boolean> {
        if (typeof input === 'string') {
            return input.toLowerCase().split(/[?#]/, 1)[0].endsWith('.pdf')
        }

        const inputName = getInputName(input)
        if (inputName?.toLowerCase().endsWith('.pdf')) {
            return true
        }

        try {
            const bytes = await readInputPrefix(input, 5)
            return new TextDecoder('latin1').decode(bytes) === PDF_HEADER
        } catch {
            return false
        }
    }

    async parse(input: ParserInput, options?: PDFParserOptions): Promise<Book> {
        if (typeof input === 'string') {
            throw new UnsupportedInputError('PDF parser cannot parse URL strings; provide a File, Blob, or ArrayBuffer')
        }

        try {
            const bytes = await readInputBytes(input)
            const document = await RebookPdfDocument.load(bytes, {
                runtime: options?.runtime ?? getBrowserPdfRuntime(),
                cache: options?.cache ?? true,
                embeddedFonts: options?.embeddedFonts ?? true,
            })
            const fixedDocument = createPdfFixedDocument(document)
            const pageLabels = await document.getPageLabels()
            const pageList = pageLabels.map((label, index): TOCItem => ({
                label,
                href: pageHref(index),
            }))
            const pageIndexByRef = new Map(document.getPages().map(page => [pdfRefKey(page.object), page.index]))
            const toc = outlineToTOC(await document.getOutline(), pageIndexByRef)
            const metadata: BookMetadata = {
                title: getInputName(input) ?? 'PDF Document',
                format: 'pdf',
                pdfVersion: document.version,
            }

            return {
                sections: [],
                pageList,
                toc,
                metadata,
                rendition: { layout: 'pre-paginated' },
                fixedDocument,
                resolveHref(href) {
                    const index = parsePageHref(href)
                    return index != null && index >= 0 && index < document.pageCount ? { index } : null
                },
                splitTOCHref(href) {
                    const index = parsePageHref(href)
                    return [index ?? href, null]
                },
                destroy() {
                    document.clearCaches()
                },
            }
        } catch (error) {
            if (error instanceof UnsupportedInputError) throw error
            const message = error instanceof Error ? error.message : String(error)
            throw new ParseError(`Failed to parse PDF: ${message}`, 'pdf')
        }
    }
}

export const pdf = (): PDFParser => new PDFParser()

function createPdfFixedDocument(document: RebookPdfDocument): PdfFixedDocument {
    const pageInfoCache = new Map<number, FixedPageInfo>()

    return {
        kind: 'fixed-document',
        format: 'pdf',
        get pageCount() {
            return document.pageCount
        },
        getPage(pageIndex) {
            assertPageIndex(document, pageIndex)
            let page = pageInfoCache.get(pageIndex)
            if (!page) {
                page = pdfPageToFixedPage(document.getPages()[pageIndex])
                pageInfoCache.set(pageIndex, page)
            }
            return page
        },
        getPages() {
            return document.getPages().map(page => {
                let fixedPage = pageInfoCache.get(page.index)
                if (!fixedPage) {
                    fixedPage = pdfPageToFixedPage(page)
                    pageInfoCache.set(page.index, fixedPage)
                }
                return fixedPage
            })
        },
        async getPageText(pageIndex) {
            assertPageIndex(document, pageIndex)
            return pdfTextToFixedTextLayer(await document.getPageText(pageIndex))
        },
        getPageDisplayList(pageIndex) {
            assertPageIndex(document, pageIndex)
            return document.getPageDisplayList(pageIndex)
        },
        destroy() {
            pageInfoCache.clear()
            document.clearCaches()
        },
    }
}

function pdfPageToFixedPage(page: PdfPageInfo): FixedPageInfo {
    const box = normalizeRect(page.cropBox)
    const width = (box[2] - box[0]) * page.userUnit
    const height = (box[3] - box[1]) * page.userUnit
    const rotation = normalizePageRotation(page.rotate)
    return {
        index: page.index,
        width: rotation === 90 || rotation === 270 ? height : width,
        height: rotation === 90 || rotation === 270 ? width : height,
        rotation,
    }
}

function pdfTextToFixedTextLayer(page: PdfPageText): FixedPageTextLayer {
    return {
        pageIndex: page.pageIndex,
        width: page.width,
        height: page.height,
        runs: page.runs.map(pdfTextRunToFixedTextRun),
        text: page.text,
    }
}

function pdfTextRunToFixedTextRun(run: PdfTextRun): FixedPageTextRun {
    const transform: PdfMatrix = [run.fontSize, 0, 0, run.fontSize, run.x, run.y]
    return {
        text: run.text,
        transform,
        width: run.width,
        height: run.fontSize,
        fontSize: run.fontSize,
        fontFamily: run.fontFamily,
        fontWeight: run.fontWeight,
        fontStyle: run.fontStyle,
    }
}

async function readInputPrefix(input: Exclude<ParserInput, string>, byteLength: number): Promise<Uint8Array> {
    if (input instanceof ArrayBuffer) return new Uint8Array(input, 0, Math.min(input.byteLength, byteLength))
    if (input instanceof Uint8Array) return input.subarray(0, byteLength)
    if (isBlobLike(input)) {
        const prefix = input.slice(0, byteLength)
        return new Uint8Array(await prefix.arrayBuffer())
    }
    throw new UnsupportedInputError('PDF parser expects a File, Blob, or ArrayBuffer')
}

async function readInputBytes(input: Exclude<ParserInput, string>): Promise<Uint8Array> {
    if (input instanceof ArrayBuffer) return new Uint8Array(input)
    if (input instanceof Uint8Array) return input
    if (isBlobLike(input)) return new Uint8Array(await input.arrayBuffer())
    throw new UnsupportedInputError('PDF parser expects a File, Blob, or ArrayBuffer')
}

function assertPageIndex(document: RebookPdfDocument, pageIndex: number): void {
    if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= document.pageCount) {
        throw new RangeError(`Invalid PDF page index ${pageIndex}`)
    }
}

function outlineToTOC(items: readonly PdfOutlineItem[], pageIndexByRef: ReadonlyMap<string, number>): TOCItem[] {
    return items.map((item, index) => ({
        label: item.title,
        href: outlineHref(item, index, pageIndexByRef),
        subitems: item.items.length > 0 ? outlineToTOC(item.items, pageIndexByRef) : undefined,
    }))
}

function outlineHref(item: PdfOutlineItem, fallbackIndex: number, pageIndexByRef: ReadonlyMap<string, number>): string {
    const pageIndex = destinationPageIndex(item.destination, pageIndexByRef)
    if (pageIndex != null) return pageHref(pageIndex)
    return item.url ?? `pdf:outline:${fallbackIndex}`
}

function destinationPageIndex(destination: PdfOutlineItem['destination'], pageIndexByRef: ReadonlyMap<string, number>): number | null {
    if (!Array.isArray(destination)) return null
    const [target] = destination
    if (typeof target === 'number') return Math.max(0, target - 1)
    if (isPdfRef(target)) return pageIndexByRef.get(pdfRefKey(target)) ?? null
    return null
}

function isPdfRef(value: unknown): value is { type: 'ref'; objectNumber: number; generation: number } {
    return !!value
        && typeof value === 'object'
        && (value as { type?: unknown }).type === 'ref'
        && typeof (value as { objectNumber?: unknown }).objectNumber === 'number'
        && typeof (value as { generation?: unknown }).generation === 'number'
}

function pdfRefKey(ref: { objectNumber: number; generation: number }): string {
    return `${ref.objectNumber}:${ref.generation}`
}

function pageHref(index: number): string {
    return `pdf:page:${index}`
}

function parsePageHref(href: string): number | null {
    const match = href.match(/^pdf:page:(\d+)$/)
    return match ? Number(match[1]) : null
}

function normalizeRect(rect: readonly [number, number, number, number]): [number, number, number, number] {
    return [
        Math.min(rect[0], rect[2]),
        Math.min(rect[1], rect[3]),
        Math.max(rect[0], rect[2]),
        Math.max(rect[1], rect[3]),
    ]
}

function normalizePageRotation(rotate: number): 0 | 90 | 180 | 270 {
    const normalized = ((Math.trunc(rotate) % 360) + 360) % 360
    return normalized === 90 || normalized === 180 || normalized === 270 ? normalized : 0
}
