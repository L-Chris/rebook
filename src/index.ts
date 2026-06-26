/**
 * rebook - A modular e-book parsing and rendering library
 *
 * @example
 * ```typescript
 * import { createReader } from 'rebook'
 * import { registerBuiltInParsers } from 'rebook'
 *
 * registerBuiltInParsers()
 *
 * // Create reader
 * const reader = createReader({ container: document.getElementById('viewer')! })
 *
 * // Open a book
 * await reader.open(file)
 *
 * // Navigate
 * await reader.next()
 * await reader.prev()
 *
 * // Access document model (AI-friendly)
 * const section = reader.getBook()?.sections[0]
 * const doc = await section?.getDocument?.()
 * const paragraphs = doc.query('p')
 * ```
 */

// Core types and interfaces
export type {
    Book,
    BookMetadata,
    Section,
    SectionFormat,
    TOCItem,
    Landmark,
    Rendition,
    ResolvedNavigation,
    LanguageMap,
    Contributor,
    LoadEvent,
    RelocateEvent,
    LinkEvent,
    BlockWindowEvent,
    BlockWindowConsumer,
    RebookPlugin,
    // Document Model
    DocumentNode,
    SectionDocument,
    DocumentResource,
    TextStyle,
    TextSegment,
    ImageStyle,
    TextImage,
    TextTable,
    TextTableRow,
    TextTableCell,
    TextBlock,
    TextBlockType,
} from './core/types'

export {
    RebookExtensionCatalog,
    RebookExtensionCommandRegistry,
    RebookExtensionManager,
    RebookExtensionRegistry,
    RebookExtensionSettingsRegistry,
    RebookExtensionSubscriptionRegistry,
    assertRebookExtensionManifest,
    createRebookExtensionCatalog,
    createRebookExtensionCatalogFromJSON,
    createRebookExtensionCatalogEntry,
    createRebookExtensionCommandRegistry,
    createRebookExtensionHost,
    createRebookExtensionInstallation,
    createRebookExtensionManager,
    createRebookExtensionRegistry,
    createRebookExtensionSettingsRegistry,
    createRebookExtensionSubscriptionRegistry,
    defineRebookExtension,
    defineRebookPlugin,
    getRebookExtensionContributionIndex,
    getRebookExtensionManifest,
    isRebookExtension,
    loadRebookExtensionModule,
    normalizeRebookExtensionModule,
    parseRebookExtensionCatalogEntries,
    resolveRebookExtension,
    resolveRebookPlugins,
} from './core/extensions'
export type {
    RebookExtension,
    RebookExtensionCapability,
    RebookExtensionCatalogEntry,
    RebookExtensionCatalogDocument,
    RebookExtensionCatalogItem,
    RebookExtensionCatalogParseOptions,
    RebookExtensionCatalogQuery,
    RebookExtensionCatalogSource,
    RebookExtensionCategory,
    RebookExtensionCommandContribution,
    RebookExtensionCommandHandler,
    RebookExtensionCommandRegistration,
    RebookExtensionCommandService,
    RebookExtensionContributionIndex,
    RebookExtensionContributions,
    RebookExtensionContext,
    RebookExtensionHost,
    RebookExtensionInstallation,
    RebookExtensionInstallState,
    RebookExtensionManifest,
    RebookExtensionManagerInstallOptions,
    RebookExtensionManagerOptions,
    RebookExtensionModuleExports,
    RebookExtensionModuleFactory,
    RebookExtensionModuleFactoryContext,
    RebookExtensionModuleImporter,
    RebookExtensionModuleLoadOptions,
    RebookExtensionPanelContribution,
    RebookExtensionPanelLocation,
    RebookExtensionRegistryInstallOptions,
    RebookExtensionSettingContribution,
    RebookExtensionSettingInspection,
    RebookExtensionSettingsService,
    RebookExtensionSettingType,
    RebookExtensionToolContribution,
    RebookResolvedExtensionContribution,
    RebookResolvedExtensionSettingContribution,
    RebookDisposable,
    RebookPluginLike,
    ResolvedRebookExtension,
} from './core/extensions'

export type {
    PreparedTextBlock,
    PreparedText,
    PrepareOptions,
    LayoutOptions,
    LinePosition,
    LineSegmentRange,
    LineRange,
    VisibleLineWindow,
    PretextRichInlineLineRange,
    CanvasProviderLike,
    PretextMeasureContext,
    PretextMeasurementPolyfillOptions,
} from './core/pretext'

export type {
    Parser,
    ParserInput,
    ParserOptions,
    ParserFactory,
    ParserRegistry,
} from './core/parser'

