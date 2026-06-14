/**
 * Renderer routing for books that need different rendering engines.
 *
 * ReaderSession owns a single Renderer instance. RendererRouter preserves that
 * contract while allowing the actual engine to be selected after parsing, when
 * the Book shape is known.
 */

import {
    ContentEngineRouter,
    matchesFixedContent,
    matchesReflowableContent,
    selectContentEngineRoute,
    type ContentEngineRoute,
    type ContentEngineRouteMatch,
} from './content-engine-router'
import { isFixedDocument } from './fixed-document'
import type { Book } from './types'
import type { Renderer } from './renderer'

export type RendererRouteMatch = ContentEngineRouteMatch

export interface RendererRoute {
    readonly id: string
    match(book: Book): RendererRouteMatch
    createRenderer(): Renderer
}

export interface RendererRouterConfig {
    readonly routes: readonly RendererRoute[]
}

interface RendererContentEngineRoute extends ContentEngineRoute<Renderer> {
    readonly rendererRoute: RendererRoute
}

export class RendererRouter extends ContentEngineRouter<Renderer> {
    constructor(config: RendererRouterConfig) {
        super({
            routes: config.routes.map(rendererRouteToContentEngineRoute),
            noActiveEngineMessage: 'No renderer is active; open a book before navigating',
            getRouteErrorMessage: getRendererRouteErrorMessage,
        })
    }

    getActiveRenderer(): Renderer | null {
        return this.getActiveEngine()
    }

    getActiveRouteId(): string | null {
        return this.getActiveEngineId()
    }
}

export function createRendererRouter(routes: readonly RendererRoute[]): RendererRouter {
    return new RendererRouter({ routes })
}

export function selectRendererRoute(book: Book, routes: readonly RendererRoute[]): RendererRoute {
    return selectContentEngineRoute(
        book,
        routes.map(rendererRouteToContentEngineRoute),
        getRendererRouteErrorMessage,
    ).rendererRoute
}

export function matchesFixedDocument(book: Book): boolean {
    return matchesFixedContent(book)
}

export function matchesReflowableBook(book: Book): boolean {
    return matchesReflowableContent(book)
}

function rendererRouteToContentEngineRoute(route: RendererRoute): RendererContentEngineRoute {
    return {
        id: route.id,
        match: route.match,
        createEngine: route.createRenderer,
        rendererRoute: route,
    }
}

function getRendererRouteErrorMessage(book: Book): string {
    if (isFixedDocument(book.fixedDocument)) {
        return `No fixed-document renderer registered for ${book.fixedDocument.format}`
    }
    return 'No renderer registered for this book'
}
