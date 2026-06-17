import { generateText, jsonSchema, Output, type LanguageModel } from 'ai'
import type { Book, RebookPlugin, TextBlock } from '../core/types'
import {
    getReadableBlocks,
    hasSpeakableText,
    normalizeText,
    splitText,
    trimSilentGapEdges,
    trimSpeechPartBoundaryEdges,
    type ReadableBlock,
    type ReadableBlockText,
} from './tts/text-utils'
import {
    buildScenePlanningSystemPrompt,
    buildSpeakerAnalysisRepairPrompt,
    buildSpeakerAnalysisSystemPrompt,
    buildSpeakerPlanningSystemPrompt,
    type TTSCompactSpeakerAnalysisMode,
} from './tts/speaker-prompts'
import {
    getSpeakerAnalysisSchema,
    scenePlanSchema,
    speakerAnalysisSchema,
    speakerPlanItemSchema,
    voiceDesignSpeakerAnalysisSchema,
    type TTSCompactKnownSpeaker,
    type TTSCompactSceneInfo,
    type TTSCompactScenePlan,
    type TTSCompactSpeakerAttribution,
    type TTSCompactSpeakerAtom,
    type TTSCompactSpeakerAnalysis,
    type TTSCompactSpeakerAnalysisBlock,
    type TTSCompactSpeakerAnalysisOutput,
    type TTSCompactSpeakerAnalysisRequest,
    type TTSCompactSpeakerAnalysisSegment,
    type TTSCompactSpeakerInfo,
    type TTSCompactSpeakerModelRequest,
    type TTSCompactSpeakerModelRequestKind,
    type TTSCompactSpeakerPlan,
    type TTSCompactSpeakerTier,
    type TTSCompactVoice,
} from './tts/speaker-schemas'
export { createBrowserTTSAudioPlayer } from './tts/audio-player'

type FetchLike = typeof fetch

function nowMs(): number {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()
}

function normalizeTimeoutMs(timeoutMs: number | undefined): { totalMs: number } | undefined {
    if (typeof timeoutMs !== 'number' || !Number.isFinite(timeoutMs) || timeoutMs <= 0) return undefined
    return { totalMs: Math.floor(timeoutMs) }
}

function createTimeoutSignal(timeoutMs: number | undefined): AbortSignal | undefined {
    const timeout = normalizeTimeoutMs(timeoutMs)?.totalMs
    if (!timeout || typeof AbortSignal === 'undefined' || typeof AbortSignal.timeout !== 'function') return undefined
    return AbortSignal.timeout(timeout)
}

function getErrorMessage(error: unknown): string {
    if (!error || typeof error !== 'object') return String(error)
    const value = error as {
        name?: string
        message?: string
        statusCode?: number
        url?: string
        responseBody?: string
        cause?: unknown
    }
    const parts = [
        value.message || value.name,
        typeof value.statusCode === 'number' ? `status=${value.statusCode}` : undefined,
        value.url ? `url=${value.url}` : undefined,
        value.responseBody ? `body=${trimErrorDetail(value.responseBody)}` : undefined,
        value.cause instanceof Error ? `cause=${value.cause.message}` : undefined,
    ].filter(Boolean)
    return parts.length ? parts.join(' | ') : String(error)
}

function trimErrorDetail(value: string): string {
    const text = value.replace(/\s+/g, ' ').trim()
    return text.length > 500 ? `${text.slice(0, 500)}...` : text
}

export interface TTSVoice {
    id: string
    name: string
    locale?: string
    gender?: string
    provider: string
    capabilities?: TTSProviderCapabilities
}

export interface TTSProviderCapabilities {
    tts?: boolean
    tts_streaming?: boolean
    asr?: boolean
    asr_streaming?: boolean
    voice_design?: boolean
    voice_clone?: boolean
    sound_effects?: boolean
    isolation?: boolean
}

export type TTSJsonPrimitive = string | number | boolean | null
export type TTSJsonValue = TTSJsonPrimitive | TTSJsonObject | TTSJsonValue[]
export interface TTSJsonObject {
    [key: string]: TTSJsonValue
}

export interface TTSProviderInfo {
    id: string
    name: string
    capabilities?: TTSProviderCapabilities
}

export type TTSSpeakerRole = 'narrator' | 'character' | 'other'
export type TTSSpeakerGender = 'male' | 'female' | 'unknown'
export type TTSSpeakerTier = TTSCompactSpeakerTier
export type TTSMixLayer = 'foreground' | 'midground' | 'background'

export interface TTSSpeakerVoiceProfile {
    speakerId?: number
    voice?: string
    speaker?: string
    role?: TTSSpeakerRole
    gender?: TTSSpeakerGender
    tier?: TTSSpeakerTier
    speakerHint?: string
    speed?: number
    pitch?: string
    volume?: string
    emotion?: string
    voicePrompt?: string
    stylePrompt?: string
    mixLayer?: TTSMixLayer
    volumeDb?: number
    pan?: number
}

export type TTSVoiceProfileEntry = string | TTSSpeakerVoiceProfile
export type TTSVoiceProfileSlot = TTSVoiceProfileEntry | readonly TTSVoiceProfileEntry[]

export interface TTSVoiceProfile {
    narrator?: TTSVoiceProfileSlot
    male?: TTSVoiceProfileSlot
    female?: TTSVoiceProfileSlot
    unknown?: TTSVoiceProfileSlot
    other?: TTSVoiceProfileSlot
    speakers?: Record<string, TTSVoiceProfileSlot>
}

export interface TTSSpeakerVoiceAssignment {
    id?: number
    speaker: string
    role?: TTSSpeakerRole
    gender?: TTSSpeakerGender
    tier?: TTSSpeakerTier
    voice?: string
    speakerHint?: string
    voicePrompt?: string
    stylePrompt?: string
}

export interface TTSSpeakerAnalysisBlock {
    blockId: string
    blockType: TextBlock['type']
    text: string
}

export interface TTSSpeakerAnalysisSegment {
    blockId: string
    startOffset: number
    endOffset: number
    speakerId?: number
    speakerIds?: readonly number[]
    text?: string
    speaker?: string
    role?: TTSSpeakerRole
    gender?: TTSSpeakerGender
    tier?: TTSSpeakerTier
    confidence?: number
    voice?: string
    speed?: number
    pitch?: string
    volume?: string
    emotion?: string
    voicePrompt?: string
    stylePrompt?: string
    mixLayer?: TTSMixLayer
    volumeDb?: number
    pan?: number
}

export interface TTSSpeakerAnalysisRequest {
    sectionIndex: number
    blocks: readonly TTSSpeakerAnalysisBlock[]
    knownSpeakers?: readonly TTSSpeakerVoiceAssignment[]
}

export interface TTSSpeakerAnalysis {
    segments: readonly TTSSpeakerAnalysisSegment[]
}

export interface TTSSpeakerAnalysisLogEvent {
    phase: 'scene' | 'plan' | 'initial' | 'repair'
    sectionIndex: number
    request: unknown
    response: unknown
    durationMs: number
    error?: string
}

export type TTSSpeakerAnalysisPhase = 'scene' | 'plan' | 'initial' | 'repair'

export type TTSSpeakerAnalyzer = (request: TTSSpeakerAnalysisRequest) => Promise<TTSSpeakerAnalysis> | TTSSpeakerAnalysis

export interface TTSSpeakerAnalysisOptions {
    model?: LanguageModel
    prompt?: string
    timeoutMs?: number
    onLog?: (event: TTSSpeakerAnalysisLogEvent) => void | Promise<void>
}

export interface TTSSegment {
    id: string
    sectionIndex: number
    blockId: string
    blockType?: TextBlock['type']
    startOffset: number
    endOffset: number
    ranges?: readonly TTSSegmentRange[]
    provider?: string
    soundEffectPrompt?: string
    soundEffectDurationSeconds?: number
    speakerId?: number
    speakerIds?: readonly number[]
    speaker: string
    speakerRole?: TTSSpeakerRole
    speakerGender?: TTSSpeakerGender
    speakerTier?: TTSSpeakerTier
    speakerConfidence?: number
    text: string
    voice?: string
    mixLayer?: TTSMixLayer
    volumeDb?: number
    pan?: number
    speed?: number
    pitch?: string
    volume?: string
    emotion?: string
    voicePrompt?: string
    stylePrompt?: string
    batchable?: boolean
}

export interface TTSSegmentRange {
    blockId: string
    blockType?: TextBlock['type']
    startOffset: number
    endOffset: number
}

export interface TTSSectionOptions {
    provider?: string
    soundEffectProvider?: string
    voice?: string
    speaker?: string
    multiSpeaker?: boolean
    voiceProfile?: TTSVoiceProfile
    model?: LanguageModel
    speakerAnalysis?: TTSSpeakerAnalysisOptions
    speakerAnalyzer?: TTSSpeakerAnalyzer
    maxSegmentChars?: number
    includeFootnotes?: boolean
    includeAnnotationRefs?: boolean
}

export interface TTSSynthesizeOptions {
    provider?: string
    voice?: string
    lang?: string
    outputFormat?: string
    speed?: number
    pitch?: string
    volume?: string
    stylePrompt?: string
    extraParams?: TTSJsonObject
}

export interface TTSSynthesizeResult {
    segmentId: string
    audioUrl: string
    fileName: string
    mimeType: string
    durationMs: number
    cacheHit: boolean
}

export interface TTSPrefetchOptions {
    concurrency?: number
    pollIntervalMs?: number
}

export type TTSSynthesisStatus = 'queued' | 'running' | 'done' | 'failed' | 'partial'

export interface TTSSynthesisState {
    id: string
    status: TTSSynthesisStatus
    provider: string
    total: number
    completed: number
    failed: number
    createdAt: string
    updatedAt: string
    error?: string
    results: TTSSynthesizeResult[]
    failures?: TTSSynthesisFailure[]
}

export interface TTSSynthesisFailure {
    index: number
    segmentId: string
    speaker?: string
    voice?: string
    textPreview: string
    error: string
}

export interface TTSPrefetchedSection {
    readonly segments: TTSSegment[]
    readonly id: string
    readonly total: number
    refresh(): Promise<TTSSynthesisState>
    getResult(segmentId: string): TTSSynthesizeResult | undefined
    waitForSegment(segmentId: string, options?: { pollIntervalMs?: number, signal?: AbortSignal }): Promise<TTSSynthesizeResult>
}

export interface TTSAudioPlaybackEvent {
    segment: TTSSegment
    index: number
    total: number
    result?: TTSSynthesizeResult
}

export interface TTSAudioPlaybackErrorEvent extends TTSAudioPlaybackEvent {
    error: unknown
}

export interface TTSAudioPlaybackOptions {
    signal?: AbortSignal
    pollIntervalMs?: number
    preloadAhead?: number
    onSegmentQueued?: (event: TTSAudioPlaybackEvent) => void
    onSegmentStart?: (event: TTSAudioPlaybackEvent) => void
    onSegmentEnd?: (event: TTSAudioPlaybackEvent) => void
    onSegmentError?: (event: TTSAudioPlaybackErrorEvent) => void
}

export interface TTSAudioPlayer {
    playPrefetchedSection(prefetch: TTSPrefetchedSection, options?: TTSAudioPlaybackOptions): Promise<void>
    stop(): void
    destroy?(): void | Promise<void>
}

export interface BrowserTTSAudioPlayerOptions {
    fetch?: FetchLike
    audioContext?: AudioContext
    preloadAhead?: number
}

export interface TTSController {
    listProviders(): Promise<TTSProviderInfo[]>
    listVoices(provider?: string): Promise<TTSVoice[]>
    prepareSection(sectionIndex: number, options?: TTSSectionOptions): Promise<TTSSegment[]>
    synthesizeSegment(segment: TTSSegment, options?: TTSSynthesizeOptions): Promise<TTSSynthesizeResult>
    synthesizeSegments(segments: readonly TTSSegment[], options?: TTSSynthesizeOptions & TTSPrefetchOptions): Promise<TTSPrefetchedSection>
    prefetchSection(sectionIndex: number, options?: TTSSectionOptions & TTSSynthesizeOptions & TTSPrefetchOptions): Promise<TTSPrefetchedSection>
    playPrefetchedSection(prefetch: TTSPrefetchedSection, options?: TTSAudioPlaybackOptions): Promise<void>
    stopPlayback(): void
    readonly player?: TTSAudioPlayer
}

export type TTSBook = Book & {
    readonly tts: TTSController
}

export interface TTSOptions {
    endpoint?: string
    provider?: string
    soundEffectProvider?: string
    voice?: string
    lang?: string
    outputFormat?: string
    speed?: number
    pitch?: string
    volume?: string
    speaker?: string
    multiSpeaker?: boolean
    voiceProfile?: TTSVoiceProfile
    model?: LanguageModel
    speakerAnalysis?: TTSSpeakerAnalysisOptions
    speakerAnalyzer?: TTSSpeakerAnalyzer
    maxSegmentChars?: number
    includeFootnotes?: boolean
    includeAnnotationRefs?: boolean
    player?: TTSAudioPlayer
    fetch?: FetchLike
}

interface ResolvedTTSSectionOptions extends TTSSectionOptions {
    lang?: string
    speakerVoiceState: TTSSpeakerVoiceState
    providerCatalog?: () => Promise<TTSProviderInfo[]>
    voiceCatalog?: () => Promise<TTSVoice[]>
    voiceDesigner?: (profile: TTSSpeakerVoiceProfile) => Promise<string>
}

interface TTSSpeakerVoiceState {
    assignments: Map<string, TTSSpeakerVoiceProfile>
    voiceDesigns: Map<string, Promise<string>>
    nextByBucket: Map<string, number>
    speakerIdsByKey: Map<string, number>
    speakerNamesById: Map<number, string>
    nextSpeakerId: number
}

