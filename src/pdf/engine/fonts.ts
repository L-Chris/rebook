import { bytesToLatin1 } from './bytes'
import { decodeLegacyChineseBytes } from './legacy-text'
import { isDict, isName, PdfDict, PdfFontSource, PdfName, PdfPrimitive } from '../types'

export interface PdfFontDecoder {
  decode(text: string): string
  advanceWidth?(text: string, options: PdfTextAdvanceOptions): number
  style?: PdfDecodedFontStyle
}

export interface PdfDecodedFontStyle {
  family: string
  weight?: string
  style?: 'normal' | 'italic' | 'oblique'
  source?: PdfFontSource
}

export type PdfFontMap = Map<string, PdfFontDecoder>

export interface PdfTextAdvanceOptions {
  fontSize: number
  charSpacing: number
  wordSpacing: number
  horizontalScale: number
}

export const identityFontDecoder: PdfFontDecoder = {
  decode: memoizeText((text) => decodeUtf16BeOrBytes(text)),
  advanceWidth: memoizeAdvance((text, options) => defaultAdvanceWidth(text, options, 500)),
}

export const createSimpleFontDecoder = (
  font: PdfDict,
  resolve: (value: PdfPrimitive | undefined) => PdfPrimitive | undefined,
  source?: PdfFontSource,
): PdfFontDecoder => {
  const encoding = resolve(font.entries.get('Encoding'))
  const table = createEncodingTable(encoding, resolve)
  const width = createSimpleWidthResolver(font, resolve, 500)
  const style = createFontStyle(font, resolve, source)
  const allowShortLegacyChinesePairs = isLegacyChineseFont(font, resolve)
  return {
    decode: memoizeText((text: string): string => {
      if (hasUtf16BeBom(text)) return decodeUtf16BeOrBytes(text)
      let output = ''
      for (let i = 0; i < text.length; i++) output += table[text.charCodeAt(i) & 0xff] ?? String.fromCharCode(text.charCodeAt(i) & 0xff)
      return decodeLegacyChineseBytes(output, { allowShortPairs: allowShortLegacyChinesePairs }) ?? output
    }),
    advanceWidth: memoizeAdvance((text, options) => advanceSimpleText(text, options, width)),
    ...(style ? { style } : {}),
  }
}

export const createToUnicodeFontDecoder = (
  cmapBytes: Uint8Array,
  font?: PdfDict,
  resolve?: (value: PdfPrimitive | undefined) => PdfPrimitive | undefined,
  source?: PdfFontSource,
): PdfFontDecoder => {
  const entries = parseToUnicodeCMap(bytesToLatin1(cmapBytes))
  const lengths = [...new Set([...entries.keys()].map((key) => key.length / 2))].sort((a, b) => b - a)
  const advanceWidth = font && resolve ? createFontAdvance(font, resolve) : undefined
  const style = font && resolve ? createFontStyle(font, resolve, source) : source ? sourceStyle(source) : undefined
  return {
    decode: memoizeText((text: string): string => {
      let output = ''
      for (let index = 0; index < text.length;) {
        let matched = false
        for (const length of lengths) {
          if (index + length > text.length) continue
          const key = stringBytesToHex(text, index, length)
          const value = entries.get(key)
          if (!value) continue
          output += value
          index += length
          matched = true
          break
        }
        if (!matched) output += String.fromCharCode(text.charCodeAt(index++) & 0xff)
      }
      return decodeLegacyChineseBytes(output) ?? output
    }),
    advanceWidth: advanceWidth ? memoizeAdvance(advanceWidth) : undefined,
    ...(style ? { style } : {}),
  }
}

export const createIdentityCidFontDecoder = (
  font?: PdfDict,
  resolve?: (value: PdfPrimitive | undefined) => PdfPrimitive | undefined,
  source?: PdfFontSource,
): PdfFontDecoder => {
  const width = font && resolve ? createCidWidthResolver(font, resolve, 1000) : () => 1000
  const style = font && resolve ? createFontStyle(font, resolve, source) : source ? sourceStyle(source) : undefined
  return {
    decode: memoizeText((text: string): string => {
      let output = ''
      for (let index = 0; index < text.length; index += 2) {
        const high = text.charCodeAt(index) & 0xff
        if (index + 1 >= text.length) output += String.fromCharCode(high)
        else output += String.fromCodePoint((high << 8) | (text.charCodeAt(index + 1) & 0xff))
      }
      return decodeLegacyChineseBytes(output) ?? output
    }),
    advanceWidth: memoizeAdvance((text, options) => advanceCidText(text, options, width)),
    ...(style ? { style } : {}),
  }
}

