#!/usr/bin/env node
import { createOpenAI } from '@ai-sdk/openai'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import process from 'node:process'
import { NodeDOMAdapter, NodeURLFactory } from '../dist/adapters/node.js'
import { EPUBParser } from '../dist/parsers/epub.js'
import { withTTS } from '../dist/plugins/index.js'
import { analyzeReplay, formatReport } from './tts-replay.mjs'

const DEFAULT_BOOK_PATH = 'data/我在精神病院学斩神.epub'
const DEFAULT_CHAPTER = '第1章 黑缎缠目'
const DEFAULT_ENDPOINT = 'http://127.0.0.1:4177'
const DEFAULT_PROVIDER = 'edge'
const DEFAULT_MODEL = 'gpt-4.1-mini'
const DEFAULT_API_MODE = 'chat'

async function main() {
    const totalStartedAt = Date.now()
    await loadDotEnvFiles()
    const options = parseArgs(process.argv.slice(2))
    if (options.help) {
        printHelp()
        return
    }

    const runDir = resolve(options.outputDir ?? join(
        'data',
        'tts-auto-runs',
        `${safeName(options.chapter)}-${formatTimestamp(new Date())}`,
    ))
    const dirs = {
        root: runDir,
        chapter: join(runDir, 'chapter'),
        llm: join(runDir, 'llm'),
        audio: join(runDir, 'audio'),
    }
    await Promise.all(Object.values(dirs).map(dir => mkdir(dir, { recursive: true })))

    const meta = {
        createdAt: new Date().toISOString(),
        bookPath: options.bookPath,
        chapter: options.chapter,
        endpoint: options.endpoint,
        provider: options.provider,
        model: options.model,
        apiMode: options.apiMode,
        llmTimeoutMs: options.llmTimeoutMs,
        maxSegmentChars: options.maxSegmentChars,
        concurrency: options.concurrency,
        skipAudio: options.skipAudio,
    }
    await writeJson(join(runDir, 'meta.json'), meta)

    const parseStartedAt = Date.now()
    const book = await parseBook(options.bookPath)
    const parseBookMs = Date.now() - parseStartedAt
    const findStartedAt = Date.now()
    const chapter = await findChapter(book, options.chapter)
    const findChapterMs = Date.now() - findStartedAt
    await writeJson(join(dirs.chapter, 'info.json'), {
        sectionIndex: chapter.sectionIndex,
        sectionId: chapter.section.id,
        sectionSize: chapter.section.size,
        title: chapter.title,
    })
    await writeJson(join(dirs.chapter, 'blocks.json'), chapter.blocks.map(block => ({
        id: block.id,
        type: block.type,
        text: blockText(block),
    })))

    const llmEvents = []
    const model = createLanguageModel(options)
    const fetchLog = []
    const loggedFetch = createLoggedFetch(globalThis.fetch.bind(globalThis), fetchLog)
    const wrapped = withTTS({
        endpoint: options.endpoint,
        provider: options.provider,
        lang: 'zh-CN',
        fetch: loggedFetch,
        model,
        speakerAnalysis: {
            timeoutMs: options.llmTimeoutMs,
            onLog: async event => {
                const record = await persistLLMEvent(dirs.llm, llmEvents.length + 1, event)
                llmEvents.push(record)
            },
        },
    })(book)

    const preparedStartedAt = Date.now()
    const segments = await wrapped.tts.prepareSection(chapter.sectionIndex, {
        multiSpeaker: true,
        maxSegmentChars: options.maxSegmentChars,
    })
    const preparedMs = Date.now() - preparedStartedAt
    await writeJson(join(runDir, 'segments.json'), segments)

    const preparedReport = analyzePreparedSegments(chapter.blocks, segments)
    await writeJson(join(runDir, 'segments-report.json'), preparedReport)

    let audioReport = null
    if (!options.skipAudio) {
        try {
            audioReport = await runAudioJob({
                wrapped,
                segments,
                options,
                audioDir: dirs.audio,
                fetchLog,
            })
        } catch (error) {
            audioReport = {
                error: error instanceof Error ? error.message : String(error),
                finalStatus: 'error',
                missingSegmentIds: segments.map(segment => segment.id),
                waitRisks: [],
            }
            await writeJson(join(dirs.audio, 'error.json'), audioReport)
        }
    }
    await writeJson(join(dirs.audio, 'fetch-log.json'), fetchLog)
    const fetchSummary = summarizeFetchLog(fetchLog)

    const totalMs = Date.now() - totalStartedAt
    const report = {
        meta,
        chapter: {
            sectionIndex: chapter.sectionIndex,
            sectionId: chapter.section.id,
            title: chapter.title,
            blockCount: chapter.blocks.length,
        },
        timings: {
            totalMs,
            parseBookMs,
            findChapterMs,
            prepareSectionMs: preparedMs,
        },
        llm: llmEvents,
        prepared: preparedReport,
        audio: audioReport,
        fetch: fetchSummary,
    }
    await writeJson(join(runDir, 'report.json'), report)
    await writeFile(join(runDir, 'report.md'), formatAutoReport(report), 'utf8')

    console.log(`TTS auto replay completed: ${runDir}`)
    console.log(`Chapter section: ${chapter.sectionIndex} ${chapter.title}`)
    console.log(`LLM calls: ${llmEvents.length}`)
    console.log(`Segments: ${segments.length}`)
    if (audioReport) {
        console.log(`Audio job: ${audioReport.jobId} ${audioReport.finalStatus}`)
        console.log(`Audio missing: ${audioReport.missingSegmentIds.length}, wait risks: ${audioReport.waitRisks.length}`)
    }
    console.log(`Report: ${join(runDir, 'report.md')}`)
}

