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
    speakerHint?: string
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
    speakers?: readonly TTSCompactSpeakerInfo[]
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
    h?: string
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

interface TTSCompactSpeakerModelRequest {
    nextSpeakerId?: number
    voices?: readonly TTSCompactVoice[]
    blocks: readonly TTSCompactSpeakerAnalysisBlock[]
    knownSpeakers: readonly TTSCompactKnownSpeaker[]
}

type TTSCompactSpeakerAnalysisMode = 'presetVoice' | 'voiceDesign'
type TTSCompactSpeakerModelRequestKind = 'plan' | 'initial' | 'repair'

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
    speakerHint?: string
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
    const analysisMode: TTSCompactSpeakerAnalysisMode = voiceDesign ? 'voiceDesign' : 'presetVoice'
    const customAnalysisPrompt = options.speakerAnalysis?.prompt
    const system = customAnalysisPrompt ?? buildSpeakerAnalysisSystemPrompt(voiceLanguage, analysisMode)
    const repairSystem = buildSpeakerAnalysisRepairPrompt(voiceLanguage, analysisMode, customAnalysisPrompt)
    const analysisSchema = getSpeakerAnalysisSchema(analysisMode)
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
    const modelRequest = buildCompactSpeakerModelRequest(request, analysisMode, 'initial')
    try {
        const result = await generateText({
            model,
            output: Output.object({
                schema: jsonSchema<TTSCompactSpeakerAnalysis>(analysisSchema),
                description: 'Compact novel TTS speaker analysis result.',
            }),
            timeout: normalizeTimeoutMs(options.speakerAnalysis?.timeoutMs),
            abortSignal: createTimeoutSignal(options.speakerAnalysis?.timeoutMs),
            system,
            prompt: JSON.stringify(modelRequest),
        })
        output = result.output
        await options.speakerAnalysis?.onLog?.({
            phase: 'initial',
            sectionIndex,
            request: modelRequest,
            response: output,
            durationMs: Math.round((nowMs() - startedAt) * 10) / 10,
        })
    } catch (error) {
        await options.speakerAnalysis?.onLog?.({
            phase: 'initial',
            sectionIndex,
            request: modelRequest,
            response: null,
            durationMs: Math.round((nowMs() - startedAt) * 10) / 10,
            error: getErrorMessage(error),
        })
        throw error
    }
    const analysis = await repairCompactAnalysisWithModelIfNeeded(
        model,
        request,
        normalizeCompactSpeakerAnalysisOutput(output),
        analysisSchema,
        repairSystem,
        options.speakerAnalysis,
    )
    return normalizeCompactAnalysisSegments(
        readableByCompactBlockId,
        splitCompactQuoteNarrationSegments(request, analysis),
        options.speakerVoiceState,
    )
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
    description: '预设音色文本解析结果；返回朗读片段，并仅在需要新增或修正说话人时返回 speakers。',
    properties: {
        segments: {
            type: 'array',
            description: 'TTS 朗读片段。覆盖所有非静默可读文本；偏移基于对应 block.x 的 UTF-16 下标。',
            items: {
                type: 'object',
                properties: {
                    b: { type: 'number', description: 'block index，对应输入 blocks[].b。' },
                    s: { type: 'number', description: 'startOffset，UTF-16 起始下标，包含。' },
                    e: { type: 'number', description: 'endOffset，UTF-16 结束下标，不包含。' },
                    i: { type: 'number', description: 'speaker id；旁白使用 0。' },
                    c: { type: 'number', description: 'confidence；仅当置信度 <= 0.8 或分配不确定时输出。' },
                },
                required: ['b', 's', 'e', 'i'],
                additionalProperties: false,
            },
        },
        speakers: {
            type: 'array',
            description: '新增或必须纠正的说话人；不要重复返回已知说话人。',
            items: {
                type: 'object',
                properties: {
                    i: { type: 'number', description: 'speaker id；新增说话人从 nextSpeakerId 开始递增。' },
                    n: { type: 'string', description: '稳定角色名。' },
                    r: { type: 'string', enum: ['n', 'c', 'o'], description: 'role code：n=旁白，c=角色对白，o=其他/无法归属声音。' },
                    g: { type: 'number', enum: [0, 1, 2], description: 'gender code：0=未知，1=男，2=女。' },
                    v: { type: 'string', description: 'voice id；从输入 voices 中选择。' },
                    h: { type: 'string', maxLength: 260, description: '说话人识别线索/上下文，用于后续保持身份一致。' },
                },
                required: ['i', 'n', 'r', 'g'],
                additionalProperties: false,
            },
        },
    },
    required: ['speakers', 'segments'],
    additionalProperties: false,
} as const

