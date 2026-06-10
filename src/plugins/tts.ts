import { generateText, jsonSchema, Output, type LanguageModel } from 'ai'
import type { Book, RebookPlugin, TextBlock, TextSegment } from '../core/types'

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
    return error instanceof Error ? error.message : String(error)
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
    voiceDesign?: boolean
}

export interface TTSProviderInfo {
    id: string
    name: string
    capabilities?: TTSProviderCapabilities
}

export type TTSSpeakerRole = 'narrator' | 'character' | 'other'
export type TTSSpeakerGender = 'male' | 'female' | 'unknown'

export interface TTSSpeakerVoiceProfile {
    speakerId?: number
    voice?: string
    speaker?: string
    role?: TTSSpeakerRole
    gender?: TTSSpeakerGender
    rate?: string
    pitch?: string
    volume?: string
    emotion?: string
    voicePrompt?: string
    stylePrompt?: string
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
    voice?: string
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
    text?: string
    speaker?: string
    role?: TTSSpeakerRole
    gender?: TTSSpeakerGender
    confidence?: number
    voice?: string
    rate?: string
    pitch?: string
    volume?: string
    emotion?: string
    voicePrompt?: string
    stylePrompt?: string
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
    phase: 'plan' | 'initial' | 'repair'
    sectionIndex: number
    request: unknown
    response: unknown
    durationMs: number
    error?: string
}

interface TTSCompactSpeakerAnalysisSegment {
    b: number
    s: number
    e: number
    i: number
    c?: number
}

interface TTSCompactSpeakerAnalysis {
    speakers: readonly TTSCompactSpeakerInfo[]
    segments: readonly TTSCompactSpeakerAnalysisSegment[]
}

interface TTSCompactSpeakerPlan {
    speakers: readonly TTSCompactSpeakerInfo[]
}

interface TTSCompactSpeakerAnalysisBlock {
    b: number
    t: TextBlock['type']
    l: number
    x: string
    m?: 1
    k?: string
}

interface TTSCompactSpeakerInfo {
    i: number
    n: string
    r?: 'n' | 'c' | 'o'
    g?: 0 | 1 | 2
    v?: string
    d?: string
    a?: string
    o?: string
    p?: string
    q?: string
}

interface TTSCompactVoice {
    v: string
    n?: string
    l?: string
    g?: 0 | 1 | 2
    p?: string
}

type TTSCompactKnownSpeaker = TTSCompactSpeakerInfo

interface TTSCompactSpeakerAnalysisRequest {
    sectionIndex: number
    nextSpeakerId: number
    voiceLanguage: string
    voices?: readonly TTSCompactVoice[]
    blocks: readonly TTSCompactSpeakerAnalysisBlock[]
    knownSpeakers: readonly TTSCompactKnownSpeaker[]
    voiceDesign?: 1
}

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
    startOffset: number
    endOffset: number
    speakerId?: number
    speaker: string
    speakerRole?: TTSSpeakerRole
    speakerGender?: TTSSpeakerGender
    speakerConfidence?: number
    text: string
    voice?: string
    rate?: string
    pitch?: string
    volume?: string
    emotion?: string
    voicePrompt?: string
    stylePrompt?: string
}

export interface TTSSectionOptions {
    provider?: string
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
    rate?: string
    pitch?: string
    volume?: string
    voicePrompt?: string
    stylePrompt?: string
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

export type TTSJobStatus = 'queued' | 'running' | 'done' | 'failed' | 'partial'

export interface TTSJob {
    id: string
    status: TTSJobStatus
    provider: string
    total: number
    completed: number
    failed: number
    createdAt: string
    updatedAt: string
    error?: string
    results: TTSSynthesizeResult[]
}

export interface TTSPrefetchedSection {
    readonly segments: TTSSegment[]
    readonly jobId: string
    readonly total: number
    refresh(): Promise<TTSJob>
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
    prefetchSection(sectionIndex: number, options?: TTSSectionOptions & TTSSynthesizeOptions & TTSPrefetchOptions): Promise<TTSPrefetchedSection>
    playPrefetchedSection(prefetch: TTSPrefetchedSection, options?: TTSAudioPlaybackOptions): Promise<void>
    stopPlayback(): void
    createSectionJob(sectionIndex: number, options?: TTSSectionOptions & TTSSynthesizeOptions & { concurrency?: number }): Promise<TTSJob>
    createJob(segments: readonly TTSSegment[], options?: TTSSynthesizeOptions & { concurrency?: number }): Promise<TTSJob>
    getJob(jobId: string): Promise<TTSJob>
    getJobSegments(jobId: string): Promise<TTSSynthesizeResult[]>
    readonly player?: TTSAudioPlayer
}

export type TTSBook = Book & {
    readonly tts: TTSController
}

export interface TTSOptions {
    endpoint?: string
    provider?: string
    voice?: string
    lang?: string
    outputFormat?: string
    rate?: string
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
}

interface TTSSpeakerVoiceState {
    assignments: Map<string, TTSSpeakerVoiceProfile>
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
        let providerCatalogCache: Promise<TTSProviderInfo[]> | undefined

        const getProviderCatalog = (): Promise<TTSProviderInfo[]> => {
            if (providerCatalogCache) return providerCatalogCache
            providerCatalogCache = (async () => {
                try {
                    const response = await fetchImpl(`${endpoint}/v1/tts/providers`)
                    const body = await readJson<{ providers: TTSProviderInfo[] }>(response)
                    return Array.isArray(body.providers) ? body.providers : []
                } catch {
                    return []
                }
            })()
            return providerCatalogCache
        }

