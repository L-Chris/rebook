import {
    createRebookExtensionCatalog,
    createRebookExtensionCatalogEntry,
    defineRebookPlugin,
    type RebookExtension,
    type RebookExtensionCatalog,
    type RebookExtensionManifest,
} from '../core/extensions'
import { withAIChat, type AIChatOptions } from './ai-chat'
import {
    withProfessionalTranslation,
    withTranslation,
    type BackendProfessionalTranslationOptions,
    type TranslationOptions,
} from './translation'
import { withTrialLimit, type TrialLimitOptions } from './trial-limit'
import { withTTS, type TTSOptions } from './tts'

export const TRIAL_LIMIT_EXTENSION_ID = 'rebook.trial-limit'
export const TRANSLATION_EXTENSION_ID = 'rebook.translation'
export const PROFESSIONAL_TRANSLATION_EXTENSION_ID = 'rebook.professional-translation'
export const TTS_EXTENSION_ID = 'rebook.tts'
export const AI_CHAT_EXTENSION_ID = 'rebook.ai-chat'

export type BuiltInRebookExtensionName =
    | 'trialLimit'
    | 'translation'
    | 'professionalTranslation'
    | 'tts'
    | 'aiChat'

export interface BuiltInRebookExtensionOptions {
    readonly trialLimit?: TrialLimitOptions
    readonly translation?: TranslationOptions
    readonly professionalTranslation?: BackendProfessionalTranslationOptions
    readonly tts?: TTSOptions
    readonly aiChat?: AIChatOptions
}

export const trialLimitExtensionManifest = {
    id: TRIAL_LIMIT_EXTENSION_ID,
    name: 'Trial Limit',
    displayName: 'Trial Limit',
    version: '1.0.0',
    publisher: 'rebook',
    description: 'Restrict reader navigation to a configurable preview range.',
    categories: ['reader', 'utility'],
    capabilities: ['book.transform', 'reader.access'],
    contributes: {
        settings: {
            maxPages: { type: 'number', default: 0 },
        },
    },
} satisfies RebookExtensionManifest

export const translationExtensionManifest = {
    id: TRANSLATION_EXTENSION_ID,
    name: 'Translation',
    displayName: 'Translation',
    version: '1.0.0',
    publisher: 'rebook',
    description: 'Translate book blocks with a configured language model.',
    categories: ['translation', 'ai'],
    capabilities: ['book.transform', 'translation'],
    contributes: {
        settings: {
            targetLanguage: { type: 'string', default: 'zh-CN' },
            mode: { type: 'string', enum: ['replace', 'bilingual'], default: 'bilingual' },
            translateTOC: { type: 'boolean', default: false },
        },
    },
} satisfies RebookExtensionManifest

export const professionalTranslationExtensionManifest = {
    id: PROFESSIONAL_TRANSLATION_EXTENSION_ID,
    name: 'Professional Translation',
    displayName: 'Professional Translation',
    version: '1.0.0',
    publisher: 'rebook',
    description: 'Use rebook-service professional translation workflow and cached chunk results.',
    categories: ['translation', 'ai'],
    capabilities: ['book.transform', 'translation'],
    contributes: {
        settings: {
            serviceBaseUrl: { type: 'string' },
            bookId: { type: 'string' },
            targetLanguage: { type: 'string', default: 'zh-CN' },
        },
    },
} satisfies RebookExtensionManifest

export const ttsExtensionManifest = {
    id: TTS_EXTENSION_ID,
    name: 'Text To Speech',
    displayName: 'Text To Speech',
    version: '1.0.0',
    publisher: 'rebook',
    description: 'Attach text-to-speech playback and prefetching to books.',
    categories: ['tts', 'ai'],
    capabilities: ['book.transform', 'tts.playback'],
    contributes: {
        settings: {
            endpoint: { type: 'string', default: 'http://127.0.0.1:4177' },
            provider: { type: 'string' },
            multiSpeaker: { type: 'boolean', default: false },
        },
    },
} satisfies RebookExtensionManifest

export const aiChatExtensionManifest = {
    id: AI_CHAT_EXTENSION_ID,
    name: 'AI Chat',
    displayName: 'AI Chat',
    version: '1.0.0',
    publisher: 'rebook',
    description: 'Chat with the current book using search, content-reading, and rewrite tools.',
    categories: ['ai', 'reader'],
    capabilities: ['ai.chat', 'content.read', 'content.rewrite', 'search', 'book.transform'],
    contributes: {
        commands: [
            { id: 'rebook.aiChat.open', title: 'Open AI Chat' },
        ],
        panels: [
            { id: 'rebook.aiChat.panel', title: 'AI Chat' },
        ],
        settings: {
            maxToolSteps: { type: 'number', default: 24 },
            maxContextChars: { type: 'number', default: 20000 },
        },
    },
} satisfies RebookExtensionManifest

export const BUILT_IN_REBOOK_EXTENSION_MANIFESTS = [
    trialLimitExtensionManifest,
    translationExtensionManifest,
    professionalTranslationExtensionManifest,
    ttsExtensionManifest,
    aiChatExtensionManifest,
] as const satisfies readonly RebookExtensionManifest[]

export function createBuiltInRebookExtensionCatalog(): RebookExtensionCatalog {
    return createRebookExtensionCatalog(BUILT_IN_REBOOK_EXTENSION_MANIFESTS.map(manifest =>
        createRebookExtensionCatalogEntry(manifest, { source: 'builtin', verified: true }),
    ))
}

export function createTrialLimitExtension(options: TrialLimitOptions = {}): RebookExtension {
    return defineRebookPlugin(trialLimitExtensionManifest, withTrialLimit(options))
}

export function createTranslationExtension(options: TranslationOptions): RebookExtension {
    return defineRebookPlugin(translationExtensionManifest, withTranslation(options))
}

export function createProfessionalTranslationExtension(
    options: BackendProfessionalTranslationOptions,
): RebookExtension {
    return defineRebookPlugin(professionalTranslationExtensionManifest, withProfessionalTranslation(options))
}

export function createTTSExtension(options: TTSOptions = {}): RebookExtension {
    return defineRebookPlugin(ttsExtensionManifest, withTTS(options))
}

export function createAIChatExtension(options: AIChatOptions): RebookExtension {
    return defineRebookPlugin(aiChatExtensionManifest, withAIChat(options))
}

export function createBuiltInRebookExtensions(options: BuiltInRebookExtensionOptions): RebookExtension[] {
    const extensions: RebookExtension[] = []
    if (options.trialLimit) extensions.push(createTrialLimitExtension(options.trialLimit))
    if (options.translation) extensions.push(createTranslationExtension(options.translation))
    if (options.professionalTranslation) {
        extensions.push(createProfessionalTranslationExtension(options.professionalTranslation))
    }
    if (options.tts) extensions.push(createTTSExtension(options.tts))
    if (options.aiChat) extensions.push(createAIChatExtension(options.aiChat))
    return extensions
}
