import { generateText, jsonSchema, Output, type LanguageModel } from 'ai'
import type { Book, RebookPlugin, TextBlock, TextSegment, TextTable, TextTableCell } from '../core/types'

const MAX_TRANSLATION_ATTEMPTS = 2
const TRANSLATION_REQUEST_DEBOUNCE_MS = 300
type TranslationMode = 'replace' | 'bilingual'
type ValueOrGetter<T> = T | (() => T)
type TranslationUpdate = { sectionIndex: number; blocks: TextBlock[] }
type TranslationItem = { block: TextBlock, index: number, text: string, tableCell?: { rowIndex: number, cellIndex: number } }
type TableCellTranslations = Map<string, string>
type BlockTranslation = string | { tableCells: TableCellTranslations }
type ProfessionalPipelinePhase = 'idle' | 'starting' | 'running' | 'ready' | 'done' | 'cancelled' | 'error'
type BackendChunk = {
    id: string
    chapterIndex: number
    chunkIndex: number
    title?: string | null
    content: string
    translation?: string | null
    status: string
}
type BackendJob = {
    id: string
    bookId: string
    status: string
    stage: string
    progress: number
    completedChunks: number
    totalChunks: number
    errorMessage?: string | null
}
type BackendChunkStat = {
    status: string
    _count: { status: number }
}
type BackendJobSnapshot = {
    job: BackendJob
    chunkStats: BackendChunkStat[]
}
type BackendSectionTranslation = {
    chunks: BackendChunk[]
    signature: string
}
type TranslationBook = Book & {
    refreshTranslatedTOC?: () => void
    requestBlockTranslations?: (sectionIndex: number, blockIds: readonly string[]) => void
    readonly translationPrefetchPageCount?: number
    readonly professionalTranslationStatus?: ProfessionalTranslationStatus
}

export type TranslationTermCategory = 'term' | 'person' | 'organization' | 'place' | 'concept' | 'abbreviation'

export interface TranslationTerm {
    source: string
    target?: string
    category: TranslationTermCategory
    note?: string
}

export interface TranslationChapterSummary {
    sectionIndex: number
    title: string
    summary: string
}

export interface ProfessionalTranslationProfile {
    bookType: string
    audience: string
    styleGuide: string
    terminologyRules: string[]
    properNounRules: string[]
    terms: TranslationTerm[]
    chapterSummaries: TranslationChapterSummary[]
}

export interface ProfessionalBookAnalysis {
    title?: string
    authors: string[]
    language?: string
    toc: Array<{ label: string, depth: number }>
    chapters: Array<{
        sectionIndex: number
        title: string
        structures: Array<'table' | 'code' | 'formula' | 'footnote'>
        sample: string
    }>
    structureSamples: {
        tables: string[]
        codeBlocks: string[]
        formulas: string[]
        footnotes: string[]
    }
}

export interface ProfessionalTranslationStatus {
    phase: ProfessionalPipelinePhase
    message: string
    bookId?: string
    jobId?: string
    stage?: string
    progress?: number
    completedChunks?: number
    totalChunks?: number
    chunkStats?: BackendChunkStat[]
    error?: unknown
}

export interface ProfessionalTranslationPipelineOptions {
    /** Optional book type hint, e.g. "computer science textbook". */
    bookType?: string
    /** Optional target reader hint. */
    audience?: string
    /** Optional preferred translation style. */
    style?: string
    /** Maximum translation review/refine loops per chunk. Defaults to the backend setting. */
    maxReviewLoops?: number
}

export interface BackendProfessionalTranslationOptions {
    /** Base URL of rebook-service, e.g. "http://127.0.0.1:8083". */
    serviceBaseUrl: string
    /** Server-side rebook-service book id. The book must already be uploaded/imported there. */
    bookId: string
    /** Existing job id to attach to. When omitted and autoStart is true, the plugin starts one. */
    jobId?: string
    /** Target language sent when starting a new backend job. Defaults to zh-CN. */
    targetLanguage?: string
    /** Optional source language sent when starting a new backend job. */
    sourceLanguage?: string
    /** Display mode. Defaults to bilingual. */
    mode?: ValueOrGetter<TranslationMode>
    /** Number of pages ahead for renderer-driven backend status/chunk refreshes. Defaults to 2. */
    prefetchPages?: ValueOrGetter<number>
    /** Start a backend expert translation job when jobId is not supplied. Defaults to true. */
    autoStart?: boolean
    /** Poll interval for backend job/chunk refresh. Defaults to 2000ms. */
    pollIntervalMs?: number
    /** Extra fetch init options, useful for credentials or headers. */
    requestInit?: RequestInit
    /** Optional fetch implementation for non-browser runtimes. */
    fetcher?: typeof fetch
    /** Backend expert translation hints. */
    pipeline?: ProfessionalTranslationPipelineOptions
    /** Called when backend translation status changes. */
    onStatus?: (status: ProfessionalTranslationStatus) => void
    /**
     * Called when backend translated chunks have updated a section.
     * Readers can use this to refresh the current section.
     */
    onUpdate?: (event: TranslationUpdate) => void
}

