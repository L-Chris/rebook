import { bytesToLatin1 } from './bytes'
import { ContentInlineImageToken, ContentTokenizer, ContentToken, isContentString } from './content'
import { decodeAscii85, decodeAsciiHex, decodeRunLength } from './filters'
import { PdfFontDecoder, PdfFontMap, PdfTextAdvanceOptions } from './fonts'
import { colorizeImageMask, imageMaskSamplesToRgba, imageSamplesToRgba, readImageColorSpace, readImageDecode, readOptionalDeviceColorSpace, supportsImageBits } from './images'
import { identityMatrix, isIdentityMatrix, multiplyMatrix, transformPoint, translateMatrix } from './matrix'
import { advancePdfTextWithOptions, contentTextValue, currentPdfFont, isContentName, pdfFontRunStyle } from './text-state'
import { isDict, isName, isStream, PdfBlendMode, PdfColor, PdfDeviceColorSpace, PdfDisplayOp, PdfError, PdfImageColorSpace, PdfImageData, PdfLineCap, PdfLineJoin, PdfMatrix, PdfPageDisplayList, PdfPathPaint, PdfPathSegment, PdfPrimitive, PdfRect, PdfShading, PdfShadingColorStop, PdfShadingPattern, PdfTextRenderingMode, PdfTextRun } from '../types'

export interface PdfType0Function {
  type: 'sampled'
  domain: [number, number]
  range: Array<[number, number]>
  size: number
  bitsPerSample: number
  encode: [number, number]
  decode: Array<[number, number]>
  outputComponents: number
  samples: number[]
}

export interface PdfType2Function {
  type: 'exponential'
  domain: [number, number]
  c0: number[]
  c1: number[]
  n: number
}

export interface PdfType3Function {
  type: 'stitching'
  domain: [number, number]
  functions: PdfColorFunction[]
  bounds: number[]
  encode: Array<[number, number]>
}

type PdfColorFunction = PdfType0Function | PdfType2Function | PdfType3Function

export interface PdfSeparationColorSpace {
  type: 'Separation'
  name: string
  alternate: PdfDeviceColorSpace
  tintTransform: PdfType2Function
}

export type PdfGraphicsColorSpace = PdfDeviceColorSpace | PdfSeparationColorSpace | 'Pattern'

type PdfPrimitiveResolver = (value: PdfPrimitive | undefined) => PdfPrimitive | undefined

export interface PdfGraphicsResources {
  images?: Map<string, PdfImageData>
  fonts?: PdfFontMap
  forms?: Map<string, PdfFormResource>
  colorSpaces?: Map<string, PdfGraphicsColorSpace>
  graphicsStates?: Map<string, PdfGraphicsState>
  shadings?: Map<string, PdfShading>
  patterns?: Map<string, PdfShadingPattern>
}

export interface PdfGraphicsState {
  lineWidth?: number
  lineCap?: PdfLineCap
  lineJoin?: PdfLineJoin
  miterLimit?: number
  dash?: { pattern: number[]; phase: number }
  strokeAlpha?: number
  fillAlpha?: number
  blendMode?: PdfBlendMode
}

export interface PdfFormResource {
  matrix: PdfMatrix
  bbox?: PdfRect
  streams: Uint8Array[]
  resources: PdfGraphicsResources
}

export interface PdfContentResourceNames {
  fonts: Set<string>
  xObjects: Set<string>
  shadings: Set<string>
  patterns: Set<string>
}

export const buildPageDisplayList = (
  streams: Uint8Array[],
  pageIndex: number,
  width: number,
  height: number,
  resources: PdfGraphicsResources = {},
): PdfPageDisplayList => {
  const interpreter = new GraphicsInterpreter(pageIndex, width, height, resources)
  for (const stream of streams) interpreter.execute(bytesToLatin1(stream))
  return interpreter.finish()
}

export const readOptionalGraphicsColorSpace = (value: PdfPrimitive | undefined, resolve: PdfPrimitiveResolver = identityResolve): PdfGraphicsColorSpace | undefined => {
  const resolved = resolve(value)
  if (isName(resolved, 'Pattern')) return 'Pattern'
  const colorSpace = readOptionalDeviceColorSpace(value, resolve)
  if (colorSpace) return colorSpace
  return readSeparationColorSpace(value, resolve)
}

export const readOptionalShadingPattern = (
  name: string,
  value: PdfPrimitive | undefined,
  resolve: PdfPrimitiveResolver = identityResolve,
  colorSpaceResources?: Map<string, PdfGraphicsColorSpace>,
): PdfShadingPattern | undefined => {
  const resolved = resolve(value)
  const dict = isStream(resolved) ? resolved.dict : isDict(resolved) ? resolved : undefined
  if (!dict || resolve(dict.entries.get('PatternType')) !== 2) return undefined
  const shading = readOptionalShading(dict.entries.get('Shading'), resolve, colorSpaceResources)
  if (!shading) return undefined
  const matrix = toMatrix(resolve(dict.entries.get('Matrix'))) ?? identityMatrix()
  return {
    type: 'shadingPattern',
    name,
    matrix,
    shading: transformShading(shading, matrix),
  }
}

export const readOptionalShading = (
  value: PdfPrimitive | undefined,
  resolve: PdfPrimitiveResolver = identityResolve,
  colorSpaceResources?: Map<string, PdfGraphicsColorSpace>,
): PdfShading | undefined => {
  const resolved = resolve(value)
  const dict = isStream(resolved) ? resolved.dict : isDict(resolved) ? resolved : undefined
  const shadingType = dict ? resolve(dict.entries.get('ShadingType')) : undefined
  if (!dict || (shadingType !== 2 && shadingType !== 3)) return undefined
  const colorSpace = readShadingColorSpace(dict.entries.get('ColorSpace') ?? dict.entries.get('CS'), resolve, colorSpaceResources)
  if (!colorSpace) return undefined
  const domain = functionDomain(resolve(dict.entries.get('Domain')))
  const fn = readColorFunction(resolve(dict.entries.get('Function')), resolve, componentsPerGraphicsColorSpace(colorSpace))
  if (!fn) return undefined
  const colorStops = shadingColorStops(fn, colorSpace, domain)
  const firstColor = colorStops[0]?.color ?? colorFromGraphicsColorSpace(colorSpace, evaluateColorFunction(fn, domain[0]))
  const lastColor = colorStops.at(-1)?.color ?? colorFromGraphicsColorSpace(colorSpace, evaluateColorFunction(fn, domain[1]))
  const base = {
    domain,
    extend: shadingExtend(resolve(dict.entries.get('Extend'))),
    startColor: firstColor,
    endColor: lastColor,
    colorStops,
  }
  if (shadingType === 2) {
    const coords = shadingCoords(resolve(dict.entries.get('Coords')), shadingType)
    if (!coords) return undefined
    return {
      type: 'axial',
      coords,
      ...base,
    }
  }
  const coords = shadingCoords(resolve(dict.entries.get('Coords')), shadingType)
  if (!coords) return undefined
  return {
    type: 'radial',
    coords,
    ...base,
  }
}

export const collectXObjectNames = (streams: Uint8Array[]): Set<string> => {
  return collectResourceNames(streams).xObjects
}

export const collectResourceNames = (streams: Uint8Array[]): PdfContentResourceNames => {
  const fonts = new Set<string>()
  const xObjects = new Set<string>()
  const shadings = new Set<string>()
  const patterns = new Set<string>()
  for (const stream of streams) {
    const tokenizer = new ContentTokenizer(bytesToLatin1(stream))
    const stack: ContentToken[] = []
    for (const token of tokenizer.tokens()) {
      if (typeof token === 'string' && operators.has(token)) {
        if (token === 'Do') {
          const name = stack[stack.length - 1]
          if (isContentName(name)) xObjects.add(name.value)
        } else if (token === 'Tf') {
          const name = stack[stack.length - 2]
          if (isContentName(name)) fonts.add(name.value)
        } else if (token === 'sh') {
          const name = stack[stack.length - 1]
          if (isContentName(name)) shadings.add(name.value)
        } else if (token === 'scn' || token === 'SCN') {
          const name = stack[stack.length - 1]
          if (isContentName(name)) patterns.add(name.value)
        }
        stack.length = 0
      } else {
        stack.push(token)
      }
    }
  }
  return { fonts, xObjects, shadings, patterns }
}

