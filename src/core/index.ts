export * from './types'
export { ParserRegistry, type Parser, type ParserInput, type ParserOptions, registry } from './parser'
export {
    type Exporter,
    type ExporterFactory,
    type ExportOptions,
    type ExportFirstSectionsOptions,
    type ExportFormat,
    type ExportSectionUnit,
    type ExportSelection,
    type ExportSelectionType,
    ExporterRegistry,
    exporterRegistry,
    exportBook,
    exportBookAsBuffer,
    exportFirstSections,
    exportFirstSectionsAsBuffer,
    firstSectionsSelection,
    isBook,
} from './exporter'
export { type Renderer, type RendererConfig, type RendererStyles, type LayoutMode, type RendererFactory } from './renderer'
export { ReaderSession, type ReaderSessionConfig, type TOCViewItem, type TOCViewOptions } from './reader'
export {
    getAnchorIds,
    getColumnCount,
    getLineHeightMultiplier,
    getLinePageIndex,
    getPagePaddingBlock,
    getPluginPrefetchPageCount,
    getReadablePageCount,
    parseCSSPixels,
} from './renderer-utils'
export { type Loader, type LoaderEntry } from './loader'
export { type DOMAdapter, type XMLDocument, type XMLElement, type XMLAttr } from './dom-adapter'
export { type URLFactory } from './url-factory'
export {
    EBookError,
    ParseError,
    UnsupportedFormatError,
    CorruptedFileError,
    AdapterRequiredError,
    UnsupportedInputError,
} from './errors'
export {
    normalizeWhitespace,
    getElementText,
    cssEscape,
    regexEscape,
    replaceSeries,
    escapeHTML,
    escapeAttr,
    unescapeHTML,
} from './utils'
export {
    normalizeLanguage,
    normalizeTitle,
    normalizePublisher,
    normalizeContributors,
    normalizeSubjects,
} from './metadata'
export {
    searchBook,
    searchChapters,
    getSectionSearchText,
} from '../search'
export type {
    SearchScope,
    SearchOptions,
    SearchResult,
    ChapterSearchResult,
} from '../search'
export {
    parseStyleDeclarations,
    mergeStyleDeclarations,
    parseSimpleClassRules,
    type SimpleClassRule,
} from './css'
export {
    readRasterImageDimensions,
    type ImageDimensions,
} from './image-size'
export {
    assertFixedPageIndex,
    createFixedPageViewport,
    isFixedDocument,
    type FixedDocument,
    type FixedDocumentFormat,
    type FixedPageInfo,
    type FixedPageRenderIntent,
    type FixedPageRenderer,
    type FixedPageRenderOptions,
    type FixedPageRenderResult,
    type FixedPageRotation,
    type FixedPageTextDirection,
    type FixedPageTextLayer,
    type FixedPageTextRun,
    type FixedPageTransform,
    type FixedPageViewport,
    type FixedPageViewportOptions,
} from './fixed-document'
export { REBOOK_LOCATION_MODEL_VERSION } from './location'
export type {
    Annotation,
    BookLocation,
    BookRange,
    BookSelection,
    Rect,
    TextChunk,
    TextProvider,
    TextSearchResult,
} from './location'
export { REBOOK_PAGE_SURFACE_MODEL_VERSION } from './page-surface'
export type {
    ContentRenderer,
    PageCompositor,
    PageSurface,
    PageSurfaceKind,
    PageSurfaceLayer,
    PageSurfaceLayerContentKind,
    PageSurfaceLayerKind,
    PageSurfaceRequest,
} from './page-surface'
export {
    RendererRouter,
    createRendererRouter,
    matchesFixedDocument,
    matchesReflowableBook,
    selectRendererRoute,
    type RendererRoute,
    type RendererRouteMatch,
    type RendererRouterConfig,
} from './renderer-router'