class TranslationFormatError extends Error {
    readonly translations?: Array<string | null>
    readonly untranslatedTexts: string[]

    constructor(message: string, options: { translations?: Array<string | null>, untranslatedTexts?: string[] } = {}) {
        super(message)
        this.name = 'TranslationFormatError'
        this.translations = options.translations
        this.untranslatedTexts = options.untranslatedTexts ?? []
    }
}

export interface TranslationOptions {
    /** The language model to use for translation (from @ai-sdk/...) */
    model: LanguageModel
    /** Target language (default: 'zh-CN') */
    targetLanguage?: string
    /**
     * Display mode:
     * - 'replace': Replace original text with translated text
     * - 'bilingual': Show original text followed by translated text
     * Default: 'bilingual'
     */
    mode?: ValueOrGetter<TranslationMode>
    /** Translate table of contents labels. Defaults to false. */
    translateTOC?: ValueOrGetter<boolean>
    /** Max concurrency for translation requests (default: 2) */
    concurrency?: number
    /**
     * Approximate maximum tokens (or characters) per translation batch.
     * The plugin will group as many blocks as possible until this limit is reached.
     * (default: 2000)
     */
    tokensPerBatch?: number
    /** Number of pages ahead for renderer-driven block prefetching. Defaults to 2. */
    prefetchPages?: ValueOrGetter<number>
    /**
     * Called when a background translation has updated a section.
     * Readers can use this to refresh the current section without blocking
     * initial rendering on the translation request.
     */
    onUpdate?: (event: TranslationUpdate) => void
    /** Called when table of contents labels have been translated. */
    onTOCUpdate?: (toc: Book['toc']) => void
}

/**
 * A professional translation plugin backed by rebook-service.
 *
 * Expert translation no longer runs in-process. The server owns the LangGraph
 * workflow, glossary, review/refine loop, persistence, and progress stream.
 */
