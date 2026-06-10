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
const DEFAULT_PROVIDER = 'mimo'
const DEFAULT_MODELS = [
    'deepseek-web/base_think',
    'deepseek-web/pro',
    'deepseek-web/pro_think',
]
const DEFAULT_API_MODE = 'chat'
const DEFAULT_LLM_TIMEOUT_MS = 120000

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
        'tts-llm-benchmarks',
        `${safeName(options.chapter)}-${formatTimestamp(new Date())}`,
    ))
    await mkdir(runDir, { recursive: true })

    const parseStartedAt = Date.now()
    const book = await parseBook(options.bookPath)
    const parseBookMs = Date.now() - parseStartedAt
    const findStartedAt = Date.now()
    const chapter = await findChapter(book, options.chapter)
    const findChapterMs = Date.now() - findStartedAt

    await writeJson(join(runDir, 'meta.json'), {
        createdAt: new Date().toISOString(),
        bookPath: options.bookPath,
        chapter: options.chapter,
        sectionIndex: chapter.sectionIndex,
        provider: options.provider,
        endpoint: options.endpoint,
        models: options.models,
        phaseModelOverrides: getPhaseModelOverrides(options),
        apiMode: options.apiMode,
        llmTimeoutMs: options.llmTimeoutMs,
        maxSegmentChars: options.maxSegmentChars,
        parseBookMs,
        findChapterMs,
    })
    await writeJson(join(runDir, 'blocks.json'), chapter.blocks.map(block => ({
        id: block.id,
        type: block.type,
        text: blockText(block),
    })))

    const results = []
    for (const modelName of options.models) {
        const modelResult = await runModelBenchmark({
            book,
            chapter,
            options,
            modelName,
            runDir,
        })
        results.push(modelResult)
        await writeBenchmarkSummary(runDir, options, chapter, results, totalStartedAt)
        console.log(`${modelName}: ${modelResult.status} ${modelResult.timings?.totalMs ?? 0}ms`)
    }

    await writeBenchmarkSummary(runDir, options, chapter, results, totalStartedAt)

    console.log(`LLM benchmark completed: ${runDir}`)
    console.log(`Summary: ${join(runDir, 'summary.md')}`)
}

async function writeBenchmarkSummary(runDir, options, chapter, results, startedAt) {
    const summary = {
        createdAt: new Date().toISOString(),
        totalMs: Date.now() - startedAt,
        book: basename(options.bookPath),
        chapter: chapter.title,
        sectionIndex: chapter.sectionIndex,
        provider: options.provider,
        phaseModelOverrides: getPhaseModelOverrides(options),
        models: results,
    }
    await writeJson(join(runDir, 'summary.json'), summary)
    await writeFile(join(runDir, 'summary.md'), formatBenchmarkSummary(summary), 'utf8')
    return summary
}