const voiceDesignSpeakerAnalysisSchema = {
    type: 'object',
    description: '角色设计后的文本解析结果；只返回朗读片段，speaker id 必须来自 knownSpeakers。',
    properties: {
        segments: {
            type: 'array',
            description: 'TTS 朗读片段。覆盖所有非静默可读文本；偏移基于对应 block.x 的 UTF-16 下标。',
            items: {
                type: 'object',
                properties: {
                    b: { type: 'number', description: 'block index，对应输入 blocks[].b。' },
                    s: { type: 'number', description: 'startOffset，UTF-16 起始下标，包含。' },
                    e: { type: 'number', description: 'endOffset，UTF-16 结束下标，不包含。' },
                    i: { type: 'number', description: 'speaker id；必须来自 knownSpeakers，旁白使用 0。' },
                    c: { type: 'number', description: 'confidence；仅当置信度 <= 0.8 或分配不确定时输出。' },
                },
                required: ['b', 's', 'e', 'i'],
                additionalProperties: false,
            },
        },
    },
    required: ['segments'],
    additionalProperties: false,
} as const

const speakerPlanItemSchema = {
    type: 'object',
    description: '规划出的重要或反复发声角色；只识别角色，不进行文本分段。',
    properties: {
        i: { type: 'number', description: 'speaker id；新增说话人从 nextSpeakerId 开始递增。' },
        n: { type: 'string', description: '稳定角色名。' },
        r: { type: 'string', enum: ['c', 'o'], description: 'role code：c=角色对白，o=其他/无法归属声音。' },
        g: { type: 'number', enum: [0, 1, 2], description: 'gender code：0=未知，1=男，2=女。' },
        a: { type: 'string', maxLength: 80, description: '年龄或年龄感。' },
        o: { type: 'string', maxLength: 120, description: '职业、身份或社会角色。' },
        p: { type: 'string', maxLength: 160, description: '性格、气质和行为特征。' },
        q: { type: 'string', maxLength: 160, description: '声音与表演风格，用于生成角色卡。' },
        h: { type: 'string', maxLength: 260, description: '说话人识别线索/上下文，不是声音风格。' },
    },
    required: ['i', 'n', 'r', 'g'],
    additionalProperties: false,
} as const

