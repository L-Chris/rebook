import type {
  PdfDisplayOp,
  PdfFontSource,
  PdfImageData,
  PdfMatrix,
  PdfPageDisplayList,
  PdfPathSegment,
  PdfTextRun,
} from '../types'
import { transformPoint } from '../engine/matrix'
import type { PdfPageRenderResult, PdfRenderContext, PdfRenderer, PdfRenderPageOptions } from './types'
import {
  clamp01,
  paintsPathFill,
  paintsPathStroke,
  paintsTextFill,
  paintsTextStroke,
  paintsVisibleText,
  pdfTextFont,
  replayPdfDisplayList,
  transformRectBounds,
  type PdfDrawingPipeline,
  type PdfDrawingState,
  type PdfRectBounds,
} from './display-list-pipeline'

export interface WebGpuRendererOptions {
  readonly clear?: boolean
  readonly background?: readonly [number, number, number, number]
  readonly fallbackOnUnsupported?: boolean
}

export interface WebGpuRenderResult extends PdfPageRenderResult {
  readonly ops: number
  readonly drawCalls: number
  readonly glyphs: number
  readonly paths: number
  readonly images: number
  readonly unsupportedOps: number
}

export class WebGpuRenderer implements PdfRenderer<HTMLCanvasElement, WebGpuRenderResult> {
  readonly id = 'webgpu'
  readonly platform = 'webgpu'
  private devicePromise: Promise<WebGpuDeviceBundle | null> | null = null
  private readonly pipelines = new Map<string, unknown>()
  private readonly registeredFontIds = new Set<string>()

  constructor(private readonly options: WebGpuRendererOptions = {}) {}

  async renderPage(
    context: PdfRenderContext,
    target: HTMLCanvasElement,
    options: PdfRenderPageOptions,
  ): Promise<WebGpuRenderResult> {
    const bundle = await this.getDeviceBundle()
    if (!bundle) throw new Error('WebGPU is unavailable')
    const displayList = await context.document.getPageDisplayList(options.pageIndex)
    const scale = options.scale ?? 1
    const width = Math.ceil(displayList.width * scale)
    const height = Math.ceil(displayList.height * scale)
    if (target.width !== width) target.width = width
    if (target.height !== height) target.height = height

    await this.registerDisplayListFonts(displayList)
    const builder = new WebGpuDisplayListBuilder(displayList, scale)
    await replayPdfDisplayList(displayList, builder, { ignoreInvisibleText: true })
    const page = await builder.finish()
    if (page.unsupportedOps > 0 && (this.options.fallbackOnUnsupported ?? true)) {
      page.destroy()
      throw new Error(`WebGPU PDF renderer does not support ${page.unsupportedOps} drawing op(s) on this page`)
    }

    renderWebGpuPage(target, page, bundle, this.pipelines, this.options)
    const result = {
      pageIndex: displayList.pageIndex,
      width,
      height,
      ops: displayList.ops.length,
      drawCalls: page.commands.length,
      glyphs: page.glyphs,
      paths: page.paths,
      images: page.images,
      unsupportedOps: page.unsupportedOps,
    }
    page.destroy()
    return result
  }

  destroy(): void {
    this.pipelines.clear()
  }

  private getDeviceBundle(): Promise<WebGpuDeviceBundle | null> {
    this.devicePromise ??= createWebGpuDeviceBundle()
    return this.devicePromise
  }

  private async registerDisplayListFonts(displayList: PdfPageDisplayList): Promise<void> {
    const fonts = collectFontSources(displayList, this.registeredFontIds)
    if (!fonts.length) return
    try {
      await registerBrowserFonts(fonts)
    } finally {
      for (const font of fonts) this.registeredFontIds.add(font.id)
    }
  }
}

export const createWebGpuRenderer = (options?: WebGpuRendererOptions): WebGpuRenderer =>
  new WebGpuRenderer(options)

interface WebGpuPage {
  readonly width: number
  readonly height: number
  readonly commands: WebGpuDrawCommand[]
  readonly glyphs: number
  readonly paths: number
  readonly images: number
  readonly unsupportedOps: number
  readonly atlas?: GlyphAtlasSnapshot
  destroy(): void
}

