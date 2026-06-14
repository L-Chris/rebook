import { describe, expect, it, vi } from 'vitest'
import {
    PageSurfaceController,
    type ContentRenderer,
    type PageCompositor,
    type PageSurface,
    type PageSurfaceComposeOutcome,
} from '../../src/core/page-surface'

describe('PageSurfaceController', () => {
    it('renders and composes synchronous page surfaces without deferring the fast path', () => {
        const surface = createSurface('surface-1')
        const contentRenderer: ContentRenderer<{ surface: PageSurface }> = {
            id: 'sync-renderer',
            renderSurface: context => context.surface,
        }
        const compositor: PageCompositor<PageSurface, undefined, string> = {
            id: 'sync-compositor',
            compose: rendered => `composed:${rendered.id}`,
        }
        const controller = new PageSurfaceController({ contentRenderer, compositor })

        const result = controller.render({ surface })

        expect(result).toEqual({ surface, result: 'composed:surface-1' })
        expect(controller.getCurrentSurface()).toBe(surface)
    })

    it('destroys stale asynchronous surfaces instead of composing them', async () => {
        const pending = new Map<string, (surface: PageSurface) => void>()
        const composed: string[] = []
        const destroyed = vi.fn()
        const contentRenderer: ContentRenderer<{ id: string }> = {
            id: 'async-renderer',
            renderSurface: context => new Promise<PageSurface>(resolve => {
                pending.set(context.id, resolve)
            }),
        }
        const compositor: PageCompositor<PageSurface, undefined, string> = {
            id: 'async-compositor',
            compose: surface => {
                composed.push(surface.id)
                return `composed:${surface.id}`
            },
        }
        const controller = new PageSurfaceController({ contentRenderer, compositor })

        const first = controller.render({ id: 'first' }) as Promise<PageSurfaceComposeOutcome<PageSurface, string> | null>
        const second = controller.render({ id: 'second' }) as Promise<PageSurfaceComposeOutcome<PageSurface, string> | null>

        pending.get('second')?.(createSurface('second'))
        await expect(second).resolves.toMatchObject({ result: 'composed:second' })
        expect(controller.getCurrentSurface()?.id).toBe('second')

        pending.get('first')?.(createSurface('first', destroyed))
        await expect(first).resolves.toBeNull()

        expect(composed).toEqual(['second'])
        expect(destroyed).toHaveBeenCalledTimes(1)
        expect(controller.getCurrentSurface()?.id).toBe('second')
    })

    it('clears the compositor and cancels pending surface renders', async () => {
        let resolveSurface!: (surface: PageSurface) => void
        const destroyed = vi.fn()
        const clear = vi.fn()
        const contentRenderer: ContentRenderer<void> = {
            id: 'clear-renderer',
            renderSurface: () => new Promise<PageSurface>(resolve => {
                resolveSurface = resolve
            }),
        }
        const compositor: PageCompositor<PageSurface> = {
            id: 'clear-compositor',
            compose: vi.fn(),
            clear,
        }
        const controller = new PageSurfaceController({ contentRenderer, compositor })

        const render = controller.render(undefined) as Promise<PageSurfaceComposeOutcome<PageSurface> | null>
        controller.clear()
        resolveSurface(createSurface('stale', destroyed))

        await expect(render).resolves.toBeNull()
        expect(clear).toHaveBeenCalledTimes(1)
        expect(compositor.compose).not.toHaveBeenCalled()
        expect(destroyed).toHaveBeenCalledTimes(1)
        expect(controller.getCurrentSurface()).toBeNull()
    })

    it('destroys surfaces when an asynchronous compositor result becomes stale', async () => {
        let resolveCompose!: (value: string) => void
        const destroyed = vi.fn()
        const firstSurface = createSurface('first', destroyed)
        const secondSurface = createSurface('second')
        const contentRenderer: ContentRenderer<{ surface: PageSurface }> = {
            id: 'async-compositor-renderer',
            renderSurface: context => context.surface,
        }
        const compositor: PageCompositor<PageSurface, undefined, string> = {
            id: 'async-compositor',
            compose: surface => surface.id === 'first'
                ? new Promise(resolve => { resolveCompose = resolve })
                : `composed:${surface.id}`,
        }
        const controller = new PageSurfaceController({ contentRenderer, compositor })

        const first = controller.render({ surface: firstSurface }) as Promise<PageSurfaceComposeOutcome<PageSurface, string> | null>
        const second = controller.render({ surface: secondSurface })
        resolveCompose('composed:first')

        expect(second).toMatchObject({ surface: secondSurface, result: 'composed:second' })
        await expect(first).resolves.toBeNull()
        expect(destroyed).toHaveBeenCalledTimes(1)
        expect(controller.getCurrentSurface()).toBe(secondSurface)
    })

    it('decorates surfaces before composing them', () => {
        const base = createSurface('base')
        const contentRenderer: ContentRenderer<void> = {
            id: 'decorated-renderer',
            renderSurface: () => base,
        }
        const compositor: PageCompositor<PageSurface, undefined, string> = {
            id: 'decorated-compositor',
            compose: surface => `layers:${surface.layers.length}`,
        }
        const controller = new PageSurfaceController({
            contentRenderer,
            compositor,
            decorators: [{
                id: 'append-layer',
                decorate: surface => ({
                    ...surface,
                    layers: [
                        ...surface.layers,
                        { id: 'overlay', kind: 'overlay', contentKind: 'custom', content: {} },
                    ],
                }),
            }],
        })

        const result = controller.render(undefined)

        expect(result).toMatchObject({ result: 'layers:1' })
        expect(controller.getCurrentSurface()?.layers.map(layer => layer.id)).toEqual(['overlay'])
    })
})

function createSurface(id: string, destroy = vi.fn()): PageSurface {
    return {
        id,
        kind: 'fixed-page',
        width: 100,
        height: 100,
        scale: 1,
        layers: [],
        destroy,
    }
}