function getSpeakerAnalysisSchema(mode: TTSCompactSpeakerAnalysisMode) {
    return mode === 'voiceDesign' ? voiceDesignSpeakerAnalysisSchema : speakerAnalysisSchema
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

function buildSpeakerAnalysisSystemPrompt(lang: string | undefined, mode: TTSCompactSpeakerAnalysisMode): string {
    const modeSections = mode === 'presetVoice'
        ? [
            promptSection('当前分支', [
                '预设音色文本解析：模型负责分段、识别新说话人，并在有 voices 时为新说话人选择 v。',
                '新增重要或反复出现的说话人时，从 nextSpeakerId 开始分配正整数 id，并按首次出现顺序递增。',
                '如果提供 voices，为新增说话人按角色、性别、语言地区和人物气质选择 v。',
                '对白中的新说话人名称要使用从上下文能稳定推断出的角色名。',
            ]),
        ]
        : [
            promptSection('当前分支', [
                '当前是角色设计后的文本分段阶段。',
                '模型只负责把文本切成说话人片段；角色规划已完成。',
            ]),
        ]
    return joinPromptSections([
        promptSection('角色', [
            '你是多角色小说 TTS 的说话人分析引擎。',
            languagePromptLine(lang),
        ]),
        ...modeSections,
        promptSection('输入格式', [
            'blocks 使用紧凑字段；m=1 表示可能同时包含旁白和对白。',
            'knownSpeakers.h 是说话人识别线索/上下文。',
        ]),
        promptSection('分段目标', [
            '把每个 block 拆成有序、连续、无重叠的 TTS 朗读片段。',
            '覆盖每个 block 中所有非静默可读文本，不遗漏开头、中间或末尾文本。',
            '有引号对白优先使用引号内实际朗读内容的偏移；可以跳过引号和纯空白。',
        ]),
        speakerAttributionPromptSection(),
        promptSection('禁止项', [
            '不要把无引号旁白归给角色；除非确实是叙述性引用，否则不要把有引号对白归给旁白。',
            '不要把混合旁白/对白的段落整段归给一个说话人。',
            '不要把姓名、发言归属短语、句首或句尾几个字从自然的旁白/对白范围中切开。',
        ]),
    ])
}

function buildSpeakerPlanningSystemPrompt(lang?: string): string {
    return joinPromptSections([
        promptSection('角色', [
            '你是多角色小说 TTS 的角色规划和语音规划引擎。',
            languagePromptLine(lang),
        ]),
        promptSection('当前分支', [
            '角色规划阶段：只识别重要或反复发声角色，不进行文本分段。',
            '后续文本解析会使用你输出的 h 来保持说话人一致性。',
            '如果 blocks 中存在对白或发言动作，必须输出本批文本里的核心发声角色；只有确实没有角色对白时才允许返回空列表。',
        ]),
        promptSection('输入格式', [
            'blocks 是待规划文本；knownSpeakers 是已知角色。',
            'knownSpeakers.h 是已有的说话人识别线索/上下文。',
        ]),
        promptSection('输出原则', [
            '新增说话人从 nextSpeakerId 开始分配正整数 id，并按首次出现顺序递增。',
            '已在 knownSpeakers 中出现的说话人必须精确复用 i；除非需要纠正，否则不要重复返回。',
            '客户端会用 a/o/p/q 合成角色卡。',
        ]),
        promptSection('规划原则', [
            '优先规划具名角色、反复出现的角色、参与多轮对话的角色，以及影响后续说话人判断的无名角色。',
            '重点提取稳定人物属性，尤其是性别、年龄感、职业或社会身份、性格气质。',
            'q 描述音色、语速节奏、表达方式和表演风格。',
            'h 只用于后续文本分段识别说话人，不是声音风格。',
            'h 要写入别名、称呼、人物关系、常见发言动作、发言归属词、容易误判的直接称呼、场景范围和对话上下文。',
            'h 要提炼可复用规则，不要只复述一句当前原文。例：阿诺=名为阿诺的年轻人；“阿诺，...”多半是在称呼他而非他说话；阿诺开口/说道/叹气/回答时才强指向他是说话人。',
            '规划时特别总结：某角色被别人频繁称呼、某角色经常被代词谈论、某些引语前后有发言动作、某个场景里的核心对话参与者。',
        ]),
        promptSection('禁止项', [
            'a/o/p/q 不要塞入当前句子内容；使用短语，不要写长段落。',
            '未知细节可以保守推断或省略。',
            '除非一次性无名说话人影响对话连续性，否则不要纳入规划。',
            '不要包含旁白 i=0。',
        ]),
    ])
}

function buildSpeakerAnalysisRepairPrompt(
    lang: string | undefined,
    mode: TTSCompactSpeakerAnalysisMode,
    customAnalysisPrompt?: string,
): string {
    const outputLines = mode === 'presetVoice'
        ? [
            'speakers 只返回纠错必需的新增或修正说话人；没有则返回空数组。',
        ]
        : [
            '沿用 knownSpeakers 中的说话人。',
        ]
    return joinPromptSections([
        promptSection('角色', [
            '你是多角色小说 TTS 的纠错分段引擎。',
            languagePromptLine(lang),
        ]),
        promptSection('当前分支', [
            '纠错文本解析阶段：代码已经筛出需要重判的异常 blocks。',
            '不要判断是否需要纠错；直接为传入 blocks 重新输出正确 segments。',
        ]),
        promptSection('输入格式', [
            'blocks 是需要重判的异常文本；m=1 表示可能同时包含旁白和对白。',
            'knownSpeakers.h 是说话人识别线索/上下文。',
            'k 存在时优先用 k 计算精确 UTF-16 偏移。',
        ]),
        promptSection('输出原则', [
            ...outputLines,
            '只返回传入 blocks 的 corrected segments。',
        ]),
        promptSection('纠错重点', [
            '把旁白、动作、发言归属短语和引号内对白拆成相邻范围。',
            '引号后的发言归属短语（如 asked/said/replied 或 问道/说道/回答/叹道/开口）通常标识引号内对白的说话人；该归属短语本身仍然是旁白。',
            '如果一个片段同时跨过引号内对白和引号外叙述/归属文本，必须拆开重判，不要把“对白 + 某人说道/动作”放进同一个说话人片段。',
            '修正示例：“小明，你在看什么？”小红问道。=> 引号内对白说话人是小红；“小红问道”是旁白。',
            '修正示例：“他不是盲人。”阿诺说道，“他一定看得见。” => 两段引号都是阿诺；“阿诺说道，”是旁白。',
        ]),
        speakerAttributionPromptSection(),
        promptSection('覆盖与偏移', [
            '覆盖每个传入 block 的所有非静默可读文本，不遗漏开头、中间或末尾文本。',
            '不要产生过碎的语义片段；不要把姓名、发言归属短语、句首或句尾几个字从自然的旁白/对白范围中切开。',
        ]),
        customAnalysisPrompt ? promptSection('调用方补充约束', [customAnalysisPrompt]) : '',
        promptSection('禁止项', [
            '不要返回未传入 block 的 segments。',
            '不要把引号外叙述/动作/归属短语归给角色。',
        ]),
    ])
}

function joinPromptSections(sections: readonly string[]): string {
    return sections.filter(Boolean).join('\n\n')
}

function promptSection(title: string, lines: readonly (string | undefined)[]): string {
    return [`## ${title}`, ...lines.filter(Boolean)].join('\n')
}

function languagePromptLine(lang: string | undefined): string | undefined {
    return lang ? `语言提示：${lang}。` : undefined
}

function speakerAttributionPromptSection(): string {
    return promptSection('说话人识别规则', [
        '旁白固定使用 i=0。',
        '识别说话人时，knownSpeakers.h 是重要线索：其中可能包含别名、人物关系、常见发言动作、称呼陷阱、场景范围和对话上下文。',
        '任何引号外可读的旁白、动作或发言归属文本都必须是 i=0，即使其中包含角色名。',
        '引号内位于逗号、顿号、冒号前的人名通常是称呼对象，不是说话人。例如 “小明，你在看什么？”小红问道。对白说话人是小红。',
        '引号之间或引号后的发言归属短语优先级高于引号内提到的人名、代词或话题。',
        '一句话中出现“引语 + 某人说道/问道/回答/叹道/开口 + 引语”时，两个引语通常属于该发言归属中的某人，中间归属短语仍是旁白。',
        '不要把对话内容里被讨论的人名或代词当作说话人证据；优先看引号外的发言动作、上下文轮次和 h 线索。',
        '角色对白片段应尽量推断男/女性别；只有文本确实缺少证据时才使用未知。',
        '无法归属的声音、人群、广播、系统提示或模糊的非旁白声音使用 r=o。',
        '同一角色必须复用 knownSpeakers 的 id 和名称。',
    ])
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
                h: typeof item.h === 'string' ? normalizeSpeakerHint(item.h) : undefined,
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
            v: typeof item.v === 'string' ? item.v : undefined,
            d: typeof item.d === 'string' ? normalizeVoicePrompt(item.d) : undefined,
            a: typeof item.a === 'string' ? normalizeVoicePrompt(item.a) : undefined,
            o: typeof item.o === 'string' ? normalizeVoicePrompt(item.o) : undefined,
            p: typeof item.p === 'string' ? normalizeVoicePrompt(item.p) : undefined,
            q: typeof item.q === 'string' ? normalizeVoicePrompt(item.q) : undefined,
            h: typeof item.h === 'string' ? normalizeSpeakerHint(item.h) : undefined,
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
        if (previous && previous.b === segment.b && previous.i === segment.i && previous.e === segment.s) {
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

function buildCompactSpeakerModelRequest(
    request: TTSCompactSpeakerAnalysisRequest,
    mode: TTSCompactSpeakerAnalysisMode,
    kind: TTSCompactSpeakerModelRequestKind,
): TTSCompactSpeakerModelRequest {
    const canCreateSpeakers = kind === 'plan' || (kind === 'initial' && mode === 'presetVoice')
    return {
        nextSpeakerId: canCreateSpeakers ? request.nextSpeakerId : undefined,
        voices: request.voices?.length ? request.voices : undefined,
        blocks: request.blocks,
        knownSpeakers: request.knownSpeakers.map(compactSpeakerForModel),
    }
}

function compactSpeakerForModel(speaker: TTSCompactKnownSpeaker): TTSCompactKnownSpeaker {
    return {
        i: speaker.i,
        n: speaker.n,
        r: speaker.r,
        g: speaker.g,
        h: speaker.h,
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
            .map(block => ({ ...block, k: buildCompactOffsetGuide(block.x) })),
        knownSpeakers: mergeCompactSpeakerInfos(request.knownSpeakers, analysis.speakers ?? []),
    }
    const startedAt = nowMs()
    let output: TTSCompactSpeakerAnalysis
    const modelRequest = buildCompactSpeakerModelRequest(repairRequest, analysisSchema === voiceDesignSpeakerAnalysisSchema ? 'voiceDesign' : 'presetVoice', 'repair')
    try {
        const result = await generateText({
            model,
            output: Output.object({
                schema: jsonSchema<TTSCompactSpeakerAnalysis>(analysisSchema),
                description: 'Compact corrected novel TTS speaker analysis result.',
            }),
            timeout: normalizeTimeoutMs(analysisOptions?.timeoutMs),
            abortSignal: createTimeoutSignal(analysisOptions?.timeoutMs),
            system: repairSystem,
            prompt: JSON.stringify(modelRequest),
        })
        output = result.output
        await analysisOptions?.onLog?.({
            phase: 'repair',
            sectionIndex: request.sectionIndex,
            request: modelRequest,
            response: output,
            durationMs: Math.round((nowMs() - startedAt) * 10) / 10,
        })
    } catch (error) {
        await analysisOptions?.onLog?.({
            phase: 'repair',
            sectionIndex: request.sectionIndex,
            request: modelRequest,
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
            const speakerId = normalizeSpeakerId(segment.i)
            if (speakerId != null) speakers.add(speakerId)
        }
        if (
            speakers.size <= 1
            || hasInvalidRange
            || hasSuspiciousTinyCompactSegment(block, validSegments)
            || hasSuspiciousQuoteBoundarySegment(block, validSegments)
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

function hasSuspiciousQuoteBoundarySegment(
    block: TTSCompactSpeakerAnalysisBlock,
    segments: readonly TTSCompactSpeakerAnalysisSegment[],
): boolean {
    return segments.some(segment => hasSegmentCrossingReadableQuoteBoundary(block.x, segment))
}

function hasSegmentCrossingReadableQuoteBoundary(
    text: string,
    segment: TTSCompactSpeakerAnalysisSegment,
): boolean {
    for (let index = segment.s; index < segment.e; index++) {
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
        ...(analysis.speakers ?? []).map(speaker => speaker.i),
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
        h: next.h ?? existing?.h,
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
            speakerHint: speakerInfo?.h ?? knownProfile?.speakerHint,
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

function normalizeSpeakerHint(hint: string | undefined): string | undefined {
    const trimmed = hint?.replace(/\s+/g, ' ').trim()
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
    const explicitPartVoice = part.voice || part.voicePrompt || part.stylePrompt || part.speakerHint
        ? {
            voice: part.voice,
            role: profilePart.role,
            gender: profilePart.gender,
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
                speakerHint: speaker.h ?? existing?.speakerHint,
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
