import { PdfMatrix } from '../types'

export const identityMatrix = (): PdfMatrix => [1, 0, 0, 1, 0, 0]

export const copyMatrix = (matrix: PdfMatrix): PdfMatrix => [...matrix]

export const translateMatrix = (matrix: PdfMatrix, x: number, y: number): PdfMatrix => [
  matrix[0],
  matrix[1],
  matrix[2],
  matrix[3],
  matrix[0] * x + matrix[2] * y + matrix[4],
  matrix[1] * x + matrix[3] * y + matrix[5],
]

export const multiplyMatrix = (left: PdfMatrix, right: PdfMatrix): PdfMatrix => [
  left[0] * right[0] + left[2] * right[1],
  left[1] * right[0] + left[3] * right[1],
  left[0] * right[2] + left[2] * right[3],
  left[1] * right[2] + left[3] * right[3],
  left[0] * right[4] + left[2] * right[5] + left[4],
  left[1] * right[4] + left[3] * right[5] + left[5],
]

export const transformPoint = (x: number, y: number, matrix: PdfMatrix): { x: number; y: number } => ({
  x: matrix[0] * x + matrix[2] * y + matrix[4],
  y: matrix[1] * x + matrix[3] * y + matrix[5],
})

export const isIdentityMatrix = (matrix: PdfMatrix): boolean =>
  matrix[0] === 1 && matrix[1] === 0 && matrix[2] === 0 && matrix[3] === 1 && matrix[4] === 0 && matrix[5] === 0