export function withTTS(options: TTSOptions = {}): RebookPlugin {
    const endpoint = trimTrailingSlash(options.endpoint ?? 'http://127.0.0.1:4177')
    const fetchImpl = options.fetch ?? globalThis.fetch?.bind(globalThis)
    if (!fetchImpl) {
        throw new Error('withTTS requires a fetch implementation.')
    }

    return (book: Book): TTSBook => {
        const sectionSegmentCache = new Map<string, Promise<TTSSegment[]>>()
        const speakerVoiceStates = new Map<string, TTSSpeakerVoiceState>()
        const voiceCatalogCache = new Map<string, Promise<TTSVoice[]>>()
        const voiceDesignCache = new Map<string, Promise<string>>()
        const voiceDesignLimiter = createAsyncLimiter(3)
        let providerCatalogCache: Promise<TTSProviderInfo[]> | undefined

        const getProviderCatalog = (): Promise<TTSProviderInfo[]> => {
            if (providerCatalogCache) return providerCatalogCache
            providerCatalogCache = (async () => {
                try {
                    const response = await fetchImpl(`${endpoint}/api/providers`)
                    const body = await readJson<{ providers: TTSProviderInfo[] }>(response)
                    return Array.isArray(body.providers) ? body.providers : []
                } catch {
                    return []
                }
            })()
            return providerCatalogCache
        }

        const getVoiceCatalog = (provider = options.provider): Promise<TTSVoice[]> => {
            const resolvedProvider = normalizeVoxoutProvider(provider ?? options.provider ?? 'default')
            const key = resolvedProvider
            const cached = voiceCatalogCache.get(key)
            if (cached) return cached
            const promise = (async () => {
                try {
                    const response = await fetchImpl(`${endpoint}/api/providers/${encodeURIComponent(resolvedProvider)}/voices`)
                    const body = await readJson<{ voices: TTSVoice[] }>(response)
                    return Array.isArray(body.voices) ? body.voices : []
                } catch {
                    try {
                        const url = new URL(`${endpoint}/api/voices`)
                        url.searchParams.set('provider', resolvedProvider)
                        const response = await fetchImpl(url.toString())
                        const body = await readJson<{ voices: TTSVoice[] }>(response)
                        return Array.isArray(body.voices) ? body.voices : []
                    } catch {
                        return []
                    }
                }
            })()
            voiceCatalogCache.set(key, promise)
            return promise
        }

        const prepareSection = (sectionIndex: number, sectionOptions: TTSSectionOptions = {}) => {
            const provider = sectionOptions.provider ?? options.provider
            const voiceProfileKey = JSON.stringify(normalizeVoiceProfileForCache(sectionOptions.voiceProfile ?? options.voiceProfile) ?? null)
            const speakerVoiceState = getSpeakerVoiceState(speakerVoiceStates, voiceProfileKey)
            const cacheKey = JSON.stringify({
                sectionIndex,
                provider,
                soundEffectProvider: sectionOptions.soundEffectProvider ?? options.soundEffectProvider ?? 'elevenlabs',
                voice: sectionOptions.voice ?? options.voice,
                speaker: sectionOptions.speaker ?? options.speaker,
                multiSpeaker: sectionOptions.multiSpeaker ?? options.multiSpeaker,
                voiceProfileKey,
                speakerAnalyzer: sectionOptions.speakerAnalyzer || options.speakerAnalyzer ? 'custom' : undefined,
                speakerAnalysisPrompt: sectionOptions.speakerAnalysis?.prompt ?? options.speakerAnalysis?.prompt,
                model: hasSpeakerAnalysisModel(sectionOptions, options) ? 'model' : undefined,
                maxSegmentChars: sectionOptions.maxSegmentChars ?? options.maxSegmentChars,
                includeFootnotes: sectionOptions.includeFootnotes ?? options.includeFootnotes,
                includeAnnotationRefs: sectionOptions.includeAnnotationRefs ?? options.includeAnnotationRefs,
            })
            const existing = sectionSegmentCache.get(cacheKey)
            if (existing) return existing

            const promise = buildSectionSegments(book, sectionIndex, {
                provider,
                soundEffectProvider: sectionOptions.soundEffectProvider ?? options.soundEffectProvider ?? 'elevenlabs',
                voice: sectionOptions.voice ?? options.voice,
                speaker: sectionOptions.speaker ?? options.speaker,
                multiSpeaker: sectionOptions.multiSpeaker ?? options.multiSpeaker,
                voiceProfile: sectionOptions.voiceProfile ?? options.voiceProfile,
                model: sectionOptions.model ?? sectionOptions.speakerAnalysis?.model ?? options.model ?? options.speakerAnalysis?.model,
                speakerAnalysis: sectionOptions.speakerAnalysis ?? options.speakerAnalysis,
                speakerAnalyzer: sectionOptions.speakerAnalyzer ?? options.speakerAnalyzer,
                lang: options.lang,
                speakerVoiceState,
                providerCatalog: getProviderCatalog,
                voiceCatalog: () => getVoiceCatalog(provider),
                voiceDesigner: profile => designVoicePrompt({
                    speaker: profile.speaker,
                    voicePrompt: profile.voicePrompt,
                    sampleText: profile.speakerHint,
                }, normalizeVoxoutProvider(provider ?? options.provider ?? 'default')),
                maxSegmentChars: sectionOptions.maxSegmentChars ?? options.maxSegmentChars,
                includeFootnotes: sectionOptions.includeFootnotes ?? options.includeFootnotes,
                includeAnnotationRefs: sectionOptions.includeAnnotationRefs ?? options.includeAnnotationRefs,
            })
            sectionSegmentCache.set(cacheKey, promise)
            return promise
        }

        const designVoicePrompt = async (
            input: { speaker?: string, voicePrompt?: string, sampleText?: string },
            provider: string,
        ): Promise<string> => {
            const prompt = normalizeVoicePrompt(input.voicePrompt)
            if (!prompt) {
                return ''
            }
            const key = JSON.stringify({
                provider,
                prompt,
                speaker: input.speaker,
            })
            const cached = voiceDesignCache.get(key)
            if (cached) return cached
            const promise = voiceDesignLimiter(async () => {
                const designResponse = await fetchImpl(`${endpoint}/v1/audio/voices/design`, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify(compactObject({
                        provider,
                        instructions: prompt,
                        input: input.sampleText?.slice(0, 240),
                        name: input.speaker && input.speaker !== NARRATOR_SPEAKER ? input.speaker : undefined,
                    })),
                })
                const design = await readJson<{ data?: Array<Record<string, unknown>> }>(designResponse)
                const preview = Array.isArray(design.data) ? design.data[0] : undefined
                if (!preview) throw new Error(`TTS voice design returned no previews for ${input.speaker ?? 'speaker'}`)
                const createResponse = await fetchImpl(`${endpoint}/v1/audio/voices/create`, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify(compactObject({
                        provider,
                        generated_voice_id: getJsonString(preview.generated_voice_id) ?? getJsonString(preview.id),
                        name: getJsonString(preview.name) ?? input.speaker,
                        instructions: getJsonString(preview.instructions) ?? prompt,
                        language: getJsonString(preview.language),
                        labels: {
                            source: 'rebook',
                            speaker: input.speaker,
                        },
                    })),
                })
                const voice = await readJson<{ id?: string }>(createResponse)
                if (!voice.id) throw new Error(`TTS voice create returned no voice id for ${input.speaker ?? 'speaker'}`)
                return voice.id
            }).catch(error => {
                if (voiceDesignCache.get(key) === promise) {
                    voiceDesignCache.delete(key)
                }
                throw error
            })
            voiceDesignCache.set(key, promise)
            return promise
        }

        const designVoice = async (segment: TTSSegment, provider: string): Promise<string> => {
            return designVoicePrompt({
                speaker: segment.speaker,
                voicePrompt: segment.voicePrompt,
                sampleText: segment.text,
            }, provider)
        }

        const synthesizeSegment = async (segment: TTSSegment, synthesizeOptions: TTSSynthesizeOptions = {}): Promise<TTSSynthesizeResult> => {
            const effect = isSoundEffectSegment(segment)
            const provider = normalizeVoxoutProvider(effect
                ? segment.provider ?? synthesizeOptions.provider ?? options.soundEffectProvider ?? 'elevenlabs'
                : synthesizeOptions.provider ?? segment.provider ?? options.provider ?? 'default')
            const voice = effect
                ? undefined
                : segment.voice ?? synthesizeOptions.voice ?? (
                    segment.voicePrompt ? await designVoice(segment, provider) : options.voice
                )
            const response = await fetchImpl(`${endpoint}${effect ? '/v1/audio/effect' : '/v1/audio/speech'}`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(effect
                    ? buildVoxoutEffectRequest(segment, provider, synthesizeOptions, options)
                    : buildVoxoutSpeechRequest(segment, provider, voice, synthesizeOptions, options)),
            })
            return createSynthesizeResultFromAudioResponse(segment, response)
        }

        const controller: TTSController = {
            async listProviders() {
                return getProviderCatalog()
            },
            async listVoices(provider = options.provider) {
                return getVoiceCatalog(provider)
            },
            prepareSection,
            synthesizeSegment,
            async synthesizeSegments(segments, synthesizeOptions = {}) {
                const state = createSynthesisState(segments, synthesizeOptions.provider ?? options.provider ?? 'default')
                runSynthesisTask(state, segments, synthesizeOptions, synthesizeSegment)
                return createPrefetchedSection(segments.slice(), state, synthesizeOptions.pollIntervalMs)
            },
            async prefetchSection(sectionIndex, prefetchOptions = {}) {
                const segments = await prepareSection(sectionIndex, prefetchOptions)
                return controller.synthesizeSegments(segments, prefetchOptions)
            },
            async playPrefetchedSection(prefetch, playbackOptions = {}) {
                if (!options.player) {
                    throw new Error('TTS playback requires a TTSAudioPlayer. Pass player to withTTS().')
                }
                return options.player.playPrefetchedSection(prefetch, playbackOptions)
            },
            stopPlayback() {
                options.player?.stop()
            },
            player: options.player,
        }

        return {
            ...book,
            tts: controller,
        }
    }
}

function createPrefetchedSection(
    segments: TTSSegment[],
    state: TTSSynthesisState,
    defaultPollIntervalMs = 300,
): TTSPrefetchedSection {
    const resultsBySegmentId = new Map<string, TTSSynthesizeResult>()
    let latestState = cloneSynthesisState(state)
    let terminal = isTerminalSynthesisState(latestState)

    const mergeResults = (nextState: TTSSynthesisState) => {
        latestState = cloneSynthesisState(nextState)
        terminal = isTerminalSynthesisState(latestState)
        for (const result of latestState.results) {
            resultsBySegmentId.set(result.segmentId, result)
        }
    }

    mergeResults(state)
    const refreshState = async () => {
        mergeResults(state)
        return latestState
    }

    return {
        segments,
        id: state.id,
        total: segments.length,
        refresh: refreshState,
        getResult(segmentId) {
            return resultsBySegmentId.get(segmentId)
        },
        async waitForSegment(segmentId, waitOptions = {}) {
            const pollIntervalMs = Math.max(50, waitOptions.pollIntervalMs ?? defaultPollIntervalMs)
            while (true) {
                const result = resultsBySegmentId.get(segmentId)
                if (result) return result
                if (waitOptions.signal?.aborted) {
                    throw new Error('TTS prefetch was aborted.')
                }
                if (!terminal) {
                    await refreshState()
                } else {
                    const failure = latestState.failures?.find(item => item.segmentId === segmentId)
                    const detail = failure?.error ?? latestState.error
                    throw new Error(detail
                        ? `TTS segment was not generated: ${segmentId}: ${detail}`
                        : `TTS segment was not generated: ${segmentId}`)
                }
                if (!resultsBySegmentId.has(segmentId) && !terminal) {
                    await delay(pollIntervalMs, waitOptions.signal)
                }
            }
        },
    }
}

function buildVoxoutSpeechRequest(
    segment: TTSSegment,
    provider: string,
    voice: string | undefined,
    synthesizeOptions: TTSSynthesizeOptions,
    options: TTSOptions,
): Record<string, unknown> {
    return compactObject({
        provider,
        input: segment.text,
        voice,
        response_format: synthesizeOptions.outputFormat ?? options.outputFormat,
        speed: normalizeSpeechSpeed(synthesizeOptions.speed ?? segment.speed ?? options.speed),
        instructions: synthesizeOptions.stylePrompt ?? segment.stylePrompt,
        extra_params: synthesizeOptions.extraParams,
    })
}

function buildVoxoutEffectRequest(
    segment: TTSSegment,
    provider: string,
    synthesizeOptions: TTSSynthesizeOptions,
    options: TTSOptions,
): Record<string, unknown> {
    return compactObject({
        provider,
        instructions: segment.soundEffectPrompt ?? segment.text,
        duration_seconds: segment.soundEffectDurationSeconds,
        response_format: synthesizeOptions.outputFormat ?? options.outputFormat,
        extra_params: synthesizeOptions.extraParams,
    })
}

async function createSynthesizeResultFromAudioResponse(
    segment: TTSSegment,
    response: Response,
): Promise<TTSSynthesizeResult> {
    if (!response.ok) {
        const detail = await response.text().catch(() => '')
        throw new Error(`TTS request failed (${response.status}): ${detail || response.statusText}`)
    }
    const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim() || 'audio/mpeg'
    const audio = await response.arrayBuffer()
    if (audio.byteLength < 1) throw new Error(`TTS provider returned empty audio for segment ${segment.id}`)
    const extension = getAudioExtension(mimeType)
    return {
        segmentId: segment.id,
        audioUrl: arrayBufferToDataUrl(audio, mimeType),
        fileName: `${sanitizeAudioFileSegment(segment.id)}.${extension}`,
        mimeType,
        durationMs: 0,
        cacheHit: false,
    }
}

function createSynthesisState(segments: readonly TTSSegment[], provider: string): TTSSynthesisState {
    const now = new Date().toISOString()
    return {
        id: createSynthesisId(),
        status: segments.length ? 'queued' : 'done',
        provider: normalizeVoxoutProvider(provider),
        total: segments.length,
        completed: 0,
        failed: 0,
        createdAt: now,
        updatedAt: now,
        results: [],
        failures: [],
    }
}

function runSynthesisTask(
    state: TTSSynthesisState,
    segments: readonly TTSSegment[],
    options: TTSSynthesizeOptions & { concurrency?: number },
    synthesize: (segment: TTSSegment, options?: TTSSynthesizeOptions) => Promise<TTSSynthesizeResult>,
): void {
    const concurrency = Math.max(1, Math.min(Math.floor(options.concurrency ?? 2), Math.max(segments.length, 1)))
    let nextIndex = 0
    const run = async () => {
        state.status = segments.length ? 'running' : 'done'
        state.updatedAt = new Date().toISOString()
        const workers = Array.from({ length: concurrency }, async () => {
            while (nextIndex < segments.length) {
                const index = nextIndex
                nextIndex += 1
                const segment = segments[index]
                if (!segment) continue
                try {
                    const result = await synthesize(segment, options)
                    state.results.push(result)
                    state.completed += 1
                } catch (error) {
                    state.failed += 1
                    state.failures = [
                        ...(state.failures ?? []),
                        {
                            index,
                            segmentId: segment.id,
                            speaker: segment.speaker,
                            voice: segment.voice,
                            textPreview: segment.text.slice(0, 80),
                            error: getErrorMessage(error),
                        },
                    ]
                } finally {
                    state.updatedAt = new Date().toISOString()
                }
            }
        })
        await Promise.all(workers)
        state.status = state.failed > 0
            ? (state.completed > 0 ? 'partial' : 'failed')
            : 'done'
        state.error = state.status === 'failed' ? state.failures?.[0]?.error : undefined
        state.updatedAt = new Date().toISOString()
    }
    void run()
}

function cloneSynthesisState(state: TTSSynthesisState): TTSSynthesisState {
    return {
        ...state,
        results: cloneTTSResults(state.results),
        failures: state.failures?.map(failure => ({ ...failure })),
    }
}

function cloneTTSResults(results: readonly TTSSynthesizeResult[]): TTSSynthesizeResult[] {
    return results.map(result => ({ ...result }))
}

function isSoundEffectSegment(segment: TTSSegment): boolean {
    return Boolean(segment.soundEffectPrompt)
        || (segment.speaker === 'sound-effect' && segment.speakerRole === 'other')
}

function normalizeVoxoutProvider(provider: string | undefined): string {
    const value = provider?.trim()
    if (!value || value === 'edge') return 'default'
    return value
}

function normalizeSpeechSpeed(speed: number | undefined): number | undefined {
    if (speed === undefined || !Number.isFinite(speed) || speed <= 0) return undefined
    return Math.max(0.25, Math.min(4, Math.round(speed * 100) / 100))
}

function parseSpeechSpeed(value: unknown): number | undefined {
    const numeric = typeof value === 'number' ? value : Number(value)
    return normalizeSpeechSpeed(numeric)
}

function compactObject<T extends Record<string, unknown>>(value: T): Partial<T> {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== '')) as Partial<T>
}

function createAsyncLimiter(maxConcurrent: number) {
    const limit = Math.max(1, Math.floor(maxConcurrent))
    const queue: Array<() => void> = []
    let active = 0

    const drain = () => {
        if (active >= limit) return
        const next = queue.shift()
        if (!next) return
        active += 1
        next()
    }

    return function runLimited<T>(task: () => Promise<T> | T): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            queue.push(() => {
                Promise.resolve()
                    .then(task)
                    .then(resolve, reject)
                    .finally(() => {
                        active -= 1
                        drain()
                    })
            })
            drain()
        })
    }
}

function arrayBufferToDataUrl(buffer: ArrayBuffer, mimeType: string): string {
    return `data:${mimeType};base64,${arrayBufferToBase64(buffer)}`
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    const chunkSize = 0x8000
    for (let index = 0; index < bytes.length; index += chunkSize) {
        const chunk = bytes.subarray(index, index + chunkSize)
        binary += String.fromCharCode(...chunk)
    }
    if (typeof btoa === 'function') return btoa(binary)
    const BufferCtor = (globalThis as unknown as { Buffer?: { from(value: Uint8Array): { toString(encoding: 'base64'): string } } }).Buffer
    if (BufferCtor) return BufferCtor.from(bytes).toString('base64')
    throw new Error('Base64 encoding is not available in this environment.')
}

function getAudioExtension(mimeType: string): 'mp3' | 'wav' {
    return mimeType.includes('wav') || mimeType.includes('wave') ? 'wav' : 'mp3'
}

function sanitizeAudioFileSegment(value: string): string {
    return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'segment'
}

function createSynthesisId(): string {
    const random = Math.random().toString(36).slice(2, 10)
    return `synth-${Date.now().toString(36)}-${random}`
}

function getJsonString(value: unknown): string | undefined {
    return typeof value === 'string' && value ? value : undefined
}

function hasSpeakerAnalysisModel(sectionOptions: TTSSectionOptions, options: TTSOptions): boolean {
    return Boolean(
        sectionOptions.model
        || sectionOptions.speakerAnalysis?.model
        || options.model
        || options.speakerAnalysis?.model,
    )
}

async function buildSectionSegments(book: Book, sectionIndex: number, options: ResolvedTTSSectionOptions): Promise<TTSSegment[]> {
    const section = book.sections[sectionIndex]
    if (!section?.getBlocks) return []

    const maxSegmentChars = Math.max(20, Math.floor(options.maxSegmentChars ?? 500))
    const narratorBatchChars = Math.min(maxSegmentChars, 100)
    const blocks = await section.getBlocks()
    const readableBlocks = getReadableBlocks(blocks, options)
    if (options.multiSpeaker) {
        return buildMultiSpeakerSegments(sectionIndex, readableBlocks, maxSegmentChars, options)
    }

    const speaker = options.speaker ?? 'narrator'
    const segments: TTSSegment[] = []

    for (const { block, readable } of readableBlocks) {
        const parts = splitText(readable.text, narratorBatchChars)
        for (let partIndex = 0; partIndex < parts.length; partIndex++) {
            const part = parts[partIndex]
            segments.push({
                id: `${sectionIndex}:${block.id}:${partIndex}`,
                sectionIndex,
                blockId: block.id,
                blockType: block.type,
                startOffset: readable.mapOffset(part.start),
                endOffset: readable.mapOffset(part.end, true),
                speaker,
                text: part.text,
                voice: options.voice,
                mixLayer: 'foreground',
                volumeDb: 0,
                pan: 0,
                batchable: isBatchableNarratorBlock(block),
            })
        }
    }

    return mergeAdjacentTTSSegments(segments, narratorBatchChars)
}

