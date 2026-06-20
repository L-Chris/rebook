import { resolveRebookPlugins, type RebookExtensionHost, type RebookPluginLike } from './extensions'
import type { Book } from './types'

export async function applyRebookPlugins(
    book: Book,
    plugins: readonly RebookPluginLike[] | undefined,
    host?: RebookExtensionHost,
): Promise<Book> {
    let current = book
    for (const plugin of await resolveRebookPlugins(plugins, host)) {
        current = await plugin(current)
    }
    return current
}
