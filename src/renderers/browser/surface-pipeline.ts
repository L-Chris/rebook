import {
    PageSurfacePipeline,
    type PageSurfacePipelineConfig,
    type PageSurfacePipelineDecoratorContext,
    type PageSurfacePipelineRenderResult,
} from '../../core/surface-pipeline'
import type { BrowserPageComposeResult, BrowserPageCompositor, BrowserPageSurface } from './compositor'

export type BrowserSurfacePipelineDecoratorContext = PageSurfacePipelineDecoratorContext

export interface BrowserSurfacePipelineConfig<TContext>
    extends PageSurfacePipelineConfig<TContext, BrowserPageSurface, undefined, BrowserPageComposeResult> {
    readonly compositor: BrowserPageCompositor
}

export type BrowserSurfacePipelineRenderResult =
    PageSurfacePipelineRenderResult<BrowserPageSurface, BrowserPageComposeResult>

export class BrowserSurfacePipeline<TContext>
    extends PageSurfacePipeline<TContext, BrowserPageSurface, undefined, BrowserPageComposeResult> {
    constructor(config: BrowserSurfacePipelineConfig<TContext>) {
        super(config)
    }
}

export const createBrowserSurfacePipeline = <TContext>(
    config: BrowserSurfacePipelineConfig<TContext>,
): BrowserSurfacePipeline<TContext> => new BrowserSurfacePipeline(config)
