/**
 * Platform-neutral reader session.
 *
 * ReaderSession owns parsing, plugins, book lifecycle, navigation helpers, and
 * event rebinding. Platform packages provide renderer factories and parser
 * adapters.
 */

import type { BlockWindowEvent, Book, LinkEvent, LoadEvent, RelocateEvent, RebookPlugin, TOCItem } from './types'
import type { ParserInput, ParserOptions } from './parser'
import type { LayoutMode, NavigationDirection, Renderer, RendererNavigationHooks, RendererStyles } from './renderer'
import type { TrialLimitController, TrialTOCAccessItem } from '../plugins/trial-limit'
import { registry } from './parser'
import { applyRebookPlugins } from './plugins'
import {
    searchBook,
    searchChapters as searchBookChapters,
    type ChapterSearchResult,
    type SearchOptions,
    type SearchResult,
} from '../search'

export interface ReaderSessionConfig {
    /** Create a renderer instance for the current platform. */
    createRenderer: (hooks?: RendererNavigationHooks) => Renderer
    /** Parser options, including platform adapters. */
    parserOptions?: ParserOptions | (() => ParserOptions)
    /** Plugins to transform the book before rendering. */
    plugins?: readonly RebookPlugin[]
}

export interface TOCViewItem {
    item: TOCItem
    key: string
    index: number
    label: string
    href: string
    depth: number
    parentHrefs: string[]
    hasChildren: boolean
    sectionIndex: number
    sectionFraction: number
    disabled: boolean
    active: boolean
}

export interface TOCViewOptions {
    items?: readonly TOCItem[]
    location?: RelocateEvent | null
}

/**
 * High-level reader API shared by browser and Mini Program hosts.
 */
export class ReaderSession {
    private renderer: Renderer
    private book: Book | null = null
    private config: ReaderSessionConfig
    private registeredListeners: Array<{
        event: string
        listener: (e: any) => void
        wrappedListener: (e: any) => void
    }> = []

    constructor(config: ReaderSessionConfig) {
        this.config = config
        this.renderer = this.createRenderer()
    }

    /**
     * Open a book from a file, URL, Blob, or ArrayBuffer.
     */
    async open(input: ParserInput): Promise<Book> {
        this.close()
        this.resetRenderer()

        const book = await applyRebookPlugins(
            await registry.open(input, this.getParserOptions()),
            this.config.plugins,
        )

        this.book = book
        await this.renderer.open(book)
        return book
    }

    /**
     * Open an already-parsed book.
     */
    async openBook(inputBook: Book): Promise<void> {
        this.close()
        this.resetRenderer()

        const book = await applyRebookPlugins(inputBook, this.config.plugins)

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
     * Search the current book's readable text.
     */
    async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
        if (!this.book) return []
        return searchBook(this.book, query, options)
    }

    /**
     * Search the current book and group matches by chapter.
     */
    async searchChapters(
        query: string,
        options: Omit<SearchOptions, 'scope' | 'chapterIndex' | 'sectionIndexes'> = {},
    ): Promise<ChapterSearchResult[]> {
        if (!this.book) return []
        return searchBookChapters(this.book, query, options)
    }

    /**
     * Get the current book's trial policy controller, if installed.
     */
    getTrialLimit(): TrialLimitController | null {
        return (this.book as (Book & { trialLimit?: TrialLimitController }) | null)?.trialLimit ?? null
    }

    /**
     * Check whether the current trial policy allows navigation to a target.
     * Books without a trial policy are unrestricted.
     */
    canGoTo(target: string | number): boolean {
        const trialLimit = this.getTrialLimit()
        if (!trialLimit) return true
        return trialLimit.canGoTo(target, this.getSectionFractions())
    }

    /**
     * Check whether the current trial policy allows moving to the next page.
     * Books without a trial policy are unrestricted.
     */
    canGoNext(): boolean {
        const trialLimit = this.getTrialLimit()
        if (!trialLimit) return true
        return trialLimit.canGoNext(this.getLocation(), this.getSectionFractions())
    }

    /**
     * Get trial-aware TOC items for the current book.
     */
    getTrialTOCItems(items?: readonly TOCItem[]): TrialTOCAccessItem[] {
        const trialLimit = this.getTrialLimit()
        if (!trialLimit) return []
        return trialLimit.getTOCItems(this.getSectionFractions(), items)
    }