interface TTSSpeechPart {
    block: TextBlock
    readable: ReadableBlockText
    text: string
    start: number
    end: number
    speakerId?: number
    speakerIds?: readonly number[]
    provider?: string
    soundEffectPrompt?: string
    soundEffectDurationSeconds?: number
    speaker: string
    role: TTSSpeakerRole
    gender: TTSSpeakerGender
    tier?: TTSSpeakerTier
    confidence?: number
    speakerHint?: string
    voice?: string
    speed?: number
    pitch?: string
    volume?: string
    emotion?: string
    voicePrompt?: string
    stylePrompt?: string
    audioTag?: string
    suffixAudioTag?: string
    muted?: boolean
    soundEffect?: boolean
    mixLayer?: TTSMixLayer
    volumeDb?: number
    pan?: number
}

async function buildMultiSpeakerSegments(
    sectionIndex: number,
    readableBlocks: readonly ReadableBlock[],
    maxSegmentChars: number,
    options: ResolvedTTSSectionOptions,
): Promise<TTSSegment[]> {
    if (!readableBlocks.length) return []
    const parts = await analyzeSpeakerParts(sectionIndex, readableBlocks, options)
    const segments: TTSSegment[] = []
    const partCounters = new Map<string, number>()

    for (const part of parts) {
        if (!normalizeText(part.text)) continue
        const splitLimit = part.role === 'narrator' ? Math.min(maxSegmentChars, 100) : maxSegmentChars
        const splitParts = splitText(part.text, splitLimit)
        for (let splitIndex = 0; splitIndex < splitParts.length; splitIndex += 1) {
            const splitPart = splitParts[splitIndex]
            const splitStart = part.start + splitPart.start
            const splitEnd = splitIndex === splitParts.length - 1 ? part.end : part.start + splitPart.end
            const counterKey = `${part.block.id}:${part.start}:${part.end}`
            const partIndex = partCounters.get(counterKey) ?? 0
            partCounters.set(counterKey, partIndex + 1)
            const profile: TTSSpeakerVoiceProfile = part.soundEffect ? {} : resolveSpeakerVoiceProfile(part, options)
            const speakerTier = resolveSpeakerTier(part, profile)
            const mix = resolveSpeechPartMix(part, profile, speakerTier)
            const stylePrompt = combineStylePrompts(part.stylePrompt, profile.stylePrompt, part.audioTag, part.suffixAudioTag)
            segments.push({
                id: `${sectionIndex}:${part.block.id}:${part.start}:${partIndex}`,
                sectionIndex,
                blockId: part.block.id,
                blockType: part.block.type,
                startOffset: part.readable.mapOffset(splitStart),
                endOffset: part.readable.mapOffset(splitEnd, true),
                provider: part.provider,
                soundEffectPrompt: part.soundEffectPrompt,
                soundEffectDurationSeconds: part.soundEffectDurationSeconds,
                speakerId: part.speakerIds?.length ? undefined : profile.speakerId ?? part.speakerId,
                speakerIds: part.speakerIds,
                speaker: part.speaker,
                speakerRole: profile.role ?? part.role,
                speakerGender: profile.gender ?? part.gender,
                speakerTier,
                speakerConfidence: part.confidence,
                text: applyProviderAudioTags(splitPart.text, part.audioTag, part.suffixAudioTag, options.provider),
                voice: profile.voice ?? options.voice,
                speed: part.speed ?? profile.speed,
                pitch: part.pitch ?? profile.pitch,
                volume: part.volume ?? profile.volume,
                emotion: part.emotion ?? profile.emotion,
                voicePrompt: profile.voicePrompt ?? part.voicePrompt,
                stylePrompt,
                mixLayer: mix.mixLayer,
                volumeDb: mix.volumeDb,
                pan: mix.pan,
                batchable: part.role === 'narrator' && isBatchableNarratorBlock(part.block),
            })
        }
    }

    return mergeAdjacentTTSSegments(segments, Math.min(maxSegmentChars, 100))
}

function mergeAdjacentTTSSegments(segments: readonly TTSSegment[], maxChars: number): TTSSegment[] {
    const merged: TTSSegment[] = []
    for (const segment of segments) {
        const previous = merged[merged.length - 1]
        if (!previous || !canMergeTTSSegments(previous, segment, maxChars)) {
            merged.push(segment)
            continue
        }
        merged[merged.length - 1] = {
            ...previous,
            endOffset: previous.blockId === segment.blockId ? segment.endOffset : previous.endOffset,
            ranges: mergeTTSSegmentRanges(previous, segment),
            text: joinTTSSegmentText(previous.text, segment.text),
            speakerConfidence: mergeSpeakerConfidence(previous.speakerConfidence, segment.speakerConfidence),
            stylePrompt: combineStylePrompts(previous.stylePrompt, segment.stylePrompt),
        }
    }
    return merged
}

function canMergeTTSSegments(previous: TTSSegment, next: TTSSegment, maxChars: number): boolean {
    if (previous.provider || next.provider) return false
    if (previous.sectionIndex !== next.sectionIndex) return false
    if (previous.blockId !== next.blockId && !canMergeAcrossBlocks(previous, next)) return false
    if (previous.blockId === next.blockId && (next.startOffset < previous.endOffset || next.startOffset - previous.endOffset > 8)) return false
    if (previous.speakerId !== next.speakerId) return false
    if (!sameNumberArray(previous.speakerIds, next.speakerIds)) return false
    if (previous.speaker !== next.speaker) return false
    if (previous.speakerRole !== next.speakerRole) return false
    if (previous.speakerGender !== next.speakerGender) return false
    if (previous.provider !== next.provider) return false
    if (previous.voice !== next.voice) return false
    if (previous.speakerTier !== next.speakerTier) return false
    if (previous.mixLayer !== next.mixLayer || previous.volumeDb !== next.volumeDb || previous.pan !== next.pan) return false
    if (previous.speed !== next.speed || previous.pitch !== next.pitch || previous.volume !== next.volume) return false
    if (previous.emotion !== next.emotion) return false
    if (previous.voicePrompt !== next.voicePrompt) return false
    if (!canMergeStylePrompts(previous.stylePrompt, next.stylePrompt)) return false
    return joinTTSSegmentText(previous.text, next.text).length <= maxChars
}

function canMergeAcrossBlocks(previous: TTSSegment, next: TTSSegment): boolean {
    return isNarratorBatchSegment(previous)
        && isNarratorBatchSegment(next)
        && previous.batchable === true
        && next.batchable === true
        && previous.blockType === 'paragraph'
        && next.blockType === 'paragraph'
}

function resolveSpeakerTier(part: TTSSpeechPart, profile: TTSSpeakerVoiceProfile): TTSSpeakerTier | undefined {
    const explicit = normalizeSpeakerTier(profile.tier ?? part.tier)
    if (explicit) return explicit
    if (part.role === 'narrator') return 'S'
    if (part.soundEffect) return undefined
    if (part.role === 'other') return 'C'
    if (part.speakerIds?.length) return 'B'
    if (isLikelyBackgroundSpeakerName(part.speaker)) return 'C'
    return 'B'
}

function resolveSpeechPartMix(
    part: TTSSpeechPart,
    profile: TTSSpeakerVoiceProfile,
    tier: TTSSpeakerTier | undefined,
): Pick<TTSSegment, 'mixLayer' | 'volumeDb' | 'pan'> {
    if (part.soundEffect) return resolveSoundEffectMix(part)
    const explicitLayer = normalizeMixLayer(part.mixLayer ?? profile.mixLayer)
    const mixLayer = explicitLayer ?? getDefaultMixLayer(part, tier)
    const explicitVolumeDb = typeof part.volumeDb === 'number' && Number.isFinite(part.volumeDb)
        ? part.volumeDb
        : typeof profile.volumeDb === 'number' && Number.isFinite(profile.volumeDb)
            ? profile.volumeDb
            : undefined
    const volumeDb = explicitVolumeDb != null
        ? clampVolumeDb(explicitVolumeDb)
        : getDefaultVolumeDb(mixLayer)
    const explicitPan = typeof part.pan === 'number' && Number.isFinite(part.pan)
        ? part.pan
        : typeof profile.pan === 'number' && Number.isFinite(profile.pan)
            ? profile.pan
            : undefined
    const pan = explicitPan != null
        ? clampPan(explicitPan)
        : getDefaultPan(part, profile, mixLayer)
    return { mixLayer, volumeDb, pan }
}

function resolveSoundEffectMix(part: TTSSpeechPart): Pick<TTSSegment, 'mixLayer' | 'volumeDb' | 'pan'> {
    const explicitLayer = normalizeMixLayer(part.mixLayer)
    const mixLayer = explicitLayer ?? 'midground'
    const volumeDb = typeof part.volumeDb === 'number' && Number.isFinite(part.volumeDb)
        ? clampVolumeDb(part.volumeDb)
        : getDefaultSoundEffectVolumeDb(mixLayer)
    const pan = typeof part.pan === 'number' && Number.isFinite(part.pan)
        ? clampPan(part.pan)
        : getDefaultSoundEffectPan(part, mixLayer)
    return { mixLayer, volumeDb, pan }
}

function getDefaultSoundEffectVolumeDb(layer: TTSMixLayer): number {
    if (layer === 'foreground') return -2
    if (layer === 'midground') return -6
    return -12
}

function getDefaultSoundEffectPan(part: TTSSpeechPart, layer: TTSMixLayer): number {
    if (layer === 'foreground') return 0
    const spread = layer === 'midground' ? 0.28 : 0.55
    const key = `${part.block.id}:${part.start}:${part.soundEffectPrompt ?? part.text}`
    return stablePan(key, spread)
}

function getDefaultMixLayer(part: TTSSpeechPart, tier: TTSSpeakerTier | undefined): TTSMixLayer {
    if (part.role === 'narrator' || tier === 'S' || tier === 'A') return 'foreground'
    if (tier === 'B') return 'midground'
    if (tier === 'C' || part.role === 'other') return 'background'
    return isLikelyBackgroundSpeakerName(part.speaker) ? 'background' : 'midground'
}

function getDefaultVolumeDb(layer: TTSMixLayer): number {
    if (layer === 'foreground') return 0
    if (layer === 'midground') return -4
    return -8
}

function getDefaultPan(part: TTSSpeechPart, profile: TTSSpeakerVoiceProfile, layer: TTSMixLayer): number {
    if (layer === 'foreground') return 0
    const spread = layer === 'midground' ? 0.18 : 0.42
    const key = `${profile.speakerId ?? part.speakerId ?? part.speaker}:${part.role}`
    return stablePan(key, spread)
}

function stablePan(key: string, spread: number): number {
    let hash = 2166136261
    for (let index = 0; index < key.length; index += 1) {
        hash ^= key.charCodeAt(index)
        hash = Math.imul(hash, 16777619)
    }
    const normalized = ((hash >>> 0) % 2001) / 1000 - 1
    return roundMixValue(clampPan(normalized * spread))
}

function isLikelyBackgroundSpeakerName(speaker: string | undefined): boolean {
    if (!speaker) return false
    return /路人|群众|围观|同学|学生|乘客|店员|街坊|邻居|人群|众人|有人|男声|女声|广播|系统|警察|士兵|职员/.test(speaker)
}

function normalizeMixLayer(layer: unknown): TTSMixLayer | undefined {
    return layer === 'foreground' || layer === 'midground' || layer === 'background'
        ? layer
        : undefined
}

function clampVolumeDb(value: number): number {
    return roundMixValue(Math.max(-60, Math.min(12, value)))
}

function clampPan(value: number): number {
    return Math.max(-1, Math.min(1, value))
}

function roundMixValue(value: number): number {
    return Math.round(value * 1000) / 1000
}

function isNarratorBatchSegment(segment: TTSSegment): boolean {
    return segment.speakerRole === 'narrator'
        || segment.speaker === NARRATOR_SPEAKER
        || segment.speaker === NARRATOR_SPEAKER_LABEL
}

function mergeTTSSegmentRanges(previous: TTSSegment, next: TTSSegment): TTSSegmentRange[] {
    const ranges = [...getTTSSegmentRanges(previous), ...getTTSSegmentRanges(next)]
    const merged: TTSSegmentRange[] = []
    for (const range of ranges) {
        const last = merged[merged.length - 1]
        if (
            last
            && last.blockId === range.blockId
            && last.blockType === range.blockType
            && range.startOffset <= last.endOffset + 8
        ) {
            last.endOffset = Math.max(last.endOffset, range.endOffset)
        } else {
            merged.push({ ...range })
        }
    }
    return merged
}

function getTTSSegmentRanges(segment: TTSSegment): TTSSegmentRange[] {
    if (segment.ranges?.length) return segment.ranges.map(range => ({ ...range }))
    return [{
        blockId: segment.blockId,
        blockType: segment.blockType,
        startOffset: segment.startOffset,
        endOffset: segment.endOffset,
    }]
}

function isBatchableNarratorBlock(block: TextBlock): boolean {
    if (block.type !== 'paragraph') return false
    const attrs = block.attrs ?? {}
    const tokens = [
        attrs['data-rebook-role'],
        attrs['epub:type'],
        attrs.type,
        attrs.role,
        attrs.rel,
        attrs.class,
    ]
        .filter(Boolean)
        .flatMap(value => value!.toLowerCase().split(/\s+/))
    if (tokens.some(token => token.includes('footnote') || token.includes('endnote') || token === 'note')) return false
    return true
}

function canMergeStylePrompts(previous: string | undefined, next: string | undefined): boolean {
    if (previous === next) return true
    return !previous || !next
}

function joinTTSSegmentText(previous: string, next: string): string {
    if (!previous) return next
    if (!next) return previous
    if (/\s$/.test(previous) || /^\s/.test(next)) return previous + next
    if (shouldInsertSpaceBetweenSegments(previous, next)) return `${previous} ${next}`
    return previous + next
}

function shouldInsertSpaceBetweenSegments(previous: string, next: string): boolean {
    const left = previous[previous.length - 1] ?? ''
    const right = next[0] ?? ''
    return /[A-Za-z0-9]/.test(left) && /[A-Za-z0-9]/.test(right)
}

function mergeSpeakerConfidence(previous: number | undefined, next: number | undefined): number | undefined {
    if (previous == null) return next
    if (next == null) return previous
    return Math.min(previous, next)
}

function combineStylePrompts(...values: Array<string | undefined>): string | undefined {
    const seen = new Set<string>()
    const parts: string[] = []
    for (const value of values) {
        const normalized = normalizeAudioTag(value)
        if (!normalized || seen.has(normalized)) continue
        seen.add(normalized)
        parts.push(normalized)
    }
    return parts.length ? parts.join('，') : undefined
}

function applyProviderAudioTags(
    text: string,
    prefixTag: string | undefined,
    suffixTag: string | undefined,
    provider: string | undefined,
): string {
    if (provider !== 'mimo') return text
    let nextText = text
    const prefix = normalizeAudioTag(prefixTag)
    if (prefix && !/^[（(［\[][^）)］\]]{1,24}[）)］\]]/.test(nextText.trim())) {
        nextText = `（${prefix}）${nextText}`
    }
    const suffix = normalizeAudioTag(suffixTag)
    if (suffix) nextText = `${nextText}（${suffix}）`
    return nextText
}

function normalizeAudioTag(value: string | undefined): string | undefined {
    const normalized = value
        ?.replace(/^[（(［\[]+/, '')
        .replace(/[）)］\]]+$/, '')
        .replace(/\s+/g, '')
        .trim()
    return normalized || undefined
}

async function analyzeSpeakerParts(
    sectionIndex: number,
    readableBlocks: readonly ReadableBlock[],
    options: ResolvedTTSSectionOptions,
): Promise<TTSSpeechPart[]> {
    const parts = options.speakerAnalyzer
        ? await analyzeWithSpeakerAnalyzer(sectionIndex, readableBlocks, options.speakerAnalyzer, options.speakerVoiceState)
        : await analyzeWithModelSpeakerAnalyzer(sectionIndex, readableBlocks, options)
    return parts
}

