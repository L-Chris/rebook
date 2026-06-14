import { describe, expect, it } from 'vitest'
import { ParserRegistry } from '../../src/core/parser'
import { builtInParsers, registerBuiltInParsers } from '../../src/parsers/builtins'
import { makeSimplePdf } from '../fixtures/pdf-fixture'

describe('built-in parser registration', () => {
    it('registers all built-in formats including PDF', async () => {
        const registry = new ParserRegistry()
        registerBuiltInParsers(registry)

        expect(registry.list()).toEqual(builtInParsers.map(parser => parser.name))

        const book = await registry.open(makeSimplePdf().buffer)
        expect(book.fixedDocument?.format).toBe('pdf')
    })
})
