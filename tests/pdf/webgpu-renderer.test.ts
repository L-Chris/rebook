import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PdfPageDisplayList } from '../../src/pdf/types'

describe('WebGPU PDF renderer', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('reuses compiled page scenes for repeated renders at the same scale', async () => {
    stubCanvasAndWebGpu()
    const { createWebGpuRenderer } = await import('../../src/pdf/paint/webgpu')
    const page: PdfPageDisplayList = {
      pageIndex: 0,
      width: 100,
      height: 120,
      ops: [],
    }
    const document = {
      getPageDisplayList: vi.fn(() => page),
    }
    const renderer = createWebGpuRenderer()

    const first = await renderer.renderPage({ document }, createTargetCanvas(), { pageIndex: 0, scale: 1 })
    const second = await renderer.renderPage({ document }, createTargetCanvas(), { pageIndex: 0, scale: 1 })

    expect(first.cacheHit).toBe(false)
    expect(second.cacheHit).toBe(true)
    expect(second.timings.buildMs).toBe(0)
    expect(second.timings.displayListMs).toBe(0)
    expect(document.getPageDisplayList).toHaveBeenCalledTimes(1)
    renderer.destroy()
  })

  it('can disable the compiled page cache', async () => {
    stubCanvasAndWebGpu()
    const { createWebGpuRenderer } = await import('../../src/pdf/paint/webgpu')
    const page: PdfPageDisplayList = {
      pageIndex: 0,
      width: 100,
      height: 120,
      ops: [],
    }
    const document = {
      getPageDisplayList: vi.fn(() => page),
    }
    const renderer = createWebGpuRenderer({ pageCacheSize: 0 })

    const first = await renderer.renderPage({ document }, createTargetCanvas(), { pageIndex: 0, scale: 1 })
    const second = await renderer.renderPage({ document }, createTargetCanvas(), { pageIndex: 0, scale: 1 })

    expect(first.cacheHit).toBe(false)
    expect(second.cacheHit).toBe(false)
    renderer.destroy()
  })

  it('reuses the glyph atlas GPU texture while the atlas version is unchanged', async () => {
    const controls = stubCanvasAndWebGpu()
    const { createWebGpuRenderer } = await import('../../src/pdf/paint/webgpu')
    const page: PdfPageDisplayList = {
      pageIndex: 0,
      width: 100,
      height: 120,
      ops: [{
        type: 'text',
        run: {
          text: 'A',
          x: 10,
          y: 20,
          fontSize: 12,
        },
      }],
    }
    const document = {
      getPageDisplayList: vi.fn(() => page),
    }
    const renderer = createWebGpuRenderer()

    const first = await renderer.renderPage({ document }, createTargetCanvas(), { pageIndex: 0, scale: 1 })
    const second = await renderer.renderPage({ document }, createTargetCanvas(), { pageIndex: 0, scale: 1 })

    expect(first.cacheHit).toBe(false)
    expect(second.cacheHit).toBe(true)
    expect(controls.device.createTexture).toHaveBeenCalledTimes(1)
    expect(controls.device.queue.copyExternalImageToTexture).toHaveBeenCalledTimes(1)
    expect(controls.device.createBuffer).toHaveBeenCalledTimes(1)
    expect(controls.device.queue.writeBuffer).toHaveBeenCalledTimes(1)
    renderer.destroy()
  })

  it('reuses prepared clip mask buffers for cached pages', async () => {
    const controls = stubCanvasAndWebGpu()
    const { createWebGpuRenderer } = await import('../../src/pdf/paint/webgpu')
    const page: PdfPageDisplayList = {
      pageIndex: 0,
      width: 100,
      height: 120,
      ops: [
        {
          type: 'clip',
          rule: 'nonzero',
          segments: [
            { type: 'moveTo', x: 0, y: 0 },
            { type: 'lineTo', x: 100, y: 0 },
            { type: 'lineTo', x: 50, y: 120 },
            { type: 'closePath' },
          ],
        },
        {
          type: 'path',
          paint: 'fill',
          segments: [{ type: 'rect', x: 0, y: 0, width: 100, height: 120 }],
        },
      ],
    }
    const document = {
      getPageDisplayList: vi.fn(() => page),
    }
    const renderer = createWebGpuRenderer()

    const first = await renderer.renderPage({ document }, createTargetCanvas(), { pageIndex: 0, scale: 1 })
    const second = await renderer.renderPage({ document }, createTargetCanvas(), { pageIndex: 0, scale: 1 })

    expect(first.cacheHit).toBe(false)
    expect(second.cacheHit).toBe(true)
    expect(controls.device.createBuffer).toHaveBeenCalledTimes(2)
    expect(controls.device.queue.writeBuffer).toHaveBeenCalledTimes(2)
    renderer.destroy()
  })

  it('reuses page-owned image GPU textures for cached pages', async () => {
    const controls = stubCanvasAndWebGpu()
    const { createWebGpuRenderer } = await import('../../src/pdf/paint/webgpu')
    const page: PdfPageDisplayList = {
      pageIndex: 0,
      width: 100,
      height: 120,
      ops: [{
        type: 'image',
        name: 'Im0',
        image: {
          width: 1,
          height: 1,
          bitsPerComponent: 8,
          colorSpace: 'DeviceRGB',
          data: new Uint8ClampedArray([255, 255, 255, 255]),
        },
      }],
    }
    const document = {
      getPageDisplayList: vi.fn(() => page),
    }
    const renderer = createWebGpuRenderer()

    const first = await renderer.renderPage({ document }, createTargetCanvas(), { pageIndex: 0, scale: 1 })
    const second = await renderer.renderPage({ document }, createTargetCanvas(), { pageIndex: 0, scale: 1 })

    expect(first.cacheHit).toBe(false)
    expect(second.cacheHit).toBe(true)
    expect(controls.device.createTexture).toHaveBeenCalledTimes(1)
    expect(controls.device.queue.copyExternalImageToTexture).toHaveBeenCalledTimes(1)
    expect(controls.device.createBuffer).toHaveBeenCalledTimes(1)
    expect(controls.device.queue.writeBuffer).toHaveBeenCalledTimes(1)
    renderer.destroy()
  })

  it('prewarms compiled page scenes and GPU resources before rendering', async () => {
    const controls = stubCanvasAndWebGpu()
    const { createWebGpuRenderer } = await import('../../src/pdf/paint/webgpu')
    const page: PdfPageDisplayList = {
      pageIndex: 0,
      width: 100,
      height: 120,
      ops: [{
        type: 'text',
        run: {
          text: 'A',
          x: 10,
          y: 20,
          fontSize: 12,
        },
      }],
    }
    const document = {
      getPageDisplayList: vi.fn(() => page),
    }
    const renderer = createWebGpuRenderer()

    const prewarm = await renderer.prewarmPage({ document }, { pageIndex: 0, scale: 1 })
    const rendered = await renderer.renderPage({ document }, createTargetCanvas(), { pageIndex: 0, scale: 1 })

    expect(prewarm.cacheHit).toBe(false)
    expect(prewarm.prepared).toBe(true)
    expect(rendered.cacheHit).toBe(true)
    expect(rendered.timings.displayListMs).toBe(0)
    expect(document.getPageDisplayList).toHaveBeenCalledTimes(1)
    expect(controls.device.createTexture).toHaveBeenCalledTimes(1)
    expect(controls.device.queue.copyExternalImageToTexture).toHaveBeenCalledTimes(1)
    expect(controls.device.createBuffer).toHaveBeenCalledTimes(1)
    expect(controls.device.queue.writeBuffer).toHaveBeenCalledTimes(1)
    renderer.destroy()
  })

  it('deduplicates concurrent prewarm and render builds for the same page', async () => {
    stubCanvasAndWebGpu()
    const { createWebGpuRenderer } = await import('../../src/pdf/paint/webgpu')
    const page: PdfPageDisplayList = {
      pageIndex: 0,
      width: 100,
      height: 120,
      ops: [],
    }
    let resolvePage: ((page: PdfPageDisplayList) => void) | undefined
    const pagePromise = new Promise<PdfPageDisplayList>(resolve => {
      resolvePage = resolve
    })
    const document = {
      getPageDisplayList: vi.fn(() => pagePromise),
    }
    const renderer = createWebGpuRenderer()

    const prewarm = renderer.prewarmPage({ document }, { pageIndex: 0, scale: 1 })
    await Promise.resolve()
    const rendered = renderer.renderPage({ document }, createTargetCanvas(), { pageIndex: 0, scale: 1 })
    resolvePage?.(page)

    const [prewarmResult, renderResult] = await Promise.all([prewarm, rendered])

    expect(prewarmResult.cacheHit).toBe(false)
    expect(renderResult.cacheHit).toBe(true)
    expect(document.getPageDisplayList).toHaveBeenCalledTimes(1)
    renderer.destroy()
  })
})

