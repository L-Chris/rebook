import type { FixedDocument, FixedPageRenderer } from '../../core/fixed-document'
import type { FixedPageContentRenderContext } from '../../core/fixed-page-model'
import { isPdfFixedDocument } from '../../pdf/fixed-document'
import type { BrowserPageSurfaceLayer } from './compositor'
import { BrowserFixedPdfCanvasRenderer } from './fixed-pdf-canvas'

export type BrowserFixedVisualRendererMatch = boolean | number

export interface BrowserFixedVisualRenderContext extends FixedPageContentRenderContext {}

export interface BrowserFixedVisualRenderer {
    readonly id: string
    match(document: FixedDocument): BrowserFixedVisualRendererMatch
    renderLayer(context: BrowserFixedVisualRenderContext): Promise<BrowserPageSurfaceLayer | null> | BrowserPageSurfaceLayer | null
    destroy?(): Promise<void> | void
}

export interface BrowserFixedCanvasVisualRendererConfig {
    readonly fixedPageRenderer?: FixedPageRenderer<HTMLCanvasElement>
    readonly devicePixelRatio?: number | (() => number)
}

export class BrowserFixedImageVisualRenderer implements BrowserFixedVisualRenderer {
    readonly id = 'browser-fixed-image-visual'

    match(document: FixedDocument): BrowserFixedVisualRendererMatch {
        return typeof document.getPageImage === 'function'
    }

    async renderLayer(context: BrowserFixedVisualRenderContext): Promise<BrowserPageSurfaceLayer | null> {
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
}

export class BrowserFixedCanvasVisualRenderer implements BrowserFixedVisualRenderer {
    readonly id = 'browser-fixed-canvas-visual'
    private readonly configuredFixedPageRenderer?: FixedPageRenderer<HTMLCanvasElement>
    private readonly defaultPdfPageRenderer = new BrowserFixedPdfCanvasRenderer()
    private readonly devicePixelRatio?: number | (() => number)

    constructor(config: BrowserFixedCanvasVisualRendererConfig = {}) {
        this.configuredFixedPageRenderer = config.fixedPageRenderer
        this.devicePixelRatio = config.devicePixelRatio
    }

    match(document: FixedDocument): BrowserFixedVisualRendererMatch {
        return Boolean(this.getFixedPageRenderer(document))
    }

    async renderLayer(context: BrowserFixedVisualRenderContext): Promise<BrowserPageSurfaceLayer | null> {
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

export function selectFixedVisualRenderer(
    document: FixedDocument,
    renderers: readonly BrowserFixedVisualRenderer[],
): BrowserFixedVisualRenderer | null {
    let selected: BrowserFixedVisualRenderer | null = null
    let selectedScore = 0
    for (const renderer of renderers) {
        const match = renderer.match(document)
        const score = typeof match === 'number' ? match : match ? 1 : 0
        if (score > selectedScore) {
            selected = renderer
            selectedScore = score
        }
    }
    return selected
}

export function createDefaultFixedVisualRenderers(config: BrowserFixedCanvasVisualRendererConfig): BrowserFixedVisualRenderer[] {
    return [
        new BrowserFixedImageVisualRenderer(),
        new BrowserFixedCanvasVisualRenderer(config),
    ]
}
