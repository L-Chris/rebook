import {
    generateText,
    jsonSchema,
    stepCountIs,
    tool,
    type LanguageModel,
    type ModelMessage,
    type ToolSet,
} from 'ai'
import type { Book, BookMetadata, Contributor, LanguageMap, RebookPlugin, Section, TOCItem } from '../core/types'
import { createSectionIndexLookup, findTOCItemForSection, flattenTOC, resolveTOCSectionIndex } from '../core/toc'
import { getSectionSearchText, searchBook, type SearchResult, type SearchScope } from '../search'

export type AIChatRole = 'user' | 'assistant'

export interface AIChatMessage {
    role: AIChatRole
    content: string
}

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

export interface AIChatSearchOptions {
    scope?: SearchScope
    sectionIndex?: number
    maxResults?: number
    contextChars?: number
}

export interface AIChatSectionContentOptions {
    maxChars?: number
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
    charCount: number
    truncated: boolean
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
        search: (query, searchOptions = {}) => searchBook(book, query, {
            scope: searchOptions.scope ?? 'book',
            chapterIndex: searchOptions.sectionIndex,
            maxResults: searchOptions.maxResults ?? readNumberOption(options.maxSearchResults, DEFAULT_MAX_SEARCH_RESULTS),
            contextChars: searchOptions.contextChars ?? 80,
        }),
        getTOC: maxItems => getTOCItems(book, maxItems),
        getSectionContent: (sectionIndex, sectionOptions = {}) =>
            getSectionContent(book, sectionIndex, sectionOptions.maxChars ?? readNumberOption(options.maxSectionChars, DEFAULT_MAX_SECTION_CHARS)),
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
            description: '在全书或当前章节中搜索关键词，返回带上下文的匹配片段。',
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
                const results = await searchBook(book, query, {
                    scope: scope ?? 'book',
                    chapterIndex,
                    maxResults: maxResults ?? readNumberOption(options.maxSearchResults, DEFAULT_MAX_SEARCH_RESULTS),
                    contextChars: 96,
                })
                return {
                    query,
                    results: results.map(compactSearchResult),
                }
            },
        }),
        getSectionContent: tool({
            description: '获取指定章节正文。适合回答需要引用章节内容的问题。',
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
                return getSectionContent(book, index, maxChars ?? readNumberOption(options.maxSectionChars, DEFAULT_MAX_SECTION_CHARS))
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

async function getSectionContent(book: Book, sectionIndex: number, maxChars: number): Promise<AIChatSectionContent> {
    const index = clampSectionIndex(book, sectionIndex)
    const section = book.sections[index]
    const text = await getSectionSearchText(section)
    const charLimit = Math.max(200, Math.floor(maxChars))
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
        '- 引用或总结书中内容时，标明章节标题或 sectionIndex。',
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
    return messages.map(message => ({
        role: message.role,
        content: message.content,
    }))
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