async function analyzeWithSpeakerAnalyzer(
    sectionIndex: number,
    readableBlocks: readonly ReadableBlock[],
    analyzer: TTSSpeakerAnalyzer,
    speakerVoiceState: TTSSpeakerVoiceState,
): Promise<TTSSpeechPart[]> {
    const readableByBlockId = new Map(readableBlocks.map(item => [item.block.id, item]))
    const analysis = await analyzer({
        sectionIndex,
        blocks: readableBlocks.map(({ block, readable }) => ({
            blockId: block.id,
            blockType: block.type,
            text: readable.text,
        })),
        knownSpeakers: getKnownSpeakerAssignments(speakerVoiceState),
    })
    return normalizeAnalysisSegments(readableByBlockId, analysis, { preferSegmentText: true })
}

async function analyzeWithModelSpeakerAnalyzer(
    sectionIndex: number,
    readableBlocks: readonly ReadableBlock[],
    options: ResolvedTTSSectionOptions,
): Promise<TTSSpeechPart[]> {
    const model = getSpeakerAnalysisModel(options)
    if (!model) {
        throw new Error('TTS multiSpeaker requires a LanguageModel via withTTS({ model }), speakerAnalysis.model, or a custom speakerAnalyzer.')
    }
    const readableByCompactBlockId = new Map(readableBlocks.map((item, index) => [index, item]))
    const providerCatalog = await (options.providerCatalog?.() ?? [])
    const voiceLanguage = inferVoiceLanguage(options.lang, readableBlocks)
    const voiceDesign = supportsVoiceDesign(options.provider, providerCatalog) ? 1 : undefined
    const voiceCatalog = voiceDesign ? [] : await (options.voiceCatalog?.() ?? [])
    const voices = voiceCatalog.length ? compactVoiceCatalog(voiceCatalog, voiceLanguage) : undefined
    let request: TTSCompactSpeakerAnalysisRequest = {
        sectionIndex,
        nextSpeakerId: options.speakerVoiceState.nextSpeakerId,
        voiceLanguage,
        voices,
        blocks: readableBlocks.map(({ block, readable }, index) => {
            const mixed = hasLikelyMixedNarrationDialogue(readable.text)
            return {
                b: index,
                t: block.type,
                l: readable.text.length,
                x: readable.text,
                m: mixed ? 1 : undefined,
                u: buildCompactSpeakerAtoms(readable.text),
            }
        }),
        knownSpeakers: getCompactKnownSpeakerAssignments(options.speakerVoiceState),
        voiceDesign,
    }
    const analysisMode: TTSCompactSpeakerAnalysisMode = voiceDesign ? 'voiceDesign' : 'presetVoice'
    const customAnalysisPrompt = options.speakerAnalysis?.prompt
    const system = customAnalysisPrompt ?? buildSpeakerAnalysisSystemPrompt(voiceLanguage, analysisMode)
    const repairSystem = buildSpeakerAnalysisRepairPrompt(voiceLanguage, analysisMode, customAnalysisPrompt)
    const analysisSchema = getSpeakerAnalysisSchema(analysisMode)
    if (voiceDesign) {
        const scenePlan = await planCompactScenesWithModel(
            model,
            buildScenePlanningSystemPrompt(options.lang),
            request,
            options.speakerAnalysis,
        )
        request = applyCompactScenePlanToRequest(request, scenePlan)
        const planRequest: TTSCompactSpeakerAnalysisRequest = {
            ...request,
            voices: undefined,
        }
        const plan = await planCompactSpeakersWithModel(
            model,
            buildSpeakerPlanningSystemPrompt(options.lang),
            planRequest,
            options.speakerAnalysis,
        )
        applyCompactSpeakerInfos(plan.speakers, options.speakerVoiceState, request.knownScenes)
        startSpeakerVoiceDesigns(options.speakerVoiceState, options.voiceDesigner)
        request = {
            ...request,
            nextSpeakerId: options.speakerVoiceState.nextSpeakerId,
            knownSpeakers: getCompactKnownSpeakerAssignments(options.speakerVoiceState),
        }
    }
    const startedAt = nowMs()
    let output: TTSCompactSpeakerAnalysis
    const modelRequest = buildCompactSpeakerModelRequest(request, analysisMode, 'initial')
    let rawOutput: unknown
    try {
        const result = await generateText({
            model,
            output: Output.object({
                schema: jsonSchema<TTSCompactSpeakerAnalysisOutput>(analysisSchema),
                description: 'Compact novel TTS atom speaker assignments. Use assignments, not segments.',
            }),
            timeout: normalizeTimeoutMs(options.speakerAnalysis?.timeoutMs),
            abortSignal: createTimeoutSignal(options.speakerAnalysis?.timeoutMs),
            system,
            prompt: JSON.stringify(modelRequest),
        })
        rawOutput = result.output
        output = normalizeCompactSpeakerAnalysisOutput(rawOutput, request)
        await options.speakerAnalysis?.onLog?.({
            phase: 'initial',
            sectionIndex,
            request: modelRequest,
            response: rawOutput,
            durationMs: Math.round((nowMs() - startedAt) * 10) / 10,
        })
    } catch (error) {
        await options.speakerAnalysis?.onLog?.({
            phase: 'initial',
            sectionIndex,
            request: modelRequest,
            response: rawOutput ?? null,
            durationMs: Math.round((nowMs() - startedAt) * 10) / 10,
            error: getErrorMessage(error),
        })
        throw error
    }
    const analysis = await repairCompactAnalysisWithModelIfNeeded(
        model,
        request,
        output,
        analysisSchema,
        repairSystem,
        options.speakerAnalysis,
    )
    if (voiceDesign && analysis.speakers?.length) {
        applyCompactSpeakerInfos(analysis.speakers, options.speakerVoiceState, request.knownScenes)
        startSpeakerVoiceDesigns(options.speakerVoiceState, options.voiceDesigner)
    }
    await settleSpeakerVoiceDesigns(options.speakerVoiceState)
    return normalizeCompactAnalysisSegments(
        readableByCompactBlockId,
        splitCompactQuoteNarrationSegments(request, analysis),
        options,
    )
}

function getSpeakerAnalysisModel(options: ResolvedTTSSectionOptions): LanguageModel | undefined {
    return options.speakerAnalysis?.model ?? options.model
}

function normalizeAnalysisSegments(
    readableByBlockId: ReadonlyMap<string, ReadableBlock>,
    analysis: TTSSpeakerAnalysis,
    options: { preferSegmentText?: boolean } = {},
): TTSSpeechPart[] {
    const parts: TTSSpeechPart[] = []
    for (const segment of analysis.segments ?? []) {
        const readableBlock = readableByBlockId.get(segment.blockId)
        if (!readableBlock) continue
        const start = Math.max(0, Math.min(segment.startOffset, readableBlock.readable.text.length))
        const end = Math.max(start, Math.min(segment.endOffset, readableBlock.readable.text.length))
        const text = options.preferSegmentText && segment.text
            ? segment.text
            : readableBlock.readable.text.slice(start, end)
        if (!text.trim()) continue
        const role = normalizeSpeakerRole(segment.role)
        const gender = normalizeSpeakerGender(segment.gender)
        parts.push({
            block: readableBlock.block,
            readable: readableBlock.readable,
            text,
            start,
            end,
            speakerId: segment.speakerId,
            speakerIds: normalizeSimultaneousSpeakerIds(segment.speakerIds, segment.speakerId),
            speaker: normalizeSpeakerName(segment.speaker, role, gender),
            role,
            gender,
            tier: normalizeSpeakerTier(segment.tier),
            confidence: segment.confidence,
            voice: segment.voice,
            speed: parseSpeechSpeed(segment.speed),
            pitch: segment.pitch,
            volume: segment.volume,
            emotion: segment.emotion,
            voicePrompt: normalizeVoicePrompt(segment.voicePrompt),
            stylePrompt: normalizeVoicePrompt(segment.stylePrompt),
            mixLayer: normalizeMixLayer(segment.mixLayer),
            volumeDb: typeof segment.volumeDb === 'number' && Number.isFinite(segment.volumeDb)
                ? clampVolumeDb(segment.volumeDb)
                : undefined,
            pan: typeof segment.pan === 'number' && Number.isFinite(segment.pan)
                ? clampPan(segment.pan)
                : undefined,
        })
    }
    return parts
}

const DEFAULT_MULTI_SPEAKER_VOICE_PROFILE: TTSVoiceProfile = {
    narrator: { voice: 'zh-CN-YunxiNeural', role: 'narrator', gender: 'unknown' },
    male: [
        { voice: 'zh-CN-YunjianNeural', role: 'character', gender: 'male' },
        { voice: 'zh-CN-YunxiNeural', role: 'character', gender: 'male' },
    ],
    female: [
        { voice: 'zh-CN-XiaoyiNeural', role: 'character', gender: 'female' },
        { voice: 'zh-CN-XiaoxiaoNeural', role: 'character', gender: 'female' },
    ],
    unknown: { voice: 'zh-CN-YunxiNeural', role: 'character', gender: 'unknown' },
    other: { voice: 'zh-CN-XiaoxiaoNeural', role: 'other', gender: 'unknown' },
}

const MIMO_MULTI_SPEAKER_VOICE_PROFILE: TTSVoiceProfile = {
    narrator: { voice: 'mimo_default', role: 'narrator', gender: 'unknown' },
    male: [
        { voice: '苏打', role: 'character', gender: 'male' },
        { voice: '白桦', role: 'character', gender: 'male' },
    ],
    female: [
        { voice: '冰糖', role: 'character', gender: 'female' },
        { voice: '茉莉', role: 'character', gender: 'female' },
    ],
    unknown: { voice: 'mimo_default', role: 'character', gender: 'unknown' },
    other: { voice: 'mimo_default', role: 'other', gender: 'unknown' },
}

const NARRATOR_SPEAKER = 'narrator'
const NARRATOR_SPEAKER_LABEL = '旁白'
const NARRATOR_SPEAKER_ID = 0
const OTHER_SPEAKER = 'other'

async function planCompactScenesWithModel(
    model: LanguageModel,
    system: string,
    request: TTSCompactSpeakerAnalysisRequest,
    analysisOptions?: TTSSpeakerAnalysisOptions,
): Promise<TTSCompactScenePlan> {
    const startedAt = nowMs()
    let output: unknown
    const modelRequest = buildCompactSpeakerModelRequest(request, 'voiceDesign', 'scene')
    try {
        const result = await generateText({
            model,
            output: Output.object({
                schema: jsonSchema<TTSCompactScenePlan>(scenePlanSchema),
                description: 'Compact novel TTS scene plan.',
            }),
            timeout: normalizeTimeoutMs(analysisOptions?.timeoutMs),
            abortSignal: createTimeoutSignal(analysisOptions?.timeoutMs),
            system,
            prompt: JSON.stringify(modelRequest),
        })
        output = result.output
        await analysisOptions?.onLog?.({
            phase: 'scene',
            sectionIndex: request.sectionIndex,
            request: modelRequest,
            response: output,
            durationMs: Math.round((nowMs() - startedAt) * 10) / 10,
        })
    } catch (error) {
        await analysisOptions?.onLog?.({
            phase: 'scene',
            sectionIndex: request.sectionIndex,
            request: modelRequest,
            response: output ?? null,
            durationMs: Math.round((nowMs() - startedAt) * 10) / 10,
            error: getErrorMessage(error),
        })
        throw error
    }
    return normalizeCompactScenePlanOutput(output, request)
}

async function planCompactSpeakersWithModel(
    model: LanguageModel,
    system: string,
    request: TTSCompactSpeakerAnalysisRequest,
    analysisOptions?: TTSSpeakerAnalysisOptions,
): Promise<TTSCompactSpeakerPlan> {
    const startedAt = nowMs()
    let output: unknown
    const modelRequest = buildCompactSpeakerModelRequest(request, 'voiceDesign', 'plan')
    try {
        const result = await generateText({
            model,
            output: Output.array({
                element: jsonSchema<TTSCompactSpeakerInfo>(speakerPlanItemSchema),
                description: 'Compact novel TTS speaker and voice plan.',
            }),
            timeout: normalizeTimeoutMs(analysisOptions?.timeoutMs),
            abortSignal: createTimeoutSignal(analysisOptions?.timeoutMs),
            system,
            prompt: JSON.stringify(modelRequest),
        })
        output = result.output
        await analysisOptions?.onLog?.({
            phase: 'plan',
            sectionIndex: request.sectionIndex,
            request: modelRequest,
            response: output,
            durationMs: Math.round((nowMs() - startedAt) * 10) / 10,
        })
    } catch (error) {
        await analysisOptions?.onLog?.({
            phase: 'plan',
            sectionIndex: request.sectionIndex,
            request: modelRequest,
            response: null,
            durationMs: Math.round((nowMs() - startedAt) * 10) / 10,
            error: getErrorMessage(error),
        })
        throw error
    }
    return normalizeCompactSpeakerPlanOutput(output)
}

function normalizeCompactScenePlanOutput(
    output: unknown,
    request: TTSCompactSpeakerAnalysisRequest,
): TTSCompactScenePlan {
    if (!output || typeof output !== 'object') return { scenes: [] }
    const rawScenes = Array.isArray((output as { scenes?: unknown }).scenes)
        ? (output as { scenes: unknown[] }).scenes
        : []
    const blockIds = new Set(request.blocks.map(block => block.b))
    return { scenes: normalizeCompactScenes(rawScenes, blockIds) }
}

function normalizeCompactScenes(values: readonly unknown[], validBlockIds?: ReadonlySet<number>): TTSCompactSceneInfo[] {
    const scenes: TTSCompactSceneInfo[] = []
    const seen = new Set<number>()
    for (const scene of values) {
        if (!scene || typeof scene !== 'object') continue
        const item = scene as Partial<TTSCompactSceneInfo>
        const id = normalizeSceneNumber(item.i)
        const name = typeof item.n === 'string' ? normalizeVoicePrompt(item.n) : undefined
        if (id == null || id <= 0 || !name || seen.has(id)) continue
        seen.add(id)
        const blockIds = Array.isArray(item.b)
            ? item.b
                .map(normalizeSceneNumber)
                .filter((value): value is number => value != null && (!validBlockIds || validBlockIds.has(value)))
            : undefined
        scenes.push({
            i: id,
            n: name,
            b: blockIds?.length ? Array.from(new Set(blockIds)) : undefined,
            loc: typeof item.loc === 'string' ? normalizeVoicePrompt(item.loc) : undefined,
            a: typeof item.a === 'string' ? normalizeVoicePrompt(item.a) : undefined,
            c: typeof item.c === 'string' ? normalizeVoicePrompt(item.c) : undefined,
            q: typeof item.q === 'string' ? normalizeVoicePrompt(item.q) : undefined,
            h: typeof item.h === 'string' ? normalizeSpeakerHint(item.h) : undefined,
            fx: Array.isArray(item.fx)
                ? item.fx.filter((value): value is string => typeof value === 'string').map(value => normalizeVoicePrompt(value)).filter(Boolean) as string[]
                : undefined,
        })
    }
    return scenes
}

function normalizeSceneNumber(value: number | undefined): number | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
    return Math.max(0, Math.floor(value))
}

function applyCompactScenePlanToRequest(
    request: TTSCompactSpeakerAnalysisRequest,
    plan: TTSCompactScenePlan,
): TTSCompactSpeakerAnalysisRequest {
    if (!plan.scenes.length) return request
    const sceneByBlock = new Map<number, number>()
    for (const scene of plan.scenes) {
        for (const blockId of scene.b ?? []) {
            if (!sceneByBlock.has(blockId)) sceneByBlock.set(blockId, scene.i)
        }
    }
    return {
        ...request,
        knownScenes: plan.scenes,
        blocks: request.blocks.map(block => ({
            ...block,
            s: sceneByBlock.get(block.b) ?? block.s,
        })),
    }
}

