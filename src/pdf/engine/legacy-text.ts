const legacyChineseDecoder = createLegacyChineseDecoder()

export interface DecodeLegacyChineseOptions {
  allowShortPairs?: boolean
}

export function decodeLegacyChineseBytes(text: string, options: DecodeLegacyChineseOptions = {}): string | undefined {
  if (!legacyChineseDecoder || text.length < 2) return undefined

  let byteLikeCount = 0
  let sourceCjkCount = 0
  let sourceVisibleCount = 0
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    if (!/\s/.test(char)) sourceVisibleCount++
    if (code >= 0x80 && code <= 0xff) byteLikeCount++
    if (isCJKCodePoint(code)) sourceCjkCount++
  }

  if (sourceVisibleCount === 0) return undefined
  if (sourceCjkCount / sourceVisibleCount > 0.25) return undefined
  const isShortPair = options.allowShortPairs === true && text.length === 2 && byteLikeCount === 2
  if (!isShortPair && (byteLikeCount < 4 || byteLikeCount / text.length < 0.25)) return undefined

  const decoded = legacyChineseDecoder.decode(stringToBytes(text))
  if (!decoded || decoded === text) return undefined

  let decodedCjkCount = 0
  let decodedVisibleCount = 0
  let replacementCount = 0
  for (const char of decoded) {
    const code = char.codePointAt(0) ?? 0
    if (!/\s/.test(char)) decodedVisibleCount++
    if (isCJKCodePoint(code)) decodedCjkCount++
    if (code === 0xfffd) replacementCount++
  }

  if (decodedVisibleCount === 0) return undefined
  if (replacementCount > 0) return undefined
  if (isShortPair) {
    const code = decoded.codePointAt(0) ?? 0
    return decodedVisibleCount === 1 && isLegacyChineseOutputCodePoint(code) ? decoded : undefined
  }
  if (decodedCjkCount < 2 || decodedCjkCount <= sourceCjkCount + 1) return undefined
  if (decodedCjkCount / decodedVisibleCount < 0.35) return undefined
  return decoded
}

function createLegacyChineseDecoder(): TextDecoder | undefined {
  if (typeof TextDecoder === 'undefined') return undefined
  for (const label of ['gb18030', 'gbk']) {
    try {
      return new TextDecoder(label)
    }
    catch {
      // Try the next compatible label.
    }
  }
  return undefined
}

function isCJKCodePoint(code: number): boolean {
  return (code >= 0x3400 && code <= 0x9fff) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0x20000 && code <= 0x2ebef)
}

function isLegacyChineseOutputCodePoint(code: number): boolean {
  return isCJKCodePoint(code) ||
    (code >= 0x3000 && code <= 0x303f) ||
    (code >= 0xff00 && code <= 0xffef) ||
    (code >= 0x2018 && code <= 0x201d)
}

function stringToBytes(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0xff
  return bytes
}