type WebGpuDrawCommand =
  | { readonly kind: 'solid'; readonly vertices: Float32Array; readonly scissor?: PdfRectBounds }
  | { readonly kind: 'texture'; readonly vertices: Float32Array; readonly texture: WebGpuTextureSource; readonly scissor?: PdfRectBounds }

interface WebGpuTextureSource {
  readonly source: unknown
  readonly width: number
  readonly height: number
  destroy?(): void
}

class WebGpuDisplayListBuilder implements PdfDrawingPipeline {
  private readonly commands: WebGpuDrawCommand[] = []
  private readonly atlas = new GlyphAtlas(2048)
  private unsupportedOps = 0
  private glyphs = 0
  private paths = 0
  private images = 0

  constructor(
    private readonly displayList: PdfPageDisplayList,
    private readonly scale: number,
  ) {}

  path(op: Extract<PdfDisplayOp, { type: 'path' }>, state: PdfDrawingState): void {
    if (state.blendMode !== 'normal' || op.fill || op.stroke) {
      this.unsupportedOps++
      return
    }
    const vertices: number[] = []
    if (paintsPathFill(op.paint)) {
      for (const triangle of tessellatePathFill(op.segments, state.transform)) {
        pushSolidTriangle(vertices, triangle, state.fillColor, state.fillAlpha, this.displayList)
      }
    }
    if (paintsPathStroke(op.paint)) {
      for (const triangle of tessellatePathStroke(op.segments, state)) {
        pushSolidTriangle(vertices, triangle, state.strokeColor, state.strokeAlpha, this.displayList)
      }
    }
    if (!vertices.length) return
    this.paths++
    this.commands.push({
      kind: 'solid',
      vertices: new Float32Array(vertices),
      ...(state.clipRect ? { scissor: state.clipRect } : {}),
    })
  }

  async image(op: Extract<PdfDisplayOp, { type: 'image' }>, state: PdfDrawingState): Promise<void> {
    if (state.blendMode !== 'normal') {
      this.unsupportedOps++
      return
    }
    const texture = await imageTextureSource(op.image)
    const points = [
      transformPoint(0, 1, state.transform),
      transformPoint(1, 1, state.transform),
      transformPoint(1, 0, state.transform),
      transformPoint(0, 0, state.transform),
    ]
    const vertices = texturedQuadVertices(points, [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ], [1, 1, 1], state.fillAlpha, this.displayList)
    this.images++
    this.commands.push({
      kind: 'texture',
      vertices,
      texture,
      ...(state.clipRect ? { scissor: state.clipRect } : {}),
    })
  }

  text(op: Extract<PdfDisplayOp, { type: 'text' }>, state: PdfDrawingState): void {
    if (state.blendMode !== 'normal' || !paintsVisibleText(op.run)) return
    if (paintsTextStroke(op.run.renderingMode)) {
      this.unsupportedOps++
      return
    }
    if (!paintsTextFill(op.run.renderingMode)) return

    const vertices = this.textVertices(op.run, state)
    if (!vertices.length) return
    this.commands.push({
      kind: 'texture',
      vertices: new Float32Array(vertices),
      texture: this.atlas,
      ...(state.clipRect ? { scissor: state.clipRect } : {}),
    })
  }

  shading(): void {
    this.unsupportedOps++
  }

  unsupported(): void {
    this.unsupportedOps++
  }

  async finish(): Promise<WebGpuPage> {
    await this.atlas.flush()
    const atlas = this.atlas.snapshot()
    const commands = this.commands
    return {
      width: this.displayList.width,
      height: this.displayList.height,
      commands,
      glyphs: this.glyphs,
      paths: this.paths,
      images: this.images,
      unsupportedOps: this.unsupportedOps,
      atlas,
      destroy() {
        atlas?.destroy?.()
        for (const command of commands) {
          if (command.kind === 'texture' && command.texture !== atlas) command.texture.destroy?.()
        }
      },
    }
  }

  private textVertices(run: PdfTextRun, state: PdfDrawingState): number[] {
    const color = run.fillColor ?? state.fillColor
    const textScale = textWidthScale(run, this.atlas, this.scale)
    const vertices: number[] = []
    let cursor = 0
    for (const char of Array.from(run.text)) {
      const glyph = this.atlas.getGlyph(run, char, this.scale)
      const advance = glyph.advance / this.scale
      if (glyph.visible) {
        const left = run.x + cursor + glyph.left / this.scale * textScale
        const right = run.x + cursor + glyph.right / this.scale * textScale
        const bottom = run.y - glyph.descent / this.scale
        const top = run.y + glyph.ascent / this.scale
        const points = [
          transformPoint(left, bottom, state.transform),
          transformPoint(right, bottom, state.transform),
          transformPoint(right, top, state.transform),
          transformPoint(left, top, state.transform),
        ]
        pushTexturedQuad(vertices, points, glyph.uv, color, state.fillAlpha, this.displayList)
        this.glyphs++
      }
      cursor += advance * textScale
    }
    return vertices
  }
}

