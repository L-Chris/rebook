import { bytesToLatin1, findLastBytes, readLine, skipWhitespace, toBytes } from './bytes'
import { decodeFilter } from './filters'
import { createIdentityCidFontDecoder, createPdfFontSource, createSimpleFontDecoder, createToUnicodeFontDecoder, fontDescriptor, identityFontDecoder, isIdentityCidFont, PdfFontMap } from './fonts'
import { buildPageDisplayList, collectResourceNames, PdfContentResourceNames, PdfFormResource, PdfGraphicsColorSpace, PdfGraphicsResources, PdfGraphicsState, readOptionalGraphicsColorSpace, readOptionalShading, readOptionalShadingPattern } from './graphics'
import { applyColorKeyMaskToRgba, applySoftMaskToRgba, applyStencilMaskToRgba, imageMaskSamplesToRgba, imageSamplesToRgba, readImageColorKeyMask, readImageColorSpace, readImageDecode, readOptionalDeviceColorSpace, supportsImageBits } from './images'
import { PdfLexer } from './lexer'
import {
  isDict,
  isName,
  isRef,
  isStream,
  PdfDecodedImageData,
  PdfDeviceColorSpace,
  PdfDict,
  PdfDestination,
  PdfDestinationItem,
  PdfError,
  PdfFontSource,
  PdfBlendMode,
  PdfImageData,
  PdfLineCap,
  PdfLineJoin,
  PdfMatrix,
  PdfName,
  PdfNamedDestinations,
  PdfOutlineItem,
  PdfPageAnnotations,
  PdfPageDisplayList,
  PdfPageLabelRule,
  PdfPageLabelStyle,
  PdfLoadOptions,
  PdfObject,
  PdfPageInfo,
  PdfPageText,
  PdfPrimitive,
  PdfRef,
  PdfRect,
  PdfShading,
  PdfShadingPattern,
  PdfStream,
} from '../types'
import { extractPageText, PdfTextFormResource, PdfTextResources } from './text'

export class RebookPdfDocument {
  private readonly objects = new Map<string, PdfObject>()
  private readonly objectCache = new Map<string, PdfPrimitive>()
  private readonly pageContentCache = new Map<number, Promise<DecodedPageContent>>()
  private readonly pageAnnotationCache = new Map<number, Promise<PdfPageAnnotations>>()
  private readonly pageTextCache = new Map<number, Promise<PdfPageText>>()
  private readonly pageDisplayListCache = new Map<number, Promise<PdfPageDisplayList>>()
  private outlineCache?: Promise<PdfOutlineItem[]>
  private namedDestinationsCache?: Promise<PdfNamedDestinations>
  private pageLabelsCache?: Promise<string[]>
  private decodedStreamCache = new WeakMap<PdfStream, Promise<Uint8Array>>()
  private imageCache = new WeakMap<PdfStream, Promise<PdfImageData>>()
  private fontCache = new WeakMap<PdfDict, Map<string, Promise<PdfFontMap>>>()
  private fontSourceCache = new WeakMap<PdfDict, Promise<PdfFontSource | undefined>>()
  private pagesCache?: PdfPageInfo[]
  private root?: PdfDict

  private constructor(
    private readonly bytes: Uint8Array,
    private readonly options: PdfLoadOptions,
  ) {}

  static async load(input: ArrayBuffer | Uint8Array, options: PdfLoadOptions = {}): Promise<RebookPdfDocument> {
    const document = new RebookPdfDocument(toBytes(input), options)
    await document.indexObjects()
    document.root = document.findCatalog()
    return document
  }

  get version(): string {
    const header = bytesToLatin1(this.bytes, 0, Math.min(32, this.bytes.length)).match(/%PDF-(\d+\.\d+)/)
    return header?.[1] ?? 'unknown'
  }

  get pageCount(): number {
    return this.getPages().length
  }

  getPages(): PdfPageInfo[] {
    if (this.cacheEnabled && this.pagesCache) return this.pagesCache
    const catalog = this.requireCatalog()
    const pagesRef = catalog.entries.get('Pages')
    const pages = this.resolve(pagesRef)
    if (!isDict(pages)) throw new PdfError('Catalog does not contain a Pages dictionary')
    const result: PdfPageInfo[] = []
    this.walkPageTree(pages, result, inheritedState())
    const normalized = result.map((page, index) => ({ ...page, index }))
    if (this.cacheEnabled) this.pagesCache = normalized
    return normalized
  }

  async getPageText(pageIndex: number): Promise<PdfPageText> {
    if (this.cacheEnabled) {
      let cached = this.pageTextCache.get(pageIndex)
      if (!cached) {
        cached = this.buildPageText(pageIndex)
        this.pageTextCache.set(pageIndex, cached)
      }
      return cached
    }
    return this.buildPageText(pageIndex)
  }

  async getPageDisplayList(pageIndex: number): Promise<PdfPageDisplayList> {
    if (this.cacheEnabled) {
      let cached = this.pageDisplayListCache.get(pageIndex)
      if (!cached) {
        cached = this.buildPageDisplayList(pageIndex)
        this.pageDisplayListCache.set(pageIndex, cached)
      }
      return cached
    }
    return this.buildPageDisplayList(pageIndex)
  }

  async getPageAnnotations(pageIndex: number): Promise<PdfPageAnnotations> {
    if (this.cacheEnabled) {
      let cached = this.pageAnnotationCache.get(pageIndex)
      if (!cached) {
        cached = this.buildPageAnnotations(pageIndex)
        this.pageAnnotationCache.set(pageIndex, cached)
      }
      return cached
    }
    return this.buildPageAnnotations(pageIndex)
  }

  async getOutline(): Promise<PdfOutlineItem[]> {
    if (this.cacheEnabled) {
      this.outlineCache ??= this.buildOutline()
      return this.outlineCache
    }
    return this.buildOutline()
  }

  async getNamedDestinations(): Promise<PdfNamedDestinations> {
    if (this.cacheEnabled) {
      this.namedDestinationsCache ??= this.buildNamedDestinations()
      return this.namedDestinationsCache
    }
    return this.buildNamedDestinations()
  }

  async getPageLabels(): Promise<string[]> {
    if (this.cacheEnabled) {
      this.pageLabelsCache ??= this.buildPageLabels()
      return this.pageLabelsCache
    }
    return this.buildPageLabels()
  }

  clearCaches(): void {
    this.objectCache.clear()
    this.pageContentCache.clear()
    this.pageAnnotationCache.clear()
    this.pageTextCache.clear()
    this.pageDisplayListCache.clear()
    this.decodedStreamCache = new WeakMap<PdfStream, Promise<Uint8Array>>()
    this.imageCache = new WeakMap<PdfStream, Promise<PdfImageData>>()
    this.fontCache = new WeakMap<PdfDict, Map<string, Promise<PdfFontMap>>>()
    this.fontSourceCache = new WeakMap<PdfDict, Promise<PdfFontSource | undefined>>()
    this.pagesCache = undefined
    this.outlineCache = undefined
    this.namedDestinationsCache = undefined
    this.pageLabelsCache = undefined
  }

  private get cacheEnabled(): boolean {
    return this.options.cache !== false
  }

  private async buildPageText(pageIndex: number): Promise<PdfPageText> {
    const { page, chunks, width, height, transform } = await this.getDecodedPageContent(pageIndex)
    const resources = await this.readTextResources(page.resources, 0, this.collectUsedResourceNames(page.resources, chunks))
    return extractPageText(chunks, page.index, width, height, resources, transform)
  }

