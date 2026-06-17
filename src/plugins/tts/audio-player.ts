import type {
    BrowserTTSAudioPlayerOptions,
    TTSAudioPlaybackOptions,
    TTSAudioPlayer,
    TTSPrefetchedSection,
    TTSSegment,
    TTSSynthesizeResult,
} from '../tts'

type FetchLike = typeof fetch

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
            lastEnded = scheduleAudioBuffer(options.state, context, loaded.buffer, startAt, segment)
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
            await playAudioElement(options.state, AudioCtor, result.audioUrl, segment)
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
    segment: TTSSegment,
): Promise<void> {
    return new Promise((resolve, reject) => {
        const source = context.createBufferSource()
        source.buffer = buffer
        const gain = context.createGain()
        gain.gain.value = getSegmentGain(segment)
        const pan = normalizeSegmentPan(segment.pan)
        source.connect(gain)
        if (pan !== 0 && typeof context.createStereoPanner === 'function') {
            const panner = context.createStereoPanner()
            panner.pan.value = pan
            gain.connect(panner)
            panner.connect(context.destination)
        } else {
            gain.connect(context.destination)
        }
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
    segment: TTSSegment,
): Promise<void> {
    return new Promise((resolve, reject) => {
        const audio = new AudioCtor(url)
        audio.volume = Math.min(1, getSegmentGain(segment))
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

function getSegmentGain(segment: TTSSegment): number {
    const volumeDb = typeof segment.volumeDb === 'number' && Number.isFinite(segment.volumeDb)
        ? Math.max(-60, Math.min(12, segment.volumeDb))
        : 0
    return Math.max(0, Math.min(4, 10 ** (volumeDb / 20)))
}

function normalizeSegmentPan(value: number | undefined): number {
    return typeof value === 'number' && Number.isFinite(value)
        ? Math.max(-1, Math.min(1, value))
        : 0
}

type AudioContextConstructor = new () => AudioContext

function getAudioContextConstructor(): AudioContextConstructor | undefined {
    const scope = globalThis as typeof globalThis & {
        AudioContext?: AudioContextConstructor
        webkitAudioContext?: AudioContextConstructor
    }
    return scope.AudioContext ?? scope.webkitAudioContext
}
