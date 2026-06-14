import { isDict, PdfDict, PdfError, PdfPrimitive, PdfRuntime } from '../types'

let nodeZlib: Promise<typeof import('node:zlib')> | undefined

export const decodeFilter = async (
  name: string,
  data: Uint8Array,
  dict: PdfDict,
  runtime?: PdfRuntime,
  decodeParms?: PdfPrimitive,
): Promise<Uint8Array> => {
  let decoded: Uint8Array
  if (name === 'FlateDecode' || name === 'Fl') decoded = runtime?.decodeFilter ? await runtime.decodeFilter(name, data, dict) : await inflate(data)
  else if (name === 'ASCIIHexDecode' || name === 'AHx') decoded = decodeAsciiHex(data)
  else if (name === 'ASCII85Decode' || name === 'A85') decoded = decodeAscii85(data)
  else if (name === 'RunLengthDecode' || name === 'RL') decoded = decodeRunLength(data)
  else if (name === 'LZWDecode' || name === 'LZW') decoded = decodeLzw(data, decodeParmNumber(decodeParms, 'EarlyChange', 1))
  else throw new PdfError(`Unsupported stream filter ${name}`)
  return applyDecodeParms(decoded, decodeParms)
}

const inflate = async (data: Uint8Array): Promise<Uint8Array> => {
  if (typeof DecompressionStream !== 'undefined') {
    try {
      return await inflateWithBrowserApi(data)
    } catch {
      // Node.js also exposes DecompressionStream, but zlib remains the more
      // predictable FlateDecode path for PDF streams in that environment.
    }
  }
  return inflateWithNode(data)
}

const inflateWithBrowserApi = async (data: Uint8Array): Promise<Uint8Array> => {
  const copy = new ArrayBuffer(data.byteLength)
  new Uint8Array(copy).set(data)
  const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

const inflateWithNode = async (data: Uint8Array): Promise<Uint8Array> => {
  try {
    nodeZlib ??= import(/* @vite-ignore */ 'node:zlib')
    const zlib = await nodeZlib
    const output = zlib.inflateSync(data)
    return new Uint8Array(output.buffer, output.byteOffset, output.byteLength)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new PdfError(`FlateDecode failed: ${message}`)
  }
}

export const decodeAsciiHex = (data: Uint8Array): Uint8Array => {
  const output: number[] = []
  let highNibble = -1
  for (const byte of data) {
    if (byte === 62) break
    if (isWhite(byte)) continue
    const value = hexValue(byte)
    if (value < 0) throw new PdfError('ASCIIHexDecode found a non-hex byte')
    if (highNibble < 0) highNibble = value
    else {
      output.push((highNibble << 4) | value)
      highNibble = -1
    }
  }
  if (highNibble >= 0) output.push(highNibble << 4)
  return Uint8Array.from(output)
}

export const decodeAscii85 = (data: Uint8Array): Uint8Array => {
  const output: number[] = []
  let group: number[] = []
  for (let i = 0; i < data.length; i++) {
    const byte = data[i]
    if (isWhite(byte)) continue
    if (byte === 126 && data[i + 1] === 62) break
    if (byte === 122 && group.length === 0) {
      output.push(0, 0, 0, 0)
      continue
    }
    if (byte < 33 || byte > 117) throw new PdfError('ASCII85Decode found an invalid byte')
    group.push(byte - 33)
    if (group.length === 5) {
      writeAscii85Group(output, group, 4)
      group = []
    }
  }
  if (group.length > 0) {
    const useful = group.length - 1
    while (group.length < 5) group.push(84)
    writeAscii85Group(output, group, useful)
  }
  return Uint8Array.from(output)
}

export const decodeRunLength = (data: Uint8Array): Uint8Array => {
  const output: number[] = []
  for (let i = 0; i < data.length; i++) {
    const length = data[i]
    if (length === 128) break
    if (length <= 127) {
      const count = length + 1
      for (let j = 0; j < count && i + 1 + j < data.length; j++) output.push(data[i + 1 + j])
      i += count
    } else {
      const count = 257 - length
      const value = data[++i] ?? 0
      for (let j = 0; j < count; j++) output.push(value)
    }
  }
  return Uint8Array.from(output)
}

const decodeLzw = (data: Uint8Array, earlyChange: number): Uint8Array => {
  const reader = new BitReader(data)
  let table = createLzwTable()
  let codeSize = 9
  let nextCode = 258
  let previous: Uint8Array | undefined
  const chunks: Uint8Array[] = []
  let total = 0

  while (true) {
    const code = reader.readBits(codeSize)
    if (code < 0 || code === 257) break
    if (code === 256) {
      table = createLzwTable()
      codeSize = 9
      nextCode = 258
      previous = undefined
      continue
    }

    const entry = table[code] ?? (code === nextCode && previous ? appendByte(previous, previous[0]) : undefined)
    if (!entry) throw new PdfError(`LZWDecode found an invalid code ${code}`)
    chunks.push(entry)
    total += entry.length

    if (previous && nextCode < 4096) {
      table[nextCode++] = appendByte(previous, entry[0])
      if (codeSize < 12 && nextCode + earlyChange >= 1 << codeSize) codeSize++
    }
    previous = entry
  }

  const output = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.length
  }
  return output
}

