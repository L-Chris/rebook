import type {
    FixedDocument,
    FixedPageInfo,
    FixedPageRenderer,
    FixedPageTextLayer,
    FixedPageTextRun,
} from '../../core/fixed-document'
import type { ContentRenderer } from '../../core/page-surface'
import type { RendererStyles } from '../../core/renderer'
import { isPdfFixedDocument } from '../../pdf/fixed-document'
import { BrowserPdfCanvasRenderer } from './pdf-canvas'
import type { BrowserPageSurface, BrowserPageSurfaceLayer } from './compositor'

export interface BrowserFixedContentRendererConfig {
    readonly fixedPageRenderer?: FixedPageRenderer<HTMLCanvasElement>
    readonly devicePixelRatio?: number | (() => number)
}

export interface BrowserFixedContentRenderContext {
    readonly document: FixedDocument
    readonly page: FixedPageInfo
    readonly scale: number
    readonly styles: RendererStyles
}

const DEFAULT_TEXT_COLOR = '#111111'
const DEFAULT_FONT_FAMILY = 'sans-serif'
const DEFAULT_ASCENT_RATIO = 0.8

export class BrowserFixedContentRenderer implements ContentRenderer<BrowserFixedContentRenderContext, BrowserPageSurface> {
    readonly id = 'browser-fixed-content'
    private readonly configuredFixedPageRenderer?: FixedPageRenderer<HTMLCanvasElement>
    private readonly defaultPdfPageRenderer = new BrowserPdfCanvasRenderer()
    private readonly devicePixelRatio?: number | (() => number)
    private readonly measureTextWidth = createCanvasTextMeasurer()
    private readonly measureFontAscentRatio = createCanvasFontAscentRatioMeasurer()

    constructor(config: BrowserFixedContentRendererConfig = {}) {
        this.configuredFixedPageRenderer = config.fixedPageRenderer
        this.devicePixelRatio = config.devicePixelRatio
    }

    destroy(): void {}

    async renderSurface(context: BrowserFixedContentRenderContext): Promise<BrowserPageSurface> {
        const text = context.document.getPageText
            ? await context.document.getPageText(context.page.index)
            : emptyTextLayer(context.page)
        const visual = await this.renderContentLayer(context)
        const textLayer = this.createTextLayer(text, context.styles, visual !== null)
        const layers: BrowserPageSurfaceLayer[] = []

        if (visual) layers.push(visual)
        layers.push(textLayer)

        return {
            id: `${context.document.format}:${context.page.index}`,
            kind: context.document.getPageImage ? 'image-page' : 'fixed-page',
            pageIndex: context.page.index,
            width: context.page.width,
            height: context.page.height,
            scale: context.scale,
            location: {
                type: context.document.format === 'cbz' ? 'image' : 'fixed',
                format: context.document.format,
                pageIndex: context.page.index,
            },
            layers,
            metadata: {
                textLayer: text,
                visualRendered: visual !== null,
            },
            destroy() {
                for (const layer of layers) layer.destroy?.()
            },
        }
    }

    private async renderContentLayer(context: BrowserFixedContentRenderContext): Promise<BrowserPageSurfaceLayer | null> {
        if (context.document.getPageImage) {
            return this.renderImageLayer(context)
        }

        const renderer = this.getFixedPageRenderer(context.document)
        if (!renderer) return null

        const canvas = document.createElement('canvas')
        canvas.dataset.rebookFixedCanvas = 'true'
        try {
            await renderer.renderPage(context.document, canvas, context.page.index, {
                scale: context.scale,
                devicePixelRatio: this.getDevicePixelRatio(),
                intent: 'display',
                textLayer: false,
            })
            return {
                id: 'content',
                kind: 'content',
                contentKind: 'canvas',
                content: canvas,
                zIndex: 0,
                selectable: false,
                pointerEvents: 'none',
            }
        } catch {
            canvas.remove()
            return null
        }
    }

    private async renderImageLayer(context: BrowserFixedContentRenderContext): Promise<BrowserPageSurfaceLayer | null> {
        const image = await context.document.getPageImage?.(context.page.index)
        if (!image) return null

        const element = document.createElement('img')
        element.dataset.rebookFixedImage = 'true'
        element.src = image.src
        element.alt = image.alt ?? ''
        element.style.display = 'block'
        element.style.objectFit = 'contain'

        return {
            id: 'content',
            kind: 'content',
            contentKind: 'image',
            content: element,
            zIndex: 0,
            selectable: false,
            pointerEvents: 'none',
        }
    }

    private createTextLayer(text: FixedPageTextLayer, styles: RendererStyles, visualRendered: boolean): BrowserPageSurfaceLayer {
        const layer = document.createElement('div')
        layer.dataset.rebookFixedTextLayer = 'true'
        layer.style.userSelect = 'text'
        renderTextLayer(layer, text, {
            color: visualRendered ? 'transparent' : styles.color ?? DEFAULT_TEXT_COLOR,
            fontFamily: styles.fontFamily,
            measureTextWidth: this.measureTextWidth,
            measureFontAscentRatio: this.measureFontAscentRatio,
        })
        return {
            id: 'text',
            kind: 'text',
            contentKind: 'dom',
            content: layer,
            zIndex: 10,
            selectable: true,
            pointerEvents: 'auto',
        }
    }