function normalizeCompactSpeakerAnalysisOutput(
    output: unknown,
    request: TTSCompactSpeakerAnalysisRequest,
): TTSCompactSpeakerAnalysis {
    if (!output || typeof output !== 'object' || !Array.isArray((output as { assignments?: unknown }).assignments)) {
        throw new Error('TTS speaker analysis response must include assignments.')
    }
    const blockById = new Map(request.blocks.map(block => [block.b, block]))
    const expectedAtoms = request.blocks.reduce((count, block) => count + (block.u?.length ?? 0), 0)
    const speakers: TTSCompactSpeakerInfo[] = []
    if (Array.isArray((output as { speakers?: unknown }).speakers)) {
        for (const speaker of (output as { speakers: unknown[] }).speakers) {
            if (!speaker || typeof speaker !== 'object') continue
            const item = speaker as Partial<TTSCompactSpeakerInfo>
            if (typeof item.i !== 'number' || typeof item.n !== 'string') continue
            speakers.push({
                i: Number(item.i),
                n: item.n,
                r: item.r,
                g: item.g,
                t: normalizeSpeakerTier(item.t),
                v: typeof item.v === 'string' ? item.v : undefined,
                d: typeof item.d === 'string' ? normalizeVoicePrompt(item.d) : undefined,
                a: typeof item.a === 'string' ? normalizeVoicePrompt(item.a) : undefined,
                o: typeof item.o === 'string' ? normalizeVoicePrompt(item.o) : undefined,
                p: typeof item.p === 'string' ? normalizeVoicePrompt(item.p) : undefined,
                q: typeof item.q === 'string' ? normalizeVoicePrompt(item.q) : undefined,
                h: typeof item.h === 'string' ? normalizeSpeakerHint(item.h) : undefined,
                s: Array.isArray(item.s)
                    ? item.s.map(normalizeSceneNumber).filter((value): value is number => value != null && value > 0)
                    : undefined,
            })
        }
    }
    const segments: TTSCompactSpeakerAnalysisSegment[] = []
    for (const [index, segment] of (output as { assignments: unknown[] }).assignments.entries()) {
        if (!segment || typeof segment !== 'object') {
            throw new Error(`TTS speaker analysis assignment ${index} must be an object.`)
        }
        const item = segment as Partial<TTSCompactSpeakerAttribution>
        if (
            typeof item.b !== 'number'
            || typeof item.a !== 'number'
            || !Number.isFinite(item.b)
            || !Number.isFinite(item.a)
        ) throw new Error(`TTS speaker analysis assignment ${index} must include numeric b and a.`)
        const itemKind = item.k === 's' || item.k === 'm' ? item.k : undefined
        const itemSpeakerId = typeof item.i === 'number' && Number.isFinite(item.i)
            ? item.i
            : itemKind === 's'
                ? NARRATOR_SPEAKER_ID
                : undefined
        if (itemSpeakerId == null) {
            throw new Error(`TTS speaker analysis assignment ${index} must include numeric i.`)
        }
        const block = blockById.get(item.b)
        const atom = block?.u?.find(value => value.a === item.a)
        if (!atom) throw new Error(`TTS speaker analysis assignment ${index} references unknown atom ${item.b}:${item.a}.`)
        const speakerId = atom && block?.m === 1 && atom.q !== 1
            ? NARRATOR_SPEAKER_ID
            : itemSpeakerId
        const speakerIds = speakerId === NARRATOR_SPEAKER_ID
            ? undefined
            : normalizeSimultaneousSpeakerIds(item.is, speakerId)
        segments.push({
            b: item.b,
            s: atom.s,
            e: atom.e,
            i: speakerId,
            is: speakerIds,
            c: typeof item.c === 'number' ? item.c : undefined,
            k: itemKind,
            p: typeof item.p === 'string' ? normalizeAudioTag(item.p) : undefined,
            fx: item.k === 's' && typeof item.fx === 'string' ? normalizeSoundEffectPrompt(item.fx) : undefined,
            dur: item.k === 's' ? normalizeSoundEffectDurationSeconds(item.dur) : undefined,
            l: item.k === 's' ? normalizeCompactMixLayerCode(item.l) : undefined,
            pan: typeof item.pan === 'number' && Number.isFinite(item.pan)
                ? clampPan(item.pan)
                : undefined,
        })
    }
    if (expectedAtoms > 0 && !(output as { assignments: unknown[] }).assignments.length) {
        throw new Error('TTS speaker analysis response did not assign any readable atoms.')
    }
    return { speakers, segments }
}

function normalizeCompactSpeakerPlanOutput(output: unknown): TTSCompactSpeakerPlan {
    if (Array.isArray(output)) {
        return { speakers: normalizeCompactSpeakerInfos(output) }
    }
    if (!output || typeof output !== 'object' || !Array.isArray((output as { speakers?: unknown }).speakers)) {
        return { speakers: [] }
    }
    return {
        speakers: normalizeCompactSpeakerInfos((output as { speakers: unknown[] }).speakers),
    }
}

function normalizeCompactSpeakerInfos(values: readonly unknown[]): TTSCompactSpeakerInfo[] {
    const speakers: TTSCompactSpeakerInfo[] = []
    for (const speaker of values) {
        if (!speaker || typeof speaker !== 'object') continue
        const item = speaker as Partial<TTSCompactSpeakerInfo>
        if (typeof item.i !== 'number' || typeof item.n !== 'string') continue
        speakers.push({
            i: Number(item.i),
            n: item.n,
            r: item.r,
            g: item.g,
            t: normalizeSpeakerTier(item.t),
            v: typeof item.v === 'string' ? item.v : undefined,
            d: typeof item.d === 'string' ? normalizeVoicePrompt(item.d) : undefined,
            a: typeof item.a === 'string' ? normalizeVoicePrompt(item.a) : undefined,
            o: typeof item.o === 'string' ? normalizeVoicePrompt(item.o) : undefined,
            p: typeof item.p === 'string' ? normalizeVoicePrompt(item.p) : undefined,
            q: typeof item.q === 'string' ? normalizeVoicePrompt(item.q) : undefined,
            h: typeof item.h === 'string' ? normalizeSpeakerHint(item.h) : undefined,
            s: Array.isArray(item.s)
                ? item.s.map(normalizeSceneNumber).filter((value): value is number => value != null && value > 0)
                : undefined,
        })
    }
    return speakers
}

function splitCompactQuoteNarrationSegments(
    request: TTSCompactSpeakerAnalysisRequest,
    analysis: TTSCompactSpeakerAnalysis,
): TTSCompactSpeakerAnalysis {
    const blockById = new Map(request.blocks.map(block => [block.b, block]))
    const segments: TTSCompactSpeakerAnalysisSegment[] = []
    let changed = false
    for (const segment of analysis.segments) {
        const block = blockById.get(segment.b)
        if (!block || block.m !== 1 || !hasAnyQuote(block.x)) {
            segments.push(segment)
            continue
        }
        const split = splitSegmentByQuoteIntervals(block.x, segment)
        if (split.length !== 1 || split[0] !== segment) changed = true
        segments.push(...split)
    }
    if (!changed) return analysis
    return {
        ...analysis,
        segments: mergeAdjacentCompactSegments(segments),
    }
}

function splitSegmentByQuoteIntervals(
    text: string,
    segment: TTSCompactSpeakerAnalysisSegment,
): TTSCompactSpeakerAnalysisSegment[] {
    const pieces: TTSCompactSpeakerAnalysisSegment[] = []
    for (const interval of getQuoteIntervals(text)) {
        const start = Math.max(segment.s, interval.start)
        const end = Math.min(segment.e, interval.end)
        if (end <= start || !hasSpeakableText(text.slice(start, end))) continue
        pieces.push({
            ...segment,
            s: start,
            e: end,
            i: interval.quoted ? segment.i : NARRATOR_SPEAKER_ID,
            is: interval.quoted ? segment.is : undefined,
        })
    }
    return pieces.length ? pieces : [segment]
}

function getQuoteIntervals(text: string): { start: number, end: number, quoted: boolean }[] {
    const intervals: { start: number, end: number, quoted: boolean }[] = []
    let start = 0
    let quoted = false
    for (let index = 0; index < text.length; index++) {
        const char = text[index] ?? ''
        if (char === '"') {
            pushQuoteInterval(intervals, start, index, quoted)
            quoted = !quoted
            start = index + 1
        } else if (!quoted && isOpenQuote(char)) {
            pushQuoteInterval(intervals, start, index, false)
            quoted = true
            start = index + 1
        } else if (quoted && isCloseQuote(char)) {
            pushQuoteInterval(intervals, start, index, true)
            quoted = false
            start = index + 1
        }
    }
    pushQuoteInterval(intervals, start, text.length, quoted)
    return intervals
}

function pushQuoteInterval(
    intervals: { start: number, end: number, quoted: boolean }[],
    start: number,
    end: number,
    quoted: boolean,
): void {
    if (end > start) intervals.push({ start, end, quoted })
}

function mergeAdjacentCompactSegments(
    segments: readonly TTSCompactSpeakerAnalysisSegment[],
): TTSCompactSpeakerAnalysisSegment[] {
    const sorted = [...segments].sort((a, b) => a.b - b.b || a.s - b.s || a.e - b.e)
    const merged: TTSCompactSpeakerAnalysisSegment[] = []
    for (const segment of sorted) {
        const previous = merged[merged.length - 1]
        if (
            previous
            && previous.b === segment.b
            && previous.i === segment.i
            && sameNumberArray(previous.is, segment.is)
            && previous.k === segment.k
            && previous.p === segment.p
            && previous.fx === segment.fx
            && previous.dur === segment.dur
            && previous.e === segment.s
        ) {
            previous.e = segment.e
            previous.c = mergeSpeakerConfidence(previous.c, segment.c)
        } else {
            merged.push({ ...segment })
        }
    }
    return merged
}

function hasAnyQuote(text: string): boolean {
    for (let index = 0; index < text.length; index++) {
        const char = text[index] ?? ''
        if (isOpenQuote(char) || isCloseQuote(char)) return true
    }
    return false
}

function buildCompactSpeakerAtoms(text: string): TTSCompactSpeakerAtom[] {
    const intervals = hasAnyQuote(text)
        ? getQuoteIntervals(text)
        : [{ start: 0, end: text.length, quoted: false }]
    const atoms: TTSCompactSpeakerAtom[] = []
    for (const interval of intervals) {
        const ranges = interval.quoted
            ? [trimSilentGapEdges(text, interval.start, interval.end)]
            : splitNarrationAtomRanges(text, interval.start, interval.end)
        for (const range of ranges) {
            const value = text.slice(range.start, range.end)
            if (!hasSpeakableText(value)) continue
            atoms.push({
                a: atoms.length,
                s: range.start,
                e: range.end,
                x: value,
                q: interval.quoted ? 1 : undefined,
            })
        }
    }
    return atoms
}

function splitNarrationAtomRanges(text: string, start: number, end: number): Array<{ start: number, end: number }> {
    const source = text.slice(start, end)
    const ranges: Array<{ start: number, end: number }> = []
    const pattern = /[^。！？.!?；;]+[。！？.!?；;]?/g
    for (const match of source.matchAll(pattern)) {
        const raw = match[0]
        const offset = start + (match.index ?? 0)
        const leading = raw.length - raw.trimStart().length
        const trailing = raw.length - raw.trimEnd().length
        const range = trimSilentGapEdges(text, offset + leading, offset + raw.length - trailing)
        if (range.end > range.start) ranges.push(range)
    }
    if (ranges.length) return ranges
    const range = trimSilentGapEdges(text, start, end)
    return range.end > range.start ? [range] : []
}

function buildCompactSpeakerModelRequest(
    request: TTSCompactSpeakerAnalysisRequest,
    mode: TTSCompactSpeakerAnalysisMode,
    kind: TTSCompactSpeakerModelRequestKind,
): TTSCompactSpeakerModelRequest {
    const canCreateSpeakers = kind === 'plan' || (kind === 'initial' && mode === 'presetVoice')
    return {
        nextSpeakerId: canCreateSpeakers ? request.nextSpeakerId : undefined,
        voices: request.voices?.length ? request.voices : undefined,
        blocks: request.blocks.map(block => compactBlockForModel(block, kind)),
        knownSpeakers: request.knownSpeakers.map(compactSpeakerForModel),
        knownScenes: kind === 'scene' ? undefined : request.knownScenes?.map(compactSceneForModel),
    }
}

function compactBlockForModel(
    block: TTSCompactSpeakerAnalysisBlock,
    kind: TTSCompactSpeakerModelRequestKind,
): TTSCompactSpeakerAnalysisBlock {
    if (kind !== 'plan' && kind !== 'scene') return block
    return {
        b: block.b,
        t: block.t,
        l: block.l,
        x: block.x,
        s: block.s,
        m: block.m,
    }
}

function compactSpeakerForModel(speaker: TTSCompactKnownSpeaker): TTSCompactKnownSpeaker {
    return {
        i: speaker.i,
        n: speaker.n,
        r: speaker.r,
        g: speaker.g,
        t: speaker.t,
        h: speaker.h,
        s: speaker.s,
    }
}

function compactSceneForModel(scene: TTSCompactSceneInfo): TTSCompactSceneInfo {
    return {
        i: scene.i,
        n: scene.n,
        loc: scene.loc,
        a: scene.a,
        c: scene.c,
        q: scene.q,
        h: scene.h,
        fx: scene.fx,
    }
}

async function repairCompactAnalysisWithModelIfNeeded(
    model: LanguageModel,
    request: TTSCompactSpeakerAnalysisRequest,
    analysis: TTSCompactSpeakerAnalysis,
    analysisSchema: typeof speakerAnalysisSchema | typeof voiceDesignSpeakerAnalysisSchema,
    repairSystem: string,
    analysisOptions?: TTSSpeakerAnalysisOptions,
): Promise<TTSCompactSpeakerAnalysis> {
    const repairBlockIds = findSpeakerAnalysisRepairBlocks(request, analysis)
    if (!repairBlockIds.size) return analysis

    const repairRequest: TTSCompactSpeakerAnalysisRequest = {
        ...request,
        nextSpeakerId: getNextCompactSpeakerId(request, analysis),
        blocks: request.blocks
            .filter(block => repairBlockIds.has(block.b))
            .map(block => ({ ...block, u: block.u?.length ? block.u : buildCompactSpeakerAtoms(block.x) })),
        knownSpeakers: mergeCompactSpeakerInfos(request.knownSpeakers, analysis.speakers ?? []),
    }
    const startedAt = nowMs()
    let output: TTSCompactSpeakerAnalysis
    const modelRequest = buildCompactSpeakerModelRequest(repairRequest, analysisSchema === voiceDesignSpeakerAnalysisSchema ? 'voiceDesign' : 'presetVoice', 'repair')
    let rawOutput: unknown
    try {
        const result = await generateText({
            model,
            output: Output.object({
                schema: jsonSchema<TTSCompactSpeakerAnalysisOutput>(analysisSchema),
                description: 'Compact corrected novel TTS atom speaker assignments. Use assignments, not segments.',
            }),
            timeout: normalizeTimeoutMs(analysisOptions?.timeoutMs),
            abortSignal: createTimeoutSignal(analysisOptions?.timeoutMs),
            system: repairSystem,
            prompt: JSON.stringify(modelRequest),
        })
        rawOutput = result.output
        output = normalizeCompactSpeakerAnalysisOutput(rawOutput, repairRequest)
        await analysisOptions?.onLog?.({
            phase: 'repair',
            sectionIndex: request.sectionIndex,
            request: modelRequest,
            response: rawOutput,
            durationMs: Math.round((nowMs() - startedAt) * 10) / 10,
        })
    } catch (error) {
        await analysisOptions?.onLog?.({
            phase: 'repair',
            sectionIndex: request.sectionIndex,
            request: modelRequest,
            response: rawOutput ?? null,
            durationMs: Math.round((nowMs() - startedAt) * 10) / 10,
            error: getErrorMessage(error),
        })
        throw error
    }
    const repair = output
    if (!repair.segments.length) return analysis
    const repairedBlockIds = new Set(repair.segments.map(segment => segment.b))

    return {
        speakers: mergeCompactSpeakerInfos(analysis.speakers ?? [], repair.speakers ?? []),
        segments: [
            ...analysis.segments.filter(segment => !repairedBlockIds.has(segment.b)),
            ...repair.segments,
        ],
    }
}

function findSpeakerAnalysisRepairBlocks(
    request: TTSCompactSpeakerAnalysisRequest,
    analysis: TTSCompactSpeakerAnalysis,
): Set<number> {
    const segmentsByBlock = new Map<number, TTSCompactSpeakerAnalysisSegment[]>()
    for (const segment of analysis.segments) {
        const list = segmentsByBlock.get(segment.b)
        if (list) list.push(segment)
        else segmentsByBlock.set(segment.b, [segment])
    }

    const blockIds = new Set<number>()
    for (const block of request.blocks) {
        if (block.m !== 1) continue
        const speakers = new Set<number>()
        const validSegments: TTSCompactSpeakerAnalysisSegment[] = []
        let hasInvalidRange = false
        for (const segment of segmentsByBlock.get(block.b) ?? []) {
            if (!isUsableCompactSegment(block, segment)) {
                hasInvalidRange = true
                continue
            }
            validSegments.push(segment)
            if (isMutedCompactSegment(segment)) continue
            for (const speakerId of getCompactSegmentSpeakerIds(segment)) speakers.add(speakerId)
        }
        if (
            (speakers.size <= 1 && hasRequiredSpokenNarrationAtom(block, validSegments))
            || hasInvalidRange
            || hasSuspiciousTinyCompactSegment(block, validSegments)
            || hasSuspiciousQuoteBoundarySegment(block, validSegments)
            || hasSuspiciousUnmutedStyledCueAtom(block, validSegments)
            || hasSuspiciousMiddleCompactCoverageGap(block, validSegments)
        ) {
            blockIds.add(block.b)
        }
    }
    return blockIds
}