class GraphicsInterpreter {
  private readonly ops: PdfDisplayOp[] = []
  private readonly stack: ContentToken[] = []
  private path: PdfPathSegment[] = []
  private inText = false
  private textMatrix: PdfMatrix = identityMatrix()
  private textLineMatrix: PdfMatrix = identityMatrix()
  private leading = 0
  private fontSize = 12
  private fontName: string | undefined
  private charSpacing = 0
  private wordSpacing = 0
  private horizontalScale = 1
  private textRise = 0
  private fillColor: PdfColor = [0, 0, 0]
  private strokeColor: PdfColor = [0, 0, 0]
  private fillPattern: PdfShadingPattern | undefined
  private strokePattern: PdfShadingPattern | undefined
  private textRenderingMode: PdfTextRenderingMode = 'fill'
  private strokeColorSpace: PdfGraphicsColorSpace = 'DeviceGray'
  private fillColorSpace: PdfGraphicsColorSpace = 'DeviceGray'
  private readonly paintStateStack: GraphicsPaintState[] = []
  private formDepth = 0
  private inlineImageCount = 0
  private cachedFontName: string | undefined
  private cachedFontResources: PdfFontMap | undefined
  private cachedFont: PdfFontDecoder | undefined
  private cachedRunStyleFont: PdfFontDecoder | undefined
  private cachedRunStyle: Partial<PdfTextRun> = {}
  private cachedAdvanceOptions: PdfTextAdvanceOptions | undefined
  private cachedAdvanceFontSize = Number.NaN
  private cachedAdvanceCharSpacing = Number.NaN
  private cachedAdvanceWordSpacing = Number.NaN
  private cachedAdvanceHorizontalScale = Number.NaN

  constructor(
    private readonly pageIndex: number,
    private readonly width: number,
    private readonly height: number,
    private resources: PdfGraphicsResources,
  ) {}

  execute(source: string): void {
    const tokenizer = new ContentTokenizer(source)
    for (const token of tokenizer.tokens()) {
      if (isInlineImage(token)) this.showInlineImage(token)
      else if (typeof token === 'string' && operators.has(token)) this.apply(token)
      else this.stack.push(token)
    }
  }

  finish(): PdfPageDisplayList {
    return {
      pageIndex: this.pageIndex,
      width: this.width,
      height: this.height,
      ops: compactTextDisplayOps(this.ops),
    }
  }

  private apply(operator: string): void {
    switch (operator) {
      case 'q':
        this.paintStateStack.push(this.snapshotPaintState())
        this.pushOp({ type: 'save' })
        break
      case 'Q':
        this.restorePaintState(this.paintStateStack.pop())
        this.pushOp({ type: 'restore' })
        break
      case 'cm': {
        const f = this.popNumber()
        const e = this.popNumber()
        const d = this.popNumber()
        const c = this.popNumber()
        const b = this.popNumber()
        const a = this.popNumber()
        this.pushOp({ type: 'transform', matrix: [a, b, c, d, e, f] })
        break
      }
      case 'w':
        this.pushOp({ type: 'lineWidth', width: this.popNumber() })
        break
      case 'J':
        this.pushOp({ type: 'lineCap', cap: lineCap(this.popNumber()) })
        break
      case 'j':
        this.pushOp({ type: 'lineJoin', join: lineJoin(this.popNumber()) })
        break
      case 'M':
        this.pushOp({ type: 'miterLimit', limit: this.popNumber() })
        break
      case 'd': {
        const phase = this.popNumber()
        const pattern = this.stack.pop()
        this.pushOp({ type: 'dash', pattern: numberArray(pattern), phase })
        break
      }
      case 'G':
        this.strokeColorSpace = 'DeviceGray'
        this.strokeColor = gray(this.popNumber())
        this.strokePattern = undefined
        this.pushOp({ type: 'strokeColor', color: this.strokeColor })
        break
      case 'g':
        this.fillColorSpace = 'DeviceGray'
        this.fillColor = gray(this.popNumber())
        this.fillPattern = undefined
        this.pushOp({ type: 'fillColor', color: this.fillColor })
        break
      case 'RG': {
        this.strokeColorSpace = 'DeviceRGB'
        const b = this.popNumber()
        const g = this.popNumber()
        const r = this.popNumber()
        this.strokeColor = [r, g, b]
        this.strokePattern = undefined
        this.pushOp({ type: 'strokeColor', color: this.strokeColor })
        break
      }
      case 'rg': {
        this.fillColorSpace = 'DeviceRGB'
        const b = this.popNumber()
        const g = this.popNumber()
        const r = this.popNumber()
        this.fillColor = [r, g, b]
        this.fillPattern = undefined
        this.pushOp({ type: 'fillColor', color: this.fillColor })
        break
      }
      case 'K': {
        this.strokeColorSpace = 'DeviceCMYK'
        const k = this.popNumber()
        const y = this.popNumber()
        const m = this.popNumber()
        const c = this.popNumber()
        this.strokeColor = cmyk(c, m, y, k)
        this.strokePattern = undefined
        this.pushOp({ type: 'strokeColor', color: this.strokeColor })
        break
      }
      case 'k': {
        this.fillColorSpace = 'DeviceCMYK'
        const k = this.popNumber()
        const y = this.popNumber()
        const m = this.popNumber()
        const c = this.popNumber()
        this.fillColor = cmyk(c, m, y, k)
        this.fillPattern = undefined
        this.pushOp({ type: 'fillColor', color: this.fillColor })
        break
      }
      case 'CS':
        this.strokeColorSpace = this.popColorSpace(this.strokeColorSpace)
        if (this.strokeColorSpace !== 'Pattern') this.strokePattern = undefined
        break
      case 'cs':
        this.fillColorSpace = this.popColorSpace(this.fillColorSpace)
        if (this.fillColorSpace !== 'Pattern') this.fillPattern = undefined
        break
      case 'SC':
      case 'SCN':
        if (this.strokeColorSpace === 'Pattern') {
          if (operator === 'SCN') this.popStrokePattern()
          break
        }
        this.strokeColor = this.popColor(this.strokeColorSpace)
        this.strokePattern = undefined
        this.pushOp({ type: 'strokeColor', color: this.strokeColor })
        break
      case 'sc':
      case 'scn':
        if (this.fillColorSpace === 'Pattern') {
          if (operator === 'scn') this.popFillPattern()
          break
        }
        this.fillColor = this.popColor(this.fillColorSpace)
        this.fillPattern = undefined
        this.pushOp({ type: 'fillColor', color: this.fillColor })
        break
      case 'BMC':
      case 'BDC':
      case 'EMC':
      case 'MP':
      case 'DP':
        break
      case 'gs': {
        const name = this.stack.pop()
        if (isContentName(name)) this.applyGraphicsState(this.resources.graphicsStates?.get(name.value))
        break
      }
      case 'sh': {
        const name = this.stack.pop()
        if (!isContentName(name)) break
        const shading = this.resources.shadings?.get(name.value)
        if (shading) this.pushOp({ type: 'shading', name: name.value, shading })
        break
      }
      case 'm': {
        const y = this.popNumber()
        const x = this.popNumber()
        this.path.push({ type: 'moveTo', x, y })
        break
      }
      case 'l': {
        const y = this.popNumber()
        const x = this.popNumber()
        this.path.push({ type: 'lineTo', x, y })
        break
      }
      case 'c': {
        const y3 = this.popNumber()
        const x3 = this.popNumber()
        const y2 = this.popNumber()
        const x2 = this.popNumber()
        const y1 = this.popNumber()
        const x1 = this.popNumber()
        this.path.push({ type: 'curveTo', x1, y1, x2, y2, x3, y3 })
        break
      }
      case 'v': {
        const y3 = this.popNumber()
        const x3 = this.popNumber()
        const y2 = this.popNumber()
        const x2 = this.popNumber()
        const current = this.currentPoint()
        this.path.push({ type: 'curveTo', x1: current.x, y1: current.y, x2, y2, x3, y3 })
        break
      }
      case 'y': {
        const y3 = this.popNumber()
        const x3 = this.popNumber()
        const y1 = this.popNumber()
        const x1 = this.popNumber()
        this.path.push({ type: 'curveTo', x1, y1, x2: x3, y2: y3, x3, y3 })
        break
      }
      case 'h':
        this.path.push({ type: 'closePath' })
        break
      case 're': {
        const height = this.popNumber()
        const width = this.popNumber()
        const y = this.popNumber()
        const x = this.popNumber()
        this.path.push({ type: 'rect', x, y, width, height })
        break
      }
      case 'S':
        this.paintPath('stroke')
        break
      case 's':
        this.path.push({ type: 'closePath' })
        this.paintPath('stroke')
        break
      case 'f':
      case 'F':
        this.paintPath('fill')
        break
      case 'f*':
        this.paintPath('fillEvenOdd')
        break
      case 'B':
        this.paintPath('fillStroke')
        break
      case 'B*':
        this.paintPath('fillStrokeEvenOdd')
        break
      case 'b':
        this.path.push({ type: 'closePath' })
        this.paintPath('fillStroke')
        break
      case 'b*':
        this.path.push({ type: 'closePath' })
        this.paintPath('fillStrokeEvenOdd')
        break
      case 'W':
        this.clipPath('nonzero')
        break
      case 'W*':
        this.clipPath('evenodd')
        break
      case 'n':
        this.paintPath('none')
        break
      case 'Do': {
        const name = this.stack.pop()
        if (!isContentName(name)) break
        const image = this.resources.images?.get(name.value)
        if (image) this.pushOp({ type: 'image', name: name.value, image: colorizeImageMask(image, this.fillColor) })
        else {
          const form = this.resources.forms?.get(name.value)
          if (form) this.showForm(form)
        }
        break
      }
      case 'BT':
        this.inText = true
        this.textMatrix = identityMatrix()
        this.textLineMatrix = identityMatrix()
        break
      case 'ET':
        this.inText = false
        break
      case 'Tf': {
        const size = this.popNumber()
        const font = this.stack.pop()
        if (font && typeof font === 'object' && !Array.isArray(font) && 'type' in font) this.fontName = String((font as { value: string }).value)
        if (size) this.fontSize = size
        break
      }
      case 'Tr':
        this.textRenderingMode = textRenderingMode(this.popNumber())
        break
      case 'Td':
      case 'TD': {
        const y = this.popNumber()
        const x = this.popNumber()
        if (operator === 'TD') this.leading = -y
        this.moveTextLine(x, y)
        break
      }
      case 'Tm': {
        const f = this.popNumber()
        const e = this.popNumber()
        const d = this.popNumber()
        const c = this.popNumber()
        const b = this.popNumber()
        const a = this.popNumber()
        this.textMatrix = [a, b, c, d, e, f]
        this.textLineMatrix = [...this.textMatrix]
        break
      }
      case 'T*':
        this.nextTextLine()
        break
      case 'Tc':
        this.charSpacing = this.popNumber()
        break
      case 'Tw':
        this.wordSpacing = this.popNumber()
        break
      case 'Tz':
        this.horizontalScale = this.popNumber() / 100
        break
      case 'TL':
        this.leading = this.popNumber()
        break
      case 'Ts':
        this.textRise = this.popNumber()
        break
      case 'Tj':
        this.showText(this.popText())
        break
      case "'":
        this.nextTextLine()
        this.showText(this.popText())
        break
      case '"': {
        const text = this.stack.pop()
        this.charSpacing = this.popNumber()
        this.wordSpacing = this.popNumber()
        this.nextTextLine()
        this.showText(contentTextValue(text))
        break
      }
      case 'TJ': {
        const parts = this.stack.pop()
        if (Array.isArray(parts)) this.showTextParts(parts)
        break
      }
    }
    this.stack.length = 0
  }

