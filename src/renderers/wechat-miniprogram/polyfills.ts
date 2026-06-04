const globalScope = globalThis as Record<string, any>

if (typeof globalScope.TextEncoder === 'undefined') {
    globalScope.TextEncoder = class TextEncoder {
        readonly encoding = 'utf-8'

        encode(value: unknown): Uint8Array {
            const input = String(value)
            const bytes: number[] = []
            for (let i = 0; i < input.length; i++) {
                let code = input.charCodeAt(i)
                if (code >= 0xd800 && code <= 0xdbff && i + 1 < input.length) {
                    const next = input.charCodeAt(i + 1)
                    if (next >= 0xdc00 && next <= 0xdfff) {
                        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00)
                        i++
                    }
                }
                if (code <= 0x7f) {
                    bytes.push(code)
                } else if (code <= 0x7ff) {
                    bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
                } else if (code <= 0xffff) {
                    bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
                } else {
                    bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
                }
            }
            return new Uint8Array(bytes)
        }
    }
}

if (typeof globalScope.TextDecoder === 'undefined') {
    const windows1252: Record<number, number> = {
        128: 0x20ac, 130: 0x201a, 131: 0x0192, 132: 0x201e, 133: 0x2026,
        134: 0x2020, 135: 0x2021, 136: 0x02c6, 137: 0x2030, 138: 0x0160,
        139: 0x2039, 140: 0x0152, 142: 0x017d, 145: 0x2018, 146: 0x2019,
        147: 0x201c, 148: 0x201d, 149: 0x2022, 150: 0x2013, 151: 0x2014,
        152: 0x02dc, 153: 0x2122, 154: 0x0161, 155: 0x203a, 156: 0x0153,
        158: 0x017e, 159: 0x0178,
    }

    globalScope.TextDecoder = class TextDecoder {
        readonly encoding: string

        constructor(label?: string) {
            this.encoding = String(label || 'utf-8').toLowerCase()
        }

        decode(input?: ArrayBuffer | ArrayBufferView | null): string {
            const bytes = getBytes(input)
            if (this.encoding === 'windows-1252' || this.encoding === 'latin1' || this.encoding === 'iso-8859-1') {
                let out = ''
                for (const byte of bytes) {
                    out += String.fromCharCode(windows1252[byte] || byte)
                }
                return out
            }

            let result = ''
            for (let index = 0; index < bytes.length;) {
                const b1 = bytes[index++]
                let code = b1
                if (b1 >= 0xc2 && b1 <= 0xdf && index < bytes.length) {
                    code = ((b1 & 0x1f) << 6) | (bytes[index++] & 0x3f)
                } else if (b1 >= 0xe0 && b1 <= 0xef && index + 1 < bytes.length) {
                    code = ((b1 & 0x0f) << 12) | ((bytes[index++] & 0x3f) << 6) | (bytes[index++] & 0x3f)
                } else if (b1 >= 0xf0 && b1 <= 0xf4 && index + 2 < bytes.length) {
                    code = ((b1 & 0x07) << 18) | ((bytes[index++] & 0x3f) << 12) | ((bytes[index++] & 0x3f) << 6) | (bytes[index++] & 0x3f)
                }
                if (code <= 0xffff) {
                    result += String.fromCharCode(code)
                } else {
                    code -= 0x10000
                    result += String.fromCharCode(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff))
                }
            }
            return result
        }
    }
}

const segmenterScope = globalThis as Record<string, any>
if (typeof segmenterScope.Intl === 'undefined') {
    ;(globalThis as { Intl?: unknown }).Intl = {}
}

if (typeof segmenterScope.Intl.Segmenter === 'undefined') {
    segmenterScope.Intl.Segmenter = class Segmenter {
        static supportedLocalesOf(locales: Intl.LocalesArgument): string[] {
            if (typeof locales === 'string') return [locales]
            return Array.isArray(locales) ? locales.map(String) : []
        }

        private readonly granularity: string

        constructor(_locale?: string, options?: { granularity?: string }) {
            this.granularity = options?.granularity || 'grapheme'
        }

        segment(value: unknown) {
            const input = String(value)
            const segments: Array<{
                segment: string
                index: number
                input?: string
                isWordLike?: boolean
            }> & {
                containing(index: number): {
                    segment: string
                    index: number
                    input?: string
                    isWordLike?: boolean
                } | undefined
            } = [] as any

            if (this.granularity === 'word') {
                for (let index = 0; index < input.length;) {
                    const start = index
                    const kind = charKind(input, index)
                    const firstLength = codePointLengthAt(input, index)
                    if (kind === 'cjk') {
                        index += firstLength
                    } else {
                        index += firstLength
                        while (index < input.length) {
                            const nextKind = charKind(input, index)
                            if (nextKind !== kind) break
                            index += codePointLengthAt(input, index)
                        }
                    }
                    segments.push(makeSegment(input.slice(start, index), start, kind === 'word' || kind === 'cjk'))
                }
            } else {
                for (let index = 0; index < input.length;) {
                    const length = codePointLengthAt(input, index)
                    segments.push(makeSegment(input.slice(index, index + length), index, true))
                    index += length
                }
            }

            segments.containing = (index: number) => {
                for (const item of segments) {
                    if (index >= item.index && index < item.index + item.segment.length) return item
                }
                return segments[segments.length - 1]
            }
            return segments
        }
    }
}

function getBytes(input?: ArrayBuffer | ArrayBufferView | null): Uint8Array {
    if (input == null) return new Uint8Array(0)
    if (input instanceof Uint8Array) return input
    if (ArrayBuffer.isView(input)) {
        return new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
    }
    return new Uint8Array(input)
}

function makeSegment(segment: string, index: number, isWordLike: boolean) {
    return { segment, index, input: undefined, isWordLike }
}

function codePointLengthAt(input: string, index: number): number {
    const first = input.charCodeAt(index)
    if (isHighSurrogate(first) && index + 1 < input.length && isLowSurrogate(input.charCodeAt(index + 1))) return 2
    return 1
}

function codePointAt(input: string, index: number): number {
    const first = input.charCodeAt(index)
    if (isHighSurrogate(first) && index + 1 < input.length) {
        const second = input.charCodeAt(index + 1)
        if (isLowSurrogate(second)) return 0x10000 + ((first - 0xd800) << 10) + (second - 0xdc00)
    }
    return first
}

function charKind(input: string, index: number): 'space' | 'cjk' | 'word' | 'punct' {
    const code = codePointAt(input, index)
    if (code === 9 || code === 10 || code === 13 || code === 32 || code === 0xa0) return 'space'
    if (
        (code >= 0x4e00 && code <= 0x9fff)
        || (code >= 0x3400 && code <= 0x4dbf)
        || (code >= 0x3040 && code <= 0x30ff)
        || (code >= 0xac00 && code <= 0xd7af)
    ) return 'cjk'
    if (
        (code >= 48 && code <= 57)
        || (code >= 65 && code <= 90)
        || (code >= 97 && code <= 122)
        || (code >= 0xc0 && code <= 0x024f)
    ) return 'word'
    return 'punct'
}

function isHighSurrogate(code: number): boolean {
    return code >= 0xd800 && code <= 0xdbff
}

function isLowSurrogate(code: number): boolean {
    return code >= 0xdc00 && code <= 0xdfff
}