interface GlyphMetrics {
  readonly uv: QuadUv
  readonly left: number
  readonly right: number
  readonly ascent: number
  readonly descent: number
  readonly advance: number
  readonly visible: boolean
}

interface GlyphAtlasSnapshot extends WebGpuTextureSource {}

type QuadUv = readonly [
  readonly [number, number],
  readonly [number, number],
  readonly [number, number],
  readonly [number, number],
]

class GlyphAtlas implements WebGpuTextureSource {
  readonly canvas: HTMLCanvasElement | OffscreenCanvas
  readonly context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  readonly width: number
  readonly height: number
  readonly source: HTMLCanvasElement | OffscreenCanvas
  private readonly glyphs = new Map<string, GlyphMetrics>()
  private x = 1
  private y = 1
  private rowHeight = 0
  private flushed = false

  constructor(size: number) {
    this.canvas = createScratchCanvas(size, size)
    this.context = this.canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
    this.width = size
    this.height = size
    this.source = this.canvas
    this.context.clearRect(0, 0, size, size)
    this.context.fillStyle = '#fff'
    this.context.textBaseline = 'alphabetic'
  }

  getGlyph(run: PdfTextRun, char: string, scale: number): GlyphMetrics {
    const font = pdfTextFont(run, scale)
    const key = `${font}\0${char}`
    const cached = this.glyphs.get(key)
    if (cached) return cached

    this.context.font = font
    const metrics = this.context.measureText(char)
    const advance = Math.max(0, metrics.width)
    const ascent = Math.max(1, metrics.actualBoundingBoxAscent || run.fontSize * scale * 0.8)
    const descent = Math.max(0, metrics.actualBoundingBoxDescent || run.fontSize * scale * 0.2)
    const left = Math.max(0, metrics.actualBoundingBoxLeft || 0)
    const right = Math.max(advance, metrics.actualBoundingBoxRight || advance)
    const glyphWidth = Math.ceil(left + right)
    const glyphHeight = Math.ceil(ascent + descent)
    if (!glyphWidth || !glyphHeight || !char.trim()) {
      const empty = {
        uv: [[0, 0], [0, 0], [0, 0], [0, 0]] as const,
        left: 0,
        right: 0,
        ascent,
        descent,
        advance,
        visible: false,
      }
      this.glyphs.set(key, empty)
      return empty
    }

    const padding = 2
    const width = glyphWidth + padding * 2
    const height = glyphHeight + padding * 2
    if (this.x + width >= this.width) {
      this.x = 1
      this.y += this.rowHeight + 1
      this.rowHeight = 0
    }
    if (this.y + height >= this.height) {
      // Drop drawing for very glyph-heavy pages rather than corrupting atlas UVs.
      const missing = {
        uv: [[0, 0], [0, 0], [0, 0], [0, 0]] as const,
        left: 0,
        right: 0,
        ascent,
        descent,
        advance,
        visible: false,
      }
      this.glyphs.set(key, missing)
      return missing
    }

    this.context.font = font
    this.context.fillStyle = '#fff'
    this.context.fillText(char, this.x + padding + left, this.y + padding + ascent)
    const uv = [
      [this.x / this.width, this.y / this.height],
      [(this.x + width) / this.width, this.y / this.height],
      [(this.x + width) / this.width, (this.y + height) / this.height],
      [this.x / this.width, (this.y + height) / this.height],
    ] as const
    const glyph = {
      uv,
        left: -left - padding,
        right: right + padding,
        ascent: ascent + padding,
        descent: descent + padding,
      advance,
      visible: true,
    }
    this.glyphs.set(key, glyph)
    this.x += width + 1
    this.rowHeight = Math.max(this.rowHeight, height)
    this.flushed = false
    return glyph
  }

