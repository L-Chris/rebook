import type { Book, RebookPlugin } from './types'

export type RebookExtensionCategory =
    | 'ai'
    | 'annotation'
    | 'export'
    | 'reader'
    | 'renderer'
    | 'theme'
    | 'translation'
    | 'tts'
    | 'utility'
    | 'other'

export type RebookExtensionCapability =
    | 'ai.chat'
    | 'book.transform'
    | 'content.read'
    | 'content.rewrite'
    | 'reader.access'
    | 'renderer.route'
    | 'search'
    | 'theme'
    | 'translation'
    | 'tts.playback'
    | 'ui.panel'

export type RebookExtensionSettingType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object'
export type RebookExtensionPanelLocation = 'sidebar' | 'bottom' | 'reader' | 'settings'

export interface RebookExtensionCommandContribution {
    readonly id: string
    readonly title: string
    readonly category?: string
    readonly icon?: string
    readonly when?: string
}

export interface RebookExtensionPanelContribution {
    readonly id: string
    readonly title: string
    readonly location?: RebookExtensionPanelLocation
    readonly icon?: string
    readonly when?: string
}

export interface RebookExtensionSettingContribution {
    readonly type: RebookExtensionSettingType
    readonly title?: string
    readonly description?: string
    readonly default?: unknown
    readonly enum?: readonly unknown[]
    readonly order?: number
    readonly scope?: 'global' | 'book' | 'session'
    readonly secret?: boolean
}

export interface RebookExtensionToolContribution {
    readonly id: string
    readonly title: string
    readonly description?: string
    readonly inputSchema?: Record<string, unknown>
}

export interface RebookExtensionContributions {
    readonly commands?: readonly RebookExtensionCommandContribution[]
    readonly panels?: readonly RebookExtensionPanelContribution[]
    readonly settings?: Record<string, RebookExtensionSettingContribution>
    readonly tools?: readonly RebookExtensionToolContribution[]
}

export interface RebookResolvedExtensionContribution<TContribution> {
    readonly extensionId: string
    readonly manifest: RebookExtensionManifest
    readonly contribution: TContribution
}

export interface RebookResolvedExtensionSettingContribution {
    readonly extensionId: string
    readonly manifest: RebookExtensionManifest
    readonly key: string
    readonly contribution: RebookExtensionSettingContribution
}

export interface RebookExtensionContributionIndex {
    readonly commands: readonly RebookResolvedExtensionContribution<RebookExtensionCommandContribution>[]
    readonly panels: readonly RebookResolvedExtensionContribution<RebookExtensionPanelContribution>[]
    readonly settings: readonly RebookResolvedExtensionSettingContribution[]
    readonly tools: readonly RebookResolvedExtensionContribution<RebookExtensionToolContribution>[]
}

export interface RebookDisposable {
    dispose(): void
}

export type RebookExtensionCommandHandler = (...args: readonly unknown[]) => unknown | Promise<unknown>

export interface RebookExtensionCommandRegistration {
    readonly id: string
    readonly extensionId: string
    readonly manifest: RebookExtensionManifest
    readonly handler: RebookExtensionCommandHandler
}

export interface RebookExtensionCommandService {
    registerCommand(id: string, handler: RebookExtensionCommandHandler): RebookDisposable
    executeCommand<T = unknown>(id: string, ...args: readonly unknown[]): Promise<T>
    hasCommand(id: string): boolean
    listCommands(): readonly RebookExtensionCommandRegistration[]
}

export interface RebookExtensionSettingInspection<T = unknown> {
    readonly extensionId: string
    readonly key: string
    readonly manifest?: RebookExtensionManifest
    readonly contribution?: RebookExtensionSettingContribution
    readonly defaultValue?: unknown
    readonly value?: T
    readonly effectiveValue?: T
}

export interface RebookExtensionSettingsService {
    get<T = unknown>(key: string, fallback?: T): T
    update<T = unknown>(key: string, value: T): void
    inspect<T = unknown>(key: string): RebookExtensionSettingInspection<T>
    list(): readonly RebookExtensionSettingInspection[]
}

export interface RebookExtensionHost {
    readonly commands: RebookExtensionCommandRegistry
    readonly settings: RebookExtensionSettingsRegistry
    readonly subscriptions: RebookExtensionSubscriptionRegistry
}

export interface RebookExtensionManifest {
    /** Stable marketplace/package id, for example "rebook.ai-chat". */
    readonly id: string
    /** Human-readable extension name. */
    readonly name: string
    /** Semver-compatible extension version. */
    readonly version: string
    readonly displayName?: string
    readonly description?: string
    readonly publisher?: string
    readonly license?: string
    readonly homepage?: string
    readonly repository?: string
    readonly icon?: string
    readonly keywords?: readonly string[]
    readonly categories?: readonly RebookExtensionCategory[]
    /** Capability declarations let hosts and future marketplaces filter extensions before loading code. */
    readonly capabilities?: readonly RebookExtensionCapability[]
    /** Package entry path for marketplace/distribution metadata. Runtime hosts may ignore it. */
    readonly entry?: string
    readonly engines?: {
        readonly rebook?: string
    }
    /** Future extension-point contributions such as commands, panels, tools, or settings schemas. */
    readonly contributes?: RebookExtensionContributions
}

