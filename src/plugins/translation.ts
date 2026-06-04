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
type ProfessionalPipelinePhase = 'idle' | 'analyzing' | 'ready' | 'error'
type TranslationBook = Book & {
    refreshTranslatedTOC?: () => void
    requestBlockTranslations?: (sectionIndex: number, blockIds: readonly string[]) => void
    readonly translationPrefetchPageCount?: number
    readonly professionalTranslationStatus?: ProfessionalTranslationStatus
}
type NormalizedProfessionalTranslationPipelineOptions = {
    enabled: () => boolean
    bookType?: string
    audience?: string
    style?: string
    sectionSampleChars: number
    onStatus?: (status: ProfessionalTranslationStatus) => void
}
type ProfessionalTranslationContext = {
    profile: ProfessionalTranslationProfile
    currentChapter: TranslationChapterSummary | null
    previousChapter: TranslationChapterSummary | null
    nextChapter: TranslationChapterSummary | null
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
    analysis?: ProfessionalBookAnalysis
    profile?: ProfessionalTranslationProfile
    error?: unknown
}

export interface ProfessionalTranslationPipelineOptions {
    /** Enable the professional pipeline. Defaults to true when this object is supplied. */
    enabled?: ValueOrGetter<boolean>
    /** Optional book type hint, e.g. "computer science textbook". */
    bookType?: string
    /** Optional target reader hint. */
    audience?: string
    /** Optional preferred translation style. */
    style?: string
    /** Maximum characters sampled per section during whole-book analysis. Defaults to 1200. */
    sectionSampleChars?: number
    /** Called when analysis/profile generation status changes. */
    onStatus?: (status: ProfessionalTranslationStatus) => void
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
     * Enable the professional translation pipeline:
     * whole-book analysis -> terminology/profile generation -> contextual chapter translation.
     */
    pipeline?: ValueOrGetter<boolean> | ProfessionalTranslationPipelineOptions
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
 * A professional translation plugin preset.
 *
 * It keeps the same lazy block translation behavior as `withTranslation`, while
 * adding a whole-book analysis pass, terminology extraction, translation
 * strategy generation, and chapter-aware prompts before any translated batch.
 */
export function withProfessionalTranslation(
    options: Omit<TranslationOptions, 'pipeline'> & { pipeline?: ProfessionalTranslationPipelineOptions | ValueOrGetter<boolean> }
): RebookPlugin {
    return withTranslation({
        ...options,
        pipeline: options.pipeline ?? true,
    })
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
    const pipelineOptions = normalizePipelineOptions(options.pipeline)

    return (book: Book): Book => {
        const sectionTranslators = new Map<number, (blockIds: readonly string[]) => void>()
        let translatedTOCLabels: string[] | null = null
        let tocTranslationPromise: Promise<string[] | null> | null = null
        let professionalStatus: ProfessionalTranslationStatus = {
            phase: 'idle',
            message: pipelineOptions.enabled() ? 'Professional translation analysis is waiting to start.' : 'Professional translation pipeline disabled.',
        }
        let professionalProfilePromise: Promise<ProfessionalTranslationProfile | null> | null = null

        const getMode = () => getValue(mode)
        const shouldTranslateTOC = () => getValue(translateTOC)
        const shouldUsePipeline = () => pipelineOptions.enabled()

        const getTOC = () => renderTOCItems(book.toc, translatedTOCLabels, shouldTranslateTOC(), getMode())
        const setProfessionalStatus = (status: ProfessionalTranslationStatus) => {
            professionalStatus = status
            pipelineOptions.onStatus?.(status)
        }

        const startProfessionalPipeline = () => {
            if (!shouldUsePipeline()) return Promise.resolve(null)
            if (professionalProfilePromise) return professionalProfilePromise

            setProfessionalStatus({
                phase: 'analyzing',
                message: 'Analyzing the whole book for chapters, terminology, names, tables, code, formulas, and notes.',
            })
            professionalProfilePromise = buildProfessionalTranslationProfile(book, model, targetLanguage, pipelineOptions)
                .then(({ analysis, profile }) => {
                    setProfessionalStatus({
                        phase: 'ready',
                        message: `Professional translation profile ready: ${profile.terms.length} terms, ${profile.chapterSummaries.length} chapter summaries.`,
                        analysis,
                        profile,
                    })
                    return profile
                })
                .catch(error => {
                    const message = error instanceof Error ? error.message : String(error)
                    setProfessionalStatus({
                        phase: 'error',
                        message: `Professional translation analysis failed; falling back to basic translation. ${message}`,
                        error,
                    })
                    console.error('Professional translation analysis failed:', error)
                    return null
                })

            return professionalProfilePromise
        }

        const getProfessionalContext = async (sectionIndex: number): Promise<ProfessionalTranslationContext | null> => {
            if (!shouldUsePipeline()) return null
            const profile = await startProfessionalPipeline()
            if (!profile) return null
            return {
                profile,
                currentChapter: profile.chapterSummaries.find(summary => summary.sectionIndex === sectionIndex) ?? null,
                previousChapter: [...profile.chapterSummaries].reverse().find(summary => summary.sectionIndex < sectionIndex) ?? null,
                nextChapter: profile.chapterSummaries.find(summary => summary.sectionIndex > sectionIndex) ?? null,
            }
        }

        const startTOCTranslation = () => {
            if (!book.toc || !shouldTranslateTOC() || tocTranslationPromise || translatedTOCLabels) return
            tocTranslationPromise = Promise.resolve()
                .then(async () => {
                    if (shouldUsePipeline()) await startProfessionalPipeline()
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

                        const professionalContext = await getProfessionalContext(index)
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
                        }, professionalContext)
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
        void startProfessionalPipeline()

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
            get professionalTranslationStatus() {
                return professionalStatus
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
    context?: ProfessionalTranslationContext | null,
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
            const batchTranslations = await requestTranslations(model, targetLanguage, payload, context)

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
    context: ProfessionalTranslationContext | null = null,
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
                system: buildTranslationSystemPrompt(targetLanguage, context),
                prompt: context
                    ? JSON.stringify({ context: serializeProfessionalContext(context), input })
                    : JSON.stringify(input),
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

function normalizePipelineOptions(
    pipeline: TranslationOptions['pipeline']
): NormalizedProfessionalTranslationPipelineOptions {
    const defaultSampleChars = 1200

    if (pipeline === undefined) {
        return {
            enabled: () => false,
            sectionSampleChars: defaultSampleChars,
        }
    }

    if (typeof pipeline === 'boolean' || typeof pipeline === 'function') {
        return {
            enabled: () => Boolean(getValue(pipeline)),
            sectionSampleChars: defaultSampleChars,
        }
    }

    return {
        enabled: () => pipeline.enabled === undefined ? true : Boolean(getValue(pipeline.enabled)),
        bookType: pipeline.bookType,
        audience: pipeline.audience,
        style: pipeline.style,
        sectionSampleChars: getPositiveInteger(pipeline.sectionSampleChars, defaultSampleChars),
        onStatus: pipeline.onStatus,
    }
}

async function buildProfessionalTranslationProfile(
    book: Book,
    model: LanguageModel,
    targetLanguage: string,
    options: NormalizedProfessionalTranslationPipelineOptions,
): Promise<{ analysis: ProfessionalBookAnalysis, profile: ProfessionalTranslationProfile }> {
    const analysis = await analyzeBookForTranslation(book, options)
    try {
        const profile = await requestProfessionalTranslationProfile(model, targetLanguage, analysis, options)
        return { analysis, profile }
    } catch (error) {
        console.warn('Professional translation profile generation failed; using heuristic profile.', error)
        return { analysis, profile: createHeuristicProfessionalProfile(analysis, targetLanguage, options) }
    }
}

async function analyzeBookForTranslation(
    book: Book,
    options: NormalizedProfessionalTranslationPipelineOptions,
): Promise<ProfessionalBookAnalysis> {
    const tocEntries = flattenTOCEntries(book.toc ?? [])
    const titleBySection = getSectionTitles(book, tocEntries)
    const chapters: ProfessionalBookAnalysis['chapters'] = []
    const structureSamples: ProfessionalBookAnalysis['structureSamples'] = {
        tables: [],
        codeBlocks: [],
        formulas: [],
        footnotes: [],
    }

    for (let sectionIndex = 0; sectionIndex < book.sections.length; sectionIndex++) {
        const section = book.sections[sectionIndex]
        const blocks = section.getBlocks ? await Promise.resolve(section.getBlocks()).catch(error => {
            console.warn(`Unable to analyze section ${sectionIndex} for translation.`, error)
            return [] as TextBlock[]
        }) : []
        const structures = new Set<ProfessionalBookAnalysis['chapters'][number]['structures'][number]>()
        const textParts: string[] = []

        for (const block of blocks) {
            const text = getBlockPlainText(block)
            if (text) {
                textParts.push(text)
            }
            if (block.type === 'table') {
                structures.add('table')
                pushLimitedSample(structureSamples.tables, text)
            }
            if (isCodeBlock(block)) {
                structures.add('code')
                pushLimitedSample(structureSamples.codeBlocks, text)
            }
            if (isFormulaBlock(block)) {
                structures.add('formula')
                pushLimitedSample(structureSamples.formulas, text)
            }
            if (isFootnoteBlock(block)) {
                structures.add('footnote')
                pushLimitedSample(structureSamples.footnotes, getFootnoteSample(block) || text)
            }
        }

        const title = titleBySection.get(sectionIndex)
            ?? blocks.find(block => block.type === 'heading')?.segments.map(segment => segment.text).join('').trim()
            ?? `Section ${sectionIndex + 1}`
        chapters.push({
            sectionIndex,
            title,
            structures: [...structures],
            sample: truncateText(textParts.join('\n'), options.sectionSampleChars),
        })
    }

    return {
        title: formatLanguageMap(book.metadata?.title),
        authors: formatContributors(book.metadata?.author),
        language: Array.isArray(book.metadata?.language) ? book.metadata?.language.join(', ') : book.metadata?.language,
        toc: tocEntries.map(({ label, depth }) => ({ label, depth })),
        chapters,
        structureSamples,
    }
}

function getProfilePromptAnalysis(analysis: ProfessionalBookAnalysis) {
    return {
        title: analysis.title,
        authors: analysis.authors,
        language: analysis.language,
        toc: analysis.toc.slice(0, 120),
        chapters: analysis.chapters.map(chapter => ({
            sectionIndex: chapter.sectionIndex,
            title: chapter.title,
            sample: chapter.sample,
        })),
    }
}

async function requestProfessionalTranslationProfile(
    model: LanguageModel,
    targetLanguage: string,
    analysis: ProfessionalBookAnalysis,
    options: NormalizedProfessionalTranslationPipelineOptions,
): Promise<ProfessionalTranslationProfile> {
    const schema = {
        type: 'object',
        properties: {
            bookType: { type: 'string' },
            audience: { type: 'string' },
            styleGuide: { type: 'string' },
            terminologyRules: { type: 'array', items: { type: 'string' } },
            properNounRules: { type: 'array', items: { type: 'string' } },
            terms: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        source: { type: 'string' },
                        target: { type: 'string' },
                        category: { type: 'string' },
                        note: { type: 'string' },
                    },
                    required: ['source', 'category'],
                    additionalProperties: false,
                },
            },
            chapterSummaries: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        sectionIndex: { type: 'number' },
                        title: { type: 'string' },
                        summary: { type: 'string' },
                    },
                    required: ['sectionIndex', 'title', 'summary'],
                    additionalProperties: false,
                },
            },
        },
        required: ['bookType', 'audience', 'styleGuide', 'terminologyRules', 'properNounRules', 'terms', 'chapterSummaries'],
        additionalProperties: false,
    }
    const prompt = {
        targetLanguage,
        hints: {
            bookType: options.bookType,
            audience: options.audience,
            style: options.style,
        },
        analysis: getProfilePromptAnalysis(analysis),
    }
    const { output } = await generateText({
        model,
        output: Output.object({
            schema: jsonSchema<ProfessionalTranslationProfile>(schema),
            description: 'Professional translation profile with strategy, glossary, and chapter summaries.',
        }),
        system: [
            'You are a senior translation editor designing a professional book translation pipeline.',
            `Target language: ${targetLanguage}.`,
            'Infer the book type, target reader, style guide, terminology rules, proper-noun rules, glossary entries, and concise chapter summaries.',
            'Keep glossary source terms exact. Provide target terms when confident; otherwise leave target empty.',
        ].join('\n'),
        prompt: JSON.stringify(prompt),
    })

    return normalizeProfessionalProfile(output, analysis, targetLanguage, options)
}