  async flush(): Promise<void> {
    if (this.flushed) return
    if ('convertToBlob' in this.canvas && typeof this.canvas.convertToBlob === 'function' && typeof createImageBitmap === 'function') {
      const blob = await this.canvas.convertToBlob()
      const bitmap = await createImageBitmap(blob)
      ;(this as { source: unknown }).source = bitmap
      ;(this as { destroy?: () => void }).destroy = () => bitmap.close()
    }
    this.flushed = true
  }

  snapshot(): GlyphAtlasSnapshot {
    return this
  }
}

function textWidthScale(run: PdfTextRun, atlas: GlyphAtlas, scale: number): number {
  if (run.width === undefined || run.width <= 0 || !run.text) return 1
  let measured = 0
  for (const char of Array.from(run.text)) measured += atlas.getGlyph(run, char, scale).advance / scale
  if (!Number.isFinite(measured) || measured <= 0) return 1
  const widthScale = run.width / measured
  return Number.isFinite(widthScale) && Math.abs(widthScale - 1) > 1e-3 ? widthScale : 1
}

function tessellatePathFill(segments: readonly PdfPathSegment[], matrix: PdfMatrix): Point[][] {
  return flattenPath(segments, matrix)
    .flatMap(path => triangulateSimplePolygon(path.points))
}

function tessellatePathStroke(segments: readonly PdfPathSegment[], state: PdfDrawingState): Point[][] {
  const width = Math.max(0.01, state.lineWidth * matrixScale(state.transform))
  return flattenPath(segments, state.transform)
    .flatMap(path => strokePath(path.points, path.closed, width))
}

interface FlatPath {
  readonly points: Point[]
  readonly closed: boolean
}

interface Point {
  readonly x: number
  readonly y: number
}

function flattenPath(segments: readonly PdfPathSegment[], matrix: PdfMatrix): FlatPath[] {
  const paths: FlatPath[] = []
  let points: Point[] = []
  let current: Point | null = null
  let start: Point | null = null
  let closed = false
  const finish = () => {
    if (points.length >= 2) paths.push({ points, closed })
    points = []
    current = null
    start = null
    closed = false
  }
  for (const segment of segments) {
    if (segment.type === 'moveTo') {
      finish()
      current = { x: segment.x, y: segment.y }
      start = current
      points.push(transformPoint(current.x, current.y, matrix))
    } else if (segment.type === 'lineTo') {
      current = { x: segment.x, y: segment.y }
      points.push(transformPoint(current.x, current.y, matrix))
    } else if (segment.type === 'curveTo' && current) {
      for (let i = 1; i <= 12; i++) {
        const t = i / 12
        const p = cubicPoint(
          current,
          { x: segment.x1, y: segment.y1 },
          { x: segment.x2, y: segment.y2 },
          { x: segment.x3, y: segment.y3 },
          t,
        )
        points.push(transformPoint(p.x, p.y, matrix))
      }
      current = { x: segment.x3, y: segment.y3 }
    } else if (segment.type === 'closePath') {
      if (start && current && distance(current, start) > 1e-6) points.push(transformPoint(start.x, start.y, matrix))
      closed = true
      finish()
    } else if (segment.type === 'rect') {
      finish()
      const rect = [
        transformPoint(segment.x, segment.y, matrix),
        transformPoint(segment.x + segment.width, segment.y, matrix),
        transformPoint(segment.x + segment.width, segment.y + segment.height, matrix),
        transformPoint(segment.x, segment.y + segment.height, matrix),
      ]
      paths.push({ points: rect, closed: true })
    }
  }
  finish()
  return paths
}

function cubicPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const mt = 1 - t
  return {
    x: mt ** 3 * p0.x + 3 * mt ** 2 * t * p1.x + 3 * mt * t ** 2 * p2.x + t ** 3 * p3.x,
    y: mt ** 3 * p0.y + 3 * mt ** 2 * t * p1.y + 3 * mt * t ** 2 * p2.y + t ** 3 * p3.y,
  }
}

