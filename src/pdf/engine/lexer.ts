import { bytesToLatin1, findBytes, isDelimiter, isWhite, skipWhitespace } from './bytes'
import { PdfDict, PdfError, PdfPrimitive, PdfRef, PdfStream } from '../types'

export class PdfLexer {
  constructor(
    private readonly bytes: Uint8Array,
    public offset = 0,
  ) {}

  readObject(): PdfPrimitive {
    this.offset = skipWhitespace(this.bytes, this.offset)
    const byte = this.bytes[this.offset]
    if (byte === 47) return this.readName()
    if (byte === 40) return this.readLiteralString()
    if (byte === 60 && this.bytes[this.offset + 1] === 60) return this.readDict()
    if (byte === 60) return this.readHexString()
    if (byte === 91) return this.readArray()
    if (byte === 116 && this.wordAt('true')) return this.consumeWord(true)
    if (byte === 102 && this.wordAt('false')) return this.consumeWord(false)
    if (byte === 110 && this.wordAt('null')) return this.consumeWord(null)
    if (byte === 45 || byte === 43 || byte === 46 || (byte >= 48 && byte <= 57)) return this.readNumberOrRef()
    throw new PdfError(`Unexpected PDF token at byte ${this.offset}`)
  }

  readIndirectObject(): { objectNumber: number; generation: number; value: PdfPrimitive } {
    this.offset = skipWhitespace(this.bytes, this.offset)
    const objectNumber = this.readNumber()
    const generation = this.readNumber()
    this.expectWord('obj')
    const valueStart = this.offset
    let value = this.readObject()
    const afterValue = skipWhitespace(this.bytes, this.offset)
    if (this.wordAt('stream', afterValue)) {
      if (!isDict(value)) throw new PdfError(`Stream object ${objectNumber} has no dictionary`)
      this.offset = afterValue + 'stream'.length
      if (this.bytes[this.offset] === 13 && this.bytes[this.offset + 1] === 10) this.offset += 2
      else if (this.bytes[this.offset] === 10 || this.bytes[this.offset] === 13) this.offset++
      const dataStart = this.offset
      const length = directStreamLength(value)
      const lengthEnd = length === undefined ? -1 : dataStart + length
      const end = lengthEnd >= dataStart && lengthEnd <= this.bytes.length
        ? findBytes(this.bytes, 'endstream', skipWhitespace(this.bytes, lengthEnd))
        : findBytes(this.bytes, 'endstream', dataStart)
      if (end < 0) throw new PdfError(`Stream object ${objectNumber} is missing endstream`)
      value = {
        type: 'stream',
        dict: value,
        data: lengthEnd >= dataStart && lengthEnd <= end
          ? this.bytes.subarray(dataStart, lengthEnd)
          : this.bytes.subarray(dataStart, end),
      } satisfies PdfStream
      this.offset = end + 'endstream'.length
    } else {
      this.offset = valueStart
      value = this.readObject()
    }
    const endObj = findBytes(this.bytes, 'endobj', this.offset)
    if (endObj < 0) throw new PdfError(`Object ${objectNumber} is missing endobj`)
    this.offset = endObj + 'endobj'.length
    return { objectNumber, generation, value }
  }

  private readDict(): PdfDict {
    this.offset += 2
    const entries = new Map<string, PdfPrimitive>()
    while (true) {
      this.offset = skipWhitespace(this.bytes, this.offset)
      if (this.bytes[this.offset] === 62 && this.bytes[this.offset + 1] === 62) {
        this.offset += 2
        return { type: 'dict', entries }
      }
      const key = this.readName()
      entries.set(key.value, this.readObject())
    }
  }

  private readArray(): PdfPrimitive[] {
    this.offset++
    const values: PdfPrimitive[] = []
    while (true) {
      this.offset = skipWhitespace(this.bytes, this.offset)
      if (this.bytes[this.offset] === 93) {
        this.offset++
        return values
      }
      values.push(this.readObject())
    }
  }

  private readName() {
    this.offset++
    const start = this.offset
    while (this.offset < this.bytes.length && !isWhite(this.bytes[this.offset]) && !isDelimiter(this.bytes[this.offset])) this.offset++
    return { type: 'name' as const, value: decodeName(bytesToLatin1(this.bytes, start, this.offset)) }
  }

  private readLiteralString(): string {
    this.offset++
    let depth = 1
    let result = ''
    while (this.offset < this.bytes.length && depth > 0) {
      const byte = this.bytes[this.offset++]
      if (byte === 92) {
        const escaped = this.bytes[this.offset++]
        if (escaped === 110) result += '\n'
        else if (escaped === 114) result += '\r'
        else if (escaped === 116) result += '\t'
        else if (escaped === 98) result += '\b'
        else if (escaped === 102) result += '\f'
        else if (escaped === 10 || escaped === 13) {
          if (escaped === 13 && this.bytes[this.offset] === 10) this.offset++
        } else result += String.fromCharCode(escaped)
      } else if (byte === 40) {
        depth++
        result += '('
      } else if (byte === 41) {
        depth--
        if (depth > 0) result += ')'
      } else {
        result += String.fromCharCode(byte)
      }
    }
    return result
  }

  private readHexString(): string {
    this.offset++
    let hex = ''
    while (this.offset < this.bytes.length && this.bytes[this.offset] !== 62) {
      if (!isWhite(this.bytes[this.offset])) hex += String.fromCharCode(this.bytes[this.offset])
      this.offset++
    }
    this.offset++
    if (hex.length % 2 === 1) hex += '0'
    let output = ''
    for (let i = 0; i < hex.length; i += 2) output += String.fromCharCode(Number.parseInt(hex.slice(i, i + 2), 16))
    return output
  }

  private readNumberOrRef(): number | PdfRef {
    const start = this.offset
    const first = this.readNumber()
    const afterFirst = this.offset
    try {
      const second = this.readNumber()
      const afterSecond = this.offset
      this.offset = skipWhitespace(this.bytes, this.offset)
      if (this.bytes[this.offset] === 82) {
        this.offset++
        return { type: 'ref', objectNumber: first, generation: second }
      }
      this.offset = afterFirst
      return first
    } catch {
      this.offset = start
      return this.readNumber()
    }
  }

  private readNumber(): number {
    this.offset = skipWhitespace(this.bytes, this.offset)
    const start = this.offset
    while (this.offset < this.bytes.length && !isWhite(this.bytes[this.offset]) && !isDelimiter(this.bytes[this.offset])) this.offset++
    const value = Number(bytesToLatin1(this.bytes, start, this.offset))
    if (!Number.isFinite(value)) throw new PdfError(`Invalid number at byte ${start}`)
    return value
  }

  private expectWord(word: string): void {
    this.offset = skipWhitespace(this.bytes, this.offset)
    if (!this.wordAt(word)) throw new PdfError(`Expected ${word} at byte ${this.offset}`)
    this.offset += word.length
  }

  private consumeWord<T>(value: T): T {
    if (value === true) this.offset += 4
    else if (value === false) this.offset += 5
    else this.offset += 4
    return value
  }

  private wordAt(word: string, offset = this.offset): boolean {
    return bytesToLatin1(this.bytes, offset, offset + word.length) === word
  }

}

const isDict = (value: PdfPrimitive): value is PdfDict =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value) && value.type === 'dict')

const directStreamLength = (dict: PdfDict): number | undefined => {
  const length = dict.entries.get('Length')
  return typeof length === 'number' && Number.isInteger(length) && length >= 0 ? length : undefined
}

const decodeName = (input: string): string =>
  input.replace(/#([0-9a-fA-F]{2})/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
