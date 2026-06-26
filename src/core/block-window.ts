import type { BlockWindowConsumer, Book } from './types'

export function getBlockWindowConsumers(book: unknown): readonly BlockWindowConsumer[] {
    const value = (book as { blockWindowConsumers?: unknown } | null | undefined)?.blockWindowConsumers
    if (!Array.isArray(value)) return []
    return value.filter(isBlockWindowConsumer)
}

export function getBlockWindowPrefetchPageCount(book: unknown): number {
    return getBlockWindowConsumers(book).reduce((max, consumer) => {
        return Math.max(max, normalizeBlockWindowPageCount(consumer.pageCount))
    }, 0)
}

export function appendBlockWindowConsumer(book: Book, consumer: BlockWindowConsumer): readonly BlockWindowConsumer[] {
    return [...getBlockWindowConsumers(book), consumer]
}

export function normalizeBlockWindowPageCount(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value)
        ? Math.max(0, Math.floor(value))
        : 0
}

function isBlockWindowConsumer(value: unknown): value is BlockWindowConsumer {
    return !!value && typeof value === 'object' && typeof (value as BlockWindowConsumer).onBlockWindow === 'function'
}