export const isIdentityCidFont = (
  font: PdfDict,
  resolve: (value: PdfPrimitive | undefined) => PdfPrimitive | undefined,
): boolean => {
  const subtype = resolve(font.entries.get('Subtype'))
  const encoding = resolve(font.entries.get('Encoding'))
  return isName(subtype, 'Type0') && (isName(encoding, 'Identity-H') || isName(encoding, 'Identity-V'))
}

export const createPdfFontSource = (
  font: PdfDict,
  resolve: (value: PdfPrimitive | undefined) => PdfPrimitive | undefined,
  data: Uint8Array,
  format?: string,
  toUnicodeCMap?: Uint8Array,
): PdfFontSource => {
  const name = fontDisplayName(font, resolve)
  const traits = fontTraits(font, resolve, name)
  const fallbackFamily = fontFallbackFamily(name, traits.generic)
  const id = `RebookPdfFont-${nextPdfFontSourceId++}`
  let browserData: Uint8Array | undefined
  return {
    id,
    family: id,
    fallbackFamily,
    data,
    ...(format === 'truetype'
      ? {
          getBrowserData: () => {
            browserData ??= prepareTrueTypeFontForBrowser(data, name, traits, toUnicodeCMap)
            return browserData
          },
        }
      : {}),
    ...(format ? { format } : {}),
    ...(traits.weight ? { weight: traits.weight } : {}),
    ...(traits.style ? { style: traits.style } : {}),
  }
}

const createFontStyle = (
  font: PdfDict,
  resolve: (value: PdfPrimitive | undefined) => PdfPrimitive | undefined,
  source?: PdfFontSource,
): PdfDecodedFontStyle | undefined => {
  if (source) return sourceStyle(source)
  return undefined
}

const sourceStyle = (source: PdfFontSource): PdfDecodedFontStyle => ({
  family: `${quoteCssFontFamily(source.family)}, ${source.fallbackFamily}`,
  ...(source.weight ? { weight: source.weight } : {}),
  ...(source.style ? { style: source.style } : {}),
  source,
})

const fontDisplayName = (
  font: PdfDict,
  resolve: (value: PdfPrimitive | undefined) => PdfPrimitive | undefined,
): string => {
  const descriptor = fontDescriptor(font, resolve)
  return stripFontSubsetPrefix(
    nameValue(resolve(font.entries.get('BaseFont'))) ??
    nameValue(descriptor ? resolve(descriptor.entries.get('FontName')) : undefined) ??
    descendantBaseFont(font, resolve) ??
    'RebookPdfFont',
  )
}

const descendantBaseFont = (
  font: PdfDict,
  resolve: (value: PdfPrimitive | undefined) => PdfPrimitive | undefined,
): string | undefined => {
  const descendants = resolve(font.entries.get('DescendantFonts'))
  const descendant = Array.isArray(descendants) ? resolve(descendants[0]) : undefined
  return isDict(descendant) ? nameValue(resolve(descendant.entries.get('BaseFont'))) : undefined
}

export const fontDescriptor = (
  font: PdfDict,
  resolve: (value: PdfPrimitive | undefined) => PdfPrimitive | undefined,
): PdfDict | undefined => {
  const direct = resolve(font.entries.get('FontDescriptor'))
  if (isDict(direct)) return direct
  const descendants = resolve(font.entries.get('DescendantFonts'))
  const descendant = Array.isArray(descendants) ? resolve(descendants[0]) : undefined
  if (!isDict(descendant)) return undefined
  const descriptor = resolve(descendant.entries.get('FontDescriptor'))
  return isDict(descriptor) ? descriptor : undefined
}

