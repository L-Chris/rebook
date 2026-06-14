import { createCanvas, loadImage } from '@napi-rs/canvas'
import { inflateSync } from 'node:zlib'
import type { PdfDecodedImageData, PdfDict, PdfRuntime } from '../types'
import { PdfError } from '../types'

export const nodePdfRuntime: PdfRuntime = {
  platform: 'node',
  decodeFilter(name: string, data: Uint8Array, _dict: PdfDict): Uint8Array {
    if (name !== 'FlateDecode' && name !== 'Fl') throw new PdfError(`Unsupported stream filter ${name}`)
    const output = inflateSync(data)
    return new Uint8Array(output.buffer, output.byteOffset, output.byteLength)
  },
  async decodeImage(name: string, data: Uint8Array, _dict: PdfDict): Promise<PdfDecodedImageData> {
    if (name !== 'DCTDecode' && name !== 'DCT') throw new PdfError(`Unsupported image filter ${name}`)
    const image = await loadImage(data)
    const canvas = createCanvas(image.width, image.height)
    const context = canvas.getContext('2d', { alpha: true })
    context.drawImage(image, 0, 0)
    const pixels = context.getImageData(0, 0, image.width, image.height).data
    const rgba = new Uint8ClampedArray(pixels.length)
    rgba.set(pixels)
    return { width: image.width, height: image.height, data: rgba }
  },
  now: () => globalThis.performance?.now?.() ?? Date.now(),
}

export const nodeRuntime = nodePdfRuntime
