/**
 * Platform-neutral reader session.
 *
 * ReaderSession owns parsing, plugins, book lifecycle, navigation helpers, and
 * event rebinding. Platform packages provide renderer factories and parser
 * adapters.
 */

import type { BlockWindowEvent, Book, LinkEvent, LoadEvent, RelocateEvent, TOCItem } from './types'
import type { ParserInput, ParserOptions } from './parser'
import type { BookRange, TextChunk, TextProvider, TextSearchResult } from './location'
import type { PageSurface } from './page-surface'
import type { LayoutMode, NavigationDirection, ReaderMark, Renderer, RendererNavigationHooks, RendererStyles } from './renderer'
import type { ReaderThemeInput } from './theme'
import {
    createRebookExtensionHost,
    createRebookExtensionRegistry,
    isRebookExtension,
    type RebookExtensionCommandRegistration,
    type RebookExtensionContributionIndex,
    type RebookExtension,
    type RebookExtensionHost,
    type RebookExtensionManifest,
    type RebookExtensionSettingInspection,
    type RebookExtensionRegistry,
    type RebookExtensionRegistryInstallOptions,
    type RebookPluginLike,
} from './extensions'
import type { TrialLimitController, TrialTOCAccessItem } from '../plugins/trial-limit'
import { registry } from './parser'
import { applyRebookPlugins } from './plugins'
import {
    createSectionIndexLookup,
    flattenTOC,
    normalizeNavigationHref,
    normalizeTOCHref,
    resolveTOCSectionIndex,
} from './toc'
import {
    searchBook,
    searchContentUnits as searchBookContentUnits,
    type ContentUnitSearchResult,
    type SearchOptions,
    type SearchResult,
} from '../search'

export interface ReaderSessionConfig {
    /** Create a renderer instance for the current platform. */
    createRenderer: (hooks?: RendererNavigationHooks) => Renderer
    /** Parser options, including platform adapters. */
    parserOptions?: ParserOptions | (() => ParserOptions)
    /** Plugins to transform the book before rendering. */
    plugins?: readonly RebookPluginLike[]
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
    private readonly extensionRegistry: RebookExtensionRegistry = createRebookExtensionRegistry()
    private readonly extensionHost: RebookExtensionHost = createRebookExtensionHost()
    private readonly pluginEntries: RebookPluginLike[] = []
    private registeredListeners: Array<{
        event: string
        listener: (e: any) => void
        wrappedListener: (e: any) => void
    }> = []