const fontTraits = (
  font: PdfDict,
  resolve: (value: PdfPrimitive | undefined) => PdfPrimitive | undefined,
  name: string,
): { weight?: string; style?: 'normal' | 'italic' | 'oblique'; generic: 'serif' | 'sans-serif' | 'monospace' } => {
  const descriptor = fontDescriptor(font, resolve)
  const normalized = name.replace(/[-_]/g, ' ')
  const bold = /\b(bold|black|heavy|demi|semibold)\b/i.test(normalized)
  const italicAngle = numberValue(descriptor ? resolve(descriptor.entries.get('ItalicAngle')) : undefined)
  const italic = /\b(italic|oblique)\b/i.test(normalized) || (italicAngle !== undefined && italicAngle !== 0)
  return {
    ...(bold ? { weight: '700' } : {}),
    ...(italic ? { style: /oblique/i.test(normalized) ? 'oblique' : 'italic' } : {}),
    generic: genericFontFamily(name),
  }
}

const genericFontFamily = (name: string): 'serif' | 'sans-serif' | 'monospace' => {
  if (/courier|mono|code|console/i.test(name)) return 'monospace'
  if (/serif|times|song|simsun|ming|kai|fangsong|liberationserif/i.test(name)) return 'serif'
  return 'sans-serif'
}

const fontFallbackFamily = (name: string, generic: 'serif' | 'sans-serif' | 'monospace'): string => {
  const family = quoteCssFontFamily(name)
  if (/simsun|song|ming|fangsong|kai/i.test(name)) return `${family}, "Songti SC", "Noto Serif CJK SC", "Source Han Serif SC", serif`
  if (generic === 'serif') return `${family}, "Liberation Serif", "Times New Roman", serif`
  if (generic === 'monospace') return `${family}, "Courier New", monospace`
  return `${family}, Arial, "Helvetica Neue", sans-serif`
}

const quoteCssFontFamily = (family: string): string =>
  `"${family.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`

const nameValue = (value: PdfPrimitive | undefined): string | undefined =>
  isName(value) ? value.value : typeof value === 'string' ? value : undefined

const stripFontSubsetPrefix = (name: string): string =>
  name.replace(/^[A-Z]{6}\+/, '')

let nextPdfFontSourceId = 1

const isLegacyChineseFont = (
  font: PdfDict,
  resolve: (value: PdfPrimitive | undefined) => PdfPrimitive | undefined,
): boolean => {
  const names = [
    nameValue(resolve(font.entries.get('BaseFont'))),
    nameValue(resolve(font.entries.get('Encoding'))),
    descendantBaseFont(font, resolve),
  ].filter(Boolean).join(' ')
  return /\b(?:GB|GBK|GB1|CNS|Big5|UniGB|STSong|SimSun|Song|Ming|Kai)(?:\b|-|_)/i.test(names)
}

const prepareTrueTypeFontForBrowser = (
  data: Uint8Array,
  family: string,
  traits: { weight?: string; style?: 'normal' | 'italic' | 'oblique'; generic: 'serif' | 'sans-serif' | 'monospace' },
  toUnicodeCMap?: Uint8Array,
): Uint8Array => {
  if (!toUnicodeCMap || hasSfntTable(data, 'cmap')) return data
  const cmap = createFormat4CmapTable(parseToUnicodeGlyphMap(bytesToLatin1(toUnicodeCMap)))
  if (!cmap) return data
  return addSfntTables(data, [
    { tag: 'cmap', data: cmap },
    { tag: 'name', data: createNameTable(family, traits) },
  ]) ?? data
}

const parseToUnicodeGlyphMap = (source: string): Map<number, number> => {
  const entries = parseToUnicodeCMap(source)
  const map = new Map<number, number>()
  for (const [hex, value] of entries) {
    const glyphId = Number.parseInt(hex, 16)
    const codePoint = value.codePointAt(0)
    if (!Number.isInteger(glyphId) || glyphId <= 0 || glyphId > 0xffff || codePoint === undefined || codePoint <= 0 || codePoint > 0xffff) continue
    if (!map.has(codePoint)) map.set(codePoint, glyphId)
  }
  return map
}

