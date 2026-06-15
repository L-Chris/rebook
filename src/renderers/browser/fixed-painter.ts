import {
    type FixedDocument,
    type FixedPageImage,
    type FixedPageRenderer,
} from '../../core/fixed-document'
import type { BrowserFixedVisualRenderContext } from './fixed-visual'
import { isPdfFixedDocument } from '../../pdf/fixed-document'
import { BrowserFixedPdfCanvasRenderer } from './fixed-pdf-canvas'
import { BrowserFixedPdfWebGpuRenderer } from './fixed-pdf-webgpu'
import { WebGpuUnsupportedError, type WebGpuRenderTimings } from '../../pdf/paint/webgpu'

export type BrowserFixedPainterMatch = boolean | number
export type BrowserFixedPainterPreference = 'canvas' | 'webgpu' | 'auto'
export type BrowserFixedPaintBackend = 'canvas2d' | 'webgpu'

export interface BrowserFixedPaintMetric {
    readonly id: string
    readonly backend: BrowserFixedPaintBackend
    readonly ms: number
    readonly fallbackFrom?: BrowserFixedPaintBackend
    readonly fallbackReason?: string
    readonly pageIndex?: number
    readonly webGpu?: BrowserFixedWebGpuPaintDetail
}

export interface BrowserFixedWebGpuPaintDetail {
    readonly cacheHit: boolean
    readonly timings: WebGpuRenderTimings
}

export interface BrowserFixedPaintResult {
    readonly element: HTMLElement
    readonly contentKind: 'canvas' | 'image' | 'texture' | 'custom'
    readonly paint: BrowserFixedPaintMetric
    destroy?(): void
}

export interface BrowserFixedPainter {
    readonly id: string
    readonly backend: BrowserFixedPaintBackend
    match(document: FixedDocument): BrowserFixedPainterMatch
    paint(context: BrowserFixedVisualRenderContext): Promise<BrowserFixedPaintResult | null> | BrowserFixedPaintResult | null
    prewarm?(context: BrowserFixedVisualRenderContext): Promise<void> | void
    destroy?(): Promise<void> | void
}

export interface BrowserFixedPainterConfig {
    readonly fixedPageRenderer?: FixedPageRenderer<HTMLCanvasElement>
    readonly devicePixelRatio?: number | (() => number)
}

export interface BrowserFixedCanvasPainterConfig extends BrowserFixedPainterConfig {}

export class BrowserFixedCanvasPainter implements BrowserFixedPainter {
    readonly id = 'browser-fixed-canvas-painter'
    readonly backend = 'canvas2d' as const
    private readonly configuredFixedPageRenderer?: FixedPageRenderer<HTMLCanvasElement>
    private readonly defaultPdfPageRenderer = new BrowserFixedPdfCanvasRenderer()
    private readonly devicePixelRatio?: number | (() => number)

    constructor(config: BrowserFixedCanvasPainterConfig = {}) {
        this.configuredFixedPageRenderer = config.fixedPageRenderer
        this.devicePixelRatio = config.devicePixelRatio
    }

    match(document: FixedDocument): BrowserFixedPainterMatch {
        return Boolean(this.getFixedPageRenderer(document) || document.getPageImage)
    }

    async paint(context: BrowserFixedVisualRenderContext): Promise<BrowserFixedPaintResult | null> {
        const start = now()
        const canvas = document.createElement('canvas')
        canvas.dataset.rebookFixedCanvas = 'true'
        canvas.dataset.rebookFixedPainter = this.id
        try {
            const renderer = this.getFixedPageRenderer(context.document)
            if (renderer) {
                await renderer.renderPage(context.document, canvas, context.page.index, {
                    scale: context.scale,
                    devicePixelRatio: this.getDevicePixelRatio(),
                    intent: 'display',
                    textLayer: false,
                })
            } else {
                const image = await context.document.getPageImage?.(context.page.index)
                if (!image) return null
                await paintFixedImageToCanvas(canvas, image, context)
            }
            return {
                element: canvas,
                contentKind: 'canvas',
                paint: {
                    id: this.id,
                    backend: this.backend,
                    ms: now() - start,
                },
                destroy() {
                    canvas.remove()
                },
            }
        } catch {
            canvas.remove()
            return null
        }
    }

    destroy(): void {
        this.configuredFixedPageRenderer?.destroy?.()
    }

    private getFixedPageRenderer(fixedDocument: FixedDocument): FixedPageRenderer<HTMLCanvasElement> | undefined {
        if (this.configuredFixedPageRenderer) return this.configuredFixedPageRenderer
        return isPdfFixedDocument(fixedDocument) ? this.defaultPdfPageRenderer : undefined
    }

