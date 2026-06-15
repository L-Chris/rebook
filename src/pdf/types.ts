export type PdfPrimitive =
  | null
  | boolean
  | number
  | string
  | PdfName
  | PdfRef
  | PdfPrimitive[]
  | PdfDict
  | PdfStream

export interface PdfName {
  type: 'name'
  value: string
}

export interface PdfRef {
  type: 'ref'
  objectNumber: number
  generation: number
}

export interface PdfDict {
  type: 'dict'
  entries: Map<string, PdfPrimitive>
}

export interface PdfStream {
  type: 'stream'
  dict: PdfDict
  data: Uint8Array
}

export interface PdfObject {
  objectNumber: number
  generation: number
  value: PdfPrimitive
}

export interface PdfPageInfo {
  index: number
  object: PdfObject
  mediaBox: [number, number, number, number]
  cropBox: [number, number, number, number]
  rotate: number
  userUnit: number
  resources?: PdfDict
}

export interface PdfTextRun {
  text: string
  x: number
  y: number
  fontSize: number
  width?: number
  fontName?: string
  fontFamily?: string
  fontWeight?: string
  fontStyle?: 'normal' | 'italic' | 'oblique'
  fontSource?: PdfFontSource
  fillColor?: PdfColor
  strokeColor?: PdfColor
  renderingMode?: PdfTextRenderingMode
}

export interface PdfFontSource {
  id: string
  family: string
  fallbackFamily: string
  data: Uint8Array
  getBrowserData?: () => Uint8Array
  format?: string
  weight?: string
  style?: 'normal' | 'italic' | 'oblique'
}

export type PdfMatrix = [number, number, number, number, number, number]
export type PdfRect = [number, number, number, number]
export type PdfColor = [number, number, number]
export type PdfDeviceColorSpace = 'DeviceRGB' | 'DeviceGray' | 'DeviceCMYK'
export interface PdfIndexedColorSpace {
  type: 'Indexed'
  base: PdfDeviceColorSpace
  highValue: number
  lookup: Uint8Array
}
export type PdfImageColorSpace = PdfDeviceColorSpace | PdfIndexedColorSpace

export interface PdfImageData {
  width: number
  height: number
  bitsPerComponent: number
  colorSpace: PdfImageColorSpace
  imageMask?: boolean
  softMask?: boolean
  data: Uint8ClampedArray
}

export interface PdfDecodedImageData {
  width: number
  height: number
  data: Uint8ClampedArray
}

export interface PdfShadingColorStop {
  offset: number
  color: PdfColor
}

export interface PdfAxialShading {
  type: 'axial'
  coords: [number, number, number, number]
  domain: [number, number]
  extend: [boolean, boolean]
  startColor: PdfColor
  endColor: PdfColor
  colorStops: PdfShadingColorStop[]
}

export interface PdfRadialShading {
  type: 'radial'
  coords: [number, number, number, number, number, number]
  domain: [number, number]
  extend: [boolean, boolean]
  startColor: PdfColor
  endColor: PdfColor
  colorStops: PdfShadingColorStop[]
}

export type PdfShading = PdfAxialShading | PdfRadialShading
export interface PdfShadingPattern {
  type: 'shadingPattern'
  name: string
  matrix: PdfMatrix
  shading: PdfShading
}

export type PdfPathSegment =
  | { type: 'moveTo'; x: number; y: number }
  | { type: 'lineTo'; x: number; y: number }
  | { type: 'curveTo'; x1: number; y1: number; x2: number; y2: number; x3: number; y3: number }
  | { type: 'closePath' }
  | { type: 'rect'; x: number; y: number; width: number; height: number }