const createFormat4CmapTable = (glyphs: Map<number, number>): Uint8Array | undefined => {
  const mappings = [...glyphs]
    .filter(([codePoint]) => codePoint < 0xffff)
    .sort(([left], [right]) => left - right)
  if (mappings.length === 0 || mappings.length > 8191) return undefined
  const segCount = mappings.length + 1
  const segCountX2 = segCount * 2
  const entrySelector = Math.floor(Math.log2(segCount))
  const searchRange = 2 * (2 ** entrySelector)
  const rangeShift = segCountX2 - searchRange
  const length = 16 + segCount * 8
  const subtable = new Uint8Array(length)
  writeUint16(subtable, 0, 4)
  writeUint16(subtable, 2, length)
  writeUint16(subtable, 4, 0)
  writeUint16(subtable, 6, segCountX2)
  writeUint16(subtable, 8, searchRange)
  writeUint16(subtable, 10, entrySelector)
  writeUint16(subtable, 12, rangeShift)

  const endCodeOffset = 14
  const startCodeOffset = endCodeOffset + segCount * 2 + 2
  const deltaOffset = startCodeOffset + segCount * 2
  const rangeOffsetOffset = deltaOffset + segCount * 2
  mappings.forEach(([codePoint, glyphId], index) => {
    writeUint16(subtable, endCodeOffset + index * 2, codePoint)
    writeUint16(subtable, startCodeOffset + index * 2, codePoint)
    writeUint16(subtable, deltaOffset + index * 2, (glyphId - codePoint) & 0xffff)
    writeUint16(subtable, rangeOffsetOffset + index * 2, 0)
  })
  const sentinel = segCount - 1
  writeUint16(subtable, endCodeOffset + sentinel * 2, 0xffff)
  writeUint16(subtable, endCodeOffset + segCount * 2, 0)
  writeUint16(subtable, startCodeOffset + sentinel * 2, 0xffff)
  writeUint16(subtable, deltaOffset + sentinel * 2, 1)
  writeUint16(subtable, rangeOffsetOffset + sentinel * 2, 0)

  const table = new Uint8Array(12 + subtable.length)
  writeUint16(table, 0, 0)
  writeUint16(table, 2, 1)
  writeUint16(table, 4, 3)
  writeUint16(table, 6, 1)
  writeUint32(table, 8, 12)
  table.set(subtable, 12)
  return table
}

const createNameTable = (
  family: string,
  traits: { weight?: string; style?: 'normal' | 'italic' | 'oblique'; generic: 'serif' | 'sans-serif' | 'monospace' },
): Uint8Array => {
  const subfamily = traits.weight === '700' ? 'Bold' : traits.style && traits.style !== 'normal' ? 'Italic' : 'Regular'
  const fullName = `${family} ${subfamily}`
  const postScriptName = `${family}-${subfamily}`.replace(/[^A-Za-z0-9-]/g, '')
  const records = [
    { id: 1, value: family },
    { id: 2, value: subfamily },
    { id: 4, value: fullName },
    { id: 6, value: postScriptName || 'RebookPdfFont' },
  ].map((record) => ({ ...record, bytes: utf16Be(record.value) }))
  const stringOffset = 6 + records.length * 12
  const length = stringOffset + records.reduce((sum, record) => sum + record.bytes.length, 0)
  const table = new Uint8Array(length)
  writeUint16(table, 0, 0)
  writeUint16(table, 2, records.length)
  writeUint16(table, 4, stringOffset)
  let offset = 0
  records.forEach((record, index) => {
    const recordOffset = 6 + index * 12
    writeUint16(table, recordOffset, 3)
    writeUint16(table, recordOffset + 2, 1)
    writeUint16(table, recordOffset + 4, 0x0409)
    writeUint16(table, recordOffset + 6, record.id)
    writeUint16(table, recordOffset + 8, record.bytes.length)
    writeUint16(table, recordOffset + 10, offset)
    table.set(record.bytes, stringOffset + offset)
    offset += record.bytes.length
  })
  return table
}

interface SfntTable {
  tag: string
  data: Uint8Array
}

