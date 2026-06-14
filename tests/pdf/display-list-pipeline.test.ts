import { describe, expect, it } from 'vitest'
import type { PdfDrawingState } from '../../src/pdf/paint/display-list-pipeline'
import { replayPdfDisplayList } from '../../src/pdf/paint/display-list-pipeline'
import type { PdfDisplayOp, PdfPageDisplayList } from '../../src/pdf/types'

describe('PDF display-list pipeline', () => {
  it('replays drawing ops with transform and clip state', async () => {
    const states: PdfDrawingState[] = []
    const ops: PdfDisplayOp[] = [
      { type: 'transform', matrix: [2, 0, 0, 2, 10, 20] },
      { type: 'clip', rule: 'nonzero', segments: [{ type: 'rect', x: 5, y: 6, width: 7, height: 8 }] },
      { type: 'fillColor', color: [0.25, 0.5, 0.75] },
      { type: 'path', paint: 'fill', segments: [{ type: 'rect', x: 0, y: 0, width: 1, height: 1 }] },
    ]

    await replayPdfDisplayList(page(ops), {
      path: (_op, state) => {
        states.push(state)
      },
    })

    expect(states).toHaveLength(1)
    expect(states[0].transform).toEqual([2, 0, 0, 2, 10, 20])
    expect(states[0].fillColor).toEqual([0.25, 0.5, 0.75])
    expect(states[0].clipRect).toEqual({ minX: 20, minY: 32, maxX: 34, maxY: 48 })
  })

  it('restores paint and clip state from the save stack', async () => {
    const colors: Array<readonly [number, number, number]> = []
    const clipped: boolean[] = []
    const ops: PdfDisplayOp[] = [
      { type: 'fillColor', color: [1, 0, 0] },
      { type: 'save' },
      { type: 'fillColor', color: [0, 1, 0] },
      { type: 'clip', rule: 'nonzero', segments: [{ type: 'rect', x: 1, y: 1, width: 2, height: 2 }] },
      { type: 'path', paint: 'fill', segments: [{ type: 'rect', x: 0, y: 0, width: 1, height: 1 }] },
      { type: 'restore' },
      { type: 'path', paint: 'fill', segments: [{ type: 'rect', x: 0, y: 0, width: 1, height: 1 }] },
    ]

    await replayPdfDisplayList(page(ops), {
      path: (_op, state) => {
        colors.push(state.fillColor)
        clipped.push(Boolean(state.clipRect))
      },
    })

    expect(colors).toEqual([[0, 1, 0], [1, 0, 0]])
    expect(clipped).toEqual([true, false])
  })
})

function page(ops: PdfDisplayOp[]): PdfPageDisplayList {
  return {
    pageIndex: 0,
    width: 100,
    height: 120,
    ops,
  }
}
