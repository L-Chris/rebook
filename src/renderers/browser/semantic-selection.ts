/**
 * Semantic selection expansion for the browser reflowable renderer.
 *
 * Expands a DOM Range to word / sentence / paragraph granularity inside
 * `data-rebook-block` elements. All offsets are UTF-16 code-unit indices
 * (matching DOM offsets and `Intl.Segmenter`), unlike `browser-selection.ts`
 * which reports code-point offsets to the outside world.
 */

import type { SelectionGranularity } from '../../core/renderer'

export type { SelectionGranularity }

const SHOW_TEXT = 4 // NodeFilter.SHOW_TEXT without relying on the global

// Ported from rebook-desktop crates/reader/src/lib.rs (is_sentence_terminal).
const SENTENCE_TERMINALS = new Set(['.', '!', '?', '。', '！', '？', '…', '‥'])

// Ported from rebook-desktop crates/reader/src/lib.rs (is_selection_trailing_punctuation).
const COLLAPSIBLE_TRAILING_PUNCTUATION = new Set([
    '.', ',', ';', ':', '!', '?', '\'', '"', ')', ']', '}',
    '。', '，', '、', '；', '：', '！', '？', '…', '‥', '’', '”',
    '»', '›', '）', '】', '》', '〉', '」', '』', '〕', '〗', '〙', '〛',
])

const CJK_PATTERN = /[぀-ヿ㐀-䶿一-鿿豈-﫿]/
const WHITESPACE_PATTERN = /\s/

export function isSentenceTerminal(character: string): boolean {
    return SENTENCE_TERMINALS.has(character)
}

export function isCollapsibleTrailingPunctuation(character: string): boolean {
    return COLLAPSIBLE_TRAILING_PUNCTUATION.has(character)
}

interface TextRange {
    start: number
    end: number
}

/**
 * Expand `range` to the given granularity. Both endpoints must live inside
 * `data-rebook-block="true"` elements under `rootEl`, otherwise `null` is
 * returned. `free` returns the original range untouched. Also returns `null`
 * when the selection touches no word/sentence unit, so taps on blank areas
 * (whitespace runs, paragraph gaps) select nothing instead of magnetically
 * snapping to the nearest unit.
 */
export function expandRangeToGranularity(
    range: Range,
    granularity: SelectionGranularity,
    rootEl: HTMLElement,
): Range | null {
    if (granularity === 'free') return range

    const startBlock = closestBlock(range.startContainer)
    const endBlock = closestBlock(range.endContainer)
    if (!startBlock || !endBlock) return null
    if (!rootEl.contains(startBlock) || !rootEl.contains(endBlock)) return null

    const startNodes = collectTextNodes(startBlock)
    const endNodes = startBlock === endBlock ? startNodes : collectTextNodes(endBlock)
    const startText = joinText(startNodes)
    const endText = startBlock === endBlock ? startText : joinText(endNodes)
    if (!startNodes.length || !endNodes.length) return null

    let startOffset = getBlockTextOffset(startNodes, range.startContainer, range.startOffset)
    let endOffset = getBlockTextOffset(endNodes, range.endContainer, range.endOffset)
    if (startOffset === null || endOffset === null) return null

    const sameBlock = startBlock === endBlock
    const collapsed = range.collapsed
    if (granularity === 'paragraph') {
        startOffset = 0
        endOffset = endText.length
    } else if (granularity === 'sentence') {
        const startRanges = sentenceRanges(startText)
        const endRanges = sameBlock ? startRanges : sentenceRanges(endText)
        const expanded = expandToSemanticRanges(
            startRanges, endRanges, startOffset, endOffset,
            { sameBlock, collapsed, startTextLength: startText.length },
        )
        if (!expanded) return null
        startOffset = expanded.start
        endOffset = expanded.end
    } else {
        const startRanges = wordRanges(startText)
        const endRanges = sameBlock ? startRanges : wordRanges(endText)
        const expanded = expandToSemanticRanges(
            startRanges, endRanges, startOffset, endOffset,
            { sameBlock, collapsed, startTextLength: startText.length },
            word => extendWordEnd(endText, word),
        )
        if (!expanded) return null
        startOffset = expanded.start
        endOffset = expanded.end
    }

    const startPosition = locateTextPosition(startNodes, startOffset)
    const endPosition = locateTextPosition(endNodes, endOffset)
    if (!startPosition || !endPosition) return null

    const expanded = range.cloneRange()
    expanded.setStart(startPosition.node, startPosition.offset)
    expanded.setEnd(endPosition.node, endPosition.offset)
    return expanded
}

