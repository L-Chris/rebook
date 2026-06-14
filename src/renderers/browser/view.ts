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
    BrowserAdaptiveRenderer,
    matchesBrowserFixedContent,
    matchesBrowserReflowableContent,
    type BrowserContentEngineRoute,
} from './adaptive'
import { BrowserDOMAdapter, BrowserURLFactory } from '../../adapters/browser'
import { BrowserRenderer, type BrowserRendererConfig } from './renderer'
import { BrowserFixedRenderer, type BrowserFixedRendererConfig } from './fixed'

export interface BrowserRendererRouteContext {
    readonly hooks?: RendererNavigationHooks
}

export interface BrowserRendererRoute {
    readonly id: string
    match: BrowserContentEngineRoute['match']
    createRenderer(context: BrowserRendererRouteContext): Renderer
}

export interface ReaderConfig extends BrowserRendererConfig {
    /** Parser options */
    parserOptions?: ParserOptions
    /** Plugins to transform the book before rendering */
    plugins?: readonly RebookPlugin[]
    /**
     * Content-engine override for fixed/page-native books. When omitted,
     * ReaderView mounts BrowserFixedRenderer behind BrowserAdaptiveRenderer.
     */
    createFixedRenderer?: (hooks?: RendererNavigationHooks) => Renderer
    fixedPageRenderer?: BrowserFixedRendererConfig['fixedPageRenderer']
    fixedContentRenderer?: BrowserFixedRendererConfig['fixedContentRenderer']
    /** Custom fixed-page visual renderers evaluated before built-in image/PDF renderers. */
    fixedVisualRenderers?: BrowserFixedRendererConfig['fixedVisualRenderers']
    devicePixelRatio?: BrowserFixedRendererConfig['devicePixelRatio']
    /**
     * Content-engine override for reflowable books. When omitted, ReaderView
     * mounts BrowserRenderer behind BrowserAdaptiveRenderer.
     */
    createReflowableRenderer?: (hooks?: RendererNavigationHooks) => Renderer
    /**
     * Additional browser content-engine routes, evaluated before the default
     * fixed and reflowable routes.
     */
    rendererRoutes?: readonly BrowserRendererRoute[]
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
            return new BrowserAdaptiveRenderer({
                routes: createBrowserContentEngineRoutes(config, rendererHooks),
            })
        },
    }
}

function createBrowserContentEngineRoutes(
    config: ReaderConfig,
    hooks: RendererNavigationHooks,
): BrowserContentEngineRoute[] {
    const context: BrowserRendererRouteContext = { hooks }
    return [
        ...(config.rendererRoutes ?? []).map((route): BrowserContentEngineRoute => ({
            id: route.id,
            match: route.match,
            createRenderer: () => route.createRenderer(context),
        })),
        {
            id: 'fixed-document',
            match: matchesBrowserFixedContent,
            createRenderer: () => config.createFixedRenderer
                ? config.createFixedRenderer(hooks)
                : new BrowserFixedRenderer({
                    ...config,
                    beforeNavigate: hooks.beforeNavigate,
                }),
        },
        {
            id: 'reflowable-browser',
            match: matchesBrowserReflowableContent,
            createRenderer: () => config.createReflowableRenderer
                ? config.createReflowableRenderer(hooks)
                : new BrowserRenderer({
                    ...config,
                    beforeNavigate: hooks.beforeNavigate,
                }),
        },
    ]
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
