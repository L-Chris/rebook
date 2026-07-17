import { describe, expect, it } from 'vitest'
import {
    getRendererDefaultFontFamily,
    resolveRendererFontFamily,
    resolveTextBlockFontFamilies,
} from '../../src/core/font-family'
import type { RendererStyles } from '../../src/core/renderer'

const styles: RendererStyles = {
    fontFamilies: {
        default: 'serif',
        serif: '"Bitter", "Noto Serif SC", serif',
        sansSerif: '"Roboto", "Noto Sans SC", sans-serif',
        monospace: '"Fira Code", monospace',
    },
}

describe('renderer font families', () => {
    it('uses the selected default semantic family', () => {
        expect(getRendererDefaultFontFamily(styles)).toBe('"Bitter", "Noto Serif SC", serif')
    })

    it('preserves named book fonts while replacing generic fallbacks', () => {
        expect(resolveRendererFontFamily('"Book Serif", serif', styles))
            .toBe('"Book Serif", "Bitter", "Noto Serif SC", serif')
        expect(resolveRendererFontFamily('sans-serif', styles))
            .toBe('"Roboto", "Noto Sans SC", sans-serif')
    })

    it('overrides book fonts but keeps code monospace', () => {
        const resolved = resolveTextBlockFontFamilies([{
            id: 'p1',
            type: 'paragraph',
            style: { fontFamily: 'Book Serif' },
            segments: [
                { text: 'Body', style: { fontFamily: 'Book Serif' } },
                { text: 'code', style: { fontFamily: 'Book Code' }, source: { nodeType: 'code' } },
            ],
        }], { ...styles, overrideBookFonts: true })

        expect(resolved[0]?.style?.fontFamily).toBe('"Bitter", "Noto Serif SC", serif')
        expect(resolved[0]?.segments[0]?.style?.fontFamily).toBe('"Bitter", "Noto Serif SC", serif')
        expect(resolved[0]?.segments[1]?.style?.fontFamily).toBe('"Fira Code", monospace')
    })
})
