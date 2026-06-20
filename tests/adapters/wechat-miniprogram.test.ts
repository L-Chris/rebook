import { describe, expect, it, vi } from 'vitest'
import { EPUBParser } from '../../src/parsers/epub'
import {
  WechatMiniProgramDOMAdapter,
  WechatMiniProgramURLFactory,
} from '../../src/adapters/wechat-miniprogram'
import { createWechatMiniProgramRenderer } from '../../src/renderers/wechat-miniprogram'
import { createTestEPUB } from '../fixtures/epub-fixture'

describe('Wechat Mini Program adapters', () => {
  it('parse EPUB content without browser or Node-specific adapter APIs', async () => {
    const parser = new EPUBParser()
    const buffer = await createTestEPUB({
      title: 'Mini Program Book',
      chapters: [
        {
          id: 'chapter',
          title: 'Chapter 1',
          content: '<html xmlns="http://www.w3.org/1999/xhtml"><body><p id="start">Hello Mini Program</p></body></html>',
        },
      ],
    })

    const book = await parser.parse(buffer, {
      domAdapter: new WechatMiniProgramDOMAdapter(),
      urlFactory: new WechatMiniProgramURLFactory(),
    })

    expect(book.metadata?.title).toBe('Mini Program Book')
    expect(book.sections).toHaveLength(1)
    expect(book.resolveHref?.('OEBPS/chapter.xhtml#start')?.index).toBe(0)
    expect(await book.sections[0].load()).toContain('Hello Mini Program')
  })

  it('renders parsed EPUB content with the WeChat Mini Program renderer', async () => {
    vi.stubGlobal('OffscreenCanvas', undefined)
    vi.stubGlobal('wx', createMockWx())

    const parser = new EPUBParser()
    const buffer = await createTestEPUB({
      chapters: [
        {
          id: 'chapter',
          title: 'Chapter 1',
          content: '<html xmlns="http://www.w3.org/1999/xhtml"><body><p>Visible mini program reader text.</p></body></html>',
        },
      ],
    })
    const book = await parser.parse(buffer, {
      domAdapter: new WechatMiniProgramDOMAdapter(),
      urlFactory: new WechatMiniProgramURLFactory(),
    })
    const renderer = createWechatMiniProgramRenderer({
      width: 320,
      height: 180,
      layout: 'paginated',
      styles: { fontSize: '16px', lineHeight: 1.5, margin: '16px' },
      wx: createMockWx(),
    })

    await renderer.open(book)
    await renderer.goTo(0)

    const snapshot = renderer.getSnapshot()
    const text = snapshot.lines
      .flatMap(line => line.fragments.map(fragment => fragment.text))
      .join('')
    expect(snapshot.sectionIndex).toBe(0)
    expect(snapshot.lines.length).toBeGreaterThan(0)
    expect(text).toContain('Visible mini program reader text.')
  })

  it('writes image resources to local mini program files when filesystem APIs are available', () => {
    const writes: Array<{ filePath: string; data: unknown; encoding?: string }> = []
    const unlinks: string[] = []
    vi.stubGlobal('wx', {
      env: { USER_DATA_PATH: 'wxfile://user' },
      getFileSystemManager: () => ({
        writeFileSync(filePath: string, data: unknown, encoding?: string) {
          writes.push({ filePath, data, encoding })
        },
        unlinkSync(filePath: string) {
          unlinks.push(filePath)
        },
      }),
      arrayBufferToBase64(buffer: ArrayBuffer) {
        return Buffer.from(buffer).toString('base64')
      },
    })

    try {
      const factory = new WechatMiniProgramURLFactory()
      const buffer = new Uint8Array([1, 2, 3]).buffer
      const url = factory.createURL(buffer, 'image/jpeg')

      expect(url).toMatch(/^wxfile:\/\/user\/rebook-resource-.+\.jpg$/)
      expect(writes).toHaveLength(1)
      expect(writes[0].data).toBe(buffer)
      expect(factory.getData(url)?.mimeType).toBe('image/jpeg')

      factory.revokeURL(url)
      expect(unlinks).toEqual([url])
      expect(factory.getData(url)).toBeUndefined()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

function createMockWx() {
  return {
    arrayBufferToBase64(buffer: ArrayBuffer) {
      return Buffer.from(buffer).toString('base64')
    },
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
