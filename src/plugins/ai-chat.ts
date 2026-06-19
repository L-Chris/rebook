import {
    generateText,
    jsonSchema,
    stepCountIs,
    streamText,
    tool,
    type LanguageModel,
    type ModelMessage,
    type ToolSet,
    type UserContent,
} from 'ai'
import type { Book, BookMetadata, Contributor, LanguageMap, RebookPlugin, TOCItem } from '../core/types'
import { flattenTOC } from '../core/toc'
import {
    clampReadableContentUnitIndex,
    createReadableContentCitation,
    getReadableContent,
    getReadableContentUnit,
    getReadableContentUnitCount,
    getReadableContentUnits,
    resolveReadableContentUnitIndex,
    type ReadableContent,
    type ReadableContentBlock,
    type ReadableContentCitation,
    type ReadableContentUnitKind,
} from '../core/readable-content'
import { searchBook, type SearchResult, type SearchScope } from '../search'

export type AIChatRole = 'user' | 'assistant'

export interface AIChatMessage {
    role: AIChatRole
    content: string | readonly AIChatContentPart[]
}

export type AIChatContentPart =
    | { type: 'text'; text: string }
    | { type: 'image'; image: string | Uint8Array | ArrayBuffer | URL; mediaType?: string }

export interface AIChatAskOptions {
    messages: readonly AIChatMessage[]
    currentUnitIndex?: number
    current?: AIChatReadingContext
    abortSignal?: AbortSignal
}

export interface AIChatResponse {
    text: string
    toolCalls: unknown[]
    toolResults: unknown[]
    usage?: unknown
    finishReason?: string
}

export interface AIChatStreamResponse {
    textStream: AsyncIterable<string>
    response: Promise<AIChatResponse>
}

export interface AIChatSearchOptions {
    scope?: SearchScope
    unitIndex?: number
    maxResults?: number
    contextChars?: number
}

export interface AIChatContentOptions {
    maxChars?: number
    includeBlocks?: boolean
}

export interface AIChatContextOptions {
    currentUnitIndex?: number
    before?: number
    after?: number
    maxChars?: number
}

export interface AIChatTOCItem {
    label: string
    href: string
    depth: number
    unitIndex?: number
    unitKind?: ReadableContentUnitKind
}

export interface AIChatContent {
    unitIndex: number
    unitId: string | number
    unitKind: ReadableContentUnitKind
    unitTitle?: string
    sectionIndex?: number
    pageIndex?: number
    title?: string
    text: string
    blocks?: AIChatContentBlock[]
    charCount: number
    truncated: boolean
}

export type AIChatCitation = ReadableContentCitation

export interface AIChatContentBlock {
    blockId?: string
    blockType: string
    text: string
    citation: AIChatCitation
}

export interface AIChatContextResult {
    currentUnitIndex: number
    units: AIChatContent[]
}

export interface AIChatToolContext {
    currentUnitIndex?: number
    current?: AIChatReadingContext
}

export interface AIChatReadingContext {
    unitIndex?: number
    unitId?: string | number
    unitKind?: ReadableContentUnitKind
    unitTitle?: string
    sectionIndex?: number
    sectionId?: string | number
    sectionTitle?: string
    sectionFraction?: number
    totalFraction?: number
    tocLabel?: string
    tocHref?: string
    pageIndex?: number
    pageCount?: number
}

export interface AIChatController {
    ask(input: string | AIChatAskOptions): Promise<AIChatResponse>
    stream(input: string | AIChatAskOptions): AIChatStreamResponse
    search(query: string, options?: AIChatSearchOptions): Promise<SearchResult[]>
    getTOC(maxItems?: number): AIChatTOCItem[]
    getContent(unitIndex: number, options?: AIChatContentOptions): Promise<AIChatContent>
    getCurrentContext(options?: AIChatContextOptions): Promise<AIChatContextResult>
    createTools(context?: AIChatToolContext): ToolSet
}

export interface AIChatBook extends Book {
    aiChat: AIChatController
}

export interface AIChatOptions {
    model: LanguageModel
    system?: string | (() => string | undefined)
    maxToolSteps?: number | (() => number)
    maxSearchResults?: number | (() => number)
    maxContentChars?: number | (() => number)
    maxContextChars?: number | (() => number)
    extraTools?: ToolSet | ((context: AIChatToolContext) => ToolSet)
}