function createHeuristicProfessionalProfile(
    analysis: ProfessionalBookAnalysis,
    targetLanguage: string,
    options: NormalizedProfessionalTranslationPipelineOptions,
): ProfessionalTranslationProfile {
    return {
        bookType: options.bookType ?? 'book',
        audience: options.audience ?? 'General readers of the original book topic.',
        styleGuide: options.style ?? `Translate into ${targetLanguage} with clear, faithful, publication-quality prose.`,
        terminologyRules: [
            'Keep recurring technical terms consistent across chapters.',
            'Prefer established translations for domain terms; keep the original in parentheses when ambiguity is high.',
        ],
        properNounRules: [
            'Preserve personal names, place names, organization names, and abbreviations unless a widely accepted localized form exists.',
            'Do not translate code identifiers, file names, URLs, or mathematical notation.',
        ],
        terms: [],
        chapterSummaries: analysis.chapters.map(chapter => ({
            sectionIndex: chapter.sectionIndex,
            title: chapter.title,
            summary: summarizeChapterHeuristically(chapter),
        })),
    }
}

function normalizeProfessionalProfile(
    output: unknown,
    analysis: ProfessionalBookAnalysis,
    targetLanguage: string,
    options: NormalizedProfessionalTranslationPipelineOptions,
): ProfessionalTranslationProfile {
    if (!output || typeof output !== 'object' || Array.isArray(output)) {
        throw new TranslationFormatError('Professional translation profile output was not an object.')
    }
    const value = output as Record<string, unknown>
    return {
        bookType: stringOrFallback(value.bookType, options.bookType ?? 'book'),
        audience: stringOrFallback(value.audience, options.audience ?? 'General readers of the original book topic.'),
        styleGuide: stringOrFallback(value.styleGuide, options.style ?? `Translate into ${targetLanguage} with clear, faithful prose.`),
        terminologyRules: stringArrayOrFallback(value.terminologyRules, [
            'Keep recurring technical terms consistent across chapters.',
        ]),
        properNounRules: stringArrayOrFallback(value.properNounRules, [
            'Preserve proper nouns unless a standard localized form exists.',
        ]),
        terms: normalizeTerms(value.terms, []),
        chapterSummaries: normalizeChapterSummaries(value.chapterSummaries, analysis),
    }
}