function parseArgs(argv) {
    const options = {
        bookPath: DEFAULT_BOOK_PATH,
        chapter: DEFAULT_CHAPTER,
        endpoint: process.env.REBOOK_TTS_ENDPOINT || DEFAULT_ENDPOINT,
        provider: process.env.REBOOK_TTS_PROVIDER || DEFAULT_PROVIDER,
        model: process.env.REBOOK_TTS_MODEL || process.env.OPENAI_MODEL || DEFAULT_MODEL,
        apiMode: process.env.OPENAI_API_MODE || DEFAULT_API_MODE,
        outputDir: undefined,
        maxSegmentChars: 500,
        concurrency: 2,
        pollIntervalMs: 1000,
        waitSeconds: 240,
        llmTimeoutMs: parseOptionalMs(process.env.REBOOK_TTS_LLM_TIMEOUT_MS),
        skipAudio: false,
        help: false,
    }

    for (let index = 0; index < argv.length; index++) {
        const arg = argv[index]
        if (arg === '--book') options.bookPath = argv[++index] ?? options.bookPath
        else if (arg === '--chapter') options.chapter = argv[++index] ?? options.chapter
        else if (arg === '--endpoint') options.endpoint = argv[++index] ?? options.endpoint
        else if (arg === '--provider') options.provider = argv[++index] ?? options.provider
        else if (arg === '--model') options.model = argv[++index] ?? options.model
        else if (arg === '--api-mode') options.apiMode = argv[++index] ?? options.apiMode
        else if (arg === '--out') options.outputDir = argv[++index]
        else if (arg === '--max-segment-chars') options.maxSegmentChars = Number(argv[++index] ?? options.maxSegmentChars)
        else if (arg === '--concurrency') options.concurrency = Number(argv[++index] ?? options.concurrency)
        else if (arg === '--poll-ms') options.pollIntervalMs = Number(argv[++index] ?? options.pollIntervalMs)
        else if (arg === '--wait-seconds') options.waitSeconds = Number(argv[++index] ?? options.waitSeconds)
        else if (arg === '--llm-timeout-seconds') options.llmTimeoutMs = secondsToMs(argv[++index])
        else if (arg === '--skip-audio') options.skipAudio = true
        else if (arg === '--help' || arg === '-h') options.help = true
        else throw new Error(`Unknown argument: ${arg}`)
    }
    return options
}

function parseOptionalMs(value) {
    if (value == null || String(value).trim() === '') return undefined
    const number = Number(value)
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : undefined
}

function secondsToMs(value) {
    const number = Number(value)
    if (!Number.isFinite(number) || number <= 0) return undefined
    return Math.floor(number * 1000)
}

