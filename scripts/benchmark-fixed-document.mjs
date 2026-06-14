import { performance } from 'node:perf_hooks'
import { access, readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import {
  createFixedPageViewport,
  isFixedDocument,
} from '../dist/core/fixed-document.js'
import {
  createRendererRouter,
  matchesFixedDocument,
  matchesReflowableBook,
} from '../dist/core/renderer-router.js'
import { PDFParser } from '../dist/parsers/pdf.js'

const pages = integerArg('pages', 20_000)
const maxMs = numberArg('max-ms', 1_000)
const pdfPages = integerArg('pdf-pages', 500)
const maxPdfMs = numberArg('max-pdf-ms', 1_500)
const realPdfPath = stringArg('real-pdf') ?? stringArg('pdf') ?? 'data/四千周.pdf'
const realPdfPages = nonNegativeIntegerArg('real-pdf-pages', 0)
const maxRealPdfMs = numberArg('max-real-pdf-ms', 3_000)

class BenchmarkRenderer {
  async open() {}
  async goTo() {}
  async next() {}
  async prev() {}
  async goToFraction() {}
  setStyles() {}
  setLayout() {}
  setSpread() {}
  setMark() {}
  removeMark() {}
  clearMarks() {}
  getMarks() { return [] }
  getLocation() { return null }
  getSectionFractions() { return [] }
  async refresh() {}
  on() {}
  off() {}
  destroy() {}
}

const document = {
  kind: 'fixed-document',
  format: 'pdf',
  pageCount: pages,
  getPage(pageIndex) {
    return {
      index: pageIndex,
      width: pageIndex % 2 === 0 ? 595 : 612,
      height: pageIndex % 2 === 0 ? 842 : 792,
      rotation: pageIndex % 4 === 0 ? 90 : 0,
    }
  },
}
const book = {
  sections: [],
  rendition: { layout: 'pre-paginated' },
  fixedDocument: document,
}

if (!isFixedDocument(document)) {
  throw new Error('benchmark fixture is not recognized as a fixed document')
}

const router = createRendererRouter([
  { id: 'fixed', match: matchesFixedDocument, createRenderer: () => new BenchmarkRenderer() },
  { id: 'flow', match: matchesReflowableBook, createRenderer: () => new BenchmarkRenderer() },
])

const start = performance.now()
await router.open(book)
for (let index = 0; index < pages; index++) {
  const page = document.getPage(index)
  createFixedPageViewport(page, {
    scale: 1 + (index % 3) * 0.25,
    devicePixelRatio: index % 2 === 0 ? 2 : 1,
  })
}
const elapsed = performance.now() - start
const pagesPerSecond = pages / (elapsed / 1000)
const ok = elapsed <= maxMs

console.log(`fixed-document viewport benchmark: ${pages.toLocaleString('en-US')} pages in ${elapsed.toFixed(1)} ms`)
console.log(`throughput: ${Math.round(pagesPerSecond).toLocaleString('en-US')} pages/s`)
console.log(`limit: ${maxMs.toFixed(1)} ms ${ok ? 'OK' : 'OVER LIMIT'}`)

if (!ok) process.exitCode = 1

const pdfBytes = makeBenchmarkPdf(pdfPages)
const parser = new PDFParser()
const pdfStart = performance.now()
const parsed = await parser.parse(pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength))
let textLength = 0
for (let index = 0; index < parsed.fixedDocument.pageCount; index++) {
  const text = await parsed.fixedDocument.getPageText(index)
  textLength += text.text.length
}
const pdfElapsed = performance.now() - pdfStart
const pdfOk = pdfElapsed <= maxPdfMs

console.log(`pdf parse/text benchmark: ${pdfPages.toLocaleString('en-US')} pages in ${pdfElapsed.toFixed(1)} ms`)
console.log(`pdf text: ${textLength.toLocaleString('en-US')} chars`)
console.log(`pdf limit: ${maxPdfMs.toFixed(1)} ms ${pdfOk ? 'OK' : 'OVER LIMIT'}`)