  private showText(text: string): void {
    if (!this.inText || text.length === 0) return
    const font = this.currentFont()
    const decoded = font.decode(text)
    const renderMatrix = this.textRenderMatrix()
    const transformed = !isSimpleTextMatrix(renderMatrix)
    const advance = this.advanceText(text, font)
    const width = this.textRunWidth(advance)
    const run: PdfTextRun = {
      text: decoded,
      x: transformed ? 0 : renderMatrix[4],
      y: transformed ? 0 : renderMatrix[5],
      fontSize: this.fontSize,
      ...(width !== undefined ? { width } : {}),
      fontName: this.fontName,
      ...this.currentRunStyle(font),
      fillColor: this.fillColor,
      strokeColor: this.strokeColor,
      renderingMode: this.textRenderingMode,
    }
    this.pushTextRun(run, transformed ? renderMatrix : undefined)
    this.advanceTextMatrix(advance)
  }

  private showTextParts(parts: ContentToken[]): void {
    for (const part of parts) {
      if (isContentString(part) || typeof part === 'string') this.showText(contentTextValue(part))
      else if (typeof part === 'number') this.adjustText(part)
    }
  }

  private showForm(form: PdfFormResource): void {
    if (this.formDepth >= maxFormDepth) return
    const state = this.snapshotState()
    const previousResources = this.resources
    this.pushOp({ type: 'save' })
    this.pushOp({ type: 'transform', matrix: form.matrix })
    if (form.bbox) {
      this.pushOp({
        type: 'clip',
        segments: [rectToPath(form.bbox)],
        rule: 'nonzero',
      })
    }
    this.resources = form.resources
    this.formDepth++
    try {
      for (const stream of form.streams) this.execute(bytesToLatin1(stream))
    } finally {
      this.formDepth--
      this.resources = previousResources
      this.restoreState(state)
      this.pushOp({ type: 'restore' })
    }
  }

  private showInlineImage(token: ContentInlineImageToken): void {
    const samples = inlineImageSamples(token)
    if (!samples) return
    const width = inlineNumber(token.dict, 'W', 'Width')
    const height = inlineNumber(token.dict, 'H', 'Height')
    const imageMask = inlineBoolean(token.dict, 'IM', 'ImageMask') ?? false
    const bitsPerComponent = inlineNumber(token.dict, 'BPC', 'BitsPerComponent') ?? (imageMask ? 1 : 8)
    const colorSpace = imageMask ? 'DeviceGray' : inlineColorSpace(token.dict, this.resources.colorSpaces)
    const decode = inlineDecode(token.dict)
    if (!Number.isInteger(width) || !Number.isInteger(height) || !width || !height || !colorSpace) return
    if (imageMask && bitsPerComponent !== 1) return
    if (!supportsImageBits(bitsPerComponent, colorSpace)) return
    const image: PdfImageData = {
      width,
      height,
      bitsPerComponent,
      colorSpace,
      ...(imageMask ? { imageMask: true } : {}),
      data: imageMask
        ? imageMaskSamplesToRgba(samples, width, height, decode)
        : imageSamplesToRgba(samples, width, height, colorSpace, bitsPerComponent, decode),
    }
    this.pushOp({
      type: 'image',
      name: `inline-${++this.inlineImageCount}`,
      image: imageMask ? colorizeImageMask(image, this.fillColor) : image,
    })
  }

  private applyGraphicsState(state: PdfGraphicsState | undefined): void {
    if (!state) return
    if (state.lineWidth !== undefined) this.pushOp({ type: 'lineWidth', width: state.lineWidth })
    if (state.lineCap !== undefined) this.pushOp({ type: 'lineCap', cap: state.lineCap })
    if (state.lineJoin !== undefined) this.pushOp({ type: 'lineJoin', join: state.lineJoin })
    if (state.miterLimit !== undefined) this.pushOp({ type: 'miterLimit', limit: state.miterLimit })
    if (state.dash !== undefined) this.pushOp({ type: 'dash', pattern: state.dash.pattern, phase: state.dash.phase })
    if (state.strokeAlpha !== undefined) this.pushOp({ type: 'strokeAlpha', alpha: state.strokeAlpha })
    if (state.fillAlpha !== undefined) this.pushOp({ type: 'fillAlpha', alpha: state.fillAlpha })
    if (state.blendMode !== undefined) this.pushOp({ type: 'blendMode', mode: state.blendMode })
  }