export type {
    Renderer,
    RendererConfig,
    RendererStyles,
    ReaderMark,
    LayoutMode,
    RendererFactory,
} from './core/renderer'
export {
    BUILT_IN_READER_THEMES,
    mergeRendererStyles,
    resolveReaderTheme,
    resolveRendererStyles,
    type BuiltInReaderThemeName,
    type ReaderTheme,
    type ReaderThemeInput,
} from './core/theme'

export {
    ReaderSession,
} from './core/reader'
export type {
    ReaderSessionConfig,
    TOCViewItem,
    TOCViewOptions,
} from './core/reader'
export {
    appendBlockWindowConsumer,
    getBlockWindowConsumers,
    getBlockWindowPrefetchPageCount,
    normalizeBlockWindowPageCount,
} from './core/block-window'

export type {
    Loader,
    LoaderEntry,
} from './core/loader'

// Adapter interfaces
export type {
    DOMAdapter,
    XMLDocument,
    XMLElement,
    XMLAttr,
} from './core/dom-adapter'

export type {
    URLFactory,
} from './core/url-factory'

// Adapter implementations
export {
    BrowserDOMAdapter,
    BrowserURLFactory,
} from './adapters/browser'

// Parser registry
export { registry } from './core/parser'

// Error types
export {
    EBookError,
    ParseError,
    UnsupportedFormatError,
    CorruptedFileError,
    AdapterRequiredError,
    UnsupportedInputError,
} from './core/errors'

// Metadata normalization helpers
export {
    normalizeLanguage,
    normalizeTitle,
    normalizePublisher,
    normalizeContributors,
    normalizeSubjects,
} from './core/metadata'

// Document Model helpers
export {
    parseHTML,
    createSectionDocument,
    textNode,
    elementNode,
    isTextNode,
    isElementNode,
} from './core/document'

export {
    extractDocumentBlocks,
    extractDocumentSegments,
    prepare,
    prepareBlocks,
    layout,
    getVisibleLines,
    installPretextMeasurementPolyfill,
} from './core/pretext'

export {
    readRasterImageDimensions,
    type ImageDimensions,
} from './core/image-size'

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
} from './core/fixed-document'
export {
    FixedPageSequence,
    clampFixedPageIndex,
    parseFixedPageHref,
    readFixedDocumentPages,
    type FixedPageSequenceConfig,
} from './core/fixed-page-sequence'
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
} from './core/fixed-page-model'
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
} from './core/spread-layout'
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
} from './core/toc'

export {
    REBOOK_LOCATION_MODEL_VERSION,
    bookPositionMatchesReflowableRange,
    getBookPositionLocations,
    getFixedPositionRects,
    isBookRange,
} from './core/location'
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
} from './core/location'

export {
    createStaticTextProvider,
    searchTextChunks,
    type StaticTextProviderOptions,
} from './core/text-provider'
export {
    createFixedPageTextProvider,
    emptyFixedPageTextLayer,
    fixedPageTextChunks,
    fixedTextChunkMatchesRange,
    fixedTextRunRect,
} from './core/fixed-text-provider'
export {
    getBlockReflowableTextRange,
    getLineReflowableTextRange,
    markMatchesReflowableRange,
    resolveFixedMarkRects,
    resolveReflowableBlockMarks,
    resolveReflowableLineMarks,
    type FixedMarkRectOptions,
    type ResolvedMarkRect,
} from './core/mark-resolver'
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
} from './core/reflowable-page-model'
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
} from './core/reflowable-text-provider'

export {
    PageSurfaceController,
    REBOOK_PAGE_SURFACE_MODEL_VERSION,
} from './core/page-surface'
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
} from './core/page-surface'
export {
    PageSurfacePipeline,
    createPageSurfacePipeline,
} from './core/surface-pipeline'
export type {
    PageSurfacePipelineConfig,
    PageSurfacePipelineDecoratorContext,
    PageSurfacePipelineRenderResult,
} from './core/surface-pipeline'
export {
    ContentEngineRouter,
    createContentEngineRouter,
    matchesFixedContent,
    matchesReflowableContent,
    selectContentEngineRoute,
} from './core/content-engine-router'
export type {
    ContentEngine,
    ContentEngineRoute,
    ContentEngineRouteMatch,
    ContentEngineRouterConfig,
} from './core/content-engine-router'

