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
  type PdfClipPath,
  type PdfDrawingPipeline,
  type PdfDrawingState,
  type PdfRectBounds,
} from './display-list-pipeline'

export interface WebGpuRendererOptions {
  readonly clear?: boolean
  readonly background?: readonly [number, number, number, number]
  readonly fallbackOnUnsupported?: boolean
  /** Rasterize glyph atlas at a higher scale before sampling it on the GPU. */
  readonly textOversample?: number
  readonly glyphAtlasSize?: number
  readonly pageCacheSize?: number
}

export interface WebGpuRenderResult extends PdfPageRenderResult {
  readonly ops: number
  readonly drawCalls: number
  readonly glyphs: number
  readonly paths: number
  readonly images: number
  readonly unsupportedOps: number
  readonly unsupportedReasons: readonly string[]
  readonly cacheHit: boolean
  readonly timings: WebGpuRenderTimings
}

export interface WebGpuRenderTimings {
  readonly totalMs: number
  readonly deviceMs: number
  readonly pendingMs: number
  readonly displayListMs: number
  readonly fontMs: number
  readonly buildMs: number
  readonly replayMs: number
  readonly finishMs: number
  readonly renderMs: number
}

export interface WebGpuPrewarmResult {
  readonly pageIndex: number
  readonly cacheHit: boolean
  readonly prepared: boolean
  readonly timings: Omit<WebGpuRenderTimings, 'renderMs'>
}

interface WebGpuPageBuildResult {
  readonly page: WebGpuPage
  readonly cacheHit: boolean
  readonly cachedForReuse: boolean
  readonly timings: Omit<WebGpuRenderTimings, 'renderMs'>
}

export class WebGpuUnsupportedError extends Error {
  constructor(
    message: string,
    readonly unsupportedOps: number,
    readonly unsupportedReasons: readonly string[],
  ) {
    super(message)
    this.name = 'WebGpuUnsupportedError'
  }
}

export class WebGpuRenderer implements PdfRenderer<HTMLCanvasElement, WebGpuRenderResult> {
  readonly id = 'webgpu'
  readonly platform = 'webgpu'
  private devicePromise: Promise<WebGpuDeviceBundle | null> | null = null
  private readonly pipelines = new Map<string, unknown>()
  private readonly registeredFontIds = new Set<string>()
  private readonly glyphAtlas: GlyphAtlas
  private readonly pageCache = new Map<string, WebGpuPage>()
  private readonly pendingPageBuilds = new Map<string, Promise<WebGpuPageBuildResult>>()
  private readonly textureCache = new Map<WebGpuTextureSource, WebGpuTextureBinding>()
  private readonly documentIds = new WeakMap<object, number>()
  private nextDocumentId = 1

  constructor(private readonly options: WebGpuRendererOptions = {}) {
    this.glyphAtlas = new GlyphAtlas(options.glyphAtlasSize ?? 2048)
  }

  async renderPage(
    context: PdfRenderContext,
    target: HTMLCanvasElement,
    options: PdfRenderPageOptions,
  ): Promise<WebGpuRenderResult> {
    const totalStarted = now()
    let deviceMs = 0
    let displayListMs = 0
    const scale = options.scale ?? 1
    const deviceStarted = now()
    const bundle = await this.getDeviceBundle()
    deviceMs = now() - deviceStarted
    if (!bundle) throw new Error('WebGPU is unavailable')
    const build = await this.getOrBuildPage(context.document, options.pageIndex, scale, {
      ...this.emptyBuildTimings(totalStarted),
      deviceMs,
      displayListMs,
    })
    const { page, cacheHit, cachedForReuse } = build
    const width = Math.ceil(page.width * scale)
    const height = Math.ceil(page.height * scale)
    if (target.width !== width) target.width = width
    if (target.height !== height) target.height = height
    const renderStarted = now()
    renderWebGpuPage(target, page, bundle, this.pipelines, this.textureCache, this.options)
    const renderMs = now() - renderStarted
    const result = {
      pageIndex: options.pageIndex,
      width,
      height,
      ops: page.ops,
      drawCalls: page.commands.length,
      glyphs: page.glyphs,
      paths: page.paths,
      images: page.images,
      unsupportedOps: page.unsupportedOps,
      unsupportedReasons: page.unsupportedReasons,
      cacheHit,
      timings: {
        totalMs: now() - totalStarted,
        deviceMs: build.timings.deviceMs,
        pendingMs: build.timings.pendingMs,
        displayListMs: build.timings.displayListMs,
        fontMs: build.timings.fontMs,
        buildMs: build.timings.buildMs,
        replayMs: build.timings.replayMs,
        finishMs: build.timings.finishMs,
        renderMs,
      },
    }
    if (!cacheHit && !cachedForReuse) page.destroy()
    return result
  }

