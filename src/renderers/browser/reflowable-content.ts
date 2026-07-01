import type { ContentRenderer } from '../../core/page-surface'
import type { LayoutMode, RendererStyles } from '../../core/renderer'
import { parseCSSPixels } from '../../core/renderer-utils'
import type { Rect } from '../../core/location'
import { createReflowableBlockTextProvider } from '../../core/reflowable-text-provider'
import {
    getReflowableColumnIndexForLeft,
    getReflowableColumnInlinePadding,
    getRenderedReflowableLinePosition,
    type ReflowableColumnLayout,
} from '../../core/reflowable-page-model'
import {
    getVisibleLines,
    type LineRange,
    type PreparedText,
    type PreparedTextBlock,
    type TextSegment,
    type TextImage,
    type TextBlock,
    type TextStyle,
    type TextTable,
} from '../../core/pretext'
import type { BrowserPageSurface, BrowserPageSurfaceLayer } from './compositor'

const REBOOK_ROLE_ATTR = 'data-rebook-role'
const INLINE_TEXT_STYLE_KEYS = [
    'fontFamily',
    'fontSize',
    'fontWeight',
    'fontStyle',
    'fontVariant',
    'color',
    'textDecoration',
    'verticalAlign',
    'letterSpacing',
] as const satisfies readonly (keyof TextStyle)[]

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
        content.dataset.rebookColumns = String(context.layout.columns)
        content.dataset.rebookColumnHeight = String(context.layout.columnHeight)
        content.dataset.rebookPageHeight = String(context.layout.pageHeight)
        content.dataset.rebookPagePaddingBlockStart = String(context.layout.pagePaddingBlockStart ?? context.layout.pagePaddingBlock)
        content.dataset.rebookPagePaddingBlockEnd = String(context.layout.pagePaddingBlockEnd ?? context.layout.pagePaddingBlock)
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
        const visibleWindow = getVisibleSemanticWindow(context, window.lines)
        const blockRectEstimates = createEstimatedBlockRects(window.lines, context)

        content.appendChild(createSemanticContent(context, visibleWindow))

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
                blocks: visibleWindow.blocks.map(block => block.block),
            },
            textProvider: createReflowableBlockTextProvider({
                sectionIndex: context.sectionIndex,
                getBlockRect: block => getSemanticBlockRect(content, block, blockRectEstimates),
            }, visibleWindow.blocks),
            destroy() {
                for (const layer of layers) layer.destroy?.()
            },
        }
    }

}

export const createBrowserReflowableContentRenderer = (): BrowserReflowableContentRenderer =>
    new BrowserReflowableContentRenderer()

interface VisibleSemanticWindow {
    readonly blocks: readonly PreparedTextBlock[]
    readonly startTop: number
}

function createSemanticContent(
    context: BrowserReflowableContentRenderContext,
    window: VisibleSemanticWindow,
): HTMLElement {
    const viewport = document.createElement('div')
    viewport.dataset.rebookSemanticContent = 'true'
    viewport.style.cssText = `
        position: absolute;
        left: 0;
        top: 0;
        width: ${context.surfaceWidth}px;
        height: ${context.surfaceHeight}px;
        overflow: hidden;
    `

    if (context.layoutMode === 'paginated') {
        viewport.appendChild(createPaginatedSemanticPage(context, window))
    } else {
        viewport.appendChild(createScrolledSemanticFlow(context, window))
    }

    return viewport
}

function createPaginatedSemanticPage(
    context: BrowserReflowableContentRenderContext,
    window: VisibleSemanticWindow,
): HTMLElement {
    const page = document.createElement('div')
    const layout = context.layout
    const pageTop = context.pageIndex * layout.pageHeight
    page.dataset.rebookSemanticPage = 'true'
    page.dataset.pageIndex = String(context.pageIndex)
    page.style.cssText = `
        position: absolute;
        left: 0;
        top: ${pageTop}px;
        width: ${context.surfaceWidth}px;
        height: ${layout.pageHeight}px;
        overflow: hidden;
    `

    const clip = document.createElement('div')
    clip.style.cssText = `
        position: absolute;
        left: 0;
        top: ${layout.pagePaddingBlockStart ?? layout.pagePaddingBlock}px;
        width: ${context.surfaceWidth}px;
        height: ${layout.columnHeight}px;
        overflow: hidden;
    `

    const flow = createSemanticFlow(context, window)
    const columnMetrics = getSemanticColumnMetrics(context)
    const sourceColumnOffset = context.pageIndex * Math.max(1, layout.columns)
    flow.style.position = 'absolute'
    flow.style.left = `${columnMetrics.firstColumnLeft - sourceColumnOffset * columnMetrics.columnStep}px`
    flow.style.top = '0'
    flow.style.width = `${columnMetrics.totalFlowWidth}px`
    flow.style.height = `${layout.columnHeight}px`
    flow.style.columnWidth = `${columnMetrics.contentWidth}px`
    flow.style.columnGap = `${columnMetrics.columnGap}px`
    flow.style.columnFill = 'auto'

    clip.appendChild(flow)
    page.appendChild(clip)
    return page
}