const addSfntTables = (font: Uint8Array, additions: SfntTable[]): Uint8Array | undefined => {
  if (font.byteLength < 12) return undefined
  const tableCount = readUint16(font, 4)
  const existing: SfntTable[] = []
  for (let index = 0; index < tableCount; index++) {
    const recordOffset = 12 + index * 16
    if (recordOffset + 16 > font.byteLength) return undefined
    const tag = bytesToTag(font, recordOffset)
    if (additions.some((table) => table.tag === tag)) continue
    const offset = readUint32(font, recordOffset + 8)
    const length = readUint32(font, recordOffset + 12)
    if (offset + length > font.byteLength) return undefined
    existing.push({ tag, data: font.slice(offset, offset + length) })
  }
  const tables = [...existing, ...additions].sort((left, right) => left.tag.localeCompare(right.tag))
  const output = buildSfnt(font.slice(0, 4), tables)
  const head = tableRecord(output, 'head')
  if (!head) return output
  writeUint32(output, head.offset + 8, 0)
  writeUint32(output, head.offset + 8, (0xb1b0afba - checksum(output)) >>> 0)
  return output
}

const buildSfnt = (scalerType: Uint8Array, tables: SfntTable[]): Uint8Array => {
  const tableCount = tables.length
  const entrySelector = Math.floor(Math.log2(tableCount))
  const searchRange = 16 * (2 ** entrySelector)
  const rangeShift = tableCount * 16 - searchRange
  let offset = 12 + tableCount * 16
  const tableOffsets = tables.map((table) => {
    const start = offset
    offset += paddedLength(table.data.length)
    return start
  })
  const output = new Uint8Array(offset)
  output.set(scalerType, 0)
  writeUint16(output, 4, tableCount)
  writeUint16(output, 6, searchRange)
  writeUint16(output, 8, entrySelector)
  writeUint16(output, 10, rangeShift)
  tables.forEach((table, index) => {
    const recordOffset = 12 + index * 16
    writeTag(output, recordOffset, table.tag)
    writeUint32(output, recordOffset + 4, checksum(table.data))
    writeUint32(output, recordOffset + 8, tableOffsets[index])
    writeUint32(output, recordOffset + 12, table.data.length)
    output.set(table.data, tableOffsets[index])
  })
  return output
}

const hasSfntTable = (font: Uint8Array, tag: string): boolean => tableRecord(font, tag) !== undefined

const tableRecord = (font: Uint8Array, tag: string): { offset: number; length: number } | undefined => {
  if (font.byteLength < 12) return undefined
  const tableCount = readUint16(font, 4)
  for (let index = 0; index < tableCount; index++) {
    const recordOffset = 12 + index * 16
    if (recordOffset + 16 > font.byteLength || bytesToTag(font, recordOffset) !== tag) continue
    return {
      offset: readUint32(font, recordOffset + 8),
      length: readUint32(font, recordOffset + 12),
    }
  }
  return undefined
}

const checksum = (data: Uint8Array): number => {
  let sum = 0
  for (let offset = 0; offset < paddedLength(data.length); offset += 4) {
    sum = (sum + (
      ((data[offset] ?? 0) << 24) |
      ((data[offset + 1] ?? 0) << 16) |
      ((data[offset + 2] ?? 0) << 8) |
      (data[offset + 3] ?? 0)
    )) >>> 0
  }
  return sum
}

const paddedLength = (length: number): number => (length + 3) & ~3

const utf16Be = (value: string): Uint8Array => {
  const output = new Uint8Array(value.length * 2)
  for (let index = 0; index < value.length; index++) writeUint16(output, index * 2, value.charCodeAt(index))
  return output
}

const bytesToTag = (data: Uint8Array, offset: number): string =>
  String.fromCharCode(data[offset] ?? 0, data[offset + 1] ?? 0, data[offset + 2] ?? 0, data[offset + 3] ?? 0)

const writeTag = (data: Uint8Array, offset: number, tag: string): void => {
  for (let index = 0; index < 4; index++) data[offset + index] = tag.charCodeAt(index) || 0x20
}

const readUint16 = (data: Uint8Array, offset: number): number =>
  ((data[offset] ?? 0) << 8) | (data[offset + 1] ?? 0)

const readUint32 = (data: Uint8Array, offset: number): number =>
  (((data[offset] ?? 0) * 0x1000000) + ((data[offset + 1] ?? 0) << 16) + ((data[offset + 2] ?? 0) << 8) + (data[offset + 3] ?? 0)) >>> 0

const writeUint16 = (data: Uint8Array, offset: number, value: number): void => {
  data[offset] = (value >>> 8) & 0xff
  data[offset + 1] = value & 0xff
}

