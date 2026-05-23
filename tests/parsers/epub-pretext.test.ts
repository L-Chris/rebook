import { readFile } from 'node:fs/promises'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { EPUBParser } from '../../src/parsers/epub'
import { TestDOMAdapter, TestURLFactory } from '../../src/adapters/test'
import { layout, prepare, type TextSegment } from '../../src/core/pretext'
import { createTestEPUB } from '../fixtures/epub-fixture'

beforeAll(() => {
    vi.stubGlobal('OffscreenCanvas', class {
        getContext() {
            return {
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
            }
        }
    })
})

describe('EPUB Pretext segments', () => {
    it('exposes styled segments on EPUB sections', async () => {
        const parser = new EPUBParser()
        const book = await parser.parse(await createTestEPUB({
            chapters: [{
                id: 'styled',
                title: 'Styled',
                content: '<html xmlns="http://www.w3.org/1999/xhtml"><body><p>Plain <strong>bold</strong> <em style="color: red">red</em></p></body></html>',
            }],
        }), {
            domAdapter: new TestDOMAdapter(),
            urlFactory: new TestURLFactory(),
        })

        const segments = await book.sections[0].getSegments?.()
        expect(segments).toBeDefined()
        expect(segments?.map(segment => segment.text).join('')).toBe('Plain bold red')
        expect(segments?.some(segment => segment.style?.fontWeight === '700')).toBe(true)
        expect(segments?.some(segment => segment.style?.color === 'red')).toBe(true)

        const blocks = await book.sections[0].getBlocks?.()
        expect(blocks?.map(block => block.type)).toEqual(['paragraph'])
        expect(blocks?.[0].segments.some(segment => segment.style?.fontWeight === '700')).toBe(true)
    })

    it('can prepare and layout a real EPUB from data/', async () => {
        const parser = new EPUBParser()
        const data = await readFile('data/1.epub')
        const book = await parser.parse(data.buffer.slice(
            data.byteOffset,
            data.byteOffset + data.byteLength,
        ), {
            domAdapter: new TestDOMAdapter(),
            urlFactory: new TestURLFactory(),
        })

        let segments: TextSegment[] = []
        for (const section of book.sections) {
            const candidate = await section.getSegments?.()
            if (candidate?.some(segment => segment.text.trim())) {
                segments = candidate
                break
            }
        }
        expect(segments?.length).toBeGreaterThan(0)

        const prepared = prepare(segments!, { baseStyle: { fontSize: 16, lineHeight: 1.5 } })
        const lines = layout(prepared, { inlineSize: 360 })

        expect(prepared.blocks.length).toBeGreaterThan(0)
        expect(lines.length).toBeGreaterThan(0)
        expect(lines[0].segments.length).toBeGreaterThan(0)
        expect(lines.every(line => line.width <= 360 || line.segments.length === 1)).toBe(true)
    })
})
