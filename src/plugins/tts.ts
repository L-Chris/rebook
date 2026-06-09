import type { Book, RebookPlugin, TextBlock } from '../core/types'

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
}

export interface TTSSynthesizeOptions {
    provider?: string
    voice?: string
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

export interface TTSController {
    listVoices(provider?: string): Promise<TTSVoice[]>
    prepareSection(sectionIndex: number, options?: TTSSectionOptions): Promise<TTSSegment[]>
    synthesizeSegment(segment: TTSSegment, options?: TTSSynthesizeOptions): Promise<TTSSynthesizeResult>
    createSectionJob(sectionIndex: number, options?: TTSSectionOptions & TTSSynthesizeOptions & { concurrency?: number }): Promise<TTSJob>
    createJob(segments: readonly TTSSegment[], options?: TTSSynthesizeOptions & { concurrency?: number }): Promise<TTSJob>
    getJob(jobId: string): Promise<TTSJob>
    getJobSegments(jobId: string): Promise<TTSSynthesizeResult[]>
}

export type TTSBook = Book & {
    readonly tts: TTSController
}

export interface TTSOptions {
    endpoint?: string
    provider?: string
    voice?: string
    rate?: string
    pitch?: string
    volume?: string
    speaker?: string
    maxSegmentChars?: number
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
            })
            const existing = sectionSegmentCache.get(cacheKey)
            if (existing) return existing

            const promise = buildSectionSegments(book, sectionIndex, {
                voice: sectionOptions.voice ?? options.voice,
                speaker: sectionOptions.speaker ?? options.speaker,
                maxSegmentChars: sectionOptions.maxSegmentChars ?? options.maxSegmentChars,
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
                        rate: synthesizeOptions.rate ?? segment.rate ?? options.rate,
                        pitch: synthesizeOptions.pitch ?? segment.pitch ?? options.pitch,
                        volume: synthesizeOptions.volume ?? segment.volume ?? options.volume,
                        segment,
                    }),
                })
                const result = await readJson<TTSSynthesizeResult>(response)
                return { ...result, audioUrl: resolveAudioUrl(endpoint, result.audioUrl) }
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
        }

        return {
            ...book,
            tts: controller,
        }
    }
}

async function buildSectionSegments(book: Book, sectionIndex: number, options: TTSSectionOptions): Promise<TTSSegment[]> {
    const section = book.sections[sectionIndex]
    if (!section?.getBlocks) return []

    const maxSegmentChars = Math.max(20, Math.floor(options.maxSegmentChars ?? 500))
    const speaker = options.speaker ?? 'narrator'
    const blocks = await section.getBlocks()
    const segments: TTSSegment[] = []
    let offset = 0

    for (const block of blocks) {
        const text = getReadableBlockText(block)
        if (!text) continue
        const blockStartOffset = offset
        const parts = splitText(text, maxSegmentChars)
        for (let partIndex = 0; partIndex < parts.length; partIndex++) {
            const part = parts[partIndex]
            segments.push({
                id: `${sectionIndex}:${block.id}:${partIndex}`,
                sectionIndex,
                blockId: block.id,
                startOffset: blockStartOffset + part.start,
                endOffset: blockStartOffset + part.end,
                speaker,
                text: part.text,
                voice: options.voice,
            })
        }
        offset += text.length + 1
    }

    return segments
}

function getReadableBlockText(block: TextBlock): string {
    if (['paragraph', 'heading', 'listItem', 'blockquote', 'pre'].includes(block.type)) {
        return normalizeText(block.segments.map(segment => segment.text).join(''))
    }
    if (block.type === 'table' && block.table) {
        return normalizeText(block.table.rows
            .flatMap(row => row.cells.map(cell => cell.text))
            .join(' '))
    }
    return ''
}

function splitText(text: string, maxChars: number): Array<{ text: string, start: number, end: number }> {
    const parts: Array<{ text: string, start: number, end: number }> = []
    const sentencePattern = /[^。！？.!?；;]+[。！？.!?；;]?/g
    let currentText = ''
    let currentStart = 0
    let currentEnd = 0

    for (const match of text.matchAll(sentencePattern)) {
        const sentence = match[0].trim()
        if (!sentence) continue
        const start = match.index ?? currentEnd
        const end = start + match[0].length
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
