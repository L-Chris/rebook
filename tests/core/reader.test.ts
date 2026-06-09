import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ReaderSession, type TOCViewItem } from '../../src/core/reader'
import type { Book, RelocateEvent } from '../../src/core/types'
import type { LayoutMode, ReaderMark, Renderer, RendererStyles } from '../../src/core/renderer'
import { EPUBParser } from '../../src/parsers/epub'
import { NodeDOMAdapter, NodeURLFactory } from '../../src/adapters/node'

class FakeRenderer implements Renderer {
    private book: Book | null = null
    private location: RelocateEvent | null = null

    async open(book: Book): Promise<void> {
        this.book = book
        this.location = { index: 0, fraction: 0, totalFraction: 0 }
    }

    async goTo(): Promise<void> {}
    async next(): Promise<void> {}
    async prev(): Promise<void> {}
    async goToFraction(): Promise<void> {}
    setStyles(_styles: RendererStyles): void {}
    setLayout(_mode: LayoutMode): void {}
    setSpread(_maxColumns: number): void {}
    setMark(_mark: ReaderMark): void {}
    removeMark(_id: string): void {}
    clearMarks(_kind?: string): void {}
    getMarks(): ReaderMark[] { return [] }
    getLocation(): RelocateEvent | null { return this.location }
    getSectionFractions(): number[] {
        const count = this.book?.sections.length ?? 0
        return Array.from({ length: count + 1 }, (_, index) => count > 0 ? index / count : 0)
    }
    on(): void {}
    off(): void {}
    destroy(): void {}

    setLocation(location: RelocateEvent): void {
        this.location = location
    }
}

describe('ReaderSession', () => {
    it('resolves active TOC items efficiently for books with many sections', async () => {
        const renderer = new FakeRenderer()
        const sectionCount = 2_050
        const book: Book = {
            sections: Array.from({ length: sectionCount }, (_, index) => ({
                id: `OEBPS/Text/chapter_${index}.html`,
                size: 1_000,
                load: () => `<p>${index}</p>`,
            })),
            toc: Array.from({ length: sectionCount }, (_, index) => ({
                label: `Chapter ${index}`,
                href: `Text/chapter_${index}.html`,
            })),
            splitTOCHref(href) {
                return [`OEBPS/${href}`, null]
            },
            destroy() {},
        }
        const reader = new ReaderSession({ createRenderer: () => renderer })
        await reader.openBook(book)
        renderer.setLocation({ index: 1_500, fraction: 0, totalFraction: 0.73 })

        const active = reader.getCurrentTOCItem(renderer.getLocation())
        const items = reader.getTOCViewItems({ location: renderer.getLocation() })

        expect(active?.href).toBe('Text/chapter_1500.html')
        expect(items).toHaveLength(sectionCount)
        expect(flattenTOCViewItems(items).find(item => item.active)?.target).toBe('Text/chapter_1500.html')
        expect(items[1_500].target).toBe('Text/chapter_1500.html')
    })

    it('marks active TOC view items for real EPUB books with different TOC shapes', async () => {
        const filenames = [
            '1.epub',
            'Structured Writing Rhetoric and Process.epub',
            '洛丽塔.epub',
            '我在精神病院学斩神.epub',
        ]

        for (const filename of filenames) {
            const data = await readFile(`data/${filename}`)
            const parser = new EPUBParser()
            const book = await parser.parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), {
                domAdapter: new NodeDOMAdapter(),
                urlFactory: new NodeURLFactory(),
            })
            const tocItems = flattenTOCItems(book.toc ?? [])
            expect(tocItems.length, filename).toBeGreaterThan(0)

            const sampleItems = [
                tocItems[0],
                tocItems[Math.floor(tocItems.length / 2)],
                tocItems[tocItems.length - 1],
            ]
            const renderer = new FakeRenderer()
            const reader = new ReaderSession({ createRenderer: () => renderer })
            await reader.openBook(book)

            for (const item of sampleItems) {
                const resolved = book.resolveHref?.(item.href)
                expect(resolved?.index, `${filename}: ${item.href}`).toEqual(expect.any(Number))
                renderer.setLocation({
                    index: resolved!.index,
                    fraction: 0,
                    totalFraction: resolved!.index / book.sections.length,
                    tocItem: undefined,
                })

                const active = flattenTOCViewItems(reader.getTOCViewItems({ location: renderer.getLocation() }))
                    .find(viewItem => viewItem.active)
                expect(active, `${filename}: ${item.href}`).toBeTruthy()
            }

            book.destroy?.()
        }
    }, 10000)

    it('falls back to the current section TOC item when a browser relocate event has no toc item', async () => {
        const data = await readFile('data/洛丽塔.epub')
        const parser = new EPUBParser()
        const book = await parser.parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), {
            domAdapter: new NodeDOMAdapter(),
            urlFactory: new NodeURLFactory(),
        })
        const renderer = new FakeRenderer()
        const reader = new ReaderSession({ createRenderer: () => renderer })
        await reader.openBook(book)

        for (const [index, label] of [
            [1, '洛丽塔'],
            [2, '版权信息'],
            [3, '目录'],
            [4, '序文'],
        ] as const) {
            renderer.setLocation({ index, fraction: 0, totalFraction: 0, tocItem: undefined })
            const location = renderer.getLocation()
            const active = reader.getCurrentTOCItem(location)
            const viewActive = flattenTOCViewItems(reader.getTOCViewItems({ location })).find(item => item.active)

            expect(active?.label, `index ${index}`).toBe(label)
            expect(viewActive?.label, `index ${index}`).toBe(label)
        }

        book.destroy?.()
    }, 10000)
})

function flattenTOCItems(items: readonly NonNullable<Book['toc']>[number][]): NonNullable<Book['toc']>[number][] {
    return items.flatMap(item => item.subitems?.length ? [item, ...flattenTOCItems(item.subitems)] : [item])
}

function flattenTOCViewItems(items: readonly TOCViewItem[]): TOCViewItem[] {
    return items.flatMap(item => item.children?.length ? [item, ...flattenTOCViewItems(item.children)] : [item])
}