  private async buildPageDisplayList(pageIndex: number): Promise<PdfPageDisplayList> {
    const { page, chunks, width, height, transform } = await this.getDecodedPageContent(pageIndex)
    const resources = await this.readGraphicsResources(page.resources, 0, this.collectUsedResourceNames(page.resources, chunks))
    return transformDisplayListToPage(buildPageDisplayList(chunks, page.index, width, height, resources), transform)
  }

  private async buildPageAnnotations(pageIndex: number): Promise<PdfPageAnnotations> {
    const page = this.getPages()[pageIndex]
    if (!page) throw new PdfError(`Page ${pageIndex} does not exist`)
    const dict = asDict(page.object.value)
    const annots = this.resolve(dict.entries.get('Annots'))
    const geometry = pageGeometry(page)
    return {
      pageIndex: page.index,
      width: geometry.width,
      height: geometry.height,
      annotations: this.readPageAnnotations(annots, geometry.transform),
    }
  }

  private readPageAnnotations(value: PdfPrimitive | undefined, transform: PdfMatrix): PdfPageAnnotations['annotations'] {
    const items = Array.isArray(value) ? value : value ? [value] : []
    const annotations: PdfPageAnnotations['annotations'] = []
    for (const item of items) {
      const annotation = this.readAnnotation(this.resolve(item), transform)
      if (annotation) annotations.push(annotation)
    }
    return annotations
  }

  private readAnnotation(value: PdfPrimitive | undefined, transform: PdfMatrix): PdfPageAnnotations['annotations'][number] | undefined {
    if (!isDict(value)) return undefined
    const subtype = this.resolve(value.entries.get('Subtype'))
    if (!isName(subtype, 'Link')) return undefined
    const rect = toBox(this.resolve(value.entries.get('Rect')))
    if (!rect) return undefined
    const contents = stringValue(this.resolve(value.entries.get('Contents')))
    const link = this.readTarget(value)
    return {
      type: 'link',
      rect: transformRect(normalizeRect(rect), transform),
      ...(contents ? { contents } : {}),
      ...(link.url ? { url: link.url } : {}),
      ...(link.destination ? { destination: link.destination } : {}),
    }
  }

  private async buildOutline(): Promise<PdfOutlineItem[]> {
    const catalog = this.requireCatalog()
    const outlines = this.resolve(catalog.entries.get('Outlines'))
    if (!isDict(outlines)) return []
    return this.readOutlineItems(this.resolve(outlines.entries.get('First')), new WeakSet(), 0)
  }

  private async buildNamedDestinations(): Promise<PdfNamedDestinations> {
    const catalog = this.requireCatalog()
    const destinations: PdfNamedDestinations = {}
    const names = this.resolve(catalog.entries.get('Names'))
    if (isDict(names)) this.readNamedDestinationsTree(this.resolve(names.entries.get('Dests')), destinations, new WeakSet(), 0)
    const legacyDests = this.resolve(catalog.entries.get('Dests'))
    if (isDict(legacyDests)) this.readLegacyDestinations(legacyDests, destinations)
    return destinations
  }

  private async buildPageLabels(): Promise<string[]> {
    const pageCount = this.pageCount
    const catalog = this.requireCatalog()
    const pageLabels = this.resolve(catalog.entries.get('PageLabels'))
    if (!isDict(pageLabels)) return defaultPageLabels(pageCount)
    const rules = this.readPageLabelRules(pageLabels)
    if (rules.length === 0 || rules[0]?.index !== 0) rules.unshift({ index: 0, start: 1 })
    rules.sort((a, b) => a.index - b.index)
    return buildPageLabels(pageCount, rules)
  }

  private readPageLabelRules(dict: PdfDict): PdfPageLabelRule[] {
    const rules: PdfPageLabelRule[] = []
    this.readPageLabelTree(dict, rules, new WeakSet(), 0)
    return rules
  }

  private readPageLabelTree(dict: PdfDict, output: PdfPageLabelRule[], seen: WeakSet<PdfDict>, depth: number): void {
    if (seen.has(dict) || depth > maxNumberTreeDepth) return
    seen.add(dict)
    const nums = this.resolve(dict.entries.get('Nums'))
    if (Array.isArray(nums)) {
      for (let index = 0; index + 1 < nums.length; index += 2) {
        const pageIndex = this.resolve(nums[index])
        const ruleDict = this.resolve(nums[index + 1])
        const rule = this.readPageLabelRule(pageIndex, ruleDict)
        if (rule) output.push(rule)
      }
    }
    const kids = this.resolve(dict.entries.get('Kids'))
    if (!Array.isArray(kids)) return
    for (const kid of kids) {
      const child = this.resolve(kid)
      if (isDict(child)) this.readPageLabelTree(child, output, seen, depth + 1)
    }
  }

  private readPageLabelRule(pageIndex: PdfPrimitive | undefined, value: PdfPrimitive | undefined): PdfPageLabelRule | undefined {
    if (typeof pageIndex !== 'number' || !Number.isInteger(pageIndex) || pageIndex < 0 || !isDict(value)) return undefined
    const style = pageLabelStyle(this.resolve(value.entries.get('S')))
    const prefix = stringValue(this.resolve(value.entries.get('P')))
    const startValue = this.resolve(value.entries.get('St'))
    const start = typeof startValue === 'number' && Number.isInteger(startValue) && startValue > 0 ? startValue : 1
    return {
      index: pageIndex,
      ...(style ? { style } : {}),
      ...(prefix !== undefined ? { prefix } : {}),
      start,
    }
  }

  private readNamedDestinationsTree(value: PdfPrimitive | undefined, output: PdfNamedDestinations, seen: WeakSet<PdfDict>, depth: number): void {
    const dict = this.resolve(value)
    if (!isDict(dict) || seen.has(dict) || depth > maxNameTreeDepth) return
    seen.add(dict)
    const names = this.resolve(dict.entries.get('Names'))
    if (Array.isArray(names)) {
      for (let index = 0; index + 1 < names.length; index += 2) {
        const key = destinationName(this.resolve(names[index]))
        const destination = readDestinationValue(this.resolve(names[index + 1]))
        if (key !== undefined && destination !== undefined) output[key] = destination
      }
    }
    const kids = this.resolve(dict.entries.get('Kids'))
    if (!Array.isArray(kids)) return
    for (const kid of kids) this.readNamedDestinationsTree(kid, output, seen, depth + 1)
  }

  private readLegacyDestinations(dict: PdfDict, output: PdfNamedDestinations): void {
    for (const [key, value] of dict.entries) {
      const destination = readDestinationValue(this.resolve(value))
      if (destination !== undefined) output[key] = destination
    }
  }

  private readOutlineItems(value: PdfPrimitive | undefined, seen: WeakSet<PdfDict>, depth: number): PdfOutlineItem[] {
    if (depth > maxOutlineDepth) return []
    const items: PdfOutlineItem[] = []
    let current = this.resolve(value)
    while (isDict(current) && !seen.has(current)) {
      seen.add(current)
      const item = this.readOutlineItem(current, seen, depth)
      if (item) items.push(item)
      current = this.resolve(current.entries.get('Next'))
    }
    return items
  }

  private readOutlineItem(dict: PdfDict, seen: WeakSet<PdfDict>, depth: number): PdfOutlineItem | undefined {
    const title = stringValue(this.resolve(dict.entries.get('Title')))
    if (title === undefined) return undefined
    const target = this.readTarget(dict)
    const count = numberValue(this.resolve(dict.entries.get('Count')))
    return {
      title,
      ...(target.url ? { url: target.url } : {}),
      ...(target.destination ? { destination: target.destination } : {}),
      ...(count !== undefined ? { count, open: count >= 0 } : {}),
      items: this.readOutlineItems(this.resolve(dict.entries.get('First')), seen, depth + 1),
    }
  }

