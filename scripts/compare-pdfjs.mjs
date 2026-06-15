import { readFile, stat, unlink, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { basename, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'

const scriptPath = fileURLToPath(import.meta.url)
const sampleArgs = positionalArgs()
const samplePaths = sampleArgs.length > 0 ? sampleArgs : ['data/四千周.pdf']
const runs = Math.max(1, Math.trunc(numberArg('runs', 1)))
const maxPages = Math.max(0, Math.trunc(numberArg('pages', 0)))
const scale = numberArg('scale', 1)
const minRenderSpeedup = numberArg('min-render-speedup', 2)
const includeRender = booleanArg('render', true)
const includeText = booleanArg('text', false)
const includeDisplayList = booleanArg('display-list', false)
const useEmbeddedFonts = booleanArg('embedded-fonts', true)
const engine = stringArg('engine')

if (engine) {
  const sample = stringArg('sample')
  const mode = stringArg('mode')
  if (!sample || !mode) throw new Error('Worker requires --sample and --mode')
  const result = engine === 'rebook'
    ? await runRebook(sample, mode)
    : await runPdfjs(sample, mode)
  const output = JSON.stringify(result)
  const outputPath = stringArg('out')
  if (outputPath) await writeFile(outputPath, output)
  else console.log(output)
} else {
  await runCoordinator()
}

async function runCoordinator() {
  const missing = await missingPaths(samplePaths)
  if (missing.length > 0) {
    console.error(`Missing benchmark sample${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}`)
    console.error('Place local PDFs under data/ or pass explicit sample paths; data/ is intentionally git-ignored.')
    process.exitCode = 1
    return
  }

  console.log(`pdf.js comparison benchmark: runs=${runs}, pages=${maxPages > 0 ? maxPages : 'all'}, scale=${scale}, embeddedFonts=${useEmbeddedFonts}`)

  let failed = false
  for (const samplePath of samplePaths) {
    const absolutePath = resolve(samplePath)
    console.log('')
    console.log(basename(samplePath))

    if (includeRender) {
      const rebookRender = await averageWorkers('rebook', 'render', absolutePath, runs)
      const pdfjsRender = await averageWorkers('pdfjs', 'render', absolutePath, runs)
      const speedup = printComparison('whole render', rebookRender, pdfjsRender)
      if (!rebookRender.ok || !pdfjsRender.ok || rebookRender.failures.length > 0 || pdfjsRender.failures.length > 0 || speedup < minRenderSpeedup) {
        failed = true
      }
      console.log(`    target: >=${minRenderSpeedup.toFixed(2)}x ${speedup >= minRenderSpeedup ? 'OK' : 'BELOW TARGET'}`)
    }

    if (includeText) {
      const rebookText = await averageWorkers('rebook', 'text', absolutePath, runs)
      const pdfjsText = await averageWorkers('pdfjs', 'text', absolutePath, runs)
      printComparison('text', rebookText, pdfjsText)
    }

    if (includeDisplayList) {
      const rebookDisplay = await averageWorkers('rebook', 'display-list', absolutePath, runs)
      const pdfjsOperators = await averageWorkers('pdfjs', 'display-list', absolutePath, runs)
      printComparison('display/operator list', rebookDisplay, pdfjsOperators)
    }
  }

  if (failed) process.exitCode = 1
}

async function runRebook(path, mode) {
  const bytes = await readPdfBytes(path)
  const input = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)

  if (mode === 'render') {
    const [{ createCanvas }, { RebookPdfDocument }, { nodeRuntime }, { createNodeCanvasRenderer }] = await Promise.all([
      import('@napi-rs/canvas'),
      import('../dist/pdf/document.js'),
      import('../dist/pdf/runtime/node.js'),
      import('../dist/pdf/paint/node-canvas.js'),
    ])
    const start = performance.now()
    const document = await RebookPdfDocument.load(input, {
      runtime: nodeRuntime,
      cache: true,
      embeddedFonts: useEmbeddedFonts,
    })
    const renderer = createNodeCanvasRenderer()
    const target = { canvas: createCanvas(1, 1) }
    const pageCount = selectedPageCount(document.pageCount)
    let ops = 0
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
      const result = await renderer.renderPageToCanvas({ document, runtime: nodeRuntime }, { pageIndex, scale }, target)
      ops += result.ops
    }
    return {
      ms: performance.now() - start,
      pages: pageCount,
      totalPages: document.pageCount,
      chars: 0,
      items: ops,
      failures: [],
    }
  }

  if (mode === 'text') {
    const [{ RebookPdfDocument }, { nodeRuntime }] = await Promise.all([
      import('../dist/pdf/document.js'),
      import('../dist/pdf/runtime/node.js'),
    ])
    const start = performance.now()
    const document = await RebookPdfDocument.load(input, {
      runtime: nodeRuntime,
      cache: true,
      embeddedFonts: useEmbeddedFonts,
    })
    const pageCount = selectedPageCount(document.pageCount)
    let chars = 0
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
      const text = await document.getPageText(pageIndex)
      chars += text.text.length
    }
    return {
      ms: performance.now() - start,
      pages: pageCount,
      totalPages: document.pageCount,
      chars,
      items: 0,
      failures: [],
    }
  }

  if (mode === 'display-list') {
    const [{ RebookPdfDocument }, { nodeRuntime }] = await Promise.all([
      import('../dist/pdf/document.js'),
      import('../dist/pdf/runtime/node.js'),
    ])
    const start = performance.now()
    const document = await RebookPdfDocument.load(input, {
      runtime: nodeRuntime,
      embeddedFonts: useEmbeddedFonts,
    })
    const pageCount = selectedPageCount(document.pageCount)
    let ops = 0
    const failures = []
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
      try {
        const displayList = await document.getPageDisplayList(pageIndex)
        ops += displayList.ops.length
      } catch (error) {
        failures.push({
          page: pageIndex + 1,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }
    return {
      ms: performance.now() - start,
      pages: pageCount,
      totalPages: document.pageCount,
      chars: 0,
      items: ops,
      failures,
    }
  }

  throw new Error(`Unknown benchmark mode ${mode}`)
}

async function runPdfjs(path, mode) {
  const [{ createCanvas }, { getDocument }] = await Promise.all([
    mode === 'render' ? import('@napi-rs/canvas') : Promise.resolve({ createCanvas: undefined }),
    import('pdfjs-dist/legacy/build/pdf.mjs'),
  ])
  const standardFontDataUrl = fileURLToPath(new URL('../node_modules/pdfjs-dist/standard_fonts/', import.meta.url))
  const bytes = await readPdfBytes(path)
  const start = performance.now()
  const task = getDocument({
    data: new Uint8Array(bytes),
    disableWorker: true,
    isEvalSupported: false,
    standardFontDataUrl,
  })
  const document = await task.promise
  const pageCount = selectedPageCount(document.numPages)
  let chars = 0
  let items = 0
  const failures = []

  try {
    const canvas = mode === 'render' ? createCanvas(1, 1) : undefined
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      try {
        const page = await document.getPage(pageNumber)
        if (mode === 'render') {
          const viewport = page.getViewport({ scale })
          canvas.width = Math.ceil(viewport.width)
          canvas.height = Math.ceil(viewport.height)
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
        } else if (mode === 'text') {
          const text = await page.getTextContent()
          items += text.items.length
          chars += text.items.reduce((sum, item) => sum + (typeof item.str === 'string' ? item.str.length : 0), 0)
        } else if (mode === 'display-list') {
          const operatorList = await page.getOperatorList()
          items += operatorList.fnArray.length
        } else {
          throw new Error(`Unknown benchmark mode ${mode}`)
        }
        page.cleanup?.()
      } catch (error) {
        failures.push({
          page: pageNumber,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }
  } finally {
    document.cleanup?.()
    await task.destroy()
  }

  return {
    ms: performance.now() - start,
    pages: pageCount,
    totalPages: document.numPages,
    chars,
    items,
    failures,
  }
}

async function averageWorkers(engine, mode, samplePath, iterations) {
  const results = []
  for (let index = 0; index < iterations; index++) {
    const result = runWorker(engine, mode, samplePath)
    if (!result.ok) return result
    results.push(result)
  }
  return {
    ok: true,
    ms: average(results.map(result => result.ms)),
    pages: results[0]?.pages ?? 0,
    totalPages: results[0]?.totalPages ?? 0,
    chars: Math.round(average(results.map(result => result.chars))),
    items: Math.round(average(results.map(result => result.items))),
    failures: mergeFailures(results),
  }
}

function runWorker(engine, mode, samplePath) {
  const outputPath = `/tmp/rebook-pdfjs-${process.pid}-${engine}-${mode}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`
  const child = spawnSync(process.execPath, [
    '--max-old-space-size=2048',
    scriptPath,
    `--engine=${engine}`,
    `--mode=${mode}`,
    `--sample=${samplePath}`,
    `--scale=${scale}`,
    `--out=${outputPath}`,
    `--embedded-fonts=${useEmbeddedFonts ? '1' : '0'}`,
    ...(maxPages > 0 ? [`--pages=${maxPages}`] : []),
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  })

  const stderr = child.stderr ?? ''
  const stdout = child.stdout ?? ''
  if (child.status !== 0) {
    return {
      ok: false,
      error: `${engine} ${mode} exited with ${child.signal ? `signal ${child.signal}` : `code ${child.status}`}${stderr ? `: ${stderr.trim().split('\n').at(-1)}` : ''}`,
    }
  }

  try {
    return { ok: true, ...JSON.parse(readFileSync(outputPath, 'utf8')) }
  } catch (error) {
    return {
      ok: false,
      error: `${engine} ${mode} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}${stdout ? ` (${stdout.slice(0, 120)})` : ''}`,
    }
  } finally {
    void unlink(outputPath).catch(() => {})
  }
}

function printComparison(label, rebook, pdfjs) {
  console.log(`  ${label}`)
  console.log(`    rebook: ${resultLine(rebook, label)}`)
  console.log(`    pdf.js: ${resultLine(pdfjs, label)}`)
  const speedup = rebook.ok && pdfjs.ok && rebook.failures.length === 0 && pdfjs.failures.length === 0 && rebook.ms > 0
    ? pdfjs.ms / rebook.ms
    : 0
  console.log(`    speedup: ${speedup > 0 ? speedup.toFixed(2) : 'n/a'}x`)
  return speedup
}

function resultLine(result, label) {
  if (!result.ok) return `failed (${result.error})`
  const parts = [
    `${formatMs(result.ms)} total`,
    `${formatMs(result.ms / Math.max(1, result.pages))} / page`,
    `${result.pages.toLocaleString('en-US')}${result.pages === result.totalPages ? '' : ` / ${result.totalPages.toLocaleString('en-US')}`} pages`,
  ]
  if (label === 'text') parts.push(`${result.chars.toLocaleString('en-US')} chars`)
  else parts.push(`${result.items.toLocaleString('en-US')} ops`)
  if (result.failures.length > 0) {
    const first = result.failures[0]
    parts.push(`${result.failures.length} failed page${result.failures.length === 1 ? '' : 's'}; first p${first.page}: ${first.message}`)
  }
  return parts.join(', ')
}

function selectedPageCount(totalPages) {
  return maxPages > 0 ? Math.min(maxPages, totalPages) : totalPages
}

async function readPdfBytes(path) {
  const bytes = await readFile(path)
  return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

function positionalArgs() {
  return process.argv.slice(2).filter(arg => !arg.startsWith('--'))
}

function stringArg(name) {
  const prefix = `--${name}=`
  return process.argv.find(arg => arg.startsWith(prefix))?.slice(prefix.length)
}

function numberArg(name, fallback) {
  const raw = stringArg(name)
  const value = raw ? Number(raw) : fallback
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

function booleanArg(name, fallback) {
  if (process.argv.includes(`--${name}`)) return true
  const raw = stringArg(name)
  if (raw === undefined) return fallback
  return raw !== 'false' && raw !== '0'
}

async function missingPaths(paths) {
  const entries = await Promise.all(paths.map(async path => {
    try {
      await stat(path)
      return undefined
    } catch {
      return path
    }
  }))
  return entries.filter(Boolean)
}

function average(values) {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function mergeFailures(results) {
  const seen = new Map()
  for (const result of results) {
    for (const failure of result.failures ?? []) {
      seen.set(`${failure.page}:${failure.message}`, failure)
    }
  }
  return Array.from(seen.values())
}

function formatMs(value) {
  return `${value.toFixed(1)} ms`
}
