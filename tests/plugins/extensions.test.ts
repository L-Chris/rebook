import { describe, expect, it } from 'vitest'
import type { LanguageModel } from 'ai'
import type { Book } from '../../src/core/types'
import { ReaderSession } from '../../src/core/reader'
import type { LayoutMode, ReaderMark, Renderer, RendererStyles } from '../../src/core/renderer'
import type { RelocateEvent } from '../../src/core/types'
import { createRebookExtensionRegistry } from '../../src/core/extensions'
import {
    AI_CHAT_EXTENSION_ID,
    BUILT_IN_REBOOK_EXTENSION_MANIFESTS,
    TRANSLATION_EXTENSION_ID,
    TRIAL_LIMIT_EXTENSION_ID,
    createAIChatExtension,
    createBuiltInRebookExtensionCatalog,
    createBuiltInRebookExtensions,
    createTranslationExtension,
    createTrialLimitExtension,
} from '../../src/plugins/extensions'
import type { AIChatBook } from '../../src/plugins/ai-chat'
import type { TrialLimitedBook } from '../../src/plugins/trial-limit'

class FakeRenderer implements Renderer {
    private book: Book | null = null

    async open(book: Book): Promise<void> {
        this.book = book
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
    getLocation(): RelocateEvent | null { return { index: 0, fraction: 0, totalFraction: 0 } }
    getSectionFractions(): number[] {
        const count = this.book?.sections.length ?? 0
        return Array.from({ length: count + 1 }, (_, index) => count > 0 ? index / count : 0)
    }
    on(): void {}
    off(): void {}
    destroy(): void {}
}

const makeBook = (): Book => ({
    sections: [{
        id: 'chapter.xhtml',
        size: 100,
        load: () => '',
        getBlocks: () => [{
            id: 'p1',
            type: 'paragraph',
            segments: [{ text: 'Systems thinking starts with feedback.' }],
        }],
    }],
    toc: [{ label: 'Chapter', href: 'chapter.xhtml' }],
    resolveHref: () => ({ index: 0 }),
})

describe('built-in rebook extensions', () => {
    it('publishes stable built-in extension manifests for host catalogs', () => {
        const ids = BUILT_IN_REBOOK_EXTENSION_MANIFESTS.map(manifest => manifest.id)

        expect(ids).toEqual([
            'rebook.trial-limit',
            'rebook.translation',
            'rebook.professional-translation',
            'rebook.tts',
            'rebook.ai-chat',
        ])
        expect(new Set(ids).size).toBe(ids.length)
        expect(BUILT_IN_REBOOK_EXTENSION_MANIFESTS.every(manifest =>
            manifest.name && manifest.version && manifest.publisher === 'rebook',
        )).toBe(true)
    })

    it('creates configured built-in extension packages', () => {
        const model = 'test-model' as LanguageModel
        const extensions = createBuiltInRebookExtensions({
            trialLimit: { maxPages: 1 },
            translation: { model },
            aiChat: { model },
        })

        expect(extensions.map(extension => extension.manifest.id)).toEqual([
            TRIAL_LIMIT_EXTENSION_ID,
            TRANSLATION_EXTENSION_ID,
            AI_CHAT_EXTENSION_ID,
        ])
    })

    it('creates a built-in extension catalog for local marketplace UIs', () => {
        const catalog = createBuiltInRebookExtensionCatalog()

        expect(catalog.list().map(entry => entry.source)).toEqual([
            'builtin',
            'builtin',
            'builtin',
            'builtin',
            'builtin',
        ])
        expect(catalog.list({ capabilities: ['ai.chat'] }).map(entry => entry.manifest.id)).toEqual([
            AI_CHAT_EXTENSION_ID,
        ])
        expect(catalog.items([{ id: AI_CHAT_EXTENSION_ID, version: '1.0.0', enabled: true }], {
            installed: true,
        }).map(item => item.manifest.id)).toEqual([AI_CHAT_EXTENSION_ID])
    })

    it('installs built-in extensions through the reader extension host', async () => {
        const renderer = new FakeRenderer()
        const reader = new ReaderSession({ createRenderer: () => renderer })
        const model = 'test-model' as LanguageModel

        reader.installExtension(createTrialLimitExtension({ maxPages: 1 }))
        reader.installExtension(createAIChatExtension({ model }))
        await reader.openBook(makeBook())
        const book = reader.getBook() as TrialLimitedBook & AIChatBook

        expect(reader.getExtensionManifests().map(manifest => manifest.id)).toEqual([
            TRIAL_LIMIT_EXTENSION_ID,
            AI_CHAT_EXTENSION_ID,
        ])
        expect(book.trialLimit.state.maxPages).toBe(1)
        expect(book.aiChat).toBeTruthy()
        await expect(book.aiChat.search('feedback')).resolves.toHaveLength(1)
    })

    it('can seed an extension registry from built-in extension packages', async () => {
        const registry = createRebookExtensionRegistry([
            createTrialLimitExtension({ maxPages: 2 }),
            createTranslationExtension({ model: 'test-model' as LanguageModel }),
        ])

        expect(registry.manifests().map(manifest => manifest.id)).toEqual([
            TRIAL_LIMIT_EXTENSION_ID,
            TRANSLATION_EXTENSION_ID,
        ])
        await expect(registry.getPlugins()).resolves.toHaveLength(2)
    })
})