    /**
     * Get TOC hrefs allowed by the current trial policy.
     */
    getAllowedTOCHrefs(): string[] {
        const trialLimit = this.getTrialLimit()
        if (!trialLimit) return flattenTOC(this.getTOC() ?? []).map(item => normalizeNavigationHref(item.href))
        return trialLimit.getAllowedTOCHrefs(this.getSectionFractions())
    }

    /**
     * Get the current trial-aware TOC item for the reader location.
     */
    getCurrentTrialTOCItem(items = this.getTrialTOCItems()): TrialTOCAccessItem | null {
        const trialLimit = this.getTrialLimit()
        if (!trialLimit) return null
        return trialLimit.getCurrentTOCItem(items, this.getLocation())
    }

    /**
     * Get flattened TOC items ready for reader UI rendering.
     *
     * The returned items include active and trial-disabled state so hosts do not
     * need to duplicate href matching or trial policy logic.
     */
    getTOCViewItems(options: TOCViewOptions = {}): TOCViewItem[] {
        if (!this.book) return []

        const items = options.items ?? this.book.toc ?? []
        if (!items.length) return []

        const location = options.location === undefined ? this.getLocation() : options.location
        const sectionFractions = this.getSectionFractions()
        const trialLimit = this.getTrialLimit()

        if (trialLimit) {
            const trialItems = trialLimit.getTOCItems(sectionFractions, items)
            const activeItem = trialLimit.getCurrentTOCItem(trialItems, location)
            return trialItems.map(item => ({
                ...item,
                active: isSameTOCItem(item.item, activeItem?.item ?? null),
            }))
        }

        const activeItem = this.getCurrentTOCItem(location)
        return flattenTOCViewItems(this.book, items, sectionFractions, activeItem)
    }

    /**
     * Navigate to a location.
     */
    async goTo(target: number | string): Promise<void> {
        if (!this.canGoTo(target)) return
        await this.renderer.goTo(target)
    }

