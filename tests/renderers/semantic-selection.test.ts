import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'
import {
    expandRangeToGranularity,
    isCollapsibleTrailingPunctuation,
    isSentenceTerminal,
} from '../../src/renderers/browser/semantic-selection'

// linkedom's Range lacks offset-based setStart/setEnd, so tests drive the
// module through a minimal stub that implements the Range surface it uses.
class StubRange {
    startContainer: Node
    startOffset: number
    endContainer: Node
    endOffset: number

    constructor(startContainer: Node, startOffset: number, endContainer: Node, endOffset: number) {
        this.startContainer = startContainer
        this.startOffset = startOffset
        this.endContainer = endContainer
        this.endOffset = endOffset
    }

    get collapsed(): boolean {
        return this.startContainer === this.endContainer && this.startOffset === this.endOffset
    }

    cloneRange(): StubRange {
        return new StubRange(this.startContainer, this.startOffset, this.endContainer, this.endOffset)
    }

    setStart(node: Node, offset: number): void {
        this.startContainer = node
        this.startOffset = offset
    }

    setEnd(node: Node, offset: number): void {
        this.endContainer = node
        this.endOffset = offset
    }
}

interface Fixture {
    document: Document
    root: HTMLElement
    block: (id: string) => HTMLElement
}

function createFixture(html: string): Fixture {
    const { document } = parseHTML(`<div id="root">${html}</div>`)
    const root = document.getElementById('root')! as unknown as HTMLElement
    return {
        document: document as unknown as Document,
        root,
        block: (id: string) => root.querySelector(`[data-block-id="${id}"]`) as HTMLElement,
    }
}

function textNodes(document: Document, block: HTMLElement): Text[] {
    const walker = document.createTreeWalker(block, 4 /* NodeFilter.SHOW_TEXT */)
    const nodes: Text[] = []
    let current = walker.nextNode()
    while (current) {
        nodes.push(current as Text)
        current = walker.nextNode()
    }
    return nodes
}

/** Build a StubRange from code-unit offsets into the blocks' text content. */
function makeRange(
    document: Document,
    startBlock: HTMLElement,
    startOffset: number,
    endBlock: HTMLElement,
    endOffset: number,
): Range {
    const locate = (block: HTMLElement, offset: number): { node: Text, offset: number } => {
        let remaining = offset
        for (const node of textNodes(document, block)) {
            if (remaining <= node.data.length) return { node, offset: remaining }
            remaining -= node.data.length
        }
        const last = textNodes(document, block).at(-1)!
        return { node: last, offset: last.data.length }
    }
    const start = locate(startBlock, startOffset)
    const end = locate(endBlock, endOffset)
    return new StubRange(start.node, start.offset, end.node, end.offset) as unknown as Range
}

/** Code-unit offset of a range boundary within a block's text content. */
function offsetInBlock(document: Document, block: HTMLElement, node: Node, offset: number): number {
    let total = 0
    for (const text of textNodes(document, block)) {
        if (text === node) return total + offset
        total += text.data.length
    }
    return -1
}

/** Expand and return [startOffsetInStartBlock, endOffsetInEndBlock]. */
function expandOffsets(
    fixture: Fixture,
    startBlock: HTMLElement,
    startOffset: number,
    endBlock: HTMLElement,
    endOffset: number,
    granularity: 'free' | 'word' | 'sentence' | 'paragraph',
): [number, number] {
    const range = makeRange(fixture.document, startBlock, startOffset, endBlock, endOffset)
    const expanded = expandRangeToGranularity(range, granularity, fixture.root)
    expect(expanded).not.toBeNull()
    return [
        offsetInBlock(fixture.document, startBlock, expanded!.startContainer, expanded!.startOffset),
        offsetInBlock(fixture.document, endBlock, expanded!.endContainer, expanded!.endOffset),
    ]
}

