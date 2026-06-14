import type {
    FixedPageRenderer,
    FixedPageTextLayer,
} from '../../core/fixed-document'
import type { TextProvider, TextChunk, TextSearchResult, BookRange } from '../../core/location'
import type { ContentRenderer } from '../../core/page-surface'
import type { RendererStyles } from '../../core/renderer'
import {
    createFixedPageTextProvider,
    emptyFixedPageTextLayer,
} from '../../core/fixed-text-provider'
import type { BrowserPageSurface, BrowserPageSurfaceLayer } from './compositor'
import {
    createDefaultFixedVisualRenderers,
    selectFixedVisualRenderer,
    type BrowserFixedVisualRenderer,
    type BrowserFixedVisualRenderContext,
} from './fixed-visual'

export interface BrowserFixedSpreadPageRenderContext {
    readonly context: BrowserFixedVisualRenderContext
    readonly x: number
    readonly y: number
}

export interface BrowserFixedSpreadContentRenderContext {
    readonly document: BrowserFixedVisualRenderContext['document']
    readonly styles: RendererStyles
    readonly pages: readonly BrowserFixedSpreadPageRenderContext[]
    readonly width: number
    readonly height: number
    readonly scale: number
}

export interface BrowserFixedContentRendererConfig {
    readonly fixedPageRenderer?: FixedPageRenderer<HTMLCanvasElement>
    readonly devicePixelRatio?: number | (() => number)
    /** Custom visual renderers evaluated before the built-in image/PDF renderers. */
    readonly visualRenderers?: readonly BrowserFixedVisualRenderer[]
}

export type BrowserFixedContentRenderContext = BrowserFixedVisualRenderContext | BrowserFixedSpreadContentRenderContext

const DEFAULT_TEXT_COLOR = '#111111'
const DEFAULT_FONT_FAMILY = 'sans-serif'
const DEFAULT_ASCENT_RATIO = 0.8

export class BrowserFixedContentRenderer implements ContentRenderer<BrowserFixedContentRenderContext, BrowserPageSurface> {
    readonly id = 'browser-fixed-content'
    private readonly visualRenderers: readonly BrowserFixedVisualRenderer[]
    private readonly measureTextWidth = createCanvasTextMeasurer()
    private readonly measureFontAscentRatio = createCanvasFontAscentRatioMeasurer()

    constructor(config: BrowserFixedContentRendererConfig = {}) {
        this.visualRenderers = [
            ...(config.visualRenderers ?? []),
            ...createDefaultFixedVisualRenderers(config),
        ]
    }

    destroy(): void {
        for (const renderer of this.visualRenderers) void renderer.destroy?.()
    }

    async renderSurface(context: BrowserFixedContentRenderContext): Promise<BrowserPageSurface> {
        if (isSpreadContext(context)) return this.renderSpreadSurface(context)
        return this.renderPageSurface(context)
    }

