/**
 * Parser interface.
 *
 * A parser takes raw input (File, Blob, URL, ArrayBuffer) and produces
 * a Book object that can be consumed by any renderer.
 */

import type { Book } from './types'

/**
 * Input types accepted by parsers.
 */
export type ParserInput = File | Blob | string | ArrayBuffer

/**
 * Options that can be passed to a parser.
 */
export interface ParserOptions {
    /**
     * Custom SHA-1 function for font deobfuscation (EPUB).
     * If not provided, uses Web Crypto (requires secure context).
     */
    sha1?: (data: ArrayBuffer) => Promise<ArrayBuffer>

    /**
     * Called during parsing to report progress.
     */
    onProgress?: (progress: number, message?: string) => void

    /**
     * DOM adapter for XML/HTML parsing.
     * If not provided, uses browser DOMParser (browser-only).
     */
    domAdapter?: import('./dom-adapter').DOMAdapter

    /**
     * URL factory for creating resource URLs.
     * If not provided, uses URL.createObjectURL (browser-only).
     */
    urlFactory?: import('./url-factory').URLFactory
}

/**
 * The Parser interface.
 * Implement this to add support for a new e-book format.
 */
export interface Parser {
    /**
     * Parse the input and return a Book object.
     */
    parse(input: ParserInput, options?: ParserOptions): Promise<Book>

    /**
     * Check if this parser can handle the given input.
     * Returns true if the format is recognized.
     */
    canParse(input: ParserInput): Promise<boolean> | boolean
}

/**
 * A parser factory is a function that creates parser instances.
 * Used for registration with the auto-detection system.
 */
export type ParserFactory = () => Parser

/**
 * Registry of parsers for auto-detection.
 */
class ParserRegistry {
    private parsers: Map<string, ParserFactory> = new Map()

    /**
     * Register a parser with a name.
     */
    register(name: string, factory: ParserFactory): void {
        this.parsers.set(name, factory)
    }

    /**
     * Unregister a parser.
     */
    unregister(name: string): void {
        this.parsers.delete(name)
    }

    /**
     * Get a parser by name.
     */
    get(name: string): Parser | undefined {
        const factory = this.parsers.get(name)
        return factory?.()
    }

    /**
     * Auto-detect the format and return a suitable parser.
     */
    async detect(input: ParserInput): Promise<Parser | null> {
        for (const [, factory] of this.parsers) {
            const parser = factory()
            if (await parser.canParse(input)) {
                return parser
            }
        }
        return null
    }

    /**
     * Auto-detect, parse, and return a Book.
     */
    async open(input: ParserInput, options?: ParserOptions): Promise<Book> {
        const parser = await this.detect(input)
        if (!parser) {
            throw new Error('Unsupported file format')
        }
        return parser.parse(input, options)
    }

    /**
     * List all registered parser names.
     */
    list(): string[] {
        return Array.from(this.parsers.keys())
    }
}

/**
 * Global parser registry.
 */
export const registry = new ParserRegistry()