export interface RebookExtensionContext {
    readonly apiVersion: 1
    readonly extensionId: string
    readonly manifest: RebookExtensionManifest
    readonly subscriptions: RebookDisposable[]
    readonly commands: RebookExtensionCommandService
    readonly settings: RebookExtensionSettingsService
}

export interface RebookExtension {
    readonly manifest: RebookExtensionManifest
    /**
     * Static book transform. Useful for simple extensions that only wrap the Book API.
     */
    readonly plugin?: RebookPlugin
    /**
     * Static book transforms applied in order.
     */
    readonly plugins?: readonly RebookPlugin[]
    /**
     * Activate the extension and return zero or more book transforms.
     * Hosts call this before opening a book for now; future hosts can cache activation.
     */
    activate?(
        context: RebookExtensionContext,
    ): void | RebookPlugin | readonly RebookPlugin[] | Promise<void | RebookPlugin | readonly RebookPlugin[]>
}

export type RebookPluginLike = RebookPlugin | RebookExtension

export interface ResolvedRebookExtension {
    readonly manifest: RebookExtensionManifest
    readonly plugins: readonly RebookPlugin[]
}

export type RebookExtensionCatalogSource = 'builtin' | 'marketplace' | 'local' | 'remote' | string

export interface RebookExtensionCatalogEntry {
    readonly manifest: RebookExtensionManifest
    /** Where this listing came from. Hosts can use this to distinguish built-ins from marketplace results. */
    readonly source?: RebookExtensionCatalogSource
    /** Optional URL or package locator used by an installer to fetch the extension bundle. */
    readonly installUrl?: string
    readonly verified?: boolean
    readonly publishedAt?: string
    readonly updatedAt?: string
}

export interface RebookExtensionModuleFactoryContext {
    readonly manifest: RebookExtensionManifest
    readonly catalogEntry?: RebookExtensionCatalogEntry
    readonly installUrl?: string
}

export type RebookExtensionModuleFactory = (
    context: RebookExtensionModuleFactoryContext,
) => RebookExtension | Promise<RebookExtension>

export interface RebookExtensionModuleExports {
    readonly default?: RebookExtension | RebookExtensionModuleFactory
    readonly extension?: RebookExtension | RebookExtensionModuleFactory
    readonly rebookExtension?: RebookExtension | RebookExtensionModuleFactory
    readonly manifest?: RebookExtensionManifest
    readonly plugin?: RebookPlugin
    readonly plugins?: readonly RebookPlugin[]
    readonly activate?: RebookExtension['activate']
}

export interface RebookExtensionModuleLoadOptions {
    readonly manifest?: RebookExtensionManifest
    readonly catalogEntry?: RebookExtensionCatalogEntry
}

export type RebookExtensionModuleImporter = (
    installUrl: string,
) => Promise<RebookExtensionModuleExports | Record<string, unknown>>

export interface RebookExtensionCatalogDocument {
    readonly schemaVersion?: 1
    readonly source?: RebookExtensionCatalogSource
    readonly entries?: readonly RebookExtensionCatalogEntry[]
    readonly extensions?: readonly RebookExtensionCatalogEntry[]
    readonly generatedAt?: string
}

export interface RebookExtensionCatalogParseOptions {
    readonly source?: RebookExtensionCatalogSource
}

export interface RebookExtensionInstallation {
    readonly id: string
    readonly version?: string
    readonly enabled?: boolean
    readonly source?: RebookExtensionCatalogSource
    readonly installedAt?: string
    readonly updatedAt?: string
}

export type RebookExtensionInstallState = 'available' | 'installed' | 'disabled'

export interface RebookExtensionCatalogItem extends RebookExtensionCatalogEntry {
    readonly installation?: RebookExtensionInstallation
    readonly installState: RebookExtensionInstallState
    readonly installed: boolean
    readonly enabled: boolean
}

export interface RebookExtensionCatalogQuery {
    readonly query?: string
    readonly categories?: readonly RebookExtensionCategory[]
    readonly capabilities?: readonly RebookExtensionCapability[]
    readonly source?: RebookExtensionCatalogSource
    readonly installed?: boolean
    readonly enabled?: boolean
}

export interface RebookExtensionManagerOptions {
    readonly catalog?: RebookExtensionCatalog | readonly RebookExtensionCatalogEntry[]
    readonly installations?: readonly RebookExtensionInstallation[]
    readonly now?: () => string
}

export interface RebookExtensionManagerInstallOptions extends Omit<RebookExtensionInstallation, 'id' | 'version'> {
    readonly version?: string
}

export class RebookExtensionCommandRegistry {
    private readonly commands = new Map<string, RebookExtensionCommandRegistration>()

    registerExtensionCommand(
        manifest: RebookExtensionManifest,
        id: string,
        handler: RebookExtensionCommandHandler,
    ): RebookDisposable {
        const normalizedManifest = assertRebookExtensionManifest(manifest)
        assertNonEmptyString(id, 'command id')
        if (typeof handler !== 'function') {
            throw new Error(`Rebook extension command "${id}" handler must be a function.`)
        }
        const existing = this.commands.get(id)
        if (existing && existing.extensionId !== normalizedManifest.id) {
            throw new Error(`Rebook extension command "${id}" is already registered by "${existing.extensionId}".`)
        }
        const registration = {
            id,
            extensionId: normalizedManifest.id,
            manifest: normalizedManifest,
            handler,
        } satisfies RebookExtensionCommandRegistration
        this.commands.set(id, registration)
        return {
            dispose: () => {
                if (this.commands.get(id) === registration) this.commands.delete(id)
            },
        }
    }

