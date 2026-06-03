import type { Book, RelocateEvent, TOCItem } from '../core/types'

export interface TrialLimitOptions {
    maxPages?: number
    bytesPerEstimatedPage?: number
    epsilon?: number
}

export interface ReaderTOCAccessItem {
    item: TOCItem
    label: string
    href: string
    depth: number
    sectionIndex: number
    sectionFraction: number
    disabled: boolean
}

export interface ReaderSnapshotLike {
    sectionIndex: number
    sectionCount: number
    pageIndex: number
    pageCount: number
    fraction: number
}

const DEFAULT_BYTES_PER_ESTIMATED_PAGE = 2500
const DEFAULT_EPSILON = 0.0001

export const normalizeNavigationHref = (href?: string | null): string => (href || '').split('#')[0]

export const normalizeBookPath = (href?: string | null): string => {
    const path = normalizeNavigationHref(href).replace(/\\/g, '/').replace(/^\/+/, '')
    const parts: string[] = []
    for (const part of path.split('/')) {
        if (!part || part === '.') continue
        if (part === '..') parts.pop()
        else parts.push(part)
    }
    return parts.join('/')
}

export function resolveBookNavigation(book: Book, href: string): { index: number } | null {
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

export function getTotalFraction(
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

export function estimatePageLimitFraction(book: Book, options: TrialLimitOptions = {}): number {
    const maxPages = options.maxPages
    if (!maxPages || maxPages <= 0) return 1

    const bytesPerEstimatedPage = options.bytesPerEstimatedPage ?? DEFAULT_BYTES_PER_ESTIMATED_PAGE
    const totalSectionSize = book.sections.reduce((sum, section) => sum + (section.size || 0), 0)
    const estimatedPages = book.pageList?.length || Math.ceil(totalSectionSize / bytesPerEstimatedPage)
    return clamp01(maxPages / Math.max(estimatedPages, maxPages))
}

export function getTrialPageStepFraction(book: Book, options: TrialLimitOptions = {}): number {
    const maxPages = options.maxPages
    if (!maxPages || maxPages <= 0) return 1
    return estimatePageLimitFraction(book, options) / maxPages
}

export function getTargetStartFraction(
    book: Book,
    sectionFractions: readonly number[],
    target: string | number,
): number {
    const index = typeof target === 'number'
        ? target
        : resolveBookNavigation(book, target)?.index
    if (typeof index !== 'number' || index < 0) return 0
    return sectionFractions[index] ?? 0
}

export function canAccessTarget(
    book: Book,
    sectionFractions: readonly number[],
    target: string | number,
    limitFraction: number,
    epsilon = DEFAULT_EPSILON,
): boolean {
    return getTargetStartFraction(book, sectionFractions, target) <= limitFraction + epsilon
}

export function getAllowedTOCHrefs(
    book: Book,
    sectionFractions: readonly number[],
    limitFraction: number,
    epsilon = DEFAULT_EPSILON,
): string[] {
    return getTOCAccessItems(book, sectionFractions, limitFraction, epsilon)
        .filter(item => !item.disabled)
        .map(item => normalizeNavigationHref(item.href))
}

export function getTOCAccessItems(
    book: Book,
    sectionFractions: readonly number[],
    limitFraction: number,
    epsilon = DEFAULT_EPSILON,
    items: readonly TOCItem[] = book.toc || [],
    depth = 0,
): ReaderTOCAccessItem[] {
    return items.flatMap(item => {
        const sectionIndex = resolveBookNavigation(book, item.href)?.index ?? -1
        const sectionFraction = sectionIndex >= 0 ? sectionFractions[sectionIndex] ?? 0 : 0
        const disabled = sectionIndex >= 0 && sectionFraction > limitFraction + epsilon
        return [
            {
                item,
                label: item.label || 'Untitled',
                href: item.href,
                depth,
                sectionIndex,
                sectionFraction,
                disabled,
            },
            ...getTOCAccessItems(book, sectionFractions, limitFraction, epsilon, item.subitems || [], depth + 1),
        ]
    })
}

export function getCurrentTOCAccessItem(
    items: readonly ReaderTOCAccessItem[],
    location: Pick<RelocateEvent, 'index'> | null | undefined,
): ReaderTOCAccessItem | null {
    if (!items.length || !location || location.index < 0) return null

    const exact = items.find(item => item.sectionIndex === location.index)
    if (exact) return exact

    for (let index = items.length - 1; index >= 0; index--) {
        const item = items[index]
        if (item && item.sectionIndex >= 0 && item.sectionIndex < location.index) return item
    }
    return null
}

export function estimateNextTotalFractionFromSnapshot(
    snapshot: ReaderSnapshotLike,
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

export function willForwardExceedLimit(
    location: Pick<RelocateEvent, 'index' | 'fraction' | 'totalFraction'> | null | undefined,
    sectionFractions: readonly number[],
    limitFraction: number,
    pageStepFraction: number,
    epsilon = DEFAULT_EPSILON,
): boolean {
    return getTotalFraction(location, sectionFractions) + pageStepFraction > limitFraction + epsilon
}

function clamp01(value: number): number {
    if (!Number.isFinite(value)) return 0
    return Math.max(0, Math.min(1, value))
}