function createScrolledSemanticFlow(
    context: BrowserReflowableContentRenderContext,
    window: VisibleSemanticWindow,
): HTMLElement {
    const flow = createSemanticFlow(context, window)
    const position = { left: 0 }
    flow.style.position = 'absolute'
    flow.style.left = `${getColumnContentLeft(position, context)}px`
    flow.style.top = `${context.layout.pagePaddingBlockStart ?? context.layout.pagePaddingBlock}px`
    flow.style.width = `${getColumnContentWidth(context, position)}px`
    return flow
}

function createSemanticFlow(
    context: BrowserReflowableContentRenderContext,
    window: VisibleSemanticWindow,
): HTMLElement {
    const flow = document.createElement('div')
    flow.dataset.rebookSemanticFlow = 'true'
    flow.style.cssText = `
        box-sizing: border-box;
        font-family: ${context.styles.fontFamily ?? context.baseTextStyle.fontFamily};
        font-size: ${context.baseTextStyle.fontSize}px;
        line-height: ${context.lineHeightPixels}px;
        color: ${context.styles.color ?? 'inherit'};
        overflow-wrap: anywhere;
    `

    if (window.startTop > 0) {
        flow.appendChild(createSemanticFlowSpacer(window.startTop))
    }

    for (const block of window.blocks) {
        flow.appendChild(createSemanticBlock(block, context))
    }

    return flow
}

function createSemanticFlowSpacer(height: number): HTMLElement {
    const spacer = document.createElement('div')
    spacer.dataset.rebookSemanticSpacer = 'true'
    spacer.setAttribute('aria-hidden', 'true')
    spacer.style.cssText = `
        height: ${height}px;
        margin: 0;
        padding: 0;
        pointer-events: none;
        user-select: none;
    `
    return spacer
}

function createSemanticBlock(block: PreparedTextBlock, context: BrowserReflowableContentRenderContext): HTMLElement {
    const source = block.block
    if (source.type === 'image' && source.image) return createSemanticImageBlock(source.image, block, context)
    if (source.type === 'table' && source.table) return createSemanticTableBlock(source.table, block, context)
    if (source.type === 'separator') return createSemanticSeparatorBlock(block)
    if (source.type === 'break') return createSemanticBreakBlock(block, context)
    if (source.type === 'pre') return createSemanticPreBlock(block, context)

    const tagName = getSemanticBlockTagName(source.type, source.depth)
    const element = document.createElement(tagName)
    applySemanticBlockDataset(element, block)
    applySemanticBlockStyle(element, block, context)
    const inheritedTextStyle = getSemanticBlockTextStyle(block, context)

    for (const segment of source.segments) {
        element.appendChild(createSemanticInlineSegment(segment, context, inheritedTextStyle))
    }

    return element
}

function createSemanticInlineSegment(
    segment: TextSegment,
    context: BrowserReflowableContentRenderContext,
    inheritedTextStyle: TextStyle,
): Node {
    if (isInlineImageSegment(segment)) {
        const img = document.createElement('img')
        img.src = segment.source.attrs.src ?? ''
        img.alt = segment.source.attrs.alt ?? ''
        const width = parseCSSPixels(segment.source.attrs['data-rebook-inline-image-width'], 11)
        const height = parseCSSPixels(segment.source.attrs['data-rebook-inline-image-height'], 11)
        const verticalAlign = getInlineImageVerticalAlign(segment)
        img.style.cssText = `
            display: inline-block;
            width: ${width}px;
            height: ${height}px;
            max-width: 100%;
            vertical-align: ${verticalAlign};
            object-fit: contain;
        `
        return img
    }

    if (segment.source?.nodeType === 'br' || segment.text.includes('\n')) {
        return createSemanticLineBreakFragment(segment, context, inheritedTextStyle)
    }

    return createSemanticTextNode(segment.text, { ...context.baseTextStyle, ...segment.style }, inheritedTextStyle)
}