    async executeCommand<T = unknown>(id: string, ...args: readonly unknown[]): Promise<T> {
        const registration = this.commands.get(id)
        if (!registration) throw new Error(`Rebook extension command "${id}" is not registered.`)
        return await registration.handler(...args) as T
    }

    hasCommand(id: string): boolean {
        return this.commands.has(id)
    }

    listCommands(): readonly RebookExtensionCommandRegistration[] {
        return Array.from(this.commands.values())
    }

    unregisterCommand(id: string): boolean {
        return this.commands.delete(id)
    }

    unregisterExtension(extensionId: string): number {
        let removed = 0
        for (const [id, registration] of this.commands) {
            if (registration.extensionId === extensionId) {
                this.commands.delete(id)
                removed += 1
            }
        }
        return removed
    }

    clear(): void {
        this.commands.clear()
    }
}

export function createRebookExtensionCommandRegistry(): RebookExtensionCommandRegistry {
    return new RebookExtensionCommandRegistry()
}

export class RebookExtensionSettingsRegistry {
    private readonly values = new Map<string, unknown>()
    private readonly contributions = new Map<string, {
        manifest: RebookExtensionManifest
        settings: Record<string, RebookExtensionSettingContribution>
    }>()

    registerExtension(manifest: RebookExtensionManifest): RebookDisposable {
        const normalizedManifest = assertRebookExtensionManifest(manifest)
        this.contributions.set(normalizedManifest.id, {
            manifest: normalizedManifest,
            settings: normalizedManifest.contributes?.settings ?? {},
        })
        return {
            dispose: () => {
                this.contributions.delete(normalizedManifest.id)
            },
        }
    }

    unregisterExtension(extensionId: string): boolean {
        return this.contributions.delete(extensionId)
    }

    get<T = unknown>(extensionId: string, key: string, fallback?: T): T {
        const storedKey = createSettingStorageKey(extensionId, key)
        if (this.values.has(storedKey)) return this.values.get(storedKey) as T
        const contribution = this.getContribution(extensionId, key)
        if (contribution && 'default' in contribution) return contribution.default as T
        return fallback as T
    }

    update<T = unknown>(extensionId: string, key: string, value: T): void {
        assertNonEmptyString(extensionId, 'extension id')
        assertNonEmptyString(key, 'setting key')
        const contribution = this.getContribution(extensionId, key)
        if (contribution) assertSettingValue(extensionId, key, contribution, value)
        this.values.set(createSettingStorageKey(extensionId, key), value)
    }

    inspect<T = unknown>(extensionId: string, key: string): RebookExtensionSettingInspection<T> {
        const storedKey = createSettingStorageKey(extensionId, key)
        const registered = this.contributions.get(extensionId)
        const contribution = this.getContribution(extensionId, key)
        const hasValue = this.values.has(storedKey)
        const value = hasValue ? this.values.get(storedKey) as T : undefined
        const hasDefault = Boolean(contribution && 'default' in contribution)
        const defaultValue = hasDefault ? contribution?.default : undefined
        const effectiveValue = hasValue ? value : hasDefault ? defaultValue as T : undefined
        return {
            extensionId,
            key,
            manifest: registered?.manifest,
            contribution,
            defaultValue,
            value,
            effectiveValue,
        }
    }

    list(extensionId?: string): readonly RebookExtensionSettingInspection[] {
        const result: RebookExtensionSettingInspection[] = []
        for (const [currentExtensionId, registered] of this.contributions) {
            if (extensionId !== undefined && currentExtensionId !== extensionId) continue
            for (const key of Object.keys(registered.settings)) {
                result.push(this.inspect(currentExtensionId, key))
            }
        }
        return result
    }

    toJSON(): Record<string, Record<string, unknown>> {
        const result: Record<string, Record<string, unknown>> = {}
        for (const [storedKey, value] of this.values) {
            const [extensionId, key] = splitSettingStorageKey(storedKey)
            result[extensionId] ??= {}
            result[extensionId][key] = value
        }
        return result
    }

    load(snapshot: Record<string, Record<string, unknown>> | undefined): void {
        this.values.clear()
        if (!snapshot || typeof snapshot !== 'object') return
        for (const [extensionId, settings] of Object.entries(snapshot)) {
            if (!settings || typeof settings !== 'object' || Array.isArray(settings)) continue
            for (const [key, value] of Object.entries(settings)) {
                this.update(extensionId, key, value)
            }
        }
    }

    clearValues(extensionId?: string): void {
        if (extensionId === undefined) {
            this.values.clear()
            return
        }
        const prefix = `${extensionId}\u0000`
        for (const storedKey of Array.from(this.values.keys())) {
            if (storedKey.startsWith(prefix)) this.values.delete(storedKey)
        }
    }

    clear(): void {
        this.values.clear()
        this.contributions.clear()
    }

    private getContribution(extensionId: string, key: string): RebookExtensionSettingContribution | undefined {
        return this.contributions.get(extensionId)?.settings[key]
    }
}

export function createRebookExtensionSettingsRegistry(): RebookExtensionSettingsRegistry {
    return new RebookExtensionSettingsRegistry()
}

export class RebookExtensionSubscriptionRegistry {
    private readonly subscriptions = new Map<string, RebookDisposable[]>()