async function runModelBenchmark({ book, chapter, options, modelName, runDir }) {
    const modelDir = join(runDir, safeName(modelName))
    const llmDir = join(modelDir, 'llm')
    await mkdir(llmDir, { recursive: true })

    const events = []
    const fetchLog = []
    const startedAt = Date.now()
    try {
        const phaseModelNames = getPhaseModelNames(options, modelName)
        const phaseModels = createPhaseLanguageModels(options, phaseModelNames)
        const wrapped = withTTS({
            endpoint: options.endpoint,
            provider: options.provider,
            lang: 'zh-CN',
            fetch: createBenchmarkFetch(globalThis.fetch.bind(globalThis), fetchLog, options.provider),
            model: phaseModels.initial,
            speakerAnalysis: {
                models: phaseModels,
                timeoutMs: options.llmTimeoutMs,
                onLog: async event => {
                    const record = await persistLLMEvent(llmDir, events.length + 1, event)
                    events.push(record)
                },
            },
        })(book)

        const prepareStartedAt = Date.now()
        const segments = await wrapped.tts.prepareSection(chapter.sectionIndex, {
            multiSpeaker: true,
            maxSegmentChars: options.maxSegmentChars,
        })
        const prepareSectionMs = Date.now() - prepareStartedAt
        const prepared = analyzePreparedSegments(chapter.blocks, segments)
        const result = {
            model: modelName,
            phaseModels: phaseModelNames,
            status: 'ok',
            timings: {
                totalMs: Date.now() - startedAt,
                prepareSectionMs,
                llmMs: events.reduce((sum, event) => sum + (event.durationMs || 0), 0),
            },
            llm: events,
            prepared,
            fetch: summarizeFetchLog(fetchLog),
        }
        await writeJson(join(modelDir, 'segments.json'), segments)
        await writeJson(join(modelDir, 'report.json'), result)
        await writeFile(join(modelDir, 'report.md'), formatModelReport(result), 'utf8')
        return result
    } catch (error) {
        const result = {
            model: modelName,
            phaseModels: getPhaseModelNames(options, modelName),
            status: 'error',
            timings: {
                totalMs: Date.now() - startedAt,
                llmMs: events.reduce((sum, event) => sum + (event.durationMs || 0), 0),
            },
            error: error instanceof Error ? error.stack || error.message : String(error),
            llm: events,
            fetch: summarizeFetchLog(fetchLog),
        }
        await writeJson(join(modelDir, 'report.json'), result)
        await writeFile(join(modelDir, 'report.md'), formatModelReport(result), 'utf8')
        return result
    }
}

function parseArgs(argv) {
    const options = {
        bookPath: DEFAULT_BOOK_PATH,
        chapter: DEFAULT_CHAPTER,
        endpoint: process.env.REBOOK_TTS_ENDPOINT || DEFAULT_ENDPOINT,
        provider: process.env.REBOOK_TTS_PROVIDER || DEFAULT_PROVIDER,
        models: parseModelList(process.env.REBOOK_LLM_BENCHMARK_MODELS) ?? DEFAULT_MODELS,
        planModel: process.env.REBOOK_TTS_PLAN_MODEL || undefined,
        initialModel: process.env.REBOOK_TTS_INITIAL_MODEL || undefined,
        repairModel: process.env.REBOOK_TTS_REPAIR_MODEL || undefined,
        apiMode: process.env.OPENAI_API_MODE || DEFAULT_API_MODE,
        llmTimeoutMs: parseOptionalMs(process.env.REBOOK_TTS_LLM_TIMEOUT_MS) ?? DEFAULT_LLM_TIMEOUT_MS,
        outputDir: undefined,
        maxSegmentChars: 500,
        help: false,
    }

    for (let index = 0; index < argv.length; index++) {
        const arg = argv[index]
        if (arg === '--book') options.bookPath = argv[++index] ?? options.bookPath
        else if (arg === '--chapter') options.chapter = argv[++index] ?? options.chapter
        else if (arg === '--endpoint') options.endpoint = argv[++index] ?? options.endpoint
        else if (arg === '--provider') options.provider = argv[++index] ?? options.provider
        else if (arg === '--models') options.models = parseModelList(argv[++index]) ?? options.models
        else if (arg === '--plan-model') options.planModel = argv[++index] ?? options.planModel
        else if (arg === '--initial-model') options.initialModel = argv[++index] ?? options.initialModel
        else if (arg === '--repair-model') options.repairModel = argv[++index] ?? options.repairModel
        else if (arg === '--api-mode') options.apiMode = argv[++index] ?? options.apiMode
        else if (arg === '--out') options.outputDir = argv[++index]
        else if (arg === '--max-segment-chars') options.maxSegmentChars = Number(argv[++index] ?? options.maxSegmentChars)
        else if (arg === '--llm-timeout-seconds') options.llmTimeoutMs = secondsToMs(argv[++index])
        else if (arg === '--help' || arg === '-h') options.help = true
        else throw new Error(`Unknown argument: ${arg}`)
    }
    return options
}

