import type { Book, Section, TOCItem } from '../core/types'
import type { ExportSelection } from '../core/exporter'

export interface SelectedSection {
    readonly section: Section
    readonly sourceIndex: number
    readonly title?: string
}

export function selectSections(book: Book, selection: ExportSelection): SelectedSection[] {
    if (selection.type !== 'first-sections') {
        throw new Error(`Unsupported export selection: ${selection.type}`)
    }
    if (!Number.isInteger(selection.count) || selection.count < 1) {
        throw new RangeError('sectionCount must be a positive integer')
    }
    if (selection.unit && selection.unit !== 'section') {
        throw new Error(`Unsupported export unit: ${selection.unit}`)
    }

    const sections = getSelectableSections(book)
    const labels = buildSectionLabels(book)
    return sections
        .map((section, sourceIndex) => ({ section, sourceIndex, title: labels.get(sourceIndex) }))
        .filter(entry => selection.includeNonLinear || entry.section.linear !== 'no')
        .slice(0, selection.count)
}

function getSelectableSections(book: Book): readonly Section[] {
    if (book.sections.length > 0) return book.sections
    const fixedDocument = book.fixedDocument
    if (!fixedDocument?.getPageImage) return book.sections

    return Array.from({ length: fixedDocument.pageCount }, (_, pageIndex): Section => {
        const href = book.pageList?.[pageIndex]?.href ?? `${fixedDocument.format}:page:${pageIndex}`
        return {
            id: href,
            size: 0,
            format: 'image',
            load: async () => (await fixedDocument.getPageImage!(pageIndex)).src,
            loadText: async () => `[${book.pageList?.[pageIndex]?.label ?? `Page ${pageIndex + 1}`}]`,
            getDocument: async () => null,
        }
    })
}

function buildSectionLabels(book: Book): Map<number, string> {
    const labels = new Map<number, string>()
    const walk = (items: readonly TOCItem[] | undefined) => {
        for (const item of items ?? []) {
            const index = resolveTOCIndex(book, item.href)
            if (index >= 0 && !labels.has(index)) labels.set(index, item.label)
            walk(item.subitems)
        }
    }
    walk(book.toc)
    return labels
}

function resolveTOCIndex(book: Book, href: string): number {
    const resolved = book.resolveHref?.(href)
    if (resolved && resolved.index >= 0) return resolved.index

    const [id] = book.splitTOCHref?.(href) ?? href.split('#')
    const sectionId = String(id)
    return book.sections.findIndex(section => String(section.id) === sectionId || String(section.id) === decodeURI(sectionId))
}
