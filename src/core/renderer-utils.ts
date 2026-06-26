import type { LayoutMode, RendererStyles } from './renderer'
import type { LineRange } from './pretext'

export function parseCSSPixels(value: string | number | undefined, fallback: number): number {
    if (!value) return fallback
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
    const match = value.trim().match(/^([\d.]+)(px)?$/)
    if (!match) return fallback
    const parsed = Number(match[1])
    return Number.isFinite(parsed) ? parsed : fallback
}

export function getLineHeightMultiplier(value: RendererStyles['lineHeight'], fontSize: number): number {
    if (typeof value === 'number') return value
    if (typeof value === 'string') {
        const trimmed = value.trim()
        if (trimmed.endsWith('px')) return parseCSSPixels(trimmed, fontSize * 1.6) / fontSize
        const parsed = Number(trimmed)
        if (Number.isFinite(parsed)) return parsed
    }
    return 1.6
}

export function getColumnCount(
    mode: LayoutMode,
    availableWidth: number,
    minColumnWidth: number,
    gap: number,
    maxColumnCount: number,
): number {
    if (mode !== 'paginated' || maxColumnCount < 2) return 1
    return availableWidth >= minColumnWidth * 2 + gap ? 2 : 1
}

export function getReadablePageCount(lines: readonly LineRange[], columnHeight: number, columns: number): number {
    let lastReadablePage = 0
    for (const line of lines) {
        if (line.height <= 0) continue
        lastReadablePage = Math.max(lastReadablePage, getLinePageIndex(line, columnHeight, columns))
    }
    return Math.max(1, lastReadablePage + 1)
}

export function getLinePageIndex(line: LineRange, columnHeight: number, columns: number): number {
    const safeColumns = Math.max(1, columns)
    const { sourceColumn } = getSourceColumnPosition(line.top, columnHeight)
    return Math.floor(sourceColumn / safeColumns)
}

export function getSourceColumnPosition(sourceTop: number, columnHeight: number): { sourceColumn: number; offset: number } {
    const safeTop = Math.max(0, sourceTop)
    const safeColumnHeight = Math.max(1, columnHeight)
    let sourceColumn = Math.floor(safeTop / safeColumnHeight)
    let offset = safeTop - sourceColumn * safeColumnHeight
    const epsilon = Math.max(1e-7, safeColumnHeight * 1e-9)

    if (offset < 0 && offset > -epsilon) offset = 0
    if (offset >= safeColumnHeight - epsilon) {
        sourceColumn += 1
        offset = 0
    }

    return {
        sourceColumn,
        offset: Math.max(0, offset),
    }
}

export function getPagePaddingBlock(mode: LayoutMode, pageHeight: number, margin: number): number {
    const preferred = mode === 'paginated'
        ? Math.max(20, margin)
        : Math.max(12, margin * 0.5)
    return Math.min(preferred, Math.max(12, pageHeight * 0.14))
}

export function getPagePaddingInline(
    value: RendererStyles['pagePaddingInline'],
    legacyGap: RendererStyles['gap'],
    fallback: number,
): number {
    const legacyGapPadding = parseCSSPixels(legacyGap, fallback * 2) / 2
    return Math.max(0, parseCSSPixels(value, legacyGapPadding))
}

export function getAnchorIds(value: unknown): string[] {
    if (typeof value !== 'string') {
        const id = getElementLikeId(value)
        return id ? [id] : []
    }

    const trimmed = value.trim()
    if (!trimmed) return []

    const attrMatch = trimmed.match(/^\[(?:id|name)=["']([^"']+)["']\]$/)
    if (attrMatch) return [unescapeCSSIdentifier(attrMatch[1])]

    if (trimmed.startsWith('#')) return [unescapeCSSIdentifier(trimmed.slice(1))]
    if (/^[\w:-]+$/.test(trimmed)) return [trimmed]

    return []
}

function getElementLikeId(value: unknown): string | null {
    if (!value || typeof value !== 'object') return null
    const maybeElement = value as { id?: unknown; getAttribute?: (name: string) => string | null }
    if (typeof maybeElement.id === 'string' && maybeElement.id) return maybeElement.id
    return maybeElement.getAttribute?.('id') ?? maybeElement.getAttribute?.('name') ?? null
}

function unescapeCSSIdentifier(value: string): string {
    return value.replace(/\\(.)/g, '$1')
}