describe('expandRangeToGranularity', () => {
    it('returns the original range for free granularity', () => {
        const fixture = createFixture('<p data-rebook-block="true" data-block-id="b1">Hello world.</p>')
        const block = fixture.block('b1')
        const range = makeRange(fixture.document, block, 2, block, 5)
        expect(expandRangeToGranularity(range, 'free', fixture.root)).toBe(range)
    })

    it('returns null when an endpoint is not inside a rebook block', () => {
        const fixture = createFixture(
            '<p data-rebook-block="true" data-block-id="b1">Hello world.</p><div>outside</div>',
        )
        const block = fixture.block('b1')
        const outside = fixture.root.querySelector('div')!.firstChild!
        const range = new StubRange(
            textNodes(fixture.document, block)[0]!, 1, outside, 2,
        ) as unknown as Range
        expect(expandRangeToGranularity(range, 'word', fixture.root)).toBeNull()
    })

    it('returns null when a block is outside the root element', () => {
        const fixture = createFixture('<p data-rebook-block="true" data-block-id="b1">Hello world.</p>')
        const block = fixture.block('b1')
        const other = createFixture('<p data-rebook-block="true" data-block-id="b2">Other text.</p>')
        const otherBlock = other.block('b2')
        const range = new StubRange(
            textNodes(fixture.document, block)[0]!, 1,
            textNodes(other.document, otherBlock)[0]!, 2,
        ) as unknown as Range
        expect(expandRangeToGranularity(range, 'word', fixture.root)).toBeNull()
    })

    it('expands to an English word', () => {
        const fixture = createFixture('<p data-rebook-block="true" data-block-id="b1">Hello brave new world.</p>')
        const block = fixture.block('b1')
        // caret inside "brave" (offsets 6..11)
        expect(expandOffsets(fixture, block, 8, block, 8, 'word')).toEqual([6, 11])
    })

    it('expands across nested inline elements', () => {
        const fixture = createFixture('<p data-rebook-block="true" data-block-id="b1">Hello <b>brave</b> new world.</p>')
        const block = fixture.block('b1')
        expect(expandOffsets(fixture, block, 8, block, 8, 'word')).toEqual([6, 11])
    })

    it('expands to a Chinese word', () => {
        const fixture = createFixture('<p data-rebook-block="true" data-block-id="b1">今天天气很好。明天再说。</p>')
        const block = fixture.block('b1')
        // caret inside "天气" (offsets 2..4)
        expect(expandOffsets(fixture, block, 3, block, 3, 'word')).toEqual([2, 4])
    })

    it('keeps word boundaries when both endpoints hit the same word', () => {
        const fixture = createFixture('<p data-rebook-block="true" data-block-id="b1">Hello world! Again.</p>')
        const block = fixture.block('b1')
        // both endpoints inside "world" (offsets 6..11): no punctuation swallow
        expect(expandOffsets(fixture, block, 7, block, 9, 'word')).toEqual([6, 11])
    })

    it('swallows collapsible trailing punctuation on the end word', () => {
        const fixture = createFixture('<p data-rebook-block="true" data-block-id="b1">Hello world! Again.</p>')
        const block = fixture.block('b1')
        // start in "Hello", end in "world": end grows across "!"
        expect(expandOffsets(fixture, block, 1, block, 8, 'word')).toEqual([0, 12])
    })

    it('swallows trailing quotes after a sentence terminal', () => {
        const fixture = createFixture('<p data-rebook-block="true" data-block-id="b1">她说“停止！”然后走了。</p>')
        const block = fixture.block('b1')
        // start in "她说" (0..2), end in "停止" (3..5): end grows across ！”
        expect(expandOffsets(fixture, block, 1, block, 4, 'word')).toEqual([0, 7])
    })

    it('does not swallow punctuation when text follows the end word', () => {
        const fixture = createFixture('<p data-rebook-block="true" data-block-id="b1">Hello world, again.</p>')
        const block = fixture.block('b1')
        // "world" is followed by "," but the sentence continues: no swallow
        expect(expandOffsets(fixture, block, 1, block, 8, 'word')).toEqual([0, 11])
    })

    it('expands to a sentence', () => {
        const fixture = createFixture('<p data-rebook-block="true" data-block-id="b1">One two. Three four! Five.</p>')
        const block = fixture.block('b1')
        // caret in the second sentence
        expect(expandOffsets(fixture, block, 12, block, 12, 'sentence')).toEqual([9, 20])
    })

    it('expands to a Chinese sentence', () => {
        const fixture = createFixture('<p data-rebook-block="true" data-block-id="b1">今天天气很好。明天再说。</p>')
        const block = fixture.block('b1')
        expect(expandOffsets(fixture, block, 9, block, 9, 'sentence')).toEqual([7, 12])
    })

    it('trims surrounding whitespace for sentence granularity', () => {
        const fixture = createFixture('<p data-rebook-block="true" data-block-id="b1">  Hello world.  Next one.  </p>')
        const block = fixture.block('b1')
        expect(expandOffsets(fixture, block, 5, block, 5, 'sentence')).toEqual([2, 14])
    })

    it('expands to the whole paragraph', () => {
        const fixture = createFixture('<p data-rebook-block="true" data-block-id="b1">Hello <b>brave</b> world.</p>')
        const block = fixture.block('b1')
        expect(expandOffsets(fixture, block, 8, block, 8, 'paragraph'))
            .toEqual([0, block.textContent!.length])
    })

    it('expands each endpoint independently across blocks', () => {
        const fixture = createFixture(
            '<p data-rebook-block="true" data-block-id="b1">Hello brave world.</p>'
            + '<p data-rebook-block="true" data-block-id="b2">今天天气很好。明天再说。</p>',
        )
        const b1 = fixture.block('b1')
        const b2 = fixture.block('b2')
        // start inside "brave" (6..11), end inside "天气" (2..4)
        expect(expandOffsets(fixture, b1, 8, b2, 3, 'word')).toEqual([6, 4])
    })

    it('expands across blocks for paragraph granularity', () => {
        const fixture = createFixture(
            '<p data-rebook-block="true" data-block-id="b1">First block.</p>'
            + '<p data-rebook-block="true" data-block-id="b2">Second block.</p>',
        )
        const b1 = fixture.block('b1')
        const b2 = fixture.block('b2')
        expect(expandOffsets(fixture, b1, 3, b2, 5, 'paragraph')).toEqual([0, b2.textContent!.length])
    })

    it('returns null when a drag touches only whitespace', () => {
        const fixture = createFixture('<p data-rebook-block="true" data-block-id="b1">Hello   world.</p>')
        const block = fixture.block('b1')
        const range = makeRange(fixture.document, block, 6, block, 7)
        expect(expandRangeToGranularity(range, 'word', fixture.root)).toBeNull()
    })

    it('snaps a drag start in whitespace forward, not back', () => {
        const fixture = createFixture('<p data-rebook-block="true" data-block-id="b1">Hello   brave world.</p>')
        const block = fixture.block('b1')
        // start on a middle space (offset 6), end inside "brave" (8..13)
        expect(expandOffsets(fixture, block, 6, block, 9, 'word')).toEqual([8, 13])
    })

    it('uses code-unit offsets around surrogate pairs', () => {
        const fixture = createFixture('<p data-rebook-block="true" data-block-id="b1">a😀b test.</p>')
        const block = fixture.block('b1')
        // "test" starts at code-unit offset 5: a(1) + 😀(2) + b(1) + space(1)
        expect(expandOffsets(fixture, block, 6, block, 6, 'word')).toEqual([5, 9])
    })

    // The renderer's tap-to-select path feeds a collapsed caret range from
    // caretRangeFromPoint into expandRangeToGranularity; these tests cover
    // that caret shape directly (linkedom has no Selection/caret APIs, so a
    // renderer-level test is not feasible).
    describe('collapsed caret ranges (tap-to-select)', () => {
        it('expands a caret inside a word to the whole word', () => {
            const fixture = createFixture('<p data-rebook-block="true" data-block-id="b1">Hello brave world.</p>')
            const block = fixture.block('b1')
            expect(expandOffsets(fixture, block, 8, block, 8, 'word')).toEqual([6, 11])
        })

        it('expands a caret at a word boundary to the touching word', () => {
            const fixture = createFixture('<p data-rebook-block="true" data-block-id="b1">Hello brave world.</p>')
            const block = fixture.block('b1')
            // caret at offset 5 touches the end boundary of "Hello"
            expect(expandOffsets(fixture, block, 5, block, 5, 'word')).toEqual([0, 5])
        })

        it('returns null for a caret in a whitespace run', () => {
            const fixture = createFixture('<p data-rebook-block="true" data-block-id="b1">Hello   world.</p>')
            const block = fixture.block('b1')
            // caret on the middle space between "Hello" and "world"
            const range = makeRange(fixture.document, block, 6, block, 6)
            expect(expandRangeToGranularity(range, 'word', fixture.root)).toBeNull()
        })

        it('returns null for a caret in trailing whitespace', () => {
            const fixture = createFixture('<p data-rebook-block="true" data-block-id="b1">Hello world.   </p>')
            const block = fixture.block('b1')
            const range = makeRange(fixture.document, block, 13, block, 13)
            expect(expandRangeToGranularity(range, 'word', fixture.root)).toBeNull()
        })

        it('returns null for a caret between trimmed sentences', () => {
            const fixture = createFixture('<p data-rebook-block="true" data-block-id="b1">One.   Two.</p>')
            const block = fixture.block('b1')
            // caret on a space between the two sentences
            const range = makeRange(fixture.document, block, 5, block, 5)
            expect(expandRangeToGranularity(range, 'sentence', fixture.root)).toBeNull()
        })

        it('expands a caret to the containing sentence', () => {
            const fixture = createFixture('<p data-rebook-block="true" data-block-id="b1">One two. Three four! Five.</p>')
            const block = fixture.block('b1')
            expect(expandOffsets(fixture, block, 12, block, 12, 'sentence')).toEqual([9, 20])
        })

        it('expands a caret to the whole paragraph', () => {
            const fixture = createFixture('<p data-rebook-block="true" data-block-id="b1">Hello brave world.</p>')
            const block = fixture.block('b1')
            expect(expandOffsets(fixture, block, 8, block, 8, 'paragraph'))
                .toEqual([0, block.textContent!.length])
        })
    })
})

describe('punctuation tables', () => {
    it('recognizes sentence terminals', () => {
        for (const char of ['.', '!', '?', '。', '！', '？', '…', '‥']) {
            expect(isSentenceTerminal(char)).toBe(true)
        }
        expect(isSentenceTerminal(',')).toBe(false)
    })

    it('recognizes collapsible trailing punctuation', () => {
        for (const char of ['.', ',', '"', ')', '。', '，', '、', '”', '）', '》', '」']) {
            expect(isCollapsibleTrailingPunctuation(char)).toBe(true)
        }
        expect(isCollapsibleTrailingPunctuation('a')).toBe(false)
        expect(isCollapsibleTrailingPunctuation('（')).toBe(false)
    })
})
