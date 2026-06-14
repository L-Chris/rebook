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
    createWebGpuRenderer,
    type WebGpuRenderer,
    type WebGpuRendererOptions,
} from '../../pdf/paint/webgpu'

export interface BrowserFixedPdfWebGpuRenderResult extends FixedPageRenderResult {
    readonly ops: number
    readonly drawCalls: number
    readonly glyphs: number
    readonly paths: number
    readonly images: number
    readonly unsupportedOps: number
}

export interface BrowserFixedPdfWebGpuRendererConfig extends WebGpuRendererOptions {
    readonly renderer?: WebGpuRenderer
}

export class BrowserFixedPdfWebGpuRenderer implements FixedPageRenderer<HTMLCanvasElement, BrowserFixedPdfWebGpuRenderResult> {
    readonly id = 'browser-fixed-pdf-webgpu'
    readonly platform = 'browser'
    private readonly renderer: WebGpuRenderer

    constructor(config: BrowserFixedPdfWebGpuRendererConfig = {}) {
        const { renderer, ...rendererOptions } = config
        this.renderer = renderer ?? createWebGpuRenderer(rendererOptions)
    }

    async renderPage(
        document: FixedDocument,
        target: HTMLCanvasElement,
        pageIndex: number,
        options: FixedPageRenderOptions = {},
    ): Promise<BrowserFixedPdfWebGpuRenderResult> {
        if (!isPdfFixedDocument(document)) {
            throw new UnsupportedFormatError('BrowserFixedPdfWebGpuRenderer requires a PDF fixed document')
        }

        const page = await document.getPage(pageIndex)
        const viewport = createFixedPageViewport(page, options)
        const result = await this.renderer.renderPage(
            { document },
            target,
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
            drawCalls: result.drawCalls,
            glyphs: result.glyphs,
            paths: result.paths,
            images: result.images,
            unsupportedOps: result.unsupportedOps,
        }
    }

    destroy(): void {
        this.renderer.destroy()
    }
}

export const createBrowserFixedPdfWebGpuRenderer = (config?: BrowserFixedPdfWebGpuRendererConfig): BrowserFixedPdfWebGpuRenderer =>
    new BrowserFixedPdfWebGpuRenderer(config)
