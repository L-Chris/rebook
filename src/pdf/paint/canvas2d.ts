import { PdfBlendMode, PdfDisplayOp, PdfFontSource, PdfImageData, PdfMatrix, PdfPageDisplayList, PdfPathSegment, PdfShading, PdfShadingPattern, PdfTextRun } from '../types'
import { PdfRenderContext, PdfRenderer, PdfRenderPageOptions, PdfPageRenderResult } from './types'

export type PdfCanvas2DContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export interface Canvas2DRendererOptions {
  clear?: boolean
  background?: string
  createImageSurface?: (image: PdfImageData) => CanvasImageSource
  registerFonts?: (fonts: PdfFontSource[]) => void | Promise<void>
}

export interface Canvas2DRenderResult extends PdfPageRenderResult {
  ops: number
}

export class Canvas2DRenderer implements PdfRenderer<PdfCanvas2DContext, Canvas2DRenderResult> {
  readonly id = 'canvas-2d'
  readonly platform = 'canvas-2d'
  private readonly imageSurfaces = new WeakMap<PdfImageData, CanvasImageSource>()
  private readonly registeredFontIds = new Set<string>()

  constructor(private readonly rendererOptions: Canvas2DRendererOptions = {}) {}

  async renderPage(context: PdfRenderContext, target: PdfCanvas2DContext, options: PdfRenderPageOptions): Promise<Canvas2DRenderResult> {
    const displayList = await context.document.getPageDisplayList(options.pageIndex)
    const scale = options.scale ?? 1
    const width = Math.ceil(displayList.width * scale)
    const height = Math.ceil(displayList.height * scale)
    resizeCanvas(target, width, height)
    await this.registerDisplayListFonts(displayList)
    renderDisplayList(target, displayList, scale, this.rendererOptions, this.imageSurfaces)
    return {
      pageIndex: displayList.pageIndex,
      width,
      height,
      ops: displayList.ops.length,
    }
  }

  private async registerDisplayListFonts(displayList: PdfPageDisplayList): Promise<void> {
    const register = this.rendererOptions.registerFonts ?? getBrowserFontRegistrar()
    if (!register) return
    const fonts = collectFontSources(displayList, this.registeredFontIds)
    if (fonts.length === 0) return
    try {
      await register(fonts)
    } finally {
      for (const font of fonts) this.registeredFontIds.add(font.id)
    }
  }
}

export const createCanvas2DRenderer = (options?: Canvas2DRendererOptions): Canvas2DRenderer => new Canvas2DRenderer(options)

const renderDisplayList = (
  context: PdfCanvas2DContext,
  displayList: PdfPageDisplayList,
  scale: number,
  options: Canvas2DRendererOptions,
  imageSurfaces: WeakMap<PdfImageData, CanvasImageSource>,
): void => {
  if (options.clear ?? true) context.clearRect(0, 0, displayList.width * scale, displayList.height * scale)
  if (options.background) {
    context.save()
    context.fillStyle = options.background
    context.fillRect(0, 0, displayList.width * scale, displayList.height * scale)
    context.restore()
  }
  context.save()
  context.setTransform(scale, 0, 0, -scale, 0, displayList.height * scale)
  const state: CanvasRenderState = { strokeAlpha: 1, fillAlpha: 1, blendMode: 'normal', textWidthCache: new Map() }
  const stateStack: CanvasRenderState[] = []
  for (let index = 0; index < displayList.ops.length;) {
    const consumed = renderTransformedTextBatch(context, displayList.ops, index, state)
    if (consumed > 0) {
      index += consumed
      continue
    }
    renderOp(context, displayList.ops[index], displayList.width, displayList.height, options, imageSurfaces, state, stateStack)
    index++
  }
  context.restore()
}