    private getDevicePixelRatio(): number {
        return getDevicePixelRatio(this.devicePixelRatio)
    }
}

export interface BrowserFixedWebGpuPainterConfig extends BrowserFixedPainterConfig {}

export class BrowserFixedWebGpuPainter implements BrowserFixedPainter {
    readonly id = 'browser-fixed-webgpu-painter'
    readonly backend = 'webgpu' as const
    private readonly canvasPainter: BrowserFixedCanvasPainter
    private readonly pdfRenderer = new BrowserFixedPdfWebGpuRenderer({ fallbackOnUnsupported: true })
    private readonly devicePixelRatio?: number | (() => number)
    private devicePromise: Promise<WebGpuDeviceBundle | null> | null = null
    private pipelineByFormat = new Map<string, unknown>()

    constructor(config: BrowserFixedWebGpuPainterConfig = {}) {
        this.canvasPainter = new BrowserFixedCanvasPainter(config)
        this.devicePixelRatio = config.devicePixelRatio
    }

    match(document: FixedDocument): BrowserFixedPainterMatch {
        if (!isBrowserWebGpuSupported()) return false
        if (isPdfFixedDocument(document)) return 20
        return this.canvasPainter.match(document) ? 10 : false
    }

    async paint(context: BrowserFixedVisualRenderContext): Promise<BrowserFixedPaintResult | null> {
        const start = now()
        if (isPdfFixedDocument(context.document)) return this.paintPdfPage(context, start)

        const bundle = await this.getDeviceBundle()
        if (!bundle) return null

        const source = await this.createTextureSource(context)
        if (!source) return null

        const canvas = document.createElement('canvas')
        canvas.dataset.rebookFixedWebgpu = 'true'
        canvas.dataset.rebookFixedPainter = this.id
        canvas.width = context.viewport.pixelWidth
        canvas.height = context.viewport.pixelHeight

        try {
            renderWebGpuTexture(canvas, source, bundle, this.pipelineByFormat)
            return {
                element: canvas,
                contentKind: 'texture',
                paint: {
                    id: this.id,
                    backend: this.backend,
                    ms: now() - start,
                },
                destroy() {
                    canvas.remove()
                    source.destroy?.()
                },
            }
        } catch {
            canvas.remove()
            source.destroy?.()
            return null
        }
    }

    async prewarm(context: BrowserFixedVisualRenderContext): Promise<void> {
        if (!isPdfFixedDocument(context.document)) return
        try {
            await this.pdfRenderer.prewarmPage(context.document, context.page.index, {
                scale: context.scale,
                devicePixelRatio: this.getDevicePixelRatio(),
                intent: 'display',
                textLayer: false,
            })
        } catch {
            // Prewarming is opportunistic; failed pages still render through the normal path.
        }
    }

    destroy(): void {
        this.pipelineByFormat.clear()
        this.pdfRenderer.destroy()
        this.canvasPainter.destroy?.()
    }

    private async createTextureSource(context: BrowserFixedVisualRenderContext): Promise<WebGpuTextureSource | null> {
        if (context.document.getPageImage && !isPdfFixedDocument(context.document)) {
            const image = await context.document.getPageImage(context.page.index)
            return image ? createImageTextureSource(image) : null
        }

        const rendered = await this.canvasPainter.paint(context)
        if (!rendered) return null
        const canvas = rendered.element instanceof HTMLCanvasElement ? rendered.element : null
        if (!canvas) {
            rendered.destroy?.()
            return null
        }
        return {
            source: canvas,
            width: canvas.width,
            height: canvas.height,
            destroy: rendered.destroy,
        }
    }

    private async paintPdfPage(
        context: BrowserFixedVisualRenderContext,
        start: number,
    ): Promise<BrowserFixedPaintResult | null> {
        const canvas = document.createElement('canvas')
        canvas.dataset.rebookFixedWebgpu = 'true'
        canvas.dataset.rebookFixedWebgpuPdf = 'true'
        canvas.dataset.rebookFixedPainter = this.id
        try {
            const result = await this.pdfRenderer.renderPage(context.document, canvas, context.page.index, {
                scale: context.scale,
                devicePixelRatio: this.getDevicePixelRatio(),
                intent: 'display',
                textLayer: false,
            })
            canvas.dataset.rebookFixedWebgpuOps = String(result.ops)
            canvas.dataset.rebookFixedWebgpuDrawCalls = String(result.drawCalls)
            canvas.dataset.rebookFixedWebgpuGlyphs = String(result.glyphs)
            canvas.dataset.rebookFixedWebgpuPaths = String(result.paths)
            canvas.dataset.rebookFixedWebgpuImages = String(result.images)
            canvas.dataset.rebookFixedWebgpuCacheHit = String(result.cacheHit)
            canvas.dataset.rebookFixedWebgpuBuildMs = String(result.timings.buildMs)
            canvas.dataset.rebookFixedWebgpuRenderMs = String(result.timings.renderMs)
            return {
                element: canvas,
                contentKind: 'texture',
                paint: {
                    id: this.id,
                    backend: this.backend,
                    ms: now() - start,
                    webGpu: {
                        cacheHit: result.cacheHit,
                        timings: result.timings,
                    },
                },
                destroy() {
                    canvas.remove()
                },
            }
        } catch (error) {
            canvas.remove()
            if (error instanceof WebGpuUnsupportedError) {
                const fallback = await this.canvasPainter.paint(context)
                if (!fallback) return null
                return {
                    ...fallback,
                    paint: {
                        ...fallback.paint,
                        fallbackFrom: this.backend,
                        fallbackReason: error.unsupportedReasons.join(', ') || error.message,
                        pageIndex: context.page.index,
                        ms: now() - start,
                    },
                }
            }
            return null
        }
    }

