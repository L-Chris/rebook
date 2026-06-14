import type { Book, Section, TOCItem } from './types'

export interface SectionIndexLookup {
    readonly byId: ReadonlyMap<string | number, number>
    readonly byPath: ReadonlyMap<string, number>
}

export function flattenTOC(items: readonly TOCItem[] | null | undefined): TOCItem[] {
    return (items ?? []).flatMap(item => item.subitems?.length ? [item, ...flattenTOC(item.subitems)] : [item])
}

export function normalizeTOCHref(href?: string | null): string {
    return (href || '').trim()
}

export function normalizeNavigationHref(href?: string | null): string {
    return normalizeTOCHref(href).split('#')[0]
}

export function normalizeBookPath(href?: string | null): string {
    const path = normalizeNavigationHref(href).replace(/\\/g, '/').replace(/^\/+/, '')
    const parts: string[] = []
    for (const part of path.split('/')) {
        if (!part || part === '.') continue
        if (part === '..') parts.pop()
        else parts.push(part)
    }
    return parts.join('/')
}

export function createSectionIndexLookup(book: Pick<Book, 'sections'>): SectionIndexLookup {
    const byId = new Map<string | number, number>()
    const byPath = new Map<string, number>()
    for (const [index, section] of book.sections.entries()) {
        byId.set(section.id, index)
        byPath.set(normalizeBookPath(String(section.id ?? '')), index)
    }
    return { byId, byPath }
}

export function findSectionIndex(lookup: SectionIndexLookup, id: string | number): number {
    const exact = lookup.byId.get(id)
    if (exact !== undefined) return exact

    const normalized = normalizeBookPath(String(id))
    if (!normalized) return -1
    const byPath = lookup.byPath.get(normalized)
    if (byPath !== undefined) return byPath

    const suffix = `/${normalized}`
    for (const [sectionPath, index] of lookup.byPath) {
        if (sectionPath.endsWith(suffix)) return index
    }
    return -1
}

export function resolveTOCSectionIndex(
    book: Pick<Book, 'sections' | 'resolveHref' | 'splitTOCHref'>,
    href: string,
    sectionLookup = createSectionIndexLookup(book),
): number {
    const resolved = book.resolveHref?.(href)
    if (typeof resolved?.index === 'number' && resolved.index >= 0) return resolved.index

    const parts = book.splitTOCHref?.(href)
    if (parts && Array.isArray(parts)) {
        const [id] = parts
        const sectionIndex = findSectionIndex(sectionLookup, id)
        if (sectionIndex >= 0) return sectionIndex
    }

    const normalizedHref = normalizeBookPath(href)
    if (!normalizedHref) return -1

    const sectionIndex = sectionLookup.byPath.get(normalizedHref)
    if (sectionIndex !== undefined) return sectionIndex

    const suffix = `/${normalizedHref}`
    for (const [sectionPath, index] of sectionLookup.byPath) {
        if (sectionPath.endsWith(suffix)) return index
    }
    return -1
}

export function findTOCItemForSection(
    book: Pick<Book, 'toc' | 'sections' | 'resolveHref' | 'splitTOCHref'>,
    sectionIndex: number,
    section: Section | undefined = book.sections[sectionIndex],
    sectionLookup = createSectionIndexLookup(book),
): TOCItem | null {
    const items = flattenTOC(book.toc)
    if (!items.length) return null

    for (const item of items) {
        const index = resolveTOCSectionIndex(book, item.href, sectionLookup)
        if (index === sectionIndex) return item
        if (section && index < 0) {
            const [id] = book.splitTOCHref?.(item.href) ?? [item.href]
            if (id === section.id) return item
        }
    }

    return null
}

export function isSameTOCItem(item: TOCItem, activeItem: TOCItem | null): boolean {
    if (!activeItem) return false
    if (item === activeItem) return true

    const itemHref = normalizeTOCHref(item.href)
    const activeHref = normalizeTOCHref(activeItem.href)
    if (!itemHref || !activeHref) return false
    return itemHref === activeHref
}
