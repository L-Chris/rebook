import type {
  PdfBlendMode,
  PdfClipRule,
  PdfColor,
  PdfDisplayOp,
  PdfLineCap,
  PdfLineJoin,
  PdfMatrix,
  PdfPageDisplayList,
  PdfPathPaint,
  PdfPathSegment,
  PdfShading,
  PdfTextRenderingMode,
  PdfTextRun,
} from '../types'
import { identityMatrix, multiplyMatrix, transformPoint } from '../engine/matrix'

export interface PdfDrawingState {
  readonly transform: PdfMatrix
  readonly lineWidth: number
  readonly lineCap: PdfLineCap
  readonly lineJoin: PdfLineJoin
  readonly miterLimit: number
  readonly dash: readonly number[]
  readonly dashPhase: number
  readonly strokeAlpha: number
  readonly fillAlpha: number
  readonly blendMode: PdfBlendMode
  readonly strokeColor: PdfColor
  readonly fillColor: PdfColor
  readonly clipRect?: PdfRectBounds
}

export interface PdfRectBounds {
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
}

export interface PdfDrawingPipeline {
  beginPage?(displayList: PdfPageDisplayList): void | Promise<void>
  endPage?(displayList: PdfPageDisplayList): void | Promise<void>
  path?(op: Extract<PdfDisplayOp, { type: 'path' }>, state: PdfDrawingState): void | Promise<void>
  image?(op: Extract<PdfDisplayOp, { type: 'image' }>, state: PdfDrawingState): void | Promise<void>
  text?(op: Extract<PdfDisplayOp, { type: 'text' }>, state: PdfDrawingState): void | Promise<void>
  shading?(op: Extract<PdfDisplayOp, { type: 'shading' }>, state: PdfDrawingState): void | Promise<void>
  clip?(op: Extract<PdfDisplayOp, { type: 'clip' }>, state: PdfDrawingState): void | Promise<void>
  unsupported?(op: PdfDisplayOp, state: PdfDrawingState, reason: string): void | Promise<void>
}

export interface PdfReplayOptions {
  readonly ignoreInvisibleText?: boolean
}

export const createInitialDrawingState = (): PdfDrawingState => ({
  transform: identityMatrix(),
  lineWidth: 1,
  lineCap: 'butt',
  lineJoin: 'miter',
  miterLimit: 10,
  dash: [],
  dashPhase: 0,
  strokeAlpha: 1,
  fillAlpha: 1,
  blendMode: 'normal',
  strokeColor: [0, 0, 0],
  fillColor: [0, 0, 0],
})

export async function replayPdfDisplayList(
  displayList: PdfPageDisplayList,
  pipeline: PdfDrawingPipeline,
  options: PdfReplayOptions = {},
): Promise<void> {
  let state = createInitialDrawingState()
  const stack: PdfDrawingState[] = []
  await pipeline.beginPage?.(displayList)

  for (const op of displayList.ops) {
    switch (op.type) {
      case 'save':
        stack.push(cloneDrawingState(state))
        break
      case 'restore':
        state = stack.pop() ?? createInitialDrawingState()
        break
      case 'transform':
        state = { ...state, transform: multiplyMatrix(state.transform, op.matrix) }
        break
      case 'lineWidth':
        state = { ...state, lineWidth: op.width }
        break
      case 'lineCap':
        state = { ...state, lineCap: op.cap }
        break
      case 'lineJoin':
        state = { ...state, lineJoin: op.join }
        break
      case 'miterLimit':
        state = { ...state, miterLimit: op.limit }
        break
      case 'dash':
        state = { ...state, dash: [...op.pattern], dashPhase: op.phase }
        break
      case 'strokeAlpha':
        state = { ...state, strokeAlpha: clamp01(op.alpha) }
        break
      case 'fillAlpha':
        state = { ...state, fillAlpha: clamp01(op.alpha) }
        break
      case 'blendMode':
        state = { ...state, blendMode: op.mode }
        break
      case 'strokeColor':
        state = { ...state, strokeColor: op.color }
        break
      case 'fillColor':
        state = { ...state, fillColor: op.color }
        break
      case 'clip': {
        const rect = clipRectFromPath(op.segments, state.transform, op.rule)
        await pipeline.clip?.(op, state)
        if (rect) state = { ...state, clipRect: intersectRectBounds(state.clipRect, rect) }
        else await pipeline.unsupported?.(op, state, 'non-rectangular clip')
        break
      }
      case 'path':
        await pipeline.path?.(op, state)
        break
      case 'image':
        await pipeline.image?.(op, state)
        break
      case 'text':
        if (!options.ignoreInvisibleText || paintsVisibleText(op.run)) await pipeline.text?.(op, state)
        break
      case 'shading':
        await pipeline.shading?.(op, state)
        break
    }
  }

  await pipeline.endPage?.(displayList)
}