  private readTarget(dict: PdfDict): { url?: string; destination?: PdfDestination } {
    const action = this.resolve(dict.entries.get('A'))
    const directDestination = readDestination(this.resolve(dict.entries.get('Dest')))
    if (!isDict(action)) return directDestination ? { destination: directDestination } : {}
    const subtype = this.resolve(action.entries.get('S'))
    if (isName(subtype, 'URI')) {
      const url = stringValue(this.resolve(action.entries.get('URI')))
      return {
        ...(url ? { url } : {}),
        ...(directDestination ? { destination: directDestination } : {}),
      }
    }
    if (isName(subtype, 'GoTo')) {
      return {
        destination: readDestination(this.resolve(action.entries.get('D'))) ?? directDestination,
      }
    }
    return directDestination ? { destination: directDestination } : {}
  }

  resolve<T extends PdfPrimitive | undefined>(value: T, depth = 0): PdfPrimitive | undefined {
    if (!isRef(value)) return value
    if (depth > 64) throw new PdfError('PDF reference graph is too deep')
    const key = refKey(value)
    const cached = this.objectCache.get(key)
    if (cached) return cached
    const object = this.objects.get(key)
    if (!object) throw new PdfError(`Missing object ${value.objectNumber} ${value.generation} R`)
    this.objectCache.set(key, object.value)
    return object.value
  }

  getObject(ref: PdfRef): PdfObject | undefined {
    return this.objects.get(refKey(ref))
  }

  private async getDecodedPageContent(pageIndex: number): Promise<DecodedPageContent> {
    if (this.cacheEnabled) {
      let cached = this.pageContentCache.get(pageIndex)
      if (!cached) {
        cached = this.buildDecodedPageContent(pageIndex)
        this.pageContentCache.set(pageIndex, cached)
      }
      return cached
    }
    return this.buildDecodedPageContent(pageIndex)
  }

  private async buildDecodedPageContent(pageIndex: number): Promise<DecodedPageContent> {
    const page = this.getPages()[pageIndex]
    if (!page) throw new PdfError(`Page ${pageIndex} does not exist`)
    const dict = asDict(page.object.value)
    const contents = this.resolve(dict.entries.get('Contents'))
    const streams = Array.isArray(contents) ? contents.map((item) => this.resolve(item)).filter(isStream) : isStream(contents) ? [contents] : []
    const chunks: Uint8Array[] = []
    for (const stream of streams) chunks.push(await this.decodePdfStream(stream))
    const geometry = pageGeometry(page)
    return {
      page,
      chunks,
      width: geometry.width,
      height: geometry.height,
      transform: geometry.transform,
    }
  }

  private async indexObjects(): Promise<void> {
    const xrefOffset = this.findStartXref()
    if (xrefOffset >= 0 && (await this.readXrefChain(xrefOffset))) return
    this.scanIndirectObjects()
  }

  private async readXrefChain(startOffset: number): Promise<boolean> {
    const seen = new Set<number>()
    let offset = startOffset
    let found = false
    while (offset >= 0 && !seen.has(offset)) {
      seen.add(offset)
      const table = this.tryReadXrefTable(offset)
      const result = table.found ? table : await this.tryReadXrefStream(offset)
      if (!result.found) break
      found = true
      offset = result.prev ?? -1
    }
    return found
  }

  private findStartXref(): number {
    const start = findLastBytes(this.bytes, 'startxref')
    if (start < 0) return -1
    const afterMarker = readLine(this.bytes, start).next
    const { line } = readLine(this.bytes, afterMarker)
    const value = Number(line.trim())
    return Number.isFinite(value) ? value : -1
  }

  private tryReadXrefTable(offset: number): XrefReadResult {
    let cursor = skipWhitespace(this.bytes, offset)
    if (bytesToLatin1(this.bytes, cursor, cursor + 4) !== 'xref') return { found: false }
    cursor = readLine(this.bytes, cursor).next
    while (cursor < this.bytes.length) {
      cursor = skipWhitespace(this.bytes, cursor)
      if (bytesToLatin1(this.bytes, cursor, cursor + 7) === 'trailer') break
      const section = readLine(this.bytes, cursor)
      cursor = section.next
      const [firstRaw, countRaw] = section.line.trim().split(/\s+/)
      const first = Number(firstRaw)
      const count = Number(countRaw)
      if (!Number.isInteger(first) || !Number.isInteger(count)) return { found: false }
      for (let i = 0; i < count; i++) {
        const entry = readLine(this.bytes, cursor)
        cursor = entry.next
        const offsetRaw = entry.line.slice(0, 10).trim()
        const generationRaw = entry.line.slice(11, 16).trim()
        const flag = entry.line.slice(17, 18)
        if (flag !== 'n') continue
        const objectOffset = Number(offsetRaw)
        const generation = Number(generationRaw)
        if (!Number.isInteger(objectOffset) || !Number.isInteger(generation)) continue
        this.readObjectAt(objectOffset, first + i, generation)
      }
    }
    const trailer = this.readTrailer(cursor)
    return { found: true, prev: readPrevOffset(trailer) }
  }

  private async tryReadXrefStream(offset: number): Promise<XrefReadResult> {
    const object = this.readObjectAt(offset)
    if (!object || !isStream(object.value)) return { found: false }
    const stream = object.value
    if (!isName(this.resolve(stream.dict.entries.get('Type')), 'XRef')) return { found: false }
    const decoded = await this.decodeStream(stream.dict, stream.data)
    const widths = toNumberArray(this.resolve(stream.dict.entries.get('W')))
    if (widths.length !== 3) throw new PdfError('XRef stream is missing a valid W array')
    const index = toNumberArray(this.resolve(stream.dict.entries.get('Index')))
    const sections = index.length > 0 ? index : [0, Number(this.resolve(stream.dict.entries.get('Size')) ?? 0)]
    const compressedEntries: CompressedXrefEntry[] = []
    let cursor = 0
    for (let i = 0; i < sections.length; i += 2) {
      const firstObject = sections[i]
      const count = sections[i + 1]
      for (let j = 0; j < count; j++) {
        const entry = readXrefStreamEntry(decoded, cursor, widths)
        cursor += widths[0] + widths[1] + widths[2]
        if (entry.type === 1) this.readObjectAt(entry.offset, firstObject + j, entry.generation)
        else if (entry.type === 2) {
          compressedEntries.push({
            objectNumber: firstObject + j,
            objectStreamNumber: entry.offset,
            objectStreamIndex: entry.generation,
          })
        }
      }
    }
    await this.readCompressedObjects(compressedEntries)
    return { found: true, prev: readPrevOffset(stream.dict) }
  }

  private async readCompressedObjects(entries: CompressedXrefEntry[]): Promise<void> {
    if (entries.length === 0) return
    const neededStreams = new Map<number, Set<number>>()
    for (const entry of entries) {
      let indexes = neededStreams.get(entry.objectStreamNumber)
      if (!indexes) {
        indexes = new Set<number>()
        neededStreams.set(entry.objectStreamNumber, indexes)
      }
      indexes.add(entry.objectStreamIndex)
    }
    for (const [objectStreamNumber, neededIndexes] of neededStreams) {
      const object = this.objects.get(`${objectStreamNumber}:0`)
      if (!object || !isStream(object.value)) continue
      if (!isName(this.resolve(object.value.dict.entries.get('Type')), 'ObjStm')) continue
      const decoded = await this.decodePdfStream(object.value)
      const objectCount = Number(this.resolve(object.value.dict.entries.get('N')) ?? 0)
      const firstObjectOffset = Number(this.resolve(object.value.dict.entries.get('First')) ?? 0)
      if (!Number.isInteger(objectCount) || !Number.isInteger(firstObjectOffset)) continue
      const table = parseObjectStreamTable(decoded, objectCount, firstObjectOffset)
      for (let index = 0; index < table.length; index++) {
        if (!neededIndexes.has(index)) continue
        const entry = table[index]
        if (this.objects.has(`${entry.objectNumber}:0`)) continue
        const lexer = new PdfLexer(decoded, firstObjectOffset + entry.offset)
        const value = lexer.readObject()
        this.objects.set(`${entry.objectNumber}:0`, {
          objectNumber: entry.objectNumber,
          generation: 0,
          value,
        })
      }
    }
  }

