import { describe, expect, it, vi } from 'vitest'
import type { Book } from '../../src/core/types'
import { installPretextMeasurementPolyfill } from '../../src/core/pretext'
import { WechatMiniProgramRenderer, createWechatMiniProgramReader, createWechatMiniProgramRenderer } from '../../src/renderers/wechat-miniprogram'

describe('WechatMiniProgramRenderer', () => {
    it('installs a wx.createOffscreenCanvas polyfill for Pretext measurement', () => {
        vi.stubGlobal('OffscreenCanvas', undefined)
        let measured = ''
        const installed = installPretextMeasurementPolyfill({
            createOffscreenCanvas: () => ({
                getContext: () => ({
                    font: '16px serif',
                    measureText(text: string) {
                        measured = text
                        return { width: text.length * 8 }
                    },
                }),
            }),
        })

        expect(installed).toBe(true)
        const canvas = new OffscreenCanvas(1, 1)
        const context = canvas.getContext('2d')!
        expect(context.measureText('hello').width).toBe(40)
        expect(measured).toBe('hello')
    })

    it('renders visible lines into a serializable Mini Program snapshot', async () => {
        vi.stubGlobal('OffscreenCanvas', undefined)
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
        const snapshots: unknown[] = []
        const renderer = new WechatMiniProgramRenderer({
            width: 360,
            height: 96,
            layout: 'paginated',
            styles: { fontSize: '16px', lineHeight: 1.5, margin: '16px', maxInlineSize: '260px' },
            wx: createMockWx(),
            setData: snapshot => snapshots.push(snapshot),
        })

        await renderer.open(book)
        await renderer.goTo(0)

        const snapshot = renderer.getSnapshot()
        expect(snapshot.sectionIndex).toBe(0)
        expect(snapshot.pageCount).toBeGreaterThan(1)
        expect(snapshot.lines.length).toBeGreaterThan(0)
        expect(snapshot.lines.length).toBeLessThan(80)
        expect(snapshot.lines[0].kind).toBe('text')
        expect(JSON.stringify(snapshot)).toContain('word0')
        expect(snapshots.length).toBeGreaterThan(0)
    })

    it('renders reader marks into Mini Program line snapshots', async () => {
        vi.stubGlobal('OffscreenCanvas', undefined)
        const book: Book = {
            sections: [{
                id: 'chapter.xhtml',
                size: 48,
                format: 'xhtml',
                load: () => '',
                getBlocks: () => [{
                    id: 'p1',
                    type: 'paragraph',
                    segments: [{ text: 'Marked text should receive snapshot metadata.' }],
                }],
            }],
        }
        const renderer = new WechatMiniProgramRenderer({
            width: 360,
            height: 96,
            layout: 'paginated',
            styles: { fontSize: '16px', lineHeight: 1.5, margin: '16px', maxInlineSize: '260px' },
            wx: createMockWx(),
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

        const markedLine = renderer.getSnapshot().lines.find(line => line.className?.includes('is-current'))
        expect(markedLine?.blockId).toBe('p1')
        expect(markedLine?.className).toContain('is-current')
        expect(markedLine?.className).toContain('rebook-mark-tts')
        expect(markedLine?.markIds).toEqual(['current'])
        expect(markedLine?.markData).toEqual({ segmentId: 's1' })
    })

    it('navigates pages and preserves renderer interface events', async () => {
        vi.stubGlobal('OffscreenCanvas', undefined)
        const blocks = Array.from({ length: 12 }, (_, index) => ({
            id: `b${index}`,
            type: 'paragraph' as const,
            segments: [{ text: `Block ${index} contains enough words to wrap across the reader viewport.` }],
        }))
        const book: Book & { translationPrefetchPageCount: number } = {
            translationPrefetchPageCount: 1,
            sections: [{
                id: 'chapter.xhtml',
                size: 500,
                format: 'xhtml',
                load: () => '',
                getBlocks: () => blocks,
            }],
        }
        const renderer = createWechatMiniProgramRenderer({
            width: 320,
            height: 90,
            layout: 'paginated',
            styles: { fontSize: '16px', lineHeight: 1.5, margin: '12px' },
            wx: createMockWx(),
        })
        const relocations: number[] = []
        let blockWindow: string[] = []
        renderer.on('relocate', event => relocations.push(event.fraction))
        renderer.on('block-window', event => {
            blockWindow = event.blockIds
        })

        await renderer.open(book)
        await renderer.goTo(0)
        const firstPage = renderer.getSnapshot().pageIndex
        await renderer.next()

        expect(firstPage).toBe(0)
        expect(renderer.getSnapshot().pageIndex).toBe(1)
        expect(renderer.getLocation()?.index).toBe(0)
        expect(relocations.length).toBeGreaterThan(1)
        expect(blockWindow.length).toBeGreaterThan(0)
        expect(blocks.some(block => block.id === blockWindow[0])).toBe(true)
    })

    it('applies configured book plugins in the Mini Program reader before rendering', async () => {
        vi.stubGlobal('OffscreenCanvas', undefined)
        const book: Book = {
            sections: [{
                id: 'chapter.xhtml',
                size: 100,
                format: 'xhtml',
                load: () => '',
                getBlocks: () => [{
                    id: 'original',
                    type: 'paragraph',
                    segments: [{ text: 'Original text' }],
                }],
            }],
        }
        const reader = createWechatMiniProgramReader({
            width: 320,
            height: 120,
            layout: 'paginated',
            styles: { fontSize: '16px', lineHeight: 1.5, margin: '12px' },
            wx: createMockWx(),
            plugins: [
                input => ({
                    ...input,
                    sections: input.sections.map(section => ({
                        ...section,
                        getBlocks: () => [{
                            id: 'plugin-block',
                            type: 'paragraph',
                            segments: [{ text: 'Plugin rendered text' }],
                        }],
                    })),
                }),
            ],
        })

        await reader.openBook(book)
        await reader.goTo(0)

        expect(JSON.stringify(reader.getSnapshot())).toContain('Plugin rendered text')
        expect(JSON.stringify(reader.getSnapshot())).not.toContain('Original text')

        reader.destroy()
    })
})

function createMockWx() {
    return {
        createOffscreenCanvas: () => ({
            getContext: () => ({
                font: '16px serif',
                measureText(text: string) {
                    const fontSize = Number(this.font.match(/([\d.]+)px/)?.[1] ?? 16)
                    const width = Array.from(text).reduce((sum, char) => {
                        if (char === ' ') return sum + fontSize * 0.32
                        if (/[\u4e00-\u9fff]/.test(char)) return sum + fontSize
                        return sum + fontSize * 0.54
                    }, 0)
                    return { width }
                },
            }),
        }),
    }
}