const writeUint32 = (data: Uint8Array, offset: number, value: number): void => {
  data[offset] = (value >>> 24) & 0xff
  data[offset + 1] = (value >>> 16) & 0xff
  data[offset + 2] = (value >>> 8) & 0xff
  data[offset + 3] = value & 0xff
}

const createEncodingTable = (
  encoding: PdfPrimitive | undefined,
  resolve: (value: PdfPrimitive | undefined) => PdfPrimitive | undefined,
): string[] => {
  const table = standardEncodingTable()
  if (isName(encoding, 'WinAnsiEncoding')) applyBaseEncoding(table, winAnsiEncoding)
  else if (isDict(encoding)) {
    const base = resolve(encoding.entries.get('BaseEncoding'))
    if (isName(base, 'WinAnsiEncoding')) applyBaseEncoding(table, winAnsiEncoding)
    applyDifferences(table, resolve(encoding.entries.get('Differences')))
  }
  return table
}

const applyBaseEncoding = (target: string[], source: Map<number, string>): void => {
  for (const [code, value] of source) target[code] = value
}

const applyDifferences = (target: string[], differences: PdfPrimitive | undefined): void => {
  if (!Array.isArray(differences)) return
  let code = 0
  for (const item of differences) {
    if (typeof item === 'number') code = item
    else if (isName(item)) target[code++] = glyphNameToUnicode(item)
  }
}

const createSimpleWidthResolver = (
  font: PdfDict,
  resolve: (value: PdfPrimitive | undefined) => PdfPrimitive | undefined,
  fallbackWidth: number,
): ((code: number) => number) => {
  const firstChar = numberValue(resolve(font.entries.get('FirstChar')))
  const widths = resolve(font.entries.get('Widths'))
  const descriptor = resolve(font.entries.get('FontDescriptor'))
  const missingWidth = isDict(descriptor) ? numberValue(resolve(descriptor.entries.get('MissingWidth'))) : undefined
  const defaultWidth = missingWidth ?? fallbackWidth
  if (firstChar === undefined || !Array.isArray(widths)) return () => defaultWidth
  const widthTable = widths.filter((item): item is number => typeof item === 'number')
  return (code) => widthTable[code - firstChar] ?? defaultWidth
}

const createFontAdvance = (
  font: PdfDict,
  resolve: (value: PdfPrimitive | undefined) => PdfPrimitive | undefined,
): ((text: string, options: PdfTextAdvanceOptions) => number) => {
  if (isIdentityCidFont(font, resolve)) {
    const width = createCidWidthResolver(font, resolve, 1000)
    return (text, options) => advanceCidText(text, options, width)
  }
  const width = createSimpleWidthResolver(font, resolve, 500)
  return (text, options) => advanceSimpleText(text, options, width)
}

const createCidWidthResolver = (
  font: PdfDict,
  resolve: (value: PdfPrimitive | undefined) => PdfPrimitive | undefined,
  fallbackWidth: number,
): ((cid: number) => number) => {
  const descendants = resolve(font.entries.get('DescendantFonts'))
  const descendant = Array.isArray(descendants) ? resolve(descendants[0]) : undefined
  const cidFont = isDict(descendant) ? descendant : undefined
  const defaultWidth = cidFont ? numberValue(resolve(cidFont.entries.get('DW'))) ?? fallbackWidth : fallbackWidth
  const widths = cidFont ? parseCidWidths(resolve(cidFont.entries.get('W'))) : { widths: new Map<number, number>(), ranges: [] }
  return (cid) => widths.widths.get(cid) ?? rangeWidth(cid, widths.ranges) ?? defaultWidth
}

const parseCidWidths = (value: PdfPrimitive | undefined): CidWidths => {
  const widths = new Map<number, number>()
  const ranges: CidWidthRange[] = []
  if (!Array.isArray(value)) return { widths, ranges }
  for (let index = 0; index < value.length;) {
    const first = value[index++]
    if (typeof first !== 'number') continue
    const next = value[index++]
    if (Array.isArray(next)) {
      for (let offset = 0; offset < next.length; offset++) {
        const width = next[offset]
        if (typeof width === 'number') widths.set(first + offset, width)
      }
      continue
    }
    const width = value[index++]
    if (typeof next === 'number' && typeof width === 'number') ranges.push({ first, last: next, width })
  }
  return { widths, ranges }
}