const DEFAULT_MAX_TOOL_STEPS = 6
const DEFAULT_MAX_SEARCH_RESULTS = 8
const DEFAULT_MAX_CONTENT_CHARS = 6000
const DEFAULT_MAX_CONTEXT_CHARS = 20000

export function withAIChat(options: AIChatOptions): RebookPlugin {
    return book => ({
        ...book,
        aiChat: createAIChatController(book, options),
    })
}

export function createAIChatController(book: Book, options: AIChatOptions): AIChatController {
    const controller: AIChatController = {
        ask: async input => {
            const askOptions = typeof input === 'string'
                ? { messages: [{ role: 'user' as const, content: input }] }
                : input
            const current = createReadingContext(book, askOptions)
            const context = { currentUnitIndex: current.unitIndex, current }
            const tools = controller.createTools(context)
            const result = await generateText({
                model: options.model,
                system: buildSystemPrompt(book, options, current),
                messages: toModelMessages(askOptions.messages),
                tools,
                stopWhen: stepCountIs(readNumberOption(options.maxToolSteps, DEFAULT_MAX_TOOL_STEPS)),
                abortSignal: askOptions.abortSignal,
            })

            return {
                text: result.text,
                toolCalls: [...result.toolCalls],
                toolResults: [...result.toolResults],
                usage: result.usage,
                finishReason: result.finishReason,
            }
        },
        stream: input => {
            const askOptions = typeof input === 'string'
                ? { messages: [{ role: 'user' as const, content: input }] }
                : input
            const current = createReadingContext(book, askOptions)
            const context = { currentUnitIndex: current.unitIndex, current }
            const tools = controller.createTools(context)
            const result = streamText({
                model: options.model,
                system: buildSystemPrompt(book, options, current),
                messages: toModelMessages(askOptions.messages),
                tools,
                stopWhen: stepCountIs(readNumberOption(options.maxToolSteps, DEFAULT_MAX_TOOL_STEPS)),
                abortSignal: askOptions.abortSignal,
            })

            return createAIChatStreamResponse(result)
        },
        search: (query, searchOptions = {}) => searchBook(book, query, {
            scope: searchOptions.scope ?? 'book',
            unitIndex: searchOptions.unitIndex,
            maxResults: searchOptions.maxResults ?? readNumberOption(options.maxSearchResults, DEFAULT_MAX_SEARCH_RESULTS),
            contextChars: searchOptions.contextChars ?? 80,
        }),
        getTOC: maxItems => getTOCItems(book, maxItems),
        getContent: (unitIndex, contentOptions = {}) =>
            getContent(book, unitIndex, contentOptions.maxChars ?? readNumberOption(options.maxContentChars, DEFAULT_MAX_CONTENT_CHARS), {
                includeBlocks: contentOptions.includeBlocks,
            }),
        getCurrentContext: contextOptions =>
            getCurrentContext(book, {
                ...contextOptions,
                maxChars: contextOptions?.maxChars ?? readNumberOption(options.maxContextChars, DEFAULT_MAX_CONTEXT_CHARS),
            }),
        createTools: context => createAIChatTools(book, options, context ?? {}),
    }
    return controller
}

