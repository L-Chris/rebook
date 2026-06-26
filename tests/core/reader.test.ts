import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ReaderSession, type TOCViewItem } from '../../src/core/reader'
import type { BlockWindowEvent, Book, RelocateEvent } from '../../src/core/types'
import type { LayoutMode, ReaderMark, Renderer, RendererStyles } from '../../src/core/renderer'
import type { PageSurface } from '../../src/core/page-surface'
import { defineRebookExtension, defineRebookPlugin } from '../../src/core/extensions'
import { createStaticTextProvider } from '../../src/core/text-provider'
import { EPUBParser } from '../../src/parsers/epub'
import { NodeDOMAdapter, NodeURLFactory } from '../../src/adapters/node'

class FakeRenderer implements Renderer {
    private book: Book | null = null
    private location: RelocateEvent | null = null
    private surface: PageSurface | null = null
    private readonly listeners = new Map<string, Set<(event: any) => void>>()

    async open(book: Book): Promise<void> {
        this.book = book
        this.location = { index: 0, fraction: 0, totalFraction: 0 }
    }

    async goTo(): Promise<void> {}
    async next(): Promise<void> {}
    async prev(): Promise<void> {}
    async goToFraction(): Promise<void> {}
    setStyles(_styles: RendererStyles): void {}
    setLayout(_mode: LayoutMode): void {}
    setSpread(_maxColumns: number): void {}
    setMark(_mark: ReaderMark): void {}
    removeMark(_id: string): void {}
    clearMarks(_kind?: string): void {}
    getMarks(): ReaderMark[] { return [] }
    getLocation(): RelocateEvent | null { return this.location }
    getCurrentSurface(): PageSurface | null { return this.surface }
    getSectionFractions(): number[] {
        const count = this.book?.sections.length ?? 0
        return Array.from({ length: count + 1 }, (_, index) => count > 0 ? index / count : 0)
    }
    on(event: string, listener: (event: any) => void): void {
        const listeners = this.listeners.get(event) ?? new Set()
        listeners.add(listener)
        this.listeners.set(event, listeners)
    }
    off(event: string, listener: (event: any) => void): void {
        this.listeners.get(event)?.delete(listener)
    }
    destroy(): void {}

    setLocation(location: RelocateEvent): void {
        this.location = location
    }

    setSurface(surface: PageSurface | null): void {
        this.surface = surface
    }

    emit(event: 'block-window', payload: BlockWindowEvent): void
    emit(event: string, payload: unknown): void {
        for (const listener of this.listeners.get(event) ?? []) {
            listener(payload)
        }
    }
}