    private getDeviceBundle(): Promise<WebGpuDeviceBundle | null> {
        this.devicePromise ??= createWebGpuDeviceBundle()
        return this.devicePromise
    }

    private getDevicePixelRatio(): number {
        return getDevicePixelRatio(this.devicePixelRatio)
    }
}

export function createDefaultFixedPainters(
    preference: BrowserFixedPainterPreference,
    config: BrowserFixedPainterConfig,
): BrowserFixedPainter[] {
    const canvas = new BrowserFixedCanvasPainter(config)
    if (preference !== 'webgpu') return [canvas]
    return [
        new BrowserFixedWebGpuPainter(config),
        canvas,
    ]
}

export function isBrowserWebGpuSupported(): boolean {
    return Boolean(getNavigatorGpu())
}

async function paintFixedImageToCanvas(
    canvas: HTMLCanvasElement,
    image: FixedPageImage,
    context: BrowserFixedVisualRenderContext,
): Promise<void> {
    const viewport = context.viewport
    canvas.dataset.rebookFixedCanvasImage = 'true'
    canvas.dataset.rebookFixedImage = 'true'
    canvas.width = viewport.pixelWidth
    canvas.height = viewport.pixelHeight
    const renderingContext = canvas.getContext('2d')
    if (!renderingContext) throw new Error('2D canvas context is unavailable')
    renderingContext.clearRect(0, 0, canvas.width, canvas.height)
    const imageElement = await loadImageElement(image)
    renderingContext.drawImage(imageElement, 0, 0, canvas.width, canvas.height)
}

async function loadImageElement(image: FixedPageImage): Promise<HTMLImageElement> {
    const element = document.createElement('img') as HTMLImageElement
    element.src = image.src
    element.alt = image.alt ?? ''
    if (typeof element.decode === 'function') {
        try {
            await element.decode()
        } catch {
            // Broken image pages are handled by the caller's painter fallback.
        }
    } else {
        await new Promise<void>(resolve => {
            const done = () => resolve()
            element.onload = done
            element.onerror = done
            setTimeout(done, 0)
        })
    }
    return element
}

async function createImageTextureSource(image: FixedPageImage): Promise<WebGpuTextureSource> {
    if (typeof createImageBitmap === 'function' && typeof fetch === 'function') {
        const response = await fetch(image.src)
        const bitmap = await createImageBitmap(await response.blob())
        return {
            source: bitmap,
            width: bitmap.width,
            height: bitmap.height,
            destroy() {
                bitmap.close()
            },
        }
    }

    const element = await loadImageElement(image)
    return {
        source: element,
        width: image.width,
        height: image.height,
    }
}

interface WebGpuDeviceBundle {
    readonly gpu: WebGpuNavigator
    readonly device: WebGpuDevice
    readonly format: string
    readonly sampler: unknown
}

interface WebGpuTextureSource {
    readonly source: unknown
    readonly width: number
    readonly height: number
    destroy?(): void
}

type WebGpuNavigator = {
    requestAdapter(): Promise<WebGpuAdapter | null>
    getPreferredCanvasFormat?: () => string
}

type WebGpuAdapter = {
    requestDevice(): Promise<WebGpuDevice>
}

type WebGpuDevice = {
    queue: {
        copyExternalImageToTexture(source: unknown, destination: unknown, size: readonly number[]): void
        submit(commandBuffers: readonly unknown[]): void
    }
    createSampler(descriptor?: unknown): unknown
    createShaderModule(descriptor: unknown): unknown
    createRenderPipeline(descriptor: unknown): unknown
    createBindGroup(descriptor: unknown): unknown
    createTexture(descriptor: unknown): WebGpuTexture
    createCommandEncoder(): WebGpuCommandEncoder
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
    draw(vertexCount: number): void
    end(): void
}

