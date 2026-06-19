import type { RendererStyles } from './renderer'
import type { FixedPageVisualAppearance } from './fixed-document'

export type BuiltInReaderThemeName = 'normal' | 'night'

export interface ReaderTheme {
    /** Stable theme id. */
    id?: string
    /** Display name for UI surfaces. */
    label?: string
    /** Main reading text color. */
    color?: string
    /** Viewport/background color around content. */
    background?: string
    /** Page-like surface background, useful for fixed pages or card-like readers. */
    pageBackground?: string
    /** Page-like surface shadow. Use "none" for flat themes. */
    pageShadow?: string
    /** Visual appearance applied by fixed-page renderers that support direct theming. */
    fixedPageVisualAppearance?: FixedPageVisualAppearance
    /** Optional link/accent color for renderers that support it. */
    accentColor?: string
    /** Optional selection background for renderers that inject CSS. */
    selectionBackground?: string
    /** Optional selection text color for renderers that inject CSS. */
    selectionColor?: string
    /** Optional renderer CSS appended before user CSS. */
    css?: string
}

export type ReaderThemeInput = BuiltInReaderThemeName | ReaderTheme

export const BUILT_IN_READER_THEMES: Record<BuiltInReaderThemeName, Required<Pick<ReaderTheme, 'id' | 'label' | 'color' | 'background' | 'pageBackground' | 'pageShadow' | 'accentColor' | 'selectionBackground' | 'selectionColor'>> & Pick<ReaderTheme, 'fixedPageVisualAppearance'>> = {
    normal: {
        id: 'normal',
        label: 'Normal',
        color: '#111827',
        background: '#ffffff',
        pageBackground: '#ffffff',
        pageShadow: '0 1px 4px rgba(0, 0, 0, 0.18)',
        accentColor: '#2563eb',
        selectionBackground: 'rgba(37, 99, 235, 0.22)',
        selectionColor: '#111827',
    },
    night: {
        id: 'night',
        label: 'Night',
        color: '#e5e7eb',
        background: '#0f172a',
        pageBackground: '#111827',
        pageShadow: '0 1px 8px rgba(0, 0, 0, 0.45)',
        fixedPageVisualAppearance: {
            background: '#111827',
            text: {
                strategy: 'force',
                color: '#e5e7eb',
            },
            vector: {
                strategy: 'map-neutral',
                foreground: '#e5e7eb',
                background: '#111827',
            },
            image: { strategy: 'preserve' },
        },
        accentColor: '#60a5fa',
        selectionBackground: 'rgba(96, 165, 250, 0.32)',
        selectionColor: '#f8fafc',
    },
}

export function resolveReaderTheme(theme: ReaderThemeInput | null | undefined): ReaderTheme | null {
    if (!theme) return null
    if (typeof theme === 'string') return BUILT_IN_READER_THEMES[theme] ?? null
    return theme
}

export function resolveRendererStyles(styles: RendererStyles = {}): RendererStyles {
    const theme = resolveReaderTheme(styles.theme)
    if (!theme) return styles
    return {
        ...styles,
        color: styles.color ?? theme.color,
        background: styles.background ?? theme.background,
        pageBackground: styles.pageBackground ?? theme.pageBackground,
        pageShadow: styles.pageShadow ?? theme.pageShadow,
        fixedPageVisualAppearance: styles.fixedPageVisualAppearance ?? theme.fixedPageVisualAppearance,
        selectionBackground: styles.selectionBackground ?? theme.selectionBackground,
        selectionColor: styles.selectionColor ?? theme.selectionColor,
        css: [theme.css, styles.css].filter(Boolean).join('\n') || undefined,
    }
}

export function mergeRendererStyles(current: RendererStyles, patch: RendererStyles): RendererStyles {
    const next: RendererStyles = { ...current, ...patch }
    if (patch.theme !== undefined) {
        if (patch.color === undefined) delete next.color
        if (patch.background === undefined) delete next.background
        if (patch.pageBackground === undefined) delete next.pageBackground
        if (patch.pageShadow === undefined) delete next.pageShadow
        if (patch.fixedPageVisualAppearance === undefined) delete next.fixedPageVisualAppearance
        if (patch.selectionBackground === undefined) delete next.selectionBackground
        if (patch.selectionColor === undefined) delete next.selectionColor
    }
    return resolveRendererStyles(next)
}