function isUsableCompactSegment(
    block: TTSCompactSpeakerAnalysisBlock,
    segment: TTSCompactSpeakerAnalysisSegment,
): boolean {
    if (
        !Number.isFinite(segment.s)
        || !Number.isFinite(segment.e)
        || segment.e <= segment.s
        || segment.s < 0
        || segment.e > block.x.length
    ) return false
    return hasSpeakableText(block.x.slice(segment.s, segment.e))
}

function isMutedCompactSegment(segment: TTSCompactSpeakerAnalysisSegment): boolean {
    return segment.k === 's' || segment.k === 'm'
}

function getCompactSegmentSpeakerIds(segment: TTSCompactSpeakerAnalysisSegment): number[] {
    const speakerIds = normalizeSimultaneousSpeakerIds(segment.is, segment.i)
    if (speakerIds?.length) return speakerIds
    const speakerId = normalizeSpeakerId(segment.i)
    return speakerId == null ? [] : [speakerId]
}

function getPrimaryCompactSpeakerId(segment: TTSCompactSpeakerAnalysisSegment): number {
    return normalizeSpeakerId(segment.i) ?? NARRATOR_SPEAKER_ID
}

function hasRequiredSpokenNarrationAtom(
    block: TTSCompactSpeakerAnalysisBlock,
    segments: readonly TTSCompactSpeakerAnalysisSegment[],
): boolean {
    const mutedRanges = segments.filter(isMutedCompactSegment)
    for (const atom of block.u ?? []) {
        if (atom.q === 1) continue
        if (!hasSpeakableText(atom.x)) continue
        if (isLikelySoundEffectText(atom.x)) continue
        if (mutedRanges.some(segment => segment.s <= atom.s && segment.e >= atom.e)) continue
        return true
    }
    return false
}

function hasSuspiciousTinyCompactSegment(
    block: TTSCompactSpeakerAnalysisBlock,
    segments: readonly TTSCompactSpeakerAnalysisSegment[],
): boolean {
    if (block.x.length < 12) return false
    return segments.some(segment => {
        if (isMutedCompactSegment(segment)) return false
        const text = block.x.slice(segment.s, segment.e)
        return text.length <= 4
            && hasSpeakableText(text)
            && hasSpeakableText(block.x.slice(segment.e))
            && !isCompleteQuotedTinySpeech(block.x, segment)
            && !isLikelyShortNarrationLeadIn(text)
    })
}

function isLikelyShortNarrationLeadIn(text: string): boolean {
    return /[：:]$/.test(text.trim())
}

function hasSuspiciousQuoteBoundarySegment(
    block: TTSCompactSpeakerAnalysisBlock,
    segments: readonly TTSCompactSpeakerAnalysisSegment[],
): boolean {
    return segments.some(segment => hasSegmentCrossingReadableQuoteBoundary(block.x, segment))
}

function hasSuspiciousUnmutedStyledCueAtom(
    block: TTSCompactSpeakerAnalysisBlock,
    segments: readonly TTSCompactSpeakerAnalysisSegment[],
): boolean {
    const atoms = block.u ?? []
    if (atoms.length < 2) return false
    for (let index = 0; index < atoms.length; index += 1) {
        const atom = atoms[index]
        if (atom.q === 1 || !hasSpeakableText(atom.x) || isLikelySoundEffectText(atom.x)) continue
        const segment = findCompactSegmentCoveringAtom(segments, atom)
        if (!segment || isMutedCompactSegment(segment) || normalizeSpeakerId(segment.i) !== NARRATOR_SPEAKER_ID) continue
        const previous = findNearestQuotedAtomWithSegment(atoms, segments, index, -1)
        const next = findNearestQuotedAtomWithSegment(atoms, segments, index, 1)
        if (!previous && !next) continue
        const hasAdjacentStyle = Boolean(previous?.segment.p || next?.segment.p)
        if (!hasAdjacentStyle) continue
        if (previous && next) {
            const previousSpeaker = normalizeSpeakerId(previous.segment.i)
            const nextSpeaker = normalizeSpeakerId(next.segment.i)
            if (previousSpeaker == null || previousSpeaker === NARRATOR_SPEAKER_ID) continue
            if (previousSpeaker !== nextSpeaker) continue
        }
        return true
    }
    return false
}

function findNearestQuotedAtomWithSegment(
    atoms: readonly TTSCompactSpeakerAtom[],
    segments: readonly TTSCompactSpeakerAnalysisSegment[],
    startIndex: number,
    direction: -1 | 1,
): { atom: TTSCompactSpeakerAtom, segment: TTSCompactSpeakerAnalysisSegment } | undefined {
    for (let index = startIndex + direction; index >= 0 && index < atoms.length; index += direction) {
        const atom = atoms[index]
        if (atom.q !== 1) {
            if (hasSpeakableText(atom.x)) return undefined
            continue
        }
        const segment = findCompactSegmentCoveringAtom(segments, atom)
        if (!segment || isMutedCompactSegment(segment)) return undefined
        const speakerId = normalizeSpeakerId(segment.i)
        if (speakerId == null || speakerId === NARRATOR_SPEAKER_ID) return undefined
        return { atom, segment }
    }
    return undefined
}

function findCompactSegmentCoveringAtom(
    segments: readonly TTSCompactSpeakerAnalysisSegment[],
    atom: TTSCompactSpeakerAtom,
): TTSCompactSpeakerAnalysisSegment | undefined {
    return segments.find(segment => segment.s <= atom.s && segment.e >= atom.e)
}

function hasSegmentCrossingReadableQuoteBoundary(
    text: string,
    segment: TTSCompactSpeakerAnalysisSegment,
): boolean {
    for (let index = segment.s; index < segment.e; index++) {
        if (isMutedCompactSegment(segment)) return false
        const char = text[index] ?? ''
        if (isCloseQuote(char)) {
            const after = text.slice(index + 1, segment.e)
            if (hasSpeakableText(after)) return true
        }
        if (isOpenQuote(char)) {
            const before = text.slice(segment.s, index)
            if (hasSpeakableText(before)) return true
        }
    }
    return false
}

function hasSuspiciousMiddleCompactCoverageGap(
    block: TTSCompactSpeakerAnalysisBlock,
    segments: readonly TTSCompactSpeakerAnalysisSegment[],
): boolean {
    const sorted = [...segments].sort((a, b) => a.s - b.s || a.e - b.e)
    let cursor = 0
    let previousSpeaker = NARRATOR_SPEAKER_ID
    for (const segment of sorted) {
        if (segment.s > cursor) {
            const gapText = block.x.slice(cursor, segment.s)
            const touchesSpeech = previousSpeaker !== NARRATOR_SPEAKER_ID || getPrimaryCompactSpeakerId(segment) !== NARRATOR_SPEAKER_ID
            if (gapText.length <= 8 && touchesSpeech && hasSpeakableText(gapText)) return true
        }
        cursor = Math.max(cursor, segment.e)
        if (!isMutedCompactSegment(segment)) previousSpeaker = getPrimaryCompactSpeakerId(segment)
    }
    return false
}

function isCompleteQuotedTinySpeech(text: string, segment: TTSCompactSpeakerAnalysisSegment): boolean {
    const before = text[segment.s - 1] ?? ''
    const after = text[segment.e] ?? ''
    return isOpenQuote(before) && isCloseQuote(after)
}

function isOpenQuote(value: string): boolean {
    return value === '“' || value === '「' || value === '『' || value === '"'
}

function isCloseQuote(value: string): boolean {
    return value === '”' || value === '」' || value === '』' || value === '"'
}

function getNextCompactSpeakerId(
    request: TTSCompactSpeakerAnalysisRequest,
    analysis: TTSCompactSpeakerAnalysis,
): number {
    const maxSpeakerId = Math.max(
        NARRATOR_SPEAKER_ID,
        request.nextSpeakerId - 1,
        ...request.knownSpeakers.map(speaker => speaker.i),
        ...(analysis.speakers ?? []).map(speaker => speaker.i),
        ...analysis.segments.map(segment => segment.i),
        ...analysis.segments.flatMap(segment => segment.is ?? []),
    )
    return Math.max(request.nextSpeakerId, maxSpeakerId + 1)
}

function mergeCompactSpeakerInfos(
    first: readonly TTSCompactSpeakerInfo[],
    second: readonly TTSCompactSpeakerInfo[],
): TTSCompactSpeakerInfo[] {
    const byId = new Map<number, TTSCompactSpeakerInfo>()
    for (const speaker of first) byId.set(speaker.i, speaker)
    for (const speaker of second) byId.set(speaker.i, mergeCompactSpeakerInfo(byId.get(speaker.i), speaker))
    return [...byId.values()]
}

function mergeCompactSpeakerInfo(
    existing: TTSCompactSpeakerInfo | undefined,
    next: TTSCompactSpeakerInfo,
): TTSCompactSpeakerInfo {
    return {
        ...existing,
        ...next,
        v: next.v ?? existing?.v,
        t: next.t ?? existing?.t,
        d: next.d ?? existing?.d,
        a: next.a ?? existing?.a,
        o: next.o ?? existing?.o,
        p: next.p ?? existing?.p,
        q: next.q ?? existing?.q,
        h: next.h ?? existing?.h,
    }
}

function normalizeCompactAnalysisSegments(
    readableByCompactBlockId: ReadonlyMap<number, ReadableBlock>,
    analysis: TTSCompactSpeakerAnalysis,
    options: ResolvedTTSSectionOptions,
): TTSSpeechPart[] {
    const parts: TTSSpeechPart[] = []
    const speakerVoiceState = options.speakerVoiceState
    const speakersById = new Map<number, TTSCompactSpeakerInfo>()
    for (const speaker of analysis.speakers ?? []) {
        const id = normalizeSpeakerId(speaker.i)
        if (id == null) continue
        speakersById.set(id, speaker)
    }
    for (const segment of analysis.segments ?? []) {
        const readableBlock = readableByCompactBlockId.get(segment.b)
        if (!readableBlock) continue
        const start = Math.max(0, Math.min(segment.s, readableBlock.readable.text.length))
        const end = Math.max(start, Math.min(segment.e, readableBlock.readable.text.length))
        const text = readableBlock.readable.text.slice(start, end)
        if (!text.trim()) continue
        if (segment.k === 's') {
            parts.push(createSoundEffectPart(
                readableBlock.block,
                readableBlock.readable,
                start,
                end,
                options.soundEffectProvider ?? 'elevenlabs',
                segment.fx,
                segment.dur,
                expandCompactMixLayer(segment.l),
                segment.pan,
            ))
            continue
        }
        if (isLikelySoundEffectText(text)) continue
        if (segment.k === 'm' && shouldHonorMutedSpeechCue(text, segment.p)) {
            parts.push(createMutedSpeechCuePart(readableBlock.block, readableBlock.readable, start, end, segment.p))
            continue
        }
        const speakerId = normalizeSpeakerId(segment.i)
        const speakerIds = normalizeSimultaneousSpeakerIds(segment.is, speakerId)
        if (speakerIds?.length) {
            const group = buildSimultaneousSpeakerGroup(speakerIds, speakersById, speakerVoiceState)
            parts.push({
                block: readableBlock.block,
                readable: readableBlock.readable,
                text,
                start,
                end,
                speakerId: undefined,
                speakerIds,
                speaker: group.speaker,
                role: 'character',
                gender: group.gender,
                tier: group.tier,
                confidence: segment.c,
                speakerHint: group.speakerHint,
                voicePrompt: group.voicePrompt,
                stylePrompt: segment.p,
                audioTag: segment.p,
                pan: segment.pan,
            })
            continue
        }
        const speakerInfo = speakerId == null ? undefined : speakersById.get(speakerId)
        const knownProfile = speakerId == null ? undefined : speakerVoiceState.assignments.get(`speaker:${speakerId}`)
        const role = speakerId === NARRATOR_SPEAKER_ID
            ? 'narrator'
            : normalizeSpeakerRole(expandCompactSpeakerRole(speakerInfo?.r) ?? knownProfile?.role)
        const gender = speakerId === NARRATOR_SPEAKER_ID
            ? 'unknown'
            : normalizeSpeakerGender(expandCompactSpeakerGender(speakerInfo?.g) ?? knownProfile?.gender)
        const tier = speakerId === NARRATOR_SPEAKER_ID
            ? 'S'
            : normalizeSpeakerTier(speakerInfo?.t ?? knownProfile?.tier)
        const speaker = normalizeSpeakerName(
            speakerInfo?.n ?? (speakerId == null ? undefined : speakerVoiceState.speakerNamesById.get(speakerId)),
            role,
            gender,
        )
        parts.push({
            block: readableBlock.block,
            readable: readableBlock.readable,
            text,
            start,
            end,
            speakerId,
            speaker,
            role,
            gender,
            tier,
            voice: speakerInfo?.v ?? knownProfile?.voice,
            confidence: segment.c,
            speakerHint: speakerInfo?.h ?? knownProfile?.speakerHint,
            voicePrompt: normalizeVoicePrompt((speakerInfo && buildCompactSpeakerRoleCard(speakerInfo)) ?? knownProfile?.voicePrompt),
            stylePrompt: combineStylePrompts(knownProfile?.stylePrompt, segment.p),
            audioTag: segment.p,
            pan: segment.pan,
        })
    }
    return absorbSpeechCueParts(repairSpeechPartCoverage(Array.from(readableByCompactBlockId.values()), parts))
}

function repairSpeechPartCoverage(
    readableBlocks: readonly ReadableBlock[],
    parts: readonly TTSSpeechPart[],
): TTSSpeechPart[] {
    const partsByBlockId = new Map<string, TTSSpeechPart[]>()
    for (const part of parts) {
        const list = partsByBlockId.get(part.block.id)
        if (list) list.push(part)
        else partsByBlockId.set(part.block.id, [part])
    }

    const repaired: TTSSpeechPart[] = []
    for (const { block, readable } of readableBlocks) {
        const textLength = readable.text.length
        const blockParts = (partsByBlockId.get(block.id) ?? [])
            .map(part => clipSpeechPart(part, textLength))
            .map(part => part && trimSpeechPartEdges(part))
            .filter(part => part && normalizeText(part.text))
            .sort((a, b) => a!.start - b!.start || a!.end - b!.end) as TTSSpeechPart[]
        let cursor = 0

        for (const part of blockParts) {
            if (part.start > cursor) {
                pushNarratorGap(repaired, block, readable, cursor, part.start)
            }
            if (part.end <= cursor) continue
            const start = Math.max(part.start, cursor)
            const nextPart = start === part.start
                ? part
                : { ...part, start, text: readable.text.slice(start, part.end) }
            repaired.push(nextPart)
            cursor = Math.max(cursor, part.end)
        }

        if (cursor < textLength) {
            pushNarratorGap(repaired, block, readable, cursor, textLength)
        }
    }
    return repaired
}

function absorbSpeechCueParts(parts: readonly TTSSpeechPart[]): TTSSpeechPart[] {
    const absorbed: TTSSpeechPart[] = []
    let pendingPrefixTag: string | undefined
    let pendingBlockId: string | undefined
    for (let index = 0; index < parts.length; index += 1) {
        const part = parts[index]
        if (!part.soundEffect && isLikelySoundEffectText(part.text)) continue
        if (pendingPrefixTag && part.block.id !== pendingBlockId) {
            pendingPrefixTag = undefined
            pendingBlockId = undefined
        }
        const previous = absorbed[absorbed.length - 1]
        if (part.muted) {
            const explicitTag = normalizeAudioTag(part.audioTag)
            if (!previous || previous.block.id !== part.block.id || previous.role !== 'character') {
                pendingPrefixTag = explicitTag
                pendingBlockId = part.block.id
                continue
            }
            const next = parts[index + 1]
            if (explicitTag && next && next.block.id === part.block.id && next.role === 'character' && previous.speakerId === next.speakerId && previous.speaker === next.speaker) {
                absorbed[absorbed.length - 1] = {
                    ...previous,
                    end: Math.max(previous.end, part.end),
                    stylePrompt: combineStylePrompts(previous.stylePrompt, explicitTag),
                    suffixAudioTag: combineStylePrompts(previous.suffixAudioTag, explicitTag),
                }
                continue
            }
            if (explicitTag && previous && previous.role === 'character' && previous.block.id === part.block.id) {
                absorbed[absorbed.length - 1] = {
                    ...previous,
                    end: Math.max(previous.end, part.end),
                    stylePrompt: combineStylePrompts(previous.stylePrompt, explicitTag),
                    audioTag: combineStylePrompts(previous.audioTag, explicitTag),
                }
            }
            continue
        }
        if (pendingPrefixTag && part.role === 'character' && part.block.id === pendingBlockId) {
            absorbed.push({
                ...part,
                stylePrompt: combineStylePrompts(pendingPrefixTag, part.stylePrompt),
                audioTag: combineStylePrompts(pendingPrefixTag, part.audioTag),
            })
            pendingPrefixTag = undefined
            pendingBlockId = undefined
            continue
        }
        absorbed.push(part)
    }
    return absorbed
}