function createSemanticLineBreakFragment(
    segment: TextSegment,
    context: BrowserReflowableContentRenderContext,
    inheritedTextStyle: TextStyle,
): DocumentFragment {
    const fragment = document.createDocumentFragment()
    const parts = segment.text.split('\n')
    parts.forEach((part, index) => {
        if (index > 0) fragment.appendChild(document.createElement('br'))
        if (part) {
            fragment.appendChild(createSemanticTextNode(part, { ...context.baseTextStyle, ...segment.style }, inheritedTextStyle))
        }
    })
    return fragment
}

function createSemanticTextNode(text: string, style: TextStyle, inheritedStyle: TextStyle): Node {
    const delta = getTextStyleDelta(style, inheritedStyle)
    if (Object.keys(delta).length === 0) return document.createTextNode(text)
    return createSemanticTextSpan(text, delta)
}

function createSemanticTextSpan(text: string, style: TextStyle): HTMLSpanElement {
    const span = document.createElement('span')
    span.textContent = text
    applyTextStyle(span, style)
    return span
}

function createSemanticImageBlock(
    image: TextImage,
    block: PreparedTextBlock,
    context: BrowserReflowableContentRenderContext,
): HTMLElement {
    const figure = document.createElement('figure')
    applySemanticBlockDataset(figure, block)
    applySemanticBlockStyle(figure, block, context)
    figure.style.breakInside = 'avoid'
    figure.style.textAlign = getImageTextAlign(image)

    const img = document.createElement('img')
    img.src = image.src
    img.alt = image.alt ?? ''
    if (image.title) img.title = image.title
    const maxHeight = getImageBlockMaxHeight(image, block, context)
    img.style.cssText = `
        display: inline-block;
        width: ${image.width ? `${image.width}px` : 'auto'};
        max-width: 100%;
        max-height: ${maxHeight ? `${maxHeight}px` : 'none'};
        object-fit: ${image.style?.objectFit ?? 'contain'};
    `
    if (image.isCover) figure.dataset.cover = 'true'
    figure.appendChild(img)
    return figure
}

function createSemanticPreBlock(block: PreparedTextBlock, context: BrowserReflowableContentRenderContext): HTMLElement {
    const pre = document.createElement('pre')
    applySemanticBlockDataset(pre, block)
    applySemanticBlockStyle(pre, block, context)
    const fontSize = getBaseFontSize(context)
    pre.style.whiteSpace = 'pre-wrap'
    pre.style.overflowWrap = 'anywhere'
    pre.style.padding = `${fontSize * 0.75}px ${fontSize}px`
    pre.style.background = '#f5f5f5'
    pre.style.border = '1px solid #e0e0e0'
    pre.style.borderRadius = '6px'
    pre.style.breakInside = 'avoid'
    pre.textContent = block.block.segments.map(segment => segment.text).join('')
    return pre
}

function createSemanticSeparatorBlock(block: PreparedTextBlock): HTMLElement {
    const hr = document.createElement('hr')
    applySemanticBlockDataset(hr, block)
    hr.style.cssText = `
        margin: ${block.block.blockGapBefore ?? 0}px 0 ${block.block.blockGapAfter ?? 0}px;
        border: 0;
        border-top: 1px solid currentColor;
        opacity: 0.35;
        break-inside: avoid;
    `
    return hr
}

function createSemanticBreakBlock(block: PreparedTextBlock, context: BrowserReflowableContentRenderContext): HTMLElement {
    const spacer = document.createElement('div')
    applySemanticBlockDataset(spacer, block)
    spacer.setAttribute('aria-hidden', 'true')
    spacer.style.cssText = `
        height: ${context.lineHeightPixels}px;
        margin: ${block.block.blockGapBefore ?? 0}px 0 ${block.block.blockGapAfter ?? 0}px;
    `
    return spacer
}