export function createAIChatTools(book: Book, options: AIChatOptions, context: AIChatToolContext = {}): ToolSet {
    const builtInTools: ToolSet = {
        getBookMetadata: tool({
            description: '获取当前电子书的基础元数据、章节数量和目录数量。',
            inputSchema: jsonSchema({
                type: 'object',
                properties: {},
                additionalProperties: false,
            }),
            execute: async () => ({
                title: formatLanguageMap(book.metadata?.title) || 'Untitled',
                subtitle: formatLanguageMap(book.metadata?.subtitle),
                authors: formatContributors(book.metadata?.author),
                language: book.metadata?.language,
                description: typeof book.metadata?.description === 'string' ? book.metadata.description : undefined,
                readableUnits: getReadableContentUnitCount(book),
                tocItems: flattenTOC(book.toc).length,
            }),
        }),
        getTOC: tool({
            description: '获取目录项。用于定位章节或了解全书结构。',
            inputSchema: jsonSchema<{ maxItems?: number }>({
                type: 'object',
                properties: {
                    maxItems: { type: 'number', description: '最多返回的目录项数量，默认 80。' },
                },
                additionalProperties: false,
            }),
            execute: async ({ maxItems }) => getTOCItems(book, maxItems ?? 80),
        }),
        searchBook: tool({
            description: '在全书或当前内容单元中搜索关键词，返回带上下文和 citation.href 的匹配片段；只要回答使用这些原文片段，就必须复制 citation.href 生成 Markdown 引用链接。',
            inputSchema: jsonSchema<{ query: string; scope?: SearchScope; unitIndex?: number; maxResults?: number }>({
                type: 'object',
                properties: {
                    query: { type: 'string', description: '要搜索的原文关键词或短语。' },
                    scope: { type: 'string', enum: ['book', 'unit'], description: '搜索范围，默认 book。' },
                    unitIndex: { type: 'number', description: '内容单元索引；scope=unit 时默认当前内容单元。EPUB 中通常是章节，PDF 中通常是页。' },
                    maxResults: { type: 'number', description: '最多返回条数，默认由插件配置决定。' },
                },
                required: ['query'],
                additionalProperties: false,
            }),
            execute: async ({ query, scope, unitIndex, maxResults }) => {
                const targetUnitIndex = typeof unitIndex === 'number' ? unitIndex : context.currentUnitIndex
                const results = await searchBookWithCitations(book, query, {
                    scope: scope ?? 'book',
                    unitIndex: targetUnitIndex,
                    maxResults: maxResults ?? readNumberOption(options.maxSearchResults, DEFAULT_MAX_SEARCH_RESULTS),
                    contextChars: 96,
                })
                return {
                    query,
                    results,
                }
            },
        }),
        getContent: tool({
            description: '获取指定内容单元正文和 block 级 citation.href。只要回答使用该正文内容、总结该内容或解释其中观点，就必须在对应结论后添加可点击引用。',
            inputSchema: jsonSchema<{ unitIndex?: number; maxChars?: number }>({
                type: 'object',
                properties: {
                    unitIndex: { type: 'number', description: '内容单元索引；不填则使用当前内容单元。' },
                    maxChars: { type: 'number', description: '最多返回字符数。' },
                },
                additionalProperties: false,
            }),
            execute: async ({ unitIndex, maxChars }) => {
                const index = typeof unitIndex === 'number' ? unitIndex : context.currentUnitIndex ?? 0
                return getContent(book, index, maxChars ?? readNumberOption(options.maxContentChars, DEFAULT_MAX_CONTENT_CHARS), {
                    includeBlocks: true,
                })
            },
        }),
        getCurrentContext: tool({
            description: '获取当前阅读位置附近的内容单元文本和 block 级 citation.href；用于回答“本章总结”“当前页讲什么”“这里是什么意思”等上下文问题，并必须为涉及原文的结论添加可点击引用。',
            inputSchema: jsonSchema<{ before?: number; after?: number; maxChars?: number }>({
                type: 'object',
                properties: {
                    before: { type: 'number', description: '当前章节前面取多少个章节，默认 0。' },
                    after: { type: 'number', description: '当前章节后面取多少个章节，默认 0。' },
                    maxChars: { type: 'number', description: '整体最多返回字符数。' },
                },
                additionalProperties: false,
            }),
            execute: async ({ before, after, maxChars }) => getCurrentContext(book, {
                currentUnitIndex: context.currentUnitIndex ?? 0,
                before,
                after,
                maxChars: maxChars ?? readNumberOption(options.maxContextChars, DEFAULT_MAX_CONTEXT_CHARS),
            }),
        }),
    }

    const extraTools = typeof options.extraTools === 'function'
        ? options.extraTools(context)
        : options.extraTools
    return extraTools ? { ...builtInTools, ...extraTools } : builtInTools
}

function createReadingContext(book: Book, options: Pick<AIChatAskOptions, 'current' | 'currentUnitIndex'>): AIChatReadingContext {
    const rawIndex = options.current?.unitIndex ?? options.currentUnitIndex ?? options.current?.sectionIndex ?? options.current?.pageIndex
    const unitIndex = typeof rawIndex === 'number' ? clampReadableContentUnitIndex(book, rawIndex) : undefined
    const unit = typeof unitIndex === 'number' ? getReadableContentUnit(book, unitIndex) : undefined
    const unitTitle = options.current?.unitTitle
        || options.current?.sectionTitle
        || options.current?.tocLabel
        || unit?.title
    return {
        ...options.current,
        unitIndex,
        unitId: options.current?.unitId ?? unit?.id,
        unitKind: options.current?.unitKind ?? unit?.kind,
        unitTitle,
        sectionIndex: unit?.sectionIndex ?? options.current?.sectionIndex,
        sectionId: options.current?.sectionId ?? (unit?.kind === 'section' ? unit.id : undefined),
        sectionTitle: options.current?.sectionTitle ?? (unit?.kind === 'section' ? unitTitle : undefined),
        pageIndex: unit?.pageIndex ?? options.current?.pageIndex,
    }
}