export const paintsPathFill = (paint: PdfPathPaint): boolean =>
  paint === 'fill' || paint === 'fillEvenOdd' || paint === 'fillStroke' || paint === 'fillStrokeEvenOdd'

export const paintsPathStroke = (paint: PdfPathPaint): boolean =>
  paint === 'stroke' || paint === 'fillStroke' || paint === 'fillStrokeEvenOdd'

export const paintsTextFill = (mode: PdfTextRenderingMode = 'fill'): boolean =>
  mode === 'fill' || mode === 'fillStroke' || mode === 'fillClip' || mode === 'fillStrokeClip'

export const paintsTextStroke = (mode: PdfTextRenderingMode = 'fill'): boolean =>
  mode === 'stroke' || mode === 'fillStroke' || mode === 'strokeClip' || mode === 'fillStrokeClip'

export const paintsVisibleText = (run: PdfTextRun): boolean => {
  if (run.renderingMode === 'invisible' || run.renderingMode === 'clip') return false
  return paintsTextFill(run.renderingMode) || paintsTextStroke(run.renderingMode)
}

export const pdfTextFont = (run: PdfTextRun, scale = 1): string => {
  const size = `${Math.max(1, run.fontSize * scale)}px`
  const family = run.fontFamily ?? 'sans-serif'
  const style = run.fontStyle ?? 'normal'
  const weight = run.fontWeight ?? 'normal'
  const prefix = [
    style !== 'normal' ? style : undefined,
    weight !== 'normal' ? weight : undefined,
  ].filter(Boolean).join(' ')
  return prefix ? `${prefix} ${size} ${family}` : `${size} ${family}`
}

export const transformRectBounds = (rect: PdfRectBounds, matrix: PdfMatrix): PdfRectBounds => {
  const points = [
    transformPoint(rect.minX, rect.minY, matrix),
    transformPoint(rect.maxX, rect.minY, matrix),
    transformPoint(rect.maxX, rect.maxY, matrix),
    transformPoint(rect.minX, rect.maxY, matrix),
  ]
  return pointsToRectBounds(points)
}

export const pathBounds = (segments: readonly PdfPathSegment[], matrix: PdfMatrix = identityMatrix()): PdfRectBounds | null => {
  const points: Array<{ x: number; y: number }> = []
  for (const segment of segments) {
    if (segment.type === 'moveTo' || segment.type === 'lineTo') points.push(transformPoint(segment.x, segment.y, matrix))
    else if (segment.type === 'curveTo') {
      points.push(
        transformPoint(segment.x1, segment.y1, matrix),
        transformPoint(segment.x2, segment.y2, matrix),
        transformPoint(segment.x3, segment.y3, matrix),
      )
    } else if (segment.type === 'rect') {
      const rect = transformRectBounds({
        minX: segment.x,
        minY: segment.y,
        maxX: segment.x + segment.width,
        maxY: segment.y + segment.height,
      }, matrix)
      points.push(
        { x: rect.minX, y: rect.minY },
        { x: rect.maxX, y: rect.maxY },
      )
    }
  }
  return points.length ? pointsToRectBounds(points) : null
}

export const clamp01 = (value: number): number => Math.max(0, Math.min(1, value))

function cloneDrawingState(state: PdfDrawingState): PdfDrawingState {
  return {
    ...state,
    transform: [...state.transform],
    dash: [...state.dash],
    strokeColor: [...state.strokeColor],
    fillColor: [...state.fillColor],
    ...(state.clipRect ? { clipRect: { ...state.clipRect } } : {}),
  }
}

function clipRectFromPath(
  segments: readonly PdfPathSegment[],
  matrix: PdfMatrix,
  rule: PdfClipRule,
): PdfRectBounds | null {
  if (rule !== 'nonzero' && rule !== 'evenodd') return null
  const rects = segments.flatMap(segment => segment.type === 'rect' ? [segment] : [])
  if (rects.length !== 1 || rects.length !== segments.length) return null
  const rect = rects[0]
  return transformRectBounds({
    minX: Math.min(rect.x, rect.x + rect.width),
    minY: Math.min(rect.y, rect.y + rect.height),
    maxX: Math.max(rect.x, rect.x + rect.width),
    maxY: Math.max(rect.y, rect.y + rect.height),
  }, matrix)
}

function pointsToRectBounds(points: ReadonlyArray<{ x: number; y: number }>): PdfRectBounds {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const point of points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }
  return { minX, minY, maxX, maxY }
}

function intersectRectBounds(left: PdfRectBounds | undefined, right: PdfRectBounds): PdfRectBounds {
  if (!left) return right
  return {
    minX: Math.max(left.minX, right.minX),
    minY: Math.max(left.minY, right.minY),
    maxX: Math.min(left.maxX, right.maxX),
    maxY: Math.min(left.maxY, right.maxY),
  }
}
