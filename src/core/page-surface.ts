/**
 * Page surface and compositor contracts.
 *
 * Format adapters and content renderers produce surfaces. Platform compositors
 * decide how to mount, cache, animate, and overlay those surfaces.
 */

import type { BookLocation, TextProvider } from './location'

export const REBOOK_PAGE_SURFACE_MODEL_VERSION = 1

export type PageSurfaceKind = 'fixed-page' | 'reflowable-page' | 'image-page' | 'spread'
export type PageSurfaceLayerKind = 'content' | 'text' | 'annotation' | 'overlay' | 'interaction'
export type PageSurfaceLayerContentKind = 'dom' | 'canvas' | 'image' | 'texture' | 'custom'

export interface PageSurfaceLayer<TContent = unknown> {
    readonly id: string
    readonly kind: PageSurfaceLayerKind
    readonly contentKind: PageSurfaceLayerContentKind
    readonly content: TContent
    readonly zIndex?: number
    readonly selectable?: boolean
    readonly pointerEvents?: 'auto' | 'none'
    readonly opacity?: number
    readonly location?: BookLocation
    destroy?(): void
}

export interface PageSurface<TLayer extends PageSurfaceLayer = PageSurfaceLayer> {
    readonly id: string
    readonly kind: PageSurfaceKind
    readonly pageIndex?: number
    readonly width: number
    readonly height: number
    readonly scale: number
    readonly location?: BookLocation
    readonly layers: readonly TLayer[]
    readonly textProvider?: TextProvider
    readonly metadata?: Readonly<Record<string, unknown>>
    destroy?(): void
}

export interface PageSurfaceRequest {
    readonly pageIndex: number
    readonly scale: number
    readonly reason?: string
}

export interface ContentRenderer<TContext = unknown, TSurface extends PageSurface = PageSurface> {
    readonly id: string
    readonly format?: string
    renderSurface(context: TContext, request?: PageSurfaceRequest): Promise<TSurface> | TSurface
    destroy?(): Promise<void> | void
}

export interface PageCompositor<TSurface extends PageSurface = PageSurface, TTarget = unknown, TResult = unknown> {
    readonly id: string
    compose(surface: TSurface, target?: TTarget): Promise<TResult> | TResult
    clear?(): void
    destroy?(): Promise<void> | void
}

export interface PageSurfaceControllerConfig<
    TContext,
    TSurface extends PageSurface = PageSurface,
    TTarget = unknown,
    TResult = unknown,
> {
    readonly contentRenderer: ContentRenderer<TContext, TSurface>
    readonly compositor: PageCompositor<TSurface, TTarget, TResult>
}

export interface PageSurfaceComposeOutcome<
    TSurface extends PageSurface = PageSurface,
    TResult = unknown,
> {
    readonly surface: TSurface
    readonly result: TResult
}

export class PageSurfaceController<
    TContext,
    TSurface extends PageSurface = PageSurface,
    TTarget = unknown,
    TResult = unknown,
> {
    private readonly contentRenderer: ContentRenderer<TContext, TSurface>
    private readonly compositor: PageCompositor<TSurface, TTarget, TResult>
    private sequence = 0

    constructor(config: PageSurfaceControllerConfig<TContext, TSurface, TTarget, TResult>) {
        this.contentRenderer = config.contentRenderer
        this.compositor = config.compositor
    }

    render(
        context: TContext,
        target?: TTarget,
        request?: PageSurfaceRequest,
    ):
        | PageSurfaceComposeOutcome<TSurface, TResult>
        | Promise<PageSurfaceComposeOutcome<TSurface, TResult> | null>
        | null {
        const token = ++this.sequence
        const surface = this.contentRenderer.renderSurface(context, request)
        if (isPromiseLike(surface)) {
            return surface.then(rendered => this.composeCurrent(token, rendered, target))
        }
        return this.composeCurrent(token, surface, target)
    }

    cancelPending(): void {
        this.sequence++
    }

    clear(): void {
        this.cancelPending()
        this.compositor.clear?.()
    }

    private composeCurrent(
        token: number,
        surface: TSurface,
        target?: TTarget,
    ):
        | PageSurfaceComposeOutcome<TSurface, TResult>
        | Promise<PageSurfaceComposeOutcome<TSurface, TResult> | null>
        | null {
        if (token !== this.sequence) {
            surface.destroy?.()
            return null
        }

        let result: Promise<TResult> | TResult
        try {
            result = this.compositor.compose(surface, target)
        } catch (error) {
            surface.destroy?.()
            throw error
        }

        if (isPromiseLike(result)) {
            return result.then(composed => (
                token === this.sequence ? { surface, result: composed } : null
            ))
        }
        return { surface, result }
    }
}

function isPromiseLike<T>(value: Promise<T> | T): value is Promise<T> {
    return typeof (value as { then?: unknown })?.then === 'function'
}