export {
    RendererRouter,
    createRendererRouter,
    matchesFixedDocument,
    matchesReflowableBook,
    selectRendererRoute,
    type RendererRoute,
    type RendererRouteMatch,
    type RendererRouterConfig,
} from './core/renderer-router'
export {
    ReaderMarkStore,
    RendererEventDispatcher,
    type RendererEventTarget,
} from './core/renderer-state'

// Search
export {
    searchBook,
    searchContentUnits,
} from './search'
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
} from './core/readable-content'

export {
    withTrialLimit,
    estimateBookPageCount,
    estimateTrialLimitState,
} from './plugins/trial-limit'
export {
    AI_CHAT_EXTENSION_ID,
    BUILT_IN_REBOOK_EXTENSION_MANIFESTS,
    PROFESSIONAL_TRANSLATION_EXTENSION_ID,
    TRANSLATION_EXTENSION_ID,
    TRIAL_LIMIT_EXTENSION_ID,
    TTS_EXTENSION_ID,
    aiChatExtensionManifest,
    createAIChatExtension,
    createBuiltInRebookExtensions,
    createBuiltInRebookExtensionCatalog,
    createProfessionalTranslationExtension,
    createTTSExtension,
    createTranslationExtension,
    createTrialLimitExtension,
    professionalTranslationExtensionManifest,
    translationExtensionManifest,
    trialLimitExtensionManifest,
    ttsExtensionManifest,
} from './plugins/extensions'
export type {
    BuiltInRebookExtensionName,
    BuiltInRebookExtensionOptions,
} from './plugins/extensions'
export {
    createBrowserTTSAudioPlayer,
    withTTS,
} from './plugins/tts'
export {
    createAIChatController,
    createAIChatTools,
    withAIChat,
} from './plugins/ai-chat'
export type {
    AIChatAskOptions,
    AIChatBook,
    AIChatContextOptions,
    AIChatContextResult,
    AIChatController,
    AIChatMessage,
    AIChatOptions,
    AIChatReadingContext,
    AIChatResponse,
    AIChatRole,
    AIChatSearchOptions,
    AIChatContent,
    AIChatContentOptions,
    AIChatDocumentEdit,
    AIChatDocumentEditEvent,
    AIChatDocumentEditResult,
    AIChatDocumentEditsController,
    AIChatDocumentRewriteInput,
    AIChatTOCItem,
    AIChatToolContext,
} from './plugins/ai-chat'
export type {
    BrowserTTSAudioPlayerOptions,
    TTSAudioPlaybackErrorEvent,
    TTSAudioPlaybackEvent,
    TTSAudioPlaybackOptions,
    TTSAudioPlayer,
    TTSBook,
    TTSController,
    TTSJsonObject,
    TTSJsonValue,
    TTSOptions,
    TTSProviderCapabilities,
    TTSProviderInfo,
    TTSPrefetchedSection,
    TTSPrefetchOptions,
    TTSSectionOptions,
    TTSSegment,
    TTSSpeakerAnalysis,
    TTSSpeakerAnalysisBlock,
    TTSSpeakerAnalysisRequest,
    TTSSpeakerAnalysisSegment,
    TTSSpeakerAnalyzer,
    TTSSpeakerAnalysisOptions,
    TTSSpeakerAnalysisPhase,
    TTSSpeakerGender,
    TTSSpeakerRole,
    TTSSpeakerVoiceAssignment,
    TTSSpeakerVoiceProfile,
    TTSVoiceProfileEntry,
    TTSVoiceProfileSlot,
    TTSSynthesizeOptions,
    TTSSynthesizeResult,
    TTSSynthesisFailure,
    TTSSynthesisState,
    TTSSynthesisStatus,
    TTSVoice,
    TTSVoiceProfile,
} from './plugins/tts'
export type {
    TrialLimitController,
    TrialLimitedBook,
    TrialLimitOptions,
    TrialLimitState,
    TrialSnapshotLike,
    TrialTOCAccessItem,
} from './plugins/trial-limit'
export type {
    SearchScope,
    SearchOptions,
    SearchResult,
    ContentUnitSearchResult,
} from './search'
export type {
    ReadableContent,
    ReadableContentBlock,
    ReadableContentBlockType,
    ReadableContentCitation,
    ReadableContentOptions,
    ReadableContentUnit,
    ReadableContentUnitKind,
} from './core/readable-content'

export {
    setRebookDebug,
    isRebookDebugEnabled,
} from './core/debug'

// MCP helpers
export {
    createBookMCPTools,
    callBookMCPTool,
} from './mcp'
export type {
    MCPToolDefinition,
    MCPToolCallResult,
    BookMCPOptions,
    SearchBookToolArgs,
    GetContentTextToolArgs,
} from './mcp'

