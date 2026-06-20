/**
 * Browser reader view.
 *
 * Provides browser defaults for the shared ReaderSession.
 */

import type { ParserOptions } from '../../core/parser'
import type { NavigationDirection, RendererNavigationHooks } from '../../core/renderer'
import type { RebookPluginLike } from '../../core/extensions'
import { ReaderSession, type ReaderSessionConfig } from '../../core/reader'
import {
    BrowserAdaptiveRenderer,
    matchesBrowserFixedContent,
    matchesBrowserReflowableContent,
} from './adaptive'
import type { BrowserContentEngine, BrowserContentEngineRoute } from './content-engine'
import { BrowserDOMAdapter, BrowserURLFactory } from '../../adapters/browser'
import { BrowserRenderer, type BrowserRendererConfig } from './renderer'
import { BrowserFixedRenderer, type BrowserFixedRendererConfig } from './fixed'

export interface BrowserContentEngineRouteContext {
    readonly hooks?: RendererNavigationHooks
}

export interface BrowserConfiguredContentEngineRoute {
    readonly id: string
    match: BrowserContentEngineRoute['match']
    createEngine(context: BrowserContentEngineRouteContext): BrowserContentEngine
}

export interface ReaderConfig extends BrowserRendererConfig {
    /** Parser options */
    parserOptions?: ParserOptions
    /** Plugins to transform the book before rendering */
    plugins?: readonly RebookPluginLike[]
    /**
     * Content-engine override for fixed/page-native books. When omitted,
     * ReaderView mounts BrowserFixedRenderer behind BrowserAdaptiveRenderer.
     */
    createFixedContentEngine?: (hooks?: RendererNavigationHooks) => BrowserContentEngine
    fixedPageRenderer?: BrowserFixedRendererConfig['fixedPageRenderer']
    fixedContentRenderer?: BrowserFixedRendererConfig['fixedContentRenderer']
    fixedPainter?: BrowserFixedRendererConfig['fixedPainter']
    fixedPainters?: BrowserFixedRendererConfig['fixedPainters']
    /** Custom fixed-page visual renderers evaluated before the built-in fixed-page painter renderer. */
    fixedVisualRenderers?: BrowserFixedRendererConfig['fixedVisualRenderers']
    devicePixelRatio?: BrowserFixedRendererConfig['devicePixelRatio']
    /**
     * Content-engine override for reflowable books. When omitted, ReaderView
     * mounts BrowserRenderer behind BrowserAdaptiveRenderer.
     */
    createReflowableContentEngine?: (hooks?: RendererNavigationHooks) => BrowserContentEngine
    /**
     * Additional browser content-engine routes, evaluated before the default
     * fixed and reflowable routes.
     */
    contentEngineRoutes?: readonly BrowserConfiguredContentEngineRoute[]
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
    const context: BrowserContentEngineRouteContext = { hooks }
    return [
        ...(config.contentEngineRoutes ?? []).map((route): BrowserContentEngineRoute => ({
            id: route.id,
            match: route.match,
            createEngine: () => route.createEngine(context),
        })),
        {
            id: 'fixed-document',
            match: matchesBrowserFixedContent,
            createEngine: () => config.createFixedContentEngine
                ? config.createFixedContentEngine(hooks)
                : new BrowserFixedRenderer({
                    ...config,
                    beforeNavigate: hooks.beforeNavigate,
                }),
        },
        {
            id: 'reflowable-browser',
            match: matchesBrowserReflowableContent,
            createEngine: () => config.createReflowableContentEngine
                ? config.createReflowableContentEngine(hooks)
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
