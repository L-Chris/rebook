import type { Book, RelocateEvent, RebookPlugin, Section, TOCItem } from '../core/types'

export interface TrialLimitOptions {
    maxPages?: number
    epsilon?: number
    sampleSections?: number
    sampleMaxBytes?: number
    bytesPerEstimatedTextUnit?: number
    estimatedTextUnitsPerPage?: number
    viewport?: {
        width?: number
        height?: number
        margin?: number
    }
    typography?: {
        fontSize?: number
        lineHeight?: number
        fillRatio?: number
    }
}

export interface TrialLimitState {
    maxPages: number
    estimatedPageCount: number
    limitFraction: number
    pageStepFraction: number
    estimatedBy: 'page-list' | 'pre-paginated-sections' | 'sampled-text' | 'section-size'
}

export interface TrialSnapshotLike {
    sectionIndex: number
    sectionCount: number
    pageIndex: number
    pageCount: number
    fraction: number
}

export interface TrialTOCAccessItem {
    item: TOCItem
    key: string
    index: number
    label: string
    href: string
    depth: number
    parentHrefs: string[]
    hasChildren: boolean
    sectionIndex: number
    sectionFraction: number
    disabled: boolean
}

export interface TrialLimitController {
    readonly state: TrialLimitState
    getTotalFraction(
        location: Pick<RelocateEvent, 'index' | 'fraction' | 'totalFraction'> | null | undefined,
        sectionFractions: readonly number[],
    ): number
    getTargetFraction(target: string | number, sectionFractions: readonly number[]): number
    canGoTo(target: string | number, sectionFractions: readonly number[]): boolean
    getTOCItems(sectionFractions: readonly number[], items?: readonly TOCItem[]): TrialTOCAccessItem[]
    getAllowedTOCHrefs(sectionFractions: readonly number[]): string[]
    getCurrentTOCItem(
        items: readonly TrialTOCAccessItem[],
        location: Pick<RelocateEvent, 'index' | 'tocItem'> | null | undefined,
    ): TrialTOCAccessItem | null
    getNextTotalFraction(snapshot: TrialSnapshotLike, sectionFractions: readonly number[]): number
    canGoNext(
        location: Pick<RelocateEvent, 'index' | 'fraction' | 'totalFraction'> | null | undefined,
        sectionFractions: readonly number[],
    ): boolean
}

export type TrialLimitedBook = Book & {
    trialLimit: TrialLimitController
}

const DEFAULT_EPSILON = 0.0001
const DEFAULT_BYTES_PER_TEXT_UNIT = 2.4
const DEFAULT_SAMPLE_SECTIONS = 4
const DEFAULT_SAMPLE_MAX_BYTES = 96_000

export function withTrialLimit(options: TrialLimitOptions = {}): RebookPlugin {
    return async (book: Book): Promise<TrialLimitedBook> => {
        const state = await estimateTrialLimitState(book, options)
        const trialLimit = createTrialLimitController(book, state, options)
        return Object.assign(book, { trialLimit })
    }
}

export async function estimateTrialLimitState(
    book: Book,
    options: TrialLimitOptions = {},
): Promise<TrialLimitState> {
    const maxPages = Math.max(0, Math.floor(options.maxPages ?? 0))
    const estimated = await estimateBookPageCount(book, options)
    const estimatedPageCount = Math.max(1, estimated.pageCount)
    const limitFraction = maxPages > 0
        ? clamp01(maxPages / Math.max(estimatedPageCount, maxPages))
        : 1

    return {
        maxPages,
        estimatedPageCount,
        limitFraction,
        pageStepFraction: maxPages > 0 ? limitFraction / maxPages : 0,
        estimatedBy: estimated.estimatedBy,
    }
}

export async function estimateBookPageCount(
    book: Book,
    options: TrialLimitOptions = {},
): Promise<{ pageCount: number; estimatedBy: TrialLimitState['estimatedBy'] }> {
    const pageListCount = book.pageList?.length ?? 0
    if (pageListCount > 0) {
        return { pageCount: pageListCount, estimatedBy: 'page-list' }
    }

    const linearSections = getLinearSections(book)
    if (book.rendition?.layout === 'pre-paginated') {
        return {
            pageCount: Math.max(1, linearSections.length || book.sections.length),
            estimatedBy: 'pre-paginated-sections',
        }
    }

    const totalSize = getTotalSectionSize(linearSections)
    const sampled = await sampleTextDensity(linearSections, options)
    const textUnitsPerPage = options.estimatedTextUnitsPerPage ?? estimateTextUnitsPerPage(options)
    if (sampled.textUnits > 0 && sampled.bytes > 0 && totalSize > 0) {
        return {
            pageCount: Math.ceil((totalSize * (sampled.textUnits / sampled.bytes)) / textUnitsPerPage),
            estimatedBy: 'sampled-text',
        }
    }

    const bytesPerTextUnit = options.bytesPerEstimatedTextUnit ?? DEFAULT_BYTES_PER_TEXT_UNIT
    return {
        pageCount: Math.ceil((totalSize / bytesPerTextUnit) / textUnitsPerPage),
        estimatedBy: 'section-size',
    }
}