// Parsers
export { epub, EPUBParser } from './parsers/epub'
export { cbz, CBZParser } from './parsers/cbz'
export { fb2, FB2Parser } from './parsers/fb2'
export { mobi, MOBIParser } from './parsers/mobi'
export { pdf, PDFParser } from './parsers/pdf'
export {
    builtInParsers,
    registerBuiltInParsers,
    type BuiltInParserEntry,
    type BuiltInParserName,
} from './parsers/builtins'
export { RebookPdfDocument } from './pdf/engine/document'
export type {
    PdfAnnotation,
    PdfLoadOptions,
    PdfOutlineItem,
    PdfPageAnnotations,
    PdfPageDisplayList,
    PdfPageInfo,
    PdfPageText,
    PdfTextRun,
} from './pdf/types'

// Loaders
export { createZipLoader, isZipFile } from './loaders'

// Progress utilities
export { SectionProgress, TOCProgress } from './utils/progress'

// Exporters
export {
    exportBook,
    exportBookAsBuffer,
    exporterRegistry,
    exportFirstSections,
    exportFirstSectionsAsBuffer,
    firstSectionsSelection,
    EPUBExporter,
    epubExporter,
    CBZExporter,
    cbzExporter,
    TXTExporter,
    txtExporter,
    HTMLExporter,
    htmlExporter,
} from './exporters'
export type {
    Exporter,
    ExporterFactory,
    ExportOptions,
    ExportFirstSectionsOptions,
    ExportFormat,
    ExportSectionUnit,
    ExportSelection,
    ExportSelectionType,
} from './exporters'

// Browser renderer
export {
    BrowserAdaptiveRenderer,
    createBrowserAdaptiveRenderer,
    BrowserFixedCanvasPainter,
    BrowserFixedContentRenderer,
    BrowserFixedPainterVisualRenderer,
    BrowserFixedPdfWebGpuRenderer,
    BrowserRenderer,
    BrowserSurfacePipeline,
    BrowserFixedWebGpuPainter,
    createDefaultFixedPainters,
    createBrowserRenderer,
    createBrowserFixedContentRenderer,
    createBrowserFixedPdfWebGpuRenderer,
    createBrowserSurfacePipeline,
    isBrowserWebGpuSupported,
    matchesBrowserFixedContent,
    matchesBrowserReflowableContent,
    ReaderView,
    createReader,
    selectBrowserContentEngine,
    selectFixedVisualRenderer,
} from './renderers/browser'
export type {
    BrowserAdaptiveRendererConfig,
    BrowserContentEngine,
    BrowserContentEngineMatch,
    BrowserContentEngineRoute,
    BrowserConfiguredContentEngineRoute,
    BrowserContentEngineRouteContext,
    BrowserFixedCanvasPainterConfig,
    BrowserFixedContentRenderContext,
    BrowserFixedContentRendererConfig,
    BrowserFixedPaintBackend,
    BrowserFixedPainter,
    BrowserFixedPainterConfig,
    BrowserFixedPainterMatch,
    BrowserFixedPainterPreference,
    BrowserFixedPainterVisualRendererConfig,
    BrowserFixedPaintMetric,
    BrowserFixedPaintResult,
    BrowserFixedPdfWebGpuRendererConfig,
    BrowserFixedPdfWebGpuRenderResult,
    BrowserFixedVisualRenderContext,
    BrowserFixedVisualLayer,
    BrowserFixedVisualRenderer,
    BrowserFixedVisualRendererMatch,
    BrowserFixedWebGpuPainterConfig,
    BrowserSurfacePipelineConfig,
    BrowserSurfacePipelineDecoratorContext,
    BrowserSurfacePipelineRenderResult,
    BrowserRendererConfig,
    ReaderConfig,
} from './renderers/browser'

// WeChat Mini Program renderer
export {
    WechatMiniProgramRenderer,
    createWechatMiniProgramRenderer,
    WechatMiniProgramReader,
    createWechatMiniProgramReader,
} from './renderers/wechat-miniprogram'
export type {
    WechatMiniProgramReaderConfig,
    WechatMiniProgramRendererConfig,
    WechatMiniProgramRendererSnapshot,
    WechatMiniProgramLineNode,
    WechatMiniProgramLineBase,
    WechatMiniProgramTextLineNode,
    WechatMiniProgramPreLineNode,
    WechatMiniProgramSeparatorLineNode,
    WechatMiniProgramImageLineNode,
    WechatMiniProgramTableLineNode,
    WechatMiniProgramTextFragment,
} from './renderers/wechat-miniprogram'
