import { readFile } from 'node:fs/promises'
import { parseHTML } from 'linkedom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Book, RelocateEvent } from '../../src/core/types'
import type { EventListener, LayoutMode, ReaderMark, Renderer, RendererStyles } from '../../src/core/renderer'
import type { TOCViewItem } from '../../src/core/reader'
import type { LineRange } from '../../src/core/pretext'
import { NodeDOMAdapter, NodeURLFactory } from '../../src/adapters/node'
import { epub } from '../../src/parsers/epub'
import { mobi } from '../../src/parsers/mobi'
import { CBZParser } from '../../src/parsers/cbz'
import { PDFParser } from '../../src/parsers/pdf'
import { withTrialLimit } from '../../src/plugins/trial-limit'
import {
    createReader,
    BrowserAdaptiveRenderer,
    BrowserFixedContentRenderer,
    BrowserPageCompositor,
    BrowserRenderer,
    BrowserReflowableContentRenderer,
    BrowserSurfaceHost,
    BrowserSurfacePipeline,
    BrowserViewportHost,
    ReaderView,
    matchesBrowserFixedContent,
    matchesBrowserReflowableContent,
} from '../../src/renderers/browser'
import { makeSimplePdf } from '../fixtures/pdf-fixture'
import { createTestCBZ } from '../fixtures/cbz-fixture'

class MockResizeObserver {
    observe() {}
    disconnect() {}
}

interface TestCanvasLike {
    width: number
    height: number
}

function createTestCanvasContext(canvas: TestCanvasLike) {
    const gradient = { addColorStop() {} }
    const context = {
        canvas,
        font: '16px serif',
        fillStyle: '#000000',
        strokeStyle: '#000000',
        globalAlpha: 1,
        globalCompositeOperation: 'source-over',
        lineWidth: 1,
        lineCap: 'butt',
        lineJoin: 'miter',
        miterLimit: 10,
        lineDashOffset: 0,
        save() {},
        restore() {},
        clearRect() {},
        fillRect() {},
        setTransform() {},
        transform() {},
        scale() {},
        translate() {},
        rotate() {},
        beginPath() {},
        moveTo() {},
        lineTo() {},
        bezierCurveTo() {},
        closePath() {},
        rect() {},
        clip() {},
        fill() {},
        stroke() {},
        setLineDash() {},
        drawImage() {},
        putImageData() {},
        fillText() {},
        strokeText() {},
        createLinearGradient: () => gradient,
        createRadialGradient: () => gradient,
        measureText(text: string) {
            const fontSize = Number(context.font.match(/([\d.]+)px/)?.[1] ?? 16)
            return {
                width: Array.from(text).length * fontSize * 0.54,
                fontBoundingBoxAscent: fontSize * 0.8,
                fontBoundingBoxDescent: fontSize * 0.2,
            }
        },
    }
    return context
}

beforeEach(() => {
    const { window } = parseHTML('<!doctype html><html><body></body></html>')
    vi.stubGlobal('window', window)
    vi.stubGlobal('document', window.document)
    vi.stubGlobal('HTMLElement', window.HTMLElement)
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    vi.stubGlobal('OffscreenCanvas', class {
        width: number
        height: number

        constructor(width = 1, height = 1) {
            this.width = width
            this.height = height
        }

        getContext(type: string) {
            return type === '2d' ? createTestCanvasContext(this) : null
        }
    })
    vi.stubGlobal('ImageData', class {
        data: Uint8ClampedArray
        width: number
        height: number

        constructor(data: Uint8ClampedArray, width: number, height: number) {
            this.data = data
            this.width = width
            this.height = height
        }
    })

    const canvasPrototype = Object.getPrototypeOf(window.document.createElement('canvas')) as {
        getContext?: (type: string) => unknown
    }
    Object.defineProperty(canvasPrototype, 'getContext', {
        configurable: true,
        value(this: TestCanvasLike, type: string) {
            return type === '2d' ? createTestCanvasContext(this) : null
        },
    })

    Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', {
        configurable: true,
        get() { return Number(this.getAttribute('data-width')) || 800 },
    })
    Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', {
        configurable: true,
        get() { return Number(this.getAttribute('data-height')) || 120 },
    })
    Object.defineProperty(window.HTMLElement.prototype, 'scrollHeight', {
        configurable: true,
        get() {
            const child = this.firstElementChild as HTMLElement | null
            return parseFloat(child?.style.height || this.style.height || '') || this.clientHeight
        },
    })
})

