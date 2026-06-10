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
    buildSpeakerAnalysisRepairPrompt,
    buildSpeakerAnalysisSystemPrompt,
    buildSpeakerPlanningSystemPrompt,
    type TTSCompactSpeakerAnalysisMode,
} from './tts/speaker-prompts'
import {
    getSpeakerAnalysisSchema,
    speakerAnalysisSchema,
    speakerPlanItemSchema,
    voiceDesignSpeakerAnalysisSchema,
    type TTSCompactKnownSpeaker,
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

export type TTSSpeakerAnalysisPhase = 'plan' | 'initial' | 'repair'

export type TTSSpeakerAnalyzer = (request: TTSSpeakerAnalysisRequest) => Promise<TTSSpeakerAnalysis> | TTSSpeakerAnalysis

export interface TTSSpeakerAnalysisModels {
    plan?: LanguageModel
    initial?: LanguageModel
    repair?: LanguageModel
}

export interface TTSSpeakerAnalysisOptions {
    model?: LanguageModel
    models?: TTSSpeakerAnalysisModels
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
    failures?: TTSJobFailure[]
}

export interface TTSJobFailure {
    index: number
    segmentId: string
    speaker?: string
    voice?: string
    textPreview: string
    error: string
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
                model: hasSpeakerAnalysisModel(sectionOptions, options) ? 'model' : undefined,
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
                    const failure = latestJob.failures?.find(item => item.segmentId === segmentId)
                    const detail = failure?.error ?? latestJob.error
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

function hasSpeakerAnalysisModel(sectionOptions: TTSSectionOptions, options: TTSOptions): boolean {
    return Boolean(
        sectionOptions.model
        || sectionOptions.speakerAnalysis?.model
        || sectionOptions.speakerAnalysis?.models?.plan
        || sectionOptions.speakerAnalysis?.models?.initial
        || sectionOptions.speakerAnalysis?.models?.repair
        || options.model
        || options.speakerAnalysis?.model
        || options.speakerAnalysis?.models?.plan
        || options.speakerAnalysis?.models?.initial
        || options.speakerAnalysis?.models?.repair,
    )
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
    const initialModel = getSpeakerAnalysisModel(options, 'initial')
    if (!initialModel) {
        throw new Error('TTS multiSpeaker requires a LanguageModel via withTTS({ model }), speakerAnalysis.models.initial, or a custom speakerAnalyzer.')
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
        const planRequest: TTSCompactSpeakerAnalysisRequest = {
            ...request,
            voices: undefined,
        }
        const planModel = getSpeakerAnalysisModel(options, 'plan') ?? initialModel
        const plan = await planCompactSpeakersWithModel(
            planModel,
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
    let rawOutput: unknown
    try {
        const result = await generateText({
            model: initialModel,
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
    const repairModel = getSpeakerAnalysisModel(options, 'repair') ?? initialModel
    const analysis = await repairCompactAnalysisWithModelIfNeeded(
        repairModel,
        request,
        output,
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

function getSpeakerAnalysisModel(
    options: ResolvedTTSSectionOptions,
    phase: TTSSpeakerAnalysisPhase,
): LanguageModel | undefined {
    const phaseModels = options.speakerAnalysis?.models
    if (phase === 'plan') {
        return phaseModels?.plan ?? phaseModels?.initial ?? options.speakerAnalysis?.model ?? options.model
    }
    if (phase === 'repair') {
        return phaseModels?.repair ?? phaseModels?.initial ?? options.speakerAnalysis?.model ?? options.model ?? phaseModels?.plan
    }
    return phaseModels?.initial ?? options.speakerAnalysis?.model ?? options.model ?? phaseModels?.plan
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
    for (const [index, segment] of (output as { assignments: unknown[] }).assignments.entries()) {
        if (!segment || typeof segment !== 'object') {
            throw new Error(`TTS speaker analysis assignment ${index} must be an object.`)
        }
        const item = segment as Partial<TTSCompactSpeakerAttribution>
        if (
            typeof item.b !== 'number'
            || typeof item.a !== 'number'
            || typeof item.i !== 'number'
            || !Number.isFinite(item.b)
            || !Number.isFinite(item.a)
            || !Number.isFinite(item.i)
        ) throw new Error(`TTS speaker analysis assignment ${index} must include numeric b, a, and i.`)
        const block = blockById.get(item.b)
        const atom = block?.u?.find(value => value.a === item.a)
        if (!atom) throw new Error(`TTS speaker analysis assignment ${index} references unknown atom ${item.b}:${item.a}.`)
        const speakerId = atom && block?.m === 1 && atom.q !== 1
            ? NARRATOR_SPEAKER_ID
            : Number(item.i)
        segments.push({
            b: item.b,
            s: atom.s,
            e: atom.e,
            i: speakerId,
            c: typeof item.c === 'number' ? item.c : undefined,
        })
    }
    if (expectedAtoms > 0 && !segments.length) {
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

function buildCompactSpeakerAtoms(text: string): TTSCompactSpeakerAtom[] {
    const intervals = hasAnyQuote(text)
        ? getQuoteIntervals(text)
        : [{ start: 0, end: text.length, quoted: false }]
    const atoms: TTSCompactSpeakerAtom[] = []
    for (const interval of intervals) {
        const range = trimSilentGapEdges(text, interval.start, interval.end)
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
    if (atoms.length) return atoms
    return [{ a: 0, s: 0, e: text.length, x: text }]
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
    }
}

function compactBlockForModel(
    block: TTSCompactSpeakerAnalysisBlock,
    kind: TTSCompactSpeakerModelRequestKind,
): TTSCompactSpeakerAnalysisBlock {
    if (kind !== 'plan') return block
    return {
        b: block.b,
        t: block.t,
        l: block.l,
        x: block.x,
        m: block.m,
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