    setExtensionSubscriptions(extensionId: string, subscriptions: readonly RebookDisposable[]): void {
        this.deactivateExtension(extensionId)
        if (subscriptions.length) this.subscriptions.set(extensionId, [...subscriptions])
    }

    list(extensionId?: string): readonly RebookDisposable[] {
        if (extensionId !== undefined) return [...(this.subscriptions.get(extensionId) ?? [])]
        return Array.from(this.subscriptions.values()).flatMap(items => items)
    }

    count(extensionId?: string): number {
        return this.list(extensionId).length
    }

    deactivateExtension(extensionId: string): number {
        const subscriptions = this.subscriptions.get(extensionId)
        if (!subscriptions) return 0
        this.subscriptions.delete(extensionId)
        disposeRebookDisposables(subscriptions)
        return subscriptions.length
    }

    clear(): void {
        for (const extensionId of Array.from(this.subscriptions.keys())) {
            this.deactivateExtension(extensionId)
        }
    }
}

export function createRebookExtensionSubscriptionRegistry(): RebookExtensionSubscriptionRegistry {
    return new RebookExtensionSubscriptionRegistry()
}

export function createRebookExtensionHost(): RebookExtensionHost {
    return {
        commands: createRebookExtensionCommandRegistry(),
        settings: createRebookExtensionSettingsRegistry(),
        subscriptions: createRebookExtensionSubscriptionRegistry(),
    }
}

export function defineRebookExtension(extension: RebookExtension): RebookExtension {
    assertRebookExtensionManifest(extension.manifest)
    return extension
}

export function defineRebookPlugin(
    manifest: RebookExtensionManifest,
    plugin: RebookPlugin,
): RebookExtension {
    return defineRebookExtension({ manifest, plugin })
}

export async function normalizeRebookExtensionModule(
    moduleExports: RebookExtensionModuleExports | Record<string, unknown>,
    options: RebookExtensionModuleLoadOptions = {},
): Promise<RebookExtension> {
    const catalogEntry = options.catalogEntry
    const manifest = options.manifest ?? catalogEntry?.manifest
    if (!moduleExports || typeof moduleExports !== 'object') {
        throw new Error('Rebook extension module must export an object.')
    }
    const exports = moduleExports as RebookExtensionModuleExports
    const exported = exports.default
        ?? exports.extension
        ?? exports.rebookExtension
        ?? null
    const candidate = typeof exported === 'function'
        ? await (exported as RebookExtensionModuleFactory)({
            manifest: manifest ?? exports.manifest ?? catalogEntry?.manifest ?? assertMissingExtensionManifest(),
            catalogEntry,
            installUrl: catalogEntry?.installUrl,
        })
        : exported
    const extension = candidate && typeof candidate === 'object' && 'manifest' in candidate
        ? defineRebookExtension(candidate as RebookExtension)
        : exports.manifest
            ? defineRebookExtension({
                manifest: exports.manifest,
                plugin: exports.plugin,
                plugins: exports.plugins,
                activate: exports.activate,
            })
            : (exports.activate || exports.plugin || exports.plugins) && manifest
                ? defineRebookExtension({
                    manifest,
                    plugin: exports.plugin,
                    plugins: exports.plugins,
                    activate: exports.activate,
                })
                : null
    if (!extension) {
        throw new Error('Rebook extension module must export default, extension, rebookExtension, or manifest/activate/plugin.')
    }
    if (manifest && extension.manifest.id !== manifest.id) {
        throw new Error(`Rebook extension module id mismatch: expected "${manifest.id}", received "${extension.manifest.id}".`)
    }
    return extension
}

export async function loadRebookExtensionModule(
    installUrl: string,
    importer: RebookExtensionModuleImporter,
    options: RebookExtensionModuleLoadOptions = {},
): Promise<RebookExtension> {
    if (!installUrl.trim()) {
        throw new Error('Rebook extension installUrl must be a non-empty string.')
    }
    return normalizeRebookExtensionModule(await importer(installUrl), options)
}

export function isRebookExtension(value: RebookPluginLike | unknown): value is RebookExtension {
    return value !== null
        && value !== undefined
        && typeof value === 'object'
        && 'manifest' in value
}

export function getRebookExtensionManifest(value: RebookPluginLike): RebookExtensionManifest | null {
    return isRebookExtension(value) ? value.manifest : null
}

export function getRebookExtensionContributionIndex(
    entries: readonly (RebookExtension | RebookExtensionManifest)[],
): RebookExtensionContributionIndex {
    const commands: RebookResolvedExtensionContribution<RebookExtensionCommandContribution>[] = []
    const panels: RebookResolvedExtensionContribution<RebookExtensionPanelContribution>[] = []
    const settings: RebookResolvedExtensionSettingContribution[] = []
    const tools: RebookResolvedExtensionContribution<RebookExtensionToolContribution>[] = []
    for (const entry of entries) {
        const manifest = assertRebookExtensionManifest(isRebookExtension(entry) ? entry.manifest : entry)
        const contributes = manifest.contributes
        for (const contribution of contributes?.commands ?? []) {
            commands.push({ extensionId: manifest.id, manifest, contribution })
        }
        for (const contribution of contributes?.panels ?? []) {
            panels.push({ extensionId: manifest.id, manifest, contribution })
        }
        for (const [key, contribution] of Object.entries(contributes?.settings ?? {})) {
            settings.push({ extensionId: manifest.id, manifest, key, contribution })
        }
        for (const contribution of contributes?.tools ?? []) {
            tools.push({ extensionId: manifest.id, manifest, contribution })
        }
    }
    return { commands, panels, settings, tools }
}