describe('BrowserRenderer', () => {
    it('provides a shared browser viewport host for surface renderers', () => {
        const container = document.createElement('div')
        const host = new BrowserViewportHost({
            container,
            kind: 'reflowable',
            styles: { color: '#222222', background: '#fafafa' },
        })

        host.setOverflowForLayout('paginated')
        host.setScrollExtentHeight(480)

        expect(container.firstElementChild).toBe(host.scroller)
        expect(host.scroller.dataset.rebookViewportScroller).toBe('true')
        expect(host.scroller.style.color).toBe('#222222')
        expect(host.scroller.style.background).toBe('#fafafa')
        expect(host.scroller.style.overflow).toBe('hidden')
        expect(host.scrollExtent.style.height).toBe('480px')
        expect(host.surfaceHost.parentElement).toBe(host.scrollExtent)

        host.destroy()
        expect(container.children.length).toBe(0)
    })

    it('combines the browser viewport and compositor into a reusable surface host', () => {
        const container = document.createElement('div')
        const content = document.createElement('div')
        content.textContent = 'hosted surface'
        const host = new BrowserSurfaceHost({
            container,
            kind: 'fixed',
        })

        const result = host.compose({
            id: 'surface-host-1',
            kind: 'image-page',
            pageIndex: 1,
            width: 120,
            height: 80,
            scale: 1,
            layers: [{
                id: 'content',
                kind: 'content',
                contentKind: 'dom',
                content,
            }],
        })

        expect(host.scroller.dataset.rebookViewportScroller).toBe('true')
        expect(host.surfaceHost.querySelector('[data-rebook-page-surface="true"]')).toBe(result.frame)
        expect(result.frame.dataset.rebookFixedPage).toBe('true')
        host.clear()
        expect(host.surfaceHost.children.length).toBe(0)
        host.destroy()
        expect(container.children.length).toBe(0)
    })

    it('composes page surfaces into layered browser DOM', () => {
        const host = document.createElement('div')
        const content = document.createElement('div')
        content.textContent = 'surface content'

        const compositor = new BrowserPageCompositor({ host })
        const result = compositor.compose({
            id: 'surface-1',
            kind: 'fixed-page',
            pageIndex: 3,
            width: 200,
            height: 100,
            scale: 2,
            layers: [{
                id: 'content',
                kind: 'content',
                contentKind: 'dom',
                content,
                selectable: false,
            }],
        })

        expect(result.frame.dataset.rebookPageSurface).toBe('true')
        expect(result.frame.dataset.rebookFixedPage).toBe('true')
        expect(result.frame.dataset.pageIndex).toBe('3')
        expect(result.frame.style.width).toBe('400px')
        expect(content.dataset.rebookSurfaceLayer).toBe('content')
        expect(content.style.transform).toBe('scale(2)')

        compositor.destroy()
        expect(host.children.length).toBe(0)
    })

    it('runs browser content surfaces through a shared pipeline', async () => {
        const host = document.createElement('div')
        const compositor = new BrowserPageCompositor({ host })
        const pipeline = new BrowserSurfacePipeline<{ text: string }>({
            compositor,
            contentRenderer: {
                id: 'test-content',
                renderSurface(context) {
                    const content = document.createElement('div')
                    content.textContent = context.text
                    return {
                        id: 'pipeline-surface',
                        kind: 'fixed-page',
                        pageIndex: 0,
                        width: 120,
                        height: 80,
                        scale: 1,
                        layers: [{
                            id: 'content',
                            kind: 'content',
                            contentKind: 'dom',
                            content,
                        }],
                    }
                },
            },
            createDecorators: ({ getMarks }) => [{
                id: 'test-mark-decorator',
                decorate(surface) {
                    const marks = getMarks()
                    if (!marks.length) return surface
                    const overlay = document.createElement('div')
                    overlay.dataset.markCount = String(marks.length)
                    overlay.textContent = marks.map(mark => mark.id).join(',')
                    return {
                        ...surface,
                        layers: [
                            ...surface.layers,
                            {
                                id: 'marks',
                                kind: 'annotation',
                                contentKind: 'dom',
                                content: overlay,
                            },
                        ],
                    }
                },
            }],
        })

        pipeline.setMark({
            id: 'm1',
            kind: 'highlight',
            location: { type: 'fixed', format: 'pdf', pageIndex: 0 },
        })
        const result = await pipeline.render({ text: 'Pipeline text' })

        expect(result?.surface).toBe(pipeline.getCurrentSurface())
        expect(host.querySelector('[data-rebook-surface-layer="content"]')?.textContent).toBe('Pipeline text')
        expect(host.querySelector('[data-rebook-surface-layer="marks"]')?.textContent).toBe('m1')
        expect((host.querySelector('[data-rebook-surface-layer="marks"]') as HTMLElement | null)?.dataset.markCount).toBe('1')

        pipeline.destroy()
        expect(host.children.length).toBe(0)
    })

    it('exposes fixed page text through PageSurface text providers', async () => {
        const renderer = new BrowserFixedContentRenderer({
            visualRenderers: [{
                id: 'fixed-test-visual',
                match: () => true,
                renderLayer: () => {
                    const content = document.createElement('div')
                    content.dataset.fixedVisual = 'true'
                    return { id: 'content', kind: 'content', contentKind: 'dom', content }
                },
            }],
        })
        const surface = await renderer.renderSurface({
            document: {
                kind: 'fixed-document',
                format: 'pdf',
                pageCount: 1,
                getPage: () => ({ index: 0, width: 300, height: 144 }),
                getPageText: () => ({
                    pageIndex: 0,
                    width: 300,
                    height: 144,
                    text: 'Surface text provider',
                    runs: [{
                        text: 'Surface text provider',
                        transform: [18, 0, 0, 18, 48, 72],
                        fontSize: 18,
                        width: 180,
                    }],
                }),
            },
            page: { index: 0, width: 300, height: 144 },
            scale: 1,
            styles: {},
        })

        const chunks = await surface.textProvider!.getText()
        const results = await surface.textProvider!.search!('provider')

        expect(chunks[0]).toMatchObject({
            text: 'Surface text provider',
            location: { type: 'fixed', format: 'pdf', pageIndex: 0 },
        })
        expect(chunks[0].rects?.[0]).toMatchObject({ x: 48, y: 54, width: 180, height: 18 })
        expect(results[0].range.start).toMatchObject({ type: 'fixed', format: 'pdf', pageIndex: 0 })
        expect(await surface.textProvider!.getText({
            start: { type: 'fixed', format: 'pdf', pageIndex: 1 },
        })).toHaveLength(0)

        surface.destroy?.()
        renderer.destroy()
    })

    it('exposes reflowable page text through PageSurface text providers', async () => {
        const renderer = new BrowserReflowableContentRenderer()
        const line: LineRange = {
            index: 0,
            kind: 'text',
            block: {
                id: 'p1',
                type: 'paragraph',
                segments: [{ text: 'Reader core text provider' }],
            },
            start: { segmentIndex: 0, cursor: { segmentIndex: 0, graphemeIndex: 0 } },
            end: { segmentIndex: 0, cursor: { segmentIndex: 0, graphemeIndex: 25 } },
            text: 'Reader core text provider',
            width: 180,
            top: 12,
            height: 24,
            segments: [],
        }
        const surface = renderer.renderSurface({
            sectionIndex: 2,
            pageIndex: 0,
            layoutMode: 'paginated',
            layout: {
                margin: 16,
                gap: 24,
                columnWidth: 260,
                columns: 1,
                pageHeight: 120,
                columnHeight: 88,
                pagePaddingBlock: 16,
                totalHeight: 120,
                pageCount: 1,
            },
            lines: [line],
            prepared: null,
            styles: {},
            baseTextStyle: { fontFamily: 'serif', fontSize: 16, lineHeight: 1.5 },
            lineHeightPixels: 24,
            sourceScrollTop: 0,
            sourceViewportHeight: 120,
            surfaceWidth: 260,
            surfaceHeight: 120,
        })

        const chunks = await surface.textProvider!.getText()
        const scoped = await surface.textProvider!.getText({
            start: { type: 'reflowable', sectionIndex: 2, blockId: 'p1', offset: 4 },
            end: { type: 'reflowable', sectionIndex: 2, blockId: 'p1', offset: 10 },
        })
        const results = await surface.textProvider!.search!('core')

        expect(chunks[0]).toMatchObject({
            id: 'reflowable:2:line:0',
            text: 'Reader core text provider',
            location: { type: 'reflowable', sectionIndex: 2, blockId: 'p1', offset: 0 },
        })
        expect(chunks[0].rects?.[0]).toMatchObject({ x: 0, y: 28, width: 180, height: 24 })
        expect(scoped).toHaveLength(1)
        expect(results[0].range.start).toMatchObject({ type: 'reflowable', sectionIndex: 2, blockId: 'p1' })
        expect(surface.metadata?.sectionIndex).toBe(2)
        expect((surface.metadata?.lines as readonly LineRange[] | undefined)?.[0]).toBe(line)
        expect((surface.layers[0].content as HTMLElement).querySelector('[data-rebook-line-index="0"]')).toBeTruthy()

        surface.destroy?.()
    })

    it('renders only visible Pretext line ranges into minimal DOM rows', async () => {
        const container = document.createElement('div')
        container.setAttribute('data-width', '360')
        container.setAttribute('data-height', '72')
        document.body.appendChild(container)

        const text = Array.from({ length: 80 }, (_, index) => `word${index}`).join(' ')
        const book: Book = {
            sections: [{
                id: 'chapter.xhtml',
                size: text.length,
                format: 'xhtml',
                load: () => `<p>${text}</p>`,
                getBlocks: () => [{
                    id: 'chapter-body',
                    type: 'paragraph',
                    segments: [{ text }],
                }],
            }],
        }

        const renderer = new BrowserRenderer({
            container,
            styles: { fontSize: '16px', lineHeight: 1.5, maxInlineSize: '260px' },
        })
        let loadedLines = 0
        renderer.on('load', event => {
            loadedLines = (event.doc as { lines: unknown[] }).lines.length
        })

        await renderer.open(book)
        await renderer.goTo(0)

        expect(container.querySelector('[data-rebook-page-surface="true"]')).toBeTruthy()
        expect(container.querySelector('[data-rebook-surface-kind="reflowable-page"]')).toBeTruthy()
        expect(container.querySelector('[data-rebook-reflowable-content-layer="true"]')).toBeTruthy()
        const renderedRows = container.querySelectorAll('span').length
        expect(loadedLines).toBeGreaterThan(5)
        expect(renderedRows).toBeGreaterThan(0)
        expect(renderedRows).toBeLessThan(loadedLines)
        expect(container.textContent).toContain('word0')

        renderer.destroy()
    })

    it('renders reader marks as classes on matching browser lines', async () => {
        const container = document.createElement('div')
        container.setAttribute('data-width', '360')
        container.setAttribute('data-height', '96')
        document.body.appendChild(container)

        const book: Book = {
            sections: [{
                id: 'chapter.xhtml',
                size: 48,
                format: 'xhtml',
                load: () => '',
                getBlocks: () => [{
                    id: 'p1',
                    type: 'paragraph',
                    segments: [{ text: 'Marked text should receive a renderer class.' }],
                }],
            }],
        }

        const renderer = new BrowserRenderer({
            container,
            styles: { fontSize: '16px', lineHeight: 1.5, maxInlineSize: '260px' },
        })

        await renderer.open(book)
        await renderer.goTo(0)
        renderer.setMark({
            id: 'current',
            kind: 'tts',
            location: {
                start: { type: 'reflowable', sectionIndex: 0, blockId: 'p1', offset: 0 },
                end: { type: 'reflowable', sectionIndex: 0, blockId: 'p1', offset: 12 },
            },
            className: 'is-current',
            data: { segmentId: 's1' },
        })

        const markedLine = container.querySelector('.is-current') as HTMLElement | null
        expect(markedLine?.dataset.blockId).toBe('p1')
        expect(markedLine?.classList.contains('is-current')).toBe(true)
        expect(markedLine?.classList.contains('rebook-mark-tts')).toBe(true)
        expect(markedLine?.dataset.markSegmentId).toBe('s1')

        renderer.removeMark('current')
        expect(container.querySelector('.is-current')).toBeNull()

        renderer.destroy()
    })

    it('is the default createReader browser renderer', async () => {
        const container = document.createElement('div')
        container.setAttribute('data-width', '360')
        container.setAttribute('data-height', '72')
        document.body.appendChild(container)

        const book: Book = {
            sections: [{
                id: 'chapter.xhtml',
                size: 20,
                format: 'xhtml',
                load: () => '<p>Hello browser</p>',
                getBlocks: () => [{
                    id: 'chapter-heading',
                    type: 'chapter',
                    segments: [{ text: 'Hello browser' }],
                }],
            }],
        }

        const reader = createReader({ container })
        await reader.openBook(book)
        await reader.goTo(0)

        expect(container.querySelector('[data-rebook-surface-kind="reflowable-page"]')).toBeTruthy()
        expect(container.querySelector('[data-block-type="chapter"]')).toBeDefined()
        expect(container.querySelector('iframe')).toBeNull()
        expect(reader.getCurrentSurface()).toMatchObject({ kind: 'reflowable-page', pageIndex: 0 })
        expect((await reader.getCurrentText())[0]).toMatchObject({
            text: 'Hello browser',
            location: { type: 'reflowable', sectionIndex: 0, blockId: 'chapter-heading' },
        })
        expect((await reader.searchCurrentText('browser'))[0].range.start)
            .toMatchObject({ type: 'reflowable', sectionIndex: 0, blockId: 'chapter-heading' })

        reader.destroy()
    })

    it('routes fixed books to the configured fixed renderer', async () => {
        const container = document.createElement('div')
        container.setAttribute('data-width', '360')
        container.setAttribute('data-height', '72')
        document.body.appendChild(container)

        const fixedRenderer = new FakeFixedRenderer()
        const book: Book = {
            sections: [],
            rendition: { layout: 'pre-paginated' },
            fixedDocument: {
                kind: 'fixed-document',
                format: 'pdf',
                pageCount: 1,
                getPage: () => ({ index: 0, width: 600, height: 800 }),
            },
        }

        const reader = createReader({
            container,
            createFixedContentEngine: () => fixedRenderer,
        })
        await reader.openBook(book)

        expect(fixedRenderer.opened).toBe(1)
        expect(fixedRenderer.book).toBe(book)
        expect(container.children.length).toBe(0)

        reader.destroy()
    })

    it('routes reflowable books to the configured reflowable renderer', async () => {
        const container = document.createElement('div')
        container.setAttribute('data-width', '360')
        container.setAttribute('data-height', '72')
        document.body.appendChild(container)

        const reflowableRenderer = new FakeFixedRenderer()
        const book: Book = {
            sections: [{
                id: 'chapter.xhtml',
                size: 22,
                format: 'xhtml',
                load: () => '<p>Route me</p>',
            }],
        }

        const reader = createReader({
            container,
            createReflowableContentEngine: () => reflowableRenderer,
        })
        await reader.openBook(book)

        expect(reflowableRenderer.opened).toBe(1)
        expect(reflowableRenderer.book).toBe(book)
        expect(container.children.length).toBe(0)

        reader.destroy()
    })

    it('lets custom browser content engine routes override default format routes', async () => {
        const container = document.createElement('div')
        container.setAttribute('data-width', '360')
        container.setAttribute('data-height', '72')
        document.body.appendChild(container)

        const routedRenderer = new FakeFixedRenderer()
        const book: Book = {
            metadata: { renderer: 'custom-route' },
            sections: [{
                id: 'chapter.xhtml',
                size: 24,
                format: 'xhtml',
                load: () => '<p>Custom route</p>',
            }],
        }

        const reader = createReader({
            container,
            contentEngineRoutes: [{
                id: 'custom-route',
                match: item => item.metadata?.renderer === 'custom-route' ? 100 : false,
                createEngine: ({ hooks }) => {
                    expect(typeof hooks?.beforeNavigate).toBe('function')
                    return routedRenderer
                },
            }],
        })
        await reader.openBook(book)

        expect(routedRenderer.opened).toBe(1)
        expect(routedRenderer.book).toBe(book)
        expect(container.children.length).toBe(0)

        reader.destroy()
    })

    it('uses one adaptive browser renderer for default ReaderView content engines', () => {
        class InspectableReaderView extends ReaderView {
            getRendererForTest(): Renderer {
                return this.getRenderer()
            }
        }

        const container = document.createElement('div')
        container.setAttribute('data-width', '360')
        container.setAttribute('data-height', '72')
        document.body.appendChild(container)

        const reader = new InspectableReaderView({ container })

        expect(reader.getRendererForTest()).toBeInstanceOf(BrowserAdaptiveRenderer)

        reader.destroy()
    })

    it('selects browser content engines and replays reader state', async () => {
        const fixed = new FakeFixedRenderer()
        const reflowable = new FakeFixedRenderer()
        const adaptive = new BrowserAdaptiveRenderer({
            routes: [
                { id: 'fixed', match: matchesBrowserFixedContent, createEngine: () => fixed },
                { id: 'reflowable', match: matchesBrowserReflowableContent, createEngine: () => reflowable },
            ],
        })
        const listener: EventListener = () => {}
        const mark: ReaderMark = {
            id: 'current',
            kind: 'highlight',
            location: { type: 'reflowable', sectionIndex: 0 },
        }
        const fixedBook: Book = {
            sections: [],
            fixedDocument: {
                kind: 'fixed-document',
                format: 'pdf',
                pageCount: 1,
                getPage: () => ({ index: 0, width: 320, height: 480 }),
            },
        }
        const reflowableBook: Book = {
            sections: [{
                id: 'chapter.xhtml',
                size: 12,
                load: () => '<p>Flow</p>',
            }],
        }

        adaptive.on('relocate', listener)
        adaptive.setStyles({ fontSize: '18px' })
        adaptive.setLayout('scrolled')
        adaptive.setSpread(1)
        adaptive.setMark(mark)

        await adaptive.open(fixedBook)
        expect(adaptive.getActiveEngineId()).toBe('fixed')
        expect(fixed.opened).toBe(1)
        expect(fixed.book).toBe(fixedBook)
        expect(fixed.styles).toEqual({ fontSize: '18px' })
        expect(fixed.layout).toBe('scrolled')
        expect(fixed.spread).toBe(1)
        expect(fixed.getMarks()).toEqual([mark])
        expect(fixed.listeners.get('relocate')?.has(listener)).toBe(true)

        await adaptive.open(reflowableBook)
        expect(adaptive.getActiveEngineId()).toBe('reflowable')
        expect(fixed.destroyed).toBe(1)
        expect(reflowable.opened).toBe(1)
        expect(reflowable.book).toBe(reflowableBook)
        expect(reflowable.styles).toEqual({ fontSize: '18px' })
        expect(reflowable.getMarks()).toEqual([mark])
        expect(reflowable.listeners.get('relocate')?.has(listener)).toBe(true)

        adaptive.destroy()
    })

    it('renders fixed-document books with the built-in browser fixed renderer', async () => {
        const container = document.createElement('div')
        container.setAttribute('data-width', '360')
        container.setAttribute('data-height', '160')
        document.body.appendChild(container)

        const book: Book = {
            sections: [],
            pageList: [
                { label: '1', href: 'pdf:page:0' },
                { label: '2', href: 'pdf:page:1' },
            ],
            fixedDocument: {
                kind: 'fixed-document',
                format: 'pdf',
                pageCount: 2,
                getPage: pageIndex => ({ index: pageIndex, width: 300, height: 144 }),
                getPages: () => [
                    { index: 0, width: 300, height: 144 },
                    { index: 1, width: 300, height: 144 },
                ],
                getPageText: pageIndex => ({
                    pageIndex,
                    width: 300,
                    height: 144,
                    text: `Fixed page ${pageIndex + 1}`,
                    runs: [{
                        text: `Fixed page ${pageIndex + 1}`,
                        transform: [18, 0, 0, 18, 48, 48],
                        fontSize: 18,
                        width: 120,
                    }],
                }),
            },
            resolveHref: href => {
                const match = href.match(/^pdf:page:(\d+)$/)
                return match ? { index: Number(match[1]) } : null
            },
        }

        const reader = createReader({ container })
        let location: RelocateEvent | null = null
        reader.on('relocate', event => { location = event })

        await reader.openBook(book)
        expect(container.querySelector('[data-rebook-page-surface="true"]')).toBeTruthy()
        expect(container.querySelector('[data-rebook-surface-layer="text"]')).toBeTruthy()
        expect(container.querySelector('[data-rebook-fixed-page="true"]')).toBeTruthy()
        expect(container.querySelector('[data-rebook-fixed-text-layer="true"]')).toBeTruthy()
        expect(container.textContent).toContain('Fixed page 1')
        expect(location?.pageItem?.label).toBe('1')
        expect(reader.getCurrentSurface()).toMatchObject({ kind: 'fixed-page', pageIndex: 0 })
        expect((await reader.getCurrentText())[0]).toMatchObject({
            text: 'Fixed page 1',
            location: { type: 'fixed', format: 'pdf', pageIndex: 0 },
        })
        expect((await reader.searchCurrentText('page 1'))[0].range.start)
            .toMatchObject({ type: 'fixed', format: 'pdf', pageIndex: 0 })

        reader.setMark({
            id: 'fixed-highlight',
            kind: 'highlight',
            location: {
                type: 'fixed',
                format: 'pdf',
                pageIndex: 0,
                rect: { x: 30, y: 24, width: 90, height: 18 },
            },
            data: { color: 'rgba(0, 128, 255, 0.25)' },
        })
        await reader.refresh()

        const annotation = container.querySelector('[data-rebook-annotation="true"]') as HTMLElement | null
        expect(container.querySelector('[data-rebook-annotation-layer="true"]')).toBeTruthy()
        expect(annotation?.dataset.markId).toBe('fixed-highlight')
        expect(annotation?.dataset.markColor).toBe('rgba(0, 128, 255, 0.25)')
        expect(annotation?.classList.contains('rebook-mark-highlight')).toBe(true)
        expect(annotation?.style.left).toBe('30px')
        expect(annotation?.style.top).toBe('24px')
        expect(annotation?.style.width).toBe('90px')

        await reader.next()
        expect(container.textContent).toContain('Fixed page 2')
        expect(reader.getLocation()?.pageItem?.label).toBe('2')
        expect(reader.getCurrentSurface()).toMatchObject({ kind: 'fixed-page', pageIndex: 1 })
        expect((await reader.getCurrentText())[0]).toMatchObject({
            text: 'Fixed page 2',
            location: { type: 'fixed', format: 'pdf', pageIndex: 1 },
        })
        expect(container.querySelector('[data-rebook-annotation="true"]')).toBeNull()

        reader.destroy()
    })

    it('renders fixed-document spreads when the viewport is wide enough', async () => {
        const container = document.createElement('div')
        container.setAttribute('data-width', '980')
        container.setAttribute('data-height', '220')
        document.body.appendChild(container)

        const book: Book = {
            sections: [],
            pageList: [
                { label: '1', href: 'pdf:page:0' },
                { label: '2', href: 'pdf:page:1' },
                { label: '3', href: 'pdf:page:2' },
            ],
            fixedDocument: {
                kind: 'fixed-document',
                format: 'pdf',
                pageCount: 3,
                getPage: pageIndex => ({ index: pageIndex, width: 300, height: 144 }),
                getPages: () => [
                    { index: 0, width: 300, height: 144 },
                    { index: 1, width: 300, height: 144 },
                    { index: 2, width: 300, height: 144 },
                ],
                getPageText: pageIndex => ({
                    pageIndex,
                    width: 300,
                    height: 144,
                    text: `Fixed page ${pageIndex + 1}`,
                    runs: [{
                        text: `Fixed page ${pageIndex + 1}`,
                        transform: [18, 0, 0, 18, 48, 48],
                        fontSize: 18,
                        width: 120,
                    }],
                }),
            },
            resolveHref: href => {
                const match = href.match(/^pdf:page:(\d+)$/)
                return match ? { index: Number(match[1]) } : null
            },
        }

        const reader = createReader({
            container,
            maxColumnCount: 2,
            styles: { margin: '32px', gap: '32px', minColumnWidth: '300px' },
        })
        await reader.openBook(book)

        expect(reader.getCurrentSurface()).toMatchObject({ kind: 'spread', pageIndex: 0 })
        expect(container.querySelectorAll('[data-rebook-spread-page="true"]')).toHaveLength(2)
        expect(container.textContent).toContain('Fixed page 1')
        expect(container.textContent).toContain('Fixed page 2')
        expect((await reader.getCurrentText()).map(chunk => chunk.text)).toEqual(['Fixed page 1', 'Fixed page 2'])

        await reader.next()
        expect(reader.getCurrentSurface()).toMatchObject({ kind: 'fixed-page', pageIndex: 2 })
        expect(container.textContent).toContain('Fixed page 3')
        expect(container.textContent).not.toContain('Fixed page 2')

        reader.setSpread(1)
        await reader.goTo(0)
        expect(reader.getCurrentSurface()).toMatchObject({ kind: 'fixed-page', pageIndex: 0 })
        expect(container.querySelectorAll('[data-rebook-spread-page="true"]')).toHaveLength(0)
        expect(container.textContent).toContain('Fixed page 1')
        expect(container.textContent).not.toContain('Fixed page 2')

        reader.destroy()
    })

    it('prewarms the next fixed page while idle after rendering the current page', async () => {
        vi.useFakeTimers()
        const container = document.createElement('div')
        container.setAttribute('data-width', '420')
        container.setAttribute('data-height', '520')
        document.body.appendChild(container)

        class RecordingFixedContentRenderer extends BrowserFixedContentRenderer {
            readonly prewarmed: number[] = []

            override async prewarmSurface(context: Parameters<BrowserFixedContentRenderer['prewarmSurface']>[0]): Promise<void> {
                if ('pages' in context) {
                    this.prewarmed.push(...context.pages.map(item => item.context.page.index))
                    return
                }
                this.prewarmed.push(context.page.index)
            }
        }

        const fixedContentRenderer = new RecordingFixedContentRenderer()
        const book: Book = {
            sections: [],
            pageList: [
                { label: '1', href: 'pdf:page:0' },
                { label: '2', href: 'pdf:page:1' },
                { label: '3', href: 'pdf:page:2' },
            ],
            fixedDocument: {
                kind: 'fixed-document',
                format: 'pdf',
                pageCount: 3,
                getPage: pageIndex => ({ index: pageIndex, width: 300, height: 420 }),
                getPages: () => [
                    { index: 0, width: 300, height: 420 },
                    { index: 1, width: 300, height: 420 },
                    { index: 2, width: 300, height: 420 },
                ],
                getPageText: pageIndex => ({
                    pageIndex,
                    width: 300,
                    height: 420,
                    text: `Fixed page ${pageIndex + 1}`,
                    runs: [{
                        text: `Fixed page ${pageIndex + 1}`,
                        transform: [18, 0, 0, 18, 48, 48],
                        fontSize: 18,
                    }],
                }),
            },
            resolveHref: href => {
                const match = href.match(/^pdf:page:(\d+)$/)
                return match ? { index: Number(match[1]) } : null
            },
        }

        const reader = createReader({ container, fixedContentRenderer })
        await reader.openBook(book)
        await vi.advanceTimersByTimeAsync(90)

        expect(fixedContentRenderer.prewarmed).toContain(1)

        await reader.next()
        await vi.advanceTimersByTimeAsync(90)

        expect(fixedContentRenderer.prewarmed).toContain(2)
        reader.destroy()
        vi.useRealTimers()
    })

    it('centers short fixed pages vertically and navigates with the wheel', async () => {
        const container = document.createElement('div')
        container.setAttribute('data-width', '420')
        container.setAttribute('data-height', '520')
        document.body.appendChild(container)

        const book: Book = {
            sections: [],
            pageList: [
                { label: '1', href: 'pdf:page:0' },
                { label: '2', href: 'pdf:page:1' },
            ],
            fixedDocument: {
                kind: 'fixed-document',
                format: 'pdf',
                pageCount: 2,
                getPage: pageIndex => ({ index: pageIndex, width: 300, height: 10 }),
                getPages: () => [
                    { index: 0, width: 300, height: 10 },
                    { index: 1, width: 300, height: 10 },
                ],
                getPageText: pageIndex => ({
                    pageIndex,
                    width: 300,
                    height: 10,
                    text: `Wheel page ${pageIndex + 1}`,
                    runs: [{
                        text: `Wheel page ${pageIndex + 1}`,
                        transform: [18, 0, 0, 18, 48, 48],
                        fontSize: 18,
                    }],
                }),
            },
            resolveHref: href => {
                const match = href.match(/^pdf:page:(\d+)$/)
                return match ? { index: Number(match[1]) } : null
            },
        }

        const reader = createReader({ container })
        await reader.openBook(book)

        const scroller = container.querySelector('[data-rebook-viewport-scroller="true"]') as HTMLElement
        const scrollExtent = scroller.firstElementChild as HTMLElement
        expect(scrollExtent.style.alignItems).toBe('center')

        const event = new window.Event('wheel', { bubbles: true, cancelable: true }) as WheelEvent
        Object.defineProperty(event, 'deltaY', { value: 120 })
        scroller.dispatchEvent(event)
        await new Promise(resolve => setTimeout(resolve, 0))

        expect(event.defaultPrevented).toBe(true)
        expect(reader.getLocation()?.pageItem?.label).toBe('2')
        expect(container.textContent).toContain('Wheel page 2')

        reader.destroy()
    })

    it('renders custom fixed formats through injected visual content renderers', async () => {
        const container = document.createElement('div')
        container.setAttribute('data-width', '360')
        container.setAttribute('data-height', '160')
        document.body.appendChild(container)

        const book: Book = {
            sections: [],
            fixedDocument: {
                kind: 'fixed-document',
                format: 'diagram',
                pageCount: 1,
                getPage: () => ({ index: 0, width: 240, height: 120 }),
                getPageText: () => ({
                    pageIndex: 0,
                    width: 240,
                    height: 120,
                    text: 'Diagram text',
                    runs: [{
                        text: 'Diagram text',
                        transform: [16, 0, 0, 16, 20, 40],
                        fontSize: 16,
                    }],
                }),
            },
        }

        const reader = createReader({
            container,
            fixedVisualRenderers: [{
                id: 'diagram-visual',
                match: document => document.format === 'diagram',
                renderLayer: () => {
                    const element = document.createElement('div')
                    element.dataset.diagramVisual = 'true'
                    element.textContent = 'Diagram visual'
                    return {
                        id: 'content',
                        kind: 'content',
                        contentKind: 'dom',
                        content: element,
                        selectable: false,
                        pointerEvents: 'none',
                    }
                },
            }],
        })
        await reader.openBook(book)

        expect(container.querySelector('[data-diagram-visual="true"]')).toBeTruthy()
        expect(container.querySelector('[data-rebook-surface-kind="fixed-page"]')).toBeTruthy()
        expect(container.querySelector('[data-rebook-surface-layer="text"]')).toBeTruthy()
        expect((container.querySelector('[data-rebook-fixed-text-layer="true"] span') as HTMLElement | null)?.style.color).toBe('transparent')
        expect(container.textContent).toContain('Diagram visual')
        expect(container.textContent).toContain('Diagram text')

        reader.destroy()
    })

    it('renders parsed PDF books through createReader without a custom renderer', async () => {
        const container = document.createElement('div')
        container.setAttribute('data-width', '360')
        container.setAttribute('data-height', '160')
        document.body.appendChild(container)

        const book = await new PDFParser().parse(makeSimplePdf().buffer)
        const reader = createReader({ container })
        await reader.openBook(book)

        expect(container.querySelector('[data-rebook-fixed-page="true"]')).toBeTruthy()
        expect(container.querySelector('[data-rebook-fixed-canvas="true"]')).toBeTruthy()
        expect((container.querySelector('[data-rebook-fixed-canvas="true"]') as HTMLElement | null)?.dataset.rebookFixedPainterBackend).toBe('canvas2d')
        expect((container.querySelector('[data-rebook-fixed-text-layer="true"] span') as HTMLElement | null)?.style.color).toBe('transparent')
        expect(container.textContent).toContain('Hello Rebook PDF')
        expect((reader.getCurrentSurface()?.metadata?.paint as { backend?: string; ms?: number } | undefined))
            .toMatchObject({ backend: 'canvas2d' })

        reader.destroy()
    })

    it('caps fixed PDF page width with maxColumnWidth in wide viewports', async () => {
        const container = document.createElement('div')
        container.setAttribute('data-width', '1000')
        container.setAttribute('data-height', '640')
        document.body.appendChild(container)

        const book = await new PDFParser().parse(makeSimplePdf().buffer)
        const reader = createReader({
            container,
            styles: {
                margin: '32px',
                maxColumnWidth: '360px',
            },
        })
        await reader.openBook(book)

        const frame = container.querySelector('[data-rebook-fixed-page="true"]') as HTMLElement | null
        const canvas = container.querySelector('[data-rebook-fixed-canvas="true"]') as HTMLCanvasElement | null

        expect(frame?.style.width).toBe('360px')
        expect(parseFloat(frame?.style.height ?? '')).toBeCloseTo(172.8)
        expect(canvas?.style.width).toBe('300px')
        expect(canvas?.style.transform).toBe('scale(1.2)')
        expect(canvas?.width).toBe(360)

        reader.destroy()
    })

    it('renders parsed CBZ books as fixed image page surfaces', async () => {
        const container = document.createElement('div')
        container.setAttribute('data-width', '360')
        container.setAttribute('data-height', '160')
        document.body.appendChild(container)

        const input = await createTestCBZ({ pages: 2 })
        const book = await new CBZParser().parse(input, { domAdapter: new NodeDOMAdapter() })
        const reader = createReader({ container })
        await reader.openBook(book)

        expect(book.sections).toHaveLength(0)
        expect(book.fixedDocument?.format).toBe('cbz')
        expect(container.querySelector('[data-rebook-page-surface="true"]')).toBeTruthy()
        expect(container.querySelector('[data-rebook-surface-kind="image-page"]')).toBeTruthy()
        expect(container.querySelector('[data-rebook-fixed-canvas="true"]')).toBeTruthy()
        expect(container.querySelector('[data-rebook-fixed-canvas-image="true"]')).toBeTruthy()
        expect((container.querySelector('[data-rebook-fixed-canvas="true"]') as HTMLElement | null)?.dataset.rebookFixedPainterBackend).toBe('canvas2d')
        expect((reader.getCurrentSurface()?.metadata?.paint as { backend?: string; ms?: number } | undefined))
            .toMatchObject({ backend: 'canvas2d' })

        reader.setMark({
            id: 'comic-panel',
            kind: 'panel',
            location: {
                type: 'image',
                pageIndex: 0,
                rect: { x: 0, y: 0, width: 1, height: 1 },
            },
        })
        await reader.refresh()

        const annotation = container.querySelector('[data-rebook-annotation="true"]') as HTMLElement | null
        expect(container.querySelector('[data-rebook-annotation-layer="true"]')).toBeTruthy()
        expect(annotation?.dataset.markId).toBe('comic-panel')
        expect(annotation?.classList.contains('rebook-mark-panel')).toBe(true)

        reader.destroy()
    })

    it('falls back to the canvas painter when WebGPU is preferred but unavailable', async () => {
        const container = document.createElement('div')
        container.setAttribute('data-width', '360')
        container.setAttribute('data-height', '160')
        document.body.appendChild(container)

        const input = await createTestCBZ({ pages: 1 })
        const book = await new CBZParser().parse(input, { domAdapter: new NodeDOMAdapter() })
        const reader = createReader({ container, fixedPainter: 'webgpu' })
        await reader.openBook(book)

        expect(container.querySelector('[data-rebook-fixed-webgpu="true"]')).toBeNull()
        expect((container.querySelector('[data-rebook-fixed-canvas="true"]') as HTMLElement | null)?.dataset.rebookFixedPainterBackend).toBe('canvas2d')
        expect((reader.getCurrentSurface()?.metadata?.paint as { backend?: string; ms?: number } | undefined))
            .toMatchObject({ backend: 'canvas2d' })

        reader.destroy()
    })

    it('emits block ids for the current viewport plus configured prefetch pages', async () => {
        const container = document.createElement('div')
        container.setAttribute('data-width', '360')
        container.setAttribute('data-height', '72')
        document.body.appendChild(container)

        const blocks = Array.from({ length: 10 }, (_, index) => ({
            id: `b${index}`,
            type: 'paragraph' as const,
            segments: [{ text: `Block ${index} has enough text to translate.` }],
        }))
        const book: Book & { translationPrefetchPageCount: number } = {
            translationPrefetchPageCount: 1,
            sections: [{
                id: 'chapter.xhtml',
                size: 300,
                format: 'xhtml',
                load: () => '',
                getBlocks: () => blocks,
            }],
        }

        const renderer = new BrowserRenderer({
            container,
            layout: 'paginated',
            maxColumnCount: 1,
            styles: { fontSize: '16px', lineHeight: 1.5, maxInlineSize: '260px', margin: '16px' },
        })
        let blockIds: string[] = []
        renderer.on('block-window', event => {
            blockIds = event.blockIds
        })

        await renderer.open(book)
        await renderer.goTo(0)

        expect(blockIds.length).toBeGreaterThan(0)
        expect(blockIds.length).toBeLessThan(blocks.length)
        expect(blockIds[0]).toBe('b0')
        expect(blockIds).not.toContain('b9')

        renderer.destroy()
    })

    it('replaces the renderer DOM when opening another book through ReaderView', async () => {
        const container = document.createElement('div')
        container.setAttribute('data-width', '360')
        container.setAttribute('data-height', '72')
        document.body.appendChild(container)

        const makeBook = (id: string, text: string): Book => ({
            sections: [{
                id,
                size: text.length,
                format: 'xhtml',
                load: () => `<p>${text}</p>`,
                getBlocks: () => [{
                    id: `${id}-body`,
                    type: 'paragraph',
                    segments: [{ text }],
                }],
            }],
        })

        const reader = createReader({ container })
        await reader.openBook(makeBook('one.xhtml', 'First book'))
        await reader.goTo(0)
        await reader.openBook(makeBook('two.xhtml', 'Second book'))
        await reader.goTo(0)

        expect(container.textContent).toContain('Second book')
        expect(container.textContent).not.toContain('First book')
        expect(container.children.length).toBe(1)

        reader.destroy()
    })

    it('uses two columns when spread is enabled and the viewport is wide enough', async () => {
        const container = document.createElement('div')
        container.setAttribute('data-width', '1200')
        container.setAttribute('data-height', '96')
        document.body.appendChild(container)

        const text = Array.from({ length: 140 }, (_, index) => `word${index}`).join(' ')
        const book: Book = {
            sections: [{
                id: 'chapter.xhtml',
                size: text.length,
                format: 'xhtml',
                load: () => `<p>${text}</p>`,
                getBlocks: () => [{
                    id: 'chapter-body',
                    type: 'paragraph',
                    segments: [{ text }],
                }],
            }],
        }

        const renderer = new BrowserRenderer({
            container,
            maxColumnCount: 2,
            styles: { fontSize: '16px', lineHeight: 1.5, maxInlineSize: '320px', gap: '48px' },
        })

        await renderer.open(book)
        await renderer.goTo(0)

        const rows = Array.from(container.querySelectorAll('[data-block-type="paragraph"]')) as HTMLElement[]
        const lefts = new Set(rows.map(row => row.style.left))
        expect(lefts.size).toBeGreaterThan(1)
        expect(rows.some(row => row.style.left === '368px')).toBe(true)
        const layer = rows[0].closest('[data-rebook-reflowable-content-layer="true"]') as HTMLElement
        const frame = layer.parentElement as HTMLElement
        const contentHost = frame.parentElement as HTMLElement
        expect(contentHost.style.left).toBe('56px')
        expect(frame.style.width).toBe('688px')

        renderer.setSpread(1)
        const singleColumnRows = Array.from(container.querySelectorAll('[data-block-type="paragraph"]')) as HTMLElement[]
        const singleColumnLefts = new Set(singleColumnRows.map(row => row.style.left))
        expect(singleColumnLefts).toEqual(new Set(['0px']))
        const singleColumnLayer = singleColumnRows[0].closest('[data-rebook-reflowable-content-layer="true"]') as HTMLElement
        const singleColumnFrame = singleColumnLayer.parentElement as HTMLElement
        const singleColumnContentHost = singleColumnFrame.parentElement as HTMLElement
        expect(singleColumnContentHost.style.left).toBe('240px')
        expect(singleColumnFrame.style.width).toBe('320px')

        renderer.destroy()
    })

    it('paginates by viewport groups and keeps text away from the clipped edge', async () => {
        const container = document.createElement('div')
        container.setAttribute('data-width', '760')
        container.setAttribute('data-height', '120')
        document.body.appendChild(container)

        const text = Array.from({ length: 120 }, (_, index) => `word${index}`).join(' ')
        const book: Book = {
            sections: [{
                id: 'chapter.xhtml',
                size: text.length,
                format: 'xhtml',
                load: () => `<p>${text}</p>`,
                getBlocks: () => [{
                    id: 'chapter-body',
                    type: 'paragraph',
                    segments: [{ text }],
                }],
            }],
        }

        const renderer = new BrowserRenderer({
            container,
            layout: 'paginated',
            maxColumnCount: 2,
            styles: { fontSize: '16px', lineHeight: 1.5, maxInlineSize: '320px', gap: '48px', margin: '32px' },
        })

        await renderer.open(book)
        await renderer.goTo(0)

        const scroller = container.firstElementChild as HTMLElement
        const firstRow = container.querySelector('[data-block-type="paragraph"]') as HTMLElement
        expect(scroller.style.overflow).toBe('hidden')
        expect(parseFloat(firstRow.style.top)).toBeGreaterThan(0)

        await renderer.next()
        expect(scroller.scrollTop).toBe(120)

        renderer.setLayout('scrolled')
        expect(scroller.style.overflow).toBe('auto')

        renderer.destroy()
    })

    it('skips fully empty paginated pages caused by large source gaps', async () => {
        const container = document.createElement('div')
        container.setAttribute('data-width', '360')
        container.setAttribute('data-height', '120')
        document.body.appendChild(container)

        const book: Book = {
            sections: [{
                id: 'chapter.xhtml',
                size: 200,
                format: 'xhtml',
                load: () => '<p>First</p><p>Second</p>',
                getBlocks: () => [
                    {
                        id: 'first',
                        type: 'paragraph',
                        segments: [{ text: 'First page text' }],
                    },
                    {
                        id: 'second',
                        type: 'paragraph',
                        blockGapBefore: 160,
                        segments: [{ text: 'Second page text after a gap' }],
                    },
                ],
            }],
        }

        const renderer = new BrowserRenderer({
            container,
            layout: 'paginated',
            maxColumnCount: 1,
            styles: { fontSize: '16px', lineHeight: 1.5, maxInlineSize: '280px', margin: '16px' },
        })
        const fractions: number[] = []
        renderer.on('relocate', event => {
            fractions.push(event.fraction)
        })

        await renderer.open(book)
        await renderer.goTo(0)
        expect(container.textContent).toContain('First page text')

        await renderer.next()
        expect(container.textContent).toContain('Second page text')
        expect(container.textContent).not.toBe('')
        expect(fractions.at(-1)).toBe(1)

        renderer.destroy()
    })

    it('keeps Hidden Tools chapter 2 pages non-empty in the simulated layout', async () => {
        const container = document.createElement('div')
        container.setAttribute('data-width', '620')
        container.setAttribute('data-height', '600')
        document.body.appendChild(container)

        const data = await readFile('data/The Hidden Tools of Comed.epub')
        const book = await epub().parse(data.buffer.slice(
            data.byteOffset,
            data.byteOffset + data.byteLength,
        ), {
            domAdapter: new NodeDOMAdapter(),
            urlFactory: new NodeURLFactory(),
        })
        const chapter2Index = book.sections.findIndex(section => String(section.id).endsWith('part0009.html'))
        expect(chapter2Index).toBeGreaterThanOrEqual(0)

        const renderer = new BrowserRenderer({
            container,
            layout: 'paginated',
            maxColumnCount: 2,
            styles: { fontSize: '16px', lineHeight: 1.5, maxInlineSize: '720px', margin: '32px' },
        })
        let currentIndex = -1
        renderer.on('relocate', event => {
            currentIndex = event.index
        })

        await renderer.open(book)
        await renderer.goTo(chapter2Index)

        for (let i = 0; i < 40 && currentIndex === chapter2Index; i++) {
            expect(container.querySelectorAll('[data-block-type]').length).toBeGreaterThan(0)
            expect(container.textContent?.trim()).not.toBe('')
            await renderer.next()
        }

        expect(currentIndex).toBe(chapter2Index + 1)

        renderer.destroy()
    })

    it('does not treat carry-over line height as a readable page', async () => {
        const container = document.createElement('div')
        container.setAttribute('data-width', '760')
        container.setAttribute('data-height', '664')
        document.body.appendChild(container)

        const renderer = new BrowserRenderer({
            container,
            layout: 'paginated',
            maxColumnCount: 2,
            styles: { fontSize: '16px', lineHeight: 1.7, maxInlineSize: '320px', margin: '32px' },
        })
        const internal = renderer as unknown as BrowserRenderer & {
            lines: Array<{ top: number; height: number }>
            columnLayout: { pageCount: number; columnHeight: number; columns: number }
            findReadablePage(pageIndex: number, direction: -1 | 0 | 1): number | null
        }

        internal.lines = [{
            index: 0,
            kind: 'text',
            start: null,
            end: null,
            text: 'line that visually belongs to the previous spread',
            width: 280,
            top: 1190,
            height: 27.2,
            segments: [],
        }]
        internal.columnLayout = {
            ...internal.columnLayout,
            columnHeight: 600,
            columns: 2,
            pageCount: 2,
        }

        expect(internal.findReadablePage(0, 0)).toBe(0)
        expect(internal.findReadablePage(1, 0)).toBe(0)
        expect(internal.findReadablePage(1, 1)).toBeNull()

        renderer.destroy()
    })

    it('renders image blocks and marks covers', async () => {
        const container = document.createElement('div')
        container.setAttribute('data-width', '360')
        container.setAttribute('data-height', '160')
        document.body.appendChild(container)

        const book: Book = {
            sections: [{
                id: 'cover.xhtml',
                size: 120,
                format: 'xhtml',
                load: () => '<p><img src="test://cover.png" alt="Cover"/></p>',
                getBlocks: () => [{
                    id: 'cover-image',
                    type: 'image',
                    image: {
                        src: 'test://cover.png',
                        originalSrc: 'images/cover.png',
                        alt: 'Cover',
                        width: 600,
                        height: 900,
                        isCover: true,
                        style: { maxWidth: 280, objectFit: 'contain', align: 'center' },
                    },
                    segments: [],
                }],
            }],
        }

        const renderer = new BrowserRenderer({
            container,
            layout: 'paginated',
            styles: { margin: '20px', fontSize: '16px', lineHeight: 1.5 },
        })

        await renderer.open(book)
        await renderer.goTo(0)

        const figure = container.querySelector('[data-block-type="image"]') as HTMLElement
        const img = container.querySelector('img') as HTMLImageElement
        expect(figure.dataset.cover).toBe('true')
        expect(img.src).toBe('test://cover.png')
        expect(img.alt).toBe('Cover')
        expect(parseFloat(figure.style.height)).toBeLessThanOrEqual(120)

        renderer.destroy()
    })

    it('renders table blocks as visible grid rows', async () => {
        const container = document.createElement('div')
        container.setAttribute('data-width', '420')
        container.setAttribute('data-height', '180')
        document.body.appendChild(container)

        const book: Book = {
            sections: [{
                id: 'table.xhtml',
                size: 120,
                format: 'xhtml',
                load: () => '<table><tr><td>Figure 1.1</td><td>Terms in a synonym ring</td></tr></table>',
                getBlocks: () => [{
                    id: 'figures-row-1',
                    type: 'table',
                    table: {
                        columnCount: 2,
                        columnWeights: [20, 80],
                        rowIndex: 0,
                        rowCount: 1,
                        rows: [{
                            cells: [
                                { text: 'Figure 1.1', align: 'start' },
                                { text: 'Terms in a synonym ring' },
                            ],
                        }],
                    },
                    style: { fontSize: 12.8, lineHeight: 1.25 },
                    segments: [],
                }],
            }],
        }

        const renderer = new BrowserRenderer({
            container,
            layout: 'paginated',
            styles: { margin: '20px', fontSize: '16px', lineHeight: 1.5 },
        })

        await renderer.open(book)
        await renderer.goTo(0)

        const tableRow = container.querySelector('[data-block-type="table"]') as HTMLElement
        expect(tableRow).toBeTruthy()
        expect(tableRow.textContent).toContain('Figure 1.1')
        expect(tableRow.textContent).toContain('Terms in a synonym ring')
        expect(tableRow.style.fontSize).toBe('12.8px')
        expect(tableRow.style.lineHeight).toBe('16px')
        expect((tableRow.firstElementChild as HTMLElement).style.gridTemplateColumns).toContain('20fr')
        expect((tableRow.firstElementChild as HTMLElement).style.gridTemplateColumns).toContain('80fr')

        renderer.destroy()
    })

    it('keeps preformatted blocks constrained to the column width', async () => {
        const container = document.createElement('div')
        container.setAttribute('data-width', '360')
        container.setAttribute('data-height', '240')
        document.body.appendChild(container)

        const code = [
            '<ol>',
            '    <li>',
            '        <p>Dogs</p>',
            '        <ol>',
            '            <li>Spot with a deliberately very long value that should scroll horizontally</li>',
            '        </ol>',
            '    </li>',
            '</ol>',
        ].join('\n')
        const book: Book = {
            sections: [{
                id: 'chapter.xhtml',
                size: code.length,
                format: 'xhtml',
                load: () => '',
                getBlocks: () => [{
                    id: 'code-sample',
                    type: 'pre',
                    segments: [{ text: code }],
                }],
            }],
        }

        const renderer = new BrowserRenderer({
            container,
            layout: 'paginated',
            maxColumnCount: 1,
            styles: { fontSize: '16px', lineHeight: 1.5, minColumnWidth: '260px', maxInlineSize: '260px', margin: '16px' },
        })

        await renderer.open(book)
        await renderer.goTo(0)

        const pre = container.querySelector('pre[data-block-type="pre"]') as HTMLElement
        expect(pre.style.width).toBe('260px')
        expect(pre.style.overflow).toBe('auto')
        expect(pre.style.whiteSpace).toBe('pre-wrap')
        expect(pre.style.overflowWrap).toBe('anywhere')
        expect(pre.textContent).toContain('<li>')
        expect(pre.textContent).toMatch(/Spot\s+with\s+a\s+deliberately/)
        expect(pre.textContent!.split('\n').length).toBeGreaterThan(code.split('\n').length)

        renderer.destroy()
    })

    it('renders footnote marker image segments inline', async () => {
        const container = document.createElement('div')
        container.setAttribute('data-width', '360')
        container.setAttribute('data-height', '120')
        document.body.appendChild(container)

        const book: Book = {
            sections: [{
                id: 'chapter.xhtml',
                size: 120,
                format: 'xhtml',
                load: () => '',
                getBlocks: () => [{
                    id: 'body',
                    type: 'paragraph',
                    segments: [
                        { text: 'Text before ' },
                        {
                            text: '\uFFFC',
                            break: 'never',
                            extraWidth: 11,
                            source: {
                                nodeType: 'img',
                                attrs: {
                                    src: 'test://note.png',
                                    alt: 'note',
                                    class: 'epub-footnote',
                                    'data-rebook-footnote-content': 'Hidden note text',
                                    'data-rebook-inline-image-width': '11',
                                    'data-rebook-inline-image-height': '11',
                                },
                            },
                        },
                        { text: ' after' },
                    ],
                }],
            }],
        }

        const renderer = new BrowserRenderer({
            container,
            layout: 'paginated',
            styles: { fontSize: '16px', lineHeight: 1.5, maxInlineSize: '280px', margin: '16px' },
        })

        await renderer.open(book)
        await renderer.goTo(0)

        const marker = container.querySelector('[data-block-type="paragraph"] img') as HTMLImageElement
        expect(marker).toBeTruthy()
        expect(marker.src).toBe('test://note.png')
        expect(marker.style.width).toBe('11px')
        expect(container.textContent).not.toContain('Hidden note text')
        expect(container.querySelector('[data-block-type="image"]')).toBeNull()

        renderer.destroy()
    })

    it('navigates to anchors inside a browser renderer section and reports the active TOC item', async () => {
        const container = document.createElement('div')
        container.setAttribute('data-width', '360')
        container.setAttribute('data-height', '96')
        document.body.appendChild(container)

        const book: Book = {
            sections: [{
                id: 0,
                size: 2000,
                format: 'xhtml',
                load: () => '<h1 id="first">First</h1><p>One</p><h1 id="second">Second</h1><p>Two</p>',
                getBlocks: () => [
                    {
                        id: 'first',
                        type: 'chapter',
                        attrs: { id: 'first' },
                        segments: [{ text: 'First' }],
                    },
                    {
                        id: 'first-body',
                        type: 'paragraph',
                        segments: [{ text: Array.from({ length: 120 }, (_, index) => `one${index}`).join(' ') }],
                    },
                    {
                        id: 'second',
                        type: 'chapter',
                        attrs: { id: 'second' },
                        segments: [{ text: 'Second' }],
                    },
                    {
                        id: 'second-body',
                        type: 'paragraph',
                        segments: [{ text: Array.from({ length: 80 }, (_, index) => `two${index}`).join(' ') }],
                    },
                ],
            }],
            toc: [
                { label: 'First', href: 'first' },
                { label: 'Second', href: 'second' },
            ],
            resolveHref: href => ({ index: 0, anchor: () => `[id="${href}"]` }),
        }

        const renderer = new BrowserRenderer({
            container,
            layout: 'scrolled',
            styles: { fontSize: '16px', lineHeight: 1.5, maxInlineSize: '280px', margin: '16px' },
        })
        let lastLabel: string | null = null
        renderer.on('relocate', event => {
            lastLabel = event.tocItem?.label ?? null
        })

        await renderer.open(book)
        await renderer.goTo('first')
        expect(lastLabel).toBe('First')

        await renderer.goTo('second')
        const scroller = container.firstElementChild as HTMLElement
        expect(scroller.scrollTop).toBeGreaterThan(0)
        expect(lastLabel).toBe('Second')

        renderer.destroy()
    })

    it('ignores unresolved TOC anchors in the current browser renderer section', async () => {
        const container = document.createElement('div')
        container.setAttribute('data-width', '360')
        container.setAttribute('data-height', '96')
        document.body.appendChild(container)

        const book: Book = {
            sections: [{
                id: 0,
                size: 2000,
                format: 'xhtml',
                load: () => '<h1 id="cover">Cover</h1><p>Body</p>',
                getBlocks: () => [
                    {
                        id: 'cover',
                        type: 'chapter',
                        attrs: { id: 'cover' },
                        segments: [{ text: 'Cover' }],
                    },
                    {
                        id: 'cover-body',
                        type: 'paragraph',
                        segments: [{ text: Array.from({ length: 120 }, (_, index) => `body${index}`).join(' ') }],
                    },
                ],
            }],
            toc: [
                { label: 'Cover', href: 'cover' },
                { label: 'Missing Later Item', href: 'missing' },
            ],
            resolveHref: href => ({ index: 0, anchor: () => `[id="${href}"]` }),
        }

        const renderer = new BrowserRenderer({
            container,
            layout: 'scrolled',
            styles: { fontSize: '16px', lineHeight: 1.5, maxInlineSize: '280px', margin: '16px' },
        })
        let lastLabel: string | null = null
        renderer.on('relocate', event => {
            lastLabel = event.tocItem?.label ?? null
        })

        await renderer.open(book)
        await renderer.goTo('cover')

        expect(lastLabel).toBe('Cover')

        renderer.destroy()
    })

    it('activates current section TOC entries without explicit anchors', async () => {
        const container = document.createElement('div')
        container.setAttribute('data-width', '360')
        container.setAttribute('data-height', '120')
        document.body.appendChild(container)

        const book: Book = {
            sections: [{
                id: 'chapter.xhtml',
                size: 100,
                load: () => '<p>Chapter text</p>',
                getBlocks: async () => [{
                    id: 'chapter',
                    type: 'paragraph',
                    segments: [{ text: 'Chapter text' }],
                }],
            }],
            toc: [{ label: 'Chapter', href: 'chapter.xhtml' }],
            splitTOCHref: href => [href.split('#')[0], href.split('#')[1] ?? null],
        }

        const renderer = new BrowserRenderer({
            container,
            layout: 'paginated',
            styles: { fontSize: '16px', lineHeight: 1.5 },
        })
        let activeHref: string | null = null
        renderer.on('relocate', event => {
            activeHref = event.tocItem?.href ?? null
        })

        await renderer.open(book)
        await renderer.goTo(0)

        expect(activeHref).toBe('chapter.xhtml')

        renderer.destroy()
    })

    it('reports the clicked TOC item for explicit paginated anchor navigation', async () => {
        const container = document.createElement('div')
        container.setAttribute('data-width', '760')
        container.setAttribute('data-height', '180')
        document.body.appendChild(container)

        const book: Book = {
            sections: [{
                id: 0,
                size: 2000,
                format: 'xhtml',
                load: () => '<p>Intro</p><h1 id="cover">Cover</h1><p>Body</p>',
                getBlocks: () => [
                    {
                        id: 'intro',
                        type: 'paragraph',
                        segments: [{ text: Array.from({ length: 24 }, (_, index) => `intro${index}`).join(' ') }],
                    },
                    {
                        id: 'cover',
                        type: 'chapter',
                        attrs: { id: 'cover' },
                        segments: [{ text: 'Cover' }],
                    },
                    {
                        id: 'cover-body',
                        type: 'paragraph',
                        segments: [{ text: Array.from({ length: 80 }, (_, index) => `body${index}`).join(' ') }],
                    },
                ],
            }],
            toc: [
                { label: 'Cover', href: 'cover' },
            ],
            resolveHref: href => ({ index: 0, anchor: () => `[id="${href}"]` }),
        }

        const renderer = new BrowserRenderer({
            container,
            layout: 'paginated',
            maxColumnCount: 2,
            styles: { fontSize: '16px', lineHeight: 1.5, maxInlineSize: '320px', margin: '32px' },
        })
        let lastLabel: string | null = null
        renderer.on('relocate', event => {
            lastLabel = event.tocItem?.label ?? null
        })

        await renderer.open(book)
        await renderer.goTo('cover')

        expect(lastLabel).toBe('Cover')

        renderer.destroy()
    })

    it('selects the active TOC item by reading order instead of TOC declaration order', async () => {
        const container = document.createElement('div')
        container.setAttribute('data-width', '360')
        container.setAttribute('data-height', '96')
        document.body.appendChild(container)

        const makeSection = (id: string, text: string) => ({
            id,
            size: text.length,
            format: 'xhtml' as const,
            load: () => `<p>${text}</p>`,
            getBlocks: () => [{
                id: `${id}-body`,
                type: 'paragraph' as const,
                segments: [{ text }],
            }],
        })
        const book: Book = {
            sections: [
                makeSection('one.xhtml', 'One'),
                makeSection('two.xhtml', 'Two'),
            ],
            toc: [
                { label: 'Two', href: 'two.xhtml' },
                { label: 'One', href: 'one.xhtml' },
            ],
            resolveHref: href => ({ index: href === 'two.xhtml' ? 1 : 0, anchor: 0 }),
        }

        const renderer = new BrowserRenderer({
            container,
            layout: 'paginated',
            styles: { fontSize: '16px', lineHeight: 1.5, maxInlineSize: '280px', margin: '16px' },
        })
        let lastLabel: string | null = null
        renderer.on('relocate', event => {
            lastLabel = event.tocItem?.label ?? null
        })

        await renderer.open(book)
        await renderer.goTo(0)
        expect(lastLabel).toBe('One')

        await renderer.next()
        expect(lastLabel).toBe('Two')

        renderer.destroy()
    })

    it('keeps Gui Women TOC navigation after chapter 2 on non-empty rendered pages', async () => {
        const container = document.createElement('div')
        container.setAttribute('data-width', '620')
        container.setAttribute('data-height', '600')
        document.body.appendChild(container)

        const data = await readFile('data/归我们未来经济社会的行动指南.epub')
        const book = await epub().parse(data.buffer.slice(
            data.byteOffset,
            data.byteOffset + data.byteLength,
        ), {
            domAdapter: new NodeDOMAdapter(),
            urlFactory: new NodeURLFactory(),
        })
        const tocItems = book.toc?.slice(2) ?? []
        expect(tocItems.length).toBeGreaterThan(0)

        const renderer = new BrowserRenderer({
            container,
            layout: 'paginated',
            maxColumnCount: 2,
            styles: { fontSize: '16px', lineHeight: 1.5, maxInlineSize: '720px', margin: '32px' },
        })
        let currentIndex = -1
        renderer.on('relocate', event => {
            currentIndex = event.index
        })

        await renderer.open(book)
        for (const item of tocItems) {
            const resolved = book.resolveHref?.(item.href)
            expect(resolved?.index).toBeGreaterThanOrEqual(0)

            await renderer.goTo(item.href)

            expect(currentIndex).toBe(resolved?.index)
            expect(container.querySelectorAll('[data-block-type]').length).toBeGreaterThan(0)
            expect(container.textContent?.trim()).not.toBe('')
        }

        renderer.destroy()
    }, 10000)

    it('activates a TOC item that starts inside the visible paginated spread', async () => {
        const container = document.createElement('div')
        container.setAttribute('data-width', '760')
        container.setAttribute('data-height', '120')
        document.body.appendChild(container)

        const book: Book = {
            sections: [{
                id: 0,
                size: 2000,
                format: 'xhtml',
                load: () => '<p>Intro</p><h1 id="chapter">Chapter</h1>',
                getBlocks: () => [
                    {
                        id: 'intro',
                        type: 'paragraph',
                        segments: [{ text: Array.from({ length: 10 }, (_, index) => `intro${index}`).join(' ') }],
                    },
                    {
                        id: 'chapter',
                        type: 'chapter',
                        attrs: { id: 'chapter' },
                        segments: [{ text: 'Chapter' }],
                    },
                ],
            }],
            toc: [
                { label: 'Intro', href: 'intro' },
                { label: 'Chapter', href: 'chapter' },
            ],
            resolveHref: href => ({ index: 0, anchor: () => `[id="${href}"]` }),
        }

        const renderer = new BrowserRenderer({
            container,
            layout: 'paginated',
            maxColumnCount: 2,
            styles: { fontSize: '16px', lineHeight: 1.5, maxInlineSize: '320px', gap: '48px', margin: '32px' },
        })
        let lastLabel: string | null = null
        renderer.on('relocate', event => {
            lastLabel = event.tocItem?.label ?? null
        })

        await renderer.open(book)
        await renderer.goTo(0)

        expect(lastLabel).toBe('Chapter')

        renderer.destroy()
    })

    it('activates real EPUB TOC entries whose anchors resolve to section start offsets', async () => {
        const buf = await readFile('data/4.epub')
        const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
        const book = await epub().parse(ab, {
            domAdapter: new NodeDOMAdapter(),
            urlFactory: new NodeURLFactory(),
        })
        const flatTOC = flattenTestTOC(book.toc ?? [])
        const target = flatTOC
            .map(item => ({ item, resolved: book.resolveHref?.(item.href) }))
            .find(({ item, resolved }) => resolved && resolved.index > 0 && !item.href.includes('#'))

        expect(target).toBeDefined()

        const container = document.createElement('div')
        container.setAttribute('data-width', '760')
        container.setAttribute('data-height', '180')
        document.body.appendChild(container)

        const renderer = new BrowserRenderer({
            container,
            layout: 'paginated',
            maxColumnCount: 2,
            styles: { fontSize: '16px', lineHeight: 1.5, maxInlineSize: '320px', margin: '32px' },
        })
        let lastHref: string | null = null
        renderer.on('relocate', event => {
            lastHref = event.tocItem?.href ?? null
        })

        await renderer.open(book)
        await renderer.goTo(target!.resolved!.index)

        expect(lastHref).toBe(target!.item.href)

        renderer.destroy()
        book.destroy?.()
    })

    it('navigates to Structured Writing TOC entries with empty child anchor elements', async () => {
        const buf = await readFile('data/Structured Writing Rhetoric and Process.epub')
        const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
        const book = await epub().parse(ab, {
            domAdapter: new NodeDOMAdapter(),
            urlFactory: new NodeURLFactory(),
        })
        const target = flattenTestTOC(book.toc ?? []).find(item => item.label === '3. Complexity')
        expect(target).toBeDefined()

        const container = document.createElement('div')
        container.setAttribute('data-width', '960')
        container.setAttribute('data-height', '480')
        document.body.appendChild(container)

        const reader = createReader({
            container,
            layout: 'paginated',
            maxColumnCount: 2,
            styles: { fontSize: '16px', lineHeight: 1.7, minColumnWidth: '320px', maxColumnWidth: '720px', margin: '32px' },
        })
        let activeLabel: string | null = null
        reader.on('relocate', event => {
            activeLabel = event.tocItem?.label ?? null
        })

        await reader.openBook(book)
        await reader.goTo(target!.href)

        expect(activeLabel).toBe('3. Complexity')
        expect(container.textContent).toContain('3.\u00a0Complexity')

        reader.destroy()
        book.destroy?.()
    }, 10000)

    it('uses EPUB TOC href fragments when anchor resolver values are unavailable', async () => {
        const buf = await readFile('data/Structured Writing Rhetoric and Process.epub')
        const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
        const book = await epub().parse(ab, {
            domAdapter: new NodeDOMAdapter(),
            urlFactory: new NodeURLFactory(),
        })
        const originalResolveHref = book.resolveHref?.bind(book)
        Object.assign(book, {
            resolveHref(href: string) {
                const resolved = originalResolveHref?.(href)
                if (!resolved || !href.includes('#')) return resolved
                return { ...resolved, anchor: () => null }
            },
        })

        const container = document.createElement('div')
        container.setAttribute('data-width', '960')
        container.setAttribute('data-height', '600')
        document.body.appendChild(container)

        const reader = createReader({
            container,
            layout: 'paginated',
            maxColumnCount: 2,
            styles: { fontSize: '16px', lineHeight: 1.7, minColumnWidth: '320px', maxColumnWidth: '720px', margin: '32px' },
        })
        let activeLabel: string | null = null
        reader.on('relocate', event => {
            activeLabel = event.tocItem?.label ?? null
        })

        await reader.openBook(book)
        for (const label of ['1. Rhetoric', '2. Process', '1.2. The three domains']) {
            const target = flattenTestTOC(book.toc ?? []).find(item => item.label === label)
            expect(target).toBeDefined()

            await reader.goTo(target!.href)

            expect(activeLabel).toBe(label)
            expect(container.textContent?.replace(/\u00a0/g, ' ')).toContain(label)
        }

        reader.destroy()
        book.destroy?.()
    }, 10000)

    it('keeps Structured Writing subsection TOC active while paging with trial plugin enabled', async () => {
        const buf = await readFile('data/Structured Writing Rhetoric and Process.epub')
        const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
        const book = await epub().parse(ab, {
            domAdapter: new NodeDOMAdapter(),
            urlFactory: new NodeURLFactory(),
        })

        const container = document.createElement('div')
        container.setAttribute('data-width', '960')
        container.setAttribute('data-height', '600')
        document.body.appendChild(container)

        const reader = createReader({
            container,
            layout: 'paginated',
            maxColumnCount: 2,
            styles: { fontSize: '16px', lineHeight: 1.7, minColumnWidth: '320px', maxColumnWidth: '720px', margin: '32px' },
            plugins: [withTrialLimit()],
        })
        let activeLabel: string | null = null
        reader.on('relocate', event => {
            activeLabel = event.tocItem?.label ?? null
        })

        await reader.openBook(book)
        await reader.goTo('OEBPS/pr02.html')
        expect(activeLabel).toBe('Introduction')
        expect(reader.canGoNext()).toBe(true)

        for (let index = 0; index < 12 && activeLabel !== '1. Rhetoric'; index++) {
            await reader.next()
        }

        const activeItems = flattenTestTOCView(reader.getTOCViewItems({ location: reader.getLocation() }))
            .filter(item => item.active)

        expect(activeLabel).toBe('1. Rhetoric')
        expect(activeItems.map(item => item.label)).toEqual(['1. Rhetoric'])
        expect(container.textContent?.replace(/\u00a0/g, ' ')).toContain('1. Rhetoric')

        reader.destroy()
        book.destroy?.()
    }, 10000)

    it('clears stale location state when opening another book', async () => {
        const container = document.createElement('div')
        container.setAttribute('data-width', '360')
        container.setAttribute('data-height', '96')
        document.body.appendChild(container)

        const makeBook = (id: string, label: string): Book => ({
            sections: [{
                id,
                size: 80,
                format: 'xhtml',
                load: () => `<p>${label}</p>`,
                getBlocks: () => [{
                    id: `${id}-body`,
                    type: 'paragraph',
                    segments: [{ text: label }],
                }],
            }],
            toc: [{ label, href: id }],
            splitTOCHref: href => [href, null],
        })

        const renderer = new BrowserRenderer({
            container,
            layout: 'paginated',
            styles: { fontSize: '16px', lineHeight: 1.5, maxInlineSize: '280px', margin: '16px' },
        })

        await renderer.open(makeBook('first.xhtml', 'First Book'))
        await renderer.goTo(0)
        expect(renderer.getLocation()?.tocItem?.label).toBe('First Book')

        await renderer.open(makeBook('second.xhtml', 'Second Book'))
        expect(renderer.getLocation()).toBeNull()
        expect(container.textContent).toBe('')

        renderer.destroy()
    })

    it('does not replace an explicit null renderer TOC item with ReaderView section fallback', async () => {
        const container = document.createElement('div')
        container.setAttribute('data-width', '360')
        container.setAttribute('data-height', '96')
        document.body.appendChild(container)

        const book: Book = {
            sections: [{
                id: 0,
                size: 120,
                format: 'xhtml',
                load: () => '<p>No matching heading here</p>',
                getBlocks: () => [{
                    id: 'body',
                    type: 'paragraph',
                    segments: [{ text: 'No matching heading here' }],
                }],
            }],
            toc: [
                { label: 'Missing Anchor', href: 'missing' },
            ],
            resolveHref: () => ({ index: 0, anchor: () => '[id="missing"]' }),
            splitTOCHref: () => [0, null],
        }

        const reader = createReader({
            container,
            layout: 'paginated',
            styles: { fontSize: '16px', lineHeight: 1.5, maxInlineSize: '280px', margin: '16px' },
        })
        let lastLabel = 'not-called'
        reader.on('relocate', event => {
            lastLabel = event.tocItem?.label ?? 'null'
        })

        await reader.openBook(book)
        await reader.goTo(0)

        expect(lastLabel).toBe('null')
        expect(reader.getLocation()?.tocItem).toBeNull()
        expect(flattenTestTOCView(reader.getTOCViewItems({ location: reader.getLocation() })).find(item => item.active)?.label)
            .toBe('Missing Anchor')

        reader.destroy()
    })

    it('keeps the clicked cover active for data/1.azw3 when a follow-up scroll relocate fires', async () => {
        const buf = await readFile('data/1.azw3')
        const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
        const book = await mobi().parse(ab, {
            domAdapter: new NodeDOMAdapter(),
            urlFactory: new NodeURLFactory(),
        })
        const cover = book.toc?.[0]
        const last = flattenTestTOC(book.toc ?? []).at(-1)

        expect(cover?.label).toBe('封面')
        expect(last?.href).not.toBe(cover?.href)

        const container = document.createElement('div')
        container.setAttribute('data-width', '960')
        container.setAttribute('data-height', '480')
        document.body.appendChild(container)

        const reader = createReader({
            container,
            layout: 'paginated',
            maxColumnCount: 2,
            styles: { fontSize: '16px', lineHeight: 1.7, minColumnWidth: '320px', maxColumnWidth: '720px', margin: '32px' },
        })
        let activeHref: string | null = null
        reader.on('relocate', event => {
            const href = event.tocItem?.href ?? null
            if (!href || href === activeHref) return
            activeHref = href
        })

        await reader.openBook(book)
        await reader.goTo(cover!.href)
        ;(container.firstElementChild as HTMLElement).dispatchEvent(new window.Event('scroll'))

        expect(activeHref).toBe(cover!.href)
        expect(activeHref).not.toBe(last!.href)

        reader.destroy()
        book.destroy?.()
    }, 10000)

    it('activates the copyright TOC entry for Lifestyle Gurus section-start KF8 links', async () => {
        const buf = await readFile('data/Lifestyle Gurus.azw3')
        const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
        const book = await mobi().parse(ab, {
            domAdapter: new NodeDOMAdapter(),
            urlFactory: new NodeURLFactory(),
        })
        const copyright = book.toc?.find(item => item.label === 'Copyright page')
        expect(copyright).toBeDefined()

        const container = document.createElement('div')
        container.setAttribute('data-width', '960')
        container.setAttribute('data-height', '480')
        document.body.appendChild(container)

        const reader = createReader({
            container,
            layout: 'paginated',
            maxColumnCount: 2,
            styles: { fontSize: '16px', lineHeight: 1.7, minColumnWidth: '320px', maxColumnWidth: '720px', margin: '32px' },
        })
        let activeLabel: string | null = null
        reader.on('relocate', event => {
            activeLabel = event.tocItem?.label ?? null
        })

        await reader.openBook(book)
        await reader.goTo(copyright!.href)
        ;(container.firstElementChild as HTMLElement).dispatchEvent(new window.Event('scroll'))

        expect(activeLabel).toBe('Copyright page')

        reader.destroy()
        book.destroy?.()
    }, 10000)

    it('navigates to Lifestyle Gurus KF8 subsection links with zero offsets', async () => {
        const buf = await readFile('data/Lifestyle Gurus.azw3')
        const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
        const book = await mobi().parse(ab, {
            domAdapter: new NodeDOMAdapter(),
            urlFactory: new NodeURLFactory(),
        })
        const subsection = book.toc?.[4]?.subitems?.find(item =>
            item.label === 'De-Traditionalisation and its Discontents')
        expect(subsection).toBeDefined()

        const container = document.createElement('div')
        container.setAttribute('data-width', '960')
        container.setAttribute('data-height', '480')
        document.body.appendChild(container)

        const reader = createReader({
            container,
            layout: 'paginated',
            maxColumnCount: 2,
            styles: { fontSize: '16px', lineHeight: 1.7, minColumnWidth: '320px', maxColumnWidth: '720px', margin: '32px' },
        })
        let activeLabel: string | null = null
        reader.on('relocate', event => {
            activeLabel = event.tocItem?.label ?? null
        })

        await reader.openBook(book)
        await reader.goTo(subsection!.href)

        expect(activeLabel).toBe('De-Traditionalisation and its Discontents')
        expect(container.textContent).toContain('De-Traditionalisation and its Discontents')

        reader.destroy()
        book.destroy?.()
    }, 10000)

    it('activates the first TOC entry on initial load for data/1.mobi', async () => {
        const buf = await readFile('data/1.mobi')
        const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
        const book = await mobi().parse(ab, {
            domAdapter: new NodeDOMAdapter(),
            urlFactory: new NodeURLFactory(),
        })

        expect(book.toc?.[0]?.label).toBe('版权信息')

        const container = document.createElement('div')
        container.setAttribute('data-width', '960')
        container.setAttribute('data-height', '480')
        document.body.appendChild(container)

        const reader = createReader({
            container,
            layout: 'paginated',
            maxColumnCount: 2,
            styles: { fontSize: '16px', lineHeight: 1.7, minColumnWidth: '320px', maxColumnWidth: '720px', margin: '32px' },
        })
        let activeLabel: string | null = null
        reader.on('relocate', event => {
            activeLabel = event.tocItem?.label ?? null
        })

        await reader.openBook(book)
        await reader.goTo(0)

        expect(activeLabel).toBe('版权信息')

        reader.destroy()
        book.destroy?.()
    })

    it('keeps data/1.mobi active TOC order monotonic while paging forward', async () => {
        const buf = await readFile('data/1.mobi')
        const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
        const book = await mobi().parse(ab, {
            domAdapter: new NodeDOMAdapter(),
            urlFactory: new NodeURLFactory(),
        })
        const tocOrder = new Map(flattenTestTOC(book.toc ?? []).map((item, index) => [item.href, index]))

        const container = document.createElement('div')
        container.setAttribute('data-width', '960')
        container.setAttribute('data-height', '480')
        document.body.appendChild(container)

        const reader = createReader({
            container,
            layout: 'paginated',
            maxColumnCount: 2,
            styles: { fontSize: '16px', lineHeight: 1.7, minColumnWidth: '320px', maxColumnWidth: '720px', margin: '32px' },
        })
        const activeIndexes: number[] = []
        reader.on('relocate', event => {
            const href = event.tocItem?.href
            const index = href ? tocOrder.get(href) : undefined
            if (index != null) activeIndexes.push(index)
        })

        await reader.openBook(book)
        await reader.goTo(0)
        for (let i = 0; i < 40; i++) await reader.next()

        expect(activeIndexes.length).toBeGreaterThan(0)
        for (let i = 1; i < activeIndexes.length; i++) {
            expect(activeIndexes[i]).toBeGreaterThanOrEqual(activeIndexes[i - 1])
        }

        reader.destroy()
        book.destroy?.()
    })
})

