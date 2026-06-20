import { describe, expect, it } from 'vitest'
import type { Book, RebookPlugin } from '../../src/core/types'
import { applyRebookPlugins } from '../../src/core/plugins'
import {
    createRebookExtensionCatalog,
    createRebookExtensionCatalogEntry,
    createRebookExtensionCommandRegistry,
    createRebookExtensionHost,
    createRebookExtensionInstallation,
    createRebookExtensionManager,
    createRebookExtensionRegistry,
    createRebookExtensionSettingsRegistry,
    defineRebookExtension,
    defineRebookPlugin,
    getRebookExtensionContributionIndex,
    getRebookExtensionManifest,
    createRebookExtensionCatalogFromJSON,
    loadRebookExtensionModule,
    normalizeRebookExtensionModule,
    parseRebookExtensionCatalogEntries,
    resolveRebookPlugins,
} from '../../src/core/extensions'

const book: Book = { sections: [] }

describe('rebook extensions', () => {
    it('keeps legacy function plugins usable', async () => {
        const plugin: RebookPlugin = input => ({
            ...input,
            metadata: { title: 'legacy' },
        })

        const result = await applyRebookPlugins(book, [plugin])

        expect(result.metadata?.title).toBe('legacy')
    })

    it('wraps a book transform in installable extension metadata', async () => {
        const extension = defineRebookPlugin({
            id: 'example.uppercase-title',
            name: 'Uppercase Title',
            version: '1.0.0',
            capabilities: ['book.transform'],
        }, input => ({
            ...input,
            metadata: { title: 'extension' },
        }))

        const result = await applyRebookPlugins(book, [extension])

        expect(getRebookExtensionManifest(extension)?.id).toBe('example.uppercase-title')
        expect(result.metadata?.title).toBe('extension')
    })

    it('activates extension packages and applies returned plugins in order', async () => {
        const extension = defineRebookExtension({
            manifest: {
                id: 'example.activation',
                name: 'Activation',
                version: '1.0.0',
                capabilities: ['book.transform'],
            },
            plugin: input => ({ ...input, metadata: { title: 'static' } }),
            activate: context => [
                input => ({ ...input, metadata: { ...input.metadata, subtitle: context.extensionId } }),
                input => ({ ...input, metadata: { ...input.metadata, language: 'en' } }),
            ],
        })

        const result = await applyRebookPlugins(book, [extension])

        expect(result.metadata).toMatchObject({
            title: 'static',
            subtitle: 'example.activation',
            language: 'en',
        })
    })

    it('provides a registry for installed extensions', async () => {
        const first = defineRebookPlugin({
            id: 'example.first',
            name: 'First',
            version: '1.0.0',
        }, input => ({ ...input, metadata: { title: 'first' } }))
        const second = defineRebookPlugin({
            id: 'example.second',
            name: 'Second',
            version: '1.0.0',
        }, input => ({ ...input, metadata: { ...input.metadata, subtitle: 'second' } }))
        const registry = createRebookExtensionRegistry([first])

        registry.install(second)
        const result = await applyRebookPlugins(book, await registry.getPlugins())

        expect(registry.manifests().map(manifest => manifest.id)).toEqual([
            'example.first',
            'example.second',
        ])
        expect(result.metadata).toMatchObject({ title: 'first', subtitle: 'second' })
    })

    it('rejects invalid manifests before installation', () => {
        expect(() => defineRebookExtension({
            manifest: { id: '', name: 'Broken', version: '1.0.0' },
        })).toThrow(/id/)
    })

    it('rejects invalid contribution declarations before installation', () => {
        expect(() => defineRebookExtension({
            manifest: {
                id: 'example.invalid-contributes',
                name: 'Invalid Contributions',
                version: '1.0.0',
                contributes: {
                    commands: [{ id: '', title: 'Broken' }],
                },
            },
        })).toThrow(/commands/)

        expect(() => defineRebookExtension({
            manifest: {
                id: 'example.invalid-setting',
                name: 'Invalid Setting',
                version: '1.0.0',
                contributes: {
                    settings: {
                        mode: { type: 'date' },
                    },
                },
            } as any,
        })).toThrow(/unsupported type/)
    })

    it('normalizes mixed extension and legacy plugin inputs', async () => {
        const extension = defineRebookPlugin({
            id: 'example.manifest',
            name: 'Manifest',
            version: '1.0.0',
        }, input => input)
        const legacy: RebookPlugin = input => input

        const plugins = await resolveRebookPlugins([extension, legacy])

        expect(plugins).toHaveLength(2)
    })

    it('indexes marketplace catalog entries independently from loaded extension code', () => {
        const catalog = createRebookExtensionCatalog([
            createRebookExtensionCatalogEntry({
                id: 'example.chat',
                name: 'Chat',
                version: '1.0.0',
                publisher: 'example',
                categories: ['ai', 'reader'],
                capabilities: ['ai.chat', 'content.read'],
                keywords: ['assistant'],
            }, {
                source: 'marketplace',
                installUrl: 'https://market.example/extensions/chat.js',
                verified: true,
            }),
            createRebookExtensionCatalogEntry({
                id: 'example.theme',
                name: 'Theme',
                version: '1.0.0',
                categories: ['theme'],
                capabilities: ['theme'],
            }, { source: 'marketplace' }),
        ])

        expect(catalog.search('assistant').map(entry => entry.manifest.id)).toEqual(['example.chat'])
        expect(catalog.list({ categories: ['theme'] }).map(entry => entry.manifest.id)).toEqual(['example.theme'])
        expect(catalog.list({ capabilities: ['ai.chat'] }).map(entry => entry.manifest.id)).toEqual(['example.chat'])
        expect(catalog.get('example.chat')?.installUrl).toBe('https://market.example/extensions/chat.js')
    })

    it('parses marketplace catalog JSON documents into catalog entries', () => {
        const entries = parseRebookExtensionCatalogEntries({
            schemaVersion: 1,
            source: 'marketplace',
            entries: [
                {
                    manifest: {
                        id: 'example.remote-chat',
                        name: 'Remote Chat',
                        version: '1.0.0',
                        categories: ['ai'],
                        capabilities: ['ai.chat'],
                    },
                    installUrl: 'https://market.example/remote-chat.mjs',
                    verified: true,
                    updatedAt: '2026-01-01T00:00:00.000Z',
                },
                {
                    manifest: {
                        id: 'example.local-theme',
                        name: 'Local Theme',
                        version: '1.0.0',
                        categories: ['theme'],
                    },
                    source: 'local',
                },
            ],
        })

        expect(entries.map(entry => ({
            id: entry.manifest.id,
            source: entry.source,
            verified: entry.verified,
        }))).toEqual([
            { id: 'example.remote-chat', source: 'marketplace', verified: true },
            { id: 'example.local-theme', source: 'local', verified: undefined },
        ])

        const catalog = createRebookExtensionCatalogFromJSON(entries, { source: 'remote' })
        expect(catalog.list({ capabilities: ['ai.chat'] }).map(entry => entry.installUrl))
            .toEqual(['https://market.example/remote-chat.mjs'])
    })

    it('normalizes marketplace extension module exports into extension packages', async () => {
        const plugin: RebookPlugin = input => ({
            ...input,
            metadata: { title: 'remote module' },
        })
        const extension = await normalizeRebookExtensionModule({
            default: {
                manifest: {
                    id: 'example.remote-module',
                    name: 'Remote Module',
                    version: '1.0.0',
                },
                plugin,
            },
        })

        const result = await applyRebookPlugins(book, [extension])

        expect(extension.manifest.id).toBe('example.remote-module')
        expect(result.metadata?.title).toBe('remote module')
    })

    it('loads marketplace extension modules with catalog manifest fallback', async () => {
        const catalogEntry = createRebookExtensionCatalogEntry({
            id: 'example.remote-fallback',
            name: 'Remote Fallback',
            version: '1.0.0',
        }, {
            source: 'marketplace',
            installUrl: 'https://market.example/remote-fallback.mjs',
        })

        const extension = await loadRebookExtensionModule(
            catalogEntry.installUrl!,
            async installUrl => ({
                default: ({ manifest, catalogEntry, installUrl: contextInstallUrl }) => ({
                    manifest,
                    plugin: input => ({
                        ...input,
                        metadata: {
                            title: catalogEntry?.source,
                            subtitle: contextInstallUrl ?? installUrl,
                        },
                    }),
                }),
            }),
            { catalogEntry },
        )
        const result = await applyRebookPlugins(book, [extension])

        expect(extension.manifest.id).toBe('example.remote-fallback')
        expect(result.metadata).toMatchObject({
            title: 'marketplace',
            subtitle: 'https://market.example/remote-fallback.mjs',
        })
    })

    it('rejects marketplace modules whose runtime manifest id does not match the catalog', async () => {
        await expect(normalizeRebookExtensionModule({
            manifest: {
                id: 'example.actual',
                name: 'Actual',
                version: '1.0.0',
            },
        }, {
            manifest: {
                id: 'example.expected',
                name: 'Expected',
                version: '1.0.0',
            },
        })).rejects.toThrow(/id mismatch/)
    })

    it('rejects malformed marketplace catalog JSON', () => {
        expect(() => parseRebookExtensionCatalogEntries({
            schemaVersion: 2,
            entries: [],
        })).toThrow(/schema version/)

        expect(() => parseRebookExtensionCatalogEntries({
            schemaVersion: 1,
            entries: [{ installUrl: 'https://market.example/missing-manifest.mjs' }],
        })).toThrow(/manifest/)

        expect(() => parseRebookExtensionCatalogEntries([{
            manifest: {
                id: 'example.invalid-url-type',
                name: 'Invalid URL Type',
                version: '1.0.0',
            },
            installUrl: 42,
        }])).toThrow(/installUrl/)
    })

    it('merges installation state into catalog items for extension manager UIs', () => {
        const manifest = {
            id: 'example.installed',
            name: 'Installed',
            version: '2.0.0',
        }
        const catalog = createRebookExtensionCatalog([
            createRebookExtensionCatalogEntry(manifest, { source: 'local' }),
            createRebookExtensionCatalogEntry({
                id: 'example.available',
                name: 'Available',
                version: '1.0.0',
            }, { source: 'local' }),
        ])

        const items = catalog.items([
            createRebookExtensionInstallation(manifest, { enabled: false, installedAt: '2026-01-01T00:00:00.000Z' }),
        ])

        expect(items.map(item => ({
            id: item.manifest.id,
            installed: item.installed,
            enabled: item.enabled,
            installState: item.installState,
        }))).toEqual([
            { id: 'example.installed', installed: true, enabled: false, installState: 'disabled' },
            { id: 'example.available', installed: false, enabled: false, installState: 'available' },
        ])
        const installations = items.flatMap(item => item.installation ? [item.installation] : [])
        expect(catalog.items(installations, { installed: true })).toHaveLength(1)
    })

    it('manages catalog-backed extension installation state', () => {
        const manager = createRebookExtensionManager({
            now: () => '2026-01-01T00:00:00.000Z',
            catalog: [
                createRebookExtensionCatalogEntry({
                    id: 'example.marketplace',
                    name: 'Marketplace Extension',
                    version: '1.2.3',
                    categories: ['reader'],
                }, { source: 'marketplace', verified: true }),
            ],
        })

        expect(manager.listItems()[0]).toMatchObject({
            installed: false,
            enabled: false,
            installState: 'available',
        })

        const installed = manager.install('example.marketplace')

        expect(installed).toMatchObject({
            id: 'example.marketplace',
            version: '1.2.3',
            enabled: true,
            source: 'marketplace',
            installedAt: '2026-01-01T00:00:00.000Z',
        })
        expect(manager.isInstalled('example.marketplace')).toBe(true)
        expect(manager.isEnabled('example.marketplace')).toBe(true)

        manager.disable('example.marketplace')
        expect(manager.getItem('example.marketplace')).toMatchObject({
            installed: true,
            enabled: false,
            installState: 'disabled',
        })

        manager.enable('example.marketplace')
        expect(manager.listItems({ enabled: true }).map(item => item.manifest.id)).toEqual(['example.marketplace'])
        expect(manager.uninstall('example.marketplace')).toBe(true)
        expect(manager.listItems({ installed: true })).toEqual([])
    })

    it('snapshots and restores extension manager installations', () => {
        const manifest = {
            id: 'example.local-managed',
            name: 'Local Managed',
            version: '3.0.0',
            capabilities: ['reader.access'],
        }
        const manager = createRebookExtensionManager({ now: () => '2026-01-01T00:00:00.000Z' })

        manager.install(manifest, { enabled: false, source: 'local' })
        const snapshot = manager.toJSON()
        const restored = createRebookExtensionManager({
            catalog: manager.listCatalogEntries(),
            installations: snapshot,
        })

        expect(manager.getCatalogEntry('example.local-managed')?.manifest).toMatchObject(manifest)
        expect(restored.getInstallation('example.local-managed')).toMatchObject({
            id: 'example.local-managed',
            version: '3.0.0',
            enabled: false,
            source: 'local',
        })
        expect(restored.listItems({ installed: true }).map(item => item.manifest.id)).toEqual(['example.local-managed'])
    })

    it('collects typed command, panel, setting, and tool contributions', () => {
        const extension = defineRebookExtension({
            manifest: {
                id: 'example.reader-tools',
                name: 'Reader Tools',
                version: '1.0.0',
                contributes: {
                    commands: [
                        { id: 'example.reader-tools.open', title: 'Open Reader Tools', category: 'Reader' },
                    ],
                    panels: [
                        { id: 'example.reader-tools.sidebar', title: 'Reader Tools', location: 'sidebar' },
                    ],
                    settings: {
                        enabled: { type: 'boolean', default: true, scope: 'global' },
                        density: { type: 'string', enum: ['compact', 'comfortable'], default: 'comfortable' },
                    },
                    tools: [
                        { id: 'example.reader-tools.search', title: 'Search Current Book' },
                    ],
                },
            },
        })

        const index = getRebookExtensionContributionIndex([extension])
        const registry = createRebookExtensionRegistry([extension])

        expect(index.commands.map(item => item.contribution.id)).toEqual(['example.reader-tools.open'])
        expect(index.panels.map(item => item.contribution.location)).toEqual(['sidebar'])
        expect(index.settings.map(item => `${item.extensionId}:${item.key}`)).toEqual([
            'example.reader-tools:enabled',
            'example.reader-tools:density',
        ])
        expect(index.tools.map(item => item.contribution.id)).toEqual(['example.reader-tools.search'])
        expect(registry.contributions().commands[0]?.manifest.id).toBe('example.reader-tools')
    })

    it('registers and executes extension commands during activation', async () => {
        const host = createRebookExtensionHost()
        const extension = defineRebookExtension({
            manifest: {
                id: 'example.commands',
                name: 'Commands',
                version: '1.0.0',
                contributes: {
                    commands: [
                        { id: 'example.commands.echo', title: 'Echo' },
                    ],
                },
            },
            activate: context => {
                context.commands.registerCommand('example.commands.echo', value => ({
                    extensionId: context.extensionId,
                    value,
                }))
            },
        })

        await resolveRebookPlugins([extension], host)

        expect(host.commands.listCommands().map(command => command.id)).toEqual(['example.commands.echo'])
        await expect(host.commands.executeCommand('example.commands.echo', 'hello')).resolves.toEqual({
            extensionId: 'example.commands',
            value: 'hello',
        })
    })

    it('disposes extension subscriptions before reactivation', async () => {
        const host = createRebookExtensionHost()
        const disposed: string[] = []
        let activationCount = 0
        const extension = defineRebookExtension({
            manifest: {
                id: 'example.lifecycle',
                name: 'Lifecycle',
                version: '1.0.0',
            },
            activate: context => {
                activationCount += 1
                const label = `activation-${activationCount}`
                context.subscriptions.push({ dispose: () => disposed.push(label) })
                context.commands.registerCommand('example.lifecycle.current', () => label)
            },
        })

        await resolveRebookPlugins([extension], host)
        expect(host.subscriptions.count('example.lifecycle')).toBe(2)
        await expect(host.commands.executeCommand('example.lifecycle.current')).resolves.toBe('activation-1')

        await resolveRebookPlugins([extension], host)

        expect(disposed).toEqual(['activation-1'])
        expect(host.subscriptions.count('example.lifecycle')).toBe(2)
        await expect(host.commands.executeCommand('example.lifecycle.current')).resolves.toBe('activation-2')
    })

    it('rolls back subscriptions and commands when activation fails', async () => {
        const host = createRebookExtensionHost()
        const disposed: string[] = []
        const extension = defineRebookExtension({
            manifest: {
                id: 'example.failing-lifecycle',
                name: 'Failing Lifecycle',
                version: '1.0.0',
            },
            activate: context => {
                context.subscriptions.push({ dispose: () => disposed.push('custom') })
                context.commands.registerCommand('example.failing-lifecycle.command', () => 'stale')
                throw new Error('activation failed')
            },
        })

        await expect(resolveRebookPlugins([extension], host)).rejects.toThrow(/activation failed/)

        expect(disposed).toEqual(['custom'])
        expect(host.subscriptions.count('example.failing-lifecycle')).toBe(0)
        expect(host.commands.hasCommand('example.failing-lifecycle.command')).toBe(false)
    })

    it('provides extension settings defaults, updates, validation, and snapshots', () => {
        const registry = createRebookExtensionSettingsRegistry()
        const manifest = {
            id: 'example.settings',
            name: 'Settings',
            version: '1.0.0',
            contributes: {
                settings: {
                    mode: { type: 'string', default: 'compact', enum: ['compact', 'comfortable'] },
                    enabled: { type: 'boolean', default: true },
                    retries: { type: 'integer', default: 2 },
                },
            },
        } as const

        registry.registerExtension(manifest)

        expect(registry.get('example.settings', 'mode')).toBe('compact')
        expect(registry.inspect('example.settings', 'enabled')).toMatchObject({
            extensionId: 'example.settings',
            key: 'enabled',
            defaultValue: true,
            effectiveValue: true,
        })

        registry.update('example.settings', 'mode', 'comfortable')
        registry.update('example.settings', 'retries', 3)

        expect(registry.get('example.settings', 'mode')).toBe('comfortable')
        expect(registry.toJSON()).toEqual({
            'example.settings': {
                mode: 'comfortable',
                retries: 3,
            },
        })
        expect(() => registry.update('example.settings', 'mode', 'invalid')).toThrow(/enum/)
        expect(() => registry.update('example.settings', 'enabled', 'yes')).toThrow(/boolean/)

        const restored = createRebookExtensionSettingsRegistry()
        restored.registerExtension(manifest)
        restored.load(registry.toJSON())

        expect(restored.get('example.settings', 'mode')).toBe('comfortable')
        expect(restored.list('example.settings').map(setting => setting.key)).toEqual(['mode', 'enabled', 'retries'])
    })

    it('exposes scoped settings to extension activation', async () => {
        const host = createRebookExtensionHost()
        const extension = defineRebookExtension({
            manifest: {
                id: 'example.scoped-settings',
                name: 'Scoped Settings',
                version: '1.0.0',
                contributes: {
                    settings: {
                        title: { type: 'string', default: 'Default Title' },
                    },
                },
            },
            activate: context => input => ({
                ...input,
                metadata: {
                    title: context.settings.get('title'),
                },
            }),
        })

        host.settings.update('example.scoped-settings', 'title', 'Configured Title')
        const result = await applyRebookPlugins(book, [extension], host)

        expect(result.metadata?.title).toBe('Configured Title')
        expect(host.settings.inspect('example.scoped-settings', 'title').defaultValue).toBe('Default Title')
    })

    it('tracks command ownership and prevents cross-extension command id conflicts', () => {
        const registry = createRebookExtensionCommandRegistry()
        const first = {
            id: 'example.first-command-owner',
            name: 'First Command Owner',
            version: '1.0.0',
        }
        const second = {
            id: 'example.second-command-owner',
            name: 'Second Command Owner',
            version: '1.0.0',
        }

        const disposable = registry.registerExtensionCommand(first, 'example.shared-command', () => 'first')

        expect(registry.listCommands()[0]?.extensionId).toBe(first.id)
        expect(() => registry.registerExtensionCommand(second, 'example.shared-command', () => 'second'))
            .toThrow(/already registered/)

        disposable.dispose()
        expect(registry.hasCommand('example.shared-command')).toBe(false)
    })
})