export async function resolveRebookExtension(
    value: RebookExtension,
    host: RebookExtensionHost = createRebookExtensionHost(),
): Promise<ResolvedRebookExtension> {
    const manifest = assertRebookExtensionManifest(value.manifest)
    host.subscriptions.deactivateExtension(manifest.id)
    host.commands.unregisterExtension(manifest.id)
    host.settings.registerExtension(manifest)
    const subscriptions: RebookDisposable[] = []
    const context: RebookExtensionContext = {
        apiVersion: 1,
        extensionId: manifest.id,
        manifest,
        subscriptions,
        commands: createScopedCommandService(host.commands, manifest, subscriptions),
        settings: createScopedSettingsService(host.settings, manifest),
    }
    let activated: void | RebookPlugin | readonly RebookPlugin[] | undefined
    try {
        activated = await value.activate?.(context)
    } catch (error) {
        disposeRebookDisposables(subscriptions)
        host.commands.unregisterExtension(manifest.id)
        throw error
    }
    host.subscriptions.setExtensionSubscriptions(manifest.id, subscriptions)
    return {
        manifest,
        plugins: [
            ...toPluginArray(value.plugin),
            ...toPluginArray(value.plugins),
            ...toPluginArray(activated),
        ],
    }
}

export async function resolveRebookPlugins(
    entries: readonly RebookPluginLike[] | undefined,
    host?: RebookExtensionHost,
): Promise<readonly RebookPlugin[]> {
    const plugins: RebookPlugin[] = []
    for (const entry of entries ?? []) {
        if (isRebookExtension(entry)) {
            plugins.push(...await resolveRebookExtension(entry, host).then(result => result.plugins))
        } else {
            plugins.push(entry)
        }
    }
    return plugins
}

export interface RebookExtensionRegistryInstallOptions {
    readonly replace?: boolean
}

export class RebookExtensionRegistry {
    private readonly extensions = new Map<string, RebookExtension>()

    install(extension: RebookExtension, options: RebookExtensionRegistryInstallOptions = {}): RebookExtension {
        const manifest = assertRebookExtensionManifest(extension.manifest)
        if (!options.replace && this.extensions.has(manifest.id)) {
            throw new Error(`Rebook extension "${manifest.id}" is already installed.`)
        }
        this.extensions.set(manifest.id, extension)
        return extension
    }

    uninstall(id: string): boolean {
        return this.extensions.delete(id)
    }

    get(id: string): RebookExtension | undefined {
        return this.extensions.get(id)
    }

    has(id: string): boolean {
        return this.extensions.has(id)
    }

    list(): readonly RebookExtension[] {
        return Array.from(this.extensions.values())
    }

    manifests(): readonly RebookExtensionManifest[] {
        return this.list().map(extension => extension.manifest)
    }

    contributions(): RebookExtensionContributionIndex {
        return getRebookExtensionContributionIndex(this.list())
    }

    async getPlugins(host?: RebookExtensionHost): Promise<readonly RebookPlugin[]> {
        return resolveRebookPlugins(this.list(), host)
    }

    clear(): void {
        this.extensions.clear()
    }
}

export function createRebookExtensionRegistry(
    extensions: readonly RebookExtension[] = [],
): RebookExtensionRegistry {
    const registry = new RebookExtensionRegistry()
    for (const extension of extensions) registry.install(extension)
    return registry
}

export class RebookExtensionCatalog {
    private readonly entries = new Map<string, RebookExtensionCatalogEntry>()

    constructor(entries: readonly RebookExtensionCatalogEntry[] = []) {
        for (const entry of entries) this.upsert(entry)
    }

    upsert(entry: RebookExtensionCatalogEntry): RebookExtensionCatalogEntry {
        const manifest = assertRebookExtensionManifest(entry.manifest)
        const normalized = { ...entry, manifest }
        this.entries.set(manifest.id, normalized)
        return normalized
    }

    remove(id: string): boolean {
        return this.entries.delete(id)
    }

    get(id: string): RebookExtensionCatalogEntry | undefined {
        return this.entries.get(id)
    }

    has(id: string): boolean {
        return this.entries.has(id)
    }

    list(query: RebookExtensionCatalogQuery = {}): readonly RebookExtensionCatalogEntry[] {
        return this.filter(Array.from(this.entries.values()), query)
    }

    search(query: string, options: Omit<RebookExtensionCatalogQuery, 'query'> = {}): readonly RebookExtensionCatalogEntry[] {
        return this.list({ ...options, query })
    }

    items(
        installations: readonly RebookExtensionInstallation[] = [],
        query: RebookExtensionCatalogQuery = {},
    ): readonly RebookExtensionCatalogItem[] {
        const installationById = new Map(installations.map(installation => [installation.id, installation]))
        const items = Array.from(this.entries.values()).map(entry => {
            const installation = installationById.get(entry.manifest.id)
            const installed = Boolean(installation)
            const enabled = installed ? installation?.enabled !== false : false
            return {
                ...entry,
                installation,
                installed,
                enabled,
                installState: installed ? (enabled ? 'installed' : 'disabled') : 'available',
            } satisfies RebookExtensionCatalogItem
        })
        return this.filter(items, query)
    }

    clear(): void {
        this.entries.clear()
    }

