import type { Book, RebookPlugin, TextBlock, TextSegment } from '../core/types'

type FetchLike = typeof fetch

export interface TTSVoice {
    id: string
    name: string
    locale?: string
    gender?: string
    provider: string
}

export interface TTSSegment {
    id: string
    sectionIndex: number
    blockId: string
    startOffset: number
    endOffset: number
    speaker: string
    text: string
    voice?: string
    rate?: string
    pitch?: string
    volume?: string
    emotion?: string
}

export interface TTSSectionOptions {
    voice?: string
    speaker?: string
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

export interface TTSAudioPlaybackOptions {
    signal?: AbortSignal
    pollIntervalMs?: number
    preloadAhead?: number
    onSegmentQueued?: (event: TTSAudioPlaybackEvent) => void
    onSegmentStart?: (event: TTSAudioPlaybackEvent) => void
    onSegmentEnd?: (event: TTSAudioPlaybackEvent) => void
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
    maxSegmentChars?: number
    includeFootnotes?: boolean
    includeAnnotationRefs?: boolean
    player?: TTSAudioPlayer
    fetch?: FetchLike
}

export function withTTS(options: TTSOptions = {}): RebookPlugin {
    const endpoint = trimTrailingSlash(options.endpoint ?? 'http://127.0.0.1:4177')
    const fetchImpl = options.fetch ?? globalThis.fetch?.bind(globalThis)
    if (!fetchImpl) {
        throw new Error('withTTS requires a fetch implementation.')
    }

    return (book: Book): TTSBook => {
        const sectionSegmentCache = new Map<string, Promise<TTSSegment[]>>()

        const prepareSection = (sectionIndex: number, sectionOptions: TTSSectionOptions = {}) => {
            const cacheKey = JSON.stringify({
                sectionIndex,
                voice: sectionOptions.voice ?? options.voice,
                speaker: sectionOptions.speaker ?? options.speaker,
                maxSegmentChars: sectionOptions.maxSegmentChars ?? options.maxSegmentChars,
                includeFootnotes: sectionOptions.includeFootnotes ?? options.includeFootnotes,
                includeAnnotationRefs: sectionOptions.includeAnnotationRefs ?? options.includeAnnotationRefs,
            })
            const existing = sectionSegmentCache.get(cacheKey)
            if (existing) return existing

            const promise = buildSectionSegments(book, sectionIndex, {
                voice: sectionOptions.voice ?? options.voice,
                speaker: sectionOptions.speaker ?? options.speaker,
                maxSegmentChars: sectionOptions.maxSegmentChars ?? options.maxSegmentChars,
                includeFootnotes: sectionOptions.includeFootnotes ?? options.includeFootnotes,
                includeAnnotationRefs: sectionOptions.includeAnnotationRefs ?? options.includeAnnotationRefs,
            })
            sectionSegmentCache.set(cacheKey, promise)
            return promise
        }

        const controller: TTSController = {
            async listVoices(provider = options.provider) {
                const url = new URL(`${endpoint}/v1/tts/voices`)
                if (provider) url.searchParams.set('provider', provider)
                const response = await fetchImpl(url.toString())
                const body = await readJson<{ voices: TTSVoice[] }>(response)
                return body.voices
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
                preloadAhead: playbackOptions.preloadAhead ?? options.preloadAhead ?? 3,
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

    try {
        for (let index = 0; index < Math.min(preloadAhead, segments.length); index++) loadBuffer(index)

        let nextStartTime = context.currentTime + 0.08
        for (let index = 0; index < segments.length; index++) {
            if (options.state.stopped || options.signal.aborted) break
            for (let preloadIndex = index; preloadIndex < Math.min(index + preloadAhead, segments.length); preloadIndex++) {
                loadBuffer(preloadIndex)
            }

            const segment = segments[index]!
            const loaded = await loadBuffer(index)
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
    const buffer = await response.arrayBuffer()
    return decodeAudioData(context, buffer)
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

async function buildSectionSegments(book: Book, sectionIndex: number, options: TTSSectionOptions): Promise<TTSSegment[]> {
    const section = book.sections[sectionIndex]
    if (!section?.getBlocks) return []

    const maxSegmentChars = Math.max(20, Math.floor(options.maxSegmentChars ?? 500))
    const speaker = options.speaker ?? 'narrator'
    const blocks = await section.getBlocks()
    const segments: TTSSegment[] = []

    for (const block of blocks) {
        const readable = getReadableBlockText(block, options)
        if (!readable?.text) continue
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

interface ReadableBlockText {
    text: string
    mapOffset(offset: number, end?: boolean): number
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
