import { describe, expect, it } from 'vitest'
import {
    ContentEngineRouter,
    createContentEngineRouter,
    matchesFixedContent,
    matchesReflowableContent,
    selectContentEngineRoute,
    type ContentEngineRoute,
} from '../../src/core/content-engine-router'
import type { Book, RelocateEvent } from '../../src/core/types'
import type {
    EventListener,
    LayoutMode,
    ReaderMark,
    Renderer,
    RendererStyles,
} from '../../src/core/renderer'
import type { PageSurface } from '../../src/core/page-surface'

describe('ContentEngineRouter', () => {
    it('selects fixed-content engines before reflowable content engines', () => {
        const fixedRoute = createRoute('fixed', matchesFixedContent)
        const flowRoute = createRoute('flow', matchesReflowableContent)

        expect(selectContentEngineRoute(createFixedBook(), [flowRoute, fixedRoute]).id).toBe('fixed')
        expect(selectContentEngineRoute(createFlowBook(), [flowRoute, fixedRoute]).id).toBe('flow')
    })

    it('opens the selected engine and forwards navigation calls', async () => {
        const fixed = new FakeEngine()
        const flow = new FakeEngine()
        const router = createContentEngineRouter([
            { id: 'fixed', match: matchesFixedContent, createEngine: () => fixed },
            { id: 'flow', match: matchesReflowableContent, createEngine: () => flow },
        ])

        await router.open(createFixedBook())
        await router.next()

        expect(router.getActiveEngineId()).toBe('fixed')
        expect(router.getActiveEngine()).toBe(fixed)
        expect(fixed.opened).toBe(1)
        expect(fixed.nextCalls).toBe(1)
        expect(flow.opened).toBe(0)
    })

    it('replays listeners and pending reader state to a newly selected engine', async () => {
        const fixed = new FakeEngine()
        const flow = new FakeEngine()
        const router = new ContentEngineRouter({
            routes: [
                { id: 'fixed', match: matchesFixedContent, createEngine: () => fixed },
                { id: 'flow', match: matchesReflowableContent, createEngine: () => flow },
            ],
        })
        const listener: EventListener = () => {}
        const mark: ReaderMark = {
            id: 'm1',
            kind: 'highlight',
            location: { type: 'fixed', format: 'pdf', pageIndex: 0 },
        }

        router.on('relocate', listener)
        router.setStyles({ fontSize: 18 })
        router.setLayout('paginated')
        router.setSpread(2)
        router.setMark(mark)
        await router.open(createFixedBook())

        expect(fixed.listeners.get('relocate')?.has(listener)).toBe(true)
        expect(fixed.styles).toEqual({ fontSize: 18 })
        expect(fixed.layout).toBe('paginated')
        expect(fixed.spread).toBe(2)
        expect(fixed.getMarks()).toEqual([mark])

        await router.open(createFlowBook())

        expect(fixed.destroyed).toBe(1)
        expect(flow.listeners.get('relocate')?.has(listener)).toBe(true)
        expect(flow.styles).toEqual({ fontSize: 18 })
        expect(flow.layout).toBe('paginated')
        expect(flow.spread).toBe(2)
        expect(flow.getMarks()).toEqual([mark])
    })

    it('forwards the active engine current surface', async () => {
        const fixed = new FakeEngine()
        const surface: PageSurface = {
            id: 'surface-1',
            kind: 'fixed-page',
            width: 100,
            height: 120,
            scale: 1,
            layers: [],
        }
        fixed.surface = surface
        const router = createContentEngineRouter([
            { id: 'fixed', match: matchesFixedContent, createEngine: () => fixed },
        ])

        expect(router.getCurrentSurface()).toBeNull()
        await router.open(createFixedBook())

        expect(router.getCurrentSurface()).toBe(surface)
    })

    it('uses caller supplied error messages for platform-specific routers', async () => {
        const router = new ContentEngineRouter({
            routes: [
                { id: 'flow', match: matchesReflowableContent, createEngine: () => new FakeEngine() },
            ],
            getRouteErrorMessage: book => `No custom engine for ${book.fixedDocument?.format ?? 'flow'}`,
        })

        await expect(router.open(createFixedBook())).rejects.toThrow('No custom engine for pdf')
    })
})

function createRoute(id: string, match: ContentEngineRoute['match']): ContentEngineRoute {
    return { id, match, createEngine: () => new FakeEngine() }
}

function createFlowBook(): Book {
    return {
        sections: [
            {
                id: 'chapter.html',
                size: 1,
                load: () => '<p>Hello</p>',
            },
        ],
    }
}

function createFixedBook(): Book {
    return {
        sections: [],
        rendition: { layout: 'pre-paginated' },
        fixedDocument: {
            kind: 'fixed-document',
            format: 'pdf',
            pageCount: 1,
            getPage: () => ({ index: 0, width: 600, height: 800 }),
        },
    }
}

class FakeEngine implements Renderer {
    opened = 0
    destroyed = 0
    nextCalls = 0
    styles: RendererStyles | null = null
    layout: LayoutMode | null = null
    spread: number | null = null
    surface: PageSurface | null = null
    marks = new Map<string, ReaderMark>()
    listeners = new Map<string, Set<EventListener>>()

    async open(): Promise<void> {
        this.opened += 1
    }

    async goTo(): Promise<void> {}

    async next(): Promise<void> {
        this.nextCalls += 1
    }

    async prev(): Promise<void> {}

    async goToFraction(): Promise<void> {}

    setStyles(styles: RendererStyles): void {
        this.styles = styles
    }

    setLayout(mode: LayoutMode): void {
        this.layout = mode
    }

    setSpread(maxColumns: number): void {
        this.spread = maxColumns
    }

    setMark(mark: ReaderMark): void {
        this.marks.set(mark.id, mark)
    }

    removeMark(id: string): void {
        this.marks.delete(id)
    }

    clearMarks(kind?: string): void {
        if (kind) {
            for (const [id, mark] of this.marks) {
                if (mark.kind === kind) this.marks.delete(id)
            }
        } else {
            this.marks.clear()
        }
    }

    getMarks(): ReaderMark[] {
        return Array.from(this.marks.values())
    }

    getLocation(): RelocateEvent | null {
        return null
    }

    getCurrentSurface(): PageSurface | null {
        return this.surface
    }

    getSectionFractions(): number[] {
        return []
    }

    async refresh(): Promise<void> {}

    on(event: string, listener: EventListener): void {
        let listeners = this.listeners.get(event)
        if (!listeners) {
            listeners = new Set()
            this.listeners.set(event, listeners)
        }
        listeners.add(listener)
    }

    off(event: string, listener: EventListener): void {
        this.listeners.get(event)?.delete(listener)
    }

    destroy(): void {
        this.destroyed += 1
    }
}
