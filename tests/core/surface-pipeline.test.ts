import { describe, expect, it } from 'vitest'
import type {
    ContentRenderer,
    PageCompositor,
    PageSurface,
    PageSurfaceRequest,
} from '../../src/core/page-surface'
import { createPageSurfacePipeline } from '../../src/core/surface-pipeline'

describe('PageSurfacePipeline', () => {
    it('runs content renderers, decorators, marks, and compositors through one core pipeline', () => {
        const requests: (PageSurfaceRequest | undefined)[] = []
        const targets: ({ slot: string } | undefined)[] = []
        const contentRenderer: ContentRenderer<{ id: string }> = {
            id: 'pipeline-content',
            renderSurface: (context, request) => {
                requests.push(request)
                return createSurface(`${context.id}:${request?.pageIndex ?? 'none'}`, request?.scale ?? 1)
            },
        }
        const compositor: PageCompositor<PageSurface, { slot: string }, string> = {
            id: 'pipeline-compositor',
            compose: (surface, target) => {
                targets.push(target)
                return `${target?.slot}:${surface.id}:${surface.layers.map(layer => layer.id).join(',')}`
            },
        }
        const pipeline = createPageSurfacePipeline({
            contentRenderer,
            compositor,
            createDecorators: ({ getMarks }) => [{
                id: 'mark-layer',
                decorate: surface => ({
                    ...surface,
                    layers: [
                        ...surface.layers,
                        {
                            id: `marks:${getMarks().map(mark => mark.id).join('|')}`,
                            kind: 'annotation',
                            contentKind: 'custom',
                            content: {},
                        },
                    ],
                }),
            }],
        })

        pipeline.setMark({
            id: 'highlight-1',
            kind: 'highlight',
            location: { type: 'fixed', format: 'pdf', pageIndex: 2 },
        })

        const result = pipeline.render(
            { id: 'surface' },
            { slot: 'viewport' },
            { pageIndex: 2, scale: 1.5, reason: 'test' },
        )

        expect(result).toMatchObject({
            result: 'viewport:surface:2:marks:highlight-1',
            surface: {
                id: 'surface:2',
                scale: 1.5,
            },
        })
        expect(requests).toEqual([{ pageIndex: 2, scale: 1.5, reason: 'test' }])
        expect(targets).toEqual([{ slot: 'viewport' }])
        expect(pipeline.getCurrentSurface()?.layers.map(layer => layer.id)).toEqual(['marks:highlight-1'])
    })
})

function createSurface(id: string, scale: number): PageSurface {
    return {
        id,
        kind: 'fixed-page',
        width: 100,
        height: 100,
        scale,
        layers: [],
    }
}