  async prewarmPage(
    context: PdfRenderContext,
    options: PdfRenderPageOptions,
  ): Promise<WebGpuPrewarmResult> {
    const totalStarted = now()
    let deviceMs = 0
    const scale = options.scale ?? 1
    const deviceStarted = now()
    const bundle = await this.getDeviceBundle()
    deviceMs = now() - deviceStarted
    if (!bundle) return {
      pageIndex: options.pageIndex,
      cacheHit: false,
      prepared: false,
      timings: {
        totalMs: now() - totalStarted,
        deviceMs,
        pendingMs: 0,
        displayListMs: 0,
        fontMs: 0,
        buildMs: 0,
        replayMs: 0,
        finishMs: 0,
      },
    }
    const build = await this.getOrBuildPage(context.document, options.pageIndex, scale, {
      ...this.emptyBuildTimings(totalStarted),
      deviceMs,
    })
    prepareWebGpuPageResources(build.page, bundle, this.pipelines, this.textureCache)
    if (!build.cacheHit && !build.cachedForReuse) build.page.destroy()
    return {
      pageIndex: options.pageIndex,
      cacheHit: build.cacheHit,
      prepared: true,
      timings: {
        ...build.timings,
        totalMs: now() - totalStarted,
      },
    }
  }

  destroy(): void {
    for (const page of this.pageCache.values()) page.destroy()
    this.pageCache.clear()
    for (const binding of this.textureCache.values()) binding.texture.destroy?.()
    this.textureCache.clear()
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

  private async getOrBuildPage(
    document: PdfRenderContext['document'],
    pageIndex: number,
    scale: number,
    timings: Omit<WebGpuRenderTimings, 'renderMs'>,
  ): Promise<WebGpuPageBuildResult> {
    const cacheKey = this.pageCacheKey(document, pageIndex, scale)
    const cached = this.getCachedPage(cacheKey)
    if (cached) return {
      page: cached,
      cacheHit: true,
      cachedForReuse: true,
      timings,
    }

    const pending = this.pendingPageBuilds.get(cacheKey)
    if (pending) {
      const pendingStarted = now()
      const result = await pending
      const pendingMs = now() - pendingStarted
      return {
        ...result,
        cacheHit: true,
        cachedForReuse: true,
        timings: {
          ...result.timings,
          ...timings,
          pendingMs,
        },
      }
    }

    const build = this.buildPage(document, pageIndex, scale, timings, cacheKey)
    this.pendingPageBuilds.set(cacheKey, build)
    try {
      return await build
    } finally {
      if (this.pendingPageBuilds.get(cacheKey) === build) this.pendingPageBuilds.delete(cacheKey)
    }
  }

  private async buildPage(
    document: PdfRenderContext['document'],
    pageIndex: number,
    scale: number,
    timings: Omit<WebGpuRenderTimings, 'renderMs'>,
    cacheKey: string,
  ): Promise<WebGpuPageBuildResult> {
    const displayListStarted = now()
    const displayList = await document.getPageDisplayList(pageIndex)
    const displayListMs = now() - displayListStarted
    const fontStarted = now()
    await this.registerDisplayListFonts(displayList)
    const fontMs = now() - fontStarted
    const builder = new WebGpuDisplayListBuilder(
      displayList,
      scale,
      normalizeTextOversample(this.options.textOversample),
      this.glyphAtlas,
    )
    const replayStarted = now()
    await replayPdfDisplayList(displayList, builder, { ignoreInvisibleText: true })
    const replayMs = now() - replayStarted
    const finishStarted = now()
    const page = await builder.finish()
    const finishMs = now() - finishStarted
    if (page.unsupportedOps > 0 && (this.options.fallbackOnUnsupported ?? true)) {
      const unsupportedOps = page.unsupportedOps
      const unsupportedReasons = page.unsupportedReasons
      page.destroy()
      throw new WebGpuUnsupportedError(
        `WebGPU PDF renderer does not support ${unsupportedOps} drawing op(s) on this page: ${unsupportedReasons.join(', ')}`,
        unsupportedOps,
        unsupportedReasons,
      )
    }
    const cachedForReuse = page.unsupportedOps === 0 && this.setCachedPage(cacheKey, page)
    return {
      page,
      cacheHit: false,
      cachedForReuse,
      timings: {
        ...timings,
        displayListMs,
        fontMs,
        buildMs: replayMs + finishMs,
        replayMs,
        finishMs,
      },
    }
  }

  private emptyBuildTimings(totalStarted: number): Omit<WebGpuRenderTimings, 'renderMs'> {
    return {
      totalMs: now() - totalStarted,
      deviceMs: 0,
      pendingMs: 0,
      displayListMs: 0,
      fontMs: 0,
      buildMs: 0,
      replayMs: 0,
      finishMs: 0,
    }
  }

  private pageCacheKey(document: PdfRenderContext['document'], pageIndex: number, scale: number): string {
    const documentId = this.documentId(document)
    const oversample = normalizeTextOversample(this.options.textOversample)
    return [
      documentId,
      pageIndex,
      scale.toFixed(4),
      oversample,
    ].join(':')
  }

  private documentId(document: PdfRenderContext['document']): number {
    const object = document as object
    const cached = this.documentIds.get(object)
    if (cached) return cached
    const id = this.nextDocumentId++
    this.documentIds.set(object, id)
    return id
  }

  private getCachedPage(key: string): WebGpuPage | undefined {
    const page = this.pageCache.get(key)
    if (!page) return undefined
    this.pageCache.delete(key)
    this.pageCache.set(key, page)
    return page
  }

  private setCachedPage(key: string, page: WebGpuPage): boolean {
    const maxSize = Math.max(0, Math.trunc(this.options.pageCacheSize ?? 24))
    if (maxSize <= 0) return false
    if (this.pageCache.has(key)) return true
    this.pageCache.set(key, page)
    while (this.pageCache.size > maxSize) {
      const oldestKey = this.pageCache.keys().next().value as string | undefined
      if (!oldestKey) break
      const oldest = this.pageCache.get(oldestKey)
      this.pageCache.delete(oldestKey)
      oldest?.destroy()
    }
    return true
  }
}

export const createWebGpuRenderer = (options?: WebGpuRendererOptions): WebGpuRenderer =>
  new WebGpuRenderer(options)

interface WebGpuPage {
  readonly pageIndex: number
  readonly width: number
  readonly height: number
  readonly ops: number
  readonly commands: WebGpuDrawCommand[]
  readonly glyphs: number
  readonly paths: number
  readonly images: number
  readonly unsupportedOps: number
  readonly unsupportedReasons: readonly string[]
  readonly atlas?: GlyphAtlasSnapshot
  prepared?: PreparedWebGpuPage
  destroy(): void
}

type WebGpuDrawCommand =
  | { readonly kind: 'solid'; readonly vertices: Float32Array; readonly scissor?: PdfRectBounds; readonly clip?: WebGpuClipRegion }
  | { readonly kind: 'texture'; readonly vertices: Float32Array; readonly texture: WebGpuTextureSource; readonly scissor?: PdfRectBounds; readonly clip?: WebGpuClipRegion }

type MutableWebGpuDrawCommand =
  | { readonly kind: 'solid'; readonly vertices: number[]; readonly scissor?: PdfRectBounds; readonly clip?: WebGpuClipRegion }
  | { readonly kind: 'texture'; readonly vertices: number[]; readonly texture: WebGpuTextureSource; readonly scissor?: PdfRectBounds; readonly clip?: WebGpuClipRegion }

interface WebGpuClipRegion {
  readonly key: string
  readonly paths: readonly WebGpuClipPath[]
}

interface WebGpuClipPath {
  readonly id: number
  readonly vertices: Float32Array
  prepared?: PreparedWebGpuClipPath
}

interface PreparedWebGpuClipPath {
  readonly device: WebGpuDevice
  readonly buffer: WebGpuBuffer
  readonly vertexCount: number
  destroy(): void
}

interface PreparedWebGpuCommand {
  readonly command: WebGpuDrawCommand
  readonly vertices: WebGpuVertexSlice
}

interface PreparedWebGpuPage {
  readonly device: WebGpuDevice
  readonly commands: PreparedWebGpuCommand[]
  readonly buffers: readonly WebGpuBuffer[]
  destroy(): void
}

interface WebGpuVertexSlice {
  readonly buffer: WebGpuBuffer
  readonly byteOffset: number
  readonly byteLength: number
  readonly vertexCount: number
}

interface WebGpuTextureSource {
  readonly source: unknown
  readonly width: number
  readonly height: number
  readonly copyWidth?: number
  readonly copyHeight?: number
  readonly version?: number
  readonly cacheScope?: 'render' | 'page' | 'renderer'
  binding?: WebGpuTextureBinding
  destroy?(): void
}

class WebGpuDisplayListBuilder implements PdfDrawingPipeline {
  private readonly commands: MutableWebGpuDrawCommand[] = []
  private unsupportedOps = 0
  private glyphs = 0
  private paths = 0
  private images = 0
  private readonly unsupportedReasons = new Map<string, number>()
  private readonly clipRegions = new Map<string, WebGpuClipRegion>()