export function withProfessionalTranslation(
    options: BackendProfessionalTranslationOptions
): RebookPlugin {
    if (!options) {
        throw new Error('withProfessionalTranslation requires options.')
    }
    const {
        serviceBaseUrl,
        bookId,
        targetLanguage = 'zh-CN',
        sourceLanguage,
        mode = 'bilingual',
        prefetchPages = 2,
        autoStart = true,
        pollIntervalMs = 2000,
        requestInit,
        fetcher = globalThis.fetch?.bind(globalThis),
        pipeline,
        onStatus,
        onUpdate,
    } = options
    if (!serviceBaseUrl?.trim()) {
        throw new Error('withProfessionalTranslation requires options.serviceBaseUrl.')
    }
    if (!bookId?.trim()) {
        throw new Error('withProfessionalTranslation requires options.bookId.')
    }
    const normalizedBaseUrl = serviceBaseUrl.trim().replace(/\/+$/, '')
    const normalizedBookId = bookId.trim()

    if (!fetcher) {
        throw new Error('withProfessionalTranslation requires fetch support or options.fetcher.')
    }

    return (book: Book): Book => {
        const sectionTranslations = new Map<number, BackendSectionTranslation>()
        let professionalStatus: ProfessionalTranslationStatus = {
            phase: 'idle',
            message: 'Backend professional translation is waiting to start.',
            bookId: normalizedBookId,
            jobId: options.jobId,
        }
        let jobId = options.jobId
        let startPromise: Promise<void> | null = null
        let refreshPromise: Promise<void> | null = null
        let pollTimer: ReturnType<typeof setTimeout> | null = null
        const originalBlockPromises = new Map<number, Promise<TextBlock[]>>()

        const getMode = () => getValue(mode)
        const setProfessionalStatus = (status: ProfessionalTranslationStatus) => {
            professionalStatus = status
            onStatus?.(status)
        }
        const getOriginalBlocks = (sectionIndex: number) => {
            const section = book.sections[sectionIndex]
            const originalGetBlocks = section?.getBlocks?.bind(section)
            if (!originalGetBlocks) return Promise.resolve([] as TextBlock[])
            let promise = originalBlockPromises.get(sectionIndex)
            if (!promise) {
                promise = Promise.resolve(originalGetBlocks()).then(blocks => blocks.map(cloneTextBlock))
                originalBlockPromises.set(sectionIndex, promise)
            }
            return promise
        }
        const ensureStarted = () => {
            if (startPromise) return startPromise
            startPromise = startBackendTranslation({
                baseUrl: normalizedBaseUrl,
                bookId: normalizedBookId,
                jobId,
                autoStart,
                targetLanguage,
                sourceLanguage,
                pipeline,
                requestInit,
                fetcher,
            })
                .then(startedJobId => {
                    jobId = startedJobId
                    setProfessionalStatus({
                        phase: 'starting',
                        message: `Backend professional translation job ${jobId} is starting.`,
                        bookId: normalizedBookId,
                        jobId,
                    })
                    schedulePoll(0)
                })
                .catch(error => {
                    setProfessionalStatus({
                        phase: 'error',
                        message: error instanceof Error ? error.message : String(error),
                        bookId: normalizedBookId,
                        jobId,
                        error,
                    })
                })
            return startPromise
        }
        const refreshFromBackend = () => {
            if (!jobId) return ensureStarted()
            if (refreshPromise) return refreshPromise
            refreshPromise = Promise.all([
                fetchBackendJob(normalizedBaseUrl, jobId, requestInit, fetcher),
                fetchBackendChunks(normalizedBaseUrl, normalizedBookId, requestInit, fetcher),
            ])
                .then(async ([snapshot, chunks]) => {
                    const changedSections = updateSectionTranslations(sectionTranslations, chunks)
                    const job = snapshot.job
                    const phase = getBackendPhase(job.status)
                    setProfessionalStatus({
                        phase,
                        message: job.status === 'done'
                            ? 'Backend professional translation is complete.'
                            : job.status === 'failed'
                                ? job.errorMessage || 'Backend professional translation failed.'
                                : job.status === 'cancelled'
                                    ? job.errorMessage || 'Backend professional translation was cancelled.'
                                    : `Backend professional translation ${job.stage || job.status}.`,
                        bookId: normalizedBookId,
                        jobId,
                        stage: job.stage,
                        progress: job.progress,
                        completedChunks: job.completedChunks,
                        totalChunks: job.totalChunks,
                        chunkStats: snapshot.chunkStats,
                        error: job.status === 'failed' ? job.errorMessage : undefined,
                    })
                    for (const sectionIndex of changedSections) {
                        const blocks = await getOriginalBlocks(sectionIndex)
                        const sectionTranslation = sectionTranslations.get(sectionIndex)
                        onUpdate?.({
                            sectionIndex,
                            blocks: renderBackendTranslatedBlocks(blocks, sectionTranslation?.chunks || [], getMode()),
                        })
                    }
                    if (!isBackendJobTerminal(job.status)) schedulePoll(pollIntervalMs)
                })
                .catch(error => {
                    setProfessionalStatus({
                        phase: 'error',
                        message: error instanceof Error ? error.message : String(error),
                        bookId: normalizedBookId,
                        jobId,
                        error,
                    })
                })
                .finally(() => {
                    refreshPromise = null
                })
            return refreshPromise
        }
        const schedulePoll = (delay: number) => {
            if (pollTimer) clearTimeout(pollTimer)
            pollTimer = setTimeout(() => {
                pollTimer = null
                void refreshFromBackend()
            }, delay)
        }

        const wrappedSections = book.sections.map((section, sectionIndex) => {
            const originalGetBlocks = section.getBlocks?.bind(section)
            if (!originalGetBlocks) return section
            return {
                ...section,
                getBlocks: async () => {
                    void ensureStarted()
                    const blocks = await getOriginalBlocks(sectionIndex)
                    const sectionTranslation = sectionTranslations.get(sectionIndex)
                    return renderBackendTranslatedBlocks(blocks, sectionTranslation?.chunks || [], getMode())
                },
            }
        })

        void ensureStarted()

        const translatedBook: TranslationBook = {
            ...book,
            requestBlockTranslations(sectionIndex: number) {
                void ensureStarted()
                if (!sectionTranslations.has(sectionIndex)) void refreshFromBackend()
            },
            get translationPrefetchPageCount() {
                return getSafePageCount(prefetchPages)
            },
            get professionalTranslationStatus() {
                return professionalStatus
            },
            sections: wrappedSections,
        }

        return translatedBook
    }
}

/**
 * A plugin that translates the text blocks of a book using Vercel AI SDK.
 */
