export type ContentNameToken = { type: 'name'; value: string }
export type ContentStringToken = { type: 'string'; value: string }
export type ContentDictToken = { type: 'dict'; entries: Map<string, ContentToken> }
export type ContentInlineImageToken = { type: 'inlineImage'; dict: Map<string, ContentToken>; data: string }
export type ContentToken = string | number | ContentNameToken | ContentStringToken | ContentDictToken | ContentInlineImageToken | ContentToken[]

export class ContentTokenizer {
  private offset = 0

  constructor(private readonly source: string) {}

  *tokens(): Generator<ContentToken> {
    while (this.offset < this.source.length) {
      this.skipWhitespace()
      if (this.offset >= this.source.length) return
      const char = this.source[this.offset]
      if (char === '%') {
        while (this.offset < this.source.length && !isLineBreak(this.source[this.offset])) this.offset++
        continue
      }
      if (char === '(') yield this.readString()
      else if (char === '<' && this.source[this.offset + 1] === '<') yield this.readDictionary()
      else if (char === '<') yield this.readHexString()
      else if (char === '/') yield this.readName()
      else if (char === '[') yield this.readArray()
      else {
        const word = this.readWord()
        yield word === 'BI' ? this.readInlineImage() : word
      }
    }
  }

  private readString(): ContentStringToken {
    this.offset++
    let depth = 1
    let result = ''
    while (this.offset < this.source.length && depth > 0) {
      const char = this.source[this.offset++]
      if (char === '\\') {
        const next = this.source[this.offset++]
        if (next === 'n') result += '\n'
        else if (next === 'r') result += '\r'
        else if (next === 't') result += '\t'
        else if (next === 'b') result += '\b'
        else if (next === 'f') result += '\f'
        else if (next === '\r' && this.source[this.offset] === '\n') this.offset++
        else if (next !== '\n' && next !== '\r') result += next
      } else if (char === '(') {
        depth++
        result += char
      } else if (char === ')') {
        depth--
        if (depth > 0) result += char
      } else result += char
    }
    return { type: 'string', value: result }
  }

  private readHexString(): ContentStringToken {
    this.offset++
    const start = this.offset
    const first = this.source.charCodeAt(start)
    const second = this.source.charCodeAt(start + 1)
    const third = this.source.charCodeAt(start + 2)
    const fourth = this.source.charCodeAt(start + 3)
    if (this.source.charCodeAt(start + 4) === 62) {
      const a = hexNibble(first)
      const b = hexNibble(second)
      const c = hexNibble(third)
      const d = hexNibble(fourth)
      if (a >= 0 && b >= 0 && c >= 0 && d >= 0) {
        this.offset = start + 5
        return { type: 'string', value: String.fromCharCode((a << 4) | b, (c << 4) | d) }
      }
    }
    if (this.source.charCodeAt(start + 2) === 62) {
      const a = hexNibble(first)
      const b = hexNibble(second)
      if (a >= 0 && b >= 0) {
        this.offset = start + 3
        return { type: 'string', value: String.fromCharCode((a << 4) | b) }
      }
    }
    let result = ''
    let highNibble = -1
    while (this.offset < this.source.length && this.source[this.offset] !== '>') {
      const char = this.source.charCodeAt(this.offset)
      if (!isWhitespaceCode(char)) {
        const nibble = hexNibble(char)
        if (nibble >= 0) {
          if (highNibble < 0) highNibble = nibble
          else {
            result += String.fromCharCode((highNibble << 4) | nibble)
            highNibble = -1
          }
        }
      }
      this.offset++
    }
    if (highNibble >= 0) result += String.fromCharCode(highNibble << 4)
    this.offset++
    return { type: 'string', value: result }
  }

  private readName(): ContentNameToken {
    this.offset++
    const start = this.offset
    while (this.offset < this.source.length && !isTokenDelimiter(this.source[this.offset])) this.offset++
    return { type: 'name', value: decodeName(this.source.slice(start, this.offset)) }
  }

  private readArray(): ContentToken[] {
    this.offset++
    const values: ContentToken[] = []
    while (this.offset < this.source.length) {
      this.skipWhitespace()
      if (this.source[this.offset] === ']') {
        this.offset++
        return values
      }
      values.push(this.readValue())
    }
    return values
  }

  private readDictionary(): ContentDictToken {
    this.offset += 2
    const entries = new Map<string, ContentToken>()
    while (this.offset < this.source.length) {
      this.skipWhitespace()
      if (this.source[this.offset] === '>' && this.source[this.offset + 1] === '>') {
        this.offset += 2
        return { type: 'dict', entries }
      }
      const keyToken = this.source[this.offset] === '/' ? this.readName() : this.readWord()
      const key = isContentName(keyToken) ? keyToken.value : typeof keyToken === 'string' && keyToken.length > 0 ? keyToken : undefined
      if (!key) {
        this.offset++
        continue
      }
      this.skipWhitespace()
      if (this.source[this.offset] === '>' && this.source[this.offset + 1] === '>') {
        entries.set(key, '')
        continue
      }
      entries.set(key, this.readValue())
    }
    return { type: 'dict', entries }
  }