function triangulateSimplePolygon(points: readonly Point[]): Point[][] {
  const polygon = sanitizePolygon(points)
  if (polygon.length < 3) return []
  if (polygon.length === 3) return [[polygon[0], polygon[1], polygon[2]]]
  const triangles: Point[][] = []
  const indices = polygon.map((_, index) => index)
  const ccw = signedArea(polygon) > 0
  let guard = 0
  while (indices.length > 3 && guard++ < polygon.length * polygon.length) {
    let clipped = false
    for (let i = 0; i < indices.length; i++) {
      const prevIndex = indices[(i - 1 + indices.length) % indices.length]
      const index = indices[i]
      const nextIndex = indices[(i + 1) % indices.length]
      const prev = polygon[prevIndex]
      const point = polygon[index]
      const next = polygon[nextIndex]
      if (!isConvex(prev, point, next, ccw)) continue
      if (indices.some(candidate => {
        if (candidate === prevIndex || candidate === index || candidate === nextIndex) return false
        return pointInTriangle(polygon[candidate], prev, point, next)
      })) continue
      triangles.push([prev, point, next])
      indices.splice(i, 1)
      clipped = true
      break
    }
    if (!clipped) break
  }
  if (indices.length === 3) triangles.push(indices.map(index => polygon[index]) as Point[])
  return triangles
}

function strokePath(points: readonly Point[], closed: boolean, width: number): Point[][] {
  const clean = sanitizePolygon(points)
  const triangles: Point[][] = []
  const last = closed ? clean.length : clean.length - 1
  for (let i = 0; i < last; i++) {
    const a = clean[i]
    const b = clean[(i + 1) % clean.length]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const length = Math.hypot(dx, dy)
    if (length <= 1e-9) continue
    const nx = -dy / length * width / 2
    const ny = dx / length * width / 2
    const p0 = { x: a.x + nx, y: a.y + ny }
    const p1 = { x: b.x + nx, y: b.y + ny }
    const p2 = { x: b.x - nx, y: b.y - ny }
    const p3 = { x: a.x - nx, y: a.y - ny }
    triangles.push([p0, p1, p2], [p0, p2, p3])
  }
  return triangles
}

function sanitizePolygon(points: readonly Point[]): Point[] {
  const output: Point[] = []
  for (const point of points) {
    const previous = output[output.length - 1]
    if (!previous || distance(previous, point) > 1e-6) output.push(point)
  }
  if (output.length > 1 && distance(output[0], output[output.length - 1]) <= 1e-6) output.pop()
  return output
}

function pushSolidTriangle(
  vertices: number[],
  triangle: readonly Point[],
  color: readonly [number, number, number],
  alpha: number,
  displayList: PdfPageDisplayList,
): void {
  for (const point of triangle) {
    const [x, y] = clipPosition(point, displayList)
    vertices.push(x, y, clamp01(color[0]), clamp01(color[1]), clamp01(color[2]), clamp01(alpha))
  }
}

function texturedQuadVertices(
  points: readonly Point[],
  uv: QuadUv,
  color: readonly [number, number, number],
  alpha: number,
  displayList: PdfPageDisplayList,
): Float32Array {
  const vertices: number[] = []
  pushTexturedQuad(vertices, points, uv, color, alpha, displayList)
  return new Float32Array(vertices)
}

function pushTexturedQuad(
  vertices: number[],
  points: readonly Point[],
  uv: QuadUv,
  color: readonly [number, number, number],
  alpha: number,
  displayList: PdfPageDisplayList,
): void {
  const order = [0, 1, 2, 0, 2, 3]
  for (const index of order) {
    const [x, y] = clipPosition(points[index], displayList)
    const [u, v] = uv[index]
    vertices.push(x, y, u, v, clamp01(color[0]), clamp01(color[1]), clamp01(color[2]), clamp01(alpha))
  }
}

function clipPosition(point: Point, displayList: PdfPageDisplayList): [number, number] {
  return [
    point.x / displayList.width * 2 - 1,
    point.y / displayList.height * 2 - 1,
  ]
}

function matrixScale(matrix: PdfMatrix): number {
  const sx = Math.hypot(matrix[0], matrix[1])
  const sy = Math.hypot(matrix[2], matrix[3])
  const scale = (sx + sy) / 2
  return Number.isFinite(scale) && scale > 0 ? scale : 1
}

function signedArea(points: readonly Point[]): number {
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    area += (a.x * b.y) - (b.x * a.y)
  }
  return area / 2
}

function isConvex(a: Point, b: Point, c: Point, ccw: boolean): boolean {
  const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  return ccw ? cross > 0 : cross < 0
}

