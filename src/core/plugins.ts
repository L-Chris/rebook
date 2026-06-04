import type { Book, RebookPlugin } from './types'

export async function applyRebookPlugins(
    book: Book,
    plugins: readonly RebookPlugin[] | undefined,
): Promise<Book> {
    let current = book
    for (const plugin of plugins ?? []) {
        current = await plugin(current)
    }
    return current
}