function createAIChatStreamResponse(result: {
    textStream: AsyncIterable<string>
    toolCalls: PromiseLike<unknown[]>
    toolResults: PromiseLike<unknown[]>
    usage: PromiseLike<unknown>
    finishReason: PromiseLike<string>
}): AIChatStreamResponse {
    let text = ''
    let resolveResponse!: (response: AIChatResponse) => void
    let rejectResponse!: (error: unknown) => void
    const response = new Promise<AIChatResponse>((resolve, reject) => {
        resolveResponse = resolve
        rejectResponse = reject
    })

    const textStream = (async function* () {
        try {
            for await (const chunk of result.textStream) {
                text += chunk
                yield chunk
            }
            const [toolCalls, toolResults, usage, finishReason] = await Promise.all([
                result.toolCalls,
                result.toolResults,
                result.usage,
                result.finishReason,
            ])
            resolveResponse({
                text,
                toolCalls: [...toolCalls],
                toolResults: [...toolResults],
                usage,
                finishReason,
            })
        } catch (error) {
            rejectResponse(error)
            throw error
        }
    })()

    return { textStream, response }
}

async function getCurrentContext(book: Book, options: AIChatContextOptions = {}): Promise<AIChatContextResult> {
    const currentUnitIndex = clampReadableContentUnitIndex(book, options.currentUnitIndex ?? 0)
    const before = Math.max(0, Math.floor(options.before ?? 0))
    const after = Math.max(0, Math.floor(options.after ?? 0))
    const maxChars = Math.max(400, Math.floor(options.maxChars ?? DEFAULT_MAX_CONTEXT_CHARS))
    const unitCount = getReadableContentUnitCount(book)
    const start = Math.max(0, currentUnitIndex - before)
    const end = Math.min(unitCount - 1, currentUnitIndex + after)
    const units: AIChatContent[] = []
    let remaining = maxChars

    for (let index = start; index <= end && remaining > 0; index++) {
        const content = await getContent(book, index, remaining, { includeBlocks: true })
        units.push(content)
        remaining -= content.text.length
    }

    return { currentUnitIndex, units }
}

async function getContent(
    book: Book,
    unitIndex: number,
    maxChars: number,
    options: { includeBlocks?: boolean } = {},
): Promise<AIChatContent> {
    const index = clampReadableContentUnitIndex(book, unitIndex)
    const content = await getReadableContent(book, index, { includeBlocks: options.includeBlocks })
    const charLimit = Math.max(200, Math.floor(maxChars))
    const clippedText = clipText(content.text, charLimit)
    const blockContent = options.includeBlocks && content.blocks
        ? clipAIChatBlocks(content.unit, content.blocks, charLimit)
        : undefined
    const blocks = blockContent?.blocks
    const text = blocks ? blocks.map(block => block.text).join('\n') : clippedText.text
    const truncated = blockContent ? blockContent.truncated : clippedText.truncated

    return {
        unitIndex: content.unit.index,
        unitId: content.unit.id,
        unitKind: content.unit.kind,
        unitTitle: content.unit.title,
        sectionIndex: content.unit.sectionIndex,
        pageIndex: content.unit.pageIndex,
        title: content.unit.title,
        text,
        blocks,
        charCount: content.charCount,
        truncated,
    }
}

async function searchBookWithCitations(
    book: Book,
    query: string,
    options: AIChatSearchOptions = {},
): Promise<Array<ReturnType<typeof compactCitationSearchResult>>> {
    const maxResults = Math.max(0, Math.floor(options.maxResults ?? DEFAULT_MAX_SEARCH_RESULTS))
    if (!query.trim() || maxResults === 0) return []

    const results = await searchBook(book, query, {
        scope: options.scope ?? 'book',
        unitIndex: options.unitIndex,
        maxResults,
        contextChars: options.contextChars ?? 96,
    })
    return results.map(result => compactCitationSearchResult(book, result))
}