        const getVoiceCatalog = (provider = options.provider): Promise<TTSVoice[]> => {
            const key = provider ?? ''
            const cached = voiceCatalogCache.get(key)
            if (cached) return cached
            const promise = (async () => {
                const url = new URL(`${endpoint}/v1/tts/voices`)
                if (provider) url.searchParams.set('provider', provider)
                try {
                    const response = await fetchImpl(url.toString())
                    const body = await readJson<{ voices: TTSVoice[] }>(response)
                    return Array.isArray(body.voices) ? body.voices : []
                } catch {
                    return []
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
                voice: sectionOptions.voice ?? options.voice,
                speaker: sectionOptions.speaker ?? options.speaker,
                multiSpeaker: sectionOptions.multiSpeaker ?? options.multiSpeaker,
                voiceProfileKey,
                speakerAnalyzer: sectionOptions.speakerAnalyzer || options.speakerAnalyzer ? 'custom' : undefined,
                speakerAnalysisPrompt: sectionOptions.speakerAnalysis?.prompt ?? options.speakerAnalysis?.prompt,
                model: sectionOptions.model || sectionOptions.speakerAnalysis?.model || options.model || options.speakerAnalysis?.model ? 'model' : undefined,
                maxSegmentChars: sectionOptions.maxSegmentChars ?? options.maxSegmentChars,
                includeFootnotes: sectionOptions.includeFootnotes ?? options.includeFootnotes,
                includeAnnotationRefs: sectionOptions.includeAnnotationRefs ?? options.includeAnnotationRefs,
            })
            const existing = sectionSegmentCache.get(cacheKey)
            if (existing) return existing

            const promise = buildSectionSegments(book, sectionIndex, {
                provider,
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
                maxSegmentChars: sectionOptions.maxSegmentChars ?? options.maxSegmentChars,
                includeFootnotes: sectionOptions.includeFootnotes ?? options.includeFootnotes,
                includeAnnotationRefs: sectionOptions.includeAnnotationRefs ?? options.includeAnnotationRefs,
            })
            sectionSegmentCache.set(cacheKey, promise)
            return promise
        }

        const controller: TTSController = {
            async listProviders() {
                return getProviderCatalog()
            },
            async listVoices(provider = options.provider) {
                return getVoiceCatalog(provider)
            },
            prepareSection,
            async synthesizeSegment(segment, synthesizeOptions = {}) {
                const response = await fetchImpl(`${endpoint}/v1/tts/synthesize`, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                        provider: synthesizeOptions.provider ?? options.provider,
                        voice: synthesizeOptions.voice ?? segment.voice ?? options.voice,
                        lang: synthesizeOptions.lang ?? options.lang,
                        outputFormat: synthesizeOptions.outputFormat ?? options.outputFormat,
                        rate: synthesizeOptions.rate ?? segment.rate ?? options.rate,
                        pitch: synthesizeOptions.pitch ?? segment.pitch ?? options.pitch,
                        volume: synthesizeOptions.volume ?? segment.volume ?? options.volume,
                        voicePrompt: synthesizeOptions.voicePrompt,
                        stylePrompt: synthesizeOptions.stylePrompt,
                        segment,
                    }),
                })
                const result = await readJson<TTSSynthesizeResult>(response)
                return { ...result, audioUrl: resolveAudioUrl(endpoint, result.audioUrl) }
            },
            async prefetchSection(sectionIndex, prefetchOptions = {}) {
                const segments = await prepareSection(sectionIndex, prefetchOptions)
                const job = await controller.createJob(segments, prefetchOptions)
                return createPrefetchedSection(controller, segments, job, prefetchOptions.pollIntervalMs)
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
            async createSectionJob(sectionIndex, jobOptions = {}) {
                const segments = await prepareSection(sectionIndex, jobOptions)
                return controller.createJob(segments, jobOptions)
            },
            async createJob(segments, jobOptions = {}) {
                const response = await fetchImpl(`${endpoint}/v1/tts/jobs`, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                        provider: jobOptions.provider ?? options.provider,
                        voice: jobOptions.voice ?? options.voice,
                        lang: jobOptions.lang ?? options.lang,
                        outputFormat: jobOptions.outputFormat ?? options.outputFormat,
                        rate: jobOptions.rate ?? options.rate,
                        pitch: jobOptions.pitch ?? options.pitch,
                        volume: jobOptions.volume ?? options.volume,
                        voicePrompt: jobOptions.voicePrompt,
                        stylePrompt: jobOptions.stylePrompt,
                        concurrency: jobOptions.concurrency,
                        segments,
                    }),
                })
                const job = await readJson<TTSJob>(response)
                return {
                    ...job,
                    results: job.results.map(result => ({ ...result, audioUrl: resolveAudioUrl(endpoint, result.audioUrl) })),
                }
            },
            async getJob(jobId) {
                const response = await fetchImpl(`${endpoint}/v1/tts/jobs/${encodeURIComponent(jobId)}`)
                const job = await readJson<TTSJob>(response)
                return {
                    ...job,
                    results: job.results.map(result => ({ ...result, audioUrl: resolveAudioUrl(endpoint, result.audioUrl) })),
                }
            },
            async getJobSegments(jobId) {
                const response = await fetchImpl(`${endpoint}/v1/tts/jobs/${encodeURIComponent(jobId)}/segments`)
                const body = await readJson<{ results: TTSSynthesizeResult[] }>(response)
                return body.results.map(result => ({ ...result, audioUrl: resolveAudioUrl(endpoint, result.audioUrl) }))
            },
            player: options.player,
        }

        return {
            ...book,
            tts: controller,
        }
    }
}

interface BrowserPlaybackState {
    abortController: AbortController
    sources: Set<AudioBufferSourceNode>
    timers: Set<ReturnType<typeof setTimeout>>
    audio?: HTMLAudioElement
    stopped: boolean
}

export function createBrowserTTSAudioPlayer(options: BrowserTTSAudioPlayerOptions = {}): TTSAudioPlayer {
    const fetchImpl = options.fetch ?? globalThis.fetch?.bind(globalThis)
    let audioContext = options.audioContext
    let playback: BrowserPlaybackState | null = null

    const stopPlayback = () => {
        const active = playback
        if (!active) return
        active.stopped = true
        active.abortController.abort()
        for (const timer of active.timers) clearTimeout(timer)
        active.timers.clear()
        for (const source of active.sources) {
            try {
                source.stop()
            } catch {
                // The source may not have started yet, or may already have ended.
            }
        }
        active.sources.clear()
        if (active.audio) {
            active.audio.pause()
            active.audio = undefined
        }
        playback = null
    }

    const getSignal = (state: BrowserPlaybackState, signal?: AbortSignal): AbortSignal => {
        if (signal?.aborted) state.abortController.abort()
        signal?.addEventListener('abort', () => state.abortController.abort(), { once: true })
        return state.abortController.signal
    }

    const ensureAudioContext = async (): Promise<AudioContext | null> => {
        if (audioContext?.state === 'closed') audioContext = undefined
        if (!audioContext) {
            const AudioContextCtor = getAudioContextConstructor()
            if (!AudioContextCtor) return null
            audioContext = new AudioContextCtor()
        }
        await audioContext.resume()
        return audioContext
    }

    return {
        async playPrefetchedSection(prefetch, playbackOptions = {}) {
            stopPlayback()
            const state: BrowserPlaybackState = {
                abortController: new AbortController(),
                sources: new Set(),
                timers: new Set(),
                stopped: false,
            }
            playback = state
            const signal = getSignal(state, playbackOptions.signal)

            const playedWithAudioContext = await playWithAudioContext({
                prefetch,
                state,
                signal,
                getAudioContext: ensureAudioContext,
                fetchImpl,
                preloadAhead: playbackOptions.preloadAhead ?? options.preloadAhead ?? 8,
                playbackOptions,
            })
            if (!playedWithAudioContext) {
                await playWithAudioElement({
                    prefetch,
                    state,
                    signal,
                    playbackOptions,
                })
            }
            if (playback === state) playback = null
        },
        stop: stopPlayback,
        async destroy() {
            stopPlayback()
            if (audioContext && audioContext.state !== 'closed') {
                await audioContext.close()
            }
            audioContext = undefined
        },
    }
}

interface PlayWithAudioContextOptions {
    prefetch: TTSPrefetchedSection
    state: BrowserPlaybackState
    signal: AbortSignal
    getAudioContext(): Promise<AudioContext | null>
    fetchImpl?: FetchLike
    preloadAhead: number
    playbackOptions: TTSAudioPlaybackOptions
}

