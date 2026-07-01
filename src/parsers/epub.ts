/**
 * EPUB Parser
 *
 * Parses EPUB 2.x and 3.x files into a Book object.
 * Based on foliate-js epub.js, restructured for TypeScript and our interfaces.
 * Environment-agnostic: uses injected adapters for DOM parsing and URL creation.
 */

import type {
    Book, Section, TOCItem, Landmark, BookMetadata,
    Rendition, ResolvedNavigation, LanguageMap, Contributor, DocumentNode,
} from '../core/types'
import type { Parser, ParserInput, ParserOptions } from '../core/parser'
import type { DOMAdapter, XMLDocument, XMLElement } from '../core/dom-adapter'
import type { URLFactory } from '../core/url-factory'
import type { Loader } from '../core/loader'
import { createZipLoader, isZipFile } from '../loaders/zip-loader'
import { normalizeWhitespace, getElementText, cssEscape, replaceSeries, getMimeTypeFromPath } from '../core/utils'
import { UnsupportedInputError, AdapterRequiredError, ParseError, CorruptedFileError } from '../core/errors'
import { normalizeLanguage, normalizeTitle, normalizePublisher } from '../core/metadata'
import { parseSimpleClassRuleIndex, mergeStyleDeclarations, extractImportURLs, parseStyleDeclarations, type SimpleClassRuleIndex } from '../core/css'
import { getInputName, isBlobLike } from '../core/binary'
import { debugRebook, isRebookDebugEnabled } from '../core/debug'
import { readRasterImageDimensionsFromBlobPrefix } from '../core/image-size'
import { getOrCreateCachedPromise, getOrCreatePromise } from '../core/promise-cache'
import { createCachedReflowableAccessors } from '../core/section-cache'
import { documentToNodes } from '../core/document'

// ============================================================================
// Constants
// ============================================================================

const NS = {
    CONTAINER: 'urn:oasis:names:tc:opendocument:xmlns:container',
    XHTML: 'http://www.w3.org/1999/xhtml',
    OPF: 'http://www.idpf.org/2007/opf',
    EPUB: 'http://www.idpf.org/2007/ops',
    DC: 'http://purl.org/dc/elements/1.1/',
    NCX: 'http://www.daisy.org/z3986/2005/ncx/',
    XLINK: 'http://www.w3.org/1999/xlink',
} as const

const MIME = {
    XML: 'application/xml',
    NCX: 'application/x-dtbncx+xml',
    XHTML: 'application/xhtml+xml',
    HTML: 'text/html',
    CSS: 'text/css',
    SVG: 'image/svg+xml',
} as const