export function withTranslation(options: TranslationOptions): RebookPlugin {
    const {
        model,
        targetLanguage = 'zh-CN',
        mode = 'bilingual',
        concurrency = 2,
        tokensPerBatch = 2000,
        prefetchPages = 2,
        onUpdate,
        translateTOC = false,
        onTOCUpdate
    } = options

    return (book: Book): Book => {
        const sectionTranslators = new Map<number, (blockIds: readonly string[]) => void>()
        let translatedTOCLabels: string[] | null = null
        let tocTranslationPromise: Promise<string[] | null> | null = null

        const getMode = () => getValue(mode)
        const shouldTranslateTOC = () => getValue(translateTOC)

        const getTOC = () => renderTOCItems(book.toc, translatedTOCLabels, shouldTranslateTOC(), getMode())

        const startTOCTranslation = () => {
            if (!book.toc || !shouldTranslateTOC() || tocTranslationPromise || translatedTOCLabels) return
            tocTranslationPromise = Promise.resolve()
                .then(async () => {
                    return translateTOCLabels(book.toc!, model, targetLanguage)
                })
                .then(labels => {
                    translatedTOCLabels = labels
                    onTOCUpdate?.(getTOC())
                    return labels
                })
                .catch(err => {
                    tocTranslationPromise = null
                    throw err
                })
            tocTranslationPromise.catch(console.error)
        }

        const wrappedSections = book.sections.map((section, index) => {
            const originalGetBlocks = section.getBlocks?.bind(section)

            if (!originalGetBlocks) {
                return section
            }

            let originalBlocksPromise: Promise<TextBlock[]> | null = null
            let translatedTextByIndex = new Map<number, BlockTranslation>()
            const pendingBlockIds = new Set<string>()
            const queuedBlockIds = new Set<string>()
            const inFlightBlockIds = new Set<string>()
            let translationDrainTimer: ReturnType<typeof setTimeout> | null = null
            let translationDrainPromise: Promise<void> | null = null

            const getOriginalBlocks = () => {
                if (!originalBlocksPromise) {
                    originalBlocksPromise = Promise.resolve(originalGetBlocks()).then(blocks => blocks.map(cloneTextBlock))
                }
                return originalBlocksPromise
            }

            const scheduleTranslationDrain = () => {
                if (translationDrainTimer) clearTimeout(translationDrainTimer)
                translationDrainTimer = setTimeout(() => {
                    translationDrainTimer = null
                    void drainPendingTranslations()
                }, TRANSLATION_REQUEST_DEBOUNCE_MS)
            }

            const drainPendingTranslations = () => {
                if (translationDrainPromise) return translationDrainPromise
                translationDrainPromise = getOriginalBlocks()
                    .then(async blocks => {
                        const pendingIds = [...pendingBlockIds]
                        pendingBlockIds.clear()
                        const indexById = new Map(blocks.map((block, blockIndex) => [block.id, blockIndex]))
                        const requestedItems = pendingIds
                            .map(id => indexById.get(id))
                            .filter((blockIndex): blockIndex is number => blockIndex != null)
                            .flatMap(blockIndex => getTranslatableItemsForBlock(blocks[blockIndex], blockIndex))
                            .filter(item =>
                                !translatedTextByIndex.has(item.index)
                                && !queuedBlockIds.has(item.block.id)
                                && !inFlightBlockIds.has(item.block.id)
                            )
                            .filter(isTranslatableItem)

                        if (!requestedItems.length) return
                        for (const item of requestedItems) queuedBlockIds.add(item.block.id)

                        await translateBlockItems(requestedItems, model, targetLanguage, concurrency, tokensPerBatch, {
                            onBatchStart: batch => {
                                for (const item of batch) {
                                    queuedBlockIds.delete(item.block.id)
                                    inFlightBlockIds.add(item.block.id)
                                }
                            },
                            onBatchComplete: (translations, batch) => {
                                for (const item of batch) inFlightBlockIds.delete(item.block.id)
                                translatedTextByIndex = new Map([...translatedTextByIndex, ...translations])
                                const renderedBlocks = renderTranslatedBlocks(blocks, translatedTextByIndex, getMode())
                                onUpdate?.({ sectionIndex: index, blocks: renderedBlocks })
                            },
                            onBatchError: batch => {
                                for (const item of batch) {
                                    queuedBlockIds.delete(item.block.id)
                                    inFlightBlockIds.delete(item.block.id)
                                }
                            },
                        })
                    })
                    .catch(console.error)
                    .finally(() => {
                        translationDrainPromise = null
                        if (pendingBlockIds.size > 0) scheduleTranslationDrain()
                    })
                return translationDrainPromise
            }

            const requestTranslationsForBlocks = (blockIds: readonly string[]) => {
                void getOriginalBlocks()
                    .then(blocks => {
                        const indexById = new Map(blocks.map((block, blockIndex) => [block.id, blockIndex]))
                        let hasPending = false
                        for (const id of new Set(blockIds)) {
                            const blockIndex = indexById.get(id)
                            if (blockIndex == null) continue
                            const block = blocks[blockIndex]
                            if (
                                translatedTextByIndex.has(blockIndex)
                                || pendingBlockIds.has(id)
                                || queuedBlockIds.has(id)
                                || inFlightBlockIds.has(id)
                                || !isTranslatableBlock(block)
                            ) continue

                            pendingBlockIds.add(id)
                            hasPending = true
                        }
                        if (hasPending) scheduleTranslationDrain()
                    })
                    .catch(console.error)
            }

            sectionTranslators.set(index, requestTranslationsForBlocks)

            return {
                ...section,
                getBlocks: async () => {
                    const originalBlocks = await getOriginalBlocks()
                    const blocks = translatedTextByIndex.size > 0
                        ? renderTranslatedBlocks(originalBlocks, translatedTextByIndex, getMode())
                        : originalBlocks
                    return blocks
                }
            }
        })

        startTOCTranslation()

        const translatedBook: TranslationBook = {
            ...book,
            get toc() {
                startTOCTranslation()
                return getTOC()
            },
            refreshTranslatedTOC() {
                startTOCTranslation()
                onTOCUpdate?.(getTOC())
            },
            requestBlockTranslations(sectionIndex: number, blockIds: readonly string[]) {
                sectionTranslators.get(sectionIndex)?.(blockIds)
            },
            get translationPrefetchPageCount() {
                return getSafePageCount(prefetchPages)
            },
            sections: wrappedSections
        }

        return translatedBook
    }
}