  private snapshotState(): GraphicsStateSnapshot {
    return {
      path: [...this.path],
      inText: this.inText,
      textMatrix: [...this.textMatrix],
      textLineMatrix: [...this.textLineMatrix],
      leading: this.leading,
      fontSize: this.fontSize,
      fontName: this.fontName,
      charSpacing: this.charSpacing,
      wordSpacing: this.wordSpacing,
      horizontalScale: this.horizontalScale,
      textRise: this.textRise,
      fillColor: this.fillColor,
      strokeColor: this.strokeColor,
      fillPattern: this.fillPattern,
      strokePattern: this.strokePattern,
      textRenderingMode: this.textRenderingMode,
      strokeColorSpace: this.strokeColorSpace,
      fillColorSpace: this.fillColorSpace,
      paintStateStack: this.paintStateStack.map((item) => ({ ...item })),
    }
  }

  private restoreState(state: GraphicsStateSnapshot): void {
    this.path = state.path
    this.inText = state.inText
    this.textMatrix = [...state.textMatrix]
    this.textLineMatrix = [...state.textLineMatrix]
    this.leading = state.leading
    this.fontSize = state.fontSize
    this.fontName = state.fontName
    this.charSpacing = state.charSpacing
    this.wordSpacing = state.wordSpacing
    this.horizontalScale = state.horizontalScale
    this.textRise = state.textRise
    this.fillColor = state.fillColor
    this.strokeColor = state.strokeColor
    this.fillPattern = state.fillPattern
    this.strokePattern = state.strokePattern
    this.textRenderingMode = state.textRenderingMode
    this.strokeColorSpace = state.strokeColorSpace
    this.fillColorSpace = state.fillColorSpace
    this.paintStateStack.length = 0
    this.paintStateStack.push(...state.paintStateStack.map((item) => ({ ...item })))
  }

  private paintPath(paint: PdfPathPaint): void {
    if (this.path.length > 0 || paint === 'none') {
      this.pushOp({
        type: 'path',
        segments: this.path,
        paint,
        ...(this.fillPattern && paintsPathFill(paint) ? { fill: this.fillPattern } : {}),
        ...(this.strokePattern && paintsPathStroke(paint) ? { stroke: this.strokePattern } : {}),
      })
    }
    this.path = []
  }

  private clipPath(rule: 'nonzero' | 'evenodd'): void {
    if (this.path.length > 0) this.pushOp({ type: 'clip', segments: [...this.path], rule })
  }

  private currentPoint(): { x: number; y: number } {
    for (let i = this.path.length - 1; i >= 0; i--) {
      const segment = this.path[i]
      if (segment.type === 'moveTo' || segment.type === 'lineTo') return { x: segment.x, y: segment.y }
      if (segment.type === 'curveTo') return { x: segment.x3, y: segment.y3 }
      if (segment.type === 'rect') return { x: segment.x, y: segment.y }
    }
    return { x: 0, y: 0 }
  }

  private moveTextLine(x: number, y: number): void {
    this.textLineMatrix = translateMatrix(this.textLineMatrix, x, y)
    this.textMatrix = [...this.textLineMatrix]
  }

  private nextTextLine(): void {
    this.moveTextLine(0, -(this.leading || this.fontSize))
  }

  private adjustText(value: number): void {
    this.advanceTextMatrix(-(value / 1000) * this.fontSize * this.horizontalScale)
  }

  private currentFont(): PdfFontDecoder {
    if (this.cachedFont && this.cachedFontName === this.fontName && this.cachedFontResources === this.resources.fonts) {
      return this.cachedFont
    }
    const font = currentPdfFont(this.fontName, this.resources.fonts)
    this.cachedFontName = this.fontName
    this.cachedFontResources = this.resources.fonts
    this.cachedFont = font
    return font
  }

  private currentRunStyle(font: PdfFontDecoder): Partial<PdfTextRun> {
    if (this.cachedRunStyleFont === font) return this.cachedRunStyle
    this.cachedRunStyleFont = font
    this.cachedRunStyle = pdfFontRunStyle(font)
    return this.cachedRunStyle
  }

  private advanceText(text: string, font: PdfFontDecoder): number {
    return advancePdfTextWithOptions(text, font, this.textAdvanceOptions())
  }

  private textRunWidth(advance: number): number | undefined {
    if (advance <= 0) return undefined
    const horizontalScale = Math.abs(this.horizontalScale)
    return horizontalScale > 1e-9 ? advance / horizontalScale : advance
  }

  private textAdvanceOptions(): PdfTextAdvanceOptions {
    if (
      this.cachedAdvanceOptions &&
      this.cachedAdvanceFontSize === this.fontSize &&
      this.cachedAdvanceCharSpacing === this.charSpacing &&
      this.cachedAdvanceWordSpacing === this.wordSpacing &&
      this.cachedAdvanceHorizontalScale === this.horizontalScale
    ) {
      return this.cachedAdvanceOptions
    }
    this.cachedAdvanceFontSize = this.fontSize
    this.cachedAdvanceCharSpacing = this.charSpacing
    this.cachedAdvanceWordSpacing = this.wordSpacing
    this.cachedAdvanceHorizontalScale = this.horizontalScale
    this.cachedAdvanceOptions = {
      fontSize: this.fontSize,
      charSpacing: this.charSpacing,
      wordSpacing: this.wordSpacing,
      horizontalScale: this.horizontalScale,
    }
    return this.cachedAdvanceOptions
  }

  private advanceTextMatrix(x: number): void {
    this.textMatrix = translateMatrix(this.textMatrix, x, 0)
  }

  private textRenderMatrix(): PdfMatrix {
    if (this.horizontalScale === 1 && this.textRise === 0) return this.textMatrix
    const matrix = this.textMatrix
    return [
      matrix[0] * this.horizontalScale,
      matrix[1] * this.horizontalScale,
      matrix[2],
      matrix[3],
      matrix[2] * this.textRise + matrix[4],
      matrix[3] * this.textRise + matrix[5],
    ]
  }

  private popNumber(): number {
    const value = this.stack.pop()
    return typeof value === 'number' ? value : 0
  }

  private popText(): string {
    return contentTextValue(this.stack.pop())
  }

  private popColor(space: PdfGraphicsColorSpace): PdfColor {
    if (typeof space === 'object') {
      const tint = this.popNumber()
      return colorFromComponents(space.alternate, evaluateType2Function(space.tintTransform, tint))
    }
    if (space === 'DeviceRGB') {
      const b = this.popNumber()
      const g = this.popNumber()
      const r = this.popNumber()
      return colorFromComponents(space, [r, g, b])
    }
    if (space === 'DeviceCMYK') {
      const k = this.popNumber()
      const y = this.popNumber()
      const m = this.popNumber()
      const c = this.popNumber()
      return colorFromComponents(space, [c, m, y, k])
    }
    if (space === 'Pattern') return this.fillColor
    return colorFromComponents(space, [this.popNumber()])
  }

  private popColorSpace(fallback: PdfGraphicsColorSpace): PdfGraphicsColorSpace {
    const token = this.stack.pop()
    if (!isContentName(token)) return fallback
    return this.resources.colorSpaces?.get(token.value) ?? colorSpaceName(token.value) ?? fallback
  }

  private popFillPattern(): void {
    const token = this.stack.pop()
    if (!isContentName(token)) return
    const pattern = this.resources.patterns?.get(token.value)
    if (pattern) this.fillPattern = pattern
  }

  private popStrokePattern(): void {
    const token = this.stack.pop()
    if (!isContentName(token)) return
    const pattern = this.resources.patterns?.get(token.value)
    if (pattern) this.strokePattern = pattern
  }

  private snapshotPaintState(): GraphicsPaintState {
    return {
      fillColor: this.fillColor,
      strokeColor: this.strokeColor,
      fillPattern: this.fillPattern,
      strokePattern: this.strokePattern,
      textRenderingMode: this.textRenderingMode,
      strokeColorSpace: this.strokeColorSpace,
      fillColorSpace: this.fillColorSpace,
    }
  }

  private restorePaintState(state: GraphicsPaintState | undefined): void {
    if (!state) return
    this.fillColor = state.fillColor
    this.strokeColor = state.strokeColor
    this.fillPattern = state.fillPattern
    this.strokePattern = state.strokePattern
    this.textRenderingMode = state.textRenderingMode
    this.strokeColorSpace = state.strokeColorSpace
    this.fillColorSpace = state.fillColorSpace
  }