    private async renderPageSurface(context: BrowserFixedVisualRenderContext): Promise<BrowserPageSurface> {
        const text = context.document.getPageText
            ? await context.document.getPageText(context.page.index)
            : emptyFixedPageTextLayer(context.page)
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
            textProvider: createFixedPageTextProvider(text, context.document.format),
            destroy() {
                for (const layer of layers) layer.destroy?.()
            },
        }
    }

    private async renderSpreadSurface(context: BrowserFixedSpreadContentRenderContext): Promise<BrowserPageSurface> {
        const renderedPages = await Promise.all(context.pages.map(async item => ({
            ...item,
            surface: await this.renderPageSurface(item.context),
        })))
        const layer = document.createElement('div')
        layer.dataset.rebookFixedSpreadLayer = 'true'
        layer.style.position = 'relative'
        layer.style.width = `${context.width}px`
        layer.style.height = `${context.height}px`

        for (const item of renderedPages) {
            const frame = document.createElement('div')
            frame.dataset.rebookSpreadPage = 'true'
            frame.dataset.pageIndex = String(item.surface.pageIndex ?? item.context.page.index)
            frame.style.cssText = `
                position: absolute;
                left: ${item.x}px;
                top: ${item.y}px;
                width: ${item.surface.width}px;
                height: ${item.surface.height}px;
                background: #ffffff;
                box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
                overflow: hidden;
                box-sizing: border-box;
            `
            for (const pageLayer of item.surface.layers) mountUnscaledLayer(frame, item.surface, pageLayer)
            layer.append(frame)
        }

        const layers: BrowserPageSurfaceLayer[] = [{
            id: 'spread',
            kind: 'content',
            contentKind: 'dom',
            content: layer,
            zIndex: 0,
            selectable: true,
            pointerEvents: 'auto',
        }]
        const pageMetadata = renderedPages.map(item => ({
            x: item.x,
            y: item.y,
            page: item.context.page,
            surface: item.surface,
        }))

        return {
            id: `${context.document.format}:spread:${renderedPages.map(item => item.context.page.index).join('-')}`,
            kind: 'spread',
            pageIndex: renderedPages[0]?.context.page.index,
            width: context.width,
            height: context.height,
            scale: context.scale,
            location: renderedPages[0]?.surface.location,
            layers,
            metadata: {
                pages: pageMetadata,
            },
            textProvider: createSpreadTextProvider(renderedPages.map(item => item.surface.textProvider).filter(isTextProvider)),
            destroy() {
                layer.remove()
                for (const item of renderedPages) item.surface.destroy?.()
            },
        }
    }

    private async renderContentLayer(context: BrowserFixedVisualRenderContext): Promise<BrowserPageSurfaceLayer | null> {
        const renderer = selectFixedVisualRenderer(context.document, this.visualRenderers)
        return await renderer?.renderLayer(context) ?? null
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

}

export const createBrowserFixedContentRenderer = (config?: BrowserFixedContentRendererConfig): BrowserFixedContentRenderer =>
    new BrowserFixedContentRenderer(config)

export {
    BrowserFixedCanvasVisualRenderer,
    BrowserFixedImageVisualRenderer,
    selectFixedVisualRenderer,
    type BrowserFixedCanvasVisualRendererConfig,
    type BrowserFixedVisualRenderContext,
    type BrowserFixedVisualRenderer,
    type BrowserFixedVisualRendererMatch,
} from './fixed-visual'

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

function isSpreadContext(context: BrowserFixedContentRenderContext): context is BrowserFixedSpreadContentRenderContext {
    return 'pages' in context
}

function mountUnscaledLayer(frame: HTMLElement, surface: BrowserPageSurface, layer: BrowserPageSurfaceLayer): void {
    const element = layer.content
    element.dataset.rebookSurfaceLayer = layer.id
    element.dataset.rebookSurfaceLayerKind = layer.kind
    element.dataset.rebookSurfaceLayerContent = layer.contentKind
    element.style.position = 'absolute'
    element.style.left = '0'
    element.style.top = '0'
    element.style.width = `${surface.width}px`
    element.style.height = `${surface.height}px`
    element.style.transformOrigin = '0 0'
    element.style.zIndex = String(layer.zIndex ?? 0)
    element.style.pointerEvents = layer.pointerEvents ?? (layer.kind === 'content' ? 'none' : 'auto')
    element.style.userSelect = layer.selectable === false ? 'none' : 'text'
    if (layer.opacity !== undefined) element.style.opacity = String(layer.opacity)
    frame.append(element)
}

function createSpreadTextProvider(providers: readonly TextProvider[]): TextProvider | undefined {
    if (providers.length === 0) return undefined
    return {
        async getText(range?: BookRange): Promise<readonly TextChunk[]> {
            return (await Promise.all(providers.map(provider => provider.getText(range)))).flat()
        },
        async search(query: string, range?: BookRange): Promise<readonly TextSearchResult[]> {
            return (await Promise.all(providers.map(provider => provider.search?.(query, range) ?? []))).flat()
        },
    }
}

function isTextProvider(value: TextProvider | undefined): value is TextProvider {
    return value !== undefined
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
