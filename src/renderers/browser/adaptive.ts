/**
 * Browser renderer that selects a content engine after the Book shape is known.
 *
 * ReaderSession should see one browser renderer. PDF, image/comic, and
 * reflowable engines are selected inside this renderer and all still emit the
 * same page-surface/compositor model.
 */

import { UnsupportedFormatError } from '../../core/errors'
import { isFixedDocument } from '../../core/fixed-document'
import type { PageSurface } from '../../core/page-surface'
import type {
    EventListener,
    LayoutMode,
    ReaderMark,
    Renderer,
    RendererStyles,
} from '../../core/renderer'
import { ReaderMarkStore, RendererEventDispatcher } from '../../core/renderer-state'
import type { Book } from '../../core/types'
import type { BrowserContentEngine, BrowserContentEngineRoute } from './content-engine'

export interface BrowserAdaptiveRendererConfig {
    readonly routes: readonly BrowserContentEngineRoute[]
}

export class BrowserAdaptiveRenderer implements Renderer {
    private readonly routes: readonly BrowserContentEngineRoute[]
    private readonly events = new RendererEventDispatcher()
    private readonly marks = new ReaderMarkStore()
    private active: BrowserContentEngine | null = null
    private activeEngineId: string | null = null
    private styles: RendererStyles | null = null
    private layout: LayoutMode | null = null
    private spread: number | null = null

    constructor(config: BrowserAdaptiveRendererConfig) {
        this.routes = config.routes
    }

    async open(book: Book): Promise<void> {
        const route = selectBrowserContentEngine(book, this.routes)

        if (this.activeEngineId !== route.id) {
            this.active?.destroy()
            this.active = route.createEngine()
            this.activeEngineId = route.id
            this.events.replayTo(this.active)
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

    getActiveEngine(): BrowserContentEngine | null {
        return this.active
    }

    getActiveEngineId(): string | null {
        return this.activeEngineId
    }

    private requireActive(): BrowserContentEngine {
        if (!this.active) {
            throw new UnsupportedFormatError('No browser content engine is active; open a book before navigating')
        }
        return this.active
    }

    private replayState(engine: BrowserContentEngine): void {
        if (this.styles) engine.setStyles(this.styles)
        if (this.layout) engine.setLayout(this.layout)
        if (this.spread !== null) engine.setSpread(this.spread)
        for (const mark of this.marks.values()) {
            engine.setMark(mark)
        }
    }
}

export function createBrowserAdaptiveRenderer(
    routes: readonly BrowserContentEngineRoute[],
): BrowserAdaptiveRenderer {
    return new BrowserAdaptiveRenderer({ routes })
}

export function selectBrowserContentEngine(
    book: Book,
    routes: readonly BrowserContentEngineRoute[],
): BrowserContentEngineRoute {
    let selected: BrowserContentEngineRoute | null = null
    let selectedScore = 0

    for (const route of routes) {
        const match = route.match(book)
        const score = typeof match === 'number' ? match : match ? 1 : 0
        if (score > selectedScore) {
            selected = route
            selectedScore = score
        }
    }

    if (!selected) throw new UnsupportedFormatError(getContentEngineRouteErrorMessage(book))
    return selected
}

export function matchesBrowserFixedContent(book: Book): boolean {
    return isFixedDocument(book.fixedDocument)
}

export function matchesBrowserReflowableContent(book: Book): boolean {
    return !matchesBrowserFixedContent(book)
}

function getContentEngineRouteErrorMessage(book: Book): string {
    if (isFixedDocument(book.fixedDocument)) {
        return `No browser fixed-content engine registered for ${book.fixedDocument.format}`
    }
    return 'No browser content engine registered for this book'
}
