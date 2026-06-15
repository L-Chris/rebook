import { bytesToLatin1 } from './bytes'
import { ContentTokenizer, ContentToken, isContentString } from './content'
import { PdfFontDecoder, PdfFontMap, PdfTextAdvanceOptions } from './fonts'
import { copyMatrix, identityMatrix, multiplyMatrix, translateMatrix } from './matrix'
import { decodePdfTextString } from './strings'
import { advancePdfTextWithOptions, contentTextValue, currentPdfFont, isContentDict, isContentName, pdfFontRunStyle } from './text-state'
import { PdfFontSource, PdfMatrix, PdfPageText, PdfTextRun } from '../types'

export interface PdfTextResources {
  fonts?: PdfFontMap
  forms?: Map<string, PdfTextFormResource>
}

export interface PdfTextFormResource {
  matrix: PdfMatrix
  streams: Uint8Array[]
  resources: PdfTextResources
}

export const extractPageText = (
  streams: Uint8Array[],
  pageIndex: number,
  width: number,
  height: number,
  resources: PdfTextResources = {},
  transform: PdfMatrix = [1, 0, 0, 1, 0, 0],
): PdfPageText => {
  const interpreter = new TextInterpreter(pageIndex, width, height, resources, transform)
  for (const stream of streams) interpreter.execute(bytesToLatin1(stream))
  return interpreter.finish()
}