  constructor(
    private readonly displayList: PdfPageDisplayList,
    private readonly scale: number,
    private readonly textOversample: number,
    private readonly atlas: GlyphAtlas,
  ) {}

  path(op: Extract<PdfDisplayOp, { type: 'path' }>, state: PdfDrawingState): void {
    if (state.blendMode !== 'normal') {
      this.addUnsupported(`path blendMode:${state.blendMode}`)
      return
    }
    if (op.fill || op.stroke) {
      this.addUnsupported(`path pattern:${op.fill ? 'fill' : ''}${op.stroke ? 'stroke' : ''}`)
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
    this.pushCommand({
      kind: 'solid',
      vertices,
      ...(state.clipRect ? { scissor: state.clipRect } : {}),
      ...this.commandClip(state),
    })
  }

  async image(op: Extract<PdfDisplayOp, { type: 'image' }>, state: PdfDrawingState): Promise<void> {
    if (state.blendMode !== 'normal') {
      this.addUnsupported(`image blendMode:${state.blendMode}`)
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
    this.pushCommand({
      kind: 'texture',
      vertices,
      texture,
      ...(state.clipRect ? { scissor: state.clipRect } : {}),
      ...this.commandClip(state),
    })
  }

  text(op: Extract<PdfDisplayOp, { type: 'text' }>, state: PdfDrawingState): void {
    if (state.blendMode !== 'normal' || !paintsVisibleText(op.run)) return
    if (paintsTextStroke(op.run.renderingMode)) {
      this.addUnsupported(`text stroke:${op.run.renderingMode ?? 'unknown'}`)
      return
    }
    if (!paintsTextFill(op.run.renderingMode)) return

    const vertices = this.textVertices(op.run, state)
    if (!vertices.length) return
    this.pushCommand({
      kind: 'texture',
      vertices,
      texture: this.atlas,
      ...(state.clipRect ? { scissor: state.clipRect } : {}),
      ...this.commandClip(state),
    })
  }

  shading(): void {
    this.addUnsupported('shading')
  }

  unsupported(op: PdfDisplayOp, state: PdfDrawingState, reason: string): void {
    this.addUnsupported(`${op.type}: ${reason}`)
  }

  async finish(): Promise<WebGpuPage> {
    await this.atlas.flush()
    const atlas = this.atlas.snapshot()
    const commands = this.commands.map(command => ({
      ...command,
      vertices: new Float32Array(command.vertices),
    })) as WebGpuDrawCommand[]
    const page: WebGpuPage = {
      pageIndex: this.displayList.pageIndex,
      width: this.displayList.width,
      height: this.displayList.height,
      ops: this.displayList.ops.length,
      commands,
      glyphs: this.glyphs,
      paths: this.paths,
      images: this.images,
      unsupportedOps: this.unsupportedOps,
      unsupportedReasons: this.getUnsupportedReasons(),
      atlas,
      destroy() {
        page.prepared?.destroy()
        destroyPreparedClipPaths(commands)
        atlas?.destroy?.()
        for (const command of commands) {
          if (command.kind === 'texture' && command.texture !== atlas) destroyTextureSource(command.texture)
        }
      },
    }
    return page
  }

  private textVertices(run: PdfTextRun, state: PdfDrawingState): number[] {
    const color = run.fillColor ?? state.fillColor
    const glyphScale = this.scale * this.textOversample
    const chars = Array.from(run.text)
    const glyphs = new Array<GlyphMetrics>(chars.length)
    let measured = 0
    for (let index = 0; index < chars.length; index++) {
      const glyph = this.atlas.getGlyph(run, chars[index], glyphScale)
      glyphs[index] = glyph
      measured += glyph.advance / glyphScale
    }
    const textScale = textWidthScale(run, measured)
    const vertices: number[] = []
    let cursor = 0
    for (const glyph of glyphs) {
      const advance = glyph.advance / glyphScale
      if (glyph.visible) {
        const left = run.x + cursor + glyph.left / glyphScale * textScale
        const right = run.x + cursor + glyph.right / glyphScale * textScale
        const bottom = run.y - glyph.descent / glyphScale
        const top = run.y + glyph.ascent / glyphScale
        pushTextGlyphQuad(vertices, left, bottom, right, top, state.transform, glyph.uv, color, state.fillAlpha, this.displayList)
        this.glyphs++
      }
      cursor += advance * textScale
    }
    return vertices
  }

  private pushCommand(command: MutableWebGpuDrawCommand): void {
    const previous = this.commands.at(-1)
    if (previous && canBatchCommands(previous, command)) {
      appendVertices(previous.vertices, command.vertices)
      return
    }
    this.commands.push(command)
  }

  private commandClip(state: PdfDrawingState): { readonly clip: WebGpuClipRegion } | Record<string, never> {
    const clipPaths = state.clipPaths?.filter(clip => !clip.rect) ?? []
    if (!clipPaths.length) return {}
    if (clipPaths.length > 255) {
      this.addUnsupported('clip: more than 255 nested non-rectangular clips')
      return {}
    }
    return { clip: this.getClipRegion(clipPaths) }
  }

  private getClipRegion(clipPaths: readonly PdfClipPath[]): WebGpuClipRegion {
    const key = clipPaths.map(clip => clip.id).join(':')
    const cached = this.clipRegions.get(key)
    if (cached) return cached
    const region = {
      key,
      paths: clipPaths.map(clip => ({
        id: clip.id,
        vertices: clipPathVertices(clip, this.displayList),
      })),
    }
    this.clipRegions.set(key, region)
    return region
  }

  private addUnsupported(reason: string): void {
    this.unsupportedOps++
    this.unsupportedReasons.set(reason, (this.unsupportedReasons.get(reason) ?? 0) + 1)
  }

  private getUnsupportedReasons(): string[] {
    return Array.from(this.unsupportedReasons.entries())
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([reason, count]) => count > 1 ? `${reason} x${count}` : reason)
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
  private usedWidth = 1
  private usedHeight = 1
  private flushed = false
  private versionCounter = 0

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
    const u0 = this.x / this.width
    const v0 = this.y / this.height
    const u1 = (this.x + width) / this.width
    const v1 = (this.y + height) / this.height
    const uv = [
      [u0, v1],
      [u1, v1],
      [u1, v0],
      [u0, v0],
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
    this.usedWidth = Math.max(this.usedWidth, this.x + width)
    this.usedHeight = Math.max(this.usedHeight, this.y + height)
    this.x += width + 1
    this.rowHeight = Math.max(this.rowHeight, height)
    this.flushed = false
    this.versionCounter++
    return glyph
  }

  async flush(): Promise<void> {
    this.flushed = true
  }

  snapshot(): GlyphAtlasSnapshot {
    return this
  }

  get copyWidth(): number {
    return Math.min(this.width, Math.max(1, Math.ceil(this.usedWidth)))
  }

  get copyHeight(): number {
    return Math.min(this.height, Math.max(1, Math.ceil(this.usedHeight)))
  }

  get version(): number {
    return this.versionCounter
  }

  get cacheScope(): 'renderer' {
    return 'renderer'
  }
}

function textWidthScale(run: PdfTextRun, measured: number): number {
  if (run.width === undefined || run.width <= 0 || !run.text) return 1
  if (!Number.isFinite(measured) || measured <= 0) return 1
  const widthScale = run.width / measured
  return Number.isFinite(widthScale) && Math.abs(widthScale - 1) > 1e-3 ? widthScale : 1
}

function canBatchCommands(left: MutableWebGpuDrawCommand, right: MutableWebGpuDrawCommand): boolean {
  if (left.kind !== right.kind || !sameScissor(left.scissor, right.scissor) || !sameClipRegion(left.clip, right.clip)) return false
  if (left.kind === 'texture' && right.kind === 'texture') return left.texture === right.texture
  return left.kind === 'solid' && right.kind === 'solid'
}

function sameClipRegion(left?: WebGpuClipRegion, right?: WebGpuClipRegion): boolean {
  return left === right || left?.key === right?.key
}

function sameScissor(left?: PdfRectBounds, right?: PdfRectBounds): boolean {
  if (!left || !right) return left === right
  return left.minX === right.minX &&
    left.minY === right.minY &&
    left.maxX === right.maxX &&
    left.maxY === right.maxY
}

function appendVertices(target: number[], source: readonly number[]): void {
  for (let index = 0; index < source.length; index++) target.push(source[index])
}

function tessellatePathFill(segments: readonly PdfPathSegment[], matrix: PdfMatrix): Point[][] {
  return flattenPath(segments, matrix)
    .flatMap(path => triangulateSimplePolygon(path.points))
}

function clipPathVertices(clip: PdfClipPath, displayList: PdfPageDisplayList): Float32Array {
  const vertices: number[] = []
  for (const triangle of tessellatePathFill(clip.segments, clip.transform)) {
    for (const point of triangle) {
      const [x, y] = clipPosition(point, displayList)
      vertices.push(x, y)
    }
  }
  return new Float32Array(vertices)
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
): number[] {
  const vertices: number[] = []
  pushTexturedQuad(vertices, points, uv, color, alpha, displayList)
  return vertices
}

function pushTexturedQuad(
  vertices: number[],
  points: readonly Point[],
  uv: QuadUv,
  color: readonly [number, number, number],
  alpha: number,
  displayList: PdfPageDisplayList,
): void {
  pushTexturedVertex(vertices, points[0].x, points[0].y, uv[0][0], uv[0][1], color, alpha, displayList)
  pushTexturedVertex(vertices, points[1].x, points[1].y, uv[1][0], uv[1][1], color, alpha, displayList)
  pushTexturedVertex(vertices, points[2].x, points[2].y, uv[2][0], uv[2][1], color, alpha, displayList)
  pushTexturedVertex(vertices, points[0].x, points[0].y, uv[0][0], uv[0][1], color, alpha, displayList)
  pushTexturedVertex(vertices, points[2].x, points[2].y, uv[2][0], uv[2][1], color, alpha, displayList)
  pushTexturedVertex(vertices, points[3].x, points[3].y, uv[3][0], uv[3][1], color, alpha, displayList)
}

function pushTextGlyphQuad(
  vertices: number[],
  left: number,
  bottom: number,
  right: number,
  top: number,
  matrix: PdfMatrix,
  uv: QuadUv,
  color: readonly [number, number, number],
  alpha: number,
  displayList: PdfPageDisplayList,
): void {
  const x0 = matrix[0] * left + matrix[2] * bottom + matrix[4]
  const y0 = matrix[1] * left + matrix[3] * bottom + matrix[5]
  const x1 = matrix[0] * right + matrix[2] * bottom + matrix[4]
  const y1 = matrix[1] * right + matrix[3] * bottom + matrix[5]
  const x2 = matrix[0] * right + matrix[2] * top + matrix[4]
  const y2 = matrix[1] * right + matrix[3] * top + matrix[5]
  const x3 = matrix[0] * left + matrix[2] * top + matrix[4]
  const y3 = matrix[1] * left + matrix[3] * top + matrix[5]
  pushTexturedVertex(vertices, x0, y0, uv[0][0], uv[0][1], color, alpha, displayList)
  pushTexturedVertex(vertices, x1, y1, uv[1][0], uv[1][1], color, alpha, displayList)
  pushTexturedVertex(vertices, x2, y2, uv[2][0], uv[2][1], color, alpha, displayList)
  pushTexturedVertex(vertices, x0, y0, uv[0][0], uv[0][1], color, alpha, displayList)
  pushTexturedVertex(vertices, x2, y2, uv[2][0], uv[2][1], color, alpha, displayList)
  pushTexturedVertex(vertices, x3, y3, uv[3][0], uv[3][1], color, alpha, displayList)
}

function pushTexturedVertex(
  vertices: number[],
  x: number,
  y: number,
  u: number,
  v: number,
  color: readonly [number, number, number],
  alpha: number,
  displayList: PdfPageDisplayList,
): void {
  vertices.push(
    x / displayList.width * 2 - 1,
    y / displayList.height * 2 - 1,
    u,
    v,
    clamp01(color[0]),
    clamp01(color[1]),
    clamp01(color[2]),
    clamp01(alpha),
  )
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
  return {
    source: new ImageData(imageDataArray(image.data), image.width, image.height),
    width: image.width,
    height: image.height,
    cacheScope: 'page',
  }
}

function imageDataArray(data: Uint8ClampedArray): ImageDataArray {
  return data.buffer instanceof ArrayBuffer
    ? data as ImageDataArray
    : new Uint8ClampedArray(data) as ImageDataArray
}

function renderWebGpuPage(
  canvas: HTMLCanvasElement,
  page: WebGpuPage,
  bundle: WebGpuDeviceBundle,
  pipelines: Map<string, unknown>,
  rendererTextureCache: Map<WebGpuTextureSource, WebGpuTextureBinding>,
  options: WebGpuRendererOptions,
): void {
  const context = canvas.getContext('webgpu') as WebGpuCanvasContext | null
  if (!context) throw new Error('WebGPU canvas context is unavailable')
  context.configure({ device: bundle.device, format: bundle.format, alphaMode: 'premultiplied' })

  const renderTextureCache = new Map<WebGpuTextureSource, WebGpuTextureBinding>()
  const prepared = getPreparedWebGpuPage(page, bundle.device, bundle.device.queue)
  const encoder = bundle.device.createCommandEncoder()
  const targetView = context.getCurrentTexture().createView()
  const stencilTexture = page.commands.some(command => command.clip)
    ? bundle.device.createTexture({
      size: [canvas.width, canvas.height],
      format: webGpuStencilFormat,
      usage: webGpuTextureUsage('RENDER_ATTACHMENT'),
    })
    : null
  let cleared = false
  let pass: WebGpuRenderPassEncoder | null = null
  const beginPass = (stencil: boolean): WebGpuRenderPassEncoder => {
    const current = encoder.beginRenderPass({
      colorAttachments: [{
        view: targetView,
        clearValue: clearValue(options.background),
        loadOp: cleared || options.clear === false ? 'load' : 'clear',
        storeOp: 'store',
      }],
      ...(stencil && stencilTexture ? {
        depthStencilAttachment: {
          view: stencilTexture.createView(),
          depthClearValue: 1,
          depthLoadOp: 'clear',
          depthStoreOp: 'discard',
          stencilClearValue: 0,
          stencilLoadOp: 'clear',
          stencilStoreOp: 'discard',
        },
      } : {}),
    })
    cleared = true
    return current
  }

  if (!prepared.commands.length) {
    pass = beginPass(false)
    pass.end()
    pass = null
  }

  for (const preparedCommand of prepared.commands) {
    const command = preparedCommand.command
    if (command.clip) {
      pass?.end()
      pass = null
      const clippedPass = beginPass(true)
      if (setScissor(clippedPass, command.scissor, page, canvas)) {
        renderClipRegion(clippedPass, command.clip, bundle, pipelines)
        drawWebGpuCommand(clippedPass, preparedCommand, page, canvas, bundle, pipelines, rendererTextureCache, renderTextureCache, true)
      }
      clippedPass.end()
      continue
    }

    pass ??= beginPass(false)
    drawWebGpuCommand(pass, preparedCommand, page, canvas, bundle, pipelines, rendererTextureCache, renderTextureCache, false)
  }

  pass?.end()
  bundle.device.queue.submit([encoder.finish()])
  stencilTexture?.destroy?.()
  for (const binding of renderTextureCache.values()) binding.texture.destroy?.()
}

function prepareWebGpuPageResources(
  page: WebGpuPage,
  bundle: WebGpuDeviceBundle,
  pipelines: Map<string, unknown>,
  rendererTextureCache: Map<WebGpuTextureSource, WebGpuTextureBinding>,
): void {
  getPreparedWebGpuPage(page, bundle.device, bundle.device.queue)
  for (const command of page.commands) {
    if (command.kind === 'texture' && command.texture.cacheScope !== 'render') {
      getTextureBinding(bundle, command.texture, rendererTextureCache, new Map(), pipelines)
    }
    for (const path of command.clip?.paths ?? []) {
      if (path.vertices.length) getPreparedClipPath(path, bundle.device, bundle.device.queue)
    }
  }
}

function drawWebGpuCommand(
  pass: WebGpuRenderPassEncoder,
  prepared: PreparedWebGpuCommand,
  page: WebGpuPage,
  canvas: HTMLCanvasElement,
  bundle: WebGpuDeviceBundle,
  pipelines: Map<string, unknown>,
  rendererTextureCache: Map<WebGpuTextureSource, WebGpuTextureBinding>,
  renderTextureCache: Map<WebGpuTextureSource, WebGpuTextureBinding>,
  stencil: boolean,
): void {
  const command = prepared.command
  if (!setScissor(pass, command.scissor, page, canvas)) return
  if (stencil && command.clip) pass.setStencilReference?.(command.clip.paths.length)
  if (command.kind === 'solid') {
    const pipeline = getSolidPipeline(bundle.device, bundle.format, pipelines, stencil)
    pass.setPipeline(pipeline)
    pass.setVertexBuffer(0, prepared.vertices.buffer, prepared.vertices.byteOffset, prepared.vertices.byteLength)
    pass.draw(prepared.vertices.vertexCount)
  } else {
    const pipeline = getTexturePipeline(bundle.device, bundle.format, pipelines, stencil)
    const binding = getTextureBinding(bundle, command.texture, rendererTextureCache, renderTextureCache, pipelines)
    pass.setPipeline(pipeline)
    pass.setBindGroup(0, binding.bindGroup)
    pass.setVertexBuffer(0, prepared.vertices.buffer, prepared.vertices.byteOffset, prepared.vertices.byteLength)
    pass.draw(prepared.vertices.vertexCount)
  }
}

function getPreparedWebGpuPage(
  page: WebGpuPage,
  device: WebGpuDevice,
  queue: WebGpuQueue,
): PreparedWebGpuPage {
  if (page.prepared?.device === device) return page.prepared
  page.prepared?.destroy()
  page.prepared = prepareWebGpuPage(page, device, queue)
  return page.prepared
}

function prepareWebGpuPage(
  page: WebGpuPage,
  device: WebGpuDevice,
  queue: WebGpuQueue,
): PreparedWebGpuPage {
  let solidFloats = 0
  let textureFloats = 0
  for (const command of page.commands) {
    if (command.kind === 'solid') solidFloats += command.vertices.length
    else textureFloats += command.vertices.length
  }

  const solidBuffer = solidFloats ? new Float32Array(solidFloats) : null
  const textureBuffer = textureFloats ? new Float32Array(textureFloats) : null
  let solidOffset = 0
  let textureOffset = 0
  const prepared: PreparedWebGpuCommand[] = []

  for (const command of page.commands) {
    if (command.kind === 'solid') {
      if (!solidBuffer) continue
      solidBuffer.set(command.vertices, solidOffset)
      prepared.push({
        command,
        vertices: {
          buffer: null as unknown as WebGpuBuffer,
          byteOffset: solidOffset * Float32Array.BYTES_PER_ELEMENT,
          byteLength: command.vertices.byteLength,
          vertexCount: command.vertices.length / 6,
        },
      })
      solidOffset += command.vertices.length
    } else {
      if (!textureBuffer) continue
      textureBuffer.set(command.vertices, textureOffset)
      prepared.push({
        command,
        vertices: {
          buffer: null as unknown as WebGpuBuffer,
          byteOffset: textureOffset * Float32Array.BYTES_PER_ELEMENT,
          byteLength: command.vertices.byteLength,
          vertexCount: command.vertices.length / 8,
        },
      })
      textureOffset += command.vertices.length
    }
  }

  const buffers: WebGpuBuffer[] = []
  const solidGpuBuffer = solidBuffer ? createVertexBuffer(device, queue, solidBuffer) : null
  const textureGpuBuffer = textureBuffer ? createVertexBuffer(device, queue, textureBuffer) : null
  if (solidGpuBuffer) buffers.push(solidGpuBuffer)
  if (textureGpuBuffer) buffers.push(textureGpuBuffer)

  const preparedPage = {
    device,
    commands: prepared.map(item => ({
      ...item,
      vertices: {
        ...item.vertices,
        buffer: item.command.kind === 'solid' ? solidGpuBuffer as WebGpuBuffer : textureGpuBuffer as WebGpuBuffer,
      },
    })),
    buffers,
    destroy() {
      for (const buffer of buffers) buffer.destroy?.()
    },
  }
  return preparedPage
}

function renderClipRegion(
  pass: WebGpuRenderPassEncoder,
  clip: WebGpuClipRegion,
  bundle: WebGpuDeviceBundle,
  pipelines: Map<string, unknown>,
): void {
  const pipeline = getClipMaskPipeline(bundle.device, bundle.format, pipelines)
  pass.setPipeline(pipeline)
  for (let index = 0; index < clip.paths.length; index++) {
    const path = clip.paths[index]
    if (!path.vertices.length) continue
    const prepared = getPreparedClipPath(path, bundle.device, bundle.device.queue)
    pass.setStencilReference?.(index)
    pass.setVertexBuffer(0, prepared.buffer)
    pass.draw(prepared.vertexCount)
  }
}

function getPreparedClipPath(path: WebGpuClipPath, device: WebGpuDevice, queue: WebGpuQueue): PreparedWebGpuClipPath {
  if (path.prepared?.device === device) return path.prepared
  path.prepared?.destroy()
  const buffer = createVertexBuffer(device, queue, path.vertices)
  path.prepared = {
    device,
    buffer,
    vertexCount: path.vertices.length / 2,
    destroy() {
      buffer.destroy?.()
    },
  }
  return path.prepared
}

function destroyPreparedClipPaths(commands: readonly WebGpuDrawCommand[]): void {
  const seen = new Set<WebGpuClipPath>()
  for (const command of commands) {
    for (const path of command.clip?.paths ?? []) {
      if (seen.has(path)) continue
      seen.add(path)
      path.prepared?.destroy()
      path.prepared = undefined
    }
  }
}

const webGpuStencilFormat = 'depth24plus-stencil8'

function clippedStencilState(): unknown {
  return {
    format: webGpuStencilFormat,
    depthWriteEnabled: false,
    depthCompare: 'always',
    stencilFront: { compare: 'equal', failOp: 'keep', depthFailOp: 'keep', passOp: 'keep' },
    stencilBack: { compare: 'equal', failOp: 'keep', depthFailOp: 'keep', passOp: 'keep' },
  }
}

function clipMaskStencilState(): unknown {
  return {
    format: webGpuStencilFormat,
    depthWriteEnabled: false,
    depthCompare: 'always',
    stencilFront: { compare: 'equal', failOp: 'keep', depthFailOp: 'keep', passOp: 'increment-clamp' },
    stencilBack: { compare: 'equal', failOp: 'keep', depthFailOp: 'keep', passOp: 'increment-clamp' },
  }
}

function colorWriteMaskNone(): number {
  const write = (globalThis as { GPUColorWrite?: Record<string, number> }).GPUColorWrite
  return write?.RED !== undefined ? 0 : 0
}

function getClipMaskPipeline(device: WebGpuDevice, format: string, cache: Map<string, unknown>): unknown {
  const key = `clip-mask:${format}`
  const cached = cache.get(key)
  if (cached) return cached
  const module = device.createShaderModule({
    code: `
@vertex
fn vertexMain(@location(0) position: vec2f) -> @builtin(position) vec4f {
  return vec4f(position, 0.0, 1.0);
}

@fragment
fn fragmentMain() -> @location(0) vec4f {
  return vec4f(0.0, 0.0, 0.0, 0.0);
}
    `,
  })
  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'vertexMain',
      buffers: [{
        arrayStride: 8,
        attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }],
      }],
    },
    fragment: {
      module,
      entryPoint: 'fragmentMain',
      targets: [{ format, writeMask: colorWriteMaskNone() }],
    },
    depthStencil: clipMaskStencilState(),
    primitive: { topology: 'triangle-list' },
  })
  cache.set(key, pipeline)
  return pipeline
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
  readonly device: WebGpuDevice
  readonly texture: WebGpuTexture
  readonly bindGroup: unknown
  version: number
  copyWidth: number
  copyHeight: number
}

