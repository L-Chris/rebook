import {
    PageSurfaceController,
    type ContentRenderer,
    type PageSurfaceComposeOutcome,
    type PageSurfaceDecorator,
} from '../../core/page-surface'
import type { ReaderMark } from '../../core/renderer'
import { ReaderMarkStore } from '../../core/renderer-state'
import type { BrowserPageComposeResult, BrowserPageCompositor, BrowserPageSurface } from './compositor'

export interface BrowserSurfacePipelineDecoratorContext {
    getMarks(): ReaderMark[]
}

export interface BrowserSurfacePipelineConfig<TContext> {
    readonly contentRenderer: ContentRenderer<TContext, BrowserPageSurface>
    readonly compositor: BrowserPageCompositor
    readonly createDecorators?: (
        context: BrowserSurfacePipelineDecoratorContext,
    ) => readonly PageSurfaceDecorator<BrowserPageSurface>[]
}

export type BrowserSurfacePipelineRenderResult =
    | PageSurfaceComposeOutcome<BrowserPageSurface, BrowserPageComposeResult>
    | Promise<PageSurfaceComposeOutcome<BrowserPageSurface, BrowserPageComposeResult> | null>
    | null

export class BrowserSurfacePipeline<TContext> {
    private readonly marks = new ReaderMarkStore()
    private readonly controller: PageSurfaceController<
        TContext,
        BrowserPageSurface,
        undefined,
        BrowserPageComposeResult
    >

    constructor(config: BrowserSurfacePipelineConfig<TContext>) {
        const decoratorContext: BrowserSurfacePipelineDecoratorContext = {
            getMarks: () => this.getMarks(),
        }
        this.controller = new PageSurfaceController({
            contentRenderer: config.contentRenderer,
            compositor: config.compositor,
            decorators: config.createDecorators?.(decoratorContext) ?? [],
        })
    }

    render(context: TContext): BrowserSurfacePipelineRenderResult {
        return this.controller.render(context)
    }

    clear(): void {
        this.controller.clear()
    }

    destroy(): void {
        this.controller.destroy()
        this.marks.clear()
    }

    setMark(mark: ReaderMark): void {
        this.marks.set(mark)
    }

    removeMark(id: string): void {
        this.marks.remove(id)
    }

    clearMarks(kind?: string): void {
        this.marks.clear(kind)
    }

    getMarks(): ReaderMark[] {
        return this.marks.getAll()
    }

    getCurrentSurface(): BrowserPageSurface | null {
        return this.controller.getCurrentSurface()
    }
}

export const createBrowserSurfacePipeline = <TContext>(
    config: BrowserSurfacePipelineConfig<TContext>,
): BrowserSurfacePipeline<TContext> => new BrowserSurfacePipeline(config)
