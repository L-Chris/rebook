import { createCanvas, ImageData, type Canvas, type ContextAttributes, type SKRSContext2D } from '@napi-rs/canvas'
import type { PdfImageData } from '../types'
import { Canvas2DRenderer, type Canvas2DRenderResult, type Canvas2DRendererOptions, type PdfCanvas2DContext } from './canvas'
import type { PdfRenderContext, PdfRenderer, PdfRenderPageOptions } from './types'

export interface NodeCanvasRendererOptions extends Omit<Canvas2DRendererOptions, 'createImageSurface'> {
  contextAttributes?: ContextAttributes
}

export interface NodeCanvasRenderTarget {
  canvas?: Canvas
}

export interface NodeCanvasRenderResult extends Canvas2DRenderResult {
  canvas: Canvas
  context: SKRSContext2D
}

export type NodeCanvasImageFormat = 'png' | 'jpeg' | 'webp'
export type NodeCanvasMimeType = 'image/png' | 'image/jpeg' | 'image/webp'

export interface NodeCanvasEncodeOptions {
  format?: NodeCanvasImageFormat
  quality?: number
}

export interface NodeCanvasBufferRenderResult extends NodeCanvasRenderResult {
  data: Buffer
  mimeType: NodeCanvasMimeType
}

export class NodeCanvasRenderer implements PdfRenderer<NodeCanvasRenderTarget, NodeCanvasRenderResult> {
  readonly id = 'node-canvas'
  readonly platform = 'node'
  private readonly canvasRenderer: Canvas2DRenderer

  constructor(private readonly options: NodeCanvasRendererOptions = {}) {
    this.canvasRenderer = new Canvas2DRenderer({
      ...options,
      createImageSurface: createNodeImageSurface,
    })
  }

  async renderPage(context: PdfRenderContext, target: NodeCanvasRenderTarget, options: PdfRenderPageOptions): Promise<NodeCanvasRenderResult> {
    const canvas = target.canvas ?? createCanvas(1, 1)
    const canvasContext = canvas.getContext('2d', this.options.contextAttributes)
    const result = await this.canvasRenderer.renderPage(context, canvasContext as unknown as PdfCanvas2DContext, options)
    return {
      ...result,
      canvas,
      context: canvasContext,
    }
  }

  async renderPageToCanvas(context: PdfRenderContext, options: PdfRenderPageOptions, target: NodeCanvasRenderTarget = {}): Promise<NodeCanvasRenderResult> {
    return this.renderPage(context, target, options)
  }

  async renderPageToBuffer(
    context: PdfRenderContext,
    options: PdfRenderPageOptions,
    encodeOptions: NodeCanvasEncodeOptions = {},
    target: NodeCanvasRenderTarget = {},
  ): Promise<NodeCanvasBufferRenderResult> {
    const result = await this.renderPage(context, target, options)
    const mimeType = toMimeType(encodeOptions.format ?? 'png')
    return {
      ...result,
      data: encodeCanvas(result.canvas, mimeType, encodeOptions.quality),
      mimeType,
    }
  }
}

export const createNodeCanvasRenderer = (options?: NodeCanvasRendererOptions): NodeCanvasRenderer =>
  new NodeCanvasRenderer(options)

const createNodeImageSurface = (image: PdfImageData): CanvasImageSource => {
  const canvas = createCanvas(image.width, image.height)
  const context = canvas.getContext('2d')
  const rgba = new Uint8ClampedArray(image.data.byteLength)
  rgba.set(image.data)
  context.putImageData(new ImageData(rgba, image.width, image.height), 0, 0)
  return canvas as unknown as CanvasImageSource
}

const toMimeType = (format: NodeCanvasImageFormat): NodeCanvasMimeType => {
  if (format === 'jpeg') return 'image/jpeg'
  if (format === 'webp') return 'image/webp'
  return 'image/png'
}

const encodeCanvas = (canvas: Canvas, mimeType: NodeCanvasMimeType, quality?: number): Buffer => {
  if (mimeType === 'image/png') return canvas.toBuffer(mimeType)
  return canvas.toBuffer(mimeType, quality)
}