function stubCanvasAndWebGpu(): { device: {
  queue: {
    copyExternalImageToTexture: ReturnType<typeof vi.fn>
    submit: ReturnType<typeof vi.fn>
    writeBuffer: ReturnType<typeof vi.fn>
  }
  createTexture: ReturnType<typeof vi.fn>
  createBuffer: ReturnType<typeof vi.fn>
} } {
  class FakeOffscreenCanvas {
    width: number
    height: number

    constructor(width: number, height: number) {
      this.width = width
      this.height = height
    }

    getContext(): unknown {
      return {
        clearRect: vi.fn(),
        fillText: vi.fn(),
        putImageData: vi.fn(),
        measureText: vi.fn(() => ({
          width: 8,
          actualBoundingBoxAscent: 9,
          actualBoundingBoxDescent: 3,
          actualBoundingBoxLeft: 0,
          actualBoundingBoxRight: 8,
        })),
        set fillStyle(_value: string) {},
        set font(_value: string) {},
        set textBaseline(_value: string) {},
      }
    }
  }

  const texture = { createView: vi.fn(() => ({})), destroy: vi.fn() }
  const pass = {
    setPipeline: vi.fn(),
    setBindGroup: vi.fn(),
    setVertexBuffer: vi.fn(),
    setScissorRect: vi.fn(),
    setStencilReference: vi.fn(),
    draw: vi.fn(),
    end: vi.fn(),
  }
  const device = {
    queue: {
      copyExternalImageToTexture: vi.fn(),
      submit: vi.fn(),
      writeBuffer: vi.fn(),
    },
    createSampler: vi.fn(() => ({})),
    createShaderModule: vi.fn(() => ({})),
    createBindGroupLayout: vi.fn(() => ({})),
    createPipelineLayout: vi.fn(() => ({})),
    createRenderPipeline: vi.fn(() => ({ getBindGroupLayout: vi.fn(() => ({})) })),
    createBindGroup: vi.fn(() => ({})),
    createTexture: vi.fn(() => texture),
    createBuffer: vi.fn(() => ({ destroy: vi.fn() })),
    createCommandEncoder: vi.fn(() => ({
      beginRenderPass: vi.fn(() => pass),
      finish: vi.fn(() => ({})),
    })),
  }

  vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas)
  vi.stubGlobal('ImageData', class FakeImageData {
    data: Uint8ClampedArray
    width: number
    height: number

    constructor(data: Uint8ClampedArray, width: number, height: number) {
      this.data = data
      this.width = width
      this.height = height
    }
  })
  vi.stubGlobal('navigator', {
    gpu: {
      requestAdapter: vi.fn(async () => ({
        requestDevice: vi.fn(async () => device),
      })),
      getPreferredCanvasFormat: vi.fn(() => 'rgba8unorm'),
    },
  })
  return { device }
}

function createTargetCanvas(): HTMLCanvasElement {
  const texture = { createView: vi.fn(() => ({})) }
  return {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ({
      configure: vi.fn(),
      getCurrentTexture: vi.fn(() => texture),
    })),
  } as unknown as HTMLCanvasElement
}
