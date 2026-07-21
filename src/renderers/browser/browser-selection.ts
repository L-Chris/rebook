import type { BookLocation, BookSelection, Rect } from '../../core/location'
import type { ReaderMark } from '../../core/renderer'
import type { BrowserPageSurface } from './compositor'

type FixedSelectionLocation = Extract<BookLocation, { type: 'fixed' | 'image' }>

export function getBrowserReflowableSelection(
    root: HTMLElement,
    sectionIndex: number,
): BookSelection | null {
    const native = root.ownerDocument.getSelection?.()
    if (!native || native.rangeCount === 0 || native.isCollapsed) return null
    const range = native.getRangeAt(0)
    if (!containsBoundary(root, range.startContainer) || !containsBoundary(root, range.endContainer)) return null

    const startBlock = closestBlock(range.startContainer)
    const endBlock = closestBlock(range.endContainer)
    const startBlockId = startBlock?.dataset.blockId
    const endBlockId = endBlock?.dataset.blockId
    if (!startBlock || !endBlock || !startBlockId || !endBlockId) return null

    const blockIds = Array.from(root.querySelectorAll<HTMLElement>('[data-rebook-block="true"]'))
        .filter(block => safeIntersectsNode(range, block))
        .flatMap(block => block.dataset.blockId ? [block.dataset.blockId] : [])
    const text = native.toString()
    if (!text.trim()) return null

    return {
        range: {
            start: {
                type: 'reflowable',
                sectionIndex,
                blockId: startBlockId,
                offset: getCodePointOffset(startBlock, range.startContainer, range.startOffset),
            },
            end: {
                type: 'reflowable',
                sectionIndex,
                blockId: endBlockId,
                offset: getCodePointOffset(endBlock, range.endContainer, range.endOffset),
            },
        },
        text,
        rects: getClientRects(range),
        blockIds,
    }
}

export function getBrowserFixedSelection(
    root: HTMLElement,
    surface: BrowserPageSurface | null,
): BookSelection | null {
    const native = root.ownerDocument.getSelection?.()
    if (!native || native.rangeCount === 0 || native.isCollapsed || !surface) return null
    const range = native.getRangeAt(0)
    if (!containsBoundary(root, range.startContainer) || !containsBoundary(root, range.endContainer)) return null
    const text = native.toString()
    if (!text.trim()) return null

    const clientRects = getClientRects(range)
    const pageLocations = getFixedPageLocations(root, surface, clientRects)
    if (!pageLocations.length) return null

    return {
        range: {
            start: pageLocations[0]!,
            ...(pageLocations.length > 1 ? { end: pageLocations[pageLocations.length - 1]! } : {}),
        },
        text,
        rects: clientRects,
    }
}

export function clearBrowserSelection(root: HTMLElement): void {
    const selection = root.ownerDocument.getSelection?.()
    if (!selection || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0)
    if (containsBoundary(root, range.startContainer) || containsBoundary(root, range.endContainer)) {
        selection.removeAllRanges()
    }
}

export function getActivatedReaderMark(target: EventTarget | null, marks: readonly ReaderMark[]): ReaderMark | null {
    const element = target && typeof (target as Element).closest === 'function'
        ? (target as Element).closest<HTMLElement>('[data-mark-id], [data-mark-ids]')
        : null
    const markId = element?.dataset.markId ?? element?.dataset.markIds?.split(/\s+/).find(Boolean)
    return markId ? marks.find(mark => mark.id === markId) ?? null : null
}

function getFixedPageLocations(
    root: HTMLElement,
    surface: BrowserPageSurface,
    clientRects: readonly Rect[],
): FixedSelectionLocation[] {
    const spreadFrames = Array.from(root.querySelectorAll<HTMLElement>('[data-rebook-spread-page="true"]'))
    const frames = spreadFrames.length
        ? spreadFrames
        : Array.from(root.querySelectorAll<HTMLElement>('[data-rebook-page-surface="true"]'))
    const format = surface.location?.type === 'fixed' ? surface.location.format : undefined
    const type: 'fixed' | 'image' = surface.location?.type === 'image' || format === 'cbz' ? 'image' : 'fixed'
    const output: FixedSelectionLocation[] = []

    for (const frame of frames) {
        const pageIndex = Number(frame.dataset.pageIndex)
        if (!Number.isInteger(pageIndex)) continue
        const bounds = frame.getBoundingClientRect()
        const textLayer = frame.querySelector<HTMLElement>('[data-rebook-fixed-text-layer="true"]')
        const scale = textLayer && textLayer.offsetWidth > 0
            ? textLayer.getBoundingClientRect().width / textLayer.offsetWidth
            : 1
        const rects = clientRects
            .filter(rect => intersects(bounds, rect))
            .map(rect => ({
                x: Math.max(0, rect.x - bounds.left) / Math.max(scale, 0.0001),
                y: Math.max(0, rect.y - bounds.top) / Math.max(scale, 0.0001),
                width: rect.width / Math.max(scale, 0.0001),
                height: rect.height / Math.max(scale, 0.0001),
            }))
        if (!rects.length) continue
        output.push(type === 'fixed'
            ? { type, format, pageIndex, rects }
            : { type, pageIndex, rects })
    }

    if (!output.length && surface.pageIndex !== undefined && clientRects.length) {
        const frame = root.querySelector<HTMLElement>('[data-rebook-page-surface="true"]')
        const bounds = frame?.getBoundingClientRect()
        if (bounds) {
            const rects = clientRects.map(rect => ({
                x: Math.max(0, rect.x - bounds.left) / Math.max(surface.scale, 0.0001),
                y: Math.max(0, rect.y - bounds.top) / Math.max(surface.scale, 0.0001),
                width: rect.width / Math.max(surface.scale, 0.0001),
                height: rect.height / Math.max(surface.scale, 0.0001),
            }))
            output.push(type === 'fixed'
                ? { type, format, pageIndex: surface.pageIndex, rects }
                : { type, pageIndex: surface.pageIndex, rects })
        }
    }
    return output.sort((left, right) => left.pageIndex - right.pageIndex)
}

function getClientRects(range: Range): Rect[] {
    return Array.from(range.getClientRects())
        .filter(rect => rect.width > 0 && rect.height > 0)
        .map(rect => ({ x: rect.left, y: rect.top, width: rect.width, height: rect.height }))
}

function closestBlock(node: Node): HTMLElement | null {
    const element = node.nodeType === 1 ? node as Element : node.parentElement
    return element?.closest<HTMLElement>('[data-rebook-block="true"]') ?? null
}

function containsBoundary(root: HTMLElement, node: Node): boolean {
    return node === root || root.contains(node)
}

function getCodePointOffset(block: HTMLElement, container: Node, offset: number): number {
    const range = block.ownerDocument.createRange()
    range.selectNodeContents(block)
    try {
        range.setEnd(container, offset)
    } catch {
        return 0
    }
    return Array.from(range.toString()).length
}

function safeIntersectsNode(range: Range, node: Node): boolean {
    try {
        return range.intersectsNode(node)
    } catch {
        return false
    }
}

function intersects(bounds: DOMRect, rect: Rect): boolean {
    return rect.x < bounds.right
        && rect.x + rect.width > bounds.left
        && rect.y < bounds.bottom
        && rect.y + rect.height > bounds.top
}