async function translateBlockTexts(
    blocks: TextBlock[],
    model: LanguageModel,
    targetLanguage: string,
    concurrency: number,
    tokensPerBatch: number,
    onBatch?: (translations: Map<number, BlockTranslation>) => void
): Promise<Map<number, BlockTranslation>> {
    return translateBlockItems(getTranslatableItems(blocks), model, targetLanguage, concurrency, tokensPerBatch, {
        onBatchComplete: onBatch,
    })
}

async function translateBlockItems(
    translatableItems: TranslationItem[],
    model: LanguageModel,
    targetLanguage: string,
    concurrency: number,
    tokensPerBatch: number,
    callbacks: {
        onBatchStart?: (batch: TranslationItem[]) => void
        onBatchComplete?: (translations: Map<number, BlockTranslation>, batch: TranslationItem[]) => void
        onBatchError?: (batch: TranslationItem[], error: unknown) => void
    } = {},
): Promise<Map<number, BlockTranslation>> {
    const translations = new Map<number, BlockTranslation>()

    const batches: TranslationItem[][] = []
    let currentBatch: TranslationItem[] = []
    let currentBatchTokens = 0

    for (const item of translatableItems) {
        const estimatedTokens = item.text.length

        if (currentBatch.length > 0 && currentBatchTokens + estimatedTokens > tokensPerBatch) {
            batches.push(currentBatch)
            currentBatch = []
            currentBatchTokens = 0
        }

        currentBatch.push(item)
        currentBatchTokens += estimatedTokens
    }

    if (currentBatch.length > 0) {
        batches.push(currentBatch)
    }

    const active = new Set<Promise<void>>()
    let currentBatchIndex = 0

    const processBatch = async (batch: TranslationItem[]) => {
        const payload = batch.map(item => item.text)

        try {
            callbacks.onBatchStart?.(batch)
            const batchTranslations = await requestTranslations(model, targetLanguage, payload)

            for (let i = 0; i < batch.length; i++) {
                const { index } = batch[i]
                const translatedText = batchTranslations[i]
                if (translatedText) {
                    setBlockTranslation(translations, index, translatedText, batch[i].tableCell)
                }
            }
            callbacks.onBatchComplete?.(new Map(translations), batch)
        } catch (error) {
            callbacks.onBatchError?.(batch, error)
            console.error(`Batch translation failed:`, error)
        }
    }

    while (currentBatchIndex < batches.length) {
        if (active.size >= concurrency) {
            await Promise.race(active)
            continue
        }

        const batch = batches[currentBatchIndex++]
        const promise = processBatch(batch).then(() => {
            active.delete(promise)
        })
        active.add(promise)
    }

    await Promise.all(active)

    return translations
}

async function startBackendTranslation(params: {
    baseUrl: string
    bookId: string
    jobId?: string
    autoStart: boolean
    targetLanguage: string
    sourceLanguage?: string
    pipeline?: ProfessionalTranslationPipelineOptions
    requestInit?: RequestInit
    fetcher: typeof fetch
}): Promise<string> {
    if (params.jobId) return params.jobId
    if (!params.autoStart) {
        throw new Error('withProfessionalTranslation requires options.jobId when autoStart is false.')
    }
    const response = await fetchJson<{ jobId: string }>(
        `${params.baseUrl}/api/books/${encodeURIComponent(params.bookId)}/translate`,
        {
            ...params.requestInit,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(params.requestInit?.headers || {}),
            },
            body: JSON.stringify({
                targetLanguage: params.targetLanguage,
                sourceLanguage: params.sourceLanguage,
                ...params.pipeline,
            }),
        },
        params.fetcher,
    )
    if (!response.jobId) throw new Error('Backend translation did not return a jobId.')
    return response.jobId
}

