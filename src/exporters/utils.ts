/**
 * Shared utilities for exporters.
 *
 * These helpers are extracted from the EPUB exporter so that
 * CBZ, TXT, HTML and future exporters can reuse them without duplication.
 */

import type { BookMetadata, Contributor, LanguageMap, Section } from '../core/types'
import type { ExportOptions, ExportSelection } from '../core/exporter'
import type { URLFactory } from '../core/url-factory'
import { extensionFromMime, extensionFromPath, getMimeTypeFromPath, escapeXML, escapeAttr } from '../core/utils'
import { isBlobLike } from '../core/binary'

export { extensionFromMime, extensionFromPath, getMimeTypeFromPath, escapeXML, escapeAttr }

// ---------------------------------------------------------------------------
// Data URI / Binary helpers
// ---------------------------------------------------------------------------

export function parseDataURI(src: string): { mimeType: string; bytes: Uint8Array } | null {
    const match = /^data:([^;,]+)?((?:;[^,]+)*),(.*)$/s.exec(src)
    if (!match) return null
    const mimeType = match[1] || 'application/octet-stream'
    const flags = match[2] || ''
    const data = match[3] || ''
    const bytes = flags.includes(';base64')
        ? decodeBase64(data)
        : new TextEncoder().encode(decodeURIComponent(data))
    return { mimeType, bytes }
}

export function decodeBase64(base64: string): Uint8Array {
    if (typeof atob === 'function') {
        const binary = atob(base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        return bytes
    }
    const bufferCtor = (globalThis as unknown as { Buffer?: { from(value: string, encoding: string): Uint8Array } }).Buffer
    if (!bufferCtor) throw new Error('No base64 decoder available')
    return new Uint8Array(bufferCtor.from(base64, 'base64'))
}

export async function toBytes(data: string | ArrayBuffer | Blob): Promise<Uint8Array> {
    if (typeof data === 'string') return new TextEncoder().encode(data)
    if (isBlobLike(data)) return new Uint8Array(await data.arrayBuffer())
    return new Uint8Array(data as ArrayBuffer)
}

// ---------------------------------------------------------------------------
// Selection / section helpers
// ---------------------------------------------------------------------------

export function canExportFirstSectionsSelection(selection: ExportSelection): boolean {
    return selection.type === 'first-sections' && (!selection.unit || selection.unit === 'section')
}

// ---------------------------------------------------------------------------
// MIME / extension helpers
// ---------------------------------------------------------------------------
// (Re-exported from core/utils.ts)

// ---------------------------------------------------------------------------
// Resource loading
// ---------------------------------------------------------------------------

export function shouldPackageResource(url: string): boolean {
    if (!url || url.startsWith('#')) return false
    if (/^(https?:|mailto:|tel:|filepos:)/i.test(url)) return false
    return /^(blob:|data:|test:)/i.test(url)
}

export async function loadReferencedResource(
    url: string,
    options: ExportOptions,
): Promise<{ mimeType: string; bytes: Uint8Array } | null> {
    const data = parseDataURI(url)
    if (data) return data

    const urlFactory = options.parserOptions?.urlFactory as URLFactory | undefined
    const stored = urlFactory?.getData?.(url)
    if (stored) {
        return {
            mimeType: stored.mimeType,
            bytes: await toBytes(stored.data),
        }
    }

    if (typeof fetch !== 'function') return null
    try {
        const response = await fetch(url)
        if (!response.ok) return null
        const blob = await response.blob()
        return {
            mimeType: blob.type || response.headers.get('content-type') || getMimeTypeFromPath(url),
            bytes: await toBytes(blob),
        }
    } catch {
        return null
    }
}

// ---------------------------------------------------------------------------
// Title extraction helpers
// ---------------------------------------------------------------------------

export function extractDocumentTitle(html: string): string | null {
    const match = /<(?:title|h[1-6])\b[^>]*>([\s\S]*?)<\/(?:title|h[1-6])>/i.exec(html)
    const text = normalizeTitleText(match?.[1])
    return text || null
}

export function sectionTitleFromId(section: Section): string | null {
    const id = String(section.id).split(/[\/\\]/).pop()?.replace(/\.[^.]+$/, '')
    const text = normalizeTitleText(id?.replace(/[-_]+/g, ' '))
    return text || null
}

export function resolveSectionTitle(
    section: Section,
    index: number,
    html: string | undefined,
    preferredTitle: string | undefined,
    fallbackPrefix = 'Section',
): string {
    return preferredTitle
        ?? (html ? extractDocumentTitle(html) : null)
        ?? sectionTitleFromId(section)
        ?? `${fallbackPrefix} ${index + 1}`
}

export function normalizeTitleText(value: string | undefined): string {
    if (!value) return ''
    return value
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/\s+/g, ' ')
        .trim()
}

