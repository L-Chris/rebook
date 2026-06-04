import './renderers/wechat-miniprogram/polyfills'

export { registry } from './core/parser'
export {
    setRebookDebug,
    isRebookDebugEnabled,
} from './core/debug'

export {
    EBookError,
    ParseError,
    UnsupportedFormatError,
    CorruptedFileError,
    AdapterRequiredError,
    UnsupportedInputError,
} from './core/errors'

export { epub, EPUBParser } from './parsers/epub'
export { cbz, CBZParser } from './parsers/cbz'
export { fb2, FB2Parser } from './parsers/fb2'
export { mobi, MOBIParser } from './parsers/mobi'

export {
    createWechatMiniProgramRenderer,
    WechatMiniProgramRenderer,
    createWechatMiniProgramReader,
    WechatMiniProgramReader,
} from './renderers/wechat-miniprogram'
export type {
    WechatMiniProgramReaderConfig,
} from './renderers/wechat-miniprogram'

export {
    WechatMiniProgramDOMAdapter,
    WechatMiniProgramURLFactory,
} from './adapters/wechat-miniprogram'

export {
    withTrialLimit,
    estimateBookPageCount,
    estimateTrialLimitState,
} from './plugins/trial-limit'
export type {
    TrialLimitController,
    TrialLimitedBook,
    TrialLimitOptions,
    TrialLimitState,
    TrialSnapshotLike,
    TrialTOCAccessItem,
} from './plugins/trial-limit'