const rangeWidth = (cid: number, ranges: CidWidthRange[]): number | undefined => {
  for (const range of ranges) {
    if (cid >= range.first && cid <= range.last) return range.width
  }
  return undefined
}

const advanceSimpleText = (text: string, options: PdfTextAdvanceOptions, width: (code: number) => number): number => {
  let glyphUnits = 0
  let spacing = 0
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) & 0xff
    glyphUnits += width(code)
    spacing += options.charSpacing
    if (code === 0x20) spacing += options.wordSpacing
  }
  return ((glyphUnits / 1000) * options.fontSize + spacing) * options.horizontalScale
}

const advanceCidText = (text: string, options: PdfTextAdvanceOptions, width: (cid: number) => number): number => {
  let glyphUnits = 0
  let spacing = 0
  for (let index = 0; index < text.length;) {
    const high = text.charCodeAt(index) & 0xff
    const cid = index + 1 < text.length ? (high << 8) | (text.charCodeAt(index + 1) & 0xff) : high
    index += index + 1 < text.length ? 2 : 1
    glyphUnits += width(cid)
    spacing += options.charSpacing
    if (cid === 0x20) spacing += options.wordSpacing
  }
  return ((glyphUnits / 1000) * options.fontSize + spacing) * options.horizontalScale
}

const defaultAdvanceWidth = (text: string, options: PdfTextAdvanceOptions, width: number): number =>
  advanceSimpleText(text, options, () => width)

const numberValue = (value: PdfPrimitive | undefined): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

interface CidWidths {
  widths: Map<number, number>
  ranges: CidWidthRange[]
}

interface CidWidthRange {
  first: number
  last: number
  width: number
}

const standardEncodingTable = (): string[] => {
  const table = new Array<string>(256)
  for (let i = 0; i < 256; i++) table[i] = i >= 32 && i <= 126 ? String.fromCharCode(i) : String.fromCharCode(i)
  table[9] = '\t'
  table[10] = '\n'
  table[13] = '\r'
  table[32] = ' '
  return table
}

const glyphNameToUnicode = (name: PdfName): string => {
  const value = name.value
  const mapped = glyphNames.get(value)
  if (mapped) return mapped
  const uni = value.match(/^uni([0-9A-Fa-f]{4})$/)
  if (uni) return String.fromCharCode(Number.parseInt(uni[1], 16))
  if (value.length === 1) return value
  return ''
}

const parseToUnicodeCMap = (source: string): Map<string, string> => {
  const entries = new Map<string, string>()
  parseBfChar(source, entries)
  parseBfRange(source, entries)
  return entries
}

const parseBfChar = (source: string, entries: Map<string, string>): void => {
  const blocks = source.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)
  for (const block of blocks) {
    const pairs = block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)
    for (const pair of pairs) entries.set(normalizeHex(pair[1]), hexToUnicode(pair[2]))
  }
}

const parseBfRange = (source: string, entries: Map<string, string>): void => {
  const blocks = source.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)
  for (const block of blocks) {
    const arrayRanges = block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[([^\]]+)\]/g)
    for (const range of arrayRanges) {
      let code = Number.parseInt(range[1], 16)
      const end = Number.parseInt(range[2], 16)
      const values = [...range[3].matchAll(/<([0-9A-Fa-f]+)>/g)].map((match) => match[1])
      for (const value of values) {
        if (code > end) break
        entries.set(normalizeHex(code.toString(16).padStart(range[1].length, '0')), hexToUnicode(value))
        code++
      }
    }
    const scalarRanges = block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)
    for (const range of scalarRanges) {
      const start = Number.parseInt(range[1], 16)
      const end = Number.parseInt(range[2], 16)
      for (let code = start; code <= end; code++) {
        entries.set(normalizeHex(code.toString(16).padStart(range[1].length, '0')), hexToUnicode(incrementHexString(range[3], code - start)))
      }
    }
  }
}

const hasUtf16BeBom = (text: string): boolean => text.length >= 2 && text.charCodeAt(0) === 0xfe && text.charCodeAt(1) === 0xff

const decodeUtf16BeOrBytes = (text: string): string => {
  if (!hasUtf16BeBom(text)) return decodeLegacyChineseBytes(text) ?? text
  let output = ''
  for (let i = 2; i + 1 < text.length; i += 2) output += String.fromCharCode((text.charCodeAt(i) << 8) | text.charCodeAt(i + 1))
  return output
}

