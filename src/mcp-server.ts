#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { pathToFileURL } from 'node:url'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import * as z from 'zod/v4'
import type { Book, Parser } from './core'
import { NodeDOMAdapter, NodeURLFactory } from './adapters/node'
import { EPUBParser } from './parsers/epub'
import { MOBIParser } from './parsers/mobi'
import { FB2Parser } from './parsers/fb2'
import { CBZParser } from './parsers/cbz'
import { PDFParser } from './parsers/pdf'
import { getReadableContent, getReadableContentUnit, getReadableContentUnits } from './core/readable-content'
import { searchBook } from './search'

const SERVER_VERSION = '0.2.1'

export interface RebookMCPServerOptions {
    name?: string
    version?: string
    defaultMaxResults?: number
    maxContentTextChars?: number
}

export async function createRebookMCPServer(
    book: Book,
    options: RebookMCPServerOptions = {},
): Promise<McpServer> {
    const server = new McpServer({
        name: options.name ?? 'rebook-mcp',
        version: options.version ?? SERVER_VERSION,
    })
    const defaultMaxResults = Math.max(1, Math.floor(options.defaultMaxResults ?? 20))
    const maxContentTextChars = Math.max(1, Math.floor(options.maxContentTextChars ?? 12_000))

    server.registerTool('list_content_units', {
        description: 'List the readable content units in the current e-book. EPUB units are sections; PDF units are pages.',
        inputSchema: {},
    }, async () => {
        return toolResult({ units: getReadableContentUnits(book) })
    })

    server.registerTool('search_book', {
        description: 'Search the current e-book. Pass unitIndex to search within one readable content unit.',
        inputSchema: {
            query: z.string().min(1).describe('Search query.'),
            unitIndex: z.number().int().min(0).optional().describe('Optional readable content unit index to limit the search.'),
            maxResults: z.number().int().min(1).optional().describe('Maximum results to return.'),
            caseSensitive: z.boolean().optional().describe('Whether matching is case-sensitive.'),
            wholeWord: z.boolean().optional().describe('Whether to match whole words only.'),
        },
    }, async ({ query, unitIndex, maxResults, caseSensitive, wholeWord }) => {
        const results = await searchBook(book, query, {
            scope: typeof unitIndex === 'number' ? 'unit' : 'book',
            unitIndex,
            maxResults: maxResults ?? defaultMaxResults,
            caseSensitive,
            wholeWord,
        })
        return toolResult({
            query,
            results: results.map(result => ({
                unitIndex: result.unitIndex,
                unitId: result.unitId,
                unitKind: result.unitKind,
                unitTitle: result.unitTitle,
                sectionIndex: result.sectionIndex,
                pageIndex: result.pageIndex,
                matchIndex: result.matchIndex,
                start: result.start,
                end: result.end,
                excerpt: result.excerpt,
            })),
        })
    })

    server.registerTool('get_content_text', {
        description: 'Return readable text for one readable content unit.',
        inputSchema: {
            unitIndex: z.number().int().min(0).describe('Readable content unit index.'),
            maxChars: z.number().int().min(1).optional().describe('Maximum characters to return.'),
        },
    }, async ({ unitIndex, maxChars }) => {
        if (!getReadableContentUnit(book, unitIndex)) throw new Error(`unitIndex out of range: ${unitIndex}`)
        const limit = Math.max(1, Math.floor(maxChars ?? maxContentTextChars))
        const content = await getReadableContent(book, unitIndex)
        return toolResult({
            unitIndex,
            unitId: content.unit.id,
            unitKind: content.unit.kind,
            unitTitle: content.unit.title,
            sectionIndex: content.unit.sectionIndex,
            pageIndex: content.unit.pageIndex,
            truncated: content.text.length > limit,
            text: content.text.slice(0, limit),
        })
    })

    return server
}

export async function openBookFile(filePath: string): Promise<Book> {
    const data = await readFile(filePath)
    const parser = getParserForPath(filePath)
    return parser.parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), {
        domAdapter: new NodeDOMAdapter(),
        urlFactory: new NodeURLFactory(),
    })
}

export async function runRebookMCPServer(argv = process.argv.slice(2)): Promise<void> {
    if (argv.includes('--help') || argv.includes('-h')) {
        printHelp()
        return
    }

    const filePath = argv.find(arg => !arg.startsWith('-')) || process.env.EBOOK_PATH
    if (!filePath) {
        printHelp()
        throw new Error('Missing e-book file path (pass as argument or set EBOOK_PATH env)')
    }

    const book = await openBookFile(filePath)
    const server = await createRebookMCPServer(book, {
        name: `rebook-mcp:${basename(filePath)}`,
    })
    await server.connect(new StdioServerTransport())
    console.error(`rebook MCP server ready: ${filePath}`)
}

function getParserForPath(filePath: string): Parser {
    const lower = filePath.toLowerCase()
    if (lower.endsWith('.epub')) return new EPUBParser()
    if (lower.endsWith('.mobi') || lower.endsWith('.azw3')) return new MOBIParser()
    if (lower.endsWith('.fb2')) return new FB2Parser()
    if (lower.endsWith('.cbz') || lower.endsWith('.zip')) return new CBZParser()
    if (lower.endsWith('.pdf')) return new PDFParser()
    throw new Error(`Unsupported e-book format: ${filePath}`)
}

function toolResult(value: Record<string, unknown>) {
    return {
        content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
        structuredContent: value,
    }
}

function printHelp(): void {
    console.error(`Usage: rebook-mcp <ebook-file>
       EBOOK_PATH=/path/to/book.epub rebook-mcp

Start a stdio MCP server for one EPUB, MOBI/AZW3, FB2, or CBZ file.
The file path can be passed as an argument or via the EBOOK_PATH env var.

Example MCP client config (argument):
{
  "mcpServers": {
    "book": {
      "command": "npx",
      "args": ["-y", "--package", "rebook", "rebook-mcp", "/absolute/path/book.epub"]
    }
  }
}

Example MCP client config (env var):
{
  "mcpServers": {
    "book": {
      "command": "npx",
      "args": ["-y", "--package", "rebook", "rebook-mcp"],
      "env": {
        "EBOOK_PATH": "/absolute/path/book.epub"
      }
    }
  }
}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    runRebookMCPServer().catch(error => {
        console.error(error instanceof Error ? error.message : error)
        process.exit(1)
    })
}