// ---------------------------------------------------------------------------
// Metadata helpers
// ---------------------------------------------------------------------------

export function stringifyLanguageMap(value: LanguageMap | undefined): string {
    if (!value) return ''
    if (typeof value === 'string') return value
    return value[Object.keys(value)[0]] ?? ''
}

export function normalizeLanguage(value: string | string[] | undefined): string {
    if (Array.isArray(value)) return value[0] ?? 'und'
    return value || 'und'
}

export function stringifyContributor(value: Contributor | readonly Contributor[] | undefined): string | undefined {
    if (!value) return undefined
    if (Array.isArray(value)) return (value as readonly Contributor[]).map(item => stringifyContributor(item)).filter(Boolean).join(', ')
    if (typeof value === 'string') return value
    return stringifyLanguageMap((value as Exclude<Contributor, string>).name)
}

export function buildExportTitle(metadata: BookMetadata | undefined): string {
    const title = stringifyLanguageMap(metadata?.title)
    return title ? `${title} - First Sections` : 'First Sections'
}

export function buildIdentifier(metadata: BookMetadata | undefined): string {
    return `${metadata?.identifier ?? 'rebook-export'}-first-sections-${Date.now()}`
}

// ---------------------------------------------------------------------------
// XML / HTML escape helpers
// ---------------------------------------------------------------------------
// (Re-exported from core/utils.ts)

// ---------------------------------------------------------------------------
// Plain-text extraction from HTML
// ---------------------------------------------------------------------------

/**
 * Strip HTML tags and decode basic entities to produce plain text.
 * This is a lightweight regex-based approach suitable for section content.
 */
export function htmlToText(html: string): string {
    return html
        // Remove script / style blocks
        .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
        // Block elements → newlines
        .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|pre|section|article|header|footer|br)\b[^>]*>/gi, '\n')
        .replace(/<br\b[^>]*\/?>/gi, '\n')
        // Remove remaining tags
        .replace(/<[^>]*>/g, '')
        // Decode entities
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
        .replace(/&[a-z]+;/gi, ' ')
        // Collapse excessive blank lines
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

// ---------------------------------------------------------------------------
// HTML fragment / resource attribute helpers
// ---------------------------------------------------------------------------

export function extractBodyContent(html: string): string {
    const bodyMatch = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(html)
    if (bodyMatch) return bodyMatch[1]
    return stripDocumentShell(html)
}

export function stripDocumentShell(html: string): string {
    return html
        .replace(/<\?xml[^>]*>/gi, '')
        .replace(/<!DOCTYPE[^>]*>/gi, '')
        .replace(/<\/?html\b[^>]*>/gi, '')
        .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, '')
        .replace(/<body\b[^>]*>/gi, '')
        .replace(/<\/body>/gi, '')
}

export function normalizeHTMLFragment(html: string): string {
    return stripDocumentShell(html)
        .replace(
            /<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)\b([^<>]*?)(?<!\/)>/gi,
            '<$1$2/>',
        )
}

export type ResourceAttributeRewriter = (
    url: string,
    attr: string,
    rawAttribute: string,
) => Promise<string | null> | string | null

export async function rewriteResourceAttributes(
    html: string,
    rewrite: ResourceAttributeRewriter,
): Promise<string> {
    let result = await rewriteResourceAttributePattern(
        html,
        /\s(src|poster|data)=["']([^"']+)["']/gi,
        rewrite,
    )
    result = await rewriteResourceAttributePattern(
        result,
        /\s((?:xlink:)?href)=["']([^"']+)["']/gi,
        rewrite,
    )
    return result
}

async function rewriteResourceAttributePattern(
    html: string,
    regex: RegExp,
    rewrite: ResourceAttributeRewriter,
): Promise<string> {
    let result = ''
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(html)) !== null) {
        const attr = match[1]
        const url = match[2]
        result += html.slice(lastIndex, match.index)
        const replacement = await rewrite(url, attr, match[0])
        result += replacement ?? match[0]
        lastIndex = regex.lastIndex
    }

    return result + html.slice(lastIndex)
}