function closestBlock(node: Node): HTMLElement | null {
    const element = node.nodeType === 1 ? node as Element : node.parentElement
    return element?.closest<HTMLElement>('[data-rebook-block="true"]') ?? null
}

function collectTextNodes(block: HTMLElement): Text[] {
    const walker = block.ownerDocument.createTreeWalker(block, SHOW_TEXT)
    const nodes: Text[] = []
    let current = walker.nextNode()
    while (current) {
        nodes.push(current as Text)
        current = walker.nextNode()
    }
    return nodes
}

function joinText(nodes: readonly Text[]): string {
    let text = ''
    for (const node of nodes) text += node.data
    return text
}

/**
 * Code-unit offset of a DOM boundary point inside the block's text, or null
 * when the boundary is not within the collected text nodes.
 */
function getBlockTextOffset(textNodes: readonly Text[], container: Node, offset: number): number | null {
    if (container.nodeType === 3) {
        let total = 0
        for (const node of textNodes) {
            if (node === container) return total + Math.min(offset, node.data.length)
            total += node.data.length
        }
        return null
    }
    // Element container: offset is a child index; the boundary sits before
    // that child (or after the last child when offset is out of range).
    const reference = container.childNodes[offset] ?? null
    let total = 0
    for (const node of textNodes) {
        if (isBeforeBoundary(node, container, reference)) {
            total += node.data.length
        } else {
            return total
        }
    }
    return total
}

function isBeforeBoundary(node: Text, container: Node, reference: Node | null): boolean {
    if (!reference) {
        // Boundary is at the end of `container`: count everything up to and
        // including container's own text descendants.
        return container === node
            || container.contains(node)
            || Boolean(node.compareDocumentPosition(container) & 4 /* DOCUMENT_POSITION_FOLLOWING */)
    }
    if (node === reference || reference.contains(node)) return false
    return Boolean(node.compareDocumentPosition(reference) & 4 /* DOCUMENT_POSITION_FOLLOWING */)
}

function locateTextPosition(textNodes: readonly Text[], offset: number): { node: Text, offset: number } | null {
    let remaining = Math.max(0, offset)
    for (const node of textNodes) {
        if (remaining <= node.data.length) return { node, offset: remaining }
        remaining -= node.data.length
    }
    const last = textNodes[textNodes.length - 1]
    return last ? { node: last, offset: last.data.length } : null
}

function makeSegmenter(text: string, granularity: 'word' | 'sentence'): Intl.Segmenter {
    // Dictionary-based CJK word segmentation only when the text needs it;
    // otherwise fall back to the runtime default locale.
    const locale = CJK_PATTERN.test(text) ? 'zh' : undefined
    return new Intl.Segmenter(locale, { granularity })
}

function wordRanges(text: string): TextRange[] {
    const ranges: TextRange[] = []
    for (const segment of makeSegmenter(text, 'word').segment(text)) {
        if (segment.isWordLike) {
            ranges.push({ start: segment.index, end: segment.index + segment.segment.length })
        }
    }
    return ranges
}

function sentenceRanges(text: string): TextRange[] {
    const ranges: TextRange[] = []
    for (const segment of makeSegmenter(text, 'sentence').segment(text)) {
        const trimmed = trimWhitespaceRange(text, segment.index, segment.index + segment.segment.length)
        if (trimmed) ranges.push(trimmed)
    }
    return ranges
}