function getTextureBinding(
  bundle: WebGpuDeviceBundle,
  source: WebGpuTextureSource,
  rendererCache: Map<WebGpuTextureSource, WebGpuTextureBinding>,
  renderCache: Map<WebGpuTextureSource, WebGpuTextureBinding>,
  pipelines: Map<string, unknown>,
): WebGpuTextureBinding {
  if (source.cacheScope === 'page') {
    if (source.binding?.device !== bundle.device) {
      source.binding?.texture.destroy?.()
      source.binding = createTextureBinding(bundle, source, pipelines)
    } else {
      updateTextureBinding(bundle, source, source.binding)
    }
    return source.binding
  }

  const cache = source.cacheScope === 'renderer' ? rendererCache : renderCache
  const cached = cache.get(source)
  if (cached) {
    updateTextureBinding(bundle, source, cached)
    return cached
  }
  const binding = createTextureBinding(bundle, source, pipelines)
  cache.set(source, binding)
  return binding
}

function createTextureBinding(
  bundle: WebGpuDeviceBundle,
  source: WebGpuTextureSource,
  pipelines: Map<string, unknown>,
): WebGpuTextureBinding {
  const texture = bundle.device.createTexture({
    size: [source.width, source.height],
    format: 'rgba8unorm',
    usage: webGpuTextureUsage('TEXTURE_BINDING') |
      webGpuTextureUsage('COPY_DST') |
      webGpuTextureUsage('RENDER_ATTACHMENT'),
  })
  const pipeline = getTexturePipeline(bundle.device, bundle.format, pipelines)
  const bindGroup = bundle.device.createBindGroup({
    layout: (pipeline as { getBindGroupLayout(index: number): unknown }).getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: bundle.sampler },
      { binding: 1, resource: texture.createView() },
    ],
  })
  const binding = {
    device: bundle.device,
    texture,
    bindGroup,
    version: Number.NaN,
    copyWidth: 0,
    copyHeight: 0,
  }
  updateTextureBinding(bundle, source, binding)
  return binding
}

