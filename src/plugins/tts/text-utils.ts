import type { TextBlock, TextSegment } from '../../core/types'

interface ReadableOptions {
    includeFootnotes?: boolean
    includeAnnotationRefs?: boolean
}

export interface ReadableBlock {
    block: TextBlock
    readable: ReadableBlockText
}

export interface ReadableBlockText {
    text: string
    mapOffset(offset: number, end?: boolean): number
}

export function getReadableBlocks(blocks: readonly TextBlock[], options: ReadableOptions): ReadableBlock[] {
    const readableBlocks: ReadableBlock[] = []
    for (const block of blocks) {
        const readable = getReadableBlockText(block, options)
        if (!readable?.text) continue
        if (!hasSpeakableText(readable.text)) continue
        readableBlocks.push({ block, readable })
    }
    return readableBlocks
}

function getReadableBlockText(block: TextBlock, options: ReadableOptions): ReadableBlockText | null {
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
    options: ReadableOptions,
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

export function splitText(text: string, maxChars: number): Array<{ text: string, start: number, end: number }> {
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

export function normalizeText(text: string): string {
    return text.replace(/\s+/g, ' ').trim()
}

export function hasSpeakableText(text: string): boolean {
    return normalizeText(text).replace(/[\s"'“”‘’「」『』()[\]{}<>《》。，、？！：；,.!?;:\-—–…]+/g, '').length > 0
}

export function trimSilentGapEdges(text: string, start: number, end: number): { start: number, end: number } {
    let nextStart = start
    let nextEnd = end
    while (nextStart < nextEnd && /[\s"'“”‘’「」『』]/.test(text[nextStart] ?? '')) nextStart += 1
    while (nextEnd > nextStart && /[\s"'“”‘’「」『』]/.test(text[nextEnd - 1] ?? '')) nextEnd -= 1
    return { start: nextStart, end: nextEnd }
}

export function trimSpeechPartBoundaryEdges(text: string, start: number, end: number): { start: number, end: number } {
    let nextStart = start
    let nextEnd = end
    while (nextStart < nextEnd && isLeadingSpeechBoundary(text[nextStart] ?? '')) nextStart += 1
    while (nextEnd > nextStart && /[\s"'“”‘’「」『』]/.test(text[nextEnd - 1] ?? '')) nextEnd -= 1
    return { start: nextStart, end: nextEnd }
}

function isLeadingSpeechBoundary(value: string): boolean {
    return /[\s"'“”‘’「」『』,，、。.!！?？;；:：—–-…]/.test(value)
}
