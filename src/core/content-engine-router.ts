/**
 * Content-engine routing for books that need different rendering engines.
 *
 * ReaderSession still owns one Renderer-compatible object. The content-engine
 * router preserves that contract while moving Book -> engine selection into
 * Reader Core so browser, WebView, mini-program, and future GPU backends can
 * share the same routing/state replay behavior.
 */

import { UnsupportedFormatError } from './errors'
import { isFixedDocument } from './fixed-document'
import type { PageSurface } from './page-surface'
import type {
    EventListener,
    LayoutMode,
    ReaderMark,
    Renderer,
    RendererStyles,
} from './renderer'
import { ReaderMarkStore, RendererEventDispatcher } from './renderer-state'
import type { ReaderThemeInput } from './theme'
import type { Book } from './types'

export type ContentEngine = Renderer

export type ContentEngineRouteMatch = boolean | number

export interface ContentEngineRoute<TEngine extends ContentEngine = ContentEngine> {
    readonly id: string
    match(book: Book): ContentEngineRouteMatch
    createEngine(): TEngine
}

export interface ContentEngineRouterConfig<TEngine extends ContentEngine = ContentEngine> {
    readonly routes: readonly ContentEngineRoute<TEngine>[]
    readonly noActiveEngineMessage?: string
    readonly getRouteErrorMessage?: (book: Book) => string
}

export class ContentEngineRouter<TEngine extends ContentEngine = ContentEngine> implements Renderer {
    private readonly routes: readonly ContentEngineRoute<TEngine>[]
    private readonly noActiveEngineMessage: string
    private readonly getRouteErrorMessage: (book: Book) => string
    private readonly events = new RendererEventDispatcher()
    private readonly marks = new ReaderMarkStore()
    private active: TEngine | null = null
    private activeEngineId: string | null = null
    private styles: RendererStyles | null = null
    private layout: LayoutMode | null = null
    private spread: number | null = null

    constructor(config: ContentEngineRouterConfig<TEngine>) {
        this.routes = config.routes
        this.noActiveEngineMessage = config.noActiveEngineMessage
            ?? 'No content engine is active; open a book before navigating'
        this.getRouteErrorMessage = config.getRouteErrorMessage ?? getContentEngineRouteErrorMessage
    }

    async open(book: Book): Promise<void> {
        const route = selectContentEngineRoute(book, this.routes, this.getRouteErrorMessage)

        if (this.activeEngineId !== route.id) {
            this.active?.destroy()
            this.active = route.createEngine()
            this.activeEngineId = route.id
            this.events.replayTo(this.active)
        }

        const engine = this.requireActive()
        this.replayState(engine)
        await engine.open(book)
    }

    async goTo(target: number | string): Promise<void> {
        await this.requireActive().goTo(target)
    }

    async next(): Promise<void> {
        await this.requireActive().next()
    }

    async prev(): Promise<void> {
        await this.requireActive().prev()
    }

    async goToFraction(fraction: number): Promise<void> {
        await this.requireActive().goToFraction(fraction)
    }

    setStyles(styles: RendererStyles): void {
        this.styles = styles
        this.active?.setStyles(styles)
    }

    setTheme(theme: ReaderThemeInput): void {
        this.styles = { ...(this.styles ?? {}), theme }
        this.active?.setTheme(theme)
    }

    setLayout(mode: LayoutMode): void {
        this.layout = mode
        this.active?.setLayout(mode)
    }

    setSpread(maxColumns: number): void {
        this.spread = maxColumns
        this.active?.setSpread(maxColumns)
    }

    setMark(mark: ReaderMark): void {
        this.marks.set(mark)
        this.active?.setMark(mark)
    }

    removeMark(id: string): void {
        this.marks.remove(id)
        this.active?.removeMark(id)
    }

    clearMarks(kind?: string): void {
        this.marks.clear(kind)
        this.active?.clearMarks(kind)
    }

    getMarks(): ReaderMark[] {
        return this.active?.getMarks() ?? this.marks.getAll()
    }

    getLocation() {
        return this.active?.getLocation() ?? null
    }

    getCurrentSurface(): PageSurface | null {
        return this.active?.getCurrentSurface?.() ?? null
    }

    getSectionFractions(): number[] {
        return this.active?.getSectionFractions() ?? []
    }

    async refresh(): Promise<void> {
        await this.requireActive().refresh()
    }

    on(event: string, listener: EventListener): void {
        this.events.on(event, listener)
        this.active?.on(event, listener)
    }

    off(event: string, listener: EventListener): void {
        this.events.off(event, listener)
        this.active?.off(event, listener)
    }

    destroy(): void {
        this.active?.destroy()
        this.active = null
        this.activeEngineId = null
        this.events.clear()
        this.marks.clear()
        this.styles = null
        this.layout = null
        this.spread = null
    }

    getActiveEngine(): TEngine | null {
        return this.active
    }

    getActiveEngineId(): string | null {
        return this.activeEngineId
    }

    private requireActive(): TEngine {
        if (!this.active) {
            throw new UnsupportedFormatError(this.noActiveEngineMessage)
        }
        return this.active
    }

    private replayState(engine: TEngine): void {
        if (this.styles) engine.setStyles(this.styles)
        if (this.layout) engine.setLayout(this.layout)
        if (this.spread !== null) engine.setSpread(this.spread)
        for (const mark of this.marks.values()) {
            engine.setMark(mark)
        }
    }
}

export function createContentEngineRouter<TEngine extends ContentEngine = ContentEngine>(
    routes: readonly ContentEngineRoute<TEngine>[],
    config: Omit<ContentEngineRouterConfig<TEngine>, 'routes'> = {},
): ContentEngineRouter<TEngine> {
    return new ContentEngineRouter({ ...config, routes })
}

export function selectContentEngineRoute<TRoute extends ContentEngineRoute = ContentEngineRoute>(
    book: Book,
    routes: readonly TRoute[],
    getRouteErrorMessage: (book: Book) => string = getContentEngineRouteErrorMessage,
): TRoute {
    let selected: TRoute | null = null
    let selectedScore = 0

    for (const route of routes) {
        const match = route.match(book)
        const score = typeof match === 'number' ? match : match ? 1 : 0
        if (score > selectedScore) {
            selected = route
            selectedScore = score
        }
    }

    if (!selected) throw new UnsupportedFormatError(getRouteErrorMessage(book))
    return selected
}

export function matchesFixedContent(book: Book): boolean {
    return isFixedDocument(book.fixedDocument)
}

export function matchesReflowableContent(book: Book): boolean {
    return !matchesFixedContent(book)
}

function getContentEngineRouteErrorMessage(book: Book): string {
    if (isFixedDocument(book.fixedDocument)) {
        return `No fixed-content engine registered for ${book.fixedDocument.format}`
    }
    return 'No content engine registered for this book'
}