const renderOp = (
  context: PdfCanvas2DContext,
  op: PdfDisplayOp,
  width: number,
  height: number,
  options: Canvas2DRendererOptions,
  imageSurfaces: WeakMap<PdfImageData, CanvasImageSource>,
  state: CanvasRenderState,
  stateStack: CanvasRenderState[],
): void => {
  switch (op.type) {
    case 'save':
      stateStack.push({ ...state })
      context.save()
      break
    case 'restore':
      Object.assign(state, stateStack.pop() ?? { strokeAlpha: 1, fillAlpha: 1, blendMode: 'normal' })
      context.restore()
      break
    case 'transform':
      context.transform(...op.matrix)
      break
    case 'lineWidth':
      context.lineWidth = op.width
      break
    case 'lineCap':
      context.lineCap = op.cap
      break
    case 'lineJoin':
      context.lineJoin = op.join
      break
    case 'miterLimit':
      context.miterLimit = op.limit
      break
    case 'dash':
      context.setLineDash(op.pattern)
      context.lineDashOffset = op.phase
      break
    case 'strokeAlpha':
      state.strokeAlpha = op.alpha
      break
    case 'fillAlpha':
      state.fillAlpha = op.alpha
      break
    case 'blendMode':
      state.blendMode = op.mode
      context.globalCompositeOperation = canvasBlendMode(op.mode)
      break
    case 'strokeColor':
      context.strokeStyle = cssColor(op.color)
      break
    case 'fillColor':
      context.fillStyle = cssColor(op.color)
      break
    case 'path':
      drawPath(context, op.segments)
      if (op.paint === 'stroke') strokePath(context, state, op.stroke)
      else if (op.paint === 'fill') fillPath(context, state, 'nonzero', op.fill)
      else if (op.paint === 'fillEvenOdd') fillPath(context, state, 'evenodd', op.fill)
      else if (op.paint === 'fillStroke') {
        fillPath(context, state, 'nonzero', op.fill)
        strokePath(context, state, op.stroke)
      } else if (op.paint === 'fillStrokeEvenOdd') {
        fillPath(context, state, 'evenodd', op.fill)
        strokePath(context, state, op.stroke)
      }
      break
    case 'clip':
      drawPath(context, op.segments)
      context.clip(op.rule)
      break
    case 'shading':
      renderShading(context, op.shading, width, height, state)
      break
    case 'image': {
      const bitmap = getImageSurface(op.image, options, imageSurfaces)
      context.save()
      context.scale(1, -1)
      withAlpha(context, state.fillAlpha, () => context.drawImage(bitmap, 0, -1, 1, 1))
      context.restore()
      break
    }
    case 'text':
      if (!paintsVisibleText(op.run)) break
      context.save()
      context.translate(op.run.x, op.run.y)
      context.scale(1, -1)
      applyTextStyle(context, op.run)
      drawTextRun(context, op.run, state)
      context.restore()
      break
  }
}

interface CanvasRenderState {
  strokeAlpha: number
  fillAlpha: number
  blendMode: PdfBlendMode
  textWidthCache: Map<string, number>
}

const fill = (context: PdfCanvas2DContext, state: CanvasRenderState, rule: CanvasFillRule): void =>
  withAlpha(context, state.fillAlpha, () => context.fill(rule))

const stroke = (context: PdfCanvas2DContext, state: CanvasRenderState): void =>
  withAlpha(context, state.strokeAlpha, () => context.stroke())

const fillPath = (context: PdfCanvas2DContext, state: CanvasRenderState, rule: CanvasFillRule, pattern?: PdfShadingPattern): void => {
  if (!pattern) {
    fill(context, state, rule)
    return
  }
  const previous = context.fillStyle
  context.fillStyle = createShadingFillStyle(context, pattern.shading)
  try {
    fill(context, state, rule)
  } finally {
    context.fillStyle = previous
  }
}

const strokePath = (context: PdfCanvas2DContext, state: CanvasRenderState, pattern?: PdfShadingPattern): void => {
  if (!pattern) {
    stroke(context, state)
    return
  }
  const previous = context.strokeStyle
  context.strokeStyle = createShadingFillStyle(context, pattern.shading)
  try {
    stroke(context, state)
  } finally {
    context.strokeStyle = previous
  }
}

const renderShading = (context: PdfCanvas2DContext, shading: PdfShading, width: number, height: number, state: CanvasRenderState): void => {
  const gradient = createShadingFillStyle(context, shading)
  const previous = context.fillStyle
  context.fillStyle = gradient
  try {
    withAlpha(context, state.fillAlpha, () => context.fillRect(0, 0, width, height))
  } finally {
    context.fillStyle = previous
  }
}