function parseModelList(value) {
    const models = String(value ?? '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
    return models.length ? models : undefined
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
    console.log(`Usage: npm run tts:llm-benchmark -- [options]

Options:
  --book PATH                 EPUB path. Default: ${DEFAULT_BOOK_PATH}
  --chapter TEXT              Chapter title. Default: ${DEFAULT_CHAPTER}
  --endpoint URL              TTS service endpoint. Provider capability is mocked for mimo. Default: ${DEFAULT_ENDPOINT}
  --provider NAME             Provider used by withTTS. Default: ${DEFAULT_PROVIDER}
  --models A,B,C              Comma-separated model list. Default: ${DEFAULT_MODELS.join(',')}
  --plan-model NAME           Model for role planning. Default: benchmark model.
  --initial-model NAME        Model for text analysis. Default: benchmark model.
  --repair-model NAME         Model for repair. Default: text analysis model.
  --api-mode MODE             chat or responses. Default: ${DEFAULT_API_MODE}
  --out DIR                   Output run directory.
  --max-segment-chars N       Max chars per final TTS segment. Default: 500.
  --llm-timeout-seconds N     Per LLM phase timeout. Use 0 to disable. Default: ${DEFAULT_LLM_TIMEOUT_MS / 1000}.

Environment:
  OPENAI_API_KEY              Required.
  OPENAI_BASE_URL             Optional OpenAI-compatible base URL.
  REBOOK_LLM_BENCHMARK_MODELS Optional comma-separated model override.
  REBOOK_TTS_PLAN_MODEL       Optional fixed role planning model.
  REBOOK_TTS_INITIAL_MODEL    Optional fixed text analysis model.
  REBOOK_TTS_REPAIR_MODEL     Optional fixed repair model.
  REBOOK_TTS_LLM_TIMEOUT_MS   Optional per LLM phase timeout.
  .env and .env.local         Loaded automatically without overriding existing env vars.
`)
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
    if (response && typeof response === 'object' && Array.isArray(response.assignments)) {
        return analyzeReplay(request, response)
    }
    return analyzeSpeakerPlan(request, response)
}

function analyzeSpeakerPlan(request, response) {
    const knownSpeakers = Array.isArray(request?.knownSpeakers) ? request.knownSpeakers : []
    const requestVoiceDesign = request?.voiceDesign === 1
    const requestVoiceCount = Array.isArray(request?.voices) ? request.voices.length : 0
    const speakers = Array.isArray(response?.speakers) ? response.speakers : []
    const invalidSpeakers = []
    const duplicateSpeakerIds = []
    const presetVoiceSpeakers = []
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
        if (typeof speaker?.v === 'string' && speaker.v.trim()) presetVoiceSpeakers.push({ index, id: speaker.i, name: speaker.n, voice: speaker.v })
    }
    const unexpectedVoiceCatalog = requestVoiceDesign && requestVoiceCount > 0
    const unexpectedPresetVoices = requestVoiceDesign && presetVoiceSpeakers.length > 0
    return {
        summary: {
            kind: 'plan',
            requestVoiceDesign,
            requestVoiceCount,
            knownSpeakers: knownSpeakers.length,
            speakers: speakers.length,
            invalidSpeakerCount: invalidSpeakers.length,
            duplicateSpeakerIdCount: duplicateSpeakerIds.length,
            voiceDesignCount: speakers.filter(hasVoiceDesignSpeakerInfo).length,
            presetVoiceCount: presetVoiceSpeakers.length,
            unexpectedVoiceCatalog,
            unexpectedPresetVoices,
            errorCount: invalidSpeakers.length + duplicateSpeakerIds.length,
            warningCount: Number(unexpectedVoiceCatalog) + Number(unexpectedPresetVoices),
        },
        examples: {
            invalidSpeakers: invalidSpeakers.slice(0, 8),
            duplicateSpeakerIds: duplicateSpeakerIds.slice(0, 8),
            presetVoiceSpeakers: presetVoiceSpeakers.slice(0, 8),
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
            `Request voiceDesign: ${replay.summary.requestVoiceDesign ? 'yes' : 'no'}`,
            `Request voices: ${replay.summary.requestVoiceCount}`,
            `Voice design prompts: ${replay.summary.voiceDesignCount}`,
            `Preset voices: ${replay.summary.presetVoiceCount}`,
            `Unexpected voice catalog in design plan: ${replay.summary.unexpectedVoiceCatalog ? 'yes' : 'no'}`,
            `Unexpected preset voices in design plan: ${replay.summary.unexpectedPresetVoices ? 'yes' : 'no'}`,
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

function getPhaseModelOverrides(options) {
    return {
        plan: options.planModel,
        initial: options.initialModel,
        repair: options.repairModel,
    }
}

function getPhaseModelNames(options, modelName) {
    const initial = options.initialModel || modelName
    return {
        plan: options.planModel || initial,
        initial,
        repair: options.repairModel || initial,
    }
}

function createPhaseLanguageModels(options, modelNames) {
    return {
        plan: createLanguageModel(options, modelNames.plan),
        initial: createLanguageModel(options, modelNames.initial),
        repair: createLanguageModel(options, modelNames.repair),
    }
}

function createLanguageModel(options, modelName) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY is required for tts:llm-benchmark')
    const openai = createOpenAI({
        apiKey,
        baseURL: normalizeOpenAIBaseURL(process.env.OPENAI_BASE_URL),
    })
    if (options.apiMode === 'responses') return openai.responses(modelName)
    if (options.apiMode !== 'chat') throw new Error('OPENAI_API_MODE must be chat or responses')
    return openai.chat(modelName)
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

function createBenchmarkFetch(fetchImpl, logs, provider) {
    return async (input, init) => {
        const startedAt = Date.now()
        const method = init?.method ?? 'GET'
        const url = typeof input === 'string' || input instanceof URL ? String(input) : input.url
        if (provider === 'mimo' && isProviderCatalogUrl(url)) {
            logs.push({
                at: new Date(startedAt).toISOString(),
                elapsedMs: Date.now() - startedAt,
                method,
                url,
                status: 200,
                ok: true,
                mocked: true,
            })
            return new Response(JSON.stringify({
                providers: [{
                    id: 'mimo',
                    name: 'Xiaomi MiMo TTS',
                    capabilities: { voiceDesign: true },
                }],
            }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            })
        }
        try {
            const response = await fetchImpl(input, init)
            logs.push({
                at: new Date(startedAt).toISOString(),
                elapsedMs: Date.now() - startedAt,
                method,
                url,
                status: response.status,
                ok: response.ok,
            })
            return response
        } catch (error) {
            logs.push({
                at: new Date(startedAt).toISOString(),
                elapsedMs: Date.now() - startedAt,
                method,
                url,
                error: error instanceof Error ? error.message : String(error),
            })
            throw error
        }
    }
}

function isProviderCatalogUrl(value) {
    try {
        return new URL(String(value)).pathname.endsWith('/v1/tts/providers')
    } catch {
        return false
    }
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

function analyzePreparedSegments(blocks, segments) {
    const blockIds = new Set(blocks.map(block => block.id))
    const tinySegments = []
    const adjacentSameSpeaker = []
    const unknownBlockSegments = []
    const speakers = new Map()
    const byBlock = new Map()

    for (const segment of segments) {
        if (!blockIds.has(segment.blockId)) unknownBlockSegments.push(segment.id)
        if (Number.isFinite(segment.speakerId)) speakers.set(segment.speakerId, segment.speaker)
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
        speakerCount: speakers.size,
        tinySegmentCount: tinySegments.length,
        adjacentSameSpeakerCount: adjacentSameSpeaker.length,
        unknownBlockSegmentCount: unknownBlockSegments.length,
        speakers: [...speakers.entries()].map(([id, name]) => ({ id, name })),
        tinySegments: tinySegments.slice(0, 20),
        adjacentSameSpeaker: adjacentSameSpeaker.slice(0, 20),
        unknownBlockSegments: unknownBlockSegments.slice(0, 20),
    }
}

function summarizeFetchLog(logs) {
    return logs.reduce((summary, log) => {
        const elapsedMs = Number.isFinite(log.elapsedMs) ? log.elapsedMs : 0
        summary.count += 1
        summary.totalMs += elapsedMs
        summary.maxMs = Math.max(summary.maxMs, elapsedMs)
        if (log.error || log.ok === false) summary.errors += 1
        if (log.mocked) summary.mocked += 1
        return summary
    }, { count: 0, totalMs: 0, maxMs: 0, errors: 0, mocked: 0 })
}

function formatBenchmarkSummary(summary) {
    const lines = [
        '# TTS LLM Benchmark',
        '',
        `- Book: ${summary.book}`,
        `- Chapter: ${summary.chapter} (section ${summary.sectionIndex})`,
        `- Provider: ${summary.provider}`,
        `- Phase model overrides: plan=${summary.phaseModelOverrides?.plan ?? '(benchmark model)'}, initial=${summary.phaseModelOverrides?.initial ?? '(benchmark model)'}, repair=${summary.phaseModelOverrides?.repair ?? '(text analysis model)'}`,
        `- Total time: ${summary.totalMs}ms`,
        '',
        '| Model | Status | Total | LLM | Plan Speakers | Initial Gaps | Initial Mixed | Repair Calls | Errors | Segments | Tiny |',
        '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ]
    for (const result of summary.models) {
        const plan = result.llm?.find(event => event.phase === 'plan')
        const initial = result.llm?.find(event => event.phase === 'initial')
        const repairCalls = result.llm?.filter(event => event.phase === 'repair').length ?? 0
        const errorCount = result.llm?.filter(event => event.summary?.kind === 'error').length ?? (result.status === 'error' ? 1 : 0)
        lines.push([
            escapeTable(result.model),
            result.status,
            `${result.timings?.totalMs ?? 0}ms`,
            `${Math.round(result.timings?.llmMs ?? 0)}ms`,
            plan?.summary?.speakers ?? 0,
            initial?.summary?.gapCount ?? 0,
            initial?.summary?.mixedSingleSpeakerCount ?? 0,
            repairCalls,
            errorCount,
            result.prepared?.segmentCount ?? 0,
            result.prepared?.tinySegmentCount ?? 0,
        ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
    }
    return `${lines.join('\n')}\n`
}

function formatModelReport(result) {
    const lines = [
        `# ${result.model}`,
        '',
        `- Phase models: plan=${result.phaseModels?.plan ?? result.model}, initial=${result.phaseModels?.initial ?? result.model}, repair=${result.phaseModels?.repair ?? result.model}`,
        `- Status: ${result.status}`,
        `- Total time: ${result.timings?.totalMs ?? 0}ms`,
        `- LLM time: ${Math.round(result.timings?.llmMs ?? 0)}ms`,
    ]
    if (result.error) lines.push(`- Error: ${result.error}`)
    lines.push('', '## LLM', '')
    for (const [index, event] of (result.llm ?? []).entries()) {
        lines.push(formatLLMSummary(event, index), '')
    }
    if (result.prepared) {
        lines.push(
            '## Prepared',
            '',
            `- Segments: ${result.prepared.segmentCount}`,
            `- Speakers: ${result.prepared.speakerCount}`,
            `- Tiny segments: ${result.prepared.tinySegmentCount}`,
            `- Adjacent same-speaker split risks: ${result.prepared.adjacentSameSpeakerCount}`,
        )
    }
    return `${lines.join('\n')}\n`
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
            `- Request voiceDesign: ${event.summary.requestVoiceDesign ? 'yes' : 'no'}`,
            `- Request voices: ${event.summary.requestVoiceCount}`,
            `- Voice design prompts: ${event.summary.voiceDesignCount}`,
            `- Preset voices: ${event.summary.presetVoiceCount}`,
            `- Unexpected voice catalog in design plan: ${event.summary.unexpectedVoiceCatalog ? 'yes' : 'no'}`,
            `- Unexpected preset voices in design plan: ${event.summary.unexpectedPresetVoices ? 'yes' : 'no'}`,
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

function clipText(text, length = 200) {
    const value = String(text ?? '')
    return value.length <= length ? value : `${value.slice(0, length)}...`
}

function escapeTable(value) {
    return String(value ?? '').replace(/\|/g, '\\|')
}

async function writeJson(path, value) {
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

main().catch(error => {
    console.error(error instanceof Error ? error.stack || error.message : String(error))
    process.exit(1)
})
