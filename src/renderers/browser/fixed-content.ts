import type {
    FixedPageRenderer,
    FixedPageTextLayer,
} from '../../core/fixed-document'
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

export interface BrowserFixedContentRendererConfig {
    readonly fixedPageRenderer?: FixedPageRenderer<HTMLCanvasElement>
    readonly devicePixelRatio?: number | (() => number)
    /** Custom visual renderers evaluated before the built-in image/PDF renderers. */
    readonly visualRenderers?: readonly BrowserFixedVisualRenderer[]
}

export type BrowserFixedContentRenderContext = BrowserFixedVisualRenderContext

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

    private async renderContentLayer(context: BrowserFixedContentRenderContext): Promise<BrowserPageSurfaceLayer | null> {
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
