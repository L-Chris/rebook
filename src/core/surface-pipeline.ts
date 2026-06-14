import {
    PageSurfaceController,
    type ContentRenderer,
    type PageCompositor,
    type PageSurface,
    type PageSurfaceComposeOutcome,
    type PageSurfaceDecorator,
    type PageSurfaceRequest,
} from './page-surface'
import type { ReaderMark } from './renderer'
import { ReaderMarkStore } from './renderer-state'

export interface PageSurfacePipelineDecoratorContext {
    getMarks(): ReaderMark[]
}

export interface PageSurfacePipelineConfig<
    TContext,
    TSurface extends PageSurface = PageSurface,
    TTarget = unknown,
    TResult = unknown,
> {
    readonly contentRenderer: ContentRenderer<TContext, TSurface>
    readonly compositor: PageCompositor<TSurface, TTarget, TResult>
    readonly createDecorators?: (
        context: PageSurfacePipelineDecoratorContext,
    ) => readonly PageSurfaceDecorator<TSurface>[]
}

export type PageSurfacePipelineRenderResult<
    TSurface extends PageSurface = PageSurface,
    TResult = unknown,
> =
    | PageSurfaceComposeOutcome<TSurface, TResult>
    | Promise<PageSurfaceComposeOutcome<TSurface, TResult> | null>
    | null

export class PageSurfacePipeline<
    TContext,
    TSurface extends PageSurface = PageSurface,
    TTarget = unknown,
    TResult = unknown,
> {
    private readonly marks = new ReaderMarkStore()
    private readonly controller: PageSurfaceController<TContext, TSurface, TTarget, TResult>

    constructor(config: PageSurfacePipelineConfig<TContext, TSurface, TTarget, TResult>) {
        const decoratorContext: PageSurfacePipelineDecoratorContext = {
            getMarks: () => this.getMarks(),
        }
        this.controller = new PageSurfaceController({
            contentRenderer: config.contentRenderer,
            compositor: config.compositor,
            decorators: config.createDecorators?.(decoratorContext) ?? [],
        })
    }

    render(
        context: TContext,
        target?: TTarget,
        request?: PageSurfaceRequest,
    ): PageSurfacePipelineRenderResult<TSurface, TResult> {
        return this.controller.render(context, target, request)
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

    getCurrentSurface(): TSurface | null {
        return this.controller.getCurrentSurface()
    }
}

export const createPageSurfacePipeline = <
    TContext,
    TSurface extends PageSurface = PageSurface,
    TTarget = unknown,
    TResult = unknown,
>(
    config: PageSurfacePipelineConfig<TContext, TSurface, TTarget, TResult>,
): PageSurfacePipeline<TContext, TSurface, TTarget, TResult> =>
    new PageSurfacePipeline(config)