  private pushOp(op: PdfDisplayOp): void {
    this.ops.push(op)
  }

  private pushTextRun(run: PdfTextRun, matrix: PdfMatrix | undefined): void {
    if (matrix === undefined) {
      this.ops.push({ type: 'text', run })
    } else {
      this.ops.push({ type: 'save' }, { type: 'transform', matrix }, { type: 'text', run }, { type: 'restore' })
    }
  }
}

const readSeparationColorSpace = (value: PdfPrimitive | undefined, resolve: PdfPrimitiveResolver): PdfSeparationColorSpace | undefined => {
  const resolved = resolve(value)
  if (!Array.isArray(resolved)) return undefined
  const family = resolve(resolved[0])
  if (!isName(family, 'Separation')) return undefined
  const name = resolve(resolved[1])
  const alternate = readOptionalDeviceColorSpace(resolved[2], resolve)
  if (!isName(name) || !alternate) throw new PdfError('Separation ColorSpace is malformed')
  const tintTransform = readType2Function(resolved[3], resolve, componentsPerDeviceColorSpace(alternate))
  if (!tintTransform) throw new PdfError('Only FunctionType 2 Separation tint transforms are supported')
  return {
    type: 'Separation',
    name: name.value,
    alternate,
    tintTransform,
  }
}

const readShadingColorSpace = (
  value: PdfPrimitive | undefined,
  resolve: PdfPrimitiveResolver,
  colorSpaceResources: Map<string, PdfGraphicsColorSpace> | undefined,
): PdfGraphicsColorSpace | undefined => {
  const resolved = resolve(value)
  const colorSpace = isName(resolved)
    ? colorSpaceResources?.get(resolved.value) ?? readOptionalGraphicsColorSpace(resolved, resolve)
    : readOptionalGraphicsColorSpace(resolved, resolve)
  return colorSpace === 'Pattern' ? undefined : colorSpace
}

const readColorFunction = (value: PdfPrimitive | undefined, resolve: PdfPrimitiveResolver, outputComponents: number): PdfColorFunction | undefined =>
  readType0Function(value, resolve, outputComponents) ?? readType2Function(value, resolve, outputComponents) ?? readType3Function(value, resolve, outputComponents)

const readType0Function = (value: PdfPrimitive | undefined, resolve: PdfPrimitiveResolver, outputComponents: number): PdfType0Function | undefined => {
  const resolved = resolve(value)
  if (!isStream(resolved)) return undefined
  const dict = resolved.dict
  if (resolve(dict.entries.get('FunctionType')) !== 0) return undefined
  const size = numberArray(resolve(dict.entries.get('Size')))
  const sampleCount = size[0]
  const bitsPerSampleValue = resolve(dict.entries.get('BitsPerSample'))
  if (!Number.isInteger(sampleCount) || sampleCount <= 0 || typeof bitsPerSampleValue !== 'number' || !Number.isInteger(bitsPerSampleValue) || bitsPerSampleValue <= 0 || bitsPerSampleValue > 32) return undefined
  const samples = readSampledFunctionSamples(resolved.data, sampleCount, outputComponents, bitsPerSampleValue)
  if (!samples) return undefined
  const range = functionRange(resolve(dict.entries.get('Range')), outputComponents)
  return {
    type: 'sampled',
    domain: functionDomain(resolve(dict.entries.get('Domain'))),
    range,
    size: sampleCount,
    bitsPerSample: bitsPerSampleValue,
    encode: sampledEncode(resolve(dict.entries.get('Encode')), sampleCount),
    decode: sampledDecode(resolve(dict.entries.get('Decode')), range),
    outputComponents,
    samples,
  }
}

const readType2Function = (value: PdfPrimitive | undefined, resolve: PdfPrimitiveResolver, outputComponents: number): PdfType2Function | undefined => {
  const resolved = resolve(value)
  const dict = isStream(resolved) ? resolved.dict : isDict(resolved) ? resolved : undefined
  if (!dict) return undefined
  if (resolve(dict.entries.get('FunctionType')) !== 2) return undefined
  const n = resolve(dict.entries.get('N'))
  if (typeof n !== 'number') throw new PdfError('FunctionType 2 tint transform is missing N')
  const c0 = completeFunctionComponents(numberArray(resolve(dict.entries.get('C0'))), outputComponents, 0)
  const c1 = completeFunctionComponents(numberArray(resolve(dict.entries.get('C1'))), outputComponents, 1)
  return {
    type: 'exponential',
    domain: functionDomain(resolve(dict.entries.get('Domain'))),
    c0,
    c1,
    n,
  }
}

const readType3Function = (value: PdfPrimitive | undefined, resolve: PdfPrimitiveResolver, outputComponents: number): PdfType3Function | undefined => {
  const resolved = resolve(value)
  const dict = isStream(resolved) ? resolved.dict : isDict(resolved) ? resolved : undefined
  if (!dict) return undefined
  if (resolve(dict.entries.get('FunctionType')) !== 3) return undefined
  const functionValues = resolve(dict.entries.get('Functions'))
  if (!Array.isArray(functionValues) || functionValues.length === 0) return undefined
  const functions = functionValues
    .map((item) => readColorFunction(resolve(item), resolve, outputComponents))
    .filter((item): item is PdfColorFunction => Boolean(item))
  if (functions.length !== functionValues.length) return undefined
  const domain = functionDomain(resolve(dict.entries.get('Domain')))
  return {
    type: 'stitching',
    domain,
    functions,
    bounds: stitchingBounds(resolve(dict.entries.get('Bounds')), functions.length, domain),
    encode: stitchingEncode(resolve(dict.entries.get('Encode')), functions),
  }
}

const evaluateType2Function = (fn: PdfType2Function, tint: number): number[] => {
  const x = clamp(tint, fn.domain[0], fn.domain[1])
  const t = Math.pow(x, fn.n)
  return fn.c0.map((c0, index) => c0 + t * ((fn.c1[index] ?? 1) - c0))
}

const evaluateType0Function = (fn: PdfType0Function, value: number): number[] => {
  const x = clamp(value, fn.domain[0], fn.domain[1])
  const encoded = clamp(interpolate(x, fn.domain[0], fn.domain[1], fn.encode[0], fn.encode[1]), 0, fn.size - 1)
  const lower = fn.size === 1 ? 0 : Math.min(fn.size - 2, Math.floor(encoded))
  const upper = fn.size === 1 ? 0 : lower + 1
  const weight = fn.size === 1 ? 0 : encoded - lower
  return Array.from({ length: fn.outputComponents }, (_, component) => {
    const low = fn.samples[lower * fn.outputComponents + component] ?? 0
    const high = fn.samples[upper * fn.outputComponents + component] ?? low
    const decoded = interpolate(low + (high - low) * weight, 0, 1, fn.decode[component]?.[0] ?? 0, fn.decode[component]?.[1] ?? 1)
    const [min, max] = fn.range[component] ?? [0, 1]
    return clamp(decoded, min, max)
  })
}

const evaluateColorFunction = (fn: PdfColorFunction, value: number): number[] => {
  if (fn.type === 'sampled') return evaluateType0Function(fn, value)
  if (fn.type === 'exponential') return evaluateType2Function(fn, value)
  const x = clamp(value, fn.domain[0], fn.domain[1])
  const index = stitchingFunctionIndex(fn.bounds, x)
  const inputStart = index === 0 ? fn.domain[0] : fn.bounds[index - 1]
  const inputEnd = index === fn.functions.length - 1 ? fn.domain[1] : fn.bounds[index]
  const [encodeStart, encodeEnd] = fn.encode[index] ?? fn.functions[index].domain
  return evaluateColorFunction(fn.functions[index], interpolate(x, inputStart, inputEnd, encodeStart, encodeEnd))
}

const shadingColorStops = (fn: PdfColorFunction, colorSpace: PdfGraphicsColorSpace, domain: [number, number]): PdfShadingColorStop[] => {
  const positions = fn.type === 'sampled'
    ? sampledStopPositions(fn, domain)
    : fn.type === 'stitching'
    ? [domain[0], ...fn.bounds.filter((value) => value > domain[0] && value < domain[1]), domain[1]]
    : [domain[0], domain[1]]
  return uniqueNumbers(positions)
    .map((value) => ({
      offset: normalizeOffset(value, domain),
      color: colorFromGraphicsColorSpace(colorSpace, evaluateColorFunction(fn, value)),
    }))
}