function fetchBackendJob(
    baseUrl: string,
    jobId: string,
    requestInit: RequestInit | undefined,
    fetcher: typeof fetch,
): Promise<BackendJobSnapshot> {
    return fetchJson(`${baseUrl}/api/jobs/${encodeURIComponent(jobId)}`, requestInit, fetcher)
}

function fetchBackendChunks(
    baseUrl: string,
    bookId: string,
    requestInit: RequestInit | undefined,
    fetcher: typeof fetch,
): Promise<BackendChunk[]> {
    return fetchJson(`${baseUrl}/api/books/${encodeURIComponent(bookId)}/chunks`, requestInit, fetcher)
}

async function fetchJson<T>(url: string, init: RequestInit | undefined, fetcher: typeof fetch): Promise<T> {
    const response = await fetcher(url, init)
    if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(`Backend request failed (${response.status}) ${body || response.statusText}`)
    }
    return response.json() as Promise<T>
}

function updateSectionTranslations(target: Map<number, BackendSectionTranslation>, chunks: BackendChunk[]): number[] {
    const grouped = new Map<number, BackendChunk[]>()
    for (const chunk of chunks) {
        if (!chunk.translation || chunk.status !== 'done') continue
        const group = grouped.get(chunk.chapterIndex) || []
        group.push(chunk)
        grouped.set(chunk.chapterIndex, group)
    }

    const changed: number[] = []
    for (const [sectionIndex, sectionChunks] of grouped) {
        sectionChunks.sort((a, b) => a.chunkIndex - b.chunkIndex)
        const nextSignature = getBackendChunksSignature(sectionChunks)
        if (target.get(sectionIndex)?.signature === nextSignature) continue
        target.set(sectionIndex, {
            chunks: sectionChunks.map(chunk => ({ ...chunk })),
            signature: nextSignature,
        })
        changed.push(sectionIndex)
    }
    return changed
}

function getBackendChunksSignature(chunks: readonly BackendChunk[]): string {
    return chunks.map(chunk => `${chunk.id}:${chunk.status}:${chunk.translation || ''}`).join('\n\n')
}

function renderBackendTranslatedBlocks(
    originalBlocks: readonly TextBlock[],
    translatedChunks: readonly BackendChunk[],
    mode: TranslationMode,
): TextBlock[] {
    if (!translatedChunks.length) return originalBlocks.map(cloneTextBlock)
    const translatedTextByIndex = mapBackendChunksToBlockTranslations(originalBlocks, translatedChunks)
    if (translatedTextByIndex.size === 0) return originalBlocks.map(cloneTextBlock)
    return renderTranslatedBlocks(originalBlocks, translatedTextByIndex, mode)
}

function mapBackendChunksToBlockTranslations(
    blocks: readonly TextBlock[],
    translatedChunks: readonly BackendChunk[],
): Map<number, BlockTranslation> {
    const translatedParts = translatedChunks.flatMap(chunk => splitBackendTranslation(chunk.translation || ''))
    const translations = new Map<number, BlockTranslation>()
    let partIndex = 0

    for (let blockIndex = 0; blockIndex < blocks.length && partIndex < translatedParts.length; blockIndex++) {
        const block = blocks[blockIndex]
        if (!isTranslatableBlock(block)) continue
        const translatedPart = translatedParts[partIndex++]
        if (!translatedPart) continue

        if (block.type === 'table' && block.table) {
            const tableCells = mapBackendTableTranslation(block.table, translatedPart)
            if (tableCells.size > 0) translations.set(blockIndex, { tableCells })
            continue
        }

        translations.set(blockIndex, translatedPart)
    }

    return translations
}

function splitBackendTranslation(text: string): string[] {
    return text
        .split(/\n{2,}/)
        .map(part => part.trim())
        .filter(Boolean)
}

function mapBackendTableTranslation(table: TextTable, translatedText: string): TableCellTranslations {
    const translatedRows = translatedText.split(/\n+/).map(row => row.trim()).filter(Boolean)
    const tableCells: TableCellTranslations = new Map()
    for (let rowIndex = 0; rowIndex < table.rows.length && rowIndex < translatedRows.length; rowIndex++) {
        const expectedCells = table.rows[rowIndex].cells.length
        const cells = splitBackendTableRow(translatedRows[rowIndex], expectedCells)
        if (cells.length !== expectedCells) continue
        for (let cellIndex = 0; cellIndex < expectedCells; cellIndex++) {
            if (cells[cellIndex]) tableCells.set(getTableCellKey(rowIndex, cellIndex), cells[cellIndex])
        }
    }
    return tableCells
}

function splitBackendTableRow(row: string, expectedCells: number): string[] {
    if (row.includes('\t')) return row.split('\t').map(cell => cell.trim())
    const pipeCells = row.split(/\s*\|\s*/).map(cell => cell.trim()).filter(Boolean)
    if (pipeCells.length === expectedCells) return pipeCells
    return expectedCells === 1 ? [row.trim()] : []
}