const stringToBytes = (text: string): Uint8Array => {
  const bytes = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0xff
  return bytes
}

const bytesToHex = (bytes: Uint8Array): string => {
  let output = ''
  for (const byte of bytes) output += byteHex[byte]
  return output
}

const stringBytesToHex = (text: string, start: number, length: number): string => {
  let output = ''
  for (let index = 0; index < length; index++) output += byteHex[text.charCodeAt(start + index) & 0xff]
  return output
}

const byteHex = Array.from({ length: 256 }, (_, value) => value.toString(16).padStart(2, '0').toUpperCase())

const normalizeHex = (hex: string): string => (hex.length % 2 === 0 ? hex : `0${hex}`).toUpperCase()

const maxTextCacheEntries = 4096

function memoizeText(decode: (text: string) => string): ((text: string) => string) {
  const cache = new Map<string, string>()
  return (text) => {
    const cached = cache.get(text)
    if (cached !== undefined) return cached
    const value = decode(text)
    if (cache.size < maxTextCacheEntries) cache.set(text, value)
    return value
  }
}

function memoizeAdvance(advance: (text: string, options: PdfTextAdvanceOptions) => number): ((text: string, options: PdfTextAdvanceOptions) => number) {
  const cacheByOptions = new Map<string, Map<string, number>>()
  let lastOptions: PdfTextAdvanceOptions | undefined
  let lastCache: Map<string, number> | undefined
  return (text, options) => {
    let cache = options === lastOptions ? lastCache : undefined
    if (!cache) {
      const key = `${options.fontSize}/${options.charSpacing}/${options.wordSpacing}/${options.horizontalScale}`
      cache = cacheByOptions.get(key)
      if (!cache) {
        cache = new Map<string, number>()
        if (cacheByOptions.size < maxTextCacheEntries) cacheByOptions.set(key, cache)
      }
      lastOptions = options
      lastCache = cache
    }
    const cached = cache.get(text)
    if (cached !== undefined) return cached
    const value = advance(text, options)
    if (cache.size < maxTextCacheEntries) cache.set(text, value)
    return value
  }
}

const incrementHexString = (hex: string, offset: number): string => {
  const normalized = normalizeHex(hex)
  const value = BigInt(`0x${normalized}`) + BigInt(offset)
  return value.toString(16).padStart(normalized.length, '0').toUpperCase()
}

const hexToUnicode = (hex: string): string => {
  const normalized = normalizeHex(hex)
  let output = ''
  for (let i = 0; i < normalized.length; i += 4) output += String.fromCharCode(Number.parseInt(normalized.slice(i, i + 4), 16))
  return output
}

const winAnsiEncoding = new Map<number, string>([
  [0x80, '€'],
  [0x82, '‚'],
  [0x83, 'ƒ'],
  [0x84, '„'],
  [0x85, '…'],
  [0x86, '†'],
  [0x87, '‡'],
  [0x88, 'ˆ'],
  [0x89, '‰'],
  [0x8a, 'Š'],
  [0x8b, '‹'],
  [0x8c, 'Œ'],
  [0x8e, 'Ž'],
  [0x91, '‘'],
  [0x92, '’'],
  [0x93, '“'],
  [0x94, '”'],
  [0x95, '•'],
  [0x96, '–'],
  [0x97, '—'],
  [0x98, '˜'],
  [0x99, '™'],
  [0x9a, 'š'],
  [0x9b, '›'],
  [0x9c, 'œ'],
  [0x9e, 'ž'],
  [0x9f, 'Ÿ'],
])

const glyphNames = new Map<string, string>([
  ['space', ' '],
  ['Euro', '€'],
  ['Alpha', 'Α'],
  ['Beta', 'Β'],
  ['Gamma', 'Γ'],
  ['Delta', 'Δ'],
  ['Omega', 'Ω'],
  ['mu', 'μ'],
  ['bullet', '•'],
  ['endash', '–'],
  ['emdash', '—'],
  ['quotedblleft', '“'],
  ['quotedblright', '”'],
  ['quoteleft', '‘'],
  ['quoteright', '’'],
  ['fi', 'fi'],
  ['fl', 'fl'],
])