async function playWithAudioContext(options: PlayWithAudioContextOptions): Promise<boolean> {
    if (!options.fetchImpl) return false
    const context = await options.getAudioContext()
    if (!context) return false

    const segments = options.prefetch.segments
    const preloadAhead = Math.max(1, Math.floor(options.preloadAhead))
    const bufferPromises = new Map<number, Promise<{ result: TTSSynthesizeResult, buffer: AudioBuffer }>>()
    let scheduledCount = 0
    let lastEnded: Promise<void> = Promise.resolve()
    let decodeFailureCount = 0
    let otherFailureCount = 0

    const loadBuffer = (index: number) => {
        if (index >= segments.length) return null
        const existing = bufferPromises.get(index)
        if (existing) return existing
        const segment = segments[index]!
        const promise = options.prefetch.waitForSegment(segment.id, {
            pollIntervalMs: options.playbackOptions.pollIntervalMs,
            signal: options.signal,
        }).then(async result => ({
            result,
            buffer: await decodeAudioUrl(context, options.fetchImpl!, result.audioUrl, options.signal),
        }))
        bufferPromises.set(index, promise)
        return promise
    }
    const preloadBuffer = (index: number) => {
        const promise = loadBuffer(index)
        if (promise) void promise.catch(() => {})
    }
    const reportSegmentError = (segment: TTSSegment, index: number, error: unknown, result?: TTSSynthesizeResult) => {
        if (error instanceof TTSAudioDecodeError) decodeFailureCount += 1
        else otherFailureCount += 1
        options.playbackOptions.onSegmentError?.({ segment, index, total: segments.length, result, error })
    }

    try {
        for (let index = 0; index < Math.min(preloadAhead, segments.length); index++) preloadBuffer(index)

        let nextStartTime = context.currentTime + 0.08
        for (let index = 0; index < segments.length; index++) {
            if (options.state.stopped || options.signal.aborted) break
            for (let preloadIndex = index; preloadIndex < Math.min(index + preloadAhead, segments.length); preloadIndex++) {
                preloadBuffer(preloadIndex)
            }

            const segment = segments[index]!
            let loaded: { result: TTSSynthesizeResult, buffer: AudioBuffer } | null
            try {
                loaded = await loadBuffer(index)
            } catch (error) {
                if (options.signal.aborted || options.state.stopped) throw error
                reportSegmentError(segment, index, error)
                continue
            }
            if (!loaded || options.state.stopped || options.signal.aborted) break

            const startAt = Math.max(nextStartTime, context.currentTime + 0.02)
            const event = { segment, index, total: segments.length, result: loaded.result }
            schedulePlaybackCallback(options.state, context, startAt, () => options.playbackOptions.onSegmentStart?.(event))
            options.playbackOptions.onSegmentQueued?.(event)
            lastEnded = scheduleAudioBuffer(options.state, context, loaded.buffer, startAt)
                .then(() => options.playbackOptions.onSegmentEnd?.(event))
            scheduledCount += 1
            nextStartTime = startAt + loaded.buffer.duration
        }

        await lastEnded
        if (scheduledCount === 0 && decodeFailureCount > 0 && otherFailureCount === 0) return false
        return true
    } catch (error) {
        if (options.signal.aborted || options.state.stopped) throw error
        if (scheduledCount === 0) return false
        throw error
    }
}

async function playWithAudioElement(options: {
    prefetch: TTSPrefetchedSection
    state: BrowserPlaybackState
    signal: AbortSignal
    playbackOptions: TTSAudioPlaybackOptions
}): Promise<void> {
    const AudioCtor = (globalThis as { Audio?: new (url?: string) => HTMLAudioElement }).Audio
    if (!AudioCtor) throw new Error('TTS playback requires AudioContext or HTMLAudioElement support.')

    for (let index = 0; index < options.prefetch.segments.length; index++) {
        if (options.state.stopped || options.signal.aborted) break
        const segment = options.prefetch.segments[index]!
        try {
            const result = await options.prefetch.waitForSegment(segment.id, {
                pollIntervalMs: options.playbackOptions.pollIntervalMs,
                signal: options.signal,
            })
            if (options.state.stopped || options.signal.aborted) break
            const event = { segment, index, total: options.prefetch.segments.length, result }
            options.playbackOptions.onSegmentQueued?.(event)
            options.playbackOptions.onSegmentStart?.(event)
            await playAudioElement(options.state, AudioCtor, result.audioUrl)
            options.playbackOptions.onSegmentEnd?.(event)
        } catch (error) {
            if (options.signal.aborted || options.state.stopped) throw error
            options.playbackOptions.onSegmentError?.({ segment, index, total: options.prefetch.segments.length, error })
        }
    }
}

async function decodeAudioUrl(
    context: AudioContext,
    fetchImpl: FetchLike,
    url: string,
    signal: AbortSignal,
): Promise<AudioBuffer> {
    const response = await fetchImpl(url, { signal, cache: 'force-cache' })
    if (!response.ok) throw new Error(`Audio fetch failed (${response.status})`)
    const contentType = response.headers.get('content-type') ?? undefined
    const buffer = await response.arrayBuffer()
    if (buffer.byteLength === 0) {
        throw new TTSAudioDecodeError(url, buffer.byteLength, contentType, 'Audio response is empty.')
    }
    try {
        return await decodeAudioData(context, buffer)
    } catch (error) {
        throw new TTSAudioDecodeError(url, buffer.byteLength, contentType, 'Unable to decode audio data.', error)
    }
}

class TTSAudioDecodeError extends Error {
    readonly url: string
    readonly byteLength: number
    readonly mimeType?: string

    constructor(url: string, byteLength: number, mimeType: string | undefined, message: string, cause?: unknown) {
        super(message, { cause })
        this.name = 'TTSAudioDecodeError'
        this.url = url
        this.byteLength = byteLength
        this.mimeType = mimeType
    }
}

function decodeAudioData(context: AudioContext, buffer: ArrayBuffer): Promise<AudioBuffer> {
    return new Promise((resolve, reject) => {
        const maybePromise = context.decodeAudioData(buffer.slice(0), resolve, reject)
        if (maybePromise?.then) maybePromise.then(resolve, reject)
    })
}

function schedulePlaybackCallback(
    state: BrowserPlaybackState,
    context: AudioContext,
    startAt: number,
    callback: () => void,
) {
    const delay = Math.max(0, (startAt - context.currentTime) * 1000)
    const timer = setTimeout(() => {
        state.timers.delete(timer)
        if (!state.stopped) callback()
    }, delay)
    state.timers.add(timer)
}

function scheduleAudioBuffer(
    state: BrowserPlaybackState,
    context: AudioContext,
    buffer: AudioBuffer,
    startAt: number,
): Promise<void> {
    return new Promise((resolve, reject) => {
        const source = context.createBufferSource()
        source.buffer = buffer
        source.connect(context.destination)
        state.sources.add(source)
        source.addEventListener('ended', () => {
            state.sources.delete(source)
            resolve()
        }, { once: true })
        try {
            source.start(startAt)
        } catch (error) {
            state.sources.delete(source)
            reject(error)
        }
    })
}

function playAudioElement(
    state: BrowserPlaybackState,
    AudioCtor: new (url?: string) => HTMLAudioElement,
    url: string,
): Promise<void> {
    return new Promise((resolve, reject) => {
        const audio = new AudioCtor(url)
        state.audio = audio
        audio.addEventListener('ended', () => {
            if (state.audio === audio) state.audio = undefined
            resolve()
        }, { once: true })
        audio.addEventListener('error', () => {
            if (state.audio === audio) state.audio = undefined
            reject(new Error('Audio playback failed.'))
        }, { once: true })
        audio.play().catch(reject)
    })
}

type AudioContextConstructor = new () => AudioContext

function getAudioContextConstructor(): AudioContextConstructor | undefined {
    const scope = globalThis as typeof globalThis & {
        AudioContext?: AudioContextConstructor
        webkitAudioContext?: AudioContextConstructor
    }
    return scope.AudioContext ?? scope.webkitAudioContext
}

function createPrefetchedSection(
    controller: Pick<TTSController, 'getJob'>,
    segments: TTSSegment[],
    initialJob: TTSJob,
    defaultPollIntervalMs = 300,
): TTSPrefetchedSection {
    const resultsBySegmentId = new Map<string, TTSSynthesizeResult>()
    let latestJob = initialJob
    let terminal = isTerminalJob(initialJob)

    const mergeResults = (job: TTSJob) => {
        latestJob = job
        terminal = isTerminalJob(job)
        for (const result of job.results) {
            resultsBySegmentId.set(result.segmentId, result)
        }
    }

    mergeResults(initialJob)
    const refreshJob = async () => {
        const job = await controller.getJob(initialJob.id)
        mergeResults(job)
        return job
    }

    return {
        segments,
        jobId: initialJob.id,
        total: segments.length,
        refresh: refreshJob,
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
                    await refreshJob()
                } else {
                    throw new Error(`TTS segment was not generated: ${segmentId}`)
                }
                if (!resultsBySegmentId.has(segmentId) && !terminal) {
                    await delay(pollIntervalMs, waitOptions.signal)
                }
            }
        },
    }
}

