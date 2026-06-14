import type {
    FixedPageInfo,
    FixedPageTextLayer,
    FixedPageTextRun,
} from './fixed-document'
import {
    getBookPositionLocations,
    getFixedPositionRects,
    type BookLocation,
    type BookRange,
    type Rect,
    type TextChunk,
    type TextProvider,
} from './location'
import { createStaticTextProvider } from './text-provider'

export function emptyFixedPageTextLayer(page: FixedPageInfo): FixedPageTextLayer {
    return {
        pageIndex: page.index,
        width: page.width,
        height: page.height,
        runs: [],
        text: '',
    }
}

export function createFixedPageTextProvider(layer: FixedPageTextLayer, format: string): TextProvider {
    return createStaticTextProvider(
        () => fixedPageTextChunks(layer, format),
        {
            filterChunk: (chunk, range) => fixedTextChunkMatchesRange(chunk, range, format, layer.pageIndex),
        },
    )
}

export function fixedPageTextChunks(layer: FixedPageTextLayer, format: string): TextChunk[] {
    return layer.runs
        .map((run, index): TextChunk | null => {
            if (!run.text) return null
            const rect = fixedTextRunRect(run)
            const location: BookLocation = format === 'cbz'
                ? { type: 'image', pageIndex: layer.pageIndex, rect }
                : { type: 'fixed', format, pageIndex: layer.pageIndex, rect }
            return {
                id: `${format}:${layer.pageIndex}:text:${index}`,
                text: run.text,
                location,
                rects: [rect],
            }
        })
        .filter((chunk): chunk is TextChunk => chunk !== null)
}

export function fixedTextRunRect(run: FixedPageTextRun): Rect {
    const matrix = run.transform
    const fontSize = run.fontSize ?? Math.max(Math.abs(matrix[0]), Math.abs(matrix[3]), 1)
    const height = run.height ?? fontSize
    return {
        x: matrix[4],
        y: matrix[5] - height,
        width: run.width ?? Math.max(fontSize, run.text.length * fontSize * 0.5),
        height,
    }
}

export function fixedTextChunkMatchesRange(
    _chunk: TextChunk,
    range: BookRange,
    format: string,
    pageIndex: number,
): boolean {
    if (getFixedPositionRects(range, { format, pageIndex }).length > 0) return true
    return getBookPositionLocations(range).some(location => {
        if (location.type !== 'fixed' && location.type !== 'image') return false
        if (location.pageIndex !== pageIndex) return false
        return location.type !== 'fixed' || !location.format || location.format === format
    })
}
