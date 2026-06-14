import { performance } from 'node:perf_hooks'
import {
  createFixedPageViewport,
  isFixedDocument,
} from '../dist/core/fixed-document.js'
import {
  createRendererRouter,
  matchesFixedDocument,
  matchesReflowableBook,
} from '../dist/core/renderer-router.js'

const pages = integerArg('pages', 20_000)
const maxMs = numberArg('max-ms', 1_000)

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

function integerArg(name, fallback) {
  return Math.max(1, Math.trunc(numberArg(name, fallback)))
}

function numberArg(name, fallback) {
  const prefix = `--${name}=`
  const raw = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length)
  const value = raw ? Number(raw) : fallback
  return Number.isFinite(value) && value > 0 ? value : fallback
}
