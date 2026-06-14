/**
 * Browser renderer that selects a content engine after the Book shape is known.
 *
 * ReaderSession should see one browser renderer. PDF, image/comic, and
 * reflowable engines are selected inside this renderer and all still emit the
 * same page-surface/compositor model.
 */

import {
    ContentEngineRouter,
    matchesFixedContent,
    matchesReflowableContent,
    selectContentEngineRoute,
} from '../../core/content-engine-router'
import { isFixedDocument } from '../../core/fixed-document'
import type { Book } from '../../core/types'
import type { BrowserContentEngine, BrowserContentEngineRoute } from './content-engine'

export interface BrowserAdaptiveRendererConfig {
    readonly routes: readonly BrowserContentEngineRoute[]
}

export class BrowserAdaptiveRenderer extends ContentEngineRouter<BrowserContentEngine> {
    constructor(config: BrowserAdaptiveRendererConfig) {
        super({
            routes: config.routes,
            noActiveEngineMessage: 'No browser content engine is active; open a book before navigating',
            getRouteErrorMessage: getContentEngineRouteErrorMessage,
        })
    }
}

export function createBrowserAdaptiveRenderer(
    routes: readonly BrowserContentEngineRoute[],
): BrowserAdaptiveRenderer {
    return new BrowserAdaptiveRenderer({ routes })
}

export function selectBrowserContentEngine(
    book: Book,
    routes: readonly BrowserContentEngineRoute[],
): BrowserContentEngineRoute {
    return selectContentEngineRoute(book, routes, getContentEngineRouteErrorMessage)
}

export function matchesBrowserFixedContent(book: Book): boolean {
    return matchesFixedContent(book)
}

export function matchesBrowserReflowableContent(book: Book): boolean {
    return matchesReflowableContent(book)
}

function getContentEngineRouteErrorMessage(book: Book): string {
    if (isFixedDocument(book.fixedDocument)) {
        return `No browser fixed-content engine registered for ${book.fixedDocument.format}`
    }
    return 'No browser content engine registered for this book'
}
