import type { FixedDocument } from '../../core/fixed-document'
import type { FixedPageContentRenderContext } from '../../core/fixed-page-model'
import type { BrowserPageSurfaceLayer } from './compositor'
import {
    BrowserFixedCanvasPainter,
    createDefaultFixedPainters,
    type BrowserFixedPainter,
    type BrowserFixedPainterConfig,
    type BrowserFixedPainterPreference,
    type BrowserFixedPaintMetric,
} from './fixed-painter'

export type BrowserFixedVisualRendererMatch = boolean | number

export interface BrowserFixedVisualRenderContext extends FixedPageContentRenderContext {}

export interface BrowserFixedVisualLayer extends BrowserPageSurfaceLayer {
    readonly paint?: BrowserFixedPaintMetric
}

export interface BrowserFixedVisualRenderer {
    readonly id: string
    match(document: FixedDocument): BrowserFixedVisualRendererMatch
    renderLayer(context: BrowserFixedVisualRenderContext): Promise<BrowserFixedVisualLayer | null> | BrowserFixedVisualLayer | null
    destroy?(): Promise<void> | void
}

export interface BrowserFixedPainterVisualRendererConfig extends BrowserFixedPainterConfig {
    readonly fixedPainter?: BrowserFixedPainterPreference
    readonly fixedPainters?: readonly BrowserFixedPainter[]
}

export class BrowserFixedPainterVisualRenderer implements BrowserFixedVisualRenderer {
    readonly id = 'browser-fixed-painter-visual'
    private readonly painters: readonly BrowserFixedPainter[]

    constructor(config: BrowserFixedPainterVisualRendererConfig = {}) {
        this.painters = config.fixedPainters?.length
            ? config.fixedPainters
            : createDefaultFixedPainters(config.fixedPainter ?? 'auto', config)
    }

    match(document: FixedDocument): BrowserFixedVisualRendererMatch {
        return this.getMatchingPainters(document).length > 0
    }

    async renderLayer(context: BrowserFixedVisualRenderContext): Promise<BrowserFixedVisualLayer | null> {
        for (const { painter } of this.getMatchingPainters(context.document)) {
            const result = await painter.paint(context)
            if (!result) continue
            const element = result.element
            element.dataset.rebookFixedPainterBackend = result.paint.backend
            element.dataset.rebookFixedPainterId = result.paint.id
            return {
                id: 'content',
                kind: 'content',
                contentKind: result.contentKind,
                content: element,
                zIndex: 0,
                selectable: false,
                pointerEvents: 'none',
                paint: result.paint,
                destroy: result.destroy,
            }
        }
        return null
    }

    destroy(): void {
        for (const painter of this.painters) void painter.destroy?.()
    }

    private getMatchingPainters(document: FixedDocument): Array<{ painter: BrowserFixedPainter; score: number }> {
        return this.painters
            .map(painter => ({ painter, score: matchScore(painter.match(document)) }))
            .filter(item => item.score > 0)
            .sort((left, right) => right.score - left.score)
    }
}

export function selectFixedVisualRenderer(
    document: FixedDocument,
    renderers: readonly BrowserFixedVisualRenderer[],
): BrowserFixedVisualRenderer | null {
    let selected: BrowserFixedVisualRenderer | null = null
    let selectedScore = 0
    for (const renderer of renderers) {
        const score = matchScore(renderer.match(document))
        if (score > selectedScore) {
            selected = renderer
            selectedScore = score
        }
    }
    return selected
}

export function createDefaultFixedVisualRenderers(config: BrowserFixedPainterVisualRendererConfig): BrowserFixedVisualRenderer[] {
    return [
        new BrowserFixedPainterVisualRenderer(config),
    ]
}

const matchScore = (match: BrowserFixedVisualRendererMatch): number =>
    typeof match === 'number' ? match : match ? 1 : 0

export {
    BrowserFixedCanvasPainter,
    BrowserFixedWebGpuPainter,
    createDefaultFixedPainters,
    isBrowserWebGpuSupported,
    type BrowserFixedCanvasPainterConfig,
    type BrowserFixedPaintBackend,
    type BrowserFixedPainter,
    type BrowserFixedPainterConfig,
    type BrowserFixedPainterMatch,
    type BrowserFixedPainterPreference,
    type BrowserFixedPaintMetric,
    type BrowserFixedPaintResult,
    type BrowserFixedWebGpuPainterConfig,
} from './fixed-painter'
