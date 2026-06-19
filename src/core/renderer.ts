/**
 * Renderer interface.
 *
 * A renderer takes a Book object and displays it on a specific platform.
 * It handles pagination, scrolling, navigation, and user interactions.
 */

import type { Book, RelocateEvent, LoadEvent } from './types'
import type { BookPosition } from './location'
import type { FixedPageVisualAppearance } from './fixed-document'
import type { ReaderThemeInput } from './theme'
import type { PageSurface } from './page-surface'

/**
 * Style options for the renderer.
 */
export interface RendererStyles {
    /** Font family */
    fontFamily?: string
    /** Font size (CSS value) */
    fontSize?: string | number
    /** Line height (number or CSS value) */
    lineHeight?: number | string
    /** Text alignment */
    textAlign?: 'start' | 'justify' | 'center'
    /** Enable hyphenation */
    hyphenate?: boolean
    /** Custom CSS to inject */
    css?: string
    /** Theme preset name or custom theme. */
    theme?: ReaderThemeInput
    /** Text color */
    color?: string
    /** Background color */
    background?: string
    /** Page-like surface background */
    pageBackground?: string
    /** Page-like surface shadow */
    pageShadow?: string
    /** Visual appearance applied by fixed-page renderers that support direct theming. */
    fixedPageVisualAppearance?: FixedPageVisualAppearance
    /** Selection background color for renderers that support it. */
    selectionBackground?: string
    /** Selection text color for renderers that support it. */
    selectionColor?: string
    /** Column gap (for paginated mode) */
    gap?: string | number
    /** Maximum column width (for paginated mode) */
    maxInlineSize?: string | number
    /** Minimum column width — switch to single column below this */
    minColumnWidth?: string | number
    /** Maximum column width per column */
    maxColumnWidth?: string | number
    /** Maximum page height (for paginated mode) */
    maxBlockSize?: string | number
    /** Header/footer margin */
    margin?: string | number
}

/**
 * Layout mode for the renderer.
 */
export type LayoutMode = 'paginated' | 'scrolled'

export type NavigationDirection = 'next' | 'prev'

export interface RendererNavigationHooks {
    beforeNavigate?: (direction: NavigationDirection) => boolean | Promise<boolean>
}

export interface ReaderMark {
    id: string
    kind?: string
    location: BookPosition
    className?: string
    data?: Record<string, unknown>
}

/**
 * Platform-neutral configuration shared by renderer implementations.
 * Browser-specific renderers add their host container in their own modules.
 */
export interface RendererConfig extends RendererNavigationHooks {
    /** Initial layout mode */
    layout?: LayoutMode
    /** Initial styles */
    styles?: RendererStyles
    /** Enable page turn animations */
    animated?: boolean
    /** Maximum number of columns in paginated mode */
    maxColumnCount?: number
}

/**
 * Event listener type.
 */
export type EventListener<T = unknown> = (event: T) => void

/**
 * The Renderer interface.
 * Implement this to add support for a new platform.
 */
export interface Renderer {
    /**
     * Open a book for rendering.
     */
    open(book: Book): Promise<void>

    /**
     * Navigate to a specific location.
     * @param target - Section index, href string, or CFI string
     */
    goTo(target: number | string): Promise<void>

    /**
     * Go to the next page/section.
     */
    next(): Promise<void>

    /**
     * Go to the previous page/section.
     */
    prev(): Promise<void>

    /**
     * Navigate by fraction (0-1) of total book progress.
     */
    goToFraction(fraction: number): Promise<void>

    /**
     * Update rendering styles.
     */
    setStyles(styles: RendererStyles): void

    /**
     * Switch reader theme.
     */
    setTheme(theme: ReaderThemeInput): void

    /**
     * Set the layout mode.
     */
    setLayout(mode: LayoutMode): void

    /**
     * Set the maximum number of visible columns (pages) in paginated mode.
     * 1 = single page, 2 = two-page spread when the container is wide enough.
     * In 'auto' mode (value 2), the renderer dynamically switches between
     * 1 and 2 columns based on the available container width.
     */
    setSpread(maxColumns: number): void

    /**
     * Replace or add a render mark.
     */
    setMark(mark: ReaderMark): void

    /**
     * Remove one render mark.
     */
    removeMark(id: string): void

    /**
     * Clear render marks. When kind is provided, only marks of that kind are cleared.
     */
    clearMarks(kind?: string): void

    /**
     * Get current render marks.
     */
    getMarks(): ReaderMark[]

    /**
     * Get the current reading location.
     */
    getLocation(): RelocateEvent | null

    /**
     * Get the currently composed page surface when the renderer is surface-backed.
     */
    getCurrentSurface?(): PageSurface | null

    /**
     * Get section progress fractions (for progress bar tick marks).
     */
    getSectionFractions(): number[]

    /**
     * Reload the current section while preserving the current reading position.
     */
    refresh(): Promise<void>

    /**
     * Register an event listener.
     */
    on(event: string, listener: EventListener): void

    /**
     * Remove an event listener.
     */
    off(event: string, listener: EventListener): void

    /**
     * Clean up and release resources.
     */
    destroy(): void
}

/**
 * A renderer factory creates renderer instances.
 */
export type RendererFactory<TConfig extends RendererConfig = RendererConfig> = (config: TConfig) => Renderer