    private filter<T extends RebookExtensionCatalogEntry | RebookExtensionCatalogItem>(
        entries: readonly T[],
        query: RebookExtensionCatalogQuery,
    ): readonly T[] {
        return entries.filter(entry => {
            if (query.source !== undefined && entry.source !== query.source) return false
            if (query.categories?.length && !containsEvery(entry.manifest.categories, query.categories)) return false
            if (query.capabilities?.length && !containsEvery(entry.manifest.capabilities, query.capabilities)) return false
            if ('installed' in entry && query.installed !== undefined && entry.installed !== query.installed) return false
            if ('enabled' in entry && query.enabled !== undefined && entry.enabled !== query.enabled) return false
            if (query.query && !catalogEntryMatchesText(entry, query.query)) return false
            return true
        })
    }
}

export function createRebookExtensionCatalog(
    entries: readonly RebookExtensionCatalogEntry[] = [],
): RebookExtensionCatalog {
    return new RebookExtensionCatalog(entries)
}

export function parseRebookExtensionCatalogEntries(
    input: unknown,
    options: RebookExtensionCatalogParseOptions = {},
): readonly RebookExtensionCatalogEntry[] {
    const { entries, source } = normalizeCatalogDocument(input, options)
    return entries.map((entry, index) => normalizeCatalogEntry(entry, source, index))
}

export function createRebookExtensionCatalogFromJSON(
    input: unknown,
    options: RebookExtensionCatalogParseOptions = {},
): RebookExtensionCatalog {
    return createRebookExtensionCatalog(parseRebookExtensionCatalogEntries(input, options))
}

export function createRebookExtensionCatalogEntry(
    manifest: RebookExtensionManifest,
    entry: Omit<RebookExtensionCatalogEntry, 'manifest'> = {},
): RebookExtensionCatalogEntry {
    return { ...entry, manifest: assertRebookExtensionManifest(manifest) }
}

export function createRebookExtensionInstallation(
    extension: RebookExtension | RebookExtensionManifest,
    installation: Omit<RebookExtensionInstallation, 'id' | 'version'> = {},
): RebookExtensionInstallation {
    const manifest = assertRebookExtensionManifest(isRebookExtension(extension) ? extension.manifest : extension)
    return {
        id: manifest.id,
        version: manifest.version,
        enabled: true,
        ...installation,
    }
}

export class RebookExtensionManager {
    private readonly catalog: RebookExtensionCatalog
    private readonly installations = new Map<string, RebookExtensionInstallation>()
    private readonly now: () => string

    constructor(options: RebookExtensionManagerOptions = {}) {
        this.catalog = options.catalog instanceof RebookExtensionCatalog
            ? options.catalog
            : createRebookExtensionCatalog(options.catalog ?? [])
        this.now = options.now ?? (() => new Date().toISOString())
        this.loadInstallations(options.installations)
    }

    getCatalog(): RebookExtensionCatalog {
        return this.catalog
    }

    upsertCatalogEntry(entry: RebookExtensionCatalogEntry): RebookExtensionCatalogEntry {
        return this.catalog.upsert(entry)
    }

    getCatalogEntry(id: string): RebookExtensionCatalogEntry | undefined {
        return this.catalog.get(id)
    }

    listCatalogEntries(query: RebookExtensionCatalogQuery = {}): readonly RebookExtensionCatalogEntry[] {
        return this.catalog.list(query)
    }

    listItems(query: RebookExtensionCatalogQuery = {}): readonly RebookExtensionCatalogItem[] {
        return this.catalog.items(this.listInstallations(), query)
    }

    getItem(id: string): RebookExtensionCatalogItem | undefined {
        return this.listItems().find(item => item.manifest.id === id)
    }

    install(
        extension: RebookExtension | RebookExtensionManifest | string,
        options: RebookExtensionManagerInstallOptions = {},
    ): RebookExtensionInstallation {
        const manifest = this.resolveInstallManifest(extension)
        if (typeof extension !== 'string' && !this.catalog.has(manifest.id)) {
            this.catalog.upsert(createRebookExtensionCatalogEntry(manifest, {
                source: options.source ?? 'local',
            }))
        }
        const existing = this.installations.get(manifest.id)
        const now = this.now()
        const installation: RebookExtensionInstallation = {
            id: manifest.id,
            version: options.version ?? manifest.version,
            enabled: options.enabled ?? existing?.enabled ?? true,
            source: options.source ?? existing?.source ?? this.catalog.get(manifest.id)?.source,
            installedAt: options.installedAt ?? existing?.installedAt ?? now,
            updatedAt: options.updatedAt ?? now,
        }
        this.installations.set(manifest.id, installation)
        return installation
    }

    uninstall(id: string): boolean {
        return this.installations.delete(id)
    }

    enable(id: string): RebookExtensionInstallation {
        return this.setEnabled(id, true)
    }

    disable(id: string): RebookExtensionInstallation {
        return this.setEnabled(id, false)
    }

    setEnabled(id: string, enabled: boolean): RebookExtensionInstallation {
        const existing = this.installations.get(id)
        if (!existing) throw new Error(`Rebook extension "${id}" is not installed.`)
        const installation = {
            ...existing,
            enabled,
            updatedAt: this.now(),
        } satisfies RebookExtensionInstallation
        this.installations.set(id, installation)
        return installation
    }

    getInstallation(id: string): RebookExtensionInstallation | undefined {
        return this.installations.get(id)
    }