function printHelp() {
    console.log(`Usage: npm run tts:auto-replay -- [options]

Options:
  --book PATH                 EPUB path. Default: ${DEFAULT_BOOK_PATH}
  --chapter TEXT              Chapter title. Default: ${DEFAULT_CHAPTER}
  --endpoint URL              TTS service endpoint. Default: ${DEFAULT_ENDPOINT}
  --provider NAME             TTS provider. Default: ${DEFAULT_PROVIDER}
  --model NAME                OpenAI model. Default: ${DEFAULT_MODEL}
  --api-mode MODE             chat or responses. Default: ${DEFAULT_API_MODE}
  --out DIR                   Output run directory.
  --max-segment-chars N       Max chars per TTS segment. Default: 500.
  --concurrency N             TTS job concurrency. Default: 2.
  --poll-ms N                 Audio job poll interval. Default: 1000.
  --wait-seconds N            Audio job timeout. Default: 240.
  --llm-timeout-seconds N     Per LLM phase timeout. Use 0 to disable.
  --skip-audio                Only run EPUB parsing, LLM analysis, and segment diagnostics.

Environment:
  OPENAI_API_KEY              Required for LLM analysis.
  OPENAI_BASE_URL             Optional OpenAI-compatible base URL.
  OPENAI_MODEL                Optional fallback model name.
  OPENAI_API_MODE             chat or responses. Default: chat.
  REBOOK_TTS_LLM_TIMEOUT_MS   Optional per LLM phase timeout.
  REBOOK_TTS_ENDPOINT         Optional TTS endpoint.
  .env and .env.local         Loaded automatically without overriding existing env vars.
`)
}

async function loadDotEnvFiles() {
    for (const fileName of ['.env', '.env.local']) {
        let text
        try {
            text = await readFile(fileName, 'utf8')
        } catch (error) {
            if (error?.code === 'ENOENT') continue
            throw error
        }
        for (const line of text.split(/\r?\n/)) {
            const parsed = parseDotEnvLine(line)
            if (!parsed) continue
            const [key, value] = parsed
            if (process.env[key] === undefined) process.env[key] = value
        }
    }
}

function parseDotEnvLine(line) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return null
    const source = trimmed.startsWith('export ') ? trimmed.slice('export '.length).trim() : trimmed
    const equalsIndex = source.indexOf('=')
    if (equalsIndex <= 0) return null
    const key = source.slice(0, equalsIndex).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null
    let value = source.slice(equalsIndex + 1).trim()
    const quote = value[0]
    if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
        value = value.slice(1, -1)
        if (quote === '"') {
            value = value
                .replace(/\\n/g, '\n')
                .replace(/\\r/g, '\r')
                .replace(/\\t/g, '\t')
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, '\\')
        }
    } else {
        value = value.replace(/\s+#.*$/, '')
    }
    return [key, value]
}

function createLanguageModel(options) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY is required for tts:auto-replay')
    }
    const openai = createOpenAI({
        apiKey,
        baseURL: normalizeOpenAIBaseURL(process.env.OPENAI_BASE_URL),
    })
    if (options.apiMode === 'responses') return openai.responses(options.model)
    if (options.apiMode !== 'chat') {
        throw new Error('OPENAI_API_MODE must be chat or responses')
    }
    return openai.chat(options.model)
}

function normalizeOpenAIBaseURL(value) {
    const trimmed = value?.trim()
    if (!trimmed) return undefined
    try {
        const url = new URL(trimmed)
        if (url.pathname === '' || url.pathname === '/') {
            url.pathname = '/v1'
            return url.toString().replace(/\/$/, '')
        }
    } catch {
        return trimmed
    }
    return trimmed.replace(/\/$/, '')
}

async function parseBook(bookPath) {
    const data = await readFile(bookPath)
    const parser = new EPUBParser()
    return parser.parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), {
        domAdapter: new NodeDOMAdapter(),
        urlFactory: new NodeURLFactory(),
    })
}

async function findChapter(book, chapterTitle) {
    const target = normalizeTitle(chapterTitle)
    for (let sectionIndex = 0; sectionIndex < book.sections.length; sectionIndex++) {
        const section = book.sections[sectionIndex]
        if (!section?.getBlocks) continue
        const blocks = await section.getBlocks()
        const sample = blocks.slice(0, 8).map(blockText).join('\n')
        if (normalizeTitle(sample).includes(target)) {
            return {
                sectionIndex,
                section,
                blocks,
                title: firstMeaningfulText(blocks) ?? chapterTitle,
            }
        }
    }
    throw new Error(`Chapter not found: ${chapterTitle}`)
}

