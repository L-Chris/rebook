import { existsSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright-core'

const DEFAULT_URL = 'https://read.rethinkos.com'
const DEFAULT_LOCAL_URL = 'http://127.0.0.1:3131'
const DEFAULT_TIMEOUT_MS = 180_000

const options = {
  url: stringArg('url') ?? process.env.REBOOK_DEMO_URL ?? DEFAULT_URL,
  localUrl: stringArg('local-url') ?? DEFAULT_LOCAL_URL,
  file: resolve(stringArg('file') ?? pickDefaultPdf()),
  pages: clampInteger(numberArg('pages', 10), 1, 80),
  timeoutMs: clampInteger(numberArg('timeout-ms', DEFAULT_TIMEOUT_MS), 5_000, 900_000),
  screenshot: resolve(stringArg('screenshot') ?? 'dist/demo-pdf-painter-benchmark.png'),
  executablePath: stringArg('executable') ?? process.env.CHROME_PATH ?? '/usr/bin/chromium',
  cdpEndpoint: stringArg('cdp-endpoint') ?? process.env.REBOOK_BROWSER_CDP ?? '',
  headless: resolveHeadless(),
  keepOpen: booleanArg('keep-open'),
  noServe: booleanArg('no-serve'),
  fallbackLocal: !booleanArg('no-fallback-local'),
  direct: !booleanArg('use-proxy'),
}
const launchEnv = options.direct ? withoutProxyEnv(process.env) : process.env

if (!existsSync(options.file)) {
  throw new Error(`PDF fixture not found: ${options.file}`)
}

if (!options.cdpEndpoint && !existsSync(options.executablePath)) {
  throw new Error(`Chromium executable not found: ${options.executablePath}`)
}

let server = null
let browser = null

try {
  if (!options.noServe) {
    server = await ensureDemoServer(options.localUrl)
  }

  browser = await connectBrowser(options)
  const context = await createBenchmarkContext(browser)
  await context.addInitScript(() => {
    localStorage.removeItem('rebook-demo-config')
  })

  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    const text = message.text()
    if (message.type() === 'error' && !isIgnoredBrowserConsoleError(text)) errors.push(text)
  })

  console.log(`Opening ${options.url}${options.direct ? ' with proxy disabled' : ''}...`)
  const effectiveUrl = await openDemoPage(page, options)
  console.log(`Uploading ${options.file}...`)
  await page.waitForSelector('#file-input', { state: 'attached', timeout: options.timeoutMs })
  await page.setInputFiles('#file-input', await createRemoteFilePayload(options.file))
  console.log('Waiting for PDF to render...')
  await waitForPdfToOpen(page, options.timeoutMs)
  console.log(`Running demo PDF painter benchmark on ${options.pages} page${options.pages === 1 ? '' : 's'}...`)
  await runBenchmarkInDemo(page, options.pages, options.timeoutMs)

  console.log(`Writing screenshot to ${options.screenshot}...`)
  await mkdir(dirname(options.screenshot), { recursive: true })
  await page.screenshot({ path: options.screenshot, fullPage: true })

  const result = await readBenchmarkResult(page)
  console.log(formatBenchmarkSummary({
    ...result,
    url: effectiveUrl,
    requestedUrl: options.url,
    file: options.file,
    pages: options.pages,
    screenshot: options.screenshot,
    browserErrors: errors.slice(-12),
  }))

  if (result.status.toLowerCase().includes('failed')) {
    process.exitCode = 1
  }

  if (options.keepOpen) {
    console.log('Browser kept open. Press Ctrl+C to stop.')
    await new Promise(() => {})
  }
} finally {
  if (browser && !options.keepOpen) await browser.close()
  if (server) stopServer(server)
}

async function connectBrowser(options) {
  if (options.cdpEndpoint) {
    console.log(`Connecting to remote browser at ${options.cdpEndpoint}...`)
    return chromium.connectOverCDP(await resolveCdpEndpoint(options.cdpEndpoint), {
      timeout: options.timeoutMs,
      headers: options.direct ? { 'Proxy-Connection': 'close' } : undefined,
    })
  }

  return chromium.launch({
    executablePath: options.executablePath,
    headless: options.headless,
    env: launchEnv,
    args: [
      ...(options.direct ? ['--no-proxy-server'] : []),
      '--ignore-certificate-errors',
      '--enable-unsafe-webgpu',
      '--enable-features=Vulkan,DefaultANGLEVulkan,WebGPUDeveloperFeatures',
      '--disable-dev-shm-usage',
    ],
  })
}