function buildTranslationSystemPrompt(
    targetLanguage: string,
    context: ProfessionalTranslationContext | null,
): string {
    if (!context) {
        return `You are a professional translator. Translate each value into ${targetLanguage}. Preserve the original tone and style. Keep the exact same keys.`
    }
    return [
        'You are a professional book translator working inside a multi-stage translation pipeline.',
        `Translate each input value into ${targetLanguage}. Keep the exact same keys.`,
        'Follow the provided book profile, glossary, terminology rules, proper-noun rules, and chapter context.',
        'Preserve code identifiers, formulas, URLs, citations, footnote markers, table structure, and numbers unless translation is required around them.',
        'Maintain consistency with previous and next chapter summaries. Do not add commentary outside the JSON object.',
    ].join('\n')
}

function serializeProfessionalContext(context: ProfessionalTranslationContext) {
    return {
        bookType: context.profile.bookType,
        audience: context.profile.audience,
        styleGuide: context.profile.styleGuide,
        terminologyRules: context.profile.terminologyRules,
        properNounRules: context.profile.properNounRules,
        glossary: context.profile.terms.slice(0, 120),
        chapter: context.currentChapter,
        previousChapter: context.previousChapter,
        nextChapter: context.nextChapter,
    }
}

function getPositiveInteger(value: number | undefined, fallback: number): number {
    return Number.isFinite(value) && value !== undefined ? Math.max(1, Math.floor(value)) : fallback
}