async function buildSectionSegments(book: Book, sectionIndex: number, options: ResolvedTTSSectionOptions): Promise<TTSSegment[]> {
    const section = book.sections[sectionIndex]
    if (!section?.getBlocks) return []

    const maxSegmentChars = Math.max(20, Math.floor(options.maxSegmentChars ?? 500))
    const blocks = await section.getBlocks()
    const readableBlocks = getReadableBlocks(blocks, options)
    if (options.multiSpeaker) {
        return buildMultiSpeakerSegments(sectionIndex, readableBlocks, maxSegmentChars, options)
    }

    const speaker = options.speaker ?? 'narrator'
    const segments: TTSSegment[] = []

    for (const { block, readable } of readableBlocks) {
        const parts = splitText(readable.text, maxSegmentChars)
        for (let partIndex = 0; partIndex < parts.length; partIndex++) {
            const part = parts[partIndex]
            segments.push({
                id: `${sectionIndex}:${block.id}:${partIndex}`,
                sectionIndex,
                blockId: block.id,
                startOffset: readable.mapOffset(part.start),
                endOffset: readable.mapOffset(part.end, true),
                speaker,
                text: part.text,
                voice: options.voice,
            })
        }
    }

    return segments
}

interface ReadableBlock {
    block: TextBlock
    readable: ReadableBlockText
}

interface ReadableBlockText {
    text: string
    mapOffset(offset: number, end?: boolean): number
}

interface TTSSpeechPart {
    block: TextBlock
    readable: ReadableBlockText
    text: string
    start: number
    end: number
    speakerId?: number
    speaker: string
    role: TTSSpeakerRole
    gender: TTSSpeakerGender
    confidence?: number
    voice?: string
    rate?: string
    pitch?: string
    volume?: string
    emotion?: string
    voicePrompt?: string
    stylePrompt?: string
}

function getReadableBlocks(blocks: readonly TextBlock[], options: TTSSectionOptions): ReadableBlock[] {
    const readableBlocks: ReadableBlock[] = []
    for (const block of blocks) {
        const readable = getReadableBlockText(block, options)
        if (!readable?.text) continue
        readableBlocks.push({ block, readable })
    }
    return readableBlocks
}

async function buildMultiSpeakerSegments(
    sectionIndex: number,
    readableBlocks: readonly ReadableBlock[],
    maxSegmentChars: number,
    options: ResolvedTTSSectionOptions,
): Promise<TTSSegment[]> {
    const parts = await analyzeSpeakerParts(sectionIndex, readableBlocks, options)
    const segments: TTSSegment[] = []
    const partCounters = new Map<string, number>()

    for (const part of parts) {
        if (!normalizeText(part.text)) continue
        const splitParts = splitText(part.text, maxSegmentChars)
        for (const splitPart of splitParts) {
            const counterKey = `${part.block.id}:${part.start}:${part.end}`
            const partIndex = partCounters.get(counterKey) ?? 0
            partCounters.set(counterKey, partIndex + 1)
            const profile = resolveSpeakerVoiceProfile(part, options)
            segments.push({
                id: `${sectionIndex}:${part.block.id}:${part.start}:${partIndex}`,
                sectionIndex,
                blockId: part.block.id,
                startOffset: part.readable.mapOffset(part.start + splitPart.start),
                endOffset: part.readable.mapOffset(part.start + splitPart.end, true),
                speakerId: profile.speakerId ?? part.speakerId,
                speaker: part.speaker,
                speakerRole: profile.role ?? part.role,
                speakerGender: profile.gender ?? part.gender,
                speakerConfidence: part.confidence,
                text: splitPart.text,
                voice: profile.voice ?? options.voice,
                rate: part.rate ?? profile.rate,
                pitch: part.pitch ?? profile.pitch,
                volume: part.volume ?? profile.volume,
                emotion: part.emotion ?? profile.emotion,
                voicePrompt: profile.voicePrompt ?? part.voicePrompt,
                stylePrompt: part.stylePrompt ?? profile.stylePrompt,
            })
        }
    }

    return mergeAdjacentTTSSegments(segments, maxSegmentChars)
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
            endOffset: segment.endOffset,
            text: joinTTSSegmentText(previous.text, segment.text),
            speakerConfidence: mergeSpeakerConfidence(previous.speakerConfidence, segment.speakerConfidence),
        }
    }
    return merged
}

function canMergeTTSSegments(previous: TTSSegment, next: TTSSegment, maxChars: number): boolean {
    if (previous.sectionIndex !== next.sectionIndex || previous.blockId !== next.blockId) return false
    if (next.startOffset < previous.endOffset || next.startOffset - previous.endOffset > 8) return false
    if (previous.speakerId !== next.speakerId) return false
    if (previous.speaker !== next.speaker) return false
    if (previous.speakerRole !== next.speakerRole) return false
    if (previous.speakerGender !== next.speakerGender) return false
    if (previous.voice !== next.voice) return false
    if (previous.rate !== next.rate || previous.pitch !== next.pitch || previous.volume !== next.volume) return false
    if (previous.emotion !== next.emotion) return false
    if (previous.voicePrompt !== next.voicePrompt || previous.stylePrompt !== next.stylePrompt) return false
    return joinTTSSegmentText(previous.text, next.text).length <= maxChars
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

async function analyzeSpeakerParts(
    sectionIndex: number,
    readableBlocks: readonly ReadableBlock[],
    options: ResolvedTTSSectionOptions,
): Promise<TTSSpeechPart[]> {
    const parts = options.speakerAnalyzer
        ? await analyzeWithSpeakerAnalyzer(sectionIndex, readableBlocks, options.speakerAnalyzer, options.speakerVoiceState)
        : await analyzeWithModelSpeakerAnalyzer(sectionIndex, readableBlocks, options)
    return parts.length > 0 ? parts : readableBlocks.map(({ block, readable }) => createNarratorPart(block, readable, 0, readable.text.length))
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
    const model = options.model ?? options.speakerAnalysis?.model
    if (!model) {
        throw new Error('TTS multiSpeaker requires a LanguageModel via withTTS({ model }) or a custom speakerAnalyzer.')
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
        blocks: readableBlocks.map(({ block, readable }, index) => ({
            b: index,
            t: block.type,
            l: readable.text.length,
            x: readable.text,
            m: hasLikelyMixedNarrationDialogue(readable.text) ? 1 : undefined,
        })),
        knownSpeakers: getCompactKnownSpeakerAssignments(options.speakerVoiceState),
        voiceDesign,
    }
    const system = options.speakerAnalysis?.prompt ?? buildSpeakerAnalysisSystemPrompt(options.lang)
    if (voiceDesign) {
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
        applyCompactSpeakerInfos(plan.speakers, options.speakerVoiceState)
        request = {
            ...request,
            nextSpeakerId: options.speakerVoiceState.nextSpeakerId,
            knownSpeakers: getCompactKnownSpeakerAssignments(options.speakerVoiceState),
        }
    }
    const startedAt = nowMs()
    let output: TTSCompactSpeakerAnalysis
    try {
        const result = await generateText({
            model,
            output: Output.object({
                schema: jsonSchema<TTSCompactSpeakerAnalysis>(speakerAnalysisSchema),
                description: 'Compact novel TTS speaker analysis result.',
            }),
            timeout: normalizeTimeoutMs(options.speakerAnalysis?.timeoutMs),
            abortSignal: createTimeoutSignal(options.speakerAnalysis?.timeoutMs),
            system,
            prompt: JSON.stringify(request),
        })
        output = result.output
        await options.speakerAnalysis?.onLog?.({
            phase: 'initial',
            sectionIndex,
            request,
            response: output,
            durationMs: Math.round((nowMs() - startedAt) * 10) / 10,
        })
    } catch (error) {
        await options.speakerAnalysis?.onLog?.({
            phase: 'initial',
            sectionIndex,
            request,
            response: null,
            durationMs: Math.round((nowMs() - startedAt) * 10) / 10,
            error: getErrorMessage(error),
        })
        throw error
    }
    const analysis = await repairCompactAnalysisWithModelIfNeeded(
        model,
        system,
        request,
        normalizeCompactSpeakerAnalysisOutput(output),
        options.speakerAnalysis,
    )
    return normalizeCompactAnalysisSegments(readableByCompactBlockId, analysis, options.speakerVoiceState)
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
            speaker: normalizeSpeakerName(segment.speaker, role, gender),
            role,
            gender,
            confidence: segment.confidence,
            voice: segment.voice,
            rate: segment.rate,
            pitch: segment.pitch,
            volume: segment.volume,
            emotion: segment.emotion,
            voicePrompt: normalizeVoicePrompt(segment.voicePrompt),
            stylePrompt: normalizeVoicePrompt(segment.stylePrompt),
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

const speakerAnalysisSchema = {
    type: 'object',
    properties: {
        segments: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    b: { type: 'number' },
                    s: { type: 'number' },
                    e: { type: 'number' },
                    i: { type: 'number' },
                    c: { type: 'number' },
                },
                required: ['b', 's', 'e', 'i'],
                additionalProperties: false,
            },
        },
        speakers: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    i: { type: 'number' },
                    n: { type: 'string' },
                    r: { type: 'string', enum: ['n', 'c', 'o'] },
                    g: { type: 'number', enum: [0, 1, 2] },
                    v: { type: 'string' },
                    d: { type: 'string', maxLength: 260 },
                    a: { type: 'string', maxLength: 80 },
                    o: { type: 'string', maxLength: 120 },
                    p: { type: 'string', maxLength: 160 },
                    q: { type: 'string', maxLength: 160 },
                },
                required: ['i', 'n', 'r', 'g'],
                additionalProperties: false,
            },
        },
    },
    required: ['speakers', 'segments'],
    additionalProperties: false,
} as const