class TextInterpreter {
  private readonly runs: PdfTextRun[] = []
  private readonly stack: ContentToken[] = []
  private inText = false
  private textMatrix: PdfMatrix = identityMatrix()
  private lineMatrix: PdfMatrix = identityMatrix()
  private ctm: PdfMatrix = identityMatrix()
  private leading = 0
  private fontSize = 12
  private fontName: string | undefined
  private charSpacing = 0
  private wordSpacing = 0
  private horizontalScale = 1
  private textRise = 0
  private readonly ctmStack: PdfMatrix[] = []
  private readonly markedContent: MarkedContentState[] = []
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
    private resources: PdfTextResources,
    private readonly transform: PdfMatrix,
  ) {}

  execute(source: string): void {
    const tokenizer = new ContentTokenizer(source)
    for (const token of tokenizer.tokens()) {
      if (typeof token === 'string' && isOperator(token)) this.apply(token)
      else this.stack.push(token)
    }
  }

  finish(): PdfPageText {
    const text = this.runs.map((run) => run.text).join('')
    return { pageIndex: this.pageIndex, width: this.width, height: this.height, runs: this.runs, text }
  }

  private apply(operator: string): void {
    switch (operator) {
      case 'q':
        this.ctmStack.push([...this.ctm])
        break
      case 'Q':
        this.ctm = this.ctmStack.pop() ?? identityMatrix()
        break
      case 'cm': {
        const f = this.popNumber()
        const e = this.popNumber()
        const d = this.popNumber()
        const c = this.popNumber()
        const b = this.popNumber()
        const a = this.popNumber()
        this.ctm = multiplyMatrix(this.ctm, [a, b, c, d, e, f])
        break
      }
      case 'BT':
        this.inText = true
        this.textMatrix = identityMatrix()
        this.lineMatrix = identityMatrix()
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
        this.lineMatrix = [...this.textMatrix]
        break
      }
      case 'T*':
        this.nextLine()
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
        this.nextLine()
        this.showText(this.popText())
        break
      case '"': {
        const text = this.stack.pop()
        this.charSpacing = this.popNumber()
        this.wordSpacing = this.popNumber()
        this.nextLine()
        this.showText(contentTextValue(text))
        break
      }
      case 'TJ': {
        const parts = this.stack.pop()
        if (Array.isArray(parts)) this.showTextParts(parts)
        break
      }
      case 'BMC':
        this.stack.pop()
        this.markedContent.push({})
        break
      case 'BDC':
        this.beginMarkedContent()
        break
      case 'EMC':
        this.endMarkedContent()
        break
      case 'MP':
      case 'DP':
        break
      case 'Do': {
        const name = this.stack.pop()
        if (!isContentName(name)) break
        const form = this.resources.forms?.get(name.value)
        if (form) this.showForm(form)
        break
      }
    }
    this.stack.length = 0
  }

  private showText(text: string): void {
    if (!this.inText || text.length === 0) return
    const font = this.currentFont()
    const decoded = font.decode(text)
    const positionMatrix = this.textPositionMatrix()
    const fontSize = this.displayFontSize(this.textRenderMatrix())
    const advance = this.advanceText(text, font)
    const width = this.displayTextAdvance(advance, this.textMatrix)
    const actualText = this.currentActualText()
    const runStyle = this.currentRunStyle(font)
    if (actualText) {
      if (!actualText.seenText) {
        const point = this.textLayerPoint(positionMatrix)
        actualText.x = point.x
        actualText.y = point.y
        actualText.fontSize = fontSize
        actualText.width = width
        actualText.fontName = this.fontName
        actualText.fontFamily = runStyle.fontFamily
        actualText.fontWeight = runStyle.fontWeight
        actualText.fontStyle = runStyle.fontStyle
        actualText.fontSource = runStyle.fontSource
        actualText.seenText = true
      }
      this.advanceTextMatrix(advance)
      return
    }
    const point = this.textLayerPoint(positionMatrix)
    this.appendTextRun({
      text: decoded,
      x: point.x,
      y: point.y,
      fontSize,
      width,
      fontName: this.fontName,
      ...runStyle,
    })
    this.advanceTextMatrix(advance)
  }

  private showTextParts(parts: ContentToken[]): void {
    for (const part of parts) {
      if (isContentString(part) || typeof part === 'string') this.showText(contentTextValue(part))
      else if (typeof part === 'number') this.adjustText(part)
    }
  }

  private beginMarkedContent(): void {
    const properties = this.stack.pop()
    this.stack.pop()
    this.markedContent.push({ actualText: actualText(properties) })
  }

  private endMarkedContent(): void {
    const state = this.markedContent.pop()
    if (!state?.actualText) return
    this.appendTextRun({
      text: state.actualText,
      ...this.textLayerPoint(this.textPositionMatrix(), state.x, state.y),
      fontSize: state.fontSize ?? this.displayFontSize(this.textRenderMatrix()),
      width: state.width,
      fontName: state.fontName ?? this.fontName,
      ...(state.fontFamily ? { fontFamily: state.fontFamily } : {}),
      ...(state.fontWeight ? { fontWeight: state.fontWeight } : {}),
      ...(state.fontStyle ? { fontStyle: state.fontStyle } : {}),
      ...(state.fontSource ? { fontSource: state.fontSource } : {}),
    })
  }

  private appendTextRun(run: PdfTextRun): void {
    const previous = this.runs.at(-1)
    if (previous && canAppendTextRun(previous, run)) {
      const right = Math.max(textRunRight(previous), textRunRight(run))
      previous.text += run.text
      previous.width = right - previous.x
      return
    }
    this.runs.push(run)
  }

  private currentActualText(): MarkedContentState | undefined {
    for (let i = this.markedContent.length - 1; i >= 0; i--) {
      if (this.markedContent[i].actualText !== undefined) return this.markedContent[i]
    }
    return undefined
  }

  private showForm(form: PdfTextFormResource): void {
    const state = this.snapshotState()
    const previousResources = this.resources
    this.resources = form.resources
    this.ctm = multiplyMatrix(this.ctm, form.matrix)
    try {
      for (const stream of form.streams) this.execute(bytesToLatin1(stream))
    } finally {
      this.resources = previousResources
      this.restoreState(state)
    }
  }

  private snapshotState(): TextStateSnapshot {
    return {
      inText: this.inText,
      textMatrix: [...this.textMatrix],
      lineMatrix: [...this.lineMatrix],
      ctm: [...this.ctm],
      leading: this.leading,
      fontSize: this.fontSize,
      fontName: this.fontName,
      charSpacing: this.charSpacing,
      wordSpacing: this.wordSpacing,
      horizontalScale: this.horizontalScale,
      textRise: this.textRise,
      ctmStack: this.ctmStack.map((matrix) => [...matrix]),
      markedContent: this.markedContent.map((item) => ({ ...item })),
    }
  }

  private restoreState(state: TextStateSnapshot): void {
    this.inText = state.inText
    this.textMatrix = [...state.textMatrix]
    this.lineMatrix = [...state.lineMatrix]
    this.ctm = [...state.ctm]
    this.leading = state.leading
    this.fontSize = state.fontSize
    this.fontName = state.fontName
    this.charSpacing = state.charSpacing
    this.wordSpacing = state.wordSpacing
    this.horizontalScale = state.horizontalScale
    this.textRise = state.textRise
    this.ctmStack.length = 0
    this.ctmStack.push(...state.ctmStack.map(copyMatrix))
    this.markedContent.length = 0
    this.markedContent.push(...state.markedContent.map((item) => ({ ...item })))
  }

  private popNumber(): number {
    const value = this.stack.pop()
    return typeof value === 'number' ? value : 0
  }

  private popText(): string {
    return contentTextValue(this.stack.pop())
  }

  private textLayerPoint(matrix: PdfMatrix, overrideX?: number, overrideY?: number): { x: number; y: number } {
    if (overrideX !== undefined && overrideY !== undefined) return { x: overrideX, y: overrideY }
    const userMatrix = multiplyMatrix(this.ctm, matrix)
    const x = userMatrix[4]
    const y = userMatrix[5]
    const [a, b, c, d, e, f] = this.transform
    const displayX = a * x + c * y + e
    const displayY = b * x + d * y + f
    return { x: displayX, y: this.height - displayY }
  }

  private displayFontSize(matrix: PdfMatrix): number {
    const userMatrix = multiplyMatrix(this.ctm, matrix)
    const [a, b, c, d] = this.transform
    const displayC = a * userMatrix[2] + c * userMatrix[3]
    const displayD = b * userMatrix[2] + d * userMatrix[3]
    const fontSize = this.fontSize * Math.hypot(displayC, displayD)
    return fontSize > 0 ? fontSize : this.fontSize
  }

  private displayTextAdvance(advance: number, matrix: PdfMatrix): number | undefined {
    if (advance <= 0) return undefined
    const userMatrix = multiplyMatrix(this.ctm, matrix)
    const [a, b, c, d] = this.transform
    const userDX = userMatrix[0] * advance
    const userDY = userMatrix[1] * advance
    return Math.hypot(a * userDX + c * userDY, b * userDX + d * userDY)
  }

  private moveTextLine(x: number, y: number): void {
    this.lineMatrix = translateMatrix(this.lineMatrix, x, y)
    this.textMatrix = [...this.lineMatrix]
  }

  private nextLine(): void {
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

  private textPositionMatrix(): PdfMatrix {
    return this.textRise === 0 ? this.textMatrix : translateMatrix(this.textMatrix, 0, this.textRise)
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
}

const operators = new Set([
  'q',
  'Q',
  'cm',
  'BT',
  'ET',
  'Tf',
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
  'BMC',
  'BDC',
  'EMC',
  'MP',
  'DP',
  'Do',
  "'",
  '"',
])

const isOperator = (value: string): boolean => operators.has(value)

interface TextStateSnapshot {
  inText: boolean
  textMatrix: PdfMatrix
  lineMatrix: PdfMatrix
  ctm: PdfMatrix
  leading: number
  fontSize: number
  fontName: string | undefined
  charSpacing: number
  wordSpacing: number
  horizontalScale: number
  textRise: number
  ctmStack: PdfMatrix[]
  markedContent: MarkedContentState[]
}

const canAppendTextRun = (previous: PdfTextRun, next: PdfTextRun): boolean => {
  if (previous.fontName !== next.fontName) return false
  if (previous.fontFamily !== next.fontFamily || previous.fontWeight !== next.fontWeight || previous.fontStyle !== next.fontStyle) return false
  const fontSize = Math.max(previous.fontSize, next.fontSize, 1)
  if (Math.abs(previous.fontSize - next.fontSize) > fontSize * 0.02) return false
  if (Math.abs(previous.y - next.y) > Math.max(0.5, fontSize * 0.15)) return false
  const gap = next.x - textRunRight(previous)
  const overlapTolerance = Math.max(0.5, fontSize * 0.1)
  const gapTolerance = Math.max(2, fontSize * 0.35)
  return gap >= -overlapTolerance && gap <= gapTolerance
}

const textRunRight = (run: PdfTextRun): number => run.x + textRunWidth(run)

const textRunWidth = (run: PdfTextRun): number =>
  run.width ?? Math.max(1, run.fontSize) * run.text.length

const actualText = (token: ContentToken | undefined): string | undefined => {
  if (!isContentDict(token)) return undefined
  const value = token.entries.get('ActualText')
  return isContentString(value) || typeof value === 'string' ? decodePdfTextString(contentTextValue(value)) : undefined
}

interface MarkedContentState {
  actualText?: string
  seenText?: boolean
  x?: number
  y?: number
  fontSize?: number
  width?: number
  fontName?: string
  fontFamily?: string
  fontWeight?: string
  fontStyle?: 'normal' | 'italic' | 'oblique'
  fontSource?: PdfFontSource
}
