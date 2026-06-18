import type { Book } from './core/types'
import {
    getReadableContent,
    getReadableContentText,
    getReadableContentUnits,
    type ReadableContentBlock,
    type ReadableContentUnit,
    type ReadableContentUnitKind,
} from './core/readable-content'

export type SearchScope = 'book' | 'unit'

export interface SearchOptions {
    /** Search all readable units or one selected unit. Defaults to 'book'. */
    scope?: SearchScope
    /** Readable unit index used when scope is 'unit'. */
    unitIndex?: number
    /** Search only these readable unit indexes. Overrides scope/unitIndex. */
    unitIndexes?: readonly number[]
    /** Defaults to false. */
    caseSensitive?: boolean
    /** Match whole words only. Defaults to false. */
    wholeWord?: boolean
    /** Maximum result count. Defaults to 100. */
    maxResults?: number
    /** Number of context characters on each side. Defaults to 48. */
    contextChars?: number
}

export interface SearchResult {
    query: string
    unitIndex: number
    unitId: string | number
    unitKind: ReadableContentUnitKind
    unitTitle?: string
    sectionIndex?: number
    pageIndex?: number
    blockId?: string
    blockType?: string
    matchIndex: number
    start: number
    end: number
    excerpt: string
    before: string
    match: string
    after: string
}

export interface ContentUnitSearchResult {
    unitIndex: number
    unitId: string | number
    unitKind: ReadableContentUnitKind
    unitTitle?: string
    sectionIndex?: number
    pageIndex?: number
    results: SearchResult[]
}

interface UnitSearchText {
    unit: ReadableContentUnit
    block?: ReadableContentBlock
    text: string
}

/**
 * Search a book's readable content. Reflowable books search sections; fixed
 * documents search pages that expose text.
 */
export async function searchBook(
    book: Book,
    query: string,
    options: SearchOptions = {},
): Promise<SearchResult[]> {
    const normalizedQuery = options.caseSensitive ? query : query.toLocaleLowerCase()
    if (!normalizedQuery) return []

    const maxResults = Math.max(0, Math.floor(options.maxResults ?? 100))
    if (maxResults === 0) return []

    const units = await getSearchableUnits(book, options)
    const results: SearchResult[] = []
    const matchIndexes = new Map<number, number>()

    for (const item of units) {
        const haystack = options.caseSensitive ? item.text : item.text.toLocaleLowerCase()
        let fromIndex = 0

        while (results.length < maxResults) {
            const index = haystack.indexOf(normalizedQuery, fromIndex)
            if (index < 0) break
            const end = index + query.length
            fromIndex = Math.max(index + 1, end)

            if (options.wholeWord && !isWholeWordMatch(item.text, index, end)) continue

            const matchIndex = matchIndexes.get(item.unit.index) ?? 0
            matchIndexes.set(item.unit.index, matchIndex + 1)
            results.push(createSearchResult(item, query, index, end, matchIndex, options.contextChars ?? 48))
        }

        if (results.length >= maxResults) break
    }

    return results
}

/**
 * Search every readable content unit and return grouped results.
 */
export async function searchContentUnits(
    book: Book,
    query: string,
    options: Omit<SearchOptions, 'scope' | 'unitIndex' | 'unitIndexes'> = {},
): Promise<ContentUnitSearchResult[]> {
    const groups: ContentUnitSearchResult[] = []
    const units = getReadableContentUnits(book)

    for (const unit of units) {
        const results = await searchBook(book, query, {
            ...options,
            scope: 'unit',
            unitIndex: unit.index,
        })
        if (!results.length) continue
        groups.push({
            unitIndex: unit.index,
            unitId: unit.id,
            unitKind: unit.kind,
            unitTitle: unit.title,
            sectionIndex: unit.sectionIndex,
            pageIndex: unit.pageIndex,
            results,
        })
    }

    return groups
}

function createSearchResult(
    item: UnitSearchText,
    query: string,
    start: number,
    end: number,
    matchIndex: number,
    contextChars: number,
): SearchResult {
    const contextStart = Math.max(0, start - Math.max(0, contextChars))
    const contextEnd = Math.min(item.text.length, end + Math.max(0, contextChars))
    const before = item.text.slice(contextStart, start)
    const match = item.text.slice(start, end)
    const after = item.text.slice(end, contextEnd)

    return {
        query,
        unitIndex: item.unit.index,
        unitId: item.unit.id,
        unitKind: item.unit.kind,
        unitTitle: item.unit.title,
        sectionIndex: item.unit.sectionIndex,
        pageIndex: item.unit.pageIndex,
        blockId: item.block?.id,
        blockType: item.block?.type,
        matchIndex,
        start,
        end,
        before,
        match,
        after,
        excerpt: `${contextStart > 0 ? '...' : ''}${before}${match}${after}${contextEnd < item.text.length ? '...' : ''}`,
    }
}

async function getSearchableUnits(book: Book, options: SearchOptions): Promise<UnitSearchText[]> {
    const units = getSearchUnits(book, options)
    const chunks: UnitSearchText[] = []
    for (const unit of units) {
        const content = await getReadableContent(book, unit.index, { includeBlocks: true })
        if (content.blocks?.length) {
            chunks.push(...content.blocks.map(block => ({ unit, block, text: block.text })))
            continue
        }
        chunks.push({ unit, text: await getReadableContentText(book, unit) })
    }
    return chunks
}

function getSearchUnits(book: Book, options: SearchOptions): ReadableContentUnit[] {
    const units = getReadableContentUnits(book)
    if (options.unitIndexes) return uniqueValidUnits(units, options.unitIndexes)
    if (options.scope === 'unit') return uniqueValidUnits(units, [options.unitIndex ?? 0])
    return units
}

function uniqueValidUnits(units: readonly ReadableContentUnit[], indexes: readonly number[]): ReadableContentUnit[] {
    const byIndex = new Map(units.map(unit => [unit.index, unit]))
    return [...new Set(indexes)]
        .map(index => Math.floor(index))
        .map(index => byIndex.get(index))
        .filter((unit): unit is ReadableContentUnit => Boolean(unit))
}

function isWholeWordMatch(text: string, start: number, end: number): boolean {
    return !isWordCharacter(text[start - 1]) && !isWordCharacter(text[end])
}

function isWordCharacter(value: string | undefined): boolean {
    return Boolean(value && /[\p{L}\p{N}_]/u.test(value))
}
