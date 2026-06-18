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
import type { Book, BookMetadata, Contributor, LanguageMap, RebookPlugin, Section, TextBlock, TextSegment, TOCItem } from '../core/types'
import { createSectionIndexLookup, findTOCItemForSection, flattenTOC, resolveTOCSectionIndex } from '../core/toc'
import { getSectionSearchText, searchBook, type SearchResult, type SearchScope } from '../search'

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
    currentSectionIndex?: number
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
    sectionIndex?: number
    maxResults?: number
    contextChars?: number
}

export interface AIChatSectionContentOptions {
    maxChars?: number
    includeBlocks?: boolean
}

export interface AIChatContextOptions {
    currentSectionIndex?: number
    before?: number
    after?: number
    maxChars?: number
}

export interface AIChatTOCItem {
    label: string
    href: string
    depth: number
    sectionIndex?: number
}

export interface AIChatSectionContent {
    sectionIndex: number
    sectionId: string | number
    title?: string
    text: string
    blocks?: AIChatContentBlock[]
    charCount: number
    truncated: boolean
}

export interface AIChatCitation {
    label: string
    href: string
    sectionIndex: number
    sectionId: string | number
    blockId?: string
    blockType?: string
}

export interface AIChatContentBlock {
    blockId: string
    blockType: string
    text: string
    citation: AIChatCitation
}

export interface AIChatContextResult {
    currentSectionIndex: number
    sections: AIChatSectionContent[]
}

export interface AIChatToolContext {
    currentSectionIndex?: number
    current?: AIChatReadingContext
}

export interface AIChatReadingContext {
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
    getSectionContent(sectionIndex: number, options?: AIChatSectionContentOptions): Promise<AIChatSectionContent>
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
    maxSectionChars?: number | (() => number)
    maxContextChars?: number | (() => number)
    extraTools?: ToolSet | ((context: AIChatToolContext) => ToolSet)
}

