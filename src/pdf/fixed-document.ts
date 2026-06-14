import type { FixedDocument } from '../core/fixed-document'
import type { PdfPageDisplayList } from './types'

export interface PdfFixedDocument extends FixedDocument {
  readonly format: 'pdf'
  getPageDisplayList(pageIndex: number): Promise<PdfPageDisplayList> | PdfPageDisplayList
}

export function isPdfFixedDocument(document: FixedDocument): document is PdfFixedDocument {
  return document.format === 'pdf' && typeof (document as Partial<PdfFixedDocument>).getPageDisplayList === 'function'
}
