import type { PdfDecodedImageData, PdfDict, PdfRuntime } from '../types'
import { PdfError } from '../types'

export const browserPdfRuntime: PdfRuntime = {
  platform: 'browser',
  async decodeFilter(name: string, data: Uint8Array, _dict: PdfDict): Promise<Uint8Array> {
    if (name !== 'FlateDecode' && name !== 'Fl') throw new PdfError(`Unsupported stream filter ${name}`)
    if (typeof DecompressionStream === 'undefined') throw new PdfError('This browser does not expose DecompressionStream')
    const copy = copyBytes(data)
    const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream('deflate'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  },
  async decodeImage(name: string, data: Uint8Array, _dict: PdfDict): Promise<PdfDecodedImageData> {
    if (name !== 'DCTDecode' && name !== 'DCT') throw new PdfError(`Unsupported image filter ${name}`)
    if (typeof createImageBitmap === 'undefined') throw new PdfError('This browser does not expose createImageBitmap')
    const bitmap = await createImageBitmap(new Blob([copyBytes(data)], { type: 'image/jpeg' }))
    try {
      const canvas = createScratchCanvas(bitmap.width, bitmap.height)
      const context = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
      if (!context) throw new PdfError('Unable to create a 2D context for image decoding')
      context.drawImage(bitmap, 0, 0)
      const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data
      const rgba = new Uint8ClampedArray(pixels.length)
      rgba.set(pixels)
      return { width: bitmap.width, height: bitmap.height, data: rgba }
    } finally {
      bitmap.close()
    }
  },
  now: () => globalThis.performance?.now?.() ?? Date.now(),
}

export function getBrowserPdfRuntime(): PdfRuntime | undefined {
  return typeof createImageBitmap === 'function' ? browserPdfRuntime : undefined
}

function createScratchCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height)
  if (typeof document === 'undefined') throw new PdfError('No canvas implementation is available for image decoding')
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function copyBytes(data: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(data.byteLength)
  new Uint8Array(copy).set(data)
  return copy
}