const CSS_RESOURCE_PATTERN = /url\(|@import/i

const RELATORS: Record<string, string> = {
    art: 'artist',
    aut: 'author',
    clr: 'colorist',
    edt: 'editor',
    ill: 'illustrator',
    nrt: 'narrator',
    trl: 'translator',
    pbl: 'publisher',
}

// ============================================================================
// Utility Functions
// ============================================================================

/** Convert hyphenated/colon-separated names to camelCase */
const camel = (x: string): string =>
    x.toLowerCase().replace(/[-:](.)/g, (_, g: string) => g.toUpperCase())

/** Create child element getters that handle namespace */
const childGetter = (doc: XMLDocument, ns: string) => {
    const useNS = doc.lookupNamespaceURI(null) === ns || doc.lookupPrefix(ns)
    const match = (_el: XMLElement | XMLDocument, name: string) => (e: XMLElement) =>
        useNS
            ? e.namespaceURI === ns && e.localName === name
            : e.localName === name
    const getChildren = (el: XMLElement | XMLDocument): XMLElement[] =>
        'documentElement' in el ? Array.from(el.documentElement.children) : Array.from(el.children)
    return {
        $: (el: XMLElement | XMLDocument, name: string) =>
            getChildren(el).find(match(el, name)) ?? null,
        $$: (el: XMLElement | XMLDocument, name: string) =>
            getChildren(el).filter(match(el, name)),
        $$$: useNS
            ? (el: XMLElement | XMLDocument, name: string) =>
                Array.from(('documentElement' in el ? el : el.ownerDocument!).getElementsByTagNameNS(ns, name))
            : (el: XMLElement | XMLDocument, name: string) =>
                Array.from(('documentElement' in el ? el : el.ownerDocument!).getElementsByTagName(name)),
    }
}

/** Resolve a URL relative to a base path */
const resolveURL = (url: string, relativeTo: string): string => {
    try {
        url = url.replace(/%2c/gi, ',').replace(/%3a/gi, ':')
        if (relativeTo.includes(':') && !relativeTo.startsWith('OEBPS')) {
            return new URL(url, relativeTo).href
        }
        const root = 'https://invalid.invalid/'
        const obj = new URL(url, root + relativeTo)
        obj.search = ''
        return decodeURI(obj.href.replace(root, ''))
    } catch {
        return url
    }
}

const normalizeArchivePath = (path: string): string => {
    const normalized = decodeURI(path)
        .replace(/\\/g, '/')
        .replace(/^[a-z]+:\/\/[^/]+\//i, '')
        .replace(/^\/+/, '')
        .replace(/\/{2,}/g, '/')

    const parts: string[] = []
    for (const part of normalized.split('/')) {
        if (!part || part === '.') continue
        if (part === '..') parts.pop()
        else parts.push(part)
    }
    return parts.join('/')
}

function applyResolvedImageDimensions(element: XMLElement, natural: { width: number; height: number }): void {
    const widthAttr = element.getAttribute('width')?.trim()
    const heightAttr = element.getAttribute('height')?.trim()
    const styleDeclarations = new Map(parseStyleDeclarations(element.getAttribute('style') ?? ''))
    const styleWidth = parseImageDimensionAttribute(styleDeclarations.get('width'))
    const styleHeight = parseImageDimensionAttribute(styleDeclarations.get('height'))
    const width = parseImageDimensionAttribute(widthAttr) ?? styleWidth
    const height = parseImageDimensionAttribute(heightAttr) ?? styleHeight
    const widthDeclared = Boolean(widthAttr) || Boolean(styleWidth)
    const heightDeclared = Boolean(heightAttr) || Boolean(styleHeight)

    if (!widthDeclared && !heightDeclared) {
        element.setAttribute('width', String(natural.width))
        element.setAttribute('height', String(natural.height))
        return
    }

    if (width && !heightDeclared) {
        element.setAttribute('height', String(Math.max(1, Math.round(width * natural.height / natural.width))))
        return
    }

    if (height && !widthDeclared) {
        element.setAttribute('width', String(Math.max(1, Math.round(height * natural.width / natural.height))))
    }
}

function shouldResolveImageNaturalSize(element: XMLElement): boolean {
    const widthAttr = element.getAttribute('width')?.trim()
    const heightAttr = element.getAttribute('height')?.trim()
    const styleDeclarations = new Map(parseStyleDeclarations(element.getAttribute('style') ?? ''))
    const styleWidth = parseImageDimensionAttribute(styleDeclarations.get('width'))
    const styleHeight = parseImageDimensionAttribute(styleDeclarations.get('height'))
    const widthDeclared = Boolean(widthAttr) || Boolean(styleWidth)
    const heightDeclared = Boolean(heightAttr) || Boolean(styleHeight)
    return !widthDeclared || !heightDeclared
}

function parseImageDimensionAttribute(value: string | undefined): number | undefined {
    if (!value || value.endsWith('%')) return undefined
    const match = value.match(/^([\d.]+)(?:px)?$/)
    if (!match) return undefined
    const dimension = Number(match[1])
    return Number.isFinite(dimension) && dimension > 0 ? dimension : undefined
}

function findSectionIndexByNormalizedSuffix(sections: readonly Section[], normalizedPath: string): number {
    if (!normalizedPath) return -1
    const suffix = `/${normalizedPath}`
    return sections.findIndex(section => normalizeArchivePath(String(section.id)).endsWith(suffix))
}

interface ArchiveEntryLookup {
    byPath: Map<string, { filename: string; size: number }>
    entries: Array<{ filename: string; normalized: string; size: number }>
}

function createArchiveEntryLookup(entries: readonly { filename: string; size: number }[]): ArchiveEntryLookup {
    const byPath = new Map<string, { filename: string; size: number }>()
    const normalizedEntries = entries.map(entry => ({
        filename: entry.filename,
        normalized: normalizeArchivePath(entry.filename),
        size: entry.size,
    }))
    for (const entry of normalizedEntries) {
        if (entry.normalized && !byPath.has(entry.normalized)) {
            byPath.set(entry.normalized, { filename: entry.filename, size: entry.size })
        }
    }
    return { byPath, entries: normalizedEntries }
}

function findArchiveEntryHref(lookup: ArchiveEntryLookup, normalizedPath: string): string | null {
    if (!normalizedPath) return null

    const exact = lookup.byPath.get(normalizedPath)
    if (exact) return exact.filename

    const suffix = `/${normalizedPath}`
    const match = lookup.entries.find(entry => entry.normalized.endsWith(suffix))
    return match?.filename ?? null
}

function debugEPUB(message: string, details?: Record<string, unknown>): void {
    debugRebook('epub', message, details)
}

function nowMs(): number {
    return typeof performance !== 'undefined' && performance.now
        ? performance.now()
        : Date.now()
}

function flattenTOCForTiming(items?: readonly TOCItem[] | null): TOCItem[] {
    return items?.flatMap(item => item.subitems?.length ? [item, ...flattenTOCForTiming(item.subitems)] : [item]) ?? []
}

/** Check if a URI is external */
const isExternal = (uri: string): boolean => uri.startsWith('//') || /^(?!blob)\w+:/i.test(uri)

/** Get dirname of a path */
const pathDirname = (str: string): string =>
    str.slice(0, str.lastIndexOf('/') + 1)

/** Get relative path from one path to another */
const pathRelative = (from: string, to: string): string => {
    if (!from) return to
    const as = from.replace(/\/$/, '').split('/')
    const bs = to.replace(/\/$/, '').split('/')
    const i = (as.length > bs.length ? as : bs).findIndex((_, i) => as[i] !== bs[i])
    return i < 0 ? '' : Array(as.length - i).fill('..').concat(bs.slice(i)).join('/')
}

// ============================================================================
// Metadata Parsing
// ============================================================================

interface ParsedMeta {
    property: string
    scheme?: string
    lang?: string
    value: string
    props: Record<string, ParsedMeta[]> | null
    attrs: Record<string, string>
}

const getPrefixes = (doc: XMLDocument): Map<string, string> => {
    const PREFIX: Record<string, string> = {
        a11y: 'http://www.idpf.org/epub/vocab/package/a11y/#',
        dcterms: 'http://purl.org/dc/terms/',
        marc: 'http://id.loc.gov/vocabulary/',
        media: 'http://www.idpf.org/epub/vocab/overlays/#',
        onix: 'http://www.editeur.org/ONIX/book/codelists/current.html#',
        rendition: 'http://www.idpf.org/vocab/rendition/#',
        schema: 'http://schema.org/',
        xsd: 'http://www.w3.org/2001/XMLSchema#',
    }
    const map = new Map(Object.entries(PREFIX))
    const value = doc.documentElement.getAttributeNS(NS.EPUB, 'prefix')
        || doc.documentElement.getAttribute('prefix')
    if (value) {
        for (const [, prefix, url] of value.matchAll(/(.+): +(.+)[ \t\r\n]*/g)) {
            map.set(prefix, url)
        }
    }
    return map
}

const getPropertyURL = (value: string | null, prefixes: Map<string, string>): string | null => {
    if (!value) return null
    const [a, b] = value.split(':')
    const prefix = b ? a : null
    const reference = b ? b : a
    const baseURL = prefixes.get(prefix!)
    return baseURL ? baseURL + reference : null
}

/**
 * Parse OPF metadata into our BookMetadata format.
 */
const parseMetadata = (opf: XMLDocument): {
    metadata: BookMetadata
    rendition: Rendition
} => {
    const { $ } = childGetter(opf, NS.OPF)
    const $metadata = $(opf.documentElement, 'metadata')
    if (!$metadata) return { metadata: {}, rendition: {} }

    const baseLang = $metadata.getAttribute('xml:lang')
        ?? opf.documentElement.getAttribute('xml:lang') ?? 'und'
    const prefixes = getPrefixes(opf)

    // Parse meta elements
    const parseMeta = (el: XMLElement): ParsedMeta => {
        const property = el.getAttribute('property')
        const scheme = el.getAttribute('scheme')
        const getProps = (el: XMLElement): Record<string, ParsedMeta[]> | null => {
            const refines = Array.from($metadata.children)
                .filter(child => child.getAttribute('refines') === '#' + el.getAttribute('id'))
            if (!refines.length) return null
            const grouped: Record<string, ParsedMeta[]> = {}
            for (const child of refines) {
                const parsed = parseMeta(child)
                const key = parsed.property
                if (!grouped[key]) grouped[key] = []
                grouped[key].push(parsed)
            }
            return grouped
        }
        return {
            property: getPropertyURL(property, prefixes) ?? property ?? '',
            scheme: getPropertyURL(scheme, prefixes) ?? scheme ?? undefined,
            lang: el.getAttribute('xml:lang') ?? undefined,
            value: getElementText(el),
            props: getProps(el),
            attrs: Object.fromEntries(
                Array.from(el.attributes)
                    .filter(attr => attr.namespaceURI === NS.OPF)
                    .map(attr => [attr.localName, attr.value])
            ),
        }
    }

    // Group elements
    const dcElements: Record<string, XMLElement[]> = {}
    const metaElements: ParsedMeta[] = []
    const legacyMeta: Record<string, string> = {}

    for (const el of Array.from($metadata.children)) {
        if (el.namespaceURI === NS.DC) {
            const name = el.localName
            if (!dcElements[name]) dcElements[name] = []
            dcElements[name].push(el)
        } else if (el.namespaceURI === NS.OPF && el.localName === 'meta') {
            if (el.hasAttribute('name')) {
                legacyMeta[el.getAttribute('name')!] = el.getAttribute('content') ?? ''
            } else {
                metaElements.push(parseMeta(el))
            }
        }
    }

    // Helper functions
    const dc = (name: string): ParsedMeta[] =>
        (dcElements[name] ?? []).map(el => ({
            property: el.localName,
            value: getElementText(el),
            lang: el.getAttribute('xml:lang') ?? undefined,
            attrs: Object.fromEntries(
                Array.from(el.attributes)
                    .filter(attr => attr.namespaceURI === NS.OPF)
                    .map(attr => [attr.localName, attr.value])
            ),
            props: null,
        }))

    const one = (arr: ParsedMeta[] | undefined): string | undefined => arr?.[0]?.value
    const prop = (x: ParsedMeta | undefined, p: string): string | undefined =>
        x?.props?.[p]?.[0]?.value

    const makeLanguageMap = (x: ParsedMeta | undefined): LanguageMap | undefined => {
        if (!x) return undefined
        const alts = x.props?.['alternate-script'] ?? []
        if (!alts.length && (!x.lang || x.lang === baseLang)) return x.value
        const map: Record<string, string> = { [x.lang ?? baseLang]: x.value }
        for (const y of alts) map[y.lang ?? baseLang] ??= y.value
        return map
    }

    const makeContributor = (x: ParsedMeta | undefined): Contributor | undefined => {
        if (!x) return undefined
        const name = makeLanguageMap(x)
        if (!name) return undefined
        return {
            name,
            sortAs: makeLanguageMap(x.props?.['file-as']?.[0]) ?? x.attrs['file-as'],
            role: x.props?.role
                ?.filter(r => r.scheme === 'http://id.loc.gov/vocabulary/relators')
                ?.map(r => r.value) ?? (x.attrs.role ? [x.attrs.role] : undefined),
        }
    }

    const dcTitle = dc('title')
    const mainTitle = dcTitle.find(x => prop(x, 'title-type') === 'main') ?? dcTitle[0]
    const dcCreator = dc('creator')
    const dcContributor = dc('contributor')

    // Build metadata (mutable during construction, readonly in final type)
    const metadata: { -readonly [K in keyof BookMetadata]?: BookMetadata[K] } = {
        identifier: getElementText(
            opf.getElementById(opf.documentElement.getAttribute('unique-identifier') ?? '')
            ?? opf.getElementsByTagNameNS(NS.DC, 'identifier')[0]
        ) || undefined,
        title: normalizeTitle(makeLanguageMap(mainTitle)),
        subtitle: normalizeTitle(one(dcTitle.filter(x => prop(x, 'title-type') === 'subtitle'))),
        language: normalizeLanguage(dc('language').map(x => x.value).filter(Boolean)),
        description: one(dc('description')),
        publisher: normalizePublisher(makeContributor(dc('publisher')[0])),
        published: dc('date').find(x => x.attrs.event === 'publication')?.value
            ?? one(dc('date')),
        modified: one(metaElements.filter(m => m.property === 'http://purl.org/dc/terms/modified'))
            ?? dc('date').find(x => x.attrs.event === 'modification')?.value,
        subject: dc('subject').map(x => x.value),
        rights: one(dc('rights')),
    }

    // Add creators as authors
    for (const creator of dcCreator) {
        const contrib = makeContributor(creator)
        if (!contrib) continue
        const roles = (contrib as { role?: string[] }).role ?? []
        const keys = new Set(roles.map(r => RELATORS[r] ?? 'author'))
        if (!keys.size) keys.add('author')
        for (const key of keys) {
            const existing = metadata[key]
            if (Array.isArray(existing)) existing.push(contrib)
            else metadata[key] = [contrib]
        }
    }

    // Add contributors
    for (const contributor of dcContributor) {
        const contrib = makeContributor(contributor)
        if (!contrib) continue
        const existing = metadata.contributor
        if (Array.isArray(existing)) existing.push(contrib)
        else metadata.contributor = [contrib]
    }

    // Clean up null/undefined values
    for (const [key, val] of Object.entries(metadata)) {
        if (val == null) delete metadata[key]
    }

    // Parse rendition properties
    const rendition: Rendition = {}
    const RENDITION_PREFIX = 'http://www.idpf.org/vocab/rendition/#'
    for (const meta of metaElements) {
        if (meta.property.startsWith(RENDITION_PREFIX)) {
            const name = camel(meta.property.replace(RENDITION_PREFIX, ''))
            ;(rendition as Record<string, string>)[name] = meta.value
        }
    }

    return { metadata, rendition }
}

// ============================================================================
// Navigation Parsing
// ============================================================================

const parseNav = (doc: XMLDocument, resolve: (url: string) => string): {
    toc: TOCItem[] | null
    pageList: TOCItem[] | null
    landmarks: Landmark[] | null
} => {
    const { $, $$, $$$ } = childGetter(doc, NS.XHTML)
    const resolveHref = (href: string | null): string | null =>
        href ? decodeURI(resolve(href)) : null

    const parseLI = ($li: XMLElement, getType: boolean): TOCItem & { type?: string[] } => {
        const $a = $($li, 'a') ?? $($li, 'span')
        const $ol = $($li, 'ol')
        const href = resolveHref($a?.getAttribute('href') ?? null)
        const label = getElementText($a) || $a?.getAttribute('title') || ''
        const result: TOCItem & { type?: string[] } = {
            label,
            href: href ?? '',
            subitems: parseOL($ol, false) ?? undefined,
        }
        if (getType) {
            result.type = $a?.getAttributeNS(NS.EPUB, 'type')?.split(/\s/)
        }
        return result
    }

    const parseOL = ($ol: XMLElement | null, getType: boolean): (TOCItem & { type?: string[] })[] | null =>
        $ol ? $$($ol, 'li').map(li => parseLI(li, getType)) : null

    const parseNavElement = ($nav: XMLElement, getType: boolean) =>
        parseOL($($nav, 'ol'), getType)

    const $$nav = $$$(doc, 'nav')
    let toc: TOCItem[] | null = null
    let pageList: TOCItem[] | null = null
    let landmarks: Landmark[] | null = null

    for (const $nav of $$nav) {
        const type = $nav.getAttributeNS(NS.EPUB, 'type')?.split(/\s/) ?? []
        if (type.includes('toc') && !toc) {
            toc = parseNavElement($nav, false) as TOCItem[] | null
        } else if (type.includes('page-list') && !pageList) {
            pageList = parseNavElement($nav, false) as TOCItem[] | null
        } else if (type.includes('landmarks') && !landmarks) {
            const items = parseNavElement($nav, true)
            landmarks = items?.map(item => ({
                label: item.label,
                href: item.href,
                type: (item as { type?: string[] }).type ?? [],
            })) ?? null
        }
    }

    return { toc, pageList, landmarks }
}

const parseNCX = (doc: XMLDocument, resolve: (url: string) => string): {
    toc: TOCItem[] | null
    pageList: TOCItem[] | null
} => {
    const resolveHref = (href: string | null): string | null =>
        href ? decodeURI(resolve(href)) : null

    const parseItem = (el: XMLElement): TOCItem => {
        let $label: XMLElement | null = null
        let $content: XMLElement | null = null
        const childItems: XMLElement[] = []
        for (const child of Array.from(el.children)) {
            if (child.localName === 'navLabel') $label = child
            else if (child.localName === 'content') $content = child
            else if (child.localName === 'navPoint') childItems.push(child)
        }
        const label = getElementText($label)
        const href = resolveHref($content?.getAttribute('src') ?? null)
        if (el.localName === 'navPoint') {
            return {
                label,
                href: href ?? '',
                subitems: childItems.length ? childItems.map(parseItem) : undefined,
            }
        }
        return { label, href: href ?? '' }
    }

    const getSingle = (container: string, itemName: string): TOCItem[] | null => {
        let $container: XMLElement | null = null
        for (const child of Array.from(doc.documentElement.children)) {
            if (child.localName === container) {
                $container = child
                break
            }
        }
        if (!$container) return null
        const items: TOCItem[] = []
        for (const child of Array.from($container.children)) {
            if (child.localName === itemName) items.push(parseItem(child))
        }
        return items
    }

    return {
        toc: getSingle('navMap', 'navPoint'),
        pageList: getSingle('pageList', 'pageTarget'),
    }
}

const parseNCXText = (xml: string, resolve: (url: string) => string): {
    toc: TOCItem[] | null
    pageList: TOCItem[] | null
} => ({
    toc: parseNCXTextList(xml, 'navMap', 'navPoint', resolve),
    pageList: parseNCXTextList(xml, 'pageList', 'pageTarget', resolve),
})

function parseNCXTextList(
    xml: string,
    containerName: string,
    itemName: string,
    resolve: (url: string) => string,
): TOCItem[] | null {
    const container = getXMLContainerContent(xml, containerName)
    if (!container) return null

    type MutableTOCItem = {
        label: string
        href: string
        subitems?: MutableTOCItem[]
    }
    const rootItems: MutableTOCItem[] = []
    const stack: MutableTOCItem[] = []
    const tagPattern = /<[^>]+>/g
    let textStart: number | null = null
    let match: RegExpExecArray | null

    while ((match = tagPattern.exec(container))) {
        const tag = match[0]
        if (tag.startsWith('<!--') || tag.startsWith('<?') || tag.startsWith('<!')) continue

        const closing = /^<\s*\//.test(tag)
        const name = getXMLTagName(tag)
        if (!name) continue

        if (!closing && name === itemName) {
            const item: MutableTOCItem = { label: '', href: '' }
            const parent = stack[stack.length - 1]
            if (parent) {
                parent.subitems ??= []
                parent.subitems.push(item)
            } else {
                rootItems.push(item)
            }
            if (!/\/\s*>$/.test(tag)) stack.push(item)
            continue
        }

        if (closing && name === itemName) {
            const item = stack.pop()
            if (item?.subitems && item.subitems.length === 0) delete item.subitems
            continue
        }

        const current = stack[stack.length - 1]
        if (!current) continue

        if (!closing && name === 'content') {
            const src = getXMLAttribute(tag, 'src')
            current.href = src ? decodeURI(resolve(decodeXMLText(src))) : ''
            continue
        }

        if (!closing && name === 'text') {
            textStart = tagPattern.lastIndex
            continue
        }

        if (closing && name === 'text' && textStart != null) {
            current.label += decodeXMLText(container.slice(textStart, match.index)).trim()
            textStart = null
        }
    }

    return rootItems.length ? rootItems : null
}

function getXMLContainerContent(xml: string, name: string): string | null {
    const open = new RegExp(`<[^>]*:?${escapeRegExp(name)}\\b[^>]*>`, 'i').exec(xml)
    if (!open) return null
    const closePattern = new RegExp(`</[^>]*:?${escapeRegExp(name)}\\s*>`, 'i')
    const close = closePattern.exec(xml.slice(open.index + open[0].length))
    if (!close) return null
    return xml.slice(open.index + open[0].length, open.index + open[0].length + close.index)
}

function getXMLTagName(tag: string): string | null {
    const match = tag.match(/^<\s*\/?\s*([A-Za-z_][\w:.-]*)/)
    if (!match) return null
    return match[1].split(':').pop() ?? null
}

function getXMLAttribute(tag: string, name: string): string | null {
    const match = new RegExp(`\\b${escapeRegExp(name)}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag)
    return match?.[1] ?? match?.[2] ?? null
}

function decodeXMLText(value: string): string {
    return value
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&')
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ============================================================================
// Resource Loading
// ============================================================================

interface ManifestItem {
    id: string
    href: string
    mediaType: string
    properties?: string[]
    mediaOverlay?: string
}

/**
 * Loader that handles resource URL replacement.
 * Converts relative paths in EPUB content to blob: URLs.
 */
class ResourceLoader {
    private cache = new Map<string, string>()
    private pending = new Map<string, Promise<string>>()
    private documentCache = new Map<string, XMLDocument>()
    private documentPending = new Map<string, Promise<XMLDocument | null>>()
    private imageDimensionCache = new Map<string, Promise<{ width: number; height: number } | null>>()
    private imageBlobCache = new Map<string, Blob>()
    private resourceItemCache = new Map<string, ManifestItem | null>()
    private cssTextCache = new Map<string, Promise<string>>()
    private cssRulesCache = new Map<string, SimpleClassRuleIndex>()
    private refCount = new Map<string, number>()
    private manifest: ManifestItem[]
    private manifestByNormalizedHref: Map<string, ManifestItem>
    private normalizedManifest: Array<{ normalized: string; item: ManifestItem }>
    private entries: ArchiveEntryLookup

    constructor(
        private loadText: (name: string) => Promise<string | null>,
        private loadBlob: (name: string) => Promise<Blob | null>,
        manifest: ManifestItem[],
        entries: { filename: string; size: number }[],
        private domAdapter: DOMAdapter,
        private urlFactory: URLFactory,
    ) {
        this.manifest = manifest
        this.manifestByNormalizedHref = new Map()
        this.normalizedManifest = manifest.map(item => ({
            normalized: normalizeArchivePath(item.href),
            item,
        }))
        for (const item of this.normalizedManifest) {
            if (item.normalized && !this.manifestByNormalizedHref.has(item.normalized)) {
                this.manifestByNormalizedHref.set(item.normalized, item.item)
            }
        }
        this.entries = createArchiveEntryLookup(entries)
    }

    private async createURL(href: string, data: string | ArrayBuffer | Blob, type: string): Promise<string> {
        if (!data) return ''
        const url = this.urlFactory.createURL(data, type)
        this.cache.set(href, url)
        this.refCount.set(href, 1)
        return url
    }

    async loadItem(item: ManifestItem): Promise<string> {
        if (this.cache.has(item.href)) {
            this.refCount.set(item.href, (this.refCount.get(item.href) ?? 0) + 1)
            return this.cache.get(item.href)!
        }
        const pending = getOrCreatePromise(this.pending, item.href, () => this.loadReplaced(item))
        const value = await pending.promise
        if (!pending.created && value) this.refCount.set(item.href, (this.refCount.get(item.href) ?? 0) + 1)
        return value
    }

    async loadItemNodes(item: ManifestItem): Promise<DocumentNode[]> {
        const doc = await this.loadItemDocument(item)
        return doc ? documentToNodes(doc, this.domAdapter) : []
    }

    async loadItemDocument(item: ManifestItem): Promise<XMLDocument | null> {
        const htmlTypes: string[] = [MIME.XHTML, MIME.HTML, MIME.SVG]
        if (!htmlTypes.includes(item.mediaType)) return null
        if (this.documentCache.has(item.href)) {
            this.refCount.set(item.href, (this.refCount.get(item.href) ?? 0) + 1)
            return this.documentCache.get(item.href)!
        }
        const pending = getOrCreatePromise(this.documentPending, item.href, () => this.loadReplacedDocument(item))
        const doc = await pending.promise
        if (!pending.created && doc) this.refCount.set(item.href, (this.refCount.get(item.href) ?? 0) + 1)
        return doc
    }

    private async loadReplaced(item: ManifestItem): Promise<string> {
        const { href, mediaType } = item

        // Parse and replace in HTML/XHTML/SVG
        const htmlTypes: string[] = [MIME.XHTML, MIME.HTML, MIME.SVG]
        if (htmlTypes.includes(mediaType)) {
            const doc = await this.loadItemDocument(item)
            if (!doc) return ''
            const result = this.domAdapter.serialize(doc)
            // Return the serialized HTML string directly.
            // The renderer is responsible for creating blob URLs for the document.
            // Embedded resources (CSS, images) already have blob URLs from loadHref.
            this.cache.set(href, result)
            this.refCount.set(href, Math.max(1, this.refCount.get(href) ?? 0))
            return result
        }

        // CSS
        if (mediaType === MIME.CSS) {
            const str = await this.loadText(href)
            if (!str) return ''
            const result = await this.replaceCSS(str, href)
            return this.createURL(href, result, mediaType)
        }

        // Other resources: create URLs directly from the extracted Blob. This
        // avoids a Blob -> ArrayBuffer -> Blob round-trip for image-heavy EPUBs.
        const blob = await this.loadBlob(href)
        if (!blob) return ''
        if (mediaType.startsWith('image/') && mediaType !== MIME.SVG) {
            this.imageBlobCache.set(href, blob)
        }
        return this.createURL(href, blob, mediaType)
    }

    private async loadReplacedDocument(item: ManifestItem): Promise<XMLDocument | null> {
        const { href, mediaType } = item
        const str = await this.loadText(href)
        if (!str) return null
        let doc: XMLDocument
        try {
            doc = this.domAdapter.parseXML(str)
        } catch (error) {
            if (mediaType !== MIME.XHTML && mediaType !== MIME.HTML) throw error
            doc = this.domAdapter.parseHTML(str, MIME.HTML)
        }

        // Change to HTML if XHTML is invalid
        if (mediaType === MIME.XHTML && (
            doc.querySelector('parsererror') ||
            !doc.documentElement?.namespaceURI
        )) {
            doc = this.domAdapter.parseHTML(str, MIME.HTML)
        }

        await this.applyLinkedStyles(doc, href)

        // Replace href/src/data/poster attributes
        const resourceStats = {
            replaced: 0,
            kept: 0,
            byAttr: {} as Record<string, number>,
            samples: [] as Array<{ tag: string; attr: string; value: string; resolved: string; replaced: string }>,
        }
        const replace = async (el: XMLElement, attr: string) => {
            const val = el.getAttribute(attr)
            if (val) {
                const resolved = resolveURL(val, href)
                const replaced = await this.loadHref(val, href)
                if (attr === 'src' || attr === 'poster' || attr === 'data') {
                    el.setAttribute(`data-rebook-original-${attr}`, resolved)
                }
                el.setAttribute(attr, replaced)
                if ((attr === 'src' || attr === 'poster' || attr === 'data') && replaced === val) {
                    resourceStats.kept += 1
                } else if ((attr === 'src' || attr === 'poster' || attr === 'data') && isRebookDebugEnabled()) {
                    resourceStats.replaced += 1
                    resourceStats.byAttr[attr] = (resourceStats.byAttr[attr] ?? 0) + 1
                    if (resourceStats.samples.length < 5) {
                        resourceStats.samples.push({
                            tag: el.localName,
                            attr,
                            value: val,
                            resolved,
                            replaced,
                        })
                    }
                }
            }
        }

        const attrTasks: Promise<void>[] = []
        for (const el of doc.querySelectorAll('link[href]')) {
            if (isResourceLinkHrefElement(el)) attrTasks.push(replace(el, 'href'))
        }
        for (const el of doc.querySelectorAll('[href]')) {
            if (!isNavigationHrefElement(el)) attrTasks.push(replace(el, 'href'))
        }
        for (const el of doc.querySelectorAll('[src]')) {
            attrTasks.push((async () => {
                const srcBefore = el.getAttribute('src')
                await replace(el, 'src')
                // Inject usable image dimensions when the source only declares one
                // axis, so layout can keep the real aspect ratio instead of using
                // fallback block heights.
                if (el.localName.toLowerCase() === 'img'
                    && srcBefore
                    && shouldResolveImageNaturalSize(el)) {
                    const imgHref = resolveURL(srcBefore, href)
                    const imgItem = this.findResourceItem(imgHref)
                    if (imgItem?.mediaType.startsWith('image/') && imgItem.mediaType !== MIME.SVG) {
                        const size = await this.readImageDimensions(imgItem)
                        if (size) applyResolvedImageDimensions(el, size)
                    }
                }
            })())
        }
        for (const el of doc.querySelectorAll('[poster]')) attrTasks.push(replace(el, 'poster'))
        for (const el of doc.querySelectorAll('object[data]')) attrTasks.push(replace(el, 'data'))
        for (const el of doc.querySelectorAll('[*|href]:not([href])')) {
            attrTasks.push((async () => {
                const val = el.getAttributeNS(NS.XLINK, 'href')
                if (val) {
                    el.setAttribute('data-rebook-original-href', resolveURL(val, href))
                    el.setAttributeNS(NS.XLINK, 'href', await this.loadHref(val, href))
                }
            })())
        }
        await Promise.all(attrTasks)

        // Replace srcset
        for (const el of doc.querySelectorAll('[srcset]')) {
            const srcset = el.getAttribute('srcset')
            if (srcset) {
                const replaced = await replaceSeries(
                    srcset,
                    /(\s*)(.+?)\s*((?:\s[\d.]+[wx])+\s*(?:,|$)|,\s+|$)/g,
                    async (_, p1, p2, p3) => {
                        const newUrl = await this.loadHref(p2, href)
                        return `${p1}${newUrl}${p3}`
                    }
                )
                el.setAttribute('srcset', replaced)
            }
        }

        // Replace inline styles
        for (const el of doc.querySelectorAll('style')) {
            if (el.textContent) {
                el.textContent = await this.replaceCSS(el.textContent, href)
            }
        }
        for (const el of doc.querySelectorAll('[style]')) {
            const style = el.getAttribute('style')
            if (style) el.setAttribute('style', await this.replaceCSS(style, href))
        }
        if (isRebookDebugEnabled() && (resourceStats.replaced > 0 || resourceStats.kept > 0)) {
            debugEPUB('resource attrs processed', {
                base: href,
                replaced: resourceStats.replaced,
                kept: resourceStats.kept,
                byAttr: resourceStats.byAttr,
                samples: resourceStats.samples,
            })
        }

        this.documentCache.set(href, doc)
        this.refCount.set(href, Math.max(1, this.refCount.get(href) ?? 0))
        return doc
    }

    private readImageDimensions(item: ManifestItem): Promise<{ width: number; height: number } | null> {
        let cached = this.imageDimensionCache.get(item.href)
        if (!cached) {
            cached = (async () => {
                try {
                    const blob = this.imageBlobCache.get(item.href) ?? await this.loadBlob(item.href)
                    if (!blob) return null
                    const size = await readRasterImageDimensionsFromBlobPrefix(blob)
                    return size?.width && size?.height ? size : null
                } catch {
                    return null
                } finally {
                    this.imageBlobCache.delete(item.href)
                }
            })()
            this.imageDimensionCache.set(item.href, cached)
        }
        return cached
    }

    private async loadHref(url: string, base: string): Promise<string> {
        if (!url || url.startsWith('#') || isExternal(url)) return url
        const href = resolveURL(url, base)
        const item = this.findResourceItem(href)
        if (!item) {
            debugEPUB('resource item not found', {
                base,
                url,
                resolved: href,
                normalized: normalizeArchivePath(href),
                manifestSample: this.manifest.slice(0, 8).map(item => item.href),
                entrySample: this.entries.entries.slice(0, 8).map(entry => entry.filename),
            })
            return url
        }
        return (await this.loadItem(item)) || href
    }

    private findResourceItem(href: string): ManifestItem | undefined {
        const normalizedHref = normalizeArchivePath(href)
        if (this.resourceItemCache.has(normalizedHref)) {
            return this.resourceItemCache.get(normalizedHref) ?? undefined
        }
        const manifestItem = this.manifestByNormalizedHref.get(normalizedHref)
            ?? this.normalizedManifest.find(entry => entry.normalized.endsWith(`/${normalizedHref}`))?.item
        if (manifestItem) {
            this.resourceItemCache.set(normalizedHref, manifestItem)
            return manifestItem
        }

        const entryHref = findArchiveEntryHref(this.entries, normalizedHref)
        if (!entryHref) {
            this.resourceItemCache.set(normalizedHref, null)
            return undefined
        }

        const normalizedEntryHref = normalizeArchivePath(entryHref)
        if (normalizedEntryHref !== normalizedHref) {
            debugEPUB('resource entry matched by suffix', {
                requested: href,
                normalized: normalizedHref,
                matched: normalizedEntryHref,
            })
        }
        const item = {
            id: normalizedEntryHref,
            href: entryHref,
            mediaType: getMimeTypeFromPath(normalizedEntryHref),
        }
        this.resourceItemCache.set(normalizedHref, item)
        return item
    }

    private async applyLinkedStyles(doc: XMLDocument, href: string): Promise<void> {
        const cssTexts: string[] = []
        for (const el of doc.querySelectorAll('style')) {
            if (el.textContent) cssTexts.push(el.textContent)
        }
        for (const el of doc.querySelectorAll('link[href]')) {
            const url = el.getAttribute('href')
            if (!url || isExternal(url)) continue
            const cssHref = resolveURL(url, href)
            const item = this.findResourceItem(cssHref)
            if (!item || item.mediaType !== MIME.CSS) continue
            const css = await this.loadCSSWithImports(item.href)
            if (css) cssTexts.push(css)
        }

        const cssSource = cssTexts.join('\n')
        let ruleIndex = this.cssRulesCache.get(cssSource)
        if (!ruleIndex) {
            ruleIndex = parseSimpleClassRuleIndex(cssSource)
            this.cssRulesCache.set(cssSource, ruleIndex)
        }
        if (!ruleIndex.rules.length) return

        for (const el of doc.querySelectorAll('[class]')) {
            const classNames = new Set((el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean))
            if (!classNames.size) continue
            const tagName = el.localName.toLowerCase()
            const declarations = ruleIndex.getMatchingRules(tagName, classNames)
                .map(rule => rule.declarations)
                .join('; ')
            if (!declarations) continue
            el.setAttribute('style', mergeStyleDeclarations(declarations, el.getAttribute('style') ?? ''))
        }
    }

    private async loadCSSWithImports(href: string, seen = new Set<string>()): Promise<string> {
        if (seen.size === 0) return getOrCreateCachedPromise(this.cssTextCache, href, () => this.loadCSSWithImportsUncached(href, seen))
        return this.loadCSSWithImportsUncached(href, seen)
    }

    private async loadCSSWithImportsUncached(href: string, seen: Set<string>): Promise<string> {
        if (seen.has(href)) return ''
        seen.add(href)
        const css = await this.loadText(href)
        if (!css) return ''

        const imports = await Promise.all(extractImportURLs(css).map(async url => {
            const importHref = resolveURL(url, href)
            const item = this.findResourceItem(importHref)
            if (item?.mediaType === MIME.CSS) {
                return this.loadCSSWithImports(item.href, seen)
            }
            return ''
        }))
        return [...imports, css].filter(Boolean).join('\n')
    }

    private async replaceCSS(str: string, href: string): Promise<string> {
        if (!CSS_RESOURCE_PATTERN.test(str)) return str
        const replacedUrls = await replaceSeries(
            str,
            /url\(\s*["']?([^'"\n]*?)\s*["']?\s*\)/gi,
            async (_, url) => {
                const newUrl = await this.loadHref(url, href)
                return `url("${newUrl}")`
            }
        )
        return replaceSeries(
            replacedUrls,
            /@import\s*["']([^"'\n]*?)["']/gi,
            async (_, url) => {
                const newUrl = await this.loadHref(url, href)
                return `@import "${newUrl}"`
            }
        )
    }

    unref(href: string): void {
        const count = (this.refCount.get(href) ?? 0) - 1
        if (count <= 0) {
            const url = this.cache.get(href)
            // Only revoke blob URLs (CSS, images). HTML content is a string.
            if (url && url.startsWith('blob:')) this.urlFactory.revokeURL(url)
            this.cache.delete(href)
            this.documentCache.delete(href)
            this.refCount.delete(href)
        } else {
            this.refCount.set(href, count)
        }
    }

    destroy(): void {
        for (const url of this.cache.values()) {
            if (url.startsWith('blob:')) this.urlFactory.revokeURL(url)
        }
        this.cache.clear()
        this.documentCache.clear()
        this.refCount.clear()
    }
}


function isNavigationHrefElement(el: XMLElement): boolean {
    const name = el.localName.toLowerCase()
    return name === 'a' || name === 'area' || name === 'link'
}

function isResourceLinkHrefElement(el: XMLElement): boolean {
    const name = el.localName.toLowerCase()
    if (name !== 'link') return false

    const relTokens = new Set((el.getAttribute('rel') ?? '')
        .split(/\s+/)
        .map(token => token.toLowerCase())
        .filter(Boolean))
    if (!relTokens.size) return false
    if (relTokens.has('stylesheet') || relTokens.has('icon') || relTokens.has('apple-touch-icon')) {
        return true
    }

    const as = el.getAttribute('as')?.toLowerCase()
    if (relTokens.has('preload') || relTokens.has('prefetch')) {
        return !!as && as !== 'document' && as !== 'html'
    }
    return false
}

// ============================================================================
// EPUB Parser
// ============================================================================

export class EPUBParser implements Parser {
    readonly priority = 10

    async canParse(input: ParserInput): Promise<boolean> {
        if (typeof input === 'string') return input.toLowerCase().endsWith('.epub')
        const inputName = getInputName(input)
        if (inputName?.toLowerCase().endsWith('.epub')) return true
        if (isBlobLike(input) || input instanceof ArrayBuffer) {
            if (!(await isZipFile(input))) return false
            // Check if it contains META-INF/container.xml
            try {
                const loader = await createZipLoader(input)
                return loader.entries.some(e => e.filename === 'META-INF/container.xml')
            } catch {
                return false
            }
        }
        return false
    }

    async parse(input: ParserInput, options?: ParserOptions): Promise<Book> {
        const parseStarted = nowMs()
        let lastTiming = parseStarted
        const markTiming = (stage: string, details?: Record<string, unknown>) => {
            if (!isRebookDebugEnabled()) return
            const current = nowMs()
            debugEPUB('parse timing', {
                stage,
                ms: Math.round((current - lastTiming) * 10) / 10,
                totalMs: Math.round((current - parseStarted) * 10) / 10,
                ...details,
            })
            lastTiming = current
        }
        let loader: Loader

        if (isBlobLike(input)) {
            loader = await createZipLoader(input)
            markTiming('zip-loader', { input: 'blob', entries: loader.entries.length })
        } else if (input instanceof ArrayBuffer) {
            loader = await createZipLoader(input)
            markTiming('zip-loader', { input: 'arraybuffer', entries: loader.entries.length })
        } else if (typeof input === 'string') {
            // Fetch from URL (browser environment)
            const res = await fetch(input)
            const buffer = await res.arrayBuffer()
            markTiming('fetch', { input: 'url', bytes: buffer.byteLength })
            loader = await createZipLoader(buffer)
            markTiming('zip-loader', { input: 'url', entries: loader.entries.length })
        } else {
            throw new UnsupportedInputError('Unsupported input type for EPUB parser')
        }

        if (!options?.domAdapter || !options?.urlFactory) {
            throw new AdapterRequiredError('domAdapter and urlFactory')
        }

        const epub = new EPUBBook(loader, options.domAdapter, options.urlFactory)
        const book = await epub.init()
        markTiming('complete', {
            sections: book.sections.length,
            toc: flattenTOCForTiming(book.toc).length,
        })
        return book
    }
}

// ============================================================================
// EPUB Book
// ============================================================================

class EPUBBook implements Book {
    private loader: Loader
    private domAdapter: DOMAdapter
    private urlFactory: URLFactory
    private resourceLoader!: ResourceLoader
    private manifest: ManifestItem[] = []
    private manifestById = new Map<string, ManifestItem>()
    private manifestByNormalizedHref = new Map<string, ManifestItem>()
    private spine: Array<{ idref: string; linear?: string; properties?: string[] }> = []
    private sectionIndexById = new Map<string | number, number>()
    private sectionIndexByNormalizedId = new Map<string, number>()
    private archiveEntries: ArchiveEntryLookup
    private opfPath = ''

    sections: Section[] = []
    dir?: 'ltr' | 'rtl'
    toc?: TOCItem[]
    pageList?: TOCItem[]
    landmarks?: Landmark[]
    metadata?: BookMetadata
    rendition?: Rendition

    constructor(loader: Loader, domAdapter: DOMAdapter, urlFactory: URLFactory) {
        this.loader = loader
        this.domAdapter = domAdapter
        this.urlFactory = urlFactory
        this.archiveEntries = createArchiveEntryLookup(loader.entries)
    }

    private async loadXML(uri: string): Promise<XMLDocument | null> {
        const str = await this.loader.loadText(uri)
        if (!str) return null
        const doc = this.domAdapter.parseXML(str)
        if (doc.querySelector('parsererror')) {
            throw new ParseError(`XML parsing error in ${uri}: ${doc.querySelector('parsererror')?.textContent}`, 'epub')
        }
        return doc
    }

    async init(): Promise<this> {
        const initStarted = nowMs()
        let lastTiming = initStarted
        const markTiming = (stage: string, details?: Record<string, unknown>) => {
            if (!isRebookDebugEnabled()) return
            const current = nowMs()
            debugEPUB('init timing', {
                stage,
                ms: Math.round((current - lastTiming) * 10) / 10,
                totalMs: Math.round((current - initStarted) * 10) / 10,
                ...details,
            })
            lastTiming = current
        }

        // 1. Load container.xml to find OPF
        const $container = await this.loadXML('META-INF/container.xml')
        if (!$container) throw new CorruptedFileError('Failed to load container.xml', 'epub')
        markTiming('container')

        const rootfiles = Array.from(
            $container.getElementsByTagNameNS(NS.CONTAINER, 'rootfile')
        ).map(el => ({
            fullPath: el.getAttribute('full-path'),
            mediaType: el.getAttribute('media-type'),
        }))

        const opfFile = rootfiles.find(f => f.mediaType === 'application/oebps-package+xml')
        if (!opfFile?.fullPath) throw new CorruptedFileError('No package document found', 'epub')
        this.opfPath = opfFile.fullPath

        // 2. Load OPF
        const opf = await this.loadXML(this.opfPath)
        if (!opf) throw new CorruptedFileError('Failed to load OPF', 'epub')
        markTiming('opf', { opfPath: this.opfPath })

        // 3. Parse manifest and spine
        const { $, $$ } = childGetter(opf, NS.OPF)
        const $manifest = $(opf.documentElement, 'manifest')
        const $spine = $(opf.documentElement, 'spine')

        if ($manifest) {
            this.manifest = Array.from($manifest.children)
                .filter(el => el.localName === 'item')
                .map(el => {
                    const href = el.getAttribute('href') ?? ''
                    return {
                        id: el.getAttribute('id') ?? '',
                        href: this.resolveManifestHref(href),
                        mediaType: el.getAttribute('media-type') ?? '',
                        properties: el.getAttribute('properties')?.split(/\s/),
                        mediaOverlay: el.getAttribute('media-overlay') ?? undefined,
                    }
                })
            this.manifestById = new Map(this.manifest.map(m => [m.id, m]))
            this.manifestByNormalizedHref = new Map(this.manifest.map(m => [normalizeArchivePath(m.href), m]))
        }

        if ($spine) {
            this.spine = Array.from($spine.children)
                .filter(el => el.localName === 'itemref')
                .map(el => ({
                    idref: el.getAttribute('idref') ?? '',
                    linear: el.getAttribute('linear') ?? undefined,
                    properties: el.getAttribute('properties')?.split(/\s/),
                }))
            this.dir = ($spine.getAttribute('page-progression-direction') as 'ltr' | 'rtl') ?? undefined
        }
        markTiming('manifest-spine', {
            manifest: this.manifest.length,
            spine: this.spine.length,
        })

        // 4. Create resource loader
        this.resourceLoader = new ResourceLoader(
            this.loader.loadText.bind(this.loader),
            this.loader.loadBlob.bind(this.loader),
            this.manifest,
            this.loader.entries,
            this.domAdapter,
            this.urlFactory,
        )
        markTiming('resource-loader')

        // 5. Create sections
        this.sections = this.spine.map((spineItem, index): Section | null => {
            const item = this.manifestById.get(spineItem.idref)
            if (!item) return null
            const accessors = createCachedReflowableAccessors({
                domAdapter: this.domAdapter,
                loadDocumentHtml: () => this.loadDocument(item),
                loadBlockNodes: () => this.resourceLoader.loadItemNodes(item),
                coverImageSrcs: () => this.getCoverImageSrcs(),
            })
            return {
                id: item.href,
                load: () => this.resourceLoader.loadItem(item),
                unload: () => this.resourceLoader.unref(item.href),
                format: 'xhtml' as const,
                loadText: () => this.loader.loadText(item.href).then(t => t ?? ''),
                createDocument: () => this.loadDocument(item),
                getDocument: accessors.getDocument,
                getSegments: accessors.getSegments,
                getBlocks: accessors.getBlocks,
                size: this.loader.getSize(item.href),
                linear: spineItem.linear,
                cfi: `/6/${(index + 1) * 2}`,
                resolveHref: (href: string) => resolveURL(href, item.href),
            }
        }).filter((s): s is Section => s !== null)
        this.sectionIndexById = new Map(this.sections.map((section, index) => [section.id, index]))
        this.sectionIndexByNormalizedId = new Map(this.sections.map((section, index) => [normalizeArchivePath(String(section.id)), index]))
        markTiming('sections', { sections: this.sections.length })

        // 6. Parse navigation
        const navItem = this.manifest.find(m => m.properties?.includes('nav'))
        const ncxItem = this.manifest.find(m => m.mediaType === MIME.NCX)

        if (navItem) {
            try {
                const navDoc = await this.loadXML(navItem.href)
                if (navDoc) {
                    const resolve = (url: string) => resolveURL(url, navItem.href)
                    const nav = parseNav(navDoc, resolve)
                    this.toc = this.normalizeTOCItems(nav.toc ?? undefined)
                    this.pageList = this.normalizeTOCItems(nav.pageList ?? undefined)
                    this.landmarks = nav.landmarks ?? undefined
                }
            } catch (e) {
                console.warn('Failed to parse navigation:', e)
            }
        }
        markTiming('nav', {
            toc: flattenTOCForTiming(this.toc).length,
            pageList: flattenTOCForTiming(this.pageList).length,
        })

        // Fallback to NCX if no TOC
        if (!this.toc && ncxItem) {
            try {
                const resolve = (url: string) => resolveURL(url, ncxItem.href)
                const ncxText = await this.loader.loadText(ncxItem.href)
                const ncx = ncxText ? parseNCXText(ncxText, resolve) : { toc: null, pageList: null }
                if (ncx.toc || ncx.pageList) {
                    this.toc = this.normalizeTOCItems(ncx.toc ?? undefined)
                    this.pageList = this.normalizeTOCItems(ncx.pageList ?? undefined)
                } else {
                    const ncxDoc = await this.loadXML(ncxItem.href)
                    if (ncxDoc) {
                        const parsed = parseNCX(ncxDoc, resolve)
                        this.toc = this.normalizeTOCItems(parsed.toc ?? undefined)
                        this.pageList = this.normalizeTOCItems(parsed.pageList ?? undefined)
                    }
                }
            } catch (e) {
                console.warn('Failed to parse NCX:', e)
            }
        }
        markTiming('ncx', {
            toc: flattenTOCForTiming(this.toc).length,
            pageList: flattenTOCForTiming(this.pageList).length,
        })

        // 7. Parse metadata
        const { metadata, rendition } = parseMetadata(opf)
        this.metadata = metadata
        this.rendition = rendition
        markTiming('metadata')
        markTiming('complete', {
            sections: this.sections.length,
            toc: flattenTOCForTiming(this.toc).length,
        })

        return this
    }

    private async loadDocument(item: ManifestItem): Promise<string> {
        const str = await this.loader.loadText(item.href) ?? ''
        // Return raw string; renderer will parse into DOM when needed
        return str
    }

    private resolveManifestHref(href: string): string {
        const resolved = resolveURL(href, this.opfPath)
        return this.findExistingEntryHref(resolved)
            ?? this.findExistingEntryHref(href)
            ?? resolved
    }

    private findExistingEntryHref(href: string): string | null {
        const normalized = normalizeArchivePath(href)
        return findArchiveEntryHref(this.archiveEntries, normalized)
    }

    private normalizeNavigationHref(href: string): string {
        const [path, hash] = href.split('#')
        if (!path) return href
        const normalized = this.findExistingEntryHref(path) ?? path
        return hash ? `${normalized}#${hash}` : normalized
    }

    private normalizeTOCItems(items?: readonly TOCItem[] | null): TOCItem[] | undefined {
        return items?.map(item => ({
            ...item,
            href: this.normalizeNavigationHref(item.href),
            subitems: this.normalizeTOCItems(item.subitems ?? undefined),
        }))
    }

    resolveHref(href: string): ResolvedNavigation | null {
        const [path, hash] = href.split('#')
        const normalizedPath = normalizeArchivePath(path)
        const item = this.manifestByNormalizedHref.get(normalizedPath)
            ?? this.manifest.find(m => normalizeArchivePath(m.href).endsWith(`/${normalizedPath}`))
        const sectionHref = item?.href
        const index = sectionHref !== undefined
            ? this.sectionIndexById.get(sectionHref) ?? -1
            : this.sectionIndexByNormalizedId.get(normalizedPath)
                ?? findSectionIndexByNormalizedSuffix(this.sections, normalizedPath)
        if (index < 0) return null
        const anchor = hash
            ? (doc: unknown) => (doc as XMLDocument).getElementById(hash)
            : () => 0
        return { index, anchor }
    }

    isExternal(href: string): boolean {
        return isExternal(href)
    }

    splitTOCHref(href: string): [string, string | null] {
        const parts = href.split('#')
        return [parts[0], parts[1] ?? null]
    }

    getTOCFragment(doc: unknown, id: string | number): unknown {
        const xmlDoc = doc as XMLDocument
        return xmlDoc.getElementById(String(id))
            ?? xmlDoc.querySelector(`[name="${cssEscape(String(id))}"]`)
    }

    async getCover(): Promise<Blob | null> {
        const coverItem = this.getCoverImageItem()

        if (!coverItem) return null
        const blob = await this.loader.loadBlob(coverItem.href)
        return blob
    }

    private getCoverImageItem(): ManifestItem | undefined {
        return this.manifest.find(m => m.properties?.includes('cover-image'))
            ?? this.manifest.find(m => m.id === 'cover' && m.mediaType.startsWith('image'))
            ?? this.manifest.find(m => m.href.includes('cover') && m.mediaType.startsWith('image'))
            ?? this.manifest.find(m => m.mediaType.startsWith('image'))
    }

    private getCoverImageSrcs(): string[] {
        const coverItem = this.getCoverImageItem()
        return coverItem ? [coverItem.href] : []
    }

    destroy(): void {
        this.resourceLoader?.destroy()
    }
}

/**
 * Create an EPUB parser instance.
 */
export const epub = () => new EPUBParser()