  private scanIndirectObjects(): void {
    const source = bytesToLatin1(this.bytes)
    const pattern = /(^|\s)(\d+)\s+(\d+)\s+obj\b/g
    let match: RegExpExecArray | null
    while ((match = pattern.exec(source))) {
      const objectOffset = match.index + match[1].length
      this.readObjectAt(objectOffset, Number(match[2]), Number(match[3]))
    }
  }

  private readObjectAt(offset: number, expectedNumber?: number, expectedGeneration?: number): PdfObject | undefined {
    try {
      const lexer = new PdfLexer(this.bytes, offset)
      const object = lexer.readIndirectObject()
      if (expectedNumber !== undefined && object.objectNumber !== expectedNumber) return undefined
      if (expectedGeneration !== undefined && object.generation !== expectedGeneration) return undefined
      const key = `${object.objectNumber}:${object.generation}`
      const existing = this.objects.get(key)
      if (existing) return existing
      this.objects.set(key, object)
      return object
    } catch {
      // Keep indexing resilient: malformed or compressed entries can be skipped for MVP.
      return undefined
    }
  }

  private readTrailer(offset: number): PdfDict | undefined {
    let cursor = skipWhitespace(this.bytes, offset)
    if (bytesToLatin1(this.bytes, cursor, cursor + 7) !== 'trailer') return undefined
    cursor += 'trailer'.length
    try {
      const trailer = new PdfLexer(this.bytes, cursor).readObject()
      return isDict(trailer) ? trailer : undefined
    } catch {
      return undefined
    }
  }

  private findCatalog(): PdfDict {
    for (const object of this.objects.values()) {
      const value = this.resolve(object.value)
      if (isDict(value) && isName(value.entries.get('Type'), 'Catalog')) return value
    }
    throw new PdfError('PDF catalog was not found')
  }

  private requireCatalog(): PdfDict {
    if (!this.root) throw new PdfError('PDF catalog was not initialized')
    return this.root
  }

  private walkPageTree(dict: PdfDict, output: PdfPageInfo[], state: PageState): void {
    const nextState = mergeState(this, dict, state)
    const type = this.resolve(dict.entries.get('Type'))
    if (isName(type, 'Page')) {
      const ref = findObjectForValue(this.objects, dict)
      if (!ref) throw new PdfError('Page dictionary has no owning object')
      output.push({
        index: output.length,
        object: ref,
        mediaBox: nextState.mediaBox,
        cropBox: nextState.cropBox ?? nextState.mediaBox,
        rotate: nextState.rotate,
        userUnit: nextState.userUnit,
        resources: nextState.resources,
      })
      return
    }
    const kids = this.resolve(dict.entries.get('Kids'))
    if (!Array.isArray(kids)) return
    for (const kid of kids) {
      const resolved = this.resolve(kid)
      if (isDict(resolved)) this.walkPageTree(resolved, output, nextState)
    }
  }

  private async decodeStream(dict: PdfDict, data: Uint8Array): Promise<Uint8Array> {
    const { filters, decodeParmsList } = this.readStreamFilters(dict)
    let current = data
    for (let index = 0; index < filters.length; index++) {
      const item = filters[index]
      current = await this.decodeByteFilter(item.value, current, dict, decodeParmsList[index])
    }
    return current
  }

  private readStreamFilters(dict: PdfDict): { filters: PdfName[]; decodeParmsList: Array<PdfPrimitive | undefined> } {
    const filter = this.resolve(dict.entries.get('Filter'))
    if (!filter) return { filters: [], decodeParmsList: [] }
    const filters = Array.isArray(filter) ? filter : [filter]
    if (!filters.every((item): item is PdfName => isName(item))) throw new PdfError('Unsupported stream filter descriptor')
    const decodeParms = this.resolve(dict.entries.get('DecodeParms') ?? dict.entries.get('DP'))
    const decodeParmsList = Array.isArray(decodeParms) ? decodeParms.map((item) => this.resolve(item)) : [decodeParms]
    return { filters, decodeParmsList }
  }

  private async decodeByteFilter(name: string, data: Uint8Array, dict: PdfDict, decodeParms: PdfPrimitive | undefined): Promise<Uint8Array> {
    if (this.options.decodeStream) return this.options.decodeStream(name, data, dict)
    return decodeFilter(name, data, dict, this.options.runtime, decodeParms)
  }

  private async decodePdfStream(stream: PdfStream): Promise<Uint8Array> {
    if (!this.cacheEnabled) return this.decodeStream(stream.dict, stream.data)
    let cached = this.decodedStreamCache.get(stream)
    if (!cached) {
      cached = this.decodeStream(stream.dict, stream.data)
      this.decodedStreamCache.set(stream, cached)
    }
    return cached
  }

  private collectUsedResourceNames(resources: PdfDict | undefined, streams: Uint8Array[]): Partial<PdfContentResourceNames> | undefined {
    const hasFonts = this.hasFontResources(resources)
    const hasXObjects = this.hasXObjectResources(resources)
    const hasShadings = this.hasShadingResources(resources)
    const hasPatterns = this.hasPatternResources(resources)
    if (!hasFonts && !hasXObjects && !hasShadings && !hasPatterns) return undefined
    const names = collectResourceNames(streams)
    return {
      fonts: hasFonts ? names.fonts : undefined,
      xObjects: hasXObjects ? names.xObjects : undefined,
      shadings: hasShadings ? names.shadings : undefined,
      patterns: hasPatterns ? names.patterns : undefined,
    }
  }

  private hasXObjectResources(resources: PdfDict | undefined): boolean {
    if (!resources) return false
    return isDict(this.resolve(resources.entries.get('XObject')))
  }

  private hasFontResources(resources: PdfDict | undefined): boolean {
    if (!resources) return false
    return isDict(this.resolve(resources.entries.get('Font')))
  }

  private hasShadingResources(resources: PdfDict | undefined): boolean {
    if (!resources) return false
    return isDict(this.resolve(resources.entries.get('Shading')))
  }

  private hasPatternResources(resources: PdfDict | undefined): boolean {
    if (!resources) return false
    return isDict(this.resolve(resources.entries.get('Pattern')))
  }

  private async readGraphicsResources(resources: PdfDict | undefined, depth = 0, usedResources?: Partial<PdfContentResourceNames>): Promise<PdfGraphicsResources> {
    const colorSpaces = this.readColorSpaceResources(resources)
    const [fonts, xObjects] = await Promise.all([this.readFontResources(resources, usedResources?.fonts), this.readXObjectResources(resources, depth, usedResources?.xObjects, colorSpaces)])
    return {
      fonts,
      images: xObjects.images,
      forms: xObjects.forms,
      colorSpaces,
      graphicsStates: this.readGraphicsStateResources(resources),
      shadings: this.readShadingResources(resources, usedResources?.shadings, colorSpaces),
      patterns: this.readPatternResources(resources, usedResources?.patterns, colorSpaces),
    }
  }

