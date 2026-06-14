import { ContentDictToken, ContentNameToken, ContentToken, isContentString } from './content'
import { identityFontDecoder, PdfFontDecoder, PdfFontMap, PdfTextAdvanceOptions } from './fonts'
import { PdfTextRun } from '../types'

export interface PdfTextState {
  fontSize: number
  fontName?: string
  charSpacing: number
  wordSpacing: number
  horizontalScale: number
}

export const isContentName = (token: ContentToken | undefined): token is ContentNameToken =>
  Boolean(token && typeof token === 'object' && !Array.isArray(token) && token.type === 'name')

export const isContentDict = (token: ContentToken | undefined): token is ContentDictToken =>
  Boolean(token && typeof token === 'object' && !Array.isArray(token) && token.type === 'dict')

export const contentTextValue = (token: ContentToken | undefined): string =>
  isContentString(token) ? token.value : typeof token === 'string' ? token : ''

export const currentPdfFont = (fontName: string | undefined, fonts: PdfFontMap | undefined): PdfFontDecoder =>
  (fontName ? fonts?.get(fontName) : undefined) ?? identityFontDecoder

export const pdfTextAdvanceOptions = (state: PdfTextState): PdfTextAdvanceOptions => ({
  fontSize: state.fontSize,
  charSpacing: state.charSpacing,
  wordSpacing: state.wordSpacing,
  horizontalScale: state.horizontalScale,
})

export const advancePdfText = (text: string, font: PdfFontDecoder, state: PdfTextState): number => {
  const options = pdfTextAdvanceOptions(state)
  return font.advanceWidth?.(text, options) ?? identityFontDecoder.advanceWidth?.(text, options) ?? 0
}

export const pdfFontRunStyle = (font: PdfFontDecoder): Partial<PdfTextRun> => {
  const style = font.style
  if (!style) return {}
  return {
    fontFamily: style.family,
    ...(style.weight ? { fontWeight: style.weight } : {}),
    ...(style.style ? { fontStyle: style.style } : {}),
    ...(style.source ? { fontSource: style.source } : {}),
  }
}