async function resolveCdpEndpoint(endpoint) {
  if (endpoint.startsWith('ws://') || endpoint.startsWith('wss://')) return endpoint
  const base = endpoint.replace(/\/+$/, '')
  const response = await fetch(`${base}/json/version`, {
    signal: AbortSignal.timeout(5_000),
  })
  if (!response.ok) throw new Error(`Unable to read CDP version from ${base}: HTTP ${response.status}`)
  const payload = await response.json()
  if (typeof payload.webSocketDebuggerUrl !== 'string') {
    throw new Error(`CDP version response from ${base} does not include webSocketDebuggerUrl`)
  }
  return payload.webSocketDebuggerUrl.replace(/^ws:\/\/127\.0\.0\.1:/, `ws://${new URL(base).hostname}:`)
}

async function createBenchmarkContext(browser) {
  try {
    return await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1600, height: 1000 },
    })
  } catch (error) {
    const fallback = browser.contexts()[0]
    if (!fallback) throw error
    return fallback
  }
}

async function createRemoteFilePayload(filePath) {
  return {
    name: basename(filePath),
    mimeType: filePath.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
    buffer: await readFile(filePath),
  }
}

async function ensureDemoServer(localUrl) {
  if (await canReach(localUrl)) return null

  console.log(`Starting Vite demo server for ${localUrl}...`)
  const child = spawn('npm', ['run', 'dev', '--', '--host', '0.0.0.0'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: launchEnv,
  })
  child.stdout.on('data', chunk => {
    const text = String(chunk)
    if (/Local:|ready in|error/i.test(text)) process.stdout.write(text)
  })
  child.stderr.on('data', chunk => process.stderr.write(chunk))

  const started = await waitForReachable(localUrl, 30_000)
  if (!started) {
    stopServer(child)
    throw new Error(`Timed out waiting for demo server at ${localUrl}`)
  }
  return child
}

async function openDemoPage(page, options) {
  try {
    await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: options.timeoutMs })
    return options.url
  } catch (error) {
    if (!options.fallbackLocal || options.url === options.localUrl) throw error
    console.warn(`Unable to open ${options.url}: ${error.message}`)
    console.warn(`Falling back to ${options.localUrl}`)
    await page.goto('about:blank', { waitUntil: 'load', timeout: 5_000 }).catch(() => {})
    await page.waitForTimeout(250)
    await page.goto(options.localUrl, { waitUntil: 'domcontentloaded', timeout: options.timeoutMs })
    return options.localUrl
  }
}

async function waitForPdfToOpen(page, timeoutMs) {
  await page.waitForFunction(() => {
    const dropHidden = document.querySelector('#drop-target')?.classList.contains('hidden')
    const surface = document.querySelector('[data-rebook-page-surface]')
    const status = document.querySelector('#pdf-benchmark-status')?.textContent ?? ''
    return Boolean(dropHidden && surface && !/Open a PDF/i.test(status))
  }, undefined, { timeout: timeoutMs })
}

async function runBenchmarkInDemo(page, pages, timeoutMs) {
  await page.evaluate(pageCount => {
    const input = document.querySelector('#pdf-benchmark-pages-input')
    if (!(input instanceof HTMLInputElement)) throw new Error('Missing PDF benchmark page input')
    input.value = String(pageCount)
    input.dispatchEvent(new Event('change', { bubbles: true }))

    const checkbox = document.querySelector('#pdf-benchmark-check')
    if (!(checkbox instanceof HTMLInputElement)) throw new Error('Missing PDF benchmark checkbox')
    if (checkbox.checked) {
      const button = document.querySelector('#btn-pdf-benchmark')
      if (!(button instanceof HTMLButtonElement)) throw new Error('Missing PDF benchmark button')
      button.click()
      return
    }
    checkbox.checked = true
    checkbox.dispatchEvent(new Event('change', { bubbles: true }))
  }, pages)

  await page.waitForFunction(() => {
    const status = document.querySelector('#pdf-benchmark-status')?.textContent?.trim() ?? ''
    const result = document.querySelector('#pdf-benchmark-result')?.textContent?.trim() ?? ''
    return result.includes('canvas ->') && /finished|failed/i.test(status)
  }, undefined, { timeout: timeoutMs })
}

