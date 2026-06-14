import type { ContentRenderer } from '../../core/page-surface'
import type { LayoutMode, RendererStyles } from '../../core/renderer'
import { parseCSSPixels } from '../../core/renderer-utils'
import { createReflowableTextProvider } from '../../core/reflowable-text-provider'
import {
    getVisibleLines,
    type LineRange,
    type PreparedText,
    type TextImage,
    type TextStyle,
    type TextTable,
} from '../../core/pretext'
import type { BrowserPageSurface, BrowserPageSurfaceLayer } from './compositor'

export interface ReflowableColumnLayout {
    margin: number
    gap: number
    columnWidth: number
    columns: number
    pageHeight: number
    columnHeight: number
    pagePaddingBlock: number
    totalHeight: number
    pageCount: number
}

export interface BrowserReflowableContentRenderContext {
    readonly sectionIndex: number
    readonly pageIndex: number
    readonly layoutMode: LayoutMode
    readonly layout: ReflowableColumnLayout
    readonly lines: readonly LineRange[]
    readonly prepared: PreparedText | null
    readonly styles: RendererStyles
    readonly baseTextStyle: TextStyle
    readonly lineHeightPixels: number
    readonly sourceScrollTop: number
    readonly sourceViewportHeight: number
    readonly surfaceWidth: number
    readonly surfaceHeight: number
}

export class BrowserReflowableContentRenderer implements ContentRenderer<BrowserReflowableContentRenderContext, BrowserPageSurface> {
    readonly id = 'browser-reflowable-content'

    destroy(): void {}

    renderSurface(context: BrowserReflowableContentRenderContext): BrowserPageSurface {
        const content = document.createElement('div')
        content.dataset.rebookReflowableContentLayer = 'true'
        content.style.cssText = `
            position: absolute;
            left: 0;
            top: 0;
            width: ${context.surfaceWidth}px;
            height: ${context.surfaceHeight}px;
        `

        const window = getVisibleLines(
            context.lines,
            context.sourceScrollTop,
            context.sourceViewportHeight,
            4,
        )

        for (const line of window.lines) {
            content.appendChild(this.createLineElement(line, context))
        }

        const layers: BrowserPageSurfaceLayer[] = [{
            id: 'content',
            kind: 'content',
            contentKind: 'dom',
            content,
            zIndex: 0,
            selectable: true,
            pointerEvents: 'auto',
        }]

        return {
            id: `reflowable:${context.sectionIndex}:${context.pageIndex}`,
            kind: 'reflowable-page',
            pageIndex: context.pageIndex,
            width: context.surfaceWidth,
            height: Math.max(1, context.surfaceHeight),
            scale: 1,
            location: {
                type: 'reflowable',
                sectionIndex: context.sectionIndex,
            },
            layers,
            metadata: {
                range: window,
                sectionIndex: context.sectionIndex,
                lines: window.lines,
            },
            textProvider: createReflowableTextProvider({
                sectionIndex: context.sectionIndex,
                getLinePosition: line => getRenderedLinePosition(line, context.layout, context.layoutMode),
            }, window.lines),
            destroy() {
                for (const layer of layers) layer.destroy?.()
            },
        }
    }

    private createLineElement(line: LineRange, context: BrowserReflowableContentRenderContext): HTMLElement {
        const position = getRenderedLinePosition(line, context.layout, context.layoutMode)

        if (line.kind === 'image' && line.image) {
            return createImageLine(line, position, context)
        }
        if (line.kind === 'table' && line.table) {
            return createTableLine(line, position, context)
        }
        if (line.kind === 'separator') {
            return createSeparatorLine(line, position, context)
        }
        if (line.kind === 'pre') {
            return createPreBlock(line, position, context)
        }

        const lineEl = document.createElement('div')
        const inlineOffset = line.inlineOffset ?? 0
        lineEl.style.cssText = `
            position: absolute;
            top: ${position.top}px;
            left: ${position.left + inlineOffset}px;
            width: ${Math.max(1, context.layout.columnWidth - inlineOffset)}px;
            height: ${line.height}px;
            line-height: ${line.height}px;
            white-space: pre;
        `
        const block = line.block ?? context.prepared?.blocks.find(item =>
            item.itemSegmentIndexes.includes(line.start?.segmentIndex ?? -1),
        )?.block
        if (block) {
            lineEl.dataset.blockId = block.id
            lineEl.dataset.blockType = block.type
        }
        lineEl.dataset.rebookLineIndex = String(line.index)

        for (const fragment of line.segments) {
            const span = document.createElement('span')
            if (fragment.gapBefore > 0) span.style.marginLeft = `${fragment.gapBefore}px`
            if (isInlineImageFragment(fragment)) {
                const img = document.createElement('img')
                img.src = fragment.source.attrs.src ?? ''
                img.alt = fragment.source.attrs.alt ?? ''
                img.style.cssText = `
                    display: inline-block;
                    width: ${parseCSSPixels(fragment.source.attrs['data-rebook-inline-image-width'], 11)}px;
                    height: ${parseCSSPixels(fragment.source.attrs['data-rebook-inline-image-height'], 11)}px;
                    max-width: 1em;
                    max-height: 1em;
                    vertical-align: super;
                    object-fit: contain;
                `
                span.appendChild(img)
            } else {
                span.textContent = fragment.text
                applyTextStyle(span, { ...context.baseTextStyle, ...fragment.style })
            }
            lineEl.appendChild(span)
        }

        return lineEl
    }
}

