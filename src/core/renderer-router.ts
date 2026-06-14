/**
 * Renderer routing for books that need different rendering engines.
 *
 * ReaderSession owns a single Renderer instance. RendererRouter preserves that
 * contract while allowing the actual engine to be selected after parsing, when
 * the Book shape is known.
 */

import { UnsupportedFormatError } from './errors'
import { isFixedDocument } from './fixed-document'
import type { Book } from './types'
import type {
    EventListener,
    LayoutMode,
    ReaderMark,
    Renderer,
    RendererStyles,
} from './renderer'
import { ReaderMarkStore, RendererEventDispatcher } from './renderer-state'

export type RendererRouteMatch = boolean | number

export interface RendererRoute {
    readonly id: string
    match(book: Book): RendererRouteMatch
    createRenderer(): Renderer
}

export interface RendererRouterConfig {
    readonly routes: readonly RendererRoute[]
}

export class RendererRouter implements Renderer {
    private readonly routes: readonly RendererRoute[]
    private active: Renderer | null = null
    private activeRouteId: string | null = null
    private readonly events = new RendererEventDispatcher()
    private readonly marks = new ReaderMarkStore()
    private styles: RendererStyles | null = null
    private layout: LayoutMode | null = null
    private spread: number | null = null

    constructor(config: RendererRouterConfig) {
        this.routes = config.routes
    }

    async open(book: Book): Promise<void> {
        const route = selectRendererRoute(book, this.routes)

        if (this.activeRouteId !== route.id) {
            this.active?.destroy()
            const nextRenderer = route.createRenderer()
            this.active = nextRenderer
            this.activeRouteId = route.id
            this.replayListeners(nextRenderer)
        }

        const renderer = this.requireActive()
        this.replayState(renderer)
        await renderer.open(book)
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
        this.activeRouteId = null
        this.events.clear()
        this.marks.clear()
        this.styles = null
        this.layout = null
        this.spread = null
    }

    getActiveRenderer(): Renderer | null {
        return this.active
    }

    getActiveRouteId(): string | null {
        return this.activeRouteId
    }

    private requireActive(): Renderer {
        if (!this.active) {
            throw new UnsupportedFormatError('No renderer is active; open a book before navigating')
        }
        return this.active
    }

    private replayListeners(renderer: Renderer): void {
        this.events.replayTo(renderer)
    }

    private replayState(renderer: Renderer): void {
        if (this.styles) renderer.setStyles(this.styles)
        if (this.layout) renderer.setLayout(this.layout)
        if (this.spread !== null) renderer.setSpread(this.spread)
        for (const mark of this.marks.values()) {
            renderer.setMark(mark)
        }
    }
}

export function createRendererRouter(routes: readonly RendererRoute[]): RendererRouter {
    return new RendererRouter({ routes })
}

export function selectRendererRoute(book: Book, routes: readonly RendererRoute[]): RendererRoute {
    let selected: RendererRoute | null = null
    let selectedScore = 0

    for (const route of routes) {
        const match = route.match(book)
        const score = typeof match === 'number' ? match : match ? 1 : 0
        if (score > selectedScore) {
            selected = route
            selectedScore = score
        }
    }

    if (!selected) {
        throw new UnsupportedFormatError(getRendererRouteErrorMessage(book))
    }

    return selected
}

export function matchesFixedDocument(book: Book): boolean {
    return isFixedDocument(book.fixedDocument)
}

export function matchesReflowableBook(book: Book): boolean {
    return !matchesFixedDocument(book)
}

function getRendererRouteErrorMessage(book: Book): string {
    if (isFixedDocument(book.fixedDocument)) {
        return `No fixed-document renderer registered for ${book.fixedDocument.format}`
    }
    return 'No renderer registered for this book'
}
