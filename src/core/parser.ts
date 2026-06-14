/**
 * Parser interface.
 *
 * A parser takes raw input (File, Blob, URL, ArrayBuffer) and produces
 * a Book object that can be consumed by any renderer.
 */

import type { Book } from './types'
import { UnsupportedFormatError } from './errors'

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

    /**
     * Priority for auto-detection (higher = checked first).
     * Default is 0. Use higher values for more specific formats.
     * For example, EPUB (10) should be checked before generic ZIP-based formats like CBZ (0).
     */
    priority?: number
}

/**
 * A parser factory is a function that creates parser instances.
 * Used for registration with the auto-detection system.
 */
export type ParserFactory = () => Parser

/**
 * Registry of parsers for auto-detection.
 */
export class ParserRegistry {
    private parsers: Map<string, { factory: ParserFactory; priority: number }> = new Map()

    /**
     * Register a parser with a name.
     * @param name - Parser name
     * @param factory - Factory function to create parser instances
     * @param priority - Detection priority (higher = checked first).
     *                   If not provided, uses parser.priority or defaults to 0.
     */
    register(name: string, factory: ParserFactory, priority?: number): void {
        const effectivePriority = priority ?? factory().priority ?? 0
        this.parsers.set(name, { factory, priority: effectivePriority })
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
        const entry = this.parsers.get(name)
        return entry?.factory()
    }

    /**
     * Auto-detect the format and return a suitable parser.
     * Parsers are checked in priority order (highest first).
     */
    async detect(input: ParserInput): Promise<Parser | null> {
        // Sort by priority (highest first)
        const sorted = Array.from(this.parsers.entries())
            .sort(([, a], [, b]) => b.priority - a.priority)

        for (const [, { factory }] of sorted) {
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
            throw new UnsupportedFormatError()
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