  private readColorSpaceResources(resources: PdfDict | undefined): Map<string, PdfGraphicsColorSpace> {
    const colorSpaces = new Map<string, PdfGraphicsColorSpace>()
    if (!resources) return colorSpaces
    const dict = this.resolve(resources.entries.get('ColorSpace') ?? resources.entries.get('CS'))
    if (!isDict(dict)) return colorSpaces
    for (const [name, value] of dict.entries) {
      const colorSpace = readOptionalGraphicsColorSpace(value, (item) => this.resolve(item))
      if (colorSpace) colorSpaces.set(name, colorSpace)
    }
    return colorSpaces
  }

  private readGraphicsStateResources(resources: PdfDict | undefined): Map<string, PdfGraphicsState> {
    const states = new Map<string, PdfGraphicsState>()
    if (!resources) return states
    const dict = this.resolve(resources.entries.get('ExtGState'))
    if (!isDict(dict)) return states
    for (const [name, value] of dict.entries) {
      const state = this.resolve(value)
      if (isDict(state)) states.set(name, this.readGraphicsState(state))
    }
    return states
  }

  private readGraphicsState(dict: PdfDict): PdfGraphicsState {
    return {
      lineWidth: numberValue(this.resolve(dict.entries.get('LW'))),
      lineCap: lineCapValue(this.resolve(dict.entries.get('LC'))),
      lineJoin: lineJoinValue(this.resolve(dict.entries.get('LJ'))),
      miterLimit: numberValue(this.resolve(dict.entries.get('ML'))),
      dash: dashValue(this.resolve(dict.entries.get('D'))),
      strokeAlpha: alphaValue(this.resolve(dict.entries.get('CA'))),
      fillAlpha: alphaValue(this.resolve(dict.entries.get('ca'))),
      blendMode: blendModeValue(this.resolve(dict.entries.get('BM'))),
    }
  }

  private readShadingResources(resources: PdfDict | undefined, usedShadings: Set<string> | undefined, colorSpaces: Map<string, PdfGraphicsColorSpace>): Map<string, PdfShading> {
    const shadings = new Map<string, PdfShading>()
    if (!resources) return shadings
    const dict = this.resolve(resources.entries.get('Shading'))
    if (!isDict(dict)) return shadings
    for (const [name, value] of dict.entries) {
      if (usedShadings && !usedShadings.has(name)) continue
      const shading = readOptionalShading(value, (item) => this.resolve(item), colorSpaces)
      if (shading) shadings.set(name, shading)
    }
    return shadings
  }

  private readPatternResources(resources: PdfDict | undefined, usedPatterns: Set<string> | undefined, colorSpaces: Map<string, PdfGraphicsColorSpace>): Map<string, PdfShadingPattern> {
    const patterns = new Map<string, PdfShadingPattern>()
    if (!resources) return patterns
    const dict = this.resolve(resources.entries.get('Pattern'))
    if (!isDict(dict)) return patterns
    for (const [name, value] of dict.entries) {
      if (usedPatterns && !usedPatterns.has(name)) continue
      const pattern = readOptionalShadingPattern(name, value, (item) => this.resolve(item), colorSpaces)
      if (pattern) patterns.set(name, pattern)
    }
    return patterns
  }

  private async readXObjectResources(resources: PdfDict | undefined, depth: number, usedXObjects?: Set<string>, colorSpaces?: Map<string, PdfGraphicsColorSpace>): Promise<{ images: Map<string, PdfImageData>; forms: Map<string, PdfFormResource> }> {
    const images = new Map<string, PdfImageData>()
    const forms = new Map<string, PdfFormResource>()
    if (!resources) return { images, forms }
    const xObjects = this.resolve(resources.entries.get('XObject'))
    if (!isDict(xObjects)) return { images, forms }
    for (const [name, value] of xObjects.entries) {
      if (usedXObjects && !usedXObjects.has(name)) continue
      const xObject = this.resolve(value)
      if (!isStream(xObject)) continue
      const subtype = this.resolve(xObject.dict.entries.get('Subtype'))
      if (isName(subtype, 'Image')) images.set(name, await this.readImageXObject(xObject, 0, colorSpaces))
      else if (isName(subtype, 'Form') && depth < maxFormResourceDepth) forms.set(name, await this.readFormXObject(xObject, resources, depth + 1))
    }
    return { images, forms }
  }

  private async readFormXObject(stream: PdfStream, parentResources: PdfDict, depth: number): Promise<PdfFormResource> {
    const formResources = this.resolve(stream.dict.entries.get('Resources'))
    const decoded = await this.decodePdfStream(stream)
    const resolvedResources = isDict(formResources) ? formResources : parentResources
    const resources = await this.readGraphicsResources(resolvedResources, depth, this.collectUsedResourceNames(resolvedResources, [decoded]))
    return {
      matrix: toMatrix(this.resolve(stream.dict.entries.get('Matrix'))) ?? identityMatrix(),
      bbox: toBox(this.resolve(stream.dict.entries.get('BBox'))),
      streams: [decoded],
      resources,
    }
  }

  private async readTextResources(resources: PdfDict | undefined, depth = 0, usedResources?: Partial<PdfContentResourceNames>): Promise<PdfTextResources> {
    const [fonts, forms] = await Promise.all([this.readFontResources(resources, usedResources?.fonts), this.readTextFormResources(resources, depth, usedResources?.xObjects)])
    return { fonts, forms }
  }

  private async readTextFormResources(resources: PdfDict | undefined, depth: number, usedXObjects?: Set<string>): Promise<Map<string, PdfTextFormResource>> {
    const forms = new Map<string, PdfTextFormResource>()
    if (!resources || depth >= maxFormResourceDepth) return forms
    const xObjects = this.resolve(resources.entries.get('XObject'))
    if (!isDict(xObjects)) return forms
    for (const [name, value] of xObjects.entries) {
      if (usedXObjects && !usedXObjects.has(name)) continue
      const xObject = this.resolve(value)
      if (!isStream(xObject) || !isName(this.resolve(xObject.dict.entries.get('Subtype')), 'Form')) continue
      forms.set(name, await this.readTextFormXObject(xObject, resources, depth + 1))
    }
    return forms
  }

  private async readTextFormXObject(stream: PdfStream, parentResources: PdfDict, depth: number): Promise<PdfTextFormResource> {
    const formResources = this.resolve(stream.dict.entries.get('Resources'))
    const decoded = await this.decodePdfStream(stream)
    const resolvedResources = isDict(formResources) ? formResources : parentResources
    return {
      matrix: toMatrix(this.resolve(stream.dict.entries.get('Matrix'))) ?? identityMatrix(),
      streams: [decoded],
      resources: await this.readTextResources(resolvedResources, depth, this.collectUsedResourceNames(resolvedResources, [decoded])),
    }
  }

  private async readFontResources(resources: PdfDict | undefined, usedFonts?: Set<string>): Promise<PdfFontMap> {
    if (!resources) return new Map()
    if (this.cacheEnabled) {
      let resourceCache = this.fontCache.get(resources)
      if (!resourceCache) {
        resourceCache = new Map()
        this.fontCache.set(resources, resourceCache)
      }
      const key = fontCacheKey(usedFonts)
      let cached = resourceCache.get(key)
      if (!cached) {
        cached = this.buildFontResources(resources, usedFonts)
        resourceCache.set(key, cached)
      }
      return cached
    }
    return this.buildFontResources(resources, usedFonts)
  }