function createSemanticTableBlock(
    table: TextTable,
    block: PreparedTextBlock,
    context: BrowserReflowableContentRenderContext,
): HTMLElement {
    const tableEl = document.createElement('table')
    applySemanticBlockDataset(tableEl, block)
    applySemanticBlockStyle(tableEl, block, context)
    tableEl.style.width = '100%'
    tableEl.style.borderCollapse = 'collapse'
    tableEl.style.breakInside = 'avoid'
    tableEl.style.tableLayout = 'fixed'

    const colgroup = document.createElement('colgroup')
    const weights = table.columnWeights?.length === table.columnCount
        ? table.columnWeights
        : Array.from({ length: table.columnCount }, () => 1)
    const totalWeight = weights.reduce((sum, weight) => sum + Math.max(0.1, weight), 0)
    for (const weight of weights) {
        const col = document.createElement('col')
        col.style.width = `${Math.max(0.1, weight) / totalWeight * 100}%`
        colgroup.appendChild(col)
    }
    tableEl.appendChild(colgroup)

    const tbody = document.createElement('tbody')
    for (const row of table.rows) {
        const rowEl = document.createElement('tr')
        for (const cell of row.cells) {
            const cellEl = document.createElement(cell.header ? 'th' : 'td')
            cellEl.textContent = cell.text
            if (cell.colspan) cellEl.colSpan = cell.colspan
            if (cell.rowspan) cellEl.rowSpan = cell.rowspan
            cellEl.style.cssText = `
                padding: 4px 6px;
                border: 1px solid #8a8a8a;
                overflow-wrap: anywhere;
                text-align: ${getTableTextAlign(cell.align)};
            `
            rowEl.appendChild(cellEl)
        }
        tbody.appendChild(rowEl)
    }
    tableEl.appendChild(tbody)
    return tableEl
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

function applySemanticBlockDataset(element: HTMLElement, block: PreparedTextBlock): void {
    element.dataset.rebookBlock = 'true'
    element.dataset.blockId = block.block.id
    element.dataset.blockType = block.block.type
}

function applySemanticBlockStyle(
    element: HTMLElement,
    block: PreparedTextBlock,
    context: BrowserReflowableContentRenderContext,
): void {
    const style = block.block.style ?? {}
    const inheritedStyle = getSemanticBlockTextStyle(block, context)
    const fontSize = inheritedStyle.fontSize ?? getBaseFontSize(context)
    const lineHeight = getCSSLineHeight(style.lineHeight, fontSize, context.lineHeightPixels)
    const fallbackGapAfter = getSemanticBlockFallbackGapAfter(block.block.type, context.lineHeightPixels)
    element.style.boxSizing = 'border-box'
    element.style.margin = `${block.block.blockGapBefore ?? 0}px 0 ${block.block.blockGapAfter ?? fallbackGapAfter}px`
    element.style.padding = '0'
    element.style.fontFamily = inheritedStyle.fontFamily ?? 'system-ui, -apple-system, Georgia, serif'
    element.style.fontSize = `${fontSize}px`
    element.style.lineHeight = `${lineHeight}px`
    element.style.textAlign = getTextAlign(style.textAlign)
    element.style.whiteSpace = block.block.type === 'pre' ? 'pre-wrap' : 'normal'
    element.style.overflowWrap = 'anywhere'
    element.style.color = inheritedStyle.color ?? 'inherit'
    if (block.block.type === 'blockquote') {
        const inset = parseBlockquoteInset(block.block.attrs?.width, fontSize) ?? fontSize * 1.5
        element.style.paddingInlineStart = `${inset}px`
        element.style.paddingInlineEnd = '0px'
        element.style.backgroundColor = 'rgba(148, 163, 184, 0.14)'
    }
    if (style.fontWeight) element.style.fontWeight = style.fontWeight
    if (style.fontStyle) element.style.fontStyle = style.fontStyle
    if (style.fontVariant) element.style.fontVariant = style.fontVariant
    if (style.textDecoration) element.style.textDecoration = style.textDecoration
    if (style.letterSpacing) element.style.letterSpacing = `${style.letterSpacing}px`
}

function getSemanticBlockTextStyle(
    block: PreparedTextBlock,
    context: BrowserReflowableContentRenderContext,
): TextStyle {
    const style = block.block.style ?? {}
    return {
        ...context.baseTextStyle,
        ...style,
        fontFamily: style.fontFamily ?? context.styles.fontFamily ?? context.baseTextStyle.fontFamily,
        fontSize: style.fontSize ?? getBaseFontSize(context),
        color: style.color ?? context.styles.color,
    }
}

function getTextStyleDelta(style: TextStyle, inheritedStyle: TextStyle): TextStyle {
    const delta: TextStyle = {}
    for (const key of INLINE_TEXT_STYLE_KEYS) {
        const value = style[key]
        if (value == null || value === inheritedStyle[key]) continue
        ;(delta as Record<string, unknown>)[key] = value
    }
    return delta
}

function getBaseFontSize(context: BrowserReflowableContentRenderContext): number {
    return context.baseTextStyle.fontSize ?? parseCSSPixels(context.styles.fontSize, 16)
}

function getSemanticBlockFallbackGapAfter(type: TextBlock['type'], lineHeightPixels: number): number {
    if (type === 'paragraph' || type === 'heading' || type === 'chapter' || type === 'listItem') {
        return lineHeightPixels * 0.5
    }
    return 0
}

function getSemanticBlockTagName(type: PreparedTextBlock['block']['type'], depth: number | undefined): keyof HTMLElementTagNameMap {
    if (type === 'heading' || type === 'chapter') {
        const level = Math.max(1, Math.min(6, Math.round(depth ?? 1)))
        return `h${level}` as keyof HTMLElementTagNameMap
    }
    if (type === 'blockquote') return 'blockquote'
    if (type === 'listItem') return 'div'
    if (type === 'container') return 'section'
    return 'p'
}

function getSemanticColumnMetrics(context: BrowserReflowableContentRenderContext): {
    contentWidth: number
    columnStep: number
    columnGap: number
    firstColumnLeft: number
    totalFlowWidth: number
} {
    const position = { left: 0 }
    const contentWidth = getColumnContentWidth(context, position)
    const columnStep = context.layout.columnWidth + context.layout.gap
    const columnGap = Math.max(0, columnStep - contentWidth)
    const sourceColumnCount = Math.max(1, context.layout.pageCount * Math.max(1, context.layout.columns))
    return {
        contentWidth,
        columnStep,
        columnGap,
        firstColumnLeft: getColumnContentLeft(position, context),
        totalFlowWidth: sourceColumnCount * contentWidth + Math.max(0, sourceColumnCount - 1) * columnGap,
    }
}

function isInlineImageSegment(segment: { source?: { nodeType?: string; attrs?: Readonly<Record<string, string>> } }): segment is { text: string; style?: TextStyle; source: { nodeType: 'img'; attrs: Readonly<Record<string, string>> } } {
    return segment.source?.nodeType === 'img' && Boolean(segment.source.attrs?.src)
}

function getImageTextAlign(image: TextImage): string {
    if (image.style?.align === 'start') return 'left'
    if (image.style?.align === 'end') return 'right'
    return 'center'
}

function getImageBlockMaxHeight(
    image: TextImage,
    block: PreparedTextBlock,
    context: BrowserReflowableContentRenderContext,
): number | null {
    const styleMaxHeight = image.style?.maxHeight
    const pageMaxHeight = context.layoutMode === 'paginated'
        ? context.layout.columnHeight
            - (block.block.blockGapBefore ?? 0)
            - (block.block.blockGapAfter ?? 0)
        : undefined
    const maxHeight = styleMaxHeight != null && pageMaxHeight != null
        ? Math.min(styleMaxHeight, pageMaxHeight)
        : styleMaxHeight ?? pageMaxHeight
    return maxHeight != null && Number.isFinite(maxHeight) && maxHeight > 0
        ? Math.max(1, maxHeight)
        : null
}

function getInlineImageVerticalAlign(segment: TextSegment): string {
    const attrs = segment.source?.attrs
    if (attrs?.[REBOOK_ROLE_ATTR] === 'noteref') return 'super'
    return attrs?.['data-rebook-inline-image-vertical-align'] ?? 'baseline'
}

function getColumnContentLeft(position: { left: number }, context: BrowserReflowableContentRenderContext): number {
    return position.left + getColumnContentPadding(position, context).start
}

function getColumnContentWidth(context: BrowserReflowableContentRenderContext, position?: { left: number }): number {
    const padding = position
        ? getColumnContentPadding(position, context)
        : getReflowableColumnInlinePadding(context.layout, 0)
    return Math.max(1, context.layout.columnWidth - padding.start - padding.end)
}

function getColumnContentPadding(
    position: { left: number },
    context: BrowserReflowableContentRenderContext,
): { start: number; end: number } {
    return getReflowableColumnInlinePadding(
        context.layout,
        getReflowableColumnIndexForLeft(context.layout, position.left),
    )
}

function getTableTextAlign(align: 'start' | 'center' | 'end' | undefined): string {
    if (align === 'center') return 'center'
    if (align === 'end') return 'right'
    return 'left'
}

function getTextAlign(align: TextStyle['textAlign']): string {
    if (align === 'center') return 'center'
    if (align === 'end') return 'right'
    if (align === 'justify') return 'justify'
    return 'left'
}

function getCSSLineHeight(value: number | undefined, fontSize: number, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
        ? fontSize * value
        : fallback
}

function parseBlockquoteInset(value: string | undefined, fontSize: number): number | undefined {
    if (!value) return undefined
    const match = value.trim().match(/^([\d.]+)(px|pt|em|rem)?$/)
    if (!match) return undefined
    const amount = Number(match[1])
    if (!Number.isFinite(amount) || amount <= 0) return 0
    const unit = match[2] ?? 'px'
    if (unit === 'em' || unit === 'rem') return amount * fontSize
    if (unit === 'pt') return amount * 96 / 72
    return amount
}

function getVisibleSemanticWindow(
    context: BrowserReflowableContentRenderContext,
    lines: readonly LineRange[],
): VisibleSemanticWindow {
    const byId = new Map<string, PreparedTextBlock>()
    for (const block of context.prepared?.blocks ?? []) {
        byId.set(block.block.id, block)
    }
    const blockStartTops = getBlockStartTops(context.lines)

    const output: PreparedTextBlock[] = []
    const seen = new Set<string>()
    let startTop = Number.POSITIVE_INFINITY
    for (const line of lines) {
        const block = line.block
        if (!block || seen.has(block.id)) continue
        seen.add(block.id)
        output.push(byId.get(block.id) ?? lineToPreparedBlock(line, block))
        startTop = Math.min(startTop, blockStartTops.get(block.id) ?? line.top)
    }
    return {
        blocks: output,
        startTop: Number.isFinite(startTop) ? Math.max(0, startTop) : 0,
    }
}

function lineToPreparedBlock(line: LineRange, block: TextBlock): PreparedTextBlock {
    return {
        block,
        itemSegmentIndexes: line.segments.map(segment => segment.segmentIndex),
    }
}

function getBlockStartTops(lines: readonly LineRange[]): Map<string, number> {
    const tops = new Map<string, number>()
    for (const line of lines) {
        const blockId = line.block?.id
        if (!blockId) continue
        const existing = tops.get(blockId)
        if (existing == null || line.top < existing) tops.set(blockId, line.top)
    }
    return tops
}

function createEstimatedBlockRects(
    lines: readonly LineRange[],
    context: BrowserReflowableContentRenderContext,
): Map<string, Rect> {
    const rects = new Map<string, Rect>()
    for (const line of lines) {
        const blockId = line.block?.id
        if (!blockId) continue
        const position = getRenderedReflowableLinePosition(line, context.layout, context.layoutMode)
        const rect: Rect = {
            x: getColumnContentLeft(position, context) + (line.inlineOffset ?? 0),
            y: position.top,
            width: Math.max(1, line.width),
            height: Math.max(1, line.height),
        }
        const existing = rects.get(blockId)
        rects.set(blockId, existing ? unionRect(existing, rect) : rect)
    }
    return rects
}

function getSemanticBlockRect(
    content: HTMLElement,
    block: PreparedTextBlock,
    estimates: ReadonlyMap<string, Rect>,
): Rect | null {
    const element = findSemanticBlockElement(content, block.block.id)
    const rect = element ? getElementRectRelativeToContent(element, content) : null
    return rect ?? estimates.get(block.block.id) ?? null
}

function findSemanticBlockElement(content: HTMLElement, blockId: string): HTMLElement | null {
    const blocks = content.querySelectorAll<HTMLElement>('[data-rebook-block="true"]')
    for (const block of blocks) {
        if (block.dataset.blockId === blockId) return block
    }
    return null
}

function getElementRectRelativeToContent(element: HTMLElement, content: HTMLElement): Rect | null {
    const rect = element.getBoundingClientRect()
    if (rect.width <= 0 && rect.height <= 0) return null
    const origin = content.getBoundingClientRect()
    return {
        x: rect.left - origin.left,
        y: rect.top - origin.top,
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
    }
}

function unionRect(left: Rect, right: Rect): Rect {
    const x = Math.min(left.x, right.x)
    const y = Math.min(left.y, right.y)
    const maxX = Math.max(left.x + left.width, right.x + right.width)
    const maxY = Math.max(left.y + left.height, right.y + right.height)
    return {
        x,
        y,
        width: Math.max(1, maxX - x),
        height: Math.max(1, maxY - y),
    }
}