const renderTransformedTextBatch = (
  context: PdfCanvas2DContext,
  ops: PdfDisplayOp[],
  startIndex: number,
  state: CanvasRenderState,
): number => {
  const first = transformedTextSequenceAt(ops, startIndex)
  if (!first) return 0

  const previousFont = context.font
  const previousFillStyle = context.fillStyle
  const previousStrokeStyle = context.strokeStyle
  applyTextStyle(context, first.run)

  let consumed = 0
  for (let index = startIndex; index < ops.length;) {
    const sequence = transformedTextSequenceAt(ops, index)
    if (!sequence || !sameTextStyle(first.run, sequence.run)) break
    const span = collectTextSpan(ops, index, first.run)
    renderTextSpan(context, span, state)
    consumed += span.consumed
    index += span.consumed
  }

  context.font = previousFont
  context.fillStyle = previousFillStyle
  context.strokeStyle = previousStrokeStyle
  return consumed
}

const renderTextSpan = (context: PdfCanvas2DContext, span: FastTextSpan, state: CanvasRenderState): void => {
  context.save()
  context.transform(...span.matrix)
  context.scale(1, -1)
  drawTextValue(context, span.run, state, span.text)
  context.restore()
}

const collectTextSpan = (ops: PdfDisplayOp[], startIndex: number, styleRun: PdfTextRun): FastTextSpan => {
  const first = transformedTextSequenceAt(ops, startIndex)
  if (!first) throw new Error('Missing transformed text sequence')
  let text = first.run.text
  let width = textAdvance(first.run)
  let consumed = 4
  let previous = first
  for (let index = startIndex + 4; index < ops.length; index += 4) {
    const next = transformedTextSequenceAt(ops, index)
    if (!next || !sameTextStyle(styleRun, next.run) || !canAppendTextSequence(previous, next)) break
    const offset = localTextOffset(first.matrix, next.matrix)
    width = Math.max(width, offset.x + textAdvance(next.run))
    text += next.run.text
    consumed += 4
    previous = next
  }
  return { matrix: first.matrix, run: { ...first.run, text, width }, text, consumed }
}

const transformedTextSequenceAt = (ops: PdfDisplayOp[], index: number): FastTextSequence | undefined => {
  const save = ops[index]
  const transform = ops[index + 1]
  const text = ops[index + 2]
  const restore = ops[index + 3]
  if (save?.type !== 'save' || transform?.type !== 'transform' || text?.type !== 'text' || restore?.type !== 'restore') return undefined
  if (text.run.x !== 0 || text.run.y !== 0 || !paintsVisibleText(text.run)) return undefined
  return { matrix: transform.matrix, run: text.run }
}

interface FastTextSequence {
  matrix: PdfMatrix
  run: PdfTextRun
}

interface FastTextSpan extends FastTextSequence {
  text: string
  consumed: number
}

const applyTextStyle = (context: PdfCanvas2DContext, run: PdfTextRun): void => {
  context.font = textFont(run)
  if (paintsTextFill(run.renderingMode)) context.fillStyle = cssColor(run.fillColor ?? [0, 0, 0])
  if (paintsTextStroke(run.renderingMode)) context.strokeStyle = cssColor(run.strokeColor ?? [0, 0, 0])
}

const drawTextRun = (context: PdfCanvas2DContext, run: PdfTextRun, state: CanvasRenderState): void => {
  drawTextValue(context, run, state, run.text)
}

const drawTextValue = (context: PdfCanvas2DContext, run: PdfTextRun, state: CanvasRenderState, text: string): void => {
  const scale = textWidthScale(context, run, state, text)
  if (scale === 1) {
    drawUnscaledTextValue(context, run, state, text)
    return
  }
  context.save()
  context.scale(scale, 1)
  try {
    drawUnscaledTextValue(context, run, state, text)
  } finally {
    context.restore()
  }
}

const sameTextStyle = (left: PdfTextRun, right: PdfTextRun): boolean =>
  textFont(left) === textFont(right) &&
  (left.renderingMode ?? 'fill') === (right.renderingMode ?? 'fill') &&
  sameColor(left.fillColor, right.fillColor) &&
  sameColor(left.strokeColor, right.strokeColor)

const textFont = (run: PdfTextRun): string => {
  const size = `${Math.max(1, run.fontSize)}px`
  const family = run.fontFamily ?? 'sans-serif'
  const style = run.fontStyle ?? 'normal'
  const weight = run.fontWeight ?? 'normal'
  const prefix = [
    style !== 'normal' ? style : undefined,
    weight !== 'normal' ? weight : undefined,
  ].filter(Boolean).join(' ')
  return prefix ? `${prefix} ${size} ${family}` : `${size} ${family}`
}