if (!pdfOk) process.exitCode = 1

await runRealPdfBenchmark()

async function runRealPdfBenchmark() {
  if (!await fileExists(realPdfPath)) {
    console.log(`real PDF parse/text benchmark: skipped; ${realPdfPath} not found`)
    console.log('place local PDFs under data/ or pass --real-pdf=<path>; data/ is intentionally git-ignored')
    return
  }

  const bytes = await readFile(realPdfPath)
  const parser = new PDFParser()
  const realPdfStart = performance.now()
  const parsed = await parser.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
  const totalPages = parsed.fixedDocument.pageCount
  const measuredPages = realPdfPages > 0 ? Math.min(realPdfPages, totalPages) : totalPages
  let textLength = 0
  for (let index = 0; index < measuredPages; index++) {
    const text = await parsed.fixedDocument.getPageText(index)
    textLength += text.text.length
  }
  const realPdfElapsed = performance.now() - realPdfStart
  const realPdfOk = realPdfElapsed <= maxRealPdfMs
  const pageLabel = measuredPages === totalPages
    ? `${totalPages.toLocaleString('en-US')} pages`
    : `${measuredPages.toLocaleString('en-US')} / ${totalPages.toLocaleString('en-US')} pages`

  console.log(`real PDF parse/text benchmark: ${basename(realPdfPath)} ${pageLabel} in ${realPdfElapsed.toFixed(1)} ms`)
  console.log(`real PDF text: ${textLength.toLocaleString('en-US')} chars`)
  console.log(`real PDF limit: ${maxRealPdfMs.toFixed(1)} ms ${realPdfOk ? 'OK' : 'OVER LIMIT'}`)

  if (!realPdfOk) process.exitCode = 1
}

function makeBenchmarkPdf(pageCount) {
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    `2 0 obj\n<< /Type /Pages /MediaBox [0 0 300 144] /Resources << /Font << /F1 3 0 R >> >> /Kids [${Array.from({ length: pageCount }, (_, index) => `${4 + index * 2} 0 R`).join(' ')}] /Count ${pageCount} >>\nendobj\n`,
    '3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ]
  for (let index = 0; index < pageCount; index++) {
    const pageObject = 4 + index * 2
    const contentObject = pageObject + 1
    objects.push(`${pageObject} 0 obj\n<< /Type /Page /Parent 2 0 R /Contents ${contentObject} 0 R >>\nendobj\n`)
    objects.push(makeContentStream(contentObject, `BT /F1 12 Tf 48 96 Td (Benchmark PDF page ${index + 1}) Tj ET`))
  }
  return buildClassicXrefPdf(objects)
}

function makeContentStream(objectNumber, content) {
  const bytes = new TextEncoder().encode(content)
  return `${objectNumber} 0 obj\n<< /Length ${bytes.byteLength} >>\nstream\n${content}\nendstream\nendobj\n`
}

function buildClassicXrefPdf(objects) {
  let source = '%PDF-1.7\n'
  const offsets = [0]
  for (const object of objects) {
    offsets.push(source.length)
    source += object
  }
  const xrefOffset = source.length
  source += `xref\n0 ${objects.length + 1}\n`
  source += '0000000000 65535 f \n'
  for (const offset of offsets.slice(1)) {
    source += `${String(offset).padStart(10, '0')} 00000 n \n`
  }
  source += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  return new TextEncoder().encode(source)
}

function integerArg(name, fallback) {
  return Math.max(1, Math.trunc(numberArg(name, fallback)))
}

function nonNegativeIntegerArg(name, fallback) {
  return Math.max(0, Math.trunc(numberArg(name, fallback)))
}

function numberArg(name, fallback) {
  const prefix = `--${name}=`
  const raw = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length)
  const value = raw ? Number(raw) : fallback
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function stringArg(name) {
  const prefix = `--${name}=`
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length)
}

async function fileExists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}