async function createWebGpuDeviceBundle(): Promise<WebGpuDeviceBundle | null> {
    const gpu = getNavigatorGpu()
    if (!gpu) return null
    const adapter = await gpu.requestAdapter()
    if (!adapter) return null
    const device = await adapter.requestDevice()
    return {
        gpu,
        device,
        format: gpu.getPreferredCanvasFormat?.() ?? 'bgra8unorm',
        sampler: device.createSampler({ magFilter: 'linear', minFilter: 'linear' }),
    }
}

function renderWebGpuTexture(
    canvas: HTMLCanvasElement,
    textureSource: WebGpuTextureSource,
    bundle: WebGpuDeviceBundle,
    pipelineByFormat: Map<string, unknown>,
): void {
    const context = canvas.getContext('webgpu') as WebGpuCanvasContext | null
    if (!context) throw new Error('WebGPU canvas context is unavailable')

    context.configure({
        device: bundle.device,
        format: bundle.format,
        alphaMode: 'premultiplied',
    })

    const texture = bundle.device.createTexture({
        size: [textureSource.width, textureSource.height],
        format: 'rgba8unorm',
        usage: webGpuTextureUsage('TEXTURE_BINDING') |
            webGpuTextureUsage('COPY_DST') |
            webGpuTextureUsage('RENDER_ATTACHMENT'),
    })
    bundle.device.queue.copyExternalImageToTexture(
        { source: textureSource.source },
        { texture },
        [textureSource.width, textureSource.height],
    )

    const pipeline = getWebGpuBlitPipeline(bundle.device, bundle.format, pipelineByFormat)
    const bindGroup = bundle.device.createBindGroup({
        layout: (pipeline as { getBindGroupLayout(index: number): unknown }).getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: bundle.sampler },
            { binding: 1, resource: texture.createView() },
        ],
    })
    const encoder = bundle.device.createCommandEncoder()
    const pass = encoder.beginRenderPass({
        colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 1, g: 1, b: 1, a: 0 },
            loadOp: 'clear',
            storeOp: 'store',
        }],
    })
    pass.setPipeline(pipeline)
    pass.setBindGroup(0, bindGroup)
    pass.draw(6)
    pass.end()
    bundle.device.queue.submit([encoder.finish()])
    texture.destroy?.()
}

type WebGpuCanvasContext = {
    configure(descriptor: unknown): void
    getCurrentTexture(): WebGpuTexture
}

function getWebGpuBlitPipeline(
    device: WebGpuDevice,
    format: string,
    pipelineByFormat: Map<string, unknown>,
): unknown {
    let pipeline = pipelineByFormat.get(format)
    if (pipeline) return pipeline

    const module = device.createShaderModule({
        code: `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vertexMain(@builtin(vertex_index) index: u32) -> VertexOutput {
  var positions = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f( 1.0, -1.0),
    vec2f(-1.0,  1.0),
    vec2f(-1.0,  1.0),
    vec2f( 1.0, -1.0),
    vec2f( 1.0,  1.0)
  );
  var uvs = array<vec2f, 6>(
    vec2f(0.0, 1.0),
    vec2f(1.0, 1.0),
    vec2f(0.0, 0.0),
    vec2f(0.0, 0.0),
    vec2f(1.0, 1.0),
    vec2f(1.0, 0.0)
  );
  var output: VertexOutput;
  output.position = vec4f(positions[index], 0.0, 1.0);
  output.uv = uvs[index];
  return output;
}

@group(0) @binding(0) var pageSampler: sampler;
@group(0) @binding(1) var pageTexture: texture_2d<f32>;

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  return textureSample(pageTexture, pageSampler, input.uv);
}
        `,
    })
    pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module, entryPoint: 'vertexMain' },
        fragment: {
            module,
            entryPoint: 'fragmentMain',
            targets: [{ format }],
        },
        primitive: { topology: 'triangle-list' },
    })
    pipelineByFormat.set(format, pipeline)
    return pipeline
}

function getNavigatorGpu(): WebGpuNavigator | null {
    const gpu = (globalThis.navigator as { gpu?: WebGpuNavigator } | undefined)?.gpu
    return gpu ?? null
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

function getDevicePixelRatio(value: number | (() => number) | undefined): number {
    const configured = typeof value === 'function' ? value() : value
    const ratio = configured ?? globalThis.devicePixelRatio ?? 1
    return Number.isFinite(ratio) && ratio > 0 ? ratio : 1
}

function now(): number {
    return globalThis.performance?.now?.() ?? Date.now()
}