function flattenTOCEntries(
    items: readonly NonNullable<Book['toc']>[number][],
    depth = 0,
): Array<{ label: string, href: string, depth: number }> {
    return items.flatMap(item => [
        { label: item.label, href: item.href, depth },
        ...flattenTOCEntries(item.subitems ?? [], depth + 1),
    ])
}

function getSectionTitles(
    book: Book,
    toc: Array<{ label: string, href: string, depth: number }>,
): Map<number, string> {
    const titles = new Map<number, string>()
    for (const item of toc) {
        const resolved = book.resolveHref?.(item.href)
        const index = resolved && typeof resolved.index === 'number' ? resolved.index : null
        if (index != null && !titles.has(index)) {
            titles.set(index, item.label)
        }
    }
    return titles
}

function getBlockPlainText(block: TextBlock): string {
    if (block.type === 'table' && block.table) {
        return block.table.rows
            .flatMap(row => row.cells.map(cell => cell.text))
            .join('\n')
            .trim()
    }
    return block.segments.map(segment => segment.text).join('').trim()
}

function isCodeBlock(block: TextBlock): boolean {
    if (block.type === 'pre') return true
    const attrs = flattenAttrs(block)
    return hasAttrToken(attrs, /(^|\b)(code|source|programlisting|preformatted)(\b|$)/i)
        || block.segments.some(segment => {
            const nodeType = segment.source?.nodeType
            return nodeType === 'code' || nodeType === 'kbd' || nodeType === 'samp' || nodeType === 'tt'
        })
}