const writeAscii85Group = (output: number[], group: number[], bytes: number): void => {
  let value = 0
  for (const digit of group) value = value * 85 + digit
  const decoded = [
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ]
  output.push(...decoded.slice(0, bytes))
}

const hexValue = (byte: number): number => {
  if (byte >= 48 && byte <= 57) return byte - 48
  if (byte >= 65 && byte <= 70) return byte - 55
  if (byte >= 97 && byte <= 102) return byte - 87
  return -1
}

const isWhite = (byte: number): boolean =>
  byte === 0 || byte === 9 || byte === 10 || byte === 12 || byte === 13 || byte === 32

class BitReader {
  private bitOffset = 0

  constructor(private readonly data: Uint8Array) {}

  readBits(size: number): number {
    if (this.bitOffset + size > this.data.length * 8) return -1
    let value = 0
    for (let i = 0; i < size; i++) {
      const byte = this.data[this.bitOffset >> 3]
      const bit = (byte >> (7 - (this.bitOffset & 7))) & 1
      value = (value << 1) | bit
      this.bitOffset++
    }
    return value
  }
}

const createLzwTable = (): Array<Uint8Array | undefined> => {
  const table: Array<Uint8Array | undefined> = new Array(4096)
  for (let i = 0; i < 256; i++) table[i] = Uint8Array.of(i)
  return table
}

const appendByte = (source: Uint8Array, byte: number): Uint8Array => {
  const output = new Uint8Array(source.length + 1)
  output.set(source)
  output[source.length] = byte
  return output
}

const decodeParmNumber = (decodeParms: PdfPrimitive | undefined, key: string, fallback: number): number =>
  isDict(decodeParms) ? numberEntry(decodeParms, key, fallback) : fallback

const applyDecodeParms = (data: Uint8Array, decodeParms: PdfPrimitive | undefined): Uint8Array => {
  if (!isDict(decodeParms)) return data
  const predictor = numberEntry(decodeParms, 'Predictor', 1)
  if (predictor <= 1) return data
  const colors = numberEntry(decodeParms, 'Colors', 1)
  const bitsPerComponent = numberEntry(decodeParms, 'BitsPerComponent', 8)
  const columns = numberEntry(decodeParms, 'Columns', 1)
  if (predictor === 2) return applyTiffPredictor(data, colors, bitsPerComponent, columns)
  if (predictor >= 10 && predictor <= 15) return applyPngPredictor(data, colors, bitsPerComponent, columns)
  throw new PdfError(`Unsupported predictor ${predictor}`)
}

const applyTiffPredictor = (data: Uint8Array, colors: number, bitsPerComponent: number, columns: number): Uint8Array => {
  const rowLength = Math.ceil((colors * bitsPerComponent * columns) / 8)
  if (rowLength <= 0 || colors <= 0 || columns <= 0) return data
  if (bitsPerComponent !== 1 && bitsPerComponent !== 2 && bitsPerComponent !== 4 && bitsPerComponent !== 8) {
    throw new PdfError('TIFF predictor currently supports 1, 2, 4, and 8-bit components only')
  }
  const output = new Uint8Array(data)
  if (bitsPerComponent !== 8) return applyPackedTiffPredictor(output, colors, bitsPerComponent, columns, rowLength)
  const bytesPerPixel = colors
  for (let row = 0; row < output.length; row += rowLength) {
    for (let i = bytesPerPixel; i < rowLength && row + i < output.length; i++) {
      output[row + i] = (output[row + i] + output[row + i - bytesPerPixel]) & 0xff
    }
  }
  return output
}

