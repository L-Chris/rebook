import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { build } from 'vite'

const out = 'miniprogram_dist'
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

await build({
  configFile: false,
  logLevel: 'info',
  build: {
    emptyOutDir: false,
    outDir: out,
    target: 'es2018',
    minify: false,
    lib: {
      entry: resolve('src/miniprogram.ts'),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
})

function writeStub(file, exports) {
  mkdirSync(`${out}/${dirname(file)}`, { recursive: true })
  writeFileSync(`${out}/${file}`, `${exports}\n`)
}

writeStub('core/parser.js', "export { registry } from '../index.js'")
writeStub('parsers/epub.js', "export { epub, EPUBParser } from '../index.js'")
writeStub('parsers/cbz.js', "export { cbz, CBZParser } from '../index.js'")
writeStub('parsers/fb2.js', "export { fb2, FB2Parser } from '../index.js'")
writeStub('parsers/mobi.js', "export { mobi, MOBIParser } from '../index.js'")
writeStub(
  'renderers/wechat-miniprogram.js',
  "export { createWechatMiniProgramRenderer, WechatMiniProgramRenderer } from '../index.js'",
)
writeStub(
  'adapters/wechat-miniprogram.js',
  "export { WechatMiniProgramDOMAdapter, WechatMiniProgramURLFactory } from '../index.js'",
)
writeStub(
  'plugins/index.js',
  "export { withTrialLimit, estimateBookPageCount, estimateTrialLimitState } from '../index.js'",
)
writeStub(
  'plugins/trial-limit.js',
  "export { withTrialLimit, estimateBookPageCount, estimateTrialLimitState } from '../index.js'",
)

writeFileSync(
  `${out}/package.json`,
  JSON.stringify({
    name: 'rebook',
    version: packageJson.version,
    type: 'module',
    main: 'index.js',
  }, null, 2) + '\n',
)
