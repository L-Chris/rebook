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
    readonly location: BookLocation | BookRange
    readonly quote?: string
    readonly note?: string
    readonly color?: string
    readonly createdAt: number
    readonly updatedAt?: number
    readonly data?: Readonly<Record<string, unknown>>
}
