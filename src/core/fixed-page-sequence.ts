import type { FixedDocument, FixedPageInfo } from './fixed-document'
import { UnsupportedFormatError } from './errors'
import type { Book, RelocateEvent, TOCItem } from './types'

export interface FixedPageSequenceConfig {
    readonly book: Book
    readonly document: FixedDocument
    readonly pages: readonly FixedPageInfo[]
    readonly pageIndex?: number
}

export class FixedPageSequence {
    readonly book: Book
    readonly document: FixedDocument
    readonly pages: readonly FixedPageInfo[]
    private index: number

    constructor(config: FixedPageSequenceConfig) {
        this.book = config.book
        this.document = config.document
        this.pages = config.pages
        this.index = clampFixedPageIndex(config.pageIndex ?? 0, this.pages.length)
    }

    static async fromBook(book: Book): Promise<FixedPageSequence> {
        if (!book.fixedDocument) {
            throw new UnsupportedFormatError('FixedPageSequence requires a fixedDocument book')
        }
        return new FixedPageSequence({
            book,
            document: book.fixedDocument,
            pages: await readFixedDocumentPages(book.fixedDocument),
        })
    }

    get pageIndex(): number {
        return this.index
    }

    get currentPage(): FixedPageInfo | null {
        return this.pages[this.index] ?? null
    }

    get pageCount(): number {
        return this.pages.length
    }

    goTo(target: number | string): boolean {
        const pageIndex = this.resolveTarget(target)
        if (pageIndex == null) return false
        return this.setPageIndex(pageIndex)
    }

    next(): boolean {
        if (this.index >= this.pages.length - 1) return false
        this.index++
        return true
    }

    prev(): boolean {
        if (this.index <= 0) return false
        this.index--
        return true
    }

    goToFraction(fraction: number): boolean {
        if (!this.pages.length) return false
        const safe = Math.max(0, Math.min(1, fraction))
        return this.setPageIndex(Math.round(safe * (this.pages.length - 1)))
    }

    getFraction(): number {
        return this.pages.length > 1 ? this.index / (this.pages.length - 1) : 0
    }

    getSectionFractions(): number[] {
        if (!this.pages.length) return []
        if (this.pages.length === 1) return [0, 1]
        return this.pages.map((_, index) => index / (this.pages.length - 1))
    }

    getLocation(reason: string): RelocateEvent {
        const fraction = this.getFraction()
        return {
            index: this.index,
            fraction,
            totalFraction: fraction,
            pageItem: this.book.pageList?.[this.index] ?? null,
            tocItem: this.getCurrentTOCItem(),
            reason,
        }
    }

    getCurrentTOCItem(): TOCItem | null {
        const items = flattenTOC(this.book.toc ?? [])
        let current: TOCItem | null = null
        for (const item of items) {
            const index = this.book.resolveHref?.(item.href)?.index
            if (typeof index === 'number' && index <= this.index) current = item
        }
        return current
    }

    private setPageIndex(pageIndex: number): boolean {
        if (!this.pages.length) return false
        this.index = clampFixedPageIndex(pageIndex, this.pages.length)
        return true
    }

    private resolveTarget(target: number | string): number | null {
        if (typeof target === 'number') return target
        return this.book.resolveHref?.(target)?.index ?? parseFixedPageHref(target)
    }
}

export async function readFixedDocumentPages(document: FixedDocument): Promise<readonly FixedPageInfo[]> {
    if (document.getPages) return document.getPages()
    const pages: FixedPageInfo[] = []
    for (let index = 0; index < document.pageCount; index++) {
        pages.push(await document.getPage(index))
    }
    return pages
}

export function clampFixedPageIndex(index: number, pageCount: number): number {
    const normalized = Number.isFinite(index) ? Math.trunc(index) : 0
    return Math.max(0, Math.min(Math.max(0, pageCount - 1), normalized))
}

export function parseFixedPageHref(href: string): number | null {
    const match = href.match(/^(?:[a-z][a-z0-9+.-]*:)?page:(\d+)$/i)
    return match ? Number(match[1]) : null
}

function flattenTOC(items: readonly TOCItem[]): TOCItem[] {
    return items.flatMap(item => item.subitems?.length ? [item, ...flattenTOC(item.subitems)] : [item])
}