function getBackendPhase(status: string): ProfessionalPipelinePhase {
    if (status === 'done') return 'done'
    if (status === 'failed') return 'error'
    if (status === 'cancelled') return 'cancelled'
    return 'running'
}

function isBackendJobTerminal(status: string): boolean {
    return status === 'done' || status === 'failed' || status === 'cancelled'
}

function isTranslatableItem(item: TranslationItem): boolean {
    return item.text.trim().length >= 2 && hasTranslatableText(item.text)
}

function isTranslatableBlock(block: TextBlock): boolean {
    return getTranslatableItemsForBlock(block, 0).length > 0
}

function hasTranslatableText(text: string): boolean {
    return /[^\p{Number}\p{Punctuation}\p{Separator}\s]/u.test(text)
}

function getTranslatableItems(blocks: readonly TextBlock[]): TranslationItem[] {
    const items: TranslationItem[] = []
    for (let i = 0; i < blocks.length; i++) {
        items.push(...getTranslatableItemsForBlock(blocks[i], i))
    }
    return items
}

function getTranslatableItemsForBlock(block: TextBlock, index: number): TranslationItem[] {
    if (['paragraph', 'heading', 'listItem', 'blockquote'].includes(block.type) && block.segments.length > 0) {
        const item = { block, index, text: block.segments.map(s => s.text).join('') }
        return isTranslatableItem(item) ? [item] : []
    }

    if (block.type !== 'table' || !block.table) return []
    const items: TranslationItem[] = []
    block.table.rows.forEach((row, rowIndex) => {
        row.cells.forEach((cell, cellIndex) => {
            const item = { block, index, text: cell.text, tableCell: { rowIndex, cellIndex } }
            if (isTranslatableItem(item)) items.push(item)
        })
    })
    return items
}

function setBlockTranslation(
    translations: Map<number, BlockTranslation>,
    index: number,
    translatedText: string,
    tableCell?: TranslationItem['tableCell'],
): void {
    if (!tableCell) {
        translations.set(index, translatedText)
        return
    }

    const existing = translations.get(index)
    const tableCells = typeof existing === 'object' && existing
        ? new Map(existing.tableCells)
        : new Map<string, string>()
    tableCells.set(getTableCellKey(tableCell.rowIndex, tableCell.cellIndex), translatedText)
    translations.set(index, { tableCells })
}

function renderTranslatedBlocks(
    blocks: readonly TextBlock[],
    translatedTextByIndex: Map<number, BlockTranslation>,
    mode: TranslationMode,
): TextBlock[] {
    const rendered: TextBlock[] = []

    for (let index = 0; index < blocks.length; index++) {
        const block = blocks[index]
        const translation = translatedTextByIndex.get(index)
        if (!translation) {
            rendered.push(cloneTextBlock(block))
            continue
        }

        if (typeof translation !== 'string') {
            const translatedBlock = translateTableBlock(block, translation.tableCells)
            if (mode === 'replace') {
                rendered.push(translatedBlock)
            } else {
                rendered.push(cloneTextBlock(block), { ...translatedBlock, id: `t${index.toString(36)}` })
            }
            continue
        }

        const translatedText = translation
        const translatedSegments: TextSegment[] = [{ text: translatedText, style: block.segments[0]?.style }]
        if (mode === 'replace') {
            rendered.push({ ...cloneTextBlock(block), segments: translatedSegments })
        } else {
            rendered.push(cloneTextBlock(block), {
                ...block,
                id: `t${index.toString(36)}`,
                segments: translatedSegments
            })
        }
    }

    return rendered
}

function cloneTextBlock(block: TextBlock): TextBlock {
    return {
        ...block,
        table: block.table ? cloneTextTable(block.table) : block.table,
        segments: block.segments.map(segment => ({ ...segment, style: segment.style ? { ...segment.style } : segment.style }))
    }
}

function translateTableBlock(block: TextBlock, tableCells: TableCellTranslations): TextBlock {
    const cloned = cloneTextBlock(block)
    if (!cloned.table) return cloned
    cloned.table = {
        ...cloned.table,
        rows: cloned.table.rows.map((row, rowIndex) => ({
            ...row,
            cells: row.cells.map((cell, cellIndex) => ({
                ...cell,
                text: tableCells.get(getTableCellKey(rowIndex, cellIndex)) ?? cell.text,
            })),
        })),
    }
    return cloned
}

function cloneTextTable(table: TextTable): TextTable {
    return {
        ...table,
        columnWeights: table.columnWeights ? [...table.columnWeights] : table.columnWeights,
        rows: table.rows.map(row => ({
            ...row,
            cells: row.cells.map(cloneTextTableCell),
        })),
    }
}