function isFormulaBlock(block: TextBlock): boolean {
    const text = getBlockPlainText(block)
    const attrs = flattenAttrs(block)
    return hasAttrToken(attrs, /(^|\b)(math|formula|equation|tex|latex)(\b|$)/i)
        || block.segments.some(segment => segment.source?.nodeType === 'math')
        || /\\(?:frac|sum|int|sqrt|begin\{)|[∑∫√≈≤≥]/.test(text)
}

function isFootnoteBlock(block: TextBlock): boolean {
    const attrs = flattenAttrs(block)
    return Boolean(block.attrs?.['data-rebook-footnote-content'])
        || hasAttrToken(attrs, /(^|\b)(footnote|note-ref|noteref|epub-footnote)(\b|$)/i)
        || block.segments.some(segment => {
            const sourceAttrs = segment.source?.attrs
            return Boolean(sourceAttrs?.['data-rebook-footnote-content'])
                || hasAttrToken(flattenRecord(sourceAttrs), /(^|\b)(footnote|note-ref|noteref|epub-footnote)(\b|$)/i)
        })
}

function getFootnoteSample(block: TextBlock): string {
    return block.attrs?.['data-rebook-footnote-content']
        ?? block.segments.map(segment => segment.source?.attrs?.['data-rebook-footnote-content']).find(Boolean)
        ?? ''
}

function pushLimitedSample(samples: string[], text: string, maxSamples = 20): void {
    const sample = truncateText(text, 240)
    if (!sample || samples.length >= maxSamples || samples.includes(sample)) return
    samples.push(sample)
}

function flattenAttrs(block: TextBlock): string {
    return flattenRecord(block.attrs)
}

function flattenRecord(record: Readonly<Record<string, string>> | undefined): string {
    return Object.entries(record ?? {})
        .map(([key, value]) => `${key} ${value}`)
        .join(' ')
}

function hasAttrToken(attrs: string, pattern: RegExp): boolean {
    return pattern.test(attrs)
}

function summarizeChapterHeuristically(chapter: ProfessionalBookAnalysis['chapters'][number]): string {
    const details = chapter.structures.length ? `Includes ${chapter.structures.join(', ')} content.` : 'Text section.'
    const sample = truncateText(chapter.sample.replace(/\s+/g, ' '), 220)
    return `${chapter.title}: ${details} ${sample}`.trim()
}

function normalizeTerms(value: unknown, fallback: TranslationTerm[]): TranslationTerm[] {
    if (!Array.isArray(value)) return fallback
    const terms: TranslationTerm[] = []
    for (const item of value) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue
        const record = item as Record<string, unknown>
        const source = typeof record.source === 'string' ? record.source.trim() : ''
        if (!source) continue
        terms.push({
            source,
            target: typeof record.target === 'string' ? record.target.trim() : undefined,
            category: normalizeTermCategory(record.category),
            note: typeof record.note === 'string' ? record.note.trim() : undefined,
        })
    }
    return terms.length ? terms : fallback
}