function blockText(block) {
    if (Array.isArray(block.segments) && block.segments.length) {
        return block.segments.map(segment => segment.text).join('')
    }
    if (block.table?.rows) {
        return block.table.rows.flatMap(row => row.cells.map(cell => cell.text)).join(' ')
    }
    return ''
}

function firstMeaningfulText(blocks) {
    for (const block of blocks) {
        const text = normalizeText(blockText(block))
        if (text) return text
    }
    return undefined
}

async function persistLLMEvent(llmDir, index, event) {
    const prefix = `${String(index).padStart(2, '0')}-${event.phase}`
    const replay = event.error ? analyzeLLMError(event) : analyzeLLMEvent(event.request, event.response)
    await writeJson(join(llmDir, `${prefix}.request.json`), event.request)
    await writeJson(join(llmDir, `${prefix}.response.json`), event.response)
    await writeJson(join(llmDir, `${prefix}.replay.json`), replay)
    await writeFile(join(llmDir, `${prefix}.replay.md`), formatLLMEventReport(replay), 'utf8')
    return {
        phase: event.phase,
        sectionIndex: event.sectionIndex,
        durationMs: event.durationMs,
        requestPath: `llm/${prefix}.request.json`,
        responsePath: `llm/${prefix}.response.json`,
        replayPath: `llm/${prefix}.replay.json`,
        error: event.error,
        summary: replay.summary,
    }
}

function analyzeLLMError(event) {
    return {
        summary: {
            kind: 'error',
            phase: event.phase,
            error: event.error,
            errorCount: 1,
            warningCount: 0,
        },
        examples: {
            errors: [{ phase: event.phase, error: event.error }],
        },
    }
}

function analyzeLLMEvent(request, response) {
    if (hasSegmentResponse(response)) return analyzeReplay(request, response)
    return analyzeSpeakerPlan(request, response)
}

function hasSegmentResponse(response) {
    return response && typeof response === 'object' && Array.isArray(response.segments)
}

function analyzeSpeakerPlan(request, response) {
    const knownSpeakers = Array.isArray(request?.knownSpeakers) ? request.knownSpeakers : []
    const speakers = Array.isArray(response?.speakers) ? response.speakers : []
    const invalidSpeakers = []
    const duplicateSpeakerIds = []
    const seenIds = new Set(knownSpeakers.map(speaker => speaker?.i).filter(Number.isFinite))
    for (const [index, speaker] of speakers.entries()) {
        if (
            !speaker
            || typeof speaker !== 'object'
            || !Number.isFinite(speaker.i)
            || typeof speaker.n !== 'string'
            || !['c', 'o'].includes(speaker.r)
            || ![0, 1, 2].includes(speaker.g)
        ) {
            invalidSpeakers.push({ index, speaker })
            continue
        }
        if (seenIds.has(speaker.i)) duplicateSpeakerIds.push({ index, id: speaker.i, name: speaker.n })
        seenIds.add(speaker.i)
    }
    return {
        summary: {
            kind: 'plan',
            knownSpeakers: knownSpeakers.length,
            speakers: speakers.length,
            invalidSpeakerCount: invalidSpeakers.length,
            duplicateSpeakerIdCount: duplicateSpeakerIds.length,
            voiceDesignCount: speakers.filter(hasVoiceDesignSpeakerInfo).length,
            presetVoiceCount: speakers.filter(speaker => typeof speaker?.v === 'string' && speaker.v.trim()).length,
            errorCount: invalidSpeakers.length + duplicateSpeakerIds.length,
            warningCount: 0,
        },
        examples: {
            invalidSpeakers: invalidSpeakers.slice(0, 8),
            duplicateSpeakerIds: duplicateSpeakerIds.slice(0, 8),
        },
    }
}