const functionDomain = (value: PdfPrimitive | undefined): [number, number] => {
  if (Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number') return [value[0], value[1]]
  return [0, 1]
}

const completeFunctionComponents = (values: number[], length: number, fallback: number): number[] =>
  Array.from({ length }, (_, index) => values[index] ?? fallback)

const functionRange = (value: PdfPrimitive | undefined, outputComponents: number): Array<[number, number]> => {
  const range = numberArray(value)
  return Array.from({ length: outputComponents }, (_, index) => [
    range[index * 2] ?? 0,
    range[index * 2 + 1] ?? 1,
  ])
}

const sampledEncode = (value: PdfPrimitive | undefined, sampleCount: number): [number, number] => {
  const encode = numberArray(value)
  return [encode[0] ?? 0, encode[1] ?? sampleCount - 1]
}

const sampledDecode = (value: PdfPrimitive | undefined, range: Array<[number, number]>): Array<[number, number]> => {
  const decode = numberArray(value)
  return range.map(([min, max], index) => [
    decode[index * 2] ?? min,
    decode[index * 2 + 1] ?? max,
  ])
}

const readSampledFunctionSamples = (data: Uint8Array, sampleCount: number, outputComponents: number, bitsPerSample: number): number[] | undefined => {
  const totalSamples = sampleCount * outputComponents
  if (data.length * 8 < totalSamples * bitsPerSample) return undefined
  const maxSample = 2 ** bitsPerSample - 1
  return Array.from({ length: totalSamples }, (_, index) => readBits(data, index * bitsPerSample, bitsPerSample) / maxSample)
}

const readBits = (data: Uint8Array, bitOffset: number, bitCount: number): number => {
  let value = 0
  for (let bit = 0; bit < bitCount; bit++) {
    const offset = bitOffset + bit
    value = value * 2 + (((data[offset >> 3] ?? 0) >> (7 - (offset & 7))) & 1)
  }
  return value
}

const maxSampledColorStops = 64

const sampledStopPositions = (fn: PdfType0Function, domain: [number, number]): number[] => {
  const count = Math.min(fn.size, maxSampledColorStops)
  const positions = [domain[0], domain[1]]
  if (count <= 1) return positions
  for (let index = 0; index < count; index++) {
    const sampleIndex = (index / (count - 1)) * (fn.size - 1)
    const value = fn.encode[0] === fn.encode[1]
      ? fn.domain[0]
      : interpolate(sampleIndex, fn.encode[0], fn.encode[1], fn.domain[0], fn.domain[1])
    if (value > domain[0] && value < domain[1]) positions.push(value)
  }
  return positions.sort((a, b) => a - b)
}

const stitchingBounds = (value: PdfPrimitive | undefined, functionCount: number, domain: [number, number]): number[] => {
  const bounds = numberArray(value)
    .filter((item) => item > domain[0] && item < domain[1])
    .sort((a, b) => a - b)
  return bounds.slice(0, Math.max(0, functionCount - 1))
}

const stitchingEncode = (value: PdfPrimitive | undefined, functions: PdfColorFunction[]): Array<[number, number]> => {
  const encode = numberArray(value)
  return functions.map((fn, index) => {
    const start = encode[index * 2]
    const end = encode[index * 2 + 1]
    return [
      start ?? fn.domain[0],
      end ?? fn.domain[1],
    ]
  })
}

const stitchingFunctionIndex = (bounds: number[], value: number): number => {
  for (let index = 0; index < bounds.length; index++) {
    if (value < bounds[index]) return index
  }
  return bounds.length
}

const interpolate = (value: number, inputStart: number, inputEnd: number, outputStart: number, outputEnd: number): number => {
  if (inputStart === inputEnd) return outputStart
  return outputStart + ((value - inputStart) / (inputEnd - inputStart)) * (outputEnd - outputStart)
}

const normalizeOffset = (value: number, domain: [number, number]): number => {
  if (domain[0] === domain[1]) return 0
  return clamp01((value - domain[0]) / (domain[1] - domain[0]))
}

const uniqueNumbers = (values: number[]): number[] => {
  const output: number[] = []
  for (const value of values) {
    if (output.length === 0 || output[output.length - 1] !== value) output.push(value)
  }
  return output
}

const componentsPerGraphicsColorSpace = (space: PdfGraphicsColorSpace): number =>
  typeof space === 'object' ? 1 : space === 'Pattern' ? 0 : componentsPerDeviceColorSpace(space)

const componentsPerDeviceColorSpace = (space: PdfDeviceColorSpace): number => {
  if (space === 'DeviceRGB') return 3
  if (space === 'DeviceCMYK') return 4
  return 1
}

const colorFromGraphicsColorSpace = (space: PdfGraphicsColorSpace, components: number[]): PdfColor => {
  if (typeof space === 'object') return colorFromComponents(space.alternate, evaluateType2Function(space.tintTransform, components[0] ?? 0))
  if (space === 'Pattern') return [0, 0, 0]
  return colorFromComponents(space, components)
}

const colorFromComponents = (space: PdfDeviceColorSpace, components: number[]): PdfColor => {
  if (space === 'DeviceRGB') return [clamp01(components[0] ?? 0), clamp01(components[1] ?? 0), clamp01(components[2] ?? 0)]
  if (space === 'DeviceCMYK') return cmyk(components[0] ?? 0, components[1] ?? 0, components[2] ?? 0, components[3] ?? 0)
  return gray(components[0] ?? 0)
}

const gray = (value: number): PdfColor => {
  const gray = clamp01(value)
  return [gray, gray, gray]
}

const cmyk = (c: number, m: number, y: number, k: number): PdfColor => [
  1 - Math.min(1, clamp01(c) + clamp01(k)),
  1 - Math.min(1, clamp01(m) + clamp01(k)),
  1 - Math.min(1, clamp01(y) + clamp01(k)),
]

const clamp01 = (value: number): number => clamp(value, 0, 1)

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))

const lineCap = (value: number): PdfLineCap => (value === 1 ? 'round' : value === 2 ? 'square' : 'butt')

const lineJoin = (value: number): PdfLineJoin => (value === 1 ? 'round' : value === 2 ? 'bevel' : 'miter')

const textRenderingMode = (value: number): PdfTextRenderingMode => {
  if (value === 1) return 'stroke'
  if (value === 2) return 'fillStroke'
  if (value === 3) return 'invisible'
  if (value === 4) return 'fillClip'
  if (value === 5) return 'strokeClip'
  if (value === 6) return 'fillStrokeClip'
  if (value === 7) return 'clip'
  return 'fill'
}

const paintsPathFill = (paint: PdfPathPaint): boolean =>
  paint === 'fill' || paint === 'fillEvenOdd' || paint === 'fillStroke' || paint === 'fillStrokeEvenOdd'

const paintsPathStroke = (paint: PdfPathPaint): boolean =>
  paint === 'stroke' || paint === 'fillStroke' || paint === 'fillStrokeEvenOdd'

const numberArray = (value: unknown): number[] =>
  Array.isArray(value) ? value.filter((item): item is number => typeof item === 'number') : []

function shadingCoords(value: PdfPrimitive | undefined, shadingType: 2): [number, number, number, number] | undefined
function shadingCoords(value: PdfPrimitive | undefined, shadingType: 3): [number, number, number, number, number, number] | undefined
function shadingCoords(value: PdfPrimitive | undefined, shadingType: 2 | 3): [number, number, number, number] | [number, number, number, number, number, number] | undefined {
  const coords = numberArray(value)
  if (shadingType === 3) {
    if (coords.length < 6) return undefined
    return [coords[0], coords[1], coords[2], coords[3], coords[4], coords[5]]
  }
  if (coords.length < 4) return undefined
  return [coords[0], coords[1], coords[2], coords[3]]
}

const shadingExtend = (value: PdfPrimitive | undefined): [boolean, boolean] => {
  if (!Array.isArray(value)) return [false, false]
  return [value[0] === true, value[1] === true]
}

