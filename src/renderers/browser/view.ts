/**
 * Browser reader view.
 *
 * Provides browser defaults for the shared ReaderSession.
 */

import type { ParserOptions } from '../../core/parser'
import type { NavigationDirection, Renderer, RendererNavigationHooks } from '../../core/renderer'
import type { RebookPlugin } from '../../core/types'
import { ReaderSession, type ReaderSessionConfig } from '../../core/reader'
import {
    createRendererRouter,
    matchesFixedDocument,
    matchesReflowableBook,
} from '../../core/renderer-router'
import { BrowserDOMAdapter, BrowserURLFactory } from '../../adapters/browser'
import { BrowserRenderer, type BrowserRendererConfig } from './renderer'
import { BrowserFixedRenderer } from './fixed'

export interface ReaderConfig extends BrowserRendererConfig {
    /** Parser options */
    parserOptions?: ParserOptions
    /** Plugins to transform the book before rendering */
    plugins?: readonly RebookPlugin[]
    /**
     * Renderer factory override for fixed/page-native books. When omitted,
     * ReaderView uses BrowserFixedRenderer.
     */
    createFixedRenderer?: (hooks?: RendererNavigationHooks) => Renderer
}

/**
 * Browser reader that combines parsing and BrowserRenderer.
 */
export class ReaderView extends ReaderSession {
    constructor(config: ReaderConfig) {
        super(createBrowserReaderSessionConfig(config))
    }
}

function createBrowserReaderSessionConfig(config: ReaderConfig): ReaderSessionConfig {
    return {
        parserOptions: () => ({
            domAdapter: new BrowserDOMAdapter(),
            urlFactory: new BrowserURLFactory(),
            ...config.parserOptions,
        }),
        plugins: config.plugins,
        createRenderer: hooks => {
            const beforeNavigate = createBeforeNavigate(config.beforeNavigate, hooks?.beforeNavigate)
            const rendererHooks = {
                ...hooks,
                beforeNavigate,
            }
            return createRendererRouter([
                {
                    id: 'fixed-document',
                    match: matchesFixedDocument,
                    createRenderer: () => config.createFixedRenderer
                        ? config.createFixedRenderer(rendererHooks)
                        : new BrowserFixedRenderer({
                            ...config,
                            beforeNavigate,
                        }),
                },
                {
                    id: 'reflowable-browser',
                    match: matchesReflowableBook,
                    createRenderer: () => new BrowserRenderer({
                        ...config,
                        beforeNavigate,
                    }),
                },
            ])
        },
    }
}

function createBeforeNavigate(
    configHook?: RendererNavigationHooks['beforeNavigate'],
    sessionHook?: RendererNavigationHooks['beforeNavigate'],
): (direction: NavigationDirection) => Promise<boolean> {
    return async direction => {
        if (configHook && await configHook(direction) === false) return false
        if (sessionHook && await sessionHook(direction) === false) return false
        return true
    }
}

/**
 * Create a new browser ReaderView instance.
 */
export const createReader = (config: ReaderConfig): ReaderView => {
    return new ReaderView(config)
}