  private readValue(): ContentToken {
    this.skipWhitespace()
    if (this.source[this.offset] === '(') return this.readString()
    if (this.source[this.offset] === '<' && this.source[this.offset + 1] === '<') return this.readDictionary()
    if (this.source[this.offset] === '<') return this.readHexString()
    if (this.source[this.offset] === '/') return this.readName()
    if (this.source[this.offset] === '[') return this.readArray()
    return this.readWord()
  }

  private readWord(): string | number {
    const start = this.offset
    while (this.offset < this.source.length && !isTokenDelimiter(this.source[this.offset])) this.offset++
    const word = this.source.slice(start, this.offset)
    if (word !== '' && canStartNumber(word.charCodeAt(0))) {
      const number = Number(word)
      if (Number.isFinite(number)) return number
    }
    return word
  }

  private readInlineImage(): ContentInlineImageToken {
    const dict = new Map<string, ContentToken>()
    while (this.offset < this.source.length) {
      this.skipWhitespace()
      const key = this.readInlineImageDictionaryToken()
      if (key === 'ID') break
      const value = this.readInlineImageDictionaryToken()
      const name = typeof key === 'string' ? key : isContentName(key) ? key.value : undefined
      if (name) dict.set(name, value)
    }
    return {
      type: 'inlineImage',
      dict,
      data: this.readInlineImageData(),
    }
  }

  private readInlineImageDictionaryToken(): ContentToken {
    this.skipWhitespace()
    if (this.source[this.offset] === '(') return this.readString()
    if (this.source[this.offset] === '<' && this.source[this.offset + 1] === '<') return this.readDictionary()
    if (this.source[this.offset] === '<') return this.readHexString()
    if (this.source[this.offset] === '/') return this.readName()
    if (this.source[this.offset] === '[') return this.readArray()
    return this.readWord()
  }

  private readInlineImageData(): string {
    this.skipSingleWhitespace()
    const start = this.offset
    const marker = this.findInlineImageEnd(start)
    if (marker < 0) {
      this.offset = this.source.length
      return this.source.slice(start)
    }
    const end = marker > start && isWhitespace(this.source[marker - 1]) ? marker - 1 : marker
    const data = this.source.slice(start, end)
    this.offset = marker + 2
    return data
  }

  private findInlineImageEnd(start: number): number {
    for (let cursor = start + 1; cursor < this.source.length - 1; cursor++) {
      if (this.source[cursor] !== 'E' || this.source[cursor + 1] !== 'I') continue
      if (!isWhitespace(this.source[cursor - 1])) continue
      if (cursor + 2 < this.source.length && !isWhitespace(this.source[cursor + 2])) continue
      return cursor
    }
    return -1
  }

  private skipSingleWhitespace(): void {
    const char = this.source[this.offset]
    if (char === '\r' && this.source[this.offset + 1] === '\n') this.offset += 2
    else if (char && isWhitespace(char)) this.offset++
  }

  private skipWhitespace(): void {
    while (this.offset < this.source.length && isWhitespace(this.source[this.offset])) this.offset++
  }
}

const decodeName = (input: string): string =>
  input.includes('#')
    ? input.replace(/#([0-9a-fA-F]{2})/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
    : input

const isLineBreak = (char: string | undefined): boolean => char === '\n' || char === '\r'

const isWhitespace = (char: string | undefined): boolean =>
  char === ' ' || char === '\n' || char === '\r' || char === '\t' || char === '\f' || char === '\0'

const isWhitespaceCode = (char: number): boolean =>
  char === 32 || char === 10 || char === 13 || char === 9 || char === 12 || char === 0

const canStartNumber = (char: number): boolean =>
  (char >= 48 && char <= 57) || char === 43 || char === 45 || char === 46

const hexNibble = (char: number): number => {
  if (char >= 48 && char <= 57) return char - 48
  if (char >= 65 && char <= 70) return char - 55
  if (char >= 97 && char <= 102) return char - 87
  return -1
}

const isTokenDelimiter = (char: string | undefined): boolean =>
  char === undefined ||
  isWhitespace(char) ||
  char === '(' ||
  char === ')' ||
  char === '[' ||
  char === ']' ||
  char === '<' ||
  char === '>' ||
  char === '/' ||
  char === '%'

const isContentName = (token: ContentToken): token is ContentNameToken =>
  Boolean(token && typeof token === 'object' && !Array.isArray(token) && token.type === 'name')

export const isContentString = (token: ContentToken | undefined): token is ContentStringToken =>
  Boolean(token && typeof token === 'object' && !Array.isArray(token) && token.type === 'string')
