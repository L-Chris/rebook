const latin1Decoder = new TextDecoder('latin1')

export const toBytes = (input: ArrayBuffer | Uint8Array): Uint8Array =>
  input instanceof Uint8Array ? input : new Uint8Array(input)

export const bytesToLatin1 = (bytes: Uint8Array, start = 0, end = bytes.length): string =>
  latin1Decoder.decode(bytes.subarray(start, end))

export const isWhite = (byte: number): boolean =>
  byte === 0 || byte === 9 || byte === 10 || byte === 12 || byte === 13 || byte === 32

export const isDelimiter = (byte: number): boolean =>
  byte === 40 || byte === 41 || byte === 60 || byte === 62 || byte === 91 || byte === 93 || byte === 123 || byte === 125 || byte === 47 || byte === 37

export const skipWhitespace = (bytes: Uint8Array, offset: number): number => {
  let cursor = offset
  while (cursor < bytes.length) {
    const byte = bytes[cursor]
    if (byte === 37) {
      while (cursor < bytes.length && bytes[cursor] !== 10 && bytes[cursor] !== 13) cursor++
      continue
    }
    if (!isWhite(byte)) break
    cursor++
  }
  return cursor
}

export const findBytes = (bytes: Uint8Array, pattern: string, start = 0): number => {
  const target = new TextEncoder().encode(pattern)
  outer: for (let i = start; i <= bytes.length - target.length; i++) {
    for (let j = 0; j < target.length; j++) {
      if (bytes[i + j] !== target[j]) continue outer
    }
    return i
  }
  return -1
}

export const findLastBytes = (bytes: Uint8Array, pattern: string): number => {
  const target = new TextEncoder().encode(pattern)
  outer: for (let i = bytes.length - target.length; i >= 0; i--) {
    for (let j = 0; j < target.length; j++) {
      if (bytes[i + j] !== target[j]) continue outer
    }
    return i
  }
  return -1
}

export const readLine = (bytes: Uint8Array, offset: number): { line: string; next: number } => {
  let cursor = offset
  while (cursor < bytes.length && bytes[cursor] !== 10 && bytes[cursor] !== 13) cursor++
  const line = bytesToLatin1(bytes, offset, cursor)
  if (bytes[cursor] === 13 && bytes[cursor + 1] === 10) cursor += 2
  else if (bytes[cursor] === 13 || bytes[cursor] === 10) cursor++
  return { line, next: cursor }
}