function trimWhitespaceRange(text: string, start: number, end: number): TextRange | null {
    while (start < end && WHITESPACE_PATTERN.test(text[start]!)) start += 1
    while (end > start && WHITESPACE_PATTERN.test(text[end - 1]!)) end -= 1
    return start < end ? { start, end } : null
}

interface SemanticExpandContext {
    /** Whether both range endpoints live in the same block. */
    sameBlock: boolean
    /** Collapsed caret (tap-to-select) vs. an actual drag selection. */
    collapsed: boolean
    /** Text length of the start block, used when no unit is touched there. */
    startTextLength: number
}

/**
 * Expand to semantic units the selection actually touches — no magnetic snap.
 * A collapsed caret must land on a unit itself (whitespace or gaps select
 * nothing); a drag snaps outward to the first/last intersecting unit. Returns
 * null when a same-block selection touches no unit at all.
 */
function expandToSemanticRanges(
    startRanges: readonly TextRange[],
    endRanges: readonly TextRange[],
    startOffset: number,
    endOffset: number,
    context: SemanticExpandContext,
    extendEnd: (range: TextRange) => TextRange = range => range,
): TextRange | null {
    if (context.collapsed) {
        const hit = containingRange(startRanges, startOffset)
        return hit ? { start: hit.start, end: hit.end } : null
    }
    const first = firstIntersectingRange(startRanges, startOffset)
    const last = lastIntersectingRange(endRanges, endOffset)
    const start = first ? first.start : context.startTextLength
    const sameRange = context.sameBlock && first !== null && first === last
    const end = last ? (sameRange ? last.end : extendEnd(last).end) : 0
    if (context.sameBlock && start >= end) return null
    return { start, end }
}

/** Unit containing `offset` (boundary-inclusive); used for tap carets. */
function containingRange(ranges: readonly TextRange[], offset: number): TextRange | null {
    for (const range of ranges) {
        if (offset >= range.start && offset <= range.end) return range
    }
    return null
}

/** First unit touching `[offset, ∞)` (boundary-inclusive); the drag start expands forward to it. */
function firstIntersectingRange(ranges: readonly TextRange[], offset: number): TextRange | null {
    for (const range of ranges) {
        if (range.end >= offset) return range
    }
    return null
}

/** Last unit touching `(-∞, offset]` (boundary-inclusive); the drag end expands back to it. */
function lastIntersectingRange(ranges: readonly TextRange[], offset: number): TextRange | null {
    for (let index = ranges.length - 1; index >= 0; index -= 1) {
        const range = ranges[index]!
        if (range.start <= offset) return range
    }
    return null
}

/**
 * Port of `extend_word_to_sentence_or_paragraph_end` from the Rust reader:
 * grow a word's end across collapsible trailing punctuation up to the end of
 * its sentence (or paragraph) when everything in between is punctuation.
 */
function extendWordEnd(text: string, word: TextRange): TextRange {
    let punctuationEnd = word.end
    let hasSentenceTerminal = false
    for (const character of text.slice(word.end)) {
        if (!isCollapsibleTrailingPunctuation(character)) break
        punctuationEnd += character.length
        hasSentenceTerminal = hasSentenceTerminal || isSentenceTerminal(character)
    }
    if (punctuationEnd > word.end && hasSentenceTerminal) {
        return { start: word.start, end: punctuationEnd }
    }

    const sentenceEnd = sentenceRanges(text)
        .find(range => rangeEndsWithWord(text, range, word))?.end
    const paragraph = trimWhitespaceRange(text, 0, text.length)
    const paragraphEnd = paragraph && rangeEndsWithWord(text, paragraph, word)
        ? paragraph.end
        : undefined
    const end = sentenceEnd ?? paragraphEnd
    if (end === undefined) return word

    const trailing = text.slice(word.end, end)
    if (!trailing || ![...trailing].every(isCollapsibleTrailingPunctuation)) return word
    return { start: word.start, end }
}

function rangeEndsWithWord(text: string, range: TextRange, word: TextRange): boolean {
    const words = wordRanges(text.slice(range.start, range.end))
    const last = words[words.length - 1]
    return !!last
        && range.start + last.start === word.start
        && range.start + last.end === word.end
}