function updateTextureBinding(
  bundle: WebGpuDeviceBundle,
  source: WebGpuTextureSource,
  binding: WebGpuTextureBinding,
): void {
  const version = source.version ?? 0
  const copyWidth = source.copyWidth ?? source.width
  const copyHeight = source.copyHeight ?? source.height
  if (binding.version === version && binding.copyWidth === copyWidth && binding.copyHeight === copyHeight) return
  bundle.device.queue.copyExternalImageToTexture(
    { source: source.source },
    { texture: binding.texture },
    [copyWidth, copyHeight],
  )
  binding.version = version
  binding.copyWidth = copyWidth
  binding.copyHeight = copyHeight
}

function destroyTextureSource(source: WebGpuTextureSource): void {
  source.binding?.texture.destroy?.()
  source.binding = undefined
  source.destroy?.()
}

function createVertexBuffer(device: WebGpuDevice, queue: WebGpuQueue, vertices: Float32Array): WebGpuBuffer {
  const buffer = device.createBuffer({
    size: alignTo(vertices.byteLength, 4),
    usage: webGpuBufferUsage('VERTEX') | webGpuBufferUsage('COPY_DST'),
  })
  queue.writeBuffer(buffer, 0, vertices.buffer, vertices.byteOffset, vertices.byteLength)
  return buffer
}

function getSolidPipeline(device: WebGpuDevice, format: string, cache: Map<string, unknown>, stencil = false): unknown {
  const key = `solid:${format}:${stencil ? 'stencil' : 'plain'}`
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
    ...(stencil ? { depthStencil: clippedStencilState() } : {}),
    primitive: { topology: 'triangle-list' },
  })
  cache.set(key, pipeline)
  return pipeline
}

function getTexturePipeline(device: WebGpuDevice, format: string, cache: Map<string, unknown>, stencil = false): unknown {
  const key = `texture:${format}:${stencil ? 'stencil' : 'plain'}`
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
    ...(stencil ? { depthStencil: clippedStencilState() } : {}),
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

function normalizeTextOversample(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 2
  return Math.max(1, Math.min(4, value))
}

function now(): number {
  return globalThis.performance?.now?.() ?? Date.now()
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
  setVertexBuffer(slot: number, buffer: unknown, offset?: number, size?: number): void
  setScissorRect?(x: number, y: number, width: number, height: number): void
  setStencilReference?(reference: number): void
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
