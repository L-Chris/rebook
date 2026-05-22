/**
 * Shared utility functions used across multiple parsers.
 */

import type { XMLElement } from './dom-adapter'

/**
 * Strip and collapse ASCII whitespace in a string.
 * Returns empty string for null/undefined input.
 */
export const normalizeWhitespace = (str: string | null | undefined): string =>
    str ? str.replace(/[\t\n\f\r ]+/g, ' ').trim() : ''

/**
 * Get normalized text content of an XML element.
 */
export const getElementText = (el: XMLElement | null | undefined): string =>
    normalizeWhitespace(el?.textContent)

/**
 * Simplified CSS.escape for ID selectors and attribute values.
 * Escapes special characters that need escaping in CSS selectors.
 */
export const cssEscape = (str: string): string =>
    str.replace(/([^\w-])/g, '\\$1')

/**
 * Escape special regex characters in a string.
 */
export const regexEscape = (str: string): string =>
    str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')

/**
 * Replace matches asynchronously and sequentially.
 * Useful when replacement function returns a Promise.
 *
 * @example
 * const result = await replaceSeries(
 *   'Hello {name}',
 *   /\{(\w+)\}/g,
 *   async (match, key) => await lookup(key)
 * )
 */
export const replaceSeries = async (
    str: string,
    regex: RegExp,
    f: (...args: string[]) => Promise<string>,
): Promise<string> => {
    const matches: string[][] = []
    str.replace(regex, (...args: string[]) => (matches.push(args), null as unknown as string))
    const results: string[] = []
    for (const args of matches) results.push(await f(...args))
    return str.replace(regex, () => results.shift()!)
}

/**
 * Escape HTML special characters in a string.
 */
export const escapeHTML = (str: string): string =>
    str.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')

/**
 * Escape HTML attribute value (quotes only).
 */
export const escapeAttr = (str: string): string =>
    str.replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')

/**
 * Unescape HTML entities in a string.
 */
export const unescapeHTML = (str: string | undefined): string => {
    if (!str) return ''
    return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
        .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
}