  private async buildFontResources(resources: PdfDict, usedFonts?: Set<string>): Promise<PdfFontMap> {
    const fonts = new Map()
    const fontDict = this.resolve(resources.entries.get('Font'))
    if (!isDict(fontDict)) return fonts
    for (const [name, value] of fontDict.entries) {
      if (usedFonts && !usedFonts.has(name)) continue
      const fontObject = this.resolve(value)
      const dict = isStream(fontObject) ? fontObject.dict : isDict(fontObject) ? fontObject : undefined
      if (!dict) {
        fonts.set(name, identityFontDecoder)
        continue
      }
      const toUnicode = this.resolve(dict.entries.get('ToUnicode'))
      const toUnicodeBytes = isStream(toUnicode) ? await this.decodePdfStream(toUnicode) : undefined
      const source = this.options.embeddedFonts ? await this.readFontSource(dict, toUnicodeBytes) : undefined
      if (toUnicodeBytes) fonts.set(name, createToUnicodeFontDecoder(toUnicodeBytes, dict, (item) => this.resolve(item), source))
      else if (isIdentityCidFont(dict, (item) => this.resolve(item))) fonts.set(name, createIdentityCidFontDecoder(dict, (item) => this.resolve(item), source))
      else fonts.set(name, createSimpleFontDecoder(dict, (item) => this.resolve(item), source))
    }
    return fonts
  }

  private async readFontSource(font: PdfDict, toUnicodeCMap?: Uint8Array): Promise<PdfFontSource | undefined> {
    if (this.cacheEnabled) {
      let cached = this.fontSourceCache.get(font)
      if (!cached) {
        cached = this.buildFontSource(font, toUnicodeCMap)
        this.fontSourceCache.set(font, cached)
      }
      return cached
    }
    return this.buildFontSource(font, toUnicodeCMap)
  }

  private async buildFontSource(font: PdfDict, toUnicodeCMap?: Uint8Array): Promise<PdfFontSource | undefined> {
    const descriptor = fontDescriptor(font, (item) => this.resolve(item))
    if (!descriptor) return undefined
    const fontFile =
      this.resolve(descriptor.entries.get('FontFile2')) ??
      this.resolve(descriptor.entries.get('FontFile3')) ??
      this.resolve(descriptor.entries.get('FontFile'))
    if (!isStream(fontFile)) return undefined
    const data = await this.decodePdfStream(fontFile)
    if (data.byteLength === 0) return undefined
    return createPdfFontSource(font, (item) => this.resolve(item), data, fontFileFormat(descriptor, fontFile), toUnicodeCMap)
  }

  private async readImageXObject(stream: PdfStream, softMaskDepth = 0, colorSpaceResources?: Map<string, PdfGraphicsColorSpace>): Promise<PdfImageData> {
    const resourceColorSpace = this.readImageResourceColorSpace(stream.dict, colorSpaceResources)
    if (this.cacheEnabled && softMaskDepth === 0 && !resourceColorSpace) {
      let cached = this.imageCache.get(stream)
      if (!cached) {
        cached = this.decodeImageXObject(stream, softMaskDepth)
        this.imageCache.set(stream, cached)
      }
      return cached
    }
    return this.decodeImageXObject(stream, softMaskDepth, resourceColorSpace)
  }

  private readImageResourceColorSpace(dict: PdfDict, colorSpaceResources: Map<string, PdfGraphicsColorSpace> | undefined): PdfDeviceColorSpace | undefined {
    if (!colorSpaceResources) return undefined
    const value = this.resolve(dict.entries.get('ColorSpace') ?? dict.entries.get('CS'))
    if (!isName(value) || readOptionalDeviceColorSpace(value)) return undefined
    const colorSpace = colorSpaceResources.get(value.value)
    return colorSpace === 'DeviceGray' || colorSpace === 'DeviceRGB' || colorSpace === 'DeviceCMYK' ? colorSpace : undefined
  }

  private async decodeImageXObject(stream: PdfStream, softMaskDepth = 0, resourceColorSpace?: PdfDeviceColorSpace): Promise<PdfImageData> {
    const dict = stream.dict
    const width = Number(this.resolve(dict.entries.get('Width') ?? dict.entries.get('W')) ?? 0)
    const height = Number(this.resolve(dict.entries.get('Height') ?? dict.entries.get('H')) ?? 0)
    const imageMask = this.resolve(dict.entries.get('ImageMask') ?? dict.entries.get('IM')) === true
    const bitsPerComponent = Number(this.resolve(dict.entries.get('BitsPerComponent') ?? dict.entries.get('BPC')) ?? (imageMask ? 1 : 8))
    const rasterImage = imageMask ? undefined : await this.decodeRasterImageXObject(stream)
    if (rasterImage) {
      if (width > 0 && height > 0 && (width !== rasterImage.width || height !== rasterImage.height)) throw new PdfError('DCTDecode image dimensions do not match the image dictionary')
      return this.applyImageMasks(dict, {
        width: rasterImage.width,
        height: rasterImage.height,
        bitsPerComponent: 8,
        colorSpace: 'DeviceRGB',
        data: rasterImage.data,
      }, softMaskDepth)
    }
    const colorSpace = imageMask ? 'DeviceGray' : resourceColorSpace ?? readImageColorSpace(dict.entries.get('ColorSpace') ?? dict.entries.get('CS'), (item) => this.resolve(item))
    const decode = readImageDecode(this.resolve(dict.entries.get('Decode') ?? dict.entries.get('D')))
    const colorKeyMask = imageMask ? undefined : readImageColorKeyMask(this.resolve(dict.entries.get('Mask')), colorSpace)
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) throw new PdfError('Image XObject has invalid dimensions')
    if (imageMask && bitsPerComponent !== 1) throw new PdfError('ImageMask XObject must use 1 bit per component')
    if (!supportsImageBits(bitsPerComponent, colorSpace)) throw new PdfError(`Image XObject bits per component ${bitsPerComponent} is not supported for this color space yet`)
    const decoded = await this.decodePdfStream(stream)
    const image = applyColorKeyMaskToRgba({
      width,
      height,
      bitsPerComponent,
      colorSpace,
      imageMask,
      data: imageMask ? imageMaskSamplesToRgba(decoded, width, height, decode) : imageSamplesToRgba(decoded, width, height, colorSpace, bitsPerComponent, decode),
    }, decoded, colorSpace, bitsPerComponent, colorKeyMask)
    return this.applyImageMasks(dict, image, softMaskDepth)
  }

  private async applyImageMasks(dict: PdfDict, image: PdfImageData, softMaskDepth: number): Promise<PdfImageData> {
    if (image.imageMask || softMaskDepth >= maxSoftMaskDepth) return image
    let output = image
    const mask = this.resolve(dict.entries.get('Mask'))
    if (isStream(mask)) output = applyStencilMaskToRgba(output, await this.readImageXObject(mask, softMaskDepth + 1))
    const softMask = this.resolve(dict.entries.get('SMask'))
    if (isStream(softMask)) output = applySoftMaskToRgba(output, await this.readImageXObject(softMask, softMaskDepth + 1))
    return output
  }

  private async decodeRasterImageXObject(stream: PdfStream): Promise<PdfDecodedImageData | undefined> {
    const { filters, decodeParmsList } = this.readStreamFilters(stream.dict)
    const rasterIndex = filters.findIndex((filter) => isRasterImageFilter(filter.value))
    if (rasterIndex < 0) return undefined
    const rasterFilter = filters[rasterIndex].value
    if (rasterIndex !== filters.length - 1) throw new PdfError(`${rasterFilter} must be the last image filter`)
    let current = stream.data
    for (let index = 0; index < rasterIndex; index++) {
      const filter = filters[index].value
      current = await this.decodeByteFilter(filter, current, stream.dict, decodeParmsList[index])
    }
    return this.decodeRasterImageFilter(rasterFilter, current, stream.dict)
  }

  private async decodeRasterImageFilter(name: string, data: Uint8Array, dict: PdfDict): Promise<PdfDecodedImageData> {
    const decoder = this.options.runtime?.decodeImage
    if (!decoder) throw new PdfError(`Runtime does not support image filter ${name}`)
    return decoder(name, data, dict)
  }
}

