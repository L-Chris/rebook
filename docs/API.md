# API Reference

Complete API documentation for ebook-js.

## Table of Contents

- [Parser Registry](#parser-registry)
- [ReaderView](#readerview)
- [Book](#book)
- [Section](#section)
- [Document Model](#document-model)
- [Parser Interface](#parser-interface)
- [Renderer Interface](#renderer-interface)
- [Adapter System](#adapter-system)
- [Error Types](#error-types)
- [Metadata Normalization](#metadata-normalization)
- [Styles](#styles)
- [Default Format Styles](#default-format-styles)
- [Parser Detection Priority](#parser-detection-priority)

---

## Parser Registry

The central hub for registering and auto-detecting parsers.

```typescript
import { registry } from 'ebook-js'

// Register a parser factory
registry.register('epub', epub)
registry.register('mobi', mobi)
registry.register('fb2', fb2)
registry.register('cbz', cbz)

// Register with custom priority (higher = checked first)
registry.register('cbz', cbz, 20)

// Auto-detect format and parse
const book = await registry.open(file, { domAdapter, urlFactory })

// Detect format only (without parsing)
const parser = await registry.detect(file)

// List registered parsers
registry.list() // ['epub', 'mobi', 'fb2', 'cbz']
```

### `registry.open(input, options?)`

Auto-detect format and parse. `input` can be a `File`, `Blob`, `ArrayBuffer`, or URL string.

### `registry.detect(input)`

Returns the first parser whose `canParse()` returns `true`, or `null`.

### `registry.list()`

Returns an array of registered parser names.

---

## ReaderView

High-level API combining parser registry, renderer, and navigation.

```typescript
import { createReader } from 'ebook-js'

const reader = createReader({
    container: document.getElementById('viewer')!,
    layout: 'paginated', // or 'scrolled'
    styles: {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        lineHeight: 1.6,
        textAlign: 'justify',
        hyphenate: true,
    },
})
```

### Opening

```typescript
await reader.open(file)           // File, Blob, ArrayBuffer, or URL string
await reader.openBook(book)       // Pre-parsed Book instance
```

### Navigation

```typescript
await reader.next()              // Next section/page
await reader.prev()              // Previous section/page
await reader.goLeft()            // Respects RTL direction
await reader.goRight()           // Respects RTL direction
await reader.goTo(href)          // Navigate to TOC href
await reader.goToFraction(0.5)   // Navigate to 50% progress
```

### Styling & Layout

```typescript
reader.setStyles({ fontSize: '18px', theme: 'dark' })
reader.setLayout('scrolled')
```

### Events

```typescript
reader.on('load', (e) => {
    // Section loaded
    console.log('index:', e.index)
})

reader.on('relocate', (e) => {
    // Location changed
    console.log('section:', e.sectionIndex, 'fraction:', e.fraction)
})

reader.on('link', (e) => {
    // Link clicked
    if (e.external) window.open(e.href)
    else reader.goTo(e.href)
})
```

### State

```typescript
const metadata = reader.getMetadata()    // BookMetadata
const toc = reader.getTOC()              // TOCItem[]
const location = reader.getLocation()    // Current location
const fractions = reader.getSectionFractions() // Per-section progress ticks
```

### Cleanup

```typescript
reader.destroy() // Release all resources
```

---

## Book

The output of parsers and input to renderers. This is the central contract.

```typescript
interface Book {
    sections: Section[]              // Ordered list of sections (chapters)
    dir?: 'ltr' | 'rtl'             // Page progression direction
    toc?: TOCItem[]                  // Table of contents
    landmarks?: Landmark[]           // Named locations (cover, toc, bodymatter...)
    metadata?: BookMetadata          // Title, author, etc.
    rendition?: Rendition            // Layout hints
    resolveHref?(href: string): ResolvedNavigation | null
    getCover?(): Promise<Blob | null>
    destroy(): void                  // Release all resources
}
```

### `BookMetadata`

All parsers normalize metadata to these consistent types:

| Field | Type | Notes |
|-------|------|-------|
| `title` | `string` | Plain string |
| `subtitle` | `string` | Plain string |
| `author` | `Contributor[]` | Array of `{ name, sortAs?, role? }` |
| `translator` | `Contributor[]` | Array |
| `editor` | `Contributor[]` | Array |
| `publisher` | `string` | Plain string |
| `language` | `string` | Single string (first if multiple) |
| `subject` | `string[]` | Array of strings |
| `identifier` | `string` | Plain string |
| `published` | `string` | Date string |
| `modified` | `string` | Date string |
| `description` | `string` | May contain HTML |
| `belongsTo` | `{ series?, collection? }` | Series info with `{ name, position?, total? }` |

### `TOCItem`

```typescript
interface TOCItem {
    label: string
    href: string
    subitems?: TOCItem[]
}
```

### `Landmark`

```typescript
interface Landmark {
    label: string
    href: string
    type: string // 'cover', 'toc', 'bodymatter', etc.
}
```

### `Rendition`

```typescript
interface Rendition {
    layout?: 'reflowable' | 'pre-paginated'
    flow?: 'paginated' | 'scrolled' | 'continuous'
    spread?: 'none' | 'auto' | 'landscape'
}
```

---

## Section

A single chapter or content unit.

```typescript
type SectionFormat = 'xhtml' | 'html' | 'image'

interface Section {
    id: string | number
    size: number                           // Byte size for progress
    format?: SectionFormat                 // Content type (default: 'xhtml')
    load(): Promise<string> | string       // Returns content string
    unload?(): void                        // Free cached resources
    getDocument?(): Promise<SectionDocument | null>  // AI-friendly doc tree
    createDocument?(): Promise<string>     // Raw HTML string for searching
}
```

### `load()`

Returns a **content string** — the renderer decides how to display it:
- `'xhtml'`/`'html'`: Full HTML/XHTML document or fragment
- `'image'`: Data URI or base64 string

### `getDocument()`

Returns a `SectionDocument` with query and mutation APIs. Returns `null` for formats without document structure (e.g., `'image'`). See [Document Model](#document-model).

---

## Document Model

SlateJS-inspired tree structure for AI-friendly content manipulation.

### `DocumentNode`

A node in the document tree:

```typescript
interface DocumentNode {
    type: string                    // 'p', 'h1', 'img', 'text', etc.
    attrs?: Record<string, string>  // class, id, src, href, etc.
    children?: DocumentNode[]       // Child nodes (element nodes)
    text?: string                   // Text content (text nodes only)
}
```

Text nodes have `type: 'text'` and `text` set. Element nodes have `type` set to the tag name and optional `children`.

### `SectionDocument`

```typescript
interface SectionDocument {
    nodes: DocumentNode[]

    // Query
    query(selector: string): DocumentNode[]

    // Content extraction
    getText(): string
    getImages(): DocumentResource[]

    // Immutable mutations (return new SectionDocument)
    insertNode(path: number[], node: DocumentNode): SectionDocument
    removeNode(path: number[]): SectionDocument
    setNode(path: number[], attrs: Record<string, string>): SectionDocument
    replaceText(path: number[], text: string): SectionDocument

    // Output
    serialize(): string
}
```

#### `query(selector)`

CSS-like selectors:
- Tag name: `'p'`, `'h1'`, `'img'`
- Class: `'.intro'`, `'.highlight'`
- ID: `'#chapter1'`
- Attribute: `'[href]'`, `'[src="image.jpg"]'`
- Multiple: `'h1, h2, h3'`

#### `getText()`

Returns plain text content of the entire document.

#### `getImages()`

Returns all images as `DocumentResource[]`:

```typescript
interface DocumentResource {
    id: string
    type: string    // 'image', 'font', 'style'
    mimeType: string
    url: string
}
```

#### Mutation Operations

All mutations are **immutable** — they return a new `SectionDocument` without modifying the original.

```typescript
import { textNode, elementNode } from 'ebook-js'

// Path is an array of indices into the tree
// [0] = first root node
// [0, 1] = second child of first root node

const doc = await section.getDocument()

// Insert at root level (after first paragraph)
const withNewPara = doc.insertNode([1], elementNode('p', {}, [textNode('New paragraph')]))

// Remove a node
const withoutFirst = doc.removeNode([0])

// Update attributes
const highlighted = doc.setNode([0], { class: 'highlight' })

// Replace text content
const translated = doc.replaceText([0, 0], 'Translated text')

// Chain mutations
const result = doc
    .setNode([0], { lang: 'en' })
    .replaceText([0, 0], 'Hello')
    .insertNode([1], elementNode('p', {}, [textNode('World')]))
```

#### `serialize()`

Converts the document tree back to an HTML string.

### Node Helpers

```typescript
import {
    textNode,
    elementNode,
    isTextNode,
    isElementNode,
    parseHTML,
    createSectionDocument,
} from 'ebook-js'

// Create nodes
const text = textNode('Hello world')
const para = elementNode('p', { class: 'intro' }, [text])
const img = elementNode('img', { src: 'cover.jpg', alt: 'Cover' })

// Type guards
isTextNode(text)    // true
isElementNode(para) // true

// Parse HTML string into DocumentNode[]
const nodes = parseHTML('<p>Hello</p><p>World</p>', domAdapter)

// Create SectionDocument from nodes
const doc = createSectionDocument(nodes, domAdapter)
```

### AI Use Cases

The Document Model enables these AI-powered workflows:

| Use Case | How |
|----------|-----|
| Translation | `getText()` → translate → `replaceText()` per text node |
| Content summary | `getText()` → summarize |
| Annotation | `setNode([path], { class: 'annotation' })` |
| Accessibility | Walk tree, add `alt` attrs to images via `setNode()` |
| Content injection | `insertNode()` to add AI-generated content |
| Restructuring | `removeNode()` + `insertNode()` to reorder sections |
| Image enhancement | `getImages()` → process → replace via `setNode()` |

---

## Parser Interface

```typescript
interface Parser {
    parse(input: ParserInput, options?: ParserOptions): Promise<Book>
    canParse(input: ParserInput): Promise<boolean>
    priority?: number  // Higher = checked first (default 0)
}

type ParserInput = string | File | Blob | ArrayBuffer

interface ParserOptions {
    domAdapter?: DOMAdapter
    urlFactory?: URLFactory
    sha1?: (data: ArrayBuffer) => Promise<ArrayBuffer>
    onProgress?: (progress: number, message?: string) => void
}
```

### Parser Factories

```typescript
import { epub } from 'ebook-js/parsers/epub'    // or from 'ebook-js'
import { mobi } from 'ebook-js/parsers/mobi'    // or from 'ebook-js'
import { fb2 } from 'ebook-js/parsers/fb2'      // or from 'ebook-js'
import { cbz } from 'ebook-js/parsers/cbz'      // or from 'ebook-js'

// Each returns a Parser instance
const parser = epub()
```

### Direct Parser Usage

```typescript
import { EPUBParser } from 'ebook-js'

const parser = new EPUBParser()
if (await parser.canParse(file)) {
    const book = await parser.parse(file, { domAdapter, urlFactory })
}
```

---

## Renderer Interface

```typescript
interface Renderer {
    open(book: Book): Promise<void>
    goTo(target: string | number): Promise<void>
    next(): Promise<void>
    prev(): Promise<void>
    setStyles(styles: RendererStyles): void
    setLayout(layout: LayoutMode): void
    on(event: string, listener: (e: any) => void): void
    off(event: string, listener: (e: any) => void): void
    destroy(): void
}
```

### Browser Renderer

```typescript
import { BrowserRenderer, createBrowserRenderer } from 'ebook-js'

// Factory function (recommended)
const renderer = createBrowserRenderer({
    container: document.getElementById('viewer')!,
    layout: 'paginated',
})

// Or class directly
const renderer = new BrowserRenderer({
    container: element,
})
```

---

## Adapter System

Parsers are environment-agnostic via dependency injection.

### `DOMAdapter`

Abstracts DOM parsing and querying:

```typescript
interface DOMAdapter {
    parseXML(str: string): XMLDocument
    parseHTML(str: string, mimeType?: string): XMLDocument
    serialize(doc: XMLDocument): string

    // Optional: document manipulation (for Document Model)
    getChildNodes?(element: XMLElement): XMLNode[]
    createDocument?(): XMLDocument
    createElement?(doc: XMLDocument, tag: string): XMLElement
    createTextNode?(doc: XMLDocument, text: string): XMLNode
    appendChild?(parent: XMLElement, child: XMLNode): void
}
```

### `URLFactory`

Abstracts blob URL creation:

```typescript
interface URLFactory {
    createURL(data: string | ArrayBuffer | Blob, mimeType?: string): string
    revokeURL(url: string): void
}
```

### Built-in Adapters

| Adapter | Import | Environment |
|---------|--------|-------------|
| `BrowserDOMAdapter` | `ebook-js` | Browser |
| `BrowserURLFactory` | `ebook-js` | Browser |
| `TestDOMAdapter` | `ebook-js/adapters/test` | Node.js (@xmldom/xmldom) |
| `TestURLFactory` | `ebook-js/adapters/test` | Node.js (fake URLs) |

### Browser Usage (auto-wired)

```typescript
import { createReader, registry } from 'ebook-js'
import { epub } from 'ebook-js/parsers/epub'

registry.register('epub', epub)
const reader = createReader({ container: element })
await reader.open(file) // Browser adapters auto-injected
```

### Node.js / Worker Usage

```typescript
import { registry } from 'ebook-js'
import { epub } from 'ebook-js/parsers/epub'
import { TestDOMAdapter, TestURLFactory } from 'ebook-js/adapters/test'

registry.register('epub', epub)

const book = await registry.open(arrayBuffer, {
    domAdapter: new TestDOMAdapter(),
    urlFactory: new TestURLFactory(),
})
```

---

## Error Types

```typescript
import {
    EBookError,            // Base class for all ebook-js errors
    ParseError,            // Parsing failed (malformed content)
    UnsupportedFormatError, // Format not recognized
    CorruptedFileError,    // File is severely corrupted
    AdapterRequiredError,  // Required adapter not provided
    UnsupportedInputError, // Input type not supported
} from 'ebook-js'
```

### Error Properties

| Property | Type | Description |
|----------|------|-------------|
| `message` | `string` | Human-readable description |
| `code` | `string` | Machine-readable code (e.g., `'PARSE_ERROR'`) |
| `name` | `string` | Error class name |
| `format` | `string` | Format name (on `ParseError`, `CorruptedFileError`) |

### Usage

```typescript
try {
    const book = await registry.open(file, options)
} catch (e) {
    if (e instanceof UnsupportedFormatError) {
        console.error('Unsupported file format')
    } else if (e instanceof ParseError) {
        console.error(`Parse error (${e.format}): ${e.message}`)
    } else if (e instanceof EBookError) {
        console.error(`[${e.code}] ${e.message}`)
    } else {
        throw e
    }
}
```

---

## Metadata Normalization

All parsers normalize metadata to consistent types:

```typescript
const book = await registry.open(file, options)

// Title: always a string
book.metadata?.title // "My Book"

// Author: always Contributor[]
const authors = book.metadata?.author ?? []
for (const a of authors) {
    a.name    // "John Doe"
    a.sortAs  // "Doe, John" (optional)
    a.role    // "aut" (optional)
}

// Language: always a single string
book.metadata?.language // "en"

// Subject: always string[]
book.metadata?.subject // ["Fiction", "Fantasy"]
```

### Normalization Helpers

```typescript
import {
    normalizeLanguage,      // (input) => string
    normalizeTitle,         // (input) => string
    normalizePublisher,     // (input) => string
    normalizeContributors,  // (input) => Contributor[]
    normalizeSubjects,      // (input) => string[]
} from 'ebook-js'
```

---

## Styles

### `RendererStyles`

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

### Usage

```typescript
reader.setStyles({
    fontFamily: 'Georgia, serif',
    fontSize: '18px',
    lineHeight: 1.6,
    theme: 'sepia',
    css: 'p { text-indent: 2em; }',
})
```

---

## Default Format Styles

### FB2 Styles

FB2 is pure XML without embedded CSS. Use the default stylesheet:

```typescript
import { fb2DefaultStyles } from 'ebook-js'

reader.setStyles({ css: fb2DefaultStyles })

// Or combine with custom overrides
reader.setStyles({ css: fb2DefaultStyles + 'p { color: #333; }' })
```

### MOBI6 Styles

Legacy MOBI6 files (`.mobi`) lack embedded stylesheets:

```typescript
import { mobi6DefaultStyles } from 'ebook-js'

reader.setStyles({ css: mobi6DefaultStyles })
```

Modern KF8/AZW3 files (`.azw3`) have embedded styles — `mobi6DefaultStyles` won't conflict.

---

## Parser Detection Priority

When using `registry.open()` or `registry.detect()`, parsers are checked in priority order (highest first):

| Parser | Default Priority | Detection Method |
|--------|-----------------|------------------|
| EPUB | 10 | `PK` magic + `mimetype` entry = `application/epub+zip` |
| MOBI | 5 | `BOOKMOBI` magic at bytes 60-68 |
| FB2 | 5 | `<FictionBook` XML or `.fb2` in zip |
| CBZ | 0 | `.cbz` extension or zip containing image files |

Override priority when registering:

```typescript
registry.register('cbz', cbz, 20) // Check CBZ first
```