function formatLLMEventReport(replay) {
    if (replay.summary?.kind === 'plan') {
        return [
            'TTS speaker plan report',
            '',
            `Known speakers: ${replay.summary.knownSpeakers}`,
            `Planned speakers: ${replay.summary.speakers}`,
            `Voice design prompts: ${replay.summary.voiceDesignCount}`,
            `Preset voices: ${replay.summary.presetVoiceCount}`,
            `Invalid speakers: ${replay.summary.invalidSpeakerCount}`,
            `Duplicate speaker ids: ${replay.summary.duplicateSpeakerIdCount}`,
        ].join('\n')
    }
    if (replay.summary?.kind === 'error') {
        return [
            'TTS LLM error report',
            '',
            `Phase: ${replay.summary.phase}`,
            `Error: ${replay.summary.error}`,
        ].join('\n')
    }
    return formatReport(replay)
}

function hasVoiceDesignSpeakerInfo(speaker) {
    return ['d', 'a', 'o', 'p', 'q'].some(key => typeof speaker?.[key] === 'string' && speaker[key].trim())
}

async function runAudioJob({ wrapped, segments, options, audioDir, fetchLog }) {
    const startedAt = Date.now()
    const initialJob = await wrapped.tts.createJob(segments, {
        provider: options.provider,
        concurrency: options.concurrency,
    })
    const createJobMs = Date.now() - startedAt
    const polls = [{ elapsedMs: createJobMs, job: compactJob(initialJob) }]
    let latestJob = initialJob
    const deadline = startedAt + options.waitSeconds * 1000

    while (!isTerminalJob(latestJob) && Date.now() < deadline) {
        await delay(options.pollIntervalMs)
        latestJob = await wrapped.tts.getJob(initialJob.id)
        polls.push({ elapsedMs: Date.now() - startedAt, job: compactJob(latestJob) })
    }

    await writeJson(join(audioDir, 'job-initial.json'), initialJob)
    await writeJson(join(audioDir, 'job-final.json'), latestJob)
    await writeJson(join(audioDir, 'polls.json'), polls)
    await writeJson(join(audioDir, 'results.json'), latestJob.results)

    return analyzeAudioJob({
        jobId: initialJob.id,
        startedAt,
        createJobMs,
        finalJob: latestJob,
        polls,
        segments,
        fetchLog,
    })
}

function compactJob(job) {
    return {
        id: job.id,
        status: job.status,
        total: job.total,
        completed: job.completed,
        failed: job.failed,
        error: job.error,
        resultSegmentIds: Array.isArray(job.results) ? job.results.map(result => result.segmentId) : [],
    }
}

function analyzePreparedSegments(blocks, segments) {
    const blockIds = new Set(blocks.map(block => block.id))
    const tinySegments = []
    const adjacentSameSpeaker = []
    const unknownBlockSegments = []
    const byBlock = new Map()

    for (const segment of segments) {
        if (!blockIds.has(segment.blockId)) unknownBlockSegments.push(segment.id)
        const list = byBlock.get(segment.blockId)
        if (list) list.push(segment)
        else byBlock.set(segment.blockId, [segment])
        if (hasSpeakableText(segment.text) && segment.text.length <= 4) {
            tinySegments.push(pickSegment(segment))
        }
    }

    for (const [blockId, list] of byBlock) {
        const sorted = list.slice().sort((a, b) => a.startOffset - b.startOffset || a.endOffset - b.endOffset)
        for (let index = 1; index < sorted.length; index++) {
            const previous = sorted[index - 1]
            const current = sorted[index]
            if (
                previous.speakerId === current.speakerId
                && previous.speaker === current.speaker
                && previous.voice === current.voice
                && current.startOffset >= previous.endOffset
                && current.startOffset - previous.endOffset <= 8
            ) {
                adjacentSameSpeaker.push({
                    blockId,
                    previous: pickSegment(previous),
                    current: pickSegment(current),
                })
            }
        }
    }

    return {
        segmentCount: segments.length,
        blockCount: byBlock.size,
        tinySegmentCount: tinySegments.length,
        adjacentSameSpeakerCount: adjacentSameSpeaker.length,
        unknownBlockSegmentCount: unknownBlockSegments.length,
        tinySegments: tinySegments.slice(0, 20),
        adjacentSameSpeaker: adjacentSameSpeaker.slice(0, 20),
        unknownBlockSegments: unknownBlockSegments.slice(0, 20),
    }
}

