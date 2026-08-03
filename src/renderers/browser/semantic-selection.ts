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
 * returned. `free` returns the original range untouched.
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

    if (granularity === 'paragraph') {
        startOffset = 0
        endOffset = endText.length
    } else if (granularity === 'sentence') {
        const startSentence = nearestRange(sentenceRanges(startText), startOffset)
        const endSentence = nearestRange(sentenceRanges(endText), endOffset)
        if (!startSentence || !endSentence) return null
        startOffset = startSentence.start
        endOffset = endSentence.end
    } else {
        const startWord = nearestRange(wordRanges(startText), startOffset)
        const endWord = nearestRange(wordRanges(endText), endOffset)
        if (!startWord || !endWord) return null
        const sameWord = startBlock === endBlock
            && startWord.start === endWord.start
            && startWord.end === endWord.end
        startOffset = startWord.start
        endOffset = sameWord ? endWord.end : extendWordEnd(endText, endWord).end
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

/**
 * Nearest range to a caret offset; ranges containing the offset win, ties go
 * to the earliest range (mirrors `nearest_semantic_range` in the Rust reader).
 */
function nearestRange(ranges: readonly TextRange[], offset: number): TextRange | null {
    let best: TextRange | null = null
    let bestDistance = Infinity
    for (const range of ranges) {
        const distance = offset < range.start
            ? range.start - offset
            : offset > range.end
                ? offset - range.end
                : 0
        if (distance < bestDistance) {
            best = range
            bestDistance = distance
        }
    }
    return best
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
