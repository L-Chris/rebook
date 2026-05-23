# ebook-js

[中文文档](./README.zh-CN.md) | [API Reference](./docs/API.md) | [Architecture](./docs/ARCHITECTURE.md) | [Experience & Lessons](./docs/EXPERIENCE.md)

A modular, extensible e-book parsing and rendering library for the web.

Inspired by [foliate-js](https://github.com/johnfactotum/foliate-js), but restructured with a clean separation between **parsers** (file format handling) and **renderers** (platform-specific display).

## Features

- **Modular architecture**: Parsers and renderers are independent — mix and match
- **TypeScript**: Full type safety with comprehensive interfaces
- **Multi-format support**: EPUB 2.x/3.x, MOBI/AZW/AZW3, FictionBook 2, and CBZ
- **AI-friendly Document Model**: SlateJS-inspired tree structure with query and mutation APIs for content manipulation (translation, annotation, restructuring)
- **Environment-agnostic parsers**: All parsers run in browser, Node.js, or workers via adapter injection
- **Browser renderer**: Paginated and scrolled reading modes with auto-spread (two-page layout on wide screens)
- **Malformed EPUB recovery**: Multi-layer fallback for broken zip archives
- **Framework-agnostic**: Core library works with any framework; React/Vue wrappers coming

## Installation

```bash
npm install ebook-js
```

## Supported Formats

| Format | Extensions | Parser | Notes |
|--------|-----------|--------|-------|
| EPUB 2/3 | `.epub` | `EPUBParser` | Full support: navigation, spine, font deobfuscation, landmarks |
| Mobipocket / Kindle | `.mobi`, `.azw`, `.azw3` | `MOBIParser` | MOBI6 + KF8, PalmDOC + HUFF/CDIC, EXTH metadata, NCX |
| FictionBook 2 | `.fb2`, `.fbz`, `.fb2.zip` | `FB2Parser` | FB2 XML to XHTML conversion, FBZ archive support |
| Comic Book Zip | `.cbz` | `CBZParser` | Sequential images from zip archives |

## Quick Start

```typescript
import { registry, createReader, UnsupportedFormatError } from 'ebook-js'
import { epub } from 'ebook-js/parsers/epub'
import { mobi } from 'ebook-js/parsers/mobi'
import { fb2 } from 'ebook-js/parsers/fb2'
import { cbz } from 'ebook-js/parsers/cbz'

// Register parsers for auto-detection
registry.register('epub', epub)
registry.register('mobi', mobi)
registry.register('fb2', fb2)
registry.register('cbz', cbz)

// Create reader with auto-spread enabled (default)
const reader = createReader({
    container: document.getElementById('viewer')!,
    layout: 'paginated',
    maxColumnCount: 2, // Enable two-page spread on wide screens (default: 2)
    styles: {
        fontSize: '16px',
        maxInlineSize: '720px', // Max width per page
        gap: '48px', // Gap between pages
    },
})

// Open and navigate
const book = await reader.open(file)
await reader.next()
await reader.goTo('/path/to/chapter.xhtml#section')

// Control spread at runtime
reader.setSpread(2) // Enable auto-spread (2 pages on wide screens)
reader.setSpread(1) // Force single page
```

### Auto-Spread Layout

In paginated mode, the renderer uses a grid-sized page window and automatically displays two pages side-by-side when the container is wide enough:

- **Container width ≥ 2 × `maxInlineSize` + `gap`**: Shows 2 pages (spread)
- **Container width < 2 × `maxInlineSize` + `gap`**: Shows 1 page (single)
- **Resizing**: Recomputes the grid span and switches between spread and single-page

The `maxColumnCount` config option (default: `2`) controls the maximum number of visible pages. Set to `1` to always use single-page layout.

## Document Model (AI-friendly)

Each section exposes a structured document tree with query and mutation APIs:

```typescript
const section = book.sections[0]
const doc = await section.getDocument()

// Query with CSS-like selectors
const paragraphs = doc.query('p')
const images = doc.getImages()
const text = doc.getText()

// Immutable mutations (returns new document)
const newDoc = doc
    .setNode([0], { class: 'highlight' })
    .insertNode([1], elementNode('p', {}, [textNode('Added by AI')]))
    .replaceText([0, 0], 'Translated text')

// Serialize back to HTML
const html = newDoc.serialize()
```

This enables AI-powered workflows: translation, content summarization, annotation, accessibility enhancement, layout adaptation, and more. See [API Reference](./docs/API.md#document-model) for details.

## Documentation

- [**API Reference**](./docs/API.md) — Full API documentation: parsers, renderer, adapters, Document Model, error types, metadata normalization
- [**Architecture**](./docs/ARCHITECTURE.md) — Design decisions, parser/renderer separation, adapter system, cross-platform rendering
- [**Experience & Lessons**](./docs/EXPERIENCE.md) — AI-friendly design rationale, SlateJS patterns, malformed EPUB handling, performance notes

## Development

```bash
npm install       # Install dependencies
npm run dev       # Run demo
npm run typecheck # Type check
npm run build     # Build
npm test          # Run tests
```

## Comparison with foliate-js

| Feature | foliate-js | ebook-js |
|---------|-----------|----------|
| Language | JavaScript | TypeScript |
| Architecture | Monolithic view.js | Separated parser/renderer |
| Browser coupling | Parser uses DOM APIs | Parser is env-agnostic (adapters) |
| Document Model | None | SlateJS-inspired tree with mutations |
| Format support | EPUB, MOBI, FB2, CBZ, PDF | EPUB, MOBI/AZW3, FB2, CBZ |
| Testing | None | Vitest (208 tests) |
| Malformed EPUB recovery | None | CD correction + per-entry LFH scan |

## License

MIT

## Credits

Based on the excellent [foliate-js](https://github.com/johnfactotum/foliate-js) by John Factotum.
