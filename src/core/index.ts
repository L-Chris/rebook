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
export {
    BUILT_IN_READER_THEMES,
    mergeRendererStyles,
    resolveReaderTheme,
    resolveRendererStyles,
    type BuiltInReaderThemeName,
    type ReaderTheme,
    type ReaderThemeInput,
} from './theme'
export { ReaderSession, type ReaderSessionConfig, type TOCViewItem, type TOCViewOptions } from './reader'
export {
    appendBlockWindowConsumer,
    getBlockWindowConsumers,
    getBlockWindowPrefetchPageCount,
    normalizeBlockWindowPageCount,
} from './block-window'
export {
    getAnchorIds,
    getColumnCount,
    getLineHeightMultiplier,
    getLinePageIndex,
    getPagePaddingBlock,
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
    searchContentUnits,
} from '../search'
export {
    clampReadableContentUnitIndex,
    createReadableContentCitation,
    getReadableContent,
    getReadableContentBlocks,
    getReadableContentText,
    getReadableContentUnit,
    getReadableContentUnitCount,
    getReadableContentUnits,
    getSectionReadableText,
    resolveReadableContentUnitIndex,
    type ReadableContent,
    type ReadableContentBlock,
    type ReadableContentBlockType,
    type ReadableContentCitation,
    type ReadableContentOptions,
    type ReadableContentUnit,
    type ReadableContentUnitKind,
} from './readable-content'
export {
    createStaticTextProvider,
    searchTextChunks,
    type StaticTextProviderOptions,
} from './text-provider'
export {
    createFixedPageTextProvider,
    emptyFixedPageTextLayer,
    fixedPageTextChunks,
    fixedTextChunkMatchesRange,
    fixedTextRunRect,
} from './fixed-text-provider'
export {
    getBlockReflowableTextRange,
    getLineReflowableTextRange,
    markMatchesReflowableRange,
    resolveFixedMarkRects,
    resolveReflowableBlockMarks,
    resolveReflowableLineMarks,
    type FixedMarkRectOptions,
    type ResolvedMarkRect,
} from './mark-resolver'
export {
    clampReflowablePageIndex,
    findReadableReflowablePage,
    getRenderedReflowableLinePosition,
    getReflowablePageIndexForScrollTop,
    getReflowablePageScrollTop,
    getReflowableScrollTopForFraction,
    getReflowableScrollTopForSourceTop,
    getReflowableSectionFraction,
    getReflowableSourceHeightForPages,
    getReflowableSourceScrollTop,
    getReflowableSourceViewport,
    getReflowableSourceViewportHeight,
    getReflowableVisibleLineWindow,
    hasReadableLinesOnReflowablePage,
    type ReflowableColumnLayout,
    type ReflowableSourceViewport,
    type ReflowableViewportMetrics,
} from './reflowable-page-model'
export {
    blockMatchesReflowableBookRange,
    blockToReflowableBookRange,
    blockToReflowableTextChunkRecord,
    createReflowableBlockTextProvider,
    createReflowableTextProvider,
    getReflowableTextBlockText,
    lineMatchesReflowableBookRange,
    lineToReflowableBookRange,
    lineToReflowableTextChunkRecord,
    type ReflowableBlockTextChunkRecord,
    type ReflowableBlockTextProviderContext,
    type ReflowableLinePosition,
    type ReflowableTextChunkRecord,
    type ReflowableTextProviderContext,
} from './reflowable-text-provider'
export {
    FixedPageSequence,
    clampFixedPageIndex,
    parseFixedPageHref,
    readFixedDocumentPages,
    type FixedPageSequenceConfig,
} from './fixed-page-sequence'
export {
    createFixedPageContentRenderContext,
    getFixedSpreadPageLayouts,
    getFixedVisiblePageCount,
    resolveFixedPageFit,
    resolveFixedSpreadFit,
    type FixedPageContentRenderContext,
    type FixedPageFit,
    type FixedPageFitOptions,
    type FixedSpreadFit,
    type FixedSpreadPageLayout,
    type FixedViewportMetrics,
} from './fixed-page-model'
export {
    clampSpreadIndex,
    getNextSpreadIndex,
    getPreviousSpreadIndex,
    getSpreadItems,
    getSpreadNavigationStep,
    getSpreadVisibleItemCount,
    type SpreadLayoutOptions,
    type SpreadNavigationUnit,
    type SpreadViewportMetrics,
} from './spread-layout'
export {
    createSectionIndexLookup,
    findSectionIndex,
    findTOCItemForSection,
    flattenTOC,
    isSameTOCItem,
    normalizeBookPath,
    normalizeNavigationHref,
    normalizeTOCHref,
    resolveTOCSectionIndex,
    type SectionIndexLookup,
} from './toc'
export type {
    SearchScope,
    SearchOptions,
    SearchResult,
    ContentUnitSearchResult,
} from '../search'
export {
    parseStyleDeclarations,
    mergeStyleDeclarations,
    parseSimpleClassRules,
    parseSimpleClassRuleIndex,
    createSimpleClassRuleIndex,
    type SimpleClassRule,
    type SimpleClassRuleIndex,
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
    type FixedPageImage,
    type FixedPageImageAppearance,
    type FixedPageRenderIntent,
    type FixedPageRenderer,
    type FixedPageRenderOptions,
    type FixedPageRenderResult,
    type FixedPageRotation,
    type FixedPageTextDirection,
    type FixedPageTextLayer,
    type FixedPageTextRun,
    type FixedPageTransform,
    type FixedPageVisualAppearance,
    type FixedPageVisualColorMapping,
    type FixedPageVisualColorStrategy,
    type FixedPageViewport,
    type FixedPageViewportOptions,
} from './fixed-document'
export {
    REBOOK_LOCATION_MODEL_VERSION,
    bookPositionMatchesReflowableRange,
    getBookPositionLocations,
    getFixedPositionRects,
    isBookRange,
} from './location'
export type {
    Annotation,
    BookLocation,
    BookPosition,
    BookRange,
    BookSelection,
    Rect,
    ReflowableTextRange,
    TextChunk,
    TextProvider,
    TextSearchResult,
} from './location'
export {
    PageSurfaceController,
    REBOOK_PAGE_SURFACE_MODEL_VERSION,
} from './page-surface'
export type {
    ContentRenderer,
    PageCompositor,
    PageSurfaceComposeOutcome,
    PageSurfaceControllerConfig,
    PageSurfaceDecorator,
    PageSurface,
    PageSurfaceKind,
    PageSurfaceLayer,
    PageSurfaceLayerContentKind,
    PageSurfaceLayerKind,
    PageSurfaceRequest,
} from './page-surface'
export {
    PageSurfacePipeline,
    createPageSurfacePipeline,
} from './surface-pipeline'
export type {
    PageSurfacePipelineConfig,
    PageSurfacePipelineDecoratorContext,
    PageSurfacePipelineRenderResult,
} from './surface-pipeline'
export {
    ContentEngineRouter,
    createContentEngineRouter,
    matchesFixedContent,
    matchesReflowableContent,
    selectContentEngineRoute,
} from './content-engine-router'
export type {
    ContentEngine,
    ContentEngineRoute,
    ContentEngineRouteMatch,
    ContentEngineRouterConfig,
} from './content-engine-router'
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
export {
    ReaderMarkStore,
    RendererEventDispatcher,
    type RendererEventTarget,
} from './renderer-state'
