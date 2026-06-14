import type { BookRange, TextChunk, TextProvider, TextSearchResult } from './location'

export interface StaticTextProviderOptions {
    filterChunk?(chunk: TextChunk, range: BookRange): boolean
    getRange?(chunk: TextChunk, index: number): BookRange | null | undefined
}

export function createStaticTextProvider(
    chunks: readonly TextChunk[] | (() => readonly TextChunk[]),
    options: StaticTextProviderOptions = {},
): TextProvider {
    const getChunks = () => typeof chunks === 'function' ? chunks() : chunks
    return {
        getText(range?: BookRange) {
            const items = getChunks()
            return range && options.filterChunk
                ? items.filter(chunk => options.filterChunk!(chunk, range))
                : items
        },
        search(query: string, range?: BookRange) {
            const items = getChunks()
            const scoped = range && options.filterChunk
                ? items.filter(chunk => options.filterChunk!(chunk, range))
                : items
            return searchTextChunks(scoped, query, options.getRange)
        },
    }
}

export function searchTextChunks(
    chunks: readonly TextChunk[],
    query: string,
    getRange: (chunk: TextChunk, index: number) => BookRange | null | undefined = defaultChunkRange,
): TextSearchResult[] {
    const needle = query.trim().toLocaleLowerCase()
    if (!needle) return []

    const results: TextSearchResult[] = []
    for (let index = 0; index < chunks.length; index++) {
        const chunk = chunks[index]
        if (!chunk.text.toLocaleLowerCase().includes(needle)) continue
        const range = getRange(chunk, index)
        if (range) results.push({ chunk, range, score: 1 })
    }
    return results
}

function defaultChunkRange(chunk: TextChunk): BookRange | null {
    return chunk.location ? { start: chunk.location } : null
}
