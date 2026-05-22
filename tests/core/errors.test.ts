/**
 * Core module unit tests - Errors and Registry
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
    EBookError,
    ParseError,
    UnsupportedFormatError,
    CorruptedFileError,
    AdapterRequiredError,
    UnsupportedInputError,
} from '../../src/core/errors'
import { registry, type Parser, type ParserInput, type ParserOptions } from '../../src/core/parser'
import type { Book } from '../../src/core/types'

describe('Error types', () => {
    describe('EBookError', () => {
        it('should be an instance of Error', () => {
            const err = new EBookError('test', 'TEST_CODE')
            expect(err).toBeInstanceOf(Error)
            expect(err).toBeInstanceOf(EBookError)
        })

        it('should have correct properties', () => {
            const err = new EBookError('test message', 'TEST_CODE')
            expect(err.message).toBe('test message')
            expect(err.code).toBe('TEST_CODE')
            expect(err.name).toBe('EBookError')
        })
    })

    describe('ParseError', () => {
        it('should extend EBookError', () => {
            const err = new ParseError('parse failed', 'epub')
            expect(err).toBeInstanceOf(EBookError)
            expect(err).toBeInstanceOf(ParseError)
        })

        it('should have correct properties', () => {
            const err = new ParseError('parse failed', 'epub')
            expect(err.message).toBe('parse failed')
            expect(err.code).toBe('PARSE_ERROR')
            expect(err.format).toBe('epub')
            expect(err.name).toBe('ParseError')
        })
    })

    describe('UnsupportedFormatError', () => {
        it('should have default message', () => {
            const err = new UnsupportedFormatError()
            expect(err.message).toBe('Unsupported file format')
            expect(err.code).toBe('UNSUPPORTED_FORMAT')
        })

        it('should accept custom message', () => {
            const err = new UnsupportedFormatError('Custom message')
            expect(err.message).toBe('Custom message')
        })
    })

    describe('CorruptedFileError', () => {
        it('should have correct properties', () => {
            const err = new CorruptedFileError('file is corrupted', 'mobi')
            expect(err.message).toBe('file is corrupted')
            expect(err.code).toBe('CORRUPTED_FILE')
            expect(err.format).toBe('mobi')
        })
    })

    describe('AdapterRequiredError', () => {
        it('should format message with adapter name', () => {
            const err = new AdapterRequiredError('domAdapter')
            expect(err.message).toBe('domAdapter is required but was not provided in ParserOptions')
            expect(err.code).toBe('ADAPTER_REQUIRED')
        })
    })

    describe('UnsupportedInputError', () => {
        it('should have default message', () => {
            const err = new UnsupportedInputError()
            expect(err.message).toBe('Input type not supported')
            expect(err.code).toBe('UNSUPPORTED_INPUT')
        })
    })
})

describe('Parser Registry', () => {
    // Create mock parsers for testing
    const createMockParser = (name: string, canParseResult: boolean, priority = 0): Parser => ({
        priority,
        canParse: () => canParseResult,
        parse: async () => ({ sections: [], metadata: {} } as Book),
    })

    beforeEach(() => {
        // Clear registry before each test
        for (const name of registry.list()) {
            registry.unregister(name)
        }
    })

    describe('register/unregister', () => {
        it('should register and list parsers', () => {
            registry.register('test1', () => createMockParser('test1', true))
            registry.register('test2', () => createMockParser('test2', true))
            expect(registry.list()).toContain('test1')
            expect(registry.list()).toContain('test2')
        })

        it('should unregister parsers', () => {
            registry.register('test', () => createMockParser('test', true))
            expect(registry.list()).toContain('test')
            registry.unregister('test')
            expect(registry.list()).not.toContain('test')
        })
    })

    describe('get', () => {
        it('should return parser by name', () => {
            registry.register('test', () => createMockParser('test', true))
            const parser = registry.get('test')
            expect(parser).toBeDefined()
        })

        it('should return undefined for unknown parser', () => {
            expect(registry.get('unknown')).toBeUndefined()
        })
    })

    describe('detect', () => {
        it('should return first matching parser', async () => {
            registry.register('no', () => createMockParser('no', false))
            registry.register('yes', () => createMockParser('yes', true))
            const parser = await registry.detect('test.epub')
            expect(parser).toBeDefined()
        })

        it('should return null if no parser matches', async () => {
            registry.register('no', () => createMockParser('no', false))
            const parser = await registry.detect('test.xyz')
            expect(parser).toBeNull()
        })

        it('should check parsers in priority order (highest first)', async () => {
            const order: string[] = []
            const trackingParser = (name: string, result: boolean, priority: number): Parser => ({
                priority,
                canParse: () => {
                    order.push(name)
                    return result
                },
                parse: async () => ({ sections: [], metadata: {} } as Book),
            })

            registry.register('low', () => trackingParser('low', true, 0))
            registry.register('high', () => trackingParser('high', true, 10))
            registry.register('medium', () => trackingParser('medium', true, 5))

            const parser = await registry.detect('test')
            expect(order[0]).toBe('high') // Highest priority checked first
            expect(parser?.priority).toBe(10)
        })

        it('should skip non-matching high-priority parsers', async () => {
            registry.register('high-no', () => createMockParser('high-no', false, 10))
            registry.register('low-yes', () => createMockParser('low-yes', true, 0))

            const parser = await registry.detect('test')
            expect(parser?.priority).toBe(0)
        })
    })

    describe('open', () => {
        it('should throw UnsupportedFormatError if no parser matches', async () => {
            registry.register('no', () => createMockParser('no', false))
            await expect(registry.open('test.xyz')).rejects.toThrow(UnsupportedFormatError)
        })

        it('should detect and parse with matching parser', async () => {
            const mockBook = { sections: [{ id: 'test' }], metadata: { title: 'Test' } } as Book
            registry.register('test', () => ({
                priority: 0,
                canParse: () => true,
                parse: async () => mockBook,
            }))

            const book = await registry.open('test.epub')
            expect(book.metadata?.title).toBe('Test')
        })
    })
})
