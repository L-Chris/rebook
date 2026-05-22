/**
 * High-level view that ties together a parser and a renderer.
 * Provides a simple API for opening and reading books.
 */

import type { Book, RelocateEvent, LoadEvent, TOCItem } from '../../core/types'
import type { ParserInput, ParserOptions } from '../../core/parser'
import type { RendererConfig, RendererStyles, LayoutMode, Renderer } from '../../core/renderer'
import { registry } from '../../core/parser'
import { BrowserRenderer } from './paginator'
import { BrowserDOMAdapter, BrowserURLFactory } from '../../adapters/browser'

// ============================================================================
// Reader View
// ============================================================================

export interface ReaderConfig extends Omit<RendererConfig, 'container'> {
    /** Container element */
    container: HTMLElement
    /** Parser options */
    parserOptions?: ParserOptions
    /** Auto-register default parsers */
    autoRegister?: boolean
}

/**
 * High-level reader that combines parsing and rendering.
 */
export class ReaderView {
    private renderer: Renderer
    private book: Book | null = null
    private config: ReaderConfig

    constructor(config: ReaderConfig) {
        this.config = config
        this.renderer = new BrowserRenderer(config)
    }

    /**
     * Open a book from a file, URL, or blob.
     */
    async open(input: ParserInput): Promise<Book> {
        this.close()

        // Auto-wire browser adapters if not provided
        const options: ParserOptions = {
            domAdapter: new BrowserDOMAdapter(),
            urlFactory: new BrowserURLFactory(),
            ...this.config.parserOptions,
        }

        // Use registry to auto-detect and parse
        const book = await registry.open(input, options)
        this.book = book

        // Open in renderer
        await this.renderer.open(book)

        return book
    }

    /**
     * Open an already-parsed book.
     */
    async openBook(book: Book): Promise<void> {
        this.close()
        this.book = book
        await this.renderer.open(book)
    }

    /**
     * Get the current book.
     */
    getBook(): Book | null {
        return this.book
    }

    /**
     * Get book metadata.
     */
    getMetadata() {
        return this.book?.metadata
    }

    /**
     * Get table of contents.
     */
    getTOC(): readonly TOCItem[] | undefined {
        return this.book?.toc
    }

    /**
     * Navigate to a location.
     */
    async goTo(target: number | string): Promise<void> {
        await this.renderer.goTo(target)
    }

    /**
     * Go to next page.
     */
    async next(): Promise<void> {
        await this.renderer.next()
    }

    /**
     * Go to previous page.
     */
    async prev(): Promise<void> {
        await this.renderer.prev()
    }

    /**
     * Navigate right (respects RTL).
     */
    async goRight(): Promise<void> {
        if (this.book?.dir === 'rtl') {
            await this.prev()
        } else {
            await this.next()
        }
    }

    /**
     * Navigate left (respects RTL).
     */
    async goLeft(): Promise<void> {
        if (this.book?.dir === 'rtl') {
            await this.next()
        } else {
            await this.prev()
        }
    }

    /**
     * Navigate by fraction (0-1).
     */
    async goToFraction(fraction: number): Promise<void> {
        await this.renderer.goToFraction(fraction)
    }

    /**
     * Get section fractions for progress bar.
     */
    getSectionFractions(): number[] {
        return this.renderer.getSectionFractions()
    }

    /**
     * Get current reading location.
     */
    getLocation(): RelocateEvent | null {
        return this.renderer.getLocation()
    }

    /**
     * Update styles.
     */
    setStyles(styles: RendererStyles): void {
        this.renderer.setStyles(styles)
    }

    /**
     * Set layout mode.
     */
    setLayout(mode: LayoutMode): void {
        this.renderer.setLayout(mode)
    }

    /**
     * Register an event listener.
     */
    on(event: 'load', listener: (e: LoadEvent) => void): void
    on(event: 'relocate', listener: (e: RelocateEvent) => void): void
    on(event: 'link', listener: (e: { href: string; external: boolean }) => void): void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on(event: string, listener: (e: any) => void): void {
        this.renderer.on(event, listener as (e: unknown) => void)
    }

    /**
     * Remove an event listener.
     */
    off(event: string, listener: (e: unknown) => void): void {
        this.renderer.off(event, listener)
    }

    /**
     * Close the current book and clean up.
     */
    close(): void {
        this.book?.destroy?.()
        this.book = null
    }

    /**
     * Destroy the reader and release all resources.
     */
    destroy(): void {
        this.close()
        this.renderer.destroy()
    }
}

/**
 * Create a new ReaderView instance.
 */
export const createReader = (config: ReaderConfig): ReaderView => {
    return new ReaderView(config)
}