function analyzeAudioJob({ jobId, startedAt, createJobMs, finalJob, polls, segments }) {
    const resultBySegmentId = new Map()
    for (const result of finalJob.results ?? []) {
        resultBySegmentId.set(result.segmentId, result)
    }
    const firstSeenBySegmentId = new Map()
    for (const poll of polls) {
        for (const segmentId of poll.job.resultSegmentIds) {
            if (!firstSeenBySegmentId.has(segmentId)) firstSeenBySegmentId.set(segmentId, poll.elapsedMs)
        }
    }

    const missingSegmentIds = []
    const waitRisks = []
    const firstSeenValues = [...firstSeenBySegmentId.values()]
    let estimatedStartMs = 0
    for (const segment of segments) {
        const result = resultBySegmentId.get(segment.id)
        const firstSeenMs = firstSeenBySegmentId.get(segment.id)
        if (!result) {
            missingSegmentIds.push(segment.id)
            continue
        }
        const waitRiskMs = Math.max(0, (firstSeenMs ?? 0) - estimatedStartMs)
        if (waitRiskMs > 500) {
            waitRisks.push({
                segmentId: segment.id,
                blockId: segment.blockId,
                speaker: segment.speaker,
                text: clipText(segment.text, 80),
                firstSeenMs,
                estimatedStartMs,
                waitRiskMs,
            })
        }
        estimatedStartMs += estimateSegmentDurationMs(segment, result)
    }

    return {
        jobId,
        startedAt: new Date(startedAt).toISOString(),
        timings: {
            createJobMs,
            totalWaitMs: polls.at(-1)?.elapsedMs ?? 0,
            firstResultMs: firstSeenValues.length ? Math.min(...firstSeenValues) : null,
            lastResultMs: firstSeenValues.length ? Math.max(...firstSeenValues) : null,
            pollCount: polls.length,
        },
        finalStatus: finalJob.status,
        total: finalJob.total,
        completed: finalJob.completed,
        failed: finalJob.failed,
        resultCount: finalJob.results?.length ?? 0,
        missingSegmentIds,
        waitRisks: waitRisks.slice(0, 50),
    }
}

function createLoggedFetch(fetchImpl, logs) {
    return async (input, init) => {
        const startedAt = Date.now()
        const inputMethod = typeof input === 'object' && input && 'method' in input ? input.method : undefined
        const method = init?.method ?? inputMethod ?? 'GET'
        const url = typeof input === 'string' || input instanceof URL ? String(input) : input.url
        const requestBody = await readRequestBody(init?.body)
        try {
            const response = await fetchImpl(input, init)
            const responseText = await response.clone().text().catch(error => `<<read failed: ${error?.message || error}>>`)
            logs.push({
                at: new Date(startedAt).toISOString(),
                elapsedMs: Date.now() - startedAt,
                method,
                url,
                requestBody: parseMaybeJson(requestBody),
                status: response.status,
                ok: response.ok,
                responseBody: parseMaybeJson(clipText(responseText, 20000)),
            })
            return response
        } catch (error) {
            logs.push({
                at: new Date(startedAt).toISOString(),
                elapsedMs: Date.now() - startedAt,
                method,
                url,
                requestBody: parseMaybeJson(requestBody),
                error: error instanceof Error ? error.message : String(error),
            })
            throw error
        }
    }
}

function summarizeFetchLog(logs) {
    const summary = {
        count: logs.length,
        totalMs: 0,
        maxMs: 0,
        errors: 0,
        byKind: {},
    }
    for (const log of logs) {
        const elapsedMs = Number.isFinite(log.elapsedMs) ? log.elapsedMs : 0
        const kind = classifyFetchUrl(log.url)
        summary.totalMs += elapsedMs
        summary.maxMs = Math.max(summary.maxMs, elapsedMs)
        if (log.error || log.ok === false) summary.errors += 1
        const item = summary.byKind[kind] ?? {
            count: 0,
            totalMs: 0,
            maxMs: 0,
            errors: 0,
        }
        item.count += 1
        item.totalMs += elapsedMs
        item.maxMs = Math.max(item.maxMs, elapsedMs)
        if (log.error || log.ok === false) item.errors += 1
        summary.byKind[kind] = item
    }
    return summary
}

