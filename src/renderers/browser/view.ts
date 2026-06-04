/**
 * Browser reader view.
 *
 * Provides browser defaults for the shared ReaderSession.
 */

import type { ParserOptions } from '../../core/parser'
import type { RebookPlugin } from '../../core/types'
import { ReaderSession, type ReaderSessionConfig } from '../../core/reader'
import { BrowserDOMAdapter, BrowserURLFactory } from '../../adapters/browser'
import { BrowserRenderer, type BrowserRendererConfig } from './renderer'

export interface ReaderConfig extends BrowserRendererConfig {
    /** Parser options */
    parserOptions?: ParserOptions
    /** Plugins to transform the book before rendering */
    plugins?: readonly RebookPlugin[]
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
        createRenderer: () => new BrowserRenderer(config),
    }
}

/**
 * Create a new browser ReaderView instance.
 */
export const createReader = (config: ReaderConfig): ReaderView => {
    return new ReaderView(config)
}