function createSoundEffectPart(
    block: TextBlock,
    readable: ReadableBlockText,
    start: number,
    end: number,
    provider: string,
    prompt?: string,
    durationSeconds?: number,
    mixLayer?: TTSMixLayer,
    pan?: number,
): TTSSpeechPart {
    return {
        block,
        readable,
        text: readable.text.slice(start, end),
        start,
        end,
        provider,
        soundEffectPrompt: prompt,
        soundEffectDurationSeconds: durationSeconds,
        speakerId: undefined,
        speaker: 'sound-effect',
        role: 'other',
        gender: 'unknown',
        confidence: 1,
        soundEffect: true,
        mixLayer,
        pan,
    }
}

function buildSimultaneousSpeakerGroup(
    speakerIds: readonly number[],
    speakersById: ReadonlyMap<number, TTSCompactSpeakerInfo>,
    speakerVoiceState: TTSSpeakerVoiceState,
): Pick<TTSSpeechPart, 'speaker' | 'gender' | 'tier' | 'speakerHint' | 'voicePrompt'> {
    const names = speakerIds.map(id => getSpeakerNameForGroup(id, speakersById, speakerVoiceState))
    const genders = speakerIds.map(id => getSpeakerGenderForGroup(id, speakersById, speakerVoiceState))
    const gender = genders.length && genders.every(item => item === genders[0]) ? genders[0]! : 'unknown'
    const tiers = speakerIds.map(id => getSpeakerTierForGroup(id, speakersById, speakerVoiceState))
    const tier = tiers.some(item => item === 'S') ? 'S'
        : tiers.some(item => item === 'A') ? 'A'
            : tiers.some(item => item === 'B') ? 'B'
                : tiers.some(item => item === 'C') ? 'C'
                    : undefined
    const cards = speakerIds
        .map(id => getSpeakerVoicePromptForGroup(id, speakersById, speakerVoiceState))
        .filter((value): value is string => Boolean(value))
    const groupName = names.join('、')
    const voicePrompt = normalizeVoicePrompt([
        `多人同声/齐声对白：${groupName}同时发声。`,
        '整体听感应像多个角色一起喊出或说出同一句话，能量同步，不要表现为单个角色独白。',
        cards.length ? `参与角色声音参考：${cards.join('；')}` : undefined,
    ].filter(Boolean).join(' '))
    return {
        speaker: groupName,
        gender,
        tier,
        speakerHint: `多人同声：${groupName}`,
        voicePrompt,
    }
}

function getSpeakerNameForGroup(
    id: number,
    speakersById: ReadonlyMap<number, TTSCompactSpeakerInfo>,
    speakerVoiceState: TTSSpeakerVoiceState,
): string {
    return speakersById.get(id)?.n?.trim()
        || speakerVoiceState.speakerNamesById.get(id)
        || `speaker-${id}`
}

function getSpeakerGenderForGroup(
    id: number,
    speakersById: ReadonlyMap<number, TTSCompactSpeakerInfo>,
    speakerVoiceState: TTSSpeakerVoiceState,
): TTSSpeakerGender {
    return expandCompactSpeakerGender(speakersById.get(id)?.g)
        ?? speakerVoiceState.assignments.get(`speaker:${id}`)?.gender
        ?? 'unknown'
}

function getSpeakerTierForGroup(
    id: number,
    speakersById: ReadonlyMap<number, TTSCompactSpeakerInfo>,
    speakerVoiceState: TTSSpeakerVoiceState,
): TTSSpeakerTier | undefined {
    return normalizeSpeakerTier(speakersById.get(id)?.t)
        ?? speakerVoiceState.assignments.get(`speaker:${id}`)?.tier
}

function getSpeakerVoicePromptForGroup(
    id: number,
    speakersById: ReadonlyMap<number, TTSCompactSpeakerInfo>,
    speakerVoiceState: TTSSpeakerVoiceState,
): string | undefined {
    const compact = speakersById.get(id)
    return normalizeVoicePrompt(
        (compact && buildCompactSpeakerRoleCard(compact))
        ?? speakerVoiceState.assignments.get(`speaker:${id}`)?.voicePrompt,
    )
}

function shouldHonorMutedSpeechCue(text: string, audioTag: string | undefined): boolean {
    const normalized = normalizeCueText(text)
    if (!normalized || normalized.length > 30) return false
    if (normalizeAudioTag(audioTag)) return true
    return hasSpeechAttributionMarker(normalized)
        || isPauseCueText(normalized)
}

function createMutedSpeechCuePart(
    block: TextBlock,
    readable: ReadableBlockText,
    start: number,
    end: number,
    audioTag: string | undefined,
): TTSSpeechPart {
    return {
        block,
        readable,
        text: readable.text.slice(start, end),
        start,
        end,
        speakerId: NARRATOR_SPEAKER_ID,
        speaker: NARRATOR_SPEAKER,
        role: 'narrator',
        gender: 'unknown',
        tier: 'S',
        confidence: 1,
        audioTag: normalizeAudioTag(audioTag),
        muted: true,
    }
}

function normalizeCueText(text: string): string {
    return normalizeText(text).replace(/^[,，、。.!！?？;；:：—–-…]+|[,，、。.!！?？;；:：—–-…]+$/g, '')
}

function isPauseCueText(text: string): boolean {
    return /顿了顿|沉吟半晌|沉吟片刻|沉默片刻|停顿/.test(text)
}

function hasSpeechAttributionMarker(text: string): boolean {
    return /(?:说道|问道|答道|回答|回道|笑道|叹道|喊道|吼道|叫道|骂道|低声(?:说|道)|轻声(?:说|道)|小声(?:说|道)|冷冷(?:说|道)|淡淡(?:说|道)|平静(?:地)?(?:说|道)|认真(?:地)?(?:说|道|开口)|有些抱歉(?:地)?开口|抱歉(?:地)?开口|开口|插话道|嘀咕道|喃喃道|补充道|解释道|反问道|追问道|打断道|絮絮叨叨说道|半开玩笑(?:地)?说道)[，,。.!！?？;；:：]*$/u.test(text)
}

function isLikelySoundEffectText(text: string): boolean {
    const normalized = normalizeText(text)
    if (!normalized || normalized.length > 16) return false
    const core = normalized.replace(/[\s"'“”‘’「」『』()[\]{}<>《》。，、？！：；,.!?;:\-—–…~～]+/g, '')
    if (!core || core.length > 8) return false
    if (/^(?:滴|嘀|叮|咚|咣|哐|砰|啪|嗒|哒|咔|嚓|轰|隆|嗡|唰|刷|沙|嘶|咻|呼|哗|滋|吱|嘎|扑|噗|咕|咯|咳|咔嚓|啪嗒|叮咚|轰隆)+$/u.test(core)) return true
    return /^(.)\1{1,5}$/u.test(core) && /[滴嘀叮咚砰啪嗒哒咔嚓轰隆嗡唰刷沙嘶咻呼哗滋吱嘎扑噗咕咯]/u.test(core)
}

function clipSpeechPart(part: TTSSpeechPart, textLength: number): TTSSpeechPart | null {
    const start = Math.max(0, Math.min(part.start, textLength))
    const end = Math.max(start, Math.min(part.end, textLength))
    if (end <= start) return null
    if (start === part.start && end === part.end) return part
    return {
        ...part,
        start,
        end,
        text: part.readable.text.slice(start, end),
    }
}

function trimSpeechPartEdges(part: TTSSpeechPart): TTSSpeechPart | null {
    const range = trimSpeechPartBoundaryEdges(part.readable.text, part.start, part.end)
    if (range.end <= range.start) return null
    if (range.start === part.start && range.end === part.end) return part
    return {
        ...part,
        start: range.start,
        end: range.end,
        text: part.readable.text.slice(range.start, range.end),
    }
}

function pushNarratorGap(
    parts: TTSSpeechPart[],
    block: TextBlock,
    readable: ReadableBlockText,
    start: number,
    end: number,
) {
    const range = trimSilentGapEdges(readable.text, start, end)
    const text = readable.text.slice(range.start, range.end)
    if (!hasSpeakableText(text) || isLikelySoundEffectText(text)) return
    parts.push(createNarratorPart(block, readable, range.start, range.end))
}

function expandCompactSpeakerRole(role: TTSCompactSpeakerInfo['r']): TTSSpeakerRole | undefined {
    if (role === 'n') return 'narrator'
    if (role === 'c') return 'character'
    if (role === 'o') return 'other'
    return undefined
}

function normalizeSpeakerId(value: number | undefined): number | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
    return Math.max(0, Math.floor(value))
}

function normalizeSimultaneousSpeakerIds(value: readonly number[] | undefined, primary?: number): number[] | undefined {
    if (!Array.isArray(value)) return undefined
    const ids: number[] = []
    const pushId = (raw: number | undefined) => {
        const id = normalizeSpeakerId(raw)
        if (id == null || id <= NARRATOR_SPEAKER_ID || ids.includes(id)) return
        ids.push(id)
    }
    pushId(primary)
    for (const item of value) pushId(item)
    return ids.length > 1 ? ids : undefined
}

function sameNumberArray(first: readonly number[] | undefined, second: readonly number[] | undefined): boolean {
    if (!first?.length && !second?.length) return true
    if (!first || !second || first.length !== second.length) return false
    return first.every((value, index) => value === second[index])
}

function compactSpeakerRole(role: TTSSpeakerRole | undefined): TTSCompactKnownSpeaker['r'] {
    if (role === 'narrator') return 'n'
    if (role === 'character') return 'c'
    if (role === 'other') return 'o'
    return undefined
}

function expandCompactSpeakerGender(gender: TTSCompactSpeakerInfo['g']): TTSSpeakerGender | undefined {
    if (gender === 1) return 'male'
    if (gender === 2) return 'female'
    if (gender === 0) return 'unknown'
    return undefined
}

function normalizeSpeakerTier(tier: unknown): TTSSpeakerTier | undefined {
    return tier === 'S' || tier === 'A' || tier === 'B' || tier === 'C'
        ? tier
        : undefined
}

function normalizeCompactMixLayerCode(layer: unknown): TTSCompactSpeakerAnalysisSegment['l'] {
    return layer === 'f' || layer === 'm' || layer === 'b'
        ? layer
        : undefined
}

function expandCompactMixLayer(layer: TTSCompactSpeakerAnalysisSegment['l']): TTSMixLayer | undefined {
    if (layer === 'f') return 'foreground'
    if (layer === 'm') return 'midground'
    if (layer === 'b') return 'background'
    return undefined
}

function compactSpeakerGender(gender: TTSSpeakerGender | undefined): TTSCompactKnownSpeaker['g'] {
    if (gender === 'male') return 1
    if (gender === 'female') return 2
    if (gender === 'unknown') return 0
    return undefined
}

function compactVoiceCatalog(voices: readonly TTSVoice[], language: string): TTSCompactVoice[] {
    const maxVoices = 24
    const preferredPrefixes = getPreferredVoiceLocalePrefixes(language)
    const primary = selectVoicesByLocale(voices, preferredPrefixes.primary, maxVoices)
    const secondary = selectVoicesByLocale(voices, preferredPrefixes.secondary, Math.max(0, maxVoices - primary.length))
    const selected = primary.length > 0 ? [...primary, ...secondary] : voices.slice(0, maxVoices)
    return selected
        .filter(voice => voice.id)
        .map(voice => ({
            v: voice.id,
            n: voice.name || undefined,
            l: voice.locale || undefined,
            g: compactVoiceGender(voice.gender),
            p: voice.provider || undefined,
        }))
}

function supportsVoiceDesign(
    provider: string | undefined,
    providers: readonly TTSProviderInfo[],
): boolean {
    if (provider) {
        const providerInfo = providers.find(item => item.id === provider)
        if (providerInfo?.capabilities?.voice_design) return true
    }
    return legacySupportsVoiceDesignProvider(provider)
}

function legacySupportsVoiceDesignProvider(provider: string | undefined): boolean {
    return provider === 'mimo'
}

function getPreferredVoiceLocalePrefixes(language: string): { primary: string[], secondary: string[] } {
    const normalized = language.toLowerCase()
    if (normalized.startsWith('zh')) return { primary: ['zh-'], secondary: ['en-'] }
    if (normalized.startsWith('en')) return { primary: ['en-'], secondary: ['zh-'] }
    return { primary: [normalized.split('-')[0] + '-'], secondary: ['zh-', 'en-'] }
}

function selectVoicesByLocale(voices: readonly TTSVoice[], prefixes: readonly string[], limit: number): TTSVoice[] {
    if (limit <= 0) return []
    const seen = new Set<string>()
    const selected: TTSVoice[] = []
    const matching = voices.filter(voice => {
        const locale = voice.locale?.toLowerCase() ?? inferLangFromVoiceId(voice.id).toLowerCase()
        return prefixes.some(prefix => locale.startsWith(prefix))
    })
    for (const gender of ['Female', 'Male', undefined]) {
        for (const voice of matching) {
            if (selected.length >= limit) return selected
            if (seen.has(voice.id)) continue
            if (gender && !voice.gender?.toLowerCase().startsWith(gender.toLowerCase())) continue
            selected.push(voice)
            seen.add(voice.id)
        }
    }
    return selected
}

function compactVoiceGender(gender: string | undefined): TTSCompactVoice['g'] {
    const normalized = gender?.trim().toLowerCase()
    if (normalized === 'male' || normalized === 'm') return 1
    if (normalized === 'female' || normalized === 'f') return 2
    if (normalized === 'unknown' || normalized === 'neutral') return 0
    return undefined
}

function inferVoiceLanguage(lang: string | undefined, readableBlocks: readonly ReadableBlock[]): string {
    const normalized = normalizeLanguageHint(lang)
    if (normalized) return normalized
    const sample = readableBlocks.map(({ readable }) => readable.text).join('\n').slice(0, 4000)
    let cjk = 0
    let latin = 0
    for (let index = 0; index < sample.length; index++) {
        const code = sample.charCodeAt(index)
        if ((code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf)) cjk += 1
        else if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) latin += 1
    }
    return cjk >= latin ? 'zh-CN' : 'en-US'
}

function normalizeLanguageHint(lang: string | undefined): string | undefined {
    const value = lang?.trim()
    if (!value) return undefined
    if (/^zh\b/i.test(value)) return 'zh-CN'
    if (/^en\b/i.test(value)) return 'en-US'
    return value
}

function inferLangFromVoiceId(voice: string): string {
    const match = /^([a-z]{2}-[A-Z]{2})-/.exec(voice)
    return match?.[1] ?? ''
}

function hasLikelyMixedNarrationDialogue(text: string): boolean {
    const quotedRanges = findQuotedRanges(text)
    if (!quotedRanges.length) return false

    let outsideText = ''
    let hasQuotedSpeech = false
    let cursor = 0
    for (const range of quotedRanges) {
        outsideText += text.slice(cursor, range.start)
        if (hasSpeakableText(text.slice(range.start + 1, range.end))) hasQuotedSpeech = true
        cursor = Math.max(cursor, range.end + 1)
    }
    outsideText += text.slice(cursor)
    return hasQuotedSpeech && hasSpeakableText(outsideText)
}

function findQuotedRanges(text: string): Array<{ start: number, end: number }> {
    const ranges: Array<{ start: number, end: number }> = []
    const quotePairs: Array<readonly [string, string]> = [
        ['“', '”'],
        ['「', '」'],
        ['『', '』'],
        ['"', '"'],
    ]

    for (const [openQuote, closeQuote] of quotePairs) {
        let searchFrom = 0
        while (searchFrom < text.length) {
            const start = text.indexOf(openQuote, searchFrom)
            if (start < 0) break
            const end = text.indexOf(closeQuote, start + 1)
            if (end < 0) break
            ranges.push({ start, end })
            searchFrom = end + 1
        }
    }

    return ranges.sort((a, b) => a.start - b.start || a.end - b.end)
}

function createNarratorPart(block: TextBlock, readable: ReadableBlockText, start: number, end: number): TTSSpeechPart {
    return {
        block,
        readable,
        text: readable.text.slice(start, end),
        start,
        end,
        speakerId: NARRATOR_SPEAKER_ID,
        speaker: NARRATOR_SPEAKER,
        role: 'narrator',
        gender: 'unknown',
        tier: 'S',
        confidence: 1,
    }
}

function normalizeSpeakerRole(role: TTSSpeakerRole | undefined): TTSSpeakerRole {
    if (role === 'narrator' || role === 'character' || role === 'other') return role
    return 'narrator'
}

function normalizeSpeakerGender(gender: TTSSpeakerGender | undefined): TTSSpeakerGender {
    return gender === 'male' || gender === 'female' || gender === 'unknown' ? gender : 'unknown'
}

