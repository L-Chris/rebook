/**
 * WeChat Mini Program reader view.
 *
 * Provides Mini Program defaults for the shared ReaderSession.
 */

import type { ParserOptions } from '../../core/parser'
import type { NavigationDirection, RendererNavigationHooks } from '../../core/renderer'
import type { RebookPluginLike } from '../../core/extensions'
import { ReaderSession, type ReaderSessionConfig } from '../../core/reader'
import {
    WechatMiniProgramDOMAdapter,
    WechatMiniProgramURLFactory,
} from '../../adapters/wechat-miniprogram'
import {
    WechatMiniProgramRenderer,
    type WechatMiniProgramRendererConfig,
    type WechatMiniProgramRendererSnapshot,
} from './renderer'

export interface WechatMiniProgramReaderConfig extends WechatMiniProgramRendererConfig {
    /** Parser options */
    parserOptions?: ParserOptions
    /** Plugins to transform the book before rendering */
    plugins?: readonly RebookPluginLike[]
}

/**
 * Mini Program reader that combines parsing and WechatMiniProgramRenderer.
 */
export class WechatMiniProgramReader extends ReaderSession {
    constructor(config: WechatMiniProgramReaderConfig) {
        super(createWechatMiniProgramReaderSessionConfig(config))
    }

    getSnapshot(): WechatMiniProgramRendererSnapshot {
        return (this.getRenderer() as WechatMiniProgramRenderer).getSnapshot()
    }

    setViewport(width: number, height: number): void {
        (this.getRenderer() as WechatMiniProgramRenderer).setViewport(width, height)
    }

    setScrollTop(scrollTop: number): void {
        (this.getRenderer() as WechatMiniProgramRenderer).setScrollTop(scrollTop)
    }
}

function createWechatMiniProgramReaderSessionConfig(
    config: WechatMiniProgramReaderConfig,
): ReaderSessionConfig {
    return {
        parserOptions: () => ({
            domAdapter: new WechatMiniProgramDOMAdapter(),
            urlFactory: new WechatMiniProgramURLFactory(),
            ...config.parserOptions,
        }),
        plugins: config.plugins,
        createRenderer: hooks => new WechatMiniProgramRenderer({
            ...config,
            beforeNavigate: createBeforeNavigate(config.beforeNavigate, hooks?.beforeNavigate),
        }),
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
 * Create a new Mini Program reader instance.
 */
export const createWechatMiniProgramReader = (
    config: WechatMiniProgramReaderConfig,
): WechatMiniProgramReader => {
    return new WechatMiniProgramReader(config)
}
