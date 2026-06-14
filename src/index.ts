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
    ReaderSession,
} from './core/reader'
export type {
    ReaderSessionConfig,
    TOCViewItem,
    TOCViewOptions,
} from './core/reader'

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
} from './core/fixed-document'

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
    searchChapters,
    getSectionSearchText,
} from './search'

export {
    withTrialLimit,
    estimateBookPageCount,
    estimateTrialLimitState,
} from './plugins/trial-limit'
export {
    createBrowserTTSAudioPlayer,
    withTTS,
} from './plugins/tts'
export type {
    BrowserTTSAudioPlayerOptions,
    TTSAudioPlaybackErrorEvent,
    TTSAudioPlaybackEvent,
    TTSAudioPlaybackOptions,
    TTSAudioPlayer,
    TTSBook,
    TTSController,
    TTSJob,
    TTSJobStatus,
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
    ChapterSearchResult,
} from './search'

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
    GetChapterTextToolArgs,
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
    BrowserFixedCanvasVisualRenderer,
    BrowserFixedContentRenderer,
    BrowserFixedImageVisualRenderer,
    BrowserRenderer,
    BrowserSurfacePipeline,
    createBrowserRenderer,
    createBrowserFixedContentRenderer,
    createBrowserSurfacePipeline,
    matchesBrowserFixedContent,
    matchesBrowserReflowableContent,
    ReaderView,
    createReader,
    selectBrowserContentEngine,
    selectFixedVisualRenderer,
} from './renderers/browser'
export type {
    BrowserAdaptiveRendererConfig,
    BrowserContentEngineMatch,
    BrowserContentEngineRoute,
    BrowserFixedCanvasVisualRendererConfig,
    BrowserFixedContentRenderContext,
    BrowserFixedContentRendererConfig,
    BrowserFixedVisualRenderContext,
    BrowserFixedVisualRenderer,
    BrowserFixedVisualRendererMatch,
    BrowserSurfacePipelineConfig,
    BrowserSurfacePipelineDecoratorContext,
    BrowserSurfacePipelineRenderResult,
    BrowserRendererConfig,
    BrowserRendererRoute,
    BrowserRendererRouteContext,
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