    private getFixedPageRenderer(fixedDocument: FixedDocument): FixedPageRenderer<HTMLCanvasElement> | undefined {
        if (this.configuredFixedPageRenderer) return this.configuredFixedPageRenderer
        return isPdfFixedDocument(fixedDocument) ? this.defaultPdfPageRenderer : undefined
    }

    private getDevicePixelRatio(): number {
        const configured = typeof this.devicePixelRatio === 'function'
            ? this.devicePixelRatio()
            : this.devicePixelRatio
        const ratio = configured ?? globalThis.devicePixelRatio ?? 1
        return Number.isFinite(ratio) && ratio > 0 ? ratio : 1
    }
}

export const createBrowserFixedContentRenderer = (config?: BrowserFixedContentRendererConfig): BrowserFixedContentRenderer =>
    new BrowserFixedContentRenderer(config)

interface TextLayerRenderOptions {
    color: string
    fontFamily?: string | number
    measureTextWidth?: ReturnType<typeof createCanvasTextMeasurer>
    measureFontAscentRatio?: ReturnType<typeof createCanvasFontAscentRatioMeasurer>
}

function renderTextLayer(target: HTMLElement, layer: FixedPageTextLayer, options: TextLayerRenderOptions): void {
    target.replaceChildren()
    for (const run of layer.runs) {
        const span = document.createElement('span')
        const matrix = run.transform
        const fontSize = run.fontSize ?? Math.max(Math.abs(matrix[0]), Math.abs(matrix[3]), 1)
        const fontFamily = String(options.fontFamily ?? run.fontFamily ?? DEFAULT_FONT_FAMILY)
        const fontStyle = run.fontStyle ?? 'normal'
        const fontWeight = run.fontWeight ?? 'normal'
        const x = matrix[4]
        const y = matrix[5]
        const ascentRatio = options.measureFontAscentRatio?.(fontSize, fontFamily, fontStyle, fontWeight) ?? DEFAULT_ASCENT_RATIO
        const ascent = fontSize * ascentRatio

        span.textContent = run.text
        span.style.position = 'absolute'
        span.style.whiteSpace = 'pre'
        span.style.left = `${x}px`
        span.style.top = `${y - ascent}px`
        span.style.fontSize = `${fontSize}px`
        span.style.fontFamily = fontFamily
        span.style.fontStyle = fontStyle
        span.style.fontWeight = fontWeight
        span.style.lineHeight = '1'
        span.style.transformOrigin = '0 0'
        span.style.color = options.color
        span.style.userSelect = 'text'

        if (run.width !== undefined) {
            const measured = options.measureTextWidth?.(run.text, fontSize, fontFamily, fontStyle, fontWeight)
            if (measured && measured > 0) span.style.transform = `scaleX(${run.width / measured})`
            else span.style.width = `${run.width}px`
        }

        target.append(span)
    }
}

function emptyTextLayer(page: FixedPageInfo): FixedPageTextLayer {
    return {
        pageIndex: page.index,
        width: page.width,
        height: page.height,
        runs: [],
        text: '',
    }
}

function createCanvasFontAscentRatioMeasurer(): ((fontSize: number, fontFamily: string, fontStyle?: string, fontWeight?: string) => number) | undefined {
    const canvas = document.createElement('canvas') as HTMLCanvasElement
    const context = canvas.getContext?.('2d')
    if (!context) return undefined
    const cache = new Map<string, number>()
    return (fontSize, fontFamily, fontStyle = 'normal', fontWeight = 'normal') => {
        const key = `${fontStyle}/${fontWeight}/${fontFamily}`
        const cached = cache.get(key)
        if (cached !== undefined) return cached
        context.font = `${fontStyle} ${fontWeight} ${Math.max(1, fontSize)}px ${fontFamily}`
        const metrics = context.measureText('')
        const ascent = metrics.fontBoundingBoxAscent
        const descent = Math.abs(metrics.fontBoundingBoxDescent)
        const ratio = ascent > 0 && ascent + descent > 0 ? ascent / (ascent + descent) : DEFAULT_ASCENT_RATIO
        cache.set(key, ratio)
        return ratio
    }
}

function createCanvasTextMeasurer(): ((text: string, fontSize: number, fontFamily: string, fontStyle?: string, fontWeight?: string) => number) | undefined {
    const canvas = document.createElement('canvas') as HTMLCanvasElement
    const context = canvas.getContext?.('2d')
    if (!context) return undefined
    return (text, fontSize, fontFamily, fontStyle = 'normal', fontWeight = 'normal') => {
        context.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`
        return context.measureText(text).width
    }
}
