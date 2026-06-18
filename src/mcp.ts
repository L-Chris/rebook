import type { Book } from './core/types'
import { getReadableContent, getReadableContentUnit, getReadableContentUnits } from './core/readable-content'
import { searchBook, type SearchOptions, type SearchResult } from './search'

type JSONSchema = Record<string, unknown>

export interface MCPToolDefinition<TArgs extends Record<string, unknown> = Record<string, unknown>, TResult = unknown> {
    name: string
    description: string
    inputSchema: JSONSchema
    handler(args: TArgs): Promise<TResult> | TResult
}

export interface MCPToolCallResult {
    content: Array<{ type: 'text'; text: string }>
    structuredContent?: unknown
}

export interface BookMCPOptions {
    /** Defaults to 20. */
    defaultMaxResults?: number
    /** Defaults to 12000. */
    maxContentTextChars?: number
}

export interface SearchBookToolArgs extends Record<string, unknown> {
    query?: string
    unitIndex?: number
    maxResults?: number
    caseSensitive?: boolean
    wholeWord?: boolean
}

export interface GetContentTextToolArgs extends Record<string, unknown> {
    unitIndex?: number
    maxChars?: number
}

/**
 * Create Model Context Protocol style tools for a parsed Book. The returned
 * objects are SDK-agnostic: adapters can register `name`, `description`,
 * `inputSchema`, and call `handler(args)` from any MCP server implementation.
 */
export function createBookMCPTools(book: Book, options: BookMCPOptions = {}): MCPToolDefinition[] {
    const defaultMaxResults = Math.max(1, Math.floor(options.defaultMaxResults ?? 20))
    const maxContentTextChars = Math.max(1, Math.floor(options.maxContentTextChars ?? 12_000))

    return [
        {
            name: 'list_content_units',
            description: 'List the readable content units in the current e-book. EPUB units are sections; PDF units are pages.',
            inputSchema: objectSchema({}),
            handler: () => toToolResult(getReadableContentUnits(book)),
        },
        {
            name: 'search_book',
            description: 'Search the current e-book. Pass unitIndex to search within one readable content unit.',
            inputSchema: objectSchema({
                query: { type: 'string', description: 'Search query.' },
                unitIndex: { type: 'number', description: 'Optional readable content unit index to limit the search.' },
                maxResults: { type: 'number', description: 'Maximum results to return.' },
                caseSensitive: { type: 'boolean', description: 'Whether matching is case-sensitive.' },
                wholeWord: { type: 'boolean', description: 'Whether to match whole words only.' },
            }, ['query']),
            handler: async (args: SearchBookToolArgs) => {
                const query = getRequiredString(args.query, 'query')
                const searchOptions: SearchOptions = {
                    maxResults: getPositiveInteger(args.maxResults, defaultMaxResults),
                    caseSensitive: args.caseSensitive === true,
                    wholeWord: args.wholeWord === true,
                }
                if (typeof args.unitIndex === 'number') {
                    searchOptions.scope = 'unit'
                    searchOptions.unitIndex = args.unitIndex
                }
                const results = await searchBook(book, query, searchOptions)
                return toToolResult({
                    query,
                    results: results.map(toMCPSearchResult),
                })
            },
        },
        {
            name: 'get_content_text',
            description: 'Return readable text for one content unit.',
            inputSchema: objectSchema({
                unitIndex: { type: 'number', description: 'Readable content unit index.' },
                maxChars: { type: 'number', description: 'Maximum characters to return.' },
            }, ['unitIndex']),
            handler: async (args: GetContentTextToolArgs) => {
                const unitIndex = getUnitIndex(book, args.unitIndex)
                const maxChars = getPositiveInteger(args.maxChars, maxContentTextChars)
                const content = await getReadableContent(book, unitIndex)
                return toToolResult({
                    unitIndex,
                    unitId: content.unit.id,
                    unitKind: content.unit.kind,
                    unitTitle: content.unit.title,
                    sectionIndex: content.unit.sectionIndex,
                    pageIndex: content.unit.pageIndex,
                    truncated: content.text.length > maxChars,
                    text: content.text.slice(0, maxChars),
                })
            },
        },
    ]
}

export async function callBookMCPTool(
    tools: readonly MCPToolDefinition[],
    name: string,
    args: Record<string, unknown> = {},
): Promise<MCPToolCallResult> {
    const tool = tools.find(item => item.name === name)
    if (!tool) throw new Error(`Unknown MCP tool: ${name}`)
    return tool.handler(args) as Promise<MCPToolCallResult>
}

function toMCPSearchResult(result: SearchResult) {
    return {
        sectionIndex: result.sectionIndex,
        pageIndex: result.pageIndex,
        unitIndex: result.unitIndex,
        unitId: result.unitId,
        unitKind: result.unitKind,
        unitTitle: result.unitTitle,
        matchIndex: result.matchIndex,
        start: result.start,
        end: result.end,
        excerpt: result.excerpt,
    }
}

function toToolResult(value: unknown): MCPToolCallResult {
    return {
        content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
        structuredContent: value,
    }
}

function objectSchema(properties: Record<string, JSONSchema>, required: string[] = []): JSONSchema {
    return {
        type: 'object',
        properties,
        required,
        additionalProperties: false,
    }
}

function getRequiredString(value: unknown, name: string): string {
    if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing required string argument: ${name}`)
    return value
}

function getUnitIndex(book: Book, value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('unitIndex must be a number')
    const index = Math.floor(value)
    if (!getReadableContentUnit(book, index)) throw new Error(`unitIndex out of range: ${index}`)
    return index
}

function getPositiveInteger(value: unknown, fallback: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
    return Math.max(1, Math.floor(value))
}