function pointInTriangle(point: Point, a: Point, b: Point, c: Point): boolean {
  const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y)
  if (Math.abs(denominator) < 1e-9) return false
  const u = ((b.y - c.y) * (point.x - c.x) + (c.x - b.x) * (point.y - c.y)) / denominator
  const v = ((c.y - a.y) * (point.x - c.x) + (a.x - c.x) * (point.y - c.y)) / denominator
  const w = 1 - u - v
  return u >= 0 && v >= 0 && w >= 0
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

async function imageTextureSource(image: PdfImageData): Promise<WebGpuTextureSource> {
  const canvas = createScratchCanvas(image.width, image.height)
  const context = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
  if (!context) throw new Error('Unable to create image texture surface')
  const rgba = new Uint8ClampedArray(new ArrayBuffer(image.data.byteLength))
  rgba.set(image.data)
  context.putImageData(new ImageData(rgba, image.width, image.height), 0, 0)
  if ('convertToBlob' in canvas && typeof canvas.convertToBlob === 'function' && typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(await canvas.convertToBlob())
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      destroy() {
        bitmap.close()
      },
    }
  }
  return { source: canvas, width: image.width, height: image.height }
}

function renderWebGpuPage(
  canvas: HTMLCanvasElement,
  page: WebGpuPage,
  bundle: WebGpuDeviceBundle,
  pipelines: Map<string, unknown>,
  options: WebGpuRendererOptions,
): void {
  const context = canvas.getContext('webgpu') as WebGpuCanvasContext | null
  if (!context) throw new Error('WebGPU canvas context is unavailable')
  context.configure({ device: bundle.device, format: bundle.format, alphaMode: 'premultiplied' })

  const textureCache = new Map<WebGpuTextureSource, WebGpuTextureBinding>()
  const vertexBuffers: WebGpuBuffer[] = []
  const encoder = bundle.device.createCommandEncoder()
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      clearValue: clearValue(options.background),
      loadOp: options.clear === false ? 'load' : 'clear',
      storeOp: 'store',
    }],
  })

  for (const command of page.commands) {
    if (!setScissor(pass, command.scissor, page, canvas)) continue
    if (command.kind === 'solid') {
      const pipeline = getSolidPipeline(bundle.device, bundle.format, pipelines)
      const buffer = createVertexBuffer(bundle.device, bundle.device.queue, command.vertices)
      vertexBuffers.push(buffer)
      pass.setPipeline(pipeline)
      pass.setVertexBuffer(0, buffer)
      pass.draw(command.vertices.length / 6)
    } else {
      const pipeline = getTexturePipeline(bundle.device, bundle.format, pipelines)
      const binding = getTextureBinding(bundle, command.texture, textureCache, pipelines)
      const buffer = createVertexBuffer(bundle.device, bundle.device.queue, command.vertices)
      vertexBuffers.push(buffer)
      pass.setPipeline(pipeline)
      pass.setBindGroup(0, binding.bindGroup)
      pass.setVertexBuffer(0, buffer)
      pass.draw(command.vertices.length / 8)
    }
  }
  pass.end()
  bundle.device.queue.submit([encoder.finish()])
  for (const binding of textureCache.values()) binding.texture.destroy?.()
  for (const buffer of vertexBuffers) buffer.destroy?.()
}

function clearValue(background: readonly [number, number, number, number] | undefined): unknown {
  const color = background ?? [1, 1, 1, 0]
  return { r: color[0], g: color[1], b: color[2], a: color[3] }
}

function setScissor(pass: WebGpuRenderPassEncoder, rect: PdfRectBounds | undefined, page: WebGpuPage, canvas: HTMLCanvasElement): boolean {
  if (!rect) {
    pass.setScissorRect?.(0, 0, canvas.width, canvas.height)
    return true
  }
  if (rect.maxX <= rect.minX || rect.maxY <= rect.minY) return false
  const bounds = transformRectBounds(rect, [canvas.width / page.width, 0, 0, canvas.height / page.height, 0, 0])
  const x = Math.max(0, Math.floor(bounds.minX))
  const y = Math.max(0, Math.floor(canvas.height - bounds.maxY))
  const width = Math.max(0, Math.min(canvas.width - x, Math.ceil(bounds.maxX - bounds.minX)))
  const height = Math.max(0, Math.min(canvas.height - y, Math.ceil(bounds.maxY - bounds.minY)))
  if (width <= 0 || height <= 0) return false
  pass.setScissorRect?.(x, y, width, height)
  return true
}