function cloneTextTableCell(cell: TextTableCell): TextTableCell {
    return {
        ...cell,
        attrs: cell.attrs ? { ...cell.attrs } : cell.attrs,
    }
}

function getTableCellKey(rowIndex: number, cellIndex: number): string {
    return `${rowIndex}:${cellIndex}`
}

async function translateTOCLabels(
    toc: NonNullable<Book['toc']>,
    model: LanguageModel,
    targetLanguage: string,
): Promise<string[]> {
    const items = flattenTOC(toc)
    const labels = items.map(item => item.label)
    if (!labels.length) return []

    const translations = await requestTranslations(model, targetLanguage, labels)
    return translations.map((translation, index) => translation ?? labels[index])
}

function renderTOCItems(
    toc: Book['toc'],
    translations: readonly string[] | null,
    enabled: boolean,
    mode: TranslationMode,
): Book['toc'] {
    if (!toc || !enabled || !translations) return toc
    let index = 0
    const mapItems = (items: NonNullable<Book['toc']>): NonNullable<Book['toc']> => items.map(item => ({
        ...item,
        label: renderTOCLabel(item.label, translations[index++] || item.label, mode),
        subitems: item.subitems ? mapItems(item.subitems) : item.subitems,
    }))

    return mapItems(toc)
}

function renderTOCLabel(original: string, translated: string, mode: TranslationMode): string {
    return mode === 'replace' ? translated : `${original} / ${translated}`
}

function flattenTOC(items: NonNullable<Book['toc']>): NonNullable<Book['toc']> {
    return items.flatMap(item => item.subitems?.length ? [item, ...flattenTOC(item.subitems)] : [item])
}

async function requestTranslations(
    model: LanguageModel,
    targetLanguage: string,
    payload: string[],
): Promise<Array<string | null>> {
    let lastError: unknown
    const entries = payload.map((text, index) => ({ key: index.toString(36), text }))
    const input = Object.fromEntries(entries.map(({ key, text }) => [key, text]))
    const schema = {
        type: 'object',
        properties: Object.fromEntries(entries.map(({ key }) => [key, { type: 'string' }])),
        required: entries.map(({ key }) => key),
        additionalProperties: false,
    }

    for (let attempt = 1; attempt <= MAX_TRANSLATION_ATTEMPTS; attempt++) {
        try {
            const { output } = await generateText({
                model,
                output: Output.object({
                    schema: jsonSchema<Record<string, string>>(schema),
                    description: 'Translations keyed by the same short block ids as the input.',
                }),
                system: buildTranslationSystemPrompt(targetLanguage),
                prompt: JSON.stringify(input),
            })

            if (!output || typeof output !== 'object' || Array.isArray(output)) {
                throw new TranslationFormatError('Translation output was not an object.')
            }

            const translations = entries.map(({ key }) => output[key])
            const missingKey = entries.find(({ key }, index) => typeof translations[index] !== 'string')
            if (missingKey) {
                throw new TranslationFormatError(`Translation output missed key "${missingKey.key}".`, {
                    translations: translations.map(value => typeof value === 'string' ? value : null),
                    untranslatedTexts: entries
                        .filter((_, index) => typeof translations[index] !== 'string')
                        .map(({ text }) => text),
                })
            }

            return translations
        } catch (error) {
            lastError = error
            if (attempt < MAX_TRANSLATION_ATTEMPTS && isRetryableTranslationError(error)) {
                console.warn('Translation output format was invalid; retrying once.', error)
                continue
            }
            if (error instanceof TranslationFormatError) {
                console.warn('Translation output format was invalid; leaving untranslated text unchanged.', {
                    error,
                    untranslatedTexts: error.untranslatedTexts.length > 0 ? error.untranslatedTexts : payload,
                })
                return error.translations ?? payload.map(() => null)
            }
            throw error
        }
    }

    throw lastError
}

function isRetryableTranslationError(error: unknown): boolean {
    if (error instanceof TranslationFormatError) return true
    if (!error || typeof error !== 'object') return false
    const name = 'name' in error ? String(error.name) : ''
    return name === 'AI_NoObjectGeneratedError' || name === 'NoObjectGeneratedError'
}

function buildTranslationSystemPrompt(
    targetLanguage: string,
): string {
    return `You are a professional translator. Translate each value into ${targetLanguage}. Preserve the original tone and style. Keep the exact same keys.`
}

function getValue<T>(value: ValueOrGetter<T>): T {
    return typeof value === 'function' ? (value as () => T)() : value
}

function getSafePageCount(value: ValueOrGetter<number>): number {
    const pageCount = getValue(value)
    return Number.isFinite(pageCount) ? Math.max(0, Math.floor(pageCount)) : 0
}
