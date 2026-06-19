import { describe, expect, it } from 'vitest'
import {
    BUILT_IN_READER_THEMES,
    mergeRendererStyles,
    resolveReaderTheme,
    resolveRendererStyles,
} from '../../src/core/theme'

describe('reader themes', () => {
    it('resolves built-in theme names', () => {
        expect(resolveReaderTheme('normal')).toEqual(BUILT_IN_READER_THEMES.normal)
        expect(resolveReaderTheme('night')).toEqual(BUILT_IN_READER_THEMES.night)
    })

    it('applies theme defaults without overriding explicit style colors', () => {
        expect(resolveRendererStyles({
            theme: 'night',
            color: '#ff0000',
        })).toMatchObject({
            theme: 'night',
            color: '#ff0000',
            background: BUILT_IN_READER_THEMES.night.background,
            pageBackground: BUILT_IN_READER_THEMES.night.pageBackground,
            fixedPageVisualAppearance: BUILT_IN_READER_THEMES.night.fixedPageVisualAppearance,
            selectionBackground: BUILT_IN_READER_THEMES.night.selectionBackground,
        })
    })

    it('resets theme-owned colors when switching themes', () => {
        const normal = resolveRendererStyles({
            theme: 'normal',
            fontSize: '16px',
        })

        expect(mergeRendererStyles(normal, { theme: 'night' })).toMatchObject({
            theme: 'night',
            fontSize: '16px',
            color: BUILT_IN_READER_THEMES.night.color,
            background: BUILT_IN_READER_THEMES.night.background,
            pageBackground: BUILT_IN_READER_THEMES.night.pageBackground,
            fixedPageVisualAppearance: BUILT_IN_READER_THEMES.night.fixedPageVisualAppearance,
        })
    })
})
