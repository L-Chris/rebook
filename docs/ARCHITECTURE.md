# Architecture

rebook is a TypeScript e-book library built around a small contract: parsers turn source files into a normalized `Book`, and renderers or exporters consume that `Book` without knowing the original file format.

## System Shape

```text
source file
  -> parser registry
  -> EPUB / MOBI / FB2 / CBZ parser
  -> Book { metadata, sections, toc, resources }
  -> renderer or exporter
```

Primary boundaries:

- `src/core`: shared contracts, document model, metadata helpers, error types, Pretext adapter, renderer helpers
- `src/adapters`: browser and Node-compatible DOM/URL adapters
- `src/parsers`: format-specific input handling
- `src/renderers/browser`: browser `ReaderView` and virtual text renderer
- `src/renderers/wechat-miniprogram`: DOM-free snapshot renderer for Mini Program hosts
- `src/plugins`: book middleware that can wrap or extend `Book` before rendering
- `src/exporters`: format-neutral export registry plus EPUB, CBZ, TXT, and HTML exporters
- `src/loaders`: zip loading and malformed archive recovery

## Design Principles

### Parsers Are Environment-Agnostic

Parsers do not call browser globals directly. XML/HTML parsing and URL creation are injected through `ParserOptions`.

```typescript
interface ParserOptions {
    domAdapter?: DOMAdapter
    urlFactory?: URLFactory
}
```

This keeps EPUB/MOBI/FB2/CBZ parsing usable in browsers, Node.js, workers, tests, and future host environments.

### Book Is The Contract

`Book` and `Section` are the stable boundary between input formats and output surfaces.

```typescript
interface Book {
    metadata?: BookMetadata
    sections: Section[]
    toc?: TOCItem[]
    resolveHref?(href: string): ResolvedNavigation | null
}
```

Parsers produce `Book`. Renderers and exporters consume `Book`. Adding a parser should not require renderer changes, and adding an exporter should not require parser changes.

### Renderers Own Platform Behavior

Platform-specific event handling, DOM/snapshot updates, and host integration live in renderers. Shared pagination math, CSS unit parsing, anchor selector parsing, and readable-page detection live in `src/core/renderer-utils.ts` so browser and Mini Program renderers do not drift.

The default browser path is:

```text
Section XHTML
  -> DocumentNode[]
  -> TextBlock[]
  -> @chenglou/pretext measurement
  -> LineRange[]
  -> visible DOM rows
```

`VirtualTextRenderer` keeps only visible line rows in the live DOM and supports scrolled, paginated, and auto-spread layouts.

The Mini Program renderer uses the same `TextBlock -> Pretext -> LineRange` pipeline and emits serializable line snapshots instead of DOM rows. Its host canvas adapter is passed into the platform-neutral `installPretextMeasurementPolyfill()` helper.

### Plugins Are Book Middleware

Plugins run after parsing and before rendering. They wrap `Book` rather than a platform renderer, which keeps official plugins usable in browser, Mini Program, and future hosts.

```typescript
type RebookPlugin = (book: Book) => Book | Promise<Book>
```

`ReaderView` applies plugins after `registry.open()`. Renderers that accept already parsed books, such as `WechatMiniProgramRenderer`, apply the same plugin chain in `open(book)`.

### Exporters Are Format-Neutral

Export is handled through `ExporterRegistry`, mirroring parser registration in the opposite direction.

```typescript
exporterRegistry.register('epub', epubExporter)
exporterRegistry.register('cbz', cbzExporter)
exporterRegistry.register('txt', txtExporter)
exporterRegistry.register('html', htmlExporter)
```

All built-in exporters share selection validation, section-title resolution, document-fragment extraction, and resource-attribute rewriting through `src/exporters/utils.ts`. Format-specific files should focus on packaging and output structure.

## Adapter System

### DOMAdapter

`DOMAdapter` is the parser-facing abstraction over XML/HTML documents.

```typescript
interface DOMAdapter {
    parseXML(str: string): XMLDocument
    parseHTML(str: string, mimeType?: string): XMLDocument
    serialize(doc: XMLDocument): string
    getChildNodes?(element: XMLElement): XMLNode[]
    createDocument?(): XMLDocument
    createElement?(doc: XMLDocument, tag: string): XMLElement
    createTextNode?(doc: XMLDocument, text: string): XMLNode
    appendChild?(parent: XMLElement, child: XMLNode): void
}
```

Browser code uses `BrowserDOMAdapter`; Node and tests use `NodeDOMAdapter`.

