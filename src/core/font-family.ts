import type { RendererStyles } from './renderer'
import type { TextBlock, TextSegment, TextStyle } from './types'

const DEFAULT_SERIF_STACK = 'system-ui, -apple-system, "Noto Serif CJK SC", "Noto Serif SC", Georgia, serif'
const DEFAULT_SANS_SERIF_STACK = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const DEFAULT_MONOSPACE_STACK = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

type FontRole = 'content' | 'monospace'
type GenericFontFamily = 'serif' | 'sans-serif' | 'monospace'

export function getRendererDefaultFontFamily(styles: RendererStyles): string {
    const families = styles.fontFamilies
    if (!families) return styles.fontFamily ?? DEFAULT_SERIF_STACK
    return families.default === 'sans-serif' ? families.sansSerif : families.serif
}

export function resolveRendererFontFamily(
    sourceFamily: string | undefined,
    styles: RendererStyles,
    role: FontRole = 'content',
): string {
    const families = styles.fontFamilies
    if (role === 'monospace') {
        return families?.monospace ?? sourceFamily ?? DEFAULT_MONOSPACE_STACK
    }

    const defaultFamily = getRendererDefaultFontFamily(styles)
    if (styles.overrideBookFonts) return defaultFamily
    if (!sourceFamily) return defaultFamily
    if (!families) return sourceFamily

    const tokens = splitFontFamilyList(sourceFamily)
    return tokens
        .map(token => {
            const generic = getGenericFontFamily(token)
            return generic ? getSemanticFontStack(generic, families) : token
        })
        .join(', ')
}

export function resolveTextBlockFontFamilies(
    blocks: readonly TextBlock[],
    styles: RendererStyles,
): TextBlock[] {
    return blocks.map(block => {
        const blockRole: FontRole = block.type === 'pre' ? 'monospace' : 'content'
        const blockFontFamily = resolveRendererFontFamily(block.style?.fontFamily, styles, blockRole)
        return {
            ...block,
            style: withFontFamily(block.style, blockFontFamily),
            segments: block.segments.map(segment => resolveTextSegmentFontFamily(
                segment,
                styles,
                isMonospaceSegment(segment) ? 'monospace' : blockRole,
                block.style?.fontFamily,
            )),
        }
    })
}

function resolveTextSegmentFontFamily(
    segment: TextSegment,
    styles: RendererStyles,
    role: FontRole,
    inheritedFontFamily?: string,
): TextSegment {
    const family = resolveRendererFontFamily(segment.style?.fontFamily ?? inheritedFontFamily, styles, role)
    return {
        ...segment,
        style: withFontFamily(segment.style, family),
    }
}

function withFontFamily(style: TextStyle | undefined, fontFamily: string): TextStyle {
    return { ...style, fontFamily }
}

function isMonospaceSegment(segment: TextSegment): boolean {
    const nodeType = segment.source?.nodeType?.toLowerCase()
    return nodeType === 'code' || nodeType === 'kbd' || nodeType === 'pre' || nodeType === 'samp'
}

function getSemanticFontStack(
    family: GenericFontFamily,
    families: NonNullable<RendererStyles['fontFamilies']>,
): string {
    if (family === 'monospace') return families.monospace
    if (family === 'sans-serif') return families.sansSerif
    return families.serif
}

function getGenericFontFamily(value: string): GenericFontFamily | null {
    const normalized = value.trim().replace(/^(['"])(.*)\1$/, '$2').toLowerCase()
    if (normalized === 'monospace' || normalized === 'ui-monospace') return 'monospace'
    if (normalized === 'sans-serif' || normalized === 'ui-sans-serif' || normalized === 'system-ui') return 'sans-serif'
    if (normalized === 'serif' || normalized === 'ui-serif') return 'serif'
    return null
}

function splitFontFamilyList(value: string): string[] {
    const result: string[] = []
    let start = 0
    let quote = ''
    let depth = 0
    for (let index = 0; index < value.length; index += 1) {
        const char = value[index]!
        if (quote) {
            if (char === quote && value[index - 1] !== '\\') quote = ''
            continue
        }
        if (char === '"' || char === "'") {
            quote = char
            continue
        }
        if (char === '(') depth += 1
        else if (char === ')') depth = Math.max(0, depth - 1)
        else if (char === ',' && depth === 0) {
            result.push(value.slice(start, index).trim())
            start = index + 1
        }
    }
    result.push(value.slice(start).trim())
    return result.filter(Boolean)
}