    listInstallations(): readonly RebookExtensionInstallation[] {
        return Array.from(this.installations.values())
    }

    isInstalled(id: string): boolean {
        return this.installations.has(id)
    }

    isEnabled(id: string): boolean {
        const installation = this.installations.get(id)
        return Boolean(installation && installation.enabled !== false)
    }

    toJSON(): readonly RebookExtensionInstallation[] {
        return this.listInstallations()
    }

    loadInstallations(installations: readonly RebookExtensionInstallation[] | undefined): void {
        this.installations.clear()
        for (const installation of installations ?? []) {
            if (!installation?.id) continue
            this.installations.set(installation.id, { ...installation })
        }
    }

    clearInstallations(): void {
        this.installations.clear()
    }

    private resolveInstallManifest(extension: RebookExtension | RebookExtensionManifest | string): RebookExtensionManifest {
        if (typeof extension === 'string') {
            const entry = this.catalog.get(extension)
            if (!entry) throw new Error(`Rebook extension "${extension}" is not in the catalog.`)
            return entry.manifest
        }
        return assertRebookExtensionManifest(isRebookExtension(extension) ? extension.manifest : extension)
    }
}

export function createRebookExtensionManager(options: RebookExtensionManagerOptions = {}): RebookExtensionManager {
    return new RebookExtensionManager(options)
}

export function assertRebookExtensionManifest(manifest: RebookExtensionManifest): RebookExtensionManifest {
    if (!manifest || typeof manifest !== 'object') {
        throw new Error('Rebook extension manifest must be an object.')
    }
    assertNonEmptyString(manifest.id, 'id')
    assertNonEmptyString(manifest.name, 'name')
    assertNonEmptyString(manifest.version, 'version')
    assertRebookExtensionContributions(manifest)
    return manifest
}

function assertNonEmptyString(value: unknown, field: string): asserts value is string {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`Rebook extension manifest field "${field}" must be a non-empty string.`)
    }
}

function assertMissingExtensionManifest(): never {
    throw new Error('Rebook extension module factory requires a manifest from the module or catalog entry.')
}

const validSettingTypes = new Set<RebookExtensionSettingType>([
    'string',
    'number',
    'integer',
    'boolean',
    'array',
    'object',
])

function assertRebookExtensionContributions(manifest: RebookExtensionManifest): void {
    const contributes = manifest.contributes
    if (contributes === undefined) return
    if (!contributes || typeof contributes !== 'object') {
        throw new Error(`Rebook extension "${manifest.id}" contributions must be an object.`)
    }
    assertNamedContributionArray(manifest.id, 'commands', contributes.commands)
    assertNamedContributionArray(manifest.id, 'panels', contributes.panels)
    assertNamedContributionArray(manifest.id, 'tools', contributes.tools)
    if (contributes.settings !== undefined) {
        if (!contributes.settings || typeof contributes.settings !== 'object' || Array.isArray(contributes.settings)) {
            throw new Error(`Rebook extension "${manifest.id}" settings contribution must be an object.`)
        }
        for (const [key, setting] of Object.entries(contributes.settings)) {
            assertNonEmptyString(key, `contributes.settings key for ${manifest.id}`)
            if (!setting || typeof setting !== 'object') {
                throw new Error(`Rebook extension "${manifest.id}" setting "${key}" must be an object.`)
            }
            if (!validSettingTypes.has(setting.type)) {
                throw new Error(`Rebook extension "${manifest.id}" setting "${key}" has unsupported type "${String(setting.type)}".`)
            }
        }
    }
}

function assertNamedContributionArray(
    extensionId: string,
    field: 'commands' | 'panels' | 'tools',
    contributions: readonly { readonly id: string; readonly title: string }[] | undefined,
): void {
    if (contributions === undefined) return
    if (!Array.isArray(contributions)) {
        throw new Error(`Rebook extension "${extensionId}" ${field} contribution must be an array.`)
    }
    for (const [index, contribution] of contributions.entries()) {
        if (!contribution || typeof contribution !== 'object') {
            throw new Error(`Rebook extension "${extensionId}" ${field}[${index}] must be an object.`)
        }
        assertNonEmptyString(contribution.id, `contributes.${field}[${index}].id`)
        assertNonEmptyString(contribution.title, `contributes.${field}[${index}].title`)
    }
}

function normalizeCatalogDocument(
    input: unknown,
    options: RebookExtensionCatalogParseOptions,
): { entries: readonly unknown[]; source?: RebookExtensionCatalogSource } {
    if (Array.isArray(input)) return { entries: input, source: options.source }
    if (!input || typeof input !== 'object') {
        throw new Error('Rebook extension catalog JSON must be an array or object.')
    }
    const document = input as Record<string, unknown>
    const schemaVersion = document.schemaVersion
    if (schemaVersion !== undefined && schemaVersion !== 1) {
        throw new Error(`Unsupported rebook extension catalog schema version "${String(schemaVersion)}".`)
    }
    const entries = document.entries ?? document.extensions
    if (!Array.isArray(entries)) {
        throw new Error('Rebook extension catalog JSON must contain an "entries" or "extensions" array.')
    }
    const source = typeof document.source === 'string' ? document.source : options.source
    return { entries, source }
}

