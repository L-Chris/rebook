import {
    createFixedPageViewport,
    type FixedDocument,
    type FixedPageRenderOptions,
    type FixedPageRenderResult,
    type FixedPageRenderer,
} from '../../core/fixed-document'
import { UnsupportedFormatError } from '../../core/errors'
import { isPdfFixedDocument } from '../../pdf/fixed-document'
import {
    Canvas2DRenderer,
    createCanvas2DRenderer,
    type Canvas2DRendererOptions,
} from '../../pdf/renderers/canvas'

export interface BrowserPdfCanvasRenderResult extends FixedPageRenderResult {
    readonly ops: number
}

export interface BrowserPdfCanvasRendererConfig extends Canvas2DRendererOptions {
    readonly renderer?: Canvas2DRenderer
}

export class BrowserPdfCanvasRenderer implements FixedPageRenderer<HTMLCanvasElement, BrowserPdfCanvasRenderResult> {
    readonly id = 'browser-pdf-canvas'
    readonly platform = 'browser'
    private readonly renderer: Canvas2DRenderer

    constructor(config: BrowserPdfCanvasRendererConfig = {}) {
        const { renderer, ...rendererOptions } = config
        this.renderer = renderer ?? createCanvas2DRenderer(rendererOptions)
    }

    async renderPage(
        document: FixedDocument,
        target: HTMLCanvasElement,
        pageIndex: number,
        options: FixedPageRenderOptions = {},
    ): Promise<BrowserPdfCanvasRenderResult> {
        if (!isPdfFixedDocument(document)) {
            throw new UnsupportedFormatError('BrowserPdfCanvasRenderer requires a PDF fixed document')
        }

        const page = await document.getPage(pageIndex)
        const viewport = createFixedPageViewport(page, options)
        const context = target.getContext('2d')
        if (!context) throw new UnsupportedFormatError('BrowserPdfCanvasRenderer requires a 2D canvas context')

        const result = await this.renderer.renderPage(
            { document },
            context,
            { pageIndex, scale: viewport.scale * viewport.devicePixelRatio },
        )

        target.style.width = `${viewport.cssWidth}px`
        target.style.height = `${viewport.cssHeight}px`

        return {
            pageIndex,
            cssWidth: viewport.cssWidth,
            cssHeight: viewport.cssHeight,
            pixelWidth: result.width,
            pixelHeight: result.height,
            scale: viewport.scale,
            devicePixelRatio: viewport.devicePixelRatio,
            ops: result.ops,
        }
    }
}

export const createBrowserPdfCanvasRenderer = (config?: BrowserPdfCanvasRendererConfig): BrowserPdfCanvasRenderer =>
    new BrowserPdfCanvasRenderer(config)
