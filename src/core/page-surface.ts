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