async function readBenchmarkResult(page) {
  return page.evaluate(async () => {
    const status = document.querySelector('#pdf-benchmark-status')?.textContent?.trim() ?? ''
    const result = document.querySelector('#pdf-benchmark-result')?.textContent?.trim() ?? ''
    const currentLayer = document.querySelector('[data-rebook-fixed-painter-backend]')
    const currentPdfLayer = document.querySelector('[data-rebook-fixed-webgpu-pdf="true"]')
    const webGpu = await detectWebGpuCapability()
    return {
      status,
      result,
      webGpu,
      currentBackend: currentLayer?.getAttribute('data-rebook-fixed-painter-backend') ?? 'unknown',
      currentPdfWebGpu: Boolean(currentPdfLayer),
      currentWebGpuOps: currentPdfLayer?.getAttribute('data-rebook-fixed-webgpu-ops') ?? null,
      currentWebGpuDrawCalls: currentPdfLayer?.getAttribute('data-rebook-fixed-webgpu-draw-calls') ?? null,
      currentWebGpuGlyphs: currentPdfLayer?.getAttribute('data-rebook-fixed-webgpu-glyphs') ?? null,
    }

    async function detectWebGpuCapability() {
      if (!navigator.gpu) return { apiExposed: false, adapterPresent: false, adapterInfo: null, error: null }
      try {
        const adapter = await navigator.gpu.requestAdapter()
        return {
          apiExposed: true,
          adapterPresent: Boolean(adapter),
          adapterInfo: adapter?.info ? Object.fromEntries(Object.entries(adapter.info)) : null,
          error: null,
        }
      } catch (error) {
        return {
          apiExposed: true,
          adapterPresent: false,
          adapterInfo: null,
          error: String(error?.message ?? error),
        }
      }
    }
  })
}

function formatBenchmarkSummary(summary) {
  const lines = [
    'Demo PDF painter benchmark',
    `url: ${summary.url}`,
    summary.requestedUrl === summary.url ? '' : `requested url: ${summary.requestedUrl}`,
    `file: ${summary.file}`,
    `pages: ${summary.pages}`,
    `status: ${summary.status}`,
    `browser WebGPU: ${formatWebGpuCapability(summary.webGpu)}`,
    `current page backend: ${summary.currentBackend}${summary.currentPdfWebGpu ? ' (native PDF WebGPU)' : ''}`,
  ].filter(Boolean)
  if (summary.currentWebGpuOps) lines.push(`current page ops/drawCalls/glyphs: ${summary.currentWebGpuOps}/${summary.currentWebGpuDrawCalls}/${summary.currentWebGpuGlyphs}`)
  lines.push('', summary.result, '', `screenshot: ${summary.screenshot}`)
  if (summary.browserErrors.length) {
    lines.push('', 'browser errors:', ...summary.browserErrors.map(error => `- ${error}`))
  }
  return lines.join('\n')
}

function formatWebGpuCapability(capability) {
  if (!capability?.apiExposed) return 'API unavailable'
  if (!capability.adapterPresent) return `API exposed, requestAdapter() returned null${capability.error ? ` (${capability.error})` : ''}`
  return `adapter available${formatWebGpuAdapterInfo(capability.adapterInfo)}`
}

function formatWebGpuAdapterInfo(info) {
  if (!info || typeof info !== 'object') return ''
  const parts = [info.vendor, info.architecture, info.device, info.description].filter(Boolean)
  return parts.length ? ` (${parts.join(' / ')})` : ''
}

function withoutProxyEnv(env) {
  const output = { ...env }
  for (const key of Object.keys(output)) {
    if (/^(?:http|https|all|ftp|no)_proxy$/i.test(key)) delete output[key]
  }
  return output
}

function isIgnoredBrowserConsoleError(text) {
  return text.includes('[vite] failed to connect to websocket') ||
    /WebSocket connection to 'wss?:\/\/[^']+\?token=/.test(text) ||
    text === 'Failed to load resource: the server responded with a status of 404 ()'
}

async function canReach(url) {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 1_500)
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    return response.ok || response.status < 500
  } catch {
    return false
  }
}

async function waitForReachable(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await canReach(url)) return true
    await sleep(500)
  }
  return false
}

function stopServer(child) {
  child.kill('SIGTERM')
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function pickDefaultPdf() {
  const candidates = [
    'data/情景学习.pdf',
    'data/四千周.pdf',
    'data/test.pdf',
  ]
  const found = candidates.find(candidate => existsSync(resolve(candidate)))
  return found ?? candidates[0]
}

function stringArg(name) {
  const prefix = `--${name}=`
  return process.argv.find(arg => arg.startsWith(prefix))?.slice(prefix.length)
}

function numberArg(name, fallback) {
  const raw = stringArg(name)
  if (!raw) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

function booleanArg(name) {
  return process.argv.includes(`--${name}`)
}

function resolveHeadless() {
  if (booleanArg('headed')) return false
  if (booleanArg('headless')) return true
  return !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY
}

function clampInteger(value, min, max) {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, Math.trunc(value)))
}