function normalizeTermCategory(value: unknown): TranslationTermCategory {
    const category = typeof value === 'string' ? value : ''
    return category === 'person'
        || category === 'organization'
        || category === 'place'
        || category === 'concept'
        || category === 'abbreviation'
        || category === 'term'
        ? category
        : 'term'
}

function normalizeChapterSummaries(
    value: unknown,
    analysis: ProfessionalBookAnalysis,
): TranslationChapterSummary[] {
    if (!Array.isArray(value)) {
        return analysis.chapters.map(chapter => ({
            sectionIndex: chapter.sectionIndex,
            title: chapter.title,
            summary: summarizeChapterHeuristically(chapter),
        }))
    }

    const summaries = value
        .map(item => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) return null
            const record = item as Record<string, unknown>
            const sectionIndex = typeof record.sectionIndex === 'number' ? Math.floor(record.sectionIndex) : null
            const title = typeof record.title === 'string' ? record.title : ''
            const summary = typeof record.summary === 'string' ? record.summary : ''
            if (sectionIndex == null || !title || !summary) return null
            return { sectionIndex, title, summary }
        })
        .filter((item): item is TranslationChapterSummary => Boolean(item))

    return summaries.length ? summaries : normalizeChapterSummaries(null, analysis)
}

function stringOrFallback(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function stringArrayOrFallback(value: unknown, fallback: string[]): string[] {
    if (!Array.isArray(value)) return fallback
    const strings = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    return strings.length ? strings : fallback
}

function formatLanguageMap(value: unknown): string | undefined {
    if (!value) return undefined
    if (typeof value === 'string') return value
    if (typeof value !== 'object' || Array.isArray(value)) return undefined
    const record = value as Record<string, unknown>
    const first = Object.values(record).find(item => typeof item === 'string')
    return typeof first === 'string' ? first : undefined
}

function formatContributors(value: unknown): string[] {
    if (!value) return []
    if (Array.isArray(value)) return value.flatMap(formatContributors)
    if (typeof value === 'string') return [value]
    if (typeof value !== 'object') return []
    const name = (value as { name?: unknown }).name
    const formatted = formatLanguageMap(name)
    return formatted ? [formatted] : []
}

function truncateText(text: string, maxChars: number): string {
    const normalized = text.replace(/\s+/g, ' ').trim()
    if (normalized.length <= maxChars) return normalized
    return `${normalized.slice(0, Math.max(0, maxChars - 3)).trim()}...`
}

function getValue<T>(value: ValueOrGetter<T>): T {
    return typeof value === 'function' ? (value as () => T)() : value
}

function getSafePageCount(value: ValueOrGetter<number>): number {
    const pageCount = getValue(value)
    return Number.isFinite(pageCount) ? Math.max(0, Math.floor(pageCount)) : 0
}
