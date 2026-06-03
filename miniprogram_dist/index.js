var __defProp = Object.defineProperty;
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __defNormalProp = (obj, key, value2) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value: value2 }) : obj[key] = value2;
var __publicField = (obj, key, value2) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value2);
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value2) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value2);
var __privateSet = (obj, member, value2, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value2) : member.set(obj, value2), value2);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);
var __privateWrapper = (obj, member, setter, getter) => ({
  set _(value2) {
    __privateSet(obj, member, value2, setter);
  },
  get _() {
    return __privateGet(obj, member, getter);
  }
});
var _start, _resourceStart, _decoder, _encoder, _decompress, _removeTrailingEntries, _pdb, _MOBI_instances, getHeaders_fn, setup_fn, _mobi, _domAdapter, _urlFactory, _resourceCache, _textCache, _cache, _sections, _fileposList, _urls, _MOBI6_instances, createURL_fn, revokeURL_fn, _mobi2, _domAdapter2, _urlFactory2, _cache2, _fragmentOffsets, _fragmentSelectors, _tables, _sections2, _sectionIndexMap, _fullRawLength, _rawHead, _rawTail, _lastLoadedHead, _lastLoadedTail, _type, _urls2, _KF8_instances, setFragmentSelector_fn, createURL_fn2, revokeURL_fn2;
;
(function(global) {
  if (typeof global.TextEncoder === "undefined") {
    global.TextEncoder = function TextEncoder2() {
      this.encoding = "utf-8";
    };
    global.TextEncoder.prototype.encode = function(value2) {
      var input = String(value2);
      var bytes = [];
      for (var i = 0; i < input.length; i++) {
        var code2 = input.charCodeAt(i);
        if (code2 >= 55296 && code2 <= 56319 && i + 1 < input.length) {
          var next = input.charCodeAt(i + 1);
          if (next >= 56320 && next <= 57343) {
            code2 = 65536 + (code2 - 55296 << 10) + (next - 56320);
            i++;
          }
        }
        if (code2 <= 127) {
          bytes.push(code2);
        } else if (code2 <= 2047) {
          bytes.push(192 | code2 >> 6, 128 | code2 & 63);
        } else if (code2 <= 65535) {
          bytes.push(224 | code2 >> 12, 128 | code2 >> 6 & 63, 128 | code2 & 63);
        } else {
          bytes.push(240 | code2 >> 18, 128 | code2 >> 12 & 63, 128 | code2 >> 6 & 63, 128 | code2 & 63);
        }
      }
      return new Uint8Array(bytes);
    };
  }
  if (typeof global.TextDecoder === "undefined") {
    var windows1252 = {
      128: 8364,
      130: 8218,
      131: 402,
      132: 8222,
      133: 8230,
      134: 8224,
      135: 8225,
      136: 710,
      137: 8240,
      138: 352,
      139: 8249,
      140: 338,
      142: 381,
      145: 8216,
      146: 8217,
      147: 8220,
      148: 8221,
      149: 8226,
      150: 8211,
      151: 8212,
      152: 732,
      153: 8482,
      154: 353,
      155: 8250,
      156: 339,
      158: 382,
      159: 376
    };
    global.TextDecoder = function TextDecoder2(label) {
      this.encoding = String(label || "utf-8").toLowerCase();
    };
    global.TextDecoder.prototype.decode = function(input) {
      var bytes = input == null ? new Uint8Array(0) : input instanceof Uint8Array ? input : input.buffer instanceof ArrayBuffer ? new Uint8Array(input.buffer, input.byteOffset || 0, input.byteLength) : new Uint8Array(input);
      if (this.encoding === "windows-1252" || this.encoding === "latin1" || this.encoding === "iso-8859-1") {
        var out = "";
        for (var i = 0; i < bytes.length; i++) {
          var byte = bytes[i];
          out += String.fromCharCode(windows1252[byte] || byte);
        }
        return out;
      }
      var result = "";
      for (var j = 0; j < bytes.length; ) {
        var b1 = bytes[j++];
        var code2 = b1;
        if (b1 >= 194 && b1 <= 223 && j < bytes.length) {
          code2 = (b1 & 31) << 6 | bytes[j++] & 63;
        } else if (b1 >= 224 && b1 <= 239 && j + 1 < bytes.length) {
          code2 = (b1 & 15) << 12 | (bytes[j++] & 63) << 6 | bytes[j++] & 63;
        } else if (b1 >= 240 && b1 <= 244 && j + 2 < bytes.length) {
          code2 = (b1 & 7) << 18 | (bytes[j++] & 63) << 12 | (bytes[j++] & 63) << 6 | bytes[j++] & 63;
        }
        if (code2 <= 65535) {
          result += String.fromCharCode(code2);
        } else {
          code2 -= 65536;
          result += String.fromCharCode(55296 + (code2 >> 10), 56320 + (code2 & 1023));
        }
      }
      return result;
    };
  }
  if (typeof global.Intl === "undefined") global.Intl = {};
  if (typeof global.Intl.Segmenter === "undefined") {
    var isHighSurrogate = function(code2) {
      return code2 >= 55296 && code2 <= 56319;
    };
    var isLowSurrogate = function(code2) {
      return code2 >= 56320 && code2 <= 57343;
    };
    var codePointLengthAt = function(input, index) {
      var first = input.charCodeAt(index);
      if (isHighSurrogate(first) && index + 1 < input.length && isLowSurrogate(input.charCodeAt(index + 1))) return 2;
      return 1;
    };
    var codePointAt = function(input, index) {
      var first = input.charCodeAt(index);
      if (isHighSurrogate(first) && index + 1 < input.length) {
        var second = input.charCodeAt(index + 1);
        if (isLowSurrogate(second)) return 65536 + (first - 55296 << 10) + (second - 56320);
      }
      return first;
    };
    var charKind = function(input, index) {
      var code2 = codePointAt(input, index);
      if (code2 === 9 || code2 === 10 || code2 === 13 || code2 === 32 || code2 === 160) return "space";
      if (code2 >= 19968 && code2 <= 40959 || code2 >= 13312 && code2 <= 19903 || code2 >= 12352 && code2 <= 12543 || code2 >= 44032 && code2 <= 55215) return "cjk";
      if (code2 >= 48 && code2 <= 57 || code2 >= 65 && code2 <= 90 || code2 >= 97 && code2 <= 122 || code2 >= 192 && code2 <= 591) return "word";
      return "punct";
    };
    var makeSegment = function(segment, index, isWordLike) {
      return { segment, index, input: void 0, isWordLike };
    };
    global.Intl.Segmenter = function Segmenter(locale, options) {
      this.locale = locale;
      this.granularity = options && options.granularity || "grapheme";
    };
    global.Intl.Segmenter.prototype.segment = function(value2) {
      var input = String(value2);
      var segments = [];
      if (this.granularity === "word") {
        for (var i = 0; i < input.length; ) {
          var start = i;
          var kind = charKind(input, i);
          var firstLen = codePointLengthAt(input, i);
          if (kind === "cjk") {
            i += firstLen;
          } else {
            i += firstLen;
            while (i < input.length) {
              var nextKind = charKind(input, i);
              if (nextKind !== kind || nextKind === "cjk") break;
              i += codePointLengthAt(input, i);
            }
          }
          segments.push(makeSegment(input.slice(start, i), start, kind === "word" || kind === "cjk"));
        }
      } else {
        for (var j = 0; j < input.length; ) {
          var length2 = codePointLengthAt(input, j);
          segments.push(makeSegment(input.slice(j, j + length2), j, true));
          j += length2;
        }
      }
      segments.containing = function(index) {
        for (var k = 0; k < segments.length; k++) {
          var item = segments[k];
          if (index >= item.index && index < item.index + item.segment.length) return item;
        }
        return segments[segments.length - 1];
      };
      return segments;
    };
  }
})(typeof globalThis !== "undefined" ? globalThis : void 0);
class EBookError extends Error {
  constructor(message, code2) {
    super(message);
    this.code = code2;
    this.name = "EBookError";
  }
}
class ParseError extends EBookError {
  constructor(message, format) {
    super(message, "PARSE_ERROR");
    this.format = format;
    this.name = "ParseError";
  }
}
class UnsupportedFormatError extends EBookError {
  constructor(message = "Unsupported file format") {
    super(message, "UNSUPPORTED_FORMAT");
    this.name = "UnsupportedFormatError";
  }
}
class CorruptedFileError extends EBookError {
  constructor(message, format) {
    super(message, "CORRUPTED_FILE");
    this.format = format;
    this.name = "CorruptedFileError";
  }
}
class AdapterRequiredError extends EBookError {
  constructor(adapter) {
    super(`${adapter} is required but was not provided in ParserOptions`, "ADAPTER_REQUIRED");
    this.name = "AdapterRequiredError";
  }
}
class UnsupportedInputError extends EBookError {
  constructor(message = "Input type not supported") {
    super(message, "UNSUPPORTED_INPUT");
    this.name = "UnsupportedInputError";
  }
}
class ParserRegistry {
  constructor() {
    __publicField(this, "parsers", /* @__PURE__ */ new Map());
  }
  /**
   * Register a parser with a name.
   * @param name - Parser name
   * @param factory - Factory function to create parser instances
   * @param priority - Detection priority (higher = checked first).
   *                   If not provided, uses parser.priority or defaults to 0.
   */
  register(name2, factory, priority) {
    var _a2;
    const effectivePriority = (_a2 = priority != null ? priority : factory().priority) != null ? _a2 : 0;
    this.parsers.set(name2, { factory, priority: effectivePriority });
  }
  /**
   * Unregister a parser.
   */
  unregister(name2) {
    this.parsers.delete(name2);
  }
  /**
   * Get a parser by name.
   */
  get(name2) {
    const entry = this.parsers.get(name2);
    return entry == null ? void 0 : entry.factory();
  }
  /**
   * Auto-detect the format and return a suitable parser.
   * Parsers are checked in priority order (highest first).
   */
  async detect(input) {
    const sorted = Array.from(this.parsers.entries()).sort(([, a], [, b]) => b.priority - a.priority);
    for (const [, { factory }] of sorted) {
      const parser = factory();
      if (await parser.canParse(input)) {
        return parser;
      }
    }
    return null;
  }
  /**
   * Auto-detect, parse, and return a Book.
   */
  async open(input, options) {
    const parser = await this.detect(input);
    if (!parser) {
      throw new UnsupportedFormatError();
    }
    return parser.parse(input, options);
  }
  /**
   * List all registered parser names.
   */
  list() {
    return Array.from(this.parsers.keys());
  }
}
const registry = new ParserRegistry();
const DEBUG_FLAG = "__REBOOK_DEBUG__";
function setRebookDebug(enabled) {
  globalThis[DEBUG_FLAG] = enabled;
}
function isRebookDebugEnabled() {
  return globalThis[DEBUG_FLAG] === true;
}
function debugRebook(scope2, message, details) {
  if (!isRebookDebugEnabled()) return;
  console.log(`[rebook:${scope2}] ${message}`, details != null ? details : {});
}
class ArrayBufferBlob {
  constructor(buffer, type = "", name2) {
    __publicField(this, "size");
    this.buffer = buffer;
    this.type = type;
    this.name = name2;
    this.size = buffer.byteLength;
  }
  slice(start = 0, end = this.size, contentType = this.type) {
    const normalizedStart = Math.max(0, start < 0 ? this.size + start : start);
    const normalizedEnd = Math.max(normalizedStart, Math.min(this.size, end < 0 ? this.size + end : end));
    return new ArrayBufferBlob(this.buffer.slice(normalizedStart, normalizedEnd), contentType);
  }
  async arrayBuffer() {
    return this.buffer.slice(0);
  }
  async text() {
    return new TextDecoder().decode(this.buffer);
  }
  stream() {
    if (typeof ReadableStream === "undefined") {
      throw new Error("ReadableStream is not available in this environment");
    }
    const bytes = new Uint8Array(this.buffer);
    return new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      }
    });
  }
}
function hasBlobConstructor() {
  return typeof Blob !== "undefined";
}
function isBlobLike$1(input) {
  return !!input && typeof input === "object" && typeof input.arrayBuffer === "function" && typeof input.slice === "function" && typeof input.size === "number";
}
function getInputName(input) {
  const name2 = input == null ? void 0 : input.name;
  return typeof name2 === "string" ? name2 : void 0;
}
function toBlobLike(input, type = "") {
  if (input instanceof ArrayBuffer) return new ArrayBufferBlob(input, type);
  if (isBlobLike$1(input)) return input;
  throw new TypeError("Expected ArrayBuffer or Blob-like input");
}
const LOCAL_FILE_HEADER_SIG = 67324752;
const LOCAL_HEADER_SIZE = 30;
const CENTRAL_DIR_SIG = 33639248;
const EOCD_MIN_SIZE = 22;
const DATA_DESCRIPTOR_SIG = 134695760;
async function readZipComment(blob) {
  const readSize = Math.min(blob.size, 22 + 65535);
  const start = blob.size - readSize;
  const buf = await blob.slice(start).arrayBuffer();
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);
  for (let i = buf.byteLength - 22; i >= 0; i--) {
    if (bytes[i] === 80 && bytes[i + 1] === 75 && bytes[i + 2] === 5 && bytes[i + 3] === 6) {
      const commentLength = view.getUint16(i + 20, true);
      if (commentLength === 0) return null;
      const commentBytes = buf.slice(i + 22, i + 22 + commentLength);
      return new TextDecoder().decode(commentBytes);
    }
  }
  return null;
}
async function buildLocalHeaderMap(blob) {
  const map = /* @__PURE__ */ new Map();
  const CHUNK = 256 * 1024;
  const size = blob.size;
  const positions = [];
  for (let start = 0; start < size; start += CHUNK - 3) {
    const end = Math.min(start + CHUNK, size);
    const buf = await blob.slice(start, end).arrayBuffer();
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length - 3; i++) {
      if (bytes[i] === 80 && bytes[i + 1] === 75 && bytes[i + 2] === 3 && bytes[i + 3] === 4) {
        positions.push(start + i);
      }
    }
  }
  for (const pos of positions) {
    if (pos + LOCAL_HEADER_SIZE > size) continue;
    const headerBuf = await blob.slice(pos, pos + LOCAL_HEADER_SIZE).arrayBuffer();
    const header = new DataView(headerBuf);
    if (header.getUint32(0, true) !== LOCAL_FILE_HEADER_SIG) continue;
    const uncompressedSize = header.getUint32(22, true);
    const fileNameLength = header.getUint16(26, true);
    if (fileNameLength === 0 || fileNameLength > 1024) continue;
    if (pos + LOCAL_HEADER_SIZE + fileNameLength > size) continue;
    const nameBuf = await blob.slice(pos + LOCAL_HEADER_SIZE, pos + LOCAL_HEADER_SIZE + fileNameLength).arrayBuffer();
    const filename = new TextDecoder().decode(nameBuf);
    if (!filename.includes("\0") && !/[�]/.test(filename)) {
      map.set(filename, { offset: pos, uncompressedSize });
    }
  }
  await applyCentralDirectoryMetadata(blob, map);
  return map;
}
async function applyCentralDirectoryMetadata(blob, localHeaderMap) {
  const readSize = Math.min(blob.size, EOCD_MIN_SIZE + 65535);
  const start = blob.size - readSize;
  const buf = await blob.slice(start).arrayBuffer();
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);
  let eocdOffset = -1;
  for (let i = buf.byteLength - EOCD_MIN_SIZE; i >= 0; i--) {
    if (bytes[i] === 80 && bytes[i + 1] === 75 && bytes[i + 2] === 5 && bytes[i + 3] === 6) {
      eocdOffset = start + i;
      break;
    }
  }
  if (eocdOffset < 0) return;
  const eocdLocalOffset = eocdOffset - start;
  const entryCount = view.getUint16(eocdLocalOffset + 10, true);
  const cdOffset = view.getUint32(eocdLocalOffset + 16, true);
  let pos = cdOffset;
  for (let i = 0; i < entryCount; i++) {
    if (pos + 46 > blob.size) break;
    const headerBuf = await blob.slice(pos, pos + 46).arrayBuffer();
    const header = new DataView(headerBuf);
    if (header.getUint32(0, true) !== CENTRAL_DIR_SIG) break;
    const uncompressedSize = header.getUint32(24, true);
    const fileNameLength = header.getUint16(28, true);
    const extraFieldLength = header.getUint16(30, true);
    const commentLength = header.getUint16(32, true);
    const localOffset = header.getUint32(42, true);
    const nameBuf = await blob.slice(pos + 46, pos + 46 + fileNameLength).arrayBuffer();
    const filename = new TextDecoder().decode(nameBuf);
    const existing = localHeaderMap.get(filename);
    if (existing) {
      existing.uncompressedSize = uncompressedSize;
    } else {
      localHeaderMap.set(filename, { offset: localOffset, uncompressedSize });
    }
    pos += 46 + fileNameLength + extraFieldLength + commentLength;
  }
}
function findNextLFHOffset(localHeaderMap, afterOffset) {
  let next = -1;
  for (const { offset } of localHeaderMap.values()) {
    if (offset > afterOffset && (next === -1 || offset < next)) {
      next = offset;
    }
  }
  return next;
}
async function extractDirectly(blob, localOffset, localHeaderMap) {
  const headerBuf = await blob.slice(localOffset, localOffset + LOCAL_HEADER_SIZE).arrayBuffer();
  const header = new DataView(headerBuf);
  if (header.getUint32(0, true) !== LOCAL_FILE_HEADER_SIG) {
    throw new CorruptedFileError("Local file header not found", "zip");
  }
  const compressionMethod = header.getUint16(8, true);
  let compressedSize = header.getUint32(18, true);
  const fileNameLength = header.getUint16(26, true);
  const extraFieldLength = header.getUint16(28, true);
  const dataStart = localOffset + LOCAL_HEADER_SIZE + fileNameLength + extraFieldLength;
  if (compressedSize === 0) {
    if (!localHeaderMap) {
      throw new CorruptedFileError("Cannot determine compressed size (data descriptor)", "zip");
    }
    const nextLFH = findNextLFHOffset(localHeaderMap, localOffset);
    const upperBound = nextLFH > 0 ? nextLFH : blob.size;
    const regionSize = upperBound - dataStart;
    if (regionSize <= 0) throw new CorruptedFileError("No data between headers", "zip");
    const regionBuf = await blob.slice(dataStart, upperBound).arrayBuffer();
    const regionView = new DataView(regionBuf);
    let found = false;
    for (let i = regionBuf.byteLength - 16; i >= 0; i--) {
      if (regionView.getUint32(i, true) === DATA_DESCRIPTOR_SIG) {
        const descCompSize = regionView.getUint32(i + 8, true);
        if (dataStart + descCompSize === localOffset + LOCAL_HEADER_SIZE + fileNameLength + extraFieldLength + descCompSize) {
          compressedSize = descCompSize;
          found = true;
          break;
        }
      }
    }
    if (!found) {
      for (let i = regionBuf.byteLength - 12; i >= 0; i--) {
        const descCompSize = regionView.getUint32(i + 4, true);
        if (dataStart + descCompSize + 12 === upperBound || dataStart + descCompSize + 16 === upperBound) {
          compressedSize = descCompSize;
          found = true;
          break;
        }
      }
    }
    if (!found) {
      compressedSize = regionSize;
    }
  }
  const compressedData = blob.slice(dataStart, dataStart + compressedSize);
  if (compressionMethod === 0) {
    return compressedData.arrayBuffer();
  }
  if (compressionMethod === 8) {
    if (compressedData.stream && typeof DecompressionStream !== "undefined" && typeof Response !== "undefined") {
      const stream = compressedData.stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return new Response(stream).arrayBuffer();
    }
    try {
      const fflate = await Promise.resolve().then(() => browser);
      const inflated = fflate.inflateSync(new Uint8Array(await compressedData.arrayBuffer()));
      return inflated.buffer.slice(inflated.byteOffset, inflated.byteOffset + inflated.byteLength);
    } catch (e) {
      throw new AdapterRequiredError("DecompressionStream API or fflate");
    }
  }
  throw new CorruptedFileError(`Unsupported compression method: ${compressionMethod}`, "zip");
}
function buildFallbackLoader(blob, localHeaderMap) {
  const filenames = [...localHeaderMap.keys()];
  const entries = filenames.map((filename) => {
    var _a2, _b2;
    return {
      filename,
      size: (_b2 = (_a2 = localHeaderMap.get(filename)) == null ? void 0 : _a2.uncompressedSize) != null ? _b2 : 0
    };
  });
  const loadText = async (filename) => {
    const entry = localHeaderMap.get(filename);
    if (!entry) return null;
    try {
      const buffer = await extractDirectly(blob, entry.offset, localHeaderMap);
      return new TextDecoder().decode(buffer);
    } catch (e) {
      return null;
    }
  };
  const loadBlob = async (filename, type) => {
    const entry = localHeaderMap.get(filename);
    if (!entry) return null;
    try {
      const buffer = await extractDirectly(blob, entry.offset, localHeaderMap);
      return createOutputBlob$1(buffer, type);
    } catch (e) {
      return null;
    }
  };
  const getSize = (filename) => {
    var _a2, _b2;
    return (_b2 = (_a2 = localHeaderMap.get(filename)) == null ? void 0 : _a2.uncompressedSize) != null ? _b2 : 0;
  };
  return { entries, loadText, loadBlob, getSize, getComment: () => readZipComment(blob) };
}
async function createZipLoader(input) {
  const blob = toBlobLike(input);
  const localHeaderMap = await buildLocalHeaderMap(blob);
  return buildFallbackLoader(blob, localHeaderMap);
}
async function isZipFile(input) {
  let buffer;
  const blob = toBlobLike(input);
  if (blob.size < 4) return false;
  buffer = await blob.slice(0, 4).arrayBuffer();
  const arr = new Uint8Array(buffer);
  return arr[0] === 80 && arr[1] === 75 && arr[2] === 3 && arr[3] === 4;
}
function createOutputBlob$1(buffer, type = "") {
  if (hasBlobConstructor()) return new Blob([buffer], { type });
  return new ArrayBufferBlob(buffer, type);
}
const normalizeWhitespace = (str) => str ? str.replace(/[\t\n\f\r ]+/g, " ").trim() : "";
const getElementText = (el) => normalizeWhitespace(el == null ? void 0 : el.textContent);
const cssEscape = (str) => str.replace(/([^\w-])/g, "\\$1");
const replaceSeries = async (str, regex, f) => {
  const matches = [];
  str.replace(regex, (...args) => (matches.push(args), null));
  const results = [];
  for (const args of matches) results.push(await f(...args));
  return str.replace(regex, () => results.shift());
};
const escapeHTML = (str) => str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const escapeAttr = (str) => str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const unescapeHTML = (str) => {
  if (!str) return "";
  return str.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
};
function extensionFromPath(path) {
  const clean = path.split(/[?#]/)[0];
  const match = /\.(jpe?g|png|gif|webp|svg|avif|bmp)$/i.exec(clean);
  return match ? `.${match[1].toLowerCase().replace("jpeg", "jpg")}` : null;
}
function getMimeTypeFromPath(path) {
  switch (extensionFromPath(path)) {
    case ".jpg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    case ".avif":
      return "image/avif";
    case ".bmp":
      return "image/bmp";
    default:
      return "application/octet-stream";
  }
}
function normalizeLanguage(lang) {
  if (!lang) return void 0;
  if (Array.isArray(lang)) return lang[0] || void 0;
  return lang;
}
function normalizeTitle(title) {
  if (!title) return void 0;
  if (typeof title === "string") return title;
  const keys = Object.keys(title);
  return keys.length > 0 ? title[keys[0]] : void 0;
}
function normalizePublisher(pub) {
  if (!pub) return void 0;
  if (typeof pub === "string") return pub;
  if ("name" in pub) {
    return normalizeTitle(pub.name);
  }
  return normalizeTitle(pub);
}
function normalizeContributors(contrib) {
  if (!contrib) return void 0;
  if (Array.isArray(contrib)) {
    return contrib.map((c) => normalizeSingleContributor(c)).filter(Boolean);
  }
  const normalized = normalizeSingleContributor(contrib);
  return normalized ? [normalized] : void 0;
}
function normalizeSingleContributor(c) {
  if (!c) return null;
  if (typeof c === "string") {
    return { name: c };
  }
  return {
    name: typeof c.name === "string" ? c.name : normalizeTitle(c.name) || "",
    sortAs: c.sortAs ? typeof c.sortAs === "string" ? c.sortAs : normalizeTitle(c.sortAs) : void 0,
    role: c.role
  };
}
function textNode(text) {
  return { type: "text", text };
}
function elementNode(type, attrs, children) {
  return { type, attrs, children };
}
function isTextNode(node2) {
  return node2.type === "text" && typeof node2.text === "string";
}
function domToNode(element, domAdapter) {
  const type = element.localName;
  const attrs = {};
  for (const attr of element.attributes) {
    attrs[attr.localName] = attr.value;
  }
  const children = [];
  const childNodes = domAdapter.getChildNodes ? domAdapter.getChildNodes(element) : element.children;
  for (const child of childNodes) {
    if (child.nodeType === 1) {
      children.push(domToNode(child, domAdapter));
    } else if (child.nodeType === 3) {
      const text = child.textContent || "";
      if (text) {
        children.push(textNode(text));
      }
    }
  }
  return elementNode(type, Object.keys(attrs).length > 0 ? attrs : void 0, children);
}
function parseHTML(html, domAdapter) {
  const cleaned = html.replace(/^\uFEFF/, "").replace(/<\?xml[^>]*\?>/gi, "");
  const isFullDocument = /^\s*(<!DOCTYPE|<html[\s>])/i.test(cleaned);
  const source = isFullDocument ? cleaned : `<html><body>${cleaned}</body></html>`;
  const doc = domAdapter.parseHTML(source, "text/html");
  const body = doc.querySelector("body") || doc.getElementsByTagName("body")[0] || doc.documentElement;
  const nodes = [];
  const childNodes = domAdapter.getChildNodes ? domAdapter.getChildNodes(body) : body.children;
  for (const child of childNodes) {
    if (child.nodeType === 1) {
      nodes.push(domToNode(child, domAdapter));
    } else if (child.nodeType === 3) {
      const text = child.textContent || "";
      if (text.trim()) {
        nodes.push(textNode(text));
      }
    }
  }
  return nodes;
}
function createSectionDocument(nodes, domAdapter) {
  return new SectionDocumentImpl(nodes, domAdapter);
}
class SectionDocumentImpl {
  constructor(nodes, domAdapter) {
    this.nodes = nodes;
    this.domAdapter = domAdapter;
  }
  query(selector2) {
    const results = [];
    const selectorParts = selector2.split(",").map((s) => s.trim());
    const matchesSelector = (node2, sel) => {
      var _a2, _b2, _c, _d, _e;
      if (isTextNode(node2)) return false;
      if (sel.startsWith(".")) {
        return ((_b2 = (_a2 = node2.attrs) == null ? void 0 : _a2.class) == null ? void 0 : _b2.split(/\s+/).includes(sel.slice(1))) || false;
      }
      if (sel.startsWith("#")) {
        return ((_c = node2.attrs) == null ? void 0 : _c.id) === sel.slice(1);
      }
      if (sel.startsWith("[") && sel.endsWith("]")) {
        const attrMatch = sel.slice(1, -1).split("=");
        const attrName = attrMatch[0];
        const attrValue = (_d = attrMatch[1]) == null ? void 0 : _d.replace(/['"]/g, "");
        if (!((_e = node2.attrs) == null ? void 0 : _e[attrName])) return false;
        return attrValue === void 0 || node2.attrs[attrName] === attrValue;
      }
      return node2.type === sel;
    };
    const walk2 = (node2) => {
      for (const sel of selectorParts) {
        if (matchesSelector(node2, sel)) {
          results.push(node2);
          break;
        }
      }
      if (node2.children) {
        for (const child of node2.children) {
          walk2(child);
        }
      }
    };
    for (const node2 of this.nodes) {
      walk2(node2);
    }
    return results;
  }
  getText() {
    const parts = [];
    const walk2 = (node2) => {
      if (isTextNode(node2)) {
        parts.push(node2.text);
      } else if (node2.children) {
        for (const child of node2.children) {
          walk2(child);
        }
      }
    };
    for (const node2 of this.nodes) {
      walk2(node2);
    }
    return parts.join("");
  }
  getImages() {
    var _a2;
    const images = [];
    const imgNodes = this.query("img");
    for (const node2 of imgNodes) {
      const src = (_a2 = node2.attrs) == null ? void 0 : _a2.src;
      if (!src) continue;
      const mimeType = getMimeTypeFromSrc(src);
      images.push({
        id: `img-${images.length}`,
        type: "image",
        mimeType,
        url: src
      });
    }
    return images;
  }
  insertNode(path, node2) {
    const newNodes = cloneNodes(this.nodes);
    if (path.length === 0) {
      newNodes.push(cloneNode(node2));
    } else if (path.length === 1) {
      newNodes.splice(path[0], 0, cloneNode(node2));
    } else {
      const parent = getNodeAtPath(newNodes, path.slice(0, -1));
      if (!parent || !parent.children) return this;
      const index = path[path.length - 1];
      parent.children.splice(index, 0, cloneNode(node2));
    }
    return new SectionDocumentImpl(newNodes, this.domAdapter);
  }
  removeNode(path) {
    if (path.length === 0) return this;
    const newNodes = cloneNodes(this.nodes);
    if (path.length === 1) {
      newNodes.splice(path[0], 1);
    } else {
      const parent = getNodeAtPath(newNodes, path.slice(0, -1));
      if (!parent || !parent.children) return this;
      parent.children.splice(path[path.length - 1], 1);
    }
    return new SectionDocumentImpl(newNodes, this.domAdapter);
  }
  setNode(path, attrs) {
    const newNodes = cloneNodes(this.nodes);
    const target = getNodeAtPath(newNodes, path);
    if (!target) return this;
    target.attrs = { ...target.attrs, ...attrs };
    return new SectionDocumentImpl(newNodes, this.domAdapter);
  }
  replaceText(path, text) {
    const newNodes = cloneNodes(this.nodes);
    const target = getNodeAtPath(newNodes, path);
    if (!target || !isTextNode(target)) return this;
    target.text = text;
    return new SectionDocumentImpl(newNodes, this.domAdapter);
  }
  serialize() {
    if (!this.domAdapter.createDocument || !this.domAdapter.createElement || !this.domAdapter.createTextNode || !this.domAdapter.appendChild) {
      return this.serializeSimple();
    }
    const doc = this.domAdapter.createDocument();
    const body = doc.querySelector("body") || doc.documentElement;
    for (const node2 of this.nodes) {
      this.nodeToDOM(node2, doc, body);
    }
    const serialized = this.domAdapter.serialize(doc);
    const bodyMatch = serialized.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    return bodyMatch ? bodyMatch[1] : serialized;
  }
  /**
   * Convert a DocumentNode to DOM and append to parent.
   */
  nodeToDOM(node2, doc, parent) {
    if (isTextNode(node2)) {
      const textNode2 = this.domAdapter.createTextNode(doc, node2.text);
      this.domAdapter.appendChild(parent, textNode2);
      return;
    }
    const element = this.domAdapter.createElement(doc, node2.type);
    if (node2.attrs) {
      for (const [key, value2] of Object.entries(node2.attrs)) {
        element.setAttribute(key, value2);
      }
    }
    if (node2.children) {
      for (const child of node2.children) {
        this.nodeToDOM(child, doc, element);
      }
    }
    this.domAdapter.appendChild(parent, element);
  }
  /**
   * Simple serialization fallback without DOM manipulation.
   */
  serializeSimple() {
    const parts = [];
    for (const node2 of this.nodes) {
      parts.push(this.nodeToHTML(node2));
    }
    return parts.join("");
  }
  /**
   * Convert a DocumentNode to HTML string.
   */
  nodeToHTML(node2) {
    if (isTextNode(node2)) {
      return escapeHTML(node2.text);
    }
    const attrs = node2.attrs ? Object.entries(node2.attrs).map(([k, v]) => `${k}="${escapeHTML(v)}"`).join(" ") : "";
    const attrsStr = attrs ? ` ${attrs}` : "";
    if (!node2.children || node2.children.length === 0) {
      if (["img", "br", "hr", "input", "meta", "link"].includes(node2.type)) {
        return `<${node2.type}${attrsStr} />`;
      }
      return `<${node2.type}${attrsStr}></${node2.type}>`;
    }
    const children = node2.children.map((c) => this.nodeToHTML(c)).join("");
    return `<${node2.type}${attrsStr}>${children}</${node2.type}>`;
  }
}
function cloneNode(node2) {
  if (isTextNode(node2)) {
    return { type: "text", text: node2.text };
  }
  const cloned = { type: node2.type };
  if (node2.attrs) {
    cloned.attrs = { ...node2.attrs };
  }
  if (node2.children) {
    cloned.children = node2.children.map(cloneNode);
  }
  return cloned;
}
function cloneNodes(nodes) {
  return nodes.map(cloneNode);
}
function getNodeAtPath(nodes, path) {
  if (path.length === 0) return null;
  let current = nodes[path[0]];
  for (let i = 1; i < path.length; i++) {
    if (!current || !current.children) return null;
    current = current.children[path[i]];
  }
  return current || null;
}
function getMimeTypeFromSrc(src) {
  const lower = src.toLowerCase();
  if (lower.includes(".jpg") || lower.includes(".jpeg")) return "image/jpeg";
  if (lower.includes(".png")) return "image/png";
  if (lower.includes(".gif")) return "image/gif";
  if (lower.includes(".webp")) return "image/webp";
  if (lower.includes(".svg")) return "image/svg+xml";
  if (lower.startsWith("data:image/")) {
    const match = src.match(/^data:([^;]+)/);
    return match ? match[1] : "image/unknown";
  }
  return "application/octet-stream";
}
const latin1BidiTypes = [
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "S",
  "B",
  "S",
  "WS",
  "B",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "B",
  "B",
  "B",
  "S",
  "WS",
  "ON",
  "ON",
  "ET",
  "ET",
  "ET",
  "ON",
  "ON",
  "ON",
  "ON",
  "ON",
  "ES",
  "CS",
  "ES",
  "CS",
  "CS",
  "EN",
  "EN",
  "EN",
  "EN",
  "EN",
  "EN",
  "EN",
  "EN",
  "EN",
  "EN",
  "CS",
  "ON",
  "ON",
  "ON",
  "ON",
  "ON",
  "ON",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "ON",
  "ON",
  "ON",
  "ON",
  "ON",
  "ON",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "ON",
  "ON",
  "ON",
  "ON",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "B",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "BN",
  "CS",
  "ON",
  "ET",
  "ET",
  "ET",
  "ET",
  "ON",
  "ON",
  "ON",
  "ON",
  "L",
  "ON",
  "ON",
  "BN",
  "ON",
  "ON",
  "ET",
  "ET",
  "EN",
  "EN",
  "ON",
  "L",
  "ON",
  "ON",
  "ON",
  "EN",
  "L",
  "ON",
  "ON",
  "ON",
  "ON",
  "ON",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "ON",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "ON",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L",
  "L"
];
const nonLatin1BidiRanges = [
  [697, 698, "ON"],
  [706, 719, "ON"],
  [722, 735, "ON"],
  [741, 749, "ON"],
  [751, 767, "ON"],
  [768, 879, "NSM"],
  [884, 885, "ON"],
  [894, 894, "ON"],
  [900, 901, "ON"],
  [903, 903, "ON"],
  [1014, 1014, "ON"],
  [1155, 1161, "NSM"],
  [1418, 1418, "ON"],
  [1421, 1422, "ON"],
  [1423, 1423, "ET"],
  [1424, 1424, "R"],
  [1425, 1469, "NSM"],
  [1470, 1470, "R"],
  [1471, 1471, "NSM"],
  [1472, 1472, "R"],
  [1473, 1474, "NSM"],
  [1475, 1475, "R"],
  [1476, 1477, "NSM"],
  [1478, 1478, "R"],
  [1479, 1479, "NSM"],
  [1480, 1535, "R"],
  [1536, 1541, "AN"],
  [1542, 1543, "ON"],
  [1544, 1544, "AL"],
  [1545, 1546, "ET"],
  [1547, 1547, "AL"],
  [1548, 1548, "CS"],
  [1549, 1549, "AL"],
  [1550, 1551, "ON"],
  [1552, 1562, "NSM"],
  [1563, 1610, "AL"],
  [1611, 1631, "NSM"],
  [1632, 1641, "AN"],
  [1642, 1642, "ET"],
  [1643, 1644, "AN"],
  [1645, 1647, "AL"],
  [1648, 1648, "NSM"],
  [1649, 1749, "AL"],
  [1750, 1756, "NSM"],
  [1757, 1757, "AN"],
  [1758, 1758, "ON"],
  [1759, 1764, "NSM"],
  [1765, 1766, "AL"],
  [1767, 1768, "NSM"],
  [1769, 1769, "ON"],
  [1770, 1773, "NSM"],
  [1774, 1775, "AL"],
  [1776, 1785, "EN"],
  [1786, 1808, "AL"],
  [1809, 1809, "NSM"],
  [1810, 1839, "AL"],
  [1840, 1866, "NSM"],
  [1867, 1957, "AL"],
  [1958, 1968, "NSM"],
  [1969, 1983, "AL"],
  [1984, 2026, "R"],
  [2027, 2035, "NSM"],
  [2036, 2037, "R"],
  [2038, 2041, "ON"],
  [2042, 2044, "R"],
  [2045, 2045, "NSM"],
  [2046, 2069, "R"],
  [2070, 2073, "NSM"],
  [2074, 2074, "R"],
  [2075, 2083, "NSM"],
  [2084, 2084, "R"],
  [2085, 2087, "NSM"],
  [2088, 2088, "R"],
  [2089, 2093, "NSM"],
  [2094, 2136, "R"],
  [2137, 2139, "NSM"],
  [2140, 2143, "R"],
  [2144, 2191, "AL"],
  [2192, 2193, "AN"],
  [2194, 2198, "AL"],
  [2199, 2207, "NSM"],
  [2208, 2249, "AL"],
  [2250, 2273, "NSM"],
  [2274, 2274, "AN"],
  [2275, 2306, "NSM"],
  [2362, 2362, "NSM"],
  [2364, 2364, "NSM"],
  [2369, 2376, "NSM"],
  [2381, 2381, "NSM"],
  [2385, 2391, "NSM"],
  [2402, 2403, "NSM"],
  [2433, 2433, "NSM"],
  [2492, 2492, "NSM"],
  [2497, 2500, "NSM"],
  [2509, 2509, "NSM"],
  [2530, 2531, "NSM"],
  [2546, 2547, "ET"],
  [2555, 2555, "ET"],
  [2558, 2558, "NSM"],
  [2561, 2562, "NSM"],
  [2620, 2620, "NSM"],
  [2625, 2626, "NSM"],
  [2631, 2632, "NSM"],
  [2635, 2637, "NSM"],
  [2641, 2641, "NSM"],
  [2672, 2673, "NSM"],
  [2677, 2677, "NSM"],
  [2689, 2690, "NSM"],
  [2748, 2748, "NSM"],
  [2753, 2757, "NSM"],
  [2759, 2760, "NSM"],
  [2765, 2765, "NSM"],
  [2786, 2787, "NSM"],
  [2801, 2801, "ET"],
  [2810, 2815, "NSM"],
  [2817, 2817, "NSM"],
  [2876, 2876, "NSM"],
  [2879, 2879, "NSM"],
  [2881, 2884, "NSM"],
  [2893, 2893, "NSM"],
  [2901, 2902, "NSM"],
  [2914, 2915, "NSM"],
  [2946, 2946, "NSM"],
  [3008, 3008, "NSM"],
  [3021, 3021, "NSM"],
  [3059, 3064, "ON"],
  [3065, 3065, "ET"],
  [3066, 3066, "ON"],
  [3072, 3072, "NSM"],
  [3076, 3076, "NSM"],
  [3132, 3132, "NSM"],
  [3134, 3136, "NSM"],
  [3142, 3144, "NSM"],
  [3146, 3149, "NSM"],
  [3157, 3158, "NSM"],
  [3170, 3171, "NSM"],
  [3192, 3198, "ON"],
  [3201, 3201, "NSM"],
  [3260, 3260, "NSM"],
  [3276, 3277, "NSM"],
  [3298, 3299, "NSM"],
  [3328, 3329, "NSM"],
  [3387, 3388, "NSM"],
  [3393, 3396, "NSM"],
  [3405, 3405, "NSM"],
  [3426, 3427, "NSM"],
  [3457, 3457, "NSM"],
  [3530, 3530, "NSM"],
  [3538, 3540, "NSM"],
  [3542, 3542, "NSM"],
  [3633, 3633, "NSM"],
  [3636, 3642, "NSM"],
  [3647, 3647, "ET"],
  [3655, 3662, "NSM"],
  [3761, 3761, "NSM"],
  [3764, 3772, "NSM"],
  [3784, 3790, "NSM"],
  [3864, 3865, "NSM"],
  [3893, 3893, "NSM"],
  [3895, 3895, "NSM"],
  [3897, 3897, "NSM"],
  [3898, 3901, "ON"],
  [3953, 3966, "NSM"],
  [3968, 3972, "NSM"],
  [3974, 3975, "NSM"],
  [3981, 3991, "NSM"],
  [3993, 4028, "NSM"],
  [4038, 4038, "NSM"],
  [4141, 4144, "NSM"],
  [4146, 4151, "NSM"],
  [4153, 4154, "NSM"],
  [4157, 4158, "NSM"],
  [4184, 4185, "NSM"],
  [4190, 4192, "NSM"],
  [4209, 4212, "NSM"],
  [4226, 4226, "NSM"],
  [4229, 4230, "NSM"],
  [4237, 4237, "NSM"],
  [4253, 4253, "NSM"],
  [4957, 4959, "NSM"],
  [5008, 5017, "ON"],
  [5120, 5120, "ON"],
  [5760, 5760, "WS"],
  [5787, 5788, "ON"],
  [5906, 5908, "NSM"],
  [5938, 5939, "NSM"],
  [5970, 5971, "NSM"],
  [6002, 6003, "NSM"],
  [6068, 6069, "NSM"],
  [6071, 6077, "NSM"],
  [6086, 6086, "NSM"],
  [6089, 6099, "NSM"],
  [6107, 6107, "ET"],
  [6109, 6109, "NSM"],
  [6128, 6137, "ON"],
  [6144, 6154, "ON"],
  [6155, 6157, "NSM"],
  [6158, 6158, "BN"],
  [6159, 6159, "NSM"],
  [6277, 6278, "NSM"],
  [6313, 6313, "NSM"],
  [6432, 6434, "NSM"],
  [6439, 6440, "NSM"],
  [6450, 6450, "NSM"],
  [6457, 6459, "NSM"],
  [6464, 6464, "ON"],
  [6468, 6469, "ON"],
  [6622, 6655, "ON"],
  [6679, 6680, "NSM"],
  [6683, 6683, "NSM"],
  [6742, 6742, "NSM"],
  [6744, 6750, "NSM"],
  [6752, 6752, "NSM"],
  [6754, 6754, "NSM"],
  [6757, 6764, "NSM"],
  [6771, 6780, "NSM"],
  [6783, 6783, "NSM"],
  [6832, 6877, "NSM"],
  [6880, 6891, "NSM"],
  [6912, 6915, "NSM"],
  [6964, 6964, "NSM"],
  [6966, 6970, "NSM"],
  [6972, 6972, "NSM"],
  [6978, 6978, "NSM"],
  [7019, 7027, "NSM"],
  [7040, 7041, "NSM"],
  [7074, 7077, "NSM"],
  [7080, 7081, "NSM"],
  [7083, 7085, "NSM"],
  [7142, 7142, "NSM"],
  [7144, 7145, "NSM"],
  [7149, 7149, "NSM"],
  [7151, 7153, "NSM"],
  [7212, 7219, "NSM"],
  [7222, 7223, "NSM"],
  [7376, 7378, "NSM"],
  [7380, 7392, "NSM"],
  [7394, 7400, "NSM"],
  [7405, 7405, "NSM"],
  [7412, 7412, "NSM"],
  [7416, 7417, "NSM"],
  [7616, 7679, "NSM"],
  [8125, 8125, "ON"],
  [8127, 8129, "ON"],
  [8141, 8143, "ON"],
  [8157, 8159, "ON"],
  [8173, 8175, "ON"],
  [8189, 8190, "ON"],
  [8192, 8202, "WS"],
  [8203, 8205, "BN"],
  [8207, 8207, "R"],
  [8208, 8231, "ON"],
  [8232, 8232, "WS"],
  [8233, 8233, "B"],
  [8234, 8238, "BN"],
  [8239, 8239, "CS"],
  [8240, 8244, "ET"],
  [8245, 8259, "ON"],
  [8260, 8260, "CS"],
  [8261, 8286, "ON"],
  [8287, 8287, "WS"],
  [8288, 8303, "BN"],
  [8304, 8304, "EN"],
  [8308, 8313, "EN"],
  [8314, 8315, "ES"],
  [8316, 8318, "ON"],
  [8320, 8329, "EN"],
  [8330, 8331, "ES"],
  [8332, 8334, "ON"],
  [8352, 8399, "ET"],
  [8400, 8432, "NSM"],
  [8448, 8449, "ON"],
  [8451, 8454, "ON"],
  [8456, 8457, "ON"],
  [8468, 8468, "ON"],
  [8470, 8472, "ON"],
  [8478, 8483, "ON"],
  [8485, 8485, "ON"],
  [8487, 8487, "ON"],
  [8489, 8489, "ON"],
  [8494, 8494, "ET"],
  [8506, 8507, "ON"],
  [8512, 8516, "ON"],
  [8522, 8525, "ON"],
  [8528, 8543, "ON"],
  [8585, 8587, "ON"],
  [8592, 8721, "ON"],
  [8722, 8722, "ES"],
  [8723, 8723, "ET"],
  [8724, 9013, "ON"],
  [9083, 9108, "ON"],
  [9110, 9257, "ON"],
  [9280, 9290, "ON"],
  [9312, 9351, "ON"],
  [9352, 9371, "EN"],
  [9450, 9899, "ON"],
  [9901, 10239, "ON"],
  [10496, 11123, "ON"],
  [11126, 11263, "ON"],
  [11493, 11498, "ON"],
  [11503, 11505, "NSM"],
  [11513, 11519, "ON"],
  [11647, 11647, "NSM"],
  [11744, 11775, "NSM"],
  [11776, 11869, "ON"],
  [11904, 11929, "ON"],
  [11931, 12019, "ON"],
  [12032, 12245, "ON"],
  [12272, 12287, "ON"],
  [12288, 12288, "WS"],
  [12289, 12292, "ON"],
  [12296, 12320, "ON"],
  [12330, 12333, "NSM"],
  [12336, 12336, "ON"],
  [12342, 12343, "ON"],
  [12349, 12351, "ON"],
  [12441, 12442, "NSM"],
  [12443, 12444, "ON"],
  [12448, 12448, "ON"],
  [12539, 12539, "ON"],
  [12736, 12773, "ON"],
  [12783, 12783, "ON"],
  [12829, 12830, "ON"],
  [12880, 12895, "ON"],
  [12924, 12926, "ON"],
  [12977, 12991, "ON"],
  [13004, 13007, "ON"],
  [13175, 13178, "ON"],
  [13278, 13279, "ON"],
  [13311, 13311, "ON"],
  [19904, 19967, "ON"],
  [42128, 42182, "ON"],
  [42509, 42511, "ON"],
  [42607, 42610, "NSM"],
  [42611, 42611, "ON"],
  [42612, 42621, "NSM"],
  [42622, 42623, "ON"],
  [42654, 42655, "NSM"],
  [42736, 42737, "NSM"],
  [42752, 42785, "ON"],
  [42888, 42888, "ON"],
  [43010, 43010, "NSM"],
  [43014, 43014, "NSM"],
  [43019, 43019, "NSM"],
  [43045, 43046, "NSM"],
  [43048, 43051, "ON"],
  [43052, 43052, "NSM"],
  [43064, 43065, "ET"],
  [43124, 43127, "ON"],
  [43204, 43205, "NSM"],
  [43232, 43249, "NSM"],
  [43263, 43263, "NSM"],
  [43302, 43309, "NSM"],
  [43335, 43345, "NSM"],
  [43392, 43394, "NSM"],
  [43443, 43443, "NSM"],
  [43446, 43449, "NSM"],
  [43452, 43453, "NSM"],
  [43493, 43493, "NSM"],
  [43561, 43566, "NSM"],
  [43569, 43570, "NSM"],
  [43573, 43574, "NSM"],
  [43587, 43587, "NSM"],
  [43596, 43596, "NSM"],
  [43644, 43644, "NSM"],
  [43696, 43696, "NSM"],
  [43698, 43700, "NSM"],
  [43703, 43704, "NSM"],
  [43710, 43711, "NSM"],
  [43713, 43713, "NSM"],
  [43756, 43757, "NSM"],
  [43766, 43766, "NSM"],
  [43882, 43883, "ON"],
  [44005, 44005, "NSM"],
  [44008, 44008, "NSM"],
  [44013, 44013, "NSM"],
  [64285, 64285, "R"],
  [64286, 64286, "NSM"],
  [64287, 64296, "R"],
  [64297, 64297, "ES"],
  [64298, 64335, "R"],
  [64336, 64450, "AL"],
  [64451, 64466, "ON"],
  [64467, 64829, "AL"],
  [64830, 64847, "ON"],
  [64848, 64911, "AL"],
  [64912, 64913, "ON"],
  [64914, 64967, "AL"],
  [64968, 64975, "ON"],
  [64976, 65007, "BN"],
  [65008, 65020, "AL"],
  [65021, 65023, "ON"],
  [65024, 65039, "NSM"],
  [65040, 65049, "ON"],
  [65056, 65071, "NSM"],
  [65072, 65103, "ON"],
  [65104, 65104, "CS"],
  [65105, 65105, "ON"],
  [65106, 65106, "CS"],
  [65108, 65108, "ON"],
  [65109, 65109, "CS"],
  [65110, 65118, "ON"],
  [65119, 65119, "ET"],
  [65120, 65121, "ON"],
  [65122, 65123, "ES"],
  [65124, 65126, "ON"],
  [65128, 65128, "ON"],
  [65129, 65130, "ET"],
  [65131, 65131, "ON"],
  [65136, 65278, "AL"],
  [65279, 65279, "BN"],
  [65281, 65282, "ON"],
  [65283, 65285, "ET"],
  [65286, 65290, "ON"],
  [65291, 65291, "ES"],
  [65292, 65292, "CS"],
  [65293, 65293, "ES"],
  [65294, 65295, "CS"],
  [65296, 65305, "EN"],
  [65306, 65306, "CS"],
  [65307, 65312, "ON"],
  [65339, 65344, "ON"],
  [65371, 65381, "ON"],
  [65504, 65505, "ET"],
  [65506, 65508, "ON"],
  [65509, 65510, "ET"],
  [65512, 65518, "ON"],
  [65520, 65528, "BN"],
  [65529, 65533, "ON"],
  [65534, 65535, "BN"],
  [65793, 65793, "ON"],
  [65856, 65932, "ON"],
  [65936, 65948, "ON"],
  [65952, 65952, "ON"],
  [66045, 66045, "NSM"],
  [66272, 66272, "NSM"],
  [66273, 66299, "EN"],
  [66422, 66426, "NSM"],
  [67584, 67870, "R"],
  [67871, 67871, "ON"],
  [67872, 68096, "R"],
  [68097, 68099, "NSM"],
  [68100, 68100, "R"],
  [68101, 68102, "NSM"],
  [68103, 68107, "R"],
  [68108, 68111, "NSM"],
  [68112, 68151, "R"],
  [68152, 68154, "NSM"],
  [68155, 68158, "R"],
  [68159, 68159, "NSM"],
  [68160, 68324, "R"],
  [68325, 68326, "NSM"],
  [68327, 68408, "R"],
  [68409, 68415, "ON"],
  [68416, 68863, "R"],
  [68864, 68899, "AL"],
  [68900, 68903, "NSM"],
  [68904, 68911, "AL"],
  [68912, 68921, "AN"],
  [68922, 68927, "AL"],
  [68928, 68937, "AN"],
  [68938, 68968, "R"],
  [68969, 68973, "NSM"],
  [68974, 68974, "ON"],
  [68975, 69215, "R"],
  [69216, 69246, "AN"],
  [69247, 69290, "R"],
  [69291, 69292, "NSM"],
  [69293, 69311, "R"],
  [69312, 69327, "AL"],
  [69328, 69336, "ON"],
  [69337, 69369, "AL"],
  [69370, 69375, "NSM"],
  [69376, 69423, "R"],
  [69424, 69445, "AL"],
  [69446, 69456, "NSM"],
  [69457, 69487, "AL"],
  [69488, 69505, "R"],
  [69506, 69509, "NSM"],
  [69510, 69631, "R"],
  [69633, 69633, "NSM"],
  [69688, 69702, "NSM"],
  [69714, 69733, "ON"],
  [69744, 69744, "NSM"],
  [69747, 69748, "NSM"],
  [69759, 69761, "NSM"],
  [69811, 69814, "NSM"],
  [69817, 69818, "NSM"],
  [69826, 69826, "NSM"],
  [69888, 69890, "NSM"],
  [69927, 69931, "NSM"],
  [69933, 69940, "NSM"],
  [70003, 70003, "NSM"],
  [70016, 70017, "NSM"],
  [70070, 70078, "NSM"],
  [70089, 70092, "NSM"],
  [70095, 70095, "NSM"],
  [70191, 70193, "NSM"],
  [70196, 70196, "NSM"],
  [70198, 70199, "NSM"],
  [70206, 70206, "NSM"],
  [70209, 70209, "NSM"],
  [70367, 70367, "NSM"],
  [70371, 70378, "NSM"],
  [70400, 70401, "NSM"],
  [70459, 70460, "NSM"],
  [70464, 70464, "NSM"],
  [70502, 70508, "NSM"],
  [70512, 70516, "NSM"],
  [70587, 70592, "NSM"],
  [70606, 70606, "NSM"],
  [70608, 70608, "NSM"],
  [70610, 70610, "NSM"],
  [70625, 70626, "NSM"],
  [70712, 70719, "NSM"],
  [70722, 70724, "NSM"],
  [70726, 70726, "NSM"],
  [70750, 70750, "NSM"],
  [70835, 70840, "NSM"],
  [70842, 70842, "NSM"],
  [70847, 70848, "NSM"],
  [70850, 70851, "NSM"],
  [71090, 71093, "NSM"],
  [71100, 71101, "NSM"],
  [71103, 71104, "NSM"],
  [71132, 71133, "NSM"],
  [71219, 71226, "NSM"],
  [71229, 71229, "NSM"],
  [71231, 71232, "NSM"],
  [71264, 71276, "ON"],
  [71339, 71339, "NSM"],
  [71341, 71341, "NSM"],
  [71344, 71349, "NSM"],
  [71351, 71351, "NSM"],
  [71453, 71453, "NSM"],
  [71455, 71455, "NSM"],
  [71458, 71461, "NSM"],
  [71463, 71467, "NSM"],
  [71727, 71735, "NSM"],
  [71737, 71738, "NSM"],
  [71995, 71996, "NSM"],
  [71998, 71998, "NSM"],
  [72003, 72003, "NSM"],
  [72148, 72151, "NSM"],
  [72154, 72155, "NSM"],
  [72160, 72160, "NSM"],
  [72193, 72198, "NSM"],
  [72201, 72202, "NSM"],
  [72243, 72248, "NSM"],
  [72251, 72254, "NSM"],
  [72263, 72263, "NSM"],
  [72273, 72278, "NSM"],
  [72281, 72283, "NSM"],
  [72330, 72342, "NSM"],
  [72344, 72345, "NSM"],
  [72544, 72544, "NSM"],
  [72546, 72548, "NSM"],
  [72550, 72550, "NSM"],
  [72752, 72758, "NSM"],
  [72760, 72765, "NSM"],
  [72850, 72871, "NSM"],
  [72874, 72880, "NSM"],
  [72882, 72883, "NSM"],
  [72885, 72886, "NSM"],
  [73009, 73014, "NSM"],
  [73018, 73018, "NSM"],
  [73020, 73021, "NSM"],
  [73023, 73029, "NSM"],
  [73031, 73031, "NSM"],
  [73104, 73105, "NSM"],
  [73109, 73109, "NSM"],
  [73111, 73111, "NSM"],
  [73459, 73460, "NSM"],
  [73472, 73473, "NSM"],
  [73526, 73530, "NSM"],
  [73536, 73536, "NSM"],
  [73538, 73538, "NSM"],
  [73562, 73562, "NSM"],
  [73685, 73692, "ON"],
  [73693, 73696, "ET"],
  [73697, 73713, "ON"],
  [78912, 78912, "NSM"],
  [78919, 78933, "NSM"],
  [90398, 90409, "NSM"],
  [90413, 90415, "NSM"],
  [92912, 92916, "NSM"],
  [92976, 92982, "NSM"],
  [94031, 94031, "NSM"],
  [94095, 94098, "NSM"],
  [94178, 94178, "ON"],
  [94180, 94180, "NSM"],
  [113821, 113822, "NSM"],
  [113824, 113827, "BN"],
  [117760, 117973, "ON"],
  [118e3, 118009, "EN"],
  [118010, 118012, "ON"],
  [118016, 118451, "ON"],
  [118458, 118480, "ON"],
  [118496, 118512, "ON"],
  [118528, 118573, "NSM"],
  [118576, 118598, "NSM"],
  [119143, 119145, "NSM"],
  [119155, 119162, "BN"],
  [119163, 119170, "NSM"],
  [119173, 119179, "NSM"],
  [119210, 119213, "NSM"],
  [119273, 119274, "ON"],
  [119296, 119361, "ON"],
  [119362, 119364, "NSM"],
  [119365, 119365, "ON"],
  [119552, 119638, "ON"],
  [120513, 120513, "ON"],
  [120539, 120539, "ON"],
  [120571, 120571, "ON"],
  [120597, 120597, "ON"],
  [120629, 120629, "ON"],
  [120655, 120655, "ON"],
  [120687, 120687, "ON"],
  [120713, 120713, "ON"],
  [120745, 120745, "ON"],
  [120771, 120771, "ON"],
  [120782, 120831, "EN"],
  [121344, 121398, "NSM"],
  [121403, 121452, "NSM"],
  [121461, 121461, "NSM"],
  [121476, 121476, "NSM"],
  [121499, 121503, "NSM"],
  [121505, 121519, "NSM"],
  [122880, 122886, "NSM"],
  [122888, 122904, "NSM"],
  [122907, 122913, "NSM"],
  [122915, 122916, "NSM"],
  [122918, 122922, "NSM"],
  [123023, 123023, "NSM"],
  [123184, 123190, "NSM"],
  [123566, 123566, "NSM"],
  [123628, 123631, "NSM"],
  [123647, 123647, "ET"],
  [124140, 124143, "NSM"],
  [124398, 124399, "NSM"],
  [124643, 124643, "NSM"],
  [124646, 124646, "NSM"],
  [124654, 124655, "NSM"],
  [124661, 124661, "NSM"],
  [124928, 125135, "R"],
  [125136, 125142, "NSM"],
  [125143, 125251, "R"],
  [125252, 125258, "NSM"],
  [125259, 126063, "R"],
  [126064, 126143, "AL"],
  [126144, 126207, "R"],
  [126208, 126287, "AL"],
  [126288, 126463, "R"],
  [126464, 126703, "AL"],
  [126704, 126705, "ON"],
  [126706, 126719, "AL"],
  [126720, 126975, "R"],
  [126976, 127019, "ON"],
  [127024, 127123, "ON"],
  [127136, 127150, "ON"],
  [127153, 127167, "ON"],
  [127169, 127183, "ON"],
  [127185, 127221, "ON"],
  [127232, 127242, "EN"],
  [127243, 127247, "ON"],
  [127279, 127279, "ON"],
  [127338, 127343, "ON"],
  [127405, 127405, "ON"],
  [127584, 127589, "ON"],
  [127744, 128728, "ON"],
  [128732, 128748, "ON"],
  [128752, 128764, "ON"],
  [128768, 128985, "ON"],
  [128992, 129003, "ON"],
  [129008, 129008, "ON"],
  [129024, 129035, "ON"],
  [129040, 129095, "ON"],
  [129104, 129113, "ON"],
  [129120, 129159, "ON"],
  [129168, 129197, "ON"],
  [129200, 129211, "ON"],
  [129216, 129217, "ON"],
  [129232, 129240, "ON"],
  [129280, 129623, "ON"],
  [129632, 129645, "ON"],
  [129648, 129660, "ON"],
  [129664, 129674, "ON"],
  [129678, 129734, "ON"],
  [129736, 129736, "ON"],
  [129741, 129756, "ON"],
  [129759, 129770, "ON"],
  [129775, 129784, "ON"],
  [129792, 129938, "ON"],
  [129940, 130031, "ON"],
  [130032, 130041, "EN"],
  [130042, 130042, "ON"],
  [131070, 131071, "BN"],
  [196606, 196607, "BN"],
  [262142, 262143, "BN"],
  [327678, 327679, "BN"],
  [393214, 393215, "BN"],
  [458750, 458751, "BN"],
  [524286, 524287, "BN"],
  [589822, 589823, "BN"],
  [655358, 655359, "BN"],
  [720894, 720895, "BN"],
  [786430, 786431, "BN"],
  [851966, 851967, "BN"],
  [917502, 917759, "BN"],
  [917760, 917999, "NSM"],
  [918e3, 921599, "BN"],
  [983038, 983039, "BN"],
  [1048574, 1048575, "BN"],
  [1114110, 1114111, "BN"]
];
function classifyCodePoint(codePoint) {
  if (codePoint <= 255)
    return latin1BidiTypes[codePoint];
  let lo = 0;
  let hi = nonLatin1BidiRanges.length - 1;
  while (lo <= hi) {
    const mid = lo + hi >> 1;
    const range = nonLatin1BidiRanges[mid];
    if (codePoint < range[0]) {
      hi = mid - 1;
      continue;
    }
    if (codePoint > range[1]) {
      lo = mid + 1;
      continue;
    }
    return range[2];
  }
  return "L";
}
function computeBidiLevels(str) {
  const len = str.length;
  if (len === 0)
    return null;
  const types = new Array(len);
  let sawBidi = false;
  for (let i = 0; i < len; ) {
    const first = str.charCodeAt(i);
    let codePoint = first;
    let codeUnitLength = 1;
    if (first >= 55296 && first <= 56319 && i + 1 < len) {
      const second = str.charCodeAt(i + 1);
      if (second >= 56320 && second <= 57343) {
        codePoint = (first - 55296 << 10) + (second - 56320) + 65536;
        codeUnitLength = 2;
      }
    }
    const t = classifyCodePoint(codePoint);
    if (t === "R" || t === "AL" || t === "AN")
      sawBidi = true;
    for (let j = 0; j < codeUnitLength; j++) {
      types[i + j] = t;
    }
    i += codeUnitLength;
  }
  if (!sawBidi)
    return null;
  let startLevel = 0;
  for (let i = 0; i < len; i++) {
    const t = types[i];
    if (t === "L") {
      startLevel = 0;
      break;
    }
    if (t === "R" || t === "AL") {
      startLevel = 1;
      break;
    }
  }
  const levels = new Int8Array(len);
  for (let i = 0; i < len; i++)
    levels[i] = startLevel;
  const e = startLevel & 1 ? "R" : "L";
  const sor = e;
  let lastType = sor;
  for (let i = 0; i < len; i++) {
    if (types[i] === "NSM")
      types[i] = lastType;
    else
      lastType = types[i];
  }
  lastType = sor;
  for (let i = 0; i < len; i++) {
    const t = types[i];
    if (t === "EN")
      types[i] = lastType === "AL" ? "AN" : "EN";
    else if (t === "R" || t === "L" || t === "AL")
      lastType = t;
  }
  for (let i = 0; i < len; i++) {
    if (types[i] === "AL")
      types[i] = "R";
  }
  for (let i = 1; i < len - 1; i++) {
    if (types[i] === "ES" && types[i - 1] === "EN" && types[i + 1] === "EN") {
      types[i] = "EN";
    }
    if (types[i] === "CS" && (types[i - 1] === "EN" || types[i - 1] === "AN") && types[i + 1] === types[i - 1]) {
      types[i] = types[i - 1];
    }
  }
  for (let i = 0; i < len; i++) {
    if (types[i] !== "EN")
      continue;
    let j;
    for (j = i - 1; j >= 0 && types[j] === "ET"; j--)
      types[j] = "EN";
    for (j = i + 1; j < len && types[j] === "ET"; j++)
      types[j] = "EN";
  }
  for (let i = 0; i < len; i++) {
    const t = types[i];
    if (t === "WS" || t === "ES" || t === "ET" || t === "CS")
      types[i] = "ON";
  }
  lastType = sor;
  for (let i = 0; i < len; i++) {
    const t = types[i];
    if (t === "EN")
      types[i] = lastType === "L" ? "L" : "EN";
    else if (t === "R" || t === "L")
      lastType = t;
  }
  for (let i = 0; i < len; i++) {
    if (types[i] !== "ON")
      continue;
    let end = i + 1;
    while (end < len && types[end] === "ON")
      end++;
    const before = i > 0 ? types[i - 1] : sor;
    const after = end < len ? types[end] : sor;
    const bDir = before !== "L" ? "R" : "L";
    const aDir = after !== "L" ? "R" : "L";
    if (bDir === aDir) {
      for (let j = i; j < end; j++)
        types[j] = bDir;
    }
    i = end - 1;
  }
  for (let i = 0; i < len; i++) {
    if (types[i] === "ON")
      types[i] = e;
  }
  for (let i = 0; i < len; i++) {
    const t = types[i];
    if ((levels[i] & 1) === 0) {
      if (t === "R")
        levels[i]++;
      else if (t === "AN" || t === "EN")
        levels[i] += 2;
    } else if (t === "L" || t === "AN" || t === "EN") {
      levels[i]++;
    }
  }
  return levels;
}
function computeSegmentLevels(normalized, segStarts) {
  const bidiLevels = computeBidiLevels(normalized);
  if (bidiLevels === null)
    return null;
  const segLevels = new Int8Array(segStarts.length);
  for (let i = 0; i < segStarts.length; i++) {
    segLevels[i] = bidiLevels[segStarts[i]];
  }
  return segLevels;
}
const collapsibleWhitespaceRunRe = /[ \t\n\r\f]+/g;
const needsWhitespaceNormalizationRe = /[\t\n\r\f]| {2,}|^ | $/;
function getWhiteSpaceProfile(whiteSpace) {
  const mode = whiteSpace != null ? whiteSpace : "normal";
  return mode === "pre-wrap" ? { mode, preserveOrdinarySpaces: true, preserveHardBreaks: true } : { mode, preserveOrdinarySpaces: false, preserveHardBreaks: false };
}
function normalizeWhitespaceNormal(text) {
  if (!needsWhitespaceNormalizationRe.test(text))
    return text;
  let normalized = text.replace(collapsibleWhitespaceRunRe, " ");
  if (normalized.charCodeAt(0) === 32) {
    normalized = normalized.slice(1);
  }
  if (normalized.length > 0 && normalized.charCodeAt(normalized.length - 1) === 32) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}
function normalizeWhitespacePreWrap(text) {
  if (!/[\r\f]/.test(text))
    return text;
  return text.replace(/\r\n/g, "\n").replace(/[\r\f]/g, "\n");
}
let sharedWordSegmenter = null;
let segmenterLocale;
function getSharedWordSegmenter() {
  if (sharedWordSegmenter === null) {
    sharedWordSegmenter = new Intl.Segmenter(segmenterLocale, { granularity: "word" });
  }
  return sharedWordSegmenter;
}
const arabicScriptRe = /\p{Script=Arabic}/u;
const combiningMarkRe = /\p{M}/u;
const decimalDigitRe = /\p{Nd}/u;
function containsArabicScript(text) {
  return arabicScriptRe.test(text);
}
function isCJKCodePoint(codePoint) {
  return codePoint >= 19968 && codePoint <= 40959 || codePoint >= 13312 && codePoint <= 19903 || codePoint >= 131072 && codePoint <= 173791 || codePoint >= 173824 && codePoint <= 177983 || codePoint >= 177984 && codePoint <= 178207 || codePoint >= 178208 && codePoint <= 183983 || codePoint >= 183984 && codePoint <= 191471 || codePoint >= 191472 && codePoint <= 192093 || codePoint >= 194560 && codePoint <= 195103 || codePoint >= 196608 && codePoint <= 201551 || codePoint >= 201552 && codePoint <= 205743 || codePoint >= 205744 && codePoint <= 210041 || codePoint >= 63744 && codePoint <= 64255 || codePoint >= 12288 && codePoint <= 12351 || codePoint >= 12352 && codePoint <= 12447 || codePoint >= 12448 && codePoint <= 12543 || codePoint >= 12592 && codePoint <= 12687 || codePoint >= 44032 && codePoint <= 55215 || codePoint >= 65280 && codePoint <= 65519;
}
function isCJK(s) {
  for (let i = 0; i < s.length; i++) {
    const first = s.charCodeAt(i);
    if (first < 12288)
      continue;
    if (first >= 55296 && first <= 56319 && i + 1 < s.length) {
      const second = s.charCodeAt(i + 1);
      if (second >= 56320 && second <= 57343) {
        const codePoint = (first - 55296 << 10) + (second - 56320) + 65536;
        if (isCJKCodePoint(codePoint))
          return true;
        i++;
        continue;
      }
    }
    if (isCJKCodePoint(first))
      return true;
  }
  return false;
}
function endsWithLineStartProhibitedText(text) {
  const last = getLastCodePoint(text);
  return last !== null && (kinsokuStart.has(last) || leftStickyPunctuation.has(last));
}
const keepAllGlueChars = /* @__PURE__ */ new Set([
  " ",
  " ",
  "⁠",
  "\uFEFF"
]);
const keepAllDashBreakChars = /* @__PURE__ */ new Set([
  "-",
  "‐",
  "–",
  "—"
]);
function endsWithKeepAllGlueText(text) {
  const last = getLastCodePoint(text);
  return last !== null && keepAllGlueChars.has(last);
}
function endsWithKeepAllDashBreakText(text) {
  const last = getLastCodePoint(text);
  return last !== null && keepAllDashBreakChars.has(last);
}
function canContinueKeepAllTextRun(previousText, breakAfterPunctuation) {
  if (endsWithKeepAllGlueText(previousText))
    return false;
  if (!breakAfterPunctuation)
    return true;
  if (endsWithLineStartProhibitedText(previousText))
    return false;
  if (endsWithKeepAllDashBreakText(previousText))
    return false;
  return true;
}
const kinsokuStart = /* @__PURE__ */ new Set([
  "，",
  "．",
  "！",
  "：",
  "；",
  "？",
  "、",
  "。",
  "・",
  "）",
  "〕",
  "〉",
  "》",
  "」",
  "』",
  "】",
  "〗",
  "〙",
  "〛",
  "ー",
  "々",
  "〻",
  "ゝ",
  "ゞ",
  "ヽ",
  "ヾ"
]);
const kinsokuEnd = /* @__PURE__ */ new Set([
  '"',
  "(",
  "[",
  "{",
  "¡",
  "¿",
  "“",
  "‘",
  "‚",
  "„",
  "«",
  "‹",
  "⸘",
  "（",
  "〔",
  "〈",
  "《",
  "「",
  "『",
  "【",
  "〖",
  "〘",
  "〚"
]);
const forwardStickyGlue = /* @__PURE__ */ new Set([
  "'",
  "’"
]);
const leftStickyPunctuation = /* @__PURE__ */ new Set([
  ".",
  ",",
  "!",
  "?",
  ":",
  ";",
  "،",
  "؛",
  "؟",
  "।",
  "॥",
  "၊",
  "။",
  "၌",
  "၍",
  "၏",
  ")",
  "]",
  "}",
  "%",
  '"',
  "”",
  "’",
  "»",
  "›",
  "…"
]);
const arabicNoSpaceTrailingPunctuation = /* @__PURE__ */ new Set([
  ":",
  ".",
  "،",
  "؛"
]);
const myanmarMedialGlue = /* @__PURE__ */ new Set([
  "၏"
]);
const closingQuoteChars = /* @__PURE__ */ new Set([
  "”",
  "’",
  "»",
  "›",
  "」",
  "』",
  "】",
  "》",
  "〉",
  "〕",
  "）"
]);
function isLeftStickyPunctuationSegment(segment) {
  if (isEscapedQuoteClusterSegment(segment))
    return true;
  let sawPunctuation = false;
  for (const ch3 of segment) {
    if (leftStickyPunctuation.has(ch3) || isLineBreakNumericAffix(ch3)) {
      sawPunctuation = true;
      continue;
    }
    if (sawPunctuation && combiningMarkRe.test(ch3))
      continue;
    return false;
  }
  return sawPunctuation;
}
function isCJKLineStartProhibitedSegment(segment) {
  for (const ch3 of segment) {
    if (!kinsokuStart.has(ch3) && !leftStickyPunctuation.has(ch3))
      return false;
  }
  return segment.length > 0;
}
function isForwardStickyClusterSegment(segment) {
  if (isEscapedQuoteClusterSegment(segment))
    return true;
  for (const ch3 of segment) {
    if (!kinsokuEnd.has(ch3) && !forwardStickyGlue.has(ch3) && !combiningMarkRe.test(ch3) && !isLineBreakNumericAffix(ch3)) {
      return false;
    }
  }
  return segment.length > 0;
}
function isEscapedQuoteClusterSegment(segment) {
  let sawQuote = false;
  for (const ch3 of segment) {
    if (ch3 === "\\" || combiningMarkRe.test(ch3))
      continue;
    if (kinsokuEnd.has(ch3) || leftStickyPunctuation.has(ch3) || forwardStickyGlue.has(ch3)) {
      sawQuote = true;
      continue;
    }
    return false;
  }
  return sawQuote;
}
function previousCodePointStart(text, end) {
  const last = end - 1;
  if (last <= 0)
    return Math.max(last, 0);
  const lastCodeUnit = text.charCodeAt(last);
  if (lastCodeUnit < 56320 || lastCodeUnit > 57343)
    return last;
  const maybeHigh = last - 1;
  if (maybeHigh < 0)
    return last;
  const highCodeUnit = text.charCodeAt(maybeHigh);
  return highCodeUnit >= 55296 && highCodeUnit <= 56319 ? maybeHigh : last;
}
function getLastCodePoint(text) {
  if (text.length === 0)
    return null;
  const start = previousCodePointStart(text, text.length);
  return text.slice(start);
}
function getFirstSignificantCodePoint(text) {
  for (const ch3 of text) {
    if (!combiningMarkRe.test(ch3))
      return ch3;
  }
  return null;
}
function getLastSignificantCodePoint(text) {
  for (let end = text.length; end > 0; ) {
    const start = previousCodePointStart(text, end);
    const ch3 = text.slice(start, end);
    if (!combiningMarkRe.test(ch3))
      return ch3;
    end = start;
  }
  return null;
}
const lineBreakNumericAffixRanges = [
  36,
  37,
  43,
  43,
  92,
  92,
  162,
  165,
  176,
  177,
  1423,
  1423,
  1545,
  1547,
  1642,
  1642,
  2046,
  2047,
  2546,
  2547,
  2553,
  2555,
  2801,
  2801,
  3065,
  3065,
  3449,
  3449,
  3647,
  3647,
  6107,
  6107,
  8240,
  8247,
  8279,
  8279,
  8352,
  8399,
  8451,
  8451,
  8457,
  8457,
  8470,
  8470,
  8722,
  8723,
  43064,
  43064,
  65020,
  65020,
  65129,
  65130,
  65284,
  65285,
  65504,
  65505,
  65509,
  65510,
  73693,
  73696,
  123647,
  123647,
  126124,
  126124,
  126128,
  126128
];
function isCodePointInRanges(codePoint, ranges) {
  for (let i = 0; i < ranges.length; i += 2) {
    if (codePoint >= ranges[i] && codePoint <= ranges[i + 1])
      return true;
  }
  return false;
}
function isLineBreakNumericAffix(ch3) {
  const codePoint = ch3.codePointAt(0);
  return codePoint !== void 0 && isCodePointInRanges(codePoint, lineBreakNumericAffixRanges);
}
function endsWithLineBreakNumericAffix(text) {
  const last = getLastSignificantCodePoint(text);
  return last !== null && isLineBreakNumericAffix(last);
}
function startsWithDecimalDigit(text) {
  const first = getFirstSignificantCodePoint(text);
  return first !== null && decimalDigitRe.test(first);
}
function splitTrailingForwardStickyCluster(text) {
  const chars = Array.from(text);
  let splitIndex = chars.length;
  while (splitIndex > 0) {
    const ch3 = chars[splitIndex - 1];
    if (combiningMarkRe.test(ch3)) {
      splitIndex--;
      continue;
    }
    if (kinsokuEnd.has(ch3) || forwardStickyGlue.has(ch3)) {
      splitIndex--;
      continue;
    }
    break;
  }
  if (splitIndex <= 0 || splitIndex === chars.length)
    return null;
  return {
    head: chars.slice(0, splitIndex).join(""),
    tail: chars.slice(splitIndex).join("")
  };
}
function getRepeatableSingleCharRunChar(text, isWordLike, kind) {
  return kind === "text" && !isWordLike && text.length === 1 && text !== "-" && text !== "—" ? text : null;
}
function materializeDeferredSingleCharRun(texts, chars, lengths, index) {
  const ch3 = chars[index];
  const text = texts[index];
  if (ch3 == null)
    return text;
  const length2 = lengths[index];
  if (text.length === length2)
    return text;
  const materialized = ch3.repeat(length2);
  texts[index] = materialized;
  return materialized;
}
function hasArabicNoSpacePunctuation(containsArabic, lastCodePoint) {
  return containsArabic && lastCodePoint !== null && arabicNoSpaceTrailingPunctuation.has(lastCodePoint);
}
function endsWithMyanmarMedialGlue(segment) {
  const lastCodePoint = getLastCodePoint(segment);
  return lastCodePoint !== null && myanmarMedialGlue.has(lastCodePoint);
}
function splitLeadingSpaceAndMarks(segment) {
  if (segment.length < 2 || segment[0] !== " ")
    return null;
  const marks = segment.slice(1);
  if (/^\p{M}+$/u.test(marks)) {
    return { space: " ", marks };
  }
  return null;
}
function endsWithClosingQuote(text) {
  let end = text.length;
  while (end > 0) {
    const start = previousCodePointStart(text, end);
    const ch3 = text.slice(start, end);
    if (closingQuoteChars.has(ch3))
      return true;
    if (!leftStickyPunctuation.has(ch3))
      return false;
    end = start;
  }
  return false;
}
function classifySegmentBreakChar(ch3, whiteSpaceProfile) {
  if (whiteSpaceProfile.preserveOrdinarySpaces || whiteSpaceProfile.preserveHardBreaks) {
    if (ch3 === " ")
      return "preserved-space";
    if (ch3 === "	")
      return "tab";
    if (whiteSpaceProfile.preserveHardBreaks && ch3 === "\n")
      return "hard-break";
  }
  if (ch3 === " ")
    return "space";
  if (ch3 === " " || ch3 === " " || ch3 === "⁠" || ch3 === "\uFEFF") {
    return "glue";
  }
  if (ch3 === "​")
    return "zero-width-break";
  if (ch3 === "­")
    return "soft-hyphen";
  return "text";
}
const breakCharRe = /[\x20\t\n\xA0\xAD\u200B\u202F\u2060\uFEFF]/;
function joinTextParts(parts) {
  return parts.length === 1 ? parts[0] : parts.join("");
}
function joinReversedPrefixParts(prefixParts, tail) {
  const parts = [];
  for (let i = prefixParts.length - 1; i >= 0; i--) {
    parts.push(prefixParts[i]);
  }
  parts.push(tail);
  return joinTextParts(parts);
}
function splitSegmentByBreakKind(segment, isWordLike, start, whiteSpaceProfile) {
  if (!breakCharRe.test(segment)) {
    return [{ text: segment, isWordLike, kind: "text", start }];
  }
  const pieces = [];
  let currentKind = null;
  let currentTextParts = [];
  let currentStart = start;
  let currentWordLike = false;
  let offset = 0;
  for (const ch3 of segment) {
    const kind = classifySegmentBreakChar(ch3, whiteSpaceProfile);
    const wordLike = kind === "text" && isWordLike;
    if (currentKind !== null && kind === currentKind && wordLike === currentWordLike) {
      currentTextParts.push(ch3);
      offset += ch3.length;
      continue;
    }
    if (currentKind !== null) {
      pieces.push({
        text: joinTextParts(currentTextParts),
        isWordLike: currentWordLike,
        kind: currentKind,
        start: currentStart
      });
    }
    currentKind = kind;
    currentTextParts = [ch3];
    currentStart = start + offset;
    currentWordLike = wordLike;
    offset += ch3.length;
  }
  if (currentKind !== null) {
    pieces.push({
      text: joinTextParts(currentTextParts),
      isWordLike: currentWordLike,
      kind: currentKind,
      start: currentStart
    });
  }
  return pieces;
}
function isTextRunBoundary(kind) {
  return kind === "space" || kind === "preserved-space" || kind === "zero-width-break" || kind === "hard-break";
}
const urlSchemeSegmentRe = /^[A-Za-z][A-Za-z0-9+.-]*:$/;
function isUrlLikeRunStart(segmentation, index) {
  const text = segmentation.texts[index];
  if (text.startsWith("www."))
    return true;
  return urlSchemeSegmentRe.test(text) && index + 1 < segmentation.len && segmentation.kinds[index + 1] === "text" && segmentation.texts[index + 1] === "//";
}
function isUrlQueryBoundarySegment(text) {
  return text.includes("?") && (text.includes("://") || text.startsWith("www."));
}
function mergeUrlLikeRuns(segmentation) {
  const texts = segmentation.texts.slice();
  const isWordLike = segmentation.isWordLike.slice();
  const kinds = segmentation.kinds.slice();
  const starts = segmentation.starts.slice();
  for (let i = 0; i < segmentation.len; i++) {
    if (kinds[i] !== "text" || !isUrlLikeRunStart(segmentation, i))
      continue;
    const mergedParts = [texts[i]];
    let j = i + 1;
    while (j < segmentation.len && !isTextRunBoundary(kinds[j])) {
      mergedParts.push(texts[j]);
      isWordLike[i] = true;
      const endsQueryPrefix = texts[j].includes("?");
      kinds[j] = "text";
      texts[j] = "";
      j++;
      if (endsQueryPrefix)
        break;
    }
    texts[i] = joinTextParts(mergedParts);
  }
  let compactLen = 0;
  for (let read = 0; read < texts.length; read++) {
    const text = texts[read];
    if (text.length === 0)
      continue;
    if (compactLen !== read) {
      texts[compactLen] = text;
      isWordLike[compactLen] = isWordLike[read];
      kinds[compactLen] = kinds[read];
      starts[compactLen] = starts[read];
    }
    compactLen++;
  }
  texts.length = compactLen;
  isWordLike.length = compactLen;
  kinds.length = compactLen;
  starts.length = compactLen;
  return {
    len: compactLen,
    texts,
    isWordLike,
    kinds,
    starts
  };
}
function mergeUrlQueryRuns(segmentation) {
  const texts = [];
  const isWordLike = [];
  const kinds = [];
  const starts = [];
  for (let i = 0; i < segmentation.len; i++) {
    const text = segmentation.texts[i];
    texts.push(text);
    isWordLike.push(segmentation.isWordLike[i]);
    kinds.push(segmentation.kinds[i]);
    starts.push(segmentation.starts[i]);
    if (!isUrlQueryBoundarySegment(text))
      continue;
    const nextIndex = i + 1;
    if (nextIndex >= segmentation.len || isTextRunBoundary(segmentation.kinds[nextIndex])) {
      continue;
    }
    const queryParts = [];
    const queryStart = segmentation.starts[nextIndex];
    let j = nextIndex;
    while (j < segmentation.len && !isTextRunBoundary(segmentation.kinds[j])) {
      queryParts.push(segmentation.texts[j]);
      j++;
    }
    if (queryParts.length > 0) {
      texts.push(joinTextParts(queryParts));
      isWordLike.push(true);
      kinds.push("text");
      starts.push(queryStart);
      i = j - 1;
    }
  }
  return {
    len: texts.length,
    texts,
    isWordLike,
    kinds,
    starts
  };
}
const numericJoinerChars = /* @__PURE__ */ new Set([
  ":",
  "-",
  "/",
  "×",
  ",",
  ".",
  "+",
  "–",
  "—"
]);
const noSpacePunctuationChainJoiners = /* @__PURE__ */ new Set([".", ",", ":", ";"]);
function endsWithNoSpacePunctuationChainJoiner(text) {
  for (let end = text.length; end > 0; ) {
    const start = previousCodePointStart(text, end);
    const ch3 = text.slice(start, end);
    if (combiningMarkRe.test(ch3)) {
      end = start;
      continue;
    }
    return noSpacePunctuationChainJoiners.has(ch3) || isLineBreakNumericAffix(ch3);
  }
  return false;
}
function isNoSpacePunctuationChainSegment(text, wordLike) {
  return wordLike && !isCJK(text);
}
function segmentContainsDecimalDigit(text) {
  for (const ch3 of text) {
    if (decimalDigitRe.test(ch3))
      return true;
  }
  return false;
}
function isNumericRunSegment(text) {
  if (text.length === 0)
    return false;
  for (const ch3 of text) {
    if (decimalDigitRe.test(ch3) || numericJoinerChars.has(ch3))
      continue;
    return false;
  }
  return true;
}
function mergeNumericRuns(segmentation) {
  const texts = [];
  const isWordLike = [];
  const kinds = [];
  const starts = [];
  for (let i = 0; i < segmentation.len; i++) {
    const text = segmentation.texts[i];
    const kind = segmentation.kinds[i];
    if (kind === "text" && isNumericRunSegment(text) && segmentContainsDecimalDigit(text)) {
      const mergedParts = [text];
      let j = i + 1;
      while (j < segmentation.len && segmentation.kinds[j] === "text" && isNumericRunSegment(segmentation.texts[j])) {
        mergedParts.push(segmentation.texts[j]);
        j++;
      }
      texts.push(joinTextParts(mergedParts));
      isWordLike.push(true);
      kinds.push("text");
      starts.push(segmentation.starts[i]);
      i = j - 1;
      continue;
    }
    texts.push(text);
    isWordLike.push(segmentation.isWordLike[i]);
    kinds.push(kind);
    starts.push(segmentation.starts[i]);
  }
  return {
    len: texts.length,
    texts,
    isWordLike,
    kinds,
    starts
  };
}
function mergeNoSpacePunctuationChains(segmentation) {
  const texts = [];
  const isWordLike = [];
  const kinds = [];
  const starts = [];
  for (let i = 0; i < segmentation.len; i++) {
    const text = segmentation.texts[i];
    const kind = segmentation.kinds[i];
    const wordLike = segmentation.isWordLike[i];
    if (kind === "text" && endsWithNoSpacePunctuationChainJoiner(text) && (wordLike || endsWithLineBreakNumericAffix(text)) && !isCJK(text)) {
      const mergedParts = [text];
      let endsWithJoiners = true;
      let j = i + 1;
      while (endsWithJoiners && j < segmentation.len && segmentation.kinds[j] === "text" && isNoSpacePunctuationChainSegment(segmentation.texts[j], segmentation.isWordLike[j])) {
        const nextText = segmentation.texts[j];
        mergedParts.push(nextText);
        endsWithJoiners = endsWithNoSpacePunctuationChainJoiner(nextText);
        j++;
      }
      texts.push(joinTextParts(mergedParts));
      isWordLike.push(true);
      kinds.push("text");
      starts.push(segmentation.starts[i]);
      i = j - 1;
      continue;
    }
    texts.push(text);
    isWordLike.push(wordLike);
    kinds.push(kind);
    starts.push(segmentation.starts[i]);
  }
  return {
    len: texts.length,
    texts,
    isWordLike,
    kinds,
    starts
  };
}
function splitHyphenatedNumericRuns(segmentation) {
  const texts = [];
  const isWordLike = [];
  const kinds = [];
  const starts = [];
  for (let i = 0; i < segmentation.len; i++) {
    const text = segmentation.texts[i];
    if (segmentation.kinds[i] === "text" && text.includes("-")) {
      const parts = text.split("-");
      let shouldSplit = parts.length > 1;
      for (let j = 0; j < parts.length; j++) {
        const part = parts[j];
        if (!shouldSplit)
          break;
        if (part.length === 0 || !segmentContainsDecimalDigit(part) || !isNumericRunSegment(part)) {
          shouldSplit = false;
        }
      }
      if (shouldSplit) {
        let offset = 0;
        for (let j = 0; j < parts.length; j++) {
          const part = parts[j];
          const splitText = j < parts.length - 1 ? `${part}-` : part;
          texts.push(splitText);
          isWordLike.push(true);
          kinds.push("text");
          starts.push(segmentation.starts[i] + offset);
          offset += splitText.length;
        }
        continue;
      }
    }
    texts.push(text);
    isWordLike.push(segmentation.isWordLike[i]);
    kinds.push(segmentation.kinds[i]);
    starts.push(segmentation.starts[i]);
  }
  return {
    len: texts.length,
    texts,
    isWordLike,
    kinds,
    starts
  };
}
function mergeGlueConnectedTextRuns(segmentation) {
  const texts = [];
  const isWordLike = [];
  const kinds = [];
  const starts = [];
  let read = 0;
  while (read < segmentation.len) {
    const textParts = [segmentation.texts[read]];
    let wordLike = segmentation.isWordLike[read];
    let kind = segmentation.kinds[read];
    let start = segmentation.starts[read];
    if (kind === "glue") {
      const glueParts = [textParts[0]];
      const glueStart = start;
      read++;
      while (read < segmentation.len && segmentation.kinds[read] === "glue") {
        glueParts.push(segmentation.texts[read]);
        read++;
      }
      const glueText = joinTextParts(glueParts);
      if (read < segmentation.len && segmentation.kinds[read] === "text") {
        textParts[0] = glueText;
        textParts.push(segmentation.texts[read]);
        wordLike = segmentation.isWordLike[read];
        kind = "text";
        start = glueStart;
        read++;
      } else {
        texts.push(glueText);
        isWordLike.push(false);
        kinds.push("glue");
        starts.push(glueStart);
        continue;
      }
    } else {
      read++;
    }
    if (kind === "text") {
      while (read < segmentation.len && segmentation.kinds[read] === "glue") {
        const glueParts = [];
        while (read < segmentation.len && segmentation.kinds[read] === "glue") {
          glueParts.push(segmentation.texts[read]);
          read++;
        }
        const glueText = joinTextParts(glueParts);
        if (read < segmentation.len && segmentation.kinds[read] === "text") {
          textParts.push(glueText, segmentation.texts[read]);
          wordLike = wordLike || segmentation.isWordLike[read];
          read++;
          continue;
        }
        textParts.push(glueText);
      }
    }
    texts.push(joinTextParts(textParts));
    isWordLike.push(wordLike);
    kinds.push(kind);
    starts.push(start);
  }
  return {
    len: texts.length,
    texts,
    isWordLike,
    kinds,
    starts
  };
}
function carryTrailingForwardStickyAcrossCJKBoundary(segmentation) {
  const texts = segmentation.texts.slice();
  const isWordLike = segmentation.isWordLike.slice();
  const kinds = segmentation.kinds.slice();
  const starts = segmentation.starts.slice();
  for (let i = 0; i < texts.length - 1; i++) {
    if (kinds[i] !== "text" || kinds[i + 1] !== "text")
      continue;
    if (!isCJK(texts[i]) || !isCJK(texts[i + 1]))
      continue;
    const split = splitTrailingForwardStickyCluster(texts[i]);
    if (split === null)
      continue;
    texts[i] = split.head;
    texts[i + 1] = split.tail + texts[i + 1];
    starts[i + 1] = starts[i] + split.head.length;
  }
  return {
    len: texts.length,
    texts,
    isWordLike,
    kinds,
    starts
  };
}
function buildMergedSegmentation(normalized, profile, whiteSpaceProfile) {
  var _a2, _b2, _c;
  const wordSegmenter = getSharedWordSegmenter();
  let mergedLen = 0;
  const mergedTexts = [];
  const mergedTextParts = [];
  const mergedWordLike = [];
  const mergedKinds = [];
  const mergedStarts = [];
  const mergedSingleCharRunChars = [];
  const mergedSingleCharRunLengths = [];
  const mergedContainsCJK = [];
  const mergedContainsArabicScript = [];
  const mergedEndsWithClosingQuote = [];
  const mergedEndsWithMyanmarMedialGlue = [];
  const mergedHasArabicNoSpacePunctuation = [];
  for (const s of wordSegmenter.segment(normalized)) {
    for (const piece of splitSegmentByBreakKind(s.segment, (_a2 = s.isWordLike) != null ? _a2 : false, s.index, whiteSpaceProfile)) {
      let appendPieceToPrevious = function() {
        if (mergedSingleCharRunChars[prevIndex] !== null) {
          mergedTextParts[prevIndex] = [
            materializeDeferredSingleCharRun(mergedTexts, mergedSingleCharRunChars, mergedSingleCharRunLengths, prevIndex)
          ];
          mergedSingleCharRunChars[prevIndex] = null;
        }
        mergedTextParts[prevIndex].push(piece.text);
        mergedWordLike[prevIndex] = mergedWordLike[prevIndex] || piece.isWordLike;
        mergedContainsCJK[prevIndex] = mergedContainsCJK[prevIndex] || pieceContainsCJK;
        mergedContainsArabicScript[prevIndex] = mergedContainsArabicScript[prevIndex] || pieceContainsArabicScript;
        mergedEndsWithClosingQuote[prevIndex] = pieceEndsWithClosingQuote;
        mergedEndsWithMyanmarMedialGlue[prevIndex] = pieceEndsWithMyanmarMedialGlue;
        mergedHasArabicNoSpacePunctuation[prevIndex] = hasArabicNoSpacePunctuation(mergedContainsArabicScript[prevIndex], pieceLastCodePoint);
      };
      const isText = piece.kind === "text";
      const repeatableSingleCharRunChar = getRepeatableSingleCharRunChar(piece.text, piece.isWordLike, piece.kind);
      const pieceContainsCJK = isCJK(piece.text);
      const pieceContainsArabicScript = containsArabicScript(piece.text);
      const pieceLastCodePoint = getLastCodePoint(piece.text);
      const pieceEndsWithClosingQuote = endsWithClosingQuote(piece.text);
      const pieceEndsWithMyanmarMedialGlue = endsWithMyanmarMedialGlue(piece.text);
      const prevIndex = mergedLen - 1;
      if (profile.carryCJKAfterClosingQuote && isText && mergedLen > 0 && mergedKinds[prevIndex] === "text" && pieceContainsCJK && mergedContainsCJK[prevIndex] && mergedEndsWithClosingQuote[prevIndex]) {
        appendPieceToPrevious();
      } else if (isText && mergedLen > 0 && mergedKinds[prevIndex] === "text" && isCJKLineStartProhibitedSegment(piece.text) && mergedContainsCJK[prevIndex]) {
        appendPieceToPrevious();
      } else if (isText && mergedLen > 0 && mergedKinds[prevIndex] === "text" && mergedEndsWithMyanmarMedialGlue[prevIndex]) {
        appendPieceToPrevious();
      } else if (isText && mergedLen > 0 && mergedKinds[prevIndex] === "text" && piece.isWordLike && pieceContainsArabicScript && mergedHasArabicNoSpacePunctuation[prevIndex]) {
        appendPieceToPrevious();
        mergedWordLike[prevIndex] = true;
      } else if (repeatableSingleCharRunChar !== null && mergedLen > 0 && mergedKinds[prevIndex] === "text" && mergedSingleCharRunChars[prevIndex] === repeatableSingleCharRunChar) {
        mergedSingleCharRunLengths[prevIndex] = ((_b2 = mergedSingleCharRunLengths[prevIndex]) != null ? _b2 : 1) + 1;
      } else if (isText && !piece.isWordLike && mergedLen > 0 && mergedKinds[prevIndex] === "text" && !mergedContainsCJK[prevIndex] && (isLeftStickyPunctuationSegment(piece.text) || piece.text === "-" && mergedWordLike[prevIndex])) {
        appendPieceToPrevious();
      } else {
        mergedTexts[mergedLen] = piece.text;
        mergedTextParts[mergedLen] = [piece.text];
        mergedWordLike[mergedLen] = piece.isWordLike;
        mergedKinds[mergedLen] = piece.kind;
        mergedStarts[mergedLen] = piece.start;
        mergedSingleCharRunChars[mergedLen] = repeatableSingleCharRunChar;
        mergedSingleCharRunLengths[mergedLen] = repeatableSingleCharRunChar === null ? 0 : 1;
        mergedContainsCJK[mergedLen] = pieceContainsCJK;
        mergedContainsArabicScript[mergedLen] = pieceContainsArabicScript;
        mergedEndsWithClosingQuote[mergedLen] = pieceEndsWithClosingQuote;
        mergedEndsWithMyanmarMedialGlue[mergedLen] = pieceEndsWithMyanmarMedialGlue;
        mergedHasArabicNoSpacePunctuation[mergedLen] = hasArabicNoSpacePunctuation(pieceContainsArabicScript, pieceLastCodePoint);
        mergedLen++;
      }
    }
  }
  for (let i = 0; i < mergedLen; i++) {
    if (mergedSingleCharRunChars[i] !== null) {
      mergedTexts[i] = materializeDeferredSingleCharRun(mergedTexts, mergedSingleCharRunChars, mergedSingleCharRunLengths, i);
      continue;
    }
    mergedTexts[i] = joinTextParts(mergedTextParts[i]);
  }
  for (let i = 1; i < mergedLen; i++) {
    if (mergedKinds[i] === "text" && !mergedWordLike[i] && isEscapedQuoteClusterSegment(mergedTexts[i]) && mergedKinds[i - 1] === "text" && !mergedContainsCJK[i - 1]) {
      mergedTexts[i - 1] += mergedTexts[i];
      mergedWordLike[i - 1] = mergedWordLike[i - 1] || mergedWordLike[i];
      mergedTexts[i] = "";
    }
  }
  const forwardStickyPrefixParts = Array.from({ length: mergedLen }, () => null);
  let nextLiveIndex = -1;
  for (let i = mergedLen - 1; i >= 0; i--) {
    const text = mergedTexts[i];
    if (text.length === 0)
      continue;
    if (mergedKinds[i] === "text" && !mergedWordLike[i] && nextLiveIndex >= 0 && mergedKinds[nextLiveIndex] === "text" && (isForwardStickyClusterSegment(text) || text === "-" && startsWithDecimalDigit(mergedTexts[nextLiveIndex]))) {
      const prefixParts = (_c = forwardStickyPrefixParts[nextLiveIndex]) != null ? _c : [];
      prefixParts.push(text);
      forwardStickyPrefixParts[nextLiveIndex] = prefixParts;
      mergedStarts[nextLiveIndex] = mergedStarts[i];
      mergedTexts[i] = "";
      continue;
    }
    nextLiveIndex = i;
  }
  for (let i = 0; i < mergedLen; i++) {
    const prefixParts = forwardStickyPrefixParts[i];
    if (prefixParts == null)
      continue;
    mergedTexts[i] = joinReversedPrefixParts(prefixParts, mergedTexts[i]);
  }
  let compactLen = 0;
  for (let read = 0; read < mergedLen; read++) {
    const text = mergedTexts[read];
    if (text.length === 0)
      continue;
    if (compactLen !== read) {
      mergedTexts[compactLen] = text;
      mergedWordLike[compactLen] = mergedWordLike[read];
      mergedKinds[compactLen] = mergedKinds[read];
      mergedStarts[compactLen] = mergedStarts[read];
    }
    compactLen++;
  }
  mergedTexts.length = compactLen;
  mergedWordLike.length = compactLen;
  mergedKinds.length = compactLen;
  mergedStarts.length = compactLen;
  const compacted = mergeGlueConnectedTextRuns({
    len: compactLen,
    texts: mergedTexts,
    isWordLike: mergedWordLike,
    kinds: mergedKinds,
    starts: mergedStarts
  });
  const withMergedUrls = carryTrailingForwardStickyAcrossCJKBoundary(mergeNoSpacePunctuationChains(splitHyphenatedNumericRuns(mergeNumericRuns(mergeUrlQueryRuns(mergeUrlLikeRuns(compacted))))));
  for (let i = 0; i < withMergedUrls.len - 1; i++) {
    const split = splitLeadingSpaceAndMarks(withMergedUrls.texts[i]);
    if (split === null)
      continue;
    if (withMergedUrls.kinds[i] !== "space" && withMergedUrls.kinds[i] !== "preserved-space" || withMergedUrls.kinds[i + 1] !== "text" || !containsArabicScript(withMergedUrls.texts[i + 1])) {
      continue;
    }
    withMergedUrls.texts[i] = split.space;
    withMergedUrls.isWordLike[i] = false;
    withMergedUrls.kinds[i] = withMergedUrls.kinds[i] === "preserved-space" ? "preserved-space" : "space";
    withMergedUrls.texts[i + 1] = split.marks + withMergedUrls.texts[i + 1];
    withMergedUrls.starts[i + 1] = withMergedUrls.starts[i] + split.space.length;
  }
  return withMergedUrls;
}
function compileAnalysisChunks(segmentation, whiteSpaceProfile) {
  if (segmentation.len === 0)
    return [];
  if (!whiteSpaceProfile.preserveHardBreaks) {
    return [{
      startSegmentIndex: 0,
      endSegmentIndex: segmentation.len,
      consumedEndSegmentIndex: segmentation.len
    }];
  }
  const chunks = [];
  let startSegmentIndex = 0;
  for (let i = 0; i < segmentation.len; i++) {
    if (segmentation.kinds[i] !== "hard-break")
      continue;
    chunks.push({
      startSegmentIndex,
      endSegmentIndex: i,
      consumedEndSegmentIndex: i + 1
    });
    startSegmentIndex = i + 1;
  }
  if (startSegmentIndex < segmentation.len) {
    chunks.push({
      startSegmentIndex,
      endSegmentIndex: segmentation.len,
      consumedEndSegmentIndex: segmentation.len
    });
  }
  return chunks;
}
function mergeKeepAllTextSegments(normalized, segmentation, breakAfterPunctuation) {
  if (segmentation.len <= 1)
    return segmentation;
  const texts = [];
  const isWordLike = [];
  const kinds = [];
  const starts = [];
  let groupStart = -1;
  let groupContainsCJK = false;
  function pushOriginalText(index) {
    texts.push(segmentation.texts[index]);
    isWordLike.push(segmentation.isWordLike[index]);
    kinds.push("text");
    starts.push(segmentation.starts[index]);
  }
  function pushMergedText(start, end) {
    let wordLike = false;
    for (let i = start; i < end; i++) {
      wordLike = wordLike || segmentation.isWordLike[i];
    }
    const sourceStart = segmentation.starts[start];
    const sourceEnd = end < segmentation.len ? segmentation.starts[end] : normalized.length;
    texts.push(normalized.slice(sourceStart, sourceEnd));
    isWordLike.push(wordLike);
    kinds.push("text");
    starts.push(sourceStart);
  }
  function flushGroup(end) {
    if (groupStart < 0)
      return;
    if (groupContainsCJK) {
      if (groupStart + 1 === end) {
        pushOriginalText(groupStart);
      } else {
        pushMergedText(groupStart, end);
      }
    } else {
      for (let i = groupStart; i < end; i++)
        pushOriginalText(i);
    }
    groupStart = -1;
    groupContainsCJK = false;
  }
  for (let i = 0; i < segmentation.len; i++) {
    const text = segmentation.texts[i];
    const kind = segmentation.kinds[i];
    if (kind === "text") {
      if (groupStart >= 0 && !canContinueKeepAllTextRun(segmentation.texts[i - 1], breakAfterPunctuation)) {
        flushGroup(i);
      }
      if (groupStart < 0)
        groupStart = i;
      groupContainsCJK = groupContainsCJK || isCJK(text);
      continue;
    }
    flushGroup(i);
    texts.push(text);
    isWordLike.push(segmentation.isWordLike[i]);
    kinds.push(kind);
    starts.push(segmentation.starts[i]);
  }
  flushGroup(segmentation.len);
  return {
    len: texts.length,
    texts,
    isWordLike,
    kinds,
    starts
  };
}
function analyzeText(text, profile, whiteSpace = "normal", wordBreak = "normal") {
  const whiteSpaceProfile = getWhiteSpaceProfile(whiteSpace);
  const normalized = whiteSpaceProfile.mode === "pre-wrap" ? normalizeWhitespacePreWrap(text) : normalizeWhitespaceNormal(text);
  if (normalized.length === 0) {
    return {
      normalized,
      chunks: [],
      len: 0,
      texts: [],
      isWordLike: [],
      kinds: [],
      starts: []
    };
  }
  const mergedSegmentation = buildMergedSegmentation(normalized, profile, whiteSpaceProfile);
  const segmentation = wordBreak === "keep-all" ? mergeKeepAllTextSegments(normalized, mergedSegmentation, profile.breakKeepAllAfterPunctuation) : mergedSegmentation;
  return {
    normalized,
    chunks: compileAnalysisChunks(segmentation, whiteSpaceProfile),
    ...segmentation
  };
}
let measureContext = null;
const segmentMetricCaches = /* @__PURE__ */ new Map();
let cachedEngineProfile = null;
const MAX_PREFIX_FIT_GRAPHEMES = 96;
const emojiPresentationRe = /\p{Emoji_Presentation}/u;
const maybeEmojiRe = /[\p{Emoji_Presentation}\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u20E3]/u;
let sharedGraphemeSegmenter$2 = null;
const emojiCorrectionCache = /* @__PURE__ */ new Map();
function getMeasureContext() {
  if (measureContext !== null)
    return measureContext;
  if (typeof OffscreenCanvas !== "undefined") {
    measureContext = new OffscreenCanvas(1, 1).getContext("2d");
    return measureContext;
  }
  if (typeof document !== "undefined") {
    measureContext = document.createElement("canvas").getContext("2d");
    return measureContext;
  }
  throw new Error("Text measurement requires OffscreenCanvas or a DOM canvas context.");
}
function getSegmentMetricCache(font) {
  let cache = segmentMetricCaches.get(font);
  if (!cache) {
    cache = /* @__PURE__ */ new Map();
    segmentMetricCaches.set(font, cache);
  }
  return cache;
}
function getSegmentMetrics(seg, cache) {
  let metrics = cache.get(seg);
  if (metrics === void 0) {
    const ctx = getMeasureContext();
    metrics = {
      width: ctx.measureText(seg).width,
      containsCJK: isCJK(seg)
    };
    cache.set(seg, metrics);
  }
  return metrics;
}
function getEngineProfile() {
  if (cachedEngineProfile !== null)
    return cachedEngineProfile;
  if (typeof navigator === "undefined") {
    cachedEngineProfile = {
      lineFitEpsilon: 5e-3,
      carryCJKAfterClosingQuote: false,
      breakKeepAllAfterPunctuation: true,
      preferPrefixWidthsForBreakableRuns: false,
      preferEarlySoftHyphenBreak: false
    };
    return cachedEngineProfile;
  }
  const ua = navigator.userAgent;
  const vendor = navigator.vendor;
  const isSafari = vendor === "Apple Computer, Inc." && ua.includes("Safari/") && !ua.includes("Chrome/") && !ua.includes("Chromium/") && !ua.includes("CriOS/") && !ua.includes("FxiOS/") && !ua.includes("EdgiOS/");
  const isChromium = ua.includes("Chrome/") || ua.includes("Chromium/") || ua.includes("CriOS/") || ua.includes("Edg/");
  cachedEngineProfile = {
    lineFitEpsilon: isSafari ? 1 / 64 : 5e-3,
    carryCJKAfterClosingQuote: isChromium,
    breakKeepAllAfterPunctuation: !isSafari,
    preferPrefixWidthsForBreakableRuns: isSafari,
    preferEarlySoftHyphenBreak: isSafari
  };
  return cachedEngineProfile;
}
function parseFontSize(font) {
  const m = font.match(/(\d+(?:\.\d+)?)\s*px/);
  return m ? parseFloat(m[1]) : 16;
}
function getSharedGraphemeSegmenter$2() {
  if (sharedGraphemeSegmenter$2 === null) {
    sharedGraphemeSegmenter$2 = new Intl.Segmenter(void 0, { granularity: "grapheme" });
  }
  return sharedGraphemeSegmenter$2;
}
function isEmojiGrapheme(g) {
  return emojiPresentationRe.test(g) || g.includes("️");
}
function textMayContainEmoji(text) {
  return maybeEmojiRe.test(text);
}
function getEmojiCorrection(font, fontSize) {
  let correction = emojiCorrectionCache.get(font);
  if (correction !== void 0)
    return correction;
  const ctx = getMeasureContext();
  ctx.font = font;
  const canvasW = ctx.measureText("😀").width;
  correction = 0;
  if (canvasW > fontSize + 0.5 && typeof document !== "undefined" && document.body !== null) {
    const span = document.createElement("span");
    span.style.font = font;
    span.style.display = "inline-block";
    span.style.visibility = "hidden";
    span.style.position = "absolute";
    span.textContent = "😀";
    document.body.appendChild(span);
    const domW = span.getBoundingClientRect().width;
    document.body.removeChild(span);
    if (canvasW - domW > 0.5) {
      correction = canvasW - domW;
    }
  }
  emojiCorrectionCache.set(font, correction);
  return correction;
}
function countEmojiGraphemes(text) {
  let count = 0;
  const graphemeSegmenter = getSharedGraphemeSegmenter$2();
  for (const g of graphemeSegmenter.segment(text)) {
    if (isEmojiGrapheme(g.segment))
      count++;
  }
  return count;
}
function getEmojiCount(seg, metrics) {
  if (metrics.emojiCount === void 0) {
    metrics.emojiCount = countEmojiGraphemes(seg);
  }
  return metrics.emojiCount;
}
function getCorrectedSegmentWidth(seg, metrics, emojiCorrection) {
  if (emojiCorrection === 0)
    return metrics.width;
  return metrics.width - getEmojiCount(seg, metrics) * emojiCorrection;
}
function getSegmentBreakableFitAdvances(seg, metrics, cache, emojiCorrection, mode) {
  if (metrics.breakableFitAdvances !== void 0 && metrics.breakableFitMode === mode) {
    return metrics.breakableFitAdvances;
  }
  metrics.breakableFitMode = mode;
  const graphemeSegmenter = getSharedGraphemeSegmenter$2();
  const graphemes = [];
  for (const gs of graphemeSegmenter.segment(seg)) {
    graphemes.push(gs.segment);
  }
  if (graphemes.length <= 1) {
    metrics.breakableFitAdvances = null;
    return metrics.breakableFitAdvances;
  }
  if (mode === "sum-graphemes") {
    const advances2 = [];
    for (const grapheme of graphemes) {
      const graphemeMetrics = getSegmentMetrics(grapheme, cache);
      advances2.push(getCorrectedSegmentWidth(grapheme, graphemeMetrics, emojiCorrection));
    }
    metrics.breakableFitAdvances = advances2;
    return metrics.breakableFitAdvances;
  }
  if (mode === "pair-context" || graphemes.length > MAX_PREFIX_FIT_GRAPHEMES) {
    const advances2 = [];
    let previousGrapheme = null;
    let previousWidth = 0;
    for (const grapheme of graphemes) {
      const graphemeMetrics = getSegmentMetrics(grapheme, cache);
      const currentWidth = getCorrectedSegmentWidth(grapheme, graphemeMetrics, emojiCorrection);
      if (previousGrapheme === null) {
        advances2.push(currentWidth);
      } else {
        const pair = previousGrapheme + grapheme;
        const pairMetrics = getSegmentMetrics(pair, cache);
        advances2.push(getCorrectedSegmentWidth(pair, pairMetrics, emojiCorrection) - previousWidth);
      }
      previousGrapheme = grapheme;
      previousWidth = currentWidth;
    }
    metrics.breakableFitAdvances = advances2;
    return metrics.breakableFitAdvances;
  }
  const advances = [];
  let prefix = "";
  let prefixWidth = 0;
  for (const grapheme of graphemes) {
    prefix += grapheme;
    const prefixMetrics = getSegmentMetrics(prefix, cache);
    const nextPrefixWidth = getCorrectedSegmentWidth(prefix, prefixMetrics, emojiCorrection);
    advances.push(nextPrefixWidth - prefixWidth);
    prefixWidth = nextPrefixWidth;
  }
  metrics.breakableFitAdvances = advances;
  return metrics.breakableFitAdvances;
}
function getFontMeasurementState(font, needsEmojiCorrection) {
  const ctx = getMeasureContext();
  ctx.font = font;
  const cache = getSegmentMetricCache(font);
  const fontSize = parseFontSize(font);
  const emojiCorrection = needsEmojiCorrection ? getEmojiCorrection(font, fontSize) : 0;
  return { cache, fontSize, emojiCorrection };
}
function consumesAtLineStart(kind) {
  return kind === "space" || kind === "zero-width-break" || kind === "soft-hyphen";
}
function breaksAfter(kind) {
  return kind === "space" || kind === "preserved-space" || kind === "tab" || kind === "zero-width-break" || kind === "soft-hyphen";
}
function normalizeLineStartSegmentIndex(prepared, segmentIndex, endSegmentIndex = prepared.widths.length) {
  while (segmentIndex < endSegmentIndex) {
    const kind = prepared.kinds[segmentIndex];
    if (!consumesAtLineStart(kind))
      break;
    segmentIndex++;
  }
  return segmentIndex;
}
function getTabAdvance(lineWidth, tabStopAdvance) {
  if (tabStopAdvance <= 0)
    return 0;
  const remainder = lineWidth % tabStopAdvance;
  if (Math.abs(remainder) <= 1e-6)
    return tabStopAdvance;
  return tabStopAdvance - remainder;
}
function getLeadingLetterSpacing(prepared, hasContent, segmentIndex) {
  return prepared.letterSpacing !== 0 && hasContent && prepared.spacingGraphemeCounts[segmentIndex] > 0 ? prepared.letterSpacing : 0;
}
function getLineEndContribution(leadingSpacing, segmentContribution) {
  return segmentContribution === 0 ? 0 : leadingSpacing + segmentContribution;
}
function getTabTrailingLetterSpacing(prepared, segmentIndex) {
  return prepared.letterSpacing !== 0 && prepared.spacingGraphemeCounts[segmentIndex] > 0 ? prepared.letterSpacing : 0;
}
function getWholeSegmentFitContribution(prepared, kind, segmentIndex, leadingSpacing, segmentWidth) {
  const segmentContribution = kind === "tab" ? segmentWidth + getTabTrailingLetterSpacing(prepared, segmentIndex) : prepared.lineEndFitAdvances[segmentIndex];
  return getLineEndContribution(leadingSpacing, segmentContribution);
}
function getBreakOpportunityFitContribution(prepared, kind, segmentIndex, leadingSpacing) {
  const segmentContribution = kind === "tab" ? 0 : prepared.lineEndFitAdvances[segmentIndex];
  return getLineEndContribution(leadingSpacing, segmentContribution);
}
function getLineEndPaintContribution(prepared, kind, segmentIndex, leadingSpacing, segmentWidth) {
  const segmentContribution = kind === "tab" ? segmentWidth : prepared.lineEndPaintAdvances[segmentIndex];
  return getLineEndContribution(leadingSpacing, segmentContribution);
}
function getBreakableGraphemeAdvance(prepared, hasContent, baseAdvance) {
  return prepared.letterSpacing !== 0 && hasContent ? baseAdvance + prepared.letterSpacing : baseAdvance;
}
function getBreakableCandidateFitWidth(prepared, candidatePaintWidth) {
  return prepared.letterSpacing === 0 ? candidatePaintWidth : candidatePaintWidth + prepared.letterSpacing;
}
function getTerminalLetterSpacing(prepared, startSegmentIndex, startGraphemeIndex, endSegmentIndex, endGraphemeIndex) {
  if (prepared.letterSpacing === 0)
    return 0;
  if (endGraphemeIndex > 0) {
    return prepared.spacingGraphemeCounts[endSegmentIndex] > 0 ? prepared.letterSpacing : 0;
  }
  for (let i = endSegmentIndex - 1; i >= startSegmentIndex; i--) {
    const kind = prepared.kinds[i];
    if (kind === "space" || kind === "zero-width-break" || kind === "hard-break")
      continue;
    if (kind === "soft-hyphen") {
      if (i === endSegmentIndex - 1)
        return 0;
      continue;
    }
    if (i === startSegmentIndex && startGraphemeIndex > 0) {
      return prepared.letterSpacing;
    }
    return prepared.spacingGraphemeCounts[i] > 0 ? prepared.letterSpacing : 0;
  }
  return 0;
}
function finalizeLinePaintWidth(prepared, width, startSegmentIndex, startGraphemeIndex, endSegmentIndex, endGraphemeIndex) {
  return width + getTerminalLetterSpacing(prepared, startSegmentIndex, startGraphemeIndex, endSegmentIndex, endGraphemeIndex);
}
function findChunkIndexForStart(prepared, segmentIndex) {
  let lo = 0;
  let hi = prepared.chunks.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (segmentIndex < prepared.chunks[mid].consumedEndSegmentIndex) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  return lo < prepared.chunks.length ? lo : -1;
}
function normalizeLineStartInChunk(prepared, chunkIndex, cursor) {
  let segmentIndex = cursor.segmentIndex;
  if (cursor.graphemeIndex > 0)
    return chunkIndex;
  const chunk = prepared.chunks[chunkIndex];
  if (chunk.startSegmentIndex === chunk.endSegmentIndex && segmentIndex === chunk.startSegmentIndex) {
    cursor.segmentIndex = segmentIndex;
    cursor.graphemeIndex = 0;
    return chunkIndex;
  }
  if (segmentIndex < chunk.startSegmentIndex)
    segmentIndex = chunk.startSegmentIndex;
  segmentIndex = normalizeLineStartSegmentIndex(prepared, segmentIndex, chunk.endSegmentIndex);
  if (segmentIndex < chunk.endSegmentIndex) {
    cursor.segmentIndex = segmentIndex;
    cursor.graphemeIndex = 0;
    return chunkIndex;
  }
  if (chunk.consumedEndSegmentIndex >= prepared.widths.length)
    return -1;
  cursor.segmentIndex = chunk.consumedEndSegmentIndex;
  cursor.graphemeIndex = 0;
  return chunkIndex + 1;
}
function normalizePreparedLineStart(prepared, cursor) {
  if (cursor.segmentIndex >= prepared.widths.length)
    return -1;
  const chunkIndex = findChunkIndexForStart(prepared, cursor.segmentIndex);
  if (chunkIndex < 0)
    return -1;
  return normalizeLineStartInChunk(prepared, chunkIndex, cursor);
}
function walkPreparedLinesSimple(prepared, maxWidth, onLine) {
  const { widths, kinds, breakableFitAdvances } = prepared;
  if (widths.length === 0)
    return 0;
  const engineProfile = getEngineProfile();
  const lineFitEpsilon = engineProfile.lineFitEpsilon;
  const fitLimit = maxWidth + lineFitEpsilon;
  let lineCount = 0;
  let lineW = 0;
  let hasContent = false;
  let lineStartSegmentIndex = 0;
  let lineStartGraphemeIndex = 0;
  let lineEndSegmentIndex = 0;
  let lineEndGraphemeIndex = 0;
  let pendingBreakSegmentIndex = -1;
  let pendingBreakPaintWidth = 0;
  function clearPendingBreak() {
    pendingBreakSegmentIndex = -1;
    pendingBreakPaintWidth = 0;
  }
  function emitCurrentLine(endSegmentIndex = lineEndSegmentIndex, endGraphemeIndex = lineEndGraphemeIndex, width = lineW) {
    lineCount++;
    onLine == null ? void 0 : onLine(width, lineStartSegmentIndex, lineStartGraphemeIndex, endSegmentIndex, endGraphemeIndex);
    lineW = 0;
    hasContent = false;
    clearPendingBreak();
  }
  function startLineAtSegment(segmentIndex, width) {
    hasContent = true;
    lineStartSegmentIndex = segmentIndex;
    lineStartGraphemeIndex = 0;
    lineEndSegmentIndex = segmentIndex + 1;
    lineEndGraphemeIndex = 0;
    lineW = width;
  }
  function startLineAtGrapheme(segmentIndex, graphemeIndex, width) {
    hasContent = true;
    lineStartSegmentIndex = segmentIndex;
    lineStartGraphemeIndex = graphemeIndex;
    lineEndSegmentIndex = segmentIndex;
    lineEndGraphemeIndex = graphemeIndex + 1;
    lineW = width;
  }
  function appendWholeSegment(segmentIndex, width) {
    if (!hasContent) {
      startLineAtSegment(segmentIndex, width);
      return;
    }
    lineW += width;
    lineEndSegmentIndex = segmentIndex + 1;
    lineEndGraphemeIndex = 0;
  }
  function appendBreakableSegmentFrom(segmentIndex, startGraphemeIndex) {
    const fitAdvances = breakableFitAdvances[segmentIndex];
    for (let g = startGraphemeIndex; g < fitAdvances.length; g++) {
      const gw = fitAdvances[g];
      if (!hasContent) {
        startLineAtGrapheme(segmentIndex, g, gw);
      } else if (lineW + gw > fitLimit) {
        emitCurrentLine();
        startLineAtGrapheme(segmentIndex, g, gw);
      } else {
        lineW += gw;
        lineEndSegmentIndex = segmentIndex;
        lineEndGraphemeIndex = g + 1;
      }
    }
    if (hasContent && lineEndSegmentIndex === segmentIndex && lineEndGraphemeIndex === fitAdvances.length) {
      lineEndSegmentIndex = segmentIndex + 1;
      lineEndGraphemeIndex = 0;
    }
  }
  let i = 0;
  while (i < widths.length) {
    if (!hasContent) {
      i = normalizeLineStartSegmentIndex(prepared, i);
      if (i >= widths.length)
        break;
    }
    const w = widths[i];
    const kind = kinds[i];
    const breakAfter = breaksAfter(kind);
    if (!hasContent) {
      if (w > fitLimit && breakableFitAdvances[i] !== null) {
        appendBreakableSegmentFrom(i, 0);
      } else {
        startLineAtSegment(i, w);
      }
      if (breakAfter) {
        pendingBreakSegmentIndex = i + 1;
        pendingBreakPaintWidth = lineW - w;
      }
      i++;
      continue;
    }
    const newW = lineW + w;
    if (newW > fitLimit) {
      if (breakAfter) {
        appendWholeSegment(i, w);
        emitCurrentLine(i + 1, 0, lineW - w);
        i++;
        continue;
      }
      if (pendingBreakSegmentIndex >= 0) {
        if (lineEndSegmentIndex > pendingBreakSegmentIndex || lineEndSegmentIndex === pendingBreakSegmentIndex && lineEndGraphemeIndex > 0) {
          emitCurrentLine();
          continue;
        }
        emitCurrentLine(pendingBreakSegmentIndex, 0, pendingBreakPaintWidth);
        continue;
      }
      if (w > fitLimit && breakableFitAdvances[i] !== null) {
        emitCurrentLine();
        appendBreakableSegmentFrom(i, 0);
        i++;
        continue;
      }
      emitCurrentLine();
      continue;
    }
    appendWholeSegment(i, w);
    if (breakAfter) {
      pendingBreakSegmentIndex = i + 1;
      pendingBreakPaintWidth = lineW - w;
    }
    i++;
  }
  if (hasContent)
    emitCurrentLine();
  return lineCount;
}
function walkPreparedLinesRaw(prepared, maxWidth, onLine) {
  if (prepared.simpleLineWalkFastPath) {
    return walkPreparedLinesSimple(prepared, maxWidth, onLine);
  }
  const { widths, kinds, breakableFitAdvances, discretionaryHyphenWidth, chunks } = prepared;
  if (widths.length === 0 || chunks.length === 0)
    return 0;
  const engineProfile = getEngineProfile();
  const lineFitEpsilon = engineProfile.lineFitEpsilon;
  const fitLimit = maxWidth + lineFitEpsilon;
  let lineCount = 0;
  let lineW = 0;
  let hasContent = false;
  let lineStartSegmentIndex = 0;
  let lineStartGraphemeIndex = 0;
  let lineEndSegmentIndex = 0;
  let lineEndGraphemeIndex = 0;
  let pendingBreakSegmentIndex = -1;
  let pendingBreakFitWidth = 0;
  let pendingBreakPaintWidth = 0;
  let pendingBreakKind = null;
  function clearPendingBreak() {
    pendingBreakSegmentIndex = -1;
    pendingBreakFitWidth = 0;
    pendingBreakPaintWidth = 0;
    pendingBreakKind = null;
  }
  function getCurrentLinePaintWidth() {
    return pendingBreakKind === "soft-hyphen" && pendingBreakSegmentIndex === lineEndSegmentIndex && lineEndGraphemeIndex === 0 ? pendingBreakPaintWidth : lineW;
  }
  function emitCurrentLine(endSegmentIndex = lineEndSegmentIndex, endGraphemeIndex = lineEndGraphemeIndex, width) {
    lineCount++;
    if (onLine !== void 0) {
      onLine(finalizeLinePaintWidth(prepared, width != null ? width : getCurrentLinePaintWidth(), lineStartSegmentIndex, lineStartGraphemeIndex, endSegmentIndex, endGraphemeIndex), lineStartSegmentIndex, lineStartGraphemeIndex, endSegmentIndex, endGraphemeIndex);
    }
    lineW = 0;
    hasContent = false;
    clearPendingBreak();
  }
  function startLineAtSegment(segmentIndex, width) {
    hasContent = true;
    lineStartSegmentIndex = segmentIndex;
    lineStartGraphemeIndex = 0;
    lineEndSegmentIndex = segmentIndex + 1;
    lineEndGraphemeIndex = 0;
    lineW = width;
  }
  function startLineAtGrapheme(segmentIndex, graphemeIndex, width) {
    hasContent = true;
    lineStartSegmentIndex = segmentIndex;
    lineStartGraphemeIndex = graphemeIndex;
    lineEndSegmentIndex = segmentIndex;
    lineEndGraphemeIndex = graphemeIndex + 1;
    lineW = width;
  }
  function appendWholeSegment(segmentIndex, advance) {
    if (!hasContent) {
      startLineAtSegment(segmentIndex, advance);
      return;
    }
    lineW += advance;
    lineEndSegmentIndex = segmentIndex + 1;
    lineEndGraphemeIndex = 0;
  }
  function updatePendingBreakForWholeSegment(kind, breakAfter, segmentIndex, segmentWidth, leadingSpacing, advance) {
    if (!breakAfter)
      return;
    const fitAdvance = getBreakOpportunityFitContribution(prepared, kind, segmentIndex, leadingSpacing);
    const paintAdvance = getLineEndPaintContribution(prepared, kind, segmentIndex, leadingSpacing, segmentWidth);
    pendingBreakSegmentIndex = segmentIndex + 1;
    pendingBreakFitWidth = lineW - advance + fitAdvance;
    pendingBreakPaintWidth = lineW - advance + paintAdvance;
    pendingBreakKind = kind;
  }
  function appendBreakableSegmentFrom(segmentIndex, startGraphemeIndex) {
    const fitAdvances = breakableFitAdvances[segmentIndex];
    for (let g = startGraphemeIndex; g < fitAdvances.length; g++) {
      const baseGw = fitAdvances[g];
      if (!hasContent) {
        startLineAtGrapheme(segmentIndex, g, baseGw);
      } else {
        const gw = getBreakableGraphemeAdvance(prepared, true, baseGw);
        const candidatePaintWidth = lineW + gw;
        if (getBreakableCandidateFitWidth(prepared, candidatePaintWidth) > fitLimit) {
          emitCurrentLine();
          startLineAtGrapheme(segmentIndex, g, baseGw);
        } else {
          lineW = candidatePaintWidth;
          lineEndSegmentIndex = segmentIndex;
          lineEndGraphemeIndex = g + 1;
        }
      }
    }
    if (hasContent && lineEndSegmentIndex === segmentIndex && lineEndGraphemeIndex === fitAdvances.length) {
      lineEndSegmentIndex = segmentIndex + 1;
      lineEndGraphemeIndex = 0;
    }
  }
  function emitEmptyChunk(chunk) {
    lineCount++;
    onLine == null ? void 0 : onLine(0, chunk.startSegmentIndex, 0, chunk.consumedEndSegmentIndex, 0);
    clearPendingBreak();
  }
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex];
    if (chunk.startSegmentIndex === chunk.endSegmentIndex) {
      emitEmptyChunk(chunk);
      continue;
    }
    hasContent = false;
    lineW = 0;
    lineStartSegmentIndex = chunk.startSegmentIndex;
    lineStartGraphemeIndex = 0;
    lineEndSegmentIndex = chunk.startSegmentIndex;
    lineEndGraphemeIndex = 0;
    clearPendingBreak();
    let i = chunk.startSegmentIndex;
    while (i < chunk.endSegmentIndex) {
      if (!hasContent) {
        i = normalizeLineStartSegmentIndex(prepared, i, chunk.endSegmentIndex);
        if (i >= chunk.endSegmentIndex)
          break;
      }
      const kind = kinds[i];
      const breakAfter = breaksAfter(kind);
      const leadingSpacing = getLeadingLetterSpacing(prepared, hasContent, i);
      const w = kind === "tab" ? getTabAdvance(lineW + leadingSpacing, prepared.tabStopAdvance) : widths[i];
      const advance = leadingSpacing + w;
      const fitAdvance = getWholeSegmentFitContribution(prepared, kind, i, leadingSpacing, w);
      if (kind === "soft-hyphen") {
        if (hasContent) {
          lineEndSegmentIndex = i + 1;
          lineEndGraphemeIndex = 0;
          pendingBreakSegmentIndex = i + 1;
          pendingBreakFitWidth = lineW + discretionaryHyphenWidth;
          pendingBreakPaintWidth = lineW + discretionaryHyphenWidth;
          pendingBreakKind = kind;
        }
        i++;
        continue;
      }
      if (!hasContent) {
        if (fitAdvance > fitLimit && breakableFitAdvances[i] !== null) {
          appendBreakableSegmentFrom(i, 0);
        } else {
          startLineAtSegment(i, w);
        }
        updatePendingBreakForWholeSegment(kind, breakAfter, i, w, leadingSpacing, advance);
        i++;
        continue;
      }
      const newFitW = lineW + fitAdvance;
      if (newFitW > fitLimit) {
        const currentBreakFitWidth = lineW + getBreakOpportunityFitContribution(prepared, kind, i, leadingSpacing);
        const currentBreakPaintWidth = lineW + getLineEndPaintContribution(prepared, kind, i, leadingSpacing, w);
        if (pendingBreakKind === "soft-hyphen" && engineProfile.preferEarlySoftHyphenBreak && pendingBreakFitWidth <= fitLimit) {
          emitCurrentLine(pendingBreakSegmentIndex, 0, pendingBreakPaintWidth);
          continue;
        }
        if (breakAfter && currentBreakFitWidth <= fitLimit) {
          appendWholeSegment(i, advance);
          emitCurrentLine(i + 1, 0, currentBreakPaintWidth);
          i++;
          continue;
        }
        if (pendingBreakSegmentIndex >= 0 && pendingBreakFitWidth <= fitLimit) {
          if (lineEndSegmentIndex > pendingBreakSegmentIndex || lineEndSegmentIndex === pendingBreakSegmentIndex && lineEndGraphemeIndex > 0) {
            emitCurrentLine();
            continue;
          }
          const nextSegmentIndex = pendingBreakSegmentIndex;
          emitCurrentLine(nextSegmentIndex, 0, pendingBreakPaintWidth);
          i = nextSegmentIndex;
          continue;
        }
        if (fitAdvance > fitLimit && breakableFitAdvances[i] !== null) {
          emitCurrentLine();
          appendBreakableSegmentFrom(i, 0);
          i++;
          continue;
        }
        emitCurrentLine();
        continue;
      }
      appendWholeSegment(i, advance);
      updatePendingBreakForWholeSegment(kind, breakAfter, i, w, leadingSpacing, advance);
      i++;
    }
    if (hasContent) {
      const finalPaintWidth = pendingBreakSegmentIndex === chunk.consumedEndSegmentIndex ? pendingBreakPaintWidth : lineW;
      emitCurrentLine(chunk.consumedEndSegmentIndex, 0, finalPaintWidth);
    }
  }
  return lineCount;
}
function stepPreparedChunkLineGeometry(prepared, cursor, chunkIndex, maxWidth) {
  const chunk = prepared.chunks[chunkIndex];
  if (chunk.startSegmentIndex === chunk.endSegmentIndex) {
    cursor.segmentIndex = chunk.consumedEndSegmentIndex;
    cursor.graphemeIndex = 0;
    return 0;
  }
  const { widths, kinds, breakableFitAdvances, discretionaryHyphenWidth } = prepared;
  const engineProfile = getEngineProfile();
  const lineFitEpsilon = engineProfile.lineFitEpsilon;
  const fitLimit = maxWidth + lineFitEpsilon;
  const lineStartSegmentIndex = cursor.segmentIndex;
  const lineStartGraphemeIndex = cursor.graphemeIndex;
  let lineW = 0;
  let hasContent = false;
  let lineEndSegmentIndex = cursor.segmentIndex;
  let lineEndGraphemeIndex = cursor.graphemeIndex;
  let pendingBreakSegmentIndex = -1;
  let pendingBreakFitWidth = 0;
  let pendingBreakPaintWidth = 0;
  let pendingBreakKind = null;
  function getCurrentLinePaintWidth() {
    return pendingBreakKind === "soft-hyphen" && pendingBreakSegmentIndex === lineEndSegmentIndex && lineEndGraphemeIndex === 0 ? pendingBreakPaintWidth : lineW;
  }
  function finishLine(endSegmentIndex = lineEndSegmentIndex, endGraphemeIndex = lineEndGraphemeIndex, width = getCurrentLinePaintWidth()) {
    if (!hasContent)
      return null;
    cursor.segmentIndex = endSegmentIndex;
    cursor.graphemeIndex = endGraphemeIndex;
    return finalizeLinePaintWidth(prepared, width, lineStartSegmentIndex, lineStartGraphemeIndex, endSegmentIndex, endGraphemeIndex);
  }
  function startLineAtSegment(segmentIndex, width) {
    hasContent = true;
    lineEndSegmentIndex = segmentIndex + 1;
    lineEndGraphemeIndex = 0;
    lineW = width;
  }
  function startLineAtGrapheme(segmentIndex, graphemeIndex, width) {
    hasContent = true;
    lineEndSegmentIndex = segmentIndex;
    lineEndGraphemeIndex = graphemeIndex + 1;
    lineW = width;
  }
  function appendWholeSegment(segmentIndex, advance) {
    if (!hasContent) {
      startLineAtSegment(segmentIndex, advance);
      return;
    }
    lineW += advance;
    lineEndSegmentIndex = segmentIndex + 1;
    lineEndGraphemeIndex = 0;
  }
  function updatePendingBreakForWholeSegment(kind, breakAfter, segmentIndex, segmentWidth, leadingSpacing, advance) {
    if (!breakAfter)
      return;
    const fitAdvance = getBreakOpportunityFitContribution(prepared, kind, segmentIndex, leadingSpacing);
    const paintAdvance = getLineEndPaintContribution(prepared, kind, segmentIndex, leadingSpacing, segmentWidth);
    pendingBreakSegmentIndex = segmentIndex + 1;
    pendingBreakFitWidth = lineW - advance + fitAdvance;
    pendingBreakPaintWidth = lineW - advance + paintAdvance;
    pendingBreakKind = kind;
  }
  function appendBreakableSegmentFrom(segmentIndex, startGraphemeIndex) {
    const fitAdvances = breakableFitAdvances[segmentIndex];
    for (let g = startGraphemeIndex; g < fitAdvances.length; g++) {
      const baseGw = fitAdvances[g];
      if (!hasContent) {
        startLineAtGrapheme(segmentIndex, g, baseGw);
      } else {
        const gw = getBreakableGraphemeAdvance(prepared, true, baseGw);
        const candidatePaintWidth = lineW + gw;
        if (getBreakableCandidateFitWidth(prepared, candidatePaintWidth) > fitLimit) {
          return finishLine();
        }
        lineW = candidatePaintWidth;
        lineEndSegmentIndex = segmentIndex;
        lineEndGraphemeIndex = g + 1;
      }
    }
    if (hasContent && lineEndSegmentIndex === segmentIndex && lineEndGraphemeIndex === fitAdvances.length) {
      lineEndSegmentIndex = segmentIndex + 1;
      lineEndGraphemeIndex = 0;
    }
    return null;
  }
  function maybeFinishAtSoftHyphen() {
    if (pendingBreakKind !== "soft-hyphen" || pendingBreakSegmentIndex < 0)
      return null;
    if (pendingBreakFitWidth <= fitLimit) {
      return finishLine(pendingBreakSegmentIndex, 0, pendingBreakPaintWidth);
    }
    return null;
  }
  for (let i = cursor.segmentIndex; i < chunk.endSegmentIndex; i++) {
    const kind = kinds[i];
    const breakAfter = breaksAfter(kind);
    const startGraphemeIndex = i === cursor.segmentIndex ? cursor.graphemeIndex : 0;
    const leadingSpacing = getLeadingLetterSpacing(prepared, hasContent, i);
    const w = kind === "tab" ? getTabAdvance(lineW + leadingSpacing, prepared.tabStopAdvance) : widths[i];
    const advance = leadingSpacing + w;
    const fitAdvance = getWholeSegmentFitContribution(prepared, kind, i, leadingSpacing, w);
    if (kind === "soft-hyphen" && startGraphemeIndex === 0) {
      if (hasContent) {
        lineEndSegmentIndex = i + 1;
        lineEndGraphemeIndex = 0;
        pendingBreakSegmentIndex = i + 1;
        pendingBreakFitWidth = lineW + discretionaryHyphenWidth;
        pendingBreakPaintWidth = lineW + discretionaryHyphenWidth;
        pendingBreakKind = kind;
      }
      continue;
    }
    if (!hasContent) {
      if (startGraphemeIndex > 0) {
        const line = appendBreakableSegmentFrom(i, startGraphemeIndex);
        if (line !== null)
          return line;
      } else if (fitAdvance > fitLimit && breakableFitAdvances[i] !== null) {
        const line = appendBreakableSegmentFrom(i, 0);
        if (line !== null)
          return line;
      } else {
        startLineAtSegment(i, w);
      }
      updatePendingBreakForWholeSegment(kind, breakAfter, i, w, leadingSpacing, advance);
      continue;
    }
    const newFitW = lineW + fitAdvance;
    if (newFitW > fitLimit) {
      const currentBreakFitWidth = lineW + getBreakOpportunityFitContribution(prepared, kind, i, leadingSpacing);
      const currentBreakPaintWidth = lineW + getLineEndPaintContribution(prepared, kind, i, leadingSpacing, w);
      if (pendingBreakKind === "soft-hyphen" && engineProfile.preferEarlySoftHyphenBreak && pendingBreakFitWidth <= fitLimit) {
        return finishLine(pendingBreakSegmentIndex, 0, pendingBreakPaintWidth);
      }
      const softBreakLine = maybeFinishAtSoftHyphen();
      if (softBreakLine !== null)
        return softBreakLine;
      if (breakAfter && currentBreakFitWidth <= fitLimit) {
        appendWholeSegment(i, advance);
        return finishLine(i + 1, 0, currentBreakPaintWidth);
      }
      if (pendingBreakSegmentIndex >= 0 && pendingBreakFitWidth <= fitLimit) {
        if (lineEndSegmentIndex > pendingBreakSegmentIndex || lineEndSegmentIndex === pendingBreakSegmentIndex && lineEndGraphemeIndex > 0) {
          return finishLine();
        }
        return finishLine(pendingBreakSegmentIndex, 0, pendingBreakPaintWidth);
      }
      if (fitAdvance > fitLimit && breakableFitAdvances[i] !== null) {
        const currentLine = finishLine();
        if (currentLine !== null)
          return currentLine;
        const line = appendBreakableSegmentFrom(i, 0);
        if (line !== null)
          return line;
      }
      return finishLine();
    }
    appendWholeSegment(i, advance);
    updatePendingBreakForWholeSegment(kind, breakAfter, i, w, leadingSpacing, advance);
  }
  if (pendingBreakSegmentIndex === chunk.consumedEndSegmentIndex && lineEndGraphemeIndex === 0) {
    return finishLine(chunk.consumedEndSegmentIndex, 0, pendingBreakPaintWidth);
  }
  return finishLine(chunk.consumedEndSegmentIndex, 0, lineW);
}
function stepPreparedSimpleLineGeometry(prepared, cursor, maxWidth) {
  const { widths, kinds, breakableFitAdvances } = prepared;
  const engineProfile = getEngineProfile();
  const lineFitEpsilon = engineProfile.lineFitEpsilon;
  const fitLimit = maxWidth + lineFitEpsilon;
  let lineW = 0;
  let hasContent = false;
  let lineEndSegmentIndex = cursor.segmentIndex;
  let lineEndGraphemeIndex = cursor.graphemeIndex;
  let pendingBreakSegmentIndex = -1;
  let pendingBreakPaintWidth = 0;
  for (let i = cursor.segmentIndex; i < widths.length; i++) {
    const kind = kinds[i];
    const breakAfter = breaksAfter(kind);
    const startGraphemeIndex = i === cursor.segmentIndex ? cursor.graphemeIndex : 0;
    const breakableFitAdvance = breakableFitAdvances[i];
    const w = widths[i];
    if (!hasContent) {
      if (startGraphemeIndex > 0 || w > fitLimit && breakableFitAdvance !== null) {
        const fitAdvances = breakableFitAdvance;
        const firstGraphemeWidth = fitAdvances[startGraphemeIndex];
        hasContent = true;
        lineW = firstGraphemeWidth;
        lineEndSegmentIndex = i;
        lineEndGraphemeIndex = startGraphemeIndex + 1;
        for (let g = startGraphemeIndex + 1; g < fitAdvances.length; g++) {
          const gw = fitAdvances[g];
          if (lineW + gw > fitLimit) {
            cursor.segmentIndex = lineEndSegmentIndex;
            cursor.graphemeIndex = lineEndGraphemeIndex;
            return lineW;
          }
          lineW += gw;
          lineEndSegmentIndex = i;
          lineEndGraphemeIndex = g + 1;
        }
        if (lineEndSegmentIndex === i && lineEndGraphemeIndex === fitAdvances.length) {
          lineEndSegmentIndex = i + 1;
          lineEndGraphemeIndex = 0;
        }
      } else {
        hasContent = true;
        lineW = w;
        lineEndSegmentIndex = i + 1;
        lineEndGraphemeIndex = 0;
      }
      if (breakAfter) {
        pendingBreakSegmentIndex = i + 1;
        pendingBreakPaintWidth = lineW - w;
      }
      continue;
    }
    if (lineW + w > fitLimit) {
      if (breakAfter) {
        cursor.segmentIndex = i + 1;
        cursor.graphemeIndex = 0;
        return lineW;
      }
      if (pendingBreakSegmentIndex >= 0) {
        if (lineEndSegmentIndex > pendingBreakSegmentIndex || lineEndSegmentIndex === pendingBreakSegmentIndex && lineEndGraphemeIndex > 0) {
          cursor.segmentIndex = lineEndSegmentIndex;
          cursor.graphemeIndex = lineEndGraphemeIndex;
          return lineW;
        }
        cursor.segmentIndex = pendingBreakSegmentIndex;
        cursor.graphemeIndex = 0;
        return pendingBreakPaintWidth;
      }
      cursor.segmentIndex = lineEndSegmentIndex;
      cursor.graphemeIndex = lineEndGraphemeIndex;
      return lineW;
    }
    lineW += w;
    lineEndSegmentIndex = i + 1;
    lineEndGraphemeIndex = 0;
    if (breakAfter) {
      pendingBreakSegmentIndex = i + 1;
      pendingBreakPaintWidth = lineW - w;
    }
  }
  if (!hasContent)
    return null;
  cursor.segmentIndex = lineEndSegmentIndex;
  cursor.graphemeIndex = lineEndGraphemeIndex;
  return lineW;
}
function stepPreparedLineGeometryFromChunk(prepared, cursor, chunkIndex, maxWidth) {
  if (prepared.simpleLineWalkFastPath) {
    return stepPreparedSimpleLineGeometry(prepared, cursor, maxWidth);
  }
  return stepPreparedChunkLineGeometry(prepared, cursor, chunkIndex, maxWidth);
}
function stepPreparedLineGeometry(prepared, cursor, maxWidth) {
  const chunkIndex = normalizePreparedLineStart(prepared, cursor);
  if (chunkIndex < 0)
    return null;
  return stepPreparedLineGeometryFromChunk(prepared, cursor, chunkIndex, maxWidth);
}
let sharedGraphemeSegmenter$1 = null;
let sharedLineTextCaches = /* @__PURE__ */ new WeakMap();
function getSharedGraphemeSegmenter$1() {
  if (sharedGraphemeSegmenter$1 === null) {
    sharedGraphemeSegmenter$1 = new Intl.Segmenter(void 0, { granularity: "grapheme" });
  }
  return sharedGraphemeSegmenter$1;
}
function getSegmentGraphemes(segmentIndex, segments, cache) {
  let graphemes = cache.get(segmentIndex);
  if (graphemes !== void 0)
    return graphemes;
  graphemes = [];
  const graphemeSegmenter = getSharedGraphemeSegmenter$1();
  for (const gs of graphemeSegmenter.segment(segments[segmentIndex])) {
    graphemes.push(gs.segment);
  }
  cache.set(segmentIndex, graphemes);
  return graphemes;
}
function lineHasDiscretionaryHyphen(kinds, startSegmentIndex, endSegmentIndex) {
  return endSegmentIndex > startSegmentIndex && kinds[endSegmentIndex - 1] === "soft-hyphen";
}
function appendSegmentGraphemeRange(text, graphemes, startGraphemeIndex, endGraphemeIndex) {
  for (let i = startGraphemeIndex; i < endGraphemeIndex; i++) {
    text += graphemes[i];
  }
  return text;
}
function getLineTextCache(prepared) {
  let cache = sharedLineTextCaches.get(prepared);
  if (cache !== void 0)
    return cache;
  cache = /* @__PURE__ */ new Map();
  sharedLineTextCaches.set(prepared, cache);
  return cache;
}
function buildLineTextFromRange(prepared, cache, startSegmentIndex, startGraphemeIndex, endSegmentIndex, endGraphemeIndex) {
  let text = "";
  const endsWithDiscretionaryHyphen = lineHasDiscretionaryHyphen(prepared.kinds, startSegmentIndex, endSegmentIndex);
  for (let i = startSegmentIndex; i < endSegmentIndex; i++) {
    if (prepared.kinds[i] === "soft-hyphen" || prepared.kinds[i] === "hard-break")
      continue;
    if (i === startSegmentIndex && startGraphemeIndex > 0) {
      const graphemes = getSegmentGraphemes(i, prepared.segments, cache);
      text = appendSegmentGraphemeRange(text, graphemes, startGraphemeIndex, graphemes.length);
    } else {
      text += prepared.segments[i];
    }
  }
  if (endGraphemeIndex > 0) {
    if (endsWithDiscretionaryHyphen)
      text += "-";
    const graphemes = getSegmentGraphemes(endSegmentIndex, prepared.segments, cache);
    text = appendSegmentGraphemeRange(text, graphemes, startSegmentIndex === endSegmentIndex ? startGraphemeIndex : 0, endGraphemeIndex);
  } else if (endsWithDiscretionaryHyphen) {
    text += "-";
  }
  return text;
}
let sharedGraphemeSegmenter = null;
function getSharedGraphemeSegmenter() {
  if (sharedGraphemeSegmenter === null) {
    sharedGraphemeSegmenter = new Intl.Segmenter(void 0, { granularity: "grapheme" });
  }
  return sharedGraphemeSegmenter;
}
function createEmptyPrepared(includeSegments) {
  {
    return {
      widths: [],
      lineEndFitAdvances: [],
      lineEndPaintAdvances: [],
      kinds: [],
      simpleLineWalkFastPath: true,
      segLevels: null,
      breakableFitAdvances: [],
      letterSpacing: 0,
      spacingGraphemeCounts: [],
      discretionaryHyphenWidth: 0,
      tabStopAdvance: 0,
      chunks: [],
      segments: []
    };
  }
}
function buildBaseCjkUnits(segText, engineProfile) {
  const units2 = [];
  let unitParts = [];
  let unitStart = 0;
  let unitContainsCJK = false;
  let unitEndsWithClosingQuote = false;
  let unitIsSingleKinsokuEnd = false;
  function pushUnit() {
    if (unitParts.length === 0)
      return;
    units2.push({
      text: unitParts.length === 1 ? unitParts[0] : unitParts.join(""),
      start: unitStart
    });
    unitParts = [];
    unitContainsCJK = false;
    unitEndsWithClosingQuote = false;
    unitIsSingleKinsokuEnd = false;
  }
  function startUnit(grapheme, start, graphemeContainsCJK) {
    unitParts = [grapheme];
    unitStart = start;
    unitContainsCJK = graphemeContainsCJK;
    unitEndsWithClosingQuote = endsWithClosingQuote(grapheme);
    unitIsSingleKinsokuEnd = kinsokuEnd.has(grapheme);
  }
  function appendToUnit(grapheme, graphemeContainsCJK) {
    unitParts.push(grapheme);
    unitContainsCJK = unitContainsCJK || graphemeContainsCJK;
    const graphemeEndsWithClosingQuote = endsWithClosingQuote(grapheme);
    if (grapheme.length === 1 && leftStickyPunctuation.has(grapheme)) {
      unitEndsWithClosingQuote = unitEndsWithClosingQuote || graphemeEndsWithClosingQuote;
    } else {
      unitEndsWithClosingQuote = graphemeEndsWithClosingQuote;
    }
    unitIsSingleKinsokuEnd = false;
  }
  for (const gs of getSharedGraphemeSegmenter().segment(segText)) {
    const grapheme = gs.segment;
    const graphemeContainsCJK = isCJK(grapheme);
    if (unitParts.length === 0) {
      startUnit(grapheme, gs.index, graphemeContainsCJK);
      continue;
    }
    if (unitIsSingleKinsokuEnd || kinsokuStart.has(grapheme) || leftStickyPunctuation.has(grapheme) || engineProfile.carryCJKAfterClosingQuote && graphemeContainsCJK && unitEndsWithClosingQuote) {
      appendToUnit(grapheme, graphemeContainsCJK);
      continue;
    }
    if (!unitContainsCJK && !graphemeContainsCJK) {
      appendToUnit(grapheme, graphemeContainsCJK);
      continue;
    }
    pushUnit();
    startUnit(grapheme, gs.index, graphemeContainsCJK);
  }
  pushUnit();
  return units2;
}
function mergeKeepAllTextUnits(segText, units2, breakAfterPunctuation) {
  if (units2.length <= 1)
    return units2;
  const merged = [];
  let groupStart = -1;
  let groupContainsCJK = false;
  function pushMergedUnit(start, end) {
    const sourceStart = units2[start].start;
    const sourceEnd = end < units2.length ? units2[end].start : segText.length;
    merged.push({
      text: segText.slice(sourceStart, sourceEnd),
      start: sourceStart
    });
  }
  function flushGroup(end) {
    if (groupStart < 0)
      return;
    if (groupContainsCJK) {
      if (groupStart + 1 === end) {
        merged.push(units2[groupStart]);
      } else {
        pushMergedUnit(groupStart, end);
      }
    } else {
      for (let i = groupStart; i < end; i++)
        merged.push(units2[i]);
    }
    groupStart = -1;
    groupContainsCJK = false;
  }
  for (let i = 0; i < units2.length; i++) {
    const unit = units2[i];
    if (groupStart >= 0 && !canContinueKeepAllTextRun(units2[i - 1].text, breakAfterPunctuation)) {
      flushGroup(i);
    }
    if (groupStart < 0)
      groupStart = i;
    groupContainsCJK = groupContainsCJK || isCJK(unit.text);
  }
  flushGroup(units2.length);
  return merged;
}
function countRenderedSpacingGraphemes(text, kind) {
  if (kind === "zero-width-break" || kind === "soft-hyphen" || kind === "hard-break") {
    return 0;
  }
  if (kind === "tab")
    return 1;
  let count = 0;
  const graphemeSegmenter = getSharedGraphemeSegmenter();
  for (const _ of graphemeSegmenter.segment(text))
    count++;
  return count;
}
function addInternalLetterSpacing(width, graphemeCount, letterSpacing) {
  return graphemeCount > 1 ? width + (graphemeCount - 1) * letterSpacing : width;
}
function measureAnalysis(analysis, font, includeSegments, wordBreak, letterSpacing) {
  const engineProfile = getEngineProfile();
  const { cache, emojiCorrection } = getFontMeasurementState(font, textMayContainEmoji(analysis.normalized));
  const discretionaryHyphenWidth = getCorrectedSegmentWidth("-", getSegmentMetrics("-", cache), emojiCorrection) + (letterSpacing === 0 ? 0 : letterSpacing * 2);
  const spaceWidth = getCorrectedSegmentWidth(" ", getSegmentMetrics(" ", cache), emojiCorrection);
  const tabStopAdvance = spaceWidth * 8;
  const hasLetterSpacing = letterSpacing !== 0;
  if (analysis.len === 0)
    return createEmptyPrepared();
  const widths = [];
  const lineEndFitAdvances = [];
  const lineEndPaintAdvances = [];
  const kinds = [];
  let simpleLineWalkFastPath = analysis.chunks.length <= 1 && !hasLetterSpacing;
  const segStarts = includeSegments ? [] : null;
  const breakableFitAdvances = [];
  const spacingGraphemeCounts = [];
  const segments = includeSegments ? [] : null;
  const preparedStartByAnalysisIndex = Array.from({ length: analysis.len });
  function pushMeasuredSegment(text, width, lineEndFitAdvance, lineEndPaintAdvance, kind, start, breakableFitAdvance, spacingGraphemeCount) {
    if (kind !== "text" && kind !== "space" && kind !== "zero-width-break") {
      simpleLineWalkFastPath = false;
    }
    widths.push(width);
    lineEndFitAdvances.push(lineEndFitAdvance);
    lineEndPaintAdvances.push(lineEndPaintAdvance);
    kinds.push(kind);
    segStarts == null ? void 0 : segStarts.push(start);
    breakableFitAdvances.push(breakableFitAdvance);
    if (hasLetterSpacing)
      spacingGraphemeCounts.push(spacingGraphemeCount);
    if (segments !== null)
      segments.push(text);
  }
  function pushMeasuredTextSegment(text, kind, start, wordLike, allowOverflowBreaks) {
    const textMetrics = getSegmentMetrics(text, cache);
    const spacingGraphemeCount = hasLetterSpacing ? countRenderedSpacingGraphemes(text, kind) : 0;
    const width = addInternalLetterSpacing(getCorrectedSegmentWidth(text, textMetrics, emojiCorrection), spacingGraphemeCount, letterSpacing);
    const baseLineEndFitAdvance = kind === "space" || kind === "preserved-space" || kind === "zero-width-break" ? 0 : width;
    const lineEndFitAdvance = baseLineEndFitAdvance === 0 ? 0 : baseLineEndFitAdvance + (spacingGraphemeCount > 0 ? letterSpacing : 0);
    const lineEndPaintAdvance = kind === "space" || kind === "zero-width-break" ? 0 : width;
    if (allowOverflowBreaks && wordLike && text.length > 1) {
      let fitMode = "sum-graphemes";
      if (letterSpacing !== 0) {
        fitMode = "segment-prefixes";
      } else if (isNumericRunSegment(text)) {
        fitMode = "pair-context";
      } else if (engineProfile.preferPrefixWidthsForBreakableRuns) {
        fitMode = "segment-prefixes";
      }
      const fitAdvances = getSegmentBreakableFitAdvances(text, textMetrics, cache, emojiCorrection, fitMode);
      pushMeasuredSegment(text, width, lineEndFitAdvance, lineEndPaintAdvance, kind, start, fitAdvances, spacingGraphemeCount);
      return;
    }
    pushMeasuredSegment(text, width, lineEndFitAdvance, lineEndPaintAdvance, kind, start, null, spacingGraphemeCount);
  }
  for (let mi = 0; mi < analysis.len; mi++) {
    preparedStartByAnalysisIndex[mi] = widths.length;
    const segText = analysis.texts[mi];
    const segWordLike = analysis.isWordLike[mi];
    const segKind = analysis.kinds[mi];
    const segStart = analysis.starts[mi];
    if (segKind === "soft-hyphen") {
      pushMeasuredSegment(segText, 0, discretionaryHyphenWidth, discretionaryHyphenWidth, segKind, segStart, null, 0);
      continue;
    }
    if (segKind === "hard-break") {
      pushMeasuredSegment(segText, 0, 0, 0, segKind, segStart, null, 0);
      continue;
    }
    if (segKind === "tab") {
      pushMeasuredSegment(segText, 0, 0, 0, segKind, segStart, null, hasLetterSpacing ? countRenderedSpacingGraphemes(segText, segKind) : 0);
      continue;
    }
    const segMetrics = getSegmentMetrics(segText, cache);
    if (segKind === "text" && segMetrics.containsCJK) {
      const baseUnits = buildBaseCjkUnits(segText, engineProfile);
      const measuredUnits = wordBreak === "keep-all" ? mergeKeepAllTextUnits(segText, baseUnits, engineProfile.breakKeepAllAfterPunctuation) : baseUnits;
      for (let i = 0; i < measuredUnits.length; i++) {
        const unit = measuredUnits[i];
        pushMeasuredTextSegment(unit.text, "text", segStart + unit.start, segWordLike, wordBreak === "keep-all" || !isCJK(unit.text));
      }
      continue;
    }
    pushMeasuredTextSegment(segText, segKind, segStart, segWordLike, true);
  }
  const chunks = mapAnalysisChunksToPreparedChunks(analysis.chunks, preparedStartByAnalysisIndex, widths.length);
  const segLevels = segStarts === null ? null : computeSegmentLevels(analysis.normalized, segStarts);
  if (segments !== null) {
    return {
      widths,
      lineEndFitAdvances,
      lineEndPaintAdvances,
      kinds,
      simpleLineWalkFastPath,
      segLevels,
      breakableFitAdvances,
      letterSpacing,
      spacingGraphemeCounts,
      discretionaryHyphenWidth,
      tabStopAdvance,
      chunks,
      segments
    };
  }
  return {
    widths,
    lineEndFitAdvances,
    lineEndPaintAdvances,
    kinds,
    simpleLineWalkFastPath,
    segLevels,
    breakableFitAdvances,
    letterSpacing,
    spacingGraphemeCounts,
    discretionaryHyphenWidth,
    tabStopAdvance,
    chunks
  };
}
function mapAnalysisChunksToPreparedChunks(chunks, preparedStartByAnalysisIndex, preparedEndSegmentIndex) {
  const preparedChunks = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const startSegmentIndex = chunk.startSegmentIndex < preparedStartByAnalysisIndex.length ? preparedStartByAnalysisIndex[chunk.startSegmentIndex] : preparedEndSegmentIndex;
    const endSegmentIndex = chunk.endSegmentIndex < preparedStartByAnalysisIndex.length ? preparedStartByAnalysisIndex[chunk.endSegmentIndex] : preparedEndSegmentIndex;
    const consumedEndSegmentIndex = chunk.consumedEndSegmentIndex < preparedStartByAnalysisIndex.length ? preparedStartByAnalysisIndex[chunk.consumedEndSegmentIndex] : preparedEndSegmentIndex;
    preparedChunks.push({
      startSegmentIndex,
      endSegmentIndex,
      consumedEndSegmentIndex
    });
  }
  return preparedChunks;
}
function prepareInternal(text, font, includeSegments, options) {
  var _a2, _b2;
  const wordBreak = (_a2 = options == null ? void 0 : options.wordBreak) != null ? _a2 : "normal";
  const letterSpacing = (_b2 = options == null ? void 0 : options.letterSpacing) != null ? _b2 : 0;
  const analysis = analyzeText(text, getEngineProfile(), options == null ? void 0 : options.whiteSpace, wordBreak);
  return measureAnalysis(analysis, font, includeSegments, wordBreak, letterSpacing);
}
function prepareWithSegments(text, font, options) {
  return prepareInternal(text, font, true, options);
}
function getInternalPrepared(prepared) {
  return prepared;
}
function measureNaturalWidth(prepared) {
  let maxWidth = 0;
  walkPreparedLinesRaw(getInternalPrepared(prepared), Number.POSITIVE_INFINITY, (width) => {
    if (width > maxWidth)
      maxWidth = width;
  });
  return maxWidth;
}
const COLLAPSIBLE_BOUNDARY_RE = /[ \t\n\f\r]+/;
const LEADING_COLLAPSIBLE_BOUNDARY_RE = /^[ \t\n\f\r]+/;
const TRAILING_COLLAPSIBLE_BOUNDARY_RE = /[ \t\n\f\r]+$/;
const EMPTY_LAYOUT_CURSOR = { segmentIndex: 0, graphemeIndex: 0 };
const RICH_INLINE_START_CURSOR = {
  itemIndex: 0,
  segmentIndex: 0,
  graphemeIndex: 0
};
function getInternalPreparedRichInline(prepared) {
  return prepared;
}
function cloneCursor(cursor) {
  return {
    segmentIndex: cursor.segmentIndex,
    graphemeIndex: cursor.graphemeIndex
  };
}
function isLineStartCursor(cursor) {
  return cursor.segmentIndex === 0 && cursor.graphemeIndex === 0;
}
function getCollapsedSpaceWidth(font, letterSpacing, cache) {
  const cacheKey = `${font}\0${letterSpacing}`;
  const cached = cache.get(cacheKey);
  if (cached !== void 0)
    return cached;
  const options = letterSpacing === 0 ? void 0 : { letterSpacing };
  const joinedWidth = measureNaturalWidth(prepareWithSegments("A A", font, options));
  const compactWidth = measureNaturalWidth(prepareWithSegments("AA", font, options));
  const collapsedWidth = Math.max(0, joinedWidth - compactWidth);
  cache.set(cacheKey, collapsedWidth);
  return collapsedWidth;
}
function prepareWholeItemLine(prepared) {
  const end = { segmentIndex: 0, graphemeIndex: 0 };
  const width = stepPreparedLineGeometry(prepared, end, Number.POSITIVE_INFINITY);
  if (width === null)
    return null;
  return {
    endGraphemeIndex: end.graphemeIndex,
    endSegmentIndex: end.segmentIndex,
    width
  };
}
function endsInsideFirstSegment(segmentIndex, graphemeIndex) {
  return segmentIndex === 0 && graphemeIndex > 0;
}
function prepareRichInline$1(items) {
  var _a2, _b2, _c;
  const preparedItems = [];
  const itemsBySourceItemIndex = Array.from({ length: items.length });
  const collapsedSpaceWidthCache = /* @__PURE__ */ new Map();
  let pendingGapWidth = 0;
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const letterSpacing = (_a2 = item.letterSpacing) != null ? _a2 : 0;
    const hasLeadingWhitespace = LEADING_COLLAPSIBLE_BOUNDARY_RE.test(item.text);
    const hasTrailingWhitespace = TRAILING_COLLAPSIBLE_BOUNDARY_RE.test(item.text);
    const trimmedText = item.text.replace(LEADING_COLLAPSIBLE_BOUNDARY_RE, "").replace(TRAILING_COLLAPSIBLE_BOUNDARY_RE, "");
    if (trimmedText.length === 0) {
      if (COLLAPSIBLE_BOUNDARY_RE.test(item.text) && pendingGapWidth === 0) {
        pendingGapWidth = getCollapsedSpaceWidth(item.font, letterSpacing, collapsedSpaceWidthCache);
      }
      continue;
    }
    const gapBefore = pendingGapWidth > 0 ? pendingGapWidth : hasLeadingWhitespace ? getCollapsedSpaceWidth(item.font, letterSpacing, collapsedSpaceWidthCache) : 0;
    const prepared = prepareWithSegments(trimmedText, item.font, letterSpacing === 0 ? void 0 : { letterSpacing });
    const wholeLine = prepareWholeItemLine(prepared);
    if (wholeLine === null) {
      pendingGapWidth = hasTrailingWhitespace ? getCollapsedSpaceWidth(item.font, letterSpacing, collapsedSpaceWidthCache) : 0;
      continue;
    }
    const preparedItem = {
      break: (_b2 = item.break) != null ? _b2 : "normal",
      endGraphemeIndex: wholeLine.endGraphemeIndex,
      endSegmentIndex: wholeLine.endSegmentIndex,
      extraWidth: (_c = item.extraWidth) != null ? _c : 0,
      gapBefore,
      naturalWidth: wholeLine.width,
      prepared,
      sourceItemIndex: index
    };
    preparedItems.push(preparedItem);
    itemsBySourceItemIndex[index] = preparedItem;
    pendingGapWidth = hasTrailingWhitespace ? getCollapsedSpaceWidth(item.font, letterSpacing, collapsedSpaceWidthCache) : 0;
  }
  return {
    items: preparedItems,
    itemsBySourceItemIndex
  };
}
function stepRichInlineLine(flow, maxWidth, cursor, collectFragment) {
  if (flow.items.length === 0 || cursor.itemIndex >= flow.items.length)
    return null;
  const safeWidth = Math.max(1, maxWidth);
  let lineWidth = 0;
  let remainingWidth = safeWidth;
  let itemIndex = cursor.itemIndex;
  lineLoop: while (itemIndex < flow.items.length) {
    const item = flow.items[itemIndex];
    if (!isLineStartCursor(cursor) && cursor.segmentIndex === item.endSegmentIndex && cursor.graphemeIndex === item.endGraphemeIndex) {
      itemIndex++;
      cursor.segmentIndex = 0;
      cursor.graphemeIndex = 0;
      continue;
    }
    const gapBefore = lineWidth === 0 ? 0 : item.gapBefore;
    const atItemStart = isLineStartCursor(cursor);
    if (item.break === "never") {
      if (!atItemStart) {
        itemIndex++;
        cursor.segmentIndex = 0;
        cursor.graphemeIndex = 0;
        continue;
      }
      const occupiedWidth = item.naturalWidth + item.extraWidth;
      const totalWidth = gapBefore + occupiedWidth;
      if (lineWidth > 0 && totalWidth > remainingWidth)
        break lineLoop;
      collectFragment == null ? void 0 : collectFragment(item, gapBefore, occupiedWidth, cloneCursor(EMPTY_LAYOUT_CURSOR), {
        segmentIndex: item.endSegmentIndex,
        graphemeIndex: item.endGraphemeIndex
      });
      lineWidth += totalWidth;
      remainingWidth = Math.max(0, safeWidth - lineWidth);
      itemIndex++;
      cursor.segmentIndex = 0;
      cursor.graphemeIndex = 0;
      continue;
    }
    const reservedWidth = gapBefore + item.extraWidth;
    if (lineWidth > 0 && reservedWidth >= remainingWidth)
      break lineLoop;
    if (atItemStart) {
      const totalWidth = reservedWidth + item.naturalWidth;
      if (totalWidth <= remainingWidth) {
        collectFragment == null ? void 0 : collectFragment(item, gapBefore, item.naturalWidth + item.extraWidth, cloneCursor(EMPTY_LAYOUT_CURSOR), {
          segmentIndex: item.endSegmentIndex,
          graphemeIndex: item.endGraphemeIndex
        });
        lineWidth += totalWidth;
        remainingWidth = Math.max(0, safeWidth - lineWidth);
        itemIndex++;
        cursor.segmentIndex = 0;
        cursor.graphemeIndex = 0;
        continue;
      }
    }
    const availableWidth = Math.max(1, remainingWidth - reservedWidth);
    const lineEnd = {
      segmentIndex: cursor.segmentIndex,
      graphemeIndex: cursor.graphemeIndex
    };
    const lineWidthForItem = stepPreparedLineGeometry(item.prepared, lineEnd, availableWidth);
    if (lineWidthForItem === null) {
      itemIndex++;
      cursor.segmentIndex = 0;
      cursor.graphemeIndex = 0;
      continue;
    }
    if (cursor.segmentIndex === lineEnd.segmentIndex && cursor.graphemeIndex === lineEnd.graphemeIndex) {
      itemIndex++;
      cursor.segmentIndex = 0;
      cursor.graphemeIndex = 0;
      continue;
    }
    const itemOccupiedWidth = lineWidthForItem + item.extraWidth;
    const lineWidthContribution = gapBefore + itemOccupiedWidth;
    if (lineWidth > 0 && atItemStart && lineWidthContribution > remainingWidth)
      break lineLoop;
    if (lineWidth > 0 && atItemStart && gapBefore > 0 && endsInsideFirstSegment(lineEnd.segmentIndex, lineEnd.graphemeIndex)) {
      const freshLineEnd = { segmentIndex: 0, graphemeIndex: 0 };
      const freshLineWidth = stepPreparedLineGeometry(item.prepared, freshLineEnd, Math.max(1, safeWidth - item.extraWidth));
      if (freshLineWidth !== null && (freshLineEnd.segmentIndex > lineEnd.segmentIndex || freshLineEnd.segmentIndex === lineEnd.segmentIndex && freshLineEnd.graphemeIndex > lineEnd.graphemeIndex)) {
        break lineLoop;
      }
    }
    collectFragment == null ? void 0 : collectFragment(item, gapBefore, itemOccupiedWidth, cloneCursor(cursor), {
      segmentIndex: lineEnd.segmentIndex,
      graphemeIndex: lineEnd.graphemeIndex
    });
    lineWidth += lineWidthContribution;
    remainingWidth = Math.max(0, safeWidth - lineWidth);
    if (lineEnd.segmentIndex === item.endSegmentIndex && lineEnd.graphemeIndex === item.endGraphemeIndex) {
      itemIndex++;
      cursor.segmentIndex = 0;
      cursor.graphemeIndex = 0;
      continue;
    }
    cursor.segmentIndex = lineEnd.segmentIndex;
    cursor.graphemeIndex = lineEnd.graphemeIndex;
    break;
  }
  if (lineWidth === 0)
    return null;
  cursor.itemIndex = itemIndex;
  return lineWidth;
}
function layoutNextRichInlineLineRange(prepared, maxWidth, start = RICH_INLINE_START_CURSOR) {
  const flow = getInternalPreparedRichInline(prepared);
  const end = {
    itemIndex: start.itemIndex,
    segmentIndex: start.segmentIndex,
    graphemeIndex: start.graphemeIndex
  };
  const fragments = [];
  const width = stepRichInlineLine(flow, maxWidth, end, (item, gapBefore, occupiedWidth, fragmentStart, fragmentEnd) => {
    fragments.push({
      itemIndex: item.sourceItemIndex,
      gapBefore,
      occupiedWidth,
      start: fragmentStart,
      end: fragmentEnd
    });
  });
  if (width === null)
    return null;
  return {
    fragments,
    width,
    end
  };
}
function materializeFragmentText(item, fragment) {
  return buildLineTextFromRange(item.prepared, getLineTextCache(item.prepared), fragment.start.segmentIndex, fragment.start.graphemeIndex, fragment.end.segmentIndex, fragment.end.graphemeIndex);
}
function materializeRichInlineLineRange$1(prepared, line) {
  const flow = getInternalPreparedRichInline(prepared);
  const fragments = [];
  for (let i = 0; i < line.fragments.length; i++) {
    const fragment = line.fragments[i];
    const item = flow.itemsBySourceItemIndex[fragment.itemIndex];
    if (item === void 0)
      throw new Error("Missing rich-text inline item for fragment");
    fragments.push({
      itemIndex: fragment.itemIndex,
      text: materializeFragmentText(item, fragment),
      gapBefore: fragment.gapBefore,
      occupiedWidth: fragment.occupiedWidth,
      start: fragment.start,
      end: fragment.end
    });
  }
  return {
    fragments,
    width: line.width,
    end: line.end
  };
}
function walkRichInlineLineRanges$1(prepared, maxWidth, onLine) {
  let lineCount = 0;
  let cursor = RICH_INLINE_START_CURSOR;
  while (true) {
    const line = layoutNextRichInlineLineRange(prepared, maxWidth, cursor);
    if (line === null)
      return lineCount;
    onLine(line);
    lineCount++;
    cursor = line.end;
  }
}
const EOF$1 = 0;
const Ident = 1;
const Function$1 = 2;
const AtKeyword = 3;
const Hash$1 = 4;
const String$2 = 5;
const BadString = 6;
const Url$1 = 7;
const BadUrl = 8;
const Delim = 9;
const Number$2 = 10;
const Percentage$1 = 11;
const Dimension$1 = 12;
const WhiteSpace$1 = 13;
const CDO$1 = 14;
const CDC$1 = 15;
const Colon = 16;
const Semicolon = 17;
const Comma = 18;
const LeftSquareBracket = 19;
const RightSquareBracket = 20;
const LeftParenthesis = 21;
const RightParenthesis = 22;
const LeftCurlyBracket = 23;
const RightCurlyBracket = 24;
const Comment$1 = 25;
const EOF = 0;
function isDigit(code2) {
  return code2 >= 48 && code2 <= 57;
}
function isHexDigit(code2) {
  return isDigit(code2) || // 0 .. 9
  code2 >= 65 && code2 <= 70 || // A .. F
  code2 >= 97 && code2 <= 102;
}
function isUppercaseLetter(code2) {
  return code2 >= 65 && code2 <= 90;
}
function isLowercaseLetter(code2) {
  return code2 >= 97 && code2 <= 122;
}
function isLetter(code2) {
  return isUppercaseLetter(code2) || isLowercaseLetter(code2);
}
function isNonAscii(code2) {
  return code2 >= 128;
}
function isNameStart(code2) {
  return isLetter(code2) || isNonAscii(code2) || code2 === 95;
}
function isName(code2) {
  return isNameStart(code2) || isDigit(code2) || code2 === 45;
}
function isNonPrintable(code2) {
  return code2 >= 0 && code2 <= 8 || code2 === 11 || code2 >= 14 && code2 <= 31 || code2 === 127;
}
function isNewline(code2) {
  return code2 === 10 || code2 === 13 || code2 === 12;
}
function isWhiteSpace(code2) {
  return isNewline(code2) || code2 === 32 || code2 === 9;
}
function isValidEscape(first, second) {
  if (first !== 92) {
    return false;
  }
  if (isNewline(second) || second === EOF) {
    return false;
  }
  return true;
}
function isIdentifierStart(first, second, third) {
  if (first === 45) {
    return isNameStart(second) || second === 45 || isValidEscape(second, third);
  }
  if (isNameStart(first)) {
    return true;
  }
  if (first === 92) {
    return isValidEscape(first, second);
  }
  return false;
}
function isNumberStart(first, second, third) {
  if (first === 43 || first === 45) {
    if (isDigit(second)) {
      return 2;
    }
    return second === 46 && isDigit(third) ? 3 : 0;
  }
  if (first === 46) {
    return isDigit(second) ? 2 : 0;
  }
  if (isDigit(first)) {
    return 1;
  }
  return 0;
}
function isBOM(code2) {
  if (code2 === 65279) {
    return 1;
  }
  if (code2 === 65534) {
    return 1;
  }
  return 0;
}
const CATEGORY = new Array(128);
const EofCategory = 128;
const WhiteSpaceCategory = 130;
const DigitCategory = 131;
const NameStartCategory = 132;
const NonPrintableCategory = 133;
for (let i = 0; i < CATEGORY.length; i++) {
  CATEGORY[i] = isWhiteSpace(i) && WhiteSpaceCategory || isDigit(i) && DigitCategory || isNameStart(i) && NameStartCategory || isNonPrintable(i) && NonPrintableCategory || i || EofCategory;
}
function charCodeCategory(code2) {
  return code2 < 128 ? CATEGORY[code2] : NameStartCategory;
}
function getCharCode(source, offset) {
  return offset < source.length ? source.charCodeAt(offset) : 0;
}
function getNewlineLength(source, offset, code2) {
  if (code2 === 13 && getCharCode(source, offset + 1) === 10) {
    return 2;
  }
  return 1;
}
function cmpChar(testStr, offset, referenceCode) {
  let code2 = testStr.charCodeAt(offset);
  if (isUppercaseLetter(code2)) {
    code2 = code2 | 32;
  }
  return code2 === referenceCode;
}
function cmpStr(testStr, start, end, referenceStr) {
  if (end - start !== referenceStr.length) {
    return false;
  }
  if (start < 0 || end > testStr.length) {
    return false;
  }
  for (let i = start; i < end; i++) {
    const referenceCode = referenceStr.charCodeAt(i - start);
    let testCode = testStr.charCodeAt(i);
    if (isUppercaseLetter(testCode)) {
      testCode = testCode | 32;
    }
    if (testCode !== referenceCode) {
      return false;
    }
  }
  return true;
}
function findWhiteSpaceStart(source, offset) {
  for (; offset >= 0; offset--) {
    if (!isWhiteSpace(source.charCodeAt(offset))) {
      break;
    }
  }
  return offset + 1;
}
function findWhiteSpaceEnd(source, offset) {
  for (; offset < source.length; offset++) {
    if (!isWhiteSpace(source.charCodeAt(offset))) {
      break;
    }
  }
  return offset;
}
function findDecimalNumberEnd(source, offset) {
  for (; offset < source.length; offset++) {
    if (!isDigit(source.charCodeAt(offset))) {
      break;
    }
  }
  return offset;
}
function consumeEscaped(source, offset) {
  offset += 2;
  if (isHexDigit(getCharCode(source, offset - 1))) {
    for (const maxOffset = Math.min(source.length, offset + 5); offset < maxOffset; offset++) {
      if (!isHexDigit(getCharCode(source, offset))) {
        break;
      }
    }
    const code2 = getCharCode(source, offset);
    if (isWhiteSpace(code2)) {
      offset += getNewlineLength(source, offset, code2);
    }
  }
  return offset;
}
function consumeName(source, offset) {
  for (; offset < source.length; offset++) {
    const code2 = source.charCodeAt(offset);
    if (isName(code2)) {
      continue;
    }
    if (isValidEscape(code2, getCharCode(source, offset + 1))) {
      offset = consumeEscaped(source, offset) - 1;
      continue;
    }
    break;
  }
  return offset;
}
function consumeNumber(source, offset) {
  let code2 = source.charCodeAt(offset);
  if (code2 === 43 || code2 === 45) {
    code2 = source.charCodeAt(offset += 1);
  }
  if (isDigit(code2)) {
    offset = findDecimalNumberEnd(source, offset + 1);
    code2 = source.charCodeAt(offset);
  }
  if (code2 === 46 && isDigit(source.charCodeAt(offset + 1))) {
    offset += 2;
    offset = findDecimalNumberEnd(source, offset);
  }
  if (cmpChar(
    source,
    offset,
    101
    /* e */
  )) {
    let sign = 0;
    code2 = source.charCodeAt(offset + 1);
    if (code2 === 45 || code2 === 43) {
      sign = 1;
      code2 = source.charCodeAt(offset + 2);
    }
    if (isDigit(code2)) {
      offset = findDecimalNumberEnd(source, offset + 1 + sign + 1);
    }
  }
  return offset;
}
function consumeBadUrlRemnants(source, offset) {
  for (; offset < source.length; offset++) {
    const code2 = source.charCodeAt(offset);
    if (code2 === 41) {
      offset++;
      break;
    }
    if (isValidEscape(code2, getCharCode(source, offset + 1))) {
      offset = consumeEscaped(source, offset);
    }
  }
  return offset;
}
function decodeEscaped(escaped) {
  if (escaped.length === 1 && !isHexDigit(escaped.charCodeAt(0))) {
    return escaped[0];
  }
  let code2 = parseInt(escaped, 16);
  if (code2 === 0 || // If this number is zero,
  code2 >= 55296 && code2 <= 57343 || // or is for a surrogate,
  code2 > 1114111) {
    code2 = 65533;
  }
  return String.fromCodePoint(code2);
}
const tokenNames = [
  "EOF-token",
  "ident-token",
  "function-token",
  "at-keyword-token",
  "hash-token",
  "string-token",
  "bad-string-token",
  "url-token",
  "bad-url-token",
  "delim-token",
  "number-token",
  "percentage-token",
  "dimension-token",
  "whitespace-token",
  "CDO-token",
  "CDC-token",
  "colon-token",
  "semicolon-token",
  "comma-token",
  "[-token",
  "]-token",
  "(-token",
  ")-token",
  "{-token",
  "}-token",
  "comment-token"
];
const MIN_SIZE = 16 * 1024;
function adoptBuffer(buffer = null, size) {
  if (buffer === null || buffer.length < size) {
    return new Uint32Array(Math.max(size + 1024, MIN_SIZE));
  }
  return buffer;
}
const N$4 = 10;
const F$2 = 12;
const R$2 = 13;
function computeLinesAndColumns(host) {
  const source = host.source;
  const sourceLength = source.length;
  const startOffset = source.length > 0 ? isBOM(source.charCodeAt(0)) : 0;
  const lines = adoptBuffer(host.lines, sourceLength);
  const columns = adoptBuffer(host.columns, sourceLength);
  let line = host.startLine;
  let column = host.startColumn;
  for (let i = startOffset; i < sourceLength; i++) {
    const code2 = source.charCodeAt(i);
    lines[i] = line;
    columns[i] = column++;
    if (code2 === N$4 || code2 === R$2 || code2 === F$2) {
      if (code2 === R$2 && i + 1 < sourceLength && source.charCodeAt(i + 1) === N$4) {
        i++;
        lines[i] = line;
        columns[i] = column;
      }
      line++;
      column = 1;
    }
  }
  lines[sourceLength] = line;
  columns[sourceLength] = column;
  host.lines = lines;
  host.columns = columns;
  host.computed = true;
}
class OffsetToLocation {
  constructor(source, startOffset, startLine, startColumn) {
    this.setSource(source, startOffset, startLine, startColumn);
    this.lines = null;
    this.columns = null;
  }
  setSource(source = "", startOffset = 0, startLine = 1, startColumn = 1) {
    this.source = source;
    this.startOffset = startOffset;
    this.startLine = startLine;
    this.startColumn = startColumn;
    this.computed = false;
  }
  getLocation(offset, filename) {
    if (!this.computed) {
      computeLinesAndColumns(this);
    }
    return {
      source: filename,
      offset: this.startOffset + offset,
      line: this.lines[offset],
      column: this.columns[offset]
    };
  }
  getLocationRange(start, end, filename) {
    if (!this.computed) {
      computeLinesAndColumns(this);
    }
    return {
      source: filename,
      start: {
        offset: this.startOffset + start,
        line: this.lines[start],
        column: this.columns[start]
      },
      end: {
        offset: this.startOffset + end,
        line: this.lines[end],
        column: this.columns[end]
      }
    };
  }
}
const OFFSET_MASK = 16777215;
const TYPE_SHIFT = 24;
const BLOCK_OPEN_TOKEN = 1;
const BLOCK_CLOSE_TOKEN = 2;
const balancePair$1 = new Uint8Array(32);
balancePair$1[Function$1] = RightParenthesis;
balancePair$1[LeftParenthesis] = RightParenthesis;
balancePair$1[LeftSquareBracket] = RightSquareBracket;
balancePair$1[LeftCurlyBracket] = RightCurlyBracket;
const blockTokens = new Uint8Array(32);
blockTokens[Function$1] = BLOCK_OPEN_TOKEN;
blockTokens[LeftParenthesis] = BLOCK_OPEN_TOKEN;
blockTokens[LeftSquareBracket] = BLOCK_OPEN_TOKEN;
blockTokens[LeftCurlyBracket] = BLOCK_OPEN_TOKEN;
blockTokens[RightParenthesis] = BLOCK_CLOSE_TOKEN;
blockTokens[RightSquareBracket] = BLOCK_CLOSE_TOKEN;
blockTokens[RightCurlyBracket] = BLOCK_CLOSE_TOKEN;
function boundIndex(index, min, max2) {
  return index < min ? min : index > max2 ? max2 : index;
}
class TokenStream {
  constructor(source, tokenize2) {
    this.setSource(source, tokenize2);
  }
  reset() {
    this.eof = false;
    this.tokenIndex = -1;
    this.tokenType = 0;
    this.tokenStart = this.firstCharOffset;
    this.tokenEnd = this.firstCharOffset;
  }
  setSource(source = "", tokenize2 = () => {
  }) {
    source = String(source || "");
    const sourceLength = source.length;
    const offsetAndType = adoptBuffer(this.offsetAndType, source.length + 1);
    const balance = adoptBuffer(this.balance, source.length + 1);
    let tokenCount = 0;
    let firstCharOffset = -1;
    let balanceCloseType = 0;
    let balanceStart = source.length;
    this.offsetAndType = null;
    this.balance = null;
    balance.fill(0);
    tokenize2(source, (type, start, end) => {
      const index = tokenCount++;
      offsetAndType[index] = type << TYPE_SHIFT | end;
      if (firstCharOffset === -1) {
        firstCharOffset = start;
      }
      balance[index] = balanceStart;
      if (type === balanceCloseType) {
        const prevBalanceStart = balance[balanceStart];
        balance[balanceStart] = index;
        balanceStart = prevBalanceStart;
        balanceCloseType = balancePair$1[offsetAndType[prevBalanceStart] >> TYPE_SHIFT];
      } else if (this.isBlockOpenerTokenType(type)) {
        balanceStart = index;
        balanceCloseType = balancePair$1[type];
      }
    });
    offsetAndType[tokenCount] = EOF$1 << TYPE_SHIFT | sourceLength;
    balance[tokenCount] = tokenCount;
    for (let i = 0; i < tokenCount; i++) {
      const balanceStart2 = balance[i];
      if (balanceStart2 <= i) {
        const balanceEnd = balance[balanceStart2];
        if (balanceEnd !== i) {
          balance[i] = balanceEnd;
        }
      } else if (balanceStart2 > tokenCount) {
        balance[i] = tokenCount;
      }
    }
    this.source = source;
    this.firstCharOffset = firstCharOffset === -1 ? 0 : firstCharOffset;
    this.tokenCount = tokenCount;
    this.offsetAndType = offsetAndType;
    this.balance = balance;
    this.reset();
    this.next();
  }
  lookupType(offset) {
    offset += this.tokenIndex;
    if (offset < this.tokenCount) {
      return this.offsetAndType[offset] >> TYPE_SHIFT;
    }
    return EOF$1;
  }
  lookupTypeNonSC(idx) {
    for (let offset = this.tokenIndex; offset < this.tokenCount; offset++) {
      const tokenType2 = this.offsetAndType[offset] >> TYPE_SHIFT;
      if (tokenType2 !== WhiteSpace$1 && tokenType2 !== Comment$1) {
        if (idx-- === 0) {
          return tokenType2;
        }
      }
    }
    return EOF$1;
  }
  lookupOffset(offset) {
    offset += this.tokenIndex;
    if (offset < this.tokenCount) {
      return this.offsetAndType[offset - 1] & OFFSET_MASK;
    }
    return this.source.length;
  }
  lookupOffsetNonSC(idx) {
    for (let offset = this.tokenIndex; offset < this.tokenCount; offset++) {
      const tokenType2 = this.offsetAndType[offset] >> TYPE_SHIFT;
      if (tokenType2 !== WhiteSpace$1 && tokenType2 !== Comment$1) {
        if (idx-- === 0) {
          return offset - this.tokenIndex;
        }
      }
    }
    return EOF$1;
  }
  lookupValue(offset, referenceStr) {
    offset += this.tokenIndex;
    if (offset < this.tokenCount) {
      return cmpStr(
        this.source,
        this.offsetAndType[offset - 1] & OFFSET_MASK,
        this.offsetAndType[offset] & OFFSET_MASK,
        referenceStr
      );
    }
    return false;
  }
  getTokenStart(tokenIndex) {
    if (tokenIndex === this.tokenIndex) {
      return this.tokenStart;
    }
    if (tokenIndex > 0) {
      return tokenIndex < this.tokenCount ? this.offsetAndType[tokenIndex - 1] & OFFSET_MASK : this.offsetAndType[this.tokenCount] & OFFSET_MASK;
    }
    return this.firstCharOffset;
  }
  getTokenEnd(tokenIndex) {
    if (tokenIndex === this.tokenIndex) {
      return this.tokenEnd;
    }
    return this.offsetAndType[boundIndex(tokenIndex, 0, this.tokenCount)] & OFFSET_MASK;
  }
  getTokenType(tokenIndex) {
    if (tokenIndex === this.tokenIndex) {
      return this.tokenType;
    }
    return this.offsetAndType[boundIndex(tokenIndex, 0, this.tokenCount)] >> TYPE_SHIFT;
  }
  substrToCursor(start) {
    return this.source.substring(start, this.tokenStart);
  }
  isBlockOpenerTokenType(tokenType2) {
    return blockTokens[tokenType2] === BLOCK_OPEN_TOKEN;
  }
  isBlockCloserTokenType(tokenType2) {
    return blockTokens[tokenType2] === BLOCK_CLOSE_TOKEN;
  }
  getBlockTokenPairIndex(tokenIndex) {
    const type = this.getTokenType(tokenIndex);
    if (blockTokens[type] === 1) {
      const pairIndex = this.balance[tokenIndex];
      const closeType = this.getTokenType(pairIndex);
      return balancePair$1[type] === closeType ? pairIndex : -1;
    } else if (blockTokens[type] === 2) {
      const pairIndex = this.balance[tokenIndex];
      const openType = this.getTokenType(pairIndex);
      return balancePair$1[openType] === type ? pairIndex : -1;
    }
    return -1;
  }
  isBalanceEdge(tokenIndex) {
    return this.balance[this.tokenIndex] < tokenIndex;
  }
  isDelim(code2, offset) {
    if (offset) {
      return this.lookupType(offset) === Delim && this.source.charCodeAt(this.lookupOffset(offset)) === code2;
    }
    return this.tokenType === Delim && this.source.charCodeAt(this.tokenStart) === code2;
  }
  skip(tokenCount) {
    let next = this.tokenIndex + tokenCount;
    if (next < this.tokenCount) {
      this.tokenIndex = next;
      this.tokenStart = this.offsetAndType[next - 1] & OFFSET_MASK;
      next = this.offsetAndType[next];
      this.tokenType = next >> TYPE_SHIFT;
      this.tokenEnd = next & OFFSET_MASK;
    } else {
      this.tokenIndex = this.tokenCount;
      this.next();
    }
  }
  next() {
    let next = this.tokenIndex + 1;
    if (next < this.tokenCount) {
      this.tokenIndex = next;
      this.tokenStart = this.tokenEnd;
      next = this.offsetAndType[next];
      this.tokenType = next >> TYPE_SHIFT;
      this.tokenEnd = next & OFFSET_MASK;
    } else {
      this.eof = true;
      this.tokenIndex = this.tokenCount;
      this.tokenType = EOF$1;
      this.tokenStart = this.tokenEnd = this.source.length;
    }
  }
  skipSC() {
    while (this.tokenType === WhiteSpace$1 || this.tokenType === Comment$1) {
      this.next();
    }
  }
  skipUntilBalanced(startToken, stopConsume) {
    let cursor = startToken;
    let balanceEnd = 0;
    let offset = 0;
    loop:
      for (; cursor < this.tokenCount; cursor++) {
        balanceEnd = this.balance[cursor];
        if (balanceEnd < startToken) {
          break loop;
        }
        offset = cursor > 0 ? this.offsetAndType[cursor - 1] & OFFSET_MASK : this.firstCharOffset;
        switch (stopConsume(this.source.charCodeAt(offset))) {
          case 1:
            break loop;
          case 2:
            cursor++;
            break loop;
          default:
            if (this.isBlockOpenerTokenType(this.offsetAndType[cursor] >> TYPE_SHIFT)) {
              cursor = balanceEnd;
            }
        }
      }
    this.skip(cursor - this.tokenIndex);
  }
  forEachToken(fn) {
    for (let i = 0, offset = this.firstCharOffset; i < this.tokenCount; i++) {
      const start = offset;
      const item = this.offsetAndType[i];
      const end = item & OFFSET_MASK;
      const type = item >> TYPE_SHIFT;
      offset = end;
      fn(type, start, end, i);
    }
  }
  dump() {
    const tokens = new Array(this.tokenCount);
    this.forEachToken((type, start, end, index) => {
      tokens[index] = {
        idx: index,
        type: tokenNames[type],
        chunk: this.source.substring(start, end),
        balance: this.balance[index]
      };
    });
    return tokens;
  }
}
function tokenize$1(source, onToken) {
  function getCharCode2(offset2) {
    return offset2 < sourceLength ? source.charCodeAt(offset2) : 0;
  }
  function consumeNumericToken() {
    offset = consumeNumber(source, offset);
    if (isIdentifierStart(getCharCode2(offset), getCharCode2(offset + 1), getCharCode2(offset + 2))) {
      type = Dimension$1;
      offset = consumeName(source, offset);
      return;
    }
    if (getCharCode2(offset) === 37) {
      type = Percentage$1;
      offset++;
      return;
    }
    type = Number$2;
  }
  function consumeIdentLikeToken() {
    const nameStartOffset = offset;
    offset = consumeName(source, offset);
    if (cmpStr(source, nameStartOffset, offset, "url") && getCharCode2(offset) === 40) {
      offset = findWhiteSpaceEnd(source, offset + 1);
      if (getCharCode2(offset) === 34 || getCharCode2(offset) === 39) {
        type = Function$1;
        offset = nameStartOffset + 4;
        return;
      }
      consumeUrlToken();
      return;
    }
    if (getCharCode2(offset) === 40) {
      type = Function$1;
      offset++;
      return;
    }
    type = Ident;
  }
  function consumeStringToken(endingCodePoint) {
    if (!endingCodePoint) {
      endingCodePoint = getCharCode2(offset++);
    }
    type = String$2;
    for (; offset < source.length; offset++) {
      const code2 = source.charCodeAt(offset);
      switch (charCodeCategory(code2)) {
        // ending code point
        case endingCodePoint:
          offset++;
          return;
        // EOF
        // case EofCategory:
        // This is a parse error. Return the <string-token>.
        // return;
        // newline
        case WhiteSpaceCategory:
          if (isNewline(code2)) {
            offset += getNewlineLength(source, offset, code2);
            type = BadString;
            return;
          }
          break;
        // U+005C REVERSE SOLIDUS (\)
        case 92:
          if (offset === source.length - 1) {
            break;
          }
          const nextCode = getCharCode2(offset + 1);
          if (isNewline(nextCode)) {
            offset += getNewlineLength(source, offset + 1, nextCode);
          } else if (isValidEscape(code2, nextCode)) {
            offset = consumeEscaped(source, offset) - 1;
          }
          break;
      }
    }
  }
  function consumeUrlToken() {
    type = Url$1;
    offset = findWhiteSpaceEnd(source, offset);
    for (; offset < source.length; offset++) {
      const code2 = source.charCodeAt(offset);
      switch (charCodeCategory(code2)) {
        // U+0029 RIGHT PARENTHESIS ())
        case 41:
          offset++;
          return;
        // EOF
        // case EofCategory:
        // This is a parse error. Return the <url-token>.
        // return;
        // whitespace
        case WhiteSpaceCategory:
          offset = findWhiteSpaceEnd(source, offset);
          if (getCharCode2(offset) === 41 || offset >= source.length) {
            if (offset < source.length) {
              offset++;
            }
            return;
          }
          offset = consumeBadUrlRemnants(source, offset);
          type = BadUrl;
          return;
        // U+0022 QUOTATION MARK (")
        // U+0027 APOSTROPHE (')
        // U+0028 LEFT PARENTHESIS (()
        // non-printable code point
        case 34:
        case 39:
        case 40:
        case NonPrintableCategory:
          offset = consumeBadUrlRemnants(source, offset);
          type = BadUrl;
          return;
        // U+005C REVERSE SOLIDUS (\)
        case 92:
          if (isValidEscape(code2, getCharCode2(offset + 1))) {
            offset = consumeEscaped(source, offset) - 1;
            break;
          }
          offset = consumeBadUrlRemnants(source, offset);
          type = BadUrl;
          return;
      }
    }
  }
  source = String(source || "");
  const sourceLength = source.length;
  let start = isBOM(getCharCode2(0));
  let offset = start;
  let type;
  while (offset < sourceLength) {
    const code2 = source.charCodeAt(offset);
    switch (charCodeCategory(code2)) {
      // whitespace
      case WhiteSpaceCategory:
        type = WhiteSpace$1;
        offset = findWhiteSpaceEnd(source, offset + 1);
        break;
      // U+0022 QUOTATION MARK (")
      case 34:
        consumeStringToken();
        break;
      // U+0023 NUMBER SIGN (#)
      case 35:
        if (isName(getCharCode2(offset + 1)) || isValidEscape(getCharCode2(offset + 1), getCharCode2(offset + 2))) {
          type = Hash$1;
          offset = consumeName(source, offset + 1);
        } else {
          type = Delim;
          offset++;
        }
        break;
      // U+0027 APOSTROPHE (')
      case 39:
        consumeStringToken();
        break;
      // U+0028 LEFT PARENTHESIS (()
      case 40:
        type = LeftParenthesis;
        offset++;
        break;
      // U+0029 RIGHT PARENTHESIS ())
      case 41:
        type = RightParenthesis;
        offset++;
        break;
      // U+002B PLUS SIGN (+)
      case 43:
        if (isNumberStart(code2, getCharCode2(offset + 1), getCharCode2(offset + 2))) {
          consumeNumericToken();
        } else {
          type = Delim;
          offset++;
        }
        break;
      // U+002C COMMA (,)
      case 44:
        type = Comma;
        offset++;
        break;
      // U+002D HYPHEN-MINUS (-)
      case 45:
        if (isNumberStart(code2, getCharCode2(offset + 1), getCharCode2(offset + 2))) {
          consumeNumericToken();
        } else {
          if (getCharCode2(offset + 1) === 45 && getCharCode2(offset + 2) === 62) {
            type = CDC$1;
            offset = offset + 3;
          } else {
            if (isIdentifierStart(code2, getCharCode2(offset + 1), getCharCode2(offset + 2))) {
              consumeIdentLikeToken();
            } else {
              type = Delim;
              offset++;
            }
          }
        }
        break;
      // U+002E FULL STOP (.)
      case 46:
        if (isNumberStart(code2, getCharCode2(offset + 1), getCharCode2(offset + 2))) {
          consumeNumericToken();
        } else {
          type = Delim;
          offset++;
        }
        break;
      // U+002F SOLIDUS (/)
      case 47:
        if (getCharCode2(offset + 1) === 42) {
          type = Comment$1;
          offset = source.indexOf("*/", offset + 2);
          offset = offset === -1 ? source.length : offset + 2;
        } else {
          type = Delim;
          offset++;
        }
        break;
      // U+003A COLON (:)
      case 58:
        type = Colon;
        offset++;
        break;
      // U+003B SEMICOLON (;)
      case 59:
        type = Semicolon;
        offset++;
        break;
      // U+003C LESS-THAN SIGN (<)
      case 60:
        if (getCharCode2(offset + 1) === 33 && getCharCode2(offset + 2) === 45 && getCharCode2(offset + 3) === 45) {
          type = CDO$1;
          offset = offset + 4;
        } else {
          type = Delim;
          offset++;
        }
        break;
      // U+0040 COMMERCIAL AT (@)
      case 64:
        if (isIdentifierStart(getCharCode2(offset + 1), getCharCode2(offset + 2), getCharCode2(offset + 3))) {
          type = AtKeyword;
          offset = consumeName(source, offset + 1);
        } else {
          type = Delim;
          offset++;
        }
        break;
      // U+005B LEFT SQUARE BRACKET ([)
      case 91:
        type = LeftSquareBracket;
        offset++;
        break;
      // U+005C REVERSE SOLIDUS (\)
      case 92:
        if (isValidEscape(code2, getCharCode2(offset + 1))) {
          consumeIdentLikeToken();
        } else {
          type = Delim;
          offset++;
        }
        break;
      // U+005D RIGHT SQUARE BRACKET (])
      case 93:
        type = RightSquareBracket;
        offset++;
        break;
      // U+007B LEFT CURLY BRACKET ({)
      case 123:
        type = LeftCurlyBracket;
        offset++;
        break;
      // U+007D RIGHT CURLY BRACKET (})
      case 125:
        type = RightCurlyBracket;
        offset++;
        break;
      // digit
      case DigitCategory:
        consumeNumericToken();
        break;
      // name-start code point
      case NameStartCategory:
        consumeIdentLikeToken();
        break;
      // EOF
      // case EofCategory:
      // Return an <EOF-token>.
      // break;
      // anything else
      default:
        type = Delim;
        offset++;
    }
    onToken(type, start, start = offset);
  }
}
let releasedCursors = null;
class List {
  static createItem(data) {
    return {
      prev: null,
      next: null,
      data
    };
  }
  constructor() {
    this.head = null;
    this.tail = null;
    this.cursor = null;
  }
  createItem(data) {
    return List.createItem(data);
  }
  // cursor helpers
  allocateCursor(prev, next) {
    let cursor;
    if (releasedCursors !== null) {
      cursor = releasedCursors;
      releasedCursors = releasedCursors.cursor;
      cursor.prev = prev;
      cursor.next = next;
      cursor.cursor = this.cursor;
    } else {
      cursor = {
        prev,
        next,
        cursor: this.cursor
      };
    }
    this.cursor = cursor;
    return cursor;
  }
  releaseCursor() {
    const { cursor } = this;
    this.cursor = cursor.cursor;
    cursor.prev = null;
    cursor.next = null;
    cursor.cursor = releasedCursors;
    releasedCursors = cursor;
  }
  updateCursors(prevOld, prevNew, nextOld, nextNew) {
    let { cursor } = this;
    while (cursor !== null) {
      if (cursor.prev === prevOld) {
        cursor.prev = prevNew;
      }
      if (cursor.next === nextOld) {
        cursor.next = nextNew;
      }
      cursor = cursor.cursor;
    }
  }
  *[Symbol.iterator]() {
    for (let cursor = this.head; cursor !== null; cursor = cursor.next) {
      yield cursor.data;
    }
  }
  // getters
  get size() {
    let size = 0;
    for (let cursor = this.head; cursor !== null; cursor = cursor.next) {
      size++;
    }
    return size;
  }
  get isEmpty() {
    return this.head === null;
  }
  get first() {
    return this.head && this.head.data;
  }
  get last() {
    return this.tail && this.tail.data;
  }
  // convertors
  fromArray(array) {
    let cursor = null;
    this.head = null;
    for (let data of array) {
      const item = List.createItem(data);
      if (cursor !== null) {
        cursor.next = item;
      } else {
        this.head = item;
      }
      item.prev = cursor;
      cursor = item;
    }
    this.tail = cursor;
    return this;
  }
  toArray() {
    return [...this];
  }
  toJSON() {
    return [...this];
  }
  // array-like methods
  forEach(fn, thisArg = this) {
    const cursor = this.allocateCursor(null, this.head);
    while (cursor.next !== null) {
      const item = cursor.next;
      cursor.next = item.next;
      fn.call(thisArg, item.data, item, this);
    }
    this.releaseCursor();
  }
  forEachRight(fn, thisArg = this) {
    const cursor = this.allocateCursor(this.tail, null);
    while (cursor.prev !== null) {
      const item = cursor.prev;
      cursor.prev = item.prev;
      fn.call(thisArg, item.data, item, this);
    }
    this.releaseCursor();
  }
  reduce(fn, initialValue, thisArg = this) {
    let cursor = this.allocateCursor(null, this.head);
    let acc = initialValue;
    let item;
    while (cursor.next !== null) {
      item = cursor.next;
      cursor.next = item.next;
      acc = fn.call(thisArg, acc, item.data, item, this);
    }
    this.releaseCursor();
    return acc;
  }
  reduceRight(fn, initialValue, thisArg = this) {
    let cursor = this.allocateCursor(this.tail, null);
    let acc = initialValue;
    let item;
    while (cursor.prev !== null) {
      item = cursor.prev;
      cursor.prev = item.prev;
      acc = fn.call(thisArg, acc, item.data, item, this);
    }
    this.releaseCursor();
    return acc;
  }
  some(fn, thisArg = this) {
    for (let cursor = this.head; cursor !== null; cursor = cursor.next) {
      if (fn.call(thisArg, cursor.data, cursor, this)) {
        return true;
      }
    }
    return false;
  }
  map(fn, thisArg = this) {
    const result = new List();
    for (let cursor = this.head; cursor !== null; cursor = cursor.next) {
      result.appendData(fn.call(thisArg, cursor.data, cursor, this));
    }
    return result;
  }
  filter(fn, thisArg = this) {
    const result = new List();
    for (let cursor = this.head; cursor !== null; cursor = cursor.next) {
      if (fn.call(thisArg, cursor.data, cursor, this)) {
        result.appendData(cursor.data);
      }
    }
    return result;
  }
  nextUntil(start, fn, thisArg = this) {
    if (start === null) {
      return;
    }
    const cursor = this.allocateCursor(null, start);
    while (cursor.next !== null) {
      const item = cursor.next;
      cursor.next = item.next;
      if (fn.call(thisArg, item.data, item, this)) {
        break;
      }
    }
    this.releaseCursor();
  }
  prevUntil(start, fn, thisArg = this) {
    if (start === null) {
      return;
    }
    const cursor = this.allocateCursor(start, null);
    while (cursor.prev !== null) {
      const item = cursor.prev;
      cursor.prev = item.prev;
      if (fn.call(thisArg, item.data, item, this)) {
        break;
      }
    }
    this.releaseCursor();
  }
  // mutation
  clear() {
    this.head = null;
    this.tail = null;
  }
  copy() {
    const result = new List();
    for (let data of this) {
      result.appendData(data);
    }
    return result;
  }
  prepend(item) {
    this.updateCursors(null, item, this.head, item);
    if (this.head !== null) {
      this.head.prev = item;
      item.next = this.head;
    } else {
      this.tail = item;
    }
    this.head = item;
    return this;
  }
  prependData(data) {
    return this.prepend(List.createItem(data));
  }
  append(item) {
    return this.insert(item);
  }
  appendData(data) {
    return this.insert(List.createItem(data));
  }
  insert(item, before = null) {
    if (before !== null) {
      this.updateCursors(before.prev, item, before, item);
      if (before.prev === null) {
        if (this.head !== before) {
          throw new Error("before doesn't belong to list");
        }
        this.head = item;
        before.prev = item;
        item.next = before;
        this.updateCursors(null, item);
      } else {
        before.prev.next = item;
        item.prev = before.prev;
        before.prev = item;
        item.next = before;
      }
    } else {
      this.updateCursors(this.tail, item, null, item);
      if (this.tail !== null) {
        this.tail.next = item;
        item.prev = this.tail;
      } else {
        this.head = item;
      }
      this.tail = item;
    }
    return this;
  }
  insertData(data, before) {
    return this.insert(List.createItem(data), before);
  }
  remove(item) {
    this.updateCursors(item, item.prev, item, item.next);
    if (item.prev !== null) {
      item.prev.next = item.next;
    } else {
      if (this.head !== item) {
        throw new Error("item doesn't belong to list");
      }
      this.head = item.next;
    }
    if (item.next !== null) {
      item.next.prev = item.prev;
    } else {
      if (this.tail !== item) {
        throw new Error("item doesn't belong to list");
      }
      this.tail = item.prev;
    }
    item.prev = null;
    item.next = null;
    return item;
  }
  push(data) {
    this.insert(List.createItem(data));
  }
  pop() {
    return this.tail !== null ? this.remove(this.tail) : null;
  }
  unshift(data) {
    this.prepend(List.createItem(data));
  }
  shift() {
    return this.head !== null ? this.remove(this.head) : null;
  }
  prependList(list) {
    return this.insertList(list, this.head);
  }
  appendList(list) {
    return this.insertList(list);
  }
  insertList(list, before) {
    if (list.head === null) {
      return this;
    }
    if (before !== void 0 && before !== null) {
      this.updateCursors(before.prev, list.tail, before, list.head);
      if (before.prev !== null) {
        before.prev.next = list.head;
        list.head.prev = before.prev;
      } else {
        this.head = list.head;
      }
      before.prev = list.tail;
      list.tail.next = before;
    } else {
      this.updateCursors(this.tail, list.tail, null, list.head);
      if (this.tail !== null) {
        this.tail.next = list.head;
        list.head.prev = this.tail;
      } else {
        this.head = list.head;
      }
      this.tail = list.tail;
    }
    list.head = null;
    list.tail = null;
    return this;
  }
  replace(oldItem, newItemOrList) {
    if ("head" in newItemOrList) {
      this.insertList(newItemOrList, oldItem);
    } else {
      this.insert(newItemOrList, oldItem);
    }
    this.remove(oldItem);
  }
}
function createCustomError(name2, message) {
  const error = Object.create(SyntaxError.prototype);
  const errorStack = new Error();
  return Object.assign(error, {
    name: name2,
    message,
    get stack() {
      return (errorStack.stack || "").replace(/^(.+\n){1,3}/, `${name2}: ${message}
`);
    }
  });
}
const MAX_LINE_LENGTH = 100;
const OFFSET_CORRECTION = 60;
const TAB_REPLACEMENT = "    ";
function sourceFragment({ source, line, column, baseLine, baseColumn }, extraLines) {
  function processLines(start, end) {
    return lines.slice(start, end).map(
      (line2, idx) => String(start + idx + 1).padStart(maxNumLength) + " |" + line2
    ).join("\n");
  }
  const prelines = "\n".repeat(Math.max(baseLine - 1, 0));
  const precolumns = " ".repeat(Math.max(baseColumn - 1, 0));
  const lines = (prelines + precolumns + source).split(/\r\n?|\n|\f/);
  const startLine = Math.max(1, line - extraLines) - 1;
  const endLine = Math.min(line + extraLines, lines.length + 1);
  const maxNumLength = Math.max(4, String(endLine).length) + 1;
  let cutLeft = 0;
  column += (TAB_REPLACEMENT.length - 1) * (lines[line - 1].substr(0, column - 1).match(/\t/g) || []).length;
  if (column > MAX_LINE_LENGTH) {
    cutLeft = column - OFFSET_CORRECTION + 3;
    column = OFFSET_CORRECTION - 2;
  }
  for (let i = startLine; i <= endLine; i++) {
    if (i >= 0 && i < lines.length) {
      lines[i] = lines[i].replace(/\t/g, TAB_REPLACEMENT);
      lines[i] = (cutLeft > 0 && lines[i].length > cutLeft ? "…" : "") + lines[i].substr(cutLeft, MAX_LINE_LENGTH - 2) + (lines[i].length > cutLeft + MAX_LINE_LENGTH - 1 ? "…" : "");
    }
  }
  return [
    processLines(startLine, line),
    new Array(column + maxNumLength + 2).join("-") + "^",
    processLines(line, endLine)
  ].filter(Boolean).join("\n").replace(/^(\s+\d+\s+\|\n)+/, "").replace(/\n(\s+\d+\s+\|)+$/, "");
}
function SyntaxError$2(message, source, offset, line, column, baseLine = 1, baseColumn = 1) {
  const error = Object.assign(createCustomError("SyntaxError", message), {
    source,
    offset,
    line,
    column,
    sourceFragment(extraLines) {
      return sourceFragment({ source, line, column, baseLine, baseColumn }, isNaN(extraLines) ? 0 : extraLines);
    },
    get formattedMessage() {
      return `Parse error: ${message}
` + sourceFragment({ source, line, column, baseLine, baseColumn }, 2);
    }
  });
  return error;
}
function readSequence(recognizer) {
  const children = this.createList();
  let space = false;
  const context = {
    recognizer
  };
  while (!this.eof) {
    switch (this.tokenType) {
      case Comment$1:
        this.next();
        continue;
      case WhiteSpace$1:
        space = true;
        this.next();
        continue;
    }
    let child = recognizer.getNode.call(this, context);
    if (child === void 0) {
      break;
    }
    if (space) {
      if (recognizer.onWhiteSpace) {
        recognizer.onWhiteSpace.call(this, child, children, context);
      }
      space = false;
    }
    children.push(child);
  }
  if (space && recognizer.onWhiteSpace) {
    recognizer.onWhiteSpace.call(this, null, children, context);
  }
  return children;
}
const NOOP = () => {
};
const EXCLAMATIONMARK$3 = 33;
const NUMBERSIGN$4 = 35;
const SEMICOLON = 59;
const LEFTCURLYBRACKET$1 = 123;
const NULL = 0;
const arrayMethods = {
  createList() {
    return [];
  },
  createSingleNodeList(node2) {
    return [node2];
  },
  getFirstListNode(list) {
    return list && list[0] || null;
  },
  getLastListNode(list) {
    return list && list.length > 0 ? list[list.length - 1] : null;
  }
};
const listMethods = {
  createList() {
    return new List();
  },
  createSingleNodeList(node2) {
    return new List().appendData(node2);
  },
  getFirstListNode(list) {
    return list && list.first;
  },
  getLastListNode(list) {
    return list && list.last;
  }
};
function createParseContext(name2) {
  return function() {
    return this[name2]();
  };
}
function fetchParseValues(dict) {
  const result = /* @__PURE__ */ Object.create(null);
  for (const name2 of Object.keys(dict)) {
    const item = dict[name2];
    const fn = item.parse || item;
    if (fn) {
      result[name2] = fn;
    }
  }
  return result;
}
function processConfig(config) {
  const parseConfig = {
    context: /* @__PURE__ */ Object.create(null),
    features: Object.assign(/* @__PURE__ */ Object.create(null), config.features),
    scope: Object.assign(/* @__PURE__ */ Object.create(null), config.scope),
    atrule: fetchParseValues(config.atrule),
    pseudo: fetchParseValues(config.pseudo),
    node: fetchParseValues(config.node)
  };
  for (const [name2, context] of Object.entries(config.parseContext)) {
    switch (typeof context) {
      case "function":
        parseConfig.context[name2] = context;
        break;
      case "string":
        parseConfig.context[name2] = createParseContext(context);
        break;
    }
  }
  return {
    config: parseConfig,
    ...parseConfig,
    ...parseConfig.node
  };
}
function createParser(config) {
  let source = "";
  let filename = "<unknown>";
  let needPositions = false;
  let onParseError = NOOP;
  let onParseErrorThrow = false;
  const locationMap = new OffsetToLocation();
  const parser = Object.assign(new TokenStream(), processConfig(config || {}), {
    parseAtrulePrelude: true,
    parseRulePrelude: true,
    parseValue: true,
    parseCustomProperty: false,
    readSequence,
    consumeUntilBalanceEnd: () => 0,
    consumeUntilLeftCurlyBracket(code2) {
      return code2 === LEFTCURLYBRACKET$1 ? 1 : 0;
    },
    consumeUntilLeftCurlyBracketOrSemicolon(code2) {
      return code2 === LEFTCURLYBRACKET$1 || code2 === SEMICOLON ? 1 : 0;
    },
    consumeUntilExclamationMarkOrSemicolon(code2) {
      return code2 === EXCLAMATIONMARK$3 || code2 === SEMICOLON ? 1 : 0;
    },
    consumeUntilSemicolonIncluded(code2) {
      return code2 === SEMICOLON ? 2 : 0;
    },
    createList: NOOP,
    createSingleNodeList: NOOP,
    getFirstListNode: NOOP,
    getLastListNode: NOOP,
    parseWithFallback(consumer, fallback) {
      const startIndex = this.tokenIndex;
      try {
        return consumer.call(this);
      } catch (e) {
        if (onParseErrorThrow) {
          throw e;
        }
        this.skip(startIndex - this.tokenIndex);
        const fallbackNode = fallback.call(this);
        onParseErrorThrow = true;
        onParseError(e, fallbackNode);
        onParseErrorThrow = false;
        return fallbackNode;
      }
    },
    lookupNonWSType(offset) {
      let type;
      do {
        type = this.lookupType(offset++);
        if (type !== WhiteSpace$1 && type !== Comment$1) {
          return type;
        }
      } while (type !== NULL);
      return NULL;
    },
    charCodeAt(offset) {
      return offset >= 0 && offset < source.length ? source.charCodeAt(offset) : 0;
    },
    substring(offsetStart, offsetEnd) {
      return source.substring(offsetStart, offsetEnd);
    },
    substrToCursor(start) {
      return this.source.substring(start, this.tokenStart);
    },
    cmpChar(offset, charCode) {
      return cmpChar(source, offset, charCode);
    },
    cmpStr(offsetStart, offsetEnd, str) {
      return cmpStr(source, offsetStart, offsetEnd, str);
    },
    consume(tokenType2) {
      const start = this.tokenStart;
      this.eat(tokenType2);
      return this.substrToCursor(start);
    },
    consumeFunctionName() {
      const name2 = source.substring(this.tokenStart, this.tokenEnd - 1);
      this.eat(Function$1);
      return name2;
    },
    consumeNumber(type) {
      const number2 = source.substring(this.tokenStart, consumeNumber(source, this.tokenStart));
      this.eat(type);
      return number2;
    },
    eat(tokenType2) {
      if (this.tokenType !== tokenType2) {
        const tokenName = tokenNames[tokenType2].slice(0, -6).replace(/-/g, " ").replace(/^./, (m) => m.toUpperCase());
        let message = `${/[[\](){}]/.test(tokenName) ? `"${tokenName}"` : tokenName} is expected`;
        let offset = this.tokenStart;
        switch (tokenType2) {
          case Ident:
            if (this.tokenType === Function$1 || this.tokenType === Url$1) {
              offset = this.tokenEnd - 1;
              message = "Identifier is expected but function found";
            } else {
              message = "Identifier is expected";
            }
            break;
          case Hash$1:
            if (this.isDelim(NUMBERSIGN$4)) {
              this.next();
              offset++;
              message = "Name is expected";
            }
            break;
          case Percentage$1:
            if (this.tokenType === Number$2) {
              offset = this.tokenEnd;
              message = "Percent sign is expected";
            }
            break;
        }
        this.error(message, offset);
      }
      this.next();
    },
    eatIdent(name2) {
      if (this.tokenType !== Ident || this.lookupValue(0, name2) === false) {
        this.error(`Identifier "${name2}" is expected`);
      }
      this.next();
    },
    eatDelim(code2) {
      if (!this.isDelim(code2)) {
        this.error(`Delim "${String.fromCharCode(code2)}" is expected`);
      }
      this.next();
    },
    getLocation(start, end) {
      if (needPositions) {
        return locationMap.getLocationRange(
          start,
          end,
          filename
        );
      }
      return null;
    },
    getLocationFromList(list) {
      if (needPositions) {
        const head = this.getFirstListNode(list);
        const tail = this.getLastListNode(list);
        return locationMap.getLocationRange(
          head !== null ? head.loc.start.offset - locationMap.startOffset : this.tokenStart,
          tail !== null ? tail.loc.end.offset - locationMap.startOffset : this.tokenStart,
          filename
        );
      }
      return null;
    },
    error(message, offset) {
      const location = typeof offset !== "undefined" && offset < source.length ? locationMap.getLocation(offset) : this.eof ? locationMap.getLocation(findWhiteSpaceStart(source, source.length - 1)) : locationMap.getLocation(this.tokenStart);
      throw new SyntaxError$2(
        message || "Unexpected input",
        source,
        location.offset,
        location.line,
        location.column,
        locationMap.startLine,
        locationMap.startColumn
      );
    }
  });
  const createTokenIterateAPI = () => ({
    filename,
    source,
    tokenCount: parser.tokenCount,
    getTokenType: (index) => parser.getTokenType(index),
    getTokenTypeName: (index) => tokenNames[parser.getTokenType(index)],
    getTokenStart: (index) => parser.getTokenStart(index),
    getTokenEnd: (index) => parser.getTokenEnd(index),
    getTokenValue: (index) => parser.source.substring(parser.getTokenStart(index), parser.getTokenEnd(index)),
    substring: (start, end) => parser.source.substring(start, end),
    balance: parser.balance.subarray(0, parser.tokenCount + 1),
    isBlockOpenerTokenType: parser.isBlockOpenerTokenType,
    isBlockCloserTokenType: parser.isBlockCloserTokenType,
    getBlockTokenPairIndex: (index) => parser.getBlockTokenPairIndex(index),
    getLocation: (offset) => locationMap.getLocation(offset, filename),
    getRangeLocation: (start, end) => locationMap.getLocationRange(start, end, filename)
  });
  const parse2 = function(source_, options) {
    source = source_;
    options = options || {};
    parser.setSource(source, tokenize$1);
    locationMap.setSource(
      source,
      options.offset,
      options.line,
      options.column
    );
    filename = options.filename || "<unknown>";
    needPositions = Boolean(options.positions);
    onParseError = typeof options.onParseError === "function" ? options.onParseError : NOOP;
    onParseErrorThrow = false;
    parser.parseAtrulePrelude = "parseAtrulePrelude" in options ? Boolean(options.parseAtrulePrelude) : true;
    parser.parseRulePrelude = "parseRulePrelude" in options ? Boolean(options.parseRulePrelude) : true;
    parser.parseValue = "parseValue" in options ? Boolean(options.parseValue) : true;
    parser.parseCustomProperty = "parseCustomProperty" in options ? Boolean(options.parseCustomProperty) : false;
    const { context = "default", list = true, onComment, onToken } = options;
    if (context in parser.context === false) {
      throw new Error("Unknown context `" + context + "`");
    }
    Object.assign(parser, list ? listMethods : arrayMethods);
    if (Array.isArray(onToken)) {
      parser.forEachToken((type, start, end) => {
        onToken.push({ type, start, end });
      });
    } else if (typeof onToken === "function") {
      parser.forEachToken(onToken.bind(createTokenIterateAPI()));
    }
    if (typeof onComment === "function") {
      parser.forEachToken((type, start, end) => {
        if (type === Comment$1) {
          const loc = parser.getLocation(start, end);
          const value2 = cmpStr(source, end - 2, end, "*/") ? source.slice(start + 2, end - 2) : source.slice(start + 2, end);
          onComment(value2, loc);
        }
      });
    }
    const ast = parser.context[context].call(parser, options);
    if (!parser.eof) {
      parser.error();
    }
    return ast;
  };
  return Object.assign(parse2, {
    SyntaxError: SyntaxError$2,
    config: parser.config
  });
}
var sourceMapGenerator = {};
var base64Vlq = {};
var base64 = {};
var hasRequiredBase64;
function requireBase64() {
  if (hasRequiredBase64) return base64;
  hasRequiredBase64 = 1;
  var intToCharMap = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split("");
  base64.encode = function(number2) {
    if (0 <= number2 && number2 < intToCharMap.length) {
      return intToCharMap[number2];
    }
    throw new TypeError("Must be between 0 and 63: " + number2);
  };
  base64.decode = function(charCode) {
    var bigA = 65;
    var bigZ = 90;
    var littleA = 97;
    var littleZ = 122;
    var zero2 = 48;
    var nine = 57;
    var plus = 43;
    var slash = 47;
    var littleOffset = 26;
    var numberOffset = 52;
    if (bigA <= charCode && charCode <= bigZ) {
      return charCode - bigA;
    }
    if (littleA <= charCode && charCode <= littleZ) {
      return charCode - littleA + littleOffset;
    }
    if (zero2 <= charCode && charCode <= nine) {
      return charCode - zero2 + numberOffset;
    }
    if (charCode == plus) {
      return 62;
    }
    if (charCode == slash) {
      return 63;
    }
    return -1;
  };
  return base64;
}
var hasRequiredBase64Vlq;
function requireBase64Vlq() {
  if (hasRequiredBase64Vlq) return base64Vlq;
  hasRequiredBase64Vlq = 1;
  var base642 = requireBase64();
  var VLQ_BASE_SHIFT = 5;
  var VLQ_BASE = 1 << VLQ_BASE_SHIFT;
  var VLQ_BASE_MASK = VLQ_BASE - 1;
  var VLQ_CONTINUATION_BIT = VLQ_BASE;
  function toVLQSigned(aValue) {
    return aValue < 0 ? (-aValue << 1) + 1 : (aValue << 1) + 0;
  }
  function fromVLQSigned(aValue) {
    var isNegative = (aValue & 1) === 1;
    var shifted = aValue >> 1;
    return isNegative ? -shifted : shifted;
  }
  base64Vlq.encode = function base64VLQ_encode(aValue) {
    var encoded = "";
    var digit;
    var vlq = toVLQSigned(aValue);
    do {
      digit = vlq & VLQ_BASE_MASK;
      vlq >>>= VLQ_BASE_SHIFT;
      if (vlq > 0) {
        digit |= VLQ_CONTINUATION_BIT;
      }
      encoded += base642.encode(digit);
    } while (vlq > 0);
    return encoded;
  };
  base64Vlq.decode = function base64VLQ_decode(aStr, aIndex, aOutParam) {
    var strLen = aStr.length;
    var result = 0;
    var shift = 0;
    var continuation, digit;
    do {
      if (aIndex >= strLen) {
        throw new Error("Expected more digits in base 64 VLQ value.");
      }
      digit = base642.decode(aStr.charCodeAt(aIndex++));
      if (digit === -1) {
        throw new Error("Invalid base64 digit: " + aStr.charAt(aIndex - 1));
      }
      continuation = !!(digit & VLQ_CONTINUATION_BIT);
      digit &= VLQ_BASE_MASK;
      result = result + (digit << shift);
      shift += VLQ_BASE_SHIFT;
    } while (continuation);
    aOutParam.value = fromVLQSigned(result);
    aOutParam.rest = aIndex;
  };
  return base64Vlq;
}
var util = {};
var hasRequiredUtil;
function requireUtil() {
  if (hasRequiredUtil) return util;
  hasRequiredUtil = 1;
  (function(exports) {
    function getArg(aArgs, aName, aDefaultValue) {
      if (aName in aArgs) {
        return aArgs[aName];
      } else if (arguments.length === 3) {
        return aDefaultValue;
      } else {
        throw new Error('"' + aName + '" is a required argument.');
      }
    }
    exports.getArg = getArg;
    var urlRegexp = /^(?:([\w+\-.]+):)?\/\/(?:(\w+:\w+)@)?([\w.-]*)(?::(\d+))?(.*)$/;
    var dataUrlRegexp = /^data:.+\,.+$/;
    function urlParse(aUrl) {
      var match = aUrl.match(urlRegexp);
      if (!match) {
        return null;
      }
      return {
        scheme: match[1],
        auth: match[2],
        host: match[3],
        port: match[4],
        path: match[5]
      };
    }
    exports.urlParse = urlParse;
    function urlGenerate(aParsedUrl) {
      var url = "";
      if (aParsedUrl.scheme) {
        url += aParsedUrl.scheme + ":";
      }
      url += "//";
      if (aParsedUrl.auth) {
        url += aParsedUrl.auth + "@";
      }
      if (aParsedUrl.host) {
        url += aParsedUrl.host;
      }
      if (aParsedUrl.port) {
        url += ":" + aParsedUrl.port;
      }
      if (aParsedUrl.path) {
        url += aParsedUrl.path;
      }
      return url;
    }
    exports.urlGenerate = urlGenerate;
    var MAX_CACHED_INPUTS = 32;
    function lruMemoize(f) {
      var cache = [];
      return function(input) {
        for (var i = 0; i < cache.length; i++) {
          if (cache[i].input === input) {
            var temp = cache[0];
            cache[0] = cache[i];
            cache[i] = temp;
            return cache[0].result;
          }
        }
        var result = f(input);
        cache.unshift({
          input,
          result
        });
        if (cache.length > MAX_CACHED_INPUTS) {
          cache.pop();
        }
        return result;
      };
    }
    var normalize = lruMemoize(function normalize2(aPath) {
      var path = aPath;
      var url = urlParse(aPath);
      if (url) {
        if (!url.path) {
          return aPath;
        }
        path = url.path;
      }
      var isAbsolute = exports.isAbsolute(path);
      var parts = [];
      var start = 0;
      var i = 0;
      while (true) {
        start = i;
        i = path.indexOf("/", start);
        if (i === -1) {
          parts.push(path.slice(start));
          break;
        } else {
          parts.push(path.slice(start, i));
          while (i < path.length && path[i] === "/") {
            i++;
          }
        }
      }
      for (var part, up = 0, i = parts.length - 1; i >= 0; i--) {
        part = parts[i];
        if (part === ".") {
          parts.splice(i, 1);
        } else if (part === "..") {
          up++;
        } else if (up > 0) {
          if (part === "") {
            parts.splice(i + 1, up);
            up = 0;
          } else {
            parts.splice(i, 2);
            up--;
          }
        }
      }
      path = parts.join("/");
      if (path === "") {
        path = isAbsolute ? "/" : ".";
      }
      if (url) {
        url.path = path;
        return urlGenerate(url);
      }
      return path;
    });
    exports.normalize = normalize;
    function join(aRoot, aPath) {
      if (aRoot === "") {
        aRoot = ".";
      }
      if (aPath === "") {
        aPath = ".";
      }
      var aPathUrl = urlParse(aPath);
      var aRootUrl = urlParse(aRoot);
      if (aRootUrl) {
        aRoot = aRootUrl.path || "/";
      }
      if (aPathUrl && !aPathUrl.scheme) {
        if (aRootUrl) {
          aPathUrl.scheme = aRootUrl.scheme;
        }
        return urlGenerate(aPathUrl);
      }
      if (aPathUrl || aPath.match(dataUrlRegexp)) {
        return aPath;
      }
      if (aRootUrl && !aRootUrl.host && !aRootUrl.path) {
        aRootUrl.host = aPath;
        return urlGenerate(aRootUrl);
      }
      var joined = aPath.charAt(0) === "/" ? aPath : normalize(aRoot.replace(/\/+$/, "") + "/" + aPath);
      if (aRootUrl) {
        aRootUrl.path = joined;
        return urlGenerate(aRootUrl);
      }
      return joined;
    }
    exports.join = join;
    exports.isAbsolute = function(aPath) {
      return aPath.charAt(0) === "/" || urlRegexp.test(aPath);
    };
    function relative(aRoot, aPath) {
      if (aRoot === "") {
        aRoot = ".";
      }
      aRoot = aRoot.replace(/\/$/, "");
      var level = 0;
      while (aPath.indexOf(aRoot + "/") !== 0) {
        var index = aRoot.lastIndexOf("/");
        if (index < 0) {
          return aPath;
        }
        aRoot = aRoot.slice(0, index);
        if (aRoot.match(/^([^\/]+:\/)?\/*$/)) {
          return aPath;
        }
        ++level;
      }
      return Array(level + 1).join("../") + aPath.substr(aRoot.length + 1);
    }
    exports.relative = relative;
    var supportsNullProto = (function() {
      var obj = /* @__PURE__ */ Object.create(null);
      return !("__proto__" in obj);
    })();
    function identity(s) {
      return s;
    }
    function toSetString(aStr) {
      if (isProtoString(aStr)) {
        return "$" + aStr;
      }
      return aStr;
    }
    exports.toSetString = supportsNullProto ? identity : toSetString;
    function fromSetString(aStr) {
      if (isProtoString(aStr)) {
        return aStr.slice(1);
      }
      return aStr;
    }
    exports.fromSetString = supportsNullProto ? identity : fromSetString;
    function isProtoString(s) {
      if (!s) {
        return false;
      }
      var length2 = s.length;
      if (length2 < 9) {
        return false;
      }
      if (s.charCodeAt(length2 - 1) !== 95 || s.charCodeAt(length2 - 2) !== 95 || s.charCodeAt(length2 - 3) !== 111 || s.charCodeAt(length2 - 4) !== 116 || s.charCodeAt(length2 - 5) !== 111 || s.charCodeAt(length2 - 6) !== 114 || s.charCodeAt(length2 - 7) !== 112 || s.charCodeAt(length2 - 8) !== 95 || s.charCodeAt(length2 - 9) !== 95) {
        return false;
      }
      for (var i = length2 - 10; i >= 0; i--) {
        if (s.charCodeAt(i) !== 36) {
          return false;
        }
      }
      return true;
    }
    function compareByOriginalPositions(mappingA, mappingB, onlyCompareOriginal) {
      var cmp = strcmp(mappingA.source, mappingB.source);
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.originalLine - mappingB.originalLine;
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.originalColumn - mappingB.originalColumn;
      if (cmp !== 0 || onlyCompareOriginal) {
        return cmp;
      }
      cmp = mappingA.generatedColumn - mappingB.generatedColumn;
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.generatedLine - mappingB.generatedLine;
      if (cmp !== 0) {
        return cmp;
      }
      return strcmp(mappingA.name, mappingB.name);
    }
    exports.compareByOriginalPositions = compareByOriginalPositions;
    function compareByOriginalPositionsNoSource(mappingA, mappingB, onlyCompareOriginal) {
      var cmp;
      cmp = mappingA.originalLine - mappingB.originalLine;
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.originalColumn - mappingB.originalColumn;
      if (cmp !== 0 || onlyCompareOriginal) {
        return cmp;
      }
      cmp = mappingA.generatedColumn - mappingB.generatedColumn;
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.generatedLine - mappingB.generatedLine;
      if (cmp !== 0) {
        return cmp;
      }
      return strcmp(mappingA.name, mappingB.name);
    }
    exports.compareByOriginalPositionsNoSource = compareByOriginalPositionsNoSource;
    function compareByGeneratedPositionsDeflated(mappingA, mappingB, onlyCompareGenerated) {
      var cmp = mappingA.generatedLine - mappingB.generatedLine;
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.generatedColumn - mappingB.generatedColumn;
      if (cmp !== 0 || onlyCompareGenerated) {
        return cmp;
      }
      cmp = strcmp(mappingA.source, mappingB.source);
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.originalLine - mappingB.originalLine;
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.originalColumn - mappingB.originalColumn;
      if (cmp !== 0) {
        return cmp;
      }
      return strcmp(mappingA.name, mappingB.name);
    }
    exports.compareByGeneratedPositionsDeflated = compareByGeneratedPositionsDeflated;
    function compareByGeneratedPositionsDeflatedNoLine(mappingA, mappingB, onlyCompareGenerated) {
      var cmp = mappingA.generatedColumn - mappingB.generatedColumn;
      if (cmp !== 0 || onlyCompareGenerated) {
        return cmp;
      }
      cmp = strcmp(mappingA.source, mappingB.source);
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.originalLine - mappingB.originalLine;
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.originalColumn - mappingB.originalColumn;
      if (cmp !== 0) {
        return cmp;
      }
      return strcmp(mappingA.name, mappingB.name);
    }
    exports.compareByGeneratedPositionsDeflatedNoLine = compareByGeneratedPositionsDeflatedNoLine;
    function strcmp(aStr1, aStr2) {
      if (aStr1 === aStr2) {
        return 0;
      }
      if (aStr1 === null) {
        return 1;
      }
      if (aStr2 === null) {
        return -1;
      }
      if (aStr1 > aStr2) {
        return 1;
      }
      return -1;
    }
    function compareByGeneratedPositionsInflated(mappingA, mappingB) {
      var cmp = mappingA.generatedLine - mappingB.generatedLine;
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.generatedColumn - mappingB.generatedColumn;
      if (cmp !== 0) {
        return cmp;
      }
      cmp = strcmp(mappingA.source, mappingB.source);
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.originalLine - mappingB.originalLine;
      if (cmp !== 0) {
        return cmp;
      }
      cmp = mappingA.originalColumn - mappingB.originalColumn;
      if (cmp !== 0) {
        return cmp;
      }
      return strcmp(mappingA.name, mappingB.name);
    }
    exports.compareByGeneratedPositionsInflated = compareByGeneratedPositionsInflated;
    function parseSourceMapInput(str) {
      return JSON.parse(str.replace(/^\)]}'[^\n]*\n/, ""));
    }
    exports.parseSourceMapInput = parseSourceMapInput;
    function computeSourceURL(sourceRoot, sourceURL, sourceMapURL) {
      sourceURL = sourceURL || "";
      if (sourceRoot) {
        if (sourceRoot[sourceRoot.length - 1] !== "/" && sourceURL[0] !== "/") {
          sourceRoot += "/";
        }
        sourceURL = sourceRoot + sourceURL;
      }
      if (sourceMapURL) {
        var parsed = urlParse(sourceMapURL);
        if (!parsed) {
          throw new Error("sourceMapURL could not be parsed");
        }
        if (parsed.path) {
          var index = parsed.path.lastIndexOf("/");
          if (index >= 0) {
            parsed.path = parsed.path.substring(0, index + 1);
          }
        }
        sourceURL = join(urlGenerate(parsed), sourceURL);
      }
      return normalize(sourceURL);
    }
    exports.computeSourceURL = computeSourceURL;
  })(util);
  return util;
}
var arraySet = {};
var hasRequiredArraySet;
function requireArraySet() {
  if (hasRequiredArraySet) return arraySet;
  hasRequiredArraySet = 1;
  var util2 = requireUtil();
  var has = Object.prototype.hasOwnProperty;
  var hasNativeMap = typeof Map !== "undefined";
  function ArraySet() {
    this._array = [];
    this._set = hasNativeMap ? /* @__PURE__ */ new Map() : /* @__PURE__ */ Object.create(null);
  }
  ArraySet.fromArray = function ArraySet_fromArray(aArray, aAllowDuplicates) {
    var set = new ArraySet();
    for (var i = 0, len = aArray.length; i < len; i++) {
      set.add(aArray[i], aAllowDuplicates);
    }
    return set;
  };
  ArraySet.prototype.size = function ArraySet_size() {
    return hasNativeMap ? this._set.size : Object.getOwnPropertyNames(this._set).length;
  };
  ArraySet.prototype.add = function ArraySet_add(aStr, aAllowDuplicates) {
    var sStr = hasNativeMap ? aStr : util2.toSetString(aStr);
    var isDuplicate = hasNativeMap ? this.has(aStr) : has.call(this._set, sStr);
    var idx = this._array.length;
    if (!isDuplicate || aAllowDuplicates) {
      this._array.push(aStr);
    }
    if (!isDuplicate) {
      if (hasNativeMap) {
        this._set.set(aStr, idx);
      } else {
        this._set[sStr] = idx;
      }
    }
  };
  ArraySet.prototype.has = function ArraySet_has(aStr) {
    if (hasNativeMap) {
      return this._set.has(aStr);
    } else {
      var sStr = util2.toSetString(aStr);
      return has.call(this._set, sStr);
    }
  };
  ArraySet.prototype.indexOf = function ArraySet_indexOf(aStr) {
    if (hasNativeMap) {
      var idx = this._set.get(aStr);
      if (idx >= 0) {
        return idx;
      }
    } else {
      var sStr = util2.toSetString(aStr);
      if (has.call(this._set, sStr)) {
        return this._set[sStr];
      }
    }
    throw new Error('"' + aStr + '" is not in the set.');
  };
  ArraySet.prototype.at = function ArraySet_at(aIdx) {
    if (aIdx >= 0 && aIdx < this._array.length) {
      return this._array[aIdx];
    }
    throw new Error("No element indexed by " + aIdx);
  };
  ArraySet.prototype.toArray = function ArraySet_toArray() {
    return this._array.slice();
  };
  arraySet.ArraySet = ArraySet;
  return arraySet;
}
var mappingList = {};
var hasRequiredMappingList;
function requireMappingList() {
  if (hasRequiredMappingList) return mappingList;
  hasRequiredMappingList = 1;
  var util2 = requireUtil();
  function generatedPositionAfter(mappingA, mappingB) {
    var lineA = mappingA.generatedLine;
    var lineB = mappingB.generatedLine;
    var columnA = mappingA.generatedColumn;
    var columnB = mappingB.generatedColumn;
    return lineB > lineA || lineB == lineA && columnB >= columnA || util2.compareByGeneratedPositionsInflated(mappingA, mappingB) <= 0;
  }
  function MappingList() {
    this._array = [];
    this._sorted = true;
    this._last = { generatedLine: -1, generatedColumn: 0 };
  }
  MappingList.prototype.unsortedForEach = function MappingList_forEach(aCallback, aThisArg) {
    this._array.forEach(aCallback, aThisArg);
  };
  MappingList.prototype.add = function MappingList_add(aMapping) {
    if (generatedPositionAfter(this._last, aMapping)) {
      this._last = aMapping;
      this._array.push(aMapping);
    } else {
      this._sorted = false;
      this._array.push(aMapping);
    }
  };
  MappingList.prototype.toArray = function MappingList_toArray() {
    if (!this._sorted) {
      this._array.sort(util2.compareByGeneratedPositionsInflated);
      this._sorted = true;
    }
    return this._array;
  };
  mappingList.MappingList = MappingList;
  return mappingList;
}
var hasRequiredSourceMapGenerator;
function requireSourceMapGenerator() {
  if (hasRequiredSourceMapGenerator) return sourceMapGenerator;
  hasRequiredSourceMapGenerator = 1;
  var base64VLQ = requireBase64Vlq();
  var util2 = requireUtil();
  var ArraySet = requireArraySet().ArraySet;
  var MappingList = requireMappingList().MappingList;
  function SourceMapGenerator(aArgs) {
    if (!aArgs) {
      aArgs = {};
    }
    this._file = util2.getArg(aArgs, "file", null);
    this._sourceRoot = util2.getArg(aArgs, "sourceRoot", null);
    this._skipValidation = util2.getArg(aArgs, "skipValidation", false);
    this._ignoreInvalidMapping = util2.getArg(aArgs, "ignoreInvalidMapping", false);
    this._sources = new ArraySet();
    this._names = new ArraySet();
    this._mappings = new MappingList();
    this._sourcesContents = null;
  }
  SourceMapGenerator.prototype._version = 3;
  SourceMapGenerator.fromSourceMap = function SourceMapGenerator_fromSourceMap(aSourceMapConsumer, generatorOps) {
    var sourceRoot = aSourceMapConsumer.sourceRoot;
    var generator = new SourceMapGenerator(Object.assign(generatorOps || {}, {
      file: aSourceMapConsumer.file,
      sourceRoot
    }));
    aSourceMapConsumer.eachMapping(function(mapping) {
      var newMapping = {
        generated: {
          line: mapping.generatedLine,
          column: mapping.generatedColumn
        }
      };
      if (mapping.source != null) {
        newMapping.source = mapping.source;
        if (sourceRoot != null) {
          newMapping.source = util2.relative(sourceRoot, newMapping.source);
        }
        newMapping.original = {
          line: mapping.originalLine,
          column: mapping.originalColumn
        };
        if (mapping.name != null) {
          newMapping.name = mapping.name;
        }
      }
      generator.addMapping(newMapping);
    });
    aSourceMapConsumer.sources.forEach(function(sourceFile) {
      var sourceRelative = sourceFile;
      if (sourceRoot !== null) {
        sourceRelative = util2.relative(sourceRoot, sourceFile);
      }
      if (!generator._sources.has(sourceRelative)) {
        generator._sources.add(sourceRelative);
      }
      var content = aSourceMapConsumer.sourceContentFor(sourceFile);
      if (content != null) {
        generator.setSourceContent(sourceFile, content);
      }
    });
    return generator;
  };
  SourceMapGenerator.prototype.addMapping = function SourceMapGenerator_addMapping(aArgs) {
    var generated = util2.getArg(aArgs, "generated");
    var original = util2.getArg(aArgs, "original", null);
    var source = util2.getArg(aArgs, "source", null);
    var name2 = util2.getArg(aArgs, "name", null);
    if (!this._skipValidation) {
      if (this._validateMapping(generated, original, source, name2) === false) {
        return;
      }
    }
    if (source != null) {
      source = String(source);
      if (!this._sources.has(source)) {
        this._sources.add(source);
      }
    }
    if (name2 != null) {
      name2 = String(name2);
      if (!this._names.has(name2)) {
        this._names.add(name2);
      }
    }
    this._mappings.add({
      generatedLine: generated.line,
      generatedColumn: generated.column,
      originalLine: original != null && original.line,
      originalColumn: original != null && original.column,
      source,
      name: name2
    });
  };
  SourceMapGenerator.prototype.setSourceContent = function SourceMapGenerator_setSourceContent(aSourceFile, aSourceContent) {
    var source = aSourceFile;
    if (this._sourceRoot != null) {
      source = util2.relative(this._sourceRoot, source);
    }
    if (aSourceContent != null) {
      if (!this._sourcesContents) {
        this._sourcesContents = /* @__PURE__ */ Object.create(null);
      }
      this._sourcesContents[util2.toSetString(source)] = aSourceContent;
    } else if (this._sourcesContents) {
      delete this._sourcesContents[util2.toSetString(source)];
      if (Object.keys(this._sourcesContents).length === 0) {
        this._sourcesContents = null;
      }
    }
  };
  SourceMapGenerator.prototype.applySourceMap = function SourceMapGenerator_applySourceMap(aSourceMapConsumer, aSourceFile, aSourceMapPath) {
    var sourceFile = aSourceFile;
    if (aSourceFile == null) {
      if (aSourceMapConsumer.file == null) {
        throw new Error(
          `SourceMapGenerator.prototype.applySourceMap requires either an explicit source file, or the source map's "file" property. Both were omitted.`
        );
      }
      sourceFile = aSourceMapConsumer.file;
    }
    var sourceRoot = this._sourceRoot;
    if (sourceRoot != null) {
      sourceFile = util2.relative(sourceRoot, sourceFile);
    }
    var newSources = new ArraySet();
    var newNames = new ArraySet();
    this._mappings.unsortedForEach(function(mapping) {
      if (mapping.source === sourceFile && mapping.originalLine != null) {
        var original = aSourceMapConsumer.originalPositionFor({
          line: mapping.originalLine,
          column: mapping.originalColumn
        });
        if (original.source != null) {
          mapping.source = original.source;
          if (aSourceMapPath != null) {
            mapping.source = util2.join(aSourceMapPath, mapping.source);
          }
          if (sourceRoot != null) {
            mapping.source = util2.relative(sourceRoot, mapping.source);
          }
          mapping.originalLine = original.line;
          mapping.originalColumn = original.column;
          if (original.name != null) {
            mapping.name = original.name;
          }
        }
      }
      var source = mapping.source;
      if (source != null && !newSources.has(source)) {
        newSources.add(source);
      }
      var name2 = mapping.name;
      if (name2 != null && !newNames.has(name2)) {
        newNames.add(name2);
      }
    }, this);
    this._sources = newSources;
    this._names = newNames;
    aSourceMapConsumer.sources.forEach(function(sourceFile2) {
      var content = aSourceMapConsumer.sourceContentFor(sourceFile2);
      if (content != null) {
        if (aSourceMapPath != null) {
          sourceFile2 = util2.join(aSourceMapPath, sourceFile2);
        }
        if (sourceRoot != null) {
          sourceFile2 = util2.relative(sourceRoot, sourceFile2);
        }
        this.setSourceContent(sourceFile2, content);
      }
    }, this);
  };
  SourceMapGenerator.prototype._validateMapping = function SourceMapGenerator_validateMapping(aGenerated, aOriginal, aSource, aName) {
    if (aOriginal && typeof aOriginal.line !== "number" && typeof aOriginal.column !== "number") {
      var message = "original.line and original.column are not numbers -- you probably meant to omit the original mapping entirely and only map the generated position. If so, pass null for the original mapping instead of an object with empty or null values.";
      if (this._ignoreInvalidMapping) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn(message);
        }
        return false;
      } else {
        throw new Error(message);
      }
    }
    if (aGenerated && "line" in aGenerated && "column" in aGenerated && aGenerated.line > 0 && aGenerated.column >= 0 && !aOriginal && !aSource && !aName) {
      return;
    } else if (aGenerated && "line" in aGenerated && "column" in aGenerated && aOriginal && "line" in aOriginal && "column" in aOriginal && aGenerated.line > 0 && aGenerated.column >= 0 && aOriginal.line > 0 && aOriginal.column >= 0 && aSource) {
      return;
    } else {
      var message = "Invalid mapping: " + JSON.stringify({
        generated: aGenerated,
        source: aSource,
        original: aOriginal,
        name: aName
      });
      if (this._ignoreInvalidMapping) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn(message);
        }
        return false;
      } else {
        throw new Error(message);
      }
    }
  };
  SourceMapGenerator.prototype._serializeMappings = function SourceMapGenerator_serializeMappings() {
    var previousGeneratedColumn = 0;
    var previousGeneratedLine = 1;
    var previousOriginalColumn = 0;
    var previousOriginalLine = 0;
    var previousName = 0;
    var previousSource = 0;
    var result = "";
    var next;
    var mapping;
    var nameIdx;
    var sourceIdx;
    var mappings = this._mappings.toArray();
    for (var i = 0, len = mappings.length; i < len; i++) {
      mapping = mappings[i];
      next = "";
      if (mapping.generatedLine !== previousGeneratedLine) {
        previousGeneratedColumn = 0;
        while (mapping.generatedLine !== previousGeneratedLine) {
          next += ";";
          previousGeneratedLine++;
        }
      } else {
        if (i > 0) {
          if (!util2.compareByGeneratedPositionsInflated(mapping, mappings[i - 1])) {
            continue;
          }
          next += ",";
        }
      }
      next += base64VLQ.encode(mapping.generatedColumn - previousGeneratedColumn);
      previousGeneratedColumn = mapping.generatedColumn;
      if (mapping.source != null) {
        sourceIdx = this._sources.indexOf(mapping.source);
        next += base64VLQ.encode(sourceIdx - previousSource);
        previousSource = sourceIdx;
        next += base64VLQ.encode(mapping.originalLine - 1 - previousOriginalLine);
        previousOriginalLine = mapping.originalLine - 1;
        next += base64VLQ.encode(mapping.originalColumn - previousOriginalColumn);
        previousOriginalColumn = mapping.originalColumn;
        if (mapping.name != null) {
          nameIdx = this._names.indexOf(mapping.name);
          next += base64VLQ.encode(nameIdx - previousName);
          previousName = nameIdx;
        }
      }
      result += next;
    }
    return result;
  };
  SourceMapGenerator.prototype._generateSourcesContent = function SourceMapGenerator_generateSourcesContent(aSources, aSourceRoot) {
    return aSources.map(function(source) {
      if (!this._sourcesContents) {
        return null;
      }
      if (aSourceRoot != null) {
        source = util2.relative(aSourceRoot, source);
      }
      var key = util2.toSetString(source);
      return Object.prototype.hasOwnProperty.call(this._sourcesContents, key) ? this._sourcesContents[key] : null;
    }, this);
  };
  SourceMapGenerator.prototype.toJSON = function SourceMapGenerator_toJSON() {
    var map = {
      version: this._version,
      sources: this._sources.toArray(),
      names: this._names.toArray(),
      mappings: this._serializeMappings()
    };
    if (this._file != null) {
      map.file = this._file;
    }
    if (this._sourceRoot != null) {
      map.sourceRoot = this._sourceRoot;
    }
    if (this._sourcesContents) {
      map.sourcesContent = this._generateSourcesContent(map.sources, map.sourceRoot);
    }
    return map;
  };
  SourceMapGenerator.prototype.toString = function SourceMapGenerator_toString() {
    return JSON.stringify(this.toJSON());
  };
  sourceMapGenerator.SourceMapGenerator = SourceMapGenerator;
  return sourceMapGenerator;
}
var sourceMapGeneratorExports = requireSourceMapGenerator();
const trackNodes = /* @__PURE__ */ new Set(["Atrule", "Selector", "Declaration"]);
function generateSourceMap(handlers) {
  const map = new sourceMapGeneratorExports.SourceMapGenerator();
  const generated = {
    line: 1,
    column: 0
  };
  const original = {
    line: 0,
    // should be zero to add first mapping
    column: 0
  };
  const activatedGenerated = {
    line: 1,
    column: 0
  };
  const activatedMapping = {
    generated: activatedGenerated
  };
  let line = 1;
  let column = 0;
  let sourceMappingActive = false;
  const origHandlersNode = handlers.node;
  handlers.node = function(node2) {
    if (node2.loc && node2.loc.start && trackNodes.has(node2.type)) {
      const nodeLine = node2.loc.start.line;
      const nodeColumn = node2.loc.start.column - 1;
      if (original.line !== nodeLine || original.column !== nodeColumn) {
        original.line = nodeLine;
        original.column = nodeColumn;
        generated.line = line;
        generated.column = column;
        if (sourceMappingActive) {
          sourceMappingActive = false;
          if (generated.line !== activatedGenerated.line || generated.column !== activatedGenerated.column) {
            map.addMapping(activatedMapping);
          }
        }
        sourceMappingActive = true;
        map.addMapping({
          source: node2.loc.source,
          original,
          generated
        });
      }
    }
    origHandlersNode.call(this, node2);
    if (sourceMappingActive && trackNodes.has(node2.type)) {
      activatedGenerated.line = line;
      activatedGenerated.column = column;
    }
  };
  const origHandlersEmit = handlers.emit;
  handlers.emit = function(value2, type, auto) {
    for (let i = 0; i < value2.length; i++) {
      if (value2.charCodeAt(i) === 10) {
        line++;
        column = 0;
      } else {
        column++;
      }
    }
    origHandlersEmit(value2, type, auto);
  };
  const origHandlersResult = handlers.result;
  handlers.result = function() {
    if (sourceMappingActive) {
      map.addMapping(activatedMapping);
    }
    return {
      css: origHandlersResult(),
      map
    };
  };
  return handlers;
}
const PLUSSIGN$9 = 43;
const HYPHENMINUS$6 = 45;
const code = (type, value2) => {
  if (type === Delim) {
    type = value2;
  }
  if (typeof type === "string") {
    type = Math.min(type.charCodeAt(0), 128) << 6;
  }
  return type << 1;
};
const specPairs = [
  [Ident, Ident],
  [Ident, Function$1],
  [Ident, Url$1],
  [Ident, BadUrl],
  [Ident, "-"],
  [Ident, Number$2],
  [Ident, Percentage$1],
  [Ident, Dimension$1],
  [Ident, CDC$1],
  [Ident, LeftParenthesis],
  [AtKeyword, Ident],
  [AtKeyword, Function$1],
  [AtKeyword, Url$1],
  [AtKeyword, BadUrl],
  [AtKeyword, "-"],
  [AtKeyword, Number$2],
  [AtKeyword, Percentage$1],
  [AtKeyword, Dimension$1],
  [AtKeyword, CDC$1],
  [Hash$1, Ident],
  [Hash$1, Function$1],
  [Hash$1, Url$1],
  [Hash$1, BadUrl],
  [Hash$1, "-"],
  [Hash$1, Number$2],
  [Hash$1, Percentage$1],
  [Hash$1, Dimension$1],
  [Hash$1, CDC$1],
  [Dimension$1, Ident],
  [Dimension$1, Function$1],
  [Dimension$1, Url$1],
  [Dimension$1, BadUrl],
  [Dimension$1, "-"],
  [Dimension$1, Number$2],
  [Dimension$1, Percentage$1],
  [Dimension$1, Dimension$1],
  [Dimension$1, CDC$1],
  ["#", Ident],
  ["#", Function$1],
  ["#", Url$1],
  ["#", BadUrl],
  ["#", "-"],
  ["#", Number$2],
  ["#", Percentage$1],
  ["#", Dimension$1],
  ["#", CDC$1],
  // https://github.com/w3c/csswg-drafts/pull/6874
  ["-", Ident],
  ["-", Function$1],
  ["-", Url$1],
  ["-", BadUrl],
  ["-", "-"],
  ["-", Number$2],
  ["-", Percentage$1],
  ["-", Dimension$1],
  ["-", CDC$1],
  // https://github.com/w3c/csswg-drafts/pull/6874
  [Number$2, Ident],
  [Number$2, Function$1],
  [Number$2, Url$1],
  [Number$2, BadUrl],
  [Number$2, Number$2],
  [Number$2, Percentage$1],
  [Number$2, Dimension$1],
  [Number$2, "%"],
  [Number$2, CDC$1],
  // https://github.com/w3c/csswg-drafts/pull/6874
  ["@", Ident],
  ["@", Function$1],
  ["@", Url$1],
  ["@", BadUrl],
  ["@", "-"],
  ["@", CDC$1],
  // https://github.com/w3c/csswg-drafts/pull/6874
  [".", Number$2],
  [".", Percentage$1],
  [".", Dimension$1],
  ["+", Number$2],
  ["+", Percentage$1],
  ["+", Dimension$1],
  ["/", "*"]
];
const safePairs = specPairs.concat([
  [Ident, Hash$1],
  [Dimension$1, Hash$1],
  [Hash$1, Hash$1],
  [AtKeyword, LeftParenthesis],
  [AtKeyword, String$2],
  [AtKeyword, Colon],
  [Percentage$1, Percentage$1],
  [Percentage$1, Dimension$1],
  [Percentage$1, Function$1],
  [Percentage$1, "-"],
  [RightParenthesis, Ident],
  [RightParenthesis, Function$1],
  [RightParenthesis, Percentage$1],
  [RightParenthesis, Dimension$1],
  [RightParenthesis, Hash$1],
  [RightParenthesis, "-"]
]);
function createMap(pairs) {
  const isWhiteSpaceRequired = new Set(
    pairs.map(([prev, next]) => code(prev) << 16 | code(next))
  );
  return function(prevCode, type, value2) {
    const nextCode = code(type, value2);
    const nextCharCode = value2.charCodeAt(0);
    const emitWs = nextCharCode === HYPHENMINUS$6 && type !== Ident && type !== Function$1 && type !== CDC$1 || nextCharCode === PLUSSIGN$9 ? isWhiteSpaceRequired.has((prevCode & 65534) << 16 | nextCharCode << 7) : isWhiteSpaceRequired.has((prevCode & 65534) << 16 | nextCode);
    return nextCode | emitWs;
  };
}
const spec = createMap(specPairs);
const safe = createMap(safePairs);
const tokenBefore = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  safe,
  spec
}, Symbol.toStringTag, { value: "Module" }));
const REVERSESOLIDUS = 92;
function processChildren(node2, delimeter) {
  if (typeof delimeter === "function") {
    let prev = null;
    node2.children.forEach((node3) => {
      if (prev !== null) {
        delimeter.call(this, prev);
      }
      this.node(node3);
      prev = node3;
    });
    return;
  }
  node2.children.forEach(this.node, this);
}
function createGenerator(config) {
  const types = /* @__PURE__ */ new Map();
  for (let [name2, item] of Object.entries(config.node)) {
    const fn = item.generate || item;
    if (typeof fn === "function") {
      types.set(name2, item.generate || item);
    }
  }
  return function(node2, options) {
    let buffer = "";
    let prevCode = 0;
    let handlers = {
      node(node3) {
        if (types.has(node3.type)) {
          types.get(node3.type).call(publicApi, node3);
        } else {
          throw new Error("Unknown node type: " + node3.type);
        }
      },
      tokenBefore: safe,
      token(type, value2, suppressAutoWhiteSpace) {
        prevCode = this.tokenBefore(prevCode, type, value2);
        if (!suppressAutoWhiteSpace && prevCode & 1) {
          this.emit(" ", WhiteSpace$1, true);
        }
        this.emit(value2, type, false);
        if (type === Delim && value2.charCodeAt(0) === REVERSESOLIDUS) {
          this.emit("\n", WhiteSpace$1, true);
        }
      },
      emit(value2) {
        buffer += value2;
      },
      result() {
        return buffer;
      }
    };
    if (options) {
      if (typeof options.decorator === "function") {
        handlers = options.decorator(handlers);
      }
      if (options.sourceMap) {
        handlers = generateSourceMap(handlers);
      }
      if (options.mode in tokenBefore) {
        handlers.tokenBefore = tokenBefore[options.mode];
      }
    }
    const publicApi = {
      node: (node3) => handlers.node(node3),
      children: processChildren,
      token: (type, value2) => handlers.token(type, value2),
      tokenize: (raw) => tokenize$1(raw, (type, start, end) => {
        handlers.token(
          type,
          raw.slice(start, end),
          start !== 0
          // suppress auto whitespace for internal value tokens
        );
      })
    };
    handlers.node(node2);
    return handlers.result();
  };
}
function createConvertor(walk2) {
  return {
    fromPlainObject(ast) {
      walk2(ast, {
        enter(node2) {
          if (node2.children && node2.children instanceof List === false) {
            node2.children = new List().fromArray(node2.children);
          }
        }
      });
      return ast;
    },
    toPlainObject(ast) {
      walk2(ast, {
        leave(node2) {
          if (node2.children && node2.children instanceof List) {
            node2.children = node2.children.toArray();
          }
        }
      });
      return ast;
    }
  };
}
const { hasOwnProperty: hasOwnProperty$3 } = Object.prototype;
const noop$2 = function() {
};
function ensureFunction$1(value2) {
  return typeof value2 === "function" ? value2 : noop$2;
}
function invokeForType(fn, type) {
  return function(node2, item, list) {
    if (node2.type === type) {
      fn.call(this, node2, item, list);
    }
  };
}
function getWalkersFromStructure(name2, nodeType) {
  const structure2 = nodeType.structure;
  const walkers = [];
  for (const key in structure2) {
    if (hasOwnProperty$3.call(structure2, key) === false) {
      continue;
    }
    let fieldTypes = structure2[key];
    const walker = {
      name: key,
      type: false,
      nullable: false
    };
    if (!Array.isArray(fieldTypes)) {
      fieldTypes = [fieldTypes];
    }
    for (const fieldType of fieldTypes) {
      if (fieldType === null) {
        walker.nullable = true;
      } else if (typeof fieldType === "string") {
        walker.type = "node";
      } else if (Array.isArray(fieldType)) {
        walker.type = "list";
      }
    }
    if (walker.type) {
      walkers.push(walker);
    }
  }
  if (walkers.length) {
    return {
      context: nodeType.walkContext,
      fields: walkers
    };
  }
  return null;
}
function getTypesFromConfig(config) {
  const types = {};
  for (const name2 in config.node) {
    if (hasOwnProperty$3.call(config.node, name2)) {
      const nodeType = config.node[name2];
      if (!nodeType.structure) {
        throw new Error("Missed `structure` field in `" + name2 + "` node type definition");
      }
      types[name2] = getWalkersFromStructure(name2, nodeType);
    }
  }
  return types;
}
function createTypeIterator(config, reverse) {
  const fields = config.fields.slice();
  const contextName = config.context;
  const useContext = typeof contextName === "string";
  if (reverse) {
    fields.reverse();
  }
  return function(node2, context, walk2, walkReducer) {
    let prevContextValue;
    if (useContext) {
      prevContextValue = context[contextName];
      context[contextName] = node2;
    }
    for (const field of fields) {
      const ref = node2[field.name];
      if (!field.nullable || ref) {
        if (field.type === "list") {
          const breakWalk = reverse ? ref.reduceRight(walkReducer, false) : ref.reduce(walkReducer, false);
          if (breakWalk) {
            return true;
          }
        } else if (walk2(ref)) {
          return true;
        }
      }
    }
    if (useContext) {
      context[contextName] = prevContextValue;
    }
  };
}
function createFastTraveralMap({
  StyleSheet: StyleSheet2,
  Atrule: Atrule2,
  Rule: Rule2,
  Block: Block2,
  DeclarationList: DeclarationList2
}) {
  return {
    Atrule: {
      StyleSheet: StyleSheet2,
      Atrule: Atrule2,
      Rule: Rule2,
      Block: Block2
    },
    Rule: {
      StyleSheet: StyleSheet2,
      Atrule: Atrule2,
      Rule: Rule2,
      Block: Block2
    },
    Declaration: {
      StyleSheet: StyleSheet2,
      Atrule: Atrule2,
      Rule: Rule2,
      Block: Block2,
      DeclarationList: DeclarationList2
    }
  };
}
function createWalker(config) {
  const types = getTypesFromConfig(config);
  const iteratorsNatural = {};
  const iteratorsReverse = {};
  const breakWalk = Symbol("break-walk");
  const skipNode = Symbol("skip-node");
  for (const name2 in types) {
    if (hasOwnProperty$3.call(types, name2) && types[name2] !== null) {
      iteratorsNatural[name2] = createTypeIterator(types[name2], false);
      iteratorsReverse[name2] = createTypeIterator(types[name2], true);
    }
  }
  const fastTraversalIteratorsNatural = createFastTraveralMap(iteratorsNatural);
  const fastTraversalIteratorsReverse = createFastTraveralMap(iteratorsReverse);
  const walk2 = function(root, options) {
    function walkNode(node2, item, list) {
      const enterRet = enter.call(context, node2, item, list);
      if (enterRet === breakWalk) {
        return true;
      }
      if (enterRet === skipNode) {
        return false;
      }
      if (iterators.hasOwnProperty(node2.type)) {
        if (iterators[node2.type](node2, context, walkNode, walkReducer)) {
          return true;
        }
      }
      if (leave.call(context, node2, item, list) === breakWalk) {
        return true;
      }
      return false;
    }
    let enter = noop$2;
    let leave = noop$2;
    let iterators = iteratorsNatural;
    let walkReducer = (ret, data, item, list) => ret || walkNode(data, item, list);
    const context = {
      break: breakWalk,
      skip: skipNode,
      root,
      stylesheet: null,
      atrule: null,
      atrulePrelude: null,
      rule: null,
      selector: null,
      block: null,
      declaration: null,
      function: null
    };
    if (typeof options === "function") {
      enter = options;
    } else if (options) {
      enter = ensureFunction$1(options.enter);
      leave = ensureFunction$1(options.leave);
      if (options.reverse) {
        iterators = iteratorsReverse;
      }
      if (options.visit) {
        if (fastTraversalIteratorsNatural.hasOwnProperty(options.visit)) {
          iterators = options.reverse ? fastTraversalIteratorsReverse[options.visit] : fastTraversalIteratorsNatural[options.visit];
        } else if (!types.hasOwnProperty(options.visit)) {
          throw new Error("Bad value `" + options.visit + "` for `visit` option (should be: " + Object.keys(types).sort().join(", ") + ")");
        }
        enter = invokeForType(enter, options.visit);
        leave = invokeForType(leave, options.visit);
      }
    }
    if (enter === noop$2 && leave === noop$2) {
      throw new Error("Neither `enter` nor `leave` walker handler is set or both aren't a function");
    }
    walkNode(root);
  };
  walk2.break = breakWalk;
  walk2.skip = skipNode;
  walk2.find = function(ast, fn) {
    let found = null;
    walk2(ast, function(node2, item, list) {
      if (fn.call(this, node2, item, list)) {
        found = node2;
        return breakWalk;
      }
    });
    return found;
  };
  walk2.findLast = function(ast, fn) {
    let found = null;
    walk2(ast, {
      reverse: true,
      enter(node2, item, list) {
        if (fn.call(this, node2, item, list)) {
          found = node2;
          return breakWalk;
        }
      }
    });
    return found;
  };
  walk2.findAll = function(ast, fn) {
    const found = [];
    walk2(ast, function(node2, item, list) {
      if (fn.call(this, node2, item, list)) {
        found.push(node2);
      }
    });
    return found;
  };
  return walk2;
}
function noop$1(value2) {
  return value2;
}
function generateMultiplier(multiplier) {
  const { min, max: max2, comma } = multiplier;
  if (min === 0 && max2 === 0) {
    return comma ? "#?" : "*";
  }
  if (min === 0 && max2 === 1) {
    return "?";
  }
  if (min === 1 && max2 === 0) {
    return comma ? "#" : "+";
  }
  if (min === 1 && max2 === 1) {
    return "";
  }
  return (comma ? "#" : "") + (min === max2 ? "{" + min + "}" : "{" + min + "," + (max2 !== 0 ? max2 : "") + "}");
}
function generateTypeOpts(node2) {
  switch (node2.type) {
    case "Range":
      return " [" + (node2.min === null ? "-∞" : node2.min) + "," + (node2.max === null ? "∞" : node2.max) + "]";
    default:
      throw new Error("Unknown node type `" + node2.type + "`");
  }
}
function generateSequence(node2, decorate, forceBraces, compact) {
  const combinator = node2.combinator === " " || compact ? node2.combinator : " " + node2.combinator + " ";
  const result = node2.terms.map((term) => internalGenerate(term, decorate, forceBraces, compact)).join(combinator);
  if (node2.explicit || forceBraces) {
    return (compact || result[0] === "," ? "[" : "[ ") + result + (compact ? "]" : " ]");
  }
  return result;
}
function internalGenerate(node2, decorate, forceBraces, compact) {
  let result;
  switch (node2.type) {
    case "Group":
      result = generateSequence(node2, decorate, forceBraces, compact) + (node2.disallowEmpty ? "!" : "");
      break;
    case "Multiplier":
      return internalGenerate(node2.term, decorate, forceBraces, compact) + decorate(generateMultiplier(node2), node2);
    case "Boolean":
      result = "<boolean-expr[" + internalGenerate(node2.term, decorate, forceBraces, compact) + "]>";
      break;
    case "Type":
      result = "<" + node2.name + (node2.opts ? decorate(generateTypeOpts(node2.opts), node2.opts) : "") + ">";
      break;
    case "Property":
      result = "<'" + node2.name + "'>";
      break;
    case "Keyword":
      result = node2.name;
      break;
    case "AtKeyword":
      result = "@" + node2.name;
      break;
    case "Function":
      result = node2.name + "(";
      break;
    case "String":
    case "Token":
      result = node2.value;
      break;
    case "Comma":
      result = ",";
      break;
    default:
      throw new Error("Unknown node type `" + node2.type + "`");
  }
  return decorate(result, node2);
}
function generate$O(node2, options) {
  let decorate = noop$1;
  let forceBraces = false;
  let compact = false;
  if (typeof options === "function") {
    decorate = options;
  } else if (options) {
    forceBraces = Boolean(options.forceBraces);
    compact = Boolean(options.compact);
    if (typeof options.decorate === "function") {
      decorate = options.decorate;
    }
  }
  return internalGenerate(node2, decorate, forceBraces, compact);
}
const defaultLoc = { offset: 0, line: 1, column: 1 };
function locateMismatch(matchResult, node2) {
  const tokens = matchResult.tokens;
  const longestMatch = matchResult.longestMatch;
  const mismatchNode = longestMatch < tokens.length ? tokens[longestMatch].node || null : null;
  const badNode = mismatchNode !== node2 ? mismatchNode : null;
  let mismatchOffset = 0;
  let mismatchLength = 0;
  let entries = 0;
  let css = "";
  let start;
  let end;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i].value;
    if (i === longestMatch) {
      mismatchLength = token.length;
      mismatchOffset = css.length;
    }
    if (badNode !== null && tokens[i].node === badNode) {
      if (i <= longestMatch) {
        entries++;
      } else {
        entries = 0;
      }
    }
    css += token;
  }
  if (longestMatch === tokens.length || entries > 1) {
    start = fromLoc(badNode || node2, "end") || buildLoc(defaultLoc, css);
    end = buildLoc(start);
  } else {
    start = fromLoc(badNode, "start") || buildLoc(fromLoc(node2, "start") || defaultLoc, css.slice(0, mismatchOffset));
    end = fromLoc(badNode, "end") || buildLoc(start, css.substr(mismatchOffset, mismatchLength));
  }
  return {
    css,
    mismatchOffset,
    mismatchLength,
    start,
    end
  };
}
function fromLoc(node2, point) {
  const value2 = node2 && node2.loc && node2.loc[point];
  if (value2) {
    return "line" in value2 ? buildLoc(value2) : value2;
  }
  return null;
}
function buildLoc({ offset, line, column }, extra) {
  const loc = {
    offset,
    line,
    column
  };
  if (extra) {
    const lines = extra.split(/\n|\r\n?|\f/);
    loc.offset += extra.length;
    loc.line += lines.length - 1;
    loc.column = lines.length === 1 ? loc.column + extra.length : lines.pop().length + 1;
  }
  return loc;
}
const SyntaxReferenceError = function(type, referenceName) {
  const error = createCustomError(
    "SyntaxReferenceError",
    type + (referenceName ? " `" + referenceName + "`" : "")
  );
  error.reference = referenceName;
  return error;
};
const SyntaxMatchError = function(message, syntax2, node2, matchResult) {
  const error = createCustomError("SyntaxMatchError", message);
  const {
    css,
    mismatchOffset,
    mismatchLength,
    start,
    end
  } = locateMismatch(matchResult, node2);
  error.rawMessage = message;
  error.syntax = syntax2 ? generate$O(syntax2) : "<generic>";
  error.css = css;
  error.mismatchOffset = mismatchOffset;
  error.mismatchLength = mismatchLength;
  error.message = message + "\n  syntax: " + error.syntax + "\n   value: " + (css || "<empty string>") + "\n  --------" + new Array(error.mismatchOffset + 1).join("-") + "^";
  Object.assign(error, start);
  error.loc = {
    source: node2 && node2.loc && node2.loc.source || "<unknown>",
    start,
    end
  };
  return error;
};
const keywords = /* @__PURE__ */ new Map();
const properties = /* @__PURE__ */ new Map();
const HYPHENMINUS$5 = 45;
const keyword = getKeywordDescriptor;
const property = getPropertyDescriptor;
function isCustomProperty(str, offset) {
  offset = offset || 0;
  return str.length - offset >= 2 && str.charCodeAt(offset) === HYPHENMINUS$5 && str.charCodeAt(offset + 1) === HYPHENMINUS$5;
}
function getVendorPrefix(str, offset) {
  offset = offset || 0;
  if (str.length - offset >= 3) {
    if (str.charCodeAt(offset) === HYPHENMINUS$5 && str.charCodeAt(offset + 1) !== HYPHENMINUS$5) {
      const secondDashIndex = str.indexOf("-", offset + 2);
      if (secondDashIndex !== -1) {
        return str.substring(offset, secondDashIndex + 1);
      }
    }
  }
  return "";
}
function getKeywordDescriptor(keyword2) {
  if (keywords.has(keyword2)) {
    return keywords.get(keyword2);
  }
  const name2 = keyword2.toLowerCase();
  let descriptor = keywords.get(name2);
  if (descriptor === void 0) {
    const custom = isCustomProperty(name2, 0);
    const vendor = !custom ? getVendorPrefix(name2, 0) : "";
    descriptor = Object.freeze({
      basename: name2.substr(vendor.length),
      name: name2,
      prefix: vendor,
      vendor,
      custom
    });
  }
  keywords.set(keyword2, descriptor);
  return descriptor;
}
function getPropertyDescriptor(property2) {
  if (properties.has(property2)) {
    return properties.get(property2);
  }
  let name2 = property2;
  let hack = property2[0];
  if (hack === "/") {
    hack = property2[1] === "/" ? "//" : "/";
  } else if (hack !== "_" && hack !== "*" && hack !== "$" && hack !== "#" && hack !== "+" && hack !== "&") {
    hack = "";
  }
  const custom = isCustomProperty(name2, hack.length);
  if (!custom) {
    name2 = name2.toLowerCase();
    if (properties.has(name2)) {
      const descriptor2 = properties.get(name2);
      properties.set(property2, descriptor2);
      return descriptor2;
    }
  }
  const vendor = !custom ? getVendorPrefix(name2, hack.length) : "";
  const prefix = name2.substr(0, hack.length + vendor.length);
  const descriptor = Object.freeze({
    basename: name2.substr(prefix.length),
    name: name2.substr(hack.length),
    hack,
    vendor,
    prefix,
    custom
  });
  properties.set(property2, descriptor);
  return descriptor;
}
const cssWideKeywords = [
  "initial",
  "inherit",
  "unset",
  "revert",
  "revert-layer"
];
const PLUSSIGN$8 = 43;
const HYPHENMINUS$4 = 45;
const N$3 = 110;
const DISALLOW_SIGN$1 = true;
const ALLOW_SIGN$1 = false;
function isDelim$1(token, code2) {
  return token !== null && token.type === Delim && token.value.charCodeAt(0) === code2;
}
function skipSC(token, offset, getNextToken) {
  while (token !== null && (token.type === WhiteSpace$1 || token.type === Comment$1)) {
    token = getNextToken(++offset);
  }
  return offset;
}
function checkInteger$1(token, valueOffset, disallowSign, offset) {
  if (!token) {
    return 0;
  }
  const code2 = token.value.charCodeAt(valueOffset);
  if (code2 === PLUSSIGN$8 || code2 === HYPHENMINUS$4) {
    if (disallowSign) {
      return 0;
    }
    valueOffset++;
  }
  for (; valueOffset < token.value.length; valueOffset++) {
    if (!isDigit(token.value.charCodeAt(valueOffset))) {
      return 0;
    }
  }
  return offset + 1;
}
function consumeB$1(token, offset_, getNextToken) {
  let sign = false;
  let offset = skipSC(token, offset_, getNextToken);
  token = getNextToken(offset);
  if (token === null) {
    return offset_;
  }
  if (token.type !== Number$2) {
    if (isDelim$1(token, PLUSSIGN$8) || isDelim$1(token, HYPHENMINUS$4)) {
      sign = true;
      offset = skipSC(getNextToken(++offset), offset, getNextToken);
      token = getNextToken(offset);
      if (token === null || token.type !== Number$2) {
        return 0;
      }
    } else {
      return offset_;
    }
  }
  if (!sign) {
    const code2 = token.value.charCodeAt(0);
    if (code2 !== PLUSSIGN$8 && code2 !== HYPHENMINUS$4) {
      return 0;
    }
  }
  return checkInteger$1(token, sign ? 0 : 1, sign, offset);
}
function anPlusB(token, getNextToken) {
  let offset = 0;
  if (!token) {
    return 0;
  }
  if (token.type === Number$2) {
    return checkInteger$1(token, 0, ALLOW_SIGN$1, offset);
  } else if (token.type === Ident && token.value.charCodeAt(0) === HYPHENMINUS$4) {
    if (!cmpChar(token.value, 1, N$3)) {
      return 0;
    }
    switch (token.value.length) {
      // -n
      // -n <signed-integer>
      // -n ['+' | '-'] <signless-integer>
      case 2:
        return consumeB$1(getNextToken(++offset), offset, getNextToken);
      // -n- <signless-integer>
      case 3:
        if (token.value.charCodeAt(2) !== HYPHENMINUS$4) {
          return 0;
        }
        offset = skipSC(getNextToken(++offset), offset, getNextToken);
        token = getNextToken(offset);
        return checkInteger$1(token, 0, DISALLOW_SIGN$1, offset);
      // <dashndashdigit-ident>
      default:
        if (token.value.charCodeAt(2) !== HYPHENMINUS$4) {
          return 0;
        }
        return checkInteger$1(token, 3, DISALLOW_SIGN$1, offset);
    }
  } else if (token.type === Ident || isDelim$1(token, PLUSSIGN$8) && getNextToken(offset + 1).type === Ident) {
    if (token.type !== Ident) {
      token = getNextToken(++offset);
    }
    if (token === null || !cmpChar(token.value, 0, N$3)) {
      return 0;
    }
    switch (token.value.length) {
      // '+'? n
      // '+'? n <signed-integer>
      // '+'? n ['+' | '-'] <signless-integer>
      case 1:
        return consumeB$1(getNextToken(++offset), offset, getNextToken);
      // '+'? n- <signless-integer>
      case 2:
        if (token.value.charCodeAt(1) !== HYPHENMINUS$4) {
          return 0;
        }
        offset = skipSC(getNextToken(++offset), offset, getNextToken);
        token = getNextToken(offset);
        return checkInteger$1(token, 0, DISALLOW_SIGN$1, offset);
      // '+'? <ndashdigit-ident>
      default:
        if (token.value.charCodeAt(1) !== HYPHENMINUS$4) {
          return 0;
        }
        return checkInteger$1(token, 2, DISALLOW_SIGN$1, offset);
    }
  } else if (token.type === Dimension$1) {
    let code2 = token.value.charCodeAt(0);
    let sign = code2 === PLUSSIGN$8 || code2 === HYPHENMINUS$4 ? 1 : 0;
    let i = sign;
    for (; i < token.value.length; i++) {
      if (!isDigit(token.value.charCodeAt(i))) {
        break;
      }
    }
    if (i === sign) {
      return 0;
    }
    if (!cmpChar(token.value, i, N$3)) {
      return 0;
    }
    if (i + 1 === token.value.length) {
      return consumeB$1(getNextToken(++offset), offset, getNextToken);
    } else {
      if (token.value.charCodeAt(i + 1) !== HYPHENMINUS$4) {
        return 0;
      }
      if (i + 2 === token.value.length) {
        offset = skipSC(getNextToken(++offset), offset, getNextToken);
        token = getNextToken(offset);
        return checkInteger$1(token, 0, DISALLOW_SIGN$1, offset);
      } else {
        return checkInteger$1(token, i + 2, DISALLOW_SIGN$1, offset);
      }
    }
  }
  return 0;
}
const PLUSSIGN$7 = 43;
const HYPHENMINUS$3 = 45;
const QUESTIONMARK$2 = 63;
const U$1 = 117;
function isDelim(token, code2) {
  return token !== null && token.type === Delim && token.value.charCodeAt(0) === code2;
}
function startsWith$1(token, code2) {
  return token.value.charCodeAt(0) === code2;
}
function hexSequence(token, offset, allowDash) {
  let hexlen = 0;
  for (let pos = offset; pos < token.value.length; pos++) {
    const code2 = token.value.charCodeAt(pos);
    if (code2 === HYPHENMINUS$3 && allowDash && hexlen !== 0) {
      hexSequence(token, offset + hexlen + 1, false);
      return 6;
    }
    if (!isHexDigit(code2)) {
      return 0;
    }
    if (++hexlen > 6) {
      return 0;
    }
  }
  return hexlen;
}
function withQuestionMarkSequence(consumed, length2, getNextToken) {
  if (!consumed) {
    return 0;
  }
  while (isDelim(getNextToken(length2), QUESTIONMARK$2)) {
    if (++consumed > 6) {
      return 0;
    }
    length2++;
  }
  return length2;
}
function urange(token, getNextToken) {
  let length2 = 0;
  if (token === null || token.type !== Ident || !cmpChar(token.value, 0, U$1)) {
    return 0;
  }
  token = getNextToken(++length2);
  if (token === null) {
    return 0;
  }
  if (isDelim(token, PLUSSIGN$7)) {
    token = getNextToken(++length2);
    if (token === null) {
      return 0;
    }
    if (token.type === Ident) {
      return withQuestionMarkSequence(hexSequence(token, 0, true), ++length2, getNextToken);
    }
    if (isDelim(token, QUESTIONMARK$2)) {
      return withQuestionMarkSequence(1, ++length2, getNextToken);
    }
    return 0;
  }
  if (token.type === Number$2) {
    const consumedHexLength = hexSequence(token, 1, true);
    if (consumedHexLength === 0) {
      return 0;
    }
    token = getNextToken(++length2);
    if (token === null) {
      return length2;
    }
    if (token.type === Dimension$1 || token.type === Number$2) {
      if (!startsWith$1(token, HYPHENMINUS$3) || !hexSequence(token, 1, false)) {
        return 0;
      }
      return length2 + 1;
    }
    return withQuestionMarkSequence(consumedHexLength, length2, getNextToken);
  }
  if (token.type === Dimension$1) {
    return withQuestionMarkSequence(hexSequence(token, 1, true), ++length2, getNextToken);
  }
  return 0;
}
const calcFunctionNames = [
  "calc(",
  "-moz-calc(",
  "-webkit-calc("
];
const comparisonFunctionNames = [
  "min(",
  "max(",
  "clamp("
];
const steppedValueFunctionNames = [
  "round(",
  "mod(",
  "rem("
];
const trigNumberFunctionNames = [
  "sin(",
  "cos(",
  "tan("
];
const trigAngleFunctionNames = [
  "asin(",
  "acos(",
  "atan(",
  "atan2("
];
const otherNumberFunctionNames = [
  "pow(",
  "sqrt(",
  "log(",
  "exp(",
  "sign("
];
const expNumberDimensionPercentageFunctionNames = [
  "hypot("
];
const signFunctionNames = [
  "abs("
];
const numberFunctionNames = [
  ...calcFunctionNames,
  ...comparisonFunctionNames,
  ...steppedValueFunctionNames,
  ...trigNumberFunctionNames,
  ...otherNumberFunctionNames,
  ...expNumberDimensionPercentageFunctionNames,
  ...signFunctionNames
];
const percentageFunctionNames = [
  ...calcFunctionNames,
  ...comparisonFunctionNames,
  ...steppedValueFunctionNames,
  ...expNumberDimensionPercentageFunctionNames,
  ...signFunctionNames
];
const dimensionFunctionNames = [
  ...calcFunctionNames,
  ...comparisonFunctionNames,
  ...steppedValueFunctionNames,
  ...trigAngleFunctionNames,
  ...expNumberDimensionPercentageFunctionNames,
  ...signFunctionNames
];
const balancePair = /* @__PURE__ */ new Map([
  [Function$1, RightParenthesis],
  [LeftParenthesis, RightParenthesis],
  [LeftSquareBracket, RightSquareBracket],
  [LeftCurlyBracket, RightCurlyBracket]
]);
function charCodeAt(str, index) {
  return index < str.length ? str.charCodeAt(index) : 0;
}
function eqStr(actual, expected) {
  return cmpStr(actual, 0, actual.length, expected);
}
function eqStrAny(actual, expected) {
  for (let i = 0; i < expected.length; i++) {
    if (eqStr(actual, expected[i])) {
      return true;
    }
  }
  return false;
}
function isPostfixIeHack(str, offset) {
  if (offset !== str.length - 2) {
    return false;
  }
  return charCodeAt(str, offset) === 92 && // U+005C REVERSE SOLIDUS (\)
  isDigit(charCodeAt(str, offset + 1));
}
function outOfRange(opts, value2, numEnd) {
  if (opts && opts.type === "Range") {
    const num = Number(
      numEnd !== void 0 && numEnd !== value2.length ? value2.substr(0, numEnd) : value2
    );
    if (isNaN(num)) {
      return true;
    }
    if (opts.min !== null && num < opts.min && typeof opts.min !== "string") {
      return true;
    }
    if (opts.max !== null && num > opts.max && typeof opts.max !== "string") {
      return true;
    }
  }
  return false;
}
function consumeFunction(token, getNextToken) {
  let balanceCloseType = 0;
  let balanceStash = [];
  let length2 = 0;
  scan:
    do {
      switch (token.type) {
        case RightCurlyBracket:
        case RightParenthesis:
        case RightSquareBracket:
          if (token.type !== balanceCloseType) {
            break scan;
          }
          balanceCloseType = balanceStash.pop();
          if (balanceStash.length === 0) {
            length2++;
            break scan;
          }
          break;
        case Function$1:
        case LeftParenthesis:
        case LeftSquareBracket:
        case LeftCurlyBracket:
          balanceStash.push(balanceCloseType);
          balanceCloseType = balancePair.get(token.type);
          break;
      }
      length2++;
    } while (token = getNextToken(length2));
  return length2;
}
function math(next, functionNames) {
  return function(token, getNextToken, opts) {
    if (token === null) {
      return 0;
    }
    if (token.type === Function$1 && eqStrAny(token.value, functionNames)) {
      return consumeFunction(token, getNextToken);
    }
    return next(token, getNextToken, opts);
  };
}
function tokenType(expectedTokenType) {
  return function(token) {
    if (token === null || token.type !== expectedTokenType) {
      return 0;
    }
    return 1;
  };
}
function customIdent(token) {
  if (token === null || token.type !== Ident) {
    return 0;
  }
  const name2 = token.value.toLowerCase();
  if (eqStrAny(name2, cssWideKeywords)) {
    return 0;
  }
  if (eqStr(name2, "default")) {
    return 0;
  }
  return 1;
}
function dashedIdent(token) {
  if (token === null || token.type !== Ident) {
    return 0;
  }
  if (charCodeAt(token.value, 0) !== 45 || charCodeAt(token.value, 1) !== 45) {
    return 0;
  }
  return 1;
}
function customPropertyName(token) {
  if (!dashedIdent(token)) {
    return 0;
  }
  if (token.value === "--") {
    return 0;
  }
  return 1;
}
function hexColor(token) {
  if (token === null || token.type !== Hash$1) {
    return 0;
  }
  const length2 = token.value.length;
  if (length2 !== 4 && length2 !== 5 && length2 !== 7 && length2 !== 9) {
    return 0;
  }
  for (let i = 1; i < length2; i++) {
    if (!isHexDigit(charCodeAt(token.value, i))) {
      return 0;
    }
  }
  return 1;
}
function idSelector(token) {
  if (token === null || token.type !== Hash$1) {
    return 0;
  }
  if (!isIdentifierStart(charCodeAt(token.value, 1), charCodeAt(token.value, 2), charCodeAt(token.value, 3))) {
    return 0;
  }
  return 1;
}
function declarationValue(token, getNextToken) {
  if (!token) {
    return 0;
  }
  let balanceCloseType = 0;
  let balanceStash = [];
  let length2 = 0;
  scan:
    do {
      switch (token.type) {
        // ... <bad-string-token>, <bad-url-token>,
        case BadString:
        case BadUrl:
          break scan;
        // ... unmatched <)-token>, <]-token>, or <}-token>,
        case RightCurlyBracket:
        case RightParenthesis:
        case RightSquareBracket:
          if (token.type !== balanceCloseType) {
            break scan;
          }
          balanceCloseType = balanceStash.pop();
          break;
        // ... or top-level <semicolon-token> tokens
        case Semicolon:
          if (balanceCloseType === 0) {
            break scan;
          }
          break;
        // ... or <delim-token> tokens with a value of "!"
        case Delim:
          if (balanceCloseType === 0 && token.value === "!") {
            break scan;
          }
          break;
        case Function$1:
        case LeftParenthesis:
        case LeftSquareBracket:
        case LeftCurlyBracket:
          balanceStash.push(balanceCloseType);
          balanceCloseType = balancePair.get(token.type);
          break;
      }
      length2++;
    } while (token = getNextToken(length2));
  return length2;
}
function anyValue(token, getNextToken) {
  if (!token) {
    return 0;
  }
  let balanceCloseType = 0;
  let balanceStash = [];
  let length2 = 0;
  scan:
    do {
      switch (token.type) {
        // ... does not contain <bad-string-token>, <bad-url-token>,
        case BadString:
        case BadUrl:
          break scan;
        // ... unmatched <)-token>, <]-token>, or <}-token>,
        case RightCurlyBracket:
        case RightParenthesis:
        case RightSquareBracket:
          if (token.type !== balanceCloseType) {
            break scan;
          }
          balanceCloseType = balanceStash.pop();
          break;
        case Function$1:
        case LeftParenthesis:
        case LeftSquareBracket:
        case LeftCurlyBracket:
          balanceStash.push(balanceCloseType);
          balanceCloseType = balancePair.get(token.type);
          break;
      }
      length2++;
    } while (token = getNextToken(length2));
  return length2;
}
function dimension(type) {
  if (type) {
    type = new Set(type);
  }
  return function(token, getNextToken, opts) {
    if (token === null || token.type !== Dimension$1) {
      return 0;
    }
    const numberEnd = consumeNumber(token.value, 0);
    if (type !== null) {
      const reverseSolidusOffset = token.value.indexOf("\\", numberEnd);
      const unit = reverseSolidusOffset === -1 || !isPostfixIeHack(token.value, reverseSolidusOffset) ? token.value.substr(numberEnd) : token.value.substring(numberEnd, reverseSolidusOffset);
      if (type.has(unit.toLowerCase()) === false) {
        return 0;
      }
    }
    if (outOfRange(opts, token.value, numberEnd)) {
      return 0;
    }
    return 1;
  };
}
function percentage(token, getNextToken, opts) {
  if (token === null || token.type !== Percentage$1) {
    return 0;
  }
  if (outOfRange(opts, token.value, token.value.length - 1)) {
    return 0;
  }
  return 1;
}
function zero(next) {
  if (typeof next !== "function") {
    next = function() {
      return 0;
    };
  }
  return function(token, getNextToken, opts) {
    if (token !== null && token.type === Number$2) {
      if (Number(token.value) === 0) {
        return 1;
      }
    }
    return next(token, getNextToken, opts);
  };
}
function number(token, getNextToken, opts) {
  if (token === null) {
    return 0;
  }
  const numberEnd = consumeNumber(token.value, 0);
  const isNumber = numberEnd === token.value.length;
  if (!isNumber && !isPostfixIeHack(token.value, numberEnd)) {
    return 0;
  }
  if (outOfRange(opts, token.value, numberEnd)) {
    return 0;
  }
  return 1;
}
function integer(token, getNextToken, opts) {
  if (token === null || token.type !== Number$2) {
    return 0;
  }
  let i = charCodeAt(token.value, 0) === 43 || // U+002B PLUS SIGN (+)
  charCodeAt(token.value, 0) === 45 ? 1 : 0;
  for (; i < token.value.length; i++) {
    if (!isDigit(charCodeAt(token.value, i))) {
      return 0;
    }
  }
  if (outOfRange(opts, token.value, i)) {
    return 0;
  }
  return 1;
}
const tokenTypes = {
  "ident-token": tokenType(Ident),
  "function-token": tokenType(Function$1),
  "at-keyword-token": tokenType(AtKeyword),
  "hash-token": tokenType(Hash$1),
  "string-token": tokenType(String$2),
  "bad-string-token": tokenType(BadString),
  "url-token": tokenType(Url$1),
  "bad-url-token": tokenType(BadUrl),
  "delim-token": tokenType(Delim),
  "number-token": tokenType(Number$2),
  "percentage-token": tokenType(Percentage$1),
  "dimension-token": tokenType(Dimension$1),
  "whitespace-token": tokenType(WhiteSpace$1),
  "CDO-token": tokenType(CDO$1),
  "CDC-token": tokenType(CDC$1),
  "colon-token": tokenType(Colon),
  "semicolon-token": tokenType(Semicolon),
  "comma-token": tokenType(Comma),
  "[-token": tokenType(LeftSquareBracket),
  "]-token": tokenType(RightSquareBracket),
  "(-token": tokenType(LeftParenthesis),
  ")-token": tokenType(RightParenthesis),
  "{-token": tokenType(LeftCurlyBracket),
  "}-token": tokenType(RightCurlyBracket)
};
const productionTypes = {
  // token type aliases
  "string": tokenType(String$2),
  "ident": tokenType(Ident),
  // percentage
  "percentage": math(percentage, percentageFunctionNames),
  // numeric
  "zero": zero(),
  "number": math(number, numberFunctionNames),
  "integer": math(integer, numberFunctionNames),
  // complex types
  "custom-ident": customIdent,
  "dashed-ident": dashedIdent,
  "custom-property-name": customPropertyName,
  "hex-color": hexColor,
  "id-selector": idSelector,
  // element( <id-selector> )
  "an-plus-b": anPlusB,
  "urange": urange,
  "declaration-value": declarationValue,
  "any-value": anyValue
};
const unitGroups = [
  "length",
  "angle",
  "time",
  "frequency",
  "resolution",
  "flex",
  "decibel",
  "semitones"
];
function createDemensionTypes(units2) {
  const {
    angle: angle2,
    decibel: decibel2,
    frequency: frequency2,
    flex: flex2,
    length: length2,
    resolution: resolution2,
    semitones: semitones2,
    time: time2
  } = units2 || {};
  return {
    "dimension": math(dimension(null), dimensionFunctionNames),
    "angle": math(dimension(angle2), dimensionFunctionNames),
    "decibel": math(dimension(decibel2), dimensionFunctionNames),
    "frequency": math(dimension(frequency2), dimensionFunctionNames),
    "flex": math(dimension(flex2), dimensionFunctionNames),
    "length": math(zero(dimension(length2)), dimensionFunctionNames),
    "resolution": math(dimension(resolution2), dimensionFunctionNames),
    "semitones": math(dimension(semitones2), dimensionFunctionNames),
    "time": math(dimension(time2), dimensionFunctionNames)
  };
}
function createAttrUnit(units2) {
  const unitSet = /* @__PURE__ */ new Set();
  for (const group of unitGroups) {
    if (Array.isArray(units2[group])) {
      for (const unit of units2[group]) {
        unitSet.add(unit.toLowerCase());
      }
    }
  }
  return function attrUnit(token) {
    if (token === null) {
      return 0;
    }
    if (token.type === Delim && token.value === "%") {
      return 1;
    }
    if (token.type === Ident && unitSet.has(token.value.toLowerCase())) {
      return 1;
    }
    return 0;
  };
}
function createGenericTypes(units2) {
  return {
    ...tokenTypes,
    ...productionTypes,
    ...createDemensionTypes(units2),
    "attr-unit": createAttrUnit(units2)
  };
}
const length = [
  // absolute length units https://www.w3.org/TR/css-values-3/#lengths
  "cm",
  "mm",
  "q",
  "in",
  "pt",
  "pc",
  "px",
  // font-relative length units https://drafts.csswg.org/css-values-4/#font-relative-lengths
  "em",
  "rem",
  "ex",
  "rex",
  "cap",
  "rcap",
  "ch",
  "rch",
  "ic",
  "ric",
  "lh",
  "rlh",
  // viewport-percentage lengths https://drafts.csswg.org/css-values-4/#viewport-relative-lengths
  "vw",
  "svw",
  "lvw",
  "dvw",
  "vh",
  "svh",
  "lvh",
  "dvh",
  "vi",
  "svi",
  "lvi",
  "dvi",
  "vb",
  "svb",
  "lvb",
  "dvb",
  "vmin",
  "svmin",
  "lvmin",
  "dvmin",
  "vmax",
  "svmax",
  "lvmax",
  "dvmax",
  // container relative lengths https://drafts.csswg.org/css-contain-3/#container-lengths
  "cqw",
  "cqh",
  "cqi",
  "cqb",
  "cqmin",
  "cqmax"
];
const angle = ["deg", "grad", "rad", "turn"];
const time = ["s", "ms"];
const frequency = ["hz", "khz"];
const resolution = ["dpi", "dpcm", "dppx", "x"];
const flex = ["fr"];
const decibel = ["db"];
const semitones = ["st"];
const units = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  angle,
  decibel,
  flex,
  frequency,
  length,
  resolution,
  semitones,
  time
}, Symbol.toStringTag, { value: "Module" }));
function SyntaxError$1(message, input, offset) {
  return Object.assign(createCustomError("SyntaxError", message), {
    input,
    offset,
    rawMessage: message,
    message: message + "\n  " + input + "\n--" + new Array((offset || input.length) + 1).join("-") + "^"
  });
}
const TAB$1 = 9;
const N$2 = 10;
const F$1 = 12;
const R$1 = 13;
const SPACE$3 = 32;
const NAME_CHAR = new Uint8Array(128).map(
  (_, idx) => /[a-zA-Z0-9\-]/.test(String.fromCharCode(idx)) ? 1 : 0
);
class Scanner {
  constructor(str) {
    this.str = str;
    this.pos = 0;
  }
  charCodeAt(pos) {
    return pos < this.str.length ? this.str.charCodeAt(pos) : 0;
  }
  charCode() {
    return this.charCodeAt(this.pos);
  }
  isNameCharCode(code2 = this.charCode()) {
    return code2 < 128 && NAME_CHAR[code2] === 1;
  }
  nextCharCode() {
    return this.charCodeAt(this.pos + 1);
  }
  nextNonWsCode(pos) {
    return this.charCodeAt(this.findWsEnd(pos));
  }
  skipWs() {
    this.pos = this.findWsEnd(this.pos);
  }
  findWsEnd(pos) {
    for (; pos < this.str.length; pos++) {
      const code2 = this.str.charCodeAt(pos);
      if (code2 !== R$1 && code2 !== N$2 && code2 !== F$1 && code2 !== SPACE$3 && code2 !== TAB$1) {
        break;
      }
    }
    return pos;
  }
  substringToPos(end) {
    return this.str.substring(this.pos, this.pos = end);
  }
  eat(code2) {
    if (this.charCode() !== code2) {
      this.error("Expect `" + String.fromCharCode(code2) + "`");
    }
    this.pos++;
  }
  peek() {
    return this.pos < this.str.length ? this.str.charAt(this.pos++) : "";
  }
  error(message) {
    throw new SyntaxError$1(message, this.str, this.pos);
  }
  scanSpaces() {
    return this.substringToPos(this.findWsEnd(this.pos));
  }
  scanWord() {
    let end = this.pos;
    for (; end < this.str.length; end++) {
      const code2 = this.str.charCodeAt(end);
      if (code2 >= 128 || NAME_CHAR[code2] === 0) {
        break;
      }
    }
    if (this.pos === end) {
      this.error("Expect a keyword");
    }
    return this.substringToPos(end);
  }
  scanNumber() {
    let end = this.pos;
    for (; end < this.str.length; end++) {
      const code2 = this.str.charCodeAt(end);
      if (code2 < 48 || code2 > 57) {
        break;
      }
    }
    if (this.pos === end) {
      this.error("Expect a number");
    }
    return this.substringToPos(end);
  }
  scanString() {
    const end = this.str.indexOf("'", this.pos + 1);
    if (end === -1) {
      this.pos = this.str.length;
      this.error("Expect an apostrophe");
    }
    return this.substringToPos(end + 1);
  }
}
const TAB = 9;
const N$1 = 10;
const F = 12;
const R = 13;
const SPACE$2 = 32;
const EXCLAMATIONMARK$2 = 33;
const NUMBERSIGN$3 = 35;
const AMPERSAND$5 = 38;
const APOSTROPHE$2 = 39;
const LEFTPARENTHESIS$2 = 40;
const RIGHTPARENTHESIS$2 = 41;
const ASTERISK$6 = 42;
const PLUSSIGN$6 = 43;
const COMMA = 44;
const HYPERMINUS = 45;
const LESSTHANSIGN$1 = 60;
const GREATERTHANSIGN$3 = 62;
const QUESTIONMARK$1 = 63;
const COMMERCIALAT = 64;
const LEFTSQUAREBRACKET = 91;
const RIGHTSQUAREBRACKET = 93;
const LEFTCURLYBRACKET = 123;
const VERTICALLINE$3 = 124;
const RIGHTCURLYBRACKET = 125;
const INFINITY = 8734;
const COMBINATOR_PRECEDENCE = {
  " ": 1,
  "&&": 2,
  "||": 3,
  "|": 4
};
function readMultiplierRange(scanner) {
  let min = null;
  let max2 = null;
  scanner.eat(LEFTCURLYBRACKET);
  scanner.skipWs();
  min = scanner.scanNumber(scanner);
  scanner.skipWs();
  if (scanner.charCode() === COMMA) {
    scanner.pos++;
    scanner.skipWs();
    if (scanner.charCode() !== RIGHTCURLYBRACKET) {
      max2 = scanner.scanNumber(scanner);
      scanner.skipWs();
    }
  } else {
    max2 = min;
  }
  scanner.eat(RIGHTCURLYBRACKET);
  return {
    min: Number(min),
    max: max2 ? Number(max2) : 0
  };
}
function readMultiplier(scanner) {
  let range = null;
  let comma = false;
  switch (scanner.charCode()) {
    case ASTERISK$6:
      scanner.pos++;
      range = {
        min: 0,
        max: 0
      };
      break;
    case PLUSSIGN$6:
      scanner.pos++;
      range = {
        min: 1,
        max: 0
      };
      break;
    case QUESTIONMARK$1:
      scanner.pos++;
      range = {
        min: 0,
        max: 1
      };
      break;
    case NUMBERSIGN$3:
      scanner.pos++;
      comma = true;
      if (scanner.charCode() === LEFTCURLYBRACKET) {
        range = readMultiplierRange(scanner);
      } else if (scanner.charCode() === QUESTIONMARK$1) {
        scanner.pos++;
        range = {
          min: 0,
          max: 0
        };
      } else {
        range = {
          min: 1,
          max: 0
        };
      }
      break;
    case LEFTCURLYBRACKET:
      range = readMultiplierRange(scanner);
      break;
    default:
      return null;
  }
  return {
    type: "Multiplier",
    comma,
    min: range.min,
    max: range.max,
    term: null
  };
}
function maybeMultiplied(scanner, node2) {
  const multiplier = readMultiplier(scanner);
  if (multiplier !== null) {
    multiplier.term = node2;
    if (scanner.charCode() === NUMBERSIGN$3 && scanner.charCodeAt(scanner.pos - 1) === PLUSSIGN$6) {
      return maybeMultiplied(scanner, multiplier);
    }
    if (scanner.charCode() === QUESTIONMARK$1 && scanner.charCodeAt(scanner.pos - 1) === RIGHTCURLYBRACKET) {
      return maybeMultiplied(scanner, multiplier);
    }
    return multiplier;
  }
  return node2;
}
function maybeToken(scanner) {
  const ch3 = scanner.peek();
  if (ch3 === "") {
    return null;
  }
  return maybeMultiplied(scanner, {
    type: "Token",
    value: ch3
  });
}
function readProperty$1(scanner) {
  let name2;
  scanner.eat(LESSTHANSIGN$1);
  scanner.eat(APOSTROPHE$2);
  name2 = scanner.scanWord();
  scanner.eat(APOSTROPHE$2);
  scanner.eat(GREATERTHANSIGN$3);
  return maybeMultiplied(scanner, {
    type: "Property",
    name: name2
  });
}
function readTypeRange(scanner) {
  let min = null;
  let max2 = null;
  let sign = 1;
  scanner.eat(LEFTSQUAREBRACKET);
  if (scanner.charCode() === HYPERMINUS) {
    scanner.peek();
    sign = -1;
  }
  if (sign == -1 && scanner.charCode() === INFINITY) {
    scanner.peek();
  } else {
    min = sign * Number(scanner.scanNumber(scanner));
    if (scanner.isNameCharCode()) {
      min += scanner.scanWord();
    }
  }
  scanner.skipWs();
  scanner.eat(COMMA);
  scanner.skipWs();
  if (scanner.charCode() === INFINITY) {
    scanner.peek();
  } else {
    sign = 1;
    if (scanner.charCode() === HYPERMINUS) {
      scanner.peek();
      sign = -1;
    }
    max2 = sign * Number(scanner.scanNumber(scanner));
    if (scanner.isNameCharCode()) {
      max2 += scanner.scanWord();
    }
  }
  scanner.eat(RIGHTSQUAREBRACKET);
  return {
    type: "Range",
    min,
    max: max2
  };
}
function readType(scanner) {
  let name2;
  let opts = null;
  scanner.eat(LESSTHANSIGN$1);
  name2 = scanner.scanWord();
  if (name2 === "boolean-expr") {
    scanner.eat(LEFTSQUAREBRACKET);
    const implicitGroup = readImplicitGroup(scanner, RIGHTSQUAREBRACKET);
    scanner.eat(RIGHTSQUAREBRACKET);
    scanner.eat(GREATERTHANSIGN$3);
    return maybeMultiplied(scanner, {
      type: "Boolean",
      term: implicitGroup.terms.length === 1 ? implicitGroup.terms[0] : implicitGroup
    });
  }
  if (scanner.charCode() === LEFTPARENTHESIS$2 && scanner.nextCharCode() === RIGHTPARENTHESIS$2) {
    scanner.pos += 2;
    name2 += "()";
  }
  if (scanner.charCodeAt(scanner.findWsEnd(scanner.pos)) === LEFTSQUAREBRACKET) {
    scanner.skipWs();
    opts = readTypeRange(scanner);
  }
  scanner.eat(GREATERTHANSIGN$3);
  return maybeMultiplied(scanner, {
    type: "Type",
    name: name2,
    opts
  });
}
function readKeywordOrFunction(scanner) {
  const name2 = scanner.scanWord();
  if (scanner.charCode() === LEFTPARENTHESIS$2) {
    scanner.pos++;
    return {
      type: "Function",
      name: name2
    };
  }
  return maybeMultiplied(scanner, {
    type: "Keyword",
    name: name2
  });
}
function regroupTerms(terms, combinators) {
  function createGroup(terms2, combinator2) {
    return {
      type: "Group",
      terms: terms2,
      combinator: combinator2,
      disallowEmpty: false,
      explicit: false
    };
  }
  let combinator;
  combinators = Object.keys(combinators).sort((a, b) => COMBINATOR_PRECEDENCE[a] - COMBINATOR_PRECEDENCE[b]);
  while (combinators.length > 0) {
    combinator = combinators.shift();
    let i = 0;
    let subgroupStart = 0;
    for (; i < terms.length; i++) {
      const term = terms[i];
      if (term.type === "Combinator") {
        if (term.value === combinator) {
          if (subgroupStart === -1) {
            subgroupStart = i - 1;
          }
          terms.splice(i, 1);
          i--;
        } else {
          if (subgroupStart !== -1 && i - subgroupStart > 1) {
            terms.splice(
              subgroupStart,
              i - subgroupStart,
              createGroup(terms.slice(subgroupStart, i), combinator)
            );
            i = subgroupStart + 1;
          }
          subgroupStart = -1;
        }
      }
    }
    if (subgroupStart !== -1 && combinators.length) {
      terms.splice(
        subgroupStart,
        i - subgroupStart,
        createGroup(terms.slice(subgroupStart, i), combinator)
      );
    }
  }
  return combinator;
}
function readImplicitGroup(scanner, stopCharCode = -1) {
  const combinators = /* @__PURE__ */ Object.create(null);
  const terms = [];
  let prevToken = null;
  let prevTokenPos = scanner.pos;
  let prevTokenIsFunction = false;
  while (scanner.charCode() !== stopCharCode) {
    let token = prevTokenIsFunction ? readImplicitGroup(scanner, RIGHTPARENTHESIS$2) : peek(scanner);
    if (!token) {
      break;
    }
    if (token.type === "Spaces") {
      continue;
    }
    if (prevTokenIsFunction) {
      if (token.terms.length === 0) {
        prevTokenIsFunction = false;
        continue;
      }
      if (token.combinator === " ") {
        while (token.terms.length > 1) {
          combinators[" "] = true;
          terms.push({
            type: "Combinator",
            value: " "
          }, token.terms.shift());
        }
        token = token.terms[0];
      }
    }
    if (token.type === "Combinator") {
      if (prevToken === null || prevToken.type === "Combinator") {
        scanner.pos = prevTokenPos;
        scanner.error("Unexpected combinator");
      }
      combinators[token.value] = true;
    } else if (prevToken !== null && prevToken.type !== "Combinator") {
      combinators[" "] = true;
      terms.push({
        type: "Combinator",
        value: " "
      });
    }
    terms.push(token);
    prevToken = token;
    prevTokenPos = scanner.pos;
    prevTokenIsFunction = token.type === "Function";
  }
  if (prevToken !== null && prevToken.type === "Combinator") {
    scanner.pos -= prevTokenPos;
    scanner.error("Unexpected combinator");
  }
  return {
    type: "Group",
    terms,
    combinator: regroupTerms(terms, combinators) || " ",
    disallowEmpty: false,
    explicit: false
  };
}
function readGroup(scanner) {
  let result;
  scanner.eat(LEFTSQUAREBRACKET);
  result = readImplicitGroup(scanner, RIGHTSQUAREBRACKET);
  scanner.eat(RIGHTSQUAREBRACKET);
  result.explicit = true;
  if (scanner.charCode() === EXCLAMATIONMARK$2) {
    scanner.pos++;
    result.disallowEmpty = true;
  }
  return result;
}
function peek(scanner) {
  let code2 = scanner.charCode();
  switch (code2) {
    case RIGHTSQUAREBRACKET:
      break;
    case LEFTSQUAREBRACKET:
      return maybeMultiplied(scanner, readGroup(scanner));
    case LESSTHANSIGN$1:
      return scanner.nextCharCode() === APOSTROPHE$2 ? readProperty$1(scanner) : readType(scanner);
    case VERTICALLINE$3:
      return {
        type: "Combinator",
        value: scanner.substringToPos(
          scanner.pos + (scanner.nextCharCode() === VERTICALLINE$3 ? 2 : 1)
        )
      };
    case AMPERSAND$5:
      scanner.pos++;
      scanner.eat(AMPERSAND$5);
      return {
        type: "Combinator",
        value: "&&"
      };
    case COMMA:
      scanner.pos++;
      return {
        type: "Comma"
      };
    case APOSTROPHE$2:
      return maybeMultiplied(scanner, {
        type: "String",
        value: scanner.scanString()
      });
    case SPACE$2:
    case TAB:
    case N$1:
    case R:
    case F:
      return {
        type: "Spaces",
        value: scanner.scanSpaces()
      };
    case COMMERCIALAT:
      code2 = scanner.nextCharCode();
      if (scanner.isNameCharCode(code2)) {
        scanner.pos++;
        return {
          type: "AtKeyword",
          name: scanner.scanWord()
        };
      }
      return maybeToken(scanner);
    case ASTERISK$6:
    case PLUSSIGN$6:
    case QUESTIONMARK$1:
    case NUMBERSIGN$3:
    case EXCLAMATIONMARK$2:
      break;
    case LEFTCURLYBRACKET:
      code2 = scanner.nextCharCode();
      if (code2 < 48 || code2 > 57) {
        return maybeToken(scanner);
      }
      break;
    default:
      if (scanner.isNameCharCode(code2)) {
        return readKeywordOrFunction(scanner);
      }
      return maybeToken(scanner);
  }
}
function parse$O(source) {
  const scanner = new Scanner(source);
  const result = readImplicitGroup(scanner);
  if (scanner.pos !== source.length) {
    scanner.error("Unexpected input");
  }
  if (result.terms.length === 1 && result.terms[0].type === "Group") {
    return result.terms[0];
  }
  return result;
}
const noop = function() {
};
function ensureFunction(value2) {
  return typeof value2 === "function" ? value2 : noop;
}
function walk$1(node2, options, context) {
  function walk2(node3) {
    enter.call(context, node3);
    switch (node3.type) {
      case "Group":
        node3.terms.forEach(walk2);
        break;
      case "Multiplier":
      case "Boolean":
        walk2(node3.term);
        break;
      case "Type":
      case "Property":
      case "Keyword":
      case "AtKeyword":
      case "Function":
      case "String":
      case "Token":
      case "Comma":
        break;
      default:
        throw new Error("Unknown type: " + node3.type);
    }
    leave.call(context, node3);
  }
  let enter = noop;
  let leave = noop;
  if (typeof options === "function") {
    enter = options;
  } else if (options) {
    enter = ensureFunction(options.enter);
    leave = ensureFunction(options.leave);
  }
  if (enter === noop && leave === noop) {
    throw new Error("Neither `enter` nor `leave` walker handler is set or both aren't a function");
  }
  walk2(node2);
}
const astToTokens = {
  decorator(handlers) {
    const tokens = [];
    let curNode = null;
    return {
      ...handlers,
      node(node2) {
        const tmp = curNode;
        curNode = node2;
        handlers.node.call(this, node2);
        curNode = tmp;
      },
      emit(value2, type, auto) {
        tokens.push({
          type,
          value: value2,
          node: auto ? null : curNode
        });
      },
      result() {
        return tokens;
      }
    };
  }
};
function stringToTokens(str) {
  const tokens = [];
  tokenize$1(
    str,
    (type, start, end) => tokens.push({
      type,
      value: str.slice(start, end),
      node: null
    })
  );
  return tokens;
}
function prepareTokens(value2, syntax2) {
  if (typeof value2 === "string") {
    return stringToTokens(value2);
  }
  return syntax2.generate(value2, astToTokens);
}
const MATCH = { type: "Match" };
const MISMATCH = { type: "Mismatch" };
const DISALLOW_EMPTY = { type: "DisallowEmpty" };
const LEFTPARENTHESIS$1 = 40;
const RIGHTPARENTHESIS$1 = 41;
function createCondition(match, thenBranch, elseBranch) {
  if (thenBranch === MATCH && elseBranch === MISMATCH) {
    return match;
  }
  if (match === MATCH && thenBranch === MATCH && elseBranch === MATCH) {
    return match;
  }
  if (match.type === "If" && match.else === MISMATCH && thenBranch === MATCH) {
    thenBranch = match.then;
    match = match.match;
  }
  return {
    type: "If",
    match,
    then: thenBranch,
    else: elseBranch
  };
}
function isFunctionType(name2) {
  return name2.length > 2 && name2.charCodeAt(name2.length - 2) === LEFTPARENTHESIS$1 && name2.charCodeAt(name2.length - 1) === RIGHTPARENTHESIS$1;
}
function isEnumCapatible(term) {
  return term.type === "Keyword" || term.type === "AtKeyword" || term.type === "Function" || term.type === "Type" && isFunctionType(term.name);
}
function groupNode(terms, combinator = " ", explicit = false) {
  return {
    type: "Group",
    terms,
    combinator,
    disallowEmpty: false,
    explicit
  };
}
function replaceTypeInGraph(node2, replacements, visited = /* @__PURE__ */ new Set()) {
  if (!visited.has(node2)) {
    visited.add(node2);
    switch (node2.type) {
      case "If":
        node2.match = replaceTypeInGraph(node2.match, replacements, visited);
        node2.then = replaceTypeInGraph(node2.then, replacements, visited);
        node2.else = replaceTypeInGraph(node2.else, replacements, visited);
        break;
      case "Type":
        return replacements[node2.name] || node2;
    }
  }
  return node2;
}
function buildGroupMatchGraph(combinator, terms, atLeastOneTermMatched) {
  switch (combinator) {
    case " ": {
      let result = MATCH;
      for (let i = terms.length - 1; i >= 0; i--) {
        const term = terms[i];
        result = createCondition(
          term,
          result,
          MISMATCH
        );
      }
      return result;
    }
    case "|": {
      let result = MISMATCH;
      let map = null;
      for (let i = terms.length - 1; i >= 0; i--) {
        let term = terms[i];
        if (isEnumCapatible(term)) {
          if (map === null && i > 0 && isEnumCapatible(terms[i - 1])) {
            map = /* @__PURE__ */ Object.create(null);
            result = createCondition(
              {
                type: "Enum",
                map
              },
              MATCH,
              result
            );
          }
          if (map !== null) {
            const key = (isFunctionType(term.name) ? term.name.slice(0, -1) : term.name).toLowerCase();
            if (key in map === false) {
              map[key] = term;
              continue;
            }
          }
        }
        map = null;
        result = createCondition(
          term,
          MATCH,
          result
        );
      }
      return result;
    }
    case "&&": {
      if (terms.length > 5) {
        return {
          type: "MatchOnce",
          terms,
          all: true
        };
      }
      let result = MISMATCH;
      for (let i = terms.length - 1; i >= 0; i--) {
        const term = terms[i];
        let thenClause;
        if (terms.length > 1) {
          thenClause = buildGroupMatchGraph(
            combinator,
            terms.filter(function(newGroupTerm) {
              return newGroupTerm !== term;
            }),
            false
          );
        } else {
          thenClause = MATCH;
        }
        result = createCondition(
          term,
          thenClause,
          result
        );
      }
      return result;
    }
    case "||": {
      if (terms.length > 5) {
        return {
          type: "MatchOnce",
          terms,
          all: false
        };
      }
      let result = atLeastOneTermMatched ? MATCH : MISMATCH;
      for (let i = terms.length - 1; i >= 0; i--) {
        const term = terms[i];
        let thenClause;
        if (terms.length > 1) {
          thenClause = buildGroupMatchGraph(
            combinator,
            terms.filter(function(newGroupTerm) {
              return newGroupTerm !== term;
            }),
            true
          );
        } else {
          thenClause = MATCH;
        }
        result = createCondition(
          term,
          thenClause,
          result
        );
      }
      return result;
    }
  }
}
function buildMultiplierMatchGraph(node2) {
  let result = MATCH;
  let matchTerm = buildMatchGraphInternal(node2.term);
  if (node2.max === 0) {
    matchTerm = createCondition(
      matchTerm,
      DISALLOW_EMPTY,
      MISMATCH
    );
    result = createCondition(
      matchTerm,
      null,
      // will be a loop
      MISMATCH
    );
    result.then = createCondition(
      MATCH,
      MATCH,
      result
      // make a loop
    );
    if (node2.comma) {
      result.then.else = createCondition(
        { type: "Comma", syntax: node2 },
        result,
        MISMATCH
      );
    }
  } else {
    for (let i = node2.min || 1; i <= node2.max; i++) {
      if (node2.comma && result !== MATCH) {
        result = createCondition(
          { type: "Comma", syntax: node2 },
          result,
          MISMATCH
        );
      }
      result = createCondition(
        matchTerm,
        createCondition(
          MATCH,
          MATCH,
          result
        ),
        MISMATCH
      );
    }
  }
  if (node2.min === 0) {
    result = createCondition(
      MATCH,
      MATCH,
      result
    );
  } else {
    for (let i = 0; i < node2.min - 1; i++) {
      if (node2.comma && result !== MATCH) {
        result = createCondition(
          { type: "Comma", syntax: node2 },
          result,
          MISMATCH
        );
      }
      result = createCondition(
        matchTerm,
        result,
        MISMATCH
      );
    }
  }
  return result;
}
function buildMatchGraphInternal(node2) {
  if (typeof node2 === "function") {
    return {
      type: "Generic",
      fn: node2
    };
  }
  switch (node2.type) {
    case "Group": {
      let result = buildGroupMatchGraph(
        node2.combinator,
        node2.terms.map(buildMatchGraphInternal),
        false
      );
      if (node2.disallowEmpty) {
        result = createCondition(
          result,
          DISALLOW_EMPTY,
          MISMATCH
        );
      }
      return result;
    }
    case "Multiplier":
      return buildMultiplierMatchGraph(node2);
    // https://drafts.csswg.org/css-values-5/#boolean
    case "Boolean": {
      const term = buildMatchGraphInternal(node2.term);
      const matchNode = buildMatchGraphInternal(groupNode([
        groupNode([
          { type: "Keyword", name: "not" },
          { type: "Type", name: "!boolean-group" }
        ]),
        groupNode([
          { type: "Type", name: "!boolean-group" },
          groupNode([
            { type: "Multiplier", comma: false, min: 0, max: 0, term: groupNode([
              { type: "Keyword", name: "and" },
              { type: "Type", name: "!boolean-group" }
            ]) },
            { type: "Multiplier", comma: false, min: 0, max: 0, term: groupNode([
              { type: "Keyword", name: "or" },
              { type: "Type", name: "!boolean-group" }
            ]) }
          ], "|")
        ])
      ], "|"));
      const booleanGroup = buildMatchGraphInternal(
        groupNode([
          { type: "Type", name: "!term" },
          groupNode([
            { type: "Token", value: "(" },
            { type: "Type", name: "!self" },
            { type: "Token", value: ")" }
          ]),
          { type: "Type", name: "general-enclosed" }
        ], "|")
      );
      replaceTypeInGraph(booleanGroup, { "!term": term, "!self": matchNode });
      replaceTypeInGraph(matchNode, { "!boolean-group": booleanGroup });
      return matchNode;
    }
    case "Type":
    case "Property":
      return {
        type: node2.type,
        name: node2.name,
        syntax: node2
      };
    case "Keyword":
      return {
        type: node2.type,
        name: node2.name.toLowerCase(),
        syntax: node2
      };
    case "AtKeyword":
      return {
        type: node2.type,
        name: "@" + node2.name.toLowerCase(),
        syntax: node2
      };
    case "Function":
      return {
        type: node2.type,
        name: node2.name.toLowerCase() + "(",
        syntax: node2
      };
    case "String":
      if (node2.value.length === 3) {
        return {
          type: "Token",
          value: node2.value.charAt(1),
          syntax: node2
        };
      }
      return {
        type: node2.type,
        value: node2.value.substr(1, node2.value.length - 2).replace(/\\'/g, "'"),
        syntax: node2
      };
    case "Token":
      return {
        type: node2.type,
        value: node2.value,
        syntax: node2
      };
    case "Comma":
      return {
        type: node2.type,
        syntax: node2
      };
    default:
      throw new Error("Unknown node type:", node2.type);
  }
}
function buildMatchGraph(syntaxTree, ref) {
  if (typeof syntaxTree === "string") {
    syntaxTree = parse$O(syntaxTree);
  }
  return {
    type: "MatchGraph",
    match: buildMatchGraphInternal(syntaxTree),
    syntax: ref || null,
    source: syntaxTree
  };
}
const { hasOwnProperty: hasOwnProperty$2 } = Object.prototype;
const STUB = 0;
const TOKEN = 1;
const OPEN_SYNTAX = 2;
const CLOSE_SYNTAX = 3;
const EXIT_REASON_MATCH = "Match";
const EXIT_REASON_MISMATCH = "Mismatch";
const EXIT_REASON_ITERATION_LIMIT = "Maximum iteration number exceeded (please fill an issue on https://github.com/csstree/csstree/issues)";
const ITERATION_LIMIT = 15e3;
function reverseList(list) {
  let prev = null;
  let next = null;
  let item = list;
  while (item !== null) {
    next = item.prev;
    item.prev = prev;
    prev = item;
    item = next;
  }
  return prev;
}
function areStringsEqualCaseInsensitive(testStr, referenceStr) {
  if (testStr.length !== referenceStr.length) {
    return false;
  }
  for (let i = 0; i < testStr.length; i++) {
    const referenceCode = referenceStr.charCodeAt(i);
    let testCode = testStr.charCodeAt(i);
    if (testCode >= 65 && testCode <= 90) {
      testCode = testCode | 32;
    }
    if (testCode !== referenceCode) {
      return false;
    }
  }
  return true;
}
function isContextEdgeDelim(token) {
  if (token.type !== Delim) {
    return false;
  }
  return token.value !== "?";
}
function isCommaContextStart(token) {
  if (token === null) {
    return true;
  }
  return token.type === Comma || token.type === Function$1 || token.type === LeftParenthesis || token.type === LeftSquareBracket || token.type === LeftCurlyBracket || isContextEdgeDelim(token);
}
function isCommaContextEnd(token) {
  if (token === null) {
    return true;
  }
  return token.type === RightParenthesis || token.type === RightSquareBracket || token.type === RightCurlyBracket || token.type === Delim && token.value === "/";
}
function internalMatch(tokens, state, syntaxes) {
  function moveToNextToken() {
    do {
      tokenIndex++;
      token = tokenIndex < tokens.length ? tokens[tokenIndex] : null;
    } while (token !== null && (token.type === WhiteSpace$1 || token.type === Comment$1));
  }
  function getNextToken(offset) {
    const nextIndex = tokenIndex + offset;
    return nextIndex < tokens.length ? tokens[nextIndex] : null;
  }
  function stateSnapshotFromSyntax(nextState, prev) {
    return {
      nextState,
      matchStack,
      syntaxStack,
      thenStack,
      tokenIndex,
      prev
    };
  }
  function pushThenStack(nextState) {
    thenStack = {
      nextState,
      matchStack,
      syntaxStack,
      prev: thenStack
    };
  }
  function pushElseStack(nextState) {
    elseStack = stateSnapshotFromSyntax(nextState, elseStack);
  }
  function addTokenToMatch() {
    matchStack = {
      type: TOKEN,
      syntax: state.syntax,
      token,
      prev: matchStack
    };
    moveToNextToken();
    syntaxStash = null;
    if (tokenIndex > longestMatch) {
      longestMatch = tokenIndex;
    }
  }
  function openSyntax() {
    syntaxStack = {
      syntax: state.syntax,
      opts: state.syntax.opts || syntaxStack !== null && syntaxStack.opts || null,
      prev: syntaxStack
    };
    matchStack = {
      type: OPEN_SYNTAX,
      syntax: state.syntax,
      token: matchStack.token,
      prev: matchStack
    };
  }
  function closeSyntax() {
    if (matchStack.type === OPEN_SYNTAX) {
      matchStack = matchStack.prev;
    } else {
      matchStack = {
        type: CLOSE_SYNTAX,
        syntax: syntaxStack.syntax,
        token: matchStack.token,
        prev: matchStack
      };
    }
    syntaxStack = syntaxStack.prev;
  }
  let syntaxStack = null;
  let thenStack = null;
  let elseStack = null;
  let syntaxStash = null;
  let iterationCount = 0;
  let exitReason = null;
  let token = null;
  let tokenIndex = -1;
  let longestMatch = 0;
  let matchStack = {
    type: STUB,
    syntax: null,
    token: null,
    prev: null
  };
  moveToNextToken();
  while (exitReason === null && ++iterationCount < ITERATION_LIMIT) {
    switch (state.type) {
      case "Match":
        if (thenStack === null) {
          if (token !== null) {
            if (tokenIndex !== tokens.length - 1 || token.value !== "\\0" && token.value !== "\\9") {
              state = MISMATCH;
              break;
            }
          }
          exitReason = EXIT_REASON_MATCH;
          break;
        }
        state = thenStack.nextState;
        if (state === DISALLOW_EMPTY) {
          if (thenStack.matchStack === matchStack) {
            state = MISMATCH;
            break;
          } else {
            state = MATCH;
          }
        }
        while (thenStack.syntaxStack !== syntaxStack) {
          closeSyntax();
        }
        thenStack = thenStack.prev;
        break;
      case "Mismatch":
        if (syntaxStash !== null && syntaxStash !== false) {
          if (elseStack === null || tokenIndex > elseStack.tokenIndex) {
            elseStack = syntaxStash;
            syntaxStash = false;
          }
        } else if (elseStack === null) {
          exitReason = EXIT_REASON_MISMATCH;
          break;
        }
        state = elseStack.nextState;
        thenStack = elseStack.thenStack;
        syntaxStack = elseStack.syntaxStack;
        matchStack = elseStack.matchStack;
        tokenIndex = elseStack.tokenIndex;
        token = tokenIndex < tokens.length ? tokens[tokenIndex] : null;
        elseStack = elseStack.prev;
        break;
      case "MatchGraph":
        state = state.match;
        break;
      case "If":
        if (state.else !== MISMATCH) {
          pushElseStack(state.else);
        }
        if (state.then !== MATCH) {
          pushThenStack(state.then);
        }
        state = state.match;
        break;
      case "MatchOnce":
        state = {
          type: "MatchOnceBuffer",
          syntax: state,
          index: 0,
          mask: 0
        };
        break;
      case "MatchOnceBuffer": {
        const terms = state.syntax.terms;
        if (state.index === terms.length) {
          if (state.mask === 0 || state.syntax.all) {
            state = MISMATCH;
            break;
          }
          state = MATCH;
          break;
        }
        if (state.mask === (1 << terms.length) - 1) {
          state = MATCH;
          break;
        }
        for (; state.index < terms.length; state.index++) {
          const matchFlag = 1 << state.index;
          if ((state.mask & matchFlag) === 0) {
            pushElseStack(state);
            pushThenStack({
              type: "AddMatchOnce",
              syntax: state.syntax,
              mask: state.mask | matchFlag
            });
            state = terms[state.index++];
            break;
          }
        }
        break;
      }
      case "AddMatchOnce":
        state = {
          type: "MatchOnceBuffer",
          syntax: state.syntax,
          index: 0,
          mask: state.mask
        };
        break;
      case "Enum":
        if (token !== null) {
          let name2 = token.value.toLowerCase();
          if (name2.indexOf("\\") !== -1) {
            name2 = name2.replace(/\\[09].*$/, "");
          }
          if (hasOwnProperty$2.call(state.map, name2)) {
            state = state.map[name2];
            break;
          }
        }
        state = MISMATCH;
        break;
      case "Generic": {
        const opts = syntaxStack !== null ? syntaxStack.opts : null;
        const lastTokenIndex2 = tokenIndex + Math.floor(state.fn(token, getNextToken, opts));
        if (!isNaN(lastTokenIndex2) && lastTokenIndex2 > tokenIndex) {
          while (tokenIndex < lastTokenIndex2) {
            addTokenToMatch();
          }
          state = MATCH;
        } else {
          state = MISMATCH;
        }
        break;
      }
      case "Type":
      case "Property": {
        const syntaxDict = state.type === "Type" ? "types" : "properties";
        const dictSyntax = hasOwnProperty$2.call(syntaxes, syntaxDict) ? syntaxes[syntaxDict][state.name] : null;
        if (!dictSyntax || !dictSyntax.match) {
          throw new Error(
            "Bad syntax reference: " + (state.type === "Type" ? "<" + state.name + ">" : "<'" + state.name + "'>")
          );
        }
        if (syntaxStash !== false && token !== null && state.type === "Type") {
          const lowPriorityMatching = (
            // https://drafts.csswg.org/css-values-4/#custom-idents
            // When parsing positionally-ambiguous keywords in a property value, a <custom-ident> production
            // can only claim the keyword if no other unfulfilled production can claim it.
            state.name === "custom-ident" && token.type === Ident || // https://drafts.csswg.org/css-values-4/#lengths
            // ... if a `0` could be parsed as either a <number> or a <length> in a property (such as line-height),
            // it must parse as a <number>
            state.name === "length" && token.value === "0"
          );
          if (lowPriorityMatching) {
            if (syntaxStash === null) {
              syntaxStash = stateSnapshotFromSyntax(state, elseStack);
            }
            state = MISMATCH;
            break;
          }
        }
        openSyntax();
        state = dictSyntax.matchRef || dictSyntax.match;
        break;
      }
      case "Keyword": {
        const name2 = state.name;
        if (token !== null) {
          let keywordName = token.value;
          if (keywordName.indexOf("\\") !== -1) {
            keywordName = keywordName.replace(/\\[09].*$/, "");
          }
          if (areStringsEqualCaseInsensitive(keywordName, name2)) {
            addTokenToMatch();
            state = MATCH;
            break;
          }
        }
        state = MISMATCH;
        break;
      }
      case "AtKeyword":
      case "Function":
        if (token !== null && areStringsEqualCaseInsensitive(token.value, state.name)) {
          addTokenToMatch();
          state = MATCH;
          break;
        }
        state = MISMATCH;
        break;
      case "Token":
        if (token !== null && token.value === state.value) {
          addTokenToMatch();
          state = MATCH;
          break;
        }
        state = MISMATCH;
        break;
      case "Comma":
        if (token !== null && token.type === Comma) {
          if (isCommaContextStart(matchStack.token)) {
            state = MISMATCH;
          } else {
            addTokenToMatch();
            state = isCommaContextEnd(token) ? MISMATCH : MATCH;
          }
        } else {
          state = isCommaContextStart(matchStack.token) || isCommaContextEnd(token) ? MATCH : MISMATCH;
        }
        break;
      case "String":
        let string = "";
        let lastTokenIndex = tokenIndex;
        for (; lastTokenIndex < tokens.length && string.length < state.value.length; lastTokenIndex++) {
          string += tokens[lastTokenIndex].value;
        }
        if (areStringsEqualCaseInsensitive(string, state.value)) {
          while (tokenIndex < lastTokenIndex) {
            addTokenToMatch();
          }
          state = MATCH;
        } else {
          state = MISMATCH;
        }
        break;
      default:
        throw new Error("Unknown node type: " + state.type);
    }
  }
  switch (exitReason) {
    case null:
      console.warn("[csstree-match] BREAK after " + ITERATION_LIMIT + " iterations");
      exitReason = EXIT_REASON_ITERATION_LIMIT;
      matchStack = null;
      break;
    case EXIT_REASON_MATCH:
      while (syntaxStack !== null) {
        closeSyntax();
      }
      break;
    default:
      matchStack = null;
  }
  return {
    tokens,
    reason: exitReason,
    iterations: iterationCount,
    match: matchStack,
    longestMatch
  };
}
function matchAsTree(tokens, matchGraph, syntaxes) {
  const matchResult = internalMatch(tokens, matchGraph, syntaxes || {});
  if (matchResult.match === null) {
    return matchResult;
  }
  let item = matchResult.match;
  let host = matchResult.match = {
    syntax: matchGraph.syntax || null,
    match: []
  };
  const hostStack = [host];
  item = reverseList(item).prev;
  while (item !== null) {
    switch (item.type) {
      case OPEN_SYNTAX:
        host.match.push(host = {
          syntax: item.syntax,
          match: []
        });
        hostStack.push(host);
        break;
      case CLOSE_SYNTAX:
        hostStack.pop();
        host = hostStack[hostStack.length - 1];
        break;
      default:
        host.match.push({
          syntax: item.syntax || null,
          token: item.token.value,
          node: item.token.node
        });
    }
    item = item.prev;
  }
  return matchResult;
}
function getTrace(node2) {
  function shouldPutToTrace(syntax2) {
    if (syntax2 === null) {
      return false;
    }
    return syntax2.type === "Type" || syntax2.type === "Property" || syntax2.type === "Keyword";
  }
  function hasMatch(matchNode) {
    if (Array.isArray(matchNode.match)) {
      for (let i = 0; i < matchNode.match.length; i++) {
        if (hasMatch(matchNode.match[i])) {
          if (shouldPutToTrace(matchNode.syntax)) {
            result.unshift(matchNode.syntax);
          }
          return true;
        }
      }
    } else if (matchNode.node === node2) {
      result = shouldPutToTrace(matchNode.syntax) ? [matchNode.syntax] : [];
      return true;
    }
    return false;
  }
  let result = null;
  if (this.matched !== null) {
    hasMatch(this.matched);
  }
  return result;
}
function isType(node2, type) {
  return testNode(this, node2, (match) => match.type === "Type" && match.name === type);
}
function isProperty(node2, property2) {
  return testNode(this, node2, (match) => match.type === "Property" && match.name === property2);
}
function isKeyword(node2) {
  return testNode(this, node2, (match) => match.type === "Keyword");
}
function testNode(match, node2, fn) {
  const trace2 = getTrace.call(match, node2);
  if (trace2 === null) {
    return false;
  }
  return trace2.some(fn);
}
const trace = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  getTrace,
  isKeyword,
  isProperty,
  isType
}, Symbol.toStringTag, { value: "Module" }));
function getFirstMatchNode(matchNode) {
  if ("node" in matchNode) {
    return matchNode.node;
  }
  return getFirstMatchNode(matchNode.match[0]);
}
function getLastMatchNode(matchNode) {
  if ("node" in matchNode) {
    return matchNode.node;
  }
  return getLastMatchNode(matchNode.match[matchNode.match.length - 1]);
}
function matchFragments(lexer2, ast, match, type, name2) {
  function findFragments(matchNode) {
    if (matchNode.syntax !== null && matchNode.syntax.type === type && matchNode.syntax.name === name2) {
      const start = getFirstMatchNode(matchNode);
      const end = getLastMatchNode(matchNode);
      lexer2.syntax.walk(ast, function(node2, item, list) {
        if (node2 === start) {
          const nodes = new List();
          do {
            nodes.appendData(item.data);
            if (item.data === end) {
              break;
            }
            item = item.next;
          } while (item !== null);
          fragments.push({
            parent: list,
            nodes
          });
        }
      });
    }
    if (Array.isArray(matchNode.match)) {
      matchNode.match.forEach(findFragments);
    }
  }
  const fragments = [];
  if (match.matched !== null) {
    findFragments(match.matched);
  }
  return fragments;
}
const { hasOwnProperty: hasOwnProperty$1 } = Object.prototype;
function isValidNumber(value2) {
  return typeof value2 === "number" && isFinite(value2) && Math.floor(value2) === value2 && value2 >= 0;
}
function isValidLocation(loc) {
  return Boolean(loc) && isValidNumber(loc.offset) && isValidNumber(loc.line) && isValidNumber(loc.column);
}
function createNodeStructureChecker(type, fields) {
  return function checkNode(node2, warn) {
    if (!node2 || node2.constructor !== Object) {
      return warn(node2, "Type of node should be an Object");
    }
    for (let key in node2) {
      let valid = true;
      if (hasOwnProperty$1.call(node2, key) === false) {
        continue;
      }
      if (key === "type") {
        if (node2.type !== type) {
          warn(node2, "Wrong node type `" + node2.type + "`, expected `" + type + "`");
        }
      } else if (key === "loc") {
        if (node2.loc === null) {
          continue;
        } else if (node2.loc && node2.loc.constructor === Object) {
          if (typeof node2.loc.source !== "string") {
            key += ".source";
          } else if (!isValidLocation(node2.loc.start)) {
            key += ".start";
          } else if (!isValidLocation(node2.loc.end)) {
            key += ".end";
          } else {
            continue;
          }
        }
        valid = false;
      } else if (fields.hasOwnProperty(key)) {
        valid = false;
        for (let i = 0; !valid && i < fields[key].length; i++) {
          const fieldType = fields[key][i];
          switch (fieldType) {
            case String:
              valid = typeof node2[key] === "string";
              break;
            case Boolean:
              valid = typeof node2[key] === "boolean";
              break;
            case null:
              valid = node2[key] === null;
              break;
            default:
              if (typeof fieldType === "string") {
                valid = node2[key] && node2[key].type === fieldType;
              } else if (Array.isArray(fieldType)) {
                valid = node2[key] instanceof List;
              }
          }
        }
      } else {
        warn(node2, "Unknown field `" + key + "` for " + type + " node type");
      }
      if (!valid) {
        warn(node2, "Bad value for `" + type + "." + key + "`");
      }
    }
    for (const key in fields) {
      if (hasOwnProperty$1.call(fields, key) && hasOwnProperty$1.call(node2, key) === false) {
        warn(node2, "Field `" + type + "." + key + "` is missed");
      }
    }
  };
}
function genTypesList(fieldTypes, path) {
  const docsTypes = [];
  for (let i = 0; i < fieldTypes.length; i++) {
    const fieldType = fieldTypes[i];
    if (fieldType === String || fieldType === Boolean) {
      docsTypes.push(fieldType.name.toLowerCase());
    } else if (fieldType === null) {
      docsTypes.push("null");
    } else if (typeof fieldType === "string") {
      docsTypes.push(fieldType);
    } else if (Array.isArray(fieldType)) {
      docsTypes.push("List<" + (genTypesList(fieldType, path) || "any") + ">");
    } else {
      throw new Error("Wrong value `" + fieldType + "` in `" + path + "` structure definition");
    }
  }
  return docsTypes.join(" | ");
}
function processStructure(name2, nodeType) {
  const structure2 = nodeType.structure;
  const fields = {
    type: String,
    loc: true
  };
  const docs = {
    type: '"' + name2 + '"'
  };
  for (const key in structure2) {
    if (hasOwnProperty$1.call(structure2, key) === false) {
      continue;
    }
    const fieldTypes = fields[key] = Array.isArray(structure2[key]) ? structure2[key].slice() : [structure2[key]];
    docs[key] = genTypesList(fieldTypes, name2 + "." + key);
  }
  return {
    docs,
    check: createNodeStructureChecker(name2, fields)
  };
}
function getStructureFromConfig(config) {
  const structure2 = {};
  if (config.node) {
    for (const name2 in config.node) {
      if (hasOwnProperty$1.call(config.node, name2)) {
        const nodeType = config.node[name2];
        if (nodeType.structure) {
          structure2[name2] = processStructure(name2, nodeType);
        } else {
          throw new Error("Missed `structure` field in `" + name2 + "` node type definition");
        }
      }
    }
  }
  return structure2;
}
function dumpMapSyntax(map, compact, syntaxAsAst) {
  const result = {};
  for (const name2 in map) {
    if (map[name2].syntax) {
      result[name2] = syntaxAsAst ? map[name2].syntax : generate$O(map[name2].syntax, { compact });
    }
  }
  return result;
}
function dumpAtruleMapSyntax(map, compact, syntaxAsAst) {
  const result = {};
  for (const [name2, atrule2] of Object.entries(map)) {
    result[name2] = {
      prelude: atrule2.prelude && (syntaxAsAst ? atrule2.prelude.syntax : generate$O(atrule2.prelude.syntax, { compact })),
      descriptors: atrule2.descriptors && dumpMapSyntax(atrule2.descriptors, compact, syntaxAsAst)
    };
  }
  return result;
}
function valueHasVar(tokens) {
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].value.toLowerCase() === "var(") {
      return true;
    }
  }
  return false;
}
function syntaxHasTopLevelCommaMultiplier(syntax2) {
  const singleTerm = syntax2.terms[0];
  return syntax2.explicit === false && syntax2.terms.length === 1 && singleTerm.type === "Multiplier" && singleTerm.comma === true;
}
function buildMatchResult(matched, error, iterations) {
  return {
    matched,
    iterations,
    error,
    ...trace
  };
}
function matchSyntax(lexer2, syntax2, value2, useCssWideKeywords) {
  const tokens = prepareTokens(value2, lexer2.syntax);
  let result;
  if (valueHasVar(tokens)) {
    return buildMatchResult(null, new Error("Matching for a tree with var() is not supported"));
  }
  if (useCssWideKeywords) {
    result = matchAsTree(tokens, lexer2.cssWideKeywordsSyntax, lexer2);
  }
  if (!useCssWideKeywords || !result.match) {
    result = matchAsTree(tokens, syntax2.match, lexer2);
    if (!result.match) {
      return buildMatchResult(
        null,
        new SyntaxMatchError(result.reason, syntax2.syntax, value2, result),
        result.iterations
      );
    }
  }
  return buildMatchResult(result.match, null, result.iterations);
}
class Lexer {
  constructor(config, syntax2, structure2) {
    this.cssWideKeywords = cssWideKeywords;
    this.syntax = syntax2;
    this.generic = false;
    this.units = { ...units };
    this.atrules = /* @__PURE__ */ Object.create(null);
    this.properties = /* @__PURE__ */ Object.create(null);
    this.types = /* @__PURE__ */ Object.create(null);
    this.structure = structure2 || getStructureFromConfig(config);
    if (config) {
      if (config.cssWideKeywords) {
        this.cssWideKeywords = config.cssWideKeywords;
      }
      if (config.units) {
        for (const group of Object.keys(units)) {
          if (Array.isArray(config.units[group])) {
            this.units[group] = config.units[group];
          }
        }
      }
      if (config.types) {
        for (const [name2, type] of Object.entries(config.types)) {
          this.addType_(name2, type);
        }
      }
      if (config.generic) {
        this.generic = true;
        for (const [name2, value2] of Object.entries(createGenericTypes(this.units))) {
          this.addType_(name2, value2);
        }
      }
      if (config.atrules) {
        for (const [name2, atrule2] of Object.entries(config.atrules)) {
          this.addAtrule_(name2, atrule2);
        }
      }
      if (config.properties) {
        for (const [name2, property2] of Object.entries(config.properties)) {
          this.addProperty_(name2, property2);
        }
      }
    }
    this.cssWideKeywordsSyntax = buildMatchGraph(this.cssWideKeywords.join(" |  "));
  }
  checkStructure(ast) {
    function collectWarning(node2, message) {
      warns.push({ node: node2, message });
    }
    const structure2 = this.structure;
    const warns = [];
    this.syntax.walk(ast, function(node2) {
      if (structure2.hasOwnProperty(node2.type)) {
        structure2[node2.type].check(node2, collectWarning);
      } else {
        collectWarning(node2, "Unknown node type `" + node2.type + "`");
      }
    });
    return warns.length ? warns : false;
  }
  createDescriptor(syntax2, type, name2, parent = null) {
    const ref = {
      type,
      name: name2
    };
    const descriptor = {
      type,
      name: name2,
      parent,
      serializable: typeof syntax2 === "string" || syntax2 && typeof syntax2.type === "string",
      syntax: null,
      match: null,
      matchRef: null
      // used for properties when a syntax referenced as <'property'> in other syntax definitions
    };
    if (typeof syntax2 === "function") {
      descriptor.match = buildMatchGraph(syntax2, ref);
    } else {
      if (typeof syntax2 === "string") {
        Object.defineProperty(descriptor, "syntax", {
          get() {
            Object.defineProperty(descriptor, "syntax", {
              value: parse$O(syntax2)
            });
            return descriptor.syntax;
          }
        });
      } else {
        descriptor.syntax = syntax2;
      }
      Object.defineProperty(descriptor, "match", {
        get() {
          Object.defineProperty(descriptor, "match", {
            value: buildMatchGraph(descriptor.syntax, ref)
          });
          return descriptor.match;
        }
      });
      if (type === "Property") {
        Object.defineProperty(descriptor, "matchRef", {
          get() {
            const syntax3 = descriptor.syntax;
            const value2 = syntaxHasTopLevelCommaMultiplier(syntax3) ? buildMatchGraph({
              ...syntax3,
              terms: [syntax3.terms[0].term]
            }, ref) : null;
            Object.defineProperty(descriptor, "matchRef", {
              value: value2
            });
            return value2;
          }
        });
      }
    }
    return descriptor;
  }
  addAtrule_(name2, syntax2) {
    if (!syntax2) {
      return;
    }
    this.atrules[name2] = {
      type: "Atrule",
      name: name2,
      prelude: syntax2.prelude ? this.createDescriptor(syntax2.prelude, "AtrulePrelude", name2) : null,
      descriptors: syntax2.descriptors ? Object.keys(syntax2.descriptors).reduce(
        (map, descName) => {
          map[descName] = this.createDescriptor(syntax2.descriptors[descName], "AtruleDescriptor", descName, name2);
          return map;
        },
        /* @__PURE__ */ Object.create(null)
      ) : null
    };
  }
  addProperty_(name2, syntax2) {
    if (!syntax2) {
      return;
    }
    this.properties[name2] = this.createDescriptor(syntax2, "Property", name2);
  }
  addType_(name2, syntax2) {
    if (!syntax2) {
      return;
    }
    this.types[name2] = this.createDescriptor(syntax2, "Type", name2);
  }
  checkAtruleName(atruleName) {
    if (!this.getAtrule(atruleName)) {
      return new SyntaxReferenceError("Unknown at-rule", "@" + atruleName);
    }
  }
  checkAtrulePrelude(atruleName, prelude) {
    const error = this.checkAtruleName(atruleName);
    if (error) {
      return error;
    }
    const atrule2 = this.getAtrule(atruleName);
    if (!atrule2.prelude && prelude) {
      return new SyntaxError("At-rule `@" + atruleName + "` should not contain a prelude");
    }
    if (atrule2.prelude && !prelude) {
      if (!matchSyntax(this, atrule2.prelude, "", false).matched) {
        return new SyntaxError("At-rule `@" + atruleName + "` should contain a prelude");
      }
    }
  }
  checkAtruleDescriptorName(atruleName, descriptorName) {
    const error = this.checkAtruleName(atruleName);
    if (error) {
      return error;
    }
    const atrule2 = this.getAtrule(atruleName);
    const descriptor = keyword(descriptorName);
    if (!atrule2.descriptors) {
      return new SyntaxError("At-rule `@" + atruleName + "` has no known descriptors");
    }
    if (!atrule2.descriptors[descriptor.name] && !atrule2.descriptors[descriptor.basename]) {
      return new SyntaxReferenceError("Unknown at-rule descriptor", descriptorName);
    }
  }
  checkPropertyName(propertyName) {
    if (!this.getProperty(propertyName)) {
      return new SyntaxReferenceError("Unknown property", propertyName);
    }
  }
  matchAtrulePrelude(atruleName, prelude) {
    const error = this.checkAtrulePrelude(atruleName, prelude);
    if (error) {
      return buildMatchResult(null, error);
    }
    const atrule2 = this.getAtrule(atruleName);
    if (!atrule2.prelude) {
      return buildMatchResult(null, null);
    }
    return matchSyntax(this, atrule2.prelude, prelude || "", false);
  }
  matchAtruleDescriptor(atruleName, descriptorName, value2) {
    const error = this.checkAtruleDescriptorName(atruleName, descriptorName);
    if (error) {
      return buildMatchResult(null, error);
    }
    const atrule2 = this.getAtrule(atruleName);
    const descriptor = keyword(descriptorName);
    return matchSyntax(this, atrule2.descriptors[descriptor.name] || atrule2.descriptors[descriptor.basename], value2, false);
  }
  matchDeclaration(node2) {
    if (node2.type !== "Declaration") {
      return buildMatchResult(null, new Error("Not a Declaration node"));
    }
    return this.matchProperty(node2.property, node2.value);
  }
  matchProperty(propertyName, value2) {
    if (property(propertyName).custom) {
      return buildMatchResult(null, new Error("Lexer matching doesn't applicable for custom properties"));
    }
    const error = this.checkPropertyName(propertyName);
    if (error) {
      return buildMatchResult(null, error);
    }
    return matchSyntax(this, this.getProperty(propertyName), value2, true);
  }
  matchType(typeName, value2) {
    const typeSyntax = this.getType(typeName);
    if (!typeSyntax) {
      return buildMatchResult(null, new SyntaxReferenceError("Unknown type", typeName));
    }
    return matchSyntax(this, typeSyntax, value2, false);
  }
  match(syntax2, value2) {
    if (typeof syntax2 !== "string" && (!syntax2 || !syntax2.type)) {
      return buildMatchResult(null, new SyntaxReferenceError("Bad syntax"));
    }
    if (typeof syntax2 === "string" || !syntax2.match) {
      syntax2 = this.createDescriptor(syntax2, "Type", "anonymous");
    }
    return matchSyntax(this, syntax2, value2, false);
  }
  findValueFragments(propertyName, value2, type, name2) {
    return matchFragments(this, value2, this.matchProperty(propertyName, value2), type, name2);
  }
  findDeclarationValueFragments(declaration, type, name2) {
    return matchFragments(this, declaration.value, this.matchDeclaration(declaration), type, name2);
  }
  findAllFragments(ast, type, name2) {
    const result = [];
    this.syntax.walk(ast, {
      visit: "Declaration",
      enter: (declaration) => {
        result.push.apply(result, this.findDeclarationValueFragments(declaration, type, name2));
      }
    });
    return result;
  }
  getAtrule(atruleName, fallbackBasename = true) {
    const atrule2 = keyword(atruleName);
    const atruleEntry = atrule2.vendor && fallbackBasename ? this.atrules[atrule2.name] || this.atrules[atrule2.basename] : this.atrules[atrule2.name];
    return atruleEntry || null;
  }
  getAtrulePrelude(atruleName, fallbackBasename = true) {
    const atrule2 = this.getAtrule(atruleName, fallbackBasename);
    return atrule2 && atrule2.prelude || null;
  }
  getAtruleDescriptor(atruleName, name2) {
    return this.atrules.hasOwnProperty(atruleName) && this.atrules.declarators ? this.atrules[atruleName].declarators[name2] || null : null;
  }
  getProperty(propertyName, fallbackBasename = true) {
    const property$1 = property(propertyName);
    const propertyEntry = property$1.vendor && fallbackBasename ? this.properties[property$1.name] || this.properties[property$1.basename] : this.properties[property$1.name];
    return propertyEntry || null;
  }
  getType(name2) {
    return hasOwnProperty.call(this.types, name2) ? this.types[name2] : null;
  }
  validate() {
    function syntaxRef(name2, isType2) {
      return isType2 ? `<${name2}>` : `<'${name2}'>`;
    }
    function validate(syntax2, name2, broken, descriptor) {
      if (broken.has(name2)) {
        return broken.get(name2);
      }
      broken.set(name2, false);
      if (descriptor.syntax !== null) {
        walk$1(descriptor.syntax, function(node2) {
          if (node2.type !== "Type" && node2.type !== "Property") {
            return;
          }
          const map = node2.type === "Type" ? syntax2.types : syntax2.properties;
          const brokenMap = node2.type === "Type" ? brokenTypes : brokenProperties;
          if (!hasOwnProperty.call(map, node2.name)) {
            errors2.push(`${syntaxRef(name2, broken === brokenTypes)} used missed syntax definition ${syntaxRef(node2.name, node2.type === "Type")}`);
            broken.set(name2, true);
          } else if (validate(syntax2, node2.name, brokenMap, map[node2.name])) {
            errors2.push(`${syntaxRef(name2, broken === brokenTypes)} used broken syntax definition ${syntaxRef(node2.name, node2.type === "Type")}`);
            broken.set(name2, true);
          }
        }, this);
      }
    }
    const errors2 = [];
    let brokenTypes = /* @__PURE__ */ new Map();
    let brokenProperties = /* @__PURE__ */ new Map();
    for (const key in this.types) {
      validate(this, key, brokenTypes, this.types[key]);
    }
    for (const key in this.properties) {
      validate(this, key, brokenProperties, this.properties[key]);
    }
    const brokenTypesArray = [...brokenTypes.keys()].filter((name2) => brokenTypes.get(name2));
    const brokenPropertiesArray = [...brokenProperties.keys()].filter((name2) => brokenProperties.get(name2));
    if (brokenTypesArray.length || brokenPropertiesArray.length) {
      return {
        errors: errors2,
        types: brokenTypesArray,
        properties: brokenPropertiesArray
      };
    }
    return null;
  }
  dump(syntaxAsAst, pretty) {
    return {
      generic: this.generic,
      cssWideKeywords: this.cssWideKeywords,
      units: this.units,
      types: dumpMapSyntax(this.types, !pretty, syntaxAsAst),
      properties: dumpMapSyntax(this.properties, !pretty, syntaxAsAst),
      atrules: dumpAtruleMapSyntax(this.atrules, !pretty, syntaxAsAst)
    };
  }
  toString() {
    return JSON.stringify(this.dump());
  }
}
function appendOrSet(a, b) {
  if (typeof b === "string" && /^\s*\|/.test(b)) {
    return typeof a === "string" ? a + b : b.replace(/^\s*\|\s*/, "");
  }
  return b || null;
}
function extractProps(obj, props) {
  const result = /* @__PURE__ */ Object.create(null);
  for (const prop of Object.keys(obj)) {
    if (props.includes(prop)) {
      result[prop] = obj[prop];
    }
  }
  return result;
}
function mergeDicts(base, ext, fields) {
  const result = { ...base };
  for (const [key, props] of Object.entries(ext)) {
    result[key] = {
      ...result[key],
      ...fields ? extractProps(props, fields) : props
    };
  }
  return result;
}
function mix(dest, src) {
  const result = { ...dest };
  for (const [prop, value2] of Object.entries(src)) {
    switch (prop) {
      case "generic":
        result[prop] = Boolean(value2);
        break;
      case "cssWideKeywords":
        result[prop] = dest[prop] ? [...dest[prop], ...value2] : value2 || [];
        break;
      case "units":
        result[prop] = { ...dest[prop] };
        for (const [name2, patch] of Object.entries(value2)) {
          result[prop][name2] = Array.isArray(patch) ? patch : [];
        }
        break;
      case "atrules":
        result[prop] = { ...dest[prop] };
        for (const [name2, atrule2] of Object.entries(value2)) {
          const exists = result[prop][name2] || {};
          const current = result[prop][name2] = {
            prelude: exists.prelude || null,
            descriptors: {
              ...exists.descriptors
            }
          };
          if (!atrule2) {
            continue;
          }
          current.prelude = atrule2.prelude ? appendOrSet(current.prelude, atrule2.prelude) : current.prelude || null;
          for (const [descriptorName, descriptorValue] of Object.entries(atrule2.descriptors || {})) {
            current.descriptors[descriptorName] = descriptorValue ? appendOrSet(current.descriptors[descriptorName], descriptorValue) : null;
          }
          if (!Object.keys(current.descriptors).length) {
            current.descriptors = null;
          }
        }
        break;
      case "types":
      case "properties":
        result[prop] = { ...dest[prop] };
        for (const [name2, syntax2] of Object.entries(value2)) {
          result[prop][name2] = appendOrSet(result[prop][name2], syntax2);
        }
        break;
      case "parseContext":
        result[prop] = {
          ...dest[prop],
          ...value2
        };
        break;
      case "scope":
      case "features":
        result[prop] = mergeDicts(dest[prop], value2);
        break;
      case "atrule":
      case "pseudo":
        result[prop] = mergeDicts(dest[prop], value2, ["parse"]);
        break;
      case "node":
        result[prop] = mergeDicts(dest[prop], value2, ["name", "structure", "parse", "generate", "walkContext"]);
        break;
    }
  }
  return result;
}
function createSyntax(config) {
  const parse2 = createParser(config);
  const walk2 = createWalker(config);
  const generate2 = createGenerator(config);
  const { fromPlainObject: fromPlainObject2, toPlainObject: toPlainObject2 } = createConvertor(walk2);
  const syntax2 = {
    lexer: null,
    createLexer: (config2) => new Lexer(config2, syntax2, syntax2.lexer.structure),
    tokenize: tokenize$1,
    parse: parse2,
    generate: generate2,
    walk: walk2,
    find: walk2.find,
    findLast: walk2.findLast,
    findAll: walk2.findAll,
    fromPlainObject: fromPlainObject2,
    toPlainObject: toPlainObject2,
    fork(extension) {
      const base = mix({}, config);
      return createSyntax(
        typeof extension === "function" ? extension(base) : mix(base, extension)
      );
    }
  };
  syntax2.lexer = new Lexer({
    generic: config.generic,
    cssWideKeywords: config.cssWideKeywords,
    units: config.units,
    types: config.types,
    atrules: config.atrules,
    properties: config.properties,
    node: config.node
  }, syntax2);
  return syntax2;
}
const createSyntax$1 = (config) => createSyntax(mix({}, config));
const definitions = {
  "generic": true,
  "cssWideKeywords": [
    "initial",
    "inherit",
    "unset",
    "revert",
    "revert-layer"
  ],
  "units": {
    "angle": [
      "deg",
      "grad",
      "rad",
      "turn"
    ],
    "decibel": [
      "db"
    ],
    "flex": [
      "fr"
    ],
    "frequency": [
      "hz",
      "khz"
    ],
    "length": [
      "cm",
      "mm",
      "q",
      "in",
      "pt",
      "pc",
      "px",
      "em",
      "rem",
      "ex",
      "rex",
      "cap",
      "rcap",
      "ch",
      "rch",
      "ic",
      "ric",
      "lh",
      "rlh",
      "vw",
      "svw",
      "lvw",
      "dvw",
      "vh",
      "svh",
      "lvh",
      "dvh",
      "vi",
      "svi",
      "lvi",
      "dvi",
      "vb",
      "svb",
      "lvb",
      "dvb",
      "vmin",
      "svmin",
      "lvmin",
      "dvmin",
      "vmax",
      "svmax",
      "lvmax",
      "dvmax",
      "cqw",
      "cqh",
      "cqi",
      "cqb",
      "cqmin",
      "cqmax"
    ],
    "resolution": [
      "dpi",
      "dpcm",
      "dppx",
      "x"
    ],
    "semitones": [
      "st"
    ],
    "time": [
      "s",
      "ms"
    ]
  },
  "types": {
    "abs()": "abs( <calc-sum> )",
    "absolute-size": "xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large",
    "acos()": "acos( <calc-sum> )",
    "alpha-value": "<number>|<percentage>",
    "an+b": "odd|even|<integer>|<n-dimension>|'+'? † n|-n|<ndashdigit-dimension>|'+'? † <ndashdigit-ident>|<dashndashdigit-ident>|<n-dimension> <signed-integer>|'+'? † n <signed-integer>|-n <signed-integer>|<ndash-dimension> <signless-integer>|'+'? † n- <signless-integer>|-n- <signless-integer>|<n-dimension> ['+'|'-'] <signless-integer>|'+'? † n ['+'|'-'] <signless-integer>|-n ['+'|'-'] <signless-integer>",
    "anchor()": "anchor( <anchor-name>?&&<anchor-side> , <length-percentage>? )",
    "anchor-name": "<dashed-ident>",
    "anchor-side": "inside|outside|top|left|right|bottom|start|end|self-start|self-end|<percentage>|center",
    "anchor-size": "width|height|block|inline|self-block|self-inline",
    "anchor-size()": "anchor-size( [<anchor-name>||<anchor-size>]? , <length-percentage>? )",
    "angle-percentage": "<angle>|<percentage>",
    "angular-color-hint": "<angle-percentage>|<zero>",
    "angular-color-stop": "<color> <color-stop-angle>?",
    "angular-color-stop-list": "<angular-color-stop> , [<angular-color-hint>? , <angular-color-stop>]#?",
    "animateable-feature": "scroll-position|contents|<custom-ident>",
    "animation-action": "none|play|play-once|play-forwards|play-backwards|pause|reset|replay",
    "asin()": "asin( <calc-sum> )",
    "atan()": "atan( <calc-sum> )",
    "atan2()": "atan2( <calc-sum> , <calc-sum> )",
    "attachment": "scroll|fixed|local",
    "attr()": "attr( <attr-name> <attr-type>? , <declaration-value>? )",
    "attr-matcher": "['~'|'|'|'^'|'$'|'*']? '='",
    "attr-modifier": "i|s",
    "attr-type": "type( <syntax> )|raw-string|number|<attr-unit>",
    "attribute-selector": "'[' <wq-name> ']'|'[' <wq-name> <attr-matcher> [<string-token>|<ident-token>] <attr-modifier>? ']'",
    "auto-repeat": "repeat( [auto-fill|auto-fit] , [<line-names>? <fixed-size>]+ <line-names>? )",
    "auto-track-list": "[<line-names>? [<fixed-size>|<fixed-repeat>]]* <line-names>? <auto-repeat> [<line-names>? [<fixed-size>|<fixed-repeat>]]* <line-names>?",
    "axis": "block|inline|x|y",
    "baseline-position": "[first|last]? baseline",
    "basic-shape": "<inset()>|<xywh()>|<rect()>|<circle()>|<ellipse()>|<polygon()>|<path()>",
    "basic-shape-rect": "<inset()>|<rect()>|<xywh()>",
    "bg-clip": "<visual-box>|border-area|text",
    "bg-image": "<image>|none",
    "bg-layer": "<bg-image>||<bg-position> [/ <bg-size>]?||<repeat-style>||<attachment>||<visual-box>||<visual-box>",
    "bg-position": "[[left|center|right|top|bottom|<length-percentage>]|[left|center|right|<length-percentage>] [top|center|bottom|<length-percentage>]|[center|[left|right] <length-percentage>?]&&[center|[top|bottom] <length-percentage>?]]",
    "bg-size": "[<length-percentage [0,∞]>|auto]{1,2}|cover|contain",
    "blend-mode": "normal|multiply|screen|overlay|darken|lighten|color-dodge|color-burn|hard-light|soft-light|difference|exclusion|hue|saturation|color|luminosity",
    "blur()": "blur( <length>? )",
    "brightness()": "brightness( [<number>|<percentage>]? )",
    "calc()": "calc( <calc-sum> )",
    "calc-constant": "e|pi|infinity|-infinity|NaN",
    "calc-product": "<calc-value> ['*' <calc-value>|'/' <number>]*",
    "calc-size()": "calc-size( <calc-size-basis> , <calc-sum> )",
    "calc-size-basis": "<intrinsic-size-keyword>|<calc-size()>|any|<calc-sum>",
    "calc-sum": "<calc-product> [['+'|'-'] <calc-product>]*",
    "calc-value": "<number>|<dimension>|<percentage>|<calc-constant>|( <calc-sum> )",
    "cf-final-image": "<image>|<color>",
    "cf-mixing-image": "<percentage>?&&<image>",
    "circle()": "circle( <radial-size>? [at <position>]? )",
    "clamp()": "clamp( <calc-sum>#{3} )",
    "class-selector": "'.' <ident-token>",
    "clip-source": "<url>",
    "color": "<color-base>|currentColor|<system-color>|<device-cmyk()>|<light-dark()>|<-non-standard-color>",
    "color()": "color( <colorspace-params> [/ [<alpha-value>|none]]? )",
    "color-base": "<hex-color>|<color-function>|<named-color>|<color-mix()>|transparent",
    "color-function": "<rgb()>|<rgba()>|<hsl()>|<hsla()>|<hwb()>|<lab()>|<lch()>|<oklab()>|<oklch()>|<color()>",
    "color-interpolation-method": "in [<rectangular-color-space>|<polar-color-space> <hue-interpolation-method>?|<custom-color-space>]",
    "color-mix()": "color-mix( <color-interpolation-method> , [<color>&&<percentage [0,100]>?]#{2} )",
    "color-stop": "<color-stop-length>|<color-stop-angle>",
    "color-stop-angle": "[<angle-percentage>|<zero>]{1,2}",
    "color-stop-length": "<length-percentage>{1,2}",
    "color-stop-list": "<linear-color-stop> , [<linear-color-hint>? , <linear-color-stop>]#?",
    "colorspace-params": "[<predefined-rgb-params>|<xyz-params>]",
    "combinator": "'>'|'+'|'~'|['|' '|']",
    "common-lig-values": "[common-ligatures|no-common-ligatures]",
    "compat-auto": "searchfield|textarea|checkbox|radio|menulist|listbox|meter|progress-bar|button",
    "compat-special": "textfield|menulist-button",
    "complex-selector": "<complex-selector-unit> [<combinator>? <complex-selector-unit>]*",
    "complex-selector-list": "<complex-selector>#",
    "composite-style": "clear|copy|source-over|source-in|source-out|source-atop|destination-over|destination-in|destination-out|destination-atop|xor",
    "compositing-operator": "add|subtract|intersect|exclude",
    "compound-selector": "[<type-selector>? <subclass-selector>*]!",
    "compound-selector-list": "<compound-selector>#",
    "conic-gradient()": "conic-gradient( [<conic-gradient-syntax>] )",
    "conic-gradient-syntax": "[[[from [<angle>|<zero>]]? [at <position>]?]||<color-interpolation-method>]? , <angular-color-stop-list>",
    "container-condition": "not <query-in-parens>|<query-in-parens> [[and <query-in-parens>]*|[or <query-in-parens>]*]",
    "container-name": "<custom-ident>",
    "container-query": "not <query-in-parens>|<query-in-parens> [[and <query-in-parens>]*|[or <query-in-parens>]*]",
    "content-distribution": "space-between|space-around|space-evenly|stretch",
    "content-list": "[<string>|contents|<image>|<counter>|<quote>|<target>|<leader()>|<attr()>]+",
    "content-position": "center|start|end|flex-start|flex-end",
    "content-replacement": "<image>",
    "contextual-alt-values": "[contextual|no-contextual]",
    "contrast()": "contrast( [<number>|<percentage>]? )",
    "coord-box": "content-box|padding-box|border-box|fill-box|stroke-box|view-box",
    "corner-shape-value": "round|scoop|bevel|notch|square|squircle|<superellipse()>",
    "cos()": "cos( <calc-sum> )",
    "counter": "<counter()>|<counters()>",
    "counter()": "counter( <counter-name> , <counter-style>? )",
    "counter-name": "<custom-ident>",
    "counter-style": "<counter-style-name>|symbols( )",
    "counter-style-name": "<custom-ident>",
    "counters()": "counters( <counter-name> , <string> , <counter-style>? )",
    "cross-fade()": "cross-fade( <cf-mixing-image> , <cf-final-image>? )",
    "cubic-bezier()": "cubic-bezier( [<number [0,1]> , <number>]#{2} )",
    "cubic-bezier-easing-function": "ease|ease-in|ease-out|ease-in-out|cubic-bezier( <number [0,1]> , <number> , <number [0,1]> , <number> )",
    "cursor-predefined": "auto|default|none|context-menu|help|pointer|progress|wait|cell|crosshair|text|vertical-text|alias|copy|move|no-drop|not-allowed|e-resize|n-resize|ne-resize|nw-resize|s-resize|se-resize|sw-resize|w-resize|ew-resize|ns-resize|nesw-resize|nwse-resize|col-resize|row-resize|all-scroll|zoom-in|zoom-out|grab|grabbing",
    "custom-color-space": "<dashed-ident>",
    "custom-params": "<dashed-ident> [<number>|<percentage>|none]+",
    "dasharray": "[[<length-percentage>|<number>]+]#",
    "dashndashdigit-ident": "<ident-token>",
    "deprecated-system-color": "ActiveBorder|ActiveCaption|AppWorkspace|Background|ButtonHighlight|ButtonShadow|CaptionText|InactiveBorder|InactiveCaption|InactiveCaptionText|InfoBackground|InfoText|Menu|MenuText|Scrollbar|ThreeDDarkShadow|ThreeDFace|ThreeDHighlight|ThreeDLightShadow|ThreeDShadow|Window|WindowFrame|WindowText",
    "discretionary-lig-values": "[discretionary-ligatures|no-discretionary-ligatures]",
    "display-box": "contents|none",
    "display-inside": "flow|flow-root|table|flex|grid|ruby",
    "display-internal": "table-row-group|table-header-group|table-footer-group|table-row|table-cell|table-column-group|table-column|table-caption|ruby-base|ruby-text|ruby-base-container|ruby-text-container",
    "display-legacy": "inline-block|inline-list-item|inline-table|inline-flex|inline-grid",
    "display-listitem": "<display-outside>?&&[flow|flow-root]?&&list-item",
    "display-outside": "block|inline|run-in",
    "drop-shadow()": "drop-shadow( [<color>?&&<length>{2,3}] )",
    "dynamic-range-limit-mix()": "dynamic-range-limit-mix( [<'dynamic-range-limit'>&&<percentage [0,100]>]#{2,} )",
    "easing-function": "<linear-easing-function>|<cubic-bezier-easing-function>|<step-easing-function>",
    "east-asian-variant-values": "[jis78|jis83|jis90|jis04|simplified|traditional]",
    "east-asian-width-values": "[full-width|proportional-width]",
    "element()": "element( <custom-ident> , [first|start|last|first-except]? )|element( <id-selector> )",
    "ellipse()": "ellipse( <radial-size>? [at <position>]? )",
    "env()": "env( <custom-ident> , <declaration-value>? )",
    "exp()": "exp( <calc-sum> )",
    "explicit-track-list": "[<line-names>? <track-size>]+ <line-names>?",
    "family-name": "<string>|<custom-ident>+",
    "feature-tag-value": "<string> [<integer>|on|off]?",
    "feature-type": "@stylistic|@historical-forms|@styleset|@character-variant|@swash|@ornaments|@annotation",
    "feature-value-block": "<feature-type> '{' <feature-value-declaration-list> '}'",
    "feature-value-block-list": "<feature-value-block>+",
    "feature-value-declaration": "<custom-ident> : <integer>+ ;",
    "feature-value-declaration-list": "<feature-value-declaration>",
    "feature-value-name": "<custom-ident>",
    "filter-function": "<blur()>|<brightness()>|<contrast()>|<drop-shadow()>|<grayscale()>|<hue-rotate()>|<invert()>|<opacity()>|<saturate()>|<sepia()>",
    "filter-value-list": "[<filter-function>|<url>]+",
    "final-bg-layer": "<bg-image>||<bg-position> [/ <bg-size>]?||<repeat-style>||<attachment>||<visual-box>||<visual-box>||<'background-color'>",
    "fit-content()": "fit-content( <length-percentage [0,∞]> )",
    "fixed-breadth": "<length-percentage>",
    "fixed-repeat": "repeat( [<integer [1,∞]>] , [<line-names>? <fixed-size>]+ <line-names>? )",
    "fixed-size": "<fixed-breadth>|minmax( <fixed-breadth> , <track-breadth> )|minmax( <inflexible-breadth> , <fixed-breadth> )",
    "font-stretch-absolute": "normal|ultra-condensed|extra-condensed|condensed|semi-condensed|semi-expanded|expanded|extra-expanded|ultra-expanded|<percentage>",
    "font-variant-css2": "normal|small-caps",
    "font-weight-absolute": "normal|bold|<number [1,1000]>",
    "font-width-css3": "normal|ultra-condensed|extra-condensed|condensed|semi-condensed|semi-expanded|expanded|extra-expanded|ultra-expanded",
    "form-control-identifier": "select",
    "frequency-percentage": "<frequency>|<percentage>",
    "generic-complete": "serif|sans-serif|system-ui|cursive|fantasy|math|monospace",
    "general-enclosed": "[<function-token> <any-value>? )]|[( <any-value>? )]",
    "generic-family": "<generic-script-specific>|<generic-complete>|<generic-incomplete>|<-non-standard-generic-family>",
    "generic-incomplete": "ui-serif|ui-sans-serif|ui-monospace|ui-rounded",
    "geometry-box": "<shape-box>|fill-box|stroke-box|view-box",
    "gradient": "<linear-gradient()>|<repeating-linear-gradient()>|<radial-gradient()>|<repeating-radial-gradient()>|<conic-gradient()>|<repeating-conic-gradient()>|<-legacy-gradient>",
    "grayscale()": "grayscale( [<number>|<percentage>]? )",
    "grid-line": "auto|<custom-ident>|[<integer>&&<custom-ident>?]|[span&&[<integer>||<custom-ident>]]",
    "historical-lig-values": "[historical-ligatures|no-historical-ligatures]",
    "hsl()": "hsl( <hue> , <percentage> , <percentage> , <alpha-value>? )|hsl( [<hue>|none] [<percentage>|<number>|none] [<percentage>|<number>|none] [/ [<alpha-value>|none]]? )",
    "hsla()": "hsla( <hue> , <percentage> , <percentage> , <alpha-value>? )|hsla( [<hue>|none] [<percentage>|<number>|none] [<percentage>|<number>|none] [/ [<alpha-value>|none]]? )",
    "hue": "<number>|<angle>",
    "hue-interpolation-method": "[shorter|longer|increasing|decreasing] hue",
    "hue-rotate()": "hue-rotate( [<angle>|<zero>]? )",
    "hwb()": "hwb( [<hue>|none] [<percentage>|<number>|none] [<percentage>|<number>|none] [/ [<alpha-value>|none]]? )",
    "hypot()": "hypot( <calc-sum># )",
    "image": "<url>|<image()>|<image-set()>|<element()>|<paint()>|<cross-fade()>|<gradient>",
    "image()": "image( <image-tags>? [<image-src>? , <color>?]! )",
    "image-set()": "image-set( <image-set-option># )",
    "image-set-option": "[<image>|<string>] [<resolution>||type( <string> )]",
    "image-src": "<url>|<string>",
    "image-tags": "ltr|rtl",
    "inflexible-breadth": "<length-percentage>|min-content|max-content|auto",
    "inset()": "inset( <length-percentage>{1,4} [round <'border-radius'>]? )",
    "invert()": "invert( [<number>|<percentage>]? )",
    "keyframe-block": "<keyframe-selector># { <declaration-list> }",
    "keyframe-selector": "from|to|<percentage [0,100]>|<timeline-range-name> <percentage>",
    "keyframes-name": "<custom-ident>|<string>",
    "lab()": "lab( [<percentage>|<number>|none] [<percentage>|<number>|none] [<percentage>|<number>|none] [/ [<alpha-value>|none]]? )",
    "layer()": "layer( <layer-name> )",
    "layer-name": "<ident> ['.' <ident>]*",
    "lch()": "lch( [<percentage>|<number>|none] [<percentage>|<number>|none] [<hue>|none] [/ [<alpha-value>|none]]? )",
    "leader()": "leader( <leader-type> )",
    "leader-type": "dotted|solid|space|<string>",
    "length-percentage": "<length>|<percentage>",
    "light-dark()": "light-dark( <color> , <color> )",
    "line-name-list": "[<line-names>|<name-repeat>]+",
    "line-names": "'[' <custom-ident>* ']'",
    "line-style": "none|hidden|dotted|dashed|solid|double|groove|ridge|inset|outset",
    "line-width": "<length>|thin|medium|thick",
    "linear()": "linear( [<number>&&<percentage>{0,2}]# )",
    "linear-color-hint": "<length-percentage>",
    "linear-color-stop": "<color> <color-stop-length>?",
    "linear-easing-function": "linear|<linear()>",
    "linear-gradient()": "linear-gradient( [<linear-gradient-syntax>] )",
    "linear-gradient-syntax": "[[<angle>|<zero>|to <side-or-corner>]||<color-interpolation-method>]? , <color-stop-list>",
    "log()": "log( <calc-sum> , <calc-sum>? )",
    "mask-layer": "<mask-reference>||<position> [/ <bg-size>]?||<repeat-style>||<geometry-box>||[<geometry-box>|no-clip]||<compositing-operator>||<masking-mode>",
    "mask-position": "[<length-percentage>|left|center|right] [<length-percentage>|top|center|bottom]?",
    "mask-reference": "none|<image>|<mask-source>",
    "mask-source": "<url>",
    "masking-mode": "alpha|luminance|match-source",
    "matrix()": "matrix( <number>#{6} )",
    "matrix3d()": "matrix3d( <number>#{16} )",
    "max()": "max( <calc-sum># )",
    "media-and": "<media-in-parens> [and <media-in-parens>]+",
    "media-condition": "<media-not>|<media-and>|<media-or>|<media-in-parens>",
    "media-condition-without-or": "<media-not>|<media-and>|<media-in-parens>",
    "media-feature": "( [<mf-plain>|<mf-boolean>|<mf-range>] )",
    "media-in-parens": "( <media-condition> )|<media-feature>|<general-enclosed>",
    "media-not": "not <media-in-parens>",
    "media-or": "<media-in-parens> [or <media-in-parens>]+",
    "media-query": "<media-condition>|[not|only]? <media-type> [and <media-condition-without-or>]?",
    "media-query-list": "<media-query>#",
    "media-type": "<ident>",
    "mf-boolean": "<mf-name>",
    "mf-name": "<ident>",
    "mf-plain": "<mf-name> : <mf-value>",
    "mf-range": "<mf-name> ['<'|'>']? '='? <mf-value>|<mf-value> ['<'|'>']? '='? <mf-name>|<mf-value> '<' '='? <mf-name> '<' '='? <mf-value>|<mf-value> '>' '='? <mf-name> '>' '='? <mf-value>",
    "mf-value": "<number>|<dimension>|<ident>|<ratio>",
    "min()": "min( <calc-sum># )",
    "minmax()": "minmax( [<length-percentage>|min-content|max-content|auto] , [<length-percentage>|<flex>|min-content|max-content|auto] )",
    "mod()": "mod( <calc-sum> , <calc-sum> )",
    "n-dimension": "<dimension-token>",
    "name-repeat": "repeat( [<integer [1,∞]>|auto-fill] , <line-names>+ )",
    "named-color": "aliceblue|antiquewhite|aqua|aquamarine|azure|beige|bisque|black|blanchedalmond|blue|blueviolet|brown|burlywood|cadetblue|chartreuse|chocolate|coral|cornflowerblue|cornsilk|crimson|cyan|darkblue|darkcyan|darkgoldenrod|darkgray|darkgreen|darkgrey|darkkhaki|darkmagenta|darkolivegreen|darkorange|darkorchid|darkred|darksalmon|darkseagreen|darkslateblue|darkslategray|darkslategrey|darkturquoise|darkviolet|deeppink|deepskyblue|dimgray|dimgrey|dodgerblue|firebrick|floralwhite|forestgreen|fuchsia|gainsboro|ghostwhite|gold|goldenrod|gray|green|greenyellow|grey|honeydew|hotpink|indianred|indigo|ivory|khaki|lavender|lavenderblush|lawngreen|lemonchiffon|lightblue|lightcoral|lightcyan|lightgoldenrodyellow|lightgray|lightgreen|lightgrey|lightpink|lightsalmon|lightseagreen|lightskyblue|lightslategray|lightslategrey|lightsteelblue|lightyellow|lime|limegreen|linen|magenta|maroon|mediumaquamarine|mediumblue|mediumorchid|mediumpurple|mediumseagreen|mediumslateblue|mediumspringgreen|mediumturquoise|mediumvioletred|midnightblue|mintcream|mistyrose|moccasin|navajowhite|navy|oldlace|olive|olivedrab|orange|orangered|orchid|palegoldenrod|palegreen|paleturquoise|palevioletred|papayawhip|peachpuff|peru|pink|plum|powderblue|purple|rebeccapurple|red|rosybrown|royalblue|saddlebrown|salmon|sandybrown|seagreen|seashell|sienna|silver|skyblue|slateblue|slategray|slategrey|snow|springgreen|steelblue|tan|teal|thistle|tomato|turquoise|violet|wheat|white|whitesmoke|yellow|yellowgreen",
    "namespace-prefix": "<ident>",
    "ndash-dimension": "<dimension-token>",
    "ndashdigit-dimension": "<dimension-token>",
    "ndashdigit-ident": "<ident-token>",
    "ns-prefix": "[<ident-token>|'*']? '|'",
    "number-percentage": "<number>|<percentage>",
    "numeric-figure-values": "[lining-nums|oldstyle-nums]",
    "numeric-fraction-values": "[diagonal-fractions|stacked-fractions]",
    "numeric-spacing-values": "[proportional-nums|tabular-nums]",
    "offset-path": "<ray()>|<url>|<basic-shape>",
    "oklab()": "oklab( [<percentage>|<number>|none] [<percentage>|<number>|none] [<percentage>|<number>|none] [/ [<alpha-value>|none]]? )",
    "oklch()": "oklch( [<percentage>|<number>|none] [<percentage>|<number>|none] [<hue>|none] [/ [<alpha-value>|none]]? )",
    "opacity()": "opacity( [<number>|<percentage>]? )",
    "opacity-value": "<number>|<percentage>",
    "outline-line-style": "none|dotted|dashed|solid|double|groove|ridge|inset|outset",
    "outline-radius": "<length>|<percentage>",
    "overflow-position": "unsafe|safe",
    "page-body": "<declaration>? [; <page-body>]?|<page-margin-box> <page-body>",
    "page-margin-box": "<page-margin-box-type> '{' <declaration-list> '}'",
    "page-margin-box-type": "@top-left-corner|@top-left|@top-center|@top-right|@top-right-corner|@bottom-left-corner|@bottom-left|@bottom-center|@bottom-right|@bottom-right-corner|@left-top|@left-middle|@left-bottom|@right-top|@right-middle|@right-bottom",
    "page-selector": "<pseudo-page>+|<ident> <pseudo-page>*",
    "page-selector-list": "[<page-selector>#]?",
    "page-size": "A5|A4|A3|B5|B4|JIS-B5|JIS-B4|letter|legal|ledger",
    "paint": "none|<color>|<url> [none|<color>]?|context-fill|context-stroke",
    "paint()": "paint( <ident> , <declaration-value>? )",
    "paint-box": "<visual-box>|fill-box|stroke-box",
    "palette-identifier": "<dashed-ident>",
    "palette-mix()": "palette-mix( <color-interpolation-method> , [[normal|light|dark|<palette-identifier>|<palette-mix()>]&&<percentage [0,100]>?]#{2} )",
    "path()": "path( <'fill-rule'>? , <string> )",
    "perspective()": "perspective( [<length [0,∞]>|none] )",
    "polar-color-space": "hsl|hwb|lch|oklch",
    "polygon()": "polygon( <'fill-rule'>? , [<length-percentage> <length-percentage>]# )",
    "position": "[[left|center|right]||[top|center|bottom]|[left|center|right|<length-percentage>] [top|center|bottom|<length-percentage>]?|[[left|right] <length-percentage>]&&[[top|bottom] <length-percentage>]]",
    "position-area": "[[left|center|right|span-left|span-right|x-start|x-end|span-x-start|span-x-end|x-self-start|x-self-end|span-x-self-start|span-x-self-end|span-all]||[top|center|bottom|span-top|span-bottom|y-start|y-end|span-y-start|span-y-end|y-self-start|y-self-end|span-y-self-start|span-y-self-end|span-all]|[block-start|center|block-end|span-block-start|span-block-end|span-all]||[inline-start|center|inline-end|span-inline-start|span-inline-end|span-all]|[self-block-start|center|self-block-end|span-self-block-start|span-self-block-end|span-all]||[self-inline-start|center|self-inline-end|span-self-inline-start|span-self-inline-end|span-all]|[start|center|end|span-start|span-end|span-all]{1,2}|[self-start|center|self-end|span-self-start|span-self-end|span-all]{1,2}]",
    "pow()": "pow( <calc-sum> , <calc-sum> )",
    "predefined-rgb": "srgb|srgb-linear|display-p3|display-p3-linear|a98-rgb|prophoto-rgb|rec2020",
    "predefined-rgb-params": "<predefined-rgb> [<number>|<percentage>|none]{3}",
    "pseudo-class-selector": "':' <ident-token>|':' <function-token> <any-value> ')'",
    "pseudo-element-selector": "':' <pseudo-class-selector>|<legacy-pseudo-element-selector>",
    "pseudo-page": ": [left|right|first|blank]",
    "query-in-parens": "( <container-condition> )|( <size-feature> )|style( <style-query> )|<general-enclosed>",
    "quote": "open-quote|close-quote|no-open-quote|no-close-quote",
    "radial-extent": "closest-corner|closest-side|farthest-corner|farthest-side",
    "radial-gradient()": "radial-gradient( [<radial-gradient-syntax>] )",
    "radial-gradient-syntax": "[[[<radial-shape>||<radial-size>]? [at <position>]?]||<color-interpolation-method>]? , <color-stop-list>",
    "radial-shape": "circle|ellipse",
    "radial-size": "<radial-extent>|<length [0,∞]>|<length-percentage [0,∞]>{2}",
    "ratio": "<number [0,∞]> [/ <number [0,∞]>]?",
    "ray()": "ray( <angle>&&<ray-size>?&&contain?&&[at <position>]? )",
    "ray-size": "closest-side|closest-corner|farthest-side|farthest-corner|sides",
    "rect()": "rect( [<length-percentage>|auto]{4} [round <'border-radius'>]? )",
    "rectangular-color-space": "srgb|srgb-linear|display-p3|display-p3-linear|a98-rgb|prophoto-rgb|rec2020|lab|oklab|xyz|xyz-d50|xyz-d65",
    "relative-selector": "<combinator>? <complex-selector>",
    "relative-selector-list": "<relative-selector>#",
    "relative-size": "larger|smaller",
    "rem()": "rem( <calc-sum> , <calc-sum> )",
    "repeat-style": "repeat-x|repeat-y|[repeat|space|round|no-repeat]{1,2}",
    "repeating-conic-gradient()": "repeating-conic-gradient( [<conic-gradient-syntax>] )",
    "repeating-linear-gradient()": "repeating-linear-gradient( [<linear-gradient-syntax>] )",
    "repeating-radial-gradient()": "repeating-radial-gradient( [<radial-gradient-syntax>] )",
    "reversed-counter-name": "reversed( <counter-name> )",
    "rgb()": "rgb( <percentage>#{3} , <alpha-value>? )|rgb( <number>#{3} , <alpha-value>? )|rgb( [<number>|<percentage>|none]{3} [/ [<alpha-value>|none]]? )",
    "rgba()": "rgba( <percentage>#{3} , <alpha-value>? )|rgba( <number>#{3} , <alpha-value>? )|rgba( [<number>|<percentage>|none]{3} [/ [<alpha-value>|none]]? )",
    "rotate()": "rotate( [<angle>|<zero>] )",
    "rotate3d()": "rotate3d( <number> , <number> , <number> , [<angle>|<zero>] )",
    "rotateX()": "rotateX( [<angle>|<zero>] )",
    "rotateY()": "rotateY( [<angle>|<zero>] )",
    "rotateZ()": "rotateZ( [<angle>|<zero>] )",
    "round()": "round( <rounding-strategy>? , <calc-sum> , <calc-sum> )",
    "rounding-strategy": "nearest|up|down|to-zero",
    "saturate()": "saturate( [<number>|<percentage>]? )",
    "scale()": "scale( [<number>|<percentage>]#{1,2} )",
    "scale3d()": "scale3d( [<number>|<percentage>]#{3} )",
    "scaleX()": "scaleX( [<number>|<percentage>] )",
    "scaleY()": "scaleY( [<number>|<percentage>] )",
    "scaleZ()": "scaleZ( [<number>|<percentage>] )",
    "scope-end": "<forgiving-selector-list>",
    "scope-start": "<forgiving-selector-list>",
    "scroll()": "scroll( [<scroller>||<axis>]? )",
    "scroller": "root|nearest|self",
    "scroll-state-feature": "<media-query-list>",
    "scroll-state-in-parens": "( <scroll-state-query> )|( <scroll-state-feature> )|<general-enclosed>",
    "scroll-state-query": "not <scroll-state-in-parens>|<scroll-state-in-parens> [[and <scroll-state-in-parens>]*|[or <scroll-state-in-parens>]*]|<scroll-state-feature>",
    "selector-list": "<complex-selector-list>",
    "self-position": "center|start|end|self-start|self-end|flex-start|flex-end",
    "sepia()": "sepia( [<number>|<percentage>]? )",
    "shadow": "inset?&&<length>{2,4}&&<color>?",
    "shadow-t": "[<length>{2,3}&&<color>?]",
    "shape": "rect( <top> , <right> , <bottom> , <left> )|rect( <top> <right> <bottom> <left> )",
    "shape-box": "<visual-box>|margin-box",
    "side-or-corner": "[left|right]||[top|bottom]",
    "sign()": "sign( <calc-sum> )",
    "signed-integer": "<number-token>",
    "signless-integer": "<number-token>",
    "sin()": "sin( <calc-sum> )",
    "single-animation": "<'animation-duration'>||<easing-function>||<'animation-delay'>||<single-animation-iteration-count>||<single-animation-direction>||<single-animation-fill-mode>||<single-animation-play-state>||[none|<keyframes-name>]||<single-animation-timeline>",
    "single-animation-composition": "replace|add|accumulate",
    "single-animation-direction": "normal|reverse|alternate|alternate-reverse",
    "single-animation-fill-mode": "none|forwards|backwards|both",
    "single-animation-iteration-count": "infinite|<number>",
    "single-animation-play-state": "running|paused",
    "single-animation-timeline": "auto|none|<dashed-ident>|<scroll()>|<view()>",
    "single-transition": "[none|<single-transition-property>]||<time>||<easing-function>||<time>||<transition-behavior-value>",
    "single-transition-property": "all|<custom-ident>",
    "size": "closest-side|farthest-side|closest-corner|farthest-corner|<length>|<length-percentage>{2}",
    "size-feature": "<mf-plain>|<mf-boolean>|<mf-range>",
    "skew()": "skew( [<angle>|<zero>] , [<angle>|<zero>]? )",
    "skewX()": "skewX( [<angle>|<zero>] )",
    "skewY()": "skewY( [<angle>|<zero>] )",
    "sqrt()": "sqrt( <calc-sum> )",
    "step-position": "jump-start|jump-end|jump-none|jump-both|start|end",
    "step-easing-function": "step-start|step-end|<steps()>",
    "steps()": "steps( <integer> , <step-position>? )",
    "style-feature": "<declaration>",
    "style-in-parens": "( <style-condition> )|( <style-feature> )|<general-enclosed>",
    "style-query": "<style-condition>|<style-feature>",
    "subclass-selector": "<id-selector>|<class-selector>|<attribute-selector>|<pseudo-class-selector>",
    "superellipse()": "superellipse( [<number>|infinity|-infinity] )",
    "supports-condition": "not <supports-in-parens>|<supports-in-parens> [and <supports-in-parens>]*|<supports-in-parens> [or <supports-in-parens>]*",
    "supports-decl": "( <declaration> )",
    "supports-feature": "<supports-decl>|<supports-selector-fn>",
    "supports-in-parens": "( <supports-condition> )|<supports-feature>|<general-enclosed>",
    "supports-selector-fn": "selector( <complex-selector> )",
    "symbol": "<string>|<image>|<custom-ident>",
    "symbols()": "symbols( <symbols-type>? [<string>|<image>]+ )",
    "symbols-type": "cyclic|numeric|alphabetic|symbolic|fixed",
    "system-color": "AccentColor|AccentColorText|ActiveText|ButtonBorder|ButtonFace|ButtonText|Canvas|CanvasText|Field|FieldText|GrayText|Highlight|HighlightText|LinkText|Mark|MarkText|SelectedItem|SelectedItemText|VisitedText",
    "system-family-name": "caption|icon|menu|message-box|small-caption|status-bar",
    "tan()": "tan( <calc-sum> )",
    "target": "<target-counter()>|<target-counters()>|<target-text()>",
    "target-counter()": "target-counter( [<string>|<url>] , <custom-ident> , <counter-style>? )",
    "target-counters()": "target-counters( [<string>|<url>] , <custom-ident> , <string> , <counter-style>? )",
    "target-text()": "target-text( [<string>|<url>] , [content|before|after|first-letter]? )",
    "text-edge": "[text|cap|ex|ideographic|ideographic-ink] [text|alphabetic|ideographic|ideographic-ink]?",
    "time-percentage": "<time>|<percentage>",
    "timeline-range-name": "cover|contain|entry|exit|entry-crossing|exit-crossing",
    "track-breadth": "<length-percentage>|<flex>|min-content|max-content|auto",
    "track-list": "[<line-names>? [<track-size>|<track-repeat>]]+ <line-names>?",
    "track-repeat": "repeat( [<integer [1,∞]>] , [<line-names>? <track-size>]+ <line-names>? )",
    "track-size": "<track-breadth>|minmax( <inflexible-breadth> , <track-breadth> )|fit-content( <length-percentage> )",
    "transform-function": "<matrix()>|<translate()>|<translateX()>|<translateY()>|<scale()>|<scaleX()>|<scaleY()>|<rotate()>|<skew()>|<skewX()>|<skewY()>|<matrix3d()>|<translate3d()>|<translateZ()>|<scale3d()>|<scaleZ()>|<rotate3d()>|<rotateX()>|<rotateY()>|<rotateZ()>|<perspective()>",
    "transform-list": "<transform-function>+",
    "transition-behavior-value": "normal|allow-discrete",
    "translate()": "translate( <length-percentage> , <length-percentage>? )",
    "translate3d()": "translate3d( <length-percentage> , <length-percentage> , <length> )",
    "translateX()": "translateX( <length-percentage> )",
    "translateY()": "translateY( <length-percentage> )",
    "translateZ()": "translateZ( <length> )",
    "try-size": "most-width|most-height|most-block-size|most-inline-size",
    "try-tactic": "flip-block||flip-inline||flip-start",
    "type-or-unit": "string|color|url|integer|number|length|angle|time|frequency|cap|ch|em|ex|ic|lh|rlh|rem|vb|vi|vw|vh|vmin|vmax|mm|Q|cm|in|pt|pc|px|deg|grad|rad|turn|ms|s|Hz|kHz|%",
    "type-selector": "<wq-name>|<ns-prefix>? '*'",
    "var()": "var( <custom-property-name> , <declaration-value>? )",
    "view()": "view( [<axis>||<'view-timeline-inset'>]? )",
    "viewport-length": "auto|<length-percentage>",
    "visual-box": "content-box|padding-box|border-box",
    "wq-name": "<ns-prefix>? <ident-token>",
    "xywh()": "xywh( <length-percentage>{2} <length-percentage [0,∞]>{2} [round <'border-radius'>]? )",
    "xyz": "xyz|xyz-d50|xyz-d65",
    "xyz-params": "<xyz-space> [<number>|<percentage>|none]{3}",
    "-legacy-gradient": "<-webkit-gradient()>|<-legacy-linear-gradient>|<-legacy-repeating-linear-gradient>|<-legacy-radial-gradient>|<-legacy-repeating-radial-gradient>",
    "-legacy-linear-gradient": "-moz-linear-gradient( <-legacy-linear-gradient-arguments> )|-webkit-linear-gradient( <-legacy-linear-gradient-arguments> )|-o-linear-gradient( <-legacy-linear-gradient-arguments> )",
    "-legacy-repeating-linear-gradient": "-moz-repeating-linear-gradient( <-legacy-linear-gradient-arguments> )|-webkit-repeating-linear-gradient( <-legacy-linear-gradient-arguments> )|-o-repeating-linear-gradient( <-legacy-linear-gradient-arguments> )",
    "-legacy-linear-gradient-arguments": "[<angle>|<side-or-corner>]? , <color-stop-list>",
    "-legacy-radial-gradient": "-moz-radial-gradient( <-legacy-radial-gradient-arguments> )|-webkit-radial-gradient( <-legacy-radial-gradient-arguments> )|-o-radial-gradient( <-legacy-radial-gradient-arguments> )",
    "-legacy-repeating-radial-gradient": "-moz-repeating-radial-gradient( <-legacy-radial-gradient-arguments> )|-webkit-repeating-radial-gradient( <-legacy-radial-gradient-arguments> )|-o-repeating-radial-gradient( <-legacy-radial-gradient-arguments> )",
    "-legacy-radial-gradient-arguments": "[<position> ,]? [[[<-legacy-radial-gradient-shape>||<-legacy-radial-gradient-size>]|[<length>|<percentage>]{2}] ,]? <color-stop-list>",
    "-legacy-radial-gradient-size": "closest-side|closest-corner|farthest-side|farthest-corner|contain|cover",
    "-legacy-radial-gradient-shape": "circle|ellipse",
    "-non-standard-font": "-apple-system-body|-apple-system-headline|-apple-system-subheadline|-apple-system-caption1|-apple-system-caption2|-apple-system-footnote|-apple-system-short-body|-apple-system-short-headline|-apple-system-short-subheadline|-apple-system-short-caption1|-apple-system-short-footnote|-apple-system-tall-body",
    "-non-standard-color": "-moz-ButtonDefault|-moz-ButtonHoverFace|-moz-ButtonHoverText|-moz-CellHighlight|-moz-CellHighlightText|-moz-Combobox|-moz-ComboboxText|-moz-Dialog|-moz-DialogText|-moz-dragtargetzone|-moz-EvenTreeRow|-moz-Field|-moz-FieldText|-moz-html-CellHighlight|-moz-html-CellHighlightText|-moz-mac-accentdarkestshadow|-moz-mac-accentdarkshadow|-moz-mac-accentface|-moz-mac-accentlightesthighlight|-moz-mac-accentlightshadow|-moz-mac-accentregularhighlight|-moz-mac-accentregularshadow|-moz-mac-chrome-active|-moz-mac-chrome-inactive|-moz-mac-focusring|-moz-mac-menuselect|-moz-mac-menushadow|-moz-mac-menutextselect|-moz-MenuHover|-moz-MenuHoverText|-moz-MenuBarText|-moz-MenuBarHoverText|-moz-nativehyperlinktext|-moz-OddTreeRow|-moz-win-communicationstext|-moz-win-mediatext|-moz-activehyperlinktext|-moz-default-background-color|-moz-default-color|-moz-hyperlinktext|-moz-visitedhyperlinktext|-webkit-activelink|-webkit-focus-ring-color|-webkit-link|-webkit-text",
    "-non-standard-image-rendering": "optimize-contrast|-moz-crisp-edges|-o-crisp-edges|-webkit-optimize-contrast",
    "-non-standard-overflow": "overlay|-moz-scrollbars-none|-moz-scrollbars-horizontal|-moz-scrollbars-vertical|-moz-hidden-unscrollable",
    "-non-standard-size": "intrinsic|min-intrinsic|-webkit-fill-available|-webkit-fit-content|-webkit-min-content|-webkit-max-content|-moz-available|-moz-fit-content|-moz-min-content|-moz-max-content",
    "-webkit-gradient()": "-webkit-gradient( <-webkit-gradient-type> , <-webkit-gradient-point> [, <-webkit-gradient-point>|, <-webkit-gradient-radius> , <-webkit-gradient-point>] [, <-webkit-gradient-radius>]? [, <-webkit-gradient-color-stop>]* )",
    "-webkit-gradient-color-stop": "from( <color> )|color-stop( [<number-zero-one>|<percentage>] , <color> )|to( <color> )",
    "-webkit-gradient-point": "[left|center|right|<length-percentage>] [top|center|bottom|<length-percentage>]",
    "-webkit-gradient-radius": "<length>|<percentage>",
    "-webkit-gradient-type": "linear|radial",
    "-webkit-mask-box-repeat": "repeat|stretch|round",
    "-ms-filter-function-list": "<-ms-filter-function>+",
    "-ms-filter-function": "<-ms-filter-function-progid>|<-ms-filter-function-legacy>",
    "-ms-filter-function-progid": "'progid:' [<ident-token> '.']* [<ident-token>|<function-token> <any-value>? )]",
    "-ms-filter-function-legacy": "<ident-token>|<function-token> <any-value>? )",
    "age": "child|young|old",
    "attr-name": "<wq-name>",
    "attr-fallback": "<any-value>",
    "autospace": "no-autospace|[ideograph-alpha||ideograph-numeric||punctuation]||[insert|replace]",
    "bottom": "<length>|auto",
    "generic-voice": "[<age>? <gender> <integer>?]",
    "gender": "male|female|neutral",
    "generic-script-specific": "generic( kai )|generic( fangsong )|generic( nastaliq )",
    "-non-standard-generic-family": "-apple-system|BlinkMacSystemFont",
    "intrinsic-size-keyword": "min-content|max-content|fit-content",
    "left": "<length>|auto",
    "device-cmyk()": "<legacy-device-cmyk-syntax>|<modern-device-cmyk-syntax>",
    "legacy-device-cmyk-syntax": "device-cmyk( <number>#{4} )",
    "modern-device-cmyk-syntax": "device-cmyk( <cmyk-component>{4} [/ [<alpha-value>|none]]? )",
    "cmyk-component": "<number>|<percentage>|none",
    "color-space": "<rectangular-color-space>|<polar-color-space>|<custom-color-space>",
    "right": "<length>|auto",
    "forgiving-selector-list": "<complex-real-selector-list>",
    "forgiving-relative-selector-list": "<relative-real-selector-list>",
    "complex-real-selector-list": "<complex-real-selector>#",
    "simple-selector-list": "<simple-selector>#",
    "relative-real-selector-list": "<relative-real-selector>#",
    "complex-selector-unit": "[<compound-selector>? <pseudo-compound-selector>*]!",
    "complex-real-selector": "<compound-selector> [<combinator>? <compound-selector>]*",
    "relative-real-selector": "<combinator>? <complex-real-selector>",
    "pseudo-compound-selector": "<pseudo-element-selector> <pseudo-class-selector>*",
    "simple-selector": "<type-selector>|<subclass-selector>",
    "legacy-pseudo-element-selector": "':' [before|after|first-line|first-letter]",
    "svg-length": "<percentage>|<length>|<number>",
    "svg-writing-mode": "lr-tb|rl-tb|tb-rl|lr|rl|tb",
    "top": "<length>|auto",
    "x": "<number>",
    "y": "<number>",
    "declaration": "<ident-token> : <declaration-value>? ['!' important]?",
    "declaration-list": "[<declaration>? ';']* <declaration>?",
    "url": "url( <string> <url-modifier>* )|<url-token>",
    "url-modifier": "<ident>|<function-token> <any-value> )",
    "number-zero-one": "<number [0,1]>",
    "number-one-or-greater": "<number [1,∞]>",
    "xyz-space": "xyz|xyz-d50|xyz-d65",
    "style-condition": "not <style-in-parens>|<style-in-parens> [[and <style-in-parens>]*|[or <style-in-parens>]*]",
    "-non-standard-display": "-ms-inline-flexbox|-ms-grid|-ms-inline-grid|-webkit-flex|-webkit-inline-flex|-webkit-box|-webkit-inline-box|-moz-inline-stack|-moz-box|-moz-inline-box",
    "inset-area": "[[left|center|right|span-left|span-right|x-start|x-end|span-x-start|span-x-end|x-self-start|x-self-end|span-x-self-start|span-x-self-end|span-all]||[top|center|bottom|span-top|span-bottom|y-start|y-end|span-y-start|span-y-end|y-self-start|y-self-end|span-y-self-start|span-y-self-end|span-all]|[block-start|center|block-end|span-block-start|span-block-end|span-all]||[inline-start|center|inline-end|span-inline-start|span-inline-end|span-all]|[self-block-start|self-block-end|span-self-block-start|span-self-block-end|span-all]||[self-inline-start|self-inline-end|span-self-inline-start|span-self-inline-end|span-all]|[start|center|end|span-start|span-end|span-all]{1,2}|[self-start|center|self-end|span-self-start|span-self-end|span-all]{1,2}]",
    "syntax": "'*'|<syntax-component> [<syntax-combinator> <syntax-component>]*|<syntax-string>",
    "syntax-component": "<syntax-single-component> <syntax-multiplier>?|'<' transform-list '>'",
    "syntax-single-component": "'<' <syntax-type-name> '>'|<ident>",
    "syntax-type-name": "angle|color|custom-ident|image|integer|length|length-percentage|number|percentage|resolution|string|time|url|transform-function",
    "syntax-combinator": "'|'",
    "syntax-multiplier": "'#'|'+'",
    "syntax-string": "<string>"
  },
  "properties": {
    "--*": "<declaration-value>",
    "-ms-accelerator": "false|true",
    "-ms-block-progression": "tb|rl|bt|lr",
    "-ms-content-zoom-chaining": "none|chained",
    "-ms-content-zoom-limit": "<'-ms-content-zoom-limit-min'> <'-ms-content-zoom-limit-max'>",
    "-ms-content-zoom-limit-max": "<percentage>",
    "-ms-content-zoom-limit-min": "<percentage>",
    "-ms-content-zoom-snap": "<'-ms-content-zoom-snap-type'>||<'-ms-content-zoom-snap-points'>",
    "-ms-content-zoom-snap-points": "snapInterval( <percentage> , <percentage> )|snapList( <percentage># )",
    "-ms-content-zoom-snap-type": "none|proximity|mandatory",
    "-ms-content-zooming": "none|zoom",
    "-ms-filter": "<string>",
    "-ms-flow-from": "[none|<custom-ident>]#",
    "-ms-flow-into": "[none|<custom-ident>]#",
    "-ms-grid-columns": "none|<track-list>|<auto-track-list>",
    "-ms-grid-rows": "none|<track-list>|<auto-track-list>",
    "-ms-high-contrast-adjust": "auto|none",
    "-ms-hyphenate-limit-chars": "auto|<integer>{1,3}",
    "-ms-hyphenate-limit-lines": "no-limit|<integer>",
    "-ms-hyphenate-limit-zone": "<percentage>|<length>",
    "-ms-ime-align": "auto|after",
    "-ms-overflow-style": "auto|none|scrollbar|-ms-autohiding-scrollbar",
    "-ms-scroll-chaining": "chained|none",
    "-ms-scroll-limit": "<'-ms-scroll-limit-x-min'> <'-ms-scroll-limit-y-min'> <'-ms-scroll-limit-x-max'> <'-ms-scroll-limit-y-max'>",
    "-ms-scroll-limit-x-max": "auto|<length>",
    "-ms-scroll-limit-x-min": "<length>",
    "-ms-scroll-limit-y-max": "auto|<length>",
    "-ms-scroll-limit-y-min": "<length>",
    "-ms-scroll-rails": "none|railed",
    "-ms-scroll-snap-points-x": "snapInterval( <length-percentage> , <length-percentage> )|snapList( <length-percentage># )",
    "-ms-scroll-snap-points-y": "snapInterval( <length-percentage> , <length-percentage> )|snapList( <length-percentage># )",
    "-ms-scroll-snap-type": "none|proximity|mandatory",
    "-ms-scroll-snap-x": "<'-ms-scroll-snap-type'> <'-ms-scroll-snap-points-x'>",
    "-ms-scroll-snap-y": "<'-ms-scroll-snap-type'> <'-ms-scroll-snap-points-y'>",
    "-ms-scroll-translation": "none|vertical-to-horizontal",
    "-ms-scrollbar-3dlight-color": "<color>",
    "-ms-scrollbar-arrow-color": "<color>",
    "-ms-scrollbar-base-color": "<color>",
    "-ms-scrollbar-darkshadow-color": "<color>",
    "-ms-scrollbar-face-color": "<color>",
    "-ms-scrollbar-highlight-color": "<color>",
    "-ms-scrollbar-shadow-color": "<color>",
    "-ms-scrollbar-track-color": "<color>",
    "-ms-text-autospace": "none|ideograph-alpha|ideograph-numeric|ideograph-parenthesis|ideograph-space",
    "-ms-touch-select": "grippers|none",
    "-ms-user-select": "none|element|text",
    "-ms-wrap-flow": "auto|both|start|end|maximum|clear",
    "-ms-wrap-margin": "<length>",
    "-ms-wrap-through": "wrap|none",
    "-moz-appearance": "none|button|button-arrow-down|button-arrow-next|button-arrow-previous|button-arrow-up|button-bevel|button-focus|caret|checkbox|checkbox-container|checkbox-label|checkmenuitem|dualbutton|groupbox|listbox|listitem|menuarrow|menubar|menucheckbox|menuimage|menuitem|menuitemtext|menulist|menulist-button|menulist-text|menulist-textfield|menupopup|menuradio|menuseparator|meterbar|meterchunk|progressbar|progressbar-vertical|progresschunk|progresschunk-vertical|radio|radio-container|radio-label|radiomenuitem|range|range-thumb|resizer|resizerpanel|scale-horizontal|scalethumbend|scalethumb-horizontal|scalethumbstart|scalethumbtick|scalethumb-vertical|scale-vertical|scrollbarbutton-down|scrollbarbutton-left|scrollbarbutton-right|scrollbarbutton-up|scrollbarthumb-horizontal|scrollbarthumb-vertical|scrollbartrack-horizontal|scrollbartrack-vertical|searchfield|separator|sheet|spinner|spinner-downbutton|spinner-textfield|spinner-upbutton|splitter|statusbar|statusbarpanel|tab|tabpanel|tabpanels|tab-scroll-arrow-back|tab-scroll-arrow-forward|textfield|textfield-multiline|toolbar|toolbarbutton|toolbarbutton-dropdown|toolbargripper|toolbox|tooltip|treeheader|treeheadercell|treeheadersortarrow|treeitem|treeline|treetwisty|treetwistyopen|treeview|-moz-mac-unified-toolbar|-moz-win-borderless-glass|-moz-win-browsertabbar-toolbox|-moz-win-communicationstext|-moz-win-communications-toolbox|-moz-win-exclude-glass|-moz-win-glass|-moz-win-mediatext|-moz-win-media-toolbox|-moz-window-button-box|-moz-window-button-box-maximized|-moz-window-button-close|-moz-window-button-maximize|-moz-window-button-minimize|-moz-window-button-restore|-moz-window-frame-bottom|-moz-window-frame-left|-moz-window-frame-right|-moz-window-titlebar|-moz-window-titlebar-maximized",
    "-moz-binding": "<url>|none",
    "-moz-border-bottom-colors": "<color>+|none",
    "-moz-border-left-colors": "<color>+|none",
    "-moz-border-right-colors": "<color>+|none",
    "-moz-border-top-colors": "<color>+|none",
    "-moz-context-properties": "none|[fill|fill-opacity|stroke|stroke-opacity]#",
    "-moz-float-edge": "border-box|content-box|margin-box|padding-box",
    "-moz-force-broken-image-icon": "0|1",
    "-moz-orient": "inline|block|horizontal|vertical",
    "-moz-outline-radius": "<outline-radius>{1,4} [/ <outline-radius>{1,4}]?",
    "-moz-outline-radius-bottomleft": "<outline-radius>",
    "-moz-outline-radius-bottomright": "<outline-radius>",
    "-moz-outline-radius-topleft": "<outline-radius>",
    "-moz-outline-radius-topright": "<outline-radius>",
    "-moz-stack-sizing": "ignore|stretch-to-fit",
    "-moz-text-blink": "none|blink",
    "-moz-user-focus": "ignore|normal|select-after|select-before|select-menu|select-same|select-all|none",
    "-moz-user-input": "auto|none|enabled|disabled",
    "-moz-user-modify": "read-only|read-write|write-only",
    "-moz-window-dragging": "drag|no-drag",
    "-moz-window-shadow": "default|menu|tooltip|sheet|none",
    "-webkit-appearance": "none|button|button-bevel|caps-lock-indicator|caret|checkbox|default-button|inner-spin-button|listbox|listitem|media-controls-background|media-controls-fullscreen-background|media-current-time-display|media-enter-fullscreen-button|media-exit-fullscreen-button|media-fullscreen-button|media-mute-button|media-overlay-play-button|media-play-button|media-seek-back-button|media-seek-forward-button|media-slider|media-sliderthumb|media-time-remaining-display|media-toggle-closed-captions-button|media-volume-slider|media-volume-slider-container|media-volume-sliderthumb|menulist|menulist-button|menulist-text|menulist-textfield|meter|progress-bar|progress-bar-value|push-button|radio|scrollbarbutton-down|scrollbarbutton-left|scrollbarbutton-right|scrollbarbutton-up|scrollbargripper-horizontal|scrollbargripper-vertical|scrollbarthumb-horizontal|scrollbarthumb-vertical|scrollbartrack-horizontal|scrollbartrack-vertical|searchfield|searchfield-cancel-button|searchfield-decoration|searchfield-results-button|searchfield-results-decoration|slider-horizontal|slider-vertical|sliderthumb-horizontal|sliderthumb-vertical|square-button|textarea|textfield|-apple-pay-button",
    "-webkit-border-before": "<'border-width'>||<'border-style'>||<color>",
    "-webkit-border-before-color": "<color>",
    "-webkit-border-before-style": "<'border-style'>",
    "-webkit-border-before-width": "<'border-width'>",
    "-webkit-box-reflect": "[above|below|right|left]? <length>? <image>?",
    "-webkit-line-clamp": "none|<integer>",
    "-webkit-mask": "[<mask-reference>||<position> [/ <bg-size>]?||<repeat-style>||[<visual-box>|border|padding|content|text]||[<visual-box>|border|padding|content]]#",
    "-webkit-mask-attachment": "<attachment>#",
    "-webkit-mask-clip": "[<coord-box>|no-clip|border|padding|content|text]#",
    "-webkit-mask-composite": "<composite-style>#",
    "-webkit-mask-image": "<mask-reference>#",
    "-webkit-mask-origin": "[<coord-box>|border|padding|content]#",
    "-webkit-mask-position": "<position>#",
    "-webkit-mask-position-x": "[<length-percentage>|left|center|right]#",
    "-webkit-mask-position-y": "[<length-percentage>|top|center|bottom]#",
    "-webkit-mask-repeat": "<repeat-style>#",
    "-webkit-mask-repeat-x": "repeat|no-repeat|space|round",
    "-webkit-mask-repeat-y": "repeat|no-repeat|space|round",
    "-webkit-mask-size": "<bg-size>#",
    "-webkit-overflow-scrolling": "auto|touch",
    "-webkit-tap-highlight-color": "<color>",
    "-webkit-text-fill-color": "<color>",
    "-webkit-text-stroke": "<length>||<color>",
    "-webkit-text-stroke-color": "<color>",
    "-webkit-text-stroke-width": "<length>",
    "-webkit-touch-callout": "default|none",
    "-webkit-user-modify": "read-only|read-write|read-write-plaintext-only",
    "-webkit-user-select": "auto|none|text|all",
    "accent-color": "auto|<color>",
    "align-content": "normal|<baseline-position>|<content-distribution>|<overflow-position>? <content-position>",
    "align-items": "normal|stretch|<baseline-position>|[<overflow-position>? <self-position>]|anchor-center",
    "align-self": "auto|normal|stretch|<baseline-position>|<overflow-position>? <self-position>|anchor-center",
    "align-tracks": "[normal|<baseline-position>|<content-distribution>|<overflow-position>? <content-position>]#",
    "alignment-baseline": "auto|baseline|before-edge|text-before-edge|middle|central|after-edge|text-after-edge|ideographic|alphabetic|hanging|mathematical",
    "all": "initial|inherit|unset|revert|revert-layer",
    "anchor-name": "none|<dashed-ident>#",
    "anchor-scope": "none|all|<dashed-ident>#",
    "animation": "<single-animation>#",
    "animation-composition": "<single-animation-composition>#",
    "animation-delay": "<time>#",
    "animation-direction": "<single-animation-direction>#",
    "animation-duration": "[auto|<time [0s,∞]>]#",
    "animation-fill-mode": "<single-animation-fill-mode>#",
    "animation-iteration-count": "<single-animation-iteration-count>#",
    "animation-name": "[none|<keyframes-name>]#",
    "animation-play-state": "<single-animation-play-state>#",
    "animation-range": "[<'animation-range-start'> <'animation-range-end'>?]#",
    "animation-range-end": "[normal|<length-percentage>|<timeline-range-name> <length-percentage>?]#",
    "animation-range-start": "[normal|<length-percentage>|<timeline-range-name> <length-percentage>?]#",
    "animation-timeline": "<single-animation-timeline>#",
    "animation-timing-function": "<easing-function>#",
    "animation-trigger": "[none|[<dashed-ident> <animation-action>+]+]#",
    "appearance": "none|auto|<compat-auto>|<compat-special>",
    "aspect-ratio": "auto||<ratio>",
    "backdrop-filter": "none|<filter-value-list>",
    "backface-visibility": "visible|hidden",
    "background": "<bg-layer>#? , <final-bg-layer>",
    "background-attachment": "<attachment>#",
    "background-blend-mode": "<blend-mode>#",
    "background-clip": "<bg-clip>#",
    "background-color": "<color>",
    "background-image": "<bg-image>#",
    "background-origin": "<visual-box>#",
    "background-position": "<bg-position>#",
    "background-position-x": "[center|[[left|right|x-start|x-end]? <length-percentage>?]!]#",
    "background-position-y": "[center|[[top|bottom|y-start|y-end]? <length-percentage>?]!]#",
    "background-repeat": "<repeat-style>#",
    "background-size": "<bg-size>#",
    "baseline-shift": "baseline|sub|super|<svg-length>",
    "baseline-source": "auto|first|last",
    "block-size": "<'width'>",
    "border": "<line-width>||<line-style>||<color>",
    "border-block": "<'border-block-start'>",
    "border-block-color": "<'border-top-color'>{1,2}",
    "border-block-end": "<'border-top-width'>||<'border-top-style'>||<color>",
    "border-block-end-color": "<'border-top-color'>",
    "border-block-end-style": "<'border-top-style'>",
    "border-block-end-width": "<'border-top-width'>",
    "border-block-start": "<'border-top-width'>||<'border-top-style'>||<color>",
    "border-block-start-color": "<'border-top-color'>",
    "border-block-start-style": "<'border-top-style'>",
    "border-block-start-width": "<'border-top-width'>",
    "border-block-style": "<'border-top-style'>{1,2}",
    "border-block-width": "<'border-top-width'>{1,2}",
    "border-bottom": "<line-width>||<line-style>||<color>",
    "border-bottom-color": "<'border-top-color'>",
    "border-bottom-left-radius": "<length-percentage [0,∞]>{1,2}",
    "border-bottom-right-radius": "<length-percentage [0,∞]>{1,2}",
    "border-bottom-style": "<line-style>",
    "border-bottom-width": "<line-width>",
    "border-collapse": "separate|collapse",
    "border-color": "<color>{1,4}",
    "border-end-end-radius": "<'border-top-left-radius'>",
    "border-end-start-radius": "<'border-top-left-radius'>",
    "border-image": "<'border-image-source'>||<'border-image-slice'> [/ <'border-image-width'>|/ <'border-image-width'>? / <'border-image-outset'>]?||<'border-image-repeat'>",
    "border-image-outset": "[<length [0,∞]>|<number [0,∞]>]{1,4}",
    "border-image-repeat": "[stretch|repeat|round|space]{1,2}",
    "border-image-slice": "[<number [0,∞]>|<percentage [0,∞]>]{1,4}&&fill?",
    "border-image-source": "none|<image>",
    "border-image-width": "[<length-percentage [0,∞]>|<number [0,∞]>|auto]{1,4}",
    "border-inline": "<'border-block-start'>",
    "border-inline-color": "<'border-top-color'>{1,2}",
    "border-inline-end": "<'border-top-width'>||<'border-top-style'>||<color>",
    "border-inline-end-color": "<'border-top-color'>",
    "border-inline-end-style": "<'border-top-style'>",
    "border-inline-end-width": "<'border-top-width'>",
    "border-inline-start": "<'border-top-width'>||<'border-top-style'>||<color>",
    "border-inline-start-color": "<'border-top-color'>",
    "border-inline-start-style": "<'border-top-style'>",
    "border-inline-start-width": "<'border-top-width'>",
    "border-inline-style": "<'border-top-style'>{1,2}",
    "border-inline-width": "<'border-top-width'>{1,2}",
    "border-left": "<line-width>||<line-style>||<color>",
    "border-left-color": "<color>",
    "border-left-style": "<line-style>",
    "border-left-width": "<line-width>",
    "border-radius": "<length-percentage [0,∞]>{1,4} [/ <length-percentage [0,∞]>{1,4}]?",
    "border-right": "<line-width>||<line-style>||<color>",
    "border-right-color": "<color>",
    "border-right-style": "<line-style>",
    "border-right-width": "<line-width>",
    "border-spacing": "<length>{1,2}",
    "border-start-end-radius": "<'border-top-left-radius'>",
    "border-start-start-radius": "<'border-top-left-radius'>",
    "border-style": "<line-style>{1,4}",
    "border-top": "<line-width>||<line-style>||<color>",
    "border-top-color": "<color>",
    "border-top-left-radius": "<length-percentage [0,∞]>{1,2}",
    "border-top-right-radius": "<length-percentage [0,∞]>{1,2}",
    "border-top-style": "<line-style>",
    "border-top-width": "<line-width>",
    "border-width": "<line-width>{1,4}",
    "bottom": "auto|<length-percentage>|<anchor()>|<anchor-size()>",
    "box-align": "start|center|end|baseline|stretch",
    "box-decoration-break": "slice|clone",
    "box-direction": "normal|reverse|inherit",
    "box-flex": "<number>",
    "box-flex-group": "<integer>",
    "box-lines": "single|multiple",
    "box-ordinal-group": "<integer>",
    "box-orient": "horizontal|vertical|inline-axis|block-axis|inherit",
    "box-pack": "start|center|end|justify",
    "box-shadow": "none|<shadow>#",
    "box-sizing": "content-box|border-box",
    "break-after": "auto|avoid|always|all|avoid-page|page|left|right|recto|verso|avoid-column|column|avoid-region|region",
    "break-before": "auto|avoid|always|all|avoid-page|page|left|right|recto|verso|avoid-column|column|avoid-region|region",
    "break-inside": "auto|avoid|avoid-page|avoid-column|avoid-region",
    "caption-side": "top|bottom",
    "caret": "<'caret-color'>||<'caret-animation'>||<'caret-shape'>",
    "caret-animation": "auto|manual",
    "caret-color": "auto|<color>",
    "caret-shape": "auto|bar|block|underscore",
    "clear": "none|left|right|both|inline-start|inline-end",
    "clip": "<shape>|auto",
    "clip-path": "<clip-source>|[<basic-shape>||<geometry-box>]|none",
    "clip-rule": "nonzero|evenodd",
    "color": "<color>",
    "color-interpolation-filters": "auto|sRGB|linearRGB",
    "color-scheme": "normal|[light|dark|<custom-ident>]+&&only?",
    "column-count": "<integer>|auto",
    "column-fill": "auto|balance",
    "column-gap": "normal|<length-percentage>",
    "column-height": "auto|<length [0,∞]>",
    "column-rule": "<'column-rule-width'>||<'column-rule-style'>||<'column-rule-color'>",
    "column-rule-color": "<color>",
    "column-rule-style": "<'border-style'>",
    "column-rule-width": "<'border-width'>",
    "column-span": "none|all",
    "column-width": "auto|<length [0,∞]>",
    "column-wrap": "auto|nowrap|wrap",
    "columns": "[<'column-width'>||<'column-count'>] [/ <'column-height'>]?",
    "contain": "none|strict|content|[[size||inline-size]||layout||style||paint]",
    "contain-intrinsic-block-size": "auto? [none|<length>]",
    "contain-intrinsic-height": "auto? [none|<length>]",
    "contain-intrinsic-inline-size": "auto? [none|<length>]",
    "contain-intrinsic-size": "[auto? [none|<length>]]{1,2}",
    "contain-intrinsic-width": "auto? [none|<length>]",
    "container": "<'container-name'> [/ <'container-type'>]?",
    "container-name": "none|<custom-ident>+",
    "container-type": "normal||[size|inline-size]",
    "content": "normal|none|[<content-replacement>|<content-list>] [/ [<string>|<counter>|<attr()>]+]?",
    "content-visibility": "visible|auto|hidden",
    "corner-block-end-shape": "<corner-shape-value>{1,2}",
    "corner-block-start-shape": "<corner-shape-value>{1,2}",
    "corner-bottom-shape": "<corner-shape-value>{1,2}",
    "corner-bottom-left-shape": "<corner-shape-value>",
    "corner-bottom-right-shape": "<corner-shape-value>",
    "corner-end-end-shape": "<corner-shape-value>",
    "corner-end-start-shape": "<corner-shape-value>",
    "corner-inline-end-shape": "<corner-shape-value>{1,2}",
    "corner-inline-start-shape": "<corner-shape-value>{1,2}",
    "corner-left-shape": "<corner-shape-value>{1,2}",
    "corner-right-shape": "<corner-shape-value>{1,2}",
    "corner-shape": "<corner-shape-value>{1,4}",
    "corner-start-start-shape": "<corner-shape-value>",
    "corner-start-end-shape": "<corner-shape-value>",
    "corner-top-shape": "<corner-shape-value>{1,2}",
    "corner-top-left-shape": "<corner-shape-value>",
    "corner-top-right-shape": "<corner-shape-value>",
    "counter-increment": "[<counter-name> <integer>?]+|none",
    "counter-reset": "[<counter-name> <integer>?|<reversed-counter-name> <integer>?]+|none",
    "counter-set": "[<counter-name> <integer>?]+|none",
    "cursor": "[[<url> [<x> <y>]? ,]* [auto|default|none|context-menu|help|pointer|progress|wait|cell|crosshair|text|vertical-text|alias|copy|move|no-drop|not-allowed|e-resize|n-resize|ne-resize|nw-resize|s-resize|se-resize|sw-resize|w-resize|ew-resize|ns-resize|nesw-resize|nwse-resize|col-resize|row-resize|all-scroll|zoom-in|zoom-out|grab|grabbing|hand|-webkit-grab|-webkit-grabbing|-webkit-zoom-in|-webkit-zoom-out|-moz-grab|-moz-grabbing|-moz-zoom-in|-moz-zoom-out]]",
    "cx": "<length>|<percentage>",
    "cy": "<length>|<percentage>",
    "d": "none|path( <string> )",
    "direction": "ltr|rtl",
    "display": "[<display-outside>||<display-inside>]|<display-listitem>|<display-internal>|<display-box>|<display-legacy>|<-non-standard-display>",
    "dominant-baseline": "auto|use-script|no-change|reset-size|ideographic|alphabetic|hanging|mathematical|central|middle|text-after-edge|text-before-edge",
    "dynamic-range-limit": "standard|no-limit|constrained|<dynamic-range-limit-mix()>",
    "empty-cells": "show|hide",
    "field-sizing": "content|fixed",
    "fill": "<paint>",
    "fill-opacity": "<number-zero-one>|<percentage>",
    "fill-rule": "nonzero|evenodd",
    "filter": "none|<filter-value-list>|<-ms-filter-function-list>",
    "flex": "none|[<'flex-grow'> <'flex-shrink'>?||<'flex-basis'>]",
    "flex-basis": "content|<'width'>",
    "flex-direction": "row|row-reverse|column|column-reverse",
    "flex-flow": "<'flex-direction'>||<'flex-wrap'>",
    "flex-grow": "<number>",
    "flex-shrink": "<number>",
    "flex-wrap": "nowrap|wrap|wrap-reverse",
    "float": "left|right|none|inline-start|inline-end",
    "flood-color": "<color>",
    "flood-opacity": "<'opacity'>",
    "font": "[[<'font-style'>||<font-variant-css2>||<'font-weight'>||<font-width-css3>]? <'font-size'> [/ <'line-height'>]? <'font-family'>#]|<system-family-name>|<-non-standard-font>",
    "font-family": "[<family-name>|<generic-family>]#",
    "font-feature-settings": "normal|<feature-tag-value>#",
    "font-kerning": "auto|normal|none",
    "font-language-override": "normal|<string>",
    "font-optical-sizing": "auto|none",
    "font-palette": "normal|light|dark|<palette-identifier>|<palette-mix()>",
    "font-size": "<absolute-size>|<relative-size>|<length-percentage [0,∞]>|math",
    "font-size-adjust": "none|[ex-height|cap-height|ch-width|ic-width|ic-height]? [from-font|<number>]",
    "font-smooth": "auto|never|always|<absolute-size>|<length>",
    "font-stretch": "<font-stretch-absolute>",
    "font-style": "normal|italic|oblique <angle>?",
    "font-synthesis": "none|[weight||style||small-caps||position]",
    "font-synthesis-position": "auto|none",
    "font-synthesis-small-caps": "auto|none",
    "font-synthesis-style": "auto|none",
    "font-synthesis-weight": "auto|none",
    "font-variant": "normal|none|[<common-lig-values>||<discretionary-lig-values>||<historical-lig-values>||<contextual-alt-values>||stylistic( <feature-value-name> )||historical-forms||styleset( <feature-value-name># )||character-variant( <feature-value-name># )||swash( <feature-value-name> )||ornaments( <feature-value-name> )||annotation( <feature-value-name> )||[small-caps|all-small-caps|petite-caps|all-petite-caps|unicase|titling-caps]||<numeric-figure-values>||<numeric-spacing-values>||<numeric-fraction-values>||ordinal||slashed-zero||<east-asian-variant-values>||<east-asian-width-values>||ruby]",
    "font-variant-alternates": "normal|[stylistic( <feature-value-name> )||historical-forms||styleset( <feature-value-name># )||character-variant( <feature-value-name># )||swash( <feature-value-name> )||ornaments( <feature-value-name> )||annotation( <feature-value-name> )]",
    "font-variant-caps": "normal|small-caps|all-small-caps|petite-caps|all-petite-caps|unicase|titling-caps",
    "font-variant-east-asian": "normal|[<east-asian-variant-values>||<east-asian-width-values>||ruby]",
    "font-variant-emoji": "normal|text|emoji|unicode",
    "font-variant-ligatures": "normal|none|[<common-lig-values>||<discretionary-lig-values>||<historical-lig-values>||<contextual-alt-values>]",
    "font-variant-numeric": "normal|[<numeric-figure-values>||<numeric-spacing-values>||<numeric-fraction-values>||ordinal||slashed-zero]",
    "font-variant-position": "normal|sub|super",
    "font-variation-settings": "normal|[<string> <number>]#",
    "font-weight": "<font-weight-absolute>|bolder|lighter",
    "font-width": "normal|<percentage [0,∞]>|ultra-condensed|extra-condensed|condensed|semi-condensed|semi-expanded|expanded|extra-expanded|ultra-expanded",
    "forced-color-adjust": "auto|none|preserve-parent-color",
    "gap": "<'row-gap'> <'column-gap'>?",
    "grid": "<'grid-template'>|<'grid-template-rows'> / [auto-flow&&dense?] <'grid-auto-columns'>?|[auto-flow&&dense?] <'grid-auto-rows'>? / <'grid-template-columns'>",
    "grid-area": "<grid-line> [/ <grid-line>]{0,3}",
    "grid-auto-columns": "<track-size>+",
    "grid-auto-flow": "[row|column]||dense",
    "grid-auto-rows": "<track-size>+",
    "grid-column": "<grid-line> [/ <grid-line>]?",
    "grid-column-end": "<grid-line>",
    "grid-column-gap": "<length-percentage>",
    "grid-column-start": "<grid-line>",
    "grid-gap": "<'grid-row-gap'> <'grid-column-gap'>?",
    "grid-row": "<grid-line> [/ <grid-line>]?",
    "grid-row-end": "<grid-line>",
    "grid-row-gap": "<length-percentage>",
    "grid-row-start": "<grid-line>",
    "grid-template": "none|[<'grid-template-rows'> / <'grid-template-columns'>]|[<line-names>? <string> <track-size>? <line-names>?]+ [/ <explicit-track-list>]?",
    "grid-template-areas": "none|<string>+",
    "grid-template-columns": "none|<track-list>|<auto-track-list>|subgrid <line-name-list>?",
    "grid-template-rows": "none|<track-list>|<auto-track-list>|subgrid <line-name-list>?",
    "hanging-punctuation": "none|[first||[force-end|allow-end]||last]",
    "height": "auto|<length-percentage [0,∞]>|min-content|max-content|fit-content|fit-content( <length-percentage [0,∞]> )|<calc-size()>|<anchor-size()>|stretch|<-non-standard-size>",
    "hyphenate-character": "auto|<string>",
    "hyphenate-limit-chars": "[auto|<integer>]{1,3}",
    "hyphens": "none|manual|auto",
    "image-orientation": "from-image|<angle>|[<angle>? flip]",
    "image-rendering": "auto|crisp-edges|pixelated|smooth|optimizeSpeed|optimizeQuality|<-non-standard-image-rendering>",
    "image-resolution": "[from-image||<resolution>]&&snap?",
    "ime-mode": "auto|normal|active|inactive|disabled",
    "initial-letter": "normal|[<number> <integer>?]",
    "initial-letter-align": "[auto|alphabetic|hanging|ideographic]",
    "inline-size": "<'width'>",
    "inset": "<'top'>{1,4}",
    "inset-block": "<'top'>{1,2}",
    "inset-block-end": "<'top'>",
    "inset-block-start": "<'top'>",
    "inset-inline": "<'top'>{1,2}",
    "inset-inline-end": "<'top'>",
    "inset-inline-start": "<'top'>",
    "interpolate-size": "numeric-only|allow-keywords",
    "isolation": "auto|isolate",
    "interactivity": "auto|inert",
    "interest-delay": "<'interest-delay-start'>{1,2}",
    "interest-delay-end": "normal|<time>",
    "interest-delay-start": "normal|<time>",
    "justify-content": "normal|<content-distribution>|<overflow-position>? [<content-position>|left|right]",
    "justify-items": "normal|stretch|<baseline-position>|<overflow-position>? [<self-position>|left|right]|legacy|legacy&&[left|right|center]|anchor-center",
    "justify-self": "auto|normal|stretch|<baseline-position>|<overflow-position>? [<self-position>|left|right]|anchor-center",
    "justify-tracks": "[normal|<content-distribution>|<overflow-position>? [<content-position>|left|right]]#",
    "left": "auto|<length-percentage>|<anchor()>|<anchor-size()>",
    "letter-spacing": "normal|<length-percentage>",
    "lighting-color": "<color>",
    "line-break": "auto|loose|normal|strict|anywhere",
    "line-clamp": "none|<integer>",
    "line-height": "normal|<number>|<length>|<percentage>",
    "line-height-step": "<length>",
    "list-style": "<'list-style-type'>||<'list-style-position'>||<'list-style-image'>",
    "list-style-image": "<image>|none",
    "list-style-position": "inside|outside",
    "list-style-type": "<counter-style>|<string>|none",
    "margin": "<'margin-top'>{1,4}",
    "margin-block": "<'margin-top'>{1,2}",
    "margin-block-end": "<'margin-top'>",
    "margin-block-start": "<'margin-top'>",
    "margin-bottom": "<length-percentage>|auto|<anchor-size()>",
    "margin-inline": "<'margin-top'>{1,2}",
    "margin-inline-end": "<'margin-top'>",
    "margin-inline-start": "<'margin-top'>",
    "margin-left": "<length-percentage>|auto|<anchor-size()>",
    "margin-right": "<length-percentage>|auto|<anchor-size()>",
    "margin-top": "<length-percentage>|auto|<anchor-size()>",
    "margin-trim": "none|in-flow|all",
    "marker": "none|<url>",
    "marker-end": "none|<url>",
    "marker-mid": "none|<url>",
    "marker-start": "none|<url>",
    "mask": "<mask-layer>#",
    "mask-border": "<'mask-border-source'>||<'mask-border-slice'> [/ <'mask-border-width'>? [/ <'mask-border-outset'>]?]?||<'mask-border-repeat'>||<'mask-border-mode'>",
    "mask-border-mode": "luminance|alpha",
    "mask-border-outset": "[<length>|<number>]{1,4}",
    "mask-border-repeat": "[stretch|repeat|round|space]{1,2}",
    "mask-border-slice": "<number-percentage>{1,4} fill?",
    "mask-border-source": "none|<image>",
    "mask-border-width": "[<length-percentage>|<number>|auto]{1,4}",
    "mask-clip": "[<coord-box>|no-clip]#",
    "mask-composite": "<compositing-operator>#",
    "mask-image": "<mask-reference>#",
    "mask-mode": "<masking-mode>#",
    "mask-origin": "<coord-box>#",
    "mask-position": "<position>#",
    "mask-repeat": "<repeat-style>#",
    "mask-size": "<bg-size>#",
    "mask-type": "luminance|alpha",
    "masonry-auto-flow": "[pack|next]||[definite-first|ordered]",
    "math-depth": "auto-add|add( <integer> )|<integer>",
    "math-shift": "normal|compact",
    "math-style": "normal|compact",
    "max-block-size": "<'max-width'>",
    "max-height": "none|<length-percentage [0,∞]>|min-content|max-content|fit-content|fit-content( <length-percentage [0,∞]> )|<calc-size()>|<anchor-size()>|stretch|<-non-standard-size>",
    "max-inline-size": "<'max-width'>",
    "max-lines": "none|<integer>",
    "max-width": "none|<length-percentage [0,∞]>|min-content|max-content|fit-content|fit-content( <length-percentage [0,∞]> )|<calc-size()>|<anchor-size()>|stretch|<-non-standard-size>",
    "min-block-size": "<'min-width'>",
    "min-height": "auto|<length-percentage [0,∞]>|min-content|max-content|fit-content|fit-content( <length-percentage [0,∞]> )|<calc-size()>|<anchor-size()>|stretch|<-non-standard-size>",
    "min-inline-size": "<'min-width'>",
    "min-width": "auto|<length-percentage [0,∞]>|min-content|max-content|fit-content|fit-content( <length-percentage [0,∞]> )|<calc-size()>|<anchor-size()>|stretch|<-non-standard-size>",
    "mix-blend-mode": "<blend-mode>|plus-darker|plus-lighter",
    "object-fit": "fill|contain|cover|none|scale-down",
    "object-position": "<position>",
    "object-view-box": "none|<basic-shape-rect>",
    "offset": "[<'offset-position'>? [<'offset-path'> [<'offset-distance'>||<'offset-rotate'>]?]?]! [/ <'offset-anchor'>]?",
    "offset-anchor": "auto|<position>",
    "offset-distance": "<length-percentage>",
    "offset-path": "none|<offset-path>||<coord-box>",
    "offset-position": "normal|auto|<position>",
    "offset-rotate": "[auto|reverse]||<angle>",
    "opacity": "<opacity-value>",
    "order": "<integer>",
    "orphans": "<integer>",
    "outline": "<'outline-width'>||<'outline-style'>||<'outline-color'>",
    "outline-color": "auto|<color>",
    "outline-offset": "<length>",
    "outline-style": "auto|<outline-line-style>",
    "outline-width": "<line-width>",
    "overflow": "[visible|hidden|clip|scroll|auto]{1,2}|<-non-standard-overflow>",
    "overflow-anchor": "auto|none",
    "overflow-block": "visible|hidden|clip|scroll|auto|<-non-standard-overflow>",
    "overflow-clip-box": "padding-box|content-box",
    "overflow-clip-margin": "<visual-box>||<length [0,∞]>",
    "overflow-inline": "visible|hidden|clip|scroll|auto|<-non-standard-overflow>",
    "overflow-wrap": "normal|break-word|anywhere",
    "overflow-x": "visible|hidden|clip|scroll|auto|<-non-standard-overflow>",
    "overflow-y": "visible|hidden|clip|scroll|auto|<-non-standard-overflow>",
    "overlay": "none|auto",
    "overscroll-behavior": "[contain|none|auto]{1,2}",
    "overscroll-behavior-block": "contain|none|auto",
    "overscroll-behavior-inline": "contain|none|auto",
    "overscroll-behavior-x": "contain|none|auto",
    "overscroll-behavior-y": "contain|none|auto",
    "padding": "<'padding-top'>{1,4}",
    "padding-block": "<'padding-top'>{1,2}",
    "padding-block-end": "<'padding-top'>",
    "padding-block-start": "<'padding-top'>",
    "padding-bottom": "<length-percentage [0,∞]>",
    "padding-inline": "<'padding-top'>{1,2}",
    "padding-inline-end": "<'padding-top'>",
    "padding-inline-start": "<'padding-top'>",
    "padding-left": "<length-percentage [0,∞]>",
    "padding-right": "<length-percentage [0,∞]>",
    "padding-top": "<length-percentage [0,∞]>",
    "page": "auto|<custom-ident>",
    "page-break-after": "auto|always|avoid|left|right|recto|verso",
    "page-break-before": "auto|always|avoid|left|right|recto|verso",
    "page-break-inside": "auto|avoid",
    "paint-order": "normal|[fill||stroke||markers]",
    "perspective": "none|<length>",
    "perspective-origin": "<position>",
    "place-content": "<'align-content'> <'justify-content'>?",
    "place-items": "<'align-items'> <'justify-items'>?",
    "place-self": "<'align-self'> <'justify-self'>?",
    "pointer-events": "auto|none|visiblePainted|visibleFill|visibleStroke|visible|painted|fill|stroke|all|inherit",
    "position": "static|relative|absolute|sticky|fixed|-webkit-sticky",
    "position-anchor": "auto|none|<anchor-name>",
    "position-area": "none|<position-area>",
    "position-try": "<'position-try-order'>? <'position-try-fallbacks'>",
    "position-try-fallbacks": "none|[[<dashed-ident>||<try-tactic>]|<'position-area'>]#",
    "position-try-order": "normal|<try-size>",
    "position-visibility": "always|[anchors-valid||anchors-visible||no-overflow]",
    "print-color-adjust": "economy|exact",
    "quotes": "none|auto|[<string> <string>]+",
    "r": "<length>|<percentage>",
    "reading-flow": "normal|source-order|flex-visual|flex-flow|grid-rows|grid-columns|grid-order",
    "reading-order": "<integer>",
    "resize": "none|both|horizontal|vertical|block|inline",
    "right": "auto|<length-percentage>|<anchor()>|<anchor-size()>",
    "rotate": "none|<angle>|[x|y|z|<number>{3}]&&<angle>",
    "row-gap": "normal|<length-percentage>",
    "ruby-align": "start|center|space-between|space-around",
    "ruby-merge": "separate|collapse|auto",
    "ruby-overhang": "auto|none",
    "ruby-position": "[alternate||[over|under]]|inter-character",
    "rx": "<length>|<percentage>",
    "ry": "<length>|<percentage>",
    "scale": "none|[<number>|<percentage>]{1,3}",
    "scroll-behavior": "auto|smooth",
    "scroll-initial-target": "none|nearest",
    "scroll-margin": "<length>{1,4}",
    "scroll-margin-block": "<length>{1,2}",
    "scroll-margin-block-end": "<length>",
    "scroll-margin-block-start": "<length>",
    "scroll-margin-bottom": "<length>",
    "scroll-margin-inline": "<length>{1,2}",
    "scroll-margin-inline-end": "<length>",
    "scroll-margin-inline-start": "<length>",
    "scroll-margin-left": "<length>",
    "scroll-margin-right": "<length>",
    "scroll-margin-top": "<length>",
    "scroll-marker-group": "none|before|after",
    "scroll-padding": "[auto|<length-percentage>]{1,4}",
    "scroll-padding-block": "[auto|<length-percentage>]{1,2}",
    "scroll-padding-block-end": "auto|<length-percentage>",
    "scroll-padding-block-start": "auto|<length-percentage>",
    "scroll-padding-bottom": "auto|<length-percentage>",
    "scroll-padding-inline": "[auto|<length-percentage>]{1,2}",
    "scroll-padding-inline-end": "auto|<length-percentage>",
    "scroll-padding-inline-start": "auto|<length-percentage>",
    "scroll-padding-left": "auto|<length-percentage>",
    "scroll-padding-right": "auto|<length-percentage>",
    "scroll-padding-top": "auto|<length-percentage>",
    "scroll-snap-align": "[none|start|end|center]{1,2}",
    "scroll-snap-coordinate": "none|<position>#",
    "scroll-snap-destination": "<position>",
    "scroll-snap-points-x": "none|repeat( <length-percentage> )",
    "scroll-snap-points-y": "none|repeat( <length-percentage> )",
    "scroll-snap-stop": "normal|always",
    "scroll-snap-type": "none|[x|y|block|inline|both] [mandatory|proximity]?",
    "scroll-snap-type-x": "none|mandatory|proximity",
    "scroll-snap-type-y": "none|mandatory|proximity",
    "scroll-target-group": "none|auto",
    "scroll-timeline": "[<'scroll-timeline-name'> <'scroll-timeline-axis'>?]#",
    "scroll-timeline-axis": "[block|inline|x|y]#",
    "scroll-timeline-name": "[none|<dashed-ident>]#",
    "scrollbar-color": "auto|<color>{2}",
    "scrollbar-gutter": "auto|stable&&both-edges?",
    "scrollbar-width": "auto|thin|none",
    "shape-image-threshold": "<opacity-value>",
    "shape-margin": "<length-percentage>",
    "shape-outside": "none|[<shape-box>||<basic-shape>]|<image>",
    "shape-rendering": "auto|optimizeSpeed|crispEdges|geometricPrecision",
    "speak-as": "normal|spell-out||digits||[literal-punctuation|no-punctuation]",
    "stop-color": "<'color'>",
    "stop-opacity": "<'opacity'>",
    "stroke": "<paint>",
    "stroke-color": "<color>",
    "stroke-dasharray": "none|[<svg-length>+]#",
    "stroke-dashoffset": "<svg-length>",
    "stroke-linecap": "butt|round|square",
    "stroke-linejoin": "miter|round|bevel",
    "stroke-miterlimit": "<number-one-or-greater>",
    "stroke-opacity": "<'opacity'>",
    "stroke-width": "<svg-length>",
    "tab-size": "<integer>|<length>",
    "table-layout": "auto|fixed",
    "text-align": "start|end|left|right|center|justify|match-parent",
    "text-align-last": "auto|start|end|left|right|center|justify",
    "text-anchor": "start|middle|end",
    "text-autospace": "normal|<autospace>|auto",
    "text-box": "normal|<'text-box-trim'>||<'text-box-edge'>",
    "text-box-edge": "auto|<text-edge>",
    "text-box-trim": "none|trim-start|trim-end|trim-both",
    "text-combine-upright": "none|all|[digits <integer>?]",
    "text-decoration": "<'text-decoration-line'>||<'text-decoration-style'>||<'text-decoration-color'>||<'text-decoration-thickness'>",
    "text-decoration-color": "<color>",
    "text-decoration-inset": "<length>{1,2}|auto",
    "text-decoration-line": "none|[underline||overline||line-through||blink]|spelling-error|grammar-error",
    "text-decoration-skip": "none|[objects||[spaces|[leading-spaces||trailing-spaces]]||edges||box-decoration]",
    "text-decoration-skip-ink": "auto|all|none",
    "text-decoration-style": "solid|double|dotted|dashed|wavy",
    "text-decoration-thickness": "auto|from-font|<length>|<percentage>",
    "text-emphasis": "<'text-emphasis-style'>||<'text-emphasis-color'>",
    "text-emphasis-color": "<color>",
    "text-emphasis-position": "auto|[over|under]&&[right|left]?",
    "text-emphasis-style": "none|[[filled|open]||[dot|circle|double-circle|triangle|sesame]]|<string>",
    "text-indent": "<length-percentage>&&hanging?&&each-line?",
    "text-justify": "auto|inter-character|inter-word|none",
    "text-orientation": "mixed|upright|sideways",
    "text-overflow": "[clip|ellipsis|<string>]{1,2}",
    "text-rendering": "auto|optimizeSpeed|optimizeLegibility|geometricPrecision",
    "text-shadow": "none|<shadow-t>#",
    "text-size-adjust": "none|auto|<percentage>",
    "text-spacing-trim": "space-all|normal|space-first|trim-start",
    "text-transform": "none|[capitalize|uppercase|lowercase]||full-width||full-size-kana|math-auto",
    "text-underline-offset": "auto|<length>|<percentage>",
    "text-underline-position": "auto|from-font|[under||[left|right]]",
    "text-wrap": "<'text-wrap-mode'>||<'text-wrap-style'>",
    "text-wrap-mode": "wrap|nowrap",
    "text-wrap-style": "auto|balance|stable|pretty",
    "timeline-scope": "none|<dashed-ident>#",
    "timeline-trigger": "none|[<'timeline-trigger-name'> <'timeline-trigger-source'> <'timeline-trigger-range'> ['/' <'timeline-trigger-exit-range'>]?]#",
    "timeline-trigger-name": "none|<dashed-ident>#",
    "timeline-trigger-exit-range": "[<'timeline-trigger-exit-range-start'> <'timeline-trigger-exit-range-end'>?]#",
    "timeline-trigger-exit-range-end": "[auto|normal|<length-percentage>|<timeline-range-name> <length-percentage>?]#",
    "timeline-trigger-exit-range-start": "[auto|normal|<length-percentage>|<timeline-range-name> <length-percentage>?]#",
    "timeline-trigger-range": "[<'timeline-trigger-range-start'> <'timeline-trigger-range-end'>?]#",
    "timeline-trigger-range-end": "[normal|<length-percentage>|<timeline-range-name> <length-percentage>?]#",
    "timeline-trigger-range-start": "[normal|<length-percentage>|<timeline-range-name> <length-percentage>?]#",
    "timeline-trigger-source": "<single-animation-timeline>#",
    "top": "auto|<length-percentage>|<anchor()>|<anchor-size()>",
    "touch-action": "auto|none|[[pan-x|pan-left|pan-right]||[pan-y|pan-up|pan-down]||pinch-zoom]|manipulation",
    "transform": "none|<transform-list>",
    "transform-box": "content-box|border-box|fill-box|stroke-box|view-box",
    "transform-origin": "[<length-percentage>|left|center|right|top|bottom]|[[<length-percentage>|left|center|right]&&[<length-percentage>|top|center|bottom]] <length>?",
    "transform-style": "flat|preserve-3d",
    "transition": "<single-transition>#",
    "transition-behavior": "<transition-behavior-value>#",
    "transition-delay": "<time>#",
    "transition-duration": "<time>#",
    "transition-property": "none|<single-transition-property>#",
    "transition-timing-function": "<easing-function>#",
    "translate": "none|<length-percentage> [<length-percentage> <length>?]?",
    "trigger-scope": "none|all|<dashed-ident>#",
    "unicode-bidi": "normal|embed|isolate|bidi-override|isolate-override|plaintext|-moz-isolate|-moz-isolate-override|-moz-plaintext|-webkit-isolate|-webkit-isolate-override|-webkit-plaintext",
    "user-select": "auto|text|none|all",
    "vector-effect": "none|non-scaling-stroke|non-scaling-size|non-rotation|fixed-position",
    "vertical-align": "baseline|sub|super|text-top|text-bottom|middle|top|bottom|<percentage>|<length>",
    "view-timeline": "[<'view-timeline-name'> [<'view-timeline-axis'>||<'view-timeline-inset'>]?]#",
    "view-timeline-axis": "[block|inline|x|y]#",
    "view-timeline-inset": "[[auto|<length-percentage>]{1,2}]#",
    "view-timeline-name": "[none|<dashed-ident>]#",
    "view-transition-class": "none|<custom-ident>+",
    "view-transition-name": "none|<custom-ident>|match-element",
    "visibility": "visible|hidden|collapse",
    "white-space": "normal|pre|pre-wrap|pre-line|<'white-space-collapse'>||<'text-wrap-mode'>",
    "white-space-collapse": "collapse|preserve|preserve-breaks|preserve-spaces|break-spaces",
    "widows": "<integer>",
    "width": "auto|<length-percentage [0,∞]>|min-content|max-content|fit-content|fit-content( <length-percentage [0,∞]> )|<calc-size()>|<anchor-size()>|stretch|<-non-standard-size>",
    "will-change": "auto|<animateable-feature>#",
    "word-break": "normal|break-all|keep-all|break-word|auto-phrase",
    "word-spacing": "normal|<length>",
    "word-wrap": "normal|break-word",
    "writing-mode": "horizontal-tb|vertical-rl|vertical-lr|sideways-rl|sideways-lr|<svg-writing-mode>",
    "x": "<length>|<percentage>",
    "y": "<length>|<percentage>",
    "z-index": "auto|<integer>",
    "zoom": "normal|reset|<number [0,∞]>||<percentage [0,∞]>",
    "-moz-background-clip": "padding|border",
    "-moz-border-radius-bottomleft": "<'border-bottom-left-radius'>",
    "-moz-border-radius-bottomright": "<'border-bottom-right-radius'>",
    "-moz-border-radius-topleft": "<'border-top-left-radius'>",
    "-moz-border-radius-topright": "<'border-bottom-right-radius'>",
    "-moz-control-character-visibility": "visible|hidden",
    "-moz-osx-font-smoothing": "auto|grayscale",
    "-moz-user-select": "none|text|all|-moz-none",
    "-ms-flex-align": "start|end|center|baseline|stretch",
    "-ms-flex-item-align": "auto|start|end|center|baseline|stretch",
    "-ms-flex-line-pack": "start|end|center|justify|distribute|stretch",
    "-ms-flex-negative": "<'flex-shrink'>",
    "-ms-flex-pack": "start|end|center|justify|distribute",
    "-ms-flex-order": "<integer>",
    "-ms-flex-positive": "<'flex-grow'>",
    "-ms-flex-preferred-size": "<'flex-basis'>",
    "-ms-interpolation-mode": "nearest-neighbor|bicubic",
    "-ms-grid-column-align": "start|end|center|stretch",
    "-ms-grid-row-align": "start|end|center|stretch",
    "-ms-hyphenate-limit-last": "none|always|column|page|spread",
    "-webkit-background-clip": "[<visual-box>|border|padding|content|text]#",
    "-webkit-column-break-after": "always|auto|avoid",
    "-webkit-column-break-before": "always|auto|avoid",
    "-webkit-column-break-inside": "always|auto|avoid",
    "-webkit-font-smoothing": "auto|none|antialiased|subpixel-antialiased",
    "-webkit-mask-box-image": "[<url>|<gradient>|none] [<length-percentage>{4} <-webkit-mask-box-repeat>{2}]?",
    "-webkit-print-color-adjust": "economy|exact",
    "-webkit-text-security": "none|circle|disc|square",
    "-webkit-user-drag": "none|element|auto",
    "behavior": "<url>+",
    "cue": "<'cue-before'> <'cue-after'>?",
    "cue-after": "<url> <decibel>?|none",
    "cue-before": "<url> <decibel>?|none",
    "glyph-orientation-horizontal": "<angle>",
    "glyph-orientation-vertical": "<angle>",
    "kerning": "auto|<svg-length>",
    "pause": "<'pause-before'> <'pause-after'>?",
    "pause-after": "<time>|none|x-weak|weak|medium|strong|x-strong",
    "pause-before": "<time>|none|x-weak|weak|medium|strong|x-strong",
    "position-try-options": "<'position-try-fallbacks'>",
    "rest": "<'rest-before'> <'rest-after'>?",
    "rest-after": "<time>|none|x-weak|weak|medium|strong|x-strong",
    "rest-before": "<time>|none|x-weak|weak|medium|strong|x-strong",
    "speak": "auto|never|always",
    "voice-balance": "<number>|left|center|right|leftwards|rightwards",
    "voice-duration": "auto|<time>",
    "voice-family": "[[<family-name>|<generic-voice>] ,]* [<family-name>|<generic-voice>]|preserve",
    "voice-pitch": "<frequency>&&absolute|[[x-low|low|medium|high|x-high]||[<frequency>|<semitones>|<percentage>]]",
    "voice-range": "<frequency>&&absolute|[[x-low|low|medium|high|x-high]||[<frequency>|<semitones>|<percentage>]]",
    "voice-rate": "[normal|x-slow|slow|medium|fast|x-fast]||<percentage>",
    "voice-stress": "normal|strong|moderate|none|reduced",
    "voice-volume": "silent|[[x-soft|soft|medium|loud|x-loud]||<decibel>]",
    "white-space-trim": "none|discard-before||discard-after||discard-inner"
  },
  "atrules": {
    "charset": {
      "prelude": "<string>",
      "descriptors": null
    },
    "counter-style": {
      "prelude": "<counter-style-name>",
      "descriptors": {
        "additive-symbols": "[<integer [0,∞]>&&<symbol>]#",
        "fallback": "<counter-style-name>",
        "negative": "<symbol> <symbol>?",
        "pad": "<integer [0,∞]>&&<symbol>",
        "prefix": "<symbol>",
        "range": "[[<integer>|infinite]{2}]#|auto",
        "speak-as": "auto|bullets|numbers|words|spell-out|<counter-style-name>",
        "suffix": "<symbol>",
        "symbols": "<symbol>+",
        "system": "cyclic|numeric|alphabetic|symbolic|additive|[fixed <integer>?]|[extends <counter-style-name>]"
      }
    },
    "container": {
      "prelude": "[<container-name>]? <container-condition>",
      "descriptors": null
    },
    "document": {
      "prelude": "[<url>|url-prefix( <string> )|domain( <string> )|media-document( <string> )|regexp( <string> )]#",
      "descriptors": null
    },
    "font-face": {
      "prelude": null,
      "descriptors": {
        "ascent-override": "normal|<percentage>",
        "descent-override": "normal|<percentage>",
        "font-display": "auto|block|swap|fallback|optional",
        "font-family": "<family-name>",
        "font-feature-settings": "normal|<feature-tag-value>#",
        "font-stretch": "<font-stretch-absolute>{1,2}",
        "font-style": "normal|italic|oblique <angle>{0,2}",
        "font-variation-settings": "normal|[<string> <number>]#",
        "font-weight": "<font-weight-absolute>{1,2}",
        "line-gap-override": "normal|<percentage>",
        "size-adjust": "<percentage>",
        "src": "[<url> [format( <string># )]?|local( <family-name> )]#",
        "unicode-range": "<urange>#"
      }
    },
    "font-feature-values": {
      "prelude": "<family-name>#",
      "descriptors": null
    },
    "font-palette-values": {
      "prelude": "<dashed-ident>",
      "descriptors": {
        "base-palette": "light|dark|<integer [0,∞]>",
        "font-family": "<family-name>#",
        "override-colors": "[<integer [0,∞]> <color>]#"
      }
    },
    "import": {
      "prelude": "[<string>|<url>] [layer|layer( <layer-name> )]? [supports( [<supports-condition>|<declaration>] )]? <media-query-list>?",
      "descriptors": null
    },
    "keyframes": {
      "prelude": "<keyframes-name>",
      "descriptors": null
    },
    "layer": {
      "prelude": "[<layer-name>#|<layer-name>?]",
      "descriptors": null
    },
    "media": {
      "prelude": "<media-query-list>",
      "descriptors": null
    },
    "namespace": {
      "prelude": "<namespace-prefix>? [<string>|<url>]",
      "descriptors": null
    },
    "page": {
      "prelude": "<page-selector-list>",
      "descriptors": {
        "bleed": "auto|<length>",
        "marks": "none|[crop||cross]",
        "page-orientation": "upright|rotate-left|rotate-right",
        "size": "<length [0,∞]>{1,2}|auto|[<page-size>||[portrait|landscape]]"
      }
    },
    "position-try": {
      "prelude": "<dashed-ident>",
      "descriptors": {
        "top": "<'top'>",
        "left": "<'left'>",
        "bottom": "<'bottom'>",
        "right": "<'right'>",
        "inset-block-start": "<'inset-block-start'>",
        "inset-block-end": "<'inset-block-end'>",
        "inset-inline-start": "<'inset-inline-start'>",
        "inset-inline-end": "<'inset-inline-end'>",
        "inset-block": "<'inset-block'>",
        "inset-inline": "<'inset-inline'>",
        "inset": "<'inset'>",
        "margin-top": "<'margin-top'>",
        "margin-left": "<'margin-left'>",
        "margin-bottom": "<'margin-bottom'>",
        "margin-right": "<'margin-right'>",
        "margin-block-start": "<'margin-block-start'>",
        "margin-block-end": "<'margin-block-end'>",
        "margin-inline-start": "<'margin-inline-start'>",
        "margin-inline-end": "<'margin-inline-end'>",
        "margin": "<'margin'>",
        "margin-block": "<'margin-block'>",
        "margin-inline": "<'margin-inline'>",
        "width": "<'width'>",
        "height": "<'height'>",
        "min-width": "<'min-width'>",
        "min-height": "<'min-height'>",
        "max-width": "<'max-width'>",
        "max-height": "<'max-height'>",
        "block-size": "<'block-size'>",
        "inline-size": "<'inline-size'>",
        "min-block-size": "<'min-block-size'>",
        "min-inline-size": "<'min-inline-size'>",
        "max-block-size": "<'max-block-size'>",
        "max-inline-size": "<'max-inline-size'>",
        "align-self": "<'align-self'>|anchor-center",
        "justify-self": "<'justify-self'>|anchor-center"
      }
    },
    "property": {
      "prelude": "<custom-property-name>",
      "descriptors": {
        "inherits": "true|false",
        "initial-value": "<declaration-value>?",
        "syntax": "<string>"
      }
    },
    "scope": {
      "prelude": "[( <scope-start> )]? [to ( <scope-end> )]?",
      "descriptors": null
    },
    "starting-style": {
      "prelude": null,
      "descriptors": null
    },
    "supports": {
      "prelude": "<supports-condition>",
      "descriptors": null
    },
    "view-transition": {
      "prelude": null,
      "descriptors": {
        "navigation": "auto|none",
        "types": "none|<custom-ident>+"
      }
    },
    "font-features-values": {
      "prelude": "[<string>|<custom-ident>]+",
      "descriptors": {
        "font-display": "auto|block|swap|fallback|optional"
      }
    }
  }
};
const PLUSSIGN$5 = 43;
const HYPHENMINUS$2 = 45;
const N = 110;
const DISALLOW_SIGN = true;
const ALLOW_SIGN = false;
function checkInteger(offset, disallowSign) {
  let pos = this.tokenStart + offset;
  const code2 = this.charCodeAt(pos);
  if (code2 === PLUSSIGN$5 || code2 === HYPHENMINUS$2) {
    if (disallowSign) {
      this.error("Number sign is not allowed");
    }
    pos++;
  }
  for (; pos < this.tokenEnd; pos++) {
    if (!isDigit(this.charCodeAt(pos))) {
      this.error("Integer is expected", pos);
    }
  }
}
function checkTokenIsInteger(disallowSign) {
  return checkInteger.call(this, 0, disallowSign);
}
function expectCharCode(offset, code2) {
  if (!this.cmpChar(this.tokenStart + offset, code2)) {
    let msg = "";
    switch (code2) {
      case N:
        msg = "N is expected";
        break;
      case HYPHENMINUS$2:
        msg = "HyphenMinus is expected";
        break;
    }
    this.error(msg, this.tokenStart + offset);
  }
}
function consumeB() {
  let offset = 0;
  let sign = 0;
  let type = this.tokenType;
  while (type === WhiteSpace$1 || type === Comment$1) {
    type = this.lookupType(++offset);
  }
  if (type !== Number$2) {
    if (this.isDelim(PLUSSIGN$5, offset) || this.isDelim(HYPHENMINUS$2, offset)) {
      sign = this.isDelim(PLUSSIGN$5, offset) ? PLUSSIGN$5 : HYPHENMINUS$2;
      do {
        type = this.lookupType(++offset);
      } while (type === WhiteSpace$1 || type === Comment$1);
      if (type !== Number$2) {
        this.skip(offset);
        checkTokenIsInteger.call(this, DISALLOW_SIGN);
      }
    } else {
      return null;
    }
  }
  if (offset > 0) {
    this.skip(offset);
  }
  if (sign === 0) {
    type = this.charCodeAt(this.tokenStart);
    if (type !== PLUSSIGN$5 && type !== HYPHENMINUS$2) {
      this.error("Number sign is expected");
    }
  }
  checkTokenIsInteger.call(this, sign !== 0);
  return sign === HYPHENMINUS$2 ? "-" + this.consume(Number$2) : this.consume(Number$2);
}
const name$M = "AnPlusB";
const structure$M = {
  a: [String, null],
  b: [String, null]
};
function parse$N() {
  const start = this.tokenStart;
  let a = null;
  let b = null;
  if (this.tokenType === Number$2) {
    checkTokenIsInteger.call(this, ALLOW_SIGN);
    b = this.consume(Number$2);
  } else if (this.tokenType === Ident && this.cmpChar(this.tokenStart, HYPHENMINUS$2)) {
    a = "-1";
    expectCharCode.call(this, 1, N);
    switch (this.tokenEnd - this.tokenStart) {
      // -n
      // -n <signed-integer>
      // -n ['+' | '-'] <signless-integer>
      case 2:
        this.next();
        b = consumeB.call(this);
        break;
      // -n- <signless-integer>
      case 3:
        expectCharCode.call(this, 2, HYPHENMINUS$2);
        this.next();
        this.skipSC();
        checkTokenIsInteger.call(this, DISALLOW_SIGN);
        b = "-" + this.consume(Number$2);
        break;
      // <dashndashdigit-ident>
      default:
        expectCharCode.call(this, 2, HYPHENMINUS$2);
        checkInteger.call(this, 3, DISALLOW_SIGN);
        this.next();
        b = this.substrToCursor(start + 2);
    }
  } else if (this.tokenType === Ident || this.isDelim(PLUSSIGN$5) && this.lookupType(1) === Ident) {
    let sign = 0;
    a = "1";
    if (this.isDelim(PLUSSIGN$5)) {
      sign = 1;
      this.next();
    }
    expectCharCode.call(this, 0, N);
    switch (this.tokenEnd - this.tokenStart) {
      // '+'? n
      // '+'? n <signed-integer>
      // '+'? n ['+' | '-'] <signless-integer>
      case 1:
        this.next();
        b = consumeB.call(this);
        break;
      // '+'? n- <signless-integer>
      case 2:
        expectCharCode.call(this, 1, HYPHENMINUS$2);
        this.next();
        this.skipSC();
        checkTokenIsInteger.call(this, DISALLOW_SIGN);
        b = "-" + this.consume(Number$2);
        break;
      // '+'? <ndashdigit-ident>
      default:
        expectCharCode.call(this, 1, HYPHENMINUS$2);
        checkInteger.call(this, 2, DISALLOW_SIGN);
        this.next();
        b = this.substrToCursor(start + sign + 1);
    }
  } else if (this.tokenType === Dimension$1) {
    const code2 = this.charCodeAt(this.tokenStart);
    const sign = code2 === PLUSSIGN$5 || code2 === HYPHENMINUS$2;
    let i = this.tokenStart + sign;
    for (; i < this.tokenEnd; i++) {
      if (!isDigit(this.charCodeAt(i))) {
        break;
      }
    }
    if (i === this.tokenStart + sign) {
      this.error("Integer is expected", this.tokenStart + sign);
    }
    expectCharCode.call(this, i - this.tokenStart, N);
    a = this.substring(start, i);
    if (i + 1 === this.tokenEnd) {
      this.next();
      b = consumeB.call(this);
    } else {
      expectCharCode.call(this, i - this.tokenStart + 1, HYPHENMINUS$2);
      if (i + 2 === this.tokenEnd) {
        this.next();
        this.skipSC();
        checkTokenIsInteger.call(this, DISALLOW_SIGN);
        b = "-" + this.consume(Number$2);
      } else {
        checkInteger.call(this, i - this.tokenStart + 2, DISALLOW_SIGN);
        this.next();
        b = this.substrToCursor(i + 1);
      }
    }
  } else {
    this.error();
  }
  if (a !== null && a.charCodeAt(0) === PLUSSIGN$5) {
    a = a.substr(1);
  }
  if (b !== null && b.charCodeAt(0) === PLUSSIGN$5) {
    b = b.substr(1);
  }
  return {
    type: "AnPlusB",
    loc: this.getLocation(start, this.tokenStart),
    a,
    b
  };
}
function generate$N(node2) {
  if (node2.a) {
    const a = node2.a === "+1" && "n" || node2.a === "1" && "n" || node2.a === "-1" && "-n" || node2.a + "n";
    if (node2.b) {
      const b = node2.b[0] === "-" || node2.b[0] === "+" ? node2.b : "+" + node2.b;
      this.tokenize(a + b);
    } else {
      this.tokenize(a);
    }
  } else {
    this.tokenize(node2.b);
  }
}
const AnPlusB = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$N,
  name: name$M,
  parse: parse$N,
  structure: structure$M
}, Symbol.toStringTag, { value: "Module" }));
function consumeRaw$4() {
  return this.Raw(this.consumeUntilLeftCurlyBracketOrSemicolon, true);
}
function isDeclarationBlockAtrule() {
  for (let offset = 1, type; type = this.lookupType(offset); offset++) {
    if (type === RightCurlyBracket) {
      return true;
    }
    if (type === LeftCurlyBracket || type === AtKeyword) {
      return false;
    }
  }
  return false;
}
const name$L = "Atrule";
const walkContext$9 = "atrule";
const structure$L = {
  name: String,
  prelude: ["AtrulePrelude", "Raw", null],
  block: ["Block", null]
};
function parse$M(isDeclaration = false) {
  const start = this.tokenStart;
  let name2;
  let nameLowerCase;
  let prelude = null;
  let block = null;
  this.eat(AtKeyword);
  name2 = this.substrToCursor(start + 1);
  nameLowerCase = name2.toLowerCase();
  this.skipSC();
  if (this.eof === false && this.tokenType !== LeftCurlyBracket && this.tokenType !== Semicolon) {
    if (this.parseAtrulePrelude) {
      prelude = this.parseWithFallback(this.AtrulePrelude.bind(this, name2, isDeclaration), consumeRaw$4);
    } else {
      prelude = consumeRaw$4.call(this, this.tokenIndex);
    }
    this.skipSC();
  }
  switch (this.tokenType) {
    case Semicolon:
      this.next();
      break;
    case LeftCurlyBracket:
      if (hasOwnProperty.call(this.atrule, nameLowerCase) && typeof this.atrule[nameLowerCase].block === "function") {
        block = this.atrule[nameLowerCase].block.call(this, isDeclaration);
      } else {
        block = this.Block(isDeclarationBlockAtrule.call(this));
      }
      break;
  }
  return {
    type: "Atrule",
    loc: this.getLocation(start, this.tokenStart),
    name: name2,
    prelude,
    block
  };
}
function generate$M(node2) {
  this.token(AtKeyword, "@" + node2.name);
  if (node2.prelude !== null) {
    this.node(node2.prelude);
  }
  if (node2.block) {
    this.node(node2.block);
  } else {
    this.token(Semicolon, ";");
  }
}
const Atrule = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$M,
  name: name$L,
  parse: parse$M,
  structure: structure$L,
  walkContext: walkContext$9
}, Symbol.toStringTag, { value: "Module" }));
const name$K = "AtrulePrelude";
const walkContext$8 = "atrulePrelude";
const structure$K = {
  children: [[]]
};
function parse$L(name2) {
  let children = null;
  if (name2 !== null) {
    name2 = name2.toLowerCase();
  }
  this.skipSC();
  if (hasOwnProperty.call(this.atrule, name2) && typeof this.atrule[name2].prelude === "function") {
    children = this.atrule[name2].prelude.call(this);
  } else {
    children = this.readSequence(this.scope.AtrulePrelude);
  }
  this.skipSC();
  if (this.eof !== true && this.tokenType !== LeftCurlyBracket && this.tokenType !== Semicolon) {
    this.error("Semicolon or block is expected");
  }
  return {
    type: "AtrulePrelude",
    loc: this.getLocationFromList(children),
    children
  };
}
function generate$L(node2) {
  this.children(node2);
}
const AtrulePrelude = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$L,
  name: name$K,
  parse: parse$L,
  structure: structure$K,
  walkContext: walkContext$8
}, Symbol.toStringTag, { value: "Module" }));
const DOLLARSIGN$1 = 36;
const ASTERISK$5 = 42;
const EQUALSSIGN$1 = 61;
const CIRCUMFLEXACCENT = 94;
const VERTICALLINE$2 = 124;
const TILDE$2 = 126;
function getAttributeName() {
  if (this.eof) {
    this.error("Unexpected end of input");
  }
  const start = this.tokenStart;
  let expectIdent = false;
  if (this.isDelim(ASTERISK$5)) {
    expectIdent = true;
    this.next();
  } else if (!this.isDelim(VERTICALLINE$2)) {
    this.eat(Ident);
  }
  if (this.isDelim(VERTICALLINE$2)) {
    if (this.charCodeAt(this.tokenStart + 1) !== EQUALSSIGN$1) {
      this.next();
      this.eat(Ident);
    } else if (expectIdent) {
      this.error("Identifier is expected", this.tokenEnd);
    }
  } else if (expectIdent) {
    this.error("Vertical line is expected");
  }
  return {
    type: "Identifier",
    loc: this.getLocation(start, this.tokenStart),
    name: this.substrToCursor(start)
  };
}
function getOperator() {
  const start = this.tokenStart;
  const code2 = this.charCodeAt(start);
  if (code2 !== EQUALSSIGN$1 && // =
  code2 !== TILDE$2 && // ~=
  code2 !== CIRCUMFLEXACCENT && // ^=
  code2 !== DOLLARSIGN$1 && // $=
  code2 !== ASTERISK$5 && // *=
  code2 !== VERTICALLINE$2) {
    this.error("Attribute selector (=, ~=, ^=, $=, *=, |=) is expected");
  }
  this.next();
  if (code2 !== EQUALSSIGN$1) {
    if (!this.isDelim(EQUALSSIGN$1)) {
      this.error("Equal sign is expected");
    }
    this.next();
  }
  return this.substrToCursor(start);
}
const name$J = "AttributeSelector";
const structure$J = {
  name: "Identifier",
  matcher: [String, null],
  value: ["String", "Identifier", null],
  flags: [String, null]
};
function parse$K() {
  const start = this.tokenStart;
  let name2;
  let matcher = null;
  let value2 = null;
  let flags = null;
  this.eat(LeftSquareBracket);
  this.skipSC();
  name2 = getAttributeName.call(this);
  this.skipSC();
  if (this.tokenType !== RightSquareBracket) {
    if (this.tokenType !== Ident) {
      matcher = getOperator.call(this);
      this.skipSC();
      value2 = this.tokenType === String$2 ? this.String() : this.Identifier();
      this.skipSC();
    }
    if (this.tokenType === Ident) {
      flags = this.consume(Ident);
      this.skipSC();
    }
  }
  this.eat(RightSquareBracket);
  return {
    type: "AttributeSelector",
    loc: this.getLocation(start, this.tokenStart),
    name: name2,
    matcher,
    value: value2,
    flags
  };
}
function generate$K(node2) {
  this.token(Delim, "[");
  this.node(node2.name);
  if (node2.matcher !== null) {
    this.tokenize(node2.matcher);
    this.node(node2.value);
  }
  if (node2.flags !== null) {
    this.token(Ident, node2.flags);
  }
  this.token(Delim, "]");
}
const AttributeSelector = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$K,
  name: name$J,
  parse: parse$K,
  structure: structure$J
}, Symbol.toStringTag, { value: "Module" }));
const AMPERSAND$4 = 38;
function consumeRaw$3() {
  return this.Raw(null, true);
}
function consumeRule() {
  return this.parseWithFallback(this.Rule, consumeRaw$3);
}
function consumeRawDeclaration() {
  return this.Raw(this.consumeUntilSemicolonIncluded, true);
}
function consumeDeclaration() {
  if (this.tokenType === Semicolon) {
    return consumeRawDeclaration.call(this, this.tokenIndex);
  }
  const node2 = this.parseWithFallback(this.Declaration, consumeRawDeclaration);
  if (this.tokenType === Semicolon) {
    this.next();
  }
  return node2;
}
const name$I = "Block";
const walkContext$7 = "block";
const structure$I = {
  children: [[
    "Atrule",
    "Rule",
    "Declaration"
  ]]
};
function parse$J(isStyleBlock) {
  const consumer = isStyleBlock ? consumeDeclaration : consumeRule;
  const start = this.tokenStart;
  let children = this.createList();
  this.eat(LeftCurlyBracket);
  scan:
    while (!this.eof) {
      switch (this.tokenType) {
        case RightCurlyBracket:
          break scan;
        case WhiteSpace$1:
        case Comment$1:
          this.next();
          break;
        case AtKeyword:
          children.push(this.parseWithFallback(this.Atrule.bind(this, isStyleBlock), consumeRaw$3));
          break;
        default:
          if (isStyleBlock && this.isDelim(AMPERSAND$4)) {
            children.push(consumeRule.call(this));
          } else {
            children.push(consumer.call(this));
          }
      }
    }
  if (!this.eof) {
    this.eat(RightCurlyBracket);
  }
  return {
    type: "Block",
    loc: this.getLocation(start, this.tokenStart),
    children
  };
}
function generate$J(node2) {
  this.token(LeftCurlyBracket, "{");
  this.children(node2, (prev) => {
    if (prev.type === "Declaration") {
      this.token(Semicolon, ";");
    }
  });
  this.token(RightCurlyBracket, "}");
}
const Block = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$J,
  name: name$I,
  parse: parse$J,
  structure: structure$I,
  walkContext: walkContext$7
}, Symbol.toStringTag, { value: "Module" }));
const name$H = "Brackets";
const structure$H = {
  children: [[]]
};
function parse$I(readSequence2, recognizer) {
  const start = this.tokenStart;
  let children = null;
  this.eat(LeftSquareBracket);
  children = readSequence2.call(this, recognizer);
  if (!this.eof) {
    this.eat(RightSquareBracket);
  }
  return {
    type: "Brackets",
    loc: this.getLocation(start, this.tokenStart),
    children
  };
}
function generate$I(node2) {
  this.token(Delim, "[");
  this.children(node2);
  this.token(Delim, "]");
}
const Brackets = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$I,
  name: name$H,
  parse: parse$I,
  structure: structure$H
}, Symbol.toStringTag, { value: "Module" }));
const name$G = "CDC";
const structure$G = [];
function parse$H() {
  const start = this.tokenStart;
  this.eat(CDC$1);
  return {
    type: "CDC",
    loc: this.getLocation(start, this.tokenStart)
  };
}
function generate$H() {
  this.token(CDC$1, "-->");
}
const CDC = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$H,
  name: name$G,
  parse: parse$H,
  structure: structure$G
}, Symbol.toStringTag, { value: "Module" }));
const name$F = "CDO";
const structure$F = [];
function parse$G() {
  const start = this.tokenStart;
  this.eat(CDO$1);
  return {
    type: "CDO",
    loc: this.getLocation(start, this.tokenStart)
  };
}
function generate$G() {
  this.token(CDO$1, "<!--");
}
const CDO = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$G,
  name: name$F,
  parse: parse$G,
  structure: structure$F
}, Symbol.toStringTag, { value: "Module" }));
const FULLSTOP$2 = 46;
const name$E = "ClassSelector";
const structure$E = {
  name: String
};
function parse$F() {
  this.eatDelim(FULLSTOP$2);
  return {
    type: "ClassSelector",
    loc: this.getLocation(this.tokenStart - 1, this.tokenEnd),
    name: this.consume(Ident)
  };
}
function generate$F(node2) {
  this.token(Delim, ".");
  this.token(Ident, node2.name);
}
const ClassSelector = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$F,
  name: name$E,
  parse: parse$F,
  structure: structure$E
}, Symbol.toStringTag, { value: "Module" }));
const PLUSSIGN$4 = 43;
const SOLIDUS$7 = 47;
const GREATERTHANSIGN$2 = 62;
const TILDE$1 = 126;
const name$D = "Combinator";
const structure$D = {
  name: String
};
function parse$E() {
  const start = this.tokenStart;
  let name2;
  switch (this.tokenType) {
    case WhiteSpace$1:
      name2 = " ";
      break;
    case Delim:
      switch (this.charCodeAt(this.tokenStart)) {
        case GREATERTHANSIGN$2:
        case PLUSSIGN$4:
        case TILDE$1:
          this.next();
          break;
        case SOLIDUS$7:
          this.next();
          this.eatIdent("deep");
          this.eatDelim(SOLIDUS$7);
          break;
        default:
          this.error("Combinator is expected");
      }
      name2 = this.substrToCursor(start);
      break;
  }
  return {
    type: "Combinator",
    loc: this.getLocation(start, this.tokenStart),
    name: name2
  };
}
function generate$E(node2) {
  this.tokenize(node2.name);
}
const Combinator = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$E,
  name: name$D,
  parse: parse$E,
  structure: structure$D
}, Symbol.toStringTag, { value: "Module" }));
const ASTERISK$4 = 42;
const SOLIDUS$6 = 47;
const name$C = "Comment";
const structure$C = {
  value: String
};
function parse$D() {
  const start = this.tokenStart;
  let end = this.tokenEnd;
  this.eat(Comment$1);
  if (end - start + 2 >= 2 && this.charCodeAt(end - 2) === ASTERISK$4 && this.charCodeAt(end - 1) === SOLIDUS$6) {
    end -= 2;
  }
  return {
    type: "Comment",
    loc: this.getLocation(start, this.tokenStart),
    value: this.substring(start + 2, end)
  };
}
function generate$D(node2) {
  this.token(Comment$1, "/*" + node2.value + "*/");
}
const Comment = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$D,
  name: name$C,
  parse: parse$D,
  structure: structure$C
}, Symbol.toStringTag, { value: "Module" }));
const likelyFeatureToken = /* @__PURE__ */ new Set([Colon, RightParenthesis, EOF$1]);
const name$B = "Condition";
const structure$B = {
  kind: String,
  children: [[
    "Identifier",
    "Feature",
    "FeatureFunction",
    "FeatureRange",
    "SupportsDeclaration"
  ]]
};
function featureOrRange(kind) {
  if (this.lookupTypeNonSC(1) === Ident && likelyFeatureToken.has(this.lookupTypeNonSC(2))) {
    return this.Feature(kind);
  }
  return this.FeatureRange(kind);
}
const parentheses = {
  media: featureOrRange,
  container: featureOrRange,
  supports() {
    return this.SupportsDeclaration();
  }
};
function parse$C(kind = "media") {
  const children = this.createList();
  scan: while (!this.eof) {
    switch (this.tokenType) {
      case Comment$1:
      case WhiteSpace$1:
        this.next();
        continue;
      case Ident:
        children.push(this.Identifier());
        break;
      case LeftParenthesis: {
        let term = this.parseWithFallback(
          () => parentheses[kind].call(this, kind),
          () => null
        );
        if (!term) {
          term = this.parseWithFallback(
            () => {
              this.eat(LeftParenthesis);
              const res = this.Condition(kind);
              this.eat(RightParenthesis);
              return res;
            },
            () => {
              return this.GeneralEnclosed(kind);
            }
          );
        }
        children.push(term);
        break;
      }
      case Function$1: {
        let term = this.parseWithFallback(
          () => this.FeatureFunction(kind),
          () => null
        );
        if (!term) {
          term = this.GeneralEnclosed(kind);
        }
        children.push(term);
        break;
      }
      default:
        break scan;
    }
  }
  if (children.isEmpty) {
    this.error("Condition is expected");
  }
  return {
    type: "Condition",
    loc: this.getLocationFromList(children),
    kind,
    children
  };
}
function generate$C(node2) {
  node2.children.forEach((child) => {
    if (child.type === "Condition") {
      this.token(LeftParenthesis, "(");
      this.node(child);
      this.token(RightParenthesis, ")");
    } else {
      this.node(child);
    }
  });
}
const Condition = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$C,
  name: name$B,
  parse: parse$C,
  structure: structure$B
}, Symbol.toStringTag, { value: "Module" }));
const EXCLAMATIONMARK$1 = 33;
const NUMBERSIGN$2 = 35;
const DOLLARSIGN = 36;
const AMPERSAND$3 = 38;
const ASTERISK$3 = 42;
const PLUSSIGN$3 = 43;
const SOLIDUS$5 = 47;
function consumeValueRaw() {
  return this.Raw(this.consumeUntilExclamationMarkOrSemicolon, true);
}
function consumeCustomPropertyRaw() {
  return this.Raw(this.consumeUntilExclamationMarkOrSemicolon, false);
}
function consumeValue() {
  const startValueToken = this.tokenIndex;
  const value2 = this.Value();
  if (value2.type !== "Raw" && this.eof === false && this.tokenType !== Semicolon && this.isDelim(EXCLAMATIONMARK$1) === false && this.isBalanceEdge(startValueToken) === false) {
    this.error();
  }
  return value2;
}
const name$A = "Declaration";
const walkContext$6 = "declaration";
const structure$A = {
  important: [Boolean, String],
  property: String,
  value: ["Value", "Raw"]
};
function parse$B() {
  const start = this.tokenStart;
  const startToken = this.tokenIndex;
  const property2 = readProperty.call(this);
  const customProperty = isCustomProperty(property2);
  const parseValue = customProperty ? this.parseCustomProperty : this.parseValue;
  const consumeRaw2 = customProperty ? consumeCustomPropertyRaw : consumeValueRaw;
  let important = false;
  let value2;
  this.skipSC();
  this.eat(Colon);
  const valueStart = this.tokenIndex;
  if (!customProperty) {
    this.skipSC();
  }
  if (parseValue) {
    value2 = this.parseWithFallback(consumeValue, consumeRaw2);
  } else {
    value2 = consumeRaw2.call(this, this.tokenIndex);
  }
  if (customProperty && value2.type === "Value" && value2.children.isEmpty) {
    for (let offset = valueStart - this.tokenIndex; offset <= 0; offset++) {
      if (this.lookupType(offset) === WhiteSpace$1) {
        value2.children.appendData({
          type: "WhiteSpace",
          loc: null,
          value: " "
        });
        break;
      }
    }
  }
  if (this.isDelim(EXCLAMATIONMARK$1)) {
    important = getImportant.call(this);
    this.skipSC();
  }
  if (this.eof === false && this.tokenType !== Semicolon && this.isBalanceEdge(startToken) === false) {
    this.error();
  }
  return {
    type: "Declaration",
    loc: this.getLocation(start, this.tokenStart),
    important,
    property: property2,
    value: value2
  };
}
function generate$B(node2) {
  this.token(Ident, node2.property);
  this.token(Colon, ":");
  this.node(node2.value);
  if (node2.important) {
    this.token(Delim, "!");
    this.token(Ident, node2.important === true ? "important" : node2.important);
  }
}
function readProperty() {
  const start = this.tokenStart;
  if (this.tokenType === Delim) {
    switch (this.charCodeAt(this.tokenStart)) {
      case ASTERISK$3:
      case DOLLARSIGN:
      case PLUSSIGN$3:
      case NUMBERSIGN$2:
      case AMPERSAND$3:
        this.next();
        break;
      // TODO: not sure we should support this hack
      case SOLIDUS$5:
        this.next();
        if (this.isDelim(SOLIDUS$5)) {
          this.next();
        }
        break;
    }
  }
  if (this.tokenType === Hash$1) {
    this.eat(Hash$1);
  } else {
    this.eat(Ident);
  }
  return this.substrToCursor(start);
}
function getImportant() {
  this.eat(Delim);
  this.skipSC();
  const important = this.consume(Ident);
  return important === "important" ? true : important;
}
const Declaration = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$B,
  name: name$A,
  parse: parse$B,
  structure: structure$A,
  walkContext: walkContext$6
}, Symbol.toStringTag, { value: "Module" }));
const AMPERSAND$2 = 38;
function consumeRaw$2() {
  return this.Raw(this.consumeUntilSemicolonIncluded, true);
}
const name$z = "DeclarationList";
const structure$z = {
  children: [[
    "Declaration",
    "Atrule",
    "Rule"
  ]]
};
function parse$A() {
  const children = this.createList();
  while (!this.eof) {
    switch (this.tokenType) {
      case WhiteSpace$1:
      case Comment$1:
      case Semicolon:
        this.next();
        break;
      case AtKeyword:
        children.push(this.parseWithFallback(this.Atrule.bind(this, true), consumeRaw$2));
        break;
      default:
        if (this.isDelim(AMPERSAND$2)) {
          children.push(this.parseWithFallback(this.Rule, consumeRaw$2));
        } else {
          children.push(this.parseWithFallback(this.Declaration, consumeRaw$2));
        }
    }
  }
  return {
    type: "DeclarationList",
    loc: this.getLocationFromList(children),
    children
  };
}
function generate$A(node2) {
  this.children(node2, (prev) => {
    if (prev.type === "Declaration") {
      this.token(Semicolon, ";");
    }
  });
}
const DeclarationList = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$A,
  name: name$z,
  parse: parse$A,
  structure: structure$z
}, Symbol.toStringTag, { value: "Module" }));
const name$y = "Dimension";
const structure$y = {
  value: String,
  unit: String
};
function parse$z() {
  const start = this.tokenStart;
  const value2 = this.consumeNumber(Dimension$1);
  return {
    type: "Dimension",
    loc: this.getLocation(start, this.tokenStart),
    value: value2,
    unit: this.substring(start + value2.length, this.tokenStart)
  };
}
function generate$z(node2) {
  this.token(Dimension$1, node2.value + node2.unit);
}
const Dimension = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$z,
  name: name$y,
  parse: parse$z,
  structure: structure$y
}, Symbol.toStringTag, { value: "Module" }));
const SOLIDUS$4 = 47;
const name$x = "Feature";
const structure$x = {
  kind: String,
  name: String,
  value: ["Identifier", "Number", "Dimension", "Ratio", "Function", null]
};
function parse$y(kind) {
  const start = this.tokenStart;
  let name2;
  let value2 = null;
  this.eat(LeftParenthesis);
  this.skipSC();
  name2 = this.consume(Ident);
  this.skipSC();
  if (this.tokenType !== RightParenthesis) {
    this.eat(Colon);
    this.skipSC();
    switch (this.tokenType) {
      case Number$2:
        if (this.lookupNonWSType(1) === Delim) {
          value2 = this.Ratio();
        } else {
          value2 = this.Number();
        }
        break;
      case Dimension$1:
        value2 = this.Dimension();
        break;
      case Ident:
        value2 = this.Identifier();
        break;
      case Function$1:
        value2 = this.parseWithFallback(
          () => {
            const res = this.Function(this.readSequence, this.scope.Value);
            this.skipSC();
            if (this.isDelim(SOLIDUS$4)) {
              this.error();
            }
            return res;
          },
          () => {
            return this.Ratio();
          }
        );
        break;
      default:
        this.error("Number, dimension, ratio or identifier is expected");
    }
    this.skipSC();
  }
  if (!this.eof) {
    this.eat(RightParenthesis);
  }
  return {
    type: "Feature",
    loc: this.getLocation(start, this.tokenStart),
    kind,
    name: name2,
    value: value2
  };
}
function generate$y(node2) {
  this.token(LeftParenthesis, "(");
  this.token(Ident, node2.name);
  if (node2.value !== null) {
    this.token(Colon, ":");
    this.node(node2.value);
  }
  this.token(RightParenthesis, ")");
}
const Feature = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$y,
  name: name$x,
  parse: parse$y,
  structure: structure$x
}, Symbol.toStringTag, { value: "Module" }));
const name$w = "FeatureFunction";
const structure$w = {
  kind: String,
  feature: String,
  value: ["Declaration", "Selector"]
};
function getFeatureParser(kind, name2) {
  const featuresOfKind = this.features[kind] || {};
  const parser = featuresOfKind[name2];
  if (typeof parser !== "function") {
    this.error(`Unknown feature ${name2}()`);
  }
  return parser;
}
function parse$x(kind = "unknown") {
  const start = this.tokenStart;
  const functionName = this.consumeFunctionName();
  const valueParser = getFeatureParser.call(this, kind, functionName.toLowerCase());
  this.skipSC();
  const value2 = this.parseWithFallback(
    () => {
      const startValueToken = this.tokenIndex;
      const value3 = valueParser.call(this);
      if (this.eof === false && this.isBalanceEdge(startValueToken) === false) {
        this.error();
      }
      return value3;
    },
    () => this.Raw(null, false)
  );
  if (!this.eof) {
    this.eat(RightParenthesis);
  }
  return {
    type: "FeatureFunction",
    loc: this.getLocation(start, this.tokenStart),
    kind,
    feature: functionName,
    value: value2
  };
}
function generate$x(node2) {
  this.token(Function$1, node2.feature + "(");
  this.node(node2.value);
  this.token(RightParenthesis, ")");
}
const FeatureFunction = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$x,
  name: name$w,
  parse: parse$x,
  structure: structure$w
}, Symbol.toStringTag, { value: "Module" }));
const SOLIDUS$3 = 47;
const LESSTHANSIGN = 60;
const EQUALSSIGN = 61;
const GREATERTHANSIGN$1 = 62;
const name$v = "FeatureRange";
const structure$v = {
  kind: String,
  left: ["Identifier", "Number", "Dimension", "Ratio", "Function"],
  leftComparison: String,
  middle: ["Identifier", "Number", "Dimension", "Ratio", "Function"],
  rightComparison: [String, null],
  right: ["Identifier", "Number", "Dimension", "Ratio", "Function", null]
};
function readTerm() {
  this.skipSC();
  switch (this.tokenType) {
    case Number$2:
      if (this.isDelim(SOLIDUS$3, this.lookupOffsetNonSC(1))) {
        return this.Ratio();
      } else {
        return this.Number();
      }
    case Dimension$1:
      return this.Dimension();
    case Ident:
      return this.Identifier();
    case Function$1:
      return this.parseWithFallback(
        () => {
          const res = this.Function(this.readSequence, this.scope.Value);
          this.skipSC();
          if (this.isDelim(SOLIDUS$3)) {
            this.error();
          }
          return res;
        },
        () => {
          return this.Ratio();
        }
      );
    default:
      this.error("Number, dimension, ratio or identifier is expected");
  }
}
function readComparison(expectColon) {
  this.skipSC();
  if (this.isDelim(LESSTHANSIGN) || this.isDelim(GREATERTHANSIGN$1)) {
    const value2 = this.source[this.tokenStart];
    this.next();
    if (this.isDelim(EQUALSSIGN)) {
      this.next();
      return value2 + "=";
    }
    return value2;
  }
  if (this.isDelim(EQUALSSIGN)) {
    return "=";
  }
  this.error(`Expected ${expectColon ? '":", ' : ""}"<", ">", "=" or ")"`);
}
function parse$w(kind = "unknown") {
  const start = this.tokenStart;
  this.skipSC();
  this.eat(LeftParenthesis);
  const left = readTerm.call(this);
  const leftComparison = readComparison.call(this, left.type === "Identifier");
  const middle = readTerm.call(this);
  let rightComparison = null;
  let right = null;
  if (this.lookupNonWSType(0) !== RightParenthesis) {
    rightComparison = readComparison.call(this);
    right = readTerm.call(this);
  }
  this.skipSC();
  this.eat(RightParenthesis);
  return {
    type: "FeatureRange",
    loc: this.getLocation(start, this.tokenStart),
    kind,
    left,
    leftComparison,
    middle,
    rightComparison,
    right
  };
}
function generate$w(node2) {
  this.token(LeftParenthesis, "(");
  this.node(node2.left);
  this.tokenize(node2.leftComparison);
  this.node(node2.middle);
  if (node2.right) {
    this.tokenize(node2.rightComparison);
    this.node(node2.right);
  }
  this.token(RightParenthesis, ")");
}
const FeatureRange = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$w,
  name: name$v,
  parse: parse$w,
  structure: structure$v
}, Symbol.toStringTag, { value: "Module" }));
const name$u = "Function";
const walkContext$5 = "function";
const structure$u = {
  name: String,
  children: [[]]
};
function parse$v(readSequence2, recognizer) {
  const start = this.tokenStart;
  const name2 = this.consumeFunctionName();
  const nameLowerCase = name2.toLowerCase();
  let children;
  children = recognizer.hasOwnProperty(nameLowerCase) ? recognizer[nameLowerCase].call(this, recognizer) : readSequence2.call(this, recognizer);
  if (!this.eof) {
    this.eat(RightParenthesis);
  }
  return {
    type: "Function",
    loc: this.getLocation(start, this.tokenStart),
    name: name2,
    children
  };
}
function generate$v(node2) {
  this.token(Function$1, node2.name + "(");
  this.children(node2);
  this.token(RightParenthesis, ")");
}
const Function = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$v,
  name: name$u,
  parse: parse$v,
  structure: structure$u,
  walkContext: walkContext$5
}, Symbol.toStringTag, { value: "Module" }));
const name$t = "GeneralEnclosed";
const structure$t = {
  kind: String,
  function: [String, null],
  children: [[]]
};
function parse$u(kind) {
  const start = this.tokenStart;
  let functionName = null;
  if (this.tokenType === Function$1) {
    functionName = this.consumeFunctionName();
  } else {
    this.eat(LeftParenthesis);
  }
  const children = this.parseWithFallback(
    () => {
      const startValueToken = this.tokenIndex;
      const children2 = this.readSequence(this.scope.Value);
      if (this.eof === false && this.isBalanceEdge(startValueToken) === false) {
        this.error();
      }
      return children2;
    },
    () => this.createSingleNodeList(
      this.Raw(null, false)
    )
  );
  if (!this.eof) {
    this.eat(RightParenthesis);
  }
  return {
    type: "GeneralEnclosed",
    loc: this.getLocation(start, this.tokenStart),
    kind,
    function: functionName,
    children
  };
}
function generate$u(node2) {
  if (node2.function) {
    this.token(Function$1, node2.function + "(");
  } else {
    this.token(LeftParenthesis, "(");
  }
  this.children(node2);
  this.token(RightParenthesis, ")");
}
const GeneralEnclosed = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$u,
  name: name$t,
  parse: parse$u,
  structure: structure$t
}, Symbol.toStringTag, { value: "Module" }));
const xxx = "XXX";
const name$s = "Hash";
const structure$s = {
  value: String
};
function parse$t() {
  const start = this.tokenStart;
  this.eat(Hash$1);
  return {
    type: "Hash",
    loc: this.getLocation(start, this.tokenStart),
    value: this.substrToCursor(start + 1)
  };
}
function generate$t(node2) {
  this.token(Hash$1, "#" + node2.value);
}
const Hash = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$t,
  name: name$s,
  parse: parse$t,
  structure: structure$s,
  xxx
}, Symbol.toStringTag, { value: "Module" }));
const name$r = "Identifier";
const structure$r = {
  name: String
};
function parse$s() {
  return {
    type: "Identifier",
    loc: this.getLocation(this.tokenStart, this.tokenEnd),
    name: this.consume(Ident)
  };
}
function generate$s(node2) {
  this.token(Ident, node2.name);
}
const Identifier = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$s,
  name: name$r,
  parse: parse$s,
  structure: structure$r
}, Symbol.toStringTag, { value: "Module" }));
const name$q = "IdSelector";
const structure$q = {
  name: String
};
function parse$r() {
  const start = this.tokenStart;
  this.eat(Hash$1);
  return {
    type: "IdSelector",
    loc: this.getLocation(start, this.tokenStart),
    name: this.substrToCursor(start + 1)
  };
}
function generate$r(node2) {
  this.token(Delim, "#" + node2.name);
}
const IdSelector = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$r,
  name: name$q,
  parse: parse$r,
  structure: structure$q
}, Symbol.toStringTag, { value: "Module" }));
const FULLSTOP$1 = 46;
const name$p = "Layer";
const structure$p = {
  name: String
};
function parse$q() {
  let tokenStart = this.tokenStart;
  let name2 = this.consume(Ident);
  while (this.isDelim(FULLSTOP$1)) {
    this.eat(Delim);
    name2 += "." + this.consume(Ident);
  }
  return {
    type: "Layer",
    loc: this.getLocation(tokenStart, this.tokenStart),
    name: name2
  };
}
function generate$q(node2) {
  this.tokenize(node2.name);
}
const Layer = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$q,
  name: name$p,
  parse: parse$q,
  structure: structure$p
}, Symbol.toStringTag, { value: "Module" }));
const name$o = "LayerList";
const structure$o = {
  children: [[
    "Layer"
  ]]
};
function parse$p() {
  const children = this.createList();
  this.skipSC();
  while (!this.eof) {
    children.push(this.Layer());
    if (this.lookupTypeNonSC(0) !== Comma) {
      break;
    }
    this.skipSC();
    this.next();
    this.skipSC();
  }
  return {
    type: "LayerList",
    loc: this.getLocationFromList(children),
    children
  };
}
function generate$p(node2) {
  this.children(node2, () => this.token(Comma, ","));
}
const LayerList = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$p,
  name: name$o,
  parse: parse$p,
  structure: structure$o
}, Symbol.toStringTag, { value: "Module" }));
const name$n = "MediaQuery";
const structure$n = {
  modifier: [String, null],
  mediaType: [String, null],
  condition: ["Condition", null]
};
function parse$o() {
  const start = this.tokenStart;
  let modifier = null;
  let mediaType = null;
  let condition = null;
  this.skipSC();
  if (this.tokenType === Ident && this.lookupTypeNonSC(1) !== LeftParenthesis) {
    const ident = this.consume(Ident);
    const identLowerCase = ident.toLowerCase();
    if (identLowerCase === "not" || identLowerCase === "only") {
      this.skipSC();
      modifier = identLowerCase;
      mediaType = this.consume(Ident);
    } else {
      mediaType = ident;
    }
    switch (this.lookupTypeNonSC(0)) {
      case Ident: {
        this.skipSC();
        this.eatIdent("and");
        condition = this.Condition("media");
        break;
      }
      case LeftCurlyBracket:
      case Semicolon:
      case Comma:
      case EOF$1:
        break;
      default:
        this.error("Identifier or parenthesis is expected");
    }
  } else {
    switch (this.tokenType) {
      case Ident:
      case LeftParenthesis:
      case Function$1: {
        condition = this.Condition("media");
        break;
      }
      case LeftCurlyBracket:
      case Semicolon:
      case EOF$1:
        break;
      default:
        this.error("Identifier or parenthesis is expected");
    }
  }
  return {
    type: "MediaQuery",
    loc: this.getLocation(start, this.tokenStart),
    modifier,
    mediaType,
    condition
  };
}
function generate$o(node2) {
  if (node2.mediaType) {
    if (node2.modifier) {
      this.token(Ident, node2.modifier);
    }
    this.token(Ident, node2.mediaType);
    if (node2.condition) {
      this.token(Ident, "and");
      this.node(node2.condition);
    }
  } else if (node2.condition) {
    this.node(node2.condition);
  }
}
const MediaQuery = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$o,
  name: name$n,
  parse: parse$o,
  structure: structure$n
}, Symbol.toStringTag, { value: "Module" }));
const name$m = "MediaQueryList";
const structure$m = {
  children: [[
    "MediaQuery"
  ]]
};
function parse$n() {
  const children = this.createList();
  this.skipSC();
  while (!this.eof) {
    children.push(this.MediaQuery());
    if (this.tokenType !== Comma) {
      break;
    }
    this.next();
  }
  return {
    type: "MediaQueryList",
    loc: this.getLocationFromList(children),
    children
  };
}
function generate$n(node2) {
  this.children(node2, () => this.token(Comma, ","));
}
const MediaQueryList = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$n,
  name: name$m,
  parse: parse$n,
  structure: structure$m
}, Symbol.toStringTag, { value: "Module" }));
const AMPERSAND$1 = 38;
const name$l = "NestingSelector";
const structure$l = {};
function parse$m() {
  const start = this.tokenStart;
  this.eatDelim(AMPERSAND$1);
  return {
    type: "NestingSelector",
    loc: this.getLocation(start, this.tokenStart)
  };
}
function generate$m() {
  this.token(Delim, "&");
}
const NestingSelector = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$m,
  name: name$l,
  parse: parse$m,
  structure: structure$l
}, Symbol.toStringTag, { value: "Module" }));
const name$k = "Nth";
const structure$k = {
  nth: ["AnPlusB", "Identifier"],
  selector: ["SelectorList", null]
};
function parse$l() {
  this.skipSC();
  const start = this.tokenStart;
  let end = start;
  let selector2 = null;
  let nth2;
  if (this.lookupValue(0, "odd") || this.lookupValue(0, "even")) {
    nth2 = this.Identifier();
  } else {
    nth2 = this.AnPlusB();
  }
  end = this.tokenStart;
  this.skipSC();
  if (this.lookupValue(0, "of")) {
    this.next();
    selector2 = this.SelectorList();
    end = this.tokenStart;
  }
  return {
    type: "Nth",
    loc: this.getLocation(start, end),
    nth: nth2,
    selector: selector2
  };
}
function generate$l(node2) {
  this.node(node2.nth);
  if (node2.selector !== null) {
    this.token(Ident, "of");
    this.node(node2.selector);
  }
}
const Nth = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$l,
  name: name$k,
  parse: parse$l,
  structure: structure$k
}, Symbol.toStringTag, { value: "Module" }));
const name$j = "Number";
const structure$j = {
  value: String
};
function parse$k() {
  return {
    type: "Number",
    loc: this.getLocation(this.tokenStart, this.tokenEnd),
    value: this.consume(Number$2)
  };
}
function generate$k(node2) {
  this.token(Number$2, node2.value);
}
const Number$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$k,
  name: name$j,
  parse: parse$k,
  structure: structure$j
}, Symbol.toStringTag, { value: "Module" }));
const name$i = "Operator";
const structure$i = {
  value: String
};
function parse$j() {
  const start = this.tokenStart;
  this.next();
  return {
    type: "Operator",
    loc: this.getLocation(start, this.tokenStart),
    value: this.substrToCursor(start)
  };
}
function generate$j(node2) {
  this.tokenize(node2.value);
}
const Operator = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$j,
  name: name$i,
  parse: parse$j,
  structure: structure$i
}, Symbol.toStringTag, { value: "Module" }));
const name$h = "Parentheses";
const structure$h = {
  children: [[]]
};
function parse$i(readSequence2, recognizer) {
  const start = this.tokenStart;
  let children = null;
  this.eat(LeftParenthesis);
  children = readSequence2.call(this, recognizer);
  if (!this.eof) {
    this.eat(RightParenthesis);
  }
  return {
    type: "Parentheses",
    loc: this.getLocation(start, this.tokenStart),
    children
  };
}
function generate$i(node2) {
  this.token(LeftParenthesis, "(");
  this.children(node2);
  this.token(RightParenthesis, ")");
}
const Parentheses = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$i,
  name: name$h,
  parse: parse$i,
  structure: structure$h
}, Symbol.toStringTag, { value: "Module" }));
const name$g = "Percentage";
const structure$g = {
  value: String
};
function parse$h() {
  return {
    type: "Percentage",
    loc: this.getLocation(this.tokenStart, this.tokenEnd),
    value: this.consumeNumber(Percentage$1)
  };
}
function generate$h(node2) {
  this.token(Percentage$1, node2.value + "%");
}
const Percentage = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$h,
  name: name$g,
  parse: parse$h,
  structure: structure$g
}, Symbol.toStringTag, { value: "Module" }));
const name$f = "PseudoClassSelector";
const walkContext$4 = "function";
const structure$f = {
  name: String,
  children: [["Raw"], null]
};
function parse$g() {
  const start = this.tokenStart;
  let children = null;
  let name2;
  let nameLowerCase;
  this.eat(Colon);
  if (this.tokenType === Function$1) {
    name2 = this.consumeFunctionName();
    nameLowerCase = name2.toLowerCase();
    if (this.lookupNonWSType(0) == RightParenthesis) {
      children = this.createList();
    } else if (hasOwnProperty.call(this.pseudo, nameLowerCase)) {
      this.skipSC();
      children = this.pseudo[nameLowerCase].call(this);
      this.skipSC();
    } else {
      children = this.createList();
      children.push(
        this.Raw(null, false)
      );
    }
    this.eat(RightParenthesis);
  } else {
    name2 = this.consume(Ident);
  }
  return {
    type: "PseudoClassSelector",
    loc: this.getLocation(start, this.tokenStart),
    name: name2,
    children
  };
}
function generate$g(node2) {
  this.token(Colon, ":");
  if (node2.children === null) {
    this.token(Ident, node2.name);
  } else {
    this.token(Function$1, node2.name + "(");
    this.children(node2);
    this.token(RightParenthesis, ")");
  }
}
const PseudoClassSelector = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$g,
  name: name$f,
  parse: parse$g,
  structure: structure$f,
  walkContext: walkContext$4
}, Symbol.toStringTag, { value: "Module" }));
const name$e = "PseudoElementSelector";
const walkContext$3 = "function";
const structure$e = {
  name: String,
  children: [["Raw"], null]
};
function parse$f() {
  const start = this.tokenStart;
  let children = null;
  let name2;
  let nameLowerCase;
  this.eat(Colon);
  this.eat(Colon);
  if (this.tokenType === Function$1) {
    name2 = this.consumeFunctionName();
    nameLowerCase = name2.toLowerCase();
    if (this.lookupNonWSType(0) == RightParenthesis) {
      children = this.createList();
    } else if (hasOwnProperty.call(this.pseudo, nameLowerCase)) {
      this.skipSC();
      children = this.pseudo[nameLowerCase].call(this);
      this.skipSC();
    } else {
      children = this.createList();
      children.push(
        this.Raw(null, false)
      );
    }
    this.eat(RightParenthesis);
  } else {
    name2 = this.consume(Ident);
  }
  return {
    type: "PseudoElementSelector",
    loc: this.getLocation(start, this.tokenStart),
    name: name2,
    children
  };
}
function generate$f(node2) {
  this.token(Colon, ":");
  this.token(Colon, ":");
  if (node2.children === null) {
    this.token(Ident, node2.name);
  } else {
    this.token(Function$1, node2.name + "(");
    this.children(node2);
    this.token(RightParenthesis, ")");
  }
}
const PseudoElementSelector = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$f,
  name: name$e,
  parse: parse$f,
  structure: structure$e,
  walkContext: walkContext$3
}, Symbol.toStringTag, { value: "Module" }));
const SOLIDUS$2 = 47;
function consumeTerm() {
  this.skipSC();
  switch (this.tokenType) {
    case Number$2:
      return this.Number();
    case Function$1:
      return this.Function(this.readSequence, this.scope.Value);
    default:
      this.error("Number of function is expected");
  }
}
const name$d = "Ratio";
const structure$d = {
  left: ["Number", "Function"],
  right: ["Number", "Function", null]
};
function parse$e() {
  const start = this.tokenStart;
  const left = consumeTerm.call(this);
  let right = null;
  this.skipSC();
  if (this.isDelim(SOLIDUS$2)) {
    this.eatDelim(SOLIDUS$2);
    right = consumeTerm.call(this);
  }
  return {
    type: "Ratio",
    loc: this.getLocation(start, this.tokenStart),
    left,
    right
  };
}
function generate$e(node2) {
  this.node(node2.left);
  this.token(Delim, "/");
  if (node2.right) {
    this.node(node2.right);
  } else {
    this.node(Number$2, 1);
  }
}
const Ratio = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$e,
  name: name$d,
  parse: parse$e,
  structure: structure$d
}, Symbol.toStringTag, { value: "Module" }));
function getOffsetExcludeWS() {
  if (this.tokenIndex > 0) {
    if (this.lookupType(-1) === WhiteSpace$1) {
      return this.tokenIndex > 1 ? this.getTokenStart(this.tokenIndex - 1) : this.firstCharOffset;
    }
  }
  return this.tokenStart;
}
const name$c = "Raw";
const structure$c = {
  value: String
};
function parse$d(consumeUntil, excludeWhiteSpace) {
  const startOffset = this.getTokenStart(this.tokenIndex);
  let endOffset;
  this.skipUntilBalanced(this.tokenIndex, consumeUntil || this.consumeUntilBalanceEnd);
  if (excludeWhiteSpace && this.tokenStart > startOffset) {
    endOffset = getOffsetExcludeWS.call(this);
  } else {
    endOffset = this.tokenStart;
  }
  return {
    type: "Raw",
    loc: this.getLocation(startOffset, endOffset),
    value: this.substring(startOffset, endOffset)
  };
}
function generate$d(node2) {
  this.tokenize(node2.value);
}
const Raw = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$d,
  name: name$c,
  parse: parse$d,
  structure: structure$c
}, Symbol.toStringTag, { value: "Module" }));
function consumeRaw$1() {
  return this.Raw(this.consumeUntilLeftCurlyBracket, true);
}
function consumePrelude() {
  const prelude = this.SelectorList();
  if (prelude.type !== "Raw" && this.eof === false && this.tokenType !== LeftCurlyBracket) {
    this.error();
  }
  return prelude;
}
const name$b = "Rule";
const walkContext$2 = "rule";
const structure$b = {
  prelude: ["SelectorList", "Raw"],
  block: ["Block"]
};
function parse$c() {
  const startToken = this.tokenIndex;
  const startOffset = this.tokenStart;
  let prelude;
  let block;
  if (this.parseRulePrelude) {
    prelude = this.parseWithFallback(consumePrelude, consumeRaw$1);
  } else {
    prelude = consumeRaw$1.call(this, startToken);
  }
  block = this.Block(true);
  return {
    type: "Rule",
    loc: this.getLocation(startOffset, this.tokenStart),
    prelude,
    block
  };
}
function generate$c(node2) {
  this.node(node2.prelude);
  this.node(node2.block);
}
const Rule = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$c,
  name: name$b,
  parse: parse$c,
  structure: structure$b,
  walkContext: walkContext$2
}, Symbol.toStringTag, { value: "Module" }));
const name$a = "Scope";
const structure$a = {
  root: ["SelectorList", "Raw", null],
  limit: ["SelectorList", "Raw", null]
};
function parse$b() {
  let root = null;
  let limit = null;
  this.skipSC();
  const startOffset = this.tokenStart;
  if (this.tokenType === LeftParenthesis) {
    this.next();
    this.skipSC();
    root = this.parseWithFallback(
      this.SelectorList,
      () => this.Raw(false, true)
    );
    this.skipSC();
    this.eat(RightParenthesis);
  }
  if (this.lookupNonWSType(0) === Ident) {
    this.skipSC();
    this.eatIdent("to");
    this.skipSC();
    this.eat(LeftParenthesis);
    this.skipSC();
    limit = this.parseWithFallback(
      this.SelectorList,
      () => this.Raw(false, true)
    );
    this.skipSC();
    this.eat(RightParenthesis);
  }
  return {
    type: "Scope",
    loc: this.getLocation(startOffset, this.tokenStart),
    root,
    limit
  };
}
function generate$b(node2) {
  if (node2.root) {
    this.token(LeftParenthesis, "(");
    this.node(node2.root);
    this.token(RightParenthesis, ")");
  }
  if (node2.limit) {
    this.token(Ident, "to");
    this.token(LeftParenthesis, "(");
    this.node(node2.limit);
    this.token(RightParenthesis, ")");
  }
}
const Scope = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$b,
  name: name$a,
  parse: parse$b,
  structure: structure$a
}, Symbol.toStringTag, { value: "Module" }));
const name$9 = "Selector";
const structure$9 = {
  children: [[
    "TypeSelector",
    "IdSelector",
    "ClassSelector",
    "AttributeSelector",
    "PseudoClassSelector",
    "PseudoElementSelector",
    "Combinator"
  ]]
};
function parse$a() {
  const children = this.readSequence(this.scope.Selector);
  if (this.getFirstListNode(children) === null) {
    this.error("Selector is expected");
  }
  return {
    type: "Selector",
    loc: this.getLocationFromList(children),
    children
  };
}
function generate$a(node2) {
  this.children(node2);
}
const Selector = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$a,
  name: name$9,
  parse: parse$a,
  structure: structure$9
}, Symbol.toStringTag, { value: "Module" }));
const name$8 = "SelectorList";
const walkContext$1 = "selector";
const structure$8 = {
  children: [[
    "Selector",
    "Raw"
  ]]
};
function parse$9() {
  const children = this.createList();
  while (!this.eof) {
    children.push(this.Selector());
    if (this.tokenType === Comma) {
      this.next();
      continue;
    }
    break;
  }
  return {
    type: "SelectorList",
    loc: this.getLocationFromList(children),
    children
  };
}
function generate$9(node2) {
  this.children(node2, () => this.token(Comma, ","));
}
const SelectorList = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$9,
  name: name$8,
  parse: parse$9,
  structure: structure$8,
  walkContext: walkContext$1
}, Symbol.toStringTag, { value: "Module" }));
const REVERSE_SOLIDUS$1 = 92;
const QUOTATION_MARK$1 = 34;
const APOSTROPHE$1 = 39;
function decode$1(str) {
  const len = str.length;
  const firstChar = str.charCodeAt(0);
  const start = firstChar === QUOTATION_MARK$1 || firstChar === APOSTROPHE$1 ? 1 : 0;
  const end = start === 1 && len > 1 && str.charCodeAt(len - 1) === firstChar ? len - 2 : len - 1;
  let decoded = "";
  for (let i = start; i <= end; i++) {
    let code2 = str.charCodeAt(i);
    if (code2 === REVERSE_SOLIDUS$1) {
      if (i === end) {
        if (i !== len - 1) {
          decoded = str.substr(i + 1);
        }
        break;
      }
      code2 = str.charCodeAt(++i);
      if (isValidEscape(REVERSE_SOLIDUS$1, code2)) {
        const escapeStart = i - 1;
        const escapeEnd = consumeEscaped(str, escapeStart);
        i = escapeEnd - 1;
        decoded += decodeEscaped(str.substring(escapeStart + 1, escapeEnd));
      } else {
        if (code2 === 13 && str.charCodeAt(i + 1) === 10) {
          i++;
        }
      }
    } else {
      decoded += str[i];
    }
  }
  return decoded;
}
function encode$1(str, apostrophe) {
  const quote = '"';
  const quoteCode = QUOTATION_MARK$1;
  let encoded = "";
  let wsBeforeHexIsNeeded = false;
  for (let i = 0; i < str.length; i++) {
    const code2 = str.charCodeAt(i);
    if (code2 === 0) {
      encoded += "�";
      continue;
    }
    if (code2 <= 31 || code2 === 127) {
      encoded += "\\" + code2.toString(16);
      wsBeforeHexIsNeeded = true;
      continue;
    }
    if (code2 === quoteCode || code2 === REVERSE_SOLIDUS$1) {
      encoded += "\\" + str.charAt(i);
      wsBeforeHexIsNeeded = false;
    } else {
      if (wsBeforeHexIsNeeded && (isHexDigit(code2) || isWhiteSpace(code2))) {
        encoded += " ";
      }
      encoded += str.charAt(i);
      wsBeforeHexIsNeeded = false;
    }
  }
  return quote + encoded + quote;
}
const name$7 = "String";
const structure$7 = {
  value: String
};
function parse$8() {
  return {
    type: "String",
    loc: this.getLocation(this.tokenStart, this.tokenEnd),
    value: decode$1(this.consume(String$2))
  };
}
function generate$8(node2) {
  this.token(String$2, encode$1(node2.value));
}
const String$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$8,
  name: name$7,
  parse: parse$8,
  structure: structure$7
}, Symbol.toStringTag, { value: "Module" }));
const EXCLAMATIONMARK = 33;
function consumeRaw() {
  return this.Raw(null, false);
}
const name$6 = "StyleSheet";
const walkContext = "stylesheet";
const structure$6 = {
  children: [[
    "Comment",
    "CDO",
    "CDC",
    "Atrule",
    "Rule",
    "Raw"
  ]]
};
function parse$7() {
  const start = this.tokenStart;
  const children = this.createList();
  let child;
  while (!this.eof) {
    switch (this.tokenType) {
      case WhiteSpace$1:
        this.next();
        continue;
      case Comment$1:
        if (this.charCodeAt(this.tokenStart + 2) !== EXCLAMATIONMARK) {
          this.next();
          continue;
        }
        child = this.Comment();
        break;
      case CDO$1:
        child = this.CDO();
        break;
      case CDC$1:
        child = this.CDC();
        break;
      // CSS Syntax Module Level 3
      // §2.2 Error handling
      // At the "top level" of a stylesheet, an <at-keyword-token> starts an at-rule.
      case AtKeyword:
        child = this.parseWithFallback(this.Atrule, consumeRaw);
        break;
      // Anything else starts a qualified rule ...
      default:
        child = this.parseWithFallback(this.Rule, consumeRaw);
    }
    children.push(child);
  }
  return {
    type: "StyleSheet",
    loc: this.getLocation(start, this.tokenStart),
    children
  };
}
function generate$7(node2) {
  this.children(node2);
}
const StyleSheet = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$7,
  name: name$6,
  parse: parse$7,
  structure: structure$6,
  walkContext
}, Symbol.toStringTag, { value: "Module" }));
const name$5 = "SupportsDeclaration";
const structure$5 = {
  declaration: "Declaration"
};
function parse$6() {
  const start = this.tokenStart;
  this.eat(LeftParenthesis);
  this.skipSC();
  const declaration = this.Declaration();
  if (!this.eof) {
    this.eat(RightParenthesis);
  }
  return {
    type: "SupportsDeclaration",
    loc: this.getLocation(start, this.tokenStart),
    declaration
  };
}
function generate$6(node2) {
  this.token(LeftParenthesis, "(");
  this.node(node2.declaration);
  this.token(RightParenthesis, ")");
}
const SupportsDeclaration = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$6,
  name: name$5,
  parse: parse$6,
  structure: structure$5
}, Symbol.toStringTag, { value: "Module" }));
const ASTERISK$2 = 42;
const VERTICALLINE$1 = 124;
function eatIdentifierOrAsterisk() {
  if (this.tokenType !== Ident && this.isDelim(ASTERISK$2) === false) {
    this.error("Identifier or asterisk is expected");
  }
  this.next();
}
const name$4 = "TypeSelector";
const structure$4 = {
  name: String
};
function parse$5() {
  const start = this.tokenStart;
  if (this.isDelim(VERTICALLINE$1)) {
    this.next();
    eatIdentifierOrAsterisk.call(this);
  } else {
    eatIdentifierOrAsterisk.call(this);
    if (this.isDelim(VERTICALLINE$1)) {
      this.next();
      eatIdentifierOrAsterisk.call(this);
    }
  }
  return {
    type: "TypeSelector",
    loc: this.getLocation(start, this.tokenStart),
    name: this.substrToCursor(start)
  };
}
function generate$5(node2) {
  this.tokenize(node2.name);
}
const TypeSelector = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$5,
  name: name$4,
  parse: parse$5,
  structure: structure$4
}, Symbol.toStringTag, { value: "Module" }));
const PLUSSIGN$2 = 43;
const HYPHENMINUS$1 = 45;
const QUESTIONMARK = 63;
function eatHexSequence(offset, allowDash) {
  let len = 0;
  for (let pos = this.tokenStart + offset; pos < this.tokenEnd; pos++) {
    const code2 = this.charCodeAt(pos);
    if (code2 === HYPHENMINUS$1 && allowDash && len !== 0) {
      eatHexSequence.call(this, offset + len + 1, false);
      return -1;
    }
    if (!isHexDigit(code2)) {
      this.error(
        allowDash && len !== 0 ? "Hyphen minus" + (len < 6 ? " or hex digit" : "") + " is expected" : len < 6 ? "Hex digit is expected" : "Unexpected input",
        pos
      );
    }
    if (++len > 6) {
      this.error("Too many hex digits", pos);
    }
  }
  this.next();
  return len;
}
function eatQuestionMarkSequence(max2) {
  let count = 0;
  while (this.isDelim(QUESTIONMARK)) {
    if (++count > max2) {
      this.error("Too many question marks");
    }
    this.next();
  }
}
function startsWith(code2) {
  if (this.charCodeAt(this.tokenStart) !== code2) {
    this.error((code2 === PLUSSIGN$2 ? "Plus sign" : "Hyphen minus") + " is expected");
  }
}
function scanUnicodeRange() {
  let hexLength = 0;
  switch (this.tokenType) {
    case Number$2:
      hexLength = eatHexSequence.call(this, 1, true);
      if (this.isDelim(QUESTIONMARK)) {
        eatQuestionMarkSequence.call(this, 6 - hexLength);
        break;
      }
      if (this.tokenType === Dimension$1 || this.tokenType === Number$2) {
        startsWith.call(this, HYPHENMINUS$1);
        eatHexSequence.call(this, 1, false);
        break;
      }
      break;
    case Dimension$1:
      hexLength = eatHexSequence.call(this, 1, true);
      if (hexLength > 0) {
        eatQuestionMarkSequence.call(this, 6 - hexLength);
      }
      break;
    default:
      this.eatDelim(PLUSSIGN$2);
      if (this.tokenType === Ident) {
        hexLength = eatHexSequence.call(this, 0, true);
        if (hexLength > 0) {
          eatQuestionMarkSequence.call(this, 6 - hexLength);
        }
        break;
      }
      if (this.isDelim(QUESTIONMARK)) {
        this.next();
        eatQuestionMarkSequence.call(this, 5);
        break;
      }
      this.error("Hex digit or question mark is expected");
  }
}
const name$3 = "UnicodeRange";
const structure$3 = {
  value: String
};
function parse$4() {
  const start = this.tokenStart;
  this.eatIdent("u");
  scanUnicodeRange.call(this);
  return {
    type: "UnicodeRange",
    loc: this.getLocation(start, this.tokenStart),
    value: this.substrToCursor(start)
  };
}
function generate$4(node2) {
  this.tokenize(node2.value);
}
const UnicodeRange = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$4,
  name: name$3,
  parse: parse$4,
  structure: structure$3
}, Symbol.toStringTag, { value: "Module" }));
const SPACE$1 = 32;
const REVERSE_SOLIDUS = 92;
const QUOTATION_MARK = 34;
const APOSTROPHE = 39;
const LEFTPARENTHESIS = 40;
const RIGHTPARENTHESIS = 41;
function decode(str) {
  const len = str.length;
  let start = 4;
  let end = str.charCodeAt(len - 1) === RIGHTPARENTHESIS ? len - 2 : len - 1;
  let decoded = "";
  while (start < end && isWhiteSpace(str.charCodeAt(start))) {
    start++;
  }
  while (start < end && isWhiteSpace(str.charCodeAt(end))) {
    end--;
  }
  for (let i = start; i <= end; i++) {
    let code2 = str.charCodeAt(i);
    if (code2 === REVERSE_SOLIDUS) {
      if (i === end) {
        if (i !== len - 1) {
          decoded = str.substr(i + 1);
        }
        break;
      }
      code2 = str.charCodeAt(++i);
      if (isValidEscape(REVERSE_SOLIDUS, code2)) {
        const escapeStart = i - 1;
        const escapeEnd = consumeEscaped(str, escapeStart);
        i = escapeEnd - 1;
        decoded += decodeEscaped(str.substring(escapeStart + 1, escapeEnd));
      } else {
        if (code2 === 13 && str.charCodeAt(i + 1) === 10) {
          i++;
        }
      }
    } else {
      decoded += str[i];
    }
  }
  return decoded;
}
function encode(str) {
  let encoded = "";
  let wsBeforeHexIsNeeded = false;
  for (let i = 0; i < str.length; i++) {
    const code2 = str.charCodeAt(i);
    if (code2 === 0) {
      encoded += "�";
      continue;
    }
    if (code2 <= 31 || code2 === 127) {
      encoded += "\\" + code2.toString(16);
      wsBeforeHexIsNeeded = true;
      continue;
    }
    if (code2 === SPACE$1 || code2 === REVERSE_SOLIDUS || code2 === QUOTATION_MARK || code2 === APOSTROPHE || code2 === LEFTPARENTHESIS || code2 === RIGHTPARENTHESIS) {
      encoded += "\\" + str.charAt(i);
      wsBeforeHexIsNeeded = false;
    } else {
      if (wsBeforeHexIsNeeded && isHexDigit(code2)) {
        encoded += " ";
      }
      encoded += str.charAt(i);
      wsBeforeHexIsNeeded = false;
    }
  }
  return "url(" + encoded + ")";
}
const name$2 = "Url";
const structure$2 = {
  value: String
};
function parse$3() {
  const start = this.tokenStart;
  let value2;
  switch (this.tokenType) {
    case Url$1:
      value2 = decode(this.consume(Url$1));
      break;
    case Function$1:
      if (!this.cmpStr(this.tokenStart, this.tokenEnd, "url(")) {
        this.error("Function name must be `url`");
      }
      this.eat(Function$1);
      this.skipSC();
      value2 = decode$1(this.consume(String$2));
      this.skipSC();
      if (!this.eof) {
        this.eat(RightParenthesis);
      }
      break;
    default:
      this.error("Url or Function is expected");
  }
  return {
    type: "Url",
    loc: this.getLocation(start, this.tokenStart),
    value: value2
  };
}
function generate$3(node2) {
  this.token(Url$1, encode(node2.value));
}
const Url = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$3,
  name: name$2,
  parse: parse$3,
  structure: structure$2
}, Symbol.toStringTag, { value: "Module" }));
const name$1 = "Value";
const structure$1 = {
  children: [[]]
};
function parse$2() {
  const start = this.tokenStart;
  const children = this.readSequence(this.scope.Value);
  return {
    type: "Value",
    loc: this.getLocation(start, this.tokenStart),
    children
  };
}
function generate$2(node2) {
  this.children(node2);
}
const Value = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$2,
  name: name$1,
  parse: parse$2,
  structure: structure$1
}, Symbol.toStringTag, { value: "Module" }));
const SPACE = Object.freeze({
  type: "WhiteSpace",
  loc: null,
  value: " "
});
const name = "WhiteSpace";
const structure = {
  value: String
};
function parse$1() {
  this.eat(WhiteSpace$1);
  return SPACE;
}
function generate$1(node2) {
  this.token(WhiteSpace$1, node2.value);
}
const WhiteSpace = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  generate: generate$1,
  name,
  parse: parse$1,
  structure
}, Symbol.toStringTag, { value: "Module" }));
const node$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AnPlusB,
  Atrule,
  AtrulePrelude,
  AttributeSelector,
  Block,
  Brackets,
  CDC,
  CDO,
  ClassSelector,
  Combinator,
  Comment,
  Condition,
  Declaration,
  DeclarationList,
  Dimension,
  Feature,
  FeatureFunction,
  FeatureRange,
  Function,
  GeneralEnclosed,
  Hash,
  IdSelector,
  Identifier,
  Layer,
  LayerList,
  MediaQuery,
  MediaQueryList,
  NestingSelector,
  Nth,
  Number: Number$1,
  Operator,
  Parentheses,
  Percentage,
  PseudoClassSelector,
  PseudoElementSelector,
  Ratio,
  Raw,
  Rule,
  Scope,
  Selector,
  SelectorList,
  String: String$1,
  StyleSheet,
  SupportsDeclaration,
  TypeSelector,
  UnicodeRange,
  Url,
  Value,
  WhiteSpace
}, Symbol.toStringTag, { value: "Module" }));
const lexerConfig = {
  generic: true,
  cssWideKeywords,
  ...definitions,
  node: node$1
};
const NUMBERSIGN$1 = 35;
const ASTERISK$1 = 42;
const PLUSSIGN$1 = 43;
const HYPHENMINUS = 45;
const SOLIDUS$1 = 47;
const U = 117;
function defaultRecognizer(context) {
  switch (this.tokenType) {
    case Hash$1:
      return this.Hash();
    case Comma:
      return this.Operator();
    case LeftParenthesis:
      return this.Parentheses(this.readSequence, context.recognizer);
    case LeftSquareBracket:
      return this.Brackets(this.readSequence, context.recognizer);
    case String$2:
      return this.String();
    case Dimension$1:
      return this.Dimension();
    case Percentage$1:
      return this.Percentage();
    case Number$2:
      return this.Number();
    case Function$1:
      return this.cmpStr(this.tokenStart, this.tokenEnd, "url(") ? this.Url() : this.Function(this.readSequence, context.recognizer);
    case Url$1:
      return this.Url();
    case Ident:
      if (this.cmpChar(this.tokenStart, U) && this.cmpChar(this.tokenStart + 1, PLUSSIGN$1)) {
        return this.UnicodeRange();
      } else {
        return this.Identifier();
      }
    case Delim: {
      const code2 = this.charCodeAt(this.tokenStart);
      if (code2 === SOLIDUS$1 || code2 === ASTERISK$1 || code2 === PLUSSIGN$1 || code2 === HYPHENMINUS) {
        return this.Operator();
      }
      if (code2 === NUMBERSIGN$1) {
        this.error("Hex or identifier is expected", this.tokenStart + 1);
      }
      break;
    }
  }
}
const atrulePrelude = {
  getNode: defaultRecognizer
};
const NUMBERSIGN = 35;
const AMPERSAND = 38;
const ASTERISK = 42;
const PLUSSIGN = 43;
const SOLIDUS = 47;
const FULLSTOP = 46;
const GREATERTHANSIGN = 62;
const VERTICALLINE = 124;
const TILDE = 126;
function onWhiteSpace(next, children) {
  if (children.last !== null && children.last.type !== "Combinator" && next !== null && next.type !== "Combinator") {
    children.push({
      // FIXME: this.Combinator() should be used instead
      type: "Combinator",
      loc: null,
      name: " "
    });
  }
}
function getNode() {
  switch (this.tokenType) {
    case LeftSquareBracket:
      return this.AttributeSelector();
    case Hash$1:
      return this.IdSelector();
    case Colon:
      if (this.lookupType(1) === Colon) {
        return this.PseudoElementSelector();
      } else {
        return this.PseudoClassSelector();
      }
    case Ident:
      return this.TypeSelector();
    case Number$2:
    case Percentage$1:
      return this.Percentage();
    case Dimension$1:
      if (this.charCodeAt(this.tokenStart) === FULLSTOP) {
        this.error("Identifier is expected", this.tokenStart + 1);
      }
      break;
    case Delim: {
      const code2 = this.charCodeAt(this.tokenStart);
      switch (code2) {
        case PLUSSIGN:
        case GREATERTHANSIGN:
        case TILDE:
        case SOLIDUS:
          return this.Combinator();
        case FULLSTOP:
          return this.ClassSelector();
        case ASTERISK:
        case VERTICALLINE:
          return this.TypeSelector();
        case NUMBERSIGN:
          return this.IdSelector();
        case AMPERSAND:
          return this.NestingSelector();
      }
      break;
    }
  }
}
const selector$1 = {
  onWhiteSpace,
  getNode
};
function expressionFn() {
  return this.createSingleNodeList(
    this.Raw(null, false)
  );
}
function varFn() {
  const children = this.createList();
  this.skipSC();
  children.push(this.Identifier());
  this.skipSC();
  if (this.tokenType === Comma) {
    children.push(this.Operator());
    const startIndex = this.tokenIndex;
    const value2 = this.parseCustomProperty ? this.Value(null) : this.Raw(this.consumeUntilExclamationMarkOrSemicolon, false);
    if (value2.type === "Value" && value2.children.isEmpty) {
      for (let offset = startIndex - this.tokenIndex; offset <= 0; offset++) {
        if (this.lookupType(offset) === WhiteSpace$1) {
          value2.children.appendData({
            type: "WhiteSpace",
            loc: null,
            value: " "
          });
          break;
        }
      }
    }
    children.push(value2);
  }
  return children;
}
function isPlusMinusOperator(node2) {
  return node2 !== null && node2.type === "Operator" && (node2.value[node2.value.length - 1] === "-" || node2.value[node2.value.length - 1] === "+");
}
const value = {
  getNode: defaultRecognizer,
  onWhiteSpace(next, children) {
    if (isPlusMinusOperator(next)) {
      next.value = " " + next.value;
    }
    if (isPlusMinusOperator(children.last)) {
      children.last.value += " ";
    }
  },
  "expression": expressionFn,
  "var": varFn
};
const scope$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AtrulePrelude: atrulePrelude,
  Selector: selector$1,
  Value: value
}, Symbol.toStringTag, { value: "Module" }));
const nonContainerNameKeywords = /* @__PURE__ */ new Set(["none", "and", "not", "or"]);
const container = {
  parse: {
    prelude() {
      const children = this.createList();
      if (this.tokenType === Ident) {
        const name2 = this.substring(this.tokenStart, this.tokenEnd);
        if (!nonContainerNameKeywords.has(name2.toLowerCase())) {
          children.push(this.Identifier());
        }
      }
      children.push(this.Condition("container"));
      return children;
    },
    block(nested = false) {
      return this.Block(nested);
    }
  }
};
const fontFace = {
  parse: {
    prelude: null,
    block() {
      return this.Block(true);
    }
  }
};
function parseWithFallback(parse2, fallback) {
  return this.parseWithFallback(
    () => {
      try {
        return parse2.call(this);
      } finally {
        this.skipSC();
        if (this.lookupNonWSType(0) !== RightParenthesis) {
          this.error();
        }
      }
    },
    fallback || (() => this.Raw(null, true))
  );
}
const parseFunctions = {
  layer() {
    this.skipSC();
    const children = this.createList();
    const node2 = parseWithFallback.call(this, this.Layer);
    if (node2.type !== "Raw" || node2.value !== "") {
      children.push(node2);
    }
    return children;
  },
  supports() {
    this.skipSC();
    const children = this.createList();
    const node2 = parseWithFallback.call(
      this,
      this.Declaration,
      () => parseWithFallback.call(this, () => this.Condition("supports"))
    );
    if (node2.type !== "Raw" || node2.value !== "") {
      children.push(node2);
    }
    return children;
  }
};
const importAtrule = {
  parse: {
    prelude() {
      const children = this.createList();
      switch (this.tokenType) {
        case String$2:
          children.push(this.String());
          break;
        case Url$1:
        case Function$1:
          children.push(this.Url());
          break;
        default:
          this.error("String or url() is expected");
      }
      this.skipSC();
      if (this.tokenType === Ident && this.cmpStr(this.tokenStart, this.tokenEnd, "layer")) {
        children.push(this.Identifier());
      } else if (this.tokenType === Function$1 && this.cmpStr(this.tokenStart, this.tokenEnd, "layer(")) {
        children.push(this.Function(null, parseFunctions));
      }
      this.skipSC();
      if (this.tokenType === Function$1 && this.cmpStr(this.tokenStart, this.tokenEnd, "supports(")) {
        children.push(this.Function(null, parseFunctions));
      }
      if (this.lookupNonWSType(0) === Ident || this.lookupNonWSType(0) === LeftParenthesis) {
        children.push(this.MediaQueryList());
      }
      return children;
    },
    block: null
  }
};
const layer = {
  parse: {
    prelude() {
      return this.createSingleNodeList(
        this.LayerList()
      );
    },
    block() {
      return this.Block(false);
    }
  }
};
const media = {
  parse: {
    prelude() {
      return this.createSingleNodeList(
        this.MediaQueryList()
      );
    },
    block(nested = false) {
      return this.Block(nested);
    }
  }
};
const nest = {
  parse: {
    prelude() {
      return this.createSingleNodeList(
        this.SelectorList()
      );
    },
    block() {
      return this.Block(true);
    }
  }
};
const page = {
  parse: {
    prelude() {
      return this.createSingleNodeList(
        this.SelectorList()
      );
    },
    block() {
      return this.Block(true);
    }
  }
};
const scope = {
  parse: {
    prelude() {
      return this.createSingleNodeList(
        this.Scope()
      );
    },
    block(nested = false) {
      return this.Block(nested);
    }
  }
};
const startingStyle = {
  parse: {
    prelude: null,
    block(nested = false) {
      return this.Block(nested);
    }
  }
};
const supports = {
  parse: {
    prelude() {
      return this.createSingleNodeList(
        this.Condition("supports")
      );
    },
    block(nested = false) {
      return this.Block(nested);
    }
  }
};
const atrule = {
  container,
  "font-face": fontFace,
  import: importAtrule,
  layer,
  media,
  nest,
  page,
  scope,
  "starting-style": startingStyle,
  supports
};
function parseLanguageRangeList() {
  const children = this.createList();
  this.skipSC();
  loop: while (!this.eof) {
    switch (this.tokenType) {
      case Ident:
        children.push(this.Identifier());
        break;
      case String$2:
        children.push(this.String());
        break;
      case Comma:
        children.push(this.Operator());
        break;
      case RightParenthesis:
        break loop;
      default:
        this.error("Identifier, string or comma is expected");
    }
    this.skipSC();
  }
  return children;
}
const selectorList = {
  parse() {
    return this.createSingleNodeList(
      this.SelectorList()
    );
  }
};
const selector = {
  parse() {
    return this.createSingleNodeList(
      this.Selector()
    );
  }
};
const identList = {
  parse() {
    return this.createSingleNodeList(
      this.Identifier()
    );
  }
};
const langList = {
  parse: parseLanguageRangeList
};
const nth = {
  parse() {
    return this.createSingleNodeList(
      this.Nth()
    );
  }
};
const pseudo = {
  "dir": identList,
  "has": selectorList,
  "lang": langList,
  "matches": selectorList,
  "is": selectorList,
  "-moz-any": selectorList,
  "-webkit-any": selectorList,
  "where": selectorList,
  "not": selectorList,
  "nth-child": nth,
  "nth-last-child": nth,
  "nth-last-of-type": nth,
  "nth-of-type": nth,
  "slotted": selector,
  "host": selector,
  "host-context": selector
};
const node = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AnPlusB: parse$N,
  Atrule: parse$M,
  AtrulePrelude: parse$L,
  AttributeSelector: parse$K,
  Block: parse$J,
  Brackets: parse$I,
  CDC: parse$H,
  CDO: parse$G,
  ClassSelector: parse$F,
  Combinator: parse$E,
  Comment: parse$D,
  Condition: parse$C,
  Declaration: parse$B,
  DeclarationList: parse$A,
  Dimension: parse$z,
  Feature: parse$y,
  FeatureFunction: parse$x,
  FeatureRange: parse$w,
  Function: parse$v,
  GeneralEnclosed: parse$u,
  Hash: parse$t,
  IdSelector: parse$r,
  Identifier: parse$s,
  Layer: parse$q,
  LayerList: parse$p,
  MediaQuery: parse$o,
  MediaQueryList: parse$n,
  NestingSelector: parse$m,
  Nth: parse$l,
  Number: parse$k,
  Operator: parse$j,
  Parentheses: parse$i,
  Percentage: parse$h,
  PseudoClassSelector: parse$g,
  PseudoElementSelector: parse$f,
  Ratio: parse$e,
  Raw: parse$d,
  Rule: parse$c,
  Scope: parse$b,
  Selector: parse$a,
  SelectorList: parse$9,
  String: parse$8,
  StyleSheet: parse$7,
  SupportsDeclaration: parse$6,
  TypeSelector: parse$5,
  UnicodeRange: parse$4,
  Url: parse$3,
  Value: parse$2,
  WhiteSpace: parse$1
}, Symbol.toStringTag, { value: "Module" }));
const parserConfig = {
  parseContext: {
    default: "StyleSheet",
    stylesheet: "StyleSheet",
    atrule: "Atrule",
    atrulePrelude(options) {
      return this.AtrulePrelude(options.atrule ? String(options.atrule) : null);
    },
    mediaQueryList: "MediaQueryList",
    mediaQuery: "MediaQuery",
    condition(options) {
      return this.Condition(options.kind);
    },
    rule: "Rule",
    selectorList: "SelectorList",
    selector: "Selector",
    block() {
      return this.Block(true);
    },
    declarationList: "DeclarationList",
    declaration: "Declaration",
    value: "Value"
  },
  features: {
    supports: {
      selector() {
        return this.Selector();
      }
    },
    container: {
      style() {
        return this.Declaration();
      }
    }
  },
  scope: scope$1,
  atrule,
  pseudo,
  node
};
const walkerConfig = {
  node: node$1
};
const syntax = createSyntax$1({
  ...lexerConfig,
  ...parserConfig,
  ...walkerConfig
});
const {
  tokenize,
  parse,
  generate,
  lexer,
  createLexer,
  walk,
  find,
  findLast,
  findAll,
  toPlainObject,
  fromPlainObject,
  fork
} = syntax;
function parseStyleDeclarations(style) {
  if (!style) return [];
  try {
    const ast = parse(style, { context: "declarationList" });
    const result = [];
    walk(ast, (node2) => {
      if (node2.type === "Declaration") {
        const name2 = node2.property.trim().toLowerCase();
        const value2 = generate(node2.value).trim();
        if (name2 && value2) result.push([name2, value2]);
      }
    });
    return result;
  } catch (e) {
    return [];
  }
}
function normalizeStyleDeclarations(style) {
  return parseStyleDeclarations(style).map(([name2, value2]) => `${name2}: ${value2}`).join("; ");
}
function mergeStyleDeclarations(base, override) {
  const merged = /* @__PURE__ */ new Map();
  for (const [name2, value2] of parseStyleDeclarations(base)) merged.set(name2, value2);
  for (const [name2, value2] of parseStyleDeclarations(override)) merged.set(name2, value2);
  return [...merged.entries()].map(([name2, value2]) => `${name2}: ${value2}`).join("; ");
}
function parseSimpleClassRules(css) {
  const rules = [];
  try {
    const ast = parse(css, { context: "stylesheet" });
    walk(ast, { visit: "Rule", enter(rule) {
      const block = generate(rule.block);
      const declarations = normalizeStyleDeclarations(block.replace(/^\{/, "").replace(/\}$/, ""));
      if (!declarations) return;
      if (rule.prelude.type !== "SelectorList") return;
      for (const selector2 of rule.prelude.children) {
        const parsed = parseSimpleClassSelector(selector2);
        if (!parsed) continue;
        rules.push({
          declarations,
          matches: (tagName, classNames) => (!parsed.tagName || parsed.tagName === tagName) && parsed.classNames.every((className) => classNames.has(className))
        });
      }
    } });
  } catch (e) {
  }
  return rules;
}
function parseSimpleClassSelector(selector2) {
  let tagName;
  const classNames = [];
  for (const child of selector2.children) {
    if (child.type === "TypeSelector") {
      tagName = child.name.toLowerCase();
    } else if (child.type === "ClassSelector") {
      classNames.push(child.name);
    } else if (child.type === "PseudoClassSelector" || child.type === "PseudoElementSelector") ;
    else {
      return null;
    }
  }
  if (!classNames.length) return null;
  return { tagName, classNames };
}
function extractImportURLs(css) {
  const urls = [];
  try {
    const ast = parse(css, { context: "stylesheet" });
    walk(ast, (node2) => {
      if (node2.type === "Atrule" && node2.name === "import" && node2.prelude) {
        walk(node2.prelude, (n) => {
          if (n.type === "Url") {
            urls.push(n.value);
          } else if (n.type === "String") {
            urls.push(n.value);
          }
        });
      }
    });
  } catch (e) {
  }
  return urls;
}
const BLOCK_TAGS = /* @__PURE__ */ new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "body",
  "br",
  "dd",
  "div",
  "dl",
  "dt",
  "figcaption",
  "figure",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "ul"
]);
const LIST_CONTAINER_TAGS = /* @__PURE__ */ new Set(["dl", "ol", "ul"]);
const ANCHOR_TAGS = /* @__PURE__ */ new Set(["a", "anchor"]);
const DEFAULT_STYLE = {
  fontFamily: "Georgia, serif",
  fontSize: 16,
  lineHeight: 1.6
};
function installWechatMiniProgramPretextPolyfill(wxLike = ((_a2) => (_a2 = globalThis.wx) != null ? _a2 : {})(), options = {}) {
  if (typeof globalThis.OffscreenCanvas !== "undefined") return false;
  const createNativeCanvas = wxLike.createOffscreenCanvas;
  if (createNativeCanvas) {
    const PolyfilledOffscreenCanvas = class {
      constructor(width = 1, height = 1) {
        __publicField(this, "width");
        __publicField(this, "height");
        this.width = width;
        this.height = height;
      }
      getContext(type) {
        const canvas = createNativeCanvas({ type, width: this.width, height: this.height });
        const context = canvas.getContext(type);
        return context;
      }
    };
    globalThis.OffscreenCanvas = PolyfilledOffscreenCanvas;
    return true;
  }
  if (options.estimatedFallback === false) return false;
  const EstimatedOffscreenCanvas = class {
    getContext(type) {
      if (type !== "2d") return null;
      return {
        font: "16px serif",
        measureText(text) {
          return { width: estimateTextWidth(text, getFontSizeFromCanvasFont(this.font)) };
        }
      };
    }
  };
  globalThis.OffscreenCanvas = EstimatedOffscreenCanvas;
  return true;
}
function extractDocumentSegments(nodes, baseStyle = {}, options = {}) {
  return extractDocumentBlocks(nodes, baseStyle, options).flatMap((block) => block.segments);
}
function extractDocumentBlocks(nodes, baseStyle = {}, options = {}) {
  var _a2;
  const blocks = [];
  let nextId = 0;
  const coverImageSrcs = new Set(((_a2 = options.coverImageSrcs) != null ? _a2 : []).map(normalizeResourceRef));
  const pushBlock = (type, node2, segments, depth) => {
    var _a3;
    const normalized = type === "pre" ? normalizePreSegments(segments) : normalizeSegments(segments);
    if (!normalized.some((segment) => segment.text.trim())) return;
    const preset = getBlockPreset(type, baseStyle, depth);
    const attrs = getBlockAnchorAttrs(node2);
    const id = (_a3 = attrs == null ? void 0 : attrs.id) != null ? _a3 : `${type}-${nextId++}`;
    blocks.push({
      id,
      type,
      depth,
      attrs,
      style: preset.style,
      blockGapBefore: preset.blockGapBefore,
      blockGapAfter: preset.blockGapAfter,
      segments: normalized.map((segment) => {
        var _a4, _b2, _c, _d;
        return {
          ...segment,
          style: { ...preset.style, ...segment.style },
          source: {
            ...segment.source,
            nodeType: (_b2 = (_a4 = segment.source) == null ? void 0 : _a4.nodeType) != null ? _b2 : type,
            attrs: (_d = (_c = segment.source) == null ? void 0 : _c.attrs) != null ? _d : attrs
          }
        };
      })
    });
  };
  const pushImageBlock = (node2) => {
    var _a3, _b2, _c, _d;
    const image = getImageData(node2, coverImageSrcs);
    if (!image) return;
    if (isFootnoteMarkerImage(image)) return;
    const fontSize = (_a3 = baseStyle.fontSize) != null ? _a3 : DEFAULT_STYLE.fontSize;
    blocks.push({
      id: (_c = (_b2 = node2.attrs) == null ? void 0 : _b2.id) != null ? _c : `image-${nextId++}`,
      type: "image",
      attrs: node2.attrs,
      style: parseInlineStyle((_d = node2.attrs) == null ? void 0 : _d.style),
      blockGapBefore: image.isCover ? 0 : fontSize * 0.75,
      blockGapAfter: fontSize * 0.75,
      image,
      segments: []
    });
  };
  const pushBreakBlock = (node2) => {
    var _a3, _b2, _c, _d;
    const fontSize = (_a3 = baseStyle.fontSize) != null ? _a3 : DEFAULT_STYLE.fontSize;
    blocks.push({
      id: (_c = (_b2 = node2.attrs) == null ? void 0 : _b2.id) != null ? _c : `break-${nextId++}`,
      type: "break",
      attrs: node2.attrs,
      style: { fontSize, lineHeight: (_d = baseStyle.lineHeight) != null ? _d : DEFAULT_STYLE.lineHeight },
      blockGapBefore: 0,
      blockGapAfter: 0,
      segments: []
    });
  };
  const pushSeparatorBlock = (node2) => {
    var _a3, _b2, _c, _d;
    const fontSize = (_a3 = baseStyle.fontSize) != null ? _a3 : DEFAULT_STYLE.fontSize;
    blocks.push({
      id: (_c = (_b2 = node2.attrs) == null ? void 0 : _b2.id) != null ? _c : `separator-${nextId++}`,
      type: "separator",
      attrs: node2.attrs,
      style: parseInlineStyle((_d = node2.attrs) == null ? void 0 : _d.style),
      blockGapBefore: fontSize * 0.4,
      blockGapAfter: fontSize * 0.4,
      segments: []
    });
  };
  const pushTableBlocks = (node2) => {
    var _a3, _b2, _c, _d;
    const table = getTableData(node2);
    if (!table || table.rows.length === 0) return;
    const fontSize = (_a3 = baseStyle.fontSize) != null ? _a3 : DEFAULT_STYLE.fontSize;
    const lineHeight = (_b2 = baseStyle.lineHeight) != null ? _b2 : DEFAULT_STYLE.lineHeight;
    const tableId = (_d = (_c = node2.attrs) == null ? void 0 : _c.id) != null ? _d : `table-${nextId++}`;
    table.rows.forEach((row, rowIndex) => {
      blocks.push({
        id: rowIndex === 0 ? tableId : `${tableId}-row-${rowIndex + 1}`,
        type: "table",
        attrs: {
          ...node2.attrs,
          "data-rebook-table-row": String(rowIndex)
        },
        style: { fontSize, lineHeight },
        blockGapBefore: rowIndex === 0 ? fontSize * 0.75 : 0,
        blockGapAfter: rowIndex === table.rows.length - 1 ? fontSize * 0.75 : 0,
        table: {
          ...table,
          rowIndex,
          rows: [row]
        },
        segments: []
      });
    });
  };
  const walkBlock = (node2, inherited, listDepth = 0, listMarker) => {
    var _a3, _b2, _c, _d, _e;
    if (isTextNode(node2)) {
      if (node2.text.trim()) {
        pushBlock("paragraph", node2, [{ text: node2.text, style: inherited, source: { nodeType: "text" } }]);
      }
      return;
    }
    const type = node2.type.toLowerCase();
    if (type === "script" || type === "style" || type === "head") return;
    if (isFootnoteContentNode(node2)) return;
    if (type === "br") {
      pushBreakBlock(node2);
      return;
    }
    if (type === "hr") {
      pushSeparatorBlock(node2);
      return;
    }
    if (isImageNode(type, node2)) {
      pushImageBlock(node2);
      return;
    }
    if (type === "table") {
      pushTableBlocks(node2);
      for (const image of collectImageNodes(node2)) pushImageBlock(image);
      return;
    }
    if (/^h[1-6]$/.test(type)) {
      const depth = Number(type[1]);
      pushBlock(depth === 1 ? "chapter" : "heading", node2, collectInlineSegments(node2, inherited), depth);
      return;
    }
    if (type === "p") {
      const segments = collectInlineSegments(node2, inherited);
      pushBlock("paragraph", node2, segments);
      if (!segments.some((segment) => segment.text.trim()) && segments.some((segment) => segment.text.includes("\n"))) {
        pushBreakBlock(node2);
      }
      for (const image of collectImageNodes(node2)) pushImageBlock(image);
      return;
    }
    if (type === "li" || type === "dt") {
      const marker = listMarker ? `${listMarker} ` : "";
      pushBlock("listItem", node2, [
        ...marker ? [{ text: marker, style: inherited, source: { nodeType: "marker" } }] : [],
        ...collectInlineSegments(node2, inherited, { skipNestedLists: true })
      ], listDepth);
      for (const child of (_a3 = node2.children) != null ? _a3 : []) {
        if (!isTextNode(child) && LIST_CONTAINER_TAGS.has(child.type.toLowerCase())) {
          walkBlock(child, inherited, listDepth + 1);
        }
      }
      return;
    }
    if (type === "dd") {
      for (const child of (_b2 = node2.children) != null ? _b2 : []) walkBlock(child, inherited, listDepth + 1);
      return;
    }
    if (LIST_CONTAINER_TAGS.has(type)) {
      let ordinal = getOrderedListStart(node2);
      for (const child of (_c = node2.children) != null ? _c : []) {
        if (isTextNode(child)) continue;
        const childType = child.type.toLowerCase();
        if (type === "ol" && childType === "li") {
          walkBlock(child, inherited, listDepth, formatOrderedListMarker(ordinal++, (_d = node2.attrs) == null ? void 0 : _d.type));
        } else if (type === "ul" && childType === "li") {
          walkBlock(child, inherited, listDepth, "•");
        } else {
          walkBlock(child, inherited, listDepth);
        }
      }
      return;
    }
    if (type === "blockquote") {
      pushBlock("blockquote", node2, collectInlineSegments(node2, inherited));
      for (const image of collectImageNodes(node2)) pushImageBlock(image);
      return;
    }
    if (type === "pre") {
      pushBlock("pre", node2, collectInlineSegments(node2, inherited), void 0);
      return;
    }
    for (const child of (_e = node2.children) != null ? _e : []) walkBlock(child, inherited, listDepth);
  };
  for (const node2 of nodes) walkBlock(node2, { ...baseStyle });
  return blocks;
}
function prepare(segments, options = {}) {
  return prepareBlocks(segmentsToBlocks(segments), options);
}
function prepareBlocks(textBlocks, options = {}) {
  const baseStyle = { ...DEFAULT_STYLE, ...options.baseStyle };
  const lineHeight = baseStyle.fontSize * baseStyle.lineHeight;
  const segments = textBlocks.flatMap((block) => block.segments);
  let nextSegmentIndex = 0;
  const blocks = textBlocks.filter(
    (block) => block.type === "image" || block.type === "table" || block.type === "break" || block.type === "separator" || block.segments.some((segment) => segment.text.trim())
  ).map((block) => {
    const itemSegmentIndexes = block.segments.map(() => nextSegmentIndex++);
    if (block.type === "image" || block.type === "table" || block.type === "break" || block.type === "separator") {
      return {
        itemSegmentIndexes,
        block
      };
    }
    const items = block.segments.map((segment) => {
      var _a2;
      return {
        text: segment.text,
        font: toCanvasFont({ ...baseStyle, ...segment.style }),
        letterSpacing: (_a2 = segment.style) == null ? void 0 : _a2.letterSpacing,
        break: segment.break,
        extraWidth: segment.extraWidth
      };
    });
    return {
      prepared: prepareRichInline(items),
      itemSegmentIndexes,
      block
    };
  });
  return { segments, blocks, baseStyle, lineHeight };
}
function layout(prepared, options) {
  var _a2, _b2, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n;
  const lines = [];
  const inlineSize = Math.max(1, options.inlineSize);
  const lineHeight = (_a2 = options.lineHeight) != null ? _a2 : prepared.lineHeight;
  const blockGap = (_b2 = options.blockGap) != null ? _b2 : 0;
  let top = (_c = options.blockStart) != null ? _c : 0;
  for (const block of prepared.blocks) {
    const blockStartCount = lines.length;
    if (blockStartCount > 0) top += (_d = block.block.blockGapBefore) != null ? _d : 0;
    const inlineOffset = getBlockInlineOffset(block.block, prepared.baseStyle.fontSize);
    const blockInlineSize = Math.max(prepared.baseStyle.fontSize * 4, inlineSize - inlineOffset);
    if (block.block.type === "break") {
      lines.push({
        index: lines.length,
        kind: "text",
        block: block.block,
        start: null,
        end: null,
        text: "",
        width: 0,
        top,
        height: lineHeight,
        inlineOffset,
        segments: []
      });
      top += lineHeight;
      top += (_e = block.block.blockGapAfter) != null ? _e : blockGap;
      continue;
    }
    if (block.block.type === "separator") {
      lines.push({
        index: lines.length,
        kind: "separator",
        block: block.block,
        start: null,
        end: null,
        text: "",
        width: inlineSize,
        top,
        height: lineHeight,
        inlineOffset,
        segments: []
      });
      top += lineHeight;
      top += (_f = block.block.blockGapAfter) != null ? _f : blockGap;
      continue;
    }
    if (block.block.type === "image" && block.block.image) {
      const metrics = getImageBlockMetrics(block.block.image, inlineSize, lineHeight, options.maxBlockHeight);
      top = avoidAtomicBlockPageBreak(top, metrics.height, options.maxBlockHeight, lineHeight);
      lines.push({
        index: lines.length,
        kind: "image",
        block: block.block,
        image: block.block.image,
        start: null,
        end: null,
        text: (_h = (_g = block.block.image.alt) != null ? _g : block.block.image.title) != null ? _h : "",
        width: metrics.width,
        top,
        height: metrics.height,
        inlineOffset,
        segments: []
      });
      top += metrics.height;
      top += (_i = block.block.blockGapAfter) != null ? _i : blockGap;
      continue;
    }
    if (block.block.type === "table" && block.block.table) {
      const metrics = getTableBlockMetrics(
        block.block.table,
        inlineSize,
        lineHeight,
        prepared.baseStyle.fontSize,
        options.maxBlockHeight
      );
      top = avoidAtomicBlockPageBreak(top, metrics.height, options.maxBlockHeight, lineHeight);
      lines.push({
        index: lines.length,
        kind: "table",
        block: block.block,
        table: block.block.table,
        start: null,
        end: null,
        text: (_k = (_j = block.block.table.rows[0]) == null ? void 0 : _j.cells.map((cell) => cell.text).join(" ")) != null ? _k : "",
        width: metrics.width,
        top,
        height: metrics.height,
        inlineOffset,
        segments: []
      });
      top += metrics.height;
      top += (_l = block.block.blockGapAfter) != null ? _l : blockGap;
      continue;
    }
    if (block.block.type === "pre") {
      const preLines = splitPreLines(block, prepared);
      let preTop = top;
      const allFragments = [];
      let maxWidth = 0;
      const lineTexts = [];
      const paddingBlock = getPreBlockPaddingBlock(block.block, prepared.baseStyle.fontSize);
      for (const preLine of preLines) {
        if (preLine.length === 0) {
          lineTexts.push("");
          continue;
        }
        const lineText = preLine.map((item) => toPreLayoutText(item.text)).join("");
        lineTexts.push(lineText);
        const richInline2 = prepareRichInline(preLine.map((item) => {
          var _a3;
          return {
            text: toPreLayoutText(item.text),
            font: toCanvasFont({ ...prepared.baseStyle, ...item.style }),
            letterSpacing: (_a3 = item.style) == null ? void 0 : _a3.letterSpacing,
            break: item.break,
            extraWidth: item.extraWidth
          };
        }));
        walkRichInlineLineRanges(richInline2, blockInlineSize, (range) => {
          const materialized = materializeRichInlineLineRange(richInline2, range);
          const fragments = materialized.fragments.map((fragment, index) => {
            var _a3;
            const rangeFragment = range.fragments[index];
            const sourceItem = preLine[fragment.itemIndex];
            return {
              segmentIndex: sourceItem.segmentIndex,
              start: rangeFragment.start,
              end: rangeFragment.end,
              text: fragment.text,
              style: (_a3 = sourceItem.style) != null ? _a3 : {},
              source: sourceItem.source,
              gapBefore: fragment.gapBefore,
              occupiedWidth: fragment.occupiedWidth
            };
          });
          allFragments.push(...fragments);
          maxWidth = Math.max(maxWidth, materialized.width);
        });
      }
      const preText = lineTexts.join("\n");
      const totalLines = lineTexts.length;
      const contentHeight = totalLines * lineHeight + paddingBlock * 2;
      const totalHeight = getPreBlockHeight(contentHeight, lineHeight, options.maxBlockHeight);
      preTop = avoidAtomicBlockPageBreak(preTop, totalHeight, options.maxBlockHeight, lineHeight);
      const first = allFragments[0];
      const last = allFragments[allFragments.length - 1];
      lines.push({
        index: lines.length,
        kind: "pre",
        block: block.block,
        start: first ? { segmentIndex: first.segmentIndex, cursor: first.start } : null,
        end: last ? { segmentIndex: last.segmentIndex, cursor: last.end } : null,
        text: preText,
        width: maxWidth,
        top: preTop,
        height: totalHeight,
        inlineOffset,
        segments: allFragments
      });
      top = preTop + totalHeight;
      top += (_m = block.block.blockGapAfter) != null ? _m : blockGap;
      continue;
    }
    const richInline = block.prepared;
    if (!richInline) continue;
    walkRichInlineLineRanges(richInline, blockInlineSize, (range) => {
      const materialized = materializeRichInlineLineRange(richInline, range);
      const fragments = materialized.fragments.map((fragment, index) => {
        var _a3, _b3, _c2;
        const rangeFragment = range.fragments[index];
        const segmentIndex = block.itemSegmentIndexes[fragment.itemIndex];
        return {
          segmentIndex,
          start: rangeFragment.start,
          end: rangeFragment.end,
          text: fragment.text,
          style: (_b3 = (_a3 = prepared.segments[segmentIndex]) == null ? void 0 : _a3.style) != null ? _b3 : {},
          source: (_c2 = prepared.segments[segmentIndex]) == null ? void 0 : _c2.source,
          gapBefore: fragment.gapBefore,
          occupiedWidth: fragment.occupiedWidth
        };
      });
      const first = fragments[0];
      const last = fragments[fragments.length - 1];
      lines.push({
        index: lines.length,
        kind: "text",
        block: block.block,
        start: first ? { segmentIndex: first.segmentIndex, cursor: first.start } : null,
        end: last ? { segmentIndex: last.segmentIndex, cursor: last.end } : null,
        text: joinFragments(fragments),
        width: materialized.width,
        top,
        height: lineHeight,
        inlineOffset,
        segments: fragments
      });
      top += lineHeight;
    });
    if (lines.length > blockStartCount) top += (_n = block.block.blockGapAfter) != null ? _n : blockGap;
  }
  if (lines.length === 0) {
    lines.push({
      index: 0,
      kind: "text",
      start: null,
      end: null,
      text: "",
      width: 0,
      top,
      height: lineHeight,
      segments: []
    });
  }
  return lines;
}
function getVisibleLines(lines, scrollTop, viewportHeight, overscan = 2) {
  var _a2, _b2;
  if (lines.length === 0) {
    return { startIndex: 0, endIndex: 0, offsetTop: 0, totalHeight: 0, lines: [] };
  }
  const totalHeight = lines[lines.length - 1].top + lines[lines.length - 1].height;
  const startIndex = findFirstVisibleLine(lines, scrollTop, overscan);
  const endIndex = findLastVisibleLine(lines, scrollTop + viewportHeight, overscan);
  return {
    startIndex,
    endIndex,
    offsetTop: (_b2 = (_a2 = lines[startIndex]) == null ? void 0 : _a2.top) != null ? _b2 : 0,
    totalHeight,
    lines: lines.slice(startIndex, endIndex)
  };
}
function prepareRichInline(items) {
  return prepareRichInline$1(items);
}
function walkRichInlineLineRanges(prepared, maxWidth, onLine) {
  return walkRichInlineLineRanges$1(
    prepared,
    maxWidth,
    (line) => onLine(line)
  );
}
function materializeRichInlineLineRange(prepared, line) {
  return materializeRichInlineLineRange$1(
    prepared,
    line
  );
}
function collectInlineSegments(node2, inherited, options = {}) {
  var _a2;
  const segments = [];
  const walk2 = (current, style) => {
    var _a3, _b2, _c;
    if (isTextNode(current)) {
      if (current.text) {
        segments.push({ text: current.text, style, source: { nodeType: "text" } });
      }
      return;
    }
    const type = current.type.toLowerCase();
    if (type === "script" || type === "style" || type === "head") return;
    if (isFootnoteContentNode(current)) return;
    if (options.skipNestedLists && current !== node2 && LIST_CONTAINER_TAGS.has(type)) return;
    if (type === "br") {
      segments.push({ text: "\n", style, source: { nodeType: "br", attrs: current.attrs } });
      return;
    }
    if (isImageNode(type, current)) {
      const image = getImageData(current, /* @__PURE__ */ new Set());
      if (image && isFootnoteMarkerImage(image)) {
        const dimensions = getFootnoteMarkerDimensions(image);
        segments.push({
          text: "￼",
          style,
          break: "never",
          extraWidth: dimensions.width,
          source: {
            nodeType: "img",
            attrs: {
              ...(_a3 = current.attrs) != null ? _a3 : {},
              ...getFootnoteMarkerDataAttrs(image, current.attrs),
              "data-rebook-inline-image-width": String(dimensions.width),
              "data-rebook-inline-image-height": String(dimensions.height)
            }
          }
        });
      }
      return;
    }
    if (BLOCK_TAGS.has(type) && current !== node2) {
      for (const child of (_b2 = current.children) != null ? _b2 : []) walk2(child, applyNodeStyle(type, style, current.attrs));
      segments.push({ text: "\n", style, source: { nodeType: type, attrs: current.attrs } });
      return;
    }
    const nextStyle = applyNodeStyle(type, style, current.attrs);
    for (const child of (_c = current.children) != null ? _c : []) walk2(child, nextStyle);
  };
  for (const child of (_a2 = node2.children) != null ? _a2 : []) walk2(child, inherited);
  return segments;
}
function collectImageNodes(node2) {
  var _a2;
  const images = [];
  const walk2 = (current) => {
    var _a3;
    if (isTextNode(current)) return;
    if (isFootnoteContentNode(current)) return;
    const type = current.type.toLowerCase();
    if (isImageNode(type, current)) {
      images.push(current);
      return;
    }
    for (const child of (_a3 = current.children) != null ? _a3 : []) walk2(child);
  };
  for (const child of (_a2 = node2.children) != null ? _a2 : []) walk2(child);
  return images;
}
function getTableData(node2) {
  const rows = collectTableRows(node2);
  if (rows.length === 0) return null;
  const columnCount = Math.max(
    1,
    ...rows.map((row) => row.cells.reduce((sum, cell) => {
      var _a2;
      return sum + ((_a2 = cell.colspan) != null ? _a2 : 1);
    }, 0))
  );
  const columnWeights = getTableColumnWeights(node2, rows, columnCount);
  return {
    columnCount,
    columnWeights,
    rowIndex: 0,
    rowCount: rows.length,
    rows
  };
}
function collectTableRows(table) {
  var _a2;
  const rows = [];
  const walk2 = (node2) => {
    var _a3, _b2;
    if (isTextNode(node2)) return;
    const type = node2.type.toLowerCase();
    if (type === "tr") {
      const cells = ((_a3 = node2.children) != null ? _a3 : []).filter((child) => !isTextNode(child) && isTableCellNode(child.type.toLowerCase())).map((cell) => getTableCellData(cell)).filter((cell) => Boolean(cell == null ? void 0 : cell.text));
      if (cells.length > 0) rows.push({ cells });
      return;
    }
    for (const child of (_b2 = node2.children) != null ? _b2 : []) walk2(child);
  };
  for (const child of (_a2 = table.children) != null ? _a2 : []) walk2(child);
  return rows;
}
function getTableCellData(node2) {
  var _a2, _b2, _c;
  if (isTextNode(node2)) return null;
  const text = normalizeTableCellText(collectInlineSegments(node2, {}).map((segment) => segment.text).join(""));
  if (!text) return null;
  const type = node2.type.toLowerCase();
  return {
    text,
    header: type === "th" || Boolean((_a2 = node2.children) == null ? void 0 : _a2.some((child) => isElementOfType(child, "b") || isElementOfType(child, "strong"))),
    colspan: parsePositiveInteger((_b2 = node2.attrs) == null ? void 0 : _b2.colspan),
    rowspan: parsePositiveInteger((_c = node2.attrs) == null ? void 0 : _c.rowspan),
    align: getTableCellAlign(node2),
    attrs: node2.attrs
  };
}
function getTableColumnWeights(table, rows, columnCount) {
  const fromColgroup = getColgroupWeights(table, columnCount);
  if (fromColgroup) return fromColgroup;
  const firstCompleteRow = rows.find((row) => row.cells.length === columnCount && row.cells.every((cell) => !cell.colspan || cell.colspan === 1));
  const weights = firstCompleteRow == null ? void 0 : firstCompleteRow.cells.map((cell) => {
    var _a2, _b2, _c;
    return (_c = parsePercentWidth((_a2 = cell.attrs) == null ? void 0 : _a2.style)) != null ? _c : parsePercentWidth((_b2 = cell.attrs) == null ? void 0 : _b2.width);
  });
  return (weights == null ? void 0 : weights.every((value2) => typeof value2 === "number" && value2 > 0)) ? weights : void 0;
}
function getColgroupWeights(table, columnCount) {
  var _a2;
  const cols = [];
  const walk2 = (node2) => {
    var _a3, _b2, _c, _d;
    if (isTextNode(node2)) return;
    if (node2.type.toLowerCase() === "col") {
      const weight = (_c = parsePercentWidth((_a3 = node2.attrs) == null ? void 0 : _a3.style)) != null ? _c : parsePercentWidth((_b2 = node2.attrs) == null ? void 0 : _b2.width);
      if (weight) cols.push(weight);
      return;
    }
    for (const child of (_d = node2.children) != null ? _d : []) walk2(child);
  };
  for (const child of (_a2 = table.children) != null ? _a2 : []) walk2(child);
  return cols.length === columnCount ? cols : void 0;
}
function isTableCellNode(type) {
  return type === "td" || type === "th";
}
function isElementOfType(node2, type) {
  return !isTextNode(node2) && node2.type.toLowerCase() === type;
}
function normalizeTableCellText(value2) {
  return value2.replace(/\s+/g, " ").trim();
}
function parsePositiveInteger(value2) {
  if (!value2) return void 0;
  const parsed = Number.parseInt(value2, 10);
  return Number.isFinite(parsed) && parsed > 1 ? parsed : void 0;
}
function getTableCellAlign(node2) {
  var _a2, _b2, _c, _d, _e;
  if (isTextNode(node2)) return void 0;
  const styleAlign = parseTextAlignFromStyle((_a2 = node2.attrs) == null ? void 0 : _a2.style);
  if (styleAlign) return styleAlign;
  const align = (_c = (_b2 = node2.attrs) == null ? void 0 : _b2.align) == null ? void 0 : _c.toLowerCase();
  if (align) return parseTextAlign(align);
  const className = (_e = (_d = node2.attrs) == null ? void 0 : _d.class) == null ? void 0 : _e.toLowerCase();
  if (className == null ? void 0 : className.split(/\s+/).includes("center")) return "center";
  if (className == null ? void 0 : className.split(/\s+/).includes("right")) return "end";
  return void 0;
}
function isImageNode(type, node2) {
  var _a2, _b2, _c, _d, _e, _f, _g, _h, _i, _j;
  if (type === "img") return Boolean((_c = (_a2 = node2.attrs) == null ? void 0 : _a2.src) != null ? _c : (_b2 = node2.attrs) == null ? void 0 : _b2["data-rebook-original-src"]);
  if (type === "image") return Boolean(
    (_j = (_h = (_f = (_d = node2.attrs) == null ? void 0 : _d.href) != null ? _f : (_e = node2.attrs) == null ? void 0 : _e.src) != null ? _h : (_g = node2.attrs) == null ? void 0 : _g["data-rebook-original-href"]) != null ? _j : (_i = node2.attrs) == null ? void 0 : _i["data-rebook-original-src"]
  );
  return false;
}
function getImageData(node2, coverImageSrcs) {
  var _a2, _b2, _c, _d, _e, _f, _g, _h, _i, _j;
  const attrs = (_a2 = node2.attrs) != null ? _a2 : {};
  const src = (_e = (_d = (_c = (_b2 = attrs.src) != null ? _b2 : attrs.href) != null ? _c : attrs["data-rebook-original-src"]) != null ? _d : attrs["data-rebook-original-href"]) != null ? _e : attrs["data-rebook-original-data"];
  if (!src) return null;
  const imageStyle = parseImageStyle(attrs.style);
  const width = (_f = parseCSSDimension(attrs.width)) != null ? _f : imageStyle.width;
  const height = (_g = parseCSSDimension(attrs.height)) != null ? _g : imageStyle.height;
  const originalSrc = (_j = (_i = (_h = attrs["data-rebook-original-src"]) != null ? _h : attrs["data-rebook-original-href"]) != null ? _i : attrs["data-rebook-original-data"]) != null ? _j : src;
  const role = [
    attrs["epub:type"],
    attrs.type,
    attrs.role,
    attrs.properties,
    attrs.class
  ].filter(Boolean).join(" ");
  const roleLower = role.toLowerCase();
  const normalizedSrc = normalizeResourceRef(src);
  const normalizedOriginalSrc = normalizeResourceRef(originalSrc);
  const isCover = roleLower.split(/\s+/).includes("cover") || coverImageSrcs.has(normalizedSrc) || coverImageSrcs.has(normalizedOriginalSrc);
  return {
    src,
    originalSrc,
    alt: attrs.alt,
    title: attrs.title,
    width,
    height,
    aspectRatio: width && height ? width / height : void 0,
    isCover,
    role: role || void 0,
    style: imageStyle
  };
}
function isFootnoteMarkerImage(image) {
  var _a2, _b2;
  const role = (_b2 = (_a2 = image.role) == null ? void 0 : _a2.toLowerCase()) != null ? _b2 : "";
  return role.split(/\s+/).some((token) => token === "epub-footnote" || token === "epub-footnote1" || token === "noteref" || token === "footnote-ref");
}
function isFootnoteContentNode(node2) {
  var _a2, _b2, _c, _d;
  if (isTextNode(node2)) return false;
  const role = [
    (_a2 = node2.attrs) == null ? void 0 : _a2["epub:type"],
    (_b2 = node2.attrs) == null ? void 0 : _b2.type,
    (_c = node2.attrs) == null ? void 0 : _c.role,
    (_d = node2.attrs) == null ? void 0 : _d.class
  ].filter(Boolean).join(" ").toLowerCase();
  const tokens = role.split(/\s+/);
  return tokens.includes("footnote") || tokens.includes("endnote") || tokens.includes("rearnote") || tokens.includes("duokan-footnote-content");
}
function getFootnoteMarkerDataAttrs(image, attrs) {
  const content = imageFromFootnoteText(image, attrs);
  return content ? { "data-rebook-footnote-content": content } : {};
}
function imageFromFootnoteText(image, attrs) {
  var _a2, _b2;
  return normalizeFootnoteText((_b2 = (_a2 = attrs == null ? void 0 : attrs["zy-footnote"]) != null ? _a2 : image.alt) != null ? _b2 : image.title);
}
function normalizeFootnoteText(value2) {
  const normalized = value2 == null ? void 0 : value2.replace(/\s+/g, " ").trim();
  return normalized || void 0;
}
function getFootnoteMarkerDimensions(image) {
  var _a2, _b2, _c, _d, _e, _f, _g, _h;
  const role = (_b2 = (_a2 = image.role) == null ? void 0 : _a2.toLowerCase()) != null ? _b2 : "";
  const width = (_e = (_d = (_c = image.style) == null ? void 0 : _c.width) != null ? _d : image.width) != null ? _e : role.split(/\s+/).includes("epub-footnote1") ? 10 : 11;
  const height = (_h = (_g = (_f = image.style) == null ? void 0 : _f.height) != null ? _g : image.height) != null ? _h : width;
  return {
    width: Math.max(1, width),
    height: Math.max(1, height)
  };
}
function getImageBlockMetrics(image, inlineSize, lineHeight, maxBlockHeight) {
  var _a2, _b2, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l;
  const maxWidth = Math.min(inlineSize, (_b2 = (_a2 = image.style) == null ? void 0 : _a2.maxWidth) != null ? _b2 : inlineSize);
  const preferredWidth = (_e = (_d = (_c = image.style) == null ? void 0 : _c.width) != null ? _d : image.width) != null ? _e : maxWidth;
  const width = Math.max(1, Math.min(maxWidth, preferredWidth));
  const naturalRatio = (_f = image.aspectRatio) != null ? _f : image.width && image.height ? image.width / image.height : void 0;
  const fallbackHeight = image.isCover ? maxBlockHeight != null ? maxBlockHeight : width * 1.35 : width * 0.75;
  const preferredHeight = (_j = (_i = (_h = (_g = image.style) == null ? void 0 : _g.height) != null ? _h : naturalRatio ? width / naturalRatio : void 0) != null ? _i : image.height) != null ? _j : fallbackHeight;
  const styleMaxHeight = (_l = (_k = image.style) == null ? void 0 : _k.maxHeight) != null ? _l : Number.POSITIVE_INFINITY;
  const maxHeight = maxBlockHeight ? Math.max(lineHeight * 2, Math.min(maxBlockHeight, styleMaxHeight)) : styleMaxHeight;
  const height = Math.max(lineHeight * 2, Math.min(maxHeight, preferredHeight));
  return { width, height };
}
function getTableBlockMetrics(table, inlineSize, lineHeight, fontSize, maxBlockHeight) {
  var _a2;
  const cellPadding = fontSize * 0.45;
  const columnWidths = getResolvedColumnWidths(table, inlineSize);
  const row = table.rows[0];
  const contentHeight = (_a2 = row == null ? void 0 : row.cells.reduce((max2, cell, cellIndex) => {
    var _a3;
    const colspan = Math.max(1, (_a3 = cell.colspan) != null ? _a3 : 1);
    const columnWidth = columnWidths.slice(cellIndex, cellIndex + colspan).reduce((sum, width) => sum + width, 0);
    const textWidth = Math.max(fontSize * 2, columnWidth - cellPadding * 2);
    const estimatedLineCount = Math.max(1, Math.ceil(estimateTextWidth(cell.text, fontSize) / textWidth));
    return Math.max(max2, estimatedLineCount * lineHeight + cellPadding * 2);
  }, lineHeight + cellPadding * 2)) != null ? _a2 : lineHeight + cellPadding * 2;
  const maxHeight = maxBlockHeight ? Math.max(lineHeight * 1.5, maxBlockHeight) : Number.POSITIVE_INFINITY;
  return {
    width: inlineSize,
    height: Math.min(maxHeight, Math.max(lineHeight * 1.5, contentHeight))
  };
}
function getResolvedColumnWidths(table, inlineSize) {
  var _a2;
  const weights = ((_a2 = table.columnWeights) == null ? void 0 : _a2.length) === table.columnCount ? table.columnWeights : Array.from({ length: table.columnCount }, () => 1);
  const total = weights.reduce((sum, width) => sum + Math.max(0, width), 0) || table.columnCount;
  return weights.map((weight) => inlineSize * (Math.max(0, weight) / total));
}
function estimateTextWidth(text, fontSize) {
  return Array.from(text).reduce((sum, char) => {
    if (char === " ") return sum + fontSize * 0.32;
    if (/[\u4e00-\u9fff]/.test(char)) return sum + fontSize;
    return sum + fontSize * 0.54;
  }, 0);
}
function getFontSizeFromCanvasFont(font) {
  const match = font.match(/([\d.]+)px/);
  const parsed = match ? Number(match[1]) : 16;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 16;
}
function avoidAtomicBlockPageBreak(top, height, maxBlockHeight, lineHeight) {
  if (!maxBlockHeight) return top;
  const offset = top % maxBlockHeight;
  if (offset === 0) return top;
  if (height >= maxBlockHeight) return top + Math.max(lineHeight, maxBlockHeight - offset);
  return offset + height > maxBlockHeight ? top + Math.max(lineHeight, maxBlockHeight - offset) : top;
}
function segmentsToBlocks(segments) {
  return splitBlocks(segments).map((block, index) => ({
    id: `paragraph-${index}`,
    type: "paragraph",
    segments: block.map((item) => item.segment)
  }));
}
function splitBlocks(segments) {
  const blocks = [];
  let current = [];
  const flush = () => {
    if (current.length > 0) {
      blocks.push(current);
      current = [];
    }
  };
  segments.forEach((segment, segmentIndex) => {
    const pieces = segment.text.split("\n");
    pieces.forEach((piece, pieceIndex) => {
      if (piece) current.push({ segment: { ...segment, text: piece }, segmentIndex });
      if (pieceIndex < pieces.length - 1) flush();
    });
  });
  flush();
  return blocks;
}
function getBlockPreset(type, baseStyle, depth) {
  var _a2, _b2;
  const fontSize = (_a2 = baseStyle.fontSize) != null ? _a2 : DEFAULT_STYLE.fontSize;
  const lineHeight = (_b2 = baseStyle.lineHeight) != null ? _b2 : DEFAULT_STYLE.lineHeight;
  if (type === "chapter") {
    return {
      style: {
        fontSize: fontSize * 1.55,
        fontWeight: "700",
        lineHeight: 1.45
      },
      blockGapBefore: fontSize * 1.2,
      blockGapAfter: fontSize * 1.2
    };
  }
  if (type === "heading") {
    const scale = Math.max(1.08, 1.42 - (depth != null ? depth : 2) * 0.08);
    return {
      style: {
        fontSize: fontSize * scale,
        fontWeight: "700",
        lineHeight: 1.45
      },
      blockGapBefore: fontSize * 0.9,
      blockGapAfter: fontSize * 0.6
    };
  }
  if (type === "blockquote") {
    return {
      style: {
        fontSize,
        lineHeight,
        color: baseStyle.color
      },
      blockGapBefore: fontSize * 0.5,
      blockGapAfter: fontSize * 0.5
    };
  }
  if (type === "pre") {
    return {
      style: {
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        fontSize: fontSize * 0.92,
        lineHeight: 1.55
      },
      blockGapBefore: fontSize * 0.6,
      blockGapAfter: fontSize * 0.6
    };
  }
  if (type === "listItem") {
    return {
      style: { fontSize, lineHeight },
      blockGapBefore: 0,
      blockGapAfter: fontSize * 0.35
    };
  }
  return {
    style: { fontSize, lineHeight },
    blockGapBefore: 0,
    blockGapAfter: fontSize * 0.75
  };
}
function getBlockInlineOffset(block, fontSize) {
  var _a2;
  if (block.type !== "listItem") return 0;
  return Math.max(0, (_a2 = block.depth) != null ? _a2 : 0) * fontSize * 1.65;
}
function getBlockAnchorAttrs(node2) {
  var _a2, _b2, _c;
  const attrs = (_a2 = node2.attrs) != null ? _a2 : {};
  if (attrs.id || attrs.name) return attrs;
  const anchor = findDescendantAnchor(node2);
  if (!anchor) return attrs;
  return {
    ...attrs,
    ...((_b2 = anchor.attrs) == null ? void 0 : _b2.id) ? { id: anchor.attrs.id } : {},
    ...((_c = anchor.attrs) == null ? void 0 : _c.name) ? { name: anchor.attrs.name } : {}
  };
}
function findDescendantAnchor(node2) {
  var _a2, _b2, _c;
  for (const child of (_a2 = node2.children) != null ? _a2 : []) {
    if (isTextNode(child)) continue;
    if (ANCHOR_TAGS.has(child.type.toLowerCase()) && (((_b2 = child.attrs) == null ? void 0 : _b2.id) || ((_c = child.attrs) == null ? void 0 : _c.name))) return child;
    const nested = findDescendantAnchor(child);
    if (nested) return nested;
  }
  return null;
}
function getPreBlockPaddingBlock(block, fallbackFontSize) {
  var _a2, _b2;
  const fontSize = (_b2 = (_a2 = block.style) == null ? void 0 : _a2.fontSize) != null ? _b2 : fallbackFontSize;
  return fontSize * 0.75;
}
function getPreBlockHeight(contentHeight, lineHeight, maxBlockHeight) {
  const minHeight = lineHeight * 2;
  if (!maxBlockHeight) return Math.max(minHeight, contentHeight);
  return Math.max(minHeight, Math.min(maxBlockHeight, contentHeight));
}
function getOrderedListStart(node2) {
  var _a2;
  const start = parsePositiveInteger((_a2 = node2.attrs) == null ? void 0 : _a2.start);
  return start != null ? start : 1;
}
function formatOrderedListMarker(value2, type) {
  const normalized = type == null ? void 0 : type.trim();
  if (normalized === "A") return `${formatAlpha(value2, true)}.`;
  if (normalized === "a") return `${formatAlpha(value2, false)}.`;
  if (normalized === "I") return `${formatRoman(value2).toUpperCase()}.`;
  if (normalized === "i") return `${formatRoman(value2).toLowerCase()}.`;
  return `${value2}.`;
}
function formatAlpha(value2, uppercase) {
  let n = Math.max(1, Math.floor(value2));
  let result = "";
  while (n > 0) {
    n--;
    result = String.fromCharCode((uppercase ? 65 : 97) + n % 26) + result;
    n = Math.floor(n / 26);
  }
  return result;
}
function formatRoman(value2) {
  let n = Math.max(1, Math.min(3999, Math.floor(value2)));
  const pairs = [
    [1e3, "m"],
    [900, "cm"],
    [500, "d"],
    [400, "cd"],
    [100, "c"],
    [90, "xc"],
    [50, "l"],
    [40, "xl"],
    [10, "x"],
    [9, "ix"],
    [5, "v"],
    [4, "iv"],
    [1, "i"]
  ];
  let result = "";
  for (const [number2, roman] of pairs) {
    while (n >= number2) {
      result += roman;
      n -= number2;
    }
  }
  return result;
}
function normalizeSegments(segments) {
  var _a2, _b2;
  const normalized = [];
  for (const segment of segments) {
    const text = segment.text.replace(/[ \t\r\f]+/g, " ");
    if (!text) continue;
    const last = normalized[normalized.length - 1];
    if (last && sameStyle(last.style, segment.style) && sameSource(last.source, segment.source)) {
      normalized[normalized.length - 1] = { ...last, text: last.text + text };
    } else {
      normalized.push({ ...segment, text });
    }
  }
  while (((_a2 = normalized[0]) == null ? void 0 : _a2.text) === "\n") normalized.shift();
  while (((_b2 = normalized[normalized.length - 1]) == null ? void 0 : _b2.text) === "\n") normalized.pop();
  return normalized;
}
function normalizePreSegments(segments) {
  const normalized = [];
  for (const segment of segments) {
    const text = segment.text.replace(/\r\n?/g, "\n");
    if (!text) continue;
    const last = normalized[normalized.length - 1];
    if (last && sameStyle(last.style, segment.style) && sameSource(last.source, segment.source)) {
      normalized[normalized.length - 1] = { ...last, text: last.text + text };
    } else {
      normalized.push({ ...segment, text });
    }
  }
  trimPreBoundaryNewline(normalized, "start");
  trimPreBoundaryNewline(normalized, "end");
  return normalized;
}
function trimPreBoundaryNewline(segments, edge) {
  var _a2, _b2;
  while (segments.length > 0) {
    const index = edge === "start" ? 0 : segments.length - 1;
    const text = (_b2 = (_a2 = segments[index]) == null ? void 0 : _a2.text) != null ? _b2 : "";
    if (edge === "start" && text.startsWith("\n")) {
      const nextText = text.slice(1);
      if (nextText) segments[index] = { ...segments[index], text: nextText };
      else segments.shift();
      continue;
    }
    if (edge === "end" && text.endsWith("\n")) {
      const nextText = text.slice(0, -1);
      if (nextText) segments[index] = { ...segments[index], text: nextText };
      else segments.pop();
      continue;
    }
    break;
  }
}
function splitPreLines(block, prepared) {
  const lines = [[]];
  block.block.segments.forEach((segment, itemIndex) => {
    var _a2, _b2, _c, _d, _e;
    const segmentIndex = block.itemSegmentIndexes[itemIndex];
    const style = (_c = (_b2 = (_a2 = prepared.segments[segmentIndex]) == null ? void 0 : _a2.style) != null ? _b2 : segment.style) != null ? _c : {};
    const source = (_e = (_d = prepared.segments[segmentIndex]) == null ? void 0 : _d.source) != null ? _e : segment.source;
    const parts = segment.text.split("\n");
    parts.forEach((part, partIndex) => {
      if (partIndex > 0) lines.push([]);
      if (part) {
        lines[lines.length - 1].push({
          ...segment,
          text: part,
          style,
          source,
          segmentIndex
        });
      }
    });
  });
  return lines;
}
function toPreLayoutText(text) {
  return text.replace(/\t/g, "    ").replace(/ /g, " ");
}
function applyNodeStyle(type, inherited, attrs) {
  var _a2, _b2, _c, _d, _e;
  const style = { ...inherited, ...parseInlineStyle(attrs == null ? void 0 : attrs.style) };
  if (type === "strong" || type === "b") style.fontWeight = "700";
  if (type === "em" || type === "i" || type === "cite") style.fontStyle = "italic";
  if (type === "code" || type === "kbd" || type === "samp" || type === "tt") {
    style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    style.fontSize = ((_b2 = (_a2 = style.fontSize) != null ? _a2 : inherited.fontSize) != null ? _b2 : DEFAULT_STYLE.fontSize) * 0.92;
  }
  if (type === "u") style.textDecoration = "underline";
  if (type === "s" || type === "strike" || type === "del") style.textDecoration = "line-through";
  if (type === "sup" || type === "sub") {
    style.fontSize = ((_d = (_c = style.fontSize) != null ? _c : inherited.fontSize) != null ? _d : DEFAULT_STYLE.fontSize) * 0.75;
    style.verticalAlign = type === "sup" ? "super" : "sub";
    style.lineHeight = inherited.lineHeight;
  }
  if (/^h[1-6]$/.test(type)) {
    const level = Number(type[1]);
    style.fontWeight = "700";
    style.fontSize = ((_e = inherited.fontSize) != null ? _e : DEFAULT_STYLE.fontSize) * (1.5 - level * 0.08);
  }
  return style;
}
function parseInlineStyle(style) {
  if (!style) return {};
  const result = {};
  for (const [name2, value2] of parseStyleDeclarations(style)) {
    if (name2 === "font-family") result.fontFamily = value2;
    else if (name2 === "font-size") result.fontSize = parseCSSPixels$1(value2);
    else if (name2 === "font-weight") result.fontWeight = value2;
    else if (name2 === "font-style") result.fontStyle = value2;
    else if (name2 === "font-variant") result.fontVariant = value2;
    else if (name2 === "line-height") result.lineHeight = parseLineHeight(value2);
    else if (name2 === "letter-spacing") result.letterSpacing = parseCSSPixels$1(value2);
    else if (name2 === "color") result.color = value2;
    else if (name2 === "text-decoration") result.textDecoration = value2;
    else if (name2 === "vertical-align") result.verticalAlign = value2;
  }
  return result;
}
function parseImageStyle(style) {
  const result = {};
  for (const [name2, value2] of parseStyleDeclarations(style)) {
    if (name2 === "width") result.width = parseCSSDimension(value2);
    else if (name2 === "height") result.height = parseCSSDimension(value2);
    else if (name2 === "max-width") result.maxWidth = parseCSSDimension(value2);
    else if (name2 === "max-height") result.maxHeight = parseCSSDimension(value2);
    else if (name2 === "object-fit" && isObjectFit(value2)) result.objectFit = value2;
    else if (name2 === "text-align") result.align = parseTextAlign(value2);
    else if (name2 === "margin-left" && value2 === "auto") result.align = "center";
    else if (name2 === "margin-right" && value2 === "auto" && result.align === "center") result.align = "center";
  }
  return result;
}
function parsePercentWidth(value2) {
  var _a2;
  if (!value2) return void 0;
  const styleWidth = (_a2 = parseStyleDeclarations(value2).find(([name2]) => name2 === "width")) == null ? void 0 : _a2[1];
  const width = styleWidth != null ? styleWidth : value2;
  const match = width.match(/([\d.]+)%/);
  if (!match) return void 0;
  const amount = Number(match[1]);
  return Number.isFinite(amount) && amount > 0 ? amount : void 0;
}
function parseTextAlignFromStyle(style) {
  var _a2;
  const textAlign = (_a2 = parseStyleDeclarations(style).find(([name2]) => name2 === "text-align")) == null ? void 0 : _a2[1];
  return textAlign ? parseTextAlign(textAlign) : void 0;
}
function parseCSSPixels$1(value2) {
  const match = value2.match(/^([\d.]+)(px|em|rem)?$/);
  if (!match) return void 0;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return void 0;
  return match[2] === "em" || match[2] === "rem" ? amount * DEFAULT_STYLE.fontSize : amount;
}
function parseCSSDimension(value2) {
  if (!value2) return void 0;
  const trimmed = value2.trim();
  if (trimmed === "auto" || trimmed.endsWith("%")) return void 0;
  return parseCSSPixels$1(trimmed);
}
function isObjectFit(value2) {
  return value2 === "contain" || value2 === "cover" || value2 === "fill" || value2 === "none" || value2 === "scale-down";
}
function parseTextAlign(value2) {
  if (value2 === "center") return "center";
  if (value2 === "right" || value2 === "end") return "end";
  if (value2 === "left" || value2 === "start") return "start";
  return void 0;
}
function parseLineHeight(value2) {
  if (value2 === "normal") return void 0;
  const numeric = Number(value2);
  if (Number.isFinite(numeric)) return numeric;
  const px = parseCSSPixels$1(value2);
  return px ? px / DEFAULT_STYLE.fontSize : void 0;
}
function toCanvasFont(style) {
  var _a2, _b2, _c, _d, _e;
  const fontStyle = (_a2 = style.fontStyle) != null ? _a2 : "normal";
  const fontVariant = (_b2 = style.fontVariant) != null ? _b2 : "normal";
  const fontWeight = (_c = style.fontWeight) != null ? _c : "400";
  const fontSize = (_d = style.fontSize) != null ? _d : DEFAULT_STYLE.fontSize;
  const fontFamily = (_e = style.fontFamily) != null ? _e : DEFAULT_STYLE.fontFamily;
  return `${fontStyle} ${fontVariant} ${fontWeight} ${fontSize}px ${fontFamily}`;
}
function joinFragments(fragments) {
  return fragments.map((fragment) => `${fragment.gapBefore > 0 ? " " : ""}${fragment.text}`).join("").trimEnd();
}
function findFirstVisibleLine(lines, y, overscan) {
  let low = 0;
  let high = lines.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (lines[mid].top + lines[mid].height <= y) low = mid + 1;
    else high = mid;
  }
  return Math.max(0, low - overscan);
}
function findLastVisibleLine(lines, y, overscan) {
  var _a2;
  let low = 0;
  let high = lines.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (((_a2 = lines[mid]) == null ? void 0 : _a2.top) <= y) low = mid + 1;
    else high = mid;
  }
  return Math.min(lines.length, low + overscan);
}
function sameStyle(a, b) {
  return JSON.stringify(a != null ? a : {}) === JSON.stringify(b != null ? b : {});
}
function sameSource(a, b) {
  return JSON.stringify(a != null ? a : {}) === JSON.stringify(b != null ? b : {});
}
function normalizeResourceRef(ref) {
  return decodeURI(ref).replace(/[?#].*$/, "").replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();
}
const NS = {
  CONTAINER: "urn:oasis:names:tc:opendocument:xmlns:container",
  XHTML: "http://www.w3.org/1999/xhtml",
  OPF: "http://www.idpf.org/2007/opf",
  EPUB: "http://www.idpf.org/2007/ops",
  DC: "http://purl.org/dc/elements/1.1/",
  NCX: "http://www.daisy.org/z3986/2005/ncx/",
  XLINK: "http://www.w3.org/1999/xlink"
};
const MIME = {
  NCX: "application/x-dtbncx+xml",
  XHTML: "application/xhtml+xml",
  HTML: "text/html",
  CSS: "text/css",
  SVG: "image/svg+xml"
};
const RELATORS = {
  art: "artist",
  aut: "author",
  clr: "colorist",
  edt: "editor",
  ill: "illustrator",
  nrt: "narrator",
  trl: "translator",
  pbl: "publisher"
};
const camel = (x) => x.toLowerCase().replace(/[-:](.)/g, (_, g) => g.toUpperCase());
const childGetter = (doc, ns) => {
  const useNS = doc.lookupNamespaceURI(null) === ns || doc.lookupPrefix(ns);
  const match = (_el, name2) => (e) => useNS ? e.namespaceURI === ns && e.localName === name2 : e.localName === name2;
  const getChildren = (el) => "documentElement" in el ? Array.from(el.documentElement.children) : Array.from(el.children);
  return {
    $: (el, name2) => {
      var _a2;
      return (_a2 = getChildren(el).find(match(el, name2))) != null ? _a2 : null;
    },
    $$: (el, name2) => getChildren(el).filter(match(el, name2)),
    $$$: useNS ? (el, name2) => Array.from(("documentElement" in el ? el : el.ownerDocument).getElementsByTagNameNS(ns, name2)) : (el, name2) => Array.from(("documentElement" in el ? el : el.ownerDocument).getElementsByTagName(name2))
  };
};
const resolveURL = (url, relativeTo) => {
  try {
    url = url.replace(/%2c/gi, ",").replace(/%3a/gi, ":");
    if (relativeTo.includes(":") && !relativeTo.startsWith("OEBPS")) {
      return new URL(url, relativeTo).href;
    }
    const root = "https://invalid.invalid/";
    const obj = new URL(url, root + relativeTo);
    obj.search = "";
    return decodeURI(obj.href.replace(root, ""));
  } catch (e) {
    return url;
  }
};
const normalizeArchivePath = (path) => {
  const normalized = decodeURI(path).replace(/\\/g, "/").replace(/^[a-z]+:\/\/[^/]+\//i, "").replace(/^\/+/, "").replace(/\/{2,}/g, "/");
  const parts = [];
  for (const part of normalized.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
};
function debugEPUB(message, details) {
  debugRebook("epub", message, details);
}
const isExternal = (uri) => uri.startsWith("//") || /^(?!blob)\w+:/i.test(uri);
function readImageSize(buf) {
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);
  if (bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) {
    if (buf.byteLength < 24) return null;
    return { width: view.getUint32(16, false), height: view.getUint32(20, false) };
  }
  if (bytes[0] === 255 && bytes[1] === 216) {
    let offset = 2;
    while (offset + 8 < buf.byteLength) {
      if (bytes[offset] !== 255) break;
      const marker = bytes[offset + 1];
      const len = view.getUint16(offset + 2, false);
      if (marker >= 192 && marker <= 207 && marker !== 196 && marker !== 200 && marker !== 204) {
        if (offset + 8 >= buf.byteLength) return null;
        return { width: view.getUint16(offset + 7, false), height: view.getUint16(offset + 5, false) };
      }
      offset += 2 + len;
    }
    return null;
  }
  if (bytes[0] === 71 && bytes[1] === 73 && bytes[2] === 70) {
    if (buf.byteLength < 10) return null;
    return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
  }
  if (bytes[0] === 82 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 70 && bytes[8] === 87 && bytes[9] === 69 && bytes[10] === 66 && bytes[11] === 80) {
    if (buf.byteLength < 30) return null;
    if (bytes[12] === 86 && bytes[13] === 80 && bytes[14] === 56 && bytes[15] === 32) {
      return {
        width: (view.getUint16(26, true) & 16383) + 1,
        height: (view.getUint16(28, true) & 16383) + 1
      };
    }
    if (bytes[12] === 86 && bytes[13] === 80 && bytes[14] === 56 && bytes[15] === 76) {
      const bits2 = view.getUint32(21, true);
      return { width: (bits2 & 16383) + 1, height: (bits2 >> 14 & 16383) + 1 };
    }
  }
  return null;
}
const getPrefixes = (doc) => {
  const PREFIX = {
    a11y: "http://www.idpf.org/epub/vocab/package/a11y/#",
    dcterms: "http://purl.org/dc/terms/",
    marc: "http://id.loc.gov/vocabulary/",
    media: "http://www.idpf.org/epub/vocab/overlays/#",
    onix: "http://www.editeur.org/ONIX/book/codelists/current.html#",
    rendition: "http://www.idpf.org/vocab/rendition/#",
    schema: "http://schema.org/",
    xsd: "http://www.w3.org/2001/XMLSchema#"
  };
  const map = new Map(Object.entries(PREFIX));
  const value2 = doc.documentElement.getAttributeNS(NS.EPUB, "prefix") || doc.documentElement.getAttribute("prefix");
  if (value2) {
    for (const [, prefix, url] of value2.matchAll(/(.+): +(.+)[ \t\r\n]*/g)) {
      map.set(prefix, url);
    }
  }
  return map;
};
const getPropertyURL = (value2, prefixes) => {
  if (!value2) return null;
  const [a, b] = value2.split(":");
  const prefix = b ? a : null;
  const reference = b ? b : a;
  const baseURL = prefixes.get(prefix);
  return baseURL ? baseURL + reference : null;
};
const parseMetadata = (opf) => {
  var _a2, _b2, _c, _d, _e, _f, _g, _h, _i, _j, _k;
  const { $ } = childGetter(opf, NS.OPF);
  const $metadata = $(opf.documentElement, "metadata");
  if (!$metadata) return { metadata: {}, rendition: {} };
  const baseLang = (_b2 = (_a2 = $metadata.getAttribute("xml:lang")) != null ? _a2 : opf.documentElement.getAttribute("xml:lang")) != null ? _b2 : "und";
  const prefixes = getPrefixes(opf);
  const parseMeta = (el) => {
    var _a3, _b3, _c2, _d2, _e2;
    const property2 = el.getAttribute("property");
    const scheme = el.getAttribute("scheme");
    const getProps = (el2) => {
      const refines = Array.from($metadata.children).filter((child) => child.getAttribute("refines") === "#" + el2.getAttribute("id"));
      if (!refines.length) return null;
      const grouped = {};
      for (const child of refines) {
        const parsed = parseMeta(child);
        const key = parsed.property;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(parsed);
      }
      return grouped;
    };
    return {
      property: (_b3 = (_a3 = getPropertyURL(property2, prefixes)) != null ? _a3 : property2) != null ? _b3 : "",
      scheme: (_d2 = (_c2 = getPropertyURL(scheme, prefixes)) != null ? _c2 : scheme) != null ? _d2 : void 0,
      lang: (_e2 = el.getAttribute("xml:lang")) != null ? _e2 : void 0,
      value: getElementText(el),
      props: getProps(el),
      attrs: Object.fromEntries(
        Array.from(el.attributes).filter((attr) => attr.namespaceURI === NS.OPF).map((attr) => [attr.localName, attr.value])
      )
    };
  };
  const dcElements = {};
  const metaElements = [];
  const legacyMeta = {};
  for (const el of Array.from($metadata.children)) {
    if (el.namespaceURI === NS.DC) {
      const name2 = el.localName;
      if (!dcElements[name2]) dcElements[name2] = [];
      dcElements[name2].push(el);
    } else if (el.namespaceURI === NS.OPF && el.localName === "meta") {
      if (el.hasAttribute("name")) {
        legacyMeta[el.getAttribute("name")] = (_c = el.getAttribute("content")) != null ? _c : "";
      } else {
        metaElements.push(parseMeta(el));
      }
    }
  }
  const dc = (name2) => {
    var _a3;
    return ((_a3 = dcElements[name2]) != null ? _a3 : []).map((el) => {
      var _a4;
      return {
        property: el.localName,
        value: getElementText(el),
        lang: (_a4 = el.getAttribute("xml:lang")) != null ? _a4 : void 0,
        attrs: Object.fromEntries(
          Array.from(el.attributes).filter((attr) => attr.namespaceURI === NS.OPF).map((attr) => [attr.localName, attr.value])
        ),
        props: null
      };
    });
  };
  const one = (arr) => {
    var _a3;
    return (_a3 = arr == null ? void 0 : arr[0]) == null ? void 0 : _a3.value;
  };
  const prop = (x, p) => {
    var _a3, _b3, _c2;
    return (_c2 = (_b3 = (_a3 = x == null ? void 0 : x.props) == null ? void 0 : _a3[p]) == null ? void 0 : _b3[0]) == null ? void 0 : _c2.value;
  };
  const makeLanguageMap = (x) => {
    var _a3, _b3, _c2, _d2, _e2, _f2;
    if (!x) return void 0;
    const alts = (_b3 = (_a3 = x.props) == null ? void 0 : _a3["alternate-script"]) != null ? _b3 : [];
    if (!alts.length && (!x.lang || x.lang === baseLang)) return x.value;
    const map = { [(_c2 = x.lang) != null ? _c2 : baseLang]: x.value };
    for (const y of alts) (_f2 = map[_e2 = (_d2 = y.lang) != null ? _d2 : baseLang]) != null ? _f2 : map[_e2] = y.value;
    return map;
  };
  const makeContributor = (x) => {
    var _a3, _b3, _c2, _d2, _e2, _f2, _g2;
    if (!x) return void 0;
    const name2 = makeLanguageMap(x);
    if (!name2) return void 0;
    return {
      name: name2,
      sortAs: (_c2 = makeLanguageMap((_b3 = (_a3 = x.props) == null ? void 0 : _a3["file-as"]) == null ? void 0 : _b3[0])) != null ? _c2 : x.attrs["file-as"],
      role: (_g2 = (_f2 = (_e2 = (_d2 = x.props) == null ? void 0 : _d2.role) == null ? void 0 : _e2.filter((r) => r.scheme === "http://id.loc.gov/vocabulary/relators")) == null ? void 0 : _f2.map((r) => r.value)) != null ? _g2 : x.attrs.role ? [x.attrs.role] : void 0
    };
  };
  const dcTitle = dc("title");
  const mainTitle = (_d = dcTitle.find((x) => prop(x, "title-type") === "main")) != null ? _d : dcTitle[0];
  const dcCreator = dc("creator");
  const dcContributor = dc("contributor");
  const metadata = {
    identifier: getElementText(
      (_f = opf.getElementById((_e = opf.documentElement.getAttribute("unique-identifier")) != null ? _e : "")) != null ? _f : opf.getElementsByTagNameNS(NS.DC, "identifier")[0]
    ) || void 0,
    title: normalizeTitle(makeLanguageMap(mainTitle)),
    subtitle: normalizeTitle(one(dcTitle.filter((x) => prop(x, "title-type") === "subtitle"))),
    language: normalizeLanguage(dc("language").map((x) => x.value).filter(Boolean)),
    description: one(dc("description")),
    publisher: normalizePublisher(makeContributor(dc("publisher")[0])),
    published: (_h = (_g = dc("date").find((x) => x.attrs.event === "publication")) == null ? void 0 : _g.value) != null ? _h : one(dc("date")),
    modified: (_j = one(metaElements.filter((m) => m.property === "http://purl.org/dc/terms/modified"))) != null ? _j : (_i = dc("date").find((x) => x.attrs.event === "modification")) == null ? void 0 : _i.value,
    subject: dc("subject").map((x) => x.value),
    rights: one(dc("rights"))
  };
  for (const creator of dcCreator) {
    const contrib = makeContributor(creator);
    if (!contrib) continue;
    const roles = (_k = contrib.role) != null ? _k : [];
    const keys = new Set(roles.map((r) => {
      var _a3;
      return (_a3 = RELATORS[r]) != null ? _a3 : "author";
    }));
    if (!keys.size) keys.add("author");
    for (const key of keys) {
      const existing = metadata[key];
      if (Array.isArray(existing)) existing.push(contrib);
      else metadata[key] = [contrib];
    }
  }
  for (const contributor of dcContributor) {
    const contrib = makeContributor(contributor);
    if (!contrib) continue;
    const existing = metadata.contributor;
    if (Array.isArray(existing)) existing.push(contrib);
    else metadata.contributor = [contrib];
  }
  for (const [key, val] of Object.entries(metadata)) {
    if (val == null) delete metadata[key];
  }
  const rendition = {};
  const RENDITION_PREFIX = "http://www.idpf.org/vocab/rendition/#";
  for (const meta of metaElements) {
    if (meta.property.startsWith(RENDITION_PREFIX)) {
      const name2 = camel(meta.property.replace(RENDITION_PREFIX, ""));
      rendition[name2] = meta.value;
    }
  }
  return { metadata, rendition };
};
const parseNav = (doc, resolve) => {
  var _a2, _b2, _c;
  const { $, $$, $$$ } = childGetter(doc, NS.XHTML);
  const resolveHref = (href) => href ? decodeURI(resolve(href)) : null;
  const parseLI = ($li, getType) => {
    var _a3, _b3, _c2, _d;
    const $a = (_a3 = $($li, "a")) != null ? _a3 : $($li, "span");
    const $ol = $($li, "ol");
    const href = resolveHref((_b3 = $a == null ? void 0 : $a.getAttribute("href")) != null ? _b3 : null);
    const label = getElementText($a) || ($a == null ? void 0 : $a.getAttribute("title")) || "";
    const result = {
      label,
      href: href != null ? href : "",
      subitems: (_c2 = parseOL($ol, false)) != null ? _c2 : void 0
    };
    if (getType) {
      result.type = (_d = $a == null ? void 0 : $a.getAttributeNS(NS.EPUB, "type")) == null ? void 0 : _d.split(/\s/);
    }
    return result;
  };
  const parseOL = ($ol, getType) => $ol ? $$($ol, "li").map((li) => parseLI(li, getType)) : null;
  const parseNavElement = ($nav, getType) => parseOL($($nav, "ol"), getType);
  const $$nav = $$$(doc, "nav");
  let toc = null;
  let pageList = null;
  let landmarks = null;
  for (const $nav of $$nav) {
    const type = (_b2 = (_a2 = $nav.getAttributeNS(NS.EPUB, "type")) == null ? void 0 : _a2.split(/\s/)) != null ? _b2 : [];
    if (type.includes("toc") && !toc) {
      toc = parseNavElement($nav, false);
    } else if (type.includes("page-list") && !pageList) {
      pageList = parseNavElement($nav, false);
    } else if (type.includes("landmarks") && !landmarks) {
      const items = parseNavElement($nav, true);
      landmarks = (_c = items == null ? void 0 : items.map((item) => {
        var _a3;
        return {
          label: item.label,
          href: item.href,
          type: (_a3 = item.type) != null ? _a3 : []
        };
      })) != null ? _c : null;
    }
  }
  return { toc, pageList, landmarks };
};
const parseNCX = (doc, resolve) => {
  const { $, $$ } = childGetter(doc, NS.NCX);
  const resolveHref = (href) => href ? decodeURI(resolve(href)) : null;
  const parseItem = (el) => {
    var _a2;
    const $label = $(el, "navLabel");
    const $content = $(el, "content");
    const label = getElementText($label);
    const href = resolveHref((_a2 = $content == null ? void 0 : $content.getAttribute("src")) != null ? _a2 : null);
    if (el.localName === "navPoint") {
      const els = $$(el, "navPoint");
      return {
        label,
        href: href != null ? href : "",
        subitems: els.length ? els.map(parseItem) : void 0
      };
    }
    return { label, href: href != null ? href : "" };
  };
  const parseList = (el, itemName) => $$(el, itemName).map(parseItem);
  const getSingle = (container2, itemName) => {
    const $container = $(doc.documentElement, container2);
    return $container ? parseList($container, itemName) : null;
  };
  return {
    toc: getSingle("navMap", "navPoint"),
    pageList: getSingle("pageList", "pageTarget")
  };
};
class ResourceLoader {
  constructor(loadText, loadBlob, manifest, entries, domAdapter, urlFactory) {
    __publicField(this, "cache", /* @__PURE__ */ new Map());
    __publicField(this, "refCount", /* @__PURE__ */ new Map());
    __publicField(this, "manifest");
    __publicField(this, "entries");
    this.loadText = loadText;
    this.loadBlob = loadBlob;
    this.domAdapter = domAdapter;
    this.urlFactory = urlFactory;
    this.manifest = manifest;
    this.entries = new Map(entries.map((e) => [e.filename, e]));
  }
  async createURL(href, data, type) {
    if (!data) return "";
    const url = this.urlFactory.createURL(data, type);
    this.cache.set(href, url);
    this.refCount.set(href, 1);
    return url;
  }
  async loadItem(item) {
    var _a2;
    if (this.cache.has(item.href)) {
      this.refCount.set(item.href, ((_a2 = this.refCount.get(item.href)) != null ? _a2 : 0) + 1);
      return this.cache.get(item.href);
    }
    return this.loadReplaced(item);
  }
  async loadReplaced(item) {
    var _a2;
    const { href, mediaType } = item;
    const htmlTypes = [MIME.XHTML, MIME.HTML, MIME.SVG];
    if (htmlTypes.includes(mediaType)) {
      const str = await this.loadText(href);
      if (!str) return "";
      let doc;
      try {
        doc = this.domAdapter.parseXML(str);
      } catch (error) {
        if (mediaType !== MIME.XHTML && mediaType !== MIME.HTML) throw error;
        doc = this.domAdapter.parseHTML(str, MIME.HTML);
      }
      if (mediaType === MIME.XHTML && (doc.querySelector("parsererror") || !((_a2 = doc.documentElement) == null ? void 0 : _a2.namespaceURI))) {
        doc = this.domAdapter.parseHTML(str, MIME.HTML);
      }
      await this.applyLinkedStyles(doc, href);
      const replace = async (el, attr) => {
        const val = el.getAttribute(attr);
        if (val) {
          const resolved = resolveURL(val, href);
          const replaced = await this.loadHref(val, href);
          if (attr === "src" || attr === "poster" || attr === "data") {
            el.setAttribute(`data-rebook-original-${attr}`, resolved);
          }
          el.setAttribute(attr, replaced);
          if ((attr === "src" || attr === "poster" || attr === "data") && replaced === val) {
            debugEPUB("resource attr kept original value", {
              base: href,
              tag: el.localName,
              attr,
              value: val,
              resolved
            });
          } else if ((attr === "src" || attr === "poster" || attr === "data") && isRebookDebugEnabled()) {
            debugEPUB("resource attr replaced", {
              base: href,
              tag: el.localName,
              attr,
              value: val,
              resolved,
              replaced
            });
          }
        }
      };
      for (const el of doc.querySelectorAll("link[href]")) await replace(el, "href");
      for (const el of doc.querySelectorAll("[href]")) {
        if (!isNavigationHrefElement(el)) await replace(el, "href");
      }
      for (const el of doc.querySelectorAll("[src]")) {
        const srcBefore = el.getAttribute("src");
        await replace(el, "src");
        if (el.localName.toLowerCase() === "img" && !el.getAttribute("width") && !el.getAttribute("height") && srcBefore) {
          const imgHref = resolveURL(srcBefore, href);
          const imgItem = this.findResourceItem(imgHref);
          if ((imgItem == null ? void 0 : imgItem.mediaType.startsWith("image/")) && imgItem.mediaType !== MIME.SVG) {
            try {
              const blob2 = await this.loadBlob(imgItem.href);
              if (blob2) {
                const buf = await blob2.arrayBuffer();
                const size = readImageSize(buf);
                if ((size == null ? void 0 : size.width) && (size == null ? void 0 : size.height)) {
                  el.setAttribute("width", String(size.width));
                  el.setAttribute("height", String(size.height));
                }
              }
            } catch (e) {
            }
          }
        }
      }
      for (const el of doc.querySelectorAll("[poster]")) await replace(el, "poster");
      for (const el of doc.querySelectorAll("object[data]")) await replace(el, "data");
      for (const el of doc.querySelectorAll("[*|href]:not([href])")) {
        const val = el.getAttributeNS(NS.XLINK, "href");
        if (val) {
          el.setAttribute("data-rebook-original-href", resolveURL(val, href));
          el.setAttributeNS(NS.XLINK, "href", await this.loadHref(val, href));
        }
      }
      for (const el of doc.querySelectorAll("[srcset]")) {
        const srcset = el.getAttribute("srcset");
        if (srcset) {
          const replaced = await replaceSeries(
            srcset,
            /(\s*)(.+?)\s*((?:\s[\d.]+[wx])+\s*(?:,|$)|,\s+|$)/g,
            async (_, p1, p2, p3) => {
              const newUrl = await this.loadHref(p2, href);
              return `${p1}${newUrl}${p3}`;
            }
          );
          el.setAttribute("srcset", replaced);
        }
      }
      for (const el of doc.querySelectorAll("style")) {
        if (el.textContent) {
          el.textContent = await this.replaceCSS(el.textContent, href);
        }
      }
      for (const el of doc.querySelectorAll("[style]")) {
        const style = el.getAttribute("style");
        if (style) el.setAttribute("style", await this.replaceCSS(style, href));
      }
      const result = this.domAdapter.serialize(doc);
      this.cache.set(href, result);
      this.refCount.set(href, 1);
      return result;
    }
    if (mediaType === MIME.CSS) {
      const str = await this.loadText(href);
      if (!str) return "";
      const result = await this.replaceCSS(str, href);
      return this.createURL(href, result, mediaType);
    }
    const blob = await this.loadBlob(href);
    if (!blob) return "";
    const buffer = await blob.arrayBuffer();
    return this.createURL(href, buffer, mediaType);
  }
  async loadHref(url, base) {
    if (!url || url.startsWith("#") || isExternal(url)) return url;
    const href = resolveURL(url, base);
    const item = this.findResourceItem(href);
    if (!item) {
      debugEPUB("resource item not found", {
        base,
        url,
        resolved: href,
        normalized: normalizeArchivePath(href),
        manifestSample: this.manifest.slice(0, 8).map((item2) => item2.href),
        entrySample: Array.from(this.entries.keys()).slice(0, 8)
      });
      return url;
    }
    return await this.loadItem(item) || href;
  }
  findResourceItem(href) {
    var _a2;
    const normalizedHref = normalizeArchivePath(href);
    const manifestItem = (_a2 = this.manifest.find((m) => normalizeArchivePath(m.href) === normalizedHref)) != null ? _a2 : this.manifest.find((m) => normalizeArchivePath(m.href).endsWith(`/${normalizedHref}`));
    if (manifestItem) return manifestItem;
    const exactEntry = this.entries.get(normalizedHref);
    const suffixEntry = exactEntry ? void 0 : Array.from(this.entries.values()).find((entry2) => normalizeArchivePath(entry2.filename).endsWith(`/${normalizedHref}`));
    const entry = exactEntry != null ? exactEntry : suffixEntry;
    if (!entry) return void 0;
    const entryHref = normalizeArchivePath(entry.filename);
    if (entryHref !== normalizedHref) {
      debugEPUB("resource entry matched by suffix", {
        requested: href,
        normalized: normalizedHref,
        matched: entryHref
      });
    }
    return {
      id: entryHref,
      href: entryHref,
      mediaType: getMimeTypeFromPath(entryHref)
    };
  }
  async applyLinkedStyles(doc, href) {
    var _a2, _b2;
    const cssTexts = [];
    for (const el of doc.querySelectorAll("style")) {
      if (el.textContent) cssTexts.push(el.textContent);
    }
    for (const el of doc.querySelectorAll("link[href]")) {
      const url = el.getAttribute("href");
      if (!url || isExternal(url)) continue;
      const cssHref = resolveURL(url, href);
      const item = this.findResourceItem(cssHref);
      if (!item || item.mediaType !== MIME.CSS) continue;
      const css = await this.loadCSSWithImports(item.href);
      if (css) cssTexts.push(css);
    }
    const rules = parseSimpleClassRules(cssTexts.join("\n"));
    if (!rules.length) return;
    for (const el of doc.querySelectorAll("[class]")) {
      const classNames = new Set(((_a2 = el.getAttribute("class")) != null ? _a2 : "").split(/\s+/).filter(Boolean));
      if (!classNames.size) continue;
      const tagName = el.localName.toLowerCase();
      const declarations = rules.filter((rule) => rule.matches(tagName, classNames)).map((rule) => rule.declarations).join("; ");
      if (!declarations) continue;
      el.setAttribute("style", mergeStyleDeclarations(declarations, (_b2 = el.getAttribute("style")) != null ? _b2 : ""));
    }
  }
  async loadCSSWithImports(href, seen = /* @__PURE__ */ new Set()) {
    if (seen.has(href)) return "";
    seen.add(href);
    const css = await this.loadText(href);
    if (!css) return "";
    const imports = [];
    for (const url of extractImportURLs(css)) {
      const importHref = resolveURL(url, href);
      const item = this.findResourceItem(importHref);
      if ((item == null ? void 0 : item.mediaType) === MIME.CSS) {
        imports.push(await this.loadCSSWithImports(item.href, seen));
      }
    }
    return [...imports, css].filter(Boolean).join("\n");
  }
  async replaceCSS(str, href) {
    const replacedUrls = await replaceSeries(
      str,
      /url\(\s*["']?([^'"\n]*?)\s*["']?\s*\)/gi,
      async (_, url) => {
        const newUrl = await this.loadHref(url, href);
        return `url("${newUrl}")`;
      }
    );
    return replaceSeries(
      replacedUrls,
      /@import\s*["']([^"'\n]*?)["']/gi,
      async (_, url) => {
        const newUrl = await this.loadHref(url, href);
        return `@import "${newUrl}"`;
      }
    );
  }
  unref(href) {
    var _a2;
    const count = ((_a2 = this.refCount.get(href)) != null ? _a2 : 0) - 1;
    if (count <= 0) {
      const url = this.cache.get(href);
      if (url && url.startsWith("blob:")) this.urlFactory.revokeURL(url);
      this.cache.delete(href);
      this.refCount.delete(href);
    } else {
      this.refCount.set(href, count);
    }
  }
  destroy() {
    for (const url of this.cache.values()) {
      if (url.startsWith("blob:")) this.urlFactory.revokeURL(url);
    }
    this.cache.clear();
    this.refCount.clear();
  }
}
function isNavigationHrefElement(el) {
  const name2 = el.localName.toLowerCase();
  return name2 === "a" || name2 === "area" || name2 === "link";
}
class EPUBParser {
  constructor() {
    __publicField(this, "priority", 10);
  }
  async canParse(input) {
    if (typeof input === "string") return input.endsWith(".epub");
    if (isBlobLike$1(input) || input instanceof ArrayBuffer) {
      if (!await isZipFile(input)) return false;
      try {
        const loader = await createZipLoader(input);
        return loader.entries.some((e) => e.filename === "META-INF/container.xml");
      } catch (e) {
        return false;
      }
    }
    return false;
  }
  async parse(input, options) {
    let loader;
    if (isBlobLike$1(input)) {
      loader = await createZipLoader(input);
    } else if (input instanceof ArrayBuffer) {
      loader = await createZipLoader(input);
    } else if (typeof input === "string") {
      const res = await fetch(input);
      const buffer = await res.arrayBuffer();
      loader = await createZipLoader(buffer);
    } else {
      throw new UnsupportedInputError("Unsupported input type for EPUB parser");
    }
    if (!(options == null ? void 0 : options.domAdapter) || !(options == null ? void 0 : options.urlFactory)) {
      throw new AdapterRequiredError("domAdapter and urlFactory");
    }
    const epub2 = new EPUBBook(loader, options.domAdapter, options.urlFactory);
    return epub2.init();
  }
}
class EPUBBook {
  constructor(loader, domAdapter, urlFactory) {
    __publicField(this, "loader");
    __publicField(this, "domAdapter");
    __publicField(this, "urlFactory");
    __publicField(this, "resourceLoader");
    __publicField(this, "manifest", []);
    __publicField(this, "manifestById", /* @__PURE__ */ new Map());
    __publicField(this, "spine", []);
    __publicField(this, "opfPath", "");
    __publicField(this, "sections", []);
    __publicField(this, "dir");
    __publicField(this, "toc");
    __publicField(this, "pageList");
    __publicField(this, "landmarks");
    __publicField(this, "metadata");
    __publicField(this, "rendition");
    this.loader = loader;
    this.domAdapter = domAdapter;
    this.urlFactory = urlFactory;
  }
  async loadXML(uri) {
    var _a2;
    const str = await this.loader.loadText(uri);
    if (!str) return null;
    const doc = this.domAdapter.parseXML(str);
    if (doc.querySelector("parsererror")) {
      throw new ParseError(`XML parsing error in ${uri}: ${(_a2 = doc.querySelector("parsererror")) == null ? void 0 : _a2.textContent}`, "epub");
    }
    return doc;
  }
  async init() {
    var _a2, _b2, _c, _d, _e, _f;
    const $container = await this.loadXML("META-INF/container.xml");
    if (!$container) throw new CorruptedFileError("Failed to load container.xml", "epub");
    const rootfiles = Array.from(
      $container.getElementsByTagNameNS(NS.CONTAINER, "rootfile")
    ).map((el) => ({
      fullPath: el.getAttribute("full-path"),
      mediaType: el.getAttribute("media-type")
    }));
    const opfFile = rootfiles.find((f) => f.mediaType === "application/oebps-package+xml");
    if (!(opfFile == null ? void 0 : opfFile.fullPath)) throw new CorruptedFileError("No package document found", "epub");
    this.opfPath = opfFile.fullPath;
    const opf = await this.loadXML(this.opfPath);
    if (!opf) throw new CorruptedFileError("Failed to load OPF", "epub");
    const { $ } = childGetter(opf, NS.OPF);
    const $manifest = $(opf.documentElement, "manifest");
    const $spine = $(opf.documentElement, "spine");
    if ($manifest) {
      this.manifest = Array.from($manifest.children).filter((el) => el.localName === "item").map((el) => {
        var _a3, _b3, _c2, _d2, _e2;
        const href = (_a3 = el.getAttribute("href")) != null ? _a3 : "";
        return {
          id: (_b3 = el.getAttribute("id")) != null ? _b3 : "",
          href: this.resolveManifestHref(href),
          mediaType: (_c2 = el.getAttribute("media-type")) != null ? _c2 : "",
          properties: (_d2 = el.getAttribute("properties")) == null ? void 0 : _d2.split(/\s/),
          mediaOverlay: (_e2 = el.getAttribute("media-overlay")) != null ? _e2 : void 0
        };
      });
      this.manifestById = new Map(this.manifest.map((m) => [m.id, m]));
    }
    if ($spine) {
      this.spine = Array.from($spine.children).filter((el) => el.localName === "itemref").map((el) => {
        var _a3, _b3, _c2;
        return {
          idref: (_a3 = el.getAttribute("idref")) != null ? _a3 : "",
          linear: (_b3 = el.getAttribute("linear")) != null ? _b3 : void 0,
          properties: (_c2 = el.getAttribute("properties")) == null ? void 0 : _c2.split(/\s/)
        };
      });
      this.dir = (_a2 = $spine.getAttribute("page-progression-direction")) != null ? _a2 : void 0;
    }
    this.resourceLoader = new ResourceLoader(
      this.loader.loadText.bind(this.loader),
      this.loader.loadBlob.bind(this.loader),
      this.manifest,
      this.loader.entries,
      this.domAdapter,
      this.urlFactory
    );
    this.sections = this.spine.map((spineItem, index) => {
      const item = this.manifestById.get(spineItem.idref);
      if (!item) return null;
      return {
        id: item.href,
        load: () => this.resourceLoader.loadItem(item),
        unload: () => this.resourceLoader.unref(item.href),
        format: "xhtml",
        loadText: () => this.loader.loadText(item.href).then((t) => t != null ? t : ""),
        createDocument: () => this.loadDocument(item),
        getDocument: async () => {
          const html = await this.loadDocument(item);
          const nodes = parseHTML(html, this.domAdapter);
          return createSectionDocument(nodes, this.domAdapter);
        },
        getSegments: async () => {
          const html = await this.loadDocument(item);
          const nodes = parseHTML(html, this.domAdapter);
          return extractDocumentSegments(nodes);
        },
        getBlocks: async () => {
          const html = await this.resourceLoader.loadItem(item);
          const nodes = parseHTML(html, this.domAdapter);
          return extractDocumentBlocks(nodes, {}, {
            coverImageSrcs: this.getCoverImageSrcs()
          });
        },
        size: this.loader.getSize(item.href),
        linear: spineItem.linear,
        cfi: `/6/${(index + 1) * 2}`,
        resolveHref: (href) => resolveURL(href, item.href)
      };
    }).filter((s) => s !== null);
    const navItem = this.manifest.find((m) => {
      var _a3;
      return (_a3 = m.properties) == null ? void 0 : _a3.includes("nav");
    });
    const ncxItem = this.manifest.find((m) => m.mediaType === MIME.NCX);
    if (navItem) {
      try {
        const navDoc = await this.loadXML(navItem.href);
        if (navDoc) {
          const resolve = (url) => resolveURL(url, navItem.href);
          const nav = parseNav(navDoc, resolve);
          this.toc = this.normalizeTOCItems((_b2 = nav.toc) != null ? _b2 : void 0);
          this.pageList = this.normalizeTOCItems((_c = nav.pageList) != null ? _c : void 0);
          this.landmarks = (_d = nav.landmarks) != null ? _d : void 0;
        }
      } catch (e) {
        console.warn("Failed to parse navigation:", e);
      }
    }
    if (!this.toc && ncxItem) {
      try {
        const ncxDoc = await this.loadXML(ncxItem.href);
        if (ncxDoc) {
          const resolve = (url) => resolveURL(url, ncxItem.href);
          const ncx = parseNCX(ncxDoc, resolve);
          this.toc = this.normalizeTOCItems((_e = ncx.toc) != null ? _e : void 0);
          this.pageList = this.normalizeTOCItems((_f = ncx.pageList) != null ? _f : void 0);
        }
      } catch (e) {
        console.warn("Failed to parse NCX:", e);
      }
    }
    const { metadata, rendition } = parseMetadata(opf);
    this.metadata = metadata;
    this.rendition = rendition;
    return this;
  }
  async loadDocument(item) {
    var _a2;
    const str = (_a2 = await this.loader.loadText(item.href)) != null ? _a2 : "";
    return str;
  }
  resolveManifestHref(href) {
    var _a2, _b2;
    const resolved = resolveURL(href, this.opfPath);
    return (_b2 = (_a2 = this.findExistingEntryHref(resolved)) != null ? _a2 : this.findExistingEntryHref(href)) != null ? _b2 : resolved;
  }
  findExistingEntryHref(href) {
    var _a2;
    const normalized = normalizeArchivePath(href);
    if (!normalized) return null;
    if (this.loader.getSize(normalized) > 0) return normalized;
    const exact = this.loader.entries.find((entry) => normalizeArchivePath(entry.filename) === normalized);
    if (exact) return exact.filename;
    const suffix = `/${normalized}`;
    const match = this.loader.entries.find((entry) => normalizeArchivePath(entry.filename).endsWith(suffix));
    return (_a2 = match == null ? void 0 : match.filename) != null ? _a2 : null;
  }
  normalizeNavigationHref(href) {
    var _a2;
    const [path, hash] = href.split("#");
    if (!path) return href;
    const normalized = (_a2 = this.findExistingEntryHref(path)) != null ? _a2 : path;
    return hash ? `${normalized}#${hash}` : normalized;
  }
  normalizeTOCItems(items) {
    return items == null ? void 0 : items.map((item) => {
      var _a2;
      return {
        ...item,
        href: this.normalizeNavigationHref(item.href),
        subitems: this.normalizeTOCItems((_a2 = item.subitems) != null ? _a2 : void 0)
      };
    });
  }
  resolveHref(href) {
    var _a2, _b2, _c;
    const [path, hash] = href.split("#");
    const normalizedPath = normalizeArchivePath(path);
    const item = (_a2 = this.manifest.find((m) => normalizeArchivePath(m.href) === normalizedPath)) != null ? _a2 : this.manifest.find((m) => normalizeArchivePath(m.href).endsWith(`/${normalizedPath}`));
    const sectionHref = (_c = item == null ? void 0 : item.href) != null ? _c : (_b2 = this.sections.find((section) => normalizeArchivePath(String(section.id)).endsWith(`/${normalizedPath}`))) == null ? void 0 : _b2.id;
    if (!sectionHref) return null;
    const index = this.sections.findIndex((s) => s.id === sectionHref);
    if (index < 0) return null;
    const anchor = hash ? (doc) => doc.getElementById(hash) : () => 0;
    return { index, anchor };
  }
  isExternal(href) {
    return isExternal(href);
  }
  splitTOCHref(href) {
    var _a2;
    const parts = href.split("#");
    return [parts[0], (_a2 = parts[1]) != null ? _a2 : null];
  }
  getTOCFragment(doc, id) {
    var _a2;
    const xmlDoc = doc;
    return (_a2 = xmlDoc.getElementById(String(id))) != null ? _a2 : xmlDoc.querySelector(`[name="${cssEscape(String(id))}"]`);
  }
  async getCover() {
    const coverItem = this.getCoverImageItem();
    if (!coverItem) return null;
    const blob = await this.loader.loadBlob(coverItem.href);
    return blob;
  }
  getCoverImageItem() {
    var _a2, _b2, _c;
    return (_c = (_b2 = (_a2 = this.manifest.find((m) => {
      var _a3;
      return (_a3 = m.properties) == null ? void 0 : _a3.includes("cover-image");
    })) != null ? _a2 : this.manifest.find((m) => m.id === "cover" && m.mediaType.startsWith("image"))) != null ? _b2 : this.manifest.find((m) => m.href.includes("cover") && m.mediaType.startsWith("image"))) != null ? _c : this.manifest.find((m) => m.mediaType.startsWith("image"));
  }
  getCoverImageSrcs() {
    const coverItem = this.getCoverImageItem();
    return coverItem ? [coverItem.href] : [];
  }
  destroy() {
    var _a2;
    (_a2 = this.resourceLoader) == null ? void 0 : _a2.destroy();
  }
}
const epub = () => new EPUBParser();
const IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".bmp",
  ".webp",
  ".svg",
  ".avif"
];
const isImageFile = (filename) => {
  const lower = filename.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
};
async function readComicInfoXML(loader, domAdapter) {
  const entry = loader.entries.find((e) => e.filename.toLowerCase() === "comicinfo.xml");
  if (!entry) return null;
  const text = await loader.loadText(entry.filename);
  if (!text) return null;
  const doc = domAdapter.parseXML(text);
  const root = doc.documentElement;
  const get = (tag) => {
    var _a2;
    const els = root.getElementsByTagName(tag);
    if (els.length > 0) {
      const text2 = (_a2 = els[0].textContent) == null ? void 0 : _a2.trim();
      return text2 || void 0;
    }
    return void 0;
  };
  return {
    title: get("Title"),
    publisher: get("Publisher"),
    language: get("LanguageISO"),
    author: get("Writer"),
    series: get("Series"),
    seriesPosition: get("Number"),
    seriesTotal: get("Count")
  };
}
async function readComicBookInfo(loader) {
  if (!loader.getComment) return null;
  const comment = await loader.getComment();
  if (!comment) return null;
  try {
    const parsed = JSON.parse(comment);
    const info = parsed["ComicBookInfo/1.0"];
    if (!info) return null;
    const year = info.publicationYear;
    const month = info.publicationMonth;
    const mm = month && month >= 1 && month <= 12 ? String(month).padStart(2, "0") : null;
    return {
      title: info.title,
      publisher: info.publisher,
      language: info.language,
      author: info.credits ? info.credits.map((c) => `${c.person} (${c.role})`).join(", ") : void 0,
      series: info.series,
      seriesPosition: info.issue != null ? String(info.issue) : void 0,
      seriesTotal: void 0
    };
  } catch (e) {
    return null;
  }
}
class CBZParser {
  constructor() {
    __publicField(this, "priority", 0);
  }
  async canParse(input) {
    if (typeof input === "string") {
      return input.toLowerCase().endsWith(".cbz");
    }
    const inputName = getInputName(input);
    if (inputName) {
      return inputName.toLowerCase().endsWith(".cbz");
    }
    const isZip = await isZipFile(input);
    if (!isZip) return false;
    try {
      const loader = await createZipLoader(input);
      return loader.entries.some((e) => isImageFile(e.filename));
    } catch (e) {
      return false;
    }
  }
  async parse(input, options) {
    if (typeof input === "string") {
      throw new UnsupportedInputError("CBZ parser cannot parse URL strings; provide a File, Blob, or ArrayBuffer");
    }
    if (!(options == null ? void 0 : options.domAdapter)) {
      throw new AdapterRequiredError("domAdapter");
    }
    const domAdapter = options.domAdapter;
    const loader = await createZipLoader(input);
    const imageFiles = loader.entries.map((e) => e.filename).filter(isImageFile).sort();
    if (imageFiles.length === 0) {
      throw new ParseError("No image files found in archive", "cbz");
    }
    const [xmlMeta, cbiMeta] = await Promise.all([
      readComicInfoXML(loader, domAdapter),
      readComicBookInfo(loader)
    ]);
    const merged = { ...cbiMeta || {}, ...xmlMeta || {} };
    const metadata = {};
    if (merged.title) metadata.title = merged.title;
    if (merged.publisher) metadata.publisher = merged.publisher;
    if (merged.language) metadata.language = merged.language;
    if (merged.author) metadata.author = normalizeContributors(merged.author);
    if (merged.series) {
      metadata.belongsTo = {
        series: {
          name: merged.series,
          position: merged.seriesPosition,
          total: merged.seriesTotal
        }
      };
    }
    const dataCache = /* @__PURE__ */ new Map();
    const blobToDataURI = async (blob, mimeType) => {
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return `data:${mimeType};base64,${btoa(binary)}`;
    };
    const sections = imageFiles.map((filename) => ({
      id: filename,
      size: loader.getSize(filename),
      format: "image",
      load: async () => {
        if (dataCache.has(filename)) {
          return dataCache.get(filename);
        }
        const blob = await loader.loadBlob(filename);
        if (!blob) throw new ParseError(`Failed to load ${filename}`, "cbz");
        const dataURI = await blobToDataURI(blob, getMimeTypeFromPath(filename));
        dataCache.set(filename, dataURI);
        return dataURI;
      },
      unload: () => {
        dataCache.delete(filename);
      },
      // Images don't have a document model
      getDocument: async () => null
    }));
    const toc = imageFiles.map((filename) => ({
      label: filename,
      href: filename
    }));
    const book = {
      sections,
      toc,
      metadata,
      rendition: { layout: "pre-paginated" },
      getCover: async () => {
        if (imageFiles.length === 0) return null;
        return loader.loadBlob(imageFiles[0]);
      },
      resolveHref: (href) => {
        const index = sections.findIndex((s) => s.id === href);
        return index >= 0 ? { index } : null;
      },
      destroy: () => {
        dataCache.clear();
      }
    };
    return book;
  }
}
const cbz = () => new CBZParser();
const XLINK_NS$1 = "http://www.w3.org/1999/xlink";
const textEncoder = new TextEncoder();
const findByTag = (el, tagName) => {
  var _a2;
  const matches = el.getElementsByTagName(tagName);
  return (_a2 = matches[0]) != null ? _a2 : null;
};
const findAllByTag = (el, tagName) => {
  return el.getElementsByTagName(tagName);
};
const STYLE = {
  "strong": ["strong", "self"],
  "emphasis": ["em", "self"],
  "style": ["span", "self"],
  "a": "anchor",
  "strikethrough": ["s", "self"],
  "sub": ["sub", "self"],
  "sup": ["sup", "self"],
  "code": ["code", "self"],
  "image": "image"
};
const TABLE = {
  "tr": ["tr", {
    "th": ["th", STYLE, ["colspan", "rowspan", "align", "valign"]],
    "td": ["td", STYLE, ["colspan", "rowspan", "align", "valign"]]
  }, ["align"]]
};
const POEM = {
  "epigraph": ["blockquote"],
  "subtitle": ["h2", STYLE],
  "text-author": ["p", STYLE],
  "date": ["p", STYLE],
  "stanza": ["div", "self"],
  "v": ["div", STYLE]
};
const SECTION = {
  "title": ["header", {
    "p": ["h1", STYLE],
    "empty-line": ["br"]
  }],
  "epigraph": ["blockquote", "self"],
  "image": "image",
  "annotation": ["aside"],
  "section": ["section", "self"],
  "p": ["p", STYLE],
  "poem": ["blockquote", POEM],
  "subtitle": ["h2", STYLE],
  "cite": ["blockquote", "self"],
  "empty-line": ["br"],
  "table": ["table", TABLE],
  "text-author": ["p", STYLE]
};
POEM["epigraph"] = ["blockquote", SECTION];
const BODY = {
  "image": "image",
  "title": ["section", {
    "p": ["h1", STYLE],
    "empty-line": ["br"]
  }],
  "epigraph": ["section", SECTION],
  "section": ["section", SECTION]
};
class FB2Converter {
  constructor(fb22, domAdapter) {
    __publicField(this, "bins");
    __publicField(this, "doc");
    this.fb2 = fb22;
    this.domAdapter = domAdapter;
    this.doc = fb22;
    this.bins = /* @__PURE__ */ new Map();
    for (const bin of findAllByTag(fb22.documentElement, "binary")) {
      const id = bin.getAttribute("id");
      if (id) this.bins.set(id, bin);
    }
  }
  /**
   * Get image src from FB2 <image> element.
   */
  getImageSrc(el) {
    const href = el.getAttributeNS(XLINK_NS$1, "href");
    if (!href) return "data:,";
    const [, id] = href.split("#");
    if (!id) return href;
    const bin = this.bins.get(id);
    if (bin) {
      const contentType = bin.getAttribute("content-type") || "image/png";
      const content = bin.textContent || "";
      return `data:${contentType};base64,${content}`;
    }
    return href;
  }
  /**
   * Convert an image element.
   */
  convertImage(node2) {
    const alt = node2.getAttribute("alt") || "";
    const title = node2.getAttribute("title") || "";
    const src = this.getImageSrc(node2);
    return `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" title="${escapeAttr(title)}">`;
  }
  /**
   * Convert an anchor element.
   */
  convertAnchor(node2) {
    const href = node2.getAttributeNS(XLINK_NS$1, "href") || "";
    const type = node2.getAttribute("type");
    const inner = this.convertChildren(node2, STYLE);
    const typeAttr = type === "note" ? ' epub:type="noteref"' : "";
    return `<a href="${escapeAttr(href)}"${typeAttr}>${inner}</a>`;
  }
  /**
   * Escape HTML text content.
   */
  escapeText(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  /**
   * Convert child elements using the given mapping.
   */
  convertChildren(node2, def) {
    if (!def) return "";
    let result = "";
    for (const child of node2.children) {
      const converted = def === "self" ? this.convertElement(child, def) : this.convertElement(child, def);
      if (converted) result += converted;
    }
    return result;
  }
  /**
   * Convert a single element using the mapping table.
   */
  convertElement(node2, def) {
    const nodeName = node2.localName;
    if (!nodeName) return "";
    const d = def[nodeName];
    if (!d) return "";
    if (typeof d === "string") {
      if (d === "image") return this.convertImage(node2);
      if (d === "anchor") return this.convertAnchor(node2);
      return "";
    }
    const [name2, opts, attrs] = d;
    let result = `<${name2}`;
    const id = node2.getAttribute("id");
    if (id) result += ` id="${escapeAttr(id)}"`;
    result += ` class="${nodeName}"`;
    if (attrs) {
      for (const attr of attrs) {
        const value2 = node2.getAttribute(attr);
        if (value2) result += ` ${attr}="${escapeAttr(value2)}"`;
      }
    }
    result += ">";
    const childDef = opts === "self" ? def : opts;
    const childContent = this.convertChildren(node2, childDef);
    result += childContent;
    if (!childContent && node2.children.length === 0) {
      result += this.escapeText(node2.textContent || "");
    }
    result += `</${name2}>`;
    return result;
  }
  /**
   * Convert a body element to XHTML.
   */
  convertBody(body) {
    return this.convertChildren(body, BODY);
  }
}
class FB2Parser {
  constructor() {
    __publicField(this, "priority", 5);
  }
  async canParse(input) {
    if (typeof input === "string") {
      const lower = input.toLowerCase();
      return lower.endsWith(".fb2") || lower.endsWith(".fbz") || lower.endsWith(".fb2.zip");
    }
    const inputName = getInputName(input);
    if (inputName) {
      const lower = inputName.toLowerCase();
      if (lower.endsWith(".fb2") || lower.endsWith(".fbz") || lower.endsWith(".fb2.zip")) return true;
    }
    if (input instanceof ArrayBuffer) {
      try {
        const text = new TextDecoder().decode(input.slice(0, 1024));
        if (text.includes("<FictionBook")) return true;
      } catch (e) {
      }
    }
    if (await isZipFile(input)) {
      try {
        const loader = await createZipLoader(input);
        return loader.entries.some((e) => e.filename.toLowerCase().endsWith(".fb2"));
      } catch (e) {
        return false;
      }
    }
    return false;
  }
  async parse(input, options) {
    var _a2;
    const domAdapter = options == null ? void 0 : options.domAdapter;
    if (!domAdapter) {
      throw new AdapterRequiredError("domAdapter");
    }
    if (typeof input === "string") {
      throw new UnsupportedInputError("FB2 parser cannot parse URL strings; provide a File, Blob, or ArrayBuffer");
    }
    let xmlContent;
    if (await isZipFile(input)) {
      const loader = await createZipLoader(input);
      const fb2Entry = loader.entries.find((e) => e.filename.toLowerCase().endsWith(".fb2"));
      if (!fb2Entry) throw new ParseError("No .fb2 file found in archive", "fb2");
      const text = await loader.loadText(fb2Entry.filename);
      if (!text) throw new ParseError("Failed to load FB2 content", "fb2");
      xmlContent = text;
    } else if (input instanceof ArrayBuffer) {
      xmlContent = new TextDecoder().decode(input);
    } else if (typeof input === "string") {
      xmlContent = input;
    } else if (isBlobLike$1(input)) {
      xmlContent = input.text ? await input.text() : new TextDecoder().decode(await input.arrayBuffer());
    } else {
      throw new UnsupportedInputError("Unsupported input type for FB2 parser");
    }
    const doc = domAdapter.parseXML(xmlContent);
    const parseError = doc.querySelector("parsererror");
    if (parseError) {
      throw new ParseError("Failed to parse FB2 XML", "fb2");
    }
    const converter = new FB2Converter(doc, domAdapter);
    const root = doc.documentElement;
    const $ = (tag) => findByTag(root, tag);
    const getPerson = (el) => {
      const nick = getElementText(findByTag(el, "nickname"));
      if (nick) return { name: nick };
      const first = getElementText(findByTag(el, "first-name"));
      const middle = getElementText(findByTag(el, "middle-name"));
      const last = getElementText(findByTag(el, "last-name"));
      const name2 = [first, middle, last].filter((x) => x).join(" ");
      const sortAs = last ? [last, [first, middle].filter((x) => x).join(" ")].join(", ") : void 0;
      return { name: name2, sortAs };
    };
    const getDate = (el) => {
      var _a3, _b2;
      if (!el) return void 0;
      return (_b2 = (_a3 = el.getAttribute("value")) != null ? _a3 : getElementText(el)) != null ? _b2 : void 0;
    };
    const titleInfo = $("title-info");
    const docInfo = $("document-info");
    const publishInfo = $("publish-info");
    const metadata = {};
    if (titleInfo) {
      const title = getElementText(findByTag(titleInfo, "book-title"));
      if (title) metadata.title = title;
      const lang = getElementText(findByTag(titleInfo, "lang"));
      if (lang) metadata.language = lang;
      const authors = findAllByTag(titleInfo, "author").map(getPerson);
      if (authors.length > 0) metadata.author = authors;
      const translators = findAllByTag(titleInfo, "translator").map(getPerson);
      if (translators.length > 0) metadata.translator = translators;
      const genres = findAllByTag(titleInfo, "genre").map(getElementText);
      if (genres.length > 0) metadata.subject = genres;
      const date = getDate(findByTag(titleInfo, "date"));
      if (date) metadata.published = date;
      const annotation = findByTag(titleInfo, "annotation");
      if (annotation) {
        const descHtml = converter.convertBody(annotation);
        if (descHtml) metadata.description = descHtml;
      }
    }
    if (docInfo) {
      const id = getElementText(findByTag(docInfo, "id"));
      if (id) metadata.identifier = id;
      const date = getDate(findByTag(docInfo, "date"));
      if (date) metadata.modified = date;
    }
    if (publishInfo) {
      const publisher = getElementText(findByTag(publishInfo, "publisher"));
      if (publisher) metadata.publisher = publisher;
    }
    let getCover;
    if (titleInfo) {
      const coverpage = findByTag(titleInfo, "coverpage");
      if (coverpage) {
        const image = findByTag(coverpage, "image");
        if (image) {
          const src = converter["getImageSrc"](image);
          getCover = async () => {
            try {
              const response = await fetch(src);
              return await response.blob();
            } catch (e) {
              return null;
            }
          };
        }
      }
    }
    const bodies = findAllByTag(root, "body");
    const sections = [];
    const toc = [];
    const idMap = /* @__PURE__ */ new Map();
    let sectionIndex = 0;
    for (let bodyIdx = 0; bodyIdx < bodies.length; bodyIdx++) {
      const body = bodies[bodyIdx];
      const isFirstBody = bodyIdx === 0;
      const bodyType = body.getAttribute("name") || (isFirstBody ? void 0 : "notes");
      const bodyHtml = converter.convertBody(body);
      const bodyDoc = domAdapter.parseHTML(
        `<html xmlns="http://www.w3.org/1999/xhtml"><body${bodyType ? ` class="${bodyType}BodyType"` : ""}>${bodyHtml}</body></html>`,
        "application/xhtml+xml"
      );
      const bodyEl = findByTag(bodyDoc.documentElement, "body");
      if (!bodyEl) continue;
      const children = bodyEl.children;
      if (isFirstBody) {
        for (const child of children) {
          const idx = sectionIndex++;
          child.textContent || "";
          const titleEl = (_a2 = findByTag(child, "title")) != null ? _a2 : findByTag(child, "h1");
          const title = titleEl ? getElementText(titleEl) : `Section ${idx + 1}`;
          const id = child.getAttribute("id");
          if (id) {
            idMap.set(id, idx);
          }
          for (const el of findAllByTag(child, "*")) {
            const elId = el.getAttribute("id");
            if (elId) {
              idMap.set(elId, idx);
            }
          }
          const sectionHtml = buildXHTMLDocument(child, bodyType);
          sections.push({
            id: idx,
            size: textEncoder.encode(sectionHtml).byteLength,
            load: () => sectionHtml,
            format: "xhtml",
            createDocument: () => sectionHtml,
            getDocument: async () => {
              const nodes = parseHTML(sectionHtml, domAdapter);
              return createSectionDocument(nodes, domAdapter);
            },
            linear: bodyType === "notes" ? "no" : void 0
          });
          toc.push({
            label: title,
            href: String(idx)
          });
        }
      } else {
        const idx = sectionIndex++;
        const titleEl = findByTag(body, "title");
        const title = titleEl ? getElementText(titleEl) : `Notes ${bodyIdx}`;
        const sectionHtml = buildXHTMLDocument(bodyEl, bodyType || "notes");
        for (const el of findAllByTag(bodyEl, "*")) {
          const elId = el.getAttribute("id");
          if (elId) idMap.set(elId, idx);
        }
        sections.push({
          id: idx,
          size: textEncoder.encode(sectionHtml).byteLength,
          load: () => sectionHtml,
          format: "xhtml",
          createDocument: () => sectionHtml,
          getDocument: async () => {
            const nodes = parseHTML(sectionHtml, domAdapter);
            return createSectionDocument(nodes, domAdapter);
          },
          linear: "no"
        });
        toc.push({
          label: title,
          href: String(idx)
        });
      }
    }
    const book = {
      sections,
      toc,
      metadata,
      getCover: getCover || (() => null),
      resolveHref: (href) => {
        const [a, b] = href.split("#");
        if (a && !b) {
          const index = Number(a);
          if (!isNaN(index)) return { index };
        }
        if (b) {
          const index = idMap.get(b);
          if (index !== void 0) {
            return {
              index,
              anchor: (doc2) => {
                return null;
              }
            };
          }
        }
        return null;
      },
      splitTOCHref: (href) => {
        const parts = href.split("#");
        return [parts[0] || "", parts[1] || null];
      },
      destroy: () => {
      }
    };
    return book;
  }
}
function buildXHTMLDocument(el, bodyClass) {
  const classAttr = bodyClass ? ` class="${bodyClass}BodyType"` : "";
  const content = serializeElement(el);
  return `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head></head>
<body${classAttr}>${content}</body>
</html>`;
}
function serializeElement(el) {
  let result = "";
  for (const child of el.children) {
    const tag = child.localName;
    if (!tag) continue;
    result += `<${tag}`;
    for (const attr of child.attributes) {
      result += ` ${attr.localName}="${escapeAttr(attr.value)}"`;
    }
    result += ">";
    if (child.children.length > 0) {
      result += serializeElement(child);
    } else {
      result += escapeText(child.textContent || "");
    }
    result += `</${tag}>`;
  }
  return result;
}
function escapeText(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
const fb2 = () => new FB2Parser();
const MIME_XHTML = "application/xhtml+xml";
const MIME_HTML = "text/html";
const MIME_CSS = "text/css";
const MIME_SVG = "image/svg+xml";
const MOBI_ENCODING = {
  1252: "windows-1252",
  65001: "utf-8"
};
const EXTH_RECORD_TYPE = {
  100: ["creator", "string", true],
  101: ["publisher", "string"],
  103: ["description", "string"],
  104: ["isbn", "string"],
  105: ["subject", "string", true],
  106: ["date", "string"],
  108: ["contributor", "string", true],
  109: ["rights", "string"],
  110: ["subjectCode", "string", true],
  112: ["source", "string", true],
  113: ["asin", "string"],
  121: ["boundary", "uint"],
  122: ["fixedLayout", "string"],
  125: ["numResources", "uint"],
  126: ["originalResolution", "string"],
  127: ["zeroGutter", "string"],
  128: ["zeroMargin", "string"],
  129: ["coverURI", "string"],
  132: ["regionMagnification", "string"],
  201: ["coverOffset", "uint"],
  202: ["thumbnailOffset", "uint"],
  503: ["title", "string"],
  524: ["language", "string", true],
  527: ["pageProgressionDirection", "string"]
};
const MOBI_LANG = {
  1: [
    "ar",
    "ar-SA",
    "ar-IQ",
    "ar-EG",
    "ar-LY",
    "ar-DZ",
    "ar-MA",
    "ar-TN",
    "ar-OM",
    "ar-YE",
    "ar-SY",
    "ar-JO",
    "ar-LB",
    "ar-KW",
    "ar-AE",
    "ar-BH",
    "ar-QA"
  ],
  2: ["bg"],
  3: ["ca"],
  4: ["zh", "zh-TW", "zh-CN", "zh-HK", "zh-SG"],
  5: ["cs"],
  6: ["da"],
  7: ["de", "de-DE", "de-CH", "de-AT", "de-LU", "de-LI"],
  8: ["el"],
  9: [
    "en",
    "en-US",
    "en-GB",
    "en-AU",
    "en-CA",
    "en-NZ",
    "en-IE",
    "en-ZA",
    "en-JM",
    null,
    "en-BZ",
    "en-TT",
    "en-ZW",
    "en-PH"
  ],
  10: [
    "es",
    "es-ES",
    "es-MX",
    null,
    "es-GT",
    "es-CR",
    "es-PA",
    "es-DO",
    "es-VE",
    "es-CO",
    "es-PE",
    "es-AR",
    "es-EC",
    "es-CL",
    "es-UY",
    "es-PY",
    "es-BO",
    "es-SV",
    "es-HN",
    "es-NI",
    "es-PR"
  ],
  11: ["fi"],
  12: ["fr", "fr-FR", "fr-BE", "fr-CA", "fr-CH", "fr-LU", "fr-MC"],
  13: ["he"],
  14: ["hu"],
  15: ["is"],
  16: ["it", "it-IT", "it-CH"],
  17: ["ja"],
  18: ["ko"],
  19: ["nl", "nl-NL", "nl-BE"],
  20: ["no", "nb", "nn"],
  21: ["pl"],
  22: ["pt", "pt-BR", "pt-PT"],
  23: ["rm"],
  24: ["ro"],
  25: ["ru"],
  26: ["hr", null, "sr"],
  27: ["sk"],
  28: ["sq"],
  29: ["sv", "sv-SE", "sv-FI"],
  30: ["th"],
  31: ["tr"],
  32: ["ur"],
  33: ["id"],
  34: ["uk"],
  35: ["be"],
  36: ["sl"],
  37: ["et"],
  38: ["lv"],
  39: ["lt"],
  41: ["fa"],
  42: ["vi"],
  43: ["hy"],
  44: ["az"],
  45: ["eu"],
  46: ["hsb"],
  47: ["mk"],
  48: ["st"],
  49: ["ts"],
  50: ["tn"],
  52: ["xh"],
  53: ["zu"],
  54: ["af"],
  55: ["ka"],
  56: ["fo"],
  57: ["hi"],
  58: ["mt"],
  59: ["se"],
  62: ["ms"],
  63: ["kk"],
  65: ["sw"],
  67: ["uz", null, "uz-UZ"],
  68: ["tt"],
  69: ["bn"],
  70: ["pa"],
  71: ["gu"],
  72: ["or"],
  73: ["ta"],
  74: ["te"],
  75: ["kn"],
  76: ["ml"],
  77: ["as"],
  78: ["mr"],
  79: ["sa"],
  82: ["cy", "cy-GB"],
  83: ["gl", "gl-ES"],
  87: ["kok"],
  97: ["ne"],
  98: ["fy"]
};
const PDB_HEADER = {
  name: [0, 32, "string"],
  type: [60, 4, "string"],
  creator: [64, 4, "string"],
  numRecords: [76, 2, "uint"]
};
const PALMDOC_HEADER = {
  compression: [0, 2, "uint"],
  numTextRecords: [8, 2, "uint"],
  recordSize: [10, 2, "uint"],
  encryption: [12, 2, "uint"]
};
const MOBI_HEADER = {
  magic: [16, 4, "string"],
  length: [20, 4, "uint"],
  type: [24, 4, "uint"],
  encoding: [28, 4, "uint"],
  uid: [32, 4, "uint"],
  version: [36, 4, "uint"],
  titleOffset: [84, 4, "uint"],
  titleLength: [88, 4, "uint"],
  localeRegion: [94, 1, "uint"],
  localeLanguage: [95, 1, "uint"],
  resourceStart: [108, 4, "uint"],
  huffcdic: [112, 4, "uint"],
  numHuffcdic: [116, 4, "uint"],
  exthFlag: [128, 4, "uint"],
  trailingFlags: [240, 4, "uint"],
  indx: [244, 4, "uint"]
};
const KF8_HEADER = {
  resourceStart: [108, 4, "uint"],
  fdst: [192, 4, "uint"],
  numFdst: [196, 4, "uint"],
  frag: [248, 4, "uint"],
  skel: [252, 4, "uint"],
  guide: [260, 4, "uint"]
};
const EXTH_HEADER = {
  magic: [0, 4, "string"],
  length: [4, 4, "uint"],
  count: [8, 4, "uint"]
};
const INDX_HEADER = {
  magic: [0, 4, "string"],
  length: [4, 4, "uint"],
  type: [8, 4, "uint"],
  idxt: [20, 4, "uint"],
  numRecords: [24, 4, "uint"],
  encoding: [28, 4, "uint"],
  language: [32, 4, "uint"],
  total: [36, 4, "uint"],
  ordt: [40, 4, "uint"],
  ligt: [44, 4, "uint"],
  numLigt: [48, 4, "uint"],
  numCncx: [52, 4, "uint"]
};
const TAGX_HEADER = {
  magic: [0, 4, "string"],
  length: [4, 4, "uint"],
  numControlBytes: [8, 4, "uint"]
};
const HUFF_HEADER = {
  magic: [0, 4, "string"],
  offset1: [8, 4, "uint"],
  offset2: [12, 4, "uint"]
};
const CDIC_HEADER = {
  magic: [0, 4, "string"],
  length: [4, 4, "uint"],
  numEntries: [8, 4, "uint"],
  codeLength: [12, 4, "uint"]
};
const FDST_HEADER = {
  magic: [0, 4, "string"],
  numEntries: [8, 4, "uint"]
};
const FONT_HEADER = {
  flags: [8, 4, "uint"],
  dataStart: [12, 4, "uint"],
  keyLength: [16, 4, "uint"],
  keyStart: [20, 4, "uint"]
};
const textDecoder = new TextDecoder();
const getString = (buffer) => textDecoder.decode(buffer);
const getUint = (buffer) => {
  if (!buffer || buffer.byteLength === 0) return void 0;
  const l = buffer.byteLength;
  const view = new DataView(buffer);
  if (l === 4) return view.getUint32(0);
  if (l === 2) return view.getUint16(0);
  return view.getUint8(0);
};
const getStruct = (def, buffer) => {
  return Object.fromEntries(
    Object.entries(def).map(([key, [start, len, type]]) => [
      key,
      (type === "string" ? getString : getUint)(buffer.slice(start, start + len))
    ])
  );
};
const getDecoder = (encoding) => {
  const enc = typeof encoding === "number" ? MOBI_ENCODING[encoding] : void 0;
  return new TextDecoder(enc);
};
const getVarLen = (byteArray, i = 0) => {
  let value2 = 0, length2 = 0;
  for (const byte of byteArray.subarray(i, i + 4)) {
    value2 = value2 << 7 | (byte & 127) >>> 0;
    length2++;
    if (byte & 128) break;
  }
  return { value: value2, length: length2 };
};
const getVarLenFromEnd = (byteArray) => {
  let value2 = 0;
  for (const byte of byteArray.subarray(-4)) {
    if (byte & 128) value2 = 0;
    value2 = value2 << 7 | byte & 127;
  }
  return value2;
};
const countBitsSet = (x) => {
  let count = 0;
  for (; x > 0; x = x >> 1) if ((x & 1) === 1) count++;
  return count;
};
const countUnsetEnd = (x) => {
  let count = 0;
  while ((x & 1) === 0) {
    x = x >> 1;
    count++;
  }
  return count;
};
const concatTypedArray = (a, b) => {
  const result = new Uint8Array(a.length + b.length);
  result.set(a);
  result.set(b, a.length);
  return result;
};
const concatTypedArray3 = (a, b, c) => {
  const result = new Uint8Array(a.length + b.length + c.length);
  result.set(a);
  result.set(b, a.length);
  result.set(c, a.length + b.length);
  return result;
};
const rawBytesToString = (uint8Array) => {
  const chunkSize = 32768;
  let result = "";
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    result += String.fromCharCode.apply(null, Array.from(uint8Array.subarray(i, i + chunkSize)));
  }
  return result;
};
const decompressPalmDOC = (array) => {
  const output = [];
  for (let i = 0; i < array.length; i++) {
    const byte = array[i];
    if (byte === 0) output.push(0);
    else if (byte <= 8)
      for (const x of array.subarray(i + 1, (i += byte) + 1))
        output.push(x);
    else if (byte <= 127) output.push(byte);
    else if (byte <= 191) {
      const bytes = byte << 8 | array[i++ + 1];
      const distance = (bytes & 16383) >>> 3;
      const length2 = (bytes & 7) + 3;
      for (let j = 0; j < length2; j++)
        output.push(output[output.length - distance]);
    } else output.push(32, byte ^ 128);
  }
  return Uint8Array.from(output);
};
const read32Bits = (byteArray, from) => {
  var _a2;
  const startByte = from >> 3;
  const end = from + 32;
  const endByte = end >> 3;
  let bits2 = /* @__PURE__ */ BigInt("0");
  for (let i = startByte; i <= endByte; i++)
    bits2 = bits2 << /* @__PURE__ */ BigInt("8") | BigInt((_a2 = byteArray[i]) != null ? _a2 : 0);
  return bits2 >> /* @__PURE__ */ BigInt("8") - BigInt(end & 7) & /* @__PURE__ */ BigInt("0xffffffff");
};
const huffcdic = async (mobi2, loadRecord) => {
  const huffRecord = await loadRecord(mobi2.huffcdic);
  const { magic, offset1, offset2 } = getStruct(HUFF_HEADER, huffRecord);
  if (magic !== "HUFF") throw new CorruptedFileError("Invalid HUFF record", "mobi");
  const off1 = offset1;
  const off2 = offset2;
  const table1 = Array.from({ length: 256 }, (_, i) => off1 + i * 4).map((offset) => getUint(huffRecord.slice(offset, offset + 4))).map((x) => [x & 128, x & 31, x >>> 8]);
  const table2 = [null].concat(
    Array.from({ length: 32 }, (_, i) => off2 + i * 8).map((offset) => [
      getUint(huffRecord.slice(offset, offset + 4)),
      getUint(huffRecord.slice(offset + 4, offset + 8))
    ])
  );
  const dictionary = [];
  const numHuffcdic = mobi2.numHuffcdic;
  for (let i = 1; i < numHuffcdic; i++) {
    const record = await loadRecord(mobi2.huffcdic + i);
    const cdic = getStruct(CDIC_HEADER, record);
    if (cdic.magic !== "CDIC") throw new CorruptedFileError("Invalid CDIC record", "mobi");
    const n = Math.min(1 << cdic.codeLength, cdic.numEntries - dictionary.length);
    const buffer = record.slice(cdic.length);
    for (let j = 0; j < n; j++) {
      const offset = getUint(buffer.slice(j * 2, j * 2 + 2));
      const x = getUint(buffer.slice(offset, offset + 2));
      const length2 = x & 32767;
      const decompressed = x & 32768;
      const value2 = new Uint8Array(buffer.slice(offset + 2, offset + 2 + length2));
      dictionary.push([value2, !!decompressed]);
    }
  }
  const decompress2 = (byteArray) => {
    let output = new Uint8Array();
    const bitLength = byteArray.byteLength * 8;
    for (let i = 0; i < bitLength; ) {
      const bits2 = Number(read32Bits(byteArray, i));
      let [found, codeLength, value2] = table1[bits2 >>> 24];
      if (!found) {
        while (bits2 >>> 32 - codeLength < table2[codeLength][0])
          codeLength += 1;
        value2 = table2[codeLength][1];
      }
      if ((i += codeLength) > bitLength) break;
      const code2 = value2 - (bits2 >>> 32 - codeLength);
      let [result, isDecompressed] = dictionary[code2];
      if (!isDecompressed) {
        result = decompress2(result);
        dictionary[code2] = [result, true];
      }
      output = concatTypedArray(output, result);
    }
    return output;
  };
  return decompress2;
};
const getIndexData = async (indxIndex, loadRecord) => {
  const indxRecord = await loadRecord(indxIndex);
  const indx = getStruct(INDX_HEADER, indxRecord);
  if (indx.magic !== "INDX") throw new CorruptedFileError("Invalid INDX record", "mobi");
  const decoder = getDecoder(indx.encoding);
  const tagxBuffer = indxRecord.slice(indx.length);
  const tagx = getStruct(TAGX_HEADER, tagxBuffer);
  if (tagx.magic !== "TAGX") throw new CorruptedFileError("Invalid TAGX section", "mobi");
  const numTags = (tagx.length - 12) / 4;
  const tagTable = Array.from({ length: numTags }, (_, i) => new Uint8Array(tagxBuffer.slice(12 + i * 4, 12 + i * 4 + 4)));
  const cncx = {};
  let cncxRecordOffset = 0;
  const numCncx = indx.numCncx;
  for (let i = 0; i < numCncx; i++) {
    const record = await loadRecord(indxIndex + indx.numRecords + i + 1);
    const array = new Uint8Array(record);
    for (let pos = 0; pos < array.byteLength; ) {
      const index = pos;
      const { value: value2, length: length2 } = getVarLen(array, pos);
      pos += length2;
      const result = record.slice(pos, pos + value2);
      pos += value2;
      cncx[cncxRecordOffset + index] = decoder.decode(result);
    }
    cncxRecordOffset += 65536;
  }
  const table = [];
  const numIndxRecords = indx.numRecords;
  for (let i = 0; i < numIndxRecords; i++) {
    const record = await loadRecord(indxIndex + 1 + i);
    const array = new Uint8Array(record);
    const subIndx = getStruct(INDX_HEADER, record);
    if (subIndx.magic !== "INDX") throw new CorruptedFileError("Invalid INDX record", "mobi");
    const subNumRecords = subIndx.numRecords;
    for (let j = 0; j < subNumRecords; j++) {
      const offsetOffset = subIndx.idxt + 4 + 2 * j;
      const offset = getUint(record.slice(offsetOffset, offsetOffset + 2));
      const length2 = getUint(record.slice(offset, offset + 1));
      const name2 = getString(record.slice(offset + 1, offset + 1 + length2));
      const tags = [];
      const startPos = offset + 1 + length2;
      let controlByteIndex = 0;
      let pos = startPos + tagx.numControlBytes;
      for (const [tag, numValues, mask, end] of tagTable) {
        if (end & 1) {
          controlByteIndex++;
          continue;
        }
        const off = startPos + controlByteIndex;
        const value2 = getUint(record.slice(off, off + 1)) & mask;
        if (value2 === mask) {
          if (countBitsSet(mask) > 1) {
            const vl = getVarLen(array, pos);
            tags.push([tag, null, vl.value, numValues]);
            pos += vl.length;
          } else tags.push([tag, 1, null, numValues]);
        } else tags.push([tag, value2 >> countUnsetEnd(mask), null, numValues]);
      }
      const tagMap = {};
      for (const [tag, valueCount, valueBytes, numVals] of tags) {
        const values = [];
        if (valueCount != null) {
          for (let k = 0; k < valueCount * numVals; k++) {
            const vl = getVarLen(array, pos);
            values.push(vl.value);
            pos += vl.length;
          }
        } else {
          let count = 0;
          while (count < (valueBytes != null ? valueBytes : 0)) {
            const vl = getVarLen(array, pos);
            values.push(vl.value);
            pos += vl.length;
            count += vl.length;
          }
        }
        tagMap[tag] = values;
      }
      table.push({ name: name2, tagMap });
    }
  }
  return { table, cncx };
};
const getNCX = async (indxIndex, loadRecord) => {
  const { table, cncx } = await getIndexData(indxIndex, loadRecord);
  const items = table.map(({ tagMap }, index) => {
    var _a2, _b2, _c, _d, _e, _f, _g, _h, _i;
    return {
      index,
      offset: (_a2 = tagMap[1]) == null ? void 0 : _a2[0],
      size: (_b2 = tagMap[2]) == null ? void 0 : _b2[0],
      label: (_d = cncx[(_c = tagMap[3]) == null ? void 0 : _c[0]]) != null ? _d : "",
      headingLevel: (_f = (_e = tagMap[4]) == null ? void 0 : _e[0]) != null ? _f : 0,
      pos: tagMap[6],
      parent: (_g = tagMap[21]) == null ? void 0 : _g[0],
      firstChild: (_h = tagMap[22]) == null ? void 0 : _h[0],
      lastChild: (_i = tagMap[23]) == null ? void 0 : _i[0]
    };
  });
  const getChildren = (item) => {
    if (item.firstChild == null) return item;
    item.children = items.filter((x) => x.parent === item.index).map(getChildren);
    return item;
  };
  return items.filter((item) => item.headingLevel === 0).map(getChildren);
};
const getEXTH = (buf, encoding) => {
  const { magic, count } = getStruct(EXTH_HEADER, buf);
  if (magic !== "EXTH") throw new CorruptedFileError("Invalid EXTH header", "mobi");
  const decoder = getDecoder(encoding);
  const results = {};
  let offset = 12;
  for (let i = 0; i < count; i++) {
    const type = getUint(buf.slice(offset, offset + 4));
    const length2 = getUint(buf.slice(offset + 4, offset + 8));
    if (type in EXTH_RECORD_TYPE) {
      const [name2, typ, many] = EXTH_RECORD_TYPE[type];
      const data = buf.slice(offset + 8, offset + length2);
      const value2 = typ === "uint" ? getUint(data) : decoder.decode(data);
      if (many) {
        const arr = results[name2];
        if (arr) arr.push(value2);
        else results[name2] = [value2];
      } else results[name2] = value2;
    }
    offset += length2;
  }
  return results;
};
const getFont = async (buf, unzlib2) => {
  const { flags, dataStart, keyLength, keyStart } = getStruct(FONT_HEADER, buf);
  const array = new Uint8Array(buf.slice(dataStart));
  const f = flags;
  if (f & 2) {
    const bytes = keyLength === 16 ? 1024 : 1040;
    const key = new Uint8Array(buf.slice(keyStart, keyStart + keyLength));
    const length2 = Math.min(bytes, array.length);
    for (let i = 0; i < length2; i++) array[i] = array[i] ^ key[i % key.length];
  }
  if (f & 1) {
    try {
      if (unzlib2) return unzlib2(array);
    } catch (e) {
      console.warn("Failed to decompress font", e);
    }
  }
  return array;
};
class PDB {
  constructor() {
    __publicField(this, "file");
    __publicField(this, "offsets", []);
    __publicField(this, "pdb", {});
  }
  async open(file) {
    this.file = file;
    const headerBuf = await file.slice(0, 78).arrayBuffer();
    this.pdb = getStruct(PDB_HEADER, headerBuf);
    const numRecords = this.pdb.numRecords;
    const buffer = await file.slice(78, 78 + numRecords * 8).arrayBuffer();
    const rawOffsets = Array.from(
      { length: numRecords },
      (_, i) => getUint(buffer.slice(i * 8, i * 8 + 4))
    );
    this.offsets = rawOffsets.map((x, i, a) => ({ start: x, end: a[i + 1] }));
  }
  loadRecord(index) {
    const offsets = this.offsets[index];
    if (!offsets) throw new CorruptedFileError("Record index out of bounds", "mobi");
    return this.file.slice(offsets.start, offsets.end).arrayBuffer();
  }
  async loadMagic(index) {
    const start = this.offsets[index].start;
    return getString(await this.file.slice(start, start + 4).arrayBuffer());
  }
}
class MOBI {
  constructor(opts) {
    __privateAdd(this, _MOBI_instances);
    __privateAdd(this, _start, 0);
    __privateAdd(this, _resourceStart, 0);
    __privateAdd(this, _decoder);
    __privateAdd(this, _encoder, new TextEncoder());
    __privateAdd(this, _decompress);
    __privateAdd(this, _removeTrailingEntries);
    __privateAdd(this, _pdb, new PDB());
    __publicField(this, "headers");
    __publicField(this, "unzlib");
    this.unzlib = opts == null ? void 0 : opts.unzlib;
  }
  get pdbInfo() {
    return __privateGet(this, _pdb).pdb;
  }
  async open(file, opts) {
    var _a2;
    await __privateGet(this, _pdb).open(file);
    this.headers = __privateMethod(this, _MOBI_instances, getHeaders_fn).call(this, await __privateGet(this, _pdb).loadRecord(0));
    __privateSet(this, _resourceStart, this.headers.mobi.resourceStart);
    let isKF8 = this.headers.mobi.version >= 8;
    if (!isKF8) {
      const boundary = (_a2 = this.headers.exth) == null ? void 0 : _a2.boundary;
      if (boundary != null && boundary < 4294967295) {
        try {
          this.headers = __privateMethod(this, _MOBI_instances, getHeaders_fn).call(this, await __privateGet(this, _pdb).loadRecord(boundary));
          __privateSet(this, _start, boundary);
          isKF8 = true;
        } catch (e) {
          console.warn("Failed to open KF8; falling back to MOBI", e);
        }
      }
    }
    await __privateMethod(this, _MOBI_instances, setup_fn).call(this);
    return isKF8 ? new KF8(this, opts).init() : new MOBI6(this, opts).init();
  }
  decode(...args) {
    return __privateGet(this, _decoder).decode(...args);
  }
  encode(str) {
    return __privateGet(this, _encoder).encode(str);
  }
  loadRecord(index) {
    return __privateGet(this, _pdb).loadRecord(__privateGet(this, _start) + index);
  }
  loadMagic(index) {
    return __privateGet(this, _pdb).loadMagic(__privateGet(this, _start) + index);
  }
  loadText(index) {
    return this.loadRecord(index + 1).then((buf) => new Uint8Array(buf)).then(__privateGet(this, _removeTrailingEntries)).then(__privateGet(this, _decompress));
  }
  async loadResource(index) {
    const buf = await __privateGet(this, _pdb).loadRecord(__privateGet(this, _resourceStart) + index);
    const magic = getString(buf.slice(0, 4));
    if (magic === "FONT") {
      const font = await getFont(buf, this.unzlib);
      return font.buffer.slice(font.byteOffset, font.byteOffset + font.byteLength);
    }
    if (magic === "VIDE" || magic === "AUDI") return buf.slice(12);
    return buf;
  }
  async getNCX() {
    const index = this.headers.mobi.indx;
    if (index < 4294967295) return getNCX(index, this.loadRecord.bind(this));
    return void 0;
  }
  getMetadata() {
    var _a2;
    const { mobi: mobi2, exth } = this.headers;
    const title = unescapeHTML((exth == null ? void 0 : exth.title) || this.decode(mobi2.title));
    const metadata = {
      identifier: (_a2 = mobi2.uid) == null ? void 0 : _a2.toString(),
      title
    };
    if (exth == null ? void 0 : exth.creator) {
      const authors = exth.creator.map(unescapeHTML);
      metadata.author = normalizeContributors(authors);
    }
    if (exth == null ? void 0 : exth.publisher) metadata.publisher = unescapeHTML(exth.publisher);
    if (exth == null ? void 0 : exth.language) {
      const langs = exth.language;
      metadata.language = Array.isArray(langs) ? langs[0] : langs;
    } else if (mobi2.language) {
      metadata.language = mobi2.language;
    }
    if (exth == null ? void 0 : exth.date) metadata.published = exth.date;
    if (exth == null ? void 0 : exth.description) metadata.description = unescapeHTML(exth.description);
    if (exth == null ? void 0 : exth.subject) metadata.subject = exth.subject.map(unescapeHTML);
    if (exth == null ? void 0 : exth.rights) metadata.rights = unescapeHTML(exth.rights);
    if (exth == null ? void 0 : exth.contributor) metadata.contributor = normalizeContributors(exth.contributor.map(unescapeHTML));
    return metadata;
  }
  async getCover() {
    const { exth } = this.headers;
    const coverOffset = exth == null ? void 0 : exth.coverOffset;
    const thumbOffset = exth == null ? void 0 : exth.thumbnailOffset;
    const offset = coverOffset != null && coverOffset < 4294967295 ? coverOffset : thumbOffset != null && thumbOffset < 4294967295 ? thumbOffset : null;
    if (offset != null) {
      const buf = await this.loadResource(offset);
      return createOutputBlob(buf);
    }
    return null;
  }
  get numTextRecords() {
    return this.headers.palmdoc.numTextRecords;
  }
  get numRecords() {
    return __privateGet(this, _pdb).pdb.numRecords;
  }
}
_start = new WeakMap();
_resourceStart = new WeakMap();
_decoder = new WeakMap();
_encoder = new WeakMap();
_decompress = new WeakMap();
_removeTrailingEntries = new WeakMap();
_pdb = new WeakMap();
_MOBI_instances = new WeakSet();
getHeaders_fn = function(buf) {
  var _a2;
  const palmdoc = getStruct(PALMDOC_HEADER, buf);
  const mobi2 = getStruct(MOBI_HEADER, buf);
  if (mobi2.magic !== "MOBI") throw new CorruptedFileError("Missing MOBI header", "mobi");
  const titleOffset = mobi2.titleOffset;
  const titleLength = mobi2.titleLength;
  mobi2.title = buf.slice(titleOffset, titleOffset + titleLength);
  const lang = MOBI_LANG[mobi2.localeLanguage];
  mobi2.language = (_a2 = lang == null ? void 0 : lang[mobi2.localeRegion >> 2]) != null ? _a2 : lang == null ? void 0 : lang[0];
  const exth = mobi2.exthFlag & 64 ? getEXTH(buf.slice(mobi2.length + 16), mobi2.encoding) : null;
  const kf8 = mobi2.version >= 8 ? getStruct(KF8_HEADER, buf) : null;
  return { palmdoc, mobi: mobi2, exth, kf8 };
};
setup_fn = async function() {
  const { palmdoc, mobi: mobi2 } = this.headers;
  __privateSet(this, _decoder, getDecoder(mobi2.encoding));
  const compression = palmdoc.compression;
  if (compression === 1) {
    __privateSet(this, _decompress, (f) => f);
  } else if (compression === 2) {
    __privateSet(this, _decompress, decompressPalmDOC);
  } else if (compression === 17480) {
    __privateSet(this, _decompress, await huffcdic(
      mobi2,
      this.loadRecord.bind(this)
    ));
  } else {
    throw new ParseError(`Unknown compression type: ${compression}`, "mobi");
  }
  const trailingFlags = mobi2.trailingFlags;
  const multibyte = trailingFlags & 1;
  const numTrailingEntries = countBitsSet(trailingFlags >>> 1);
  __privateSet(this, _removeTrailingEntries, (array) => {
    for (let i = 0; i < numTrailingEntries; i++) {
      const length2 = getVarLenFromEnd(array);
      array = array.subarray(0, -length2);
    }
    if (multibyte) {
      const length2 = (array[array.length - 1] & 3) + 1;
      array = array.subarray(0, -length2);
    }
    return array;
  });
};
const mbpPagebreakRegex = /<\s*(?:mbp:)?pagebreak[^>]*>/gi;
const fileposRegex = /<[^<>]+filepos=['"]{0,1}(\d+)[^<>]*>/gi;
const selfClosingRegex = /<(a|div|span|p)\s*\/>/gi;
const htmlVoidTagRegex = /<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)\b([^<>]*?)>/gi;
function sanitizeMOBI6HTML(str) {
  return str.replace(/<!doctype[^>]*>/gi, "").replace(/<\/?(?:html|head|body)\b[^>]*>/gi, "").replace(/\s(filepos|recindex)=["']?(\d+)["']?/gi, ' $1="$2"').replace(selfClosingRegex, "<$1></$1>").replace(htmlVoidTagRegex, (match, tag, attrs) => /\/\s*>$/.test(match) ? match : `<${tag}${attrs}/>`).replace(/<\/(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)>/gi, "");
}
function wrapMOBI6Fragment(str) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body>${str}</body></html>`;
}
class MOBI6 {
  constructor(mobi2, opts) {
    __privateAdd(this, _MOBI6_instances);
    __privateAdd(this, _mobi);
    __privateAdd(this, _domAdapter);
    __privateAdd(this, _urlFactory);
    __privateAdd(this, _resourceCache, /* @__PURE__ */ new Map());
    __privateAdd(this, _textCache, /* @__PURE__ */ new Map());
    __privateAdd(this, _cache, /* @__PURE__ */ new Map());
    __privateAdd(this, _sections, []);
    __privateAdd(this, _fileposList, []);
    __privateAdd(this, _urls, []);
    __publicField(this, "sections", []);
    __publicField(this, "toc");
    __publicField(this, "landmarks");
    __publicField(this, "metadata");
    __privateSet(this, _mobi, mobi2);
    __privateSet(this, _domAdapter, opts == null ? void 0 : opts.domAdapter);
    __privateSet(this, _urlFactory, opts == null ? void 0 : opts.urlFactory);
  }
  async init() {
    var _a2;
    const recordBuffers = [];
    for (let i = 0; i < __privateGet(this, _mobi).numTextRecords; i++) {
      recordBuffers.push(await __privateGet(this, _mobi).loadText(i));
    }
    const totalLength = recordBuffers.reduce((sum, buf) => sum + buf.byteLength, 0);
    const array = new Uint8Array(totalLength);
    recordBuffers.reduce((offset, buf) => {
      array.set(buf, offset);
      return offset + buf.byteLength;
    }, 0);
    const str = rawBytesToString(array);
    const breakIndices = [0, ...Array.from(str.matchAll(mbpPagebreakRegex), (m) => m.index)];
    __privateSet(this, _sections, breakIndices.map((start, i) => {
      var _a3;
      const end = (_a3 = breakIndices[i + 1]) != null ? _a3 : array.length;
      return { book: this, raw: array.subarray(start, end), start: 0, end: 0 };
    }));
    __privateGet(this, _sections).forEach((section, i, arr) => {
      var _a3, _b2;
      section.start = (_b2 = (_a3 = arr[i - 1]) == null ? void 0 : _a3.end) != null ? _b2 : 0;
      section.end = section.start + section.raw.byteLength;
    });
    this.sections = __privateGet(this, _sections).map((section, index) => ({
      id: index,
      load: () => this.loadSection(section),
      createDocument: () => this.createDocument(section),
      format: "html",
      getDocument: async () => {
        const html = await this.createDocument(section);
        if (!__privateGet(this, _domAdapter)) return null;
        const nodes = parseHTML(html, __privateGet(this, _domAdapter));
        return createSectionDocument(nodes, __privateGet(this, _domAdapter));
      },
      getSegments: async () => {
        const html = await this.createDocument(section);
        if (!__privateGet(this, _domAdapter)) return [];
        const nodes = parseHTML(html, __privateGet(this, _domAdapter));
        return extractDocumentSegments(nodes);
      },
      getBlocks: async () => {
        const html = await this.loadSection(section);
        if (!__privateGet(this, _domAdapter)) return [];
        const nodes = parseHTML(html, __privateGet(this, _domAdapter));
        return extractDocumentBlocks(nodes, {}, {
          coverImageSrcs: []
        });
      },
      size: section.end - section.start
    }));
    try {
      this.landmarks = await this.getGuide();
      const tocHref = (_a2 = this.landmarks.find(({ type }) => type == null ? void 0 : type.includes("toc"))) == null ? void 0 : _a2.href;
      if (tocHref) {
        const { index } = this.resolveHref(tocHref);
        const docStr = await this.sections[index].createDocument();
        if (__privateGet(this, _domAdapter)) {
          const doc = __privateGet(this, _domAdapter).parseHTML(wrapMOBI6Fragment(docStr), MIME_HTML);
          const links = doc.querySelectorAll("a[filepos]");
          this.toc = [];
          for (const a of links) {
            const filepos = a.getAttribute("filepos");
            if (filepos) {
              this.toc.push({
                label: (a.textContent || "").trim(),
                href: `filepos:${filepos}`
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn("Failed to build MOBI6 TOC", e);
    }
    __privateSet(this, _fileposList, [...new Set(
      Array.from(str.matchAll(fileposRegex), (m) => m[1])
    )].map((filepos) => ({ filepos, number: Number(filepos) })).sort((a, b) => a.number - b.number));
    this.metadata = __privateGet(this, _mobi).getMetadata();
    return this.toBook();
  }
  async getGuide() {
    const docStr = await this.createDocument(__privateGet(this, _sections)[0]);
    if (!__privateGet(this, _domAdapter)) return [];
    const doc = __privateGet(this, _domAdapter).parseHTML(wrapMOBI6Fragment(docStr), MIME_HTML);
    const refs = doc.getElementsByTagName("reference");
    return refs.map((ref) => ({
      label: ref.getAttribute("title") || "",
      type: (ref.getAttribute("type") || "").split(/\s/),
      href: `filepos:${ref.getAttribute("filepos") || "0"}`
    }));
  }
  async loadResource(index) {
    if (__privateGet(this, _resourceCache).has(index)) return __privateGet(this, _resourceCache).get(index);
    const raw = await __privateGet(this, _mobi).loadResource(index);
    const url = __privateMethod(this, _MOBI6_instances, createURL_fn).call(this, raw, "");
    __privateGet(this, _resourceCache).set(index, url);
    return url;
  }
  async loadRecindex(recindex) {
    return this.loadResource(Number(recindex) - 1);
  }
  async replaceResources(htmlStr) {
    htmlStr = htmlStr.replace(/<img[^>]+recindex=["'](\d+)["'][^>]*>/gi, (match, recindex) => {
      return match;
    });
    const imgRegex = /recindex=["']?(\d+)["']?/gi;
    const matches = [];
    let m;
    while ((m = imgRegex.exec(htmlStr)) !== null) {
      matches.push({ full: m[0], recindex: m[1] });
    }
    for (const { full, recindex } of matches) {
      try {
        const url = await this.loadRecindex(recindex);
        htmlStr = htmlStr.replace(full, `src="${url}"`);
      } catch (e) {
      }
    }
    htmlStr = htmlStr.replace(/\sfilepos=["']?(\d+)["']?/gi, (_, filepos) => ` href="filepos:${filepos}"`);
    return htmlStr;
  }
  async loadSectionText(section) {
    if (__privateGet(this, _textCache).has(section)) return __privateGet(this, _textCache).get(section);
    const { raw } = section;
    const sectionFilepos = __privateGet(this, _fileposList).filter(({ number: number2 }) => number2 >= section.start && number2 < section.end).map((obj) => ({ ...obj, offset: obj.number - section.start }));
    let arr = raw;
    if (sectionFilepos.length) {
      arr = raw.subarray(0, sectionFilepos[0].offset);
      sectionFilepos.forEach(({ filepos, offset }, i) => {
        const next = sectionFilepos[i + 1];
        const a = __privateGet(this, _mobi).encode(`<a id="filepos${filepos}"></a>`);
        arr = concatTypedArray3(arr, a, raw.subarray(offset, next == null ? void 0 : next.offset));
      });
    }
    const str = __privateGet(this, _mobi).decode(arr).replaceAll(mbpPagebreakRegex, "").replace(/<\/\s*(?:mbp:)?pagebreak\s*>/gi, "");
    __privateGet(this, _textCache).set(section, str);
    return str;
  }
  async createDocument(section) {
    const str = await this.loadSectionText(section);
    return sanitizeMOBI6HTML(str);
  }
  async loadSection(section) {
    if (__privateGet(this, _cache).has(section)) return __privateGet(this, _cache).get(section);
    let str = await this.createDocument(section);
    str = await this.replaceResources(str);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${str}</body></html>`;
    __privateGet(this, _cache).set(section, html);
    return html;
  }
  resolveHref(href) {
    const match = href.match(/filepos:(.*)/);
    if (!match) return null;
    const filepos = match[1];
    const number2 = Number(filepos);
    const index = __privateGet(this, _sections).findIndex((section) => section.end > number2);
    if (index < 0) return null;
    const anchor = (doc) => {
      return `filepos${filepos}`;
    };
    return { index, anchor };
  }
  splitTOCHref(href) {
    const match = href.match(/filepos:(.*)/);
    if (!match) return null;
    const filepos = match[1];
    const number2 = Number(filepos);
    const index = __privateGet(this, _sections).findIndex((section) => section.end > number2);
    return [index, `filepos${filepos}`];
  }
  isExternal(uri) {
    return /^(?!blob|filepos)\w+:/i.test(uri);
  }
  destroy() {
    for (const url of __privateGet(this, _resourceCache).values()) __privateMethod(this, _MOBI6_instances, revokeURL_fn).call(this, url);
    for (const url of __privateGet(this, _cache).values()) {
      if (url.startsWith("blob:") || url.startsWith("test:")) __privateMethod(this, _MOBI6_instances, revokeURL_fn).call(this, url);
    }
  }
  toBook() {
    const self = this;
    return {
      sections: this.sections,
      toc: this.toc,
      landmarks: this.landmarks,
      metadata: this.metadata,
      getCover: () => __privateGet(this, _mobi).getCover(),
      resolveHref: (href) => self.resolveHref(href),
      isExternal: (uri) => self.isExternal(uri),
      splitTOCHref: (href) => {
        const result = self.splitTOCHref(href);
        return result != null ? result : [0, null];
      },
      destroy: () => self.destroy()
    };
  }
}
_mobi = new WeakMap();
_domAdapter = new WeakMap();
_urlFactory = new WeakMap();
_resourceCache = new WeakMap();
_textCache = new WeakMap();
_cache = new WeakMap();
_sections = new WeakMap();
_fileposList = new WeakMap();
_urls = new WeakMap();
_MOBI6_instances = new WeakSet();
createURL_fn = function(data, mimeType) {
  if (__privateGet(this, _urlFactory)) {
    return __privateGet(this, _urlFactory).createURL(data, mimeType);
  }
  const blob = typeof data === "string" ? new Blob([data], { type: mimeType }) : new Blob([data]);
  const url = URL.createObjectURL(blob);
  __privateGet(this, _urls).push(url);
  return url;
};
revokeURL_fn = function(url) {
  if (__privateGet(this, _urlFactory)) {
    __privateGet(this, _urlFactory).revokeURL(url);
  } else {
    URL.revokeObjectURL(url);
  }
};
const kindleResourceRegex = /kindle:(flow|embed):(\w+)(?:\?mime=(\w+\/[-+.\w]+))?/;
const kindlePosRegex = /kindle:pos:fid:(\w+):off:(\w+)/;
const parseResourceURI = (str) => {
  const match = str.match(kindleResourceRegex);
  if (!match) return { resourceType: "", id: 0, type: "" };
  const [, resourceType, id, type] = match;
  return { resourceType, id: parseInt(id, 32), type };
};
const parsePosURI = (str) => {
  const match = str.match(kindlePosRegex);
  if (!match) return null;
  const [, fid, off] = match;
  return { fid: parseInt(fid, 32), off: parseInt(off, 32) };
};
const makePosURI = (fid = 0, off = 0) => `kindle:pos:fid:${fid.toString(32).toUpperCase().padStart(4, "0")}:off:${off.toString(32).toUpperCase().padStart(10, "0")}`;
const getFragmentSelector = (str) => {
  const match = str.match(/\s(id|name|aid)\s*=\s*['"]([^'"]*)['"]/i);
  if (!match) return void 0;
  const [, attr, value2] = match;
  return `[${attr}="${value2.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"]`;
};
const getPageSpread = (properties2) => {
  for (const p of properties2) {
    if (p === "page-spread-left" || p === "rendition:page-spread-left") return "left";
    if (p === "page-spread-right" || p === "rendition:page-spread-right") return "right";
    if (p === "rendition:page-spread-center") return "center";
  }
  return void 0;
};
const isBlankDocumentNode = (node2) => {
  var _a2;
  return node2.type === "text" && !((_a2 = node2.text) != null ? _a2 : "").trim();
};
const getNodeAttr = (node2, name2) => {
  var _a2, _b2, _c;
  return (_c = (_b2 = Object.entries((_a2 = node2.attrs) != null ? _a2 : {}).find(([key]) => key.toLowerCase() === name2.toLowerCase())) == null ? void 0 : _b2[1]) != null ? _c : "";
};
const hasNavigationSemantics = (node2) => {
  const type = getNodeAttr(node2, "type");
  const role = getNodeAttr(node2, "role");
  const values = `${type} ${role}`.toLowerCase().split(/\s+/);
  return values.some((value2) => value2 === "toc" || value2 === "landmarks" || value2 === "page-list" || value2 === "doc-toc" || value2 === "doc-pagelist");
};
const isKF8NavigationDocument = (html, domAdapter) => {
  const nodes = parseHTML(html, domAdapter).filter((node2) => !isBlankDocumentNode(node2));
  if (nodes.length === 0) return false;
  return nodes.every((node2) => node2.type.toLowerCase() === "nav") && nodes.some(hasNavigationSemantics);
};
class KF8 {
  constructor(mobi2, opts) {
    __privateAdd(this, _KF8_instances);
    __privateAdd(this, _mobi2);
    __privateAdd(this, _domAdapter2);
    __privateAdd(this, _urlFactory2);
    __privateAdd(this, _cache2, /* @__PURE__ */ new Map());
    __privateAdd(this, _fragmentOffsets, /* @__PURE__ */ new Map());
    __privateAdd(this, _fragmentSelectors, /* @__PURE__ */ new Map());
    __privateAdd(this, _tables, {});
    __privateAdd(this, _sections2, []);
    __privateAdd(this, _sectionIndexMap, /* @__PURE__ */ new Map());
    __privateAdd(this, _fullRawLength, 0);
    __privateAdd(this, _rawHead, new Uint8Array());
    __privateAdd(this, _rawTail, new Uint8Array());
    __privateAdd(this, _lastLoadedHead, -1);
    __privateAdd(this, _lastLoadedTail, -1);
    __privateAdd(this, _type, MIME_XHTML);
    __privateAdd(this, _urls2, []);
    __publicField(this, "sections", []);
    __publicField(this, "toc");
    __publicField(this, "landmarks");
    __publicField(this, "metadata");
    __publicField(this, "dir");
    __publicField(this, "rendition");
    __privateSet(this, _mobi2, mobi2);
    __privateSet(this, _domAdapter2, opts == null ? void 0 : opts.domAdapter);
    __privateSet(this, _urlFactory2, opts == null ? void 0 : opts.urlFactory);
  }
  async init() {
    const loadRecord = __privateGet(this, _mobi2).loadRecord.bind(__privateGet(this, _mobi2));
    const { kf8 } = __privateGet(this, _mobi2).headers;
    try {
      const fdstBuffer = await loadRecord(kf8.fdst);
      const fdst = getStruct(FDST_HEADER, fdstBuffer);
      if (fdst.magic !== "FDST") throw new CorruptedFileError("Missing FDST record", "mobi");
      const fdstTable = Array.from(
        { length: fdst.numEntries },
        (_, i) => 12 + i * 8
      ).map((offset) => [
        getUint(fdstBuffer.slice(offset, offset + 4)),
        getUint(fdstBuffer.slice(offset + 4, offset + 8))
      ]);
      __privateGet(this, _tables).fdstTable = fdstTable;
      __privateSet(this, _fullRawLength, fdstTable[fdstTable.length - 1][1]);
    } catch (e) {
    }
    const skelData = await getIndexData(kf8.skel, loadRecord);
    const skelTable = skelData.table.map(({ name: name2, tagMap }, index) => ({
      index,
      name: name2,
      numFrag: tagMap[1][0],
      offset: tagMap[6][0],
      length: tagMap[6][1]
    }));
    const fragData = await getIndexData(kf8.frag, loadRecord);
    const fragTable = fragData.table.map(({ name: name2, tagMap }) => {
      var _a2;
      return {
        insertOffset: parseInt(name2),
        selector: fragData.cncx[(_a2 = tagMap[2]) == null ? void 0 : _a2[0]],
        index: tagMap[4][0],
        offset: tagMap[6][0],
        length: tagMap[6][1]
      };
    });
    __privateGet(this, _tables).skelTable = skelTable;
    __privateGet(this, _tables).fragTable = fragTable;
    __privateSet(this, _sections2, skelTable.reduce((arr, skel) => {
      var _a2, _b2;
      const last = arr[arr.length - 1];
      const fragStart = (_a2 = last == null ? void 0 : last.fragEnd) != null ? _a2 : 0;
      const fragEnd = fragStart + skel.numFrag;
      const frags = fragTable.slice(fragStart, fragEnd);
      const length2 = skel.length + frags.reduce((a, f) => a + f.length, 0);
      const totalLength = ((_b2 = last == null ? void 0 : last.totalLength) != null ? _b2 : 0) + length2;
      return arr.concat({ skel, frags, fragEnd, length: length2, totalLength });
    }, []));
    const pageSpreads = /* @__PURE__ */ new Map();
    try {
      const resources = await this.getResourcesByMagic(["RESC", "PAGE"]);
      if (resources.RESC != null) {
        const buf = await __privateGet(this, _mobi2).loadRecord(resources.RESC);
        const str = __privateGet(this, _mobi2).decode(buf.slice(16)).replace(/\0/g, "");
        const index = str.search(/\?>/);
        const xmlStr = `<package>${str.slice(index)}</package>`;
        if (__privateGet(this, _domAdapter2)) {
          const opf = __privateGet(this, _domAdapter2).parseXML(xmlStr);
          const itemrefs = opf.querySelectorAll("itemref");
          for (const $itemref of itemrefs) {
            const i = parseInt($itemref.getAttribute("skelid") || "0");
            const props = ($itemref.getAttribute("properties") || "").split(" ");
            const spread = getPageSpread(props);
            if (spread) pageSpreads.set(i, spread);
          }
        }
      }
    } catch (e) {
    }
    this.sections = [];
    __privateGet(this, _sectionIndexMap).clear();
    for (const [index, section] of __privateGet(this, _sections2).entries()) {
      if (!section.frags.length) continue;
      if (__privateGet(this, _domAdapter2) && isKF8NavigationDocument(await this.createDocument(section), __privateGet(this, _domAdapter2))) {
        continue;
      }
      __privateGet(this, _sectionIndexMap).set(index, this.sections.length);
      this.sections.push({
        id: index,
        load: () => this.loadSection(section),
        createDocument: () => this.createDocument(section),
        format: "xhtml",
        getDocument: async () => {
          const html = await this.createDocument(section);
          if (!__privateGet(this, _domAdapter2)) return null;
          const nodes = parseHTML(html, __privateGet(this, _domAdapter2));
          return createSectionDocument(nodes, __privateGet(this, _domAdapter2));
        },
        getSegments: async () => {
          const html = await this.createDocument(section);
          if (!__privateGet(this, _domAdapter2)) return [];
          const nodes = parseHTML(html, __privateGet(this, _domAdapter2));
          return extractDocumentSegments(nodes);
        },
        getBlocks: async () => {
          const html = await this.loadSection(section);
          if (!__privateGet(this, _domAdapter2)) return [];
          const nodes = parseHTML(html, __privateGet(this, _domAdapter2));
          return extractDocumentBlocks(nodes, {}, {
            coverImageSrcs: []
          });
        },
        size: section.length
      });
    }
    try {
      const ncx = await __privateGet(this, _mobi2).getNCX();
      const map = ({ label, pos, children }) => {
        const [fid, off] = pos || [0, 0];
        const href = makePosURI(fid, off);
        const arr = __privateGet(this, _fragmentOffsets).get(fid);
        if (arr) arr.push(off);
        else __privateGet(this, _fragmentOffsets).set(fid, [off]);
        return { label: unescapeHTML(label), href, subitems: children == null ? void 0 : children.map(map) };
      };
      this.toc = ncx == null ? void 0 : ncx.map(map);
      this.landmarks = await this.getGuide();
    } catch (e) {
      console.warn("Failed to build KF8 TOC", e);
    }
    const { exth } = __privateGet(this, _mobi2).headers;
    this.dir = exth == null ? void 0 : exth.pageProgressionDirection;
    this.rendition = {
      layout: (exth == null ? void 0 : exth.fixedLayout) === "true" ? "pre-paginated" : "reflowable"
    };
    this.metadata = __privateGet(this, _mobi2).getMetadata();
    return this.toBook();
  }
  async getResourcesByMagic(keys) {
    const results = {};
    const start = __privateGet(this, _mobi2).headers.kf8.resourceStart;
    const end = __privateGet(this, _mobi2).numRecords;
    for (let i = start; i < end; i++) {
      try {
        const magic = await __privateGet(this, _mobi2).loadMagic(i);
        const match = keys.find((key) => key === magic);
        if (match) results[match] = i;
      } catch (e) {
      }
    }
    return results;
  }
  async getGuide() {
    const index = __privateGet(this, _mobi2).headers.kf8.guide;
    if (index < 4294967295) {
      const loadRecord = __privateGet(this, _mobi2).loadRecord.bind(__privateGet(this, _mobi2));
      const { table, cncx } = await getIndexData(index, loadRecord);
      return table.map(({ name: name2, tagMap }) => {
        var _a2, _b2, _c, _d, _e, _f;
        return {
          label: (_b2 = cncx[(_a2 = tagMap[1]) == null ? void 0 : _a2[0]]) != null ? _b2 : "",
          type: (_c = name2 == null ? void 0 : name2.split(/\s/)) != null ? _c : [],
          href: makePosURI((_f = (_d = tagMap[6]) == null ? void 0 : _d[0]) != null ? _f : (_e = tagMap[3]) == null ? void 0 : _e[0])
        };
      });
    }
    return void 0;
  }
  async loadResource(str) {
    if (__privateGet(this, _cache2).has(str)) return __privateGet(this, _cache2).get(str);
    const { resourceType, id, type } = parseResourceURI(str);
    const raw = resourceType === "flow" ? await this.loadFlow(id) : await __privateGet(this, _mobi2).loadResource(id - 1);
    let data;
    if ([MIME_XHTML, MIME_HTML, MIME_CSS, MIME_SVG].includes(type)) {
      const buf = raw instanceof Uint8Array ? raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) : raw;
      data = await this.replaceResources(__privateGet(this, _mobi2).decode(buf));
    } else {
      data = raw instanceof Uint8Array ? new Uint8Array(raw).buffer : raw;
    }
    const url = __privateMethod(this, _KF8_instances, createURL_fn2).call(this, data, type);
    __privateGet(this, _cache2).set(str, url);
    return url;
  }
  replaceResources(str) {
    const regex = new RegExp(kindleResourceRegex, "g");
    return replaceSeries(str, regex, this.loadResource.bind(this));
  }
  async loadRaw(start, end) {
    const distanceHead = end - __privateGet(this, _rawHead).length;
    const distanceEnd = __privateGet(this, _fullRawLength) == null ? Infinity : __privateGet(this, _fullRawLength) - __privateGet(this, _rawTail).length - start;
    if (distanceHead < 0 || distanceHead < distanceEnd) {
      while (__privateGet(this, _rawHead).length < end) {
        const index = ++__privateWrapper(this, _lastLoadedHead)._;
        const data = await __privateGet(this, _mobi2).loadText(index);
        __privateSet(this, _rawHead, concatTypedArray(__privateGet(this, _rawHead), new Uint8Array(data)));
      }
      return __privateGet(this, _rawHead).slice(start, end);
    }
    while (__privateGet(this, _fullRawLength) - __privateGet(this, _rawTail).length > start) {
      const index = __privateGet(this, _mobi2).numTextRecords - 1 - ++__privateWrapper(this, _lastLoadedTail)._;
      const data = await __privateGet(this, _mobi2).loadText(index);
      __privateSet(this, _rawTail, concatTypedArray(new Uint8Array(data), __privateGet(this, _rawTail)));
    }
    const rawTailStart = __privateGet(this, _fullRawLength) - __privateGet(this, _rawTail).length;
    return __privateGet(this, _rawTail).slice(start - rawTailStart, end - rawTailStart);
  }
  loadFlow(index) {
    if (index < 4294967295 && __privateGet(this, _tables).fdstTable) {
      return this.loadRaw(...__privateGet(this, _tables).fdstTable[index]);
    }
    return new Uint8Array();
  }
  async loadText(section) {
    const { skel, frags, length: length2 } = section;
    const raw = await this.loadRaw(skel.offset, skel.offset + length2);
    let skeleton = new Uint8Array(raw.slice(0, skel.length));
    for (const frag of frags) {
      const insertOffset = frag.insertOffset - skel.offset;
      const offset = skel.length + frag.offset;
      const fragRaw = new Uint8Array(raw.slice(offset, offset + frag.length));
      skeleton = concatTypedArray3(
        new Uint8Array(skeleton.slice(0, insertOffset)),
        fragRaw,
        new Uint8Array(skeleton.slice(insertOffset))
      );
      const offsets = __privateGet(this, _fragmentOffsets).get(frag.index);
      if (offsets) {
        for (const off of offsets) {
          const str = __privateGet(this, _mobi2).decode(fragRaw.slice(off));
          const selector2 = getFragmentSelector(str);
          if (selector2) __privateMethod(this, _KF8_instances, setFragmentSelector_fn).call(this, frag.index, off, selector2);
        }
      }
    }
    return __privateGet(this, _mobi2).decode(skeleton);
  }
  async createDocument(section) {
    return this.loadText(section);
  }
  async loadSection(section) {
    var _a2;
    if (__privateGet(this, _cache2).has(section)) return __privateGet(this, _cache2).get(section);
    const str = await this.loadText(section);
    const replaced = await this.replaceResources(str);
    let docStr = replaced;
    if (__privateGet(this, _domAdapter2)) {
      let doc = __privateGet(this, _domAdapter2).parseHTML(replaced, __privateGet(this, _type));
      const parseError = doc.querySelector("parsererror");
      if (parseError || !((_a2 = doc.documentElement) == null ? void 0 : _a2.namespaceURI)) {
        __privateSet(this, _type, MIME_HTML);
        doc = __privateGet(this, _domAdapter2).parseHTML(replaced, __privateGet(this, _type));
      }
      docStr = __privateGet(this, _domAdapter2).serialize(doc);
    }
    __privateGet(this, _cache2).set(section, docStr);
    return docStr;
  }
  getIndexByFID(fid) {
    return __privateGet(this, _sections2).findIndex((section) => section.frags.some((frag) => frag.index === fid));
  }
  isSectionStart(rawIndex, fid, off) {
    var _a2, _b2;
    return off === 0 && ((_b2 = (_a2 = __privateGet(this, _sections2)[rawIndex]) == null ? void 0 : _a2.frags[0]) == null ? void 0 : _b2.index) === fid;
  }
  resolveHref(href) {
    const pos = parsePosURI(href);
    if (!pos) return null;
    const rawIndex = this.getIndexByFID(pos.fid);
    const index = __privateGet(this, _sectionIndexMap).get(rawIndex);
    if (index == null) return null;
    if (this.isSectionStart(rawIndex, pos.fid, pos.off)) return { index, anchor: 0 };
    const anchor = () => {
      var _a2, _b2;
      return (_b2 = (_a2 = __privateGet(this, _fragmentSelectors).get(pos.fid)) == null ? void 0 : _a2.get(pos.off)) != null ? _b2 : null;
    };
    return { index, anchor };
  }
  splitTOCHref(href) {
    const pos = parsePosURI(href);
    if (!pos) return null;
    const rawIndex = this.getIndexByFID(pos.fid);
    const index = __privateGet(this, _sectionIndexMap).get(rawIndex);
    if (index == null) return null;
    if (this.isSectionStart(rawIndex, pos.fid, pos.off)) return [index, null];
    return [index, `${pos.fid}:${pos.off}`];
  }
  isExternal(uri) {
    return /^(?!blob|kindle)\w+:/i.test(uri);
  }
  destroy() {
    for (const url of __privateGet(this, _cache2).values()) {
      if (typeof url === "string" && (url.startsWith("blob:") || url.startsWith("test:"))) {
        __privateMethod(this, _KF8_instances, revokeURL_fn2).call(this, url);
      }
    }
  }
  toBook() {
    const self = this;
    return {
      sections: this.sections,
      toc: this.toc,
      landmarks: this.landmarks,
      metadata: this.metadata,
      dir: this.dir,
      rendition: this.rendition,
      getCover: () => __privateGet(this, _mobi2).getCover(),
      resolveHref: (href) => self.resolveHref(href),
      isExternal: (uri) => self.isExternal(uri),
      splitTOCHref: (href) => {
        const result = self.splitTOCHref(href);
        return result != null ? result : [0, null];
      },
      destroy: () => self.destroy()
    };
  }
}
_mobi2 = new WeakMap();
_domAdapter2 = new WeakMap();
_urlFactory2 = new WeakMap();
_cache2 = new WeakMap();
_fragmentOffsets = new WeakMap();
_fragmentSelectors = new WeakMap();
_tables = new WeakMap();
_sections2 = new WeakMap();
_sectionIndexMap = new WeakMap();
_fullRawLength = new WeakMap();
_rawHead = new WeakMap();
_rawTail = new WeakMap();
_lastLoadedHead = new WeakMap();
_lastLoadedTail = new WeakMap();
_type = new WeakMap();
_urls2 = new WeakMap();
_KF8_instances = new WeakSet();
setFragmentSelector_fn = function(id, offset, selector2) {
  const map = __privateGet(this, _fragmentSelectors).get(id);
  if (map) map.set(offset, selector2);
  else {
    const newMap = /* @__PURE__ */ new Map();
    __privateGet(this, _fragmentSelectors).set(id, newMap);
    newMap.set(offset, selector2);
  }
};
createURL_fn2 = function(data, mimeType) {
  if (__privateGet(this, _urlFactory2)) {
    return __privateGet(this, _urlFactory2).createURL(data, mimeType);
  }
  const blob = typeof data === "string" ? new Blob([data], { type: mimeType }) : new Blob([data]);
  const url = URL.createObjectURL(blob);
  __privateGet(this, _urls2).push(url);
  return url;
};
revokeURL_fn2 = function(url) {
  if (__privateGet(this, _urlFactory2)) {
    __privateGet(this, _urlFactory2).revokeURL(url);
  } else {
    URL.revokeObjectURL(url);
  }
};
function createOutputBlob(buffer, type = "") {
  if (typeof Blob !== "undefined") return new Blob([buffer], { type });
  return new ArrayBufferBlob(buffer, type);
}
function toMOBIBlobInput(input) {
  try {
    return toBlobLike(input);
  } catch (e) {
    throw new UnsupportedInputError("MOBI parser cannot parse this input; provide a Blob-like object or ArrayBuffer");
  }
}
const isMOBI = async (file) => {
  try {
    const blob = toMOBIBlobInput(file);
    const magic = getString(await blob.slice(60, 68).arrayBuffer());
    return magic === "BOOKMOBI";
  } catch (e) {
    return false;
  }
};
class MOBIParser {
  constructor() {
    __publicField(this, "priority", 5);
  }
  async canParse(input) {
    if (typeof input === "string") {
      const lower = input.toLowerCase();
      return lower.endsWith(".mobi") || lower.endsWith(".azw") || lower.endsWith(".azw3");
    }
    const inputName = getInputName(input);
    if (inputName) {
      const lower = inputName.toLowerCase();
      return lower.endsWith(".mobi") || lower.endsWith(".azw") || lower.endsWith(".azw3");
    }
    if (input instanceof ArrayBuffer) {
      return isMOBI(input);
    }
    if (isBlobLike$1(input)) {
      return isMOBI(input);
    }
    return false;
  }
  async parse(input, options) {
    if (!(options == null ? void 0 : options.domAdapter) || !(options == null ? void 0 : options.urlFactory)) {
      throw new AdapterRequiredError("domAdapter and urlFactory");
    }
    let blob;
    if (typeof input === "string") {
      throw new UnsupportedInputError("MOBI parser cannot parse URL strings; provide a File, Blob, or ArrayBuffer");
    }
    blob = toMOBIBlobInput(input);
    let unzlib2;
    try {
      const fflate = await Promise.resolve().then(() => browser);
      unzlib2 = (data) => fflate.unzlibSync(data);
    } catch (e) {
    }
    const mobi2 = new MOBI({ unzlib: unzlib2 });
    const book = await mobi2.open(blob, {
      domAdapter: options.domAdapter,
      urlFactory: options.urlFactory
    });
    return book;
  }
}
const mobi = () => new MOBIParser();
class SectionProgress {
  constructor(sections, sizePerLoc = 1500) {
    __publicField(this, "sizes");
    __publicField(this, "sizePerLoc");
    __publicField(this, "sizeTotal");
    __publicField(this, "sectionFractions");
    this.sizes = sections.map((s) => s.linear !== "no" && s.size > 0 ? s.size : 0);
    this.sizePerLoc = sizePerLoc;
    this.sizeTotal = this.sizes.reduce((a, b) => a + b, 0);
    this.sectionFractions = this.calcSectionFractions();
  }
  calcSectionFractions() {
    const results = [0];
    let sum = 0;
    for (const size of this.sizes) {
      results.push((sum += size) / this.sizeTotal);
    }
    return results;
  }
  /**
   * Get progress info given section index and fraction within section.
   */
  getProgress(index, fractionInSection) {
    var _a2;
    const { sizes, sizePerLoc, sizeTotal } = this;
    const sizeInSection = (_a2 = sizes[index]) != null ? _a2 : 0;
    const sizeBefore = sizes.slice(0, index).reduce((a, b) => a + b, 0);
    const size = sizeBefore + fractionInSection * sizeInSection;
    const remaining = sizeTotal - size;
    return {
      fraction: sizeTotal > 0 ? size / sizeTotal : 0,
      section: {
        current: index,
        total: sizes.length
      },
      location: {
        current: Math.floor(size / sizePerLoc),
        total: Math.ceil(sizeTotal / sizePerLoc)
      },
      remaining: {
        section: (1 - fractionInSection) * sizeInSection,
        total: remaining
      }
    };
  }
  /**
   * Get section index and fraction from total fraction (inverse of getProgress).
   */
  getSection(fraction) {
    if (fraction <= 0) return [0, 0];
    if (fraction >= 1) return [this.sizes.length - 1, 1];
    fraction = fraction + Number.EPSILON;
    let index = this.sectionFractions.findIndex((x) => x > fraction) - 1;
    if (index < 0) return [0, 0];
    while (!this.sizes[index]) index++;
    const fractionInSection = (fraction - this.sectionFractions[index]) / (this.sizes[index] / this.sizeTotal);
    return [index, fractionInSection];
  }
  /**
   * Get section boundary fractions (for progress bar tick marks).
   */
  getFractions() {
    return this.sectionFractions.map((x) => x + Number.EPSILON);
  }
}
const DEFAULT_MARGIN = 32;
const DEFAULT_GAP = 48;
class WechatMiniProgramRenderer {
  constructor(config) {
    __publicField(this, "width");
    __publicField(this, "height");
    __publicField(this, "styles");
    __publicField(this, "layoutMode");
    __publicField(this, "maxColumnCount");
    __publicField(this, "overscan");
    __publicField(this, "setData");
    __publicField(this, "book", null);
    __publicField(this, "sections", []);
    __publicField(this, "currentIndex", -1);
    __publicField(this, "prepared", null);
    __publicField(this, "lines", []);
    __publicField(this, "pageIndex", 0);
    __publicField(this, "scrollTop", 0);
    __publicField(this, "progress", null);
    __publicField(this, "lastLocation", null);
    __publicField(this, "listeners", /* @__PURE__ */ new Map());
    __publicField(this, "activeLoadId", 0);
    __publicField(this, "prefetchPageCount", 0);
    __publicField(this, "columnLayout", {
      margin: DEFAULT_MARGIN,
      gap: DEFAULT_GAP,
      columnWidth: 0,
      columns: 1,
      pageHeight: 0,
      columnHeight: 0,
      pagePaddingBlock: 0,
      totalHeight: 0,
      pageCount: 1
    });
    var _a2, _b2, _c, _d;
    if (config.installPretextPolyfill !== false) {
      installWechatMiniProgramPretextPolyfill(config.wx);
    }
    this.width = Math.max(1, config.width);
    this.height = Math.max(1, config.height);
    this.styles = (_a2 = config.styles) != null ? _a2 : {};
    this.layoutMode = (_b2 = config.layout) != null ? _b2 : "paginated";
    this.maxColumnCount = (_c = config.maxColumnCount) != null ? _c : 1;
    this.overscan = (_d = config.overscan) != null ? _d : 4;
    this.setData = config.setData;
  }
  async open(book) {
    this.book = book;
    this.sections = book.sections;
    this.progress = new SectionProgress(this.sections);
    this.prefetchPageCount = getTranslationPrefetchPageCount(book);
    this.currentIndex = -1;
    this.pageIndex = 0;
    this.scrollTop = 0;
    this.publishSnapshot();
  }
  async goTo(target) {
    var _a2, _b2, _c;
    if (typeof target === "number") {
      await this.loadSection(target);
      return;
    }
    const resolved = (_c = (_b2 = (_a2 = this.book) == null ? void 0 : _a2.resolveHref) == null ? void 0 : _b2.call(_a2, target)) != null ? _c : this.resolveHrefFallback(target);
    if (!resolved) return;
    await this.loadSection(resolved.index, resolved.anchor);
  }
  async next() {
    if (this.layoutMode === "paginated") {
      if (this.pageIndex < this.columnLayout.pageCount - 1) {
        this.pageIndex++;
        this.scrollTop = this.pageIndex * this.columnLayout.pageHeight;
        this.publishPosition("page");
        return;
      }
      if (this.currentIndex < this.sections.length - 1) await this.loadSection(this.currentIndex + 1);
      return;
    }
    const maxScroll = this.getMaxScrollTop();
    if (this.scrollTop < maxScroll - 1) {
      this.scrollTop = Math.min(maxScroll, this.scrollTop + this.height);
      this.publishPosition("scroll");
      return;
    }
    if (this.currentIndex < this.sections.length - 1) await this.loadSection(this.currentIndex + 1);
  }
  async prev() {
    if (this.layoutMode === "paginated") {
      if (this.pageIndex > 0) {
        this.pageIndex--;
        this.scrollTop = this.pageIndex * this.columnLayout.pageHeight;
        this.publishPosition("page");
        return;
      }
      if (this.currentIndex > 0) {
        await this.loadSection(this.currentIndex - 1);
        this.pageIndex = this.columnLayout.pageCount - 1;
        this.scrollTop = this.pageIndex * this.columnLayout.pageHeight;
        this.publishPosition("page");
      }
      return;
    }
    if (this.scrollTop > 1) {
      this.scrollTop = Math.max(0, this.scrollTop - this.height);
      this.publishPosition("scroll");
      return;
    }
    if (this.currentIndex > 0) {
      await this.loadSection(this.currentIndex - 1);
      this.scrollTop = this.getMaxScrollTop();
      this.publishPosition("scroll");
    }
  }
  async goToFraction(fraction) {
    if (!this.progress) return;
    const safe2 = clamp01$1(fraction);
    const [index, sectionFraction] = this.progress.getSection(safe2);
    await this.loadSection(index);
    this.restoreSectionFraction(sectionFraction);
    this.publishPosition("fraction");
  }
  setStyles(styles) {
    const fraction = this.getSectionFraction();
    this.styles = { ...this.styles, ...styles };
    if (this.currentIndex >= 0) {
      void this.loadSection(this.currentIndex).then(() => {
        this.restoreSectionFraction(fraction);
        this.publishPosition("style");
      });
    } else {
      this.publishSnapshot();
    }
  }
  setLayout(mode) {
    if (this.layoutMode === mode) return;
    const fraction = this.getSectionFraction();
    this.layoutMode = mode;
    this.relayout();
    this.restoreSectionFraction(fraction);
    this.publishPosition("layout");
  }
  setSpread(maxColumns) {
    const fraction = this.getSectionFraction();
    this.maxColumnCount = Math.max(1, Math.floor(maxColumns));
    this.relayout();
    this.restoreSectionFraction(fraction);
    this.publishPosition("spread");
  }
  setViewport(width, height) {
    const fraction = this.getSectionFraction();
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.relayout();
    this.restoreSectionFraction(fraction);
    this.publishPosition("resize");
  }
  setScrollTop(scrollTop) {
    if (this.layoutMode === "paginated") return;
    this.scrollTop = Math.max(0, Math.min(scrollTop, this.getMaxScrollTop()));
    this.publishPosition("scroll");
  }
  getSnapshot() {
    const sourceScrollTop = this.getSourceScrollTop();
    const sourceViewportHeight = this.getSourceViewportHeight();
    const visible = getVisibleLines(this.lines, sourceScrollTop, sourceViewportHeight, this.overscan);
    const lines = visible.lines.map((line) => this.createLineNode(line));
    return {
      layout: this.layoutMode,
      width: this.width,
      height: this.height,
      contentWidth: this.columnLayout.columnWidth * this.columnLayout.columns + this.columnLayout.gap * (this.columnLayout.columns - 1),
      totalHeight: this.columnLayout.totalHeight,
      scrollTop: this.scrollTop,
      pageIndex: this.layoutMode === "paginated" ? this.pageIndex : 0,
      pageCount: this.columnLayout.pageCount,
      sectionIndex: this.currentIndex,
      sectionCount: this.sections.length,
      fraction: this.getSectionFraction(),
      lines
    };
  }
  getLocation() {
    return this.lastLocation;
  }
  getSectionFractions() {
    var _a2, _b2;
    return (_b2 = (_a2 = this.progress) == null ? void 0 : _a2.getFractions()) != null ? _b2 : [];
  }
  async refresh() {
    if (this.currentIndex < 0) return;
    const fraction = this.getSectionFraction();
    await this.loadSection(this.currentIndex);
    this.restoreSectionFraction(fraction);
    this.publishPosition("refresh");
  }
  on(event, listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, /* @__PURE__ */ new Set());
    this.listeners.get(event).add(listener);
  }
  off(event, listener) {
    var _a2;
    (_a2 = this.listeners.get(event)) == null ? void 0 : _a2.delete(listener);
  }
  destroy() {
    this.activeLoadId++;
    this.listeners.clear();
    this.book = null;
    this.sections = [];
    this.prepared = null;
    this.lines = [];
    this.currentIndex = -1;
    this.publishSnapshot();
  }
  async loadSection(index, anchor) {
    if (index < 0 || index >= this.sections.length) return;
    const loadId = ++this.activeLoadId;
    const section = this.sections[index];
    const blocks = await this.loadTextBlocks(section);
    if (loadId !== this.activeLoadId) return;
    const segments = blocks.flatMap((block) => block.segments);
    this.prepared = blocks.length > 0 ? prepareBlocks(blocks, { baseStyle: this.getBaseTextStyle() }) : prepare(segments, { baseStyle: this.getBaseTextStyle() });
    this.currentIndex = index;
    this.pageIndex = 0;
    this.scrollTop = 0;
    this.relayout();
    const anchorTop = this.getAnchorSourceTop(anchor);
    if (anchorTop != null) this.scrollTop = this.getScrollTopForSourceTop(anchorTop);
    if (this.layoutMode === "paginated") {
      this.pageIndex = Math.min(
        this.columnLayout.pageCount - 1,
        Math.floor(this.scrollTop / Math.max(1, this.columnLayout.pageHeight))
      );
      this.scrollTop = this.pageIndex * this.columnLayout.pageHeight;
    }
    this.emit("load", { doc: { lines: this.lines, segments }, index });
    this.publishPosition("snap");
  }
  async loadTextBlocks(section) {
    if (section.getBlocks) return section.getBlocks();
    if (section.getSegments) {
      return [{
        id: `${section.id}-body`,
        type: "container",
        segments: await section.getSegments()
      }];
    }
    const text = section.loadText ? await section.loadText() : await section.load();
    return [{
      id: `${section.id}-body`,
      type: "paragraph",
      segments: [{ text }]
    }];
  }
  relayout() {
    var _a2;
    if (!this.prepared) {
      this.columnLayout = this.createEmptyLayout();
      return;
    }
    const margin = parseCSSPixels(this.styles.margin, DEFAULT_MARGIN);
    const gap = parseCSSPixels(this.styles.gap, DEFAULT_GAP);
    const minColumnWidth = parseCSSPixels(this.styles.minColumnWidth, 320);
    const maxColumnWidth = parseCSSPixels((_a2 = this.styles.maxColumnWidth) != null ? _a2 : this.styles.maxInlineSize, 720);
    const availableWidth = Math.max(1, this.width - margin * 2);
    const columns = getColumnCount(this.layoutMode, availableWidth, minColumnWidth, gap, this.maxColumnCount);
    const rawWidth = columns > 1 ? (availableWidth - gap * (columns - 1)) / columns : availableWidth;
    const inlineSize = Math.max(1, Math.min(maxColumnWidth, rawWidth));
    const pageHeight = Math.max(1, this.height);
    const pagePaddingBlock = getPagePaddingBlock(this.layoutMode, pageHeight, margin);
    const columnHeight = this.layoutMode === "paginated" ? Math.max(this.getLineHeightPixels(), pageHeight - pagePaddingBlock * 2) : Number.POSITIVE_INFINITY;
    this.lines = layout(this.prepared, {
      inlineSize,
      lineHeight: this.getLineHeightPixels(),
      blockGap: this.getLineHeightPixels() * 0.5,
      maxBlockHeight: this.layoutMode === "paginated" ? columnHeight : void 0
    });
    const contentHeight = this.getContentHeight();
    const pageCount = this.layoutMode === "paginated" ? getReadablePageCount(this.lines, columnHeight, columns) : 1;
    const totalHeight = this.layoutMode === "paginated" ? pageCount * pageHeight : contentHeight + pagePaddingBlock * 2;
    this.columnLayout = {
      margin,
      gap,
      columnWidth: inlineSize,
      columns,
      pageHeight,
      columnHeight,
      pagePaddingBlock,
      totalHeight,
      pageCount
    };
    this.pageIndex = Math.min(this.pageIndex, pageCount - 1);
    this.scrollTop = Math.min(this.scrollTop, this.getMaxScrollTop());
  }
  createEmptyLayout() {
    return {
      margin: parseCSSPixels(this.styles.margin, DEFAULT_MARGIN),
      gap: parseCSSPixels(this.styles.gap, DEFAULT_GAP),
      columnWidth: Math.max(1, this.width - parseCSSPixels(this.styles.margin, DEFAULT_MARGIN) * 2),
      columns: 1,
      pageHeight: this.height,
      columnHeight: this.height,
      pagePaddingBlock: 0,
      totalHeight: this.height,
      pageCount: 1
    };
  }
  createLineNode(line) {
    var _a2, _b2;
    const position = this.getRenderedLinePosition(line);
    const style = this.getLineStyle(line, position);
    const base = {
      key: `line-${this.currentIndex}-${line.index}`,
      blockId: (_a2 = line.block) == null ? void 0 : _a2.id,
      blockType: (_b2 = line.block) == null ? void 0 : _b2.type,
      style
    };
    if (line.kind === "image" && line.image) {
      return { ...base, kind: "image", image: line.image };
    }
    if (line.kind === "table" && line.table) {
      return { ...base, kind: "table", table: line.table, columns: getTableColumns(line.table) };
    }
    if (line.kind === "separator") {
      return { ...base, kind: "separator" };
    }
    if (line.kind === "pre") {
      return { ...base, kind: "pre", text: line.text };
    }
    return {
      ...base,
      kind: "text",
      fragments: line.segments.map((fragment, index) => this.createTextFragment(fragment, index))
    };
  }
  getLineStyle(line, position) {
    var _a2, _b2;
    const inlineOffset = (_a2 = line.inlineOffset) != null ? _a2 : 0;
    const left = position.left + inlineOffset;
    const width = Math.max(1, line.kind === "image" ? line.width : this.columnLayout.columnWidth - inlineOffset);
    return {
      position: "absolute",
      top: `${position.top}px`,
      left: `${left}px`,
      width: `${width}px`,
      height: `${line.height}px`,
      lineHeight: `${line.height}px`,
      color: (_b2 = this.styles.color) != null ? _b2 : "inherit"
    };
  }
  createTextFragment(fragment, index) {
    var _a2, _b2;
    const sourceAttrs = (_a2 = fragment.source) == null ? void 0 : _a2.attrs;
    const style = getTextFragmentStyle({ ...this.getBaseTextStyle(), ...fragment.style }, fragment.gapBefore);
    if (((_b2 = fragment.source) == null ? void 0 : _b2.nodeType) === "img" && (sourceAttrs == null ? void 0 : sourceAttrs.src)) {
      return {
        key: `fragment-${fragment.segmentIndex}-${index}`,
        text: "",
        style,
        image: {
          src: sourceAttrs.src,
          alt: sourceAttrs.alt,
          width: parseCSSPixels(sourceAttrs["data-rebook-inline-image-width"], 11),
          height: parseCSSPixels(sourceAttrs["data-rebook-inline-image-height"], 11)
        }
      };
    }
    return {
      key: `fragment-${fragment.segmentIndex}-${index}`,
      text: fragment.text,
      style
    };
  }
  publishPosition(reason) {
    this.publishSnapshot();
    this.emitRelocate(reason);
    this.emitBlockWindow(reason);
  }
  publishSnapshot() {
    var _a2;
    const snapshot = this.getSnapshot();
    (_a2 = this.setData) == null ? void 0 : _a2.call(this, snapshot);
    this.emit("snapshot", snapshot);
  }
  emitRelocate(reason) {
    var _a2;
    if (this.currentIndex < 0) return;
    const fraction = this.getSectionFraction();
    const event = {
      range: getVisibleLines(this.lines, this.getSourceScrollTop(), this.getSourceViewportHeight(), 0),
      index: this.currentIndex,
      fraction,
      totalFraction: (_a2 = this.progress) == null ? void 0 : _a2.getProgress(this.currentIndex, fraction).fraction,
      reason
    };
    this.lastLocation = event;
    this.emit("relocate", event);
  }
  emitBlockWindow(reason) {
    if (this.currentIndex < 0 || this.prefetchPageCount <= 0) return;
    const blockIds = this.getPrefetchBlockIds();
    if (!blockIds.length) return;
    this.emit("block-window", {
      index: this.currentIndex,
      blockIds,
      pageIndex: this.layoutMode === "paginated" ? this.pageIndex : void 0,
      pageCount: this.prefetchPageCount,
      reason
    });
  }
  getPrefetchBlockIds() {
    var _a2;
    const ids = [];
    const seen = /* @__PURE__ */ new Set();
    const sourceStart = this.getSourceScrollTop();
    const sourceEnd = sourceStart + this.getSourceViewportHeight() + this.getSourceHeightForPages(this.prefetchPageCount);
    for (const line of this.lines) {
      if (line.top + line.height < sourceStart) continue;
      if (line.top > sourceEnd) break;
      const blockId = (_a2 = line.block) == null ? void 0 : _a2.id;
      if (!blockId || seen.has(blockId)) continue;
      seen.add(blockId);
      ids.push(blockId);
    }
    return ids;
  }
  getSourceHeightForPages(pageCount) {
    return this.layoutMode === "paginated" ? this.columnLayout.columnHeight * this.columnLayout.columns * Math.max(1, pageCount) : this.height * Math.max(1, pageCount);
  }
  resolveHrefFallback(href) {
    const [path] = href.split("#");
    const index = this.sections.findIndex((section) => typeof section.id === "string" && (section.id === path || section.id.endsWith(path)));
    return index < 0 ? null : { index };
  }
  getAnchorSourceTop(anchor) {
    var _a2;
    if (anchor == null) return null;
    if (typeof anchor === "number") return anchor;
    const value2 = typeof anchor === "function" ? this.resolveAnchorValue(anchor) : anchor;
    const anchorIds = getAnchorIds(value2);
    if (!anchorIds.length) return null;
    const line = this.lines.find((item) => {
      const block = item.block;
      return block && anchorIds.some((id) => {
        var _a3, _b2;
        return block.id === id || ((_a3 = block.attrs) == null ? void 0 : _a3.id) === id || ((_b2 = block.attrs) == null ? void 0 : _b2.name) === id;
      });
    });
    return (_a2 = line == null ? void 0 : line.top) != null ? _a2 : null;
  }
  resolveAnchorValue(anchor) {
    try {
      return anchor({
        getElementById: (id) => id,
        querySelector: (selector2) => selector2
      });
    } catch (e) {
      return null;
    }
  }
  getScrollTopForSourceTop(sourceTop) {
    const safeSourceTop = Math.max(0, sourceTop);
    if (this.layoutMode === "paginated") {
      const pageSourceHeight = Math.max(1, this.columnLayout.columnHeight * this.columnLayout.columns);
      return Math.floor(safeSourceTop / pageSourceHeight) * this.columnLayout.pageHeight;
    }
    return safeSourceTop + this.columnLayout.pagePaddingBlock;
  }
  getRenderedLinePosition(line) {
    const { columns, pageHeight, columnHeight, columnWidth, gap, pagePaddingBlock } = this.columnLayout;
    if (this.layoutMode !== "paginated") return { top: line.top + pagePaddingBlock, left: 0 };
    const sourceColumn = Math.floor(line.top / columnHeight);
    const row = Math.floor(sourceColumn / columns);
    const column = sourceColumn % columns;
    return {
      top: (row - this.pageIndex) * pageHeight + pagePaddingBlock + line.top % columnHeight,
      left: column * (columnWidth + gap)
    };
  }
  getSourceScrollTop() {
    if (this.layoutMode !== "paginated") return Math.max(0, this.scrollTop - this.columnLayout.pagePaddingBlock);
    return this.pageIndex * this.columnLayout.columnHeight * this.columnLayout.columns;
  }
  getSourceViewportHeight() {
    if (this.layoutMode !== "paginated") return this.height + this.columnLayout.pagePaddingBlock * 2;
    return this.columnLayout.columnHeight * this.columnLayout.columns;
  }
  getSectionFraction() {
    if (this.currentIndex < 0) return 0;
    if (this.layoutMode === "paginated") {
      return this.columnLayout.pageCount > 1 ? this.pageIndex / (this.columnLayout.pageCount - 1) : 0;
    }
    const maxScroll = this.getMaxScrollTop();
    return maxScroll > 0 ? this.scrollTop / maxScroll : 0;
  }
  restoreSectionFraction(fraction) {
    const safe2 = clamp01$1(fraction);
    if (this.layoutMode === "paginated") {
      this.pageIndex = Math.min(
        this.columnLayout.pageCount - 1,
        Math.round(safe2 * Math.max(0, this.columnLayout.pageCount - 1))
      );
      this.scrollTop = this.pageIndex * this.columnLayout.pageHeight;
      return;
    }
    this.scrollTop = this.getMaxScrollTop() * safe2;
  }
  getMaxScrollTop() {
    return Math.max(0, this.columnLayout.totalHeight - this.height);
  }
  getContentHeight() {
    const last = this.lines[this.lines.length - 1];
    return last ? last.top + last.height : 0;
  }
  getBaseTextStyle() {
    var _a2;
    const fontSize = parseCSSPixels(this.styles.fontSize, 16);
    return {
      fontFamily: (_a2 = this.styles.fontFamily) != null ? _a2 : 'system-ui, "Noto Serif CJK SC", "Noto Serif SC", Georgia, serif',
      fontSize,
      lineHeight: getLineHeightMultiplier(this.styles.lineHeight, fontSize),
      color: this.styles.color
    };
  }
  getLineHeightPixels() {
    const fontSize = parseCSSPixels(this.styles.fontSize, 16);
    const lineHeight = this.styles.lineHeight;
    if (typeof lineHeight === "string" && lineHeight.trim().endsWith("px")) {
      return parseCSSPixels(lineHeight, fontSize * 1.6);
    }
    return fontSize * getLineHeightMultiplier(lineHeight, fontSize);
  }
  emit(event, data) {
    var _a2;
    (_a2 = this.listeners.get(event)) == null ? void 0 : _a2.forEach((fn) => fn(data));
  }
}
const createWechatMiniProgramRenderer = (config) => {
  return new WechatMiniProgramRenderer(config);
};
function getTranslationPrefetchPageCount(book) {
  const value2 = book.translationPrefetchPageCount;
  return typeof value2 === "number" && Number.isFinite(value2) ? Math.max(0, Math.floor(value2)) : 0;
}
function parseCSSPixels(value2, fallback) {
  if (!value2) return fallback;
  if (typeof value2 === "number") return Number.isFinite(value2) ? value2 : fallback;
  const match = value2.trim().match(/^([\d.]+)(px)?$/);
  if (!match) return fallback;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function getLineHeightMultiplier(value2, fontSize) {
  if (typeof value2 === "number") return value2;
  if (typeof value2 === "string") {
    const trimmed = value2.trim();
    if (trimmed.endsWith("px")) return parseCSSPixels(trimmed, fontSize * 1.6) / fontSize;
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 1.6;
}
function getColumnCount(mode, availableWidth, minColumnWidth, gap, maxColumnCount) {
  if (mode !== "paginated" || maxColumnCount < 2) return 1;
  return availableWidth >= minColumnWidth * 2 + gap ? 2 : 1;
}
function getReadablePageCount(lines, columnHeight, columns) {
  let lastReadablePage = 0;
  for (const line of lines) {
    if (line.height <= 0) continue;
    lastReadablePage = Math.max(lastReadablePage, getLinePageIndex(line, columnHeight, columns));
  }
  return Math.max(1, lastReadablePage + 1);
}
function getLinePageIndex(line, columnHeight, columns) {
  const sourceColumn = Math.floor(Math.max(0, line.top) / Math.max(1, columnHeight));
  return Math.floor(sourceColumn / Math.max(1, columns));
}
function getPagePaddingBlock(mode, pageHeight, margin) {
  const preferred = mode === "paginated" ? Math.max(20, margin) : Math.max(12, margin * 0.5);
  return Math.min(Math.max(0, pageHeight / 2 - 16), preferred);
}
function getTextFragmentStyle(style, gapBefore) {
  return {
    ...gapBefore > 0 ? { marginLeft: `${gapBefore}px` } : {},
    ...style.fontFamily ? { fontFamily: style.fontFamily } : {},
    ...style.fontSize ? { fontSize: `${style.fontSize}px` } : {},
    ...style.fontWeight ? { fontWeight: style.fontWeight } : {},
    ...style.fontStyle ? { fontStyle: style.fontStyle } : {},
    ...style.fontVariant ? { fontVariant: style.fontVariant } : {},
    ...style.color ? { color: style.color } : {},
    ...style.textDecoration ? { textDecoration: style.textDecoration } : {},
    ...style.verticalAlign ? { verticalAlign: style.verticalAlign } : {},
    ...style.letterSpacing ? { letterSpacing: `${style.letterSpacing}px` } : {}
  };
}
function getTableColumns(table) {
  var _a2;
  const weights = ((_a2 = table.columnWeights) == null ? void 0 : _a2.length) === table.columnCount ? table.columnWeights : Array.from({ length: table.columnCount }, () => 1);
  return weights.map((weight) => `${Math.max(0.1, weight)}fr`).join(" ");
}
function getAnchorIds(value2) {
  if (typeof value2 !== "string") {
    const id = getElementLikeId(value2);
    return id ? [id] : [];
  }
  const trimmed = value2.trim();
  if (!trimmed) return [];
  const attrMatch = trimmed.match(/^\[(?:id|name)=["']([^"']+)["']\]$/);
  if (attrMatch) return [unescapeCSSIdentifier(attrMatch[1])];
  if (trimmed.startsWith("#")) return [unescapeCSSIdentifier(trimmed.slice(1))];
  if (/^[\w:-]+$/.test(trimmed)) return [trimmed];
  return [];
}
function getElementLikeId(value2) {
  var _a2, _b2, _c, _d;
  if (!value2 || typeof value2 !== "object") return null;
  const maybeElement = value2;
  if (typeof maybeElement.id === "string" && maybeElement.id) return maybeElement.id;
  return (_d = (_c = (_a2 = maybeElement.getAttribute) == null ? void 0 : _a2.call(maybeElement, "id")) != null ? _c : (_b2 = maybeElement.getAttribute) == null ? void 0 : _b2.call(maybeElement, "name")) != null ? _d : null;
}
function unescapeCSSIdentifier(value2) {
  return value2.replace(/\\(.)/g, "$1");
}
function clamp01$1(value2) {
  return Math.max(0, Math.min(1, value2));
}
var lib = {};
var conventions = {};
var hasRequiredConventions;
function requireConventions() {
  if (hasRequiredConventions) return conventions;
  hasRequiredConventions = 1;
  function find2(list, predicate, ac) {
    if (ac === void 0) {
      ac = Array.prototype;
    }
    if (list && typeof ac.find === "function") {
      return ac.find.call(list, predicate);
    }
    for (var i = 0; i < list.length; i++) {
      if (hasOwn(list, i)) {
        var item = list[i];
        if (predicate.call(void 0, item, i, list)) {
          return item;
        }
      }
    }
  }
  function freeze(object, oc) {
    if (oc === void 0) {
      oc = Object;
    }
    if (oc && typeof oc.getOwnPropertyDescriptors === "function") {
      object = oc.create(null, oc.getOwnPropertyDescriptors(object));
    }
    return oc && typeof oc.freeze === "function" ? oc.freeze(object) : object;
  }
  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }
  function assign(target, source) {
    if (target === null || typeof target !== "object") {
      throw new TypeError("target is not an object");
    }
    for (var key in source) {
      if (hasOwn(source, key)) {
        target[key] = source[key];
      }
    }
    return target;
  }
  var HTML_BOOLEAN_ATTRIBUTES = freeze({
    allowfullscreen: true,
    async: true,
    autofocus: true,
    autoplay: true,
    checked: true,
    controls: true,
    default: true,
    defer: true,
    disabled: true,
    formnovalidate: true,
    hidden: true,
    ismap: true,
    itemscope: true,
    loop: true,
    multiple: true,
    muted: true,
    nomodule: true,
    novalidate: true,
    open: true,
    playsinline: true,
    readonly: true,
    required: true,
    reversed: true,
    selected: true
  });
  function isHTMLBooleanAttribute(name2) {
    return hasOwn(HTML_BOOLEAN_ATTRIBUTES, name2.toLowerCase());
  }
  var HTML_VOID_ELEMENTS = freeze({
    area: true,
    base: true,
    br: true,
    col: true,
    embed: true,
    hr: true,
    img: true,
    input: true,
    link: true,
    meta: true,
    param: true,
    source: true,
    track: true,
    wbr: true
  });
  function isHTMLVoidElement(tagName) {
    return hasOwn(HTML_VOID_ELEMENTS, tagName.toLowerCase());
  }
  var HTML_RAW_TEXT_ELEMENTS = freeze({
    script: false,
    style: false,
    textarea: true,
    title: true
  });
  function isHTMLRawTextElement(tagName) {
    var key = tagName.toLowerCase();
    return hasOwn(HTML_RAW_TEXT_ELEMENTS, key) && !HTML_RAW_TEXT_ELEMENTS[key];
  }
  function isHTMLEscapableRawTextElement(tagName) {
    var key = tagName.toLowerCase();
    return hasOwn(HTML_RAW_TEXT_ELEMENTS, key) && HTML_RAW_TEXT_ELEMENTS[key];
  }
  function isHTMLMimeType(mimeType) {
    return mimeType === MIME_TYPE.HTML;
  }
  function hasDefaultHTMLNamespace(mimeType) {
    return isHTMLMimeType(mimeType) || mimeType === MIME_TYPE.XML_XHTML_APPLICATION;
  }
  var MIME_TYPE = freeze({
    /**
     * `text/html`, the only mime type that triggers treating an XML document as HTML.
     *
     * @see https://www.iana.org/assignments/media-types/text/html IANA MimeType registration
     * @see https://en.wikipedia.org/wiki/HTML Wikipedia
     * @see https://developer.mozilla.org/en-US/docs/Web/API/DOMParser/parseFromString MDN
     * @see https://html.spec.whatwg.org/multipage/dynamic-markup-insertion.html#dom-domparser-parsefromstring
     *      WHATWG HTML Spec
     */
    HTML: "text/html",
    /**
     * `application/xml`, the standard mime type for XML documents.
     *
     * @see https://www.iana.org/assignments/media-types/application/xml IANA MimeType
     *      registration
     * @see https://tools.ietf.org/html/rfc7303#section-9.1 RFC 7303
     * @see https://en.wikipedia.org/wiki/XML_and_MIME Wikipedia
     */
    XML_APPLICATION: "application/xml",
    /**
     * `text/xml`, an alias for `application/xml`.
     *
     * @see https://tools.ietf.org/html/rfc7303#section-9.2 RFC 7303
     * @see https://www.iana.org/assignments/media-types/text/xml IANA MimeType registration
     * @see https://en.wikipedia.org/wiki/XML_and_MIME Wikipedia
     */
    XML_TEXT: "text/xml",
    /**
     * `application/xhtml+xml`, indicates an XML document that has the default HTML namespace,
     * but is parsed as an XML document.
     *
     * @see https://www.iana.org/assignments/media-types/application/xhtml+xml IANA MimeType
     *      registration
     * @see https://dom.spec.whatwg.org/#dom-domimplementation-createdocument WHATWG DOM Spec
     * @see https://en.wikipedia.org/wiki/XHTML Wikipedia
     */
    XML_XHTML_APPLICATION: "application/xhtml+xml",
    /**
     * `image/svg+xml`,
     *
     * @see https://www.iana.org/assignments/media-types/image/svg+xml IANA MimeType registration
     * @see https://www.w3.org/TR/SVG11/ W3C SVG 1.1
     * @see https://en.wikipedia.org/wiki/Scalable_Vector_Graphics Wikipedia
     */
    XML_SVG_IMAGE: "image/svg+xml"
  });
  var _MIME_TYPES = Object.keys(MIME_TYPE).map(function(key) {
    return MIME_TYPE[key];
  });
  function isValidMimeType(mimeType) {
    return _MIME_TYPES.indexOf(mimeType) > -1;
  }
  var NAMESPACE = freeze({
    /**
     * The XHTML namespace.
     *
     * @see http://www.w3.org/1999/xhtml
     */
    HTML: "http://www.w3.org/1999/xhtml",
    /**
     * The SVG namespace.
     *
     * @see http://www.w3.org/2000/svg
     */
    SVG: "http://www.w3.org/2000/svg",
    /**
     * The `xml:` namespace.
     *
     * @see http://www.w3.org/XML/1998/namespace
     */
    XML: "http://www.w3.org/XML/1998/namespace",
    /**
     * The `xmlns:` namespace.
     *
     * @see https://www.w3.org/2000/xmlns/
     */
    XMLNS: "http://www.w3.org/2000/xmlns/"
  });
  conventions.assign = assign;
  conventions.find = find2;
  conventions.freeze = freeze;
  conventions.HTML_BOOLEAN_ATTRIBUTES = HTML_BOOLEAN_ATTRIBUTES;
  conventions.HTML_RAW_TEXT_ELEMENTS = HTML_RAW_TEXT_ELEMENTS;
  conventions.HTML_VOID_ELEMENTS = HTML_VOID_ELEMENTS;
  conventions.hasDefaultHTMLNamespace = hasDefaultHTMLNamespace;
  conventions.hasOwn = hasOwn;
  conventions.isHTMLBooleanAttribute = isHTMLBooleanAttribute;
  conventions.isHTMLRawTextElement = isHTMLRawTextElement;
  conventions.isHTMLEscapableRawTextElement = isHTMLEscapableRawTextElement;
  conventions.isHTMLMimeType = isHTMLMimeType;
  conventions.isHTMLVoidElement = isHTMLVoidElement;
  conventions.isValidMimeType = isValidMimeType;
  conventions.MIME_TYPE = MIME_TYPE;
  conventions.NAMESPACE = NAMESPACE;
  return conventions;
}
var errors = {};
var hasRequiredErrors;
function requireErrors() {
  if (hasRequiredErrors) return errors;
  hasRequiredErrors = 1;
  var conventions2 = requireConventions();
  function extendError(constructor, writableName) {
    constructor.prototype = Object.create(Error.prototype, {
      constructor: { value: constructor },
      name: { value: constructor.name, enumerable: true, writable: writableName }
    });
  }
  var DOMExceptionName = conventions2.freeze({
    /**
     * the default value as defined by the spec
     */
    Error: "Error",
    /**
     * @deprecated
     * Use RangeError instead.
     */
    IndexSizeError: "IndexSizeError",
    /**
     * @deprecated
     * Just to match the related static code, not part of the spec.
     */
    DomstringSizeError: "DomstringSizeError",
    HierarchyRequestError: "HierarchyRequestError",
    WrongDocumentError: "WrongDocumentError",
    InvalidCharacterError: "InvalidCharacterError",
    /**
     * @deprecated
     * Just to match the related static code, not part of the spec.
     */
    NoDataAllowedError: "NoDataAllowedError",
    NoModificationAllowedError: "NoModificationAllowedError",
    NotFoundError: "NotFoundError",
    NotSupportedError: "NotSupportedError",
    InUseAttributeError: "InUseAttributeError",
    InvalidStateError: "InvalidStateError",
    SyntaxError: "SyntaxError",
    InvalidModificationError: "InvalidModificationError",
    NamespaceError: "NamespaceError",
    /**
     * @deprecated
     * Use TypeError for invalid arguments,
     * "NotSupportedError" DOMException for unsupported operations,
     * and "NotAllowedError" DOMException for denied requests instead.
     */
    InvalidAccessError: "InvalidAccessError",
    /**
     * @deprecated
     * Just to match the related static code, not part of the spec.
     */
    ValidationError: "ValidationError",
    /**
     * @deprecated
     * Use TypeError instead.
     */
    TypeMismatchError: "TypeMismatchError",
    SecurityError: "SecurityError",
    NetworkError: "NetworkError",
    AbortError: "AbortError",
    /**
     * @deprecated
     * Just to match the related static code, not part of the spec.
     */
    URLMismatchError: "URLMismatchError",
    QuotaExceededError: "QuotaExceededError",
    TimeoutError: "TimeoutError",
    InvalidNodeTypeError: "InvalidNodeTypeError",
    DataCloneError: "DataCloneError",
    EncodingError: "EncodingError",
    NotReadableError: "NotReadableError",
    UnknownError: "UnknownError",
    ConstraintError: "ConstraintError",
    DataError: "DataError",
    TransactionInactiveError: "TransactionInactiveError",
    ReadOnlyError: "ReadOnlyError",
    VersionError: "VersionError",
    OperationError: "OperationError",
    NotAllowedError: "NotAllowedError",
    OptOutError: "OptOutError"
  });
  var DOMExceptionNames = Object.keys(DOMExceptionName);
  function isValidDomExceptionCode(value2) {
    return typeof value2 === "number" && value2 >= 1 && value2 <= 25;
  }
  function endsWithError(value2) {
    return typeof value2 === "string" && value2.substring(value2.length - DOMExceptionName.Error.length) === DOMExceptionName.Error;
  }
  function DOMException(messageOrCode, nameOrMessage) {
    if (isValidDomExceptionCode(messageOrCode)) {
      this.name = DOMExceptionNames[messageOrCode];
      this.message = nameOrMessage || "";
    } else {
      this.message = messageOrCode;
      this.name = endsWithError(nameOrMessage) ? nameOrMessage : DOMExceptionName.Error;
    }
    if (Error.captureStackTrace) Error.captureStackTrace(this, DOMException);
  }
  extendError(DOMException, true);
  Object.defineProperties(DOMException.prototype, {
    code: {
      enumerable: true,
      get: function() {
        var code2 = DOMExceptionNames.indexOf(this.name);
        if (isValidDomExceptionCode(code2)) return code2;
        return 0;
      }
    }
  });
  var ExceptionCode = {
    INDEX_SIZE_ERR: 1,
    DOMSTRING_SIZE_ERR: 2,
    HIERARCHY_REQUEST_ERR: 3,
    WRONG_DOCUMENT_ERR: 4,
    INVALID_CHARACTER_ERR: 5,
    NO_DATA_ALLOWED_ERR: 6,
    NO_MODIFICATION_ALLOWED_ERR: 7,
    NOT_FOUND_ERR: 8,
    NOT_SUPPORTED_ERR: 9,
    INUSE_ATTRIBUTE_ERR: 10,
    INVALID_STATE_ERR: 11,
    SYNTAX_ERR: 12,
    INVALID_MODIFICATION_ERR: 13,
    NAMESPACE_ERR: 14,
    INVALID_ACCESS_ERR: 15,
    VALIDATION_ERR: 16,
    TYPE_MISMATCH_ERR: 17,
    SECURITY_ERR: 18,
    NETWORK_ERR: 19,
    ABORT_ERR: 20,
    URL_MISMATCH_ERR: 21,
    QUOTA_EXCEEDED_ERR: 22,
    TIMEOUT_ERR: 23,
    INVALID_NODE_TYPE_ERR: 24,
    DATA_CLONE_ERR: 25
  };
  var entries = Object.entries(ExceptionCode);
  for (var i = 0; i < entries.length; i++) {
    var key = entries[i][0];
    DOMException[key] = entries[i][1];
  }
  function ParseError2(message, locator) {
    this.message = message;
    this.locator = locator;
    if (Error.captureStackTrace) Error.captureStackTrace(this, ParseError2);
  }
  extendError(ParseError2);
  errors.DOMException = DOMException;
  errors.DOMExceptionName = DOMExceptionName;
  errors.ExceptionCode = ExceptionCode;
  errors.ParseError = ParseError2;
  return errors;
}
var dom = {};
var grammar = {};
var hasRequiredGrammar;
function requireGrammar() {
  if (hasRequiredGrammar) return grammar;
  hasRequiredGrammar = 1;
  function detectUnicodeSupport(RegExpImpl) {
    try {
      if (typeof RegExpImpl !== "function") {
        RegExpImpl = RegExp;
      }
      var match = new RegExpImpl("𝌆", "u").exec("𝌆");
      return !!match && match[0].length === 2;
    } catch (error) {
    }
    return false;
  }
  var UNICODE_SUPPORT = detectUnicodeSupport();
  function chars(regexp) {
    if (regexp.source[0] !== "[") {
      throw new Error(regexp + " can not be used with chars");
    }
    return regexp.source.slice(1, regexp.source.lastIndexOf("]"));
  }
  function chars_without(regexp, search) {
    if (regexp.source[0] !== "[") {
      throw new Error("/" + regexp.source + "/ can not be used with chars_without");
    }
    if (!search || typeof search !== "string") {
      throw new Error(JSON.stringify(search) + " is not a valid search");
    }
    if (regexp.source.indexOf(search) === -1) {
      throw new Error('"' + search + '" is not is /' + regexp.source + "/");
    }
    if (search === "-" && regexp.source.indexOf(search) !== 1) {
      throw new Error('"' + search + '" is not at the first postion of /' + regexp.source + "/");
    }
    return new RegExp(regexp.source.replace(search, ""), UNICODE_SUPPORT ? "u" : "");
  }
  function reg(args) {
    var self = this;
    return new RegExp(
      Array.prototype.slice.call(arguments).map(function(part) {
        var isStr = typeof part === "string";
        if (isStr && self === void 0 && part === "|") {
          throw new Error("use regg instead of reg to wrap expressions with `|`!");
        }
        return isStr ? part : part.source;
      }).join(""),
      UNICODE_SUPPORT ? "mu" : "m"
    );
  }
  function regg(args) {
    if (arguments.length === 0) {
      throw new Error("no parameters provided");
    }
    return reg.apply(regg, ["(?:"].concat(Array.prototype.slice.call(arguments), [")"]));
  }
  var UNICODE_REPLACEMENT_CHARACTER = "�";
  var Char = /[-\x09\x0A\x0D\x20-\x2C\x2E-\uD7FF\uE000-\uFFFD]/;
  if (UNICODE_SUPPORT) {
    Char = reg("[", chars(Char), "\\u{10000}-\\u{10FFFF}", "]");
  }
  var InvalidChar = new RegExp("[^" + chars(Char) + "]", UNICODE_SUPPORT ? "u" : "");
  var _SChar = /[\x20\x09\x0D\x0A]/;
  var SChar_s = chars(_SChar);
  var S = reg(_SChar, "+");
  var S_OPT = reg(_SChar, "*");
  var NameStartChar = /[:_a-zA-Z\xC0-\xD6\xD8-\xF6\xF8-\u02FF\u0370-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/;
  if (UNICODE_SUPPORT) {
    NameStartChar = reg("[", chars(NameStartChar), "\\u{10000}-\\u{10FFFF}", "]");
  }
  var NameStartChar_s = chars(NameStartChar);
  var NameChar = reg("[", NameStartChar_s, chars(/[-.0-9\xB7]/), chars(/[\u0300-\u036F\u203F-\u2040]/), "]");
  var Name = reg(NameStartChar, NameChar, "*");
  var Nmtoken = reg(NameChar, "+");
  var EntityRef = reg("&", Name, ";");
  var CharRef = regg(/&#[0-9]+;|&#x[0-9a-fA-F]+;/);
  var Reference = regg(EntityRef, "|", CharRef);
  var PEReference = reg("%", Name, ";");
  var EntityValue = regg(
    reg('"', regg(/[^%&"]/, "|", PEReference, "|", Reference), "*", '"'),
    "|",
    reg("'", regg(/[^%&']/, "|", PEReference, "|", Reference), "*", "'")
  );
  var AttValue = regg('"', regg(/[^<&"]/, "|", Reference), "*", '"', "|", "'", regg(/[^<&']/, "|", Reference), "*", "'");
  var NCNameStartChar = chars_without(NameStartChar, ":");
  var NCNameChar = chars_without(NameChar, ":");
  var NCName = reg(NCNameStartChar, NCNameChar, "*");
  var QName = reg(NCName, regg(":", NCName), "?");
  var QName_exact = reg("^", QName, "$");
  var QName_group = reg("(", QName, ")");
  var SystemLiteral = regg(/"[^"]*"|'[^']*'/);
  var PI = reg(/^<\?/, "(", Name, ")", regg(S, "(", Char, "*?)"), "?", /\?>/);
  var PubidChar = /[\x20\x0D\x0Aa-zA-Z0-9-'()+,./:=?;!*#@$_%]/;
  var PubidLiteral = regg('"', PubidChar, '*"', "|", "'", chars_without(PubidChar, "'"), "*'");
  var COMMENT_START = "<!--";
  var COMMENT_END = "-->";
  var Comment2 = reg(COMMENT_START, regg(chars_without(Char, "-"), "|", reg("-", chars_without(Char, "-"))), "*", COMMENT_END);
  var PCDATA = "#PCDATA";
  var Mixed = regg(
    reg(/\(/, S_OPT, PCDATA, regg(S_OPT, /\|/, S_OPT, QName), "*", S_OPT, /\)\*/),
    "|",
    reg(/\(/, S_OPT, PCDATA, S_OPT, /\)/)
  );
  var _children_quantity = /[?*+]?/;
  var children = reg(
    /\([^>]+\)/,
    _children_quantity
    /*regg(choice, '|', seq), _children_quantity*/
  );
  var contentspec = regg("EMPTY", "|", "ANY", "|", Mixed, "|", children);
  var ELEMENTDECL_START = "<!ELEMENT";
  var elementdecl = reg(ELEMENTDECL_START, S, regg(QName, "|", PEReference), S, regg(contentspec, "|", PEReference), S_OPT, ">");
  var NotationType = reg("NOTATION", S, /\(/, S_OPT, Name, regg(S_OPT, /\|/, S_OPT, Name), "*", S_OPT, /\)/);
  var Enumeration = reg(/\(/, S_OPT, Nmtoken, regg(S_OPT, /\|/, S_OPT, Nmtoken), "*", S_OPT, /\)/);
  var EnumeratedType = regg(NotationType, "|", Enumeration);
  var AttType = regg(/CDATA|ID|IDREF|IDREFS|ENTITY|ENTITIES|NMTOKEN|NMTOKENS/, "|", EnumeratedType);
  var DefaultDecl = regg(/#REQUIRED|#IMPLIED/, "|", regg(regg("#FIXED", S), "?", AttValue));
  var AttDef = regg(S, Name, S, AttType, S, DefaultDecl);
  var ATTLIST_DECL_START = "<!ATTLIST";
  var AttlistDecl = reg(ATTLIST_DECL_START, S, Name, AttDef, "*", S_OPT, ">");
  var ABOUT_LEGACY_COMPAT = "about:legacy-compat";
  var ABOUT_LEGACY_COMPAT_SystemLiteral = regg('"' + ABOUT_LEGACY_COMPAT + '"', "|", "'" + ABOUT_LEGACY_COMPAT + "'");
  var SYSTEM = "SYSTEM";
  var PUBLIC = "PUBLIC";
  var ExternalID = regg(regg(SYSTEM, S, SystemLiteral), "|", regg(PUBLIC, S, PubidLiteral, S, SystemLiteral));
  var ExternalID_match = reg(
    "^",
    regg(
      regg(SYSTEM, S, "(?<SystemLiteralOnly>", SystemLiteral, ")"),
      "|",
      regg(PUBLIC, S, "(?<PubidLiteral>", PubidLiteral, ")", S, "(?<SystemLiteral>", SystemLiteral, ")")
    )
  );
  var PubidLiteral_match = reg("^", PubidLiteral, "$");
  var SystemLiteral_match = reg("^", SystemLiteral, "$");
  var NDataDecl = regg(S, "NDATA", S, Name);
  var EntityDef = regg(EntityValue, "|", regg(ExternalID, NDataDecl, "?"));
  var ENTITY_DECL_START = "<!ENTITY";
  var GEDecl = reg(ENTITY_DECL_START, S, Name, S, EntityDef, S_OPT, ">");
  var PEDef = regg(EntityValue, "|", ExternalID);
  var PEDecl = reg(ENTITY_DECL_START, S, "%", S, Name, S, PEDef, S_OPT, ">");
  var EntityDecl = regg(GEDecl, "|", PEDecl);
  var PublicID = reg(PUBLIC, S, PubidLiteral);
  var NotationDecl = reg("<!NOTATION", S, Name, S, regg(ExternalID, "|", PublicID), S_OPT, ">");
  var Eq = reg(S_OPT, "=", S_OPT);
  var VersionNum = /1[.]\d+/;
  var VersionInfo = reg(S, "version", Eq, regg("'", VersionNum, "'", "|", '"', VersionNum, '"'));
  var EncName = /[A-Za-z][-A-Za-z0-9._]*/;
  var EncodingDecl = regg(S, "encoding", Eq, regg('"', EncName, '"', "|", "'", EncName, "'"));
  var SDDecl = regg(S, "standalone", Eq, regg("'", regg("yes", "|", "no"), "'", "|", '"', regg("yes", "|", "no"), '"'));
  var XMLDecl = reg(/^<\?xml/, VersionInfo, EncodingDecl, "?", SDDecl, "?", S_OPT, /\?>/);
  var DOCTYPE_DECL_START = "<!DOCTYPE";
  var CDATA_START = "<![CDATA[";
  var CDATA_END = "]]>";
  var CDStart = /<!\[CDATA\[/;
  var CDEnd = /\]\]>/;
  var CData = reg(Char, "*?", CDEnd);
  var CDSect = reg(CDStart, CData);
  grammar.chars = chars;
  grammar.chars_without = chars_without;
  grammar.detectUnicodeSupport = detectUnicodeSupport;
  grammar.reg = reg;
  grammar.regg = regg;
  grammar.ABOUT_LEGACY_COMPAT = ABOUT_LEGACY_COMPAT;
  grammar.ABOUT_LEGACY_COMPAT_SystemLiteral = ABOUT_LEGACY_COMPAT_SystemLiteral;
  grammar.AttlistDecl = AttlistDecl;
  grammar.CDATA_START = CDATA_START;
  grammar.CDATA_END = CDATA_END;
  grammar.CDSect = CDSect;
  grammar.Char = Char;
  grammar.Comment = Comment2;
  grammar.COMMENT_START = COMMENT_START;
  grammar.COMMENT_END = COMMENT_END;
  grammar.DOCTYPE_DECL_START = DOCTYPE_DECL_START;
  grammar.elementdecl = elementdecl;
  grammar.EntityDecl = EntityDecl;
  grammar.EntityValue = EntityValue;
  grammar.ExternalID = ExternalID;
  grammar.ExternalID_match = ExternalID_match;
  grammar.Name = Name;
  grammar.NotationDecl = NotationDecl;
  grammar.Reference = Reference;
  grammar.PEReference = PEReference;
  grammar.PI = PI;
  grammar.PUBLIC = PUBLIC;
  grammar.PubidLiteral = PubidLiteral;
  grammar.PubidLiteral_match = PubidLiteral_match;
  grammar.QName = QName;
  grammar.QName_exact = QName_exact;
  grammar.QName_group = QName_group;
  grammar.S = S;
  grammar.SChar_s = SChar_s;
  grammar.S_OPT = S_OPT;
  grammar.SYSTEM = SYSTEM;
  grammar.SystemLiteral = SystemLiteral;
  grammar.SystemLiteral_match = SystemLiteral_match;
  grammar.InvalidChar = InvalidChar;
  grammar.UNICODE_REPLACEMENT_CHARACTER = UNICODE_REPLACEMENT_CHARACTER;
  grammar.UNICODE_SUPPORT = UNICODE_SUPPORT;
  grammar.XMLDecl = XMLDecl;
  return grammar;
}
var hasRequiredDom;
function requireDom() {
  if (hasRequiredDom) return dom;
  hasRequiredDom = 1;
  var conventions2 = requireConventions();
  var find2 = conventions2.find;
  var hasDefaultHTMLNamespace = conventions2.hasDefaultHTMLNamespace;
  var hasOwn = conventions2.hasOwn;
  var isHTMLMimeType = conventions2.isHTMLMimeType;
  var isHTMLRawTextElement = conventions2.isHTMLRawTextElement;
  var isHTMLVoidElement = conventions2.isHTMLVoidElement;
  var MIME_TYPE = conventions2.MIME_TYPE;
  var NAMESPACE = conventions2.NAMESPACE;
  var PDC = Symbol();
  var errors2 = requireErrors();
  var DOMException = errors2.DOMException;
  var DOMExceptionName = errors2.DOMExceptionName;
  var g = requireGrammar();
  function checkSymbol(symbol) {
    if (symbol !== PDC) {
      throw new TypeError("Illegal constructor");
    }
  }
  function notEmptyString(input) {
    return input !== "";
  }
  function splitOnASCIIWhitespace(input) {
    return input ? input.split(/[\t\n\f\r ]+/).filter(notEmptyString) : [];
  }
  function orderedSetReducer(current, element) {
    if (!hasOwn(current, element)) {
      current[element] = true;
    }
    return current;
  }
  function toOrderedSet(input) {
    if (!input) return [];
    var list = splitOnASCIIWhitespace(input);
    return Object.keys(list.reduce(orderedSetReducer, {}));
  }
  function arrayIncludes(list) {
    return function(element) {
      return list && list.indexOf(element) !== -1;
    };
  }
  function validateQualifiedName(qualifiedName) {
    if (!g.QName_exact.test(qualifiedName)) {
      throw new DOMException(DOMException.INVALID_CHARACTER_ERR, 'invalid character in qualified name "' + qualifiedName + '"');
    }
  }
  function validateAndExtract(namespace, qualifiedName) {
    validateQualifiedName(qualifiedName);
    namespace = namespace || null;
    var prefix = null;
    var localName = qualifiedName;
    if (qualifiedName.indexOf(":") >= 0) {
      var splitResult = qualifiedName.split(":");
      prefix = splitResult[0];
      localName = splitResult[1];
    }
    if (prefix !== null && namespace === null) {
      throw new DOMException(DOMException.NAMESPACE_ERR, "prefix is non-null and namespace is null");
    }
    if (prefix === "xml" && namespace !== conventions2.NAMESPACE.XML) {
      throw new DOMException(DOMException.NAMESPACE_ERR, 'prefix is "xml" and namespace is not the XML namespace');
    }
    if ((prefix === "xmlns" || qualifiedName === "xmlns") && namespace !== conventions2.NAMESPACE.XMLNS) {
      throw new DOMException(
        DOMException.NAMESPACE_ERR,
        'either qualifiedName or prefix is "xmlns" and namespace is not the XMLNS namespace'
      );
    }
    if (namespace === conventions2.NAMESPACE.XMLNS && prefix !== "xmlns" && qualifiedName !== "xmlns") {
      throw new DOMException(
        DOMException.NAMESPACE_ERR,
        'namespace is the XMLNS namespace and neither qualifiedName nor prefix is "xmlns"'
      );
    }
    return [namespace, prefix, localName];
  }
  function copy(src, dest) {
    for (var p in src) {
      if (hasOwn(src, p)) {
        dest[p] = src[p];
      }
    }
  }
  function _extends(Class, Super) {
    var pt = Class.prototype;
    if (!(pt instanceof Super)) {
      let t = function() {
      };
      t.prototype = Super.prototype;
      t = new t();
      copy(pt, t);
      Class.prototype = pt = t;
    }
    if (pt.constructor != Class) {
      if (typeof Class != "function") {
        console.error("unknown Class:" + Class);
      }
      pt.constructor = Class;
    }
  }
  var NodeType = {};
  var ELEMENT_NODE = NodeType.ELEMENT_NODE = 1;
  var ATTRIBUTE_NODE = NodeType.ATTRIBUTE_NODE = 2;
  var TEXT_NODE = NodeType.TEXT_NODE = 3;
  var CDATA_SECTION_NODE = NodeType.CDATA_SECTION_NODE = 4;
  var ENTITY_REFERENCE_NODE = NodeType.ENTITY_REFERENCE_NODE = 5;
  var ENTITY_NODE = NodeType.ENTITY_NODE = 6;
  var PROCESSING_INSTRUCTION_NODE = NodeType.PROCESSING_INSTRUCTION_NODE = 7;
  var COMMENT_NODE = NodeType.COMMENT_NODE = 8;
  var DOCUMENT_NODE = NodeType.DOCUMENT_NODE = 9;
  var DOCUMENT_TYPE_NODE = NodeType.DOCUMENT_TYPE_NODE = 10;
  var DOCUMENT_FRAGMENT_NODE = NodeType.DOCUMENT_FRAGMENT_NODE = 11;
  var NOTATION_NODE = NodeType.NOTATION_NODE = 12;
  var DocumentPosition = conventions2.freeze({
    DOCUMENT_POSITION_DISCONNECTED: 1,
    DOCUMENT_POSITION_PRECEDING: 2,
    DOCUMENT_POSITION_FOLLOWING: 4,
    DOCUMENT_POSITION_CONTAINS: 8,
    DOCUMENT_POSITION_CONTAINED_BY: 16,
    DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC: 32
  });
  function commonAncestor(a, b) {
    if (b.length < a.length) return commonAncestor(b, a);
    var c = null;
    for (var n in a) {
      if (a[n] !== b[n]) return c;
      c = a[n];
    }
    return c;
  }
  function docGUID(doc) {
    if (!doc.guid) doc.guid = Math.random();
    return doc.guid;
  }
  function NodeList() {
  }
  NodeList.prototype = {
    /**
     * The number of nodes in the list. The range of valid child node indices is 0 to length-1
     * inclusive.
     *
     * @type {number}
     */
    length: 0,
    /**
     * Returns the item at `index`. If index is greater than or equal to the number of nodes in
     * the list, this returns null.
     *
     * @param index
     * Unsigned long Index into the collection.
     * @returns {Node | null}
     * The node at position `index` in the NodeList,
     * or null if that is not a valid index.
     */
    item: function(index) {
      return index >= 0 && index < this.length ? this[index] : null;
    },
    /**
     * Returns a string representation of the NodeList.
     *
     * Accepts the same `options` object as `XMLSerializer.prototype.serializeToString`
     * (`requireWellFormed`, `splitCDATASections`, `nodeFilter`). Passing a function is treated as
     * a legacy `nodeFilter` for backward compatibility.
     *
     * @param {Object | function} [options]
     * @param {boolean} [options.requireWellFormed=false]
     * @param {boolean} [options.splitCDATASections=true]
     * @param {function} [options.nodeFilter]
     * @returns {string}
     */
    toString: function(options) {
      var opts;
      if (typeof options === "function") {
        opts = { requireWellFormed: false, splitCDATASections: true, nodeFilter: options };
      } else if (!!options) {
        opts = {
          requireWellFormed: !!options.requireWellFormed,
          splitCDATASections: options.splitCDATASections !== false,
          nodeFilter: options.nodeFilter || null
        };
      } else {
        opts = { requireWellFormed: false, splitCDATASections: true, nodeFilter: null };
      }
      for (var buf = [], i = 0; i < this.length; i++) {
        serializeToString(this[i], buf, null, opts);
      }
      return buf.join("");
    },
    /**
     * Filters the NodeList based on a predicate.
     *
     * @param {function(Node): boolean} predicate
     * - A predicate function to filter the NodeList.
     * @returns {Node[]}
     * An array of nodes that satisfy the predicate.
     * @private
     */
    filter: function(predicate) {
      return Array.prototype.filter.call(this, predicate);
    },
    /**
     * Returns the first index at which a given node can be found in the NodeList, or -1 if it is
     * not present.
     *
     * @param {Node} item
     * - The Node item to locate in the NodeList.
     * @returns {number}
     * The first index of the node in the NodeList; -1 if not found.
     * @private
     */
    indexOf: function(item) {
      return Array.prototype.indexOf.call(this, item);
    }
  };
  NodeList.prototype[Symbol.iterator] = function() {
    var me = this;
    var index = 0;
    return {
      next: function() {
        if (index < me.length) {
          return {
            value: me[index++],
            done: false
          };
        } else {
          return {
            done: true
          };
        }
      },
      return: function() {
        return {
          done: true
        };
      }
    };
  };
  function LiveNodeList(node2, refresh) {
    this._node = node2;
    this._refresh = refresh;
    _updateLiveList(this);
  }
  function _updateLiveList(list) {
    var inc = list._node._inc || list._node.ownerDocument._inc;
    if (list._inc !== inc) {
      var ls = list._refresh(list._node);
      __set__(list, "length", ls.length);
      if (!list.$$length || ls.length < list.$$length) {
        for (var i = ls.length; i in list; i++) {
          if (hasOwn(list, i)) {
            delete list[i];
          }
        }
      }
      copy(ls, list);
      list._inc = inc;
    }
  }
  LiveNodeList.prototype.item = function(i) {
    _updateLiveList(this);
    return this[i] || null;
  };
  _extends(LiveNodeList, NodeList);
  function NamedNodeMap() {
  }
  function _findNodeIndex(list, node2) {
    var i = 0;
    while (i < list.length) {
      if (list[i] === node2) {
        return i;
      }
      i++;
    }
  }
  function _addNamedNode(el, list, newAttr, oldAttr) {
    if (oldAttr) {
      list[_findNodeIndex(list, oldAttr)] = newAttr;
    } else {
      list[list.length] = newAttr;
      list.length++;
    }
    if (el) {
      newAttr.ownerElement = el;
      var doc = el.ownerDocument;
      if (doc) {
        oldAttr && _onRemoveAttribute(doc, el, oldAttr);
        _onAddAttribute(doc, el, newAttr);
      }
    }
  }
  function _removeNamedNode(el, list, attr) {
    var i = _findNodeIndex(list, attr);
    if (i >= 0) {
      var lastIndex = list.length - 1;
      while (i <= lastIndex) {
        list[i] = list[++i];
      }
      list.length = lastIndex;
      if (el) {
        var doc = el.ownerDocument;
        if (doc) {
          _onRemoveAttribute(doc, el, attr);
        }
        attr.ownerElement = null;
      }
    }
  }
  NamedNodeMap.prototype = {
    length: 0,
    item: NodeList.prototype.item,
    /**
     * Get an attribute by name. Note: Name is in lower case in case of HTML namespace and
     * document.
     *
     * @param {string} localName
     * The local name of the attribute.
     * @returns {Attr | null}
     * The attribute with the given local name, or null if no such attribute exists.
     * @see https://dom.spec.whatwg.org/#concept-element-attributes-get-by-name
     */
    getNamedItem: function(localName) {
      if (this._ownerElement && this._ownerElement._isInHTMLDocumentAndNamespace()) {
        localName = localName.toLowerCase();
      }
      var i = 0;
      while (i < this.length) {
        var attr = this[i];
        if (attr.nodeName === localName) {
          return attr;
        }
        i++;
      }
      return null;
    },
    /**
     * Set an attribute.
     *
     * @param {Attr} attr
     * The attribute to set.
     * @returns {Attr | null}
     * The old attribute with the same local name and namespace URI as the new one, or null if no
     * such attribute exists.
     * @throws {DOMException}
     * With code:
     * - {@link INUSE_ATTRIBUTE_ERR} - If the attribute is already an attribute of another
     * element.
     * @see https://dom.spec.whatwg.org/#concept-element-attributes-set
     */
    setNamedItem: function(attr) {
      var el = attr.ownerElement;
      if (el && el !== this._ownerElement) {
        throw new DOMException(DOMException.INUSE_ATTRIBUTE_ERR);
      }
      var oldAttr = this.getNamedItemNS(attr.namespaceURI, attr.localName);
      if (oldAttr === attr) {
        return attr;
      }
      _addNamedNode(this._ownerElement, this, attr, oldAttr);
      return oldAttr;
    },
    /**
     * Set an attribute, replacing an existing attribute with the same local name and namespace
     * URI if one exists.
     *
     * @param {Attr} attr
     * The attribute to set.
     * @returns {Attr | null}
     * The old attribute with the same local name and namespace URI as the new one, or null if no
     * such attribute exists.
     * @throws {DOMException}
     * Throws a DOMException with the name "InUseAttributeError" if the attribute is already an
     * attribute of another element.
     * @see https://dom.spec.whatwg.org/#concept-element-attributes-set
     */
    setNamedItemNS: function(attr) {
      return this.setNamedItem(attr);
    },
    /**
     * Removes an attribute specified by the local name.
     *
     * @param {string} localName
     * The local name of the attribute to be removed.
     * @returns {Attr}
     * The attribute node that was removed.
     * @throws {DOMException}
     * With code:
     * - {@link DOMException.NOT_FOUND_ERR} if no attribute with the given name is found.
     * @see https://dom.spec.whatwg.org/#dom-namednodemap-removenameditem
     * @see https://dom.spec.whatwg.org/#concept-element-attributes-remove-by-name
     */
    removeNamedItem: function(localName) {
      var attr = this.getNamedItem(localName);
      if (!attr) {
        throw new DOMException(DOMException.NOT_FOUND_ERR, localName);
      }
      _removeNamedNode(this._ownerElement, this, attr);
      return attr;
    },
    /**
     * Removes an attribute specified by the namespace and local name.
     *
     * @param {string | null} namespaceURI
     * The namespace URI of the attribute to be removed.
     * @param {string} localName
     * The local name of the attribute to be removed.
     * @returns {Attr}
     * The attribute node that was removed.
     * @throws {DOMException}
     * With code:
     * - {@link DOMException.NOT_FOUND_ERR} if no attribute with the given namespace URI and local
     * name is found.
     * @see https://dom.spec.whatwg.org/#dom-namednodemap-removenameditemns
     * @see https://dom.spec.whatwg.org/#concept-element-attributes-remove-by-namespace
     */
    removeNamedItemNS: function(namespaceURI, localName) {
      var attr = this.getNamedItemNS(namespaceURI, localName);
      if (!attr) {
        throw new DOMException(DOMException.NOT_FOUND_ERR, namespaceURI ? namespaceURI + " : " + localName : localName);
      }
      _removeNamedNode(this._ownerElement, this, attr);
      return attr;
    },
    /**
     * Get an attribute by namespace and local name.
     *
     * @param {string | null} namespaceURI
     * The namespace URI of the attribute.
     * @param {string} localName
     * The local name of the attribute.
     * @returns {Attr | null}
     * The attribute with the given namespace URI and local name, or null if no such attribute
     * exists.
     * @see https://dom.spec.whatwg.org/#concept-element-attributes-get-by-namespace
     */
    getNamedItemNS: function(namespaceURI, localName) {
      if (!namespaceURI) {
        namespaceURI = null;
      }
      var i = 0;
      while (i < this.length) {
        var node2 = this[i];
        if (node2.localName === localName && node2.namespaceURI === namespaceURI) {
          return node2;
        }
        i++;
      }
      return null;
    }
  };
  NamedNodeMap.prototype[Symbol.iterator] = function() {
    var me = this;
    var index = 0;
    return {
      next: function() {
        if (index < me.length) {
          return {
            value: me[index++],
            done: false
          };
        } else {
          return {
            done: true
          };
        }
      },
      return: function() {
        return {
          done: true
        };
      }
    };
  };
  function DOMImplementation() {
  }
  DOMImplementation.prototype = {
    /**
     * Test if the DOM implementation implements a specific feature and version, as specified in
     * {@link https://www.w3.org/TR/DOM-Level-3-Core/core.html#DOMFeatures DOM Features}.
     *
     * The DOMImplementation.hasFeature() method returns a Boolean flag indicating if a given
     * feature is supported. The different implementations fairly diverged in what kind of
     * features were reported. The latest version of the spec settled to force this method to
     * always return true, where the functionality was accurate and in use.
     *
     * @deprecated
     * It is deprecated and modern browsers return true in all cases.
     * @function DOMImplementation#hasFeature
     * @param {string} feature
     * The name of the feature to test.
     * @param {string} [version]
     * This is the version number of the feature to test.
     * @returns {boolean}
     * Always returns true.
     * @see https://developer.mozilla.org/en-US/docs/Web/API/DOMImplementation/hasFeature MDN
     * @see https://www.w3.org/TR/REC-DOM-Level-1/level-one-core.html#ID-5CED94D7 DOM Level 1 Core
     * @see https://dom.spec.whatwg.org/#dom-domimplementation-hasfeature DOM Living Standard
     * @see https://www.w3.org/TR/DOM-Level-3-Core/core.html#ID-5CED94D7 DOM Level 3 Core
     */
    hasFeature: function(feature, version) {
      return true;
    },
    /**
     * Creates a DOM Document object of the specified type with its document element. Note that
     * based on the {@link DocumentType}
     * given to create the document, the implementation may instantiate specialized
     * {@link Document} objects that support additional features than the "Core", such as "HTML"
     * {@link https://www.w3.org/TR/DOM-Level-3-Core/references.html#DOM2HTML DOM Level 2 HTML}.
     * On the other hand, setting the {@link DocumentType} after the document was created makes
     * this very unlikely to happen. Alternatively, specialized {@link Document} creation methods,
     * such as createHTMLDocument
     * {@link https://www.w3.org/TR/DOM-Level-3-Core/references.html#DOM2HTML DOM Level 2 HTML},
     * can be used to obtain specific types of {@link Document} objects.
     *
     * __It behaves slightly different from the description in the living standard__:
     * - There is no interface/class `XMLDocument`, it returns a `Document`
     * instance (with it's `type` set to `'xml'`).
     * - `encoding`, `mode`, `origin`, `url` fields are currently not declared.
     *
     * @function DOMImplementation.createDocument
     * @param {string | null} namespaceURI
     * The
     * {@link https://www.w3.org/TR/DOM-Level-3-Core/glossary.html#dt-namespaceURI namespace URI}
     * of the document element to create or null.
     * @param {string | null} qualifiedName
     * The
     * {@link https://www.w3.org/TR/DOM-Level-3-Core/glossary.html#dt-qualifiedname qualified name}
     * of the document element to be created or null.
     * @param {DocumentType | null} [doctype=null]
     * The type of document to be created or null. When doctype is not null, its
     * {@link Node#ownerDocument} attribute is set to the document being created. Default is
     * `null`
     * @returns {Document}
     * A new {@link Document} object with its document element. If the NamespaceURI,
     * qualifiedName, and doctype are null, the returned {@link Document} is empty with no
     * document element.
     * @throws {DOMException}
     * With code:
     *
     * - `INVALID_CHARACTER_ERR`: Raised if the specified qualified name is not an XML name
     * according to {@link https://www.w3.org/TR/DOM-Level-3-Core/references.html#XML XML 1.0}.
     * - `NAMESPACE_ERR`: Raised if the qualifiedName is malformed, if the qualifiedName has a
     * prefix and the namespaceURI is null, or if the qualifiedName is null and the namespaceURI
     * is different from null, or if the qualifiedName has a prefix that is "xml" and the
     * namespaceURI is different from "{@link http://www.w3.org/XML/1998/namespace}"
     * {@link https://www.w3.org/TR/DOM-Level-3-Core/references.html#Namespaces XML Namespaces},
     * or if the DOM implementation does not support the "XML" feature but a non-null namespace
     * URI was provided, since namespaces were defined by XML.
     * - `WRONG_DOCUMENT_ERR`: Raised if doctype has already been used with a different document
     * or was created from a different implementation.
     * - `NOT_SUPPORTED_ERR`: May be raised if the implementation does not support the feature
     * "XML" and the language exposed through the Document does not support XML Namespaces (such
     * as {@link https://www.w3.org/TR/DOM-Level-3-Core/references.html#HTML40 HTML 4.01}).
     * @since DOM Level 2.
     * @see {@link #createHTMLDocument}
     * @see https://developer.mozilla.org/en-US/docs/Web/API/DOMImplementation/createDocument MDN
     * @see https://dom.spec.whatwg.org/#dom-domimplementation-createdocument DOM Living Standard
     * @see https://www.w3.org/TR/DOM-Level-3-Core/core.html#Level-2-Core-DOM-createDocument DOM
     *      Level 3 Core
     * @see https://www.w3.org/TR/DOM-Level-2-Core/core.html#Level-2-Core-DOM-createDocument DOM
     *      Level 2 Core (initial)
     */
    createDocument: function(namespaceURI, qualifiedName, doctype) {
      var contentType = MIME_TYPE.XML_APPLICATION;
      if (namespaceURI === NAMESPACE.HTML) {
        contentType = MIME_TYPE.XML_XHTML_APPLICATION;
      } else if (namespaceURI === NAMESPACE.SVG) {
        contentType = MIME_TYPE.XML_SVG_IMAGE;
      }
      var doc = new Document(PDC, { contentType });
      doc.implementation = this;
      doc.childNodes = new NodeList();
      doc.doctype = doctype || null;
      if (doctype) {
        doc.appendChild(doctype);
      }
      if (qualifiedName) {
        var root = doc.createElementNS(namespaceURI, qualifiedName);
        doc.appendChild(root);
      }
      return doc;
    },
    /**
     * Creates an empty DocumentType node. Entity declarations and notations are not made
     * available. Entity reference expansions and default attribute additions do not occur.
     *
     * **This behavior is slightly different from the one in the specs**:
     * - `encoding`, `mode`, `origin`, `url` fields are currently not declared.
     * - `publicId` and `systemId` contain the raw data including any possible quotes,
     *   so they can always be serialized back to the original value
     * - `internalSubset` contains the raw string between `[` and `]` if present,
     *   but is not parsed or validated in any form.
     *
     * @function DOMImplementation#createDocumentType
     * @param {string} qualifiedName
     * The {@link https://www.w3.org/TR/DOM-Level-3-Core/glossary.html#dt-qualifiedname qualified
     * name} of the document type to be created.
     * @param {string} [publicId]
     * The external subset public identifier. Stored verbatim including surrounding quotes.
     * When serialized with `requireWellFormed: true`, the serializer throws `InvalidStateError`
     * if the value is non-empty and does not match the XML `PubidLiteral` production
     * (W3C DOM Parsing §3.2.1.3; XML 1.0 production [12]). Creation-time validation is not
     * enforced — deferred to a future breaking release.
     * @param {string} [systemId]
     * The external subset system identifier. Stored verbatim including surrounding quotes.
     * When serialized with `requireWellFormed: true`, the serializer throws `InvalidStateError`
     * if the value is non-empty and does not match the XML `SystemLiteral` production
     * (W3C DOM Parsing §3.2.1.3; XML 1.0 production [11]). Creation-time validation is not
     * enforced — deferred to a future breaking release.
     * @param {string} [internalSubset]
     * The internal subset or an empty string if it is not present. Stored verbatim.
     * When serialized with `requireWellFormed: true`, the serializer throws `InvalidStateError`
     * if the value contains `"]>"`. Creation-time validation is not enforced.
     * @returns {DocumentType}
     * A new {@link DocumentType} node with {@link Node#ownerDocument} set to null.
     * @throws {DOMException}
     * With code:
     *
     * - `INVALID_CHARACTER_ERR`: Raised if the specified qualified name is not an XML name
     * according to {@link https://www.w3.org/TR/DOM-Level-3-Core/references.html#XML XML 1.0}.
     * - `NAMESPACE_ERR`: Raised if the qualifiedName is malformed.
     * - `NOT_SUPPORTED_ERR`: May be raised if the implementation does not support the feature
     * "XML" and the language exposed through the Document does not support XML Namespaces (such
     * as {@link https://www.w3.org/TR/DOM-Level-3-Core/references.html#HTML40 HTML 4.01}).
     * @since DOM Level 2.
     * @see https://developer.mozilla.org/en-US/docs/Web/API/DOMImplementation/createDocumentType
     *      MDN
     * @see https://dom.spec.whatwg.org/#dom-domimplementation-createdocumenttype DOM Living
     *      Standard
     * @see https://www.w3.org/TR/DOM-Level-3-Core/core.html#Level-3-Core-DOM-createDocType DOM
     *      Level 3 Core
     * @see https://www.w3.org/TR/DOM-Level-2-Core/core.html#Level-2-Core-DOM-createDocType DOM
     *      Level 2 Core
     * @see https://github.com/xmldom/xmldom/blob/master/CHANGELOG.md#050
     * @see https://www.w3.org/TR/DOM-Level-2-Core/#core-ID-Core-DocType-internalSubset
     * @prettierignore
     */
    createDocumentType: function(qualifiedName, publicId, systemId, internalSubset) {
      validateQualifiedName(qualifiedName);
      var node2 = new DocumentType(PDC);
      node2.name = qualifiedName;
      node2.nodeName = qualifiedName;
      node2.publicId = publicId || "";
      node2.systemId = systemId || "";
      node2.internalSubset = internalSubset || "";
      node2.childNodes = new NodeList();
      return node2;
    },
    /**
     * Returns an HTML document, that might already have a basic DOM structure.
     *
     * __It behaves slightly different from the description in the living standard__:
     * - If the first argument is `false` no initial nodes are added (steps 3-7 in the specs are
     * omitted)
     * - `encoding`, `mode`, `origin`, `url` fields are currently not declared.
     *
     * @param {string | false} [title]
     * A string containing the title to give the new HTML document.
     * @returns {Document}
     * The HTML document.
     * @since WHATWG Living Standard.
     * @see {@link #createDocument}
     * @see https://dom.spec.whatwg.org/#dom-domimplementation-createhtmldocument
     * @see https://dom.spec.whatwg.org/#html-document
     */
    createHTMLDocument: function(title) {
      var doc = new Document(PDC, { contentType: MIME_TYPE.HTML });
      doc.implementation = this;
      doc.childNodes = new NodeList();
      if (title !== false) {
        doc.doctype = this.createDocumentType("html");
        doc.doctype.ownerDocument = doc;
        doc.appendChild(doc.doctype);
        var htmlNode = doc.createElement("html");
        doc.appendChild(htmlNode);
        var headNode = doc.createElement("head");
        htmlNode.appendChild(headNode);
        if (typeof title === "string") {
          var titleNode = doc.createElement("title");
          titleNode.appendChild(doc.createTextNode(title));
          headNode.appendChild(titleNode);
        }
        htmlNode.appendChild(doc.createElement("body"));
      }
      return doc;
    }
  };
  function Node(symbol) {
    checkSymbol(symbol);
  }
  Node.prototype = {
    /**
     * The first child of this node.
     *
     * @type {Node | null}
     */
    firstChild: null,
    /**
     * The last child of this node.
     *
     * @type {Node | null}
     */
    lastChild: null,
    /**
     * The previous sibling of this node.
     *
     * @type {Node | null}
     */
    previousSibling: null,
    /**
     * The next sibling of this node.
     *
     * @type {Node | null}
     */
    nextSibling: null,
    /**
     * The parent node of this node.
     *
     * @type {Node | null}
     */
    parentNode: null,
    /**
     * The parent element of this node.
     *
     * @type {Element | null}
     */
    get parentElement() {
      return this.parentNode && this.parentNode.nodeType === this.ELEMENT_NODE ? this.parentNode : null;
    },
    /**
     * The child nodes of this node.
     *
     * @type {NodeList}
     */
    childNodes: null,
    /**
     * The document object associated with this node.
     *
     * @type {Document | null}
     */
    ownerDocument: null,
    /**
     * The value of this node.
     *
     * @type {string | null}
     */
    nodeValue: null,
    /**
     * The namespace URI of this node.
     *
     * @type {string | null}
     */
    namespaceURI: null,
    /**
     * The prefix of the namespace for this node.
     *
     * @type {string | null}
     */
    prefix: null,
    /**
     * The local part of the qualified name of this node.
     *
     * @type {string | null}
     */
    localName: null,
    /**
     * The baseURI is currently always `about:blank`,
     * since that's what happens when you create a document from scratch.
     *
     * @type {'about:blank'}
     */
    baseURI: "about:blank",
    /**
     * Is true if this node is part of a document.
     *
     * @type {boolean}
     */
    get isConnected() {
      var rootNode = this.getRootNode();
      return rootNode && rootNode.nodeType === rootNode.DOCUMENT_NODE;
    },
    /**
     * Checks whether `other` is an inclusive descendant of this node.
     *
     * @param {Node | null | undefined} other
     * The node to check.
     * @returns {boolean}
     * True if `other` is an inclusive descendant of this node; false otherwise.
     * @see https://dom.spec.whatwg.org/#dom-node-contains
     */
    contains: function(other) {
      if (!other) return false;
      var parent = other;
      do {
        if (this === parent) return true;
        parent = parent.parentNode;
      } while (parent);
      return false;
    },
    /**
     * @typedef GetRootNodeOptions
     * @property {boolean} [composed=false]
     */
    /**
     * Searches for the root node of this node.
     *
     * **This behavior is slightly different from the in the specs**:
     * - ignores `options.composed`, since `ShadowRoot`s are unsupported, always returns root.
     *
     * @param {GetRootNodeOptions} [options]
     * @returns {Node}
     * Root node.
     * @see https://dom.spec.whatwg.org/#dom-node-getrootnode
     * @see https://dom.spec.whatwg.org/#concept-shadow-including-root
     */
    getRootNode: function(options) {
      var parent = this;
      do {
        if (!parent.parentNode) {
          return parent;
        }
        parent = parent.parentNode;
      } while (parent);
    },
    /**
     * Checks whether the given node is equal to this node.
     *
     * Two nodes are equal when they have the same type, defining characteristics (for the type),
     * and the same childNodes. The comparison is iterative to avoid stack overflows on
     * deeply-nested trees. Attribute nodes of each Element pair are also pushed onto the stack
     * and compared the same way.
     *
     * @param {Node} [otherNode]
     * @returns {boolean}
     * @see https://dom.spec.whatwg.org/#concept-node-equals
     * @see ../docs/walk-dom.md.
     */
    isEqualNode: function(otherNode) {
      if (!otherNode) return false;
      var stack = [{ node: this, other: otherNode }];
      while (stack.length > 0) {
        var pair = stack.pop();
        var node2 = pair.node;
        var other = pair.other;
        if (node2.nodeType !== other.nodeType) return false;
        switch (node2.nodeType) {
          case node2.DOCUMENT_TYPE_NODE:
            if (node2.name !== other.name) return false;
            if (node2.publicId !== other.publicId) return false;
            if (node2.systemId !== other.systemId) return false;
            break;
          case node2.ELEMENT_NODE:
            if (node2.namespaceURI !== other.namespaceURI) return false;
            if (node2.prefix !== other.prefix) return false;
            if (node2.localName !== other.localName) return false;
            if (node2.attributes.length !== other.attributes.length) return false;
            for (var i = 0; i < node2.attributes.length; i++) {
              var attr = node2.attributes.item(i);
              var otherAttr = other.getAttributeNodeNS(attr.namespaceURI, attr.localName);
              if (!otherAttr) return false;
              stack.push({ node: attr, other: otherAttr });
            }
            break;
          case node2.ATTRIBUTE_NODE:
            if (node2.namespaceURI !== other.namespaceURI) return false;
            if (node2.localName !== other.localName) return false;
            if (node2.value !== other.value) return false;
            break;
          case node2.PROCESSING_INSTRUCTION_NODE:
            if (node2.target !== other.target || node2.data !== other.data) return false;
            break;
          case node2.TEXT_NODE:
          case node2.CDATA_SECTION_NODE:
          case node2.COMMENT_NODE:
            if (node2.data !== other.data) return false;
            break;
        }
        if (node2.childNodes.length !== other.childNodes.length) return false;
        for (var i = node2.childNodes.length - 1; i >= 0; i--) {
          stack.push({ node: node2.childNodes[i], other: other.childNodes[i] });
        }
      }
      return true;
    },
    /**
     * Checks whether or not the given node is this node.
     *
     * @param {Node} [otherNode]
     */
    isSameNode: function(otherNode) {
      return this === otherNode;
    },
    /**
     * Inserts a node before a reference node as a child of this node.
     *
     * @param {Node} newChild
     * The new child node to be inserted.
     * @param {Node | null} refChild
     * The reference node before which newChild will be inserted.
     * @returns {Node}
     * The new child node successfully inserted.
     * @throws {DOMException}
     * Throws a DOMException if inserting the node would result in a DOM tree that is not
     * well-formed, or if `child` is provided but is not a child of `parent`.
     * See {@link _insertBefore} for more details.
     * @since Modified in DOM L2
     */
    insertBefore: function(newChild, refChild) {
      return _insertBefore(this, newChild, refChild);
    },
    /**
     * Replaces an old child node with a new child node within this node.
     *
     * @param {Node} newChild
     * The new node that is to replace the old node.
     * If it already exists in the DOM, it is removed from its original position.
     * @param {Node} oldChild
     * The existing child node to be replaced.
     * @returns {Node}
     * Returns the replaced child node.
     * @throws {DOMException}
     * Throws a DOMException if replacing the node would result in a DOM tree that is not
     * well-formed, or if `oldChild` is not a child of `this`.
     * This can also occur if the pre-replacement validity assertion fails.
     * See {@link _insertBefore}, {@link Node.removeChild}, and
     * {@link assertPreReplacementValidityInDocument} for more details.
     * @see https://dom.spec.whatwg.org/#concept-node-replace
     */
    replaceChild: function(newChild, oldChild) {
      _insertBefore(this, newChild, oldChild, assertPreReplacementValidityInDocument);
      if (oldChild) {
        this.removeChild(oldChild);
      }
    },
    /**
     * Removes an existing child node from this node.
     *
     * @param {Node} oldChild
     * The child node to be removed.
     * @returns {Node}
     * Returns the removed child node.
     * @throws {DOMException}
     * Throws a DOMException if `oldChild` is not a child of `this`.
     * See {@link _removeChild} for more details.
     */
    removeChild: function(oldChild) {
      return _removeChild(this, oldChild);
    },
    /**
     * Appends a child node to this node.
     *
     * @param {Node} newChild
     * The child node to be appended to this node.
     * If it already exists in the DOM, it is removed from its original position.
     * @returns {Node}
     * Returns the appended child node.
     * @throws {DOMException}
     * Throws a DOMException if appending the node would result in a DOM tree that is not
     * well-formed, or if `newChild` is not a valid Node.
     * See {@link insertBefore} for more details.
     */
    appendChild: function(newChild) {
      return this.insertBefore(newChild, null);
    },
    /**
     * Determines whether this node has any child nodes.
     *
     * @returns {boolean}
     * Returns true if this node has any child nodes, and false otherwise.
     */
    hasChildNodes: function() {
      return this.firstChild != null;
    },
    /**
     * Creates a copy of the calling node.
     *
     * @param {boolean} deep
     * If true, the contents of the node are recursively copied.
     * If false, only the node itself (and its attributes, if it is an element) are copied.
     * @returns {Node}
     * Returns the newly created copy of the node.
     * @throws {DOMException}
     * May throw a DOMException if operations within {@link Element#setAttributeNode} or
     * {@link Node#appendChild} (which are potentially invoked in this method) do not meet their
     * specific constraints.
     * @see {@link cloneNode}
     */
    cloneNode: function(deep) {
      return cloneNode2(this.ownerDocument || this, this, deep);
    },
    /**
     * Puts the specified node and all of its subtree into a "normalized" form. In a normalized
     * subtree, no text nodes in the subtree are empty and there are no adjacent text nodes.
     *
     * Specifically, this method merges any adjacent text nodes (i.e., nodes for which `nodeType`
     * is `TEXT_NODE`) into a single node with the combined data. It also removes any empty text
     * nodes.
     *
     * This method iterativly traverses all child nodes to normalize all descendent nodes within
     * the subtree.
     *
     * @throws {DOMException}
     * May throw a DOMException if operations within removeChild or appendData (which are
     * potentially invoked in this method) do not meet their specific constraints.
     * @since Modified in DOM Level 2
     * @see {@link Node.removeChild}
     * @see {@link CharacterData.appendData}
     * @see ../docs/walk-dom.md.
     */
    normalize: function() {
      walkDOM(this, null, {
        enter: function(node2) {
          var child = node2.firstChild;
          while (child) {
            var next = child.nextSibling;
            if (next !== null && next.nodeType === TEXT_NODE && child.nodeType === TEXT_NODE) {
              node2.removeChild(next);
              child.appendData(next.data);
            } else {
              child = next;
            }
          }
          return true;
        }
      });
    },
    /**
     * Checks whether the DOM implementation implements a specific feature and its version.
     *
     * @deprecated
     * Since `DOMImplementation.hasFeature` is deprecated and always returns true.
     * @param {string} feature
     * The package name of the feature to test. This is the same name that can be passed to the
     * method `hasFeature` on `DOMImplementation`.
     * @param {string} version
     * This is the version number of the package name to test.
     * @returns {boolean}
     * Returns true in all cases in the current implementation.
     * @since Introduced in DOM Level 2
     * @see {@link DOMImplementation.hasFeature}
     */
    isSupported: function(feature, version) {
      return this.ownerDocument.implementation.hasFeature(feature, version);
    },
    /**
     * Look up the prefix associated to the given namespace URI, starting from this node.
     * **The default namespace declarations are ignored by this method.**
     * See Namespace Prefix Lookup for details on the algorithm used by this method.
     *
     * **This behavior is different from the in the specs**:
     * - no node type specific handling
     * - uses the internal attribute _nsMap for resolving namespaces that is updated when changing attributes
     *
     * @param {string | null} namespaceURI
     * The namespace URI for which to find the associated prefix.
     * @returns {string | null}
     * The associated prefix, if found; otherwise, null.
     * @see https://www.w3.org/TR/DOM-Level-3-Core/core.html#Node3-lookupNamespacePrefix
     * @see https://www.w3.org/TR/DOM-Level-3-Core/namespaces-algorithms.html#lookupNamespacePrefixAlgo
     * @see https://dom.spec.whatwg.org/#dom-node-lookupprefix
     * @see https://github.com/xmldom/xmldom/issues/322
     * @prettierignore
     */
    lookupPrefix: function(namespaceURI) {
      var el = this;
      while (el) {
        var map = el._nsMap;
        if (map) {
          for (var n in map) {
            if (hasOwn(map, n) && map[n] === namespaceURI) {
              return n;
            }
          }
        }
        el = el.nodeType == ATTRIBUTE_NODE ? el.ownerDocument : el.parentNode;
      }
      return null;
    },
    /**
     * This function is used to look up the namespace URI associated with the given prefix,
     * starting from this node.
     *
     * **This behavior is different from the in the specs**:
     * - no node type specific handling
     * - uses the internal attribute _nsMap for resolving namespaces that is updated when changing attributes
     *
     * @param {string | null} prefix
     * The prefix for which to find the associated namespace URI.
     * @returns {string | null}
     * The associated namespace URI, if found; otherwise, null.
     * @since DOM Level 3
     * @see https://dom.spec.whatwg.org/#dom-node-lookupnamespaceuri
     * @see https://www.w3.org/TR/DOM-Level-3-Core/core.html#Node3-lookupNamespaceURI
     * @prettierignore
     */
    lookupNamespaceURI: function(prefix) {
      var el = this;
      while (el) {
        var map = el._nsMap;
        if (map) {
          if (hasOwn(map, prefix)) {
            return map[prefix];
          }
        }
        el = el.nodeType == ATTRIBUTE_NODE ? el.ownerDocument : el.parentNode;
      }
      return null;
    },
    /**
     * Determines whether the given namespace URI is the default namespace.
     *
     * The function works by looking up the prefix associated with the given namespace URI. If no
     * prefix is found (i.e., the namespace URI is not registered in the namespace map of this
     * node or any of its ancestors), it returns `true`, implying the namespace URI is considered
     * the default.
     *
     * **This behavior is different from the in the specs**:
     * - no node type specific handling
     * - uses the internal attribute _nsMap for resolving namespaces that is updated when changing attributes
     *
     * @param {string | null} namespaceURI
     * The namespace URI to be checked.
     * @returns {boolean}
     * Returns true if the given namespace URI is the default namespace, false otherwise.
     * @since DOM Level 3
     * @see https://www.w3.org/TR/DOM-Level-3-Core/core.html#Node3-isDefaultNamespace
     * @see https://dom.spec.whatwg.org/#dom-node-isdefaultnamespace
     * @prettierignore
     */
    isDefaultNamespace: function(namespaceURI) {
      var prefix = this.lookupPrefix(namespaceURI);
      return prefix == null;
    },
    /**
     * Compares the reference node with a node with regard to their position in the document and
     * according to the document order.
     *
     * @param {Node} other
     * The node to compare the reference node to.
     * @returns {number}
     * Returns how the node is positioned relatively to the reference node according to the
     * bitmask. 0 if reference node and given node are the same.
     * @since DOM Level 3
     * @see https://www.w3.org/TR/2004/REC-DOM-Level-3-Core-20040407/core.html#Node3-compare
     * @see https://dom.spec.whatwg.org/#dom-node-comparedocumentposition
     */
    compareDocumentPosition: function(other) {
      if (this === other) return 0;
      var node1 = other;
      var node2 = this;
      var attr1 = null;
      var attr2 = null;
      if (node1 instanceof Attr) {
        attr1 = node1;
        node1 = attr1.ownerElement;
      }
      if (node2 instanceof Attr) {
        attr2 = node2;
        node2 = attr2.ownerElement;
        if (attr1 && node1 && node2 === node1) {
          for (var i = 0, attr; attr = node2.attributes[i]; i++) {
            if (attr === attr1)
              return DocumentPosition.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC + DocumentPosition.DOCUMENT_POSITION_PRECEDING;
            if (attr === attr2)
              return DocumentPosition.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC + DocumentPosition.DOCUMENT_POSITION_FOLLOWING;
          }
        }
      }
      if (!node1 || !node2 || node2.ownerDocument !== node1.ownerDocument) {
        return DocumentPosition.DOCUMENT_POSITION_DISCONNECTED + DocumentPosition.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC + (docGUID(node2.ownerDocument) > docGUID(node1.ownerDocument) ? DocumentPosition.DOCUMENT_POSITION_FOLLOWING : DocumentPosition.DOCUMENT_POSITION_PRECEDING);
      }
      if (attr2 && node1 === node2) {
        return DocumentPosition.DOCUMENT_POSITION_CONTAINS + DocumentPosition.DOCUMENT_POSITION_PRECEDING;
      }
      if (attr1 && node1 === node2) {
        return DocumentPosition.DOCUMENT_POSITION_CONTAINED_BY + DocumentPosition.DOCUMENT_POSITION_FOLLOWING;
      }
      var chain1 = [];
      var ancestor1 = node1.parentNode;
      while (ancestor1) {
        if (!attr2 && ancestor1 === node2) {
          return DocumentPosition.DOCUMENT_POSITION_CONTAINED_BY + DocumentPosition.DOCUMENT_POSITION_FOLLOWING;
        }
        chain1.push(ancestor1);
        ancestor1 = ancestor1.parentNode;
      }
      chain1.reverse();
      var chain2 = [];
      var ancestor2 = node2.parentNode;
      while (ancestor2) {
        if (!attr1 && ancestor2 === node1) {
          return DocumentPosition.DOCUMENT_POSITION_CONTAINS + DocumentPosition.DOCUMENT_POSITION_PRECEDING;
        }
        chain2.push(ancestor2);
        ancestor2 = ancestor2.parentNode;
      }
      chain2.reverse();
      var ca = commonAncestor(chain1, chain2);
      for (var n in ca.childNodes) {
        var child = ca.childNodes[n];
        if (child === node2) return DocumentPosition.DOCUMENT_POSITION_FOLLOWING;
        if (child === node1) return DocumentPosition.DOCUMENT_POSITION_PRECEDING;
        if (chain2.indexOf(child) >= 0) return DocumentPosition.DOCUMENT_POSITION_FOLLOWING;
        if (chain1.indexOf(child) >= 0) return DocumentPosition.DOCUMENT_POSITION_PRECEDING;
      }
      return 0;
    }
  };
  function _xmlEncoder(c) {
    return c == "<" && "&lt;" || c == ">" && "&gt;" || c == "&" && "&amp;" || c == '"' && "&quot;" || "&#" + c.charCodeAt() + ";";
  }
  copy(NodeType, Node);
  copy(NodeType, Node.prototype);
  copy(DocumentPosition, Node);
  copy(DocumentPosition, Node.prototype);
  function _visitNode(node2, callback) {
    walkDOM(node2, null, {
      enter: function(n) {
        return callback(n) ? walkDOM.STOP : true;
      }
    });
  }
  function walkDOM(node2, context, callbacks) {
    var stack = [{ node: node2, context, phase: walkDOM.ENTER }];
    while (stack.length > 0) {
      var frame = stack.pop();
      if (frame.phase === walkDOM.ENTER) {
        var childContext = callbacks.enter(frame.node, frame.context);
        if (childContext === walkDOM.STOP) {
          return walkDOM.STOP;
        }
        stack.push({ node: frame.node, context: childContext, phase: walkDOM.EXIT });
        if (childContext === null || childContext === void 0) {
          continue;
        }
        var child = frame.node.lastChild;
        while (child) {
          stack.push({ node: child, context: childContext, phase: walkDOM.ENTER });
          child = child.previousSibling;
        }
      } else {
        if (callbacks.exit) {
          callbacks.exit(frame.node, frame.context);
        }
      }
    }
  }
  walkDOM.STOP = Symbol("walkDOM.STOP");
  walkDOM.ENTER = 0;
  walkDOM.EXIT = 1;
  function Document(symbol, options) {
    checkSymbol(symbol);
    var opt = options || {};
    this.ownerDocument = this;
    this.contentType = opt.contentType || MIME_TYPE.XML_APPLICATION;
    this.type = isHTMLMimeType(this.contentType) ? "html" : "xml";
  }
  function _onAddAttribute(doc, el, newAttr) {
    doc && doc._inc++;
    var ns = newAttr.namespaceURI;
    if (ns === NAMESPACE.XMLNS) {
      el._nsMap[newAttr.prefix ? newAttr.localName : ""] = newAttr.value;
    }
  }
  function _onRemoveAttribute(doc, el, newAttr, remove) {
    doc && doc._inc++;
    var ns = newAttr.namespaceURI;
    if (ns === NAMESPACE.XMLNS) {
      delete el._nsMap[newAttr.prefix ? newAttr.localName : ""];
    }
  }
  function _onUpdateChild(doc, parent, newChild) {
    if (doc && doc._inc) {
      doc._inc++;
      var childNodes = parent.childNodes;
      if (newChild && !newChild.nextSibling) {
        childNodes[childNodes.length++] = newChild;
      } else {
        var child = parent.firstChild;
        var i = 0;
        while (child) {
          childNodes[i++] = child;
          child = child.nextSibling;
        }
        childNodes.length = i;
        delete childNodes[childNodes.length];
      }
    }
  }
  function _removeChild(parentNode, child) {
    if (parentNode !== child.parentNode) {
      throw new DOMException(DOMException.NOT_FOUND_ERR, "child's parent is not parent");
    }
    var oldPreviousSibling = child.previousSibling;
    var oldNextSibling = child.nextSibling;
    if (oldPreviousSibling) {
      oldPreviousSibling.nextSibling = oldNextSibling;
    } else {
      parentNode.firstChild = oldNextSibling;
    }
    if (oldNextSibling) {
      oldNextSibling.previousSibling = oldPreviousSibling;
    } else {
      parentNode.lastChild = oldPreviousSibling;
    }
    _onUpdateChild(parentNode.ownerDocument, parentNode);
    child.parentNode = null;
    child.previousSibling = null;
    child.nextSibling = null;
    return child;
  }
  function hasValidParentNodeType(node2) {
    return node2 && (node2.nodeType === Node.DOCUMENT_NODE || node2.nodeType === Node.DOCUMENT_FRAGMENT_NODE || node2.nodeType === Node.ELEMENT_NODE);
  }
  function hasInsertableNodeType(node2) {
    return node2 && (node2.nodeType === Node.CDATA_SECTION_NODE || node2.nodeType === Node.COMMENT_NODE || node2.nodeType === Node.DOCUMENT_FRAGMENT_NODE || node2.nodeType === Node.DOCUMENT_TYPE_NODE || node2.nodeType === Node.ELEMENT_NODE || node2.nodeType === Node.PROCESSING_INSTRUCTION_NODE || node2.nodeType === Node.TEXT_NODE);
  }
  function isDocTypeNode(node2) {
    return node2 && node2.nodeType === Node.DOCUMENT_TYPE_NODE;
  }
  function isElementNode(node2) {
    return node2 && node2.nodeType === Node.ELEMENT_NODE;
  }
  function isTextNode2(node2) {
    return node2 && node2.nodeType === Node.TEXT_NODE;
  }
  function isElementInsertionPossible(doc, child) {
    var parentChildNodes = doc.childNodes || [];
    if (find2(parentChildNodes, isElementNode) || isDocTypeNode(child)) {
      return false;
    }
    var docTypeNode = find2(parentChildNodes, isDocTypeNode);
    return !(child && docTypeNode && parentChildNodes.indexOf(docTypeNode) > parentChildNodes.indexOf(child));
  }
  function isElementReplacementPossible(doc, child) {
    var parentChildNodes = doc.childNodes || [];
    function hasElementChildThatIsNotChild(node2) {
      return isElementNode(node2) && node2 !== child;
    }
    if (find2(parentChildNodes, hasElementChildThatIsNotChild)) {
      return false;
    }
    var docTypeNode = find2(parentChildNodes, isDocTypeNode);
    return !(child && docTypeNode && parentChildNodes.indexOf(docTypeNode) > parentChildNodes.indexOf(child));
  }
  function assertPreInsertionValidity1to5(parent, node2, child) {
    if (!hasValidParentNodeType(parent)) {
      throw new DOMException(DOMException.HIERARCHY_REQUEST_ERR, "Unexpected parent node type " + parent.nodeType);
    }
    if (child && child.parentNode !== parent) {
      throw new DOMException(DOMException.NOT_FOUND_ERR, "child not in parent");
    }
    if (
      // 4. If `node` is not a DocumentFragment, DocumentType, Element, or CharacterData node, then throw a "HierarchyRequestError" DOMException.
      !hasInsertableNodeType(node2) || // 5. If either `node` is a Text node and `parent` is a document,
      // the sax parser currently adds top level text nodes, this will be fixed in 0.9.0
      // || (node.nodeType === Node.TEXT_NODE && parent.nodeType === Node.DOCUMENT_NODE)
      // or `node` is a doctype and `parent` is not a document, then throw a "HierarchyRequestError" DOMException.
      isDocTypeNode(node2) && parent.nodeType !== Node.DOCUMENT_NODE
    ) {
      throw new DOMException(
        DOMException.HIERARCHY_REQUEST_ERR,
        "Unexpected node type " + node2.nodeType + " for parent node type " + parent.nodeType
      );
    }
  }
  function assertPreInsertionValidityInDocument(parent, node2, child) {
    var parentChildNodes = parent.childNodes || [];
    var nodeChildNodes = node2.childNodes || [];
    if (node2.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      var nodeChildElements = nodeChildNodes.filter(isElementNode);
      if (nodeChildElements.length > 1 || find2(nodeChildNodes, isTextNode2)) {
        throw new DOMException(DOMException.HIERARCHY_REQUEST_ERR, "More than one element or text in fragment");
      }
      if (nodeChildElements.length === 1 && !isElementInsertionPossible(parent, child)) {
        throw new DOMException(DOMException.HIERARCHY_REQUEST_ERR, "Element in fragment can not be inserted before doctype");
      }
    }
    if (isElementNode(node2)) {
      if (!isElementInsertionPossible(parent, child)) {
        throw new DOMException(DOMException.HIERARCHY_REQUEST_ERR, "Only one element can be added and only after doctype");
      }
    }
    if (isDocTypeNode(node2)) {
      if (find2(parentChildNodes, isDocTypeNode)) {
        throw new DOMException(DOMException.HIERARCHY_REQUEST_ERR, "Only one doctype is allowed");
      }
      var parentElementChild = find2(parentChildNodes, isElementNode);
      if (child && parentChildNodes.indexOf(parentElementChild) < parentChildNodes.indexOf(child)) {
        throw new DOMException(DOMException.HIERARCHY_REQUEST_ERR, "Doctype can only be inserted before an element");
      }
      if (!child && parentElementChild) {
        throw new DOMException(DOMException.HIERARCHY_REQUEST_ERR, "Doctype can not be appended since element is present");
      }
    }
  }
  function assertPreReplacementValidityInDocument(parent, node2, child) {
    var parentChildNodes = parent.childNodes || [];
    var nodeChildNodes = node2.childNodes || [];
    if (node2.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      var nodeChildElements = nodeChildNodes.filter(isElementNode);
      if (nodeChildElements.length > 1 || find2(nodeChildNodes, isTextNode2)) {
        throw new DOMException(DOMException.HIERARCHY_REQUEST_ERR, "More than one element or text in fragment");
      }
      if (nodeChildElements.length === 1 && !isElementReplacementPossible(parent, child)) {
        throw new DOMException(DOMException.HIERARCHY_REQUEST_ERR, "Element in fragment can not be inserted before doctype");
      }
    }
    if (isElementNode(node2)) {
      if (!isElementReplacementPossible(parent, child)) {
        throw new DOMException(DOMException.HIERARCHY_REQUEST_ERR, "Only one element can be added and only after doctype");
      }
    }
    if (isDocTypeNode(node2)) {
      let hasDoctypeChildThatIsNotChild = function(node3) {
        return isDocTypeNode(node3) && node3 !== child;
      };
      if (find2(parentChildNodes, hasDoctypeChildThatIsNotChild)) {
        throw new DOMException(DOMException.HIERARCHY_REQUEST_ERR, "Only one doctype is allowed");
      }
      var parentElementChild = find2(parentChildNodes, isElementNode);
      if (child && parentChildNodes.indexOf(parentElementChild) < parentChildNodes.indexOf(child)) {
        throw new DOMException(DOMException.HIERARCHY_REQUEST_ERR, "Doctype can only be inserted before an element");
      }
    }
  }
  function _insertBefore(parent, node2, child, _inDocumentAssertion) {
    assertPreInsertionValidity1to5(parent, node2, child);
    if (parent.nodeType === Node.DOCUMENT_NODE) {
      (_inDocumentAssertion || assertPreInsertionValidityInDocument)(parent, node2, child);
    }
    var cp = node2.parentNode;
    if (cp) {
      cp.removeChild(node2);
    }
    if (node2.nodeType === DOCUMENT_FRAGMENT_NODE) {
      var newFirst = node2.firstChild;
      if (newFirst == null) {
        return node2;
      }
      var newLast = node2.lastChild;
    } else {
      newFirst = newLast = node2;
    }
    var pre = child ? child.previousSibling : parent.lastChild;
    newFirst.previousSibling = pre;
    newLast.nextSibling = child;
    if (pre) {
      pre.nextSibling = newFirst;
    } else {
      parent.firstChild = newFirst;
    }
    if (child == null) {
      parent.lastChild = newLast;
    } else {
      child.previousSibling = newLast;
    }
    do {
      newFirst.parentNode = parent;
    } while (newFirst !== newLast && (newFirst = newFirst.nextSibling));
    _onUpdateChild(parent.ownerDocument || parent, parent, node2);
    if (node2.nodeType == DOCUMENT_FRAGMENT_NODE) {
      node2.firstChild = node2.lastChild = null;
    }
    return node2;
  }
  Document.prototype = {
    /**
     * The implementation that created this document.
     *
     * @type DOMImplementation
     * @readonly
     */
    implementation: null,
    nodeName: "#document",
    nodeType: DOCUMENT_NODE,
    /**
     * The DocumentType node of the document.
     *
     * @type DocumentType
     * @readonly
     */
    doctype: null,
    documentElement: null,
    _inc: 1,
    insertBefore: function(newChild, refChild) {
      if (newChild.nodeType === DOCUMENT_FRAGMENT_NODE) {
        var child = newChild.firstChild;
        while (child) {
          var next = child.nextSibling;
          this.insertBefore(child, refChild);
          child = next;
        }
        return newChild;
      }
      _insertBefore(this, newChild, refChild);
      newChild.ownerDocument = this;
      if (this.documentElement === null && newChild.nodeType === ELEMENT_NODE) {
        this.documentElement = newChild;
      }
      return newChild;
    },
    removeChild: function(oldChild) {
      var removed = _removeChild(this, oldChild);
      if (removed === this.documentElement) {
        this.documentElement = null;
      }
      return removed;
    },
    replaceChild: function(newChild, oldChild) {
      _insertBefore(this, newChild, oldChild, assertPreReplacementValidityInDocument);
      newChild.ownerDocument = this;
      if (oldChild) {
        this.removeChild(oldChild);
      }
      if (isElementNode(newChild)) {
        this.documentElement = newChild;
      }
    },
    /**
     * Imports a node from another document into this document, creating a new copy owned by this
     * document. The source node and its subtree are not modified.
     *
     * @param {Node} importedNode
     * The node to import.
     * @param {boolean} deep
     * If true, the contents of the node are recursively imported.
     * If false, only the node itself (and its attributes, if it is an element) are imported.
     * @returns {Node}
     * Returns the newly created import of the node.
     * @see {@link importNode}
     * @see {@link https://dom.spec.whatwg.org/#dom-document-importnode}
     */
    importNode: function(importedNode, deep) {
      return importNode(this, importedNode, deep);
    },
    // Introduced in DOM Level 2:
    getElementById: function(id) {
      var rtv = null;
      _visitNode(this.documentElement, function(node2) {
        if (node2.nodeType == ELEMENT_NODE) {
          if (node2.getAttribute("id") == id) {
            rtv = node2;
            return true;
          }
        }
      });
      return rtv;
    },
    /**
     * Creates a new `Element` that is owned by this `Document`.
     * In HTML Documents `localName` is the lower cased `tagName`,
     * otherwise no transformation is being applied.
     * When `contentType` implies the HTML namespace, it will be set as `namespaceURI`.
     *
     * __This implementation differs from the specification:__ - The provided name is not checked
     * against the `Name` production,
     * so no related error will be thrown.
     * - There is no interface `HTMLElement`, it is always an `Element`.
     * - There is no support for a second argument to indicate using custom elements.
     *
     * @param {string} tagName
     * @returns {Element}
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Document/createElement
     * @see https://dom.spec.whatwg.org/#dom-document-createelement
     * @see https://dom.spec.whatwg.org/#concept-create-element
     */
    createElement: function(tagName) {
      var node2 = new Element(PDC);
      node2.ownerDocument = this;
      if (this.type === "html") {
        tagName = tagName.toLowerCase();
      }
      if (hasDefaultHTMLNamespace(this.contentType)) {
        node2.namespaceURI = NAMESPACE.HTML;
      }
      node2.nodeName = tagName;
      node2.tagName = tagName;
      node2.localName = tagName;
      node2.childNodes = new NodeList();
      var attrs = node2.attributes = new NamedNodeMap();
      attrs._ownerElement = node2;
      return node2;
    },
    /**
     * @returns {DocumentFragment}
     */
    createDocumentFragment: function() {
      var node2 = new DocumentFragment(PDC);
      node2.ownerDocument = this;
      node2.childNodes = new NodeList();
      return node2;
    },
    /**
     * @param {string} data
     * @returns {Text}
     */
    createTextNode: function(data) {
      var node2 = new Text(PDC);
      node2.ownerDocument = this;
      node2.childNodes = new NodeList();
      node2.appendData(data);
      return node2;
    },
    /**
     * @param {string} data
     * @returns {Comment}
     * @see https://dom.spec.whatwg.org/#dom-document-createcomment
     * @see https://www.w3.org/TR/xml/#NT-Comment XML 1.0 production [15]
     * @see https://www.w3.org/TR/DOM-Parsing/#dfn-concept-serialize-xml §3.2.1.3
     *
     *      Note: no validation is performed at creation time. When the resulting document is
     *      serialized with `requireWellFormed: true`, the serializer throws `InvalidStateError`
     *      if the comment data contains `--` anywhere, ends with `-`, or contains characters
     *      outside the XML Char production (W3C DOM Parsing §3.2.1.3). Without that option the
     *      data is emitted verbatim.
     */
    createComment: function(data) {
      var node2 = new Comment2(PDC);
      node2.ownerDocument = this;
      node2.childNodes = new NodeList();
      node2.appendData(data);
      return node2;
    },
    /**
     * Returns a new CDATASection node whose data is `data`.
     *
     * __This implementation differs from the specification:__ - calling this method on an HTML
     * document does not throw `NotSupportedError`.
     *
     * @param {string} data
     * @returns {CDATASection}
     * @throws {DOMException}
     * With code `INVALID_CHARACTER_ERR` if `data` contains `"]]>"`.
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Document/createCDATASection
     * @see https://dom.spec.whatwg.org/#dom-document-createcdatasection
     */
    createCDATASection: function(data) {
      if (data.indexOf("]]>") !== -1) {
        throw new DOMException(DOMException.INVALID_CHARACTER_ERR, 'data contains "]]>"');
      }
      var node2 = new CDATASection(PDC);
      node2.ownerDocument = this;
      node2.childNodes = new NodeList();
      node2.appendData(data);
      return node2;
    },
    /**
     * Returns a ProcessingInstruction node whose target is target and data is data.
     *
     * __This behavior is slightly different from the in the specs__:
     * - it does not do any input validation on the arguments and doesn't throw
     * "InvalidCharacterError".
     *
     * Note: When the resulting document is serialized with `requireWellFormed: true`, the
     * serializer throws `InvalidStateError` if `.target` contains `:` or is an ASCII
     * case-insensitive match for `"xml"`, or if `.data` contains `?>` or characters outside the
     * XML Char production (W3C DOM Parsing §3.2.1.7). Without that option the data is emitted
     * verbatim.
     *
     * @param {string} target
     * @param {string} data
     * @returns {ProcessingInstruction}
     * @see https://developer.mozilla.org/docs/Web/API/Document/createProcessingInstruction
     * @see https://dom.spec.whatwg.org/#dom-document-createprocessinginstruction
     * @see https://www.w3.org/TR/DOM-Parsing/#dfn-concept-serialize-xml §3.2.1.7
     */
    createProcessingInstruction: function(target, data) {
      var node2 = new ProcessingInstruction(PDC);
      node2.ownerDocument = this;
      node2.childNodes = new NodeList();
      node2.nodeName = node2.target = target;
      node2.nodeValue = node2.data = data;
      return node2;
    },
    /**
     * Creates an `Attr` node that is owned by this document.
     * In HTML Documents `localName` is the lower cased `name`,
     * otherwise no transformation is being applied.
     *
     * __This implementation differs from the specification:__ - The provided name is not checked
     * against the `Name` production,
     * so no related error will be thrown.
     *
     * @param {string} name
     * @returns {Attr}
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Document/createAttribute
     * @see https://dom.spec.whatwg.org/#dom-document-createattribute
     */
    createAttribute: function(name2) {
      if (!g.QName_exact.test(name2)) {
        throw new DOMException(DOMException.INVALID_CHARACTER_ERR, 'invalid character in name "' + name2 + '"');
      }
      if (this.type === "html") {
        name2 = name2.toLowerCase();
      }
      return this._createAttribute(name2);
    },
    _createAttribute: function(name2) {
      var node2 = new Attr(PDC);
      node2.ownerDocument = this;
      node2.childNodes = new NodeList();
      node2.name = name2;
      node2.nodeName = name2;
      node2.localName = name2;
      node2.specified = true;
      return node2;
    },
    /**
     * Creates an EntityReference object.
     * The current implementation does not fill the `childNodes` with those of the corresponding
     * `Entity`
     *
     * @deprecated
     * In DOM Level 4.
     * @param {string} name
     * The name of the entity to reference. No namespace well-formedness checks are performed.
     * @returns {EntityReference}
     * @throws {DOMException}
     * With code `INVALID_CHARACTER_ERR` when `name` is not valid.
     * @throws {DOMException}
     * with code `NOT_SUPPORTED_ERR` when the document is of type `html`
     * @see https://www.w3.org/TR/DOM-Level-3-Core/core.html#ID-392B75AE
     */
    createEntityReference: function(name2) {
      if (!g.Name.test(name2)) {
        throw new DOMException(DOMException.INVALID_CHARACTER_ERR, 'not a valid xml name "' + name2 + '"');
      }
      if (this.type === "html") {
        throw new DOMException("document is an html document", DOMExceptionName.NotSupportedError);
      }
      var node2 = new EntityReference(PDC);
      node2.ownerDocument = this;
      node2.childNodes = new NodeList();
      node2.nodeName = name2;
      return node2;
    },
    // Introduced in DOM Level 2:
    /**
     * @param {string} namespaceURI
     * @param {string} qualifiedName
     * @returns {Element}
     */
    createElementNS: function(namespaceURI, qualifiedName) {
      var validated = validateAndExtract(namespaceURI, qualifiedName);
      var node2 = new Element(PDC);
      var attrs = node2.attributes = new NamedNodeMap();
      node2.childNodes = new NodeList();
      node2.ownerDocument = this;
      node2.nodeName = qualifiedName;
      node2.tagName = qualifiedName;
      node2.namespaceURI = validated[0];
      node2.prefix = validated[1];
      node2.localName = validated[2];
      attrs._ownerElement = node2;
      return node2;
    },
    // Introduced in DOM Level 2:
    /**
     * @param {string} namespaceURI
     * @param {string} qualifiedName
     * @returns {Attr}
     */
    createAttributeNS: function(namespaceURI, qualifiedName) {
      var validated = validateAndExtract(namespaceURI, qualifiedName);
      var node2 = new Attr(PDC);
      node2.ownerDocument = this;
      node2.childNodes = new NodeList();
      node2.nodeName = qualifiedName;
      node2.name = qualifiedName;
      node2.specified = true;
      node2.namespaceURI = validated[0];
      node2.prefix = validated[1];
      node2.localName = validated[2];
      return node2;
    }
  };
  _extends(Document, Node);
  function Element(symbol) {
    checkSymbol(symbol);
    this._nsMap = /* @__PURE__ */ Object.create(null);
  }
  Element.prototype = {
    nodeType: ELEMENT_NODE,
    /**
     * The attributes of this element.
     *
     * @type {NamedNodeMap | null}
     */
    attributes: null,
    getQualifiedName: function() {
      return this.prefix ? this.prefix + ":" + this.localName : this.localName;
    },
    _isInHTMLDocumentAndNamespace: function() {
      return this.ownerDocument.type === "html" && this.namespaceURI === NAMESPACE.HTML;
    },
    /**
     * Implementaton of Level2 Core function hasAttributes.
     *
     * @returns {boolean}
     * True if attribute list is not empty.
     * @see https://www.w3.org/TR/DOM-Level-2-Core/#core-ID-NodeHasAttrs
     */
    hasAttributes: function() {
      return !!(this.attributes && this.attributes.length);
    },
    hasAttribute: function(name2) {
      return !!this.getAttributeNode(name2);
    },
    /**
     * Returns element’s first attribute whose qualified name is `name`, and `null`
     * if there is no such attribute.
     *
     * @param {string} name
     * @returns {string | null}
     */
    getAttribute: function(name2) {
      var attr = this.getAttributeNode(name2);
      return attr ? attr.value : null;
    },
    getAttributeNode: function(name2) {
      if (this._isInHTMLDocumentAndNamespace()) {
        name2 = name2.toLowerCase();
      }
      return this.attributes.getNamedItem(name2);
    },
    /**
     * Sets the value of element’s first attribute whose qualified name is qualifiedName to value.
     *
     * @param {string} name
     * @param {string} value
     */
    setAttribute: function(name2, value2) {
      if (this._isInHTMLDocumentAndNamespace()) {
        name2 = name2.toLowerCase();
      }
      var attr = this.getAttributeNode(name2);
      if (attr) {
        attr.value = attr.nodeValue = "" + value2;
      } else {
        attr = this.ownerDocument._createAttribute(name2);
        attr.value = attr.nodeValue = "" + value2;
        this.setAttributeNode(attr);
      }
    },
    removeAttribute: function(name2) {
      var attr = this.getAttributeNode(name2);
      attr && this.removeAttributeNode(attr);
    },
    setAttributeNode: function(newAttr) {
      return this.attributes.setNamedItem(newAttr);
    },
    setAttributeNodeNS: function(newAttr) {
      return this.attributes.setNamedItemNS(newAttr);
    },
    removeAttributeNode: function(oldAttr) {
      return this.attributes.removeNamedItem(oldAttr.nodeName);
    },
    //get real attribute name,and remove it by removeAttributeNode
    removeAttributeNS: function(namespaceURI, localName) {
      var old = this.getAttributeNodeNS(namespaceURI, localName);
      old && this.removeAttributeNode(old);
    },
    hasAttributeNS: function(namespaceURI, localName) {
      return this.getAttributeNodeNS(namespaceURI, localName) != null;
    },
    /**
     * Returns element’s attribute whose namespace is `namespaceURI` and local name is
     * `localName`,
     * or `null` if there is no such attribute.
     *
     * @param {string} namespaceURI
     * @param {string} localName
     * @returns {string | null}
     */
    getAttributeNS: function(namespaceURI, localName) {
      var attr = this.getAttributeNodeNS(namespaceURI, localName);
      return attr ? attr.value : null;
    },
    /**
     * Sets the value of element’s attribute whose namespace is `namespaceURI` and local name is
     * `localName` to value.
     *
     * @param {string} namespaceURI
     * @param {string} qualifiedName
     * @param {string} value
     * @see https://dom.spec.whatwg.org/#dom-element-setattributens
     */
    setAttributeNS: function(namespaceURI, qualifiedName, value2) {
      var validated = validateAndExtract(namespaceURI, qualifiedName);
      var localName = validated[2];
      var attr = this.getAttributeNodeNS(namespaceURI, localName);
      if (attr) {
        attr.value = attr.nodeValue = "" + value2;
      } else {
        attr = this.ownerDocument.createAttributeNS(namespaceURI, qualifiedName);
        attr.value = attr.nodeValue = "" + value2;
        this.setAttributeNode(attr);
      }
    },
    getAttributeNodeNS: function(namespaceURI, localName) {
      return this.attributes.getNamedItemNS(namespaceURI, localName);
    },
    /**
     * Returns a LiveNodeList of all child elements which have **all** of the given class name(s).
     *
     * Returns an empty list if `classNames` is an empty string or only contains HTML white space
     * characters.
     *
     * Warning: This returns a live LiveNodeList.
     * Changes in the DOM will reflect in the array as the changes occur.
     * If an element selected by this array no longer qualifies for the selector,
     * it will automatically be removed. Be aware of this for iteration purposes.
     *
     * @param {string} classNames
     * Is a string representing the class name(s) to match; multiple class names are separated by
     * (ASCII-)whitespace.
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/getElementsByClassName
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Document/getElementsByClassName
     * @see https://dom.spec.whatwg.org/#concept-getelementsbyclassname
     */
    getElementsByClassName: function(classNames) {
      var classNamesSet = toOrderedSet(classNames);
      return new LiveNodeList(this, function(base) {
        var ls = [];
        if (classNamesSet.length > 0) {
          _visitNode(base, function(node2) {
            if (node2 !== base && node2.nodeType === ELEMENT_NODE) {
              var nodeClassNames = node2.getAttribute("class");
              if (nodeClassNames) {
                var matches = classNames === nodeClassNames;
                if (!matches) {
                  var nodeClassNamesSet = toOrderedSet(nodeClassNames);
                  matches = classNamesSet.every(arrayIncludes(nodeClassNamesSet));
                }
                if (matches) {
                  ls.push(node2);
                }
              }
            }
          });
        }
        return ls;
      });
    },
    /**
     * Returns a LiveNodeList of elements with the given qualifiedName.
     * Searching for all descendants can be done by passing `*` as `qualifiedName`.
     *
     * All descendants of the specified element are searched, but not the element itself.
     * The returned list is live, which means it updates itself with the DOM tree automatically.
     * Therefore, there is no need to call `Element.getElementsByTagName()`
     * with the same element and arguments repeatedly if the DOM changes in between calls.
     *
     * When called on an HTML element in an HTML document,
     * `getElementsByTagName` lower-cases the argument before searching for it.
     * This is undesirable when trying to match camel-cased SVG elements (such as
     * `<linearGradient>`) in an HTML document.
     * Instead, use `Element.getElementsByTagNameNS()`,
     * which preserves the capitalization of the tag name.
     *
     * `Element.getElementsByTagName` is similar to `Document.getElementsByTagName()`,
     * except that it only searches for elements that are descendants of the specified element.
     *
     * @param {string} qualifiedName
     * @returns {LiveNodeList}
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/getElementsByTagName
     * @see https://dom.spec.whatwg.org/#concept-getelementsbytagname
     */
    getElementsByTagName: function(qualifiedName) {
      var isHTMLDocument = (this.nodeType === DOCUMENT_NODE ? this : this.ownerDocument).type === "html";
      var lowerQualifiedName = qualifiedName.toLowerCase();
      return new LiveNodeList(this, function(base) {
        var ls = [];
        _visitNode(base, function(node2) {
          if (node2 === base || node2.nodeType !== ELEMENT_NODE) {
            return;
          }
          if (qualifiedName === "*") {
            ls.push(node2);
          } else {
            var nodeQualifiedName = node2.getQualifiedName();
            var matchingQName = isHTMLDocument && node2.namespaceURI === NAMESPACE.HTML ? lowerQualifiedName : qualifiedName;
            if (nodeQualifiedName === matchingQName) {
              ls.push(node2);
            }
          }
        });
        return ls;
      });
    },
    getElementsByTagNameNS: function(namespaceURI, localName) {
      return new LiveNodeList(this, function(base) {
        var ls = [];
        _visitNode(base, function(node2) {
          if (node2 !== base && node2.nodeType === ELEMENT_NODE && (namespaceURI === "*" || node2.namespaceURI === namespaceURI) && (localName === "*" || node2.localName == localName)) {
            ls.push(node2);
          }
        });
        return ls;
      });
    }
  };
  Document.prototype.getElementsByClassName = Element.prototype.getElementsByClassName;
  Document.prototype.getElementsByTagName = Element.prototype.getElementsByTagName;
  Document.prototype.getElementsByTagNameNS = Element.prototype.getElementsByTagNameNS;
  _extends(Element, Node);
  function Attr(symbol) {
    checkSymbol(symbol);
    this.namespaceURI = null;
    this.prefix = null;
    this.ownerElement = null;
  }
  Attr.prototype.nodeType = ATTRIBUTE_NODE;
  _extends(Attr, Node);
  function CharacterData(symbol) {
    checkSymbol(symbol);
  }
  CharacterData.prototype = {
    data: "",
    substringData: function(offset, count) {
      return this.data.substring(offset, offset + count);
    },
    appendData: function(text) {
      text = this.data + text;
      this.nodeValue = this.data = text;
      this.length = text.length;
    },
    insertData: function(offset, text) {
      this.replaceData(offset, 0, text);
    },
    deleteData: function(offset, count) {
      this.replaceData(offset, count, "");
    },
    replaceData: function(offset, count, text) {
      var start = this.data.substring(0, offset);
      var end = this.data.substring(offset + count);
      text = start + text + end;
      this.nodeValue = this.data = text;
      this.length = text.length;
    }
  };
  _extends(CharacterData, Node);
  function Text(symbol) {
    checkSymbol(symbol);
  }
  Text.prototype = {
    nodeName: "#text",
    nodeType: TEXT_NODE,
    splitText: function(offset) {
      var text = this.data;
      var newText = text.substring(offset);
      text = text.substring(0, offset);
      this.data = this.nodeValue = text;
      this.length = text.length;
      var newNode = this.ownerDocument.createTextNode(newText);
      if (this.parentNode) {
        this.parentNode.insertBefore(newNode, this.nextSibling);
      }
      return newNode;
    }
  };
  _extends(Text, CharacterData);
  function Comment2(symbol) {
    checkSymbol(symbol);
  }
  Comment2.prototype = {
    nodeName: "#comment",
    nodeType: COMMENT_NODE
  };
  _extends(Comment2, CharacterData);
  function CDATASection(symbol) {
    checkSymbol(symbol);
  }
  CDATASection.prototype = {
    nodeName: "#cdata-section",
    nodeType: CDATA_SECTION_NODE
  };
  _extends(CDATASection, Text);
  function DocumentType(symbol) {
    checkSymbol(symbol);
  }
  DocumentType.prototype.nodeType = DOCUMENT_TYPE_NODE;
  _extends(DocumentType, Node);
  function Notation(symbol) {
    checkSymbol(symbol);
  }
  Notation.prototype.nodeType = NOTATION_NODE;
  _extends(Notation, Node);
  function Entity(symbol) {
    checkSymbol(symbol);
  }
  Entity.prototype.nodeType = ENTITY_NODE;
  _extends(Entity, Node);
  function EntityReference(symbol) {
    checkSymbol(symbol);
  }
  EntityReference.prototype.nodeType = ENTITY_REFERENCE_NODE;
  _extends(EntityReference, Node);
  function DocumentFragment(symbol) {
    checkSymbol(symbol);
  }
  DocumentFragment.prototype.nodeName = "#document-fragment";
  DocumentFragment.prototype.nodeType = DOCUMENT_FRAGMENT_NODE;
  _extends(DocumentFragment, Node);
  function ProcessingInstruction(symbol) {
    checkSymbol(symbol);
  }
  ProcessingInstruction.prototype.nodeType = PROCESSING_INSTRUCTION_NODE;
  _extends(ProcessingInstruction, CharacterData);
  function XMLSerializer() {
  }
  XMLSerializer.prototype.serializeToString = function(node2, options) {
    return nodeSerializeToString.call(node2, options);
  };
  Node.prototype.toString = nodeSerializeToString;
  function nodeSerializeToString(options) {
    var opts;
    if (typeof options === "function") {
      opts = { requireWellFormed: false, splitCDATASections: true, nodeFilter: options };
    } else if (options != null) {
      opts = {
        requireWellFormed: !!options.requireWellFormed,
        splitCDATASections: options.splitCDATASections !== false,
        nodeFilter: options.nodeFilter || null
      };
    } else {
      opts = { requireWellFormed: false, splitCDATASections: true, nodeFilter: null };
    }
    var buf = [];
    var refNode = this.nodeType === DOCUMENT_NODE && this.documentElement || this;
    var prefix = refNode.prefix;
    var uri = refNode.namespaceURI;
    if (uri && prefix == null) {
      var prefix = refNode.lookupPrefix(uri);
      if (prefix == null) {
        var visibleNamespaces = [
          { namespace: uri, prefix: null }
          //{namespace:uri,prefix:''}
        ];
      }
    }
    serializeToString(this, buf, visibleNamespaces, opts);
    return buf.join("");
  }
  function needNamespaceDefine(node2, isHTML, visibleNamespaces) {
    var prefix = node2.prefix || "";
    var uri = node2.namespaceURI;
    if (!uri) {
      return false;
    }
    if (prefix === "xml" && uri === NAMESPACE.XML || uri === NAMESPACE.XMLNS) {
      return false;
    }
    var i = visibleNamespaces.length;
    while (i--) {
      var ns = visibleNamespaces[i];
      if (ns.prefix === prefix) {
        return ns.namespace !== uri;
      }
    }
    return true;
  }
  function addSerializedAttribute(buf, qualifiedName, value2) {
    buf.push(" ", qualifiedName, '="', value2.replace(/[<>&"\t\n\r]/g, _xmlEncoder), '"');
  }
  function serializeToString(node2, buf, visibleNamespaces, opts) {
    if (!visibleNamespaces) {
      visibleNamespaces = [];
    }
    var nodeFilter = opts.nodeFilter;
    var requireWellFormed = opts.requireWellFormed;
    var splitCDATASections = opts.splitCDATASections;
    var doc = node2.nodeType === DOCUMENT_NODE ? node2 : node2.ownerDocument;
    var isHTML = doc.type === "html";
    walkDOM(
      node2,
      { ns: visibleNamespaces },
      {
        enter: function(n, ctx) {
          var namespaces = ctx.ns;
          if (nodeFilter) {
            n = nodeFilter(n);
            if (n) {
              if (typeof n == "string") {
                buf.push(n);
                return null;
              }
            } else {
              return null;
            }
          }
          switch (n.nodeType) {
            case ELEMENT_NODE:
              var attrs = n.attributes;
              var len = attrs.length;
              var nodeName = n.tagName;
              var prefixedNodeName = nodeName;
              if (!isHTML && !n.prefix && n.namespaceURI) {
                var defaultNS;
                for (var ai = 0; ai < attrs.length; ai++) {
                  if (attrs.item(ai).name === "xmlns") {
                    defaultNS = attrs.item(ai).value;
                    break;
                  }
                }
                if (!defaultNS) {
                  for (var nsi = namespaces.length - 1; nsi >= 0; nsi--) {
                    var nsEntry = namespaces[nsi];
                    if (nsEntry.prefix === "" && nsEntry.namespace === n.namespaceURI) {
                      defaultNS = nsEntry.namespace;
                      break;
                    }
                  }
                }
                if (defaultNS !== n.namespaceURI) {
                  for (var nsi = namespaces.length - 1; nsi >= 0; nsi--) {
                    var nsEntry = namespaces[nsi];
                    if (nsEntry.namespace === n.namespaceURI) {
                      if (nsEntry.prefix) {
                        prefixedNodeName = nsEntry.prefix + ":" + nodeName;
                      }
                      break;
                    }
                  }
                }
              }
              buf.push("<", prefixedNodeName);
              var childNamespaces = namespaces.slice();
              for (var i = 0; i < len; i++) {
                var attr = attrs.item(i);
                if (attr.prefix == "xmlns") {
                  childNamespaces.push({
                    prefix: attr.localName,
                    namespace: attr.value
                  });
                } else if (attr.nodeName == "xmlns") {
                  childNamespaces.push({ prefix: "", namespace: attr.value });
                }
              }
              for (var i = 0; i < len; i++) {
                var attr = attrs.item(i);
                if (needNamespaceDefine(attr, isHTML, childNamespaces)) {
                  var attrPrefix = attr.prefix || "";
                  var uri = attr.namespaceURI;
                  addSerializedAttribute(buf, attrPrefix ? "xmlns:" + attrPrefix : "xmlns", uri);
                  childNamespaces.push({ prefix: attrPrefix, namespace: uri });
                }
                var filteredAttr = nodeFilter ? nodeFilter(attr) : attr;
                if (filteredAttr) {
                  if (typeof filteredAttr === "string") {
                    buf.push(filteredAttr);
                  } else {
                    addSerializedAttribute(buf, filteredAttr.name, filteredAttr.value);
                  }
                }
              }
              if (nodeName === prefixedNodeName && needNamespaceDefine(n, isHTML, childNamespaces)) {
                var nodePrefix = n.prefix || "";
                var uri = n.namespaceURI;
                addSerializedAttribute(buf, nodePrefix ? "xmlns:" + nodePrefix : "xmlns", uri);
                childNamespaces.push({ prefix: nodePrefix, namespace: uri });
              }
              var canCloseTag = !n.firstChild;
              if (canCloseTag && (isHTML || n.namespaceURI === NAMESPACE.HTML)) {
                canCloseTag = isHTMLVoidElement(nodeName);
              }
              if (canCloseTag) {
                buf.push("/>");
                return null;
              }
              buf.push(">");
              if (isHTML && isHTMLRawTextElement(nodeName)) {
                var child = n.firstChild;
                while (child) {
                  if (child.data) {
                    buf.push(child.data);
                  } else {
                    serializeToString(child, buf, childNamespaces.slice(), opts);
                  }
                  child = child.nextSibling;
                }
                buf.push("</", prefixedNodeName, ">");
                return null;
              }
              return { ns: childNamespaces, tag: prefixedNodeName };
            case DOCUMENT_NODE:
            case DOCUMENT_FRAGMENT_NODE:
              if (requireWellFormed && n.nodeType === DOCUMENT_NODE && n.documentElement == null) {
                throw new DOMException("The Document has no documentElement", DOMExceptionName.InvalidStateError);
              }
              return { ns: namespaces };
            case ATTRIBUTE_NODE:
              addSerializedAttribute(buf, n.name, n.value);
              return null;
            case TEXT_NODE:
              if (requireWellFormed && g.InvalidChar.test(n.data)) {
                throw new DOMException(
                  "The Text node data contains characters outside the XML Char production",
                  DOMExceptionName.InvalidStateError
                );
              }
              buf.push(n.data.replace(/[<&>]/g, _xmlEncoder));
              return null;
            case CDATA_SECTION_NODE:
              if (requireWellFormed && n.data.indexOf("]]>") !== -1) {
                throw new DOMException('The CDATASection data contains "]]>"', DOMExceptionName.InvalidStateError);
              }
              if (splitCDATASections) {
                buf.push(g.CDATA_START, n.data.replace(/]]>/g, "]]]]><![CDATA[>"), g.CDATA_END);
              } else {
                buf.push(g.CDATA_START, n.data, g.CDATA_END);
              }
              return null;
            case COMMENT_NODE:
              if (requireWellFormed) {
                if (g.InvalidChar.test(n.data)) {
                  throw new DOMException(
                    "The comment node data contains characters outside the XML Char production",
                    DOMExceptionName.InvalidStateError
                  );
                }
                if (n.data.indexOf("--") !== -1 || n.data[n.data.length - 1] === "-") {
                  throw new DOMException(
                    'The comment node data contains "--" or ends with "-"',
                    DOMExceptionName.InvalidStateError
                  );
                }
              }
              buf.push(g.COMMENT_START, n.data, g.COMMENT_END);
              return null;
            case DOCUMENT_TYPE_NODE:
              var pubid = n.publicId;
              var sysid = n.systemId;
              if (requireWellFormed) {
                if (pubid && !g.PubidLiteral_match.test(pubid)) {
                  throw new DOMException("DocumentType publicId is not a valid PubidLiteral", DOMExceptionName.InvalidStateError);
                }
                if (sysid && sysid !== "." && !g.SystemLiteral_match.test(sysid)) {
                  throw new DOMException("DocumentType systemId is not a valid SystemLiteral", DOMExceptionName.InvalidStateError);
                }
                if (n.internalSubset && n.internalSubset.indexOf("]>") !== -1) {
                  throw new DOMException('DocumentType internalSubset contains "]>"', DOMExceptionName.InvalidStateError);
                }
              }
              buf.push(g.DOCTYPE_DECL_START, " ", n.name);
              if (pubid) {
                buf.push(" ", g.PUBLIC, " ", pubid);
                if (sysid && sysid !== ".") {
                  buf.push(" ", sysid);
                }
              } else if (sysid && sysid !== ".") {
                buf.push(" ", g.SYSTEM, " ", sysid);
              }
              if (n.internalSubset) {
                buf.push(" [", n.internalSubset, "]");
              }
              buf.push(">");
              return null;
            case PROCESSING_INSTRUCTION_NODE:
              if (requireWellFormed) {
                if (n.target.indexOf(":") !== -1 || n.target.toLowerCase() === "xml") {
                  throw new DOMException("The ProcessingInstruction target is not well-formed", DOMExceptionName.InvalidStateError);
                }
                if (g.InvalidChar.test(n.data)) {
                  throw new DOMException(
                    "The ProcessingInstruction data contains characters outside the XML Char production",
                    DOMExceptionName.InvalidStateError
                  );
                }
                if (n.data.indexOf("?>") !== -1) {
                  throw new DOMException('The ProcessingInstruction data contains "?>"', DOMExceptionName.InvalidStateError);
                }
              }
              buf.push("<?", n.target, " ", n.data, "?>");
              return null;
            case ENTITY_REFERENCE_NODE:
              buf.push("&", n.nodeName, ";");
              return null;
            //case ENTITY_NODE:
            //case NOTATION_NODE:
            default:
              buf.push("??", n.nodeName);
              return null;
          }
        },
        exit: function(n, childCtx) {
          if (childCtx && childCtx.tag) {
            buf.push("</", childCtx.tag, ">");
          }
        }
      }
    );
  }
  function importNode(doc, node2, deep) {
    var destRoot;
    walkDOM(node2, null, {
      enter: function(srcNode, destParent) {
        var destNode = srcNode.cloneNode(false);
        destNode.ownerDocument = doc;
        destNode.parentNode = null;
        if (destParent === null) {
          destRoot = destNode;
        } else {
          destParent.appendChild(destNode);
        }
        var shouldDeep = srcNode.nodeType === ATTRIBUTE_NODE || deep;
        return shouldDeep ? destNode : null;
      }
    });
    return destRoot;
  }
  function cloneNode2(doc, node2, deep) {
    var destRoot;
    walkDOM(node2, null, {
      enter: function(srcNode, destParent) {
        var destNode = new srcNode.constructor(PDC);
        for (var n in srcNode) {
          if (hasOwn(srcNode, n)) {
            var v = srcNode[n];
            if (typeof v != "object") {
              if (v != destNode[n]) {
                destNode[n] = v;
              }
            }
          }
        }
        if (srcNode.childNodes) {
          destNode.childNodes = new NodeList();
        }
        destNode.ownerDocument = doc;
        var shouldDeep = deep;
        switch (destNode.nodeType) {
          case ELEMENT_NODE:
            var attrs = srcNode.attributes;
            var attrs2 = destNode.attributes = new NamedNodeMap();
            var len = attrs.length;
            attrs2._ownerElement = destNode;
            for (var i = 0; i < len; i++) {
              destNode.setAttributeNode(cloneNode2(doc, attrs.item(i), true));
            }
            break;
          case ATTRIBUTE_NODE:
            shouldDeep = true;
        }
        if (destParent !== null) {
          destParent.appendChild(destNode);
        } else {
          destRoot = destNode;
        }
        return shouldDeep ? destNode : null;
      }
    });
    return destRoot;
  }
  function __set__(object, key, value2) {
    object[key] = value2;
  }
  function childrenRefresh(node2) {
    var ls = [];
    var child = node2.firstChild;
    while (child) {
      if (child.nodeType === ELEMENT_NODE) {
        ls.push(child);
      }
      child = child.nextSibling;
    }
    return ls;
  }
  try {
    if (Object.defineProperty) {
      Object.defineProperty(LiveNodeList.prototype, "length", {
        get: function() {
          _updateLiveList(this);
          return this.$$length;
        }
      });
      Object.defineProperty(Node.prototype, "textContent", {
        get: function() {
          if (this.nodeType === ELEMENT_NODE || this.nodeType === DOCUMENT_FRAGMENT_NODE) {
            var buf = [];
            walkDOM(this, null, {
              enter: function(n) {
                if (n.nodeType === ELEMENT_NODE || n.nodeType === DOCUMENT_FRAGMENT_NODE) {
                  return true;
                }
                if (n.nodeType === PROCESSING_INSTRUCTION_NODE || n.nodeType === COMMENT_NODE) {
                  return null;
                }
                buf.push(n.nodeValue);
              }
            });
            return buf.join("");
          }
          return this.nodeValue;
        },
        set: function(data) {
          switch (this.nodeType) {
            case ELEMENT_NODE:
            case DOCUMENT_FRAGMENT_NODE:
              while (this.firstChild) {
                this.removeChild(this.firstChild);
              }
              if (data || String(data)) {
                this.appendChild(this.ownerDocument.createTextNode(data));
              }
              break;
            default:
              this.data = data;
              this.value = data;
              this.nodeValue = data;
          }
        }
      });
      Object.defineProperty(Element.prototype, "children", {
        get: function() {
          return new LiveNodeList(this, childrenRefresh);
        }
      });
      Object.defineProperty(Document.prototype, "children", {
        get: function() {
          return new LiveNodeList(this, childrenRefresh);
        }
      });
      Object.defineProperty(DocumentFragment.prototype, "children", {
        get: function() {
          return new LiveNodeList(this, childrenRefresh);
        }
      });
      __set__ = function(object, key, value2) {
        object["$$" + key] = value2;
      };
    }
  } catch (e) {
  }
  dom._updateLiveList = _updateLiveList;
  dom.Attr = Attr;
  dom.CDATASection = CDATASection;
  dom.CharacterData = CharacterData;
  dom.Comment = Comment2;
  dom.Document = Document;
  dom.DocumentFragment = DocumentFragment;
  dom.DocumentType = DocumentType;
  dom.DOMImplementation = DOMImplementation;
  dom.Element = Element;
  dom.Entity = Entity;
  dom.EntityReference = EntityReference;
  dom.LiveNodeList = LiveNodeList;
  dom.NamedNodeMap = NamedNodeMap;
  dom.Node = Node;
  dom.NodeList = NodeList;
  dom.Notation = Notation;
  dom.Text = Text;
  dom.ProcessingInstruction = ProcessingInstruction;
  dom.walkDOM = walkDOM;
  dom.XMLSerializer = XMLSerializer;
  return dom;
}
var domParser = {};
var entities = {};
var hasRequiredEntities;
function requireEntities() {
  if (hasRequiredEntities) return entities;
  hasRequiredEntities = 1;
  (function(exports) {
    var freeze = requireConventions().freeze;
    exports.XML_ENTITIES = freeze({
      amp: "&",
      apos: "'",
      gt: ">",
      lt: "<",
      quot: '"'
    });
    exports.HTML_ENTITIES = freeze({
      Aacute: "Á",
      aacute: "á",
      Abreve: "Ă",
      abreve: "ă",
      ac: "∾",
      acd: "∿",
      acE: "∾̳",
      Acirc: "Â",
      acirc: "â",
      acute: "´",
      Acy: "А",
      acy: "а",
      AElig: "Æ",
      aelig: "æ",
      af: "⁡",
      Afr: "𝔄",
      afr: "𝔞",
      Agrave: "À",
      agrave: "à",
      alefsym: "ℵ",
      aleph: "ℵ",
      Alpha: "Α",
      alpha: "α",
      Amacr: "Ā",
      amacr: "ā",
      amalg: "⨿",
      AMP: "&",
      amp: "&",
      And: "⩓",
      and: "∧",
      andand: "⩕",
      andd: "⩜",
      andslope: "⩘",
      andv: "⩚",
      ang: "∠",
      ange: "⦤",
      angle: "∠",
      angmsd: "∡",
      angmsdaa: "⦨",
      angmsdab: "⦩",
      angmsdac: "⦪",
      angmsdad: "⦫",
      angmsdae: "⦬",
      angmsdaf: "⦭",
      angmsdag: "⦮",
      angmsdah: "⦯",
      angrt: "∟",
      angrtvb: "⊾",
      angrtvbd: "⦝",
      angsph: "∢",
      angst: "Å",
      angzarr: "⍼",
      Aogon: "Ą",
      aogon: "ą",
      Aopf: "𝔸",
      aopf: "𝕒",
      ap: "≈",
      apacir: "⩯",
      apE: "⩰",
      ape: "≊",
      apid: "≋",
      apos: "'",
      ApplyFunction: "⁡",
      approx: "≈",
      approxeq: "≊",
      Aring: "Å",
      aring: "å",
      Ascr: "𝒜",
      ascr: "𝒶",
      Assign: "≔",
      ast: "*",
      asymp: "≈",
      asympeq: "≍",
      Atilde: "Ã",
      atilde: "ã",
      Auml: "Ä",
      auml: "ä",
      awconint: "∳",
      awint: "⨑",
      backcong: "≌",
      backepsilon: "϶",
      backprime: "‵",
      backsim: "∽",
      backsimeq: "⋍",
      Backslash: "∖",
      Barv: "⫧",
      barvee: "⊽",
      Barwed: "⌆",
      barwed: "⌅",
      barwedge: "⌅",
      bbrk: "⎵",
      bbrktbrk: "⎶",
      bcong: "≌",
      Bcy: "Б",
      bcy: "б",
      bdquo: "„",
      becaus: "∵",
      Because: "∵",
      because: "∵",
      bemptyv: "⦰",
      bepsi: "϶",
      bernou: "ℬ",
      Bernoullis: "ℬ",
      Beta: "Β",
      beta: "β",
      beth: "ℶ",
      between: "≬",
      Bfr: "𝔅",
      bfr: "𝔟",
      bigcap: "⋂",
      bigcirc: "◯",
      bigcup: "⋃",
      bigodot: "⨀",
      bigoplus: "⨁",
      bigotimes: "⨂",
      bigsqcup: "⨆",
      bigstar: "★",
      bigtriangledown: "▽",
      bigtriangleup: "△",
      biguplus: "⨄",
      bigvee: "⋁",
      bigwedge: "⋀",
      bkarow: "⤍",
      blacklozenge: "⧫",
      blacksquare: "▪",
      blacktriangle: "▴",
      blacktriangledown: "▾",
      blacktriangleleft: "◂",
      blacktriangleright: "▸",
      blank: "␣",
      blk12: "▒",
      blk14: "░",
      blk34: "▓",
      block: "█",
      bne: "=⃥",
      bnequiv: "≡⃥",
      bNot: "⫭",
      bnot: "⌐",
      Bopf: "𝔹",
      bopf: "𝕓",
      bot: "⊥",
      bottom: "⊥",
      bowtie: "⋈",
      boxbox: "⧉",
      boxDL: "╗",
      boxDl: "╖",
      boxdL: "╕",
      boxdl: "┐",
      boxDR: "╔",
      boxDr: "╓",
      boxdR: "╒",
      boxdr: "┌",
      boxH: "═",
      boxh: "─",
      boxHD: "╦",
      boxHd: "╤",
      boxhD: "╥",
      boxhd: "┬",
      boxHU: "╩",
      boxHu: "╧",
      boxhU: "╨",
      boxhu: "┴",
      boxminus: "⊟",
      boxplus: "⊞",
      boxtimes: "⊠",
      boxUL: "╝",
      boxUl: "╜",
      boxuL: "╛",
      boxul: "┘",
      boxUR: "╚",
      boxUr: "╙",
      boxuR: "╘",
      boxur: "└",
      boxV: "║",
      boxv: "│",
      boxVH: "╬",
      boxVh: "╫",
      boxvH: "╪",
      boxvh: "┼",
      boxVL: "╣",
      boxVl: "╢",
      boxvL: "╡",
      boxvl: "┤",
      boxVR: "╠",
      boxVr: "╟",
      boxvR: "╞",
      boxvr: "├",
      bprime: "‵",
      Breve: "˘",
      breve: "˘",
      brvbar: "¦",
      Bscr: "ℬ",
      bscr: "𝒷",
      bsemi: "⁏",
      bsim: "∽",
      bsime: "⋍",
      bsol: "\\",
      bsolb: "⧅",
      bsolhsub: "⟈",
      bull: "•",
      bullet: "•",
      bump: "≎",
      bumpE: "⪮",
      bumpe: "≏",
      Bumpeq: "≎",
      bumpeq: "≏",
      Cacute: "Ć",
      cacute: "ć",
      Cap: "⋒",
      cap: "∩",
      capand: "⩄",
      capbrcup: "⩉",
      capcap: "⩋",
      capcup: "⩇",
      capdot: "⩀",
      CapitalDifferentialD: "ⅅ",
      caps: "∩︀",
      caret: "⁁",
      caron: "ˇ",
      Cayleys: "ℭ",
      ccaps: "⩍",
      Ccaron: "Č",
      ccaron: "č",
      Ccedil: "Ç",
      ccedil: "ç",
      Ccirc: "Ĉ",
      ccirc: "ĉ",
      Cconint: "∰",
      ccups: "⩌",
      ccupssm: "⩐",
      Cdot: "Ċ",
      cdot: "ċ",
      cedil: "¸",
      Cedilla: "¸",
      cemptyv: "⦲",
      cent: "¢",
      CenterDot: "·",
      centerdot: "·",
      Cfr: "ℭ",
      cfr: "𝔠",
      CHcy: "Ч",
      chcy: "ч",
      check: "✓",
      checkmark: "✓",
      Chi: "Χ",
      chi: "χ",
      cir: "○",
      circ: "ˆ",
      circeq: "≗",
      circlearrowleft: "↺",
      circlearrowright: "↻",
      circledast: "⊛",
      circledcirc: "⊚",
      circleddash: "⊝",
      CircleDot: "⊙",
      circledR: "®",
      circledS: "Ⓢ",
      CircleMinus: "⊖",
      CirclePlus: "⊕",
      CircleTimes: "⊗",
      cirE: "⧃",
      cire: "≗",
      cirfnint: "⨐",
      cirmid: "⫯",
      cirscir: "⧂",
      ClockwiseContourIntegral: "∲",
      CloseCurlyDoubleQuote: "”",
      CloseCurlyQuote: "’",
      clubs: "♣",
      clubsuit: "♣",
      Colon: "∷",
      colon: ":",
      Colone: "⩴",
      colone: "≔",
      coloneq: "≔",
      comma: ",",
      commat: "@",
      comp: "∁",
      compfn: "∘",
      complement: "∁",
      complexes: "ℂ",
      cong: "≅",
      congdot: "⩭",
      Congruent: "≡",
      Conint: "∯",
      conint: "∮",
      ContourIntegral: "∮",
      Copf: "ℂ",
      copf: "𝕔",
      coprod: "∐",
      Coproduct: "∐",
      COPY: "©",
      copy: "©",
      copysr: "℗",
      CounterClockwiseContourIntegral: "∳",
      crarr: "↵",
      Cross: "⨯",
      cross: "✗",
      Cscr: "𝒞",
      cscr: "𝒸",
      csub: "⫏",
      csube: "⫑",
      csup: "⫐",
      csupe: "⫒",
      ctdot: "⋯",
      cudarrl: "⤸",
      cudarrr: "⤵",
      cuepr: "⋞",
      cuesc: "⋟",
      cularr: "↶",
      cularrp: "⤽",
      Cup: "⋓",
      cup: "∪",
      cupbrcap: "⩈",
      CupCap: "≍",
      cupcap: "⩆",
      cupcup: "⩊",
      cupdot: "⊍",
      cupor: "⩅",
      cups: "∪︀",
      curarr: "↷",
      curarrm: "⤼",
      curlyeqprec: "⋞",
      curlyeqsucc: "⋟",
      curlyvee: "⋎",
      curlywedge: "⋏",
      curren: "¤",
      curvearrowleft: "↶",
      curvearrowright: "↷",
      cuvee: "⋎",
      cuwed: "⋏",
      cwconint: "∲",
      cwint: "∱",
      cylcty: "⌭",
      Dagger: "‡",
      dagger: "†",
      daleth: "ℸ",
      Darr: "↡",
      dArr: "⇓",
      darr: "↓",
      dash: "‐",
      Dashv: "⫤",
      dashv: "⊣",
      dbkarow: "⤏",
      dblac: "˝",
      Dcaron: "Ď",
      dcaron: "ď",
      Dcy: "Д",
      dcy: "д",
      DD: "ⅅ",
      dd: "ⅆ",
      ddagger: "‡",
      ddarr: "⇊",
      DDotrahd: "⤑",
      ddotseq: "⩷",
      deg: "°",
      Del: "∇",
      Delta: "Δ",
      delta: "δ",
      demptyv: "⦱",
      dfisht: "⥿",
      Dfr: "𝔇",
      dfr: "𝔡",
      dHar: "⥥",
      dharl: "⇃",
      dharr: "⇂",
      DiacriticalAcute: "´",
      DiacriticalDot: "˙",
      DiacriticalDoubleAcute: "˝",
      DiacriticalGrave: "`",
      DiacriticalTilde: "˜",
      diam: "⋄",
      Diamond: "⋄",
      diamond: "⋄",
      diamondsuit: "♦",
      diams: "♦",
      die: "¨",
      DifferentialD: "ⅆ",
      digamma: "ϝ",
      disin: "⋲",
      div: "÷",
      divide: "÷",
      divideontimes: "⋇",
      divonx: "⋇",
      DJcy: "Ђ",
      djcy: "ђ",
      dlcorn: "⌞",
      dlcrop: "⌍",
      dollar: "$",
      Dopf: "𝔻",
      dopf: "𝕕",
      Dot: "¨",
      dot: "˙",
      DotDot: "⃜",
      doteq: "≐",
      doteqdot: "≑",
      DotEqual: "≐",
      dotminus: "∸",
      dotplus: "∔",
      dotsquare: "⊡",
      doublebarwedge: "⌆",
      DoubleContourIntegral: "∯",
      DoubleDot: "¨",
      DoubleDownArrow: "⇓",
      DoubleLeftArrow: "⇐",
      DoubleLeftRightArrow: "⇔",
      DoubleLeftTee: "⫤",
      DoubleLongLeftArrow: "⟸",
      DoubleLongLeftRightArrow: "⟺",
      DoubleLongRightArrow: "⟹",
      DoubleRightArrow: "⇒",
      DoubleRightTee: "⊨",
      DoubleUpArrow: "⇑",
      DoubleUpDownArrow: "⇕",
      DoubleVerticalBar: "∥",
      DownArrow: "↓",
      Downarrow: "⇓",
      downarrow: "↓",
      DownArrowBar: "⤓",
      DownArrowUpArrow: "⇵",
      DownBreve: "̑",
      downdownarrows: "⇊",
      downharpoonleft: "⇃",
      downharpoonright: "⇂",
      DownLeftRightVector: "⥐",
      DownLeftTeeVector: "⥞",
      DownLeftVector: "↽",
      DownLeftVectorBar: "⥖",
      DownRightTeeVector: "⥟",
      DownRightVector: "⇁",
      DownRightVectorBar: "⥗",
      DownTee: "⊤",
      DownTeeArrow: "↧",
      drbkarow: "⤐",
      drcorn: "⌟",
      drcrop: "⌌",
      Dscr: "𝒟",
      dscr: "𝒹",
      DScy: "Ѕ",
      dscy: "ѕ",
      dsol: "⧶",
      Dstrok: "Đ",
      dstrok: "đ",
      dtdot: "⋱",
      dtri: "▿",
      dtrif: "▾",
      duarr: "⇵",
      duhar: "⥯",
      dwangle: "⦦",
      DZcy: "Џ",
      dzcy: "џ",
      dzigrarr: "⟿",
      Eacute: "É",
      eacute: "é",
      easter: "⩮",
      Ecaron: "Ě",
      ecaron: "ě",
      ecir: "≖",
      Ecirc: "Ê",
      ecirc: "ê",
      ecolon: "≕",
      Ecy: "Э",
      ecy: "э",
      eDDot: "⩷",
      Edot: "Ė",
      eDot: "≑",
      edot: "ė",
      ee: "ⅇ",
      efDot: "≒",
      Efr: "𝔈",
      efr: "𝔢",
      eg: "⪚",
      Egrave: "È",
      egrave: "è",
      egs: "⪖",
      egsdot: "⪘",
      el: "⪙",
      Element: "∈",
      elinters: "⏧",
      ell: "ℓ",
      els: "⪕",
      elsdot: "⪗",
      Emacr: "Ē",
      emacr: "ē",
      empty: "∅",
      emptyset: "∅",
      EmptySmallSquare: "◻",
      emptyv: "∅",
      EmptyVerySmallSquare: "▫",
      emsp: " ",
      emsp13: " ",
      emsp14: " ",
      ENG: "Ŋ",
      eng: "ŋ",
      ensp: " ",
      Eogon: "Ę",
      eogon: "ę",
      Eopf: "𝔼",
      eopf: "𝕖",
      epar: "⋕",
      eparsl: "⧣",
      eplus: "⩱",
      epsi: "ε",
      Epsilon: "Ε",
      epsilon: "ε",
      epsiv: "ϵ",
      eqcirc: "≖",
      eqcolon: "≕",
      eqsim: "≂",
      eqslantgtr: "⪖",
      eqslantless: "⪕",
      Equal: "⩵",
      equals: "=",
      EqualTilde: "≂",
      equest: "≟",
      Equilibrium: "⇌",
      equiv: "≡",
      equivDD: "⩸",
      eqvparsl: "⧥",
      erarr: "⥱",
      erDot: "≓",
      Escr: "ℰ",
      escr: "ℯ",
      esdot: "≐",
      Esim: "⩳",
      esim: "≂",
      Eta: "Η",
      eta: "η",
      ETH: "Ð",
      eth: "ð",
      Euml: "Ë",
      euml: "ë",
      euro: "€",
      excl: "!",
      exist: "∃",
      Exists: "∃",
      expectation: "ℰ",
      ExponentialE: "ⅇ",
      exponentiale: "ⅇ",
      fallingdotseq: "≒",
      Fcy: "Ф",
      fcy: "ф",
      female: "♀",
      ffilig: "ﬃ",
      fflig: "ﬀ",
      ffllig: "ﬄ",
      Ffr: "𝔉",
      ffr: "𝔣",
      filig: "ﬁ",
      FilledSmallSquare: "◼",
      FilledVerySmallSquare: "▪",
      fjlig: "fj",
      flat: "♭",
      fllig: "ﬂ",
      fltns: "▱",
      fnof: "ƒ",
      Fopf: "𝔽",
      fopf: "𝕗",
      ForAll: "∀",
      forall: "∀",
      fork: "⋔",
      forkv: "⫙",
      Fouriertrf: "ℱ",
      fpartint: "⨍",
      frac12: "½",
      frac13: "⅓",
      frac14: "¼",
      frac15: "⅕",
      frac16: "⅙",
      frac18: "⅛",
      frac23: "⅔",
      frac25: "⅖",
      frac34: "¾",
      frac35: "⅗",
      frac38: "⅜",
      frac45: "⅘",
      frac56: "⅚",
      frac58: "⅝",
      frac78: "⅞",
      frasl: "⁄",
      frown: "⌢",
      Fscr: "ℱ",
      fscr: "𝒻",
      gacute: "ǵ",
      Gamma: "Γ",
      gamma: "γ",
      Gammad: "Ϝ",
      gammad: "ϝ",
      gap: "⪆",
      Gbreve: "Ğ",
      gbreve: "ğ",
      Gcedil: "Ģ",
      Gcirc: "Ĝ",
      gcirc: "ĝ",
      Gcy: "Г",
      gcy: "г",
      Gdot: "Ġ",
      gdot: "ġ",
      gE: "≧",
      ge: "≥",
      gEl: "⪌",
      gel: "⋛",
      geq: "≥",
      geqq: "≧",
      geqslant: "⩾",
      ges: "⩾",
      gescc: "⪩",
      gesdot: "⪀",
      gesdoto: "⪂",
      gesdotol: "⪄",
      gesl: "⋛︀",
      gesles: "⪔",
      Gfr: "𝔊",
      gfr: "𝔤",
      Gg: "⋙",
      gg: "≫",
      ggg: "⋙",
      gimel: "ℷ",
      GJcy: "Ѓ",
      gjcy: "ѓ",
      gl: "≷",
      gla: "⪥",
      glE: "⪒",
      glj: "⪤",
      gnap: "⪊",
      gnapprox: "⪊",
      gnE: "≩",
      gne: "⪈",
      gneq: "⪈",
      gneqq: "≩",
      gnsim: "⋧",
      Gopf: "𝔾",
      gopf: "𝕘",
      grave: "`",
      GreaterEqual: "≥",
      GreaterEqualLess: "⋛",
      GreaterFullEqual: "≧",
      GreaterGreater: "⪢",
      GreaterLess: "≷",
      GreaterSlantEqual: "⩾",
      GreaterTilde: "≳",
      Gscr: "𝒢",
      gscr: "ℊ",
      gsim: "≳",
      gsime: "⪎",
      gsiml: "⪐",
      Gt: "≫",
      GT: ">",
      gt: ">",
      gtcc: "⪧",
      gtcir: "⩺",
      gtdot: "⋗",
      gtlPar: "⦕",
      gtquest: "⩼",
      gtrapprox: "⪆",
      gtrarr: "⥸",
      gtrdot: "⋗",
      gtreqless: "⋛",
      gtreqqless: "⪌",
      gtrless: "≷",
      gtrsim: "≳",
      gvertneqq: "≩︀",
      gvnE: "≩︀",
      Hacek: "ˇ",
      hairsp: " ",
      half: "½",
      hamilt: "ℋ",
      HARDcy: "Ъ",
      hardcy: "ъ",
      hArr: "⇔",
      harr: "↔",
      harrcir: "⥈",
      harrw: "↭",
      Hat: "^",
      hbar: "ℏ",
      Hcirc: "Ĥ",
      hcirc: "ĥ",
      hearts: "♥",
      heartsuit: "♥",
      hellip: "…",
      hercon: "⊹",
      Hfr: "ℌ",
      hfr: "𝔥",
      HilbertSpace: "ℋ",
      hksearow: "⤥",
      hkswarow: "⤦",
      hoarr: "⇿",
      homtht: "∻",
      hookleftarrow: "↩",
      hookrightarrow: "↪",
      Hopf: "ℍ",
      hopf: "𝕙",
      horbar: "―",
      HorizontalLine: "─",
      Hscr: "ℋ",
      hscr: "𝒽",
      hslash: "ℏ",
      Hstrok: "Ħ",
      hstrok: "ħ",
      HumpDownHump: "≎",
      HumpEqual: "≏",
      hybull: "⁃",
      hyphen: "‐",
      Iacute: "Í",
      iacute: "í",
      ic: "⁣",
      Icirc: "Î",
      icirc: "î",
      Icy: "И",
      icy: "и",
      Idot: "İ",
      IEcy: "Е",
      iecy: "е",
      iexcl: "¡",
      iff: "⇔",
      Ifr: "ℑ",
      ifr: "𝔦",
      Igrave: "Ì",
      igrave: "ì",
      ii: "ⅈ",
      iiiint: "⨌",
      iiint: "∭",
      iinfin: "⧜",
      iiota: "℩",
      IJlig: "Ĳ",
      ijlig: "ĳ",
      Im: "ℑ",
      Imacr: "Ī",
      imacr: "ī",
      image: "ℑ",
      ImaginaryI: "ⅈ",
      imagline: "ℐ",
      imagpart: "ℑ",
      imath: "ı",
      imof: "⊷",
      imped: "Ƶ",
      Implies: "⇒",
      in: "∈",
      incare: "℅",
      infin: "∞",
      infintie: "⧝",
      inodot: "ı",
      Int: "∬",
      int: "∫",
      intcal: "⊺",
      integers: "ℤ",
      Integral: "∫",
      intercal: "⊺",
      Intersection: "⋂",
      intlarhk: "⨗",
      intprod: "⨼",
      InvisibleComma: "⁣",
      InvisibleTimes: "⁢",
      IOcy: "Ё",
      iocy: "ё",
      Iogon: "Į",
      iogon: "į",
      Iopf: "𝕀",
      iopf: "𝕚",
      Iota: "Ι",
      iota: "ι",
      iprod: "⨼",
      iquest: "¿",
      Iscr: "ℐ",
      iscr: "𝒾",
      isin: "∈",
      isindot: "⋵",
      isinE: "⋹",
      isins: "⋴",
      isinsv: "⋳",
      isinv: "∈",
      it: "⁢",
      Itilde: "Ĩ",
      itilde: "ĩ",
      Iukcy: "І",
      iukcy: "і",
      Iuml: "Ï",
      iuml: "ï",
      Jcirc: "Ĵ",
      jcirc: "ĵ",
      Jcy: "Й",
      jcy: "й",
      Jfr: "𝔍",
      jfr: "𝔧",
      jmath: "ȷ",
      Jopf: "𝕁",
      jopf: "𝕛",
      Jscr: "𝒥",
      jscr: "𝒿",
      Jsercy: "Ј",
      jsercy: "ј",
      Jukcy: "Є",
      jukcy: "є",
      Kappa: "Κ",
      kappa: "κ",
      kappav: "ϰ",
      Kcedil: "Ķ",
      kcedil: "ķ",
      Kcy: "К",
      kcy: "к",
      Kfr: "𝔎",
      kfr: "𝔨",
      kgreen: "ĸ",
      KHcy: "Х",
      khcy: "х",
      KJcy: "Ќ",
      kjcy: "ќ",
      Kopf: "𝕂",
      kopf: "𝕜",
      Kscr: "𝒦",
      kscr: "𝓀",
      lAarr: "⇚",
      Lacute: "Ĺ",
      lacute: "ĺ",
      laemptyv: "⦴",
      lagran: "ℒ",
      Lambda: "Λ",
      lambda: "λ",
      Lang: "⟪",
      lang: "⟨",
      langd: "⦑",
      langle: "⟨",
      lap: "⪅",
      Laplacetrf: "ℒ",
      laquo: "«",
      Larr: "↞",
      lArr: "⇐",
      larr: "←",
      larrb: "⇤",
      larrbfs: "⤟",
      larrfs: "⤝",
      larrhk: "↩",
      larrlp: "↫",
      larrpl: "⤹",
      larrsim: "⥳",
      larrtl: "↢",
      lat: "⪫",
      lAtail: "⤛",
      latail: "⤙",
      late: "⪭",
      lates: "⪭︀",
      lBarr: "⤎",
      lbarr: "⤌",
      lbbrk: "❲",
      lbrace: "{",
      lbrack: "[",
      lbrke: "⦋",
      lbrksld: "⦏",
      lbrkslu: "⦍",
      Lcaron: "Ľ",
      lcaron: "ľ",
      Lcedil: "Ļ",
      lcedil: "ļ",
      lceil: "⌈",
      lcub: "{",
      Lcy: "Л",
      lcy: "л",
      ldca: "⤶",
      ldquo: "“",
      ldquor: "„",
      ldrdhar: "⥧",
      ldrushar: "⥋",
      ldsh: "↲",
      lE: "≦",
      le: "≤",
      LeftAngleBracket: "⟨",
      LeftArrow: "←",
      Leftarrow: "⇐",
      leftarrow: "←",
      LeftArrowBar: "⇤",
      LeftArrowRightArrow: "⇆",
      leftarrowtail: "↢",
      LeftCeiling: "⌈",
      LeftDoubleBracket: "⟦",
      LeftDownTeeVector: "⥡",
      LeftDownVector: "⇃",
      LeftDownVectorBar: "⥙",
      LeftFloor: "⌊",
      leftharpoondown: "↽",
      leftharpoonup: "↼",
      leftleftarrows: "⇇",
      LeftRightArrow: "↔",
      Leftrightarrow: "⇔",
      leftrightarrow: "↔",
      leftrightarrows: "⇆",
      leftrightharpoons: "⇋",
      leftrightsquigarrow: "↭",
      LeftRightVector: "⥎",
      LeftTee: "⊣",
      LeftTeeArrow: "↤",
      LeftTeeVector: "⥚",
      leftthreetimes: "⋋",
      LeftTriangle: "⊲",
      LeftTriangleBar: "⧏",
      LeftTriangleEqual: "⊴",
      LeftUpDownVector: "⥑",
      LeftUpTeeVector: "⥠",
      LeftUpVector: "↿",
      LeftUpVectorBar: "⥘",
      LeftVector: "↼",
      LeftVectorBar: "⥒",
      lEg: "⪋",
      leg: "⋚",
      leq: "≤",
      leqq: "≦",
      leqslant: "⩽",
      les: "⩽",
      lescc: "⪨",
      lesdot: "⩿",
      lesdoto: "⪁",
      lesdotor: "⪃",
      lesg: "⋚︀",
      lesges: "⪓",
      lessapprox: "⪅",
      lessdot: "⋖",
      lesseqgtr: "⋚",
      lesseqqgtr: "⪋",
      LessEqualGreater: "⋚",
      LessFullEqual: "≦",
      LessGreater: "≶",
      lessgtr: "≶",
      LessLess: "⪡",
      lesssim: "≲",
      LessSlantEqual: "⩽",
      LessTilde: "≲",
      lfisht: "⥼",
      lfloor: "⌊",
      Lfr: "𝔏",
      lfr: "𝔩",
      lg: "≶",
      lgE: "⪑",
      lHar: "⥢",
      lhard: "↽",
      lharu: "↼",
      lharul: "⥪",
      lhblk: "▄",
      LJcy: "Љ",
      ljcy: "љ",
      Ll: "⋘",
      ll: "≪",
      llarr: "⇇",
      llcorner: "⌞",
      Lleftarrow: "⇚",
      llhard: "⥫",
      lltri: "◺",
      Lmidot: "Ŀ",
      lmidot: "ŀ",
      lmoust: "⎰",
      lmoustache: "⎰",
      lnap: "⪉",
      lnapprox: "⪉",
      lnE: "≨",
      lne: "⪇",
      lneq: "⪇",
      lneqq: "≨",
      lnsim: "⋦",
      loang: "⟬",
      loarr: "⇽",
      lobrk: "⟦",
      LongLeftArrow: "⟵",
      Longleftarrow: "⟸",
      longleftarrow: "⟵",
      LongLeftRightArrow: "⟷",
      Longleftrightarrow: "⟺",
      longleftrightarrow: "⟷",
      longmapsto: "⟼",
      LongRightArrow: "⟶",
      Longrightarrow: "⟹",
      longrightarrow: "⟶",
      looparrowleft: "↫",
      looparrowright: "↬",
      lopar: "⦅",
      Lopf: "𝕃",
      lopf: "𝕝",
      loplus: "⨭",
      lotimes: "⨴",
      lowast: "∗",
      lowbar: "_",
      LowerLeftArrow: "↙",
      LowerRightArrow: "↘",
      loz: "◊",
      lozenge: "◊",
      lozf: "⧫",
      lpar: "(",
      lparlt: "⦓",
      lrarr: "⇆",
      lrcorner: "⌟",
      lrhar: "⇋",
      lrhard: "⥭",
      lrm: "‎",
      lrtri: "⊿",
      lsaquo: "‹",
      Lscr: "ℒ",
      lscr: "𝓁",
      Lsh: "↰",
      lsh: "↰",
      lsim: "≲",
      lsime: "⪍",
      lsimg: "⪏",
      lsqb: "[",
      lsquo: "‘",
      lsquor: "‚",
      Lstrok: "Ł",
      lstrok: "ł",
      Lt: "≪",
      LT: "<",
      lt: "<",
      ltcc: "⪦",
      ltcir: "⩹",
      ltdot: "⋖",
      lthree: "⋋",
      ltimes: "⋉",
      ltlarr: "⥶",
      ltquest: "⩻",
      ltri: "◃",
      ltrie: "⊴",
      ltrif: "◂",
      ltrPar: "⦖",
      lurdshar: "⥊",
      luruhar: "⥦",
      lvertneqq: "≨︀",
      lvnE: "≨︀",
      macr: "¯",
      male: "♂",
      malt: "✠",
      maltese: "✠",
      Map: "⤅",
      map: "↦",
      mapsto: "↦",
      mapstodown: "↧",
      mapstoleft: "↤",
      mapstoup: "↥",
      marker: "▮",
      mcomma: "⨩",
      Mcy: "М",
      mcy: "м",
      mdash: "—",
      mDDot: "∺",
      measuredangle: "∡",
      MediumSpace: " ",
      Mellintrf: "ℳ",
      Mfr: "𝔐",
      mfr: "𝔪",
      mho: "℧",
      micro: "µ",
      mid: "∣",
      midast: "*",
      midcir: "⫰",
      middot: "·",
      minus: "−",
      minusb: "⊟",
      minusd: "∸",
      minusdu: "⨪",
      MinusPlus: "∓",
      mlcp: "⫛",
      mldr: "…",
      mnplus: "∓",
      models: "⊧",
      Mopf: "𝕄",
      mopf: "𝕞",
      mp: "∓",
      Mscr: "ℳ",
      mscr: "𝓂",
      mstpos: "∾",
      Mu: "Μ",
      mu: "μ",
      multimap: "⊸",
      mumap: "⊸",
      nabla: "∇",
      Nacute: "Ń",
      nacute: "ń",
      nang: "∠⃒",
      nap: "≉",
      napE: "⩰̸",
      napid: "≋̸",
      napos: "ŉ",
      napprox: "≉",
      natur: "♮",
      natural: "♮",
      naturals: "ℕ",
      nbsp: " ",
      nbump: "≎̸",
      nbumpe: "≏̸",
      ncap: "⩃",
      Ncaron: "Ň",
      ncaron: "ň",
      Ncedil: "Ņ",
      ncedil: "ņ",
      ncong: "≇",
      ncongdot: "⩭̸",
      ncup: "⩂",
      Ncy: "Н",
      ncy: "н",
      ndash: "–",
      ne: "≠",
      nearhk: "⤤",
      neArr: "⇗",
      nearr: "↗",
      nearrow: "↗",
      nedot: "≐̸",
      NegativeMediumSpace: "​",
      NegativeThickSpace: "​",
      NegativeThinSpace: "​",
      NegativeVeryThinSpace: "​",
      nequiv: "≢",
      nesear: "⤨",
      nesim: "≂̸",
      NestedGreaterGreater: "≫",
      NestedLessLess: "≪",
      NewLine: "\n",
      nexist: "∄",
      nexists: "∄",
      Nfr: "𝔑",
      nfr: "𝔫",
      ngE: "≧̸",
      nge: "≱",
      ngeq: "≱",
      ngeqq: "≧̸",
      ngeqslant: "⩾̸",
      nges: "⩾̸",
      nGg: "⋙̸",
      ngsim: "≵",
      nGt: "≫⃒",
      ngt: "≯",
      ngtr: "≯",
      nGtv: "≫̸",
      nhArr: "⇎",
      nharr: "↮",
      nhpar: "⫲",
      ni: "∋",
      nis: "⋼",
      nisd: "⋺",
      niv: "∋",
      NJcy: "Њ",
      njcy: "њ",
      nlArr: "⇍",
      nlarr: "↚",
      nldr: "‥",
      nlE: "≦̸",
      nle: "≰",
      nLeftarrow: "⇍",
      nleftarrow: "↚",
      nLeftrightarrow: "⇎",
      nleftrightarrow: "↮",
      nleq: "≰",
      nleqq: "≦̸",
      nleqslant: "⩽̸",
      nles: "⩽̸",
      nless: "≮",
      nLl: "⋘̸",
      nlsim: "≴",
      nLt: "≪⃒",
      nlt: "≮",
      nltri: "⋪",
      nltrie: "⋬",
      nLtv: "≪̸",
      nmid: "∤",
      NoBreak: "⁠",
      NonBreakingSpace: " ",
      Nopf: "ℕ",
      nopf: "𝕟",
      Not: "⫬",
      not: "¬",
      NotCongruent: "≢",
      NotCupCap: "≭",
      NotDoubleVerticalBar: "∦",
      NotElement: "∉",
      NotEqual: "≠",
      NotEqualTilde: "≂̸",
      NotExists: "∄",
      NotGreater: "≯",
      NotGreaterEqual: "≱",
      NotGreaterFullEqual: "≧̸",
      NotGreaterGreater: "≫̸",
      NotGreaterLess: "≹",
      NotGreaterSlantEqual: "⩾̸",
      NotGreaterTilde: "≵",
      NotHumpDownHump: "≎̸",
      NotHumpEqual: "≏̸",
      notin: "∉",
      notindot: "⋵̸",
      notinE: "⋹̸",
      notinva: "∉",
      notinvb: "⋷",
      notinvc: "⋶",
      NotLeftTriangle: "⋪",
      NotLeftTriangleBar: "⧏̸",
      NotLeftTriangleEqual: "⋬",
      NotLess: "≮",
      NotLessEqual: "≰",
      NotLessGreater: "≸",
      NotLessLess: "≪̸",
      NotLessSlantEqual: "⩽̸",
      NotLessTilde: "≴",
      NotNestedGreaterGreater: "⪢̸",
      NotNestedLessLess: "⪡̸",
      notni: "∌",
      notniva: "∌",
      notnivb: "⋾",
      notnivc: "⋽",
      NotPrecedes: "⊀",
      NotPrecedesEqual: "⪯̸",
      NotPrecedesSlantEqual: "⋠",
      NotReverseElement: "∌",
      NotRightTriangle: "⋫",
      NotRightTriangleBar: "⧐̸",
      NotRightTriangleEqual: "⋭",
      NotSquareSubset: "⊏̸",
      NotSquareSubsetEqual: "⋢",
      NotSquareSuperset: "⊐̸",
      NotSquareSupersetEqual: "⋣",
      NotSubset: "⊂⃒",
      NotSubsetEqual: "⊈",
      NotSucceeds: "⊁",
      NotSucceedsEqual: "⪰̸",
      NotSucceedsSlantEqual: "⋡",
      NotSucceedsTilde: "≿̸",
      NotSuperset: "⊃⃒",
      NotSupersetEqual: "⊉",
      NotTilde: "≁",
      NotTildeEqual: "≄",
      NotTildeFullEqual: "≇",
      NotTildeTilde: "≉",
      NotVerticalBar: "∤",
      npar: "∦",
      nparallel: "∦",
      nparsl: "⫽⃥",
      npart: "∂̸",
      npolint: "⨔",
      npr: "⊀",
      nprcue: "⋠",
      npre: "⪯̸",
      nprec: "⊀",
      npreceq: "⪯̸",
      nrArr: "⇏",
      nrarr: "↛",
      nrarrc: "⤳̸",
      nrarrw: "↝̸",
      nRightarrow: "⇏",
      nrightarrow: "↛",
      nrtri: "⋫",
      nrtrie: "⋭",
      nsc: "⊁",
      nsccue: "⋡",
      nsce: "⪰̸",
      Nscr: "𝒩",
      nscr: "𝓃",
      nshortmid: "∤",
      nshortparallel: "∦",
      nsim: "≁",
      nsime: "≄",
      nsimeq: "≄",
      nsmid: "∤",
      nspar: "∦",
      nsqsube: "⋢",
      nsqsupe: "⋣",
      nsub: "⊄",
      nsubE: "⫅̸",
      nsube: "⊈",
      nsubset: "⊂⃒",
      nsubseteq: "⊈",
      nsubseteqq: "⫅̸",
      nsucc: "⊁",
      nsucceq: "⪰̸",
      nsup: "⊅",
      nsupE: "⫆̸",
      nsupe: "⊉",
      nsupset: "⊃⃒",
      nsupseteq: "⊉",
      nsupseteqq: "⫆̸",
      ntgl: "≹",
      Ntilde: "Ñ",
      ntilde: "ñ",
      ntlg: "≸",
      ntriangleleft: "⋪",
      ntrianglelefteq: "⋬",
      ntriangleright: "⋫",
      ntrianglerighteq: "⋭",
      Nu: "Ν",
      nu: "ν",
      num: "#",
      numero: "№",
      numsp: " ",
      nvap: "≍⃒",
      nVDash: "⊯",
      nVdash: "⊮",
      nvDash: "⊭",
      nvdash: "⊬",
      nvge: "≥⃒",
      nvgt: ">⃒",
      nvHarr: "⤄",
      nvinfin: "⧞",
      nvlArr: "⤂",
      nvle: "≤⃒",
      nvlt: "<⃒",
      nvltrie: "⊴⃒",
      nvrArr: "⤃",
      nvrtrie: "⊵⃒",
      nvsim: "∼⃒",
      nwarhk: "⤣",
      nwArr: "⇖",
      nwarr: "↖",
      nwarrow: "↖",
      nwnear: "⤧",
      Oacute: "Ó",
      oacute: "ó",
      oast: "⊛",
      ocir: "⊚",
      Ocirc: "Ô",
      ocirc: "ô",
      Ocy: "О",
      ocy: "о",
      odash: "⊝",
      Odblac: "Ő",
      odblac: "ő",
      odiv: "⨸",
      odot: "⊙",
      odsold: "⦼",
      OElig: "Œ",
      oelig: "œ",
      ofcir: "⦿",
      Ofr: "𝔒",
      ofr: "𝔬",
      ogon: "˛",
      Ograve: "Ò",
      ograve: "ò",
      ogt: "⧁",
      ohbar: "⦵",
      ohm: "Ω",
      oint: "∮",
      olarr: "↺",
      olcir: "⦾",
      olcross: "⦻",
      oline: "‾",
      olt: "⧀",
      Omacr: "Ō",
      omacr: "ō",
      Omega: "Ω",
      omega: "ω",
      Omicron: "Ο",
      omicron: "ο",
      omid: "⦶",
      ominus: "⊖",
      Oopf: "𝕆",
      oopf: "𝕠",
      opar: "⦷",
      OpenCurlyDoubleQuote: "“",
      OpenCurlyQuote: "‘",
      operp: "⦹",
      oplus: "⊕",
      Or: "⩔",
      or: "∨",
      orarr: "↻",
      ord: "⩝",
      order: "ℴ",
      orderof: "ℴ",
      ordf: "ª",
      ordm: "º",
      origof: "⊶",
      oror: "⩖",
      orslope: "⩗",
      orv: "⩛",
      oS: "Ⓢ",
      Oscr: "𝒪",
      oscr: "ℴ",
      Oslash: "Ø",
      oslash: "ø",
      osol: "⊘",
      Otilde: "Õ",
      otilde: "õ",
      Otimes: "⨷",
      otimes: "⊗",
      otimesas: "⨶",
      Ouml: "Ö",
      ouml: "ö",
      ovbar: "⌽",
      OverBar: "‾",
      OverBrace: "⏞",
      OverBracket: "⎴",
      OverParenthesis: "⏜",
      par: "∥",
      para: "¶",
      parallel: "∥",
      parsim: "⫳",
      parsl: "⫽",
      part: "∂",
      PartialD: "∂",
      Pcy: "П",
      pcy: "п",
      percnt: "%",
      period: ".",
      permil: "‰",
      perp: "⊥",
      pertenk: "‱",
      Pfr: "𝔓",
      pfr: "𝔭",
      Phi: "Φ",
      phi: "φ",
      phiv: "ϕ",
      phmmat: "ℳ",
      phone: "☎",
      Pi: "Π",
      pi: "π",
      pitchfork: "⋔",
      piv: "ϖ",
      planck: "ℏ",
      planckh: "ℎ",
      plankv: "ℏ",
      plus: "+",
      plusacir: "⨣",
      plusb: "⊞",
      pluscir: "⨢",
      plusdo: "∔",
      plusdu: "⨥",
      pluse: "⩲",
      PlusMinus: "±",
      plusmn: "±",
      plussim: "⨦",
      plustwo: "⨧",
      pm: "±",
      Poincareplane: "ℌ",
      pointint: "⨕",
      Popf: "ℙ",
      popf: "𝕡",
      pound: "£",
      Pr: "⪻",
      pr: "≺",
      prap: "⪷",
      prcue: "≼",
      prE: "⪳",
      pre: "⪯",
      prec: "≺",
      precapprox: "⪷",
      preccurlyeq: "≼",
      Precedes: "≺",
      PrecedesEqual: "⪯",
      PrecedesSlantEqual: "≼",
      PrecedesTilde: "≾",
      preceq: "⪯",
      precnapprox: "⪹",
      precneqq: "⪵",
      precnsim: "⋨",
      precsim: "≾",
      Prime: "″",
      prime: "′",
      primes: "ℙ",
      prnap: "⪹",
      prnE: "⪵",
      prnsim: "⋨",
      prod: "∏",
      Product: "∏",
      profalar: "⌮",
      profline: "⌒",
      profsurf: "⌓",
      prop: "∝",
      Proportion: "∷",
      Proportional: "∝",
      propto: "∝",
      prsim: "≾",
      prurel: "⊰",
      Pscr: "𝒫",
      pscr: "𝓅",
      Psi: "Ψ",
      psi: "ψ",
      puncsp: " ",
      Qfr: "𝔔",
      qfr: "𝔮",
      qint: "⨌",
      Qopf: "ℚ",
      qopf: "𝕢",
      qprime: "⁗",
      Qscr: "𝒬",
      qscr: "𝓆",
      quaternions: "ℍ",
      quatint: "⨖",
      quest: "?",
      questeq: "≟",
      QUOT: '"',
      quot: '"',
      rAarr: "⇛",
      race: "∽̱",
      Racute: "Ŕ",
      racute: "ŕ",
      radic: "√",
      raemptyv: "⦳",
      Rang: "⟫",
      rang: "⟩",
      rangd: "⦒",
      range: "⦥",
      rangle: "⟩",
      raquo: "»",
      Rarr: "↠",
      rArr: "⇒",
      rarr: "→",
      rarrap: "⥵",
      rarrb: "⇥",
      rarrbfs: "⤠",
      rarrc: "⤳",
      rarrfs: "⤞",
      rarrhk: "↪",
      rarrlp: "↬",
      rarrpl: "⥅",
      rarrsim: "⥴",
      Rarrtl: "⤖",
      rarrtl: "↣",
      rarrw: "↝",
      rAtail: "⤜",
      ratail: "⤚",
      ratio: "∶",
      rationals: "ℚ",
      RBarr: "⤐",
      rBarr: "⤏",
      rbarr: "⤍",
      rbbrk: "❳",
      rbrace: "}",
      rbrack: "]",
      rbrke: "⦌",
      rbrksld: "⦎",
      rbrkslu: "⦐",
      Rcaron: "Ř",
      rcaron: "ř",
      Rcedil: "Ŗ",
      rcedil: "ŗ",
      rceil: "⌉",
      rcub: "}",
      Rcy: "Р",
      rcy: "р",
      rdca: "⤷",
      rdldhar: "⥩",
      rdquo: "”",
      rdquor: "”",
      rdsh: "↳",
      Re: "ℜ",
      real: "ℜ",
      realine: "ℛ",
      realpart: "ℜ",
      reals: "ℝ",
      rect: "▭",
      REG: "®",
      reg: "®",
      ReverseElement: "∋",
      ReverseEquilibrium: "⇋",
      ReverseUpEquilibrium: "⥯",
      rfisht: "⥽",
      rfloor: "⌋",
      Rfr: "ℜ",
      rfr: "𝔯",
      rHar: "⥤",
      rhard: "⇁",
      rharu: "⇀",
      rharul: "⥬",
      Rho: "Ρ",
      rho: "ρ",
      rhov: "ϱ",
      RightAngleBracket: "⟩",
      RightArrow: "→",
      Rightarrow: "⇒",
      rightarrow: "→",
      RightArrowBar: "⇥",
      RightArrowLeftArrow: "⇄",
      rightarrowtail: "↣",
      RightCeiling: "⌉",
      RightDoubleBracket: "⟧",
      RightDownTeeVector: "⥝",
      RightDownVector: "⇂",
      RightDownVectorBar: "⥕",
      RightFloor: "⌋",
      rightharpoondown: "⇁",
      rightharpoonup: "⇀",
      rightleftarrows: "⇄",
      rightleftharpoons: "⇌",
      rightrightarrows: "⇉",
      rightsquigarrow: "↝",
      RightTee: "⊢",
      RightTeeArrow: "↦",
      RightTeeVector: "⥛",
      rightthreetimes: "⋌",
      RightTriangle: "⊳",
      RightTriangleBar: "⧐",
      RightTriangleEqual: "⊵",
      RightUpDownVector: "⥏",
      RightUpTeeVector: "⥜",
      RightUpVector: "↾",
      RightUpVectorBar: "⥔",
      RightVector: "⇀",
      RightVectorBar: "⥓",
      ring: "˚",
      risingdotseq: "≓",
      rlarr: "⇄",
      rlhar: "⇌",
      rlm: "‏",
      rmoust: "⎱",
      rmoustache: "⎱",
      rnmid: "⫮",
      roang: "⟭",
      roarr: "⇾",
      robrk: "⟧",
      ropar: "⦆",
      Ropf: "ℝ",
      ropf: "𝕣",
      roplus: "⨮",
      rotimes: "⨵",
      RoundImplies: "⥰",
      rpar: ")",
      rpargt: "⦔",
      rppolint: "⨒",
      rrarr: "⇉",
      Rrightarrow: "⇛",
      rsaquo: "›",
      Rscr: "ℛ",
      rscr: "𝓇",
      Rsh: "↱",
      rsh: "↱",
      rsqb: "]",
      rsquo: "’",
      rsquor: "’",
      rthree: "⋌",
      rtimes: "⋊",
      rtri: "▹",
      rtrie: "⊵",
      rtrif: "▸",
      rtriltri: "⧎",
      RuleDelayed: "⧴",
      ruluhar: "⥨",
      rx: "℞",
      Sacute: "Ś",
      sacute: "ś",
      sbquo: "‚",
      Sc: "⪼",
      sc: "≻",
      scap: "⪸",
      Scaron: "Š",
      scaron: "š",
      sccue: "≽",
      scE: "⪴",
      sce: "⪰",
      Scedil: "Ş",
      scedil: "ş",
      Scirc: "Ŝ",
      scirc: "ŝ",
      scnap: "⪺",
      scnE: "⪶",
      scnsim: "⋩",
      scpolint: "⨓",
      scsim: "≿",
      Scy: "С",
      scy: "с",
      sdot: "⋅",
      sdotb: "⊡",
      sdote: "⩦",
      searhk: "⤥",
      seArr: "⇘",
      searr: "↘",
      searrow: "↘",
      sect: "§",
      semi: ";",
      seswar: "⤩",
      setminus: "∖",
      setmn: "∖",
      sext: "✶",
      Sfr: "𝔖",
      sfr: "𝔰",
      sfrown: "⌢",
      sharp: "♯",
      SHCHcy: "Щ",
      shchcy: "щ",
      SHcy: "Ш",
      shcy: "ш",
      ShortDownArrow: "↓",
      ShortLeftArrow: "←",
      shortmid: "∣",
      shortparallel: "∥",
      ShortRightArrow: "→",
      ShortUpArrow: "↑",
      shy: "­",
      Sigma: "Σ",
      sigma: "σ",
      sigmaf: "ς",
      sigmav: "ς",
      sim: "∼",
      simdot: "⩪",
      sime: "≃",
      simeq: "≃",
      simg: "⪞",
      simgE: "⪠",
      siml: "⪝",
      simlE: "⪟",
      simne: "≆",
      simplus: "⨤",
      simrarr: "⥲",
      slarr: "←",
      SmallCircle: "∘",
      smallsetminus: "∖",
      smashp: "⨳",
      smeparsl: "⧤",
      smid: "∣",
      smile: "⌣",
      smt: "⪪",
      smte: "⪬",
      smtes: "⪬︀",
      SOFTcy: "Ь",
      softcy: "ь",
      sol: "/",
      solb: "⧄",
      solbar: "⌿",
      Sopf: "𝕊",
      sopf: "𝕤",
      spades: "♠",
      spadesuit: "♠",
      spar: "∥",
      sqcap: "⊓",
      sqcaps: "⊓︀",
      sqcup: "⊔",
      sqcups: "⊔︀",
      Sqrt: "√",
      sqsub: "⊏",
      sqsube: "⊑",
      sqsubset: "⊏",
      sqsubseteq: "⊑",
      sqsup: "⊐",
      sqsupe: "⊒",
      sqsupset: "⊐",
      sqsupseteq: "⊒",
      squ: "□",
      Square: "□",
      square: "□",
      SquareIntersection: "⊓",
      SquareSubset: "⊏",
      SquareSubsetEqual: "⊑",
      SquareSuperset: "⊐",
      SquareSupersetEqual: "⊒",
      SquareUnion: "⊔",
      squarf: "▪",
      squf: "▪",
      srarr: "→",
      Sscr: "𝒮",
      sscr: "𝓈",
      ssetmn: "∖",
      ssmile: "⌣",
      sstarf: "⋆",
      Star: "⋆",
      star: "☆",
      starf: "★",
      straightepsilon: "ϵ",
      straightphi: "ϕ",
      strns: "¯",
      Sub: "⋐",
      sub: "⊂",
      subdot: "⪽",
      subE: "⫅",
      sube: "⊆",
      subedot: "⫃",
      submult: "⫁",
      subnE: "⫋",
      subne: "⊊",
      subplus: "⪿",
      subrarr: "⥹",
      Subset: "⋐",
      subset: "⊂",
      subseteq: "⊆",
      subseteqq: "⫅",
      SubsetEqual: "⊆",
      subsetneq: "⊊",
      subsetneqq: "⫋",
      subsim: "⫇",
      subsub: "⫕",
      subsup: "⫓",
      succ: "≻",
      succapprox: "⪸",
      succcurlyeq: "≽",
      Succeeds: "≻",
      SucceedsEqual: "⪰",
      SucceedsSlantEqual: "≽",
      SucceedsTilde: "≿",
      succeq: "⪰",
      succnapprox: "⪺",
      succneqq: "⪶",
      succnsim: "⋩",
      succsim: "≿",
      SuchThat: "∋",
      Sum: "∑",
      sum: "∑",
      sung: "♪",
      Sup: "⋑",
      sup: "⊃",
      sup1: "¹",
      sup2: "²",
      sup3: "³",
      supdot: "⪾",
      supdsub: "⫘",
      supE: "⫆",
      supe: "⊇",
      supedot: "⫄",
      Superset: "⊃",
      SupersetEqual: "⊇",
      suphsol: "⟉",
      suphsub: "⫗",
      suplarr: "⥻",
      supmult: "⫂",
      supnE: "⫌",
      supne: "⊋",
      supplus: "⫀",
      Supset: "⋑",
      supset: "⊃",
      supseteq: "⊇",
      supseteqq: "⫆",
      supsetneq: "⊋",
      supsetneqq: "⫌",
      supsim: "⫈",
      supsub: "⫔",
      supsup: "⫖",
      swarhk: "⤦",
      swArr: "⇙",
      swarr: "↙",
      swarrow: "↙",
      swnwar: "⤪",
      szlig: "ß",
      Tab: "	",
      target: "⌖",
      Tau: "Τ",
      tau: "τ",
      tbrk: "⎴",
      Tcaron: "Ť",
      tcaron: "ť",
      Tcedil: "Ţ",
      tcedil: "ţ",
      Tcy: "Т",
      tcy: "т",
      tdot: "⃛",
      telrec: "⌕",
      Tfr: "𝔗",
      tfr: "𝔱",
      there4: "∴",
      Therefore: "∴",
      therefore: "∴",
      Theta: "Θ",
      theta: "θ",
      thetasym: "ϑ",
      thetav: "ϑ",
      thickapprox: "≈",
      thicksim: "∼",
      ThickSpace: "  ",
      thinsp: " ",
      ThinSpace: " ",
      thkap: "≈",
      thksim: "∼",
      THORN: "Þ",
      thorn: "þ",
      Tilde: "∼",
      tilde: "˜",
      TildeEqual: "≃",
      TildeFullEqual: "≅",
      TildeTilde: "≈",
      times: "×",
      timesb: "⊠",
      timesbar: "⨱",
      timesd: "⨰",
      tint: "∭",
      toea: "⤨",
      top: "⊤",
      topbot: "⌶",
      topcir: "⫱",
      Topf: "𝕋",
      topf: "𝕥",
      topfork: "⫚",
      tosa: "⤩",
      tprime: "‴",
      TRADE: "™",
      trade: "™",
      triangle: "▵",
      triangledown: "▿",
      triangleleft: "◃",
      trianglelefteq: "⊴",
      triangleq: "≜",
      triangleright: "▹",
      trianglerighteq: "⊵",
      tridot: "◬",
      trie: "≜",
      triminus: "⨺",
      TripleDot: "⃛",
      triplus: "⨹",
      trisb: "⧍",
      tritime: "⨻",
      trpezium: "⏢",
      Tscr: "𝒯",
      tscr: "𝓉",
      TScy: "Ц",
      tscy: "ц",
      TSHcy: "Ћ",
      tshcy: "ћ",
      Tstrok: "Ŧ",
      tstrok: "ŧ",
      twixt: "≬",
      twoheadleftarrow: "↞",
      twoheadrightarrow: "↠",
      Uacute: "Ú",
      uacute: "ú",
      Uarr: "↟",
      uArr: "⇑",
      uarr: "↑",
      Uarrocir: "⥉",
      Ubrcy: "Ў",
      ubrcy: "ў",
      Ubreve: "Ŭ",
      ubreve: "ŭ",
      Ucirc: "Û",
      ucirc: "û",
      Ucy: "У",
      ucy: "у",
      udarr: "⇅",
      Udblac: "Ű",
      udblac: "ű",
      udhar: "⥮",
      ufisht: "⥾",
      Ufr: "𝔘",
      ufr: "𝔲",
      Ugrave: "Ù",
      ugrave: "ù",
      uHar: "⥣",
      uharl: "↿",
      uharr: "↾",
      uhblk: "▀",
      ulcorn: "⌜",
      ulcorner: "⌜",
      ulcrop: "⌏",
      ultri: "◸",
      Umacr: "Ū",
      umacr: "ū",
      uml: "¨",
      UnderBar: "_",
      UnderBrace: "⏟",
      UnderBracket: "⎵",
      UnderParenthesis: "⏝",
      Union: "⋃",
      UnionPlus: "⊎",
      Uogon: "Ų",
      uogon: "ų",
      Uopf: "𝕌",
      uopf: "𝕦",
      UpArrow: "↑",
      Uparrow: "⇑",
      uparrow: "↑",
      UpArrowBar: "⤒",
      UpArrowDownArrow: "⇅",
      UpDownArrow: "↕",
      Updownarrow: "⇕",
      updownarrow: "↕",
      UpEquilibrium: "⥮",
      upharpoonleft: "↿",
      upharpoonright: "↾",
      uplus: "⊎",
      UpperLeftArrow: "↖",
      UpperRightArrow: "↗",
      Upsi: "ϒ",
      upsi: "υ",
      upsih: "ϒ",
      Upsilon: "Υ",
      upsilon: "υ",
      UpTee: "⊥",
      UpTeeArrow: "↥",
      upuparrows: "⇈",
      urcorn: "⌝",
      urcorner: "⌝",
      urcrop: "⌎",
      Uring: "Ů",
      uring: "ů",
      urtri: "◹",
      Uscr: "𝒰",
      uscr: "𝓊",
      utdot: "⋰",
      Utilde: "Ũ",
      utilde: "ũ",
      utri: "▵",
      utrif: "▴",
      uuarr: "⇈",
      Uuml: "Ü",
      uuml: "ü",
      uwangle: "⦧",
      vangrt: "⦜",
      varepsilon: "ϵ",
      varkappa: "ϰ",
      varnothing: "∅",
      varphi: "ϕ",
      varpi: "ϖ",
      varpropto: "∝",
      vArr: "⇕",
      varr: "↕",
      varrho: "ϱ",
      varsigma: "ς",
      varsubsetneq: "⊊︀",
      varsubsetneqq: "⫋︀",
      varsupsetneq: "⊋︀",
      varsupsetneqq: "⫌︀",
      vartheta: "ϑ",
      vartriangleleft: "⊲",
      vartriangleright: "⊳",
      Vbar: "⫫",
      vBar: "⫨",
      vBarv: "⫩",
      Vcy: "В",
      vcy: "в",
      VDash: "⊫",
      Vdash: "⊩",
      vDash: "⊨",
      vdash: "⊢",
      Vdashl: "⫦",
      Vee: "⋁",
      vee: "∨",
      veebar: "⊻",
      veeeq: "≚",
      vellip: "⋮",
      Verbar: "‖",
      verbar: "|",
      Vert: "‖",
      vert: "|",
      VerticalBar: "∣",
      VerticalLine: "|",
      VerticalSeparator: "❘",
      VerticalTilde: "≀",
      VeryThinSpace: " ",
      Vfr: "𝔙",
      vfr: "𝔳",
      vltri: "⊲",
      vnsub: "⊂⃒",
      vnsup: "⊃⃒",
      Vopf: "𝕍",
      vopf: "𝕧",
      vprop: "∝",
      vrtri: "⊳",
      Vscr: "𝒱",
      vscr: "𝓋",
      vsubnE: "⫋︀",
      vsubne: "⊊︀",
      vsupnE: "⫌︀",
      vsupne: "⊋︀",
      Vvdash: "⊪",
      vzigzag: "⦚",
      Wcirc: "Ŵ",
      wcirc: "ŵ",
      wedbar: "⩟",
      Wedge: "⋀",
      wedge: "∧",
      wedgeq: "≙",
      weierp: "℘",
      Wfr: "𝔚",
      wfr: "𝔴",
      Wopf: "𝕎",
      wopf: "𝕨",
      wp: "℘",
      wr: "≀",
      wreath: "≀",
      Wscr: "𝒲",
      wscr: "𝓌",
      xcap: "⋂",
      xcirc: "◯",
      xcup: "⋃",
      xdtri: "▽",
      Xfr: "𝔛",
      xfr: "𝔵",
      xhArr: "⟺",
      xharr: "⟷",
      Xi: "Ξ",
      xi: "ξ",
      xlArr: "⟸",
      xlarr: "⟵",
      xmap: "⟼",
      xnis: "⋻",
      xodot: "⨀",
      Xopf: "𝕏",
      xopf: "𝕩",
      xoplus: "⨁",
      xotime: "⨂",
      xrArr: "⟹",
      xrarr: "⟶",
      Xscr: "𝒳",
      xscr: "𝓍",
      xsqcup: "⨆",
      xuplus: "⨄",
      xutri: "△",
      xvee: "⋁",
      xwedge: "⋀",
      Yacute: "Ý",
      yacute: "ý",
      YAcy: "Я",
      yacy: "я",
      Ycirc: "Ŷ",
      ycirc: "ŷ",
      Ycy: "Ы",
      ycy: "ы",
      yen: "¥",
      Yfr: "𝔜",
      yfr: "𝔶",
      YIcy: "Ї",
      yicy: "ї",
      Yopf: "𝕐",
      yopf: "𝕪",
      Yscr: "𝒴",
      yscr: "𝓎",
      YUcy: "Ю",
      yucy: "ю",
      Yuml: "Ÿ",
      yuml: "ÿ",
      Zacute: "Ź",
      zacute: "ź",
      Zcaron: "Ž",
      zcaron: "ž",
      Zcy: "З",
      zcy: "з",
      Zdot: "Ż",
      zdot: "ż",
      zeetrf: "ℨ",
      ZeroWidthSpace: "​",
      Zeta: "Ζ",
      zeta: "ζ",
      Zfr: "ℨ",
      zfr: "𝔷",
      ZHcy: "Ж",
      zhcy: "ж",
      zigrarr: "⇝",
      Zopf: "ℤ",
      zopf: "𝕫",
      Zscr: "𝒵",
      zscr: "𝓏",
      zwj: "‍",
      zwnj: "‌"
    });
    exports.entityMap = exports.HTML_ENTITIES;
  })(entities);
  return entities;
}
var sax = {};
var hasRequiredSax;
function requireSax() {
  if (hasRequiredSax) return sax;
  hasRequiredSax = 1;
  var conventions2 = requireConventions();
  var g = requireGrammar();
  var errors2 = requireErrors();
  var isHTMLEscapableRawTextElement = conventions2.isHTMLEscapableRawTextElement;
  var isHTMLMimeType = conventions2.isHTMLMimeType;
  var isHTMLRawTextElement = conventions2.isHTMLRawTextElement;
  var hasOwn = conventions2.hasOwn;
  var NAMESPACE = conventions2.NAMESPACE;
  var ParseError2 = errors2.ParseError;
  var DOMException = errors2.DOMException;
  var S_TAG = 0;
  var S_ATTR = 1;
  var S_ATTR_SPACE = 2;
  var S_EQ = 3;
  var S_ATTR_NOQUOT_VALUE = 4;
  var S_ATTR_END = 5;
  var S_TAG_SPACE = 6;
  var S_TAG_CLOSE = 7;
  function XMLReader() {
  }
  XMLReader.prototype = {
    parse: function(source, defaultNSMap, entityMap) {
      var domBuilder = this.domBuilder;
      domBuilder.startDocument();
      _copy(defaultNSMap, defaultNSMap = /* @__PURE__ */ Object.create(null));
      parse2(source, defaultNSMap, entityMap, domBuilder, this.errorHandler);
      domBuilder.endDocument();
    }
  };
  var ENTITY_REG = /&#?\w+;?/g;
  function parse2(source, defaultNSMapCopy, entityMap, domBuilder, errorHandler) {
    var isHTML = isHTMLMimeType(domBuilder.mimeType);
    if (source.indexOf(g.UNICODE_REPLACEMENT_CHARACTER) >= 0) {
      errorHandler.warning("Unicode replacement character detected, source encoding issues?");
    }
    function fixedFromCharCode(code2) {
      if (code2 > 65535) {
        code2 -= 65536;
        var surrogate1 = 55296 + (code2 >> 10), surrogate2 = 56320 + (code2 & 1023);
        return String.fromCharCode(surrogate1, surrogate2);
      } else {
        return String.fromCharCode(code2);
      }
    }
    function entityReplacer(a2) {
      var complete = a2[a2.length - 1] === ";" ? a2 : a2 + ";";
      if (!isHTML && complete !== a2) {
        errorHandler.error("EntityRef: expecting ;");
        return a2;
      }
      var match = g.Reference.exec(complete);
      if (!match || match[0].length !== complete.length) {
        errorHandler.error("entity not matching Reference production: " + a2);
        return a2;
      }
      var k = complete.slice(1, -1);
      if (hasOwn(entityMap, k)) {
        return entityMap[k];
      } else if (k.charAt(0) === "#") {
        return fixedFromCharCode(parseInt(k.substring(1).replace("x", "0x")));
      } else {
        errorHandler.error("entity not found:" + a2);
        return a2;
      }
    }
    function appendText(end2) {
      if (end2 > start) {
        var xt = source.substring(start, end2).replace(ENTITY_REG, entityReplacer);
        locator && position(start);
        domBuilder.characters(xt, 0, end2 - start);
        start = end2;
      }
    }
    var lineStart = 0;
    var lineEnd = 0;
    var linePattern = /\r\n?|\n|$/g;
    var locator = domBuilder.locator;
    function position(p, m) {
      while (p >= lineEnd && (m = linePattern.exec(source))) {
        lineStart = lineEnd;
        lineEnd = m.index + m[0].length;
        locator.lineNumber++;
      }
      locator.columnNumber = p - lineStart + 1;
    }
    var parseStack = [{ currentNSMap: defaultNSMapCopy }];
    var unclosedTags = [];
    var start = 0;
    while (true) {
      try {
        var tagStart = source.indexOf("<", start);
        if (tagStart < 0) {
          if (!isHTML && unclosedTags.length > 0) {
            return errorHandler.fatalError("unclosed xml tag(s): " + unclosedTags.join(", "));
          }
          if (!source.substring(start).match(/^\s*$/)) {
            var doc = domBuilder.doc;
            var text = doc.createTextNode(source.substring(start));
            if (doc.documentElement) {
              return errorHandler.error("Extra content at the end of the document");
            }
            doc.appendChild(text);
            domBuilder.currentElement = text;
          }
          return;
        }
        if (tagStart > start) {
          var fromSource = source.substring(start, tagStart);
          if (!isHTML && unclosedTags.length === 0) {
            fromSource = fromSource.replace(new RegExp(g.S_OPT.source, "g"), "");
            fromSource && errorHandler.error("Unexpected content outside root element: '" + fromSource + "'");
          }
          appendText(tagStart);
        }
        switch (source.charAt(tagStart + 1)) {
          case "/":
            var end = source.indexOf(">", tagStart + 2);
            var tagNameRaw = source.substring(tagStart + 2, end > 0 ? end : void 0);
            if (!tagNameRaw) {
              return errorHandler.fatalError("end tag name missing");
            }
            var tagNameMatch = end > 0 && g.reg("^", g.QName_group, g.S_OPT, "$").exec(tagNameRaw);
            if (!tagNameMatch) {
              return errorHandler.fatalError('end tag name contains invalid characters: "' + tagNameRaw + '"');
            }
            if (!domBuilder.currentElement && !domBuilder.doc.documentElement) {
              return;
            }
            var currentTagName = unclosedTags[unclosedTags.length - 1] || domBuilder.currentElement.tagName || domBuilder.doc.documentElement.tagName || "";
            if (currentTagName !== tagNameMatch[1]) {
              var tagNameLower = tagNameMatch[1].toLowerCase();
              if (!isHTML || currentTagName.toLowerCase() !== tagNameLower) {
                return errorHandler.fatalError('Opening and ending tag mismatch: "' + currentTagName + '" != "' + tagNameRaw + '"');
              }
            }
            var config = parseStack.pop();
            unclosedTags.pop();
            var localNSMap = config.localNSMap;
            domBuilder.endElement(config.uri, config.localName, currentTagName);
            if (localNSMap) {
              for (var prefix in localNSMap) {
                if (hasOwn(localNSMap, prefix)) {
                  domBuilder.endPrefixMapping(prefix);
                }
              }
            }
            end++;
            break;
          // end element
          case "?":
            locator && position(tagStart);
            end = parseProcessingInstruction(source, tagStart, domBuilder, errorHandler);
            break;
          case "!":
            locator && position(tagStart);
            end = parseDoctypeCommentOrCData(source, tagStart, domBuilder, errorHandler, isHTML);
            break;
          default:
            locator && position(tagStart);
            var el = new ElementAttributes();
            var currentNSMap = parseStack[parseStack.length - 1].currentNSMap;
            var end = parseElementStartPart(source, tagStart, el, currentNSMap, entityReplacer, errorHandler, isHTML);
            var len = el.length;
            if (!el.closed) {
              if (isHTML && conventions2.isHTMLVoidElement(el.tagName)) {
                el.closed = true;
              } else {
                unclosedTags.push(el.tagName);
              }
            }
            if (locator && len) {
              var locator2 = copyLocator(locator, {});
              for (var i = 0; i < len; i++) {
                var a = el[i];
                position(a.offset);
                a.locator = copyLocator(locator, {});
              }
              domBuilder.locator = locator2;
              if (appendElement(el, domBuilder, currentNSMap)) {
                parseStack.push(el);
              }
              domBuilder.locator = locator;
            } else {
              if (appendElement(el, domBuilder, currentNSMap)) {
                parseStack.push(el);
              }
            }
            if (isHTML && !el.closed) {
              end = parseHtmlSpecialContent(source, end, el.tagName, entityReplacer, domBuilder);
            } else {
              end++;
            }
        }
      } catch (e) {
        if (e instanceof ParseError2) {
          throw e;
        } else if (e instanceof DOMException) {
          throw new ParseError2(e.name + ": " + e.message, domBuilder.locator, e);
        }
        errorHandler.error("element parse error: " + e);
        end = -1;
      }
      if (end > start) {
        start = end;
      } else {
        appendText(Math.max(tagStart, start) + 1);
      }
    }
  }
  function copyLocator(f, t) {
    t.lineNumber = f.lineNumber;
    t.columnNumber = f.columnNumber;
    return t;
  }
  function parseElementStartPart(source, start, el, currentNSMap, entityReplacer, errorHandler, isHTML) {
    function addAttribute(qname, value3, startIndex) {
      if (hasOwn(el.attributeNames, qname)) {
        return errorHandler.fatalError("Attribute " + qname + " redefined");
      }
      if (!isHTML && value3.indexOf("<") >= 0) {
        return errorHandler.fatalError("Unescaped '<' not allowed in attributes values");
      }
      el.addValue(
        qname,
        // @see https://www.w3.org/TR/xml/#AVNormalize
        // since the xmldom sax parser does not "interpret" DTD the following is not implemented:
        // - recursive replacement of (DTD) entity references
        // - trimming and collapsing multiple spaces into a single one for attributes that are not of type CDATA
        value3.replace(/[\t\n\r]/g, " ").replace(ENTITY_REG, entityReplacer),
        startIndex
      );
    }
    var attrName;
    var value2;
    var p = ++start;
    var s = S_TAG;
    while (true) {
      var c = source.charAt(p);
      switch (c) {
        case "=":
          if (s === S_ATTR) {
            attrName = source.slice(start, p);
            s = S_EQ;
          } else if (s === S_ATTR_SPACE) {
            s = S_EQ;
          } else {
            throw new Error("attribute equal must after attrName");
          }
          break;
        case "'":
        case '"':
          if (s === S_EQ || s === S_ATTR) {
            if (s === S_ATTR) {
              errorHandler.warning('attribute value must after "="');
              attrName = source.slice(start, p);
            }
            start = p + 1;
            p = source.indexOf(c, start);
            if (p > 0) {
              value2 = source.slice(start, p);
              addAttribute(attrName, value2, start - 1);
              s = S_ATTR_END;
            } else {
              throw new Error("attribute value no end '" + c + "' match");
            }
          } else if (s == S_ATTR_NOQUOT_VALUE) {
            value2 = source.slice(start, p);
            addAttribute(attrName, value2, start);
            errorHandler.warning('attribute "' + attrName + '" missed start quot(' + c + ")!!");
            start = p + 1;
            s = S_ATTR_END;
          } else {
            throw new Error('attribute value must after "="');
          }
          break;
        case "/":
          switch (s) {
            case S_TAG:
              el.setTagName(source.slice(start, p));
            case S_ATTR_END:
            case S_TAG_SPACE:
            case S_TAG_CLOSE:
              s = S_TAG_CLOSE;
              el.closed = true;
            case S_ATTR_NOQUOT_VALUE:
            case S_ATTR:
              break;
            case S_ATTR_SPACE:
              el.closed = true;
              break;
            //case S_EQ:
            default:
              throw new Error("attribute invalid close char('/')");
          }
          break;
        case "":
          errorHandler.error("unexpected end of input");
          if (s == S_TAG) {
            el.setTagName(source.slice(start, p));
          }
          return p;
        case ">":
          switch (s) {
            case S_TAG:
              el.setTagName(source.slice(start, p));
            case S_ATTR_END:
            case S_TAG_SPACE:
            case S_TAG_CLOSE:
              break;
            //normal
            case S_ATTR_NOQUOT_VALUE:
            //Compatible state
            case S_ATTR:
              value2 = source.slice(start, p);
              if (value2.slice(-1) === "/") {
                el.closed = true;
                value2 = value2.slice(0, -1);
              }
            case S_ATTR_SPACE:
              if (s === S_ATTR_SPACE) {
                value2 = attrName;
              }
              if (s == S_ATTR_NOQUOT_VALUE) {
                errorHandler.warning('attribute "' + value2 + '" missed quot(")!');
                addAttribute(attrName, value2, start);
              } else {
                if (!isHTML) {
                  errorHandler.warning('attribute "' + value2 + '" missed value!! "' + value2 + '" instead!!');
                }
                addAttribute(value2, value2, start);
              }
              break;
            case S_EQ:
              if (!isHTML) {
                return errorHandler.fatalError(`AttValue: ' or " expected`);
              }
          }
          return p;
        /*xml space '\x20' | #x9 | #xD | #xA; */
        case "":
          c = " ";
        default:
          if (c <= " ") {
            switch (s) {
              case S_TAG:
                el.setTagName(source.slice(start, p));
                s = S_TAG_SPACE;
                break;
              case S_ATTR:
                attrName = source.slice(start, p);
                s = S_ATTR_SPACE;
                break;
              case S_ATTR_NOQUOT_VALUE:
                var value2 = source.slice(start, p);
                errorHandler.warning('attribute "' + value2 + '" missed quot(")!!');
                addAttribute(attrName, value2, start);
              case S_ATTR_END:
                s = S_TAG_SPACE;
                break;
            }
          } else {
            switch (s) {
              //case S_TAG:void();break;
              //case S_ATTR:void();break;
              //case S_ATTR_NOQUOT_VALUE:void();break;
              case S_ATTR_SPACE:
                if (!isHTML) {
                  errorHandler.warning('attribute "' + attrName + '" missed value!! "' + attrName + '" instead2!!');
                }
                addAttribute(attrName, attrName, start);
                start = p;
                s = S_ATTR;
                break;
              case S_ATTR_END:
                errorHandler.warning('attribute space is required"' + attrName + '"!!');
              case S_TAG_SPACE:
                s = S_ATTR;
                start = p;
                break;
              case S_EQ:
                s = S_ATTR_NOQUOT_VALUE;
                start = p;
                break;
              case S_TAG_CLOSE:
                throw new Error("elements closed character '/' and '>' must be connected to");
            }
          }
      }
      p++;
    }
  }
  function appendElement(el, domBuilder, currentNSMap) {
    var tagName = el.tagName;
    var localNSMap = null;
    var i = el.length;
    while (i--) {
      var a = el[i];
      var qName = a.qName;
      var value2 = a.value;
      var nsp = qName.indexOf(":");
      if (nsp > 0) {
        var prefix = a.prefix = qName.slice(0, nsp);
        var localName = qName.slice(nsp + 1);
        var nsPrefix = prefix === "xmlns" && localName;
      } else {
        localName = qName;
        prefix = null;
        nsPrefix = qName === "xmlns" && "";
      }
      a.localName = localName;
      if (nsPrefix !== false) {
        if (localNSMap == null) {
          localNSMap = /* @__PURE__ */ Object.create(null);
          _copy(currentNSMap, currentNSMap = /* @__PURE__ */ Object.create(null));
        }
        currentNSMap[nsPrefix] = localNSMap[nsPrefix] = value2;
        a.uri = NAMESPACE.XMLNS;
        domBuilder.startPrefixMapping(nsPrefix, value2);
      }
    }
    var i = el.length;
    while (i--) {
      a = el[i];
      if (a.prefix) {
        if (a.prefix === "xml") {
          a.uri = NAMESPACE.XML;
        }
        if (a.prefix !== "xmlns") {
          a.uri = currentNSMap[a.prefix];
        }
      }
    }
    var nsp = tagName.indexOf(":");
    if (nsp > 0) {
      prefix = el.prefix = tagName.slice(0, nsp);
      localName = el.localName = tagName.slice(nsp + 1);
    } else {
      prefix = null;
      localName = el.localName = tagName;
    }
    var ns = el.uri = currentNSMap[prefix || ""];
    domBuilder.startElement(ns, localName, tagName, el);
    if (el.closed) {
      domBuilder.endElement(ns, localName, tagName);
      if (localNSMap) {
        for (prefix in localNSMap) {
          if (hasOwn(localNSMap, prefix)) {
            domBuilder.endPrefixMapping(prefix);
          }
        }
      }
    } else {
      el.currentNSMap = currentNSMap;
      el.localNSMap = localNSMap;
      return true;
    }
  }
  function parseHtmlSpecialContent(source, elStartEnd, tagName, entityReplacer, domBuilder) {
    var isEscapableRaw = isHTMLEscapableRawTextElement(tagName);
    if (isEscapableRaw || isHTMLRawTextElement(tagName)) {
      var elEndStart = source.indexOf("</" + tagName + ">", elStartEnd);
      var text = source.substring(elStartEnd + 1, elEndStart);
      if (isEscapableRaw) {
        text = text.replace(ENTITY_REG, entityReplacer);
      }
      domBuilder.characters(text, 0, text.length);
      return elEndStart;
    }
    return elStartEnd + 1;
  }
  function _copy(source, target) {
    for (var n in source) {
      if (hasOwn(source, n)) {
        target[n] = source[n];
      }
    }
  }
  function parseUtils(source, start) {
    var index = start;
    function char(n) {
      n = n || 0;
      return source.charAt(index + n);
    }
    function skip(n) {
      n = n || 1;
      index += n;
    }
    function skipBlanks() {
      var blanks = 0;
      while (index < source.length) {
        var c = char();
        if (c !== " " && c !== "\n" && c !== "	" && c !== "\r") {
          return blanks;
        }
        blanks++;
        skip();
      }
      return -1;
    }
    function substringFromIndex() {
      return source.substring(index);
    }
    function substringStartsWith(text) {
      return source.substring(index, index + text.length) === text;
    }
    function substringStartsWithCaseInsensitive(text) {
      return source.substring(index, index + text.length).toUpperCase() === text.toUpperCase();
    }
    function getMatch(args) {
      var expr = g.reg("^", args);
      var match = expr.exec(substringFromIndex());
      if (match) {
        skip(match[0].length);
        return match[0];
      }
      return null;
    }
    return {
      char,
      getIndex: function() {
        return index;
      },
      getMatch,
      getSource: function() {
        return source;
      },
      skip,
      skipBlanks,
      substringFromIndex,
      substringStartsWith,
      substringStartsWithCaseInsensitive
    };
  }
  function parseDoctypeInternalSubset(p, errorHandler) {
    function parsePI(p2, errorHandler2) {
      var match = g.PI.exec(p2.substringFromIndex());
      if (!match) {
        return errorHandler2.fatalError("processing instruction is not well-formed at position " + p2.getIndex());
      }
      if (match[1].toLowerCase() === "xml") {
        return errorHandler2.fatalError(
          "xml declaration is only allowed at the start of the document, but found at position " + p2.getIndex()
        );
      }
      p2.skip(match[0].length);
      return match[0];
    }
    var source = p.getSource();
    if (p.char() === "[") {
      p.skip(1);
      var intSubsetStart = p.getIndex();
      while (p.getIndex() < source.length) {
        p.skipBlanks();
        if (p.char() === "]") {
          var internalSubset = source.substring(intSubsetStart, p.getIndex());
          p.skip(1);
          return internalSubset;
        }
        var current = null;
        if (p.char() === "<" && p.char(1) === "!") {
          switch (p.char(2)) {
            case "E":
              if (p.char(3) === "L") {
                current = p.getMatch(g.elementdecl);
              } else if (p.char(3) === "N") {
                current = p.getMatch(g.EntityDecl);
              }
              break;
            case "A":
              current = p.getMatch(g.AttlistDecl);
              break;
            case "N":
              current = p.getMatch(g.NotationDecl);
              break;
            case "-":
              current = p.getMatch(g.Comment);
              break;
          }
        } else if (p.char() === "<" && p.char(1) === "?") {
          current = parsePI(p, errorHandler);
        } else if (p.char() === "%") {
          current = p.getMatch(g.PEReference);
        } else {
          return errorHandler.fatalError("Error detected in Markup declaration");
        }
        if (!current) {
          return errorHandler.fatalError("Error in internal subset at position " + p.getIndex());
        }
      }
      return errorHandler.fatalError("doctype internal subset is not well-formed, missing ]");
    }
  }
  function parseDoctypeCommentOrCData(source, start, domBuilder, errorHandler, isHTML) {
    var p = parseUtils(source, start);
    switch (isHTML ? p.char(2).toUpperCase() : p.char(2)) {
      case "-":
        var comment = p.getMatch(g.Comment);
        if (comment) {
          domBuilder.comment(comment, g.COMMENT_START.length, comment.length - g.COMMENT_START.length - g.COMMENT_END.length);
          return p.getIndex();
        } else {
          return errorHandler.fatalError("comment is not well-formed at position " + p.getIndex());
        }
      case "[":
        var cdata = p.getMatch(g.CDSect);
        if (cdata) {
          if (!isHTML && !domBuilder.currentElement) {
            return errorHandler.fatalError("CDATA outside of element");
          }
          domBuilder.startCDATA();
          domBuilder.characters(cdata, g.CDATA_START.length, cdata.length - g.CDATA_START.length - g.CDATA_END.length);
          domBuilder.endCDATA();
          return p.getIndex();
        } else {
          return errorHandler.fatalError("Invalid CDATA starting at position " + start);
        }
      case "D": {
        if (domBuilder.doc && domBuilder.doc.documentElement) {
          return errorHandler.fatalError("Doctype not allowed inside or after documentElement at position " + p.getIndex());
        }
        if (isHTML ? !p.substringStartsWithCaseInsensitive(g.DOCTYPE_DECL_START) : !p.substringStartsWith(g.DOCTYPE_DECL_START)) {
          return errorHandler.fatalError("Expected " + g.DOCTYPE_DECL_START + " at position " + p.getIndex());
        }
        p.skip(g.DOCTYPE_DECL_START.length);
        if (p.skipBlanks() < 1) {
          return errorHandler.fatalError("Expected whitespace after " + g.DOCTYPE_DECL_START + " at position " + p.getIndex());
        }
        var doctype = {
          name: void 0,
          publicId: void 0,
          systemId: void 0,
          internalSubset: void 0
        };
        doctype.name = p.getMatch(g.Name);
        if (!doctype.name)
          return errorHandler.fatalError("doctype name missing or contains unexpected characters at position " + p.getIndex());
        if (isHTML && doctype.name.toLowerCase() !== "html") {
          errorHandler.warning("Unexpected DOCTYPE in HTML document at position " + p.getIndex());
        }
        p.skipBlanks();
        if (p.substringStartsWith(g.PUBLIC) || p.substringStartsWith(g.SYSTEM)) {
          var match = g.ExternalID_match.exec(p.substringFromIndex());
          if (!match) {
            return errorHandler.fatalError("doctype external id is not well-formed at position " + p.getIndex());
          }
          if (match.groups.SystemLiteralOnly !== void 0) {
            doctype.systemId = match.groups.SystemLiteralOnly;
          } else {
            doctype.systemId = match.groups.SystemLiteral;
            doctype.publicId = match.groups.PubidLiteral;
          }
          p.skip(match[0].length);
        } else if (isHTML && p.substringStartsWithCaseInsensitive(g.SYSTEM)) {
          p.skip(g.SYSTEM.length);
          if (p.skipBlanks() < 1) {
            return errorHandler.fatalError("Expected whitespace after " + g.SYSTEM + " at position " + p.getIndex());
          }
          doctype.systemId = p.getMatch(g.ABOUT_LEGACY_COMPAT_SystemLiteral);
          if (!doctype.systemId) {
            return errorHandler.fatalError(
              "Expected " + g.ABOUT_LEGACY_COMPAT + " in single or double quotes after " + g.SYSTEM + " at position " + p.getIndex()
            );
          }
        }
        if (isHTML && doctype.systemId && !g.ABOUT_LEGACY_COMPAT_SystemLiteral.test(doctype.systemId)) {
          errorHandler.warning("Unexpected doctype.systemId in HTML document at position " + p.getIndex());
        }
        if (!isHTML) {
          p.skipBlanks();
          doctype.internalSubset = parseDoctypeInternalSubset(p, errorHandler);
        }
        p.skipBlanks();
        if (p.char() !== ">") {
          return errorHandler.fatalError("doctype not terminated with > at position " + p.getIndex());
        }
        p.skip(1);
        domBuilder.startDTD(doctype.name, doctype.publicId, doctype.systemId, doctype.internalSubset);
        domBuilder.endDTD();
        return p.getIndex();
      }
      default:
        return errorHandler.fatalError('Not well-formed XML starting with "<!" at position ' + start);
    }
  }
  function parseProcessingInstruction(source, start, domBuilder, errorHandler) {
    var match = source.substring(start).match(g.PI);
    if (!match) {
      return errorHandler.fatalError("Invalid processing instruction starting at position " + start);
    }
    if (match[1].toLowerCase() === "xml") {
      if (start > 0) {
        return errorHandler.fatalError(
          "processing instruction at position " + start + " is an xml declaration which is only at the start of the document"
        );
      }
      if (!g.XMLDecl.test(source.substring(start))) {
        return errorHandler.fatalError("xml declaration is not well-formed");
      }
    }
    domBuilder.processingInstruction(match[1], match[2]);
    return start + match[0].length;
  }
  function ElementAttributes() {
    this.attributeNames = /* @__PURE__ */ Object.create(null);
  }
  ElementAttributes.prototype = {
    setTagName: function(tagName) {
      if (!g.QName_exact.test(tagName)) {
        throw new Error("invalid tagName:" + tagName);
      }
      this.tagName = tagName;
    },
    addValue: function(qName, value2, offset) {
      if (!g.QName_exact.test(qName)) {
        throw new Error("invalid attribute:" + qName);
      }
      this.attributeNames[qName] = this.length;
      this[this.length++] = { qName, value: value2, offset };
    },
    length: 0,
    getLocalName: function(i) {
      return this[i].localName;
    },
    getLocator: function(i) {
      return this[i].locator;
    },
    getQName: function(i) {
      return this[i].qName;
    },
    getURI: function(i) {
      return this[i].uri;
    },
    getValue: function(i) {
      return this[i].value;
    }
    //	,getIndex:function(uri, localName)){
    //		if(localName){
    //
    //		}else{
    //			var qName = uri
    //		}
    //	},
    //	getValue:function(){return this.getValue(this.getIndex.apply(this,arguments))},
    //	getType:function(uri,localName){}
    //	getType:function(i){},
  };
  sax.XMLReader = XMLReader;
  sax.parseUtils = parseUtils;
  sax.parseDoctypeCommentOrCData = parseDoctypeCommentOrCData;
  return sax;
}
var hasRequiredDomParser;
function requireDomParser() {
  if (hasRequiredDomParser) return domParser;
  hasRequiredDomParser = 1;
  var conventions2 = requireConventions();
  var dom2 = requireDom();
  var errors2 = requireErrors();
  var entities2 = requireEntities();
  var sax2 = requireSax();
  var DOMImplementation = dom2.DOMImplementation;
  var hasDefaultHTMLNamespace = conventions2.hasDefaultHTMLNamespace;
  var isHTMLMimeType = conventions2.isHTMLMimeType;
  var isValidMimeType = conventions2.isValidMimeType;
  var MIME_TYPE = conventions2.MIME_TYPE;
  var NAMESPACE = conventions2.NAMESPACE;
  var ParseError2 = errors2.ParseError;
  var XMLReader = sax2.XMLReader;
  function normalizeLineEndings(input) {
    return input.replace(/\r[\n\u0085]/g, "\n").replace(/[\r\u0085\u2028\u2029]/g, "\n");
  }
  function DOMParser(options) {
    options = options || {};
    if (options.locator === void 0) {
      options.locator = true;
    }
    this.assign = options.assign || conventions2.assign;
    this.domHandler = options.domHandler || DOMHandler;
    this.onError = options.onError || options.errorHandler;
    if (options.errorHandler && typeof options.errorHandler !== "function") {
      throw new TypeError("errorHandler object is no longer supported, switch to onError!");
    } else if (options.errorHandler) {
      options.errorHandler("warning", "The `errorHandler` option has been deprecated, use `onError` instead!", this);
    }
    this.normalizeLineEndings = options.normalizeLineEndings || normalizeLineEndings;
    this.locator = !!options.locator;
    this.xmlns = this.assign(/* @__PURE__ */ Object.create(null), options.xmlns);
  }
  DOMParser.prototype.parseFromString = function(source, mimeType) {
    if (!isValidMimeType(mimeType)) {
      throw new TypeError('DOMParser.parseFromString: the provided mimeType "' + mimeType + '" is not valid.');
    }
    var defaultNSMap = this.assign(/* @__PURE__ */ Object.create(null), this.xmlns);
    var entityMap = entities2.XML_ENTITIES;
    var defaultNamespace = defaultNSMap[""] || null;
    if (hasDefaultHTMLNamespace(mimeType)) {
      entityMap = entities2.HTML_ENTITIES;
      defaultNamespace = NAMESPACE.HTML;
    } else if (mimeType === MIME_TYPE.XML_SVG_IMAGE) {
      defaultNamespace = NAMESPACE.SVG;
    }
    defaultNSMap[""] = defaultNamespace;
    defaultNSMap.xml = defaultNSMap.xml || NAMESPACE.XML;
    var domBuilder = new this.domHandler({
      mimeType,
      defaultNamespace,
      onError: this.onError
    });
    var locator = this.locator ? {} : void 0;
    if (this.locator) {
      domBuilder.setDocumentLocator(locator);
    }
    var sax3 = new XMLReader();
    sax3.errorHandler = domBuilder;
    sax3.domBuilder = domBuilder;
    var isXml = !conventions2.isHTMLMimeType(mimeType);
    if (isXml && typeof source !== "string") {
      sax3.errorHandler.fatalError("source is not a string");
    }
    sax3.parse(this.normalizeLineEndings(String(source)), defaultNSMap, entityMap);
    if (!domBuilder.doc.documentElement) {
      sax3.errorHandler.fatalError("missing root element");
    }
    return domBuilder.doc;
  };
  function DOMHandler(options) {
    var opt = options || {};
    this.mimeType = opt.mimeType || MIME_TYPE.XML_APPLICATION;
    this.defaultNamespace = opt.defaultNamespace || null;
    this.cdata = false;
    this.currentElement = void 0;
    this.doc = void 0;
    this.locator = void 0;
    this.onError = opt.onError;
  }
  function position(locator, node2) {
    node2.lineNumber = locator.lineNumber;
    node2.columnNumber = locator.columnNumber;
  }
  DOMHandler.prototype = {
    /**
     * Either creates an XML or an HTML document and stores it under `this.doc`.
     * If it is an XML document, `this.defaultNamespace` is used to create it,
     * and it will not contain any `childNodes`.
     * If it is an HTML document, it will be created without any `childNodes`.
     *
     * @see http://www.saxproject.org/apidoc/org/xml/sax/ContentHandler.html
     */
    startDocument: function() {
      var impl = new DOMImplementation();
      this.doc = isHTMLMimeType(this.mimeType) ? impl.createHTMLDocument(false) : impl.createDocument(this.defaultNamespace, "");
    },
    startElement: function(namespaceURI, localName, qName, attrs) {
      var doc = this.doc;
      var el = doc.createElementNS(namespaceURI, qName || localName);
      var len = attrs.length;
      appendElement(this, el);
      this.currentElement = el;
      this.locator && position(this.locator, el);
      for (var i = 0; i < len; i++) {
        var namespaceURI = attrs.getURI(i);
        var value2 = attrs.getValue(i);
        var qName = attrs.getQName(i);
        var attr = doc.createAttributeNS(namespaceURI, qName);
        this.locator && position(attrs.getLocator(i), attr);
        attr.value = attr.nodeValue = value2;
        el.setAttributeNode(attr);
      }
    },
    endElement: function(namespaceURI, localName, qName) {
      this.currentElement = this.currentElement.parentNode;
    },
    startPrefixMapping: function(prefix, uri) {
    },
    endPrefixMapping: function(prefix) {
    },
    processingInstruction: function(target, data) {
      var ins = this.doc.createProcessingInstruction(target, data);
      this.locator && position(this.locator, ins);
      appendElement(this, ins);
    },
    ignorableWhitespace: function(ch3, start, length2) {
    },
    characters: function(chars, start, length2) {
      chars = _toString.apply(this, arguments);
      if (chars) {
        if (this.cdata) {
          var charNode = this.doc.createCDATASection(chars);
        } else {
          var charNode = this.doc.createTextNode(chars);
        }
        if (this.currentElement) {
          this.currentElement.appendChild(charNode);
        } else if (/^\s*$/.test(chars)) {
          this.doc.appendChild(charNode);
        }
        this.locator && position(this.locator, charNode);
      }
    },
    skippedEntity: function(name2) {
    },
    endDocument: function() {
      this.doc.normalize();
    },
    /**
     * Stores the locator to be able to set the `columnNumber` and `lineNumber`
     * on the created DOM nodes.
     *
     * @param {Locator} locator
     */
    setDocumentLocator: function(locator) {
      if (locator) {
        locator.lineNumber = 0;
      }
      this.locator = locator;
    },
    //LexicalHandler
    comment: function(chars, start, length2) {
      chars = _toString.apply(this, arguments);
      var comm = this.doc.createComment(chars);
      this.locator && position(this.locator, comm);
      appendElement(this, comm);
    },
    startCDATA: function() {
      this.cdata = true;
    },
    endCDATA: function() {
      this.cdata = false;
    },
    startDTD: function(name2, publicId, systemId, internalSubset) {
      var impl = this.doc.implementation;
      if (impl && impl.createDocumentType) {
        var dt = impl.createDocumentType(name2, publicId, systemId, internalSubset);
        this.locator && position(this.locator, dt);
        appendElement(this, dt);
        this.doc.doctype = dt;
      }
    },
    reportError: function(level, message) {
      if (typeof this.onError === "function") {
        try {
          this.onError(level, message, this);
        } catch (e) {
          throw new ParseError2("Reporting " + level + ' "' + message + '" caused ' + e, this.locator);
        }
      } else {
        console.error("[xmldom " + level + "]	" + message, _locator(this.locator));
      }
    },
    /**
     * @see http://www.saxproject.org/apidoc/org/xml/sax/ErrorHandler.html
     */
    warning: function(message) {
      this.reportError("warning", message);
    },
    error: function(message) {
      this.reportError("error", message);
    },
    /**
     * This function reports a fatal error and throws a ParseError.
     *
     * @param {string} message
     * - The message to be used for reporting and throwing the error.
     * @returns {never}
     * This function always throws an error and never returns a value.
     * @throws {ParseError}
     * Always throws a ParseError with the provided message.
     */
    fatalError: function(message) {
      this.reportError("fatalError", message);
      throw new ParseError2(message, this.locator);
    }
  };
  function _locator(l) {
    if (l) {
      return "\n@#[line:" + l.lineNumber + ",col:" + l.columnNumber + "]";
    }
  }
  function _toString(chars, start, length2) {
    if (typeof chars == "string") {
      return chars.substr(start, length2);
    } else {
      if (chars.length >= start + length2 || start) {
        return new java.lang.String(chars, start, length2) + "";
      }
      return chars;
    }
  }
  "endDTD,startEntity,endEntity,attributeDecl,elementDecl,externalEntityDecl,internalEntityDecl,resolveEntity,getExternalSubset,notationDecl,unparsedEntityDecl".replace(
    /\w+/g,
    function(key) {
      DOMHandler.prototype[key] = function() {
        return null;
      };
    }
  );
  function appendElement(handler, node2) {
    if (!handler.currentElement) {
      handler.doc.appendChild(node2);
    } else {
      handler.currentElement.appendChild(node2);
    }
  }
  function onErrorStopParsing(level) {
    if (level === "error") throw "onErrorStopParsing";
  }
  function onWarningStopParsing() {
    throw "onWarningStopParsing";
  }
  domParser.__DOMHandler = DOMHandler;
  domParser.DOMParser = DOMParser;
  domParser.normalizeLineEndings = normalizeLineEndings;
  domParser.onErrorStopParsing = onErrorStopParsing;
  domParser.onWarningStopParsing = onWarningStopParsing;
  return domParser;
}
var hasRequiredLib;
function requireLib() {
  if (hasRequiredLib) return lib;
  hasRequiredLib = 1;
  var conventions2 = requireConventions();
  lib.assign = conventions2.assign;
  lib.hasDefaultHTMLNamespace = conventions2.hasDefaultHTMLNamespace;
  lib.isHTMLMimeType = conventions2.isHTMLMimeType;
  lib.isValidMimeType = conventions2.isValidMimeType;
  lib.MIME_TYPE = conventions2.MIME_TYPE;
  lib.NAMESPACE = conventions2.NAMESPACE;
  var errors2 = requireErrors();
  lib.DOMException = errors2.DOMException;
  lib.DOMExceptionName = errors2.DOMExceptionName;
  lib.ExceptionCode = errors2.ExceptionCode;
  lib.ParseError = errors2.ParseError;
  var dom2 = requireDom();
  lib.Attr = dom2.Attr;
  lib.CDATASection = dom2.CDATASection;
  lib.CharacterData = dom2.CharacterData;
  lib.Comment = dom2.Comment;
  lib.Document = dom2.Document;
  lib.DocumentFragment = dom2.DocumentFragment;
  lib.DocumentType = dom2.DocumentType;
  lib.DOMImplementation = dom2.DOMImplementation;
  lib.Element = dom2.Element;
  lib.Entity = dom2.Entity;
  lib.EntityReference = dom2.EntityReference;
  lib.LiveNodeList = dom2.LiveNodeList;
  lib.NamedNodeMap = dom2.NamedNodeMap;
  lib.Node = dom2.Node;
  lib.NodeList = dom2.NodeList;
  lib.Notation = dom2.Notation;
  lib.ProcessingInstruction = dom2.ProcessingInstruction;
  lib.Text = dom2.Text;
  lib.XMLSerializer = dom2.XMLSerializer;
  var domParser2 = requireDomParser();
  lib.DOMParser = domParser2.DOMParser;
  lib.normalizeLineEndings = domParser2.normalizeLineEndings;
  lib.onErrorStopParsing = domParser2.onErrorStopParsing;
  lib.onWarningStopParsing = domParser2.onWarningStopParsing;
  return lib;
}
var libExports = requireLib();
const XLINK_NS = "http://www.w3.org/1999/xlink";
function nodeListToArray(list) {
  const result = [];
  if (!list) return result;
  for (let i = 0; i < list.length; i++) {
    const item = list.item(i);
    if (item) result.push(item);
  }
  return result;
}
function getElementChildren(el) {
  return nodeListToArray(el.childNodes).filter((child) => child.nodeType === 1);
}
function normalizeHTMLVoidTags(str) {
  return str.replace(/<!DOCTYPE[^>]*>/gi, "").replace(
    /<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)(\s[^<>]*?)?>/gi,
    (match, tagName, attrs = "") => match.endsWith("/>") ? match : `<${tagName}${attrs}/>`
  );
}
function encodeBase64(data) {
  var _a2;
  const wxLike = globalThis;
  const toBase64 = (_a2 = wxLike.wx) == null ? void 0 : _a2.arrayBufferToBase64;
  const buffer = typeof data === "string" ? stringToArrayBuffer(data) : data;
  if (toBase64) return toBase64(buffer);
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const btoa2 = globalThis.btoa;
  if (btoa2) return btoa2(binary);
  throw new EBookError("No base64 encoder available in this environment", "ADAPTER_ERROR");
}
function stringToArrayBuffer(value2) {
  const buffer = new ArrayBuffer(value2.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < value2.length; i++) view[i] = value2.charCodeAt(i);
  return buffer;
}
function isBlobLike(value2) {
  return !!value2 && typeof value2 === "object" && "type" in value2 && "arrayBuffer" in value2;
}
function getWechatMiniProgramFileSystem() {
  var _a2, _b2;
  const wxLike = globalThis.wx;
  const root = (_a2 = wxLike == null ? void 0 : wxLike.env) == null ? void 0 : _a2.USER_DATA_PATH;
  const fs = (_b2 = wxLike == null ? void 0 : wxLike.getFileSystemManager) == null ? void 0 : _b2.call(wxLike);
  return root && fs ? { fs, root } : null;
}
function getMimeExtension(mimeType) {
  const normalized = mimeType.split(";", 1)[0].trim().toLowerCase();
  switch (normalized) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/gif":
      return "gif";
    case "image/webp":
      return "webp";
    case "image/svg+xml":
      return "svg";
    case "image/bmp":
      return "bmp";
    default:
      return "bin";
  }
}
function debugResource(message, details) {
  debugRebook("wechat-url", message, details);
}
class MiniProgramXMLNode {
  constructor(node2, parent = null) {
    this.node = node2;
    this.parent = parent;
  }
  get nodeType() {
    return this.node.nodeType;
  }
  get textContent() {
    var _a2;
    return (_a2 = this.node.textContent) != null ? _a2 : null;
  }
  set textContent(value2) {
    this.node.textContent = value2 != null ? value2 : "";
  }
  get parentNode() {
    if (this.parent) return this.parent;
    const parent = this.node.parentNode;
    return (parent == null ? void 0 : parent.nodeType) === 1 ? new MiniProgramXMLElement(parent) : null;
  }
}
class MiniProgramXMLText extends MiniProgramXMLNode {
  constructor(node2, parent = null) {
    super(node2, parent);
  }
  get nodeType() {
    return 3;
  }
  get textContent() {
    return this.node.textContent || "";
  }
  set textContent(value2) {
    this.node.textContent = value2;
  }
}
class MiniProgramXMLElement extends MiniProgramXMLNode {
  constructor(el) {
    super(el);
    this.el = el;
  }
  get nodeType() {
    return 1;
  }
  get localName() {
    return this.el.localName || this.el.nodeName;
  }
  get namespaceURI() {
    return this.el.namespaceURI || null;
  }
  get children() {
    return getElementChildren(this.el).map((child) => new MiniProgramXMLElement(child));
  }
  get textContent() {
    var _a2;
    return (_a2 = this.el.textContent) != null ? _a2 : null;
  }
  set textContent(value2) {
    this.el.textContent = value2 != null ? value2 : "";
  }
  get attributes() {
    return nodeListToArray(this.el.attributes).map((attr) => ({
      localName: attr.localName || attr.name,
      namespaceURI: attr.namespaceURI || null,
      value: attr.value
    }));
  }
  get ownerDocument() {
    return this.el.ownerDocument ? new MiniProgramXMLDocument(this.el.ownerDocument) : null;
  }
  getAttribute(name2) {
    return this.el.getAttribute(name2);
  }
  getAttributeNS(ns, name2) {
    return this.el.getAttributeNS(ns, name2);
  }
  hasAttribute(name2) {
    return this.el.hasAttribute(name2);
  }
  setAttribute(name2, value2) {
    this.el.setAttribute(name2, value2);
  }
  setAttributeNS(ns, name2, value2) {
    this.el.setAttributeNS(ns, name2, value2);
  }
  querySelector(selector2) {
    var _a2;
    if (selector2 === "parsererror") return null;
    if (selector2.startsWith("#")) {
      const el = (_a2 = this.el.ownerDocument) == null ? void 0 : _a2.getElementById(selector2.slice(1));
      return el ? new MiniProgramXMLElement(el) : null;
    }
    const attrValueMatch = selector2.match(/^\[(\w+)="([^"]+)"\]$/);
    if (attrValueMatch) {
      const [, attrName, attrValue] = attrValueMatch;
      const found = this.findByAttribute(attrName, attrValue);
      return found ? new MiniProgramXMLElement(found) : null;
    }
    if (/^[a-zA-Z][\w-]*$/.test(selector2)) {
      const elements = this.el.getElementsByTagName(selector2);
      return elements.length > 0 ? new MiniProgramXMLElement(elements.item(0)) : null;
    }
    return null;
  }
  querySelectorAll(selector2) {
    if (/^[a-zA-Z][\w-]*$/.test(selector2)) {
      return nodeListToArray(this.el.getElementsByTagName(selector2)).map(
        (child) => new MiniProgramXMLElement(child)
      );
    }
    const results = [];
    const tagAttrMatch = selector2.match(/^(\w+)\[(\w+)\]$/);
    if (tagAttrMatch) {
      const [, tagName, attrName] = tagAttrMatch;
      nodeListToArray(this.el.getElementsByTagName(tagName)).forEach((el) => {
        if (el.hasAttribute(attrName)) results.push(el);
      });
      return results.map((el) => new MiniProgramXMLElement(el));
    }
    const attrMatch = selector2.match(/^\[(?:\*\|)?(\w+)\]/);
    if (!attrMatch) return [];
    this.collectWithAttribute(attrMatch[1], results);
    return results.map((el) => new MiniProgramXMLElement(el));
  }
  getElementsByTagNameNS(ns, name2) {
    return nodeListToArray(this.el.getElementsByTagNameNS(ns, name2)).map(
      (child) => new MiniProgramXMLElement(child)
    );
  }
  getElementsByTagName(name2) {
    return nodeListToArray(this.el.getElementsByTagName(name2)).map(
      (child) => new MiniProgramXMLElement(child)
    );
  }
  lookupNamespaceURI(prefix) {
    return this.el.lookupNamespaceURI(prefix);
  }
  lookupPrefix(ns) {
    return this.el.lookupPrefix(ns);
  }
  toNative() {
    return this.el;
  }
  findByAttribute(name2, value2) {
    if (this.el.getAttribute(name2) === value2) return this.el;
    for (const child of getElementChildren(this.el)) {
      const found = new MiniProgramXMLElement(child).findByAttribute(name2, value2);
      if (found) return found;
    }
    return null;
  }
  collectWithAttribute(attrName, results) {
    if (this.el.hasAttribute(attrName) || attrName === "href" && this.el.getAttributeNS(XLINK_NS, "href") || this.el.getAttributeNS(XLINK_NS, attrName)) {
      results.push(this.el);
    }
    getElementChildren(this.el).forEach((child) => {
      new MiniProgramXMLElement(child).collectWithAttribute(attrName, results);
    });
  }
}
class MiniProgramXMLDocument {
  constructor(doc) {
    this.doc = doc;
  }
  get documentElement() {
    return new MiniProgramXMLElement(this.doc.documentElement);
  }
  getElementById(id) {
    const el = this.doc.getElementById(id);
    return el ? new MiniProgramXMLElement(el) : null;
  }
  getElementsByTagNameNS(ns, name2) {
    return nodeListToArray(this.doc.getElementsByTagNameNS(ns, name2)).map(
      (child) => new MiniProgramXMLElement(child)
    );
  }
  getElementsByTagName(name2) {
    return nodeListToArray(this.doc.getElementsByTagName(name2)).map(
      (child) => new MiniProgramXMLElement(child)
    );
  }
  querySelector(selector2) {
    if (selector2 === "parsererror") return null;
    if (selector2.startsWith("#")) return this.getElementById(selector2.slice(1));
    const attrValueMatch = selector2.match(/^\[(\w+)="([^"]+)"\]$/);
    if (attrValueMatch) {
      const [, attrName, attrValue] = attrValueMatch;
      return this.querySelectorAll(`[${attrName}]`).find(
        (el) => el.getAttribute(attrName) === attrValue
      ) || null;
    }
    if (/^[a-zA-Z][\w-]*$/.test(selector2)) {
      const elements = this.doc.getElementsByTagName(selector2);
      return elements.length > 0 ? new MiniProgramXMLElement(elements.item(0)) : null;
    }
    return null;
  }
  querySelectorAll(selector2) {
    if (/^[a-zA-Z][\w-]*$/.test(selector2)) {
      return this.getElementsByTagName(selector2);
    }
    const tagAttrMatch = selector2.match(/^(\w+)\[(\w+)\]$/);
    if (tagAttrMatch) {
      const [, tagName, attrName2] = tagAttrMatch;
      return this.getElementsByTagName(tagName).filter((el) => el.hasAttribute(attrName2));
    }
    const attrMatch = selector2.match(/^\[(?:\*\|)?(\w+)\]/);
    if (!attrMatch) return [];
    const attrName = attrMatch[1];
    const results = [];
    const walk2 = (el) => {
      if (el.hasAttribute(attrName) || attrName === "href" && el.getAttributeNS(XLINK_NS, "href") || el.getAttributeNS(XLINK_NS, attrName)) {
        results.push(el);
      }
      el.children.forEach(walk2);
    };
    walk2(this.documentElement);
    return results;
  }
  lookupNamespaceURI(prefix) {
    return this.doc.lookupNamespaceURI(prefix);
  }
  lookupPrefix(ns) {
    return this.doc.lookupPrefix(ns);
  }
  toNative() {
    return this.doc;
  }
}
class WechatMiniProgramDOMAdapter {
  constructor() {
    __publicField(this, "serializer", new libExports.XMLSerializer());
  }
  parseXML(str) {
    return new MiniProgramXMLDocument(new libExports.DOMParser().parseFromString(str, "application/xml"));
  }
  parseHTML(str, _mimeType = "text/html") {
    return new MiniProgramXMLDocument(
      new libExports.DOMParser().parseFromString(normalizeHTMLVoidTags(str), "text/html")
    );
  }
  serialize(doc) {
    var _a2;
    const nativeDoc = (_a2 = doc.toNative) == null ? void 0 : _a2.call(doc);
    if (!nativeDoc) throw new EBookError("XMLDocument does not support toNative()", "ADAPTER_ERROR");
    return this.serializer.serializeToString(nativeDoc);
  }
  getChildNodes(element) {
    var _a2;
    const nativeElement = (_a2 = element.toNative) == null ? void 0 : _a2.call(element);
    if (!nativeElement || !nativeElement.childNodes) return element.children;
    return nodeListToArray(nativeElement.childNodes).map((child) => {
      if (child.nodeType === 1) return new MiniProgramXMLElement(child);
      if (child.nodeType === 3) return new MiniProgramXMLText(child, element);
      return new MiniProgramXMLNode(child, element);
    });
  }
}
class WechatMiniProgramURLFactory {
  constructor() {
    __publicField(this, "counter", 0);
    __publicField(this, "urls", /* @__PURE__ */ new Map());
  }
  createURL(data, mimeType = "application/octet-stream") {
    if (isBlobLike(data)) {
      throw new EBookError(
        "WechatMiniProgramURLFactory cannot synchronously encode Blob data; pass ArrayBuffer or string data instead",
        "ADAPTER_ERROR"
      );
    }
    const fsInfo = getWechatMiniProgramFileSystem();
    if (fsInfo && mimeType.startsWith("image/")) {
      const ext = getMimeExtension(mimeType);
      const url2 = `${fsInfo.root}/rebook-resource-${Date.now()}-${this.counter++}.${ext}`;
      try {
        if (typeof data === "string") {
          fsInfo.fs.writeFileSync(url2, data, "utf8");
        } else {
          fsInfo.fs.writeFileSync(url2, data);
        }
        this.urls.set(url2, { data, mimeType, localPath: url2 });
        debugResource("wrote image resource", {
          url: url2,
          mimeType,
          bytes: typeof data === "string" ? data.length : data.byteLength
        });
        return url2;
      } catch (error) {
        debugResource("failed to write image resource, falling back to data URL", {
          mimeType,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    } else if (mimeType.startsWith("image/")) {
      debugResource("mini program filesystem unavailable, falling back to data URL", { mimeType });
    }
    const url = `data:${mimeType};base64,${encodeBase64(data)}`;
    this.urls.set(url, { data, mimeType });
    return url;
  }
  revokeURL(url) {
    var _a2, _b2, _c;
    const entry = this.urls.get(url);
    if (entry == null ? void 0 : entry.localPath) {
      try {
        (_c = (_a2 = getWechatMiniProgramFileSystem()) == null ? void 0 : (_b2 = _a2.fs).unlinkSync) == null ? void 0 : _c.call(_b2, entry.localPath);
      } catch (e) {
      }
    }
    this.urls.delete(url);
  }
  getData(url) {
    return this.urls.get(url);
  }
}
const DEFAULT_BYTES_PER_ESTIMATED_PAGE = 2500;
const DEFAULT_EPSILON = 1e-4;
const normalizeNavigationHref = (href) => (href || "").split("#")[0];
const normalizeBookPath = (href) => {
  const path = normalizeNavigationHref(href).replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
};
function resolveBookNavigation(book, href) {
  var _a2;
  const resolved = (_a2 = book.resolveHref) == null ? void 0 : _a2.call(book, href);
  if (typeof (resolved == null ? void 0 : resolved.index) === "number" && resolved.index >= 0) return resolved;
  const normalizedHref = normalizeBookPath(href);
  if (!normalizedHref) return null;
  const sectionIndex = book.sections.findIndex((section) => {
    var _a3;
    const sectionId = normalizeBookPath(String((_a3 = section.id) != null ? _a3 : ""));
    return sectionId === normalizedHref || sectionId.endsWith(`/${normalizedHref}`);
  });
  return sectionIndex >= 0 ? { index: sectionIndex } : null;
}
function getTotalFraction(location, sectionFractions) {
  var _a2, _b2;
  if (!location || location.index < 0) return 0;
  if (typeof location.totalFraction === "number") return clamp01(location.totalFraction);
  const sectionStart = (_a2 = sectionFractions[location.index]) != null ? _a2 : 0;
  const nextSectionStart = (_b2 = sectionFractions[location.index + 1]) != null ? _b2 : 1;
  const sectionSpan = Math.max(0, nextSectionStart - sectionStart);
  return clamp01(sectionStart + sectionSpan * (location.fraction || 0));
}
function estimatePageLimitFraction(book, options = {}) {
  var _a2, _b2;
  const maxPages = options.maxPages;
  if (!maxPages || maxPages <= 0) return 1;
  const bytesPerEstimatedPage = (_a2 = options.bytesPerEstimatedPage) != null ? _a2 : DEFAULT_BYTES_PER_ESTIMATED_PAGE;
  const totalSectionSize = book.sections.reduce((sum, section) => sum + (section.size || 0), 0);
  const estimatedPages = ((_b2 = book.pageList) == null ? void 0 : _b2.length) || Math.ceil(totalSectionSize / bytesPerEstimatedPage);
  return clamp01(maxPages / Math.max(estimatedPages, maxPages));
}
function getTrialPageStepFraction(book, options = {}) {
  const maxPages = options.maxPages;
  if (!maxPages || maxPages <= 0) return 1;
  return estimatePageLimitFraction(book, options) / maxPages;
}
function getTargetStartFraction(book, sectionFractions, target) {
  var _a2, _b2;
  const index = typeof target === "number" ? target : (_a2 = resolveBookNavigation(book, target)) == null ? void 0 : _a2.index;
  if (typeof index !== "number" || index < 0) return 0;
  return (_b2 = sectionFractions[index]) != null ? _b2 : 0;
}
function canAccessTarget(book, sectionFractions, target, limitFraction, epsilon = DEFAULT_EPSILON) {
  return getTargetStartFraction(book, sectionFractions, target) <= limitFraction + epsilon;
}
function getAllowedTOCHrefs(book, sectionFractions, limitFraction, epsilon = DEFAULT_EPSILON) {
  return getTOCAccessItems(book, sectionFractions, limitFraction, epsilon).filter((item) => !item.disabled).map((item) => normalizeNavigationHref(item.href));
}
function getTOCAccessItems(book, sectionFractions, limitFraction, epsilon = DEFAULT_EPSILON, items = book.toc || [], depth = 0) {
  return items.flatMap((item) => {
    var _a2, _b2, _c;
    const sectionIndex = (_b2 = (_a2 = resolveBookNavigation(book, item.href)) == null ? void 0 : _a2.index) != null ? _b2 : -1;
    const sectionFraction = sectionIndex >= 0 ? (_c = sectionFractions[sectionIndex]) != null ? _c : 0 : 0;
    const disabled = sectionIndex >= 0 && sectionFraction > limitFraction + epsilon;
    return [
      {
        item,
        label: item.label || "Untitled",
        href: item.href,
        depth,
        sectionIndex,
        sectionFraction,
        disabled
      },
      ...getTOCAccessItems(book, sectionFractions, limitFraction, epsilon, item.subitems || [], depth + 1)
    ];
  });
}
function getCurrentTOCAccessItem(items, location) {
  if (!items.length || !location || location.index < 0) return null;
  const exact = items.find((item) => item.sectionIndex === location.index);
  if (exact) return exact;
  for (let index = items.length - 1; index >= 0; index--) {
    const item = items[index];
    if (item && item.sectionIndex >= 0 && item.sectionIndex < location.index) return item;
  }
  return null;
}
function estimateNextTotalFractionFromSnapshot(snapshot, sectionFractions) {
  var _a2;
  if (snapshot.pageIndex < snapshot.pageCount - 1) {
    return getTotalFraction({
      index: snapshot.sectionIndex,
      fraction: snapshot.pageCount > 1 ? (snapshot.pageIndex + 1) / (snapshot.pageCount - 1) : 0
    }, sectionFractions);
  }
  if (snapshot.sectionIndex < snapshot.sectionCount - 1) {
    return (_a2 = sectionFractions[snapshot.sectionIndex + 1]) != null ? _a2 : 1;
  }
  return 1;
}
function willForwardExceedLimit(location, sectionFractions, limitFraction, pageStepFraction, epsilon = DEFAULT_EPSILON) {
  return getTotalFraction(location, sectionFractions) + pageStepFraction > limitFraction + epsilon;
}
function clamp01(value2) {
  if (!Number.isFinite(value2)) return 0;
  return Math.max(0, Math.min(1, value2));
}
var ch2 = {};
var wk = (function(c, id, msg, transfer, cb) {
  var w = new Worker(ch2[id] || (ch2[id] = URL.createObjectURL(new Blob([
    c + ';addEventListener("error",function(e){e=e.error;postMessage({$e$:[e.message,e.code,e.stack]})})'
  ], { type: "text/javascript" }))));
  w.onmessage = function(e) {
    var d = e.data, ed = d.$e$;
    if (ed) {
      var err2 = new Error(ed[0]);
      err2["code"] = ed[1];
      err2.stack = ed[2];
      cb(err2, null);
    } else
      cb(null, d);
  };
  w.postMessage(msg, transfer);
  return w;
});
var u8 = Uint8Array, u16 = Uint16Array, i32 = Int32Array;
var fleb = new u8([
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  1,
  1,
  1,
  2,
  2,
  2,
  2,
  3,
  3,
  3,
  3,
  4,
  4,
  4,
  4,
  5,
  5,
  5,
  5,
  0,
  /* unused */
  0,
  0,
  /* impossible */
  0
]);
var fdeb = new u8([
  0,
  0,
  0,
  0,
  1,
  1,
  2,
  2,
  3,
  3,
  4,
  4,
  5,
  5,
  6,
  6,
  7,
  7,
  8,
  8,
  9,
  9,
  10,
  10,
  11,
  11,
  12,
  12,
  13,
  13,
  /* unused */
  0,
  0
]);
var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
var freb = function(eb, start) {
  var b = new u16(31);
  for (var i = 0; i < 31; ++i) {
    b[i] = start += 1 << eb[i - 1];
  }
  var r = new i32(b[30]);
  for (var i = 1; i < 30; ++i) {
    for (var j = b[i]; j < b[i + 1]; ++j) {
      r[j] = j - b[i] << 5 | i;
    }
  }
  return { b, r };
};
var _a = freb(fleb, 2), fl = _a.b, revfl = _a.r;
fl[28] = 258, revfl[258] = 28;
var _b = freb(fdeb, 0), fd = _b.b, revfd = _b.r;
var rev = new u16(32768);
for (var i = 0; i < 32768; ++i) {
  var x = (i & 43690) >> 1 | (i & 21845) << 1;
  x = (x & 52428) >> 2 | (x & 13107) << 2;
  x = (x & 61680) >> 4 | (x & 3855) << 4;
  rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
}
var hMap = (function(cd, mb, r) {
  var s = cd.length;
  var i = 0;
  var l = new u16(mb);
  for (; i < s; ++i) {
    if (cd[i])
      ++l[cd[i] - 1];
  }
  var le = new u16(mb);
  for (i = 1; i < mb; ++i) {
    le[i] = le[i - 1] + l[i - 1] << 1;
  }
  var co;
  if (r) {
    co = new u16(1 << mb);
    var rvb = 15 - mb;
    for (i = 0; i < s; ++i) {
      if (cd[i]) {
        var sv = i << 4 | cd[i];
        var r_1 = mb - cd[i];
        var v = le[cd[i] - 1]++ << r_1;
        for (var m = v | (1 << r_1) - 1; v <= m; ++v) {
          co[rev[v] >> rvb] = sv;
        }
      }
    }
  } else {
    co = new u16(s);
    for (i = 0; i < s; ++i) {
      if (cd[i]) {
        co[i] = rev[le[cd[i] - 1]++] >> 15 - cd[i];
      }
    }
  }
  return co;
});
var flt = new u8(288);
for (var i = 0; i < 144; ++i)
  flt[i] = 8;
for (var i = 144; i < 256; ++i)
  flt[i] = 9;
for (var i = 256; i < 280; ++i)
  flt[i] = 7;
for (var i = 280; i < 288; ++i)
  flt[i] = 8;
var fdt = new u8(32);
for (var i = 0; i < 32; ++i)
  fdt[i] = 5;
var flm = /* @__PURE__ */ hMap(flt, 9, 0), flrm = /* @__PURE__ */ hMap(flt, 9, 1);
var fdm = /* @__PURE__ */ hMap(fdt, 5, 0), fdrm = /* @__PURE__ */ hMap(fdt, 5, 1);
var max = function(a) {
  var m = a[0];
  for (var i = 1; i < a.length; ++i) {
    if (a[i] > m)
      m = a[i];
  }
  return m;
};
var bits = function(d, p, m) {
  var o = p / 8 | 0;
  return (d[o] | d[o + 1] << 8) >> (p & 7) & m;
};
var bits16 = function(d, p) {
  var o = p / 8 | 0;
  return (d[o] | d[o + 1] << 8 | d[o + 2] << 16) >> (p & 7);
};
var shft = function(p) {
  return (p + 7) / 8 | 0;
};
var slc = function(v, s, e) {
  if (s == null || s < 0)
    s = 0;
  if (e == null || e > v.length)
    e = v.length;
  return new u8(v.subarray(s, e));
};
var FlateErrorCode = {
  UnexpectedEOF: 0,
  InvalidBlockType: 1,
  InvalidLengthLiteral: 2,
  InvalidDistance: 3,
  StreamFinished: 4,
  NoStreamHandler: 5,
  InvalidHeader: 6,
  NoCallback: 7,
  InvalidUTF8: 8,
  ExtraFieldTooLong: 9,
  InvalidDate: 10,
  FilenameTooLong: 11,
  StreamFinishing: 12,
  InvalidZipData: 13,
  UnknownCompressionMethod: 14
};
var ec = [
  "unexpected EOF",
  "invalid block type",
  "invalid length/literal",
  "invalid distance",
  "stream finished",
  "no stream handler",
  ,
  // determined by compression function
  "no callback",
  "invalid UTF-8 data",
  "extra field too long",
  "date not in range 1980-2099",
  "filename too long",
  "stream finishing",
  "invalid zip data"
  // determined by unknown compression method
];
var err = function(ind, msg, nt) {
  var e = new Error(msg || ec[ind]);
  e.code = ind;
  if (Error.captureStackTrace)
    Error.captureStackTrace(e, err);
  if (!nt)
    throw e;
  return e;
};
var inflt = function(dat, st, buf, dict) {
  var sl = dat.length, dl = dict ? dict.length : 0;
  if (!sl || st.f && !st.l)
    return buf || new u8(0);
  var noBuf = !buf;
  var resize = noBuf || st.i != 2;
  var noSt = st.i;
  if (noBuf)
    buf = new u8(sl * 3);
  var cbuf = function(l2) {
    var bl = buf.length;
    if (l2 > bl) {
      var nbuf = new u8(Math.max(bl * 2, l2));
      nbuf.set(buf);
      buf = nbuf;
    }
  };
  var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
  var tbts = sl * 8;
  do {
    if (!lm) {
      final = bits(dat, pos, 1);
      var type = bits(dat, pos + 1, 3);
      pos += 3;
      if (!type) {
        var s = shft(pos) + 4, l = dat[s - 4] | dat[s - 3] << 8, t = s + l;
        if (t > sl) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + l);
        buf.set(dat.subarray(s, t), bt);
        st.b = bt += l, st.p = pos = t * 8, st.f = final;
        continue;
      } else if (type == 1)
        lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
      else if (type == 2) {
        var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
        var tl = hLit + bits(dat, pos + 5, 31) + 1;
        pos += 14;
        var ldt = new u8(tl);
        var clt = new u8(19);
        for (var i = 0; i < hcLen; ++i) {
          clt[clim[i]] = bits(dat, pos + i * 3, 7);
        }
        pos += hcLen * 3;
        var clb = max(clt), clbmsk = (1 << clb) - 1;
        var clm = hMap(clt, clb, 1);
        for (var i = 0; i < tl; ) {
          var r = clm[bits(dat, pos, clbmsk)];
          pos += r & 15;
          var s = r >> 4;
          if (s < 16) {
            ldt[i++] = s;
          } else {
            var c = 0, n = 0;
            if (s == 16)
              n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i - 1];
            else if (s == 17)
              n = 3 + bits(dat, pos, 7), pos += 3;
            else if (s == 18)
              n = 11 + bits(dat, pos, 127), pos += 7;
            while (n--)
              ldt[i++] = c;
          }
        }
        var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
        lbt = max(lt);
        dbt = max(dt);
        lm = hMap(lt, lbt, 1);
        dm = hMap(dt, dbt, 1);
      } else
        err(1);
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
    }
    if (resize)
      cbuf(bt + 131072);
    var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
    var lpos = pos;
    for (; ; lpos = pos) {
      var c = lm[bits16(dat, pos) & lms], sym = c >> 4;
      pos += c & 15;
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
      if (!c)
        err(2);
      if (sym < 256)
        buf[bt++] = sym;
      else if (sym == 256) {
        lpos = pos, lm = null;
        break;
      } else {
        var add = sym - 254;
        if (sym > 264) {
          var i = sym - 257, b = fleb[i];
          add = bits(dat, pos, (1 << b) - 1) + fl[i];
          pos += b;
        }
        var d = dm[bits16(dat, pos) & dms], dsym = d >> 4;
        if (!d)
          err(3);
        pos += d & 15;
        var dt = fd[dsym];
        if (dsym > 3) {
          var b = fdeb[dsym];
          dt += bits16(dat, pos) & (1 << b) - 1, pos += b;
        }
        if (pos > tbts) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + 131072);
        var end = bt + add;
        if (bt < dt) {
          var shift = dl - dt, dend = Math.min(dt, end);
          if (shift + bt < 0)
            err(3);
          for (; bt < dend; ++bt)
            buf[bt] = dict[shift + bt];
        }
        for (; bt < end; ++bt)
          buf[bt] = buf[bt - dt];
      }
    }
    st.l = lm, st.p = lpos, st.b = bt, st.f = final;
    if (lm)
      final = 1, st.m = lbt, st.d = dm, st.n = dbt;
  } while (!final);
  return bt != buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);
};
var wbits = function(d, p, v) {
  v <<= p & 7;
  var o = p / 8 | 0;
  d[o] |= v;
  d[o + 1] |= v >> 8;
};
var wbits16 = function(d, p, v) {
  v <<= p & 7;
  var o = p / 8 | 0;
  d[o] |= v;
  d[o + 1] |= v >> 8;
  d[o + 2] |= v >> 16;
};
var hTree = function(d, mb) {
  var t = [];
  for (var i = 0; i < d.length; ++i) {
    if (d[i])
      t.push({ s: i, f: d[i] });
  }
  var s = t.length;
  var t2 = t.slice();
  if (!s)
    return { t: et, l: 0 };
  if (s == 1) {
    var v = new u8(t[0].s + 1);
    v[t[0].s] = 1;
    return { t: v, l: 1 };
  }
  t.sort(function(a, b) {
    return a.f - b.f;
  });
  t.push({ s: -1, f: 25001 });
  var l = t[0], r = t[1], i0 = 0, i1 = 1, i2 = 2;
  t[0] = { s: -1, f: l.f + r.f, l, r };
  while (i1 != s - 1) {
    l = t[t[i0].f < t[i2].f ? i0++ : i2++];
    r = t[i0 != i1 && t[i0].f < t[i2].f ? i0++ : i2++];
    t[i1++] = { s: -1, f: l.f + r.f, l, r };
  }
  var maxSym = t2[0].s;
  for (var i = 1; i < s; ++i) {
    if (t2[i].s > maxSym)
      maxSym = t2[i].s;
  }
  var tr = new u16(maxSym + 1);
  var mbt = ln(t[i1 - 1], tr, 0);
  if (mbt > mb) {
    var i = 0, dt = 0;
    var lft = mbt - mb, cst = 1 << lft;
    t2.sort(function(a, b) {
      return tr[b.s] - tr[a.s] || a.f - b.f;
    });
    for (; i < s; ++i) {
      var i2_1 = t2[i].s;
      if (tr[i2_1] > mb) {
        dt += cst - (1 << mbt - tr[i2_1]);
        tr[i2_1] = mb;
      } else
        break;
    }
    dt >>= lft;
    while (dt > 0) {
      var i2_2 = t2[i].s;
      if (tr[i2_2] < mb)
        dt -= 1 << mb - tr[i2_2]++ - 1;
      else
        ++i;
    }
    for (; i >= 0 && dt; --i) {
      var i2_3 = t2[i].s;
      if (tr[i2_3] == mb) {
        --tr[i2_3];
        ++dt;
      }
    }
    mbt = mb;
  }
  return { t: new u8(tr), l: mbt };
};
var ln = function(n, l, d) {
  return n.s == -1 ? Math.max(ln(n.l, l, d + 1), ln(n.r, l, d + 1)) : l[n.s] = d;
};
var lc = function(c) {
  var s = c.length;
  while (s && !c[--s])
    ;
  var cl = new u16(++s);
  var cli = 0, cln = c[0], cls = 1;
  var w = function(v) {
    cl[cli++] = v;
  };
  for (var i = 1; i <= s; ++i) {
    if (c[i] == cln && i != s)
      ++cls;
    else {
      if (!cln && cls > 2) {
        for (; cls > 138; cls -= 138)
          w(32754);
        if (cls > 2) {
          w(cls > 10 ? cls - 11 << 5 | 28690 : cls - 3 << 5 | 12305);
          cls = 0;
        }
      } else if (cls > 3) {
        w(cln), --cls;
        for (; cls > 6; cls -= 6)
          w(8304);
        if (cls > 2)
          w(cls - 3 << 5 | 8208), cls = 0;
      }
      while (cls--)
        w(cln);
      cls = 1;
      cln = c[i];
    }
  }
  return { c: cl.subarray(0, cli), n: s };
};
var clen = function(cf, cl) {
  var l = 0;
  for (var i = 0; i < cl.length; ++i)
    l += cf[i] * cl[i];
  return l;
};
var wfblk = function(out, pos, dat) {
  var s = dat.length;
  var o = shft(pos + 2);
  out[o] = s & 255;
  out[o + 1] = s >> 8;
  out[o + 2] = out[o] ^ 255;
  out[o + 3] = out[o + 1] ^ 255;
  for (var i = 0; i < s; ++i)
    out[o + i + 4] = dat[i];
  return (o + 4 + s) * 8;
};
var wblk = function(dat, out, final, syms, lf, df, eb, li, bs, bl, p) {
  wbits(out, p++, final);
  ++lf[256];
  var _a2 = hTree(lf, 15), dlt = _a2.t, mlb = _a2.l;
  var _b2 = hTree(df, 15), ddt = _b2.t, mdb = _b2.l;
  var _c = lc(dlt), lclt = _c.c, nlc = _c.n;
  var _d = lc(ddt), lcdt = _d.c, ndc = _d.n;
  var lcfreq = new u16(19);
  for (var i = 0; i < lclt.length; ++i)
    ++lcfreq[lclt[i] & 31];
  for (var i = 0; i < lcdt.length; ++i)
    ++lcfreq[lcdt[i] & 31];
  var _e = hTree(lcfreq, 7), lct = _e.t, mlcb = _e.l;
  var nlcc = 19;
  for (; nlcc > 4 && !lct[clim[nlcc - 1]]; --nlcc)
    ;
  var flen = bl + 5 << 3;
  var ftlen = clen(lf, flt) + clen(df, fdt) + eb;
  var dtlen = clen(lf, dlt) + clen(df, ddt) + eb + 14 + 3 * nlcc + clen(lcfreq, lct) + 2 * lcfreq[16] + 3 * lcfreq[17] + 7 * lcfreq[18];
  if (bs >= 0 && flen <= ftlen && flen <= dtlen)
    return wfblk(out, p, dat.subarray(bs, bs + bl));
  var lm, ll, dm, dl;
  wbits(out, p, 1 + (dtlen < ftlen)), p += 2;
  if (dtlen < ftlen) {
    lm = hMap(dlt, mlb, 0), ll = dlt, dm = hMap(ddt, mdb, 0), dl = ddt;
    var llm = hMap(lct, mlcb, 0);
    wbits(out, p, nlc - 257);
    wbits(out, p + 5, ndc - 1);
    wbits(out, p + 10, nlcc - 4);
    p += 14;
    for (var i = 0; i < nlcc; ++i)
      wbits(out, p + 3 * i, lct[clim[i]]);
    p += 3 * nlcc;
    var lcts = [lclt, lcdt];
    for (var it = 0; it < 2; ++it) {
      var clct = lcts[it];
      for (var i = 0; i < clct.length; ++i) {
        var len = clct[i] & 31;
        wbits(out, p, llm[len]), p += lct[len];
        if (len > 15)
          wbits(out, p, clct[i] >> 5 & 127), p += clct[i] >> 12;
      }
    }
  } else {
    lm = flm, ll = flt, dm = fdm, dl = fdt;
  }
  for (var i = 0; i < li; ++i) {
    var sym = syms[i];
    if (sym > 255) {
      var len = sym >> 18 & 31;
      wbits16(out, p, lm[len + 257]), p += ll[len + 257];
      if (len > 7)
        wbits(out, p, sym >> 23 & 31), p += fleb[len];
      var dst = sym & 31;
      wbits16(out, p, dm[dst]), p += dl[dst];
      if (dst > 3)
        wbits16(out, p, sym >> 5 & 8191), p += fdeb[dst];
    } else {
      wbits16(out, p, lm[sym]), p += ll[sym];
    }
  }
  wbits16(out, p, lm[256]);
  return p + ll[256];
};
var deo = /* @__PURE__ */ new i32([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]);
var et = /* @__PURE__ */ new u8(0);
var dflt = function(dat, lvl, plvl, pre, post, st) {
  var s = st.z || dat.length;
  var o = new u8(pre + s + 5 * (1 + Math.ceil(s / 7e3)) + post);
  var w = o.subarray(pre, o.length - post);
  var lst = st.l;
  var pos = (st.r || 0) & 7;
  if (lvl) {
    if (pos)
      w[0] = st.r >> 3;
    var opt = deo[lvl - 1];
    var n = opt >> 13, c = opt & 8191;
    var msk_1 = (1 << plvl) - 1;
    var prev = st.p || new u16(32768), head = st.h || new u16(msk_1 + 1);
    var bs1_1 = Math.ceil(plvl / 3), bs2_1 = 2 * bs1_1;
    var hsh = function(i2) {
      return (dat[i2] ^ dat[i2 + 1] << bs1_1 ^ dat[i2 + 2] << bs2_1) & msk_1;
    };
    var syms = new i32(25e3);
    var lf = new u16(288), df = new u16(32);
    var lc_1 = 0, eb = 0, i = st.i || 0, li = 0, wi = st.w || 0, bs = 0;
    for (; i + 2 < s; ++i) {
      var hv = hsh(i);
      var imod = i & 32767, pimod = head[hv];
      prev[imod] = pimod;
      head[hv] = imod;
      if (wi <= i) {
        var rem = s - i;
        if ((lc_1 > 7e3 || li > 24576) && (rem > 423 || !lst)) {
          pos = wblk(dat, w, 0, syms, lf, df, eb, li, bs, i - bs, pos);
          li = lc_1 = eb = 0, bs = i;
          for (var j = 0; j < 286; ++j)
            lf[j] = 0;
          for (var j = 0; j < 30; ++j)
            df[j] = 0;
        }
        var l = 2, d = 0, ch_1 = c, dif = imod - pimod & 32767;
        if (rem > 2 && hv == hsh(i - dif)) {
          var maxn = Math.min(n, rem) - 1;
          var maxd = Math.min(32767, i);
          var ml = Math.min(258, rem);
          while (dif <= maxd && --ch_1 && imod != pimod) {
            if (dat[i + l] == dat[i + l - dif]) {
              var nl = 0;
              for (; nl < ml && dat[i + nl] == dat[i + nl - dif]; ++nl)
                ;
              if (nl > l) {
                l = nl, d = dif;
                if (nl > maxn)
                  break;
                var mmd = Math.min(dif, nl - 2);
                var md = 0;
                for (var j = 0; j < mmd; ++j) {
                  var ti = i - dif + j & 32767;
                  var pti = prev[ti];
                  var cd = ti - pti & 32767;
                  if (cd > md)
                    md = cd, pimod = ti;
                }
              }
            }
            imod = pimod, pimod = prev[imod];
            dif += imod - pimod & 32767;
          }
        }
        if (d) {
          syms[li++] = 268435456 | revfl[l] << 18 | revfd[d];
          var lin = revfl[l] & 31, din = revfd[d] & 31;
          eb += fleb[lin] + fdeb[din];
          ++lf[257 + lin];
          ++df[din];
          wi = i + l;
          ++lc_1;
        } else {
          syms[li++] = dat[i];
          ++lf[dat[i]];
        }
      }
    }
    for (i = Math.max(i, wi); i < s; ++i) {
      syms[li++] = dat[i];
      ++lf[dat[i]];
    }
    pos = wblk(dat, w, lst, syms, lf, df, eb, li, bs, i - bs, pos);
    if (!lst) {
      st.r = pos & 7 | w[pos / 8 | 0] << 3;
      pos -= 7;
      st.h = head, st.p = prev, st.i = i, st.w = wi;
    }
  } else {
    for (var i = st.w || 0; i < s + lst; i += 65535) {
      var e = i + 65535;
      if (e >= s) {
        w[pos / 8 | 0] = lst;
        e = s;
      }
      pos = wfblk(w, pos + 1, dat.subarray(i, e));
    }
    st.i = s;
  }
  return slc(o, 0, pre + shft(pos) + post);
};
var crct = /* @__PURE__ */ (function() {
  var t = new Int32Array(256);
  for (var i = 0; i < 256; ++i) {
    var c = i, k = 9;
    while (--k)
      c = (c & 1 && -306674912) ^ c >>> 1;
    t[i] = c;
  }
  return t;
})();
var crc = function() {
  var c = -1;
  return {
    p: function(d) {
      var cr = c;
      for (var i = 0; i < d.length; ++i)
        cr = crct[cr & 255 ^ d[i]] ^ cr >>> 8;
      c = cr;
    },
    d: function() {
      return ~c;
    }
  };
};
var adler = function() {
  var a = 1, b = 0;
  return {
    p: function(d) {
      var n = a, m = b;
      var l = d.length | 0;
      for (var i = 0; i != l; ) {
        var e = Math.min(i + 2655, l);
        for (; i < e; ++i)
          m += n += d[i];
        n = (n & 65535) + 15 * (n >> 16), m = (m & 65535) + 15 * (m >> 16);
      }
      a = n, b = m;
    },
    d: function() {
      a %= 65521, b %= 65521;
      return (a & 255) << 24 | (a & 65280) << 8 | (b & 255) << 8 | b >> 8;
    }
  };
};
var dopt = function(dat, opt, pre, post, st) {
  if (!st) {
    st = { l: 1 };
    if (opt.dictionary) {
      var dict = opt.dictionary.subarray(-32768);
      var newDat = new u8(dict.length + dat.length);
      newDat.set(dict);
      newDat.set(dat, dict.length);
      dat = newDat;
      st.w = dict.length;
    }
  }
  return dflt(dat, opt.level == null ? 6 : opt.level, opt.mem == null ? st.l ? Math.ceil(Math.max(8, Math.min(13, Math.log(dat.length))) * 1.5) : 20 : 12 + opt.mem, pre, post, st);
};
var mrg = function(a, b) {
  var o = {};
  for (var k in a)
    o[k] = a[k];
  for (var k in b)
    o[k] = b[k];
  return o;
};
var wcln = function(fn, fnStr, td2) {
  var dt = fn();
  var st = fn.toString();
  var ks = st.slice(st.indexOf("[") + 1, st.lastIndexOf("]")).replace(/\s+/g, "").split(",");
  for (var i = 0; i < dt.length; ++i) {
    var v = dt[i], k = ks[i];
    if (typeof v == "function") {
      fnStr += ";" + k + "=";
      var st_1 = v.toString();
      if (v.prototype) {
        if (st_1.indexOf("[native code]") != -1) {
          var spInd = st_1.indexOf(" ", 8) + 1;
          fnStr += st_1.slice(spInd, st_1.indexOf("(", spInd));
        } else {
          fnStr += st_1;
          for (var t in v.prototype)
            fnStr += ";" + k + ".prototype." + t + "=" + v.prototype[t].toString();
        }
      } else
        fnStr += st_1;
    } else
      td2[k] = v;
  }
  return fnStr;
};
var ch = [];
var cbfs = function(v) {
  var tl = [];
  for (var k in v) {
    if (v[k].buffer) {
      tl.push((v[k] = new v[k].constructor(v[k])).buffer);
    }
  }
  return tl;
};
var wrkr = function(fns, init, id, cb) {
  if (!ch[id]) {
    var fnStr = "", td_1 = {}, m = fns.length - 1;
    for (var i = 0; i < m; ++i)
      fnStr = wcln(fns[i], fnStr, td_1);
    ch[id] = { c: wcln(fns[m], fnStr, td_1), e: td_1 };
  }
  var td2 = mrg({}, ch[id].e);
  return wk(ch[id].c + ";onmessage=function(e){for(var k in e.data)self[k]=e.data[k];onmessage=" + init.toString() + "}", id, td2, cbfs(td2), cb);
};
var bInflt = function() {
  return [u8, u16, i32, fleb, fdeb, clim, fl, fd, flrm, fdrm, rev, ec, hMap, max, bits, bits16, shft, slc, err, inflt, inflateSync, pbf, gopt];
};
var bDflt = function() {
  return [u8, u16, i32, fleb, fdeb, clim, revfl, revfd, flm, flt, fdm, fdt, rev, deo, et, hMap, wbits, wbits16, hTree, ln, lc, clen, wfblk, wblk, shft, slc, dflt, dopt, deflateSync, pbf];
};
var gze = function() {
  return [gzh, gzhl, wbytes, crc, crct];
};
var guze = function() {
  return [gzs, gzl];
};
var zle = function() {
  return [zlh, wbytes, adler];
};
var zule = function() {
  return [zls];
};
var pbf = function(msg) {
  return postMessage(msg, [msg.buffer]);
};
var gopt = function(o) {
  return o && {
    out: o.size && new u8(o.size),
    dictionary: o.dictionary
  };
};
var cbify = function(dat, opts, fns, init, id, cb) {
  var w = wrkr(fns, init, id, function(err2, dat2) {
    w.terminate();
    cb(err2, dat2);
  });
  w.postMessage([dat, opts], opts.consume ? [dat.buffer] : []);
  return function() {
    w.terminate();
  };
};
var astrm = function(strm) {
  strm.ondata = function(dat, final) {
    return postMessage([dat, final], [dat.buffer]);
  };
  return function(ev) {
    if (ev.data[0]) {
      strm.push(ev.data[0], ev.data[1]);
      postMessage([ev.data[0].length]);
    } else
      strm.flush(ev.data[1]);
  };
};
var astrmify = function(fns, strm, opts, init, id, flush, ext) {
  var t;
  var w = wrkr(fns, init, id, function(err2, dat) {
    if (err2)
      w.terminate(), strm.ondata.call(strm, err2);
    else if (!Array.isArray(dat))
      ext(dat);
    else if (dat.length == 1) {
      strm.queuedSize -= dat[0];
      if (strm.ondrain)
        strm.ondrain(dat[0]);
    } else {
      if (dat[1])
        w.terminate();
      strm.ondata.call(strm, err2, dat[0], dat[1]);
    }
  });
  w.postMessage(opts);
  strm.queuedSize = 0;
  strm.push = function(d, f) {
    if (!strm.ondata)
      err(5);
    if (t)
      strm.ondata(err(4, 0, 1), null, !!f);
    strm.queuedSize += d.length;
    w.postMessage([d, t = f], d.buffer instanceof ArrayBuffer ? [d.buffer] : []);
  };
  strm.terminate = function() {
    w.terminate();
  };
  if (flush) {
    strm.flush = function(sync) {
      w.postMessage([0, sync]);
    };
  }
};
var b2 = function(d, b) {
  return d[b] | d[b + 1] << 8;
};
var b4 = function(d, b) {
  return (d[b] | d[b + 1] << 8 | d[b + 2] << 16 | d[b + 3] << 24) >>> 0;
};
var b8 = function(d, b) {
  return b4(d, b) + b4(d, b + 4) * 4294967296;
};
var wbytes = function(d, b, v) {
  for (; v; ++b)
    d[b] = v, v >>>= 8;
};
var gzh = function(c, o) {
  var fn = o.filename;
  c[0] = 31, c[1] = 139, c[2] = 8, c[8] = o.level < 2 ? 4 : o.level == 9 ? 2 : 0, c[9] = 3;
  if (o.mtime != 0)
    wbytes(c, 4, Math.floor(new Date(o.mtime || Date.now()) / 1e3));
  if (fn) {
    c[3] = 8;
    for (var i = 0; i <= fn.length; ++i)
      c[i + 10] = fn.charCodeAt(i);
  }
};
var gzs = function(d) {
  if (d[0] != 31 || d[1] != 139 || d[2] != 8)
    err(6, "invalid gzip data");
  var flg = d[3];
  var st = 10;
  if (flg & 4)
    st += (d[10] | d[11] << 8) + 2;
  for (var zs = (flg >> 3 & 1) + (flg >> 4 & 1); zs > 0; zs -= !d[st++])
    ;
  return st + (flg & 2);
};
var gzl = function(d) {
  var l = d.length;
  return (d[l - 4] | d[l - 3] << 8 | d[l - 2] << 16 | d[l - 1] << 24) >>> 0;
};
var gzhl = function(o) {
  return 10 + (o.filename ? o.filename.length + 1 : 0);
};
var zlh = function(c, o) {
  var lv = o.level, fl2 = lv == 0 ? 0 : lv < 6 ? 1 : lv == 9 ? 3 : 2;
  c[0] = 120, c[1] = fl2 << 6 | (o.dictionary && 32);
  c[1] |= 31 - (c[0] << 8 | c[1]) % 31;
  if (o.dictionary) {
    var h = adler();
    h.p(o.dictionary);
    wbytes(c, 2, h.d());
  }
};
var zls = function(d, dict) {
  if ((d[0] & 15) != 8 || d[0] >> 4 > 7 || (d[0] << 8 | d[1]) % 31)
    err(6, "invalid zlib data");
  if ((d[1] >> 5 & 1) == +!dict)
    err(6, "invalid zlib data: " + (d[1] & 32 ? "need" : "unexpected") + " dictionary");
  return (d[1] >> 3 & 4) + 2;
};
function StrmOpt(opts, cb) {
  if (typeof opts == "function")
    cb = opts, opts = {};
  this.ondata = cb;
  return opts;
}
var Deflate = /* @__PURE__ */ (function() {
  function Deflate2(opts, cb) {
    if (typeof opts == "function")
      cb = opts, opts = {};
    this.ondata = cb;
    this.o = opts || {};
    this.s = { l: 0, i: 32768, w: 32768, z: 32768 };
    this.b = new u8(98304);
    if (this.o.dictionary) {
      var dict = this.o.dictionary.subarray(-32768);
      this.b.set(dict, 32768 - dict.length);
      this.s.i = 32768 - dict.length;
    }
  }
  Deflate2.prototype.p = function(c, f) {
    this.ondata(dopt(c, this.o, 0, 0, this.s), f);
  };
  Deflate2.prototype.push = function(chunk, final) {
    if (!this.ondata)
      err(5);
    if (this.s.l)
      err(4);
    var endLen = chunk.length + this.s.z;
    if (endLen > this.b.length) {
      if (endLen > 2 * this.b.length - 32768) {
        var newBuf = new u8(endLen & -32768);
        newBuf.set(this.b.subarray(0, this.s.z));
        this.b = newBuf;
      }
      var split = this.b.length - this.s.z;
      this.b.set(chunk.subarray(0, split), this.s.z);
      this.s.z = this.b.length;
      this.p(this.b, false);
      this.b.set(this.b.subarray(-32768));
      this.b.set(chunk.subarray(split), 32768);
      this.s.z = chunk.length - split + 32768;
      this.s.i = 32766, this.s.w = 32768;
    } else {
      this.b.set(chunk, this.s.z);
      this.s.z += chunk.length;
    }
    this.s.l = final & 1;
    if (this.s.z > this.s.w + 8191 || final) {
      this.p(this.b, final || false);
      this.s.w = this.s.i, this.s.i -= 2;
    }
    if (final) {
      this.s = this.o = {};
      this.b = et;
    }
  };
  Deflate2.prototype.flush = function(sync) {
    if (!this.ondata)
      err(5);
    if (this.s.l)
      err(4);
    this.p(this.b, false);
    this.s.w = this.s.i, this.s.i -= 2;
    if (sync) {
      var c = new u8(6);
      c[0] = this.s.r >> 3;
      var ep = wfblk(c, this.s.r, et);
      this.s.r = 0;
      this.ondata(c.subarray(0, ep >> 3), false);
    }
  };
  return Deflate2;
})();
var AsyncDeflate = /* @__PURE__ */ (function() {
  function AsyncDeflate2(opts, cb) {
    astrmify([
      bDflt,
      function() {
        return [astrm, Deflate];
      }
    ], this, StrmOpt.call(this, opts, cb), function(ev) {
      var strm = new Deflate(ev.data);
      onmessage = astrm(strm);
    }, 6, 1);
  }
  return AsyncDeflate2;
})();
function deflate(data, opts, cb) {
  if (!cb)
    cb = opts, opts = {};
  if (typeof cb != "function")
    err(7);
  return cbify(data, opts, [
    bDflt
  ], function(ev) {
    return pbf(deflateSync(ev.data[0], ev.data[1]));
  }, 0, cb);
}
function deflateSync(data, opts) {
  return dopt(data, opts || {}, 0, 0);
}
var Inflate = /* @__PURE__ */ (function() {
  function Inflate2(opts, cb) {
    if (typeof opts == "function")
      cb = opts, opts = {};
    this.ondata = cb;
    var dict = opts && opts.dictionary && opts.dictionary.subarray(-32768);
    this.s = { i: 0, b: dict ? dict.length : 0 };
    this.o = new u8(32768);
    this.p = new u8(0);
    if (dict)
      this.o.set(dict);
  }
  Inflate2.prototype.e = function(c) {
    if (!this.ondata)
      err(5);
    if (this.d)
      err(4);
    if (!this.p.length)
      this.p = c;
    else if (c.length) {
      var n = new u8(this.p.length + c.length);
      n.set(this.p), n.set(c, this.p.length), this.p = n;
    }
  };
  Inflate2.prototype.c = function(final) {
    this.s.i = +(this.d = final || false);
    var bts = this.s.b;
    var dt = inflt(this.p, this.s, this.o);
    this.ondata(slc(dt, bts, this.s.b), this.d);
    this.o = slc(dt, this.s.b - 32768), this.s.b = this.o.length;
    this.p = slc(this.p, this.s.p / 8 | 0), this.s.p &= 7;
  };
  Inflate2.prototype.push = function(chunk, final) {
    this.e(chunk), this.c(final);
  };
  return Inflate2;
})();
var AsyncInflate = /* @__PURE__ */ (function() {
  function AsyncInflate2(opts, cb) {
    astrmify([
      bInflt,
      function() {
        return [astrm, Inflate];
      }
    ], this, StrmOpt.call(this, opts, cb), function(ev) {
      var strm = new Inflate(ev.data);
      onmessage = astrm(strm);
    }, 7, 0);
  }
  return AsyncInflate2;
})();
function inflate(data, opts, cb) {
  if (!cb)
    cb = opts, opts = {};
  if (typeof cb != "function")
    err(7);
  return cbify(data, opts, [
    bInflt
  ], function(ev) {
    return pbf(inflateSync(ev.data[0], gopt(ev.data[1])));
  }, 1, cb);
}
function inflateSync(data, opts) {
  return inflt(data, { i: 2 }, opts && opts.out, opts && opts.dictionary);
}
var Gzip = /* @__PURE__ */ (function() {
  function Gzip2(opts, cb) {
    this.c = crc();
    this.l = 0;
    this.v = 1;
    Deflate.call(this, opts, cb);
  }
  Gzip2.prototype.push = function(chunk, final) {
    this.c.p(chunk);
    this.l += chunk.length;
    Deflate.prototype.push.call(this, chunk, final);
  };
  Gzip2.prototype.p = function(c, f) {
    var raw = dopt(c, this.o, this.v && gzhl(this.o), f && 8, this.s);
    if (this.v)
      gzh(raw, this.o), this.v = 0;
    if (f)
      wbytes(raw, raw.length - 8, this.c.d()), wbytes(raw, raw.length - 4, this.l);
    this.ondata(raw, f);
  };
  Gzip2.prototype.flush = function(sync) {
    Deflate.prototype.flush.call(this, sync);
  };
  return Gzip2;
})();
var AsyncGzip = /* @__PURE__ */ (function() {
  function AsyncGzip2(opts, cb) {
    astrmify([
      bDflt,
      gze,
      function() {
        return [astrm, Deflate, Gzip];
      }
    ], this, StrmOpt.call(this, opts, cb), function(ev) {
      var strm = new Gzip(ev.data);
      onmessage = astrm(strm);
    }, 8, 1);
  }
  return AsyncGzip2;
})();
function gzip(data, opts, cb) {
  if (!cb)
    cb = opts, opts = {};
  if (typeof cb != "function")
    err(7);
  return cbify(data, opts, [
    bDflt,
    gze,
    function() {
      return [gzipSync];
    }
  ], function(ev) {
    return pbf(gzipSync(ev.data[0], ev.data[1]));
  }, 2, cb);
}
function gzipSync(data, opts) {
  if (!opts)
    opts = {};
  var c = crc(), l = data.length;
  c.p(data);
  var d = dopt(data, opts, gzhl(opts), 8), s = d.length;
  return gzh(d, opts), wbytes(d, s - 8, c.d()), wbytes(d, s - 4, l), d;
}
var Gunzip = /* @__PURE__ */ (function() {
  function Gunzip2(opts, cb) {
    this.v = 1;
    this.r = 0;
    Inflate.call(this, opts, cb);
  }
  Gunzip2.prototype.push = function(chunk, final) {
    Inflate.prototype.e.call(this, chunk);
    this.r += chunk.length;
    if (this.v) {
      var p = this.p.subarray(this.v - 1);
      var s = p.length > 3 ? gzs(p) : 4;
      if (s > p.length) {
        if (!final)
          return;
      } else if (this.v > 1 && this.onmember) {
        this.onmember(this.r - p.length);
      }
      this.p = p.subarray(s), this.v = 0;
    }
    Inflate.prototype.c.call(this, 0);
    if (this.s.f && !this.s.l) {
      this.v = shft(this.s.p) + 9;
      this.s = { i: 0 };
      this.o = new u8(0);
      this.push(new u8(0), final);
    } else if (final) {
      Inflate.prototype.c.call(this, final);
    }
  };
  return Gunzip2;
})();
var AsyncGunzip = /* @__PURE__ */ (function() {
  function AsyncGunzip2(opts, cb) {
    var _this = this;
    astrmify([
      bInflt,
      guze,
      function() {
        return [astrm, Inflate, Gunzip];
      }
    ], this, StrmOpt.call(this, opts, cb), function(ev) {
      var strm = new Gunzip(ev.data);
      strm.onmember = function(offset) {
        return postMessage(offset);
      };
      onmessage = astrm(strm);
    }, 9, 0, function(offset) {
      return _this.onmember && _this.onmember(offset);
    });
  }
  return AsyncGunzip2;
})();
function gunzip(data, opts, cb) {
  if (!cb)
    cb = opts, opts = {};
  if (typeof cb != "function")
    err(7);
  return cbify(data, opts, [
    bInflt,
    guze,
    function() {
      return [gunzipSync];
    }
  ], function(ev) {
    return pbf(gunzipSync(ev.data[0], ev.data[1]));
  }, 3, cb);
}
function gunzipSync(data, opts) {
  var st = gzs(data);
  if (st + 8 > data.length)
    err(6, "invalid gzip data");
  return inflt(data.subarray(st, -8), { i: 2 }, opts && opts.out || new u8(gzl(data)), opts && opts.dictionary);
}
var Zlib = /* @__PURE__ */ (function() {
  function Zlib2(opts, cb) {
    this.c = adler();
    this.v = 1;
    Deflate.call(this, opts, cb);
  }
  Zlib2.prototype.push = function(chunk, final) {
    this.c.p(chunk);
    Deflate.prototype.push.call(this, chunk, final);
  };
  Zlib2.prototype.p = function(c, f) {
    var raw = dopt(c, this.o, this.v && (this.o.dictionary ? 6 : 2), f && 4, this.s);
    if (this.v)
      zlh(raw, this.o), this.v = 0;
    if (f)
      wbytes(raw, raw.length - 4, this.c.d());
    this.ondata(raw, f);
  };
  Zlib2.prototype.flush = function(sync) {
    Deflate.prototype.flush.call(this, sync);
  };
  return Zlib2;
})();
var AsyncZlib = /* @__PURE__ */ (function() {
  function AsyncZlib2(opts, cb) {
    astrmify([
      bDflt,
      zle,
      function() {
        return [astrm, Deflate, Zlib];
      }
    ], this, StrmOpt.call(this, opts, cb), function(ev) {
      var strm = new Zlib(ev.data);
      onmessage = astrm(strm);
    }, 10, 1);
  }
  return AsyncZlib2;
})();
function zlib(data, opts, cb) {
  if (!cb)
    cb = opts, opts = {};
  if (typeof cb != "function")
    err(7);
  return cbify(data, opts, [
    bDflt,
    zle,
    function() {
      return [zlibSync];
    }
  ], function(ev) {
    return pbf(zlibSync(ev.data[0], ev.data[1]));
  }, 4, cb);
}
function zlibSync(data, opts) {
  if (!opts)
    opts = {};
  var a = adler();
  a.p(data);
  var d = dopt(data, opts, opts.dictionary ? 6 : 2, 4);
  return zlh(d, opts), wbytes(d, d.length - 4, a.d()), d;
}
var Unzlib = /* @__PURE__ */ (function() {
  function Unzlib2(opts, cb) {
    Inflate.call(this, opts, cb);
    this.v = opts && opts.dictionary ? 2 : 1;
  }
  Unzlib2.prototype.push = function(chunk, final) {
    Inflate.prototype.e.call(this, chunk);
    if (this.v) {
      if (this.p.length < 6 && !final)
        return;
      this.p = this.p.subarray(zls(this.p, this.v - 1)), this.v = 0;
    }
    if (final) {
      if (this.p.length < 4)
        err(6, "invalid zlib data");
      this.p = this.p.subarray(0, -4);
    }
    Inflate.prototype.c.call(this, final);
  };
  return Unzlib2;
})();
var AsyncUnzlib = /* @__PURE__ */ (function() {
  function AsyncUnzlib2(opts, cb) {
    astrmify([
      bInflt,
      zule,
      function() {
        return [astrm, Inflate, Unzlib];
      }
    ], this, StrmOpt.call(this, opts, cb), function(ev) {
      var strm = new Unzlib(ev.data);
      onmessage = astrm(strm);
    }, 11, 0);
  }
  return AsyncUnzlib2;
})();
function unzlib(data, opts, cb) {
  if (!cb)
    cb = opts, opts = {};
  if (typeof cb != "function")
    err(7);
  return cbify(data, opts, [
    bInflt,
    zule,
    function() {
      return [unzlibSync];
    }
  ], function(ev) {
    return pbf(unzlibSync(ev.data[0], gopt(ev.data[1])));
  }, 5, cb);
}
function unzlibSync(data, opts) {
  return inflt(data.subarray(zls(data, opts && opts.dictionary), -4), { i: 2 }, opts && opts.out, opts && opts.dictionary);
}
var Decompress = /* @__PURE__ */ (function() {
  function Decompress2(opts, cb) {
    this.o = StrmOpt.call(this, opts, cb) || {};
    this.G = Gunzip;
    this.I = Inflate;
    this.Z = Unzlib;
  }
  Decompress2.prototype.i = function() {
    var _this = this;
    this.s.ondata = function(dat, final) {
      _this.ondata(dat, final);
    };
  };
  Decompress2.prototype.push = function(chunk, final) {
    if (!this.ondata)
      err(5);
    if (!this.s) {
      if (this.p && this.p.length) {
        var n = new u8(this.p.length + chunk.length);
        n.set(this.p), n.set(chunk, this.p.length);
      } else
        this.p = chunk;
      if (this.p.length > 2) {
        this.s = this.p[0] == 31 && this.p[1] == 139 && this.p[2] == 8 ? new this.G(this.o) : (this.p[0] & 15) != 8 || this.p[0] >> 4 > 7 || (this.p[0] << 8 | this.p[1]) % 31 ? new this.I(this.o) : new this.Z(this.o);
        this.i();
        this.s.push(this.p, final);
        this.p = null;
      }
    } else
      this.s.push(chunk, final);
  };
  return Decompress2;
})();
var AsyncDecompress = /* @__PURE__ */ (function() {
  function AsyncDecompress2(opts, cb) {
    Decompress.call(this, opts, cb);
    this.queuedSize = 0;
    this.G = AsyncGunzip;
    this.I = AsyncInflate;
    this.Z = AsyncUnzlib;
  }
  AsyncDecompress2.prototype.i = function() {
    var _this = this;
    this.s.ondata = function(err2, dat, final) {
      _this.ondata(err2, dat, final);
    };
    this.s.ondrain = function(size) {
      _this.queuedSize -= size;
      if (_this.ondrain)
        _this.ondrain(size);
    };
  };
  AsyncDecompress2.prototype.push = function(chunk, final) {
    this.queuedSize += chunk.length;
    Decompress.prototype.push.call(this, chunk, final);
  };
  return AsyncDecompress2;
})();
function decompress(data, opts, cb) {
  if (!cb)
    cb = opts, opts = {};
  if (typeof cb != "function")
    err(7);
  return data[0] == 31 && data[1] == 139 && data[2] == 8 ? gunzip(data, opts, cb) : (data[0] & 15) != 8 || data[0] >> 4 > 7 || (data[0] << 8 | data[1]) % 31 ? inflate(data, opts, cb) : unzlib(data, opts, cb);
}
function decompressSync(data, opts) {
  return data[0] == 31 && data[1] == 139 && data[2] == 8 ? gunzipSync(data, opts) : (data[0] & 15) != 8 || data[0] >> 4 > 7 || (data[0] << 8 | data[1]) % 31 ? inflateSync(data, opts) : unzlibSync(data, opts);
}
var fltn = function(d, p, t, o) {
  for (var k in d) {
    var val = d[k], n = p + k, op = o;
    if (Array.isArray(val))
      op = mrg(o, val[1]), val = val[0];
    if (ArrayBuffer.isView(val))
      t[n] = [val, op];
    else {
      t[n += "/"] = [new u8(0), op];
      fltn(val, n, t, o);
    }
  }
};
var te = typeof TextEncoder != "undefined" && /* @__PURE__ */ new TextEncoder();
var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
var tds = 0;
try {
  td.decode(et, { stream: true });
  tds = 1;
} catch (e) {
}
var dutf8 = function(d) {
  for (var r = "", i = 0; ; ) {
    var c = d[i++];
    var eb = (c > 127) + (c > 223) + (c > 239);
    if (i + eb > d.length)
      return { s: r, r: slc(d, i - 1) };
    if (!eb)
      r += String.fromCharCode(c);
    else if (eb == 3) {
      c = ((c & 15) << 18 | (d[i++] & 63) << 12 | (d[i++] & 63) << 6 | d[i++] & 63) - 65536, r += String.fromCharCode(55296 | c >> 10, 56320 | c & 1023);
    } else if (eb & 1)
      r += String.fromCharCode((c & 31) << 6 | d[i++] & 63);
    else
      r += String.fromCharCode((c & 15) << 12 | (d[i++] & 63) << 6 | d[i++] & 63);
  }
};
var DecodeUTF8 = /* @__PURE__ */ (function() {
  function DecodeUTF82(cb) {
    this.ondata = cb;
    if (tds)
      this.t = new TextDecoder();
    else
      this.p = et;
  }
  DecodeUTF82.prototype.push = function(chunk, final) {
    if (!this.ondata)
      err(5);
    final = !!final;
    if (this.t) {
      this.ondata(this.t.decode(chunk, { stream: true }), final);
      if (final) {
        if (this.t.decode().length)
          err(8);
        this.t = null;
      }
      return;
    }
    if (!this.p)
      err(4);
    var dat = new u8(this.p.length + chunk.length);
    dat.set(this.p);
    dat.set(chunk, this.p.length);
    var _a2 = dutf8(dat), s = _a2.s, r = _a2.r;
    if (final) {
      if (r.length)
        err(8);
      this.p = null;
    } else
      this.p = r;
    this.ondata(s, final);
  };
  return DecodeUTF82;
})();
var EncodeUTF8 = /* @__PURE__ */ (function() {
  function EncodeUTF82(cb) {
    this.ondata = cb;
  }
  EncodeUTF82.prototype.push = function(chunk, final) {
    if (!this.ondata)
      err(5);
    if (this.d)
      err(4);
    this.ondata(strToU8(chunk), this.d = final || false);
  };
  return EncodeUTF82;
})();
function strToU8(str, latin1) {
  if (latin1) {
    var ar_1 = new u8(str.length);
    for (var i = 0; i < str.length; ++i)
      ar_1[i] = str.charCodeAt(i);
    return ar_1;
  }
  if (te)
    return te.encode(str);
  var l = str.length;
  var ar = new u8(str.length + (str.length >> 1));
  var ai = 0;
  var w = function(v) {
    ar[ai++] = v;
  };
  for (var i = 0; i < l; ++i) {
    if (ai + 5 > ar.length) {
      var n = new u8(ai + 8 + (l - i << 1));
      n.set(ar);
      ar = n;
    }
    var c = str.charCodeAt(i);
    if (c < 128 || latin1)
      w(c);
    else if (c < 2048)
      w(192 | c >> 6), w(128 | c & 63);
    else if (c > 55295 && c < 57344)
      c = 65536 + (c & 1023 << 10) | str.charCodeAt(++i) & 1023, w(240 | c >> 18), w(128 | c >> 12 & 63), w(128 | c >> 6 & 63), w(128 | c & 63);
    else
      w(224 | c >> 12), w(128 | c >> 6 & 63), w(128 | c & 63);
  }
  return slc(ar, 0, ai);
}
function strFromU8(dat, latin1) {
  if (latin1) {
    var r = "";
    for (var i = 0; i < dat.length; i += 16384)
      r += String.fromCharCode.apply(null, dat.subarray(i, i + 16384));
    return r;
  } else if (td) {
    return td.decode(dat);
  } else {
    var _a2 = dutf8(dat), s = _a2.s, r = _a2.r;
    if (r.length)
      err(8);
    return s;
  }
}
var dbf = function(l) {
  return l == 1 ? 3 : l < 6 ? 2 : l == 9 ? 1 : 0;
};
var slzh = function(d, b) {
  return b + 30 + b2(d, b + 26) + b2(d, b + 28);
};
var zh = function(d, b, z) {
  var fnl = b2(d, b + 28), efl = b2(d, b + 30), fn = strFromU8(d.subarray(b + 46, b + 46 + fnl), !(b2(d, b + 8) & 2048)), es = b + 46 + fnl;
  var _a2 = z64hs(d, es, efl, z, b4(d, b + 20), b4(d, b + 24), b4(d, b + 42)), sc = _a2[0], su = _a2[1], off = _a2[2];
  return [b2(d, b + 10), sc, su, fn, es + efl + b2(d, b + 32), off];
};
var z64hs = function(d, b, l, z, sc, su, off) {
  var nsc = sc == 4294967295, nsu = su == 4294967295, noff = off == 4294967295, e = b + l;
  var nf = nsc + nsu + noff;
  if (z && nf) {
    for (; b + 4 < e; b += 4 + b2(d, b + 2)) {
      if (b2(d, b) == 1) {
        return [
          nsc ? b8(d, b + 4 + 8 * nsu) : sc,
          nsu ? b8(d, b + 4) : su,
          noff ? b8(d, b + 4 + 8 * (nsu + nsc)) : off,
          1
        ];
      }
    }
    if (z < 2)
      err(13);
  }
  return [sc, su, off, 0];
};
var exfl = function(ex) {
  var le = 0;
  if (ex) {
    for (var k in ex) {
      var l = ex[k].length;
      if (l > 65535)
        err(9);
      le += l + 4;
    }
  }
  return le;
};
var wzh = function(d, b, f, fn, u, c, ce, co) {
  var fl2 = fn.length, ex = f.extra, col = co && co.length;
  var exl = exfl(ex);
  wbytes(d, b, ce != null ? 33639248 : 67324752), b += 4;
  if (ce != null)
    d[b++] = 20, d[b++] = f.os;
  d[b] = 20, b += 2;
  d[b++] = f.flag << 1 | (c < 0 && 8), d[b++] = u && 8;
  d[b++] = f.compression & 255, d[b++] = f.compression >> 8;
  var dt = new Date(f.mtime == null ? Date.now() : f.mtime), y = dt.getFullYear() - 1980;
  if (y < 0 || y > 119)
    err(10);
  wbytes(d, b, y << 25 | dt.getMonth() + 1 << 21 | dt.getDate() << 16 | dt.getHours() << 11 | dt.getMinutes() << 5 | dt.getSeconds() >> 1), b += 4;
  if (c != -1) {
    wbytes(d, b, f.crc);
    wbytes(d, b + 4, c < 0 ? -c - 2 : c);
    wbytes(d, b + 8, f.size);
  }
  wbytes(d, b + 12, fl2);
  wbytes(d, b + 14, exl), b += 16;
  if (ce != null) {
    wbytes(d, b, col);
    wbytes(d, b + 6, f.attrs);
    wbytes(d, b + 10, ce), b += 14;
  }
  d.set(fn, b);
  b += fl2;
  if (exl) {
    for (var k in ex) {
      var exf = ex[k], l = exf.length;
      wbytes(d, b, +k);
      wbytes(d, b + 2, l);
      d.set(exf, b + 4), b += 4 + l;
    }
  }
  if (col)
    d.set(co, b), b += col;
  return b;
};
var wzf = function(o, b, c, d, e) {
  wbytes(o, b, 101010256);
  wbytes(o, b + 8, c);
  wbytes(o, b + 10, c);
  wbytes(o, b + 12, d);
  wbytes(o, b + 16, e);
};
var ZipPassThrough = /* @__PURE__ */ (function() {
  function ZipPassThrough2(filename) {
    this.filename = filename;
    this.c = crc();
    this.size = 0;
    this.compression = 0;
  }
  ZipPassThrough2.prototype.process = function(chunk, final) {
    this.ondata(null, chunk, final);
  };
  ZipPassThrough2.prototype.push = function(chunk, final) {
    if (!this.ondata)
      err(5);
    this.c.p(chunk);
    this.size += chunk.length;
    if (final)
      this.crc = this.c.d();
    this.process(chunk, final || false);
  };
  return ZipPassThrough2;
})();
var ZipDeflate = /* @__PURE__ */ (function() {
  function ZipDeflate2(filename, opts) {
    var _this = this;
    if (!opts)
      opts = {};
    ZipPassThrough.call(this, filename);
    this.d = new Deflate(opts, function(dat, final) {
      _this.ondata(null, dat, final);
    });
    this.compression = 8;
    this.flag = dbf(opts.level);
  }
  ZipDeflate2.prototype.process = function(chunk, final) {
    try {
      this.d.push(chunk, final);
    } catch (e) {
      this.ondata(e, null, final);
    }
  };
  ZipDeflate2.prototype.push = function(chunk, final) {
    ZipPassThrough.prototype.push.call(this, chunk, final);
  };
  return ZipDeflate2;
})();
var AsyncZipDeflate = /* @__PURE__ */ (function() {
  function AsyncZipDeflate2(filename, opts) {
    var _this = this;
    if (!opts)
      opts = {};
    ZipPassThrough.call(this, filename);
    this.d = new AsyncDeflate(opts, function(err2, dat, final) {
      _this.ondata(err2, dat, final);
    });
    this.compression = 8;
    this.flag = dbf(opts.level);
    this.terminate = this.d.terminate;
  }
  AsyncZipDeflate2.prototype.process = function(chunk, final) {
    this.d.push(chunk, final);
  };
  AsyncZipDeflate2.prototype.push = function(chunk, final) {
    ZipPassThrough.prototype.push.call(this, chunk, final);
  };
  return AsyncZipDeflate2;
})();
var Zip = /* @__PURE__ */ (function() {
  function Zip2(cb) {
    this.ondata = cb;
    this.u = [];
    this.d = 1;
  }
  Zip2.prototype.add = function(file) {
    var _this = this;
    if (!this.ondata)
      err(5);
    if (this.d & 2)
      this.ondata(err(4 + (this.d & 1) * 8, 0, 1), null, false);
    else {
      var f = strToU8(file.filename), fl_1 = f.length;
      var com = file.comment, o = com && strToU8(com);
      var u = fl_1 != file.filename.length || o && com.length != o.length;
      var hl_1 = fl_1 + exfl(file.extra) + 30;
      if (fl_1 > 65535)
        this.ondata(err(11, 0, 1), null, false);
      var header = new u8(hl_1);
      wzh(header, 0, file, f, u, -1);
      var chks_1 = [header];
      var pAll_1 = function() {
        for (var _i = 0, chks_2 = chks_1; _i < chks_2.length; _i++) {
          var chk = chks_2[_i];
          _this.ondata(null, chk, false);
        }
        chks_1 = [];
      };
      var tr_1 = this.d;
      this.d = 0;
      var ind_1 = this.u.length;
      var uf_1 = mrg(file, {
        f,
        u,
        o,
        t: function() {
          if (file.terminate)
            file.terminate();
        },
        r: function() {
          pAll_1();
          if (tr_1) {
            var nxt = _this.u[ind_1 + 1];
            if (nxt)
              nxt.r();
            else
              _this.d = 1;
          }
          tr_1 = 1;
        }
      });
      var cl_1 = 0;
      file.ondata = function(err2, dat, final) {
        if (err2) {
          _this.ondata(err2, dat, final);
          _this.terminate();
        } else {
          cl_1 += dat.length;
          chks_1.push(dat);
          if (final) {
            var dd = new u8(16);
            wbytes(dd, 0, 134695760);
            wbytes(dd, 4, file.crc);
            wbytes(dd, 8, cl_1);
            wbytes(dd, 12, file.size);
            chks_1.push(dd);
            uf_1.c = cl_1, uf_1.b = hl_1 + cl_1 + 16, uf_1.crc = file.crc, uf_1.size = file.size;
            if (tr_1)
              uf_1.r();
            tr_1 = 1;
          } else if (tr_1)
            pAll_1();
        }
      };
      this.u.push(uf_1);
    }
  };
  Zip2.prototype.end = function() {
    var _this = this;
    if (this.d & 2) {
      this.ondata(err(4 + (this.d & 1) * 8, 0, 1), null, true);
      return;
    }
    if (this.d)
      this.e();
    else
      this.u.push({
        r: function() {
          if (!(_this.d & 1))
            return;
          _this.u.splice(-1, 1);
          _this.e();
        },
        t: function() {
        }
      });
    this.d = 3;
  };
  Zip2.prototype.e = function() {
    var bt = 0, l = 0, tl = 0;
    for (var _i = 0, _a2 = this.u; _i < _a2.length; _i++) {
      var f = _a2[_i];
      tl += 46 + f.f.length + exfl(f.extra) + (f.o ? f.o.length : 0);
    }
    var out = new u8(tl + 22);
    for (var _b2 = 0, _c = this.u; _b2 < _c.length; _b2++) {
      var f = _c[_b2];
      wzh(out, bt, f, f.f, f.u, -f.c - 2, l, f.o);
      bt += 46 + f.f.length + exfl(f.extra) + (f.o ? f.o.length : 0), l += f.b;
    }
    wzf(out, bt, this.u.length, tl, l);
    this.ondata(null, out, true);
    this.d = 2;
  };
  Zip2.prototype.terminate = function() {
    for (var _i = 0, _a2 = this.u; _i < _a2.length; _i++) {
      var f = _a2[_i];
      f.t();
    }
    this.d = 2;
  };
  return Zip2;
})();
function zip(data, opts, cb) {
  if (!cb)
    cb = opts, opts = {};
  if (typeof cb != "function")
    err(7);
  var r = {};
  fltn(data, "", r, opts);
  var k = Object.keys(r);
  var lft = k.length, o = 0, tot = 0;
  var slft = lft, files = new Array(lft);
  var term = [];
  var tAll = function() {
    for (var i2 = 0; i2 < term.length; ++i2)
      term[i2]();
  };
  var cbd = function(a, b) {
    mt(function() {
      cb(a, b);
    });
  };
  mt(function() {
    cbd = cb;
  });
  var cbf = function() {
    var out = new u8(tot + 22), oe = o, cdl = tot - o;
    tot = 0;
    for (var i2 = 0; i2 < slft; ++i2) {
      var f = files[i2];
      try {
        var l = f.c.length;
        wzh(out, tot, f, f.f, f.u, l);
        var badd = 30 + f.f.length + exfl(f.extra);
        var loc = tot + badd;
        out.set(f.c, loc);
        wzh(out, o, f, f.f, f.u, l, tot, f.m), o += 16 + badd + (f.m ? f.m.length : 0), tot = loc + l;
      } catch (e) {
        return cbd(e, null);
      }
    }
    wzf(out, o, files.length, cdl, oe);
    cbd(null, out);
  };
  if (!lft)
    cbf();
  var _loop_1 = function(i2) {
    var fn = k[i2];
    var _a2 = r[fn], file = _a2[0], p = _a2[1];
    var c = crc(), size = file.length;
    c.p(file);
    var f = strToU8(fn), s = f.length;
    var com = p.comment, m = com && strToU8(com), ms = m && m.length;
    var exl = exfl(p.extra);
    var compression = p.level == 0 ? 0 : 8;
    var cbl = function(e, d) {
      if (e) {
        tAll();
        cbd(e, null);
      } else {
        var l = d.length;
        files[i2] = mrg(p, {
          size,
          crc: c.d(),
          c: d,
          f,
          m,
          u: s != fn.length || m && com.length != ms,
          compression
        });
        o += 30 + s + exl + l;
        tot += 76 + 2 * (s + exl) + (ms || 0) + l;
        if (!--lft)
          cbf();
      }
    };
    if (s > 65535)
      cbl(err(11, 0, 1), null);
    if (!compression)
      cbl(null, file);
    else if (size < 16e4) {
      try {
        cbl(null, deflateSync(file, p));
      } catch (e) {
        cbl(e, null);
      }
    } else
      term.push(deflate(file, p, cbl));
  };
  for (var i = 0; i < slft; ++i) {
    _loop_1(i);
  }
  return tAll;
}
function zipSync(data, opts) {
  if (!opts)
    opts = {};
  var r = {};
  var files = [];
  fltn(data, "", r, opts);
  var o = 0;
  var tot = 0;
  for (var fn in r) {
    var _a2 = r[fn], file = _a2[0], p = _a2[1];
    var compression = p.level == 0 ? 0 : 8;
    var f = strToU8(fn), s = f.length;
    var com = p.comment, m = com && strToU8(com), ms = m && m.length;
    var exl = exfl(p.extra);
    if (s > 65535)
      err(11);
    var d = compression ? deflateSync(file, p) : file, l = d.length;
    var c = crc();
    c.p(file);
    files.push(mrg(p, {
      size: file.length,
      crc: c.d(),
      c: d,
      f,
      m,
      u: s != fn.length || m && com.length != ms,
      o,
      compression
    }));
    o += 30 + s + exl + l;
    tot += 76 + 2 * (s + exl) + (ms || 0) + l;
  }
  var out = new u8(tot + 22), oe = o, cdl = tot - o;
  for (var i = 0; i < files.length; ++i) {
    var f = files[i];
    wzh(out, f.o, f, f.f, f.u, f.c.length);
    var badd = 30 + f.f.length + exfl(f.extra);
    out.set(f.c, f.o + badd);
    wzh(out, o, f, f.f, f.u, f.c.length, f.o, f.m), o += 16 + badd + (f.m ? f.m.length : 0);
  }
  wzf(out, o, files.length, cdl, oe);
  return out;
}
var UnzipPassThrough = /* @__PURE__ */ (function() {
  function UnzipPassThrough2() {
  }
  UnzipPassThrough2.prototype.push = function(chunk, final) {
    this.ondata(null, chunk, final);
  };
  UnzipPassThrough2.compression = 0;
  return UnzipPassThrough2;
})();
var UnzipInflate = /* @__PURE__ */ (function() {
  function UnzipInflate2() {
    var _this = this;
    this.i = new Inflate(function(dat, final) {
      _this.ondata(null, dat, final);
    });
  }
  UnzipInflate2.prototype.push = function(chunk, final) {
    try {
      this.i.push(chunk, final);
    } catch (e) {
      this.ondata(e, null, final);
    }
  };
  UnzipInflate2.compression = 8;
  return UnzipInflate2;
})();
var AsyncUnzipInflate = /* @__PURE__ */ (function() {
  function AsyncUnzipInflate2(_, sz) {
    var _this = this;
    if (sz < 32e4) {
      this.i = new Inflate(function(dat, final) {
        _this.ondata(null, dat, final);
      });
    } else {
      this.i = new AsyncInflate(function(err2, dat, final) {
        _this.ondata(err2, dat, final);
      });
      this.terminate = this.i.terminate;
    }
  }
  AsyncUnzipInflate2.prototype.push = function(chunk, final) {
    if (this.i.terminate)
      chunk = slc(chunk, 0);
    this.i.push(chunk, final);
  };
  AsyncUnzipInflate2.compression = 8;
  return AsyncUnzipInflate2;
})();
var Unzip = /* @__PURE__ */ (function() {
  function Unzip2(cb) {
    this.onfile = cb;
    this.k = [];
    this.o = {
      0: UnzipPassThrough
    };
    this.p = et;
  }
  Unzip2.prototype.push = function(chunk, final) {
    var _this = this;
    if (!this.onfile)
      err(5);
    if (!this.p)
      err(4);
    if (this.c > 0) {
      var len = Math.min(this.c, chunk.length);
      var toAdd = chunk.subarray(0, len);
      this.c -= len;
      if (this.d)
        this.d.push(toAdd, !this.c);
      else
        this.k[0].push(toAdd);
      chunk = chunk.subarray(len);
      if (chunk.length)
        return this.push(chunk, final);
    } else {
      var f = 0, i = 0, is = void 0, buf = void 0;
      if (!this.p.length)
        buf = chunk;
      else if (!chunk.length)
        buf = this.p;
      else {
        buf = new u8(this.p.length + chunk.length);
        buf.set(this.p), buf.set(chunk, this.p.length);
      }
      var l = buf.length, oc = this.c, add = oc && this.d;
      var _loop_2 = function() {
        var sig = b4(buf, i);
        if (sig == 67324752) {
          f = 1, is = i;
          this_1.d = null;
          this_1.c = 0;
          var bf = b2(buf, i + 6), cmp_1 = b2(buf, i + 8), u = bf & 2048, dd = bf & 8, fnl = b2(buf, i + 26), es = b2(buf, i + 28);
          if (l > i + 30 + fnl + es) {
            var chks_3 = [];
            this_1.k.unshift(chks_3);
            f = 2;
            var lsc = b4(buf, i + 18), lsu = b4(buf, i + 22);
            var fn_1 = strFromU8(buf.subarray(i + 30, i += 30 + fnl), !u);
            var _a2 = z64hs(buf, i, es, 2, lsc, lsu, 0), sc_1 = _a2[0], su_1 = _a2[1], z64 = _a2[3];
            if (dd)
              sc_1 = -1 - z64;
            i += es;
            this_1.c = sc_1;
            var d_1;
            var file_1 = {
              name: fn_1,
              compression: cmp_1,
              start: function() {
                if (!file_1.ondata)
                  err(5);
                if (!sc_1)
                  file_1.ondata(null, et, true);
                else {
                  var ctr = _this.o[cmp_1];
                  if (!ctr)
                    file_1.ondata(err(14, "unknown compression type " + cmp_1, 1), null, false);
                  d_1 = sc_1 < 0 ? new ctr(fn_1) : new ctr(fn_1, sc_1, su_1);
                  d_1.ondata = function(err2, dat3, final2) {
                    file_1.ondata(err2, dat3, final2);
                  };
                  for (var _i = 0, chks_4 = chks_3; _i < chks_4.length; _i++) {
                    var dat2 = chks_4[_i];
                    d_1.push(dat2, false);
                  }
                  if (_this.k[0] == chks_3 && _this.c)
                    _this.d = d_1;
                  else
                    d_1.push(et, true);
                }
              },
              terminate: function() {
                if (d_1 && d_1.terminate)
                  d_1.terminate();
              }
            };
            if (sc_1 >= 0)
              file_1.size = sc_1, file_1.originalSize = su_1;
            this_1.onfile(file_1);
          }
          return "break";
        } else if (oc) {
          if (sig == 134695760) {
            is = i += 12 + (oc == -2 && 8), f = 3, this_1.c = 0;
            return "break";
          } else if (sig == 33639248) {
            is = i -= 4, f = 3, this_1.c = 0;
            return "break";
          }
        }
      };
      var this_1 = this;
      for (; i < l - 4; ++i) {
        var state_1 = _loop_2();
        if (state_1 === "break")
          break;
      }
      this.p = et;
      if (oc < 0) {
        var dat = f ? buf.subarray(0, is - 12 - (oc == -2 && 8) - (b4(buf, is - 16) == 134695760 && 4)) : buf.subarray(0, i);
        if (add)
          add.push(dat, !!f);
        else
          this.k[+(f == 2)].push(dat);
      }
      if (f & 2)
        return this.push(buf.subarray(i), final);
      this.p = buf.subarray(i);
    }
    if (final) {
      if (this.c)
        err(13);
      this.p = null;
    }
  };
  Unzip2.prototype.register = function(decoder) {
    this.o[decoder.compression] = decoder;
  };
  return Unzip2;
})();
var mt = typeof queueMicrotask == "function" ? queueMicrotask : typeof setTimeout == "function" ? setTimeout : function(fn) {
  fn();
};
function unzip(data, opts, cb) {
  if (!cb)
    cb = opts, opts = {};
  if (typeof cb != "function")
    err(7);
  var term = [];
  var tAll = function() {
    for (var i2 = 0; i2 < term.length; ++i2)
      term[i2]();
  };
  var files = {};
  var cbd = function(a, b) {
    mt(function() {
      cb(a, b);
    });
  };
  mt(function() {
    cbd = cb;
  });
  var e = data.length - 22;
  for (; b4(data, e) != 101010256; --e) {
    if (!e || data.length - e > 65558) {
      cbd(err(13, 0, 1), null);
      return tAll;
    }
  }
  var lft = b2(data, e + 8);
  if (lft) {
    var c = lft;
    var o = b4(data, e + 16);
    var z = b4(data, e - 20) == 117853008;
    if (z) {
      var ze = b4(data, e - 12);
      z = b4(data, ze) == 101075792;
      if (z) {
        c = lft = b4(data, ze + 32);
        o = b4(data, ze + 48);
      }
    }
    var fltr = opts && opts.filter;
    var _loop_3 = function(i2) {
      var _a2 = zh(data, o, z), c_1 = _a2[0], sc = _a2[1], su = _a2[2], fn = _a2[3], no = _a2[4], off = _a2[5], b = slzh(data, off);
      o = no;
      var cbl = function(e2, d) {
        if (e2) {
          tAll();
          cbd(e2, null);
        } else {
          if (d)
            files[fn] = d;
          if (!--lft)
            cbd(null, files);
        }
      };
      if (!fltr || fltr({
        name: fn,
        size: sc,
        originalSize: su,
        compression: c_1
      })) {
        if (!c_1)
          cbl(null, slc(data, b, b + sc));
        else if (c_1 == 8) {
          var infl = data.subarray(b, b + sc);
          if (su < 524288 || sc > 0.8 * su) {
            try {
              cbl(null, inflateSync(infl, { out: new u8(su) }));
            } catch (e2) {
              cbl(e2, null);
            }
          } else
            term.push(inflate(infl, { size: su }, cbl));
        } else
          cbl(err(14, "unknown compression type " + c_1, 1), null);
      } else
        cbl(null, null);
    };
    for (var i = 0; i < c; ++i) {
      _loop_3(i);
    }
  } else
    cbd(null, {});
  return tAll;
}
function unzipSync(data, opts) {
  var files = {};
  var e = data.length - 22;
  for (; b4(data, e) != 101010256; --e) {
    if (!e || data.length - e > 65558)
      err(13);
  }
  var c = b2(data, e + 8);
  if (!c)
    return {};
  var o = b4(data, e + 16);
  var z = b4(data, e - 20) == 117853008;
  if (z) {
    var ze = b4(data, e - 12);
    z = b4(data, ze) == 101075792;
    if (z) {
      c = b4(data, ze + 32);
      o = b4(data, ze + 48);
    }
  }
  var fltr = opts && opts.filter;
  for (var i = 0; i < c; ++i) {
    var _a2 = zh(data, o, z), c_2 = _a2[0], sc = _a2[1], su = _a2[2], fn = _a2[3], no = _a2[4], off = _a2[5], b = slzh(data, off);
    o = no;
    if (!fltr || fltr({
      name: fn,
      size: sc,
      originalSize: su,
      compression: c_2
    })) {
      if (!c_2)
        files[fn] = slc(data, b, b + sc);
      else if (c_2 == 8)
        files[fn] = inflateSync(data.subarray(b, b + sc), { out: new u8(su) });
      else
        err(14, "unknown compression type " + c_2);
    }
  }
  return files;
}
const browser = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  AsyncCompress: AsyncGzip,
  AsyncDecompress,
  AsyncDeflate,
  AsyncGunzip,
  AsyncGzip,
  AsyncInflate,
  AsyncUnzipInflate,
  AsyncUnzlib,
  AsyncZipDeflate,
  AsyncZlib,
  Compress: Gzip,
  DecodeUTF8,
  Decompress,
  Deflate,
  EncodeUTF8,
  FlateErrorCode,
  Gunzip,
  Gzip,
  Inflate,
  Unzip,
  UnzipInflate,
  UnzipPassThrough,
  Unzlib,
  Zip,
  ZipDeflate,
  ZipPassThrough,
  Zlib,
  compress: gzip,
  compressSync: gzipSync,
  decompress,
  decompressSync,
  deflate,
  deflateSync,
  gunzip,
  gunzipSync,
  gzip,
  gzipSync,
  inflate,
  inflateSync,
  strFromU8,
  strToU8,
  unzip,
  unzipSync,
  unzlib,
  unzlibSync,
  zip,
  zipSync,
  zlib,
  zlibSync
}, Symbol.toStringTag, { value: "Module" }));
export {
  AdapterRequiredError,
  CBZParser,
  CorruptedFileError,
  EBookError,
  EPUBParser,
  FB2Parser,
  MOBIParser,
  ParseError,
  UnsupportedFormatError,
  UnsupportedInputError,
  WechatMiniProgramDOMAdapter,
  WechatMiniProgramRenderer,
  WechatMiniProgramURLFactory,
  canAccessTarget,
  cbz,
  createWechatMiniProgramRenderer,
  epub,
  estimateNextTotalFractionFromSnapshot,
  estimatePageLimitFraction,
  fb2,
  getAllowedTOCHrefs,
  getCurrentTOCAccessItem,
  getTOCAccessItems,
  getTargetStartFraction,
  getTotalFraction,
  getTrialPageStepFraction,
  isRebookDebugEnabled,
  mobi,
  normalizeBookPath,
  normalizeNavigationHref,
  registry,
  resolveBookNavigation,
  setRebookDebug,
  willForwardExceedLimit
};