const transformShading = (shading: PdfShading, matrix: PdfMatrix): PdfShading => {
  if (isIdentityMatrix(matrix)) return shading
  if (shading.type === 'axial') {
    const start = transformPoint(shading.coords[0], shading.coords[1], matrix)
    const end = transformPoint(shading.coords[2], shading.coords[3], matrix)
    return {
      ...shading,
      coords: [start.x, start.y, end.x, end.y],
    }
  }
  const start = transformPoint(shading.coords[0], shading.coords[1], matrix)
  const end = transformPoint(shading.coords[3], shading.coords[4], matrix)
  return {
    ...shading,
    coords: [
      start.x,
      start.y,
      transformRadius(shading.coords[2], matrix),
      end.x,
      end.y,
      transformRadius(shading.coords[5], matrix),
    ],
  }
}

const transformRadius = (radius: number, matrix: PdfMatrix): number => radius * Math.sqrt(Math.abs(matrix[0] * matrix[3] - matrix[1] * matrix[2]))

const toMatrix = (value: PdfPrimitive | undefined): PdfMatrix | undefined => {
  const numbers = numberArray(value)
  if (numbers.length < 6) return undefined
  return [numbers[0], numbers[1], numbers[2], numbers[3], numbers[4], numbers[5]]
}

const rectToPath = (box: PdfRect): PdfPathSegment => ({
  type: 'rect',
  x: box[0],
  y: box[1],
  width: box[2] - box[0],
  height: box[3] - box[1],
})

const isSimpleTextMatrix = (matrix: PdfMatrix): boolean =>
  matrix[0] === 1 && matrix[1] === 0 && matrix[2] === 0 && matrix[3] === 1

const compactTextDisplayOps = (ops: PdfDisplayOp[]): PdfDisplayOp[] => {
  const compacted: PdfDisplayOp[] = []
  for (let index = 0; index < ops.length;) {
    const op = ops[index]
    if (op?.type === 'save') {
      const first = transformedTextOpAt(ops, index)
      if (first) {
        let text = first.run.text
        let width = textDisplayRunWidth(first.run)
        let consumed = 4
        let sequenceCount = 1
        let previous = first
        for (let nextIndex = index + 4; nextIndex < ops.length; nextIndex += 4) {
          const next = transformedTextOpAt(ops, nextIndex)
          if (!next || !sameTextDisplayStyle(first.run, next.run) || !canAppendTextDisplayOp(previous, next)) break
          const offset = localMatrixOffset(first.matrix, next.matrix)
          width = Math.max(width, offset.x + textDisplayRunWidth(next.run))
          text += next.run.text
          consumed += 4
          sequenceCount++
          previous = next
        }
        if (sequenceCount > 1) {
          compacted.push(
            { type: 'save' },
            { type: 'transform', matrix: first.matrix },
            { type: 'text', run: { ...first.run, text, width } },
            { type: 'restore' },
          )
          index += consumed
          continue
        }
      }
    }
    if (op?.type === 'text' && paintsDisplayText(op.run)) {
      const first = op.run
      let text = first.text
      let width = textDisplayRunWidth(first)
      let consumed = 1
      let sequenceCount = 1
      let previous = first
      for (let nextIndex = index + 1; nextIndex < ops.length; nextIndex++) {
        const nextOp = ops[nextIndex]
        if (nextOp?.type !== 'text' || !paintsDisplayText(nextOp.run) || !sameTextDisplayStyle(first, nextOp.run) || !canAppendPlainTextDisplayOp(previous, nextOp.run)) break
        width = Math.max(width, nextOp.run.x - first.x + textDisplayRunWidth(nextOp.run))
        text += nextOp.run.text
        consumed++
        sequenceCount++
        previous = nextOp.run
      }
      if (sequenceCount > 1) {
        compacted.push({ type: 'text', run: { ...first, text, width } })
        index += consumed
        continue
      }
    }
    compacted.push(op)
    index++
  }
  return compacted
}

const collectPlainTextDisplaySpan = (ops: PdfDisplayOp[], startIndex: number): PlainTextDisplaySpan | undefined => {
  const first = plainTextOpAt(ops, startIndex)
  if (!first) return undefined
  let text = first.text
  let width = textDisplayRunWidth(first)
  let consumed = 1
  let sequenceCount = 1
  let previous = first
  for (let index = startIndex + 1; index < ops.length; index++) {
    const next = plainTextOpAt(ops, index)
    if (!next || !sameTextDisplayStyle(first, next) || !canAppendPlainTextDisplayOp(previous, next)) break
    width = Math.max(width, next.x - first.x + textDisplayRunWidth(next))
    text += next.text
    consumed++
    sequenceCount++
    previous = next
  }
  return { run: first, text, width, consumed, sequenceCount }
}

const plainTextOpAt = (ops: PdfDisplayOp[], index: number): PdfTextRun | undefined => {
  const op = ops[index]
  if (op?.type !== 'text' || !paintsDisplayText(op.run)) return undefined
  return op.run
}

const collectTextDisplaySpan = (ops: PdfDisplayOp[], startIndex: number): TextDisplaySpan | undefined => {
  const first = transformedTextOpAt(ops, startIndex)
  if (!first) return undefined
  let text = first.run.text
  let width = textDisplayRunWidth(first.run)
  let consumed = 4
  let sequenceCount = 1
  let previous = first
  for (let index = startIndex + 4; index < ops.length; index += 4) {
    const next = transformedTextOpAt(ops, index)
    if (!next || !sameTextDisplayStyle(first.run, next.run) || !canAppendTextDisplayOp(previous, next)) break
    const offset = localMatrixOffset(first.matrix, next.matrix)
    width = Math.max(width, offset.x + textDisplayRunWidth(next.run))
    text += next.run.text
    consumed += 4
    sequenceCount++
    previous = next
  }
  return { matrix: first.matrix, run: first.run, text, width, consumed, sequenceCount }
}

const transformedTextOpAt = (ops: PdfDisplayOp[], index: number): TextDisplaySequence | undefined => {
  const save = ops[index]
  const transform = ops[index + 1]
  const text = ops[index + 2]
  const restore = ops[index + 3]
  if (save?.type !== 'save' || transform?.type !== 'transform' || text?.type !== 'text' || restore?.type !== 'restore') return undefined
  if (text.run.x !== 0 || text.run.y !== 0 || !paintsDisplayText(text.run)) return undefined
  return { matrix: transform.matrix, run: text.run }
}

interface TextDisplaySequence {
  matrix: PdfMatrix
  run: PdfTextRun
}

interface TextDisplaySpan extends TextDisplaySequence {
  text: string
  width: number
  consumed: number
  sequenceCount: number
}

interface PlainTextDisplaySpan {
  run: PdfTextRun
  text: string
  width: number
  consumed: number
  sequenceCount: number
}

const sameTextDisplayStyle = (left: PdfTextRun, right: PdfTextRun): boolean =>
  left.fontSize === right.fontSize &&
  left.fontName === right.fontName &&
  left.fontFamily === right.fontFamily &&
  left.fontWeight === right.fontWeight &&
  left.fontStyle === right.fontStyle &&
  (left.renderingMode ?? 'fill') === (right.renderingMode ?? 'fill') &&
  samePdfColor(left.fillColor, right.fillColor) &&
  samePdfColor(left.strokeColor, right.strokeColor)

const canAppendTextDisplayOp = (previous: TextDisplaySequence, next: TextDisplaySequence): boolean => {
  if (!sameMatrixLinearPart(previous.matrix, next.matrix)) return false
  const offset = localMatrixOffset(previous.matrix, next.matrix)
  const expected = textDisplayRunWidth(previous.run)
  const tolerance = Math.max(0.5, previous.run.fontSize * 0.1)
  return Math.abs(offset.y) <= tolerance && Math.abs(offset.x - expected) <= tolerance
}

const canAppendPlainTextDisplayOp = (previous: PdfTextRun, next: PdfTextRun): boolean => {
  const expected = previous.x + textDisplayRunWidth(previous)
  const tolerance = Math.max(0.5, previous.fontSize * 0.1)
  return Math.abs(next.y - previous.y) <= tolerance && Math.abs(next.x - expected) <= tolerance
}

const textDisplayRunWidth = (run: PdfTextRun): number => run.width ?? Math.max(1, run.fontSize) * run.text.length

