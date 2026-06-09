# rebook

[中文文档](./README.zh-CN.md) | [API Reference](./docs/API.md) | [Architecture](./docs/ARCHITECTURE.md) | [Experience & Lessons](./docs/EXPERIENCE.md)

rebook is a TypeScript e-book toolkit for building fast readers and book workflows across browser, Mini Program, Node.js, and worker-like runtimes.

It parses EPUB, MOBI/AZW3, FB2, and CBZ into a normalized `Book` contract. Browser and WeChat Mini Program renderers, exporters, search, plugins, and AI-oriented document workflows all build on that same contract.

## Highlights

- **Fast page turns**: rebook lays sections out into Pretext-backed line ranges, then renders only the visible lines. Normal page turns update a page index and a small DOM/snapshot window instead of reflowing a full chapter DOM or iframe.
- **Cross-platform rendering**: browser rendering uses lightweight DOM rows; WeChat Mini Program rendering emits serializable snapshots for WXML.
- **Multi-format parsing**: EPUB 2/3, MOBI/AZW/AZW3, FictionBook 2, and CBZ.
- **Environment-agnostic parsers**: parser adapters make the same parser code run in browsers, Node.js, Mini Programs, and workers.
- **Modular architecture**: parsers, renderers, exporters, plugins, and adapters are independent.
- **AI-ready content model**: sections can expose structured blocks, styled segments, searchable text, and a mutable document tree.
- **Built-in workflow pieces**: search, first-section export, trial-reading limits, TTS playback hooks, professional translation pipelines, and an MCP server.

## Install

```bash
npm install rebook
```

## Browser Reader

```typescript
import { registry, createReader } from 'rebook'
import { epub } from 'rebook/parsers/epub'
import { mobi } from 'rebook/parsers/mobi'
import { fb2 } from 'rebook/parsers/fb2'
import { cbz } from 'rebook/parsers/cbz'

registry.register('epub', epub)
registry.register('mobi', mobi)
registry.register('fb2', fb2)
registry.register('cbz', cbz)

const reader = createReader({
    container: document.getElementById('viewer')!,
    layout: 'paginated',
    maxColumnCount: 2,
    styles: {
        fontSize: '18px',
        lineHeight: 1.7,
        minColumnWidth: '320px',
        maxColumnWidth: '720px',
        margin: '32px',
    },
})

const book = await reader.open(file)
await reader.next()
await reader.goTo('chapter.xhtml#section')
```

## WeChat Mini Program Reader

Use the Mini Program reader when there is no DOM. It installs Mini Program parser adapters by default and can use `wx.createOffscreenCanvas` for text measurement.

```typescript
import { registry } from 'rebook'
import { epub } from 'rebook/parsers/epub'
import { createWechatMiniProgramReader } from 'rebook/renderers/wechat-miniprogram'

registry.register('epub', epub)

const fs = wx.getFileSystemManager()
const arrayBuffer = fs.readFileSync(filePath) as ArrayBuffer
const unitlessStyles = new Set(['fontWeight', 'opacity', 'zIndex'])
const toStyleText = (style: Record<string, string | number> = {}) =>
    Object.entries(style)
        .map(([key, value]) => {
            const cssKey = key.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)
            const cssValue = typeof value === 'number' && !unitlessStyles.has(key)
                ? `${value}px`
                : String(value)
            return `${cssKey}:${cssValue}`
        })
        .join(';')

const reader = createWechatMiniProgramReader({
    width: 375,
    height: 667,
    wx,
    layout: 'paginated',
    styles: { fontSize: '18px', lineHeight: 1.7 },
    setData: snapshot => this.setData({
        reader: {
            ...snapshot,
            lines: snapshot.lines.map(line => ({
                ...line,
                styleText: toStyleText(line.style),
                fragments: 'fragments' in line
                    ? line.fragments.map(fragment => ({
                        ...fragment,
                        styleText: toStyleText(fragment.style),
                    }))
                    : undefined,
            })),
        },
    }),
})

await reader.open(arrayBuffer)
await reader.next()
```

Render `reader.lines` from the snapshot in WXML. Each line node includes layout style and text/image/table data. Convert style objects to CSS strings before passing them to WXML. See [API Reference: WeChat Mini Program Reader](./docs/API.md#wechat-mini-program-reader) for a fuller integration example.

## MCP Server

`rebook-mcp` exposes a local book to AI assistants through the Model Context Protocol. It supports EPUB, MOBI/AZW3, FB2, and CBZ.

```json
{
  "mcpServers": {
    "book": {
      "command": "npx",
      "args": ["-y", "--package", "rebook", "rebook-mcp", "/absolute/path/book.epub"]
    }
  }
}
```

Built-in tools include chapter listing, chapter text reading, metadata lookup, and full-book or chapter-scoped search. See [MCP Tools](./docs/API.md#mcp-tools) for embedding APIs.

## Supported Formats

| Format | Extensions |
|--------|------------|
| EPUB 2/3 | `.epub` |
| Mobipocket / Kindle | `.mobi`, `.azw`, `.azw3` |
| FictionBook 2 | `.fb2`, `.fbz`, `.fb2.zip` |
| Comic Book Zip | `.cbz` |

## More APIs

- **Trial reading**: `withTrialLimit({ maxPages })`, trial-aware TOC items, and guarded navigation. See [Plugins](./docs/API.md#plugins).
- **Export**: `exportFirstSections()` and `exportBook()` support EPUB, CBZ, TXT, and HTML output. See [First Sections Export](./docs/API.md#first-sections-export).
- **Search**: `searchBook()`, `searchChapters()`, `reader.search()`, and `reader.searchChapters()`. See [Search](./docs/API.md#search).
- **Document Model**: query and mutate section trees for AI workflows, annotation, transformation, and serialization. See [Document Model](./docs/API.md#document-model).
- **Pretext layout**: use `prepareBlocks()`, `layout()`, and `getVisibleLines()` directly for custom renderers. See [Pretext Layout](./docs/API.md#pretext-layout).

## Documentation

- [**API Reference**](./docs/API.md) - API details for readers, parsers, renderers, plugins, exporters, adapters, search, MCP, and document APIs.
- [**Architecture**](./docs/ARCHITECTURE.md) - Parser/renderer separation, adapter design, rendering pipeline, and project layout.
- [**Experience & Lessons**](./docs/EXPERIENCE.md) - Design rationale, performance notes, AI workflow ideas, and implementation lessons.

## Development

```bash
npm install
npm run dev
npm run typecheck
npm run build
npm test
```

## License

MIT

## Credits

Based on the excellent [foliate-js](https://github.com/johnfactotum/foliate-js) by John Factotum.
