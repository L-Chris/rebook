# ebook-js

[中文文档](./README.zh-CN.md)

A modular, extensible e-book parsing and rendering library for the web.

Inspired by [foliate-js](https://github.com/johnfactotum/foliate-js), but restructured with a clean separation between **parsers** (file format handling) and **renderers** (platform-specific display).

## Features

- **Modular architecture**: Parsers and renderers are independent — mix and match
- **TypeScript**: Full type safety with comprehensive interfaces
- **EPUB support**: Full EPUB 2.x and 3.x parsing with metadata, TOC, and navigation
- **Environment-agnostic parser**: EPUB parser runs in browser, Node.js, or workers via adapter injection
- **Browser renderer**: Paginated and scrolled reading modes
- **Progress tracking**: Section and TOC-level progress reporting
- **Framework-agnostic**: Core library works with any framework; React/Vue wrappers coming

## Installation

```bash
npm install ebook-js
```

## Quick Start

```typescript
import { registry, createReader } from 'ebook-js'
import { epub } from 'ebook-js/parsers/epub'

// 1. Register parsers
registry.register('epub', epub)

// 2. Create reader
const reader = createReader({
    container: document.getElementById('viewer')!,
})

// 3. Open a book (File, Blob, or URL)
const book = await reader.open(file)

// 4. Navigate
await reader.next()
await reader.prev()
await reader.goTo('/path/to/chapter.xhtml#section')
```

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                          ebook-js                             │
├────────────────────────────┬─────────────────────────────────┤
│         Parsers            │           Renderers             │
│                            │                                 │
│  ┌──────────────────────┐  │  ┌───────────────────────────┐  │
│  │  EPUB Parser         │  │  │  Browser Renderer         │  │
│  │  (env-agnostic)      │  │  │  (paginated/scrolled)     │  │
│  └──────────┬───────────┘  │  └───────────────────────────┘  │
│             │              │  ┌───────────────────────────┐  │
│  ┌──────────┴───────────┐  │  │  React/Vue Wrappers       │  │
│  │  Adapters (injected) │  │  │  (planned)                │  │
│  │  - DOMAdapter        │  │  └───────────────────────────┘  │
│  │  - URLFactory        │  │                                 │
│  └──────────────────────┘  │                                 │
│                            │                                 │
│         │                  │            ▲                    │
│         ▼                  │            │                    │
│      Book Interface ───────┼────────────┘                    │
│   (common contract)        │                                 │
└────────────────────────────┴─────────────────────────────────┘
```

### Design Principles

1. **Parsers are environment-agnostic**: The EPUB parser has no browser dependencies. DOM parsing and URL creation are injected via adapters.
2. **Renderers own the browser**: Browser-specific concerns (iframe, CSS columns, DOM events) live in renderers.
3. **Book is the contract**: Parsers produce a `Book`, renderers consume it. Neither knows about the other.

### Key Interfaces

#### `Book` (output of parsers, input to renderers)
```typescript
interface Book {
    sections: Section[]        // Ordered list of chapters
    dir?: 'ltr' | 'rtl'       // Page progression direction
    toc?: TOCItem[]           // Table of contents
    metadata?: BookMetadata   // Title, author, etc.
    rendition?: Rendition     // Layout hints
    resolveHref?(href): ResolvedNavigation | null
    getCover?(): Promise<Blob | null>
}
```

#### `Section` (a single chapter/document)
```typescript
interface Section {
    id: string | number
    load(): Promise<string>              // Returns URL for content (via URLFactory)
    unload?(): void                      // Free resources
    createDocument?(): Promise<string>   // Returns raw HTML string for searching
    size: number                         // Byte size for progress
}
```

#### `Parser`
```typescript
interface Parser {
    parse(input, options?): Promise<Book>
    canParse(input): Promise<boolean>
}

interface ParserOptions {
    domAdapter?: DOMAdapter    // Injected DOM parser (required for EPUB)
    urlFactory?: URLFactory    // Injected URL factory (required for EPUB)
    sha1?: (data: ArrayBuffer) => Promise<ArrayBuffer>
    onProgress?: (progress: number, message?: string) => void
}
```

#### `Renderer`
```typescript
interface Renderer {
    open(book): Promise<void>
    goTo(target): Promise<void>
    next(): Promise<void>
    prev(): Promise<void>
    setStyles(styles): void
    on(event, listener): void
}
```

## Adapter System

The EPUB parser uses dependency injection to remain environment-agnostic. Two adapters must be provided via `ParserOptions`:

### `DOMAdapter`

Abstracts DOM parsing and querying:

```typescript
interface DOMAdapter {
    parseXML(str: string): XMLDocument
    parseHTML(str: string, mimeType?: string): XMLDocument
    serialize(doc: XMLDocument): string
}
```

### `URLFactory`

Abstracts blob URL creation:

```typescript
interface URLFactory {
    createURL(data: string | ArrayBuffer, mimeType: string): string
    revokeURL(url: string): void
}
```

### Built-in Adapters

| Adapter | Package | Environment |
|---------|---------|-------------|
| `BrowserDOMAdapter` | `ebook-js` | Browser |
| `BrowserURLFactory` | `ebook-js` | Browser |
| `TestDOMAdapter` | `ebook-js/adapters/test` | Node.js (uses @xmldom/xmldom) |
| `TestURLFactory` | `ebook-js/adapters/test` | Node.js (fake URLs) |

### Browser Usage (Auto-wired)

When using `createReader()`, browser adapters are auto-injected:

```typescript
import { createReader, registry } from 'ebook-js'
import { epub } from 'ebook-js/parsers/epub'

registry.register('epub', epub)
const reader = createReader({ container: element })
// Browser adapters are automatically provided
await reader.open(file)
```

### Node.js / Worker Usage

Provide adapters explicitly when parsing outside the browser:

```typescript
import { registry } from 'ebook-js'
import { epub } from 'ebook-js/parsers/epub'
import { TestDOMAdapter, TestURLFactory } from 'ebook-js/adapters/test'

registry.register('epub', epub)

const domAdapter = new TestDOMAdapter()
const urlFactory = new TestURLFactory()

const book = await registry.open(arrayBuffer, { domAdapter, urlFactory })
```

## API Reference

### Parser Registry

```typescript
import { registry } from 'ebook-js'

// Register a parser
registry.register('epub', epub)

// Auto-detect and parse
const book = await registry.open(file, { domAdapter, urlFactory })

// Check what parsers are available
registry.list() // ['epub']
```

### Reader View (High-Level API)

```typescript
import { createReader } from 'ebook-js'

const reader = createReader({
    container: element,
    layout: 'paginated', // or 'scrolled'
    styles: {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        lineHeight: 1.6,
        textAlign: 'justify',
        hyphenate: true,
    },
})

// Open
await reader.open(file)

// Navigation
await reader.next()
await reader.prev()
await reader.goLeft()    // Respects RTL
await reader.goRight()   // Respects RTL
await reader.goTo(href)
await reader.goToFraction(0.5)

// Styling
reader.setStyles({ fontSize: '18px' })
reader.setLayout('scrolled')

// Events
reader.on('load', (e) => console.log('Section loaded:', e.index))
reader.on('relocate', (e) => console.log('Location:', e))
reader.on('link', (e) => {
    if (e.external) window.open(e.href)
})

// Metadata
const metadata = reader.getMetadata()
const toc = reader.getTOC()
const location = reader.getLocation()
const fractions = reader.getSectionFractions() // For progress bar ticks

// Cleanup
reader.destroy()
```

### Styles

```typescript
interface RendererStyles {
    fontFamily?: string
    fontSize?: string
    lineHeight?: number | string
    textAlign?: 'start' | 'justify' | 'center'
    hyphenate?: boolean
    css?: string           // Custom CSS
    theme?: 'light' | 'dark' | 'sepia'
    color?: string
    background?: string
    gap?: string           // Column gap (paginated)
    maxInlineSize?: string // Max column width
    maxBlockSize?: string  // Max page height
    margin?: string        // Header/footer margin
}
```

## Development

```bash
# Install dependencies
npm install

# Run demo
npm run dev

# Type check
npm run typecheck

# Build
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Project Structure

```
src/
├── core/               # Shared interfaces and types
│   ├── types.ts        # Book, Section, TOCItem, etc.
│   ├── parser.ts       # Parser interface and registry
│   ├── renderer.ts     # Renderer interface
│   ├── dom-adapter.ts  # DOMAdapter interface
│   └── url-factory.ts  # URLFactory interface
├── adapters/
│   ├── browser.ts      # Browser DOM/URL adapters
│   └── test.ts         # Node.js test adapters
├── parsers/
│   └── epub.ts         # EPUB parser (env-agnostic)
├── loaders/
│   └── zip-loader.ts   # Zip archive loader
├── renderers/
│   └── browser/        # Browser renderer
│       ├── paginator.ts
│       └── view.ts     # High-level ReaderView
└── utils/
    └── progress.ts     # Progress tracking

tests/
├── fixtures/           # Test EPUB generator
├── parsers/            # EPUB parser tests
└── utils/              # Progress utility tests
```

## Comparison with foliate-js

| Feature | foliate-js | ebook-js |
|---------|-----------|----------|
| Language | JavaScript | TypeScript |
| Architecture | Monolithic view.js | Separated parser/renderer |
| Browser coupling | Parser uses DOM APIs | Parser is env-agnostic (adapters) |
| Entry point | Custom element | Function API |
| Framework support | None | Planned React/Vue |
| Format support | EPUB, MOBI, FB2, CBZ, PDF | EPUB (others planned) |
| Module system | ESM | ESM + typed exports |
| Build | None (raw ESM) | Vite + TypeScript |
| Testing | None | Vitest (45 tests) |

## License

MIT

## Credits

Based on the excellent [foliate-js](https://github.com/johnfactotum/foliate-js) by John Factotum.