interface WebGpuTextureBinding {
  readonly texture: WebGpuTexture
  readonly bindGroup: unknown
}

function getTextureBinding(
  bundle: WebGpuDeviceBundle,
  source: WebGpuTextureSource,
  cache: Map<WebGpuTextureSource, WebGpuTextureBinding>,
  pipelines: Map<string, unknown>,
): WebGpuTextureBinding {
  const cached = cache.get(source)
  if (cached) return cached
  const texture = bundle.device.createTexture({
    size: [source.width, source.height],
    format: 'rgba8unorm',
    usage: webGpuTextureUsage('TEXTURE_BINDING') |
      webGpuTextureUsage('COPY_DST') |
      webGpuTextureUsage('RENDER_ATTACHMENT'),
  })
  bundle.device.queue.copyExternalImageToTexture({ source: source.source }, { texture }, [source.width, source.height])
  const pipeline = getTexturePipeline(bundle.device, bundle.format, pipelines)
  const bindGroup = bundle.device.createBindGroup({
    layout: (pipeline as { getBindGroupLayout(index: number): unknown }).getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: bundle.sampler },
      { binding: 1, resource: texture.createView() },
    ],
  })
  const binding = { texture, bindGroup }
  cache.set(source, binding)
  return binding
}

function createVertexBuffer(device: WebGpuDevice, queue: WebGpuQueue, vertices: Float32Array): WebGpuBuffer {
  const buffer = device.createBuffer({
    size: alignTo(vertices.byteLength, 4),
    usage: webGpuBufferUsage('VERTEX') | webGpuBufferUsage('COPY_DST'),
  })
  queue.writeBuffer(buffer, 0, vertices.buffer, vertices.byteOffset, vertices.byteLength)
  return buffer
}

function getSolidPipeline(device: WebGpuDevice, format: string, cache: Map<string, unknown>): unknown {
  const key = `solid:${format}`
  const cached = cache.get(key)
  if (cached) return cached
  const module = device.createShaderModule({
    code: `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}

@vertex
fn vertexMain(@location(0) position: vec2f, @location(1) color: vec4f) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4f(position, 0.0, 1.0);
  output.color = color;
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  return input.color;
}
    `,
  })
  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'vertexMain',
      buffers: [{
        arrayStride: 24,
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x2' },
          { shaderLocation: 1, offset: 8, format: 'float32x4' },
        ],
      }],
    },
    fragment: {
      module,
      entryPoint: 'fragmentMain',
      targets: [{ format, blend: alphaBlend() }],
    },
    primitive: { topology: 'triangle-list' },
  })
  cache.set(key, pipeline)
  return pipeline
}

function getTexturePipeline(device: WebGpuDevice, format: string, cache: Map<string, unknown>): unknown {
  const key = `texture:${format}`
  const cached = cache.get(key)
  if (cached) return cached
  const module = device.createShaderModule({
    code: `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
  @location(1) color: vec4f,
}

@vertex
fn vertexMain(@location(0) position: vec2f, @location(1) uv: vec2f, @location(2) color: vec4f) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4f(position, 0.0, 1.0);
  output.uv = uv;
  output.color = color;
  return output;
}

@group(0) @binding(0) var pageSampler: sampler;
@group(0) @binding(1) var pageTexture: texture_2d<f32>;

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  return textureSample(pageTexture, pageSampler, input.uv) * input.color;
}
    `,
  })
  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'vertexMain',
      buffers: [{
        arrayStride: 32,
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x2' },
          { shaderLocation: 1, offset: 8, format: 'float32x2' },
          { shaderLocation: 2, offset: 16, format: 'float32x4' },
        ],
      }],
    },
    fragment: {
      module,
      entryPoint: 'fragmentMain',
      targets: [{ format, blend: alphaBlend() }],
    },
    primitive: { topology: 'triangle-list' },
  })
  cache.set(key, pipeline)
  return pipeline
}

function alphaBlend(): unknown {
  return {
    color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
    alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
  }
}