describe('ReaderSession', () => {
    it('dispatches renderer block windows to book consumers', async () => {
        const renderer = new FakeRenderer()
        const receivedByConsumer: BlockWindowEvent[] = []
        const receivedByListener: BlockWindowEvent[] = []
        const book: Book = {
            blockWindowConsumers: [{
                pageCount: 1,
                onBlockWindow: event => receivedByConsumer.push(event),
            }],
            sections: [],
        }
        const reader = new ReaderSession({ createRenderer: () => renderer })
        reader.on('block-window', event => receivedByListener.push(event))
        await reader.openBook(book)

        const event: BlockWindowEvent = { index: 0, blockIds: ['b1'], pageCount: 1, reason: 'test' }
        renderer.emit('block-window', event)

        expect(receivedByConsumer).toEqual([event])
        expect(receivedByListener).toEqual([event])
    })

    it('resolves active TOC items efficiently for books with many sections', async () => {
        const renderer = new FakeRenderer()
        const sectionCount = 2_050
        const book: Book = {
            sections: Array.from({ length: sectionCount }, (_, index) => ({
                id: `OEBPS/Text/chapter_${index}.html`,
                size: 1_000,
                load: () => `<p>${index}</p>`,
            })),
            toc: Array.from({ length: sectionCount }, (_, index) => ({
                label: `Chapter ${index}`,
                href: `Text/chapter_${index}.html`,
            })),
            splitTOCHref(href) {
                return [`OEBPS/${href}`, null]
            },
            destroy() {},
        }
        const reader = new ReaderSession({ createRenderer: () => renderer })
        await reader.openBook(book)
        renderer.setLocation({ index: 1_500, fraction: 0, totalFraction: 0.73 })

        const active = reader.getCurrentTOCItem(renderer.getLocation())
        const items = reader.getTOCViewItems({ location: renderer.getLocation() })

        expect(active?.href).toBe('Text/chapter_1500.html')
        expect(items).toHaveLength(sectionCount)
        expect(flattenTOCViewItems(items).find(item => item.active)?.target).toBe('Text/chapter_1500.html')
        expect(items[1_500].target).toBe('Text/chapter_1500.html')
    })

    it('marks active TOC view items for real EPUB books with different TOC shapes', async () => {
        const filenames = [
            '1.epub',
            'Structured Writing Rhetoric and Process.epub',
            '洛丽塔.epub',
            '我在精神病院学斩神.epub',
        ]

        for (const filename of filenames) {
            const data = await readFile(`data/${filename}`)
            const parser = new EPUBParser()
            const book = await parser.parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), {
                domAdapter: new NodeDOMAdapter(),
                urlFactory: new NodeURLFactory(),
            })
            const tocItems = flattenTOCItems(book.toc ?? [])
            expect(tocItems.length, filename).toBeGreaterThan(0)

            const sampleItems = [
                tocItems[0],
                tocItems[Math.floor(tocItems.length / 2)],
                tocItems[tocItems.length - 1],
            ]
            const renderer = new FakeRenderer()
            const reader = new ReaderSession({ createRenderer: () => renderer })
            await reader.openBook(book)

            for (const item of sampleItems) {
                const resolved = book.resolveHref?.(item.href)
                expect(resolved?.index, `${filename}: ${item.href}`).toEqual(expect.any(Number))
                renderer.setLocation({
                    index: resolved!.index,
                    fraction: 0,
                    totalFraction: resolved!.index / book.sections.length,
                    tocItem: undefined,
                })

                const active = flattenTOCViewItems(reader.getTOCViewItems({ location: renderer.getLocation() }))
                    .find(viewItem => viewItem.active)
                expect(active, `${filename}: ${item.href}`).toBeTruthy()
            }

            book.destroy?.()
        }
    }, 10000)

    it('falls back to the current section TOC item when a browser relocate event has no toc item', async () => {
        const data = await readFile('data/洛丽塔.epub')
        const parser = new EPUBParser()
        const book = await parser.parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), {
            domAdapter: new NodeDOMAdapter(),
            urlFactory: new NodeURLFactory(),
        })
        const renderer = new FakeRenderer()
        const reader = new ReaderSession({ createRenderer: () => renderer })
        await reader.openBook(book)

        for (const [index, label] of [
            [1, '洛丽塔'],
            [2, '版权信息'],
            [3, '目录'],
            [4, '序文'],
        ] as const) {
            renderer.setLocation({ index, fraction: 0, totalFraction: 0, tocItem: undefined })
            const location = renderer.getLocation()
            const active = reader.getCurrentTOCItem(location)
            const viewActive = flattenTOCViewItems(reader.getTOCViewItems({ location })).find(item => item.active)

            expect(active?.label, `index ${index}`).toBe(label)
            expect(viewActive?.label, `index ${index}`).toBe(label)
        }

        book.destroy?.()
    }, 10000)

    it('marks only the active TOC object when multiple items share a target', async () => {
        const renderer = new FakeRenderer()
        const intro = { label: 'Intro', href: 'pdf:page:0' }
        const chapter = { label: 'Chapter', href: 'pdf:page:0' }
        const book: Book = {
            sections: [],
            toc: [intro, chapter],
            resolveHref: href => ({ index: href === 'pdf:page:0' ? 0 : -1 }),
            destroy() {},
        }
        const reader = new ReaderSession({ createRenderer: () => renderer })
        await reader.openBook(book)
        renderer.setLocation({ index: 0, fraction: 0, totalFraction: 0, tocItem: chapter })

        const activeItems = flattenTOCViewItems(reader.getTOCViewItems({ location: renderer.getLocation() }))
            .filter(item => item.active)

        expect(activeItems.map(item => item.label)).toEqual(['Chapter'])
    })

    it('exposes current surface text through the reader core', async () => {
        const renderer = new FakeRenderer()
        const reader = new ReaderSession({ createRenderer: () => renderer })
        await reader.openBook({ sections: [] })

        const chunk = {
            id: 'current-text',
            text: 'current surface provider',
            location: { type: 'fixed' as const, format: 'pdf', pageIndex: 0 },
        }
        const surface: PageSurface = {
            id: 'surface-1',
            kind: 'fixed-page',
            width: 100,
            height: 120,
            scale: 1,
            layers: [],
            textProvider: createStaticTextProvider([chunk]),
        }
        renderer.setSurface(surface)

        expect(reader.getCurrentSurface()).toBe(surface)
        expect(reader.getCurrentTextProvider()).toBe(surface.textProvider)
        expect(await reader.getCurrentText()).toEqual([chunk])
        expect(await reader.searchCurrentText('provider')).toEqual([{
            chunk,
            range: { start: chunk.location },
            score: 1,
        }])

        renderer.setSurface(null)
        expect(await reader.getCurrentText()).toEqual([])
        expect(await reader.searchCurrentText('provider')).toEqual([])
    })

    it('lists extension manifests installed through reader config', async () => {
        const extension = defineRebookPlugin({
            id: 'example.config-extension',
            name: 'Config Extension',
            version: '1.0.0',
            displayName: 'Config Extension',
            capabilities: ['book.transform'],
        }, input => ({ ...input, metadata: { title: 'configured' } }))
        const renderer = new FakeRenderer()
        const reader = new ReaderSession({
            createRenderer: () => renderer,
            plugins: [extension],
        })

        await reader.openBook({ sections: [] })

        expect(reader.hasExtension('example.config-extension')).toBe(true)
        expect(reader.getExtensionManifests()).toEqual([extension.manifest])
        expect(reader.getMetadata()?.title).toBe('configured')
    })

    it('installs and uninstalls extensions for future book opens', async () => {
        const extension = defineRebookPlugin({
            id: 'example.runtime-extension',
            name: 'Runtime Extension',
            version: '1.0.0',
        }, input => ({ ...input, metadata: { title: 'installed' } }))
        const renderer = new FakeRenderer()
        const reader = new ReaderSession({ createRenderer: () => renderer })

        await reader.openBook({ sections: [], metadata: { title: 'plain' } })
        expect(reader.getMetadata()?.title).toBe('plain')

        reader.installExtension(extension)
        await reader.openBook({ sections: [], metadata: { title: 'plain' } })
        expect(reader.getMetadata()?.title).toBe('installed')

        expect(reader.uninstallExtension('example.runtime-extension')).toBe(true)
        await reader.openBook({ sections: [], metadata: { title: 'plain' } })
        expect(reader.getMetadata()?.title).toBe('plain')
    })

    it('replaces installed extensions without changing plugin order', async () => {
        const first = defineRebookPlugin({
            id: 'example.replace-extension',
            name: 'Replace Extension',
            version: '1.0.0',
        }, input => ({ ...input, metadata: { title: 'first' } }))
        const second = defineRebookPlugin({
            id: 'example.replace-extension',
            name: 'Replace Extension',
            version: '2.0.0',
        }, input => ({ ...input, metadata: { title: 'second' } }))
        const suffix = defineRebookPlugin({
            id: 'example.suffix-extension',
            name: 'Suffix Extension',
            version: '1.0.0',
        }, input => ({ ...input, metadata: { ...input.metadata, subtitle: `${input.metadata?.title}-suffix` } }))
        const renderer = new FakeRenderer()
        const reader = new ReaderSession({ createRenderer: () => renderer })

        reader.installExtension(first)
        reader.installExtension(suffix)
        reader.installExtension(second, { replace: true })
        await reader.openBook({ sections: [] })

        expect(reader.getExtensionManifests().map(manifest => manifest.version)).toEqual(['2.0.0', '1.0.0'])
        expect(reader.getMetadata()).toMatchObject({
            title: 'second',
            subtitle: 'second-suffix',
        })
    })

    it('activates extension commands and removes them when the extension is uninstalled', async () => {
        const disposed: string[] = []
        const extension = defineRebookExtension({
            manifest: {
                id: 'example.reader-command',
                name: 'Reader Command',
                version: '1.0.0',
                contributes: {
                    commands: [
                        { id: 'example.reader-command.describe', title: 'Describe Current Book' },
                    ],
                },
            },
            activate: context => {
                context.subscriptions.push({ dispose: () => disposed.push('reader-command') })
                context.commands.registerCommand('example.reader-command.describe', title => ({
                    extensionId: context.extensionId,
                    title,
                }))
            },
        })
        const renderer = new FakeRenderer()
        const reader = new ReaderSession({ createRenderer: () => renderer })

        reader.installExtension(extension)
        expect(reader.getExtensionContributions().commands.map(command => command.contribution.id)).toEqual([
            'example.reader-command.describe',
        ])

        await reader.openBook({ sections: [], metadata: { title: 'Command Book' } })

        expect(reader.hasExtensionCommand('example.reader-command.describe')).toBe(true)
        expect(reader.getExtensionCommands().map(command => command.extensionId)).toEqual(['example.reader-command'])
        await expect(reader.executeExtensionCommand('example.reader-command.describe', reader.getMetadata()?.title))
            .resolves.toEqual({
                extensionId: 'example.reader-command',
                title: 'Command Book',
            })

        expect(reader.uninstallExtension('example.reader-command')).toBe(true)
        expect(reader.hasExtensionCommand('example.reader-command.describe')).toBe(false)
        expect(disposed).toEqual(['reader-command'])
    })

    it('exposes extension settings through the reader host', async () => {
        const extension = defineRebookExtension({
            manifest: {
                id: 'example.reader-settings',
                name: 'Reader Settings',
                version: '1.0.0',
                contributes: {
                    settings: {
                        title: { type: 'string', default: 'Default Reader Title' },
                        enabled: { type: 'boolean', default: true },
                    },
                },
            },
            activate: context => input => ({
                ...input,
                metadata: {
                    ...input.metadata,
                    title: context.settings.get('title'),
                },
            }),
        })
        const renderer = new FakeRenderer()
        const reader = new ReaderSession({ createRenderer: () => renderer })

        reader.installExtension(extension)

        expect(reader.getExtensionSettings('example.reader-settings').map(setting => setting.key)).toEqual([
            'title',
            'enabled',
        ])
        expect(reader.getExtensionSetting('example.reader-settings', 'title')).toBe('Default Reader Title')

        reader.updateExtensionSetting('example.reader-settings', 'title', 'Configured Reader Title')
        await reader.openBook({ sections: [] })

        expect(reader.getMetadata()?.title).toBe('Configured Reader Title')
        expect(reader.getExtensionSettingsSnapshot()).toEqual({
            'example.reader-settings': {
                title: 'Configured Reader Title',
            },
        })
    })
})

function flattenTOCItems(items: readonly NonNullable<Book['toc']>[number][]): NonNullable<Book['toc']>[number][] {
    return items.flatMap(item => item.subitems?.length ? [item, ...flattenTOCItems(item.subitems)] : [item])
}

function flattenTOCViewItems(items: readonly TOCViewItem[]): TOCViewItem[] {
    return items.flatMap(item => item.children?.length ? [item, ...flattenTOCViewItems(item.children)] : [item])
}