function clipAIChatBlocks(unit: ReadableContent['unit'], blocks: readonly ReadableContentBlock[], maxChars: number): {
    blocks: AIChatContentBlock[]
    truncated: boolean
} {
    const clippedBlocks: AIChatContentBlock[] = []
    let used = 0
    let truncated = false

    for (const block of blocks) {
        const remaining = maxChars - used
        if (remaining <= 0) {
            truncated = true
            break
        }
        const text = block.text.length > remaining ? block.text.slice(0, remaining).trimEnd() : block.text
        if (block.text.length > remaining) truncated = true
        if (!text) continue
        clippedBlocks.push({
            blockId: block.id,
            blockType: block.type,
            text,
            citation: createReadableContentCitation(unit, block),
        })
        used += text.length
        if (truncated) break
    }

    if (clippedBlocks.length < blocks.filter(block => block.text).length) truncated = true

    return { blocks: clippedBlocks, truncated }
}

function compactCitationSearchResult(book: Book, result: SearchResult) {
    const unit = getReadableContentUnit(book, result.unitIndex)
    const block = result.blockId ? {
        id: result.blockId,
        type: (result.blockType ?? 'page') as ReadableContentBlock['type'],
        text: result.match,
    } satisfies ReadableContentBlock : undefined
    return {
        unitIndex: result.unitIndex,
        unitId: result.unitId,
        unitKind: result.unitKind,
        unitTitle: result.unitTitle,
        sectionIndex: result.sectionIndex,
        pageIndex: result.pageIndex,
        matchIndex: result.matchIndex,
        blockId: result.blockId,
        blockType: result.blockType,
        excerpt: result.excerpt,
        citation: unit ? createReadableContentCitation(unit, block) : undefined,
    }
}

function getTOCItems(book: Book, maxItems = 80): AIChatTOCItem[] {
    const items: AIChatTOCItem[] = []
    const numericMaxItems = Number(maxItems)
    const limit = Number.isFinite(numericMaxItems) ? Math.max(0, Math.floor(numericMaxItems)) : 80

    const visit = (tocItems: readonly TOCItem[] | undefined, depth: number) => {
        if (!tocItems || items.length >= limit) return
        for (const item of tocItems) {
            if (items.length >= limit) break
            const unitIndex = resolveReadableContentUnitIndex(book, item.href)
            const unit = typeof unitIndex === 'number' ? getReadableContentUnit(book, unitIndex) : undefined
            items.push({
                label: item.label,
                href: item.href,
                depth,
                unitIndex,
                unitKind: unit?.kind,
            })
            visit(item.subitems, depth + 1)
        }
    }

    visit(book.toc, 0)
    return items
}