function createTrialLimitController(
    book: Book,
    state: TrialLimitState,
    options: TrialLimitOptions,
): TrialLimitController {
    const epsilon = options.epsilon ?? DEFAULT_EPSILON

    return {
        state,
        getTotalFraction(location, sectionFractions) {
            return getTotalFraction(location, sectionFractions)
        },
        getTargetFraction(target, sectionFractions) {
            return getTargetFraction(book, target, sectionFractions)
        },
        canGoTo(target, sectionFractions) {
            return getTargetFraction(book, target, sectionFractions) <= state.limitFraction + epsilon
        },
        getTOCItems(sectionFractions, items = book.toc || []) {
            return getTrialTOCItems(book, sectionFractions, state.limitFraction, epsilon, items)
        },
        getAllowedTOCHrefs(sectionFractions) {
            return this.getTOCItems(sectionFractions)
                .filter(item => !item.disabled)
                .map(item => normalizeNavigationHref(item.href))
        },
        getCurrentTOCItem(items, location) {
            return getCurrentTrialTOCItem(items, location)
        },
        getNextTotalFraction(snapshot, sectionFractions) {
            return getNextTotalFraction(snapshot, sectionFractions)
        },
        canGoNext(location, sectionFractions) {
            return getTotalFraction(location, sectionFractions) + state.pageStepFraction <= state.limitFraction + epsilon
        },
    }
}

function normalizeTOCHref(href?: string | null): string {
    return (href || '').trim()
}

function normalizeNavigationHref(href?: string | null): string {
    return normalizeTOCHref(href).split('#')[0]
}

function normalizeBookPath(href?: string | null): string {
    const path = normalizeNavigationHref(href).replace(/\\/g, '/').replace(/^\/+/, '')
    const parts: string[] = []
    for (const part of path.split('/')) {
        if (!part || part === '.') continue
        if (part === '..') parts.pop()
        else parts.push(part)
    }
    return parts.join('/')
}

function resolveBookNavigation(book: Book, href: string): { index: number } | null {
    const resolved = book.resolveHref?.(href)
    if (typeof resolved?.index === 'number' && resolved.index >= 0) return resolved

    const normalizedHref = normalizeBookPath(href)
    if (!normalizedHref) return null

    const sectionIndex = book.sections.findIndex(section => {
        const sectionId = normalizeBookPath(String(section.id ?? ''))
        return sectionId === normalizedHref || sectionId.endsWith(`/${normalizedHref}`)
    })
    return sectionIndex >= 0 ? { index: sectionIndex } : null
}

function getTotalFraction(
    location: Pick<RelocateEvent, 'index' | 'fraction' | 'totalFraction'> | null | undefined,
    sectionFractions: readonly number[],
): number {
    if (!location || location.index < 0) return 0
    if (typeof location.totalFraction === 'number') return clamp01(location.totalFraction)

    const sectionStart = sectionFractions[location.index] ?? 0
    const nextSectionStart = sectionFractions[location.index + 1] ?? 1
    const sectionSpan = Math.max(0, nextSectionStart - sectionStart)
    return clamp01(sectionStart + sectionSpan * (location.fraction || 0))
}

function getTargetFraction(
    book: Book,
    target: string | number,
    sectionFractions: readonly number[],
): number {
    const index = typeof target === 'number'
        ? target
        : resolveBookNavigation(book, target)?.index
    if (typeof index !== 'number' || index < 0) return 0
    return sectionFractions[index] ?? 0
}

function getTrialTOCItems(
    book: Book,
    sectionFractions: readonly number[],
    limitFraction: number,
    epsilon: number,
    items: readonly TOCItem[] = book.toc || [],
    depth = 0,
): TrialTOCAccessItem[] {
    const result: TrialTOCAccessItem[] = []
    let index = 0

    const walk = (tocItems: readonly TOCItem[], currentDepth: number, parentHrefs: string[]) => {
        for (const item of tocItems) {
            const itemIndex = index++
            const sectionIndex = resolveBookNavigation(book, item.href)?.index ?? -1
            const sectionFraction = sectionIndex >= 0 ? sectionFractions[sectionIndex] ?? 0 : 0
            const disabled = sectionIndex >= 0 && sectionFraction > limitFraction + epsilon
            const hasChildren = !!item.subitems?.length
            result.push({
                item,
                key: `${currentDepth}-${itemIndex}-${item.href}`,
                index: itemIndex,
                label: item.label || 'Untitled',
                href: item.href,
                depth: currentDepth,
                parentHrefs,
                hasChildren,
                sectionIndex,
                sectionFraction,
                disabled,
            })

            if (hasChildren) {
                walk(item.subitems!, currentDepth + 1, [...parentHrefs, item.href])
            }
        }
    }

    walk(items, depth, [])
    return result
}