    /**
     * Go to next page.
     */
    async next(): Promise<void> {
        if (!this.canGoNext()) return
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
     * Reload the current section while preserving the current reading position.
     */
    async refresh(): Promise<void> {
        await this.renderer.refresh()
    }

    /**
     * Get current reading location.
     */
    getLocation(): RelocateEvent | null {
        const location = this.renderer.getLocation()
        if (location && location.tocItem === undefined) {
            location.tocItem = this.getCurrentTOCItem(location)
        }
        return location
    }

    /**
     * Get current TOC item based on location.
     */
    getCurrentTOCItem(location?: RelocateEvent | null): TOCItem | null {
        if (!this.book || !this.book.toc) return null
        const loc = location ?? this.getLocation()
        if (!loc) return null
        if (loc.tocItem !== undefined) return loc.tocItem

        let activeItem: TOCItem | null = null
        let maxIndex = -1

        const checkItem = (item: TOCItem) => {
            if (this.book!.splitTOCHref) {
                try {
                    const parts = this.book!.splitTOCHref(item.href)
                    if (parts && Array.isArray(parts)) {
                        const [id] = parts
                        const index = this.book!.sections.findIndex(s => s.id === id)
                        if (index >= 0 && index <= loc.index && index >= maxIndex) {
                            maxIndex = index
                            activeItem = item
                        }
                    }
                } catch (e) {
                    console.error('Error in splitTOCHref:', e)
                }
            }
            if (item.subitems) {
                for (const sub of item.subitems) checkItem(sub)
            }
        }

        for (const item of this.book.toc) {
            checkItem(item)
        }
        return activeItem
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
     * Set maximum number of visible columns (pages).
     */
    setSpread(maxColumns: number): void {
        this.renderer.setSpread(maxColumns)
    }

    /**
     * Register an event listener.
     */
    on(event: 'load', listener: (e: LoadEvent) => void): void
    on(event: 'relocate', listener: (e: RelocateEvent) => void): void
    on(event: 'link', listener: (e: LinkEvent) => void): void
    on(event: 'block-window', listener: (e: BlockWindowEvent) => void): void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on(event: string, listener: (e: any) => void): void {
        let wrappedListener = listener
        if (event === 'relocate') {
            wrappedListener = (e: RelocateEvent) => {
                if (e.tocItem === undefined) e.tocItem = this.getCurrentTOCItem(e)
                listener(e)
            }
        }

        this.renderer.on(event, wrappedListener)
        this.registeredListeners.push({ event, listener, wrappedListener })
    }

    /**
     * Remove an event listener.
     */
    off(event: string, listener: (e: unknown) => void): void {
        const index = this.registeredListeners.findIndex(
            item => item.event === event && item.listener === listener,
        )
        if (index >= 0) {
            const { wrappedListener } = this.registeredListeners[index]
            this.renderer.off(event, wrappedListener)
            this.registeredListeners.splice(index, 1)
        }
    }

    /**
     * Close the current book and clean up book resources.
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
        this.registeredListeners = []
    }

    protected getRenderer(): Renderer {
        return this.renderer
    }

    private createRenderer(): Renderer {
        return this.config.createRenderer({
            beforeNavigate: direction => this.canNavigate(direction),
        })
    }

    private canNavigate(direction: NavigationDirection): boolean {
        if (direction === 'next') return this.canGoNext()
        return true
    }

    private resetRenderer(): void {
        this.renderer.destroy()
        this.renderer = this.createRenderer()
        for (const item of this.registeredListeners) {
            this.renderer.on(item.event, item.wrappedListener)
        }
    }

    private getParserOptions(): ParserOptions | undefined {
        return typeof this.config.parserOptions === 'function'
            ? this.config.parserOptions()
            : this.config.parserOptions
    }
}

function flattenTOC(items: readonly TOCItem[]): TOCItem[] {
    return items.flatMap(item => item.subitems?.length ? [item, ...flattenTOC(item.subitems)] : [item])
}

function flattenTOCViewItems(
    book: Book,
    items: readonly TOCItem[],
    sectionFractions: readonly number[],
    activeItem: TOCItem | null,
): TOCViewItem[] {
    const result: TOCViewItem[] = []
    let index = 0

    const walk = (tocItems: readonly TOCItem[], depth: number, parentHrefs: string[]) => {
        for (const item of tocItems) {
            const itemIndex = index++
            const sectionIndex = resolveTOCSectionIndex(book, item.href)
            const sectionFraction = sectionIndex >= 0 ? sectionFractions[sectionIndex] ?? 0 : 0
            const hasChildren = !!item.subitems?.length
            result.push({
                item,
                key: `${depth}-${itemIndex}-${item.href}`,
                index: itemIndex,
                label: item.label || 'Untitled',
                href: item.href,
                depth,
                parentHrefs,
                hasChildren,
                sectionIndex,
                sectionFraction,
                disabled: false,
                active: isSameTOCItem(item, activeItem),
            })

            if (hasChildren) {
                walk(item.subitems!, depth + 1, [...parentHrefs, item.href])
            }
        }
    }

    walk(items, 0, [])
    return result
}

function isSameTOCItem(item: TOCItem, activeItem: TOCItem | null): boolean {
    if (!activeItem) return false
    if (item === activeItem) return true

    const itemHref = normalizeTOCHref(item.href)
    const activeHref = normalizeTOCHref(activeItem.href)
    if (!itemHref || !activeHref) return false
    if (itemHref === activeHref) return true

    if (activeHref.includes('#')) return false
    return normalizeNavigationHref(itemHref) === normalizeNavigationHref(activeHref)
}

function normalizeNavigationHref(href?: string | null): string {
    return normalizeTOCHref(href).split('#')[0]
}

function normalizeTOCHref(href?: string | null): string {
    return (href || '').trim()
}

function normalizeBookPath(href?: string | null): string {
    const path = normalizeNavigationHref(href).replace(/\\/g, '/').replace(/^\/+/, '')
    const parts: string[] = []
    for (const part of path.split('/')) {
        if (!part || part === '.') continue
        if (part === '..') parts.pop()
        else parts.push(part)
    }
    return parts.join('/')
}

function resolveTOCSectionIndex(book: Book, href: string): number {
    const resolved = book.resolveHref?.(href)
    if (typeof resolved?.index === 'number' && resolved.index >= 0) return resolved.index

    const parts = book.splitTOCHref?.(href)
    if (parts && Array.isArray(parts)) {
        const [id] = parts
        const sectionIndex = book.sections.findIndex(section => section.id === id)
        if (sectionIndex >= 0) return sectionIndex
    }

    const normalizedHref = normalizeBookPath(href)
    if (!normalizedHref) return -1

    return book.sections.findIndex(section => {
        const sectionId = normalizeBookPath(String(section.id ?? ''))
        return sectionId === normalizedHref || sectionId.endsWith(`/${normalizedHref}`)
    })
}
