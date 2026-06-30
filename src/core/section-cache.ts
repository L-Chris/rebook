import type { DOMAdapter } from './dom-adapter'
import type { DocumentNode, SectionDocument, TextBlock, TextSegment } from './types'
import { createSectionDocument, parseHTML } from './document'
import { extractDocumentBlocks, extractDocumentSegments } from './pretext'
import { getOrCreateCachedPromise } from './promise-cache'

type MaybePromise<T> = T | Promise<T>

export interface CachedReflowableAccessorsOptions {
    domAdapter?: DOMAdapter
    loadDocumentHtml?: () => MaybePromise<string>
    loadBlocksHtml?: () => MaybePromise<string>
    loadDocumentNodes?: () => MaybePromise<DocumentNode[]>
    loadBlockNodes?: () => MaybePromise<DocumentNode[]>
    coverImageSrcs?: () => Iterable<string>
}

export function createCachedReflowableAccessors({
    domAdapter,
    loadDocumentHtml,
    loadBlocksHtml,
    loadDocumentNodes: loadDocumentNodesSource,
    loadBlockNodes: loadBlockNodesSource,
    coverImageSrcs = () => [],
}: CachedReflowableAccessorsOptions): {
    getDocument: () => Promise<SectionDocument | null>
    getSegments: () => Promise<TextSegment[]>
    getBlocks: () => Promise<TextBlock[]>
} {
    const cache = new Map<string, Promise<unknown>>()
    const getCached = <T>(key: string, load: () => MaybePromise<T>): Promise<T> =>
        getOrCreateCachedPromise(cache as Map<string, Promise<T>>, key, load)

    const loadDocumentNodes = async () => {
        if (loadDocumentNodesSource) return loadDocumentNodesSource()
        if (!domAdapter) return []
        if (!loadDocumentHtml) return []
        const html = await loadDocumentHtml()
        return parseHTML(html, domAdapter)
    }

    const loadBlockNodes = async () => {
        if (loadBlockNodesSource) return loadBlockNodesSource()
        if (!domAdapter) return []
        const htmlLoader = loadBlocksHtml ?? loadDocumentHtml
        if (!htmlLoader) return []
        const html = await htmlLoader()
        return parseHTML(html, domAdapter)
    }

    return {
        getDocument: async () => {
            if (!domAdapter) return null
            const nodes = await getCached('document-nodes', loadDocumentNodes)
            return createSectionDocument(nodes, domAdapter)
        },
        getSegments: () => getCached('segments', async () => {
            const nodes = await getCached('document-nodes', loadDocumentNodes)
            return extractDocumentSegments(nodes)
        }),
        getBlocks: () => getCached('blocks', async () => {
            const nodes = await getCached('block-nodes', loadBlockNodes)
            return extractDocumentBlocks(nodes, {}, {
                coverImageSrcs: Array.from(coverImageSrcs()),
            })
        }),
    }
}
