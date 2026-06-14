import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const outPath = resolve(stringArg('out') ?? 'dist/fixed-painter-benchmark.html')
const pages = Math.max(1, Math.trunc(numberArg('pages', 80)))
const width = Math.max(1, Math.trunc(numberArg('width', 900)))
const height = Math.max(1, Math.trunc(numberArg('height', 1280)))

await mkdir(dirname(outPath), { recursive: true })
await writeFile(outPath, createBenchmarkHtml({ pages, width, height }))

console.log(`fixed painter benchmark written to ${outPath}`)
console.log('Open this file in a WebGPU-capable browser to compare Canvas2D and WebGPU painter timings.')

function createBenchmarkHtml(options) {
  const data = JSON.stringify(options)
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Rebook Fixed Painter Benchmark</title>
  <style>
    body { font: 14px system-ui, sans-serif; margin: 24px; color: #111; }
    #viewport { width: 720px; height: 900px; border: 1px solid #ccc; overflow: hidden; }
    pre { white-space: pre-wrap; line-height: 1.5; }
  </style>
</head>
<body>
  <h1>Rebook Fixed Painter Benchmark</h1>
  <div id="viewport"></div>
  <pre id="output">Running...</pre>
  <script type="module">
    import { createReader } from './renderers/browser.js'

    const options = ${data}
    const output = document.getElementById('output')
    const viewport = document.getElementById('viewport')

    const book = createImageBook(options.pages, options.width, options.height)
    const results = []
    for (const painter of ['canvas', 'webgpu']) {
      results.push(await runBenchmark(painter, book, viewport, options.pages))
    }
    output.textContent = results.map(formatResult).join('\\n')

    async function runBenchmark(fixedPainter, book, container, pageCount) {
      container.replaceChildren()
      const reader = createReader({
        container,
        fixedPainter,
        styles: { margin: 0, maxColumnWidth: '720px' },
      })
      const start = performance.now()
      await reader.openBook(book)
      for (let index = 1; index < pageCount; index++) {
        await reader.goTo(index)
      }
      const ms = performance.now() - start
      const paint = reader.getCurrentSurface()?.metadata?.paint
      reader.destroy()
      return {
        requested: fixedPainter,
        actual: paint?.backend ?? 'none',
        pages: pageCount,
        ms,
        perPage: ms / pageCount,
        supported: fixedPainter !== 'webgpu' || Boolean(navigator.gpu),
      }
    }

    function createImageBook(pageCount, width, height) {
      const src = createSvgDataUri(width, height)
      return {
        sections: [],
        fixedDocument: {
          kind: 'fixed-document',
          format: 'image-sequence',
          pageCount,
          getPage: pageIndex => ({ index: pageIndex, width, height, label: String(pageIndex + 1) }),
          getPages: () => Array.from({ length: pageCount }, (_, index) => ({ index, width, height, label: String(index + 1) })),
          getPageImage: pageIndex => ({ pageIndex, width, height, src, mimeType: 'image/svg+xml', alt: 'benchmark page' }),
        },
      }
    }

    function createSvgDataUri(width, height) {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">' +
        '<defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#f7f7f7"/><stop offset="1" stop-color="#dbeafe"/></linearGradient></defs>' +
        '<rect width="100%" height="100%" fill="url(#g)"/>' +
        '<g fill="#111" font-family="serif" font-size="28">' +
        Array.from({ length: 34 }, (_, i) => '<text x="72" y="' + (96 + i * 32) + '">Fixed painter benchmark line ' + (i + 1) + '</text>').join('') +
        '</g></svg>'
      return 'data:image/svg+xml;base64,' + btoa(svg)
    }

    function formatResult(result) {
      const support = result.supported ? '' : ' (WebGPU unavailable; fallback expected)'
      return result.requested + ' -> ' + result.actual + support + ': ' +
        result.ms.toFixed(1) + ' ms total, ' + result.perPage.toFixed(2) + ' ms/page over ' + result.pages + ' pages'
    }
  </script>
</body>
</html>`
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