function buildSystemPrompt(book: Book, options: AIChatOptions, current?: AIChatReadingContext): string {
    const configuredSystem = readStringOption(options.system)
    const metadata = book.metadata
    const title = formatLanguageMap(metadata?.title) || 'Untitled'
    const authors = formatContributors(metadata?.author).join(', ') || 'unknown author'
    const language = Array.isArray(metadata?.language) ? metadata?.language.join(', ') : metadata?.language
    const tocPreview = getTOCItems(book, 16)
        .map(item => `${'  '.repeat(item.depth)}- [${item.unitIndex ?? '?'}] ${item.label}`)
        .join('\n')

    return [
        '# 角色',
        '你是 rebook 的书籍内容问答助手，只围绕当前打开的电子书提供解释、总结、检索和阅读辅助。',
        '',
        '# 输出语言',
        '- 默认必须使用简体中文回答。',
        '- 即使书籍内容、目录、工具返回内容或用户问题是英文，只要用户没有明确要求使用其他语言，最终回答仍然使用简体中文。',
        '- 只有当用户明确要求“用英文/日文/其他语言回答”时，才切换语言。',
        '',
        '# 内容依据',
        '- 回答必须优先基于当前电子书内容。',
        '- 涉及事实、情节、术语解释、章节总结、人物关系或章节定位时，先使用工具搜索或读取正文。',
        '- 不要编造书中没有的信息；信息不足时说明缺少上下文，并给出可继续搜索的关键词。',
        '',
        '# 当前阅读位置规则',
        '- 用户说“本章”“当前章节”“当前页”“这里”“这一段”时，默认指当前阅读位置。',
        '- 回答这类问题前必须使用 getCurrentContext 或 getContent 读取当前内容单元正文。',
        '- getCurrentContext 未指定 maxChars 时默认可读取 20000 字符。',
        '',
        '# 回答格式',
        '- 回答尽量简洁、结构清晰。',
        '- 可以使用 Markdown。',
        '- 基于书中内容回答时，必须在对应观点后添加可点击引用，而不是只标明标题或 unitIndex。',
        '',
        '# 可点击引用规则',
        '- 引用不是某个工具的专属格式；任何工具或额外工具只要返回 citation.href、blocks[].citation.href、blockId 或可定位字段，都应视为可引用出处。',
        '- 只要回答涉及书中具体内容、章节总结、概念解释、情节/人物/术语分析、检索结果、对原文观点的归纳或对某段文字的解释，就必须先使用工具取得原文依据，并生成可点击引用。',
        '- 总结类回答也必须引用：每个主要主题、关键概念、重要结论或列表项后面至少放一个支持它的引用；不要因为是概括、归纳或改写就省略引用。',
        '- 引用生成优先级：优先复制离被使用原文最近的短 citation.href，例如 block.citation.href、result.citation.href、unit.blocks[].citation.href；如果没有 citation.href 但有 blockId 和 unitIndex，则按 path 短格式生成 rebook://j 链接；如果两者都没有，才只标注标题或 unitIndex。',
        '- 当工具结果提供 citation.href 时，必须逐字复制 citation.href，用 Markdown 链接生成可点击出处：`[出处](citation.href)`。',
        '- 当工具结果没有 citation.href 但提供 blockId 时，必须使用同一条工具结果或其父级内容单元里的字段生成短链接：`rebook://j/<unitIndex>/<encodeURIComponent(blockId)>`。',
        '- 如果只定位到内容单元而没有 blockId，使用短链接：`rebook://j/<unitIndex>`。',
        '- blockId 引用示例：`[出处](rebook://j/12/paragraph-21)`。',
        '- 禁止生成 `rebook://j?...` query 形式；引用链接只能使用 `rebook://j/<unitIndex>` 或 `rebook://j/<unitIndex>/<blockId>` path 形式。',
        '- 引用应放在它支持的具体观点、句子或列表项后面；不要只把所有引用集中放在文末。',
        '- 输出前自检：如果最终回答包含书中事实或原文归纳，但没有任何 `rebook://j/` Markdown 链接，应补充引用后再回答。',
        '- 只有在寒暄、说明自身能力、解释如何使用功能、用户明确不需要出处，或工具结果没有任何可定位字段时，才可以不生成可点击引用。',
        '- 禁止编造 unitIndex 或 blockId；短链接路径里的第一个片段必须来自工具结果的 unitIndex，第二个片段必须来自工具结果的 blockId。',
        '',
        '# SVG/HTML/Mermaid 生成规则',
        '- 只有当用户明确要求图示、可视化、页面、卡片、流程图、表格预览或交互示例时，才生成 SVG、HTML 或 Mermaid 代码。',
        '- 生成可预览代码时，默认只输出一个 fenced code block，并使用 `mermaid`、`svg` 或 `html` 语言标记；代码块前后不要附加冗长解释。',
        '- 以“足够表达需求的最小代码”为目标：省略注释、元数据、占位内容、重复样式、无关 aria、无用 wrapper 和外部依赖。',
        '- 流程图、时序图、状态图、关系图、概念结构图优先用 Mermaid；需要精细视觉造型时再用 SVG；HTML 只用于复杂布局或需要交互时。',
        '- Mermaid 应使用紧凑语法，节点文案短，避免 init 配置块、主题配置、HTML label 和重复样式，除非用户明确要求。',
        '- HTML 默认输出 body 片段，不要输出 `<!doctype>`、`html`、`head`、`body` 样板，除非用户要求完整文档。',
        '- SVG 默认省略 XML 声明、命名空间以外的样板和复杂滤镜；使用 `viewBox`、少量基础图形、共享属性或短 class，避免超长 path、base64、图片内嵌和大段重复文本。',
        '- CSS 应合并重复规则，优先短 class 和共享选择器；不要为每个元素复制大段 inline style。JS 只有在用户明确要求交互时才加入。',
        '- 保持代码可读但紧凑；不要为了美化输出大量空行或装饰性元素。若需求可能导致代码很长，先给最小可用版本。',
        '',
        '# 书籍信息',
        `- 书名：${title}`,
        `- 作者：${authors}`,
        language ? `- 语言：${language}` : '',
        `- 可读内容单元数：${getReadableContentUnitCount(book)}`,
        '',
        formatReadingContext(current),
        tocPreview ? `# 目录预览\n${tocPreview}` : '',
        configuredSystem ? `# 额外指令\n${configuredSystem}` : '',
    ].filter(Boolean).join('\n')
}