export const createBrowserReflowableContentRenderer = (): BrowserReflowableContentRenderer =>
    new BrowserReflowableContentRenderer()

function createImageLine(
    line: LineRange,
    position: { top: number; left: number },
    context: BrowserReflowableContentRenderContext,
): HTMLElement {
    const image = line.image!
    const imageLeft = getImageLeft(image, position.left, line.width, context.layout.columnWidth)
    const wrapper = document.createElement('figure')
    wrapper.style.cssText = `
        position: absolute;
        top: ${position.top}px;
        left: ${imageLeft}px;
        width: ${line.width}px;
        height: ${line.height}px;
        margin: 0;
        overflow: hidden;
    `
    if (line.block) {
        wrapper.dataset.blockId = line.block.id
        wrapper.dataset.blockType = line.block.type
    }
    wrapper.dataset.rebookLineIndex = String(line.index)
    if (image.isCover) wrapper.dataset.cover = 'true'

    const img = document.createElement('img')
    img.src = image.src
    img.alt = image.alt ?? ''
    if (image.title) img.title = image.title
    img.style.cssText = `
        display: block;
        width: 100%;
        height: auto;
        max-height: ${line.height}px;
        object-fit: ${image.style?.objectFit ?? 'contain'};
    `
    wrapper.appendChild(img)
    return wrapper
}

function createPreBlock(
    line: LineRange,
    position: { top: number; left: number },
    context: BrowserReflowableContentRenderContext,
): HTMLElement {
    const block = line.block!
    const preStyle = block.style ?? {}
    const fontSize = preStyle.fontSize ?? context.layout.columnWidth * 0.04
    const inlineOffset = line.inlineOffset ?? 0
    const preWidth = Math.max(1, context.layout.columnWidth - inlineOffset)

    const wrapper = document.createElement('pre')
    wrapper.style.cssText = `
        position: absolute;
        top: ${position.top}px;
        left: ${position.left + inlineOffset}px;
        width: ${preWidth}px;
        height: ${line.height}px;
        margin: 0;
        padding: ${fontSize * 0.75}px ${fontSize}px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: ${fontSize}px;
        line-height: 1.55;
        white-space: pre;
        overflow: auto;
        background: #f5f5f5;
        border-radius: 6px;
        border: 1px solid #e0e0e0;
        color: #333;
        box-sizing: border-box;
    `
    if (block) {
        wrapper.dataset.blockId = block.id
        wrapper.dataset.blockType = block.type
    }
    wrapper.dataset.rebookLineIndex = String(line.index)

    const hasVariedStyles = line.segments.some((seg, i) => {
        if (i === 0) return false
        return seg.style?.fontFamily !== line.segments[i - 1]?.style?.fontFamily
            || seg.style?.fontWeight !== line.segments[i - 1]?.style?.fontWeight
            || seg.style?.fontStyle !== line.segments[i - 1]?.style?.fontStyle
            || seg.style?.color !== line.segments[i - 1]?.style?.color
    })

    if (hasVariedStyles && line.segments.length > 0) {
        let currentStyle: TextStyle | null = null
        let currentText = ''
        const flush = () => {
            if (currentText) {
                if (currentStyle) {
                    const span = document.createElement('span')
                    if (currentStyle.fontWeight) span.style.fontWeight = currentStyle.fontWeight
                    if (currentStyle.fontStyle) span.style.fontStyle = currentStyle.fontStyle
                    if (currentStyle.color) span.style.color = currentStyle.color
                    if (currentStyle.fontFamily) span.style.fontFamily = currentStyle.fontFamily
                    span.textContent = currentText
                    wrapper.appendChild(span)
                } else {
                    wrapper.appendChild(document.createTextNode(currentText))
                }
                currentText = ''
            }
        }
        for (const seg of line.segments) {
            const segKey = seg.style ? `${seg.style.fontWeight}-${seg.style.fontStyle}-${seg.style.color}-${seg.style.fontFamily}` : 'none'
            const prevKey = currentStyle ? `${currentStyle.fontWeight}-${currentStyle.fontStyle}-${currentStyle.color}-${currentStyle.fontFamily}` : 'none'
            if (segKey !== prevKey) {
                flush()
                currentStyle = seg.style ?? null
            }
            currentText += seg.text
        }
        flush()
    } else {
        wrapper.textContent = line.text
    }

    return wrapper
}

