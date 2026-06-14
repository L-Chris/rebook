/**
 * Fixed-layout document contracts for page-native formats such as PDF,
 * CBZ, image sequences, and future fixed EPUB flows.
 *
 * Coordinates are normalized to CSS pixels with a top-left origin. Platform
 * renderers may render into higher-resolution backing stores by using the
 * viewport pixel dimensions and pixel scale values.
 */

export type FixedDocumentFormat = 'pdf' | 'cbz' | 'image-sequence' | (string & {})

export type FixedPageRotation = 0 | 90 | 180 | 270

export type FixedPageTransform = readonly [
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
]

export interface FixedPageInfo {
    readonly index: number
    /** Page width in unscaled CSS pixels. */
    readonly width: number
    /** Page height in unscaled CSS pixels. */
    readonly height: number
    readonly rotation?: FixedPageRotation
    readonly label?: string
}

export type FixedPageTextDirection = 'ltr' | 'rtl' | 'ttb' | 'btt'

export interface FixedPageTextRun {
    readonly text: string
    /**
     * Matrix that maps run-local text coordinates into the page's CSS pixel
     * coordinate space. Keeping this explicit prevents browser and non-DOM
     * renderers from guessing text layer positions from font metrics.
     */
    readonly transform: FixedPageTransform
    readonly width?: number
    readonly height?: number
    readonly fontSize?: number
    readonly fontFamily?: string
    readonly fontWeight?: string
    readonly fontStyle?: string
    readonly direction?: FixedPageTextDirection
    readonly hasEOL?: boolean
}

export interface FixedPageTextLayer {
    readonly pageIndex: number
    readonly width: number
    readonly height: number
    readonly runs: readonly FixedPageTextRun[]
    readonly text?: string
}

export type FixedPageRenderIntent = 'display' | 'print' | 'thumbnail'

export interface FixedPageViewportOptions {
    readonly scale?: number
    readonly devicePixelRatio?: number
    readonly rotation?: FixedPageRotation
}

export interface FixedPageViewport {
    readonly pageIndex: number
    readonly scale: number
    readonly devicePixelRatio: number
    readonly rotation: FixedPageRotation
    readonly cssWidth: number
    readonly cssHeight: number
    readonly pixelWidth: number
    readonly pixelHeight: number
    readonly pixelScaleX: number
    readonly pixelScaleY: number
    readonly transform: FixedPageTransform
}

export interface FixedPageRenderOptions extends FixedPageViewportOptions {
    readonly intent?: FixedPageRenderIntent
    readonly textLayer?: boolean
}

export interface FixedPageRenderResult {
    readonly pageIndex: number
    readonly cssWidth: number
    readonly cssHeight: number
    readonly pixelWidth: number
    readonly pixelHeight: number
    readonly scale: number
    readonly devicePixelRatio: number
}

export interface FixedDocument {
    readonly kind: 'fixed-document'
    readonly format: FixedDocumentFormat
    readonly pageCount: number

    getPage(pageIndex: number): Promise<FixedPageInfo> | FixedPageInfo
    getPages?(): Promise<readonly FixedPageInfo[]> | readonly FixedPageInfo[]
    getPageText?(pageIndex: number): Promise<FixedPageTextLayer> | FixedPageTextLayer
    destroy?(): Promise<void> | void
}

export interface FixedPageRenderer<TTarget, TResult extends FixedPageRenderResult = FixedPageRenderResult> {
    readonly id: string
    readonly platform: string
    renderPage(
        document: FixedDocument,
        target: TTarget,
        pageIndex: number,
        options?: FixedPageRenderOptions,
    ): Promise<TResult>
    destroy?(): Promise<void> | void
}

export function isFixedDocument(value: unknown): value is FixedDocument {
    if (!value || typeof value !== 'object') {
        return false
    }

    const candidate = value as Partial<FixedDocument>
    return candidate.kind === 'fixed-document'
        && typeof candidate.format === 'string'
        && typeof candidate.pageCount === 'number'
        && Number.isInteger(candidate.pageCount)
        && candidate.pageCount >= 0
        && typeof candidate.getPage === 'function'
}

export function assertFixedPageIndex(document: Pick<FixedDocument, 'pageCount'>, pageIndex: number): void {
    if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= document.pageCount) {
        throw new RangeError(`Invalid fixed page index ${pageIndex}; expected 0-${Math.max(0, document.pageCount - 1)}`)
    }
}

export function createFixedPageViewport(
    page: FixedPageInfo,
    options: FixedPageViewportOptions = {},
): FixedPageViewport {
    validatePageInfo(page)

    const scale = positiveNumber(options.scale ?? 1, 'scale')
    const devicePixelRatio = positiveNumber(options.devicePixelRatio ?? 1, 'devicePixelRatio')
    const rotation = options.rotation ?? page.rotation ?? 0

    validateRotation(rotation)

    const rotated = rotation === 90 || rotation === 270
    const cssWidth = (rotated ? page.height : page.width) * scale
    const cssHeight = (rotated ? page.width : page.height) * scale
    const pixelWidth = Math.max(1, Math.round(cssWidth * devicePixelRatio))
    const pixelHeight = Math.max(1, Math.round(cssHeight * devicePixelRatio))

    return {
        pageIndex: page.index,
        scale,
        devicePixelRatio,
        rotation,
        cssWidth,
        cssHeight,
        pixelWidth,
        pixelHeight,
        pixelScaleX: pixelWidth / cssWidth,
        pixelScaleY: pixelHeight / cssHeight,
        transform: getRotationTransform(page, scale, rotation),
    }
}

function validatePageInfo(page: FixedPageInfo): void {
    if (!Number.isInteger(page.index) || page.index < 0) {
        throw new RangeError(`Invalid fixed page index ${page.index}`)
    }
    positiveNumber(page.width, 'page.width')
    positiveNumber(page.height, 'page.height')
}

function validateRotation(rotation: number): asserts rotation is FixedPageRotation {
    if (rotation !== 0 && rotation !== 90 && rotation !== 180 && rotation !== 270) {
        throw new RangeError(`Invalid fixed page rotation ${rotation}; expected 0, 90, 180, or 270`)
    }
}

function positiveNumber(value: number, name: string): number {
    if (!Number.isFinite(value) || value <= 0) {
        throw new RangeError(`${name} must be a positive finite number`)
    }
    return value
}

function getRotationTransform(page: FixedPageInfo, scale: number, rotation: FixedPageRotation): FixedPageTransform {
    switch (rotation) {
        case 90:
            return [0, scale, -scale, 0, page.height * scale, 0]
        case 180:
            return [-scale, 0, 0, -scale, page.width * scale, page.height * scale]
        case 270:
            return [0, -scale, scale, 0, 0, page.width * scale]
        default:
            return [scale, 0, 0, scale, 0, 0]
    }
}
