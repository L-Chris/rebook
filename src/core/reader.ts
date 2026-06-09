/**
 * Platform-neutral reader session.
 *
 * ReaderSession owns parsing, plugins, book lifecycle, navigation helpers, and
 * event rebinding. Platform packages provide renderer factories and parser
 * adapters.
 */

import type { BlockWindowEvent, Book, LinkEvent, LoadEvent, RelocateEvent, RebookPlugin, TOCItem } from './types'
import type { ParserInput, ParserOptions } from './parser'
import type { LayoutMode, NavigationDirection, ReaderMark, Renderer, RendererNavigationHooks, RendererStyles } from './renderer'
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
    /** Stable key for rendering and expansion state. */
    id: string
    /** Display label. */
    label: string
    /** Opaque navigation target. Pass this to reader.goTo() or reader.canGoTo(). */
    target: string
    /** True when trial/access policy prevents navigation to this item. */
    disabled: boolean
    /** True when this item is the current reading location. */
    active: boolean
    /** Nested TOC items ready for recursive UI rendering. */
    children?: readonly TOCViewItem[]
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
     * Get TOC items ready for reader UI rendering.
     *
     * The returned tree includes active and trial-disabled state so hosts only
     * need to render labels and pass item.target back to goTo().
     */
    getTOCViewItems(options: TOCViewOptions = {}): TOCViewItem[] {
        if (!this.book) return []

        const items = options.items ?? this.book.toc ?? []
        if (!items.length) return []

        const location = normalizeTOCViewLocation(
            options.location === undefined ? this.getLocation() : options.location,
        )
        const sectionFractions = this.getSectionFractions()
        const trialLimit = this.getTrialLimit()

        if (trialLimit) {
            const trialItems = trialLimit.getTOCItems(sectionFractions, items)
            const activeItem = trialLimit.getCurrentTOCItem(trialItems, location)
            const trialByItem = new Map(trialItems.map(item => [item.item, item]))
            return createTOCViewTree(items, activeItem?.item ?? null, trialByItem)
        }

        const activeItem = this.getCurrentTOCItem(location)
        return createTOCViewTree(items, activeItem)
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
        const sectionLookup = createSectionIndexLookup(this.book)

        const checkItem = (item: TOCItem) => {
            try {
                const index = resolveTOCSectionIndex(this.book!, item.href, sectionLookup)
                if (index >= 0 && index < loc.index && index >= maxIndex) {
                    maxIndex = index
                    activeItem = item
                } else if (index === loc.index && maxIndex < loc.index) {
                    maxIndex = index
                    activeItem = item
                }
            } catch (e) {
                console.error('Error resolving TOC item:', e)
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
     * Add or replace a transient render mark such as the current TTS segment,
     * search hit, translation state, or annotation preview.
     */
    setMark(mark: ReaderMark): void {
        this.renderer.setMark(mark)
    }

    /**
     * Remove a render mark by id.
     */
    removeMark(id: string): void {
        this.renderer.removeMark(id)
    }

    /**
     * Clear render marks. When kind is provided, only marks of that kind are cleared.
     */
    clearMarks(kind?: string): void {
        this.renderer.clearMarks(kind)
    }

    /**
     * Get current render marks.
     */
    getMarks(): ReaderMark[] {
        return this.renderer.getMarks()
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

function createTOCViewTree(
    items: readonly TOCItem[],
    activeItem: TOCItem | null,
    trialByItem?: ReadonlyMap<TOCItem, TrialTOCAccessItem>,
): TOCViewItem[] {
    let index = 0

    const walk = (tocItems: readonly TOCItem[]): TOCViewItem[] => tocItems.map(item => {
        const itemIndex = index++
        const trialItem = trialByItem?.get(item)
        const children = item.subitems?.length ? walk(item.subitems) : undefined
        return {
            id: `${itemIndex}-${item.href}`,
            label: item.label || 'Untitled',
            target: trialItem?.href ?? item.href,
            disabled: trialItem?.disabled ?? false,
            active: isSameTOCItem(item, activeItem),
            children,
        }
    })

    return walk(items)
}

function isSameTOCItem(item: TOCItem, activeItem: TOCItem | null): boolean {
    if (!activeItem) return false
    if (item === activeItem) return true

    const itemHref = normalizeTOCHref(item.href)
    const activeHref = normalizeTOCHref(activeItem.href)
    if (!itemHref || !activeHref) return false
    return itemHref === activeHref
}

function normalizeNavigationHref(href?: string | null): string {
    return normalizeTOCHref(href).split('#')[0]
}

function normalizeTOCHref(href?: string | null): string {
    return (href || '').trim()
}

function normalizeTOCViewLocation(location: RelocateEvent | null): RelocateEvent | null {
    if (location?.tocItem !== null) return location
    return { ...location, tocItem: undefined }
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

interface SectionIndexLookup {
    byId: Map<string | number, number>
    byPath: Map<string, number>
}

function createSectionIndexLookup(book: Book): SectionIndexLookup {
    const byId = new Map<string | number, number>()
    const byPath = new Map<string, number>()
    for (const [index, section] of book.sections.entries()) {
        byId.set(section.id, index)
        byPath.set(normalizeBookPath(String(section.id ?? '')), index)
    }
    return { byId, byPath }
}

function findSectionIndex(lookup: SectionIndexLookup, id: string | number): number {
    const exact = lookup.byId.get(id)
    if (exact !== undefined) return exact

    const normalized = normalizeBookPath(String(id))
    if (!normalized) return -1
    const byPath = lookup.byPath.get(normalized)
    if (byPath !== undefined) return byPath

    const suffix = `/${normalized}`
    for (const [sectionPath, index] of lookup.byPath) {
        if (sectionPath.endsWith(suffix)) return index
    }
    return -1
}

function resolveTOCSectionIndex(book: Book, href: string, sectionLookup = createSectionIndexLookup(book)): number {
    const resolved = book.resolveHref?.(href)
    if (typeof resolved?.index === 'number' && resolved.index >= 0) return resolved.index

    const parts = book.splitTOCHref?.(href)
    if (parts && Array.isArray(parts)) {
        const [id] = parts
        const sectionIndex = findSectionIndex(sectionLookup, id)
        if (sectionIndex >= 0) return sectionIndex
    }

    const normalizedHref = normalizeBookPath(href)
    if (!normalizedHref) return -1

    const sectionIndex = sectionLookup.byPath.get(normalizedHref)
    if (sectionIndex !== undefined) return sectionIndex

    const suffix = `/${normalizedHref}`
    for (const [sectionPath, index] of sectionLookup.byPath) {
        if (sectionPath.endsWith(suffix)) return index
    }
    return -1
}