function createSeparatorLine(
    line: LineRange,
    position: { top: number; left: number },
    context: BrowserReflowableContentRenderContext,
): HTMLElement {
    const wrapper = document.createElement('div')
    wrapper.style.cssText = `
        position: absolute;
        top: ${position.top}px;
        left: ${position.left}px;
        width: ${context.layout.columnWidth}px;
        height: ${line.height}px;
        display: flex;
        align-items: center;
    `
    if (line.block) {
        wrapper.dataset.blockId = line.block.id
        wrapper.dataset.blockType = line.block.type
    }
    wrapper.dataset.rebookLineIndex = String(line.index)

    const rule = document.createElement('div')
    rule.style.cssText = `
        width: 100%;
        border-top: 1px solid currentColor;
        opacity: 0.35;
    `
    wrapper.appendChild(rule)
    return wrapper
}

function createTableLine(
    line: LineRange,
    position: { top: number; left: number },
    context: BrowserReflowableContentRenderContext,
): HTMLElement {
    const table = line.table!
    const wrapper = document.createElement('div')
    wrapper.style.cssText = `
        position: absolute;
        top: ${position.top}px;
        left: ${position.left}px;
        width: ${context.layout.columnWidth}px;
        height: ${line.height}px;
        overflow: hidden;
        font-family: ${context.styles.fontFamily ?? 'system-ui, -apple-system, Georgia, serif'};
        font-size: ${parseCSSPixels(context.styles.fontSize, 16)}px;
        line-height: ${context.lineHeightPixels}px;
        color: ${context.styles.color ?? 'inherit'};
    `
    wrapper.dataset.blockId = line.block?.id ?? `table-row-${table.rowIndex}`
    wrapper.dataset.blockType = 'table'
    wrapper.dataset.rebookLineIndex = String(line.index)
    wrapper.setAttribute('role', 'row')

    const row = document.createElement('div')
    row.style.cssText = `
        display: grid;
        grid-template-columns: ${getTableGridTemplate(table)};
        width: 100%;
        min-height: 100%;
        border-top: ${table.rowIndex === 0 ? '1px solid #8a8a8a' : '0'};
        border-left: 1px solid #8a8a8a;
        background: #fff;
    `

    for (const cell of table.rows[0]?.cells ?? []) {
        const cellEl = document.createElement(cell.header ? 'strong' : 'span')
        cellEl.textContent = cell.text
        cellEl.style.cssText = `
            display: block;
            min-width: 0;
            padding: 4px 6px;
            border-right: 1px solid #8a8a8a;
            border-bottom: 1px solid #8a8a8a;
            white-space: normal;
            overflow-wrap: anywhere;
            text-align: ${getTableTextAlign(cell.align)};
            ${cell.colspan ? `grid-column: span ${cell.colspan};` : ''}
        `
        row.appendChild(cellEl)
    }

    wrapper.appendChild(row)
    return wrapper
}

function getRenderedLinePosition(
    line: LineRange,
    layout: ReflowableColumnLayout,
    layoutMode: LayoutMode,
): { top: number; left: number } {
    const { columns, pageHeight, columnHeight, columnWidth, gap, pagePaddingBlock } = layout
    if (layoutMode !== 'paginated') return { top: line.top + pagePaddingBlock, left: 0 }

    const sourceColumn = Math.floor(line.top / columnHeight)
    const row = Math.floor(sourceColumn / columns)
    const column = sourceColumn % columns
    return {
        top: row * pageHeight + pagePaddingBlock + (line.top % columnHeight),
        left: column * (columnWidth + gap),
    }
}

function applyTextStyle(element: HTMLElement, style: TextStyle): void {
    if (style.fontFamily) element.style.fontFamily = style.fontFamily
    if (style.fontSize) element.style.fontSize = `${style.fontSize}px`
    if (style.fontWeight) element.style.fontWeight = style.fontWeight
    if (style.fontStyle) element.style.fontStyle = style.fontStyle
    if (style.fontVariant) element.style.fontVariant = style.fontVariant
    if (style.color) element.style.color = style.color
    if (style.textDecoration) element.style.textDecoration = style.textDecoration
    if (style.verticalAlign) element.style.verticalAlign = style.verticalAlign
    if (style.letterSpacing) element.style.letterSpacing = `${style.letterSpacing}px`
}

function isInlineImageFragment(fragment: { source?: { nodeType?: string; attrs?: Readonly<Record<string, string>> } }): fragment is { source: { nodeType: 'img'; attrs: Readonly<Record<string, string>> } } {
    return fragment.source?.nodeType === 'img' && Boolean(fragment.source.attrs?.src)
}

function getImageLeft(image: TextImage, columnLeft: number, imageWidth: number, columnWidth: number): number {
    if (image.style?.align === 'start') return columnLeft
    if (image.style?.align === 'end') return columnLeft + columnWidth - imageWidth
    return columnLeft + (columnWidth - imageWidth) / 2
}

function getTableGridTemplate(table: TextTable): string {
    const weights = table.columnWeights?.length === table.columnCount
        ? table.columnWeights
        : Array.from({ length: table.columnCount }, () => 1)
    return weights.map(weight => `minmax(0, ${Math.max(0.1, weight)}fr)`).join(' ')
}

function getTableTextAlign(align: 'start' | 'center' | 'end' | undefined): string {
    if (align === 'center') return 'center'
    if (align === 'end') return 'right'
    return 'left'
}