function normalizeCatalogEntry(
    input: unknown,
    documentSource: RebookExtensionCatalogSource | undefined,
    index: number,
): RebookExtensionCatalogEntry {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new Error(`Rebook extension catalog entry at index ${index} must be an object.`)
    }
    const entry = input as Record<string, unknown>
    if (!entry.manifest || typeof entry.manifest !== 'object' || Array.isArray(entry.manifest)) {
        throw new Error(`Rebook extension catalog entry at index ${index} must contain a manifest object.`)
    }
    const normalized: RebookExtensionCatalogEntry = {
        manifest: assertRebookExtensionManifest(entry.manifest as RebookExtensionManifest),
        source: typeof entry.source === 'string' ? entry.source : documentSource,
        installUrl: readOptionalString(entry.installUrl, `entries[${index}].installUrl`),
        verified: readOptionalBoolean(entry.verified, `entries[${index}].verified`),
        publishedAt: readOptionalString(entry.publishedAt, `entries[${index}].publishedAt`),
        updatedAt: readOptionalString(entry.updatedAt, `entries[${index}].updatedAt`),
    }
    return normalized
}

function readOptionalString(value: unknown, field: string): string | undefined {
    if (value === undefined) return undefined
    if (typeof value !== 'string') throw new Error(`Rebook extension catalog field "${field}" must be a string.`)
    return value
}

function readOptionalBoolean(value: unknown, field: string): boolean | undefined {
    if (value === undefined) return undefined
    if (typeof value !== 'boolean') throw new Error(`Rebook extension catalog field "${field}" must be a boolean.`)
    return value
}

function createScopedCommandService(
    registry: RebookExtensionCommandRegistry,
    manifest: RebookExtensionManifest,
    subscriptions: RebookDisposable[],
): RebookExtensionCommandService {
    return {
        registerCommand(id, handler) {
            const disposable = registry.registerExtensionCommand(manifest, id, handler)
            subscriptions.push(disposable)
            return disposable
        },
        executeCommand(id, ...args) {
            return registry.executeCommand(id, ...args)
        },
        hasCommand(id) {
            return registry.hasCommand(id)
        },
        listCommands() {
            return registry.listCommands()
        },
    }
}

function createScopedSettingsService(
    registry: RebookExtensionSettingsRegistry,
    manifest: RebookExtensionManifest,
): RebookExtensionSettingsService {
    return {
        get(key, fallback) {
            return registry.get(manifest.id, key, fallback)
        },
        update(key, value) {
            registry.update(manifest.id, key, value)
        },
        inspect(key) {
            return registry.inspect(manifest.id, key)
        },
        list() {
            return registry.list(manifest.id)
        },
    }
}

function disposeRebookDisposables(disposables: readonly RebookDisposable[]): void {
    const errors: unknown[] = []
    for (const disposable of [...disposables].reverse()) {
        try {
            disposable.dispose()
        } catch (error) {
            errors.push(error)
        }
    }
    if (errors.length) {
        throw new Error(`Failed to dispose ${errors.length} rebook extension subscription(s).`)
    }
}

function createSettingStorageKey(extensionId: string, key: string): string {
    assertNonEmptyString(extensionId, 'extension id')
    assertNonEmptyString(key, 'setting key')
    return `${extensionId}\u0000${key}`
}

function splitSettingStorageKey(storedKey: string): [extensionId: string, key: string] {
    const separatorIndex = storedKey.indexOf('\u0000')
    if (separatorIndex < 0) return [storedKey, '']
    return [storedKey.slice(0, separatorIndex), storedKey.slice(separatorIndex + 1)]
}

function assertSettingValue(
    extensionId: string,
    key: string,
    contribution: RebookExtensionSettingContribution,
    value: unknown,
): void {
    if (!settingValueMatchesType(contribution.type, value)) {
        throw new Error(`Rebook extension "${extensionId}" setting "${key}" must be ${contribution.type}.`)
    }
    if (contribution.enum?.length && !contribution.enum.some(item => Object.is(item, value))) {
        throw new Error(`Rebook extension "${extensionId}" setting "${key}" must be one of its declared enum values.`)
    }
}

function settingValueMatchesType(type: RebookExtensionSettingType, value: unknown): boolean {
    switch (type) {
        case 'string':
            return typeof value === 'string'
        case 'number':
            return typeof value === 'number' && Number.isFinite(value)
        case 'integer':
            return typeof value === 'number' && Number.isInteger(value)
        case 'boolean':
            return typeof value === 'boolean'
        case 'array':
            return Array.isArray(value)
        case 'object':
            return Boolean(value && typeof value === 'object' && !Array.isArray(value))
        default:
            return false
    }
}

function toPluginArray(
    value: void | RebookPlugin | readonly RebookPlugin[] | undefined,
): RebookPlugin[] {
    if (!value) return []
    return typeof value === 'function' ? [value] : [...value]
}

function containsEvery<T>(values: readonly T[] | undefined, expected: readonly T[]): boolean {
    if (!expected.length) return true
    if (!values?.length) return false
    const set = new Set(values)
    return expected.every(value => set.has(value))
}

function catalogEntryMatchesText(entry: RebookExtensionCatalogEntry, rawQuery: string): boolean {
    const query = rawQuery.trim().toLowerCase()
    if (!query) return true
    return [
        entry.manifest.id,
        entry.manifest.name,
        entry.manifest.displayName,
        entry.manifest.description,
        entry.manifest.publisher,
        ...(entry.manifest.keywords ?? []),
        ...(entry.manifest.categories ?? []),
        ...(entry.manifest.capabilities ?? []),
    ].some(value => value?.toLowerCase().includes(query))
}