const speakerPlanSchema = {
    type: 'object',
    properties: {
        speakers: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    i: { type: 'number' },
                    n: { type: 'string' },
                    r: { type: 'string', enum: ['c', 'o'] },
                    g: { type: 'number', enum: [0, 1, 2] },
                    v: { type: 'string' },
                    d: { type: 'string', maxLength: 260 },
                    a: { type: 'string', maxLength: 80 },
                    o: { type: 'string', maxLength: 120 },
                    p: { type: 'string', maxLength: 160 },
                    q: { type: 'string', maxLength: 160 },
                },
                required: ['i', 'n', 'r', 'g'],
                additionalProperties: false,
            },
        },
    },
    required: ['speakers'],
    additionalProperties: false,
} as const

async function planCompactSpeakersWithModel(
    model: LanguageModel,
    system: string,
    request: TTSCompactSpeakerAnalysisRequest,
    analysisOptions?: TTSSpeakerAnalysisOptions,
): Promise<TTSCompactSpeakerPlan> {
    const startedAt = nowMs()
    let output: TTSCompactSpeakerPlan
    try {
        const result = await generateText({
            model,
            output: Output.object({
                schema: jsonSchema<TTSCompactSpeakerPlan>(speakerPlanSchema),
                description: 'Compact novel TTS speaker and voice plan.',
            }),
            timeout: normalizeTimeoutMs(analysisOptions?.timeoutMs),
            abortSignal: createTimeoutSignal(analysisOptions?.timeoutMs),
            system,
            prompt: JSON.stringify(request),
        })
        output = result.output
        await analysisOptions?.onLog?.({
            phase: 'plan',
            sectionIndex: request.sectionIndex,
            request,
            response: output,
            durationMs: Math.round((nowMs() - startedAt) * 10) / 10,
        })
    } catch (error) {
        await analysisOptions?.onLog?.({
            phase: 'plan',
            sectionIndex: request.sectionIndex,
            request,
            response: null,
            durationMs: Math.round((nowMs() - startedAt) * 10) / 10,
            error: getErrorMessage(error),
        })
        throw error
    }
    return normalizeCompactSpeakerPlanOutput(output)
}

function buildSpeakerAnalysisSystemPrompt(lang?: string): string {
    return [
        'You are a speaker-analysis engine for multi-voice web-novel TTS.',
        lang ? `Language hint: ${lang}.` : '',
        'Input blocks use compact fields: b=block index, t=block type, l=UTF-16 text length, x=block text.',
        'Correction blocks may include k=indexed characters. Use k to calculate exact offsets.',
        'Input block m=1 means the block likely contains both narration and dialogue and must be inspected carefully.',
        'Known speakers use compact fields: i=speaker id, n=speaker name, r=role, g=gender, v=voice id, d=voice design role card/prompt.',
        'Available voices may be omitted. When supplied, they use compact fields: v=voice id, n=voice name, l=locale, g=gender, p=provider.',
        'Split the supplied chapter blocks into consecutive TTS speaker segments.',
        'Return speakers only for new or corrected speaker metadata that is necessary for segmentation: i=speaker id, n=speaker name, r=role, g=gender, v=voice id.',
        'Return segments for speech ranges only: b=block index, s=startOffset, e=endOffset, i=speaker id. Add c=confidence only when confidence is <= 0.8 or the assignment is uncertain; omit c when confidence is > 0.8.',
        'Role codes: r=n narrator, r=c character dialogue, r=o other speech. Gender codes: g=0 unknown, g=1 male, g=2 female.',
        'Use i=0 for narration. Do not include narration in speakers unless correcting metadata.',
        'Reuse knownSpeakers i exactly for an already known speaker. Do not repeat known speaker metadata unless it must be corrected.',
        'For a new important or recurring speaker, assign a positive id starting at nextSpeakerId and increasing in first-appearance order within this response, and add one speakers item for it.',
        'If voices are supplied, choose v from voices for new speakers according to role, gender, locale, and character tone. Known speaker voices are already provided in knownSpeakers.',
        'If input voiceDesign=1, this is the text-segmentation pass after character planning: reuse knownSpeakers ids and role cards, do not choose preset voice ids, and omit v. Only return a/o/p/q/d for a genuinely new speaking character that was not in knownSpeakers.',
        'For dialogue, use the most stable character name you can infer from context in the speakers item for each new speaker.',
        'A name used as a direct address inside dialogue before a comma, such as "Ano, ..." or “阿诺，…”, is usually the addressee, not the speaker. Use nearby attribution clauses to identify the actual speaker.',
        'Example: in “小明，你在看什么？”小红问道。 the dialogue speaker is 小红 and the attribution phrase 小红问道 is narration.',
        'For character segments, infer gender as male or female unless the text genuinely does not provide enough evidence; then use unknown.',
        'Use r=o for unattributed voices, crowds, broadcasts, monsters, systems, or ambiguous non-narrator speech.',
        'Preserve speaker identity across the request. Reuse knownSpeakers ids and names exactly when the same character appears.',
        'Mixed narration/dialogue paragraphs must be split into adjacent segments instead of assigned to one speaker; a block marked m=1 with both quoted and unquoted readable text is invalid if returned as one whole-speaker segment.',
        'For every m=1 block, inspect text outside quote marks. Any readable unquoted narration or attribution text outside quotes must be i=0, even when it contains a character name; do not return multiple same-speaker segments to cover both quote and narration.',
        'Do not assign unquoted narration to a character, and do not assign quoted dialogue to narrator unless it is truly narration.',
        'For quoted dialogue, prefer offsets for the speech content inside quote marks; it is OK to skip quote marks and pure whitespace.',
        'Cover all non-silent text in each block with ordered, non-overlapping segments. Do not leave readable prefix, middle, or trailing text uncovered.',
        'Do not output text content. Use UTF-16 offsets into the corresponding block text. e is exclusive and must satisfy 0 <= s < e <= l.',
        'Return only the requested JSON object.',
    ].filter(Boolean).join('\n')
}