async function createWebGpuDeviceBundle(): Promise<WebGpuDeviceBundle | null> {
  const gpu = (globalThis.navigator as { gpu?: WebGpuNavigator } | undefined)?.gpu
  if (!gpu) return null
  const adapter = await gpu.requestAdapter()
  if (!adapter) return null
  const device = await adapter.requestDevice()
  return {
    device,
    format: gpu.getPreferredCanvasFormat?.() ?? 'bgra8unorm',
    sampler: device.createSampler({ magFilter: 'linear', minFilter: 'linear' }),
  }
}

interface WebGpuDeviceBundle {
  readonly device: WebGpuDevice
  readonly format: string
  readonly sampler: unknown
}

type WebGpuNavigator = {
  requestAdapter(): Promise<WebGpuAdapter | null>
  getPreferredCanvasFormat?: () => string
}

type WebGpuAdapter = {
  requestDevice(): Promise<WebGpuDevice>
}

type WebGpuQueue = {
  copyExternalImageToTexture(source: unknown, destination: unknown, size: readonly number[]): void
  submit(commandBuffers: readonly unknown[]): void
  writeBuffer(buffer: unknown, bufferOffset: number, data: ArrayBufferLike, dataOffset?: number, size?: number): void
}

type WebGpuDevice = {
  queue: WebGpuQueue
  createSampler(descriptor?: unknown): unknown
  createShaderModule(descriptor: unknown): unknown
  createRenderPipeline(descriptor: unknown): unknown
  createBindGroup(descriptor: unknown): unknown
  createTexture(descriptor: unknown): WebGpuTexture
  createBuffer(descriptor: unknown): WebGpuBuffer
  createCommandEncoder(): WebGpuCommandEncoder
}

type WebGpuBuffer = {
  destroy?(): void
}

type WebGpuTexture = {
  createView(): unknown
  destroy?(): void
}

type WebGpuCommandEncoder = {
  beginRenderPass(descriptor: unknown): WebGpuRenderPassEncoder
  finish(): unknown
}

type WebGpuRenderPassEncoder = {
  setPipeline(pipeline: unknown): void
  setBindGroup(index: number, bindGroup: unknown): void
  setVertexBuffer(slot: number, buffer: unknown): void
  setScissorRect?(x: number, y: number, width: number, height: number): void
  draw(vertexCount: number): void
  end(): void
}

type WebGpuCanvasContext = {
  configure(descriptor: unknown): void
  getCurrentTexture(): WebGpuTexture
}

function webGpuTextureUsage(name: 'TEXTURE_BINDING' | 'COPY_DST' | 'RENDER_ATTACHMENT'): number {
  const usage = (globalThis as { GPUTextureUsage?: Record<string, number> }).GPUTextureUsage
  const fallback = {
    TEXTURE_BINDING: 0x04,
    COPY_DST: 0x08,
    RENDER_ATTACHMENT: 0x10,
  }
  return usage?.[name] ?? fallback[name]
}

function webGpuBufferUsage(name: 'VERTEX' | 'COPY_DST'): number {
  const usage = (globalThis as { GPUBufferUsage?: Record<string, number> }).GPUBufferUsage
  const fallback = {
    VERTEX: 0x20,
    COPY_DST: 0x08,
  }
  return usage?.[name] ?? fallback[name]
}

function alignTo(value: number, alignment: number): number {
  return Math.ceil(value / alignment) * alignment
}

function createScratchCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function collectFontSources(displayList: PdfPageDisplayList, registeredIds: Set<string>): PdfFontSource[] {
  const fonts: PdfFontSource[] = []
  for (const op of displayList.ops) {
    if (op.type !== 'text' || !op.run.fontSource || registeredIds.has(op.run.fontSource.id) || fonts.some(font => font.id === op.run.fontSource?.id)) continue
    fonts.push(op.run.fontSource)
  }
  return fonts
}

async function registerBrowserFonts(fonts: readonly PdfFontSource[]): Promise<void> {
  const FontFaceCtor = globalThis.FontFace
  const fontSet = globalThis.document?.fonts
  if (typeof FontFaceCtor !== 'function' || !fontSet || typeof fontSet.add !== 'function') return
  await Promise.all(fonts.map(async font => {
    try {
      const face = new FontFaceCtor(font.family, font.data.slice().buffer, {
        ...(font.weight ? { weight: font.weight } : {}),
        ...(font.style ? { style: font.style } : {}),
      })
      await face.load()
      fontSet.add(face)
    } catch {
      // The glyph atlas still uses the CSS fallback stack if a font program is rejected.
    }
  }))
}
