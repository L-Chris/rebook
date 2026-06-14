import { decodeLegacyChineseBytes } from './legacy-text'

export interface DecodePdfTextStringOptions {
  keepEscapeSequence?: boolean
}

export const decodePdfTextString = (
  value: string,
  options: DecodePdfTextStringOptions = {},
): string => {
  const decoded = decodeUnicodeTextString(value)
  if (decoded !== undefined) return options.keepEscapeSequence ? decoded : stripLanguageTags(decoded)
  const legacyChinese = decodeLegacyChineseBytes(value)
  if (legacyChinese !== undefined) return legacyChinese
  return decodePdfDocEncoding(value, options.keepEscapeSequence === true)
}

const decodeUnicodeTextString = (value: string): string | undefined => {
  if (value.length >= 2 && value.charCodeAt(0) === 0xfe && value.charCodeAt(1) === 0xff) {
    return decodeUtf16(value, 2, true)
  }
  if (value.length >= 2 && value.charCodeAt(0) === 0xff && value.charCodeAt(1) === 0xfe) {
    return decodeUtf16(value, 2, false)
  }
  if (value.length >= 3 && value.charCodeAt(0) === 0xef && value.charCodeAt(1) === 0xbb && value.charCodeAt(2) === 0xbf) {
    return decodeUtf8(value, 3)
  }
  return undefined
}

const decodeUtf16 = (value: string, offset: number, bigEndian: boolean): string => {
  let output = ''
  const end = value.length - ((value.length - offset) % 2)
  for (let index = offset; index + 1 < end; index += 2) {
    const first = value.charCodeAt(index) & 0xff
    const second = value.charCodeAt(index + 1) & 0xff
    output += String.fromCharCode(bigEndian ? (first << 8) | second : (second << 8) | first)
  }
  return output
}

const decodeUtf8 = (value: string, offset: number): string => {
  let output = ''
  for (let index = offset; index < value.length;) {
    const first = value.charCodeAt(index++) & 0xff
    if (first < 0x80) {
      output += String.fromCharCode(first)
      continue
    }
    const length = first >= 0xf0 ? 4 : first >= 0xe0 ? 3 : first >= 0xc0 ? 2 : 0
    if (length === 0 || index + length - 1 > value.length) {
      output += replacementCharacter
      continue
    }
    let codePoint = first & ((1 << (7 - length)) - 1)
    let valid = true
    for (let seen = 1; seen < length; seen++) {
      const next = value.charCodeAt(index++) & 0xff
      if ((next & 0xc0) !== 0x80) {
        valid = false
        break
      }
      codePoint = (codePoint << 6) | (next & 0x3f)
    }
    output += valid && isValidUtf8CodePoint(codePoint, length) ? String.fromCodePoint(codePoint) : replacementCharacter
  }
  return output
}

const isValidUtf8CodePoint = (codePoint: number, length: number): boolean => {
  const minimum = length === 2 ? 0x80 : length === 3 ? 0x800 : 0x10000
  return codePoint >= minimum && codePoint <= 0x10ffff && (codePoint < 0xd800 || codePoint > 0xdfff)
}

const decodePdfDocEncoding = (value: string, keepEscapeSequence: boolean): string => {
  let output = ''
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    if (!keepEscapeSequence && code === 0x1b) {
      while (++index < value.length && value.charCodeAt(index) !== 0x1b) {}
      continue
    }
    const mapped = code <= 0xff ? pdfDocEncoding[code] : undefined
    output += mapped ? String.fromCharCode(mapped) : value[index]
  }
  return output
}

const stripLanguageTags = (value: string): string =>
  value.includes('\x1b') ? value.replace(/\x1b[^\x1b]*(?:\x1b|$)/g, '') : value

const replacementCharacter = '\ufffd'

const pdfDocEncoding: Readonly<Record<number, number>> = {
  0x18: 0x02d8,
  0x19: 0x02c7,
  0x1a: 0x02c6,
  0x1b: 0x02d9,
  0x1c: 0x02dd,
  0x1d: 0x02db,
  0x1e: 0x02da,
  0x1f: 0x02dc,
  0x80: 0x2022,
  0x81: 0x2020,
  0x82: 0x2021,
  0x83: 0x2026,
  0x84: 0x2014,
  0x85: 0x2013,
  0x86: 0x0192,
  0x87: 0x2044,
  0x88: 0x2039,
  0x89: 0x203a,
  0x8a: 0x2212,
  0x8b: 0x2030,
  0x8c: 0x201e,
  0x8d: 0x201c,
  0x8e: 0x201d,
  0x8f: 0x2018,
  0x90: 0x2019,
  0x91: 0x201a,
  0x92: 0x2122,
  0x93: 0xfb01,
  0x94: 0xfb02,
  0x95: 0x0141,
  0x96: 0x0152,
  0x97: 0x0160,
  0x98: 0x0178,
  0x99: 0x017d,
  0x9a: 0x0131,
  0x9b: 0x0142,
  0x9c: 0x0153,
  0x9d: 0x0161,
  0x9e: 0x017e,
  0xa0: 0x20ac,
}