const applyPackedTiffPredictor = (output: Uint8Array, colors: number, bitsPerComponent: number, columns: number, rowLength: number): Uint8Array => {
  const sampleMax = (1 << bitsPerComponent) - 1
  const samplesPerRow = colors * columns
  for (let row = 0; row < output.length; row += rowLength) {
    const rowBytes = Math.min(rowLength, output.length - row)
    const samplesInRow = Math.min(samplesPerRow, Math.floor((rowBytes * 8) / bitsPerComponent))
    for (let sample = colors; sample < samplesInRow; sample++) {
      const encoded = readPackedPredictorSample(output, row, sample, bitsPerComponent, sampleMax)
      const left = readPackedPredictorSample(output, row, sample - colors, bitsPerComponent, sampleMax)
      writePackedPredictorSample(output, row, sample, bitsPerComponent, sampleMax, encoded + left)
    }
  }
  return output
}

const readPackedPredictorSample = (data: Uint8Array, rowOffset: number, sample: number, bitsPerComponent: number, sampleMax: number): number => {
  const bitOffset = sample * bitsPerComponent
  const byteOffset = rowOffset + (bitOffset >> 3)
  const shift = 8 - bitsPerComponent - (bitOffset & 7)
  return ((data[byteOffset] ?? 0) >> shift) & sampleMax
}

const writePackedPredictorSample = (data: Uint8Array, rowOffset: number, sample: number, bitsPerComponent: number, sampleMax: number, value: number): void => {
  const bitOffset = sample * bitsPerComponent
  const byteOffset = rowOffset + (bitOffset >> 3)
  const shift = 8 - bitsPerComponent - (bitOffset & 7)
  const mask = sampleMax << shift
  data[byteOffset] = (data[byteOffset] & ~mask) | ((value & sampleMax) << shift)
}

const applyPngPredictor = (data: Uint8Array, colors: number, bitsPerComponent: number, columns: number): Uint8Array => {
  const rowLength = Math.ceil((colors * bitsPerComponent * columns) / 8)
  const bytesPerPixel = Math.max(1, Math.ceil((colors * bitsPerComponent) / 8))
  const output = new Uint8Array(rowLength * Math.floor(data.length / (rowLength + 1)))
  let source = 0
  let target = 0
  while (source < data.length && target < output.length) {
    const filter = data[source++]
    const rowStart = target
    const previousRowStart = rowStart - rowLength
    for (let i = 0; i < rowLength && source < data.length; i++, source++, target++) {
      const raw = data[source]
      const left = i >= bytesPerPixel ? output[target - bytesPerPixel] : 0
      const up = previousRowStart >= 0 ? output[previousRowStart + i] : 0
      const upperLeft = previousRowStart >= 0 && i >= bytesPerPixel ? output[previousRowStart + i - bytesPerPixel] : 0
      output[target] = (raw + predictorValue(filter, left, up, upperLeft)) & 0xff
    }
  }
  return output
}

const predictorValue = (filter: number, left: number, up: number, upperLeft: number): number => {
  if (filter === 0) return 0
  if (filter === 1) return left
  if (filter === 2) return up
  if (filter === 3) return Math.floor((left + up) / 2)
  if (filter === 4) return paeth(left, up, upperLeft)
  throw new PdfError(`Unsupported PNG predictor row filter ${filter}`)
}

const paeth = (left: number, up: number, upperLeft: number): number => {
  const estimate = left + up - upperLeft
  const leftDistance = Math.abs(estimate - left)
  const upDistance = Math.abs(estimate - up)
  const upperLeftDistance = Math.abs(estimate - upperLeft)
  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left
  if (upDistance <= upperLeftDistance) return up
  return upperLeft
}

const numberEntry = (dict: PdfDict, key: string, fallback: number): number => {
  const value = dict.entries.get(key)
  return typeof value === 'number' ? value : fallback
}