const sameMatrixLinearPart = (left: PdfMatrix, right: PdfMatrix): boolean =>
  nearlyEqual(left[0], right[0]) &&
  nearlyEqual(left[1], right[1]) &&
  nearlyEqual(left[2], right[2]) &&
  nearlyEqual(left[3], right[3])

const localMatrixOffset = (from: PdfMatrix, to: PdfMatrix): { x: number; y: number } => {
  const dx = to[4] - from[4]
  const dy = to[5] - from[5]
  const determinant = from[0] * from[3] - from[1] * from[2]
  if (Math.abs(determinant) < 1e-9) return { x: Number.NaN, y: Number.NaN }
  return {
    x: (from[3] * dx - from[2] * dy) / determinant,
    y: (-from[1] * dx + from[0] * dy) / determinant,
  }
}

const paintsDisplayText = (run: PdfTextRun): boolean =>
  run.renderingMode !== 'invisible' && run.renderingMode !== 'clip'

const samePdfColor = (left?: PdfColor, right?: PdfColor): boolean => {
  const a = left ?? [0, 0, 0]
  const b = right ?? [0, 0, 0]
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
}

const nearlyEqual = (left: number, right: number): boolean => Math.abs(left - right) <= 1e-6

interface GraphicsStateSnapshot {
  path: PdfPathSegment[]
  inText: boolean
  textMatrix: PdfMatrix
  textLineMatrix: PdfMatrix
  leading: number
  fontSize: number
  fontName: string | undefined
  charSpacing: number
  wordSpacing: number
  horizontalScale: number
  textRise: number
  fillColor: PdfColor
  strokeColor: PdfColor
  fillPattern: PdfShadingPattern | undefined
  strokePattern: PdfShadingPattern | undefined
  textRenderingMode: PdfTextRenderingMode
  strokeColorSpace: PdfGraphicsColorSpace
  fillColorSpace: PdfGraphicsColorSpace
  paintStateStack: GraphicsPaintState[]
}

interface GraphicsPaintState {
  fillColor: PdfColor
  strokeColor: PdfColor
  fillPattern: PdfShadingPattern | undefined
  strokePattern: PdfShadingPattern | undefined
  textRenderingMode: PdfTextRenderingMode
  strokeColorSpace: PdfGraphicsColorSpace
  fillColorSpace: PdfGraphicsColorSpace
}

const isInlineImage = (token: ContentToken): token is ContentInlineImageToken =>
  Boolean(token && typeof token === 'object' && !Array.isArray(token) && token.type === 'inlineImage')

const colorSpaceName = (value: string): PdfDeviceColorSpace | 'Pattern' | undefined => {
  if (value === 'DeviceGray' || value === 'G') return 'DeviceGray'
  if (value === 'DeviceRGB' || value === 'RGB') return 'DeviceRGB'
  if (value === 'DeviceCMYK' || value === 'CMYK') return 'DeviceCMYK'
  if (value === 'Pattern') return 'Pattern'
  return undefined
}

const inlineColorSpace = (dict: Map<string, ContentToken>, resources: Map<string, PdfGraphicsColorSpace> | undefined): PdfImageColorSpace | undefined => {
  const token = inlineValue(dict, 'CS', 'ColorSpace')
  if (!token) return 'DeviceGray'
  if (isContentName(token)) {
    const resourceColorSpace = resources?.get(token.value)
    return deviceColorSpace(resourceColorSpace) ?? deviceColorSpace(colorSpaceName(token.value)) ?? inlineReadColorSpace(token)
  }
  return inlineReadColorSpace(token)
}

const identityResolve: PdfPrimitiveResolver = (value) => value

const deviceColorSpace = (value: PdfGraphicsColorSpace | undefined): PdfDeviceColorSpace | undefined =>
  value === 'DeviceGray' || value === 'DeviceRGB' || value === 'DeviceCMYK' ? value : undefined

const inlineReadColorSpace = (token: ContentToken): PdfImageColorSpace | undefined => {
  const primitive = inlinePrimitive(token)
  if (primitive === undefined) return undefined
  try {
    return readImageColorSpace(primitive)
  } catch {
    return undefined
  }
}

const inlineNumber = (dict: Map<string, ContentToken>, ...keys: string[]): number | undefined => {
  const value = inlineValue(dict, ...keys)
  return typeof value === 'number' ? value : undefined
}

const inlineBoolean = (dict: Map<string, ContentToken>, ...keys: string[]): boolean | undefined => {
  const value = inlineValue(dict, ...keys)
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

const inlineDecode = (dict: Map<string, ContentToken>): number[] | undefined => {
  const value = inlinePrimitive(inlineValue(dict, 'D', 'Decode'))
  if (value === undefined) return undefined
  try {
    return readImageDecode(value)
  } catch {
    return undefined
  }
}

const inlineValue = (dict: Map<string, ContentToken>, ...keys: string[]): ContentToken | undefined => {
  for (const key of keys) {
    const value = dict.get(key)
    if (value !== undefined) return value
  }
  return undefined
}

const inlinePrimitive = (token: ContentToken | undefined): PdfPrimitive | undefined => {
  if (token === undefined || isInlineImage(token)) return undefined
  if (isContentString(token)) return token.value
  if (typeof token === 'string' || typeof token === 'number') return token
  if (isContentName(token)) return token
  if (Array.isArray(token)) {
    const output: PdfPrimitive[] = []
    for (const item of token) {
      const value = inlinePrimitive(item)
      if (value === undefined) return undefined
      output.push(value)
    }
    return output
  }
  return undefined
}

const inlineImageSamples = (token: ContentInlineImageToken): Uint8Array | undefined => {
  let data = latin1ToBytes(token.data)
  const filters = inlineFilterNames(token.dict)
  if (!filters) return data
  try {
    for (const filter of filters) {
      if (!supportsInlineImageFilter(filter)) return undefined
      data = decodeInlineImageFilter(filter, data) ?? data
    }
    return data
  } catch {
    return undefined
  }
}

const inlineFilterNames = (dict: Map<string, ContentToken>): string[] | undefined => {
  const filter = inlineValue(dict, 'F', 'Filter')
  if (!filter) return undefined
  if (isContentName(filter)) return [filter.value]
  if (Array.isArray(filter)) {
    const names = filter.filter(isContentName).map((item) => item.value)
    return names.length === filter.length ? names : undefined
  }
  return undefined
}

const decodeInlineImageFilter = (name: string, data: Uint8Array): Uint8Array | undefined => {
  if (name === 'ASCIIHexDecode' || name === 'AHx') return decodeAsciiHex(data)
  if (name === 'ASCII85Decode' || name === 'A85') return decodeAscii85(data)
  if (name === 'RunLengthDecode' || name === 'RL') return decodeRunLength(data)
  return undefined
}

const supportsInlineImageFilter = (name: string): boolean =>
  name === 'ASCIIHexDecode' || name === 'AHx' || name === 'ASCII85Decode' || name === 'A85' || name === 'RunLengthDecode' || name === 'RL'

const latin1ToBytes = (input: string): Uint8Array => {
  const bytes = new Uint8Array(input.length)
  for (let i = 0; i < input.length; i++) bytes[i] = input.charCodeAt(i) & 0xff
  return bytes
}

const maxFormDepth = 16

const operators = new Set([
  'q',
  'Q',
  'cm',
  'w',
  'J',
  'j',
  'M',
  'd',
  'G',
  'g',
  'RG',
  'rg',
  'K',
  'k',
  'CS',
  'cs',
  'SC',
  'SCN',
  'sc',
  'scn',
  'BMC',
  'BDC',
  'EMC',
  'MP',
  'DP',
  'gs',
  'sh',
  'm',
  'l',
  'c',
  'v',
  'y',
  'h',
  're',
  'S',
  's',
  'f',
  'F',
  'f*',
  'B',
  'B*',
  'b',
  'b*',
  'W',
  'W*',
  'n',
  'Do',
  'BT',
  'ET',
  'Tf',
  'Tr',
  'Td',
  'TD',
  'Tm',
  'T*',
  'Tc',
  'Tw',
  'Tz',
  'TL',
  'Ts',
  'Tj',
  'TJ',
  "'",
  '"',
])
