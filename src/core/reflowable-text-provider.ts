import {
    bookPositionMatchesReflowableRange,
    type BookRange,
    type Rect,
    type TextChunk,
    type TextProvider,
} from './location'
import type { LineRange, PreparedTextBlock, TextBlock } from './pretext'
import { searchTextChunks } from './text-provider'

export interface ReflowableLinePosition {
    readonly top: number
    readonly left: number
}

export interface ReflowableTextProviderContext {
    readonly sectionIndex: number
    getLinePosition(line: LineRange): ReflowableLinePosition
}

export interface ReflowableTextChunkRecord {
    readonly chunk: TextChunk
    readonly range: BookRange
    readonly line: LineRange
}

export interface ReflowableBlockTextProviderContext {
    readonly sectionIndex: number
    getBlockRect?(block: PreparedTextBlock): Rect | null | undefined
}

export interface ReflowableBlockTextChunkRecord {
    readonly chunk: TextChunk
    readonly range: BookRange
    readonly block: PreparedTextBlock
}

export function createReflowableTextProvider(
    context: ReflowableTextProviderContext,
    lines: readonly LineRange[],
): TextProvider {
    const getRecords = (range?: BookRange) =>
        lines
            .filter(line => line.text)
            .filter(line => !range || lineMatchesReflowableBookRange(line, context.sectionIndex, range))
            .map(line => lineToReflowableTextChunkRecord(line, context))

    return {
        getText(range?: BookRange) {
            return getRecords(range).map(record => record.chunk)
        },
        search(query: string, range?: BookRange) {
            const records = getRecords(range)
            return searchTextChunks(
                records.map(record => record.chunk),
                query,
                (_chunk, index) => records[index]?.range,
            )
        },
    }
}

export function createReflowableBlockTextProvider(
    context: ReflowableBlockTextProviderContext,
    blocks: readonly PreparedTextBlock[],
): TextProvider {
    const getRecords = (range?: BookRange) =>
        blocks
            .map(block => blockToReflowableTextChunkRecord(block, context))
            .filter((record): record is ReflowableBlockTextChunkRecord => Boolean(record))
            .filter(record => !range || blockMatchesReflowableBookRange(record.block, context.sectionIndex, range))

    return {
        getText(range?: BookRange) {
            return getRecords(range).map(record => record.chunk)
        },
        search(query: string, range?: BookRange) {
            const records = getRecords(range)
            return searchTextChunks(
                records.map(record => record.chunk),
                query,
                (_chunk, index) => records[index]?.range,
            )
        },
    }
}

export function blockToReflowableTextChunkRecord(
    block: PreparedTextBlock,
    context: ReflowableBlockTextProviderContext,
): ReflowableBlockTextChunkRecord | null {
    const text = getReflowableTextBlockText(block.block)
    if (!text) return null
    const range = blockToReflowableBookRange(block.block, context.sectionIndex)
    const rect = context.getBlockRect?.(block)
    return {
        block,
        range,
        chunk: {
            id: `reflowable:${context.sectionIndex}:block:${block.block.id}`,
            text,
            location: range.start,
            ...(rect ? { rects: [rect] } : {}),
        },
    }
}

export function blockToReflowableBookRange(block: TextBlock, sectionIndex: number): BookRange {
    const text = getReflowableTextBlockText(block)
    const endOffset = Array.from(text).length
    return {
        start: {
            type: 'reflowable',
            sectionIndex,
            blockId: block.id,
            offset: 0,
        },
        end: {
            type: 'reflowable',
            sectionIndex,
            blockId: block.id,
            offset: endOffset,
        },
    }
}

export function blockMatchesReflowableBookRange(
    block: PreparedTextBlock | TextBlock,
    sectionIndex: number,
    range: BookRange,
): boolean {
    const source = 'block' in block ? block.block : block
    const endOffset = Array.from(getReflowableTextBlockText(source)).length
    return bookPositionMatchesReflowableRange(range, {
        sectionIndex,
        blockId: source.id,
        startOffset: 0,
        endOffset,
        offsetsReliable: true,
    })
}

export function getReflowableTextBlockText(block: TextBlock): string {
    if (block.type === 'image' && block.image) {
        return block.image.alt ?? block.image.title ?? ''
    }
    if (block.type === 'table' && block.table) {
        return block.table.rows
            .flatMap(row => row.cells.map(cell => cell.text))
            .join(' ')
    }
    return block.segments.map(segment => segment.text).join('')
}

export function lineToReflowableTextChunkRecord(
    line: LineRange,
    context: ReflowableTextProviderContext,
): ReflowableTextChunkRecord {
    const range = lineToReflowableBookRange(line, context.sectionIndex)
    const position = context.getLinePosition(line)
    const rect: Rect = {
        x: position.left + (line.inlineOffset ?? 0),
        y: position.top,
        width: Math.max(1, line.width),
        height: line.height,
    }
    return {
        line,
        range,
        chunk: {
            id: `reflowable:${context.sectionIndex}:line:${line.index}`,
            text: line.text,
            location: range.start,
            rects: [rect],
        },
    }
}

export function lineToReflowableBookRange(line: LineRange, sectionIndex: number): BookRange {
    const blockId = line.block?.id
    const startOffset = line.start?.cursor.graphemeIndex
    const endOffset = line.end?.cursor.graphemeIndex ?? startOffset
    return {
        start: {
            type: 'reflowable',
            sectionIndex,
            ...(blockId ? { blockId } : {}),
            ...(startOffset !== undefined ? { offset: startOffset } : {}),
        },
        end: {
            type: 'reflowable',
            sectionIndex,
            ...(blockId ? { blockId } : {}),
            ...(endOffset !== undefined ? { offset: endOffset } : {}),
        },
    }
}

export function lineMatchesReflowableBookRange(
    line: LineRange,
    sectionIndex: number,
    range: BookRange,
): boolean {
    return bookPositionMatchesReflowableRange(range, {
        sectionIndex,
        blockId: line.block?.id,
        startOffset: line.start?.cursor.graphemeIndex,
        endOffset: line.end?.cursor.graphemeIndex,
        offsetsReliable: (line.block?.segments.length ?? 0) === 1,
    })
}