const DEFAULT_MAX_TOOL_STEPS = 6
const DEFAULT_MAX_SEARCH_RESULTS = 8
const DEFAULT_MAX_SECTION_CHARS = 6000
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
            const context = { currentSectionIndex: current.sectionIndex, current }
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
            const context = { currentSectionIndex: current.sectionIndex, current }
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
            chapterIndex: searchOptions.sectionIndex,
            maxResults: searchOptions.maxResults ?? readNumberOption(options.maxSearchResults, DEFAULT_MAX_SEARCH_RESULTS),
            contextChars: searchOptions.contextChars ?? 80,
        }),
        getTOC: maxItems => getTOCItems(book, maxItems),
        getSectionContent: (sectionIndex, sectionOptions = {}) =>
            getSectionContent(book, sectionIndex, sectionOptions.maxChars ?? readNumberOption(options.maxSectionChars, DEFAULT_MAX_SECTION_CHARS), {
                includeBlocks: sectionOptions.includeBlocks,
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
                sections: book.sections.length,
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
            description: '在全书或当前章节中搜索关键词，返回带上下文和 citation.href 的匹配片段；回答中引用这些片段时应复制 citation.href 生成 Markdown 链接。',
            inputSchema: jsonSchema<{ query: string; scope?: SearchScope; sectionIndex?: number; maxResults?: number }>({
                type: 'object',
                properties: {
                    query: { type: 'string', description: '要搜索的原文关键词或短语。' },
                    scope: { type: 'string', enum: ['book', 'chapter'], description: '搜索范围，默认 book。' },
                    sectionIndex: { type: 'number', description: '章节索引；scope=chapter 时默认当前章节。' },
                    maxResults: { type: 'number', description: '最多返回条数，默认由插件配置决定。' },
                },
                required: ['query'],
                additionalProperties: false,
            }),
            execute: async ({ query, scope, sectionIndex, maxResults }) => {
                const chapterIndex = typeof sectionIndex === 'number' ? sectionIndex : context.currentSectionIndex
                const results = await searchBookWithCitations(book, query, {
                    scope: scope ?? 'book',
                    sectionIndex: chapterIndex,
                    maxResults: maxResults ?? readNumberOption(options.maxSearchResults, DEFAULT_MAX_SEARCH_RESULTS),
                    contextChars: 96,
                })
                return {
                    query,
                    results,
                }
            },
        }),
        getSectionContent: tool({
            description: '获取指定章节正文和 block 级 citation.href。适合回答需要引用章节内容、总结本章并给出可点击出处的问题。',
            inputSchema: jsonSchema<{ sectionIndex?: number; maxChars?: number }>({
                type: 'object',
                properties: {
                    sectionIndex: { type: 'number', description: '章节索引；不填则使用当前章节。' },
                    maxChars: { type: 'number', description: '最多返回字符数。' },
                },
                additionalProperties: false,
            }),
            execute: async ({ sectionIndex, maxChars }) => {
                const index = typeof sectionIndex === 'number' ? sectionIndex : context.currentSectionIndex ?? 0
                return getSectionContent(book, index, maxChars ?? readNumberOption(options.maxSectionChars, DEFAULT_MAX_SECTION_CHARS), {
                    includeBlocks: true,
                })
            },
        }),
        getCurrentContext: tool({
            description: '获取当前阅读位置附近的章节文本，可用于回答“本章总结”“这里是什么意思”等上下文问题。',
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
                currentSectionIndex: context.currentSectionIndex ?? 0,
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

function createReadingContext(book: Book, options: Pick<AIChatAskOptions, 'current' | 'currentSectionIndex'>): AIChatReadingContext {
    const rawIndex = options.current?.sectionIndex ?? options.currentSectionIndex
    const sectionIndex = typeof rawIndex === 'number' ? clampSectionIndex(book, rawIndex) : undefined
    const section = typeof sectionIndex === 'number' ? book.sections[sectionIndex] : undefined
    const sectionTitle = options.current?.sectionTitle
        || options.current?.tocLabel
        || (typeof sectionIndex === 'number' ? getSectionTitle(book, sectionIndex, section) : undefined)
    return {
        ...options.current,
        sectionIndex,
        sectionId: options.current?.sectionId ?? section?.id,
        sectionTitle,
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
    const currentSectionIndex = clampSectionIndex(book, options.currentSectionIndex ?? 0)
    const before = Math.max(0, Math.floor(options.before ?? 0))
    const after = Math.max(0, Math.floor(options.after ?? 0))
    const maxChars = Math.max(400, Math.floor(options.maxChars ?? DEFAULT_MAX_CONTEXT_CHARS))
    const start = Math.max(0, currentSectionIndex - before)
    const end = Math.min(book.sections.length - 1, currentSectionIndex + after)
    const sections: AIChatSectionContent[] = []
    let remaining = maxChars

    for (let index = start; index <= end && remaining > 0; index++) {
        const content = await getSectionContent(book, index, remaining)
        sections.push(content)
        remaining -= content.text.length
    }

    return { currentSectionIndex, sections }
}

async function getSectionContent(
    book: Book,
    sectionIndex: number,
    maxChars: number,
    options: { includeBlocks?: boolean } = {},
): Promise<AIChatSectionContent> {
    const index = clampSectionIndex(book, sectionIndex)
    const section = book.sections[index]
    const charLimit = Math.max(200, Math.floor(maxChars))
    if (options.includeBlocks && section.getBlocks) {
        const blockContent = await getSectionContentBlocks(book, index, charLimit)
        return {
            sectionIndex: index,
            sectionId: section.id,
            title: getSectionTitle(book, index, section),
            text: blockContent.text,
            blocks: blockContent.blocks,
            charCount: blockContent.charCount,
            truncated: blockContent.truncated,
        }
    }

    const text = await getSectionSearchText(section)
    const clipped = clipText(text, charLimit)
    return {
        sectionIndex: index,
        sectionId: section.id,
        title: getSectionTitle(book, index, section),
        text: clipped.text,
        charCount: text.length,
        truncated: clipped.truncated,
    }
}

async function searchBookWithCitations(
    book: Book,
    query: string,
    options: AIChatSearchOptions = {},
): Promise<Array<ReturnType<typeof compactCitationSearchResult>>> {
    const maxResults = Math.max(0, Math.floor(options.maxResults ?? DEFAULT_MAX_SEARCH_RESULTS))
    if (!query.trim() || maxResults === 0) return []

    const sectionIndexes = getCitationSearchSectionIndexes(book, options)
    const normalizedQuery = query.toLocaleLowerCase()
    const results: Array<ReturnType<typeof compactCitationSearchResult>> = []

    for (const sectionIndex of sectionIndexes) {
        const section = book.sections[sectionIndex]
        if (!section.getBlocks) {
            const fallback = await searchBook(book, query, {
                scope: 'chapter',
                chapterIndex: sectionIndex,
                maxResults: maxResults - results.length,
                contextChars: options.contextChars ?? 96,
            })
            results.push(...fallback.map(result => compactCitationSearchResult(book, result)))
            if (results.length >= maxResults) break
            continue
        }

        const entries = await getSectionBlockEntries(section)
        let matchIndex = 0
        for (const entry of entries) {
            const haystack = entry.text.toLocaleLowerCase()
            let fromIndex = 0
            while (results.length < maxResults) {
                const start = haystack.indexOf(normalizedQuery, fromIndex)
                if (start < 0) break
                const end = start + query.length
                fromIndex = Math.max(start + 1, end)
                results.push(createCitationSearchResult(book, sectionIndex, section, entry, query, start, end, matchIndex++, options.contextChars ?? 96))
            }
            if (results.length >= maxResults) break
        }
        if (results.length >= maxResults) break
    }

    return results
}

async function getSectionContentBlocks(book: Book, sectionIndex: number, maxChars: number): Promise<{
    blocks: AIChatContentBlock[]
    text: string
    charCount: number
    truncated: boolean
}> {
    const section = book.sections[sectionIndex]
    const entries = await getSectionBlockEntries(section)
    const chapterTitle = getSectionTitle(book, sectionIndex, section)
    const blocks: AIChatContentBlock[] = []
    const textParts: string[] = []
    let used = 0
    let truncated = false

    for (const entry of entries) {
        const remaining = maxChars - used
        if (remaining <= 0) {
            truncated = true
            break
        }
        const text = entry.text.length > remaining ? entry.text.slice(0, remaining) : entry.text
        if (entry.text.length > remaining) truncated = true
        blocks.push({
            blockId: entry.block.id,
            blockType: entry.block.type,
            text,
            citation: createCitation(book, sectionIndex, section, entry.block, chapterTitle),
        })
        textParts.push(text)
        used += text.length
        if (truncated) break
    }

    const charCount = entries.reduce((sum, entry) => sum + entry.text.length, 0)
    return {
        blocks,
        text: textParts.join('\n'),
        charCount,
        truncated,
    }
}

interface AIChatBlockEntry {
    block: TextBlock
    text: string
}

function getCitationSearchSectionIndexes(book: Book, options: AIChatSearchOptions): number[] {
    if (options.scope === 'chapter') {
        return [clampSectionIndex(book, options.sectionIndex ?? 0)]
    }
    return book.sections.map((_, index) => index)
}

async function getSectionBlockEntries(section: Section): Promise<AIChatBlockEntry[]> {
    if (!section.getBlocks) return []
    const blocks = await section.getBlocks()
    return blocks
        .map(block => ({ block, text: textBlockToText(block) }))
        .filter(entry => entry.text)
}

function createCitationSearchResult(
    book: Book,
    sectionIndex: number,
    section: Section,
    entry: AIChatBlockEntry,
    query: string,
    start: number,
    end: number,
    matchIndex: number,
    contextChars: number,
) {
    const contextStart = Math.max(0, start - Math.max(0, contextChars))
    const contextEnd = Math.min(entry.text.length, end + Math.max(0, contextChars))
    const before = entry.text.slice(contextStart, start)
    const match = entry.text.slice(start, end)
    const after = entry.text.slice(end, contextEnd)
    return {
        query,
        sectionIndex,
        sectionId: section.id,
        chapterLabel: getSectionTitle(book, sectionIndex, section),
        matchIndex,
        blockId: entry.block.id,
        blockType: entry.block.type,
        before,
        match,
        after,
        excerpt: `${contextStart > 0 ? '...' : ''}${before}${match}${after}${contextEnd < entry.text.length ? '...' : ''}`,
        citation: createCitation(book, sectionIndex, section, entry.block),
    }
}

function compactCitationSearchResult(book: Book, result: SearchResult) {
    const section = book.sections[result.sectionIndex]
    return {
        sectionIndex: result.sectionIndex,
        sectionId: result.sectionId,
        chapterLabel: result.chapterLabel,
        matchIndex: result.matchIndex,
        excerpt: result.excerpt,
        citation: createCitation(book, result.sectionIndex, section),
    }
}

function createCitation(
    book: Book,
    sectionIndex: number,
    section: Section,
    block?: TextBlock,
    chapterTitle = getSectionTitle(book, sectionIndex, section),
): AIChatCitation {
    const label = [
        chapterTitle || `Section ${sectionIndex + 1}`,
        block?.id,
    ].filter(Boolean).join(' · ')
    const params = new URLSearchParams({
        sectionIndex: String(sectionIndex),
        sectionId: String(section.id),
    })
    if (block?.id) {
        params.set('blockId', block.id)
        params.set('blockType', block.type)
    }
    return {
        label,
        href: `rebook://jump?${params.toString()}`,
        sectionIndex,
        sectionId: section.id,
        blockId: block?.id,
        blockType: block?.type,
    }
}

function textBlockToText(block: TextBlock): string {
    if (block.type === 'image') return normalizeAIChatText(block.image?.alt ?? block.image?.title ?? '')
    if (block.type === 'table') return normalizeAIChatText(block.table?.rows
        .flatMap(row => row.cells.map(cell => cell.text))
        .join(' ') ?? '')
    return normalizeAIChatText(segmentsToPlainText(block.segments))
}

function segmentsToPlainText(segments: readonly TextSegment[]): string {
    return segments
        .filter(segment => segment.source?.nodeType !== 'img')
        .map(segment => segment.text)
        .join('')
}

function normalizeAIChatText(value: string): string {
    return value.replace(/\s+/g, ' ').trim()
}

function getTOCItems(book: Book, maxItems = 80): AIChatTOCItem[] {
    const sectionLookup = createSectionIndexLookup(book)
    const items: AIChatTOCItem[] = []
    const numericMaxItems = Number(maxItems)
    const limit = Number.isFinite(numericMaxItems) ? Math.max(0, Math.floor(numericMaxItems)) : 80

    const visit = (tocItems: readonly TOCItem[] | undefined, depth: number) => {
        if (!tocItems || items.length >= limit) return
        for (const item of tocItems) {
            if (items.length >= limit) break
            const sectionIndex = resolveTOCSectionIndex(book, item.href, sectionLookup)
            items.push({
                label: item.label,
                href: item.href,
                depth,
                sectionIndex: sectionIndex >= 0 ? sectionIndex : undefined,
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
        .map(item => `${'  '.repeat(item.depth)}- [${item.sectionIndex ?? '?'}] ${item.label}`)
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
        '- 用户说“本章”“当前章节”“这里”“这一段”时，默认指当前阅读位置。',
        '- 回答这类问题前必须使用 getCurrentContext 或 getSectionContent 读取当前章节正文。',
        '- getCurrentContext 未指定 maxChars 时默认可读取 20000 字符。',
        '',
        '# 回答格式',
        '- 回答尽量简洁、结构清晰。',
        '- 可以使用 Markdown。',
        '- 基于书中内容回答时，优先在对应观点后添加可点击引用，而不是只标明章节标题或 sectionIndex。',
        '',
        '# 可点击引用规则',
        '- searchBook 和 getSectionContent 的结果会尽量提供 citation.href；getSectionContent 的 blocks 也会提供 blockId、blockType、sectionIndex、sectionId。',
        '- 只要回答涉及书中具体内容、章节总结、概念解释、情节/人物/术语分析、检索结果或对原文观点的归纳，就应当使用工具并生成可点击引用。',
        '- 生成引用的优先级：优先复制工具返回的 citation.href；如果没有 citation.href 但有 blockId，则按规则生成 rebook://jump 链接；如果两者都没有，才只标注章节标题或 sectionIndex。',
        '- 当工具结果提供 citation.href 时，必须逐字复制 citation.href，用 Markdown 链接生成可点击出处：`[章节或段落说明](citation.href)`。',
        '- 当工具结果没有 citation.href 但提供 blockId 时，必须使用工具返回的字段生成链接：`rebook://jump?sectionIndex=<sectionIndex>&sectionId=<encodeURIComponent(sectionId)>&blockId=<encodeURIComponent(blockId)>&blockType=<encodeURIComponent(blockType)>`。',
        '- 如果 blockType 缺失，可以省略 blockType 参数；sectionId、blockId 必须来自工具结果，不要根据文本自行猜测。',
        '- blockId 引用示例：`[出处](rebook://jump?sectionIndex=12&sectionId=OEBPS%2Fxhtml%2Fchapter2.xhtml&blockId=paragraph-21&blockType=paragraph)`。',
        '- 引用应放在它支持的具体观点、句子或列表项后面；不要只把所有引用集中放在文末。',
        '- 每个主要结论、关键概念或检索命中，原则上至少给一个可点击引用。',
        '- 只有在寒暄、说明自身能力、解释如何使用功能、用户明确不需要出处，或工具结果既没有 citation.href 也没有 blockId 时，才可以不生成可点击引用。',
        '- 禁止编造 sectionIndex、sectionId、blockId、blockType；所有定位字段必须来自工具结果。',
        '',
        '# 书籍信息',
        `- 书名：${title}`,
        `- 作者：${authors}`,
        language ? `- 语言：${language}` : '',
        `- 章节数：${book.sections.length}`,
        '',
        formatReadingContext(current),
        tocPreview ? `# 目录预览\n${tocPreview}` : '',
        configuredSystem ? `# 额外指令\n${configuredSystem}` : '',
    ].filter(Boolean).join('\n')
}

function formatReadingContext(current?: AIChatReadingContext): string {
    if (!current || typeof current.sectionIndex !== 'number') return ''
    const rows = [
        `sectionIndex: ${current.sectionIndex}`,
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

function compactSearchResult(result: SearchResult) {
    return {
        sectionIndex: result.sectionIndex,
        sectionId: result.sectionId,
        chapterLabel: result.chapterLabel,
        matchIndex: result.matchIndex,
        excerpt: result.excerpt,
    }
}

function getSectionTitle(book: Book, sectionIndex: number, section?: Section): string | undefined {
    return findTOCItemForSection(book, sectionIndex, section)?.label
}

function clampSectionIndex(book: Book, index: number): number {
    if (!book.sections.length) return 0
    return Math.min(book.sections.length - 1, Math.max(0, Math.floor(index)))
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