function getCurrentTrialTOCItem(
    items: readonly TrialTOCAccessItem[],
    location: Pick<RelocateEvent, 'index' | 'tocItem'> | null | undefined,
): TrialTOCAccessItem | null {
    if (!items.length || !location || location.index < 0) return null

    const tocHref = normalizeTOCHref(location.tocItem?.href)
    if (tocHref) {
        const exact = items.find(item => normalizeTOCHref(item.href) === tocHref)
        if (exact) return exact

        const sectionHref = normalizeNavigationHref(tocHref)
        const sectionItem = items.find(item => normalizeNavigationHref(item.href) === sectionHref)
        if (sectionItem) return sectionItem
    }

    const exact = items.find(item => item.sectionIndex === location.index)
    if (exact) return exact

    for (let index = items.length - 1; index >= 0; index--) {
        const item = items[index]
        if (item && item.sectionIndex >= 0 && item.sectionIndex < location.index) return item
    }
    return null
}

function getNextTotalFraction(
    snapshot: TrialSnapshotLike,
    sectionFractions: readonly number[],
): number {
    if (snapshot.pageIndex < snapshot.pageCount - 1) {
        return getTotalFraction({
            index: snapshot.sectionIndex,
            fraction: snapshot.pageCount > 1
                ? (snapshot.pageIndex + 1) / (snapshot.pageCount - 1)
                : 0,
        }, sectionFractions)
    }

    if (snapshot.sectionIndex < snapshot.sectionCount - 1) {
        return sectionFractions[snapshot.sectionIndex + 1] ?? 1
    }

    return 1
}

async function sampleTextDensity(
    sections: readonly Section[],
    options: TrialLimitOptions,
): Promise<{ bytes: number; textUnits: number }> {
    let remainingSections = Math.max(0, Math.floor(options.sampleSections ?? DEFAULT_SAMPLE_SECTIONS))
    const maxBytes = Math.max(0, Math.floor(options.sampleMaxBytes ?? DEFAULT_SAMPLE_MAX_BYTES))
    if (remainingSections === 0 || maxBytes === 0) return { bytes: 0, textUnits: 0 }

    let bytes = 0
    let textUnits = 0
    for (const section of sections) {
        if (bytes >= maxBytes) break
        if (section.format === 'image') continue
        const text = await loadSectionText(section)
        if (!text) continue
        const sectionSize = Math.max(0, section.size || utf8ByteLength(text))
        bytes += sectionSize
        textUnits += countTextUnits(text)
        if (textUnits > 0 && --remainingSections <= 0) break
    }
    return { bytes, textUnits }
}

async function loadSectionText(section: Section): Promise<string> {
    try {
        if (section.getBlocks) {
            const blocks = await section.getBlocks()
            return blocks.flatMap(block => block.segments).map(segment => segment.text).join('\n')
        }
        if (section.getSegments) {
            return (await section.getSegments()).map(segment => segment.text).join('\n')
        }
        if (section.loadText) return await section.loadText()
        return stripMarkup(await section.load())
    } catch {
        return ''
    }
}

function stripMarkup(value: string): string {
    return value
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function countTextUnits(text: string): number {
    let units = 0
    for (const char of text) {
        if (/\s/.test(char)) {
            units += 0.25
        } else if (/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(char)) {
            units += 1
        } else if (/[A-Za-z0-9]/.test(char)) {
            units += 0.55
        } else {
            units += 0.5
        }
    }
    return units
}

function estimateTextUnitsPerPage(options: TrialLimitOptions): number {
    const fontSize = Math.max(8, options.typography?.fontSize ?? 17)
    const lineHeight = Math.max(1, options.typography?.lineHeight ?? 1.7)
    const fillRatio = Math.max(0.4, Math.min(1, options.typography?.fillRatio ?? 0.92))
    const width = Math.max(120, options.viewport?.width ?? 390)
    const height = Math.max(160, options.viewport?.height ?? 740)
    const margin = Math.max(0, options.viewport?.margin ?? 32)
    const inlineSize = Math.max(fontSize * 8, width - margin * 2)
    const blockSize = Math.max(fontSize * lineHeight * 4, height - margin * 2)
    const unitsPerLine = inlineSize / fontSize
    const linesPerPage = blockSize / (fontSize * lineHeight)
    return Math.max(1, unitsPerLine * linesPerPage * fillRatio)
}

function getLinearSections(book: Book): Section[] {
    return book.sections.filter(section => section.linear !== 'no')
}

function getTotalSectionSize(sections: readonly Section[]): number {
    return sections.reduce((sum, section) => sum + Math.max(0, section.size || 0), 0)
}

function utf8ByteLength(text: string): number {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length
    return text.length
}

function clamp01(value: number): number {
    if (!Number.isFinite(value)) return 0
    return Math.max(0, Math.min(1, value))
}