function classifyFetchUrl(url) {
    try {
        const parsed = new URL(String(url))
        if (/\/v1\/tts\/voices/.test(parsed.pathname)) return 'tts-voices'
        if (/\/v1\/tts\/jobs\/[^/]+$/.test(parsed.pathname)) return 'tts-job-poll'
        if (/\/v1\/tts\/jobs$/.test(parsed.pathname)) return 'tts-job-create'
        if (/\/v1\/tts\/synthesize/.test(parsed.pathname)) return 'tts-synthesize'
        return parsed.pathname || 'other'
    } catch {
        return 'other'
    }
}

function estimateSegmentDurationMs(segment, result) {
    if (typeof result.durationMs === 'number' && result.durationMs > 0) return result.durationMs
    const text = String(segment.text ?? '')
    const cjkCount = [...text].filter(char => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(char)).length
    const latinWordCount = (text.match(/[A-Za-z0-9]+/g) ?? []).length
    const punctuationPause = (text.match(/[。！？.!?；;，,、：:—…]/g) ?? []).length * 120
    const base = cjkCount * 180 + latinWordCount * 260 + punctuationPause
    return Math.max(450, Math.min(30000, base || text.length * 150))
}

async function readRequestBody(body) {
    if (body == null) return undefined
    if (typeof body === 'string') return body
    if (body instanceof Uint8Array) return new TextDecoder().decode(body)
    if (body instanceof ArrayBuffer) return new TextDecoder().decode(body)
    return `<<${Object.prototype.toString.call(body)}>>`
}

function formatAutoReport(report) {
    const lines = [
        '# TTS Auto Replay Report',
        '',
        `- Book: ${basename(report.meta.bookPath)}`,
        `- Chapter: ${report.chapter.title} (section ${report.chapter.sectionIndex})`,
        `- Model: ${report.meta.model}`,
        `- Endpoint: ${report.meta.endpoint}`,
        `- LLM timeout: ${formatNullableMs(report.meta.llmTimeoutMs)}`,
        `- Total time: ${report.timings.totalMs}ms`,
        `- Parse book: ${report.timings.parseBookMs}ms`,
        `- Find chapter: ${report.timings.findChapterMs}ms`,
        `- Prepare section: ${report.timings.prepareSectionMs}ms`,
        `- LLM calls: ${report.llm.length}`,
        `- Prepared segments: ${report.prepared.segmentCount}`,
        `- Tiny prepared segments: ${report.prepared.tinySegmentCount}`,
        `- Adjacent same-speaker prepared splits: ${report.prepared.adjacentSameSpeakerCount}`,
        '',
        '## LLM',
        '',
        ...report.llm.map(formatLLMSummary),
        '',
        '## Audio',
        '',
    ]

    if (report.audio) {
        if (report.audio.error) {
            lines.push(`- Error: ${report.audio.error}`)
        } else {
            lines.push(
                `- Job: ${report.audio.jobId}`,
                `- Final status: ${report.audio.finalStatus}`,
                `- Create job time: ${report.audio.timings?.createJobMs ?? 0}ms`,
                `- Total wait time: ${report.audio.timings?.totalWaitMs ?? 0}ms`,
                `- First result: ${formatNullableMs(report.audio.timings?.firstResultMs)}`,
                `- Last result: ${formatNullableMs(report.audio.timings?.lastResultMs)}`,
                `- Polls: ${report.audio.timings?.pollCount ?? 0}`,
                `- Completed: ${report.audio.completed}/${report.audio.total}`,
                `- Failed: ${report.audio.failed}`,
                `- Missing segments: ${report.audio.missingSegmentIds.length}`,
                `- Estimated wait risks: ${report.audio.waitRisks.length}`,
            )
            if (report.audio.waitRisks.length) {
                lines.push('', '### Wait Risk Examples', '')
                for (const risk of report.audio.waitRisks.slice(0, 10)) {
                    lines.push(`- ${risk.segmentId} ${risk.waitRiskMs}ms ${risk.text}`)
                }
            }
        }
    } else {
        lines.push('- Audio job skipped.')
    }

    lines.push('', '## Fetch', '')
    lines.push(
        `- Requests: ${report.fetch?.count ?? 0}`,
        `- Total HTTP time: ${report.fetch?.totalMs ?? 0}ms`,
        `- Max request time: ${report.fetch?.maxMs ?? 0}ms`,
        `- Errors: ${report.fetch?.errors ?? 0}`,
    )
    for (const [kind, item] of Object.entries(report.fetch?.byKind ?? {})) {
        lines.push(`- ${kind}: ${item.count} requests, ${item.totalMs}ms total, ${item.maxMs}ms max, ${item.errors} errors`)
    }

    lines.push('', '## Prepared Segment Findings', '')
    for (const item of report.prepared.tinySegments.slice(0, 10)) {
        lines.push(`- Tiny: ${item.id} ${item.text}`)
    }
    for (const item of report.prepared.adjacentSameSpeaker.slice(0, 10)) {
        lines.push(`- Adjacent same-speaker: ${item.previous.id} -> ${item.current.id}`)
    }

    return lines.join('\n')
}

