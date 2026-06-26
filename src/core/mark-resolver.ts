import {
    bookPositionMatchesReflowableRange,
    getFixedPositionRects,
    type Rect,
    type ReflowableTextRange,
} from './location'
import type { LineRange, TextBlock } from './pretext'
import { getReflowableTextBlockText } from './reflowable-text-provider'
import type { ReaderMark } from './renderer'

export interface ResolvedMarkRect {
    readonly mark: ReaderMark
    readonly rect: Rect
}

export interface FixedMarkRectOptions {
    readonly pageIndex: number
    readonly format?: string
}

export function resolveFixedMarkRects(
    marks: readonly ReaderMark[],
    options: FixedMarkRectOptions,
): ResolvedMarkRect[] {
    const output: ResolvedMarkRect[] = []
    for (const mark of marks) {
        for (const rect of getFixedPositionRects(mark.location, {
            format: options.format ?? '',
            pageIndex: options.pageIndex,
        })) {
            output.push({ mark, rect })
        }
    }
    return output
}

export function getLineReflowableTextRange(line: LineRange, sectionIndex: number): ReflowableTextRange {
    return {
        sectionIndex,
        blockId: line.block?.id,
        startOffset: line.start?.cursor.graphemeIndex,
        endOffset: line.end?.cursor.graphemeIndex,
        offsetsReliable: (line.block?.segments.length ?? 0) === 1,
    }
}

export function getBlockReflowableTextRange(block: TextBlock, sectionIndex: number): ReflowableTextRange {
    return {
        sectionIndex,
        blockId: block.id,
        startOffset: 0,
        endOffset: Array.from(getReflowableTextBlockText(block)).length,
        offsetsReliable: true,
    }
}

export function markMatchesReflowableRange(mark: ReaderMark, range: ReflowableTextRange): boolean {
    return bookPositionMatchesReflowableRange(mark.location, range)
}

export function resolveReflowableLineMarks(
    marks: readonly ReaderMark[],
    line: LineRange,
    sectionIndex: number,
): ReaderMark[] {
    const range = getLineReflowableTextRange(line, sectionIndex)
    return marks.filter(mark => markMatchesReflowableRange(mark, range))
}

export function resolveReflowableBlockMarks(
    marks: readonly ReaderMark[],
    block: TextBlock,
    sectionIndex: number,
): ReaderMark[] {
    const range = getBlockReflowableTextRange(block, sectionIndex)
    return marks.filter(mark => markMatchesReflowableRange(mark, range))
}