function normalizeSpeakerName(speaker: string | undefined, role: TTSSpeakerRole, gender: TTSSpeakerGender): string {
    const trimmed = speaker?.trim()
    if (trimmed) return trimmed
    if (role === 'narrator') return NARRATOR_SPEAKER
    if (gender === 'male') return 'male-character'
    if (gender === 'female') return 'female-character'
    return OTHER_SPEAKER
}

function normalizeVoicePrompt(prompt: string | undefined): string | undefined {
    const trimmed = prompt?.replace(/\s+/g, ' ').trim()
    return trimmed || undefined
}

function normalizeSoundEffectPrompt(prompt: string | undefined): string | undefined {
    const trimmed = prompt?.replace(/\s+/g, ' ').trim()
    if (!trimmed) return undefined
    return trimmed.length > 220 ? trimmed.slice(0, 220).trim() : trimmed
}

function normalizeSoundEffectDurationSeconds(value: unknown): number | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined
    return Math.max(0.5, Math.min(30, Number(value.toFixed(2))))
}

function normalizeSpeakerHint(hint: string | undefined): string | undefined {
    const trimmed = hint?.replace(/\s+/g, ' ').trim()
    return trimmed || undefined
}

function buildCompactSpeakerRoleCard(
    speaker: TTSCompactSpeakerInfo,
    knownScenes: readonly TTSCompactSceneInfo[] = [],
): string | undefined {
    const role = expandCompactSpeakerRole(speaker.r)
    if (role === 'narrator') return undefined
    if (!speaker.d && !speaker.a && !speaker.o && !speaker.p && !speaker.q) return undefined
    const speakerScenes = getCompactScenesForSpeaker(speaker, knownScenes)
    const identity = [
        `${speaker.n}，${formatCompactGender(speaker.g)}性`,
        speaker.t && `声音层级：${formatSpeakerTier(speaker.t)}`,
        speaker.a && `年龄感：${speaker.a}`,
        speaker.o && `身份：${speaker.o}`,
        speaker.p && `性格底色：${speaker.p}`,
    ].filter(Boolean).join('；')
    const scene = speaker.h
        ? `场景：小说多人对白配音；${formatCompactSceneContext(speakerScenes)}识别上下文：${speaker.h}`
        : `场景：小说多人对白配音；${formatCompactSceneContext(speakerScenes)}需要和旁白及其他角色形成清晰区分。`
    const voiceDesign = [
        speaker.q && `音色设计：${speaker.q}`,
        ...speakerScenes.map(scene => scene.q && `场景声音约束(${scene.n})：${scene.q}`).filter(Boolean),
        speaker.t && getSpeakerTierVoiceGuidance(speaker.t),
        '如果原文声音信息不足，可基于角色年龄、身份、性格、对白措辞和场景人群画像合理补足音色质感',
        '匿名/路人角色也要保留从对白推断出的年龄感、身份和口吻；同一场景的路人不要设计成彼此近似的通用声音',
        '必须和同篇章其他核心角色保持可听辨差异',
    ].filter(Boolean).join('；')
    const guidance = [
        speaker.g === 1 && '保持男性声线，不要贴近旁白默认音色',
        speaker.g === 2 && '保持女性声线，不要贴近旁白默认音色',
        '语速、停顿、能量和口吻要稳定，后续同一角色必须一致',
    ].filter(Boolean).join('；')
    const card = [
        `角色：${identity}`,
        scene,
        voiceDesign && `音色：${voiceDesign}`,
        `指导：${guidance}`,
        speaker.d && `补充：${speaker.d}`,
    ].filter(Boolean).join('\n')
    return normalizeVoicePrompt(card)
}

function getCompactScenesForSpeaker(
    speaker: TTSCompactSpeakerInfo,
    knownScenes: readonly TTSCompactSceneInfo[],
): TTSCompactSceneInfo[] {
    if (!speaker.s?.length || !knownScenes.length) return []
    const scenesById = new Map(knownScenes.map(scene => [scene.i, scene]))
    return speaker.s.map(id => scenesById.get(id)).filter((scene): scene is TTSCompactSceneInfo => Boolean(scene))
}

function formatCompactSceneContext(scenes: readonly TTSCompactSceneInfo[]): string {
    if (!scenes.length) return ''
    const parts = scenes.map(scene => [
        scene.n,
        scene.loc && `地点=${scene.loc}`,
        scene.a && `氛围=${scene.a}`,
        scene.c && `默认人群=${scene.c}`,
        scene.h && `线索=${scene.h}`,
    ].filter(Boolean).join('，'))
    return `相关场景：${parts.join('；')}；`
}

function formatCompactGender(gender: TTSCompactSpeakerInfo['g']): string {
    if (gender === 1) return '男'
    if (gender === 2) return '女'
    return '未知'
}

function formatSpeakerTier(tier: TTSSpeakerTier): string {
    if (tier === 'S') return 'S级主角/视角人物'
    if (tier === 'A') return 'A级重要配角'
    if (tier === 'B') return 'B级临时关键角色'
    return 'C级路人/短暂角色'
}

function getSpeakerTierVoiceGuidance(tier: TTSSpeakerTier): string {
    if (tier === 'S') return 'S级角色需要稳定、清晰、有可记忆的身份特征，允许更强辨识度'
    if (tier === 'A') return 'A级角色需要独立可辨，但不要压过主角'
    if (tier === 'B') return 'B级角色以剧情信息清晰为先，使用中等辨识度'
    return 'C级路人是功能性声音，保持自然常规、情绪幅度小，不抢主角注意力'
}

function resolveSpeakerVoiceProfile(part: TTSSpeechPart, options: ResolvedTTSSectionOptions): TTSSpeakerVoiceProfile {
    const profile = mergeVoiceProfiles(getDefaultMultiSpeakerVoiceProfile(options.provider), options.voiceProfile)
    const identity = resolveSpeakerIdentity(part, options.speakerVoiceState)
    part.speakerId = identity.id
    part.speaker = identity.speaker
    const stateKey = getSpeakerVoiceKey(part)
    const existing = options.speakerVoiceState.assignments.get(stateKey)
    if (existing && hasConcreteVoiceProfile(existing)) return existing

    const profilePart = {
        role: existing?.role ?? part.role,
        gender: existing?.gender ?? part.gender,
    }
    const explicitPartVoice = part.voice || part.voicePrompt || part.stylePrompt || part.speakerHint
        ? {
            voice: part.voice,
            role: profilePart.role,
            gender: profilePart.gender,
            tier: existing?.tier ?? part.tier,
            speakerHint: part.speakerHint,
            voicePrompt: part.voicePrompt,
            stylePrompt: part.stylePrompt,
        }
        : undefined
    const speakerProfile = profile.speakers?.[part.speaker]
    const candidate = explicitPartVoice
        ?? speakerProfile
        ?? (profilePart.role === 'narrator' ? profile.narrator : undefined)
        ?? (profilePart.role === 'other' ? profile.other : undefined)
        ?? (profilePart.gender === 'male' ? profile.male : undefined)
        ?? (profilePart.gender === 'female' ? profile.female : undefined)
        ?? profile.unknown
    const resolved = {
        ...chooseSpeakerVoiceProfile(candidate, profilePart, options.speakerVoiceState),
        ...existing,
        speakerId: identity.id,
        speaker: identity.speaker,
        tier: existing?.tier ?? part.tier,
    }
    options.speakerVoiceState.assignments.set(stateKey, resolved)
    return resolved
}

function hasConcreteVoiceProfile(profile: TTSSpeakerVoiceProfile): boolean {
    return Boolean(
        profile.voice
        || profile.voicePrompt
        || profile.stylePrompt
        || profile.speed
        || profile.pitch
        || profile.volume
        || profile.emotion,
    )
}

function getDefaultMultiSpeakerVoiceProfile(provider: string | undefined): TTSVoiceProfile {
    return provider === 'mimo' ? MIMO_MULTI_SPEAKER_VOICE_PROFILE : DEFAULT_MULTI_SPEAKER_VOICE_PROFILE
}

function resolveSpeakerIdentity(part: TTSSpeechPart, state: TTSSpeakerVoiceState): { id: number, speaker: string } {
    if (part.role === 'narrator') {
        const speaker = part.speaker === NARRATOR_SPEAKER ? NARRATOR_SPEAKER_LABEL : part.speaker
        state.speakerNamesById.set(NARRATOR_SPEAKER_ID, speaker)
        state.speakerIdsByKey.set(getSpeakerIdentityKey('narrator', speaker), NARRATOR_SPEAKER_ID)
        return { id: NARRATOR_SPEAKER_ID, speaker }
    }

    const normalizedId = normalizeSpeakerId(part.speakerId)
    const existingName = normalizedId == null ? undefined : state.speakerNamesById.get(normalizedId)
    if (normalizedId != null && existingName) {
        state.speakerIdsByKey.set(getSpeakerIdentityKey(part.role, existingName), normalizedId)
        return { id: normalizedId, speaker: existingName }
    }

    const identityKey = getSpeakerIdentityKey(part.role, part.speaker)
    const existingIdByName = state.speakerIdsByKey.get(identityKey)
    if (existingIdByName != null) {
        return { id: existingIdByName, speaker: state.speakerNamesById.get(existingIdByName) ?? part.speaker }
    }

    const id = normalizedId && normalizedId > NARRATOR_SPEAKER_ID
        ? normalizedId
        : state.nextSpeakerId
    const speaker = part.speaker
    state.speakerNamesById.set(id, speaker)
    state.speakerIdsByKey.set(identityKey, id)
    state.nextSpeakerId = Math.max(state.nextSpeakerId, id + 1)
    return { id, speaker }
}

function mergeVoiceProfiles(base: TTSVoiceProfile, override?: TTSVoiceProfile): TTSVoiceProfile {
    return {
        ...base,
        ...override,
        speakers: {
            ...(base.speakers ?? {}),
            ...(override?.speakers ?? {}),
        },
    }
}

function normalizeSpeakerVoiceProfile(
    value: TTSVoiceProfileEntry | undefined,
    part: Pick<TTSSpeechPart, 'role' | 'gender'>,
): TTSSpeakerVoiceProfile {
    if (typeof value === 'string') return { voice: value, role: part.role, gender: part.gender }
    return {
        role: part.role,
        gender: part.gender,
        ...value,
    }
}

function chooseSpeakerVoiceProfile(
    value: TTSVoiceProfileSlot | undefined,
    part: Pick<TTSSpeechPart, 'role' | 'gender'>,
    state: TTSSpeakerVoiceState,
): TTSSpeakerVoiceProfile {
    if (!isVoiceProfileEntryArray(value)) return normalizeSpeakerVoiceProfile(value, part)
    if (value.length === 0) return normalizeSpeakerVoiceProfile(undefined, part)

    const bucket = `${part.role}:${part.gender}`
    const next = state.nextByBucket.get(bucket) ?? 0
    state.nextByBucket.set(bucket, next + 1)
    return normalizeSpeakerVoiceProfile(value[next % value.length], part)
}

function isVoiceProfileEntryArray(value: TTSVoiceProfileSlot | undefined): value is readonly TTSVoiceProfileEntry[] {
    return Array.isArray(value)
}

function getSpeakerVoiceKey(part: Pick<TTSSpeechPart, 'speakerId' | 'speaker' | 'role'>): string {
    if (part.speakerId != null) return `speaker:${part.speakerId}`
    return `${part.role}:${part.speaker.trim().toLowerCase()}`
}

function getSpeakerIdentityKey(role: TTSSpeakerRole, speaker: string): string {
    return `${role}:${speaker.trim().toLowerCase()}`
}

function getSpeakerVoiceState(states: Map<string, TTSSpeakerVoiceState>, key: string): TTSSpeakerVoiceState {
    const existing = states.get(key)
    if (existing) return existing
    const state: TTSSpeakerVoiceState = {
        assignments: new Map(),
        voiceDesigns: new Map(),
        nextByBucket: new Map(),
        speakerIdsByKey: new Map([[getSpeakerIdentityKey('narrator', NARRATOR_SPEAKER_LABEL), NARRATOR_SPEAKER_ID]]),
        speakerNamesById: new Map([[NARRATOR_SPEAKER_ID, NARRATOR_SPEAKER_LABEL]]),
        nextSpeakerId: 1,
    }
    states.set(key, state)
    return state
}

function applyCompactSpeakerInfos(
    speakers: readonly TTSCompactSpeakerInfo[],
    state: TTSSpeakerVoiceState,
    knownScenes: readonly TTSCompactSceneInfo[] = [],
): void {
    for (const speaker of speakers) {
        const id = normalizeSpeakerId(speaker.i)
        const name = speaker.n?.trim()
        if (id == null || id <= NARRATOR_SPEAKER_ID || !name) continue
        const role = expandCompactSpeakerRole(speaker.r) ?? 'character'
        const gender = expandCompactSpeakerGender(speaker.g) ?? 'unknown'
        const tier = normalizeSpeakerTier(speaker.t)
        state.speakerNamesById.set(id, name)
        state.speakerIdsByKey.set(getSpeakerIdentityKey(role, name), id)
        state.nextSpeakerId = Math.max(state.nextSpeakerId, id + 1)
        const voicePrompt = normalizeVoicePrompt(buildCompactSpeakerRoleCard(speaker, knownScenes))
        if (speaker.v || voicePrompt || role || gender) {
            const key = `speaker:${id}`
            const existing = state.assignments.get(key)
            state.assignments.set(key, {
                ...existing,
                speakerId: id,
                speaker: name,
                role,
                gender,
                tier: tier ?? existing?.tier,
                speakerHint: speaker.h ?? existing?.speakerHint,
                voice: speaker.v ?? existing?.voice,
                voicePrompt: voicePrompt ?? existing?.voicePrompt,
            })
        }
    }
}

function startSpeakerVoiceDesigns(
    state: TTSSpeakerVoiceState,
    designer: ResolvedTTSSectionOptions['voiceDesigner'],
): void {
    if (!designer) return
    for (const [key, profile] of state.assignments) {
        if (profile.voice || !profile.voicePrompt || state.voiceDesigns.has(key)) continue
        const promise = designer(profile).then(voice => {
            if (voice) {
                const current = state.assignments.get(key)
                if (current && !current.voice) {
                    state.assignments.set(key, { ...current, voice })
                }
            }
            return voice
        }).catch(error => {
            if (state.voiceDesigns.get(key) === promise) {
                state.voiceDesigns.delete(key)
            }
            throw error
        })
        state.voiceDesigns.set(key, promise)
        void promise.catch(() => {})
    }
}

async function settleSpeakerVoiceDesigns(state: TTSSpeakerVoiceState): Promise<void> {
    if (!state.voiceDesigns.size) return
    await Promise.allSettled([...state.voiceDesigns.values()])
}

function getKnownSpeakerAssignments(state: TTSSpeakerVoiceState): TTSSpeakerVoiceAssignment[] {
    return Array.from(state.speakerNamesById.entries())
        .filter(([id]) => id !== NARRATOR_SPEAKER_ID)
        .map(([id, speaker]) => {
            const profile = state.assignments.get(`speaker:${id}`)
            return {
                id,
                speaker,
                role: profile?.role,
                gender: profile?.gender,
                tier: profile?.tier,
                voice: profile?.voice,
                speakerHint: profile?.speakerHint,
                voicePrompt: profile?.voicePrompt,
                stylePrompt: profile?.stylePrompt,
            }
        })
}

function getCompactKnownSpeakerAssignments(state: TTSSpeakerVoiceState): TTSCompactKnownSpeaker[] {
    return [
        { i: NARRATOR_SPEAKER_ID, n: NARRATOR_SPEAKER_LABEL, r: 'n', g: 0 },
        ...getKnownSpeakerAssignments(state).map(assignment => ({
            i: assignment.id ?? NARRATOR_SPEAKER_ID,
            n: assignment.speaker,
            r: compactSpeakerRole(assignment.role),
            g: compactSpeakerGender(assignment.gender),
            t: assignment.tier,
            h: assignment.speakerHint,
        })),
    ]
}

function normalizeVoiceProfileForCache(profile: TTSVoiceProfile | undefined): unknown {
    if (!profile) return undefined
    return {
        narrator: profile.narrator,
        male: profile.male,
        female: profile.female,
        unknown: profile.unknown,
        other: profile.other,
        speakers: profile.speakers,
    }
}

function isTerminalSynthesisState(state: TTSSynthesisState): boolean {
    return state.status === 'done' || state.status === 'failed' || state.status === 'partial'
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(new Error('TTS prefetch was aborted.'))
            return
        }
        const timer = setTimeout(resolve, ms)
        signal?.addEventListener('abort', () => {
            clearTimeout(timer)
            reject(new Error('TTS prefetch was aborted.'))
        }, { once: true })
    })
}

async function readJson<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(`TTS request failed (${response.status}): ${text || response.statusText}`)
    }
    return response.json() as Promise<T>
}

function trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '')
}