class FakeFixedRenderer implements Renderer {
    opened = 0
    destroyed = 0
    book: Book | null = null
    styles: RendererStyles | null = null
    layout: LayoutMode | null = null
    spread: number | null = null
    listeners = new Map<string, Set<EventListener>>()
    private marks = new Map<string, ReaderMark>()

    async open(book: Book): Promise<void> {
        this.opened += 1
        this.book = book
    }

    async goTo(): Promise<void> {}
    async next(): Promise<void> {}
    async prev(): Promise<void> {}
    async goToFraction(): Promise<void> {}
    setStyles(styles: RendererStyles): void { this.styles = styles }
    setLayout(mode: LayoutMode): void { this.layout = mode }
    setSpread(maxColumns: number): void { this.spread = maxColumns }
    setMark(mark: ReaderMark): void { this.marks.set(mark.id, mark) }
    removeMark(id: string): void { this.marks.delete(id) }
    clearMarks(kind?: string): void {
        if (kind) {
            for (const [id, mark] of this.marks) {
                if (mark.kind === kind) this.marks.delete(id)
            }
        } else {
            this.marks.clear()
        }
    }
    getMarks(): ReaderMark[] { return Array.from(this.marks.values()) }
    getLocation(): RelocateEvent | null { return null }
    getSectionFractions(): number[] { return [] }
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
    destroy(): void { this.destroyed += 1 }
}

function flattenTestTOC(items: NonNullable<Book['toc']>): NonNullable<Book['toc']>[number][] {
    return items.flatMap(item =>
        item.subitems?.length
            ? [item, ...flattenTestTOC(item.subitems)]
            : [item]
    )
}

function flattenTestTOCView(items: readonly TOCViewItem[]): TOCViewItem[] {
    return items.flatMap(item =>
        item.children?.length
            ? [item, ...flattenTestTOCView(item.children)]
            : [item]
    )
}