### URLFactory

`URLFactory` abstracts resource URL creation and resource lookup.

```typescript
interface URLFactory {
    createURL(data: string | ArrayBuffer | Blob, mimeType?: string): string
    revokeURL(url: string): void
    getData?(url: string): { data: string | ArrayBuffer | Blob; mimeType: string } | undefined
}
```

The optional `getData()` hook lets exporters repackage parser-created resources without depending on browser blob internals.

## Document Model

The document model is a small, immutable tree inspired by SlateJS.

```typescript
interface DocumentNode {
    type: string
    attrs?: Record<string, string>
    children?: DocumentNode[]
    text?: string
}
```

Text nodes use `type: 'text'`. Element nodes use tag-name `type` and optional children.

Paths are arrays of child indexes:

```text
[0]       -> first root node
[0, 1]    -> second child of first root node
[0, 1, 2] -> third child of that child
```

Mutations return new `SectionDocument` instances:

```typescript
const next = doc
    .setNode([0], { class: 'highlight' })
    .replaceText([0, 0], 'Translated text')
```

This supports translation, annotation, summarization, and accessibility workflows without exposing renderer DOM.

## Pretext Boundary

`TextBlock`, `TextSegment`, and `TextStyle` live in `src/core/types.ts` because they are part of the parser-renderer contract. `src/core/pretext.ts` is only an adapter layer:

- `extractDocumentBlocks()` maps `DocumentNode[]` to reading blocks
- `prepareBlocks()` maps blocks to Pretext rich-inline input
- `layout()` maps Pretext line ranges back to `LineRange[]`
- `getVisibleLines()` computes virtualized windows

The parser only guarantees that sections can load content and, where supported, provide document/block helpers. Measurement and display remain renderer concerns.

## Error Model

All user-visible failures should use typed errors from `src/core/errors.ts`:

```text
EBookError
  - ParseError
  - UnsupportedFormatError
  - CorruptedFileError
  - AdapterRequiredError
  - UnsupportedInputError
```

Use cases:

- `UnsupportedFormatError`: no registered parser/exporter can handle the input
- `ParseError`: recognized format failed to parse
- `CorruptedFileError`: archive or file structure is severely damaged
- `AdapterRequiredError`: the caller did not provide a required host adapter
- `UnsupportedInputError`: the input type itself is invalid for the API

## Malformed EPUB Recovery

The zip loader has layered recovery for real-world damaged EPUBs:

1. Try normal `@zip.js/zip.js` loading.
2. Detect uniformly shifted Central Directory offsets and correct them.
3. Scan individual Local File Header positions.
4. Build entries entirely from Local File Headers when needed.
5. Return `null` for unrecoverable entries instead of crashing the whole parse.

## Current File Map

```text
src/
  core/
    types.ts          Book, Section, DocumentNode, text block contracts
    parser.ts         Parser interface and registry
    renderer.ts       Renderer interface
    renderer-utils.ts shared renderer math and anchor helpers
    exporter.ts       Exporter interface and registry
    document.ts       immutable document model
    pretext.ts        TextBlock extraction and Pretext adapter
    dom-adapter.ts    DOMAdapter interface
    url-factory.ts    URLFactory interface
    errors.ts         typed error hierarchy
    metadata.ts       metadata normalization
    utils.ts          shared low-level utilities
  adapters/
    browser.ts        BrowserDOMAdapter, BrowserURLFactory
    node.ts           NodeDOMAdapter, NodeURLFactory
  parsers/
    epub.ts           EPUB parser
    mobi.ts           MOBI/AZW/AZW3 parser
    fb2.ts            FictionBook 2 parser
    cbz.ts            Comic Book Zip parser
  exporters/
    index.ts          exporter registration and public exports
    utils.ts          shared exporter utilities
    epub.ts           EPUB package exporter
    cbz.ts            Comic Book Zip exporter
    txt.ts            plain text exporter
    html.ts           single-file HTML exporter
  loaders/
    zip-loader.ts     zip archive loader with malformed recovery
  renderers/
    browser/
      virtual-text.ts Pretext-backed virtual renderer
      view.ts         ReaderView high-level API
    wechat-miniprogram/
      index.ts        public renderer exports
      renderer.ts     DOM-free snapshot renderer
      polyfills.ts    Mini Program runtime polyfills
  plugins/
    index.ts          official plugin exports
    translation.ts    block/TOC translation plugin
    trial-limit.ts    trial-reading access controller plugin
  utils/
    progress.ts       section and TOC progress helpers
```