interface DecodedPageContent {
  page: PdfPageInfo
  chunks: Uint8Array[]
  width: number
  height: number
  transform: PdfMatrix
}

interface PageState {
  mediaBox: [number, number, number, number]
  cropBox?: [number, number, number, number]
  rotate: number
  userUnit: number
  resources?: PdfDict
}

interface CompressedXrefEntry {
  objectNumber: number
  objectStreamNumber: number
  objectStreamIndex: number
}

interface XrefReadResult {
  found: boolean
  prev?: number
}

const inheritedState = (): PageState => ({
  mediaBox: [0, 0, 612, 792],
  rotate: 0,
  userUnit: 1,
})

const mergeState = (document: RebookPdfDocument, dict: PdfDict, state: PageState): PageState => {
  const mediaBox = document.resolve(dict.entries.get('MediaBox'))
  const cropBox = document.resolve(dict.entries.get('CropBox'))
  const rotate = document.resolve(dict.entries.get('Rotate'))
  const userUnit = document.resolve(dict.entries.get('UserUnit'))
  const resources = document.resolve(dict.entries.get('Resources'))
  const nextMediaBox = toBox(mediaBox) ?? state.mediaBox
  return {
    mediaBox: nextMediaBox,
    cropBox: toBox(cropBox) ?? state.cropBox,
    rotate: typeof rotate === 'number' ? normalizePageRotation(rotate) : state.rotate,
    userUnit: validUserUnit(userUnit) ?? state.userUnit,
    resources: isDict(resources) ? resources : state.resources,
  }
}

const toBox = (value: PdfPrimitive | undefined): [number, number, number, number] | undefined => {
  if (!Array.isArray(value) || value.length < 4) return undefined
  const numbers = value.slice(0, 4)
  if (numbers.every((item): item is number => typeof item === 'number')) return [numbers[0], numbers[1], numbers[2], numbers[3]]
  return undefined
}

const pageVisibleBox = (page: PdfPageInfo): PdfRect => normalizeRect(page.cropBox)

const boxWidth = (box: PdfRect): number => box[2] - box[0]

const boxHeight = (box: PdfRect): number => box[3] - box[1]

const pageGeometry = (page: PdfPageInfo): PageGeometry => {
  const box = pageVisibleBox(page)
  const width = boxWidth(box)
  const height = boxHeight(box)
  const rotate = normalizePageRotation(page.rotate)
  const userUnit = page.userUnit
  return {
    width: (rotate === 90 || rotate === 270 ? height : width) * userUnit,
    height: (rotate === 90 || rotate === 270 ? width : height) * userUnit,
    transform: multiplyMatrix([userUnit, 0, 0, userUnit, 0, 0], pageTransform(box, rotate)),
  }
}

const validUserUnit = (value: PdfPrimitive | undefined): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined

const pageTransform = (box: PdfRect, rotate: number): PdfMatrix => {
  switch (rotate) {
    case 90:
      return [0, -1, 1, 0, -box[1], box[2]]
    case 180:
      return [-1, 0, 0, -1, box[2], box[3]]
    case 270:
      return [0, 1, -1, 0, box[3], -box[0]]
    default:
      return [1, 0, 0, 1, -box[0], -box[1]]
  }
}

const normalizePageRotation = (rotate: number): 0 | 90 | 180 | 270 => {
  const normalized = ((Math.trunc(rotate) % 360) + 360) % 360
  return normalized === 90 || normalized === 180 || normalized === 270 ? normalized : 0
}

const transformDisplayListToPage = (displayList: PdfPageDisplayList, transform: PdfMatrix): PdfPageDisplayList => {
  if (isIdentityMatrix(transform)) return displayList
  return {
    ...displayList,
    ops: [{ type: 'transform', matrix: transform }, ...displayList.ops],
  }
}

const transformRect = (rect: PdfRect, matrix: PdfMatrix): PdfRect => {
  const p0 = transformPoint(rect[0], rect[1], matrix)
  const p1 = transformPoint(rect[0], rect[3], matrix)
  const p2 = transformPoint(rect[2], rect[1], matrix)
  const p3 = transformPoint(rect[2], rect[3], matrix)
  return [
    Math.min(p0.x, p1.x, p2.x, p3.x),
    Math.min(p0.y, p1.y, p2.y, p3.y),
    Math.max(p0.x, p1.x, p2.x, p3.x),
    Math.max(p0.y, p1.y, p2.y, p3.y),
  ]
}

const transformPoint = (x: number, y: number, matrix: PdfMatrix): { x: number; y: number } => ({
  x: matrix[0] * x + matrix[2] * y + matrix[4],
  y: matrix[1] * x + matrix[3] * y + matrix[5],
})

const multiplyMatrix = (left: PdfMatrix, right: PdfMatrix): PdfMatrix => [
  left[0] * right[0] + left[2] * right[1],
  left[1] * right[0] + left[3] * right[1],
  left[0] * right[2] + left[2] * right[3],
  left[1] * right[2] + left[3] * right[3],
  left[0] * right[4] + left[2] * right[5] + left[4],
  left[1] * right[4] + left[3] * right[5] + left[5],
]

const isIdentityMatrix = (matrix: PdfMatrix): boolean =>
  matrix[0] === 1 && matrix[1] === 0 && matrix[2] === 0 && matrix[3] === 1 && matrix[4] === 0 && matrix[5] === 0

interface PageGeometry {
  width: number
  height: number
  transform: PdfMatrix
}

const normalizeRect = (rect: [number, number, number, number]): [number, number, number, number] => [
  Math.min(rect[0], rect[2]),
  Math.min(rect[1], rect[3]),
  Math.max(rect[0], rect[2]),
  Math.max(rect[1], rect[3]),
]

const stringValue = (value: PdfPrimitive | undefined): string | undefined =>
  typeof value === 'string' ? value : undefined

const destinationName = (value: PdfPrimitive | undefined): string | undefined => {
  if (typeof value === 'string') return value
  if (isName(value)) return value.value
  return undefined
}

const readDestinationValue = (value: PdfPrimitive | undefined): PdfDestination | undefined => {
  if (isDict(value)) return readDestination(value.entries.get('D'))
  return readDestination(value)
}

const readDestination = (value: PdfPrimitive | undefined): PdfDestination | undefined => {
  if (typeof value === 'string') return value
  if (isName(value)) return value.value
  if (!Array.isArray(value)) return undefined
  const items: PdfDestinationItem[] = []
  for (const item of value) {
    const destinationItem = readDestinationItem(item)
    if (destinationItem !== undefined) items.push(destinationItem)
  }
  return items.length > 0 ? items : undefined
}

const readDestinationItem = (value: PdfPrimitive): PdfDestinationItem | undefined => {
  if (value === null || typeof value === 'number' || typeof value === 'string' || isRef(value)) return value
  if (isName(value)) return value.value
  return undefined
}

const defaultPageLabels = (pageCount: number): string[] =>
  Array.from({ length: pageCount }, (_, index) => String(index + 1))

const buildPageLabels = (pageCount: number, rules: PdfPageLabelRule[]): string[] => {
  const labels = new Array<string>(pageCount)
  let ruleIndex = 0
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    while (ruleIndex + 1 < rules.length && rules[ruleIndex + 1].index <= pageIndex) ruleIndex++
    const rule = rules[ruleIndex]
    const value = rule.start + pageIndex - rule.index
    labels[pageIndex] = `${rule.prefix ?? ''}${formatPageLabelValue(value, rule.style)}`
  }
  return labels
}

