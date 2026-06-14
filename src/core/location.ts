/**
 * Platform-neutral reading locations.
 *
 * Renderers keep their native coordinate systems, while annotations,
 * selections, sync, and AI overlays can depend on this common shape.
 */

export const REBOOK_LOCATION_MODEL_VERSION = 1

export interface Rect {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
}

export type BookLocation =
    | {
        readonly type: 'fixed'
        readonly format?: string
        readonly pageIndex: number
        readonly rect?: Rect
    }
    | {
        readonly type: 'reflowable'
        readonly sectionIndex: number
        readonly href?: string
        readonly cfi?: string
        readonly blockId?: string
        readonly offset?: number
    }
    | {
        readonly type: 'image'
        readonly pageIndex: number
        readonly rect?: Rect
    }
    | {
        readonly type: 'text'
        readonly sectionIndex: number
        readonly offset: number
    }

export interface BookRange {
    readonly start: BookLocation
    readonly end?: BookLocation
}

export type BookPosition = BookLocation | BookRange

export interface ReflowableTextRange {
    readonly sectionIndex: number
    readonly blockId?: string
    readonly startOffset?: number
    readonly endOffset?: number
    readonly offsetsReliable?: boolean
}

export interface BookSelection {
    readonly range: BookRange
    readonly text?: string
    readonly rects?: readonly Rect[]
}

export interface TextChunk {
    readonly id?: string
    readonly text: string
    readonly location?: BookLocation
    readonly rects?: readonly Rect[]
}

export interface TextSearchResult {
    readonly chunk: TextChunk
    readonly range: BookRange
    readonly score?: number
}

export interface TextProvider {
    getText(range?: BookRange): Promise<readonly TextChunk[]> | readonly TextChunk[]
    search?(query: string, range?: BookRange): Promise<readonly TextSearchResult[]> | readonly TextSearchResult[]
    getSelection?(): Promise<BookSelection | null> | BookSelection | null
}

export interface Annotation {
    readonly id: string
    readonly bookId?: string
    readonly location: BookPosition
    readonly quote?: string
    readonly note?: string
    readonly color?: string
    readonly createdAt: number
    readonly updatedAt?: number
    readonly data?: Readonly<Record<string, unknown>>
}

export function isBookRange(value: BookPosition): value is BookRange {
    return typeof value === 'object' && value !== null && 'start' in value
}

export function getBookPositionLocations(position: BookPosition): readonly BookLocation[] {
    return isBookRange(position)
        ? position.end ? [position.start, position.end] : [position.start]
        : [position]
}

export function getFixedPositionRects(position: BookPosition, options: {
    readonly format: string
    readonly pageIndex: number
}): Rect[] {
    const rects: Rect[] = []
    for (const location of getBookPositionLocations(position)) {
        if (location.type !== 'fixed' && location.type !== 'image') continue
        if (location.pageIndex !== options.pageIndex) continue
        if ('format' in location && location.format && location.format !== options.format) continue
        if (location.rect) rects.push(location.rect)
    }
    return rects
}

export function bookPositionMatchesReflowableRange(position: BookPosition, range: ReflowableTextRange): boolean {
    if (isBookRange(position)) return bookRangeMatchesReflowableRange(position, range)
    return bookLocationMatchesReflowableRange(position, range)
}

function bookRangeMatchesReflowableRange(position: BookRange, range: ReflowableTextRange): boolean {
    const start = getReflowableLocation(position.start)
    const end = position.end ? getReflowableLocation(position.end) : start
    if (!start || !end) return false

    if (start.sectionIndex !== end.sectionIndex) {
        return range.sectionIndex >= Math.min(start.sectionIndex, end.sectionIndex)
            && range.sectionIndex <= Math.max(start.sectionIndex, end.sectionIndex)
    }

    if (start.sectionIndex !== range.sectionIndex) return false

    const startBlockId = getReflowableBlockId(start)
    const endBlockId = getReflowableBlockId(end)
    if (startBlockId && endBlockId && startBlockId === endBlockId) {
        return reflowableLocationMatchesBlock(start, range, end.offset)
    }

    return bookLocationMatchesReflowableRange(position.start, range)
        || (position.end ? bookLocationMatchesReflowableRange(position.end, range) : false)
}

function bookLocationMatchesReflowableRange(location: BookLocation, range: ReflowableTextRange): boolean {
    const reflowable = getReflowableLocation(location)
    if (!reflowable) return false
    return reflowableLocationMatchesBlock(reflowable, range)
}

function getReflowableLocation(location: BookLocation): Extract<BookLocation, { type: 'reflowable' | 'text' }> | null {
    return location.type === 'reflowable' || location.type === 'text' ? location : null
}

function getReflowableBlockId(location: Extract<BookLocation, { type: 'reflowable' | 'text' }>): string | undefined {
    return location.type === 'reflowable' ? location.blockId : undefined
}

function reflowableLocationMatchesBlock(
    location: Extract<BookLocation, { type: 'reflowable' | 'text' }>,
    range: ReflowableTextRange,
    endOffset = location.offset,
): boolean {
    if (location.sectionIndex !== range.sectionIndex) return false
    if (location.type === 'reflowable' && location.blockId) {
        if (range.blockId !== location.blockId) return false
    }
    if (location.offset === undefined && endOffset === undefined) return true
    if (!range.offsetsReliable) return true

    const rangeStart = range.startOffset ?? Number.NEGATIVE_INFINITY
    const rangeEnd = range.endOffset ?? Number.POSITIVE_INFINITY
    if (rangeEnd <= rangeStart) return true

    const markStart = location.offset ?? Number.NEGATIVE_INFINITY
    const markEnd = endOffset ?? Number.POSITIVE_INFINITY
    if (markEnd === markStart) return rangeStart <= markStart && markStart < rangeEnd
    return rangeStart < markEnd && rangeEnd > markStart
}