export type PdfPathPaint = 'stroke' | 'fill' | 'fillEvenOdd' | 'fillStroke' | 'fillStrokeEvenOdd' | 'none'
export type PdfClipRule = 'nonzero' | 'evenodd'
export type PdfLineCap = 'butt' | 'round' | 'square'
export type PdfLineJoin = 'miter' | 'round' | 'bevel'
export type PdfTextRenderingMode = 'fill' | 'stroke' | 'fillStroke' | 'invisible' | 'fillClip' | 'strokeClip' | 'fillStrokeClip' | 'clip'
export type PdfBlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'colorDodge'
  | 'colorBurn'
  | 'hardLight'
  | 'softLight'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity'

export type PdfDisplayOp =
  | { type: 'save' }
  | { type: 'restore' }
  | { type: 'transform'; matrix: PdfMatrix }
  | { type: 'lineWidth'; width: number }
  | { type: 'lineCap'; cap: PdfLineCap }
  | { type: 'lineJoin'; join: PdfLineJoin }
  | { type: 'miterLimit'; limit: number }
  | { type: 'dash'; pattern: number[]; phase: number }
  | { type: 'strokeAlpha'; alpha: number }
  | { type: 'fillAlpha'; alpha: number }
  | { type: 'blendMode'; mode: PdfBlendMode }
  | { type: 'strokeColor'; color: PdfColor }
  | { type: 'fillColor'; color: PdfColor }
  | { type: 'path'; segments: PdfPathSegment[]; paint: PdfPathPaint; fill?: PdfShadingPattern; stroke?: PdfShadingPattern }
  | { type: 'clip'; segments: PdfPathSegment[]; rule: PdfClipRule }
  | { type: 'shading'; name: string; shading: PdfShading }
  | { type: 'image'; name: string; image: PdfImageData }
  | { type: 'text'; run: PdfTextRun }

export interface PdfPageDisplayList {
  pageIndex: number
  width: number
  height: number
  ops: PdfDisplayOp[]
}

export interface PdfPageText {
  pageIndex: number
  width: number
  height: number
  runs: PdfTextRun[]
  text: string
}

export type PdfDestinationItem = null | number | string | PdfRef
export type PdfDestination = string | PdfDestinationItem[]
export type PdfNamedDestinations = Record<string, PdfDestination>

export interface PdfLinkAnnotation {
  type: 'link'
  rect: PdfRect
  contents?: string
  url?: string
  destination?: PdfDestination
}

export type PdfAnnotation = PdfLinkAnnotation

export interface PdfPageAnnotations {
  pageIndex: number
  width: number
  height: number
  annotations: PdfAnnotation[]
}

export interface PdfOutlineItem {
  title: string
  url?: string
  destination?: PdfDestination
  count?: number
  open?: boolean
  items: PdfOutlineItem[]
}

export type PdfPageLabelStyle = 'D' | 'R' | 'r' | 'A' | 'a'

export interface PdfPageLabelRule {
  index: number
  style?: PdfPageLabelStyle
  prefix?: string
  start: number
}

export type PdfMaybePromise<T> = T | Promise<T>

export interface PdfRuntime {
  platform: string
  decodeFilter?: (name: string, data: Uint8Array, dict: PdfDict) => PdfMaybePromise<Uint8Array>
  decodeImage?: (name: string, data: Uint8Array, dict: PdfDict) => PdfMaybePromise<PdfDecodedImageData>
  now?: () => number
}

export interface PdfLoadOptions {
  runtime?: PdfRuntime
  cache?: boolean
  embeddedFonts?: boolean
  decodeStream?: (name: string, data: Uint8Array, dict: PdfDict) => Uint8Array | Promise<Uint8Array>
}

export class PdfError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PdfError'
  }
}

export const name = (value: string): PdfName => ({ type: 'name', value })

export const isName = (value: PdfPrimitive | undefined, expected?: string): value is PdfName =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value) && value.type === 'name' && (!expected || value.value === expected))

export const isRef = (value: PdfPrimitive | undefined): value is PdfRef =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value) && value.type === 'ref')

export const isDict = (value: PdfPrimitive | undefined): value is PdfDict =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value) && value.type === 'dict')

export const isStream = (value: PdfPrimitive | undefined): value is PdfStream =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value) && value.type === 'stream')