    constructor(config: ReaderSessionConfig) {
        this.config = config
        for (const plugin of config.plugins ?? []) this.addPluginEntry(plugin)
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
            this.pluginEntries,
            this.extensionHost,
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

        const book = await applyRebookPlugins(inputBook, this.pluginEntries, this.extensionHost)

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
     * Install an extension for future book opens. Existing open books are not rewrapped automatically.
     */
    installExtension(
        extension: RebookExtension,
        options: RebookExtensionRegistryInstallOptions = {},
    ): RebookExtension {
        const existingIndex = this.pluginEntries.findIndex(entry =>
            isRebookExtension(entry) && entry.manifest.id === extension.manifest.id,
        )
        const installed = this.extensionRegistry.install(extension, options)
        if (existingIndex >= 0) {
            this.extensionHost.subscriptions.deactivateExtension(installed.manifest.id)
            this.extensionHost.commands.unregisterExtension(installed.manifest.id)
        }
        this.extensionHost.settings.registerExtension(installed.manifest)
        if (existingIndex >= 0) {
            this.pluginEntries[existingIndex] = installed
        } else {
            this.pluginEntries.push(installed)
        }
        return installed
    }

    /**
     * Uninstall an extension by id for future book opens.
     */
    uninstallExtension(id: string): boolean {
        const removed = this.extensionRegistry.uninstall(id)
        if (!removed) return false
        this.extensionHost.subscriptions.deactivateExtension(id)
        this.extensionHost.commands.unregisterExtension(id)
        this.extensionHost.settings.unregisterExtension(id)
        for (let index = this.pluginEntries.length - 1; index >= 0; index--) {
            const entry = this.pluginEntries[index]
            if (isRebookExtension(entry) && entry.manifest.id === id) {
                this.pluginEntries.splice(index, 1)
            }
        }
        return true
    }

    /**
     * Get an installed extension package by id.
     */
    getExtension(id: string): RebookExtension | undefined {
        return this.extensionRegistry.get(id)
    }

    /**
     * Check whether an extension package is installed.
     */
    hasExtension(id: string): boolean {
        return this.extensionRegistry.has(id)
    }

    /**
     * List installed extension packages.
     */
    getInstalledExtensions(): readonly RebookExtension[] {
        return this.extensionRegistry.list()
    }

    /**
     * List installed extension manifests for UI, settings, and future marketplace integrations.
     */
    getExtensionManifests(): readonly RebookExtensionManifest[] {
        return this.extensionRegistry.manifests()
    }

    /**
     * List typed contribution points declared by installed extensions.
     */
    getExtensionContributions(): RebookExtensionContributionIndex {
        return this.extensionRegistry.contributions()
    }

    /**
     * List commands registered by activated extensions.
     */
    getExtensionCommands(): readonly RebookExtensionCommandRegistration[] {
        return this.extensionHost.commands.listCommands()
    }

    /**
     * Check whether an activated extension command has a handler registered.
     */
    hasExtensionCommand(id: string): boolean {
        return this.extensionHost.commands.hasCommand(id)
    }

    /**
     * Execute a command registered during extension activation.
     */
    executeExtensionCommand<T = unknown>(id: string, ...args: readonly unknown[]): Promise<T> {
        return this.extensionHost.commands.executeCommand<T>(id, ...args)
    }

    /**
     * List settings declared by installed/activated extensions with effective values.
     */
    getExtensionSettings(extensionId?: string): readonly RebookExtensionSettingInspection[] {
        return this.extensionHost.settings.list(extensionId)
    }

    /**
     * Read one extension setting, falling back to the manifest default when present.
     */
    getExtensionSetting<T = unknown>(extensionId: string, key: string, fallback?: T): T {
        return this.extensionHost.settings.get(extensionId, key, fallback)
    }

    /**
     * Update one extension setting for subsequent command activation and plugin behavior.
     */
    updateExtensionSetting<T = unknown>(extensionId: string, key: string, value: T): void {
        this.extensionHost.settings.update(extensionId, key, value)
    }

    /**
     * Export host-managed extension setting values for persistence.
     */
    getExtensionSettingsSnapshot(): Record<string, Record<string, unknown>> {
        return this.extensionHost.settings.toJSON()
    }

    /**
     * Restore host-managed extension setting values from persisted state.
     */
    loadExtensionSettingsSnapshot(snapshot: Record<string, Record<string, unknown>> | undefined): void {
        this.extensionHost.settings.load(snapshot)
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
     * Search the current book and group matches by readable content unit.
     */
    async searchContentUnits(
        query: string,
        options: Omit<SearchOptions, 'scope' | 'unitIndex' | 'unitIndexes'> = {},
    ): Promise<ContentUnitSearchResult[]> {
        if (!this.book) return []
        return searchBookContentUnits(this.book, query, options)
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
     * Get the currently composed page surface, when the active renderer exposes one.
     */
    getCurrentSurface(): PageSurface | null {
        return this.renderer.getCurrentSurface?.() ?? null
    }

    /**
     * Get a text provider for the currently composed surface.
     */
    getCurrentTextProvider(): TextProvider | null {
        return this.getCurrentSurface()?.textProvider ?? null
    }

    /**
     * Get visible/current surface text through the unified surface model.
     */
    async getCurrentText(range?: BookRange): Promise<readonly TextChunk[]> {
        return await this.getCurrentTextProvider()?.getText(range) ?? []
    }

    /**
     * Search visible/current surface text through the unified surface model.
     */
    async searchCurrentText(query: string, range?: BookRange): Promise<readonly TextSearchResult[]> {
        const provider = this.getCurrentTextProvider()
        if (!provider?.search) return []
        return await provider.search(query, range)
    }

    /**
     * Update styles.
     */
    setStyles(styles: RendererStyles): void {
        this.renderer.setStyles(styles)
    }

    /**
     * Switch reader theme.
     */
    setTheme(theme: ReaderThemeInput): void {
        this.renderer.setTheme(theme)
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

    private addPluginEntry(entry: RebookPluginLike): void {
        if (isRebookExtension(entry)) {
            this.extensionRegistry.install(entry)
            this.extensionHost.settings.registerExtension(entry.manifest)
        }
        this.pluginEntries.push(entry)
    }
}

function createTOCViewTree(
    items: readonly TOCItem[],
    activeItem: TOCItem | null,
    trialByItem?: ReadonlyMap<TOCItem, TrialTOCAccessItem>,
): TOCViewItem[] {
    let index = 0
    const hrefCounts = countTOCHrefs(items)

    const walk = (tocItems: readonly TOCItem[]): TOCViewItem[] => tocItems.map(item => {
        const itemIndex = index++
        const trialItem = trialByItem?.get(item)
        const children = item.subitems?.length ? walk(item.subitems) : undefined
        return {
            id: `${itemIndex}-${item.href}`,
            label: item.label || 'Untitled',
            target: trialItem?.href ?? item.href,
            disabled: trialItem?.disabled ?? false,
            active: isActiveTOCViewItem(item, activeItem, hrefCounts),
            children,
        }
    })

    return walk(items)
}

function countTOCHrefs(items: readonly TOCItem[]): Map<string, number> {
    const counts = new Map<string, number>()
    for (const item of flattenTOC(items)) {
        const href = normalizeTOCHref(item.href)
        if (!href) continue
        counts.set(href, (counts.get(href) ?? 0) + 1)
    }
    return counts
}

function isActiveTOCViewItem(
    item: TOCItem,
    activeItem: TOCItem | null,
    hrefCounts: ReadonlyMap<string, number>,
): boolean {
    if (!activeItem) return false
    if (item === activeItem) return true

    const itemHref = normalizeTOCHref(item.href)
    const activeHref = normalizeTOCHref(activeItem.href)
    if (!itemHref || !activeHref || itemHref !== activeHref) return false
    return (hrefCounts.get(itemHref) ?? 0) <= 1
}

function normalizeTOCViewLocation(location: RelocateEvent | null): RelocateEvent | null {
    if (location?.tocItem !== null) return location
    return { ...location, tocItem: undefined }
}
