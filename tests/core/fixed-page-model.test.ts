import { describe, expect, it } from 'vitest'
import type { FixedDocument, FixedPageInfo } from '../../src/core/fixed-document'
import {
    createFixedPageContentRenderContext,
    resolveFixedPageFit,
} from '../../src/core/fixed-page-model'

describe('fixed page model', () => {
    it('fits a fixed page to the available inline viewport', () => {
        const page = createPage({ width: 600, height: 800 })
        const fit = resolveFixedPageFit(page, {
            inlineSize: 400,
            blockSize: 640,
        }, {
            defaultMargin: 32,
            devicePixelRatio: 2,
        })

        expect(fit).toMatchObject({
            margin: 32,
            availableInlineSize: 336,
            targetInlineSize: 336,
            scale: 0.56,
            viewport: {
                pageIndex: 0,
                scale: 0.56,
                devicePixelRatio: 2,
                pixelWidth: 672,
                pixelHeight: 896,
            },
        })
        expect(fit.viewport.cssWidth).toBeCloseTo(336)
        expect(fit.viewport.cssHeight).toBeCloseTo(448)
    })

    it('honors explicit margin, max inline size, and scale bounds', () => {
        const page = createPage({ width: 200, height: 300 })
        const fit = resolveFixedPageFit(page, {
            inlineSize: 1000,
            blockSize: 700,
        }, {
            margin: '40px',
            maxInlineSize: '300px',
            minScale: 1.75,
            maxScale: 3,
        })

        expect(fit.margin).toBe(40)
        expect(fit.availableInlineSize).toBe(920)
        expect(fit.targetInlineSize).toBe(300)
        expect(fit.scale).toBe(1.75)
        expect(fit.viewport.cssWidth).toBe(350)
    })

    it('uses max column width as the fixed page inline cap', () => {
        const page = createPage({ width: 612, height: 792 })
        const fit = resolveFixedPageFit(page, {
            inlineSize: 1400,
            blockSize: 900,
        }, {
            margin: '32px',
            maxColumnWidth: '720px',
        })

        expect(fit.availableInlineSize).toBe(1336)
        expect(fit.targetInlineSize).toBe(720)
        expect(fit.scale).toBeCloseTo(720 / 612)
        expect(fit.viewport.cssWidth).toBeCloseTo(720)
    })

    it('normalizes invalid fit options defensively', () => {
        const page = createPage({ width: 500, height: 250 })
        const fit = resolveFixedPageFit(page, {
            inlineSize: 0,
            blockSize: 0,
        }, {
            margin: 'invalid',
            defaultMargin: 12,
            maxInlineSize: 'invalid',
            devicePixelRatio: -1,
        })

        expect(fit.margin).toBe(12)
        expect(fit.availableInlineSize).toBe(1)
        expect(fit.targetInlineSize).toBe(1)
        expect(fit.scale).toBe(0.002)
        expect(fit.viewport.devicePixelRatio).toBe(1)
    })

    it('creates platform-neutral fixed content render contexts', () => {
        const document: FixedDocument = {
            kind: 'fixed-document',
            format: 'pdf',
            pageCount: 1,
            getPage: () => createPage(),
        }
        const page = createPage()
        const fit = resolveFixedPageFit(page, { inlineSize: 320, blockSize: 480 })
        const context = createFixedPageContentRenderContext(document, page, { color: '#222222' }, fit)

        expect(context).toMatchObject({
            document,
            page,
            scale: fit.scale,
            viewport: fit.viewport,
            styles: { color: '#222222' },
        })
    })
})

function createPage(overrides: Partial<FixedPageInfo> = {}): FixedPageInfo {
    return {
        index: 0,
        width: 600,
        height: 800,
        ...overrides,
    }
}