function formatReadingContext(current?: AIChatReadingContext): string {
    if (!current || typeof current.unitIndex !== 'number') return ''
    const rows = [
        `unitIndex: ${current.unitIndex}`,
        current.unitId !== undefined ? `unitId: ${current.unitId}` : '',
        current.unitKind ? `unitKind: ${current.unitKind}` : '',
        current.unitTitle ? `unitTitle: ${current.unitTitle}` : '',
        typeof current.sectionIndex === 'number' ? `sectionIndex: ${current.sectionIndex}` : '',
        current.sectionId !== undefined ? `sectionId: ${current.sectionId}` : '',
        current.sectionTitle ? `sectionTitle: ${current.sectionTitle}` : '',
        current.tocLabel && current.tocLabel !== current.sectionTitle ? `tocLabel: ${current.tocLabel}` : '',
        current.tocHref ? `tocHref: ${current.tocHref}` : '',
        typeof current.sectionFraction === 'number' ? `sectionFraction: ${roundContextNumber(current.sectionFraction)}` : '',
        typeof current.totalFraction === 'number' ? `totalFraction: ${roundContextNumber(current.totalFraction)}` : '',
        typeof current.pageIndex === 'number' ? `pageIndex: ${current.pageIndex}` : '',
        typeof current.pageCount === 'number' ? `pageCount: ${current.pageCount}` : '',
    ].filter(Boolean)
    return rows.length ? `当前阅读位置：\n${rows.map(row => `- ${row}`).join('\n')}` : ''
}

function roundContextNumber(value: number): number {
    return Math.round(value * 10000) / 10000
}

function toModelMessages(messages: readonly AIChatMessage[]): ModelMessage[] {
    return messages.map(message => {
        if (message.role === 'user') {
            return {
                role: 'user',
                content: normalizeUserMessageContent(message.content),
            }
        }
        return {
            role: 'assistant',
            content: normalizeAssistantMessageContent(message.content),
        }
    })
}

function normalizeUserMessageContent(content: AIChatMessage['content']): string | UserContent {
    if (typeof content === 'string') return content
    return content.map(part => {
        if (part.type === 'text') return { type: 'text', text: part.text }
        return { type: 'image', image: part.image, mediaType: part.mediaType }
    })
}

function normalizeAssistantMessageContent(content: AIChatMessage['content']): string {
    if (typeof content === 'string') return content
    return content
        .filter(part => part.type === 'text')
        .map(part => part.text)
        .join('\n')
}

function clipText(text: string, maxChars: number): { text: string; truncated: boolean } {
    const normalized = text.replace(/\n{3,}/g, '\n\n').trim()
    if (normalized.length <= maxChars) return { text: normalized, truncated: false }
    return { text: `${normalized.slice(0, maxChars).trimEnd()}\n...[truncated]`, truncated: true }
}

function readNumberOption(option: number | (() => number) | undefined, fallback: number): number {
    const value = typeof option === 'function' ? option() : option
    return Number.isFinite(value) && Number(value) > 0 ? Number(value) : fallback
}

function readStringOption(option: string | (() => string | undefined) | undefined): string | undefined {
    const value = typeof option === 'function' ? option() : option
    return value?.trim() || undefined
}

function formatLanguageMap(value: LanguageMap | undefined): string {
    if (!value) return ''
    if (typeof value === 'string') return value
    return value.en || value.zh || Object.values(value)[0] || ''
}

function formatContributors(value: BookMetadata['author']): string[] {
    const contributors = Array.isArray(value) ? value : value ? [value] : []
    return contributors.map(formatContributor).filter(Boolean)
}

function formatContributor(value: Contributor): string {
    return typeof value === 'string' ? value : formatLanguageMap(value.name)
}
