import { describe, expect, it } from 'vitest'
import {
    createRendererRouter,
    matchesFixedDocument,
    matchesReflowableBook,
    selectRendererRoute,
    type RendererRoute,
} from '../../src/core/renderer-router'
import type { Book, RelocateEvent } from '../../src/core/types'
import type {
    EventListener,
    LayoutMode,
    ReaderMark,
    Renderer,
    RendererStyles,
} from '../../src/core/renderer'
import type { PageSurface } from '../../src/core/page-surface'

describe('RendererRouter', () => {
    it('selects fixed-document renderers before reflowable renderers', () => {
        const fixedBook = createFixedBook()
        const fixedRoute = createRoute('fixed', matchesFixedDocument)
        const flowRoute = createRoute('flow', matchesReflowableBook)

        expect(selectRendererRoute(fixedBook, [flowRoute, fixedRoute]).id).toBe('fixed')
        expect(selectRendererRoute(createFlowBook(), [flowRoute, fixedRoute]).id).toBe('flow')
    })

    it('opens the selected renderer and forwards navigation calls', async () => {
        const fixed = new FakeRenderer()
        const flow = new FakeRenderer()
        const router = createRendererRouter([
            { id: 'fixed', match: matchesFixedDocument, createRenderer: () => fixed },
            { id: 'flow', match: matchesReflowableBook, createRenderer: () => flow },
        ])

        await router.open(createFixedBook())
        await router.next()

        expect(router.getActiveRouteId()).toBe('fixed')
        expect(fixed.opened).toBe(1)
        expect(fixed.nextCalls).toBe(1)
        expect(flow.opened).toBe(0)
    })

    it('replays listeners and pending renderer state to a newly selected renderer', async () => {
        const mark: ReaderMark = { id: 'm1', location: { type: 'reflowable', sectionIndex: 0, href: 'chapter.html' } }
        const fixed = new FakeRenderer()
        const router = createRendererRouter([
            { id: 'fixed', match: matchesFixedDocument, createRenderer: () => fixed },
        ])
        const listener: EventListener = () => {}

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
        expect(fixed.marks.get('m1')).toEqual(mark)
    })

    it('forwards the active renderer current surface', async () => {
        const fixed = new FakeRenderer()
        const surface: PageSurface = {
            id: 'surface-1',
            kind: 'fixed-page',
            width: 100,
            height: 120,
            scale: 1,
            layers: [],
        }
        fixed.surface = surface
        const router = createRendererRouter([
            { id: 'fixed', match: matchesFixedDocument, createRenderer: () => fixed },
        ])

        expect(router.getCurrentSurface()).toBeNull()
        await router.open(createFixedBook())

        expect(router.getCurrentSurface()).toBe(surface)
    })

    it('throws a clear error when no renderer can handle the book', async () => {
        const router = createRendererRouter([
            { id: 'flow', match: matchesReflowableBook, createRenderer: () => new FakeRenderer() },
        ])

        await expect(router.open(createFixedBook())).rejects.toThrow('No fixed-document renderer registered for pdf')
    })
})

function createRoute(id: string, match: RendererRoute['match']): RendererRoute {
    return { id, match, createRenderer: () => new FakeRenderer() }
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

class FakeRenderer implements Renderer {
    opened = 0
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

    destroy(): void {}
}
