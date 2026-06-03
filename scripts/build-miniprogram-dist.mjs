import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { build } from 'vite'

const out = 'miniprogram_dist'
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const textCodecPolyfill = `;(function(global){
  if (typeof global.TextEncoder === 'undefined') {
    global.TextEncoder = function TextEncoder(){ this.encoding = 'utf-8' }
    global.TextEncoder.prototype.encode = function(value){
      var input = String(value)
      var bytes = []
      for (var i = 0; i < input.length; i++) {
        var code = input.charCodeAt(i)
        if (code >= 0xd800 && code <= 0xdbff && i + 1 < input.length) {
          var next = input.charCodeAt(i + 1)
          if (next >= 0xdc00 && next <= 0xdfff) {
            code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00)
            i++
          }
        }
        if (code <= 0x7f) {
          bytes.push(code)
        } else if (code <= 0x7ff) {
          bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
        } else if (code <= 0xffff) {
          bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
        } else {
          bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
        }
      }
      return new Uint8Array(bytes)
    }
  }
  if (typeof global.TextDecoder === 'undefined') {
    var windows1252 = {
      128: 0x20ac, 130: 0x201a, 131: 0x0192, 132: 0x201e, 133: 0x2026,
      134: 0x2020, 135: 0x2021, 136: 0x02c6, 137: 0x2030, 138: 0x0160,
      139: 0x2039, 140: 0x0152, 142: 0x017d, 145: 0x2018, 146: 0x2019,
      147: 0x201c, 148: 0x201d, 149: 0x2022, 150: 0x2013, 151: 0x2014,
      152: 0x02dc, 153: 0x2122, 154: 0x0161, 155: 0x203a, 156: 0x0153,
      158: 0x017e, 159: 0x0178
    }
    global.TextDecoder = function TextDecoder(label){
      this.encoding = String(label || 'utf-8').toLowerCase()
    }
    global.TextDecoder.prototype.decode = function(input){
      var bytes = input == null
        ? new Uint8Array(0)
        : input instanceof Uint8Array
          ? input
          : input.buffer instanceof ArrayBuffer
            ? new Uint8Array(input.buffer, input.byteOffset || 0, input.byteLength)
            : new Uint8Array(input)
      if (this.encoding === 'windows-1252' || this.encoding === 'latin1' || this.encoding === 'iso-8859-1') {
        var out = ''
        for (var i = 0; i < bytes.length; i++) {
          var byte = bytes[i]
          out += String.fromCharCode(windows1252[byte] || byte)
        }
        return out
      }
      var result = ''
      for (var j = 0; j < bytes.length;) {
        var b1 = bytes[j++]
        var code = b1
        if (b1 >= 0xc2 && b1 <= 0xdf && j < bytes.length) {
          code = ((b1 & 0x1f) << 6) | (bytes[j++] & 0x3f)
        } else if (b1 >= 0xe0 && b1 <= 0xef && j + 1 < bytes.length) {
          code = ((b1 & 0x0f) << 12) | ((bytes[j++] & 0x3f) << 6) | (bytes[j++] & 0x3f)
        } else if (b1 >= 0xf0 && b1 <= 0xf4 && j + 2 < bytes.length) {
          code = ((b1 & 0x07) << 18) | ((bytes[j++] & 0x3f) << 12) | ((bytes[j++] & 0x3f) << 6) | (bytes[j++] & 0x3f)
        }
        if (code <= 0xffff) {
          result += String.fromCharCode(code)
        } else {
          code -= 0x10000
          result += String.fromCharCode(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff))
        }
      }
      return result
    }
  }
  if (typeof global.Intl === 'undefined') global.Intl = {}
  if (typeof global.Intl.Segmenter === 'undefined') {
    var isHighSurrogate = function(code){ return code >= 0xd800 && code <= 0xdbff }
    var isLowSurrogate = function(code){ return code >= 0xdc00 && code <= 0xdfff }
    var codePointLengthAt = function(input, index){
      var first = input.charCodeAt(index)
      if (isHighSurrogate(first) && index + 1 < input.length && isLowSurrogate(input.charCodeAt(index + 1))) return 2
      return 1
    }
    var codePointAt = function(input, index){
      var first = input.charCodeAt(index)
      if (isHighSurrogate(first) && index + 1 < input.length) {
        var second = input.charCodeAt(index + 1)
        if (isLowSurrogate(second)) return 0x10000 + ((first - 0xd800) << 10) + (second - 0xdc00)
      }
      return first
    }
    var charKind = function(input, index){
      var code = codePointAt(input, index)
      if (code === 9 || code === 10 || code === 13 || code === 32 || code === 0xa0) return 'space'
      if (
        code >= 0x4e00 && code <= 0x9fff ||
        code >= 0x3400 && code <= 0x4dbf ||
        code >= 0x3040 && code <= 0x30ff ||
        code >= 0xac00 && code <= 0xd7af
      ) return 'cjk'
      if (
        code >= 48 && code <= 57 ||
        code >= 65 && code <= 90 ||
        code >= 97 && code <= 122 ||
        code >= 0xc0 && code <= 0x024f
      ) return 'word'
      return 'punct'
    }
    var makeSegment = function(segment, index, isWordLike){
      return { segment: segment, index: index, input: undefined, isWordLike: isWordLike }
    }
    global.Intl.Segmenter = function Segmenter(locale, options){
      this.locale = locale
      this.granularity = options && options.granularity || 'grapheme'
    }
    global.Intl.Segmenter.prototype.segment = function(value){
      var input = String(value)
      var segments = []
      if (this.granularity === 'word') {
        for (var i = 0; i < input.length;) {
          var start = i
          var kind = charKind(input, i)
          var firstLen = codePointLengthAt(input, i)
          if (kind === 'cjk') {
            i += firstLen
          } else {
            i += firstLen
            while (i < input.length) {
              var nextKind = charKind(input, i)
              if (nextKind !== kind || nextKind === 'cjk') break
              i += codePointLengthAt(input, i)
            }
          }
          segments.push(makeSegment(input.slice(start, i), start, kind === 'word' || kind === 'cjk'))
        }
      } else {
        for (var j = 0; j < input.length;) {
          var length = codePointLengthAt(input, j)
          segments.push(makeSegment(input.slice(j, j + length), j, true))
          j += length
        }
      }
      segments.containing = function(index){
        for (var k = 0; k < segments.length; k++) {
          var item = segments[k]
          if (index >= item.index && index < item.index + item.segment.length) return item
        }
        return segments[segments.length - 1]
      }
      return segments
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);`

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
        banner: textCodecPolyfill,
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

writeFileSync(
  `${out}/package.json`,
  JSON.stringify({
    name: 'rebook',
    version: packageJson.version,
    type: 'module',
    main: 'index.js',
  }, null, 2) + '\n',
)
