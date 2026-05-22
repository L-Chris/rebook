/**
 * Metadata normalization helpers.
 * Ensures consistent types across all parsers.
 */

import type { Contributor, LanguageMap } from './types'

/**
 * Normalize a language value to a plain string.
 * - string[] → first element or undefined
 * - Record → first value or undefined
 * - string → as-is
 */
export function normalizeLanguage(lang: string | string[] | undefined): string | undefined {
    if (!lang) return undefined
    if (Array.isArray(lang)) return lang[0] || undefined
    return lang
}

/**
 * Normalize a title/subtitle to a plain string.
 * - LanguageMap object → first value
 * - string → as-is
 */
export function normalizeTitle(title: LanguageMap | undefined): string | undefined {
    if (!title) return undefined
    if (typeof title === 'string') return title
    const keys = Object.keys(title)
    return keys.length > 0 ? title[keys[0]] : undefined
}

/**
 * Normalize a publisher to a plain string.
 * - Contributor object → name field
 * - LanguageMap object → first value
 * - string → as-is
 */
export function normalizePublisher(pub: Contributor | LanguageMap | undefined): string | undefined {
    if (!pub) return undefined
    if (typeof pub === 'string') return pub
    // Contributor object
    if ('name' in pub) {
        return normalizeTitle(pub.name)
    }
    // LanguageMap object
    return normalizeTitle(pub)
}

/**
 * Normalize contributors to always be an array of Contributor objects.
 * - string → [{ name: str }]
 * - string[] → [{ name: str }, ...]
 * - Contributor → [contributor]
 * - Contributor[] → as-is
 */
export function normalizeContributors(
    contrib: Contributor | Contributor[] | string | string[] | undefined
): Contributor[] | undefined {
    if (!contrib) return undefined

    // Array handling
    if (Array.isArray(contrib)) {
        return contrib.map(c => normalizeSingleContributor(c)).filter(Boolean) as Contributor[]
    }

    // Single value
    const normalized = normalizeSingleContributor(contrib)
    return normalized ? [normalized] : undefined
}

function normalizeSingleContributor(c: Contributor | string): Contributor | null {
    if (!c) return null
    if (typeof c === 'string') {
        return { name: c }
    }
    // Already a Contributor object, ensure name is normalized
    return {
        name: typeof c.name === 'string' ? c.name : normalizeTitle(c.name) || '',
        sortAs: c.sortAs ? (typeof c.sortAs === 'string' ? c.sortAs : normalizeTitle(c.sortAs)) : undefined,
        role: c.role,
    }
}

/**
 * Normalize subject/keywords to always be an array of strings.
 * - string → [str]
 * - string[] → as-is
 */
export function normalizeSubjects(subject: string | string[] | undefined): string[] | undefined {
    if (!subject) return undefined
    if (Array.isArray(subject)) return subject.filter(Boolean)
    return [subject]
}
