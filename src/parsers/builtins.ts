import type { ParserFactory, ParserRegistry } from '../core/parser'
import { registry } from '../core/parser'
import { cbz } from './cbz'
import { epub } from './epub'
import { fb2 } from './fb2'
import { mobi } from './mobi'
import { pdf } from './pdf'

export type BuiltInParserName = 'epub' | 'mobi' | 'fb2' | 'pdf' | 'cbz'

export interface BuiltInParserEntry {
    readonly name: BuiltInParserName
    readonly factory: ParserFactory
}

export const builtInParsers: readonly BuiltInParserEntry[] = [
    { name: 'epub', factory: epub },
    { name: 'mobi', factory: mobi },
    { name: 'fb2', factory: fb2 },
    { name: 'pdf', factory: pdf },
    { name: 'cbz', factory: cbz },
]

export function registerBuiltInParsers(target: Pick<ParserRegistry, 'register'> = registry): void {
    for (const parser of builtInParsers) {
        target.register(parser.name, parser.factory)
    }
}