const collectFontSources = (displayList: PdfPageDisplayList, registeredIds: Set<string>): PdfFontSource[] => {
  const fonts: PdfFontSource[] = []
  for (const op of displayList.ops) {
    if (op.type !== 'text' || !op.run.fontSource || registeredIds.has(op.run.fontSource.id) || fonts.some((font) => font.id === op.run.fontSource?.id)) continue
    fonts.push(op.run.fontSource)
  }
  return fonts
}

const getBrowserFontRegistrar = (): ((fonts: PdfFontSource[]) => Promise<void>) | undefined => {
  const FontFaceCtor = globalThis.FontFace
  const fontSet = globalThis.document?.fonts
  if (typeof FontFaceCtor !== 'function' || !fontSet || typeof fontSet.add !== 'function') return undefined
  return async (fonts) => {
    await Promise.all(fonts.map(async (font) => {
      try {
        const face = new FontFaceCtor(font.family, fontArrayBuffer(font.getBrowserData?.() ?? font.data), {
          ...(font.weight ? { weight: font.weight } : {}),
          ...(font.style ? { style: font.style } : {}),
        })
        await face.load()
        fontSet.add(face)
      } catch {
        // Keep rendering with the CSS fallback stack when a platform rejects a font program.
      }
    }))
  }
}

const fontArrayBuffer = (data: Uint8Array): ArrayBuffer =>
  data.slice().buffer

const canAppendTextSequence = (previous: FastTextSequence, next: FastTextSequence): boolean => {
  if (!sameMatrixLinearPart(previous.matrix, next.matrix)) return false
  const offset = localTextOffset(previous.matrix, next.matrix)
  const expected = textAdvance(previous.run)
  const tolerance = Math.max(0.5, previous.run.fontSize * 0.1)
  return Math.abs(offset.y) <= tolerance && Math.abs(offset.x - expected) <= tolerance
}

const sameMatrixLinearPart = (left: PdfMatrix, right: PdfMatrix): boolean =>
  nearEqual(left[0], right[0]) &&
  nearEqual(left[1], right[1]) &&
  nearEqual(left[2], right[2]) &&
  nearEqual(left[3], right[3])

const localTextOffset = (from: PdfMatrix, to: PdfMatrix): { x: number; y: number } => {
  const dx = to[4] - from[4]
  const dy = to[5] - from[5]
  const determinant = from[0] * from[3] - from[1] * from[2]
  if (Math.abs(determinant) < 1e-9) return { x: Number.NaN, y: Number.NaN }
  return {
    x: (from[3] * dx - from[2] * dy) / determinant,
    y: (-from[1] * dx + from[0] * dy) / determinant,
  }
}

const drawUnscaledTextValue = (context: PdfCanvas2DContext, run: PdfTextRun, state: CanvasRenderState, text: string): void => {
  if (paintsTextFill(run.renderingMode)) withAlpha(context, state.fillAlpha, () => context.fillText(text, 0, 0))
  if (paintsTextStroke(run.renderingMode)) withAlpha(context, state.strokeAlpha, () => context.strokeText(text, 0, 0))
}

const textWidthScale = (context: PdfCanvas2DContext, run: PdfTextRun, state: CanvasRenderState, text: string): number => {
  const width = run.width
  if (width === undefined || width <= 0 || text.length === 0) return 1
  const measured = measureTextWidth(context, state, text)
  if (!Number.isFinite(measured) || measured <= 0) return 1
  const scale = width / measured
  return Number.isFinite(scale) && Math.abs(scale - 1) > 1e-3 ? scale : 1
}

const maxTextWidthCacheEntries = 4096

const measureTextWidth = (context: PdfCanvas2DContext, state: CanvasRenderState, text: string): number => {
  const key = `${context.font}\0${text}`
  const cached = state.textWidthCache.get(key)
  if (cached !== undefined) return cached
  const width = context.measureText(text).width
  if (state.textWidthCache.size < maxTextWidthCacheEntries) state.textWidthCache.set(key, width)
  return width
}

const textAdvance = (run: PdfTextRun): number => run.width ?? Math.max(1, run.fontSize) * run.text.length

const nearEqual = (left: number, right: number): boolean => Math.abs(left - right) <= 1e-6