function formatLLMSummary(event, index) {
    if (event.summary?.kind === 'error') {
        return [
            `### ${index + 1}. ${event.phase}`,
            '',
            `- Duration: ${event.durationMs}ms`,
            `- Error: ${event.summary.error}`,
            `- Replay: ${event.replayPath}`,
        ].join('\n')
    }
    if (event.summary?.kind === 'plan') {
        return [
            `### ${index + 1}. ${event.phase}`,
            '',
            `- Duration: ${event.durationMs}ms`,
            `- Planned speakers: ${event.summary.speakers}`,
            `- Voice design prompts: ${event.summary.voiceDesignCount}`,
            `- Preset voices: ${event.summary.presetVoiceCount}`,
            `- Invalid speakers: ${event.summary.invalidSpeakerCount}`,
            `- Duplicate speaker ids: ${event.summary.duplicateSpeakerIdCount}`,
            `- Replay: ${event.replayPath}`,
        ].join('\n')
    }
    return [
        `### ${index + 1}. ${event.phase}`,
        '',
        `- Duration: ${event.durationMs}ms`,
        `- Gaps: ${event.summary?.gapCount ?? 0}`,
        `- Out-of-range: ${event.summary?.outOfRangeCount ?? 0}`,
        `- Mixed single-speaker blocks: ${event.summary?.mixedSingleSpeakerCount ?? 0}`,
        `- Tiny segments: ${event.summary?.tinySegmentCount ?? 0}`,
        `- Replay: ${event.replayPath}`,
    ].join('\n')
}

function formatNullableMs(value) {
    return typeof value === 'number' ? `${value}ms` : 'none'
}

function pickSegment(segment) {
    return {
        id: segment.id,
        blockId: segment.blockId,
        startOffset: segment.startOffset,
        endOffset: segment.endOffset,
        speakerId: segment.speakerId,
        speaker: segment.speaker,
        voice: segment.voice,
        text: clipText(segment.text, 120),
    }
}

function isTerminalJob(job) {
    return job.status === 'done' || job.status === 'failed' || job.status === 'partial'
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

function normalizeTitle(value) {
    return String(value ?? '').replace(/\s+/g, '')
}

function normalizeText(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function safeName(value) {
    return normalizeTitle(value).replace(/[^\p{Letter}\p{Number}._-]+/gu, '-').slice(0, 80) || 'tts-run'
}

function formatTimestamp(date) {
    const pad = value => String(value).padStart(2, '0')
    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate()),
        '-',
        pad(date.getHours()),
        pad(date.getMinutes()),
        pad(date.getSeconds()),
    ].join('')
}

function hasSpeakableText(text) {
    return String(text ?? '').replace(/[\s"'“”‘’「」『』()[\]{}<>《》。，、？！：；,.!?;:\-—–…]+/g, '').length > 0
}

function parseMaybeJson(value) {
    if (typeof value !== 'string') return value
    if (!value) return value
    try {
        return JSON.parse(value)
    } catch {
        return value
    }
}

function clipText(text, length = 200) {
    const value = String(text ?? '')
    return value.length <= length ? value : `${value.slice(0, length)}...`
}

async function writeJson(path, value) {
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

main().catch(error => {
    console.error(error instanceof Error ? error.stack || error.message : String(error))
    process.exit(1)
})
