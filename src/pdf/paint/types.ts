import { PdfPageDisplayList, PdfPageText, PdfRuntime, PdfTextRun } from '../types'
import type { FixedPageVisualAppearance } from '../../core/fixed-document'

export interface PdfRenderableDocument {
  getPageDisplayList(pageIndex: number): PdfPageDisplayList | Promise<PdfPageDisplayList>
}

export interface PdfRenderContext {
  document: PdfRenderableDocument
  runtime?: PdfRuntime
}

export interface PdfRenderPageOptions {
  pageIndex: number
  scale?: number
  visualAppearance?: FixedPageVisualAppearance
}

export interface PdfPageRenderResult {
  pageIndex: number
  width: number
  height: number
}

export interface PdfRenderer<TTarget, TResult extends PdfPageRenderResult = PdfPageRenderResult> {
  readonly id: string
  readonly platform: string
  renderPage(context: PdfRenderContext, target: TTarget, options: PdfRenderPageOptions): TResult | Promise<TResult>
}

export interface PdfTextSurface {
  beginPage?(page: PdfPageText): void
  textRun(run: PdfTextRun): void
  endPage?(page: PdfPageText): void
}

export interface PdfTextRenderResult extends PdfPageRenderResult {
  text: string
  runs: PdfTextRun[]
}