function buildSpeakerPlanningSystemPrompt(lang?: string): string {
    return [
        'You are a character and voice-planning engine for multi-voice web-novel TTS.',
        lang ? `Language hint: ${lang}.` : '',
        'Input blocks use compact fields: b=block index, t=block type, l=UTF-16 text length, x=block text.',
        'Known speakers use compact fields: i=speaker id, n=speaker name, r=role, g=gender, d=voice design role card/prompt.',
        'Do not segment text. Identify important or recurring speaking characters likely to appear in these blocks.',
        'Reuse knownSpeakers i exactly for an already known speaker and do not repeat known metadata unless it needs correction.',
        'For new speakers, assign positive ids starting at nextSpeakerId and increasing in first-appearance order.',
        'Return speakers only: i=speaker id, n=stable character name, r=role, g=gender, a=age, o=occupation/identity, p=personality/temperament, q=voice style, d=optional final voice design role card.',
        'Use r=c for character dialogue and r=o for ambiguous non-narrator voices, crowds, systems, broadcasts, monsters, or unattributed voices.',
        'Gender codes: g=0 unknown, g=1 male, g=2 female.',
        'For voiceDesign=1, extract stable character attributes, especially gender, apparent age, occupation or social identity, and personality. q should describe timbre, speech rhythm, and performance style. Do not choose preset voice ids and omit v. You may omit d; the client can compile a role card from a/o/p/q.',
        'Do not include current sentence content in a/o/p/q/d. Use short phrases, not paragraphs. For unknown details, infer conservatively from context or omit the field.',
        'Avoid one-off unnamed speakers unless they are needed for dialogue continuity. Do not include narrator i=0.',
        'Return only the requested JSON object.',
    ].filter(Boolean).join('\n')
}

function normalizeCompactSpeakerAnalysisOutput(output: unknown): TTSCompactSpeakerAnalysis {
    if (!output || typeof output !== 'object' || !Array.isArray((output as { segments?: unknown }).segments)) {
        return { speakers: [], segments: [] }
    }
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
                v: typeof item.v === 'string' ? item.v : undefined,
                d: typeof item.d === 'string' ? normalizeVoicePrompt(item.d) : undefined,
                a: typeof item.a === 'string' ? normalizeVoicePrompt(item.a) : undefined,
                o: typeof item.o === 'string' ? normalizeVoicePrompt(item.o) : undefined,
                p: typeof item.p === 'string' ? normalizeVoicePrompt(item.p) : undefined,
                q: typeof item.q === 'string' ? normalizeVoicePrompt(item.q) : undefined,
            })
        }
    }
    const segments: TTSCompactSpeakerAnalysisSegment[] = []
    for (const segment of (output as { segments: unknown[] }).segments) {
        if (!segment || typeof segment !== 'object') continue
        const item = segment as Partial<TTSCompactSpeakerAnalysisSegment>
        if (
            typeof item.b !== 'number'
            || typeof item.s !== 'number'
            || typeof item.e !== 'number'
            || typeof item.i !== 'number'
            || !Number.isFinite(item.b)
            || !Number.isFinite(item.s)
            || !Number.isFinite(item.e)
            || !Number.isFinite(item.i)
        ) continue
        segments.push({
            b: item.b,
            s: Number(item.s),
            e: Number(item.e),
            i: Number(item.i),
            c: typeof item.c === 'number' ? item.c : undefined,
        })
    }
    return { speakers, segments }
}

function normalizeCompactSpeakerPlanOutput(output: unknown): TTSCompactSpeakerPlan {
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
            v: typeof item.v === 'string' ? item.v : undefined,
            d: typeof item.d === 'string' ? normalizeVoicePrompt(item.d) : undefined,
            a: typeof item.a === 'string' ? normalizeVoicePrompt(item.a) : undefined,
            o: typeof item.o === 'string' ? normalizeVoicePrompt(item.o) : undefined,
            p: typeof item.p === 'string' ? normalizeVoicePrompt(item.p) : undefined,
            q: typeof item.q === 'string' ? normalizeVoicePrompt(item.q) : undefined,
        })
    }
    return speakers
}