const pageLabelStyle = (value: PdfPrimitive | undefined): PdfPageLabelStyle | undefined => {
  if (!isName(value)) return undefined
  return value.value === 'D' || value.value === 'R' || value.value === 'r' || value.value === 'A' || value.value === 'a' ? value.value : undefined
}

const formatPageLabelValue = (value: number, style: PdfPageLabelStyle | undefined): string => {
  if (!style) return ''
  if (style === 'D') return String(value)
  if (style === 'R') return toRoman(value).toUpperCase()
  if (style === 'r') return toRoman(value)
  if (style === 'A') return toLetters(value).toUpperCase()
  return toLetters(value)
}

const toRoman = (value: number): string => {
  if (value <= 0 || value >= 4000) return String(value)
  const numerals: Array<[number, string]> = [
    [1000, 'm'],
    [900, 'cm'],
    [500, 'd'],
    [400, 'cd'],
    [100, 'c'],
    [90, 'xc'],
    [50, 'l'],
    [40, 'xl'],
    [10, 'x'],
    [9, 'ix'],
    [5, 'v'],
    [4, 'iv'],
    [1, 'i'],
  ]
  let remaining = value
  let output = ''
  for (const [number, numeral] of numerals) {
    while (remaining >= number) {
      output += numeral
      remaining -= number
    }
  }
  return output
}

const toLetters = (value: number): string => {
  if (value <= 0) return String(value)
  let remaining = value
  let output = ''
  while (remaining > 0) {
    remaining--
    output = String.fromCharCode(97 + (remaining % 26)) + output
    remaining = Math.floor(remaining / 26)
  }
  return output
}

const toNumberArray = (value: PdfPrimitive | undefined): number[] =>
  Array.isArray(value) ? value.filter((item): item is number => typeof item === 'number') : []

const numberValue = (value: PdfPrimitive | undefined): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

const alphaValue = (value: PdfPrimitive | undefined): number | undefined => {
  const number = numberValue(value)
  return number === undefined ? undefined : Math.max(0, Math.min(1, number))
}

const lineCapValue = (value: PdfPrimitive | undefined): PdfLineCap | undefined => {
  if (value === 0) return 'butt'
  if (value === 1) return 'round'
  if (value === 2) return 'square'
  return undefined
}

const lineJoinValue = (value: PdfPrimitive | undefined): PdfLineJoin | undefined => {
  if (value === 0) return 'miter'
  if (value === 1) return 'round'
  if (value === 2) return 'bevel'
  return undefined
}

const dashValue = (value: PdfPrimitive | undefined): { pattern: number[]; phase: number } | undefined => {
  if (!Array.isArray(value) || !Array.isArray(value[0]) || typeof value[1] !== 'number') return undefined
  return {
    pattern: value[0].filter((item): item is number => typeof item === 'number'),
    phase: value[1],
  }
}

const blendModeValue = (value: PdfPrimitive | undefined): PdfBlendMode | undefined => {
  if (isName(value)) return blendModeName(value.value)
  if (Array.isArray(value)) {
    for (const item of value) {
      if (!isName(item)) continue
      const mode = blendModeName(item.value)
      if (mode) return mode
    }
  }
  return undefined
}

const blendModeName = (value: string): PdfBlendMode | undefined => {
  switch (value) {
    case 'Normal':
    case 'Compatible':
      return 'normal'
    case 'Multiply':
      return 'multiply'
    case 'Screen':
      return 'screen'
    case 'Overlay':
      return 'overlay'
    case 'Darken':
      return 'darken'
    case 'Lighten':
      return 'lighten'
    case 'ColorDodge':
      return 'colorDodge'
    case 'ColorBurn':
      return 'colorBurn'
    case 'HardLight':
      return 'hardLight'
    case 'SoftLight':
      return 'softLight'
    case 'Difference':
      return 'difference'
    case 'Exclusion':
      return 'exclusion'
    case 'Hue':
      return 'hue'
    case 'Saturation':
      return 'saturation'
    case 'Color':
      return 'color'
    case 'Luminosity':
      return 'luminosity'
    default:
      return undefined
  }
}

const readPrevOffset = (dict: PdfDict | undefined): number | undefined => {
  const prev = dict?.entries.get('Prev')
  return typeof prev === 'number' && Number.isInteger(prev) && prev >= 0 ? prev : undefined
}

const toMatrix = (value: PdfPrimitive | undefined): PdfMatrix | undefined => {
  const numbers = toNumberArray(value)
  if (numbers.length < 6) return undefined
  return [numbers[0], numbers[1], numbers[2], numbers[3], numbers[4], numbers[5]]
}

const identityMatrix = (): PdfMatrix => [1, 0, 0, 1, 0, 0]

const maxFormResourceDepth = 16
const maxOutlineDepth = 64
const maxNameTreeDepth = 64
const maxNumberTreeDepth = 64
const maxSoftMaskDepth = 4

const isRasterImageFilter = (name: string): boolean =>
  name === 'DCTDecode' || name === 'DCT'

const parseObjectStreamTable = (bytes: Uint8Array, count: number, firstObjectOffset: number): Array<{ objectNumber: number; offset: number }> => {
  const header = bytesToLatin1(bytes, 0, firstObjectOffset)
  const values = header.trim().split(/\s+/).map(Number)
  const entries: Array<{ objectNumber: number; offset: number }> = []
  for (let i = 0; i < count; i++) {
    const objectNumber = values[i * 2]
    const offset = values[i * 2 + 1]
    if (Number.isInteger(objectNumber) && Number.isInteger(offset)) entries.push({ objectNumber, offset })
  }
  return entries
}

const readXrefStreamEntry = (bytes: Uint8Array, offset: number, widths: number[]): { type: number; offset: number; generation: number } => {
  const typeWidth = widths[0]
  const offsetWidth = widths[1]
  const generationWidth = widths[2]
  return {
    type: typeWidth === 0 ? 1 : readBigEndian(bytes, offset, typeWidth),
    offset: readBigEndian(bytes, offset + typeWidth, offsetWidth),
    generation: readBigEndian(bytes, offset + typeWidth + offsetWidth, generationWidth),
  }
}

const readBigEndian = (bytes: Uint8Array, offset: number, width: number): number => {
  let value = 0
  for (let i = 0; i < width; i++) value = value * 256 + (bytes[offset + i] ?? 0)
  return value
}

const asDict = (value: PdfPrimitive): PdfDict => {
  if (!isDict(value)) throw new PdfError('Expected a PDF dictionary')
  return value
}

const refKey = (ref: PdfRef): string => `${ref.objectNumber}:${ref.generation}`

const fontCacheKey = (usedFonts: Set<string> | undefined): string => {
  if (!usedFonts) return '*'
  return [...usedFonts].sort().join('\0')
}

const fontFileFormat = (descriptor: PdfDict, stream: PdfStream): string | undefined => {
  const subtype = stream.dict.entries.get('Subtype')
  if (isName(subtype, 'OpenType')) return 'opentype'
  if (isName(subtype, 'Type1C') || isName(subtype, 'CIDFontType0C')) return 'cff'
  if (descriptor.entries.has('FontFile2')) return 'truetype'
  if (descriptor.entries.has('FontFile')) return 'type1'
  return undefined
}

const findObjectForValue = (objects: Map<string, PdfObject>, value: PdfPrimitive): PdfObject | undefined => {
  for (const object of objects.values()) {
    if (object.value === value) return object
  }
  return undefined
}