const paintsVisibleText = (run: PdfTextRun): boolean => {
  if (run.renderingMode === 'invisible' || run.renderingMode === 'clip') return false
  return paintsTextFill(run.renderingMode) || paintsTextStroke(run.renderingMode)
}

const sameColor = (left?: readonly [number, number, number], right?: readonly [number, number, number]): boolean => {
  const a = left ?? [0, 0, 0]
  const b = right ?? [0, 0, 0]
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
}

const createShadingFillStyle = (context: PdfCanvas2DContext, shading: PdfShading): CanvasGradient => {
  const gradient = shading.type === 'axial'
    ? context.createLinearGradient(...shading.coords)
    : context.createRadialGradient(...shading.coords)
  const stops = shading.colorStops.length > 0
    ? shading.colorStops
    : [
      { offset: 0, color: shading.startColor },
      { offset: 1, color: shading.endColor },
    ]
  for (const stop of stops) gradient.addColorStop(clamp01(stop.offset), cssColor(stop.color))
  return gradient
}

const withAlpha = (context: PdfCanvas2DContext, alpha: number, action: () => void): void => {
  const clamped = clamp01(alpha)
  if (context.globalAlpha === clamped) {
    action()
    return
  }
  const previous = context.globalAlpha
  context.globalAlpha = clamped
  try {
    action()
  } finally {
    context.globalAlpha = previous
  }
}

const paintsTextFill = (mode = 'fill'): boolean =>
  mode === 'fill' || mode === 'fillStroke' || mode === 'fillClip' || mode === 'fillStrokeClip'

const paintsTextStroke = (mode = 'fill'): boolean =>
  mode === 'stroke' || mode === 'fillStroke' || mode === 'strokeClip' || mode === 'fillStrokeClip'

const canvasBlendMode = (mode: PdfBlendMode): GlobalCompositeOperation => {
  switch (mode) {
    case 'normal':
      return 'source-over'
    case 'colorDodge':
      return 'color-dodge'
    case 'colorBurn':
      return 'color-burn'
    case 'hardLight':
      return 'hard-light'
    case 'softLight':
      return 'soft-light'
    default:
      return mode
  }
}

const getImageSurface = (image: PdfImageData, options: Canvas2DRendererOptions, cache: WeakMap<PdfImageData, CanvasImageSource>): CanvasImageSource => {
  let surface = cache.get(image)
  if (!surface) {
    surface = options.createImageSurface?.(image) ?? createImageCanvas(image)
    cache.set(image, surface)
  }
  return surface
}

const createImageCanvas = (image: PdfImageData): CanvasImageSource => {
  const canvas = createScratchCanvas(image.width, image.height)
  const context = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
  if (!context) throw new Error('Unable to create scratch canvas context')
  const rgba = new Uint8ClampedArray(new ArrayBuffer(image.data.byteLength))
  rgba.set(image.data)
  context.putImageData(new ImageData(rgba, image.width, image.height), 0, 0)
  return canvas
}

const createScratchCanvas = (width: number, height: number): HTMLCanvasElement | OffscreenCanvas => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

const drawPath = (context: PdfCanvas2DContext, segments: PdfPathSegment[]): void => {
  context.beginPath()
  for (const segment of segments) {
    if (segment.type === 'moveTo') context.moveTo(segment.x, segment.y)
    else if (segment.type === 'lineTo') context.lineTo(segment.x, segment.y)
    else if (segment.type === 'curveTo') context.bezierCurveTo(segment.x1, segment.y1, segment.x2, segment.y2, segment.x3, segment.y3)
    else if (segment.type === 'closePath') context.closePath()
    else if (segment.type === 'rect') context.rect(segment.x, segment.y, segment.width, segment.height)
  }
}

const cssColor = (color: readonly [number, number, number]): string => {
  const r = Math.round(clamp01(color[0]) * 255)
  const g = Math.round(clamp01(color[1]) * 255)
  const b = Math.round(clamp01(color[2]) * 255)
  return `rgb(${r} ${g} ${b})`
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value))

const resizeCanvas = (context: PdfCanvas2DContext, width: number, height: number): void => {
  const canvas = context.canvas
  if ('width' in canvas && canvas.width !== width) canvas.width = width
  if ('height' in canvas && canvas.height !== height) canvas.height = height
}