async function repairCompactAnalysisWithModelIfNeeded(
    model: LanguageModel,
    system: string,
    request: TTSCompactSpeakerAnalysisRequest,
    analysis: TTSCompactSpeakerAnalysis,
    analysisOptions?: TTSSpeakerAnalysisOptions,
): Promise<TTSCompactSpeakerAnalysis> {
    const repairBlockIds = findSpeakerAnalysisRepairBlocks(request, analysis)
    if (!repairBlockIds.size) return analysis

    const repairRequest: TTSCompactSpeakerAnalysisRequest = {
        ...request,
        nextSpeakerId: getNextCompactSpeakerId(request, analysis),
        blocks: request.blocks
            .filter(block => repairBlockIds.has(block.b))
            .map(block => ({ ...block, k: buildCompactOffsetGuide(block.x) })),
        knownSpeakers: mergeCompactSpeakerInfos(request.knownSpeakers, analysis.speakers),
    }
    const startedAt = nowMs()
    let output: TTSCompactSpeakerAnalysis
    try {
        const result = await generateText({
            model,
            output: Output.object({
                schema: jsonSchema<TTSCompactSpeakerAnalysis>(speakerAnalysisSchema),
                description: 'Compact corrected novel TTS speaker analysis result.',
            }),
            timeout: normalizeTimeoutMs(analysisOptions?.timeoutMs),
            abortSignal: createTimeoutSignal(analysisOptions?.timeoutMs),
            system: buildSpeakerAnalysisRepairPrompt(system),
            prompt: JSON.stringify(repairRequest),
        })
        output = result.output
        await analysisOptions?.onLog?.({
            phase: 'repair',
            sectionIndex: request.sectionIndex,
            request: repairRequest,
            response: output,
            durationMs: Math.round((nowMs() - startedAt) * 10) / 10,
        })
    } catch (error) {
        await analysisOptions?.onLog?.({
            phase: 'repair',
            sectionIndex: request.sectionIndex,
            request: repairRequest,
            response: null,
            durationMs: Math.round((nowMs() - startedAt) * 10) / 10,
            error: getErrorMessage(error),
        })
        throw error
    }
    const repair = normalizeCompactSpeakerAnalysisOutput(output)
    if (!repair.segments.length) return analysis
    const repairedBlockIds = new Set(repair.segments.map(segment => segment.b))

    return {
        speakers: mergeCompactSpeakerInfos(analysis.speakers, repair.speakers),
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
            const speakerId = normalizeSpeakerId(segment.i)
            if (speakerId != null) speakers.add(speakerId)
        }
        if (
            speakers.size <= 1
            || hasInvalidRange
            || hasSuspiciousTinyCompactSegment(block, validSegments)
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

function hasSuspiciousTinyCompactSegment(
    block: TTSCompactSpeakerAnalysisBlock,
    segments: readonly TTSCompactSpeakerAnalysisSegment[],
): boolean {
    if (block.x.length < 12) return false
    return segments.some(segment => {
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
            const touchesSpeech = previousSpeaker !== NARRATOR_SPEAKER_ID || segment.i !== NARRATOR_SPEAKER_ID
            if (gapText.length <= 8 && touchesSpeech && hasSpeakableText(gapText)) return true
        }
        cursor = Math.max(cursor, segment.e)
        previousSpeaker = segment.i
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

function buildSpeakerAnalysisRepairPrompt(system: string): string {
    return [
        system,
        'Correction pass: every supplied block failed validation because it was mixed narration/dialogue but had a one-speaker, tiny-range, out-of-range, or short middle-gap problem.',
        'Return corrected segments only for the supplied blocks. Split narration and dialogue into adjacent ranges and preserve speaker ids from knownSpeakers whenever possible.',
        'A speech attribution clause after a quote, such as asked/said/replied or 问道/说道/回答, usually identifies the speaker of the quoted dialogue; keep the attribution clause itself as narration.',
        'Example correction: “小明，你在看什么？”小红问道。 => quote content speaker 小红; 小红问道 narration.',
        'Avoid tiny semantic fragments. Do not split names, attribution phrases, or sentence prefixes away from their natural narration/dialogue span.',
    ].join('\n')
}

function buildCompactOffsetGuide(text: string): string | undefined {
    if (text.length > 180) return undefined
    const items: string[] = []
    for (let index = 0; index < text.length; index++) {
        items.push(`${index}:${text[index]}`)
    }
    return items.join(' ')
}

function getNextCompactSpeakerId(
    request: TTSCompactSpeakerAnalysisRequest,
    analysis: TTSCompactSpeakerAnalysis,
): number {
    const maxSpeakerId = Math.max(
        NARRATOR_SPEAKER_ID,
        request.nextSpeakerId - 1,
        ...request.knownSpeakers.map(speaker => speaker.i),
        ...analysis.speakers.map(speaker => speaker.i),
        ...analysis.segments.map(segment => segment.i),
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
        d: next.d ?? existing?.d,
        a: next.a ?? existing?.a,
        o: next.o ?? existing?.o,
        p: next.p ?? existing?.p,
        q: next.q ?? existing?.q,
    }
}

function normalizeCompactAnalysisSegments(
    readableByCompactBlockId: ReadonlyMap<number, ReadableBlock>,
    analysis: TTSCompactSpeakerAnalysis,
    speakerVoiceState: TTSSpeakerVoiceState,
): TTSSpeechPart[] {
    const parts: TTSSpeechPart[] = []
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
        const speakerId = normalizeSpeakerId(segment.i)
        const speakerInfo = speakerId == null ? undefined : speakersById.get(speakerId)
        const knownProfile = speakerId == null ? undefined : speakerVoiceState.assignments.get(`speaker:${speakerId}`)
        const role = speakerId === NARRATOR_SPEAKER_ID
            ? 'narrator'
            : normalizeSpeakerRole(expandCompactSpeakerRole(speakerInfo?.r) ?? knownProfile?.role)
        const gender = speakerId === NARRATOR_SPEAKER_ID
            ? 'unknown'
            : normalizeSpeakerGender(expandCompactSpeakerGender(speakerInfo?.g) ?? knownProfile?.gender)
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
            voice: speakerInfo?.v,
            confidence: segment.c,
            voicePrompt: normalizeVoicePrompt((speakerInfo && buildCompactSpeakerRoleCard(speakerInfo)) ?? knownProfile?.voicePrompt),
            stylePrompt: normalizeVoicePrompt(knownProfile?.stylePrompt),
        })
    }
    return repairSpeechPartCoverage(Array.from(readableByCompactBlockId.values()), parts)
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
    if (!hasSpeakableText(readable.text.slice(range.start, range.end))) return
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
        if (providerInfo?.capabilities?.voiceDesign) return true
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

function buildCompactSpeakerRoleCard(speaker: TTSCompactSpeakerInfo): string | undefined {
    const role = expandCompactSpeakerRole(speaker.r)
    if (role === 'narrator') return undefined
    const lines = [
        `角色：${speaker.n}`,
        `性别：${formatCompactGender(speaker.g)}`,
        speaker.a && `年龄：${speaker.a}`,
        speaker.o && `身份/职业：${speaker.o}`,
        speaker.p && `性格/气质：${speaker.p}`,
        speaker.q && `声线/表演：${speaker.q}`,
    ].filter(Boolean) as string[]
    if (speaker.d) lines.push(`补充：${speaker.d}`)
    if (lines.length <= 2) return normalizeVoicePrompt(speaker.d)
    return normalizeVoicePrompt(lines.join('；'))
}

function formatCompactGender(gender: TTSCompactSpeakerInfo['g']): string {
    if (gender === 1) return '男'
    if (gender === 2) return '女'
    return '未知'
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
    const explicitPartVoice = part.voice || part.voicePrompt || part.stylePrompt
        ? {
            voice: part.voice,
            role: profilePart.role,
            gender: profilePart.gender,
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
    }
    options.speakerVoiceState.assignments.set(stateKey, resolved)
    return resolved
}

function hasConcreteVoiceProfile(profile: TTSSpeakerVoiceProfile): boolean {
    return Boolean(
        profile.voice
        || profile.voicePrompt
        || profile.stylePrompt
        || profile.rate
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
): void {
    for (const speaker of speakers) {
        const id = normalizeSpeakerId(speaker.i)
        const name = speaker.n?.trim()
        if (id == null || id <= NARRATOR_SPEAKER_ID || !name) continue
        const role = expandCompactSpeakerRole(speaker.r) ?? 'character'
        const gender = expandCompactSpeakerGender(speaker.g) ?? 'unknown'
        state.speakerNamesById.set(id, name)
        state.speakerIdsByKey.set(getSpeakerIdentityKey(role, name), id)
        state.nextSpeakerId = Math.max(state.nextSpeakerId, id + 1)
        const voicePrompt = normalizeVoicePrompt(buildCompactSpeakerRoleCard(speaker))
        if (speaker.v || voicePrompt || role || gender) {
            const key = `speaker:${id}`
            const existing = state.assignments.get(key)
            state.assignments.set(key, {
                ...existing,
                speakerId: id,
                speaker: name,
                role,
                gender,
                voice: speaker.v ?? existing?.voice,
                voicePrompt: voicePrompt ?? existing?.voicePrompt,
            })
        }
    }
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
                voice: profile?.voice,
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
            v: assignment.voice,
            d: assignment.voicePrompt,
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

function getReadableBlockText(block: TextBlock, options: TTSSectionOptions): ReadableBlockText | null {
    if (!options.includeFootnotes && isTTSFootnoteBlock(block)) return null

    if (['paragraph', 'heading', 'listItem', 'blockquote', 'pre'].includes(block.type)) {
        return buildReadableInlineText(block.segments, options)
    }
    if (block.type === 'table' && block.table) {
        const text = normalizeText(block.table.rows
            .flatMap(row => row.cells.map(cell => cell.text))
            .join(' '))
        return text ? identityReadableText(text) : null
    }
    return null
}

function buildReadableInlineText(
    segments: readonly TextSegment[],
    options: TTSSectionOptions,
): ReadableBlockText | null {
    let rawText = ''
    let originalOffset = 0
    let offsetMap: number[] = []

    for (const segment of segments) {
        if (!options.includeAnnotationRefs && isTTSNoterefSegment(segment)) {
            originalOffset += segment.text.length
            continue
        }
        for (let index = 0; index < segment.text.length; index++) {
            rawText += segment.text[index]
            offsetMap.push(originalOffset + index)
        }
        originalOffset += segment.text.length
    }

    if (!options.includeAnnotationRefs) {
        const removed = removeInlineAnnotationRefs(rawText, offsetMap)
        rawText = removed.text
        offsetMap = removed.offsetMap
    }

    const readable = normalizeTextWithMap(rawText, offsetMap)
    return readable.text ? readable : null
}

function identityReadableText(text: string): ReadableBlockText {
    return {
        text,
        mapOffset(offset, end = false) {
            if (end) return Math.min(text.length, Math.max(0, offset))
            return Math.min(Math.max(0, offset), Math.max(0, text.length - 1))
        },
    }
}

function normalizeTextWithMap(text: string, offsetMap: readonly number[]): ReadableBlockText {
    let normalized = ''
    const normalizedMap: number[] = []
    let pendingSpaceOffset: number | undefined

    for (let index = 0; index < text.length; index++) {
        const char = text[index]
        const sourceOffset = offsetMap[index] ?? index
        if (/\s/.test(char)) {
            if (normalized.length > 0 && pendingSpaceOffset === undefined) pendingSpaceOffset = sourceOffset
            continue
        }
        if (pendingSpaceOffset !== undefined && normalized.length > 0) {
            normalized += ' '
            normalizedMap.push(pendingSpaceOffset)
        }
        pendingSpaceOffset = undefined
        normalized += char
        normalizedMap.push(sourceOffset)
    }

    return {
        text: normalized,
        mapOffset(offset, end = false) {
            if (!normalizedMap.length) return 0
            const bounded = Math.min(Math.max(0, offset), normalized.length)
            if (end) {
                if (bounded <= 0) return normalizedMap[0]
                return (normalizedMap[bounded - 1] ?? normalizedMap[normalizedMap.length - 1]) + 1
            }
            return normalizedMap[Math.min(bounded, normalizedMap.length - 1)] ?? normalizedMap[0]
        },
    }
}

function removeInlineAnnotationRefs(
    text: string,
    offsetMap: readonly number[],
): { text: string, offsetMap: number[] } {
    const keep = new Array(text.length).fill(true)
    const patterns = [
        /[\s\u00a0]*[\[［]\s*\d{1,4}\s*[\]］]/g,
        /[\s\u00a0]*[¹²³⁴⁵⁶⁷⁸⁹⁰]+/g,
    ]

    for (const pattern of patterns) {
        for (const match of text.matchAll(pattern)) {
            const start = match.index ?? 0
            const end = start + match[0].length
            for (let index = start; index < end; index++) keep[index] = false
        }
    }

    let nextText = ''
    const nextMap: number[] = []
    for (let index = 0; index < text.length; index++) {
        if (!keep[index]) continue
        nextText += text[index]
        nextMap.push(offsetMap[index] ?? index)
    }
    return { text: nextText, offsetMap: nextMap }
}

function isTTSFootnoteBlock(block: TextBlock): boolean {
    if (hasRebookRole(block.attrs, 'footnote')) return true
    const attrs = block.attrs ?? {}
    const tokens = getSourceTokens(attrs)
    if (tokens.some(token => token === 'footnote' || token === 'doc-footnote' || token === 'endnote' || token === 'doc-endnote')) return true
    const text = block.segments.map(segment => segment.text).join('')
    if (!tokens.includes('note')) return false
    const anchor = attrs.id ?? attrs.name
    return (anchor ? isFootnoteAnchorId(anchor) : false) || isFootnoteContentText(text)
}

function isTTSNoterefSegment(segment: TextSegment): boolean {
    const attrs = segment.source?.attrs
    if (hasRebookRole(attrs, 'noteref')) return true
    if (segment.text === '\uFFFC' && attrs?.['data-rebook-footnote-content']) return true
    return getSourceTokens(attrs).some(token =>
        token === 'noteref'
        || token === 'doc-noteref'
        || token === 'footnote-ref'
        || token === 'epub-footnote'
        || token === 'epub-footnote1'
    )
}

function hasRebookRole(attrs: Readonly<Record<string, string>> | undefined, role: string): boolean {
    return attrs?.['data-rebook-role']?.split(/\s+/).includes(role) ?? false
}

function getSourceTokens(attrs: Readonly<Record<string, string>> | undefined): string[] {
    return [
        attrs?.['epub:type'],
        attrs?.type,
        attrs?.role,
        attrs?.rel,
        attrs?.class,
    ]
        .filter(Boolean)
        .flatMap(value => value!.toLowerCase().split(/\s+/))
        .filter(Boolean)
}

function isFootnoteAnchorId(value: string): boolean {
    return /^(?:m|fn|footnote|note|endnote|en)[-_]?\d{1,4}$/i.test(value)
}

function isFootnoteContentText(value: string): boolean {
    return /^[\s\u00a0]*[\[［]\s*\d{1,4}\s*[\]］]/.test(value)
}

function splitText(text: string, maxChars: number): Array<{ text: string, start: number, end: number }> {
    const parts: Array<{ text: string, start: number, end: number }> = []
    const sentencePattern = /[^。！？.!?；;]+[。！？.!?；;]?/g
    let currentText = ''
    let currentStart = 0
    let currentEnd = 0

    for (const match of text.matchAll(sentencePattern)) {
        const raw = match[0]
        const sentence = raw.trim()
        if (!sentence) continue
        const rawStart = match.index ?? currentEnd
        const leading = raw.length - raw.trimStart().length
        const start = rawStart + leading
        const end = start + sentence.length
        if (!currentText) {
            currentText = sentence
            currentStart = start
            currentEnd = end
            continue
        }
        if (currentText.length + sentence.length + 1 > maxChars) {
            parts.push({ text: currentText, start: currentStart, end: currentEnd })
            currentText = sentence
            currentStart = start
            currentEnd = end
        } else {
            currentText = `${currentText} ${sentence}`
            currentEnd = end
        }
    }

    if (currentText) parts.push({ text: currentText, start: currentStart, end: currentEnd })
    if (!parts.length && text.trim()) {
        for (let start = 0; start < text.length; start += maxChars) {
            const chunk = text.slice(start, start + maxChars).trim()
            if (chunk) parts.push({ text: chunk, start, end: start + chunk.length })
        }
    }
    return parts
}

function normalizeText(text: string): string {
    return text.replace(/\s+/g, ' ').trim()
}

function hasSpeakableText(text: string): boolean {
    return normalizeText(text).replace(/[\s"'“”‘’「」『』()[\]{}<>《》。，、？！：；,.!?;:\-—–…]+/g, '').length > 0
}

function trimSilentGapEdges(text: string, start: number, end: number): { start: number, end: number } {
    let nextStart = start
    let nextEnd = end
    while (nextStart < nextEnd && /[\s"'“”‘’「」『』]/.test(text[nextStart] ?? '')) nextStart += 1
    while (nextEnd > nextStart && /[\s"'“”‘’「」『』]/.test(text[nextEnd - 1] ?? '')) nextEnd -= 1
    return { start: nextStart, end: nextEnd }
}

function trimSpeechPartBoundaryEdges(text: string, start: number, end: number): { start: number, end: number } {
    let nextStart = start
    let nextEnd = end
    while (nextStart < nextEnd && isLeadingSpeechBoundary(text[nextStart] ?? '')) nextStart += 1
    while (nextEnd > nextStart && /[\s"'“”‘’「」『』]/.test(text[nextEnd - 1] ?? '')) nextEnd -= 1
    return { start: nextStart, end: nextEnd }
}

function isLeadingSpeechBoundary(value: string): boolean {
    return /[\s"'“”‘’「」『』,，、。.!！?？;；:：—–-…]/.test(value)
}

function isTerminalJob(job: TTSJob): boolean {
    return job.status === 'done' || job.status === 'failed' || job.status === 'partial'
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

function resolveAudioUrl(endpoint: string, audioUrl: string): string {
    if (/^https?:\/\//i.test(audioUrl)) return audioUrl
    return `${endpoint}${audioUrl.startsWith('/') ? '' : '/'}${audioUrl}`
}
