import type { Book, Section, TextBlock, TextBlockType, TextSegment, TOCItem } from './types'
import { createSectionIndexLookup, flattenTOC, resolveTOCSectionIndex, type SectionIndexLookup } from './toc'

export type ReadableContentUnitKind = 'section' | 'page'
export type ReadableContentBlockType = TextBlockType | 'page'

export interface ReadableContentUnit {
    index: number
    id: string | number
    kind: ReadableContentUnitKind
    title?: string
    href?: string
    sectionIndex?: number
    pageIndex?: number
    size?: number
    linear?: string
    format?: string
}

export interface ReadableContentBlock {
    id?: string
    type: ReadableContentBlockType
    text: string
    sourceBlock?: TextBlock
}

export interface ReadableContent {
    unit: ReadableContentUnit
    text: string
    blocks?: ReadableContentBlock[]
    charCount: number
}

export interface ReadableContentCitation {
    label: string
    href: string
    unitIndex: number
    unitId: string | number
    unitKind: ReadableContentUnitKind
    sectionIndex?: number
    pageIndex?: number
    blockId?: string
    blockType?: string
}

export interface ReadableContentOptions {
    includeBlocks?: boolean
}

interface ReadableContentIndex {
    readonly sections: readonly Section[]
    readonly toc: readonly TOCItem[] | undefined
    readonly units: ReadableContentUnit[]
    readonly sectionLookup: SectionIndexLookup
}

const readableContentIndexCache = new WeakMap<Book, ReadableContentIndex>()

export function getReadableContentUnits(book: Book): ReadableContentUnit[] {
    return getReadableContentIndex(book).units
}

export function getReadableContentIndex(book: Book): ReadableContentIndex {
    const cached = readableContentIndexCache.get(book)
    if (cached && cached.sections === book.sections && cached.toc === book.toc) return cached

    const sectionLookup = createSectionIndexLookup(book)
    const units = book.sections.length > 0
        ? createSectionReadableContentUnits(book, sectionLookup)
        : createFixedReadableContentUnits(book)
    const next: ReadableContentIndex = {
        sections: book.sections,
        toc: book.toc,
        units,
        sectionLookup,
    }
    readableContentIndexCache.set(book, next)
    return next
}

export function getReadableContentUnitCount(book: Book): number {
    if (book.sections.length > 0) return book.sections.length
    return book.fixedDocument?.pageCount ?? 0
}

export function clampReadableContentUnitIndex(book: Book, index: number): number {
    const count = getReadableContentUnitCount(book)
    if (count <= 0) return 0
    return Math.min(count - 1, Math.max(0, Math.floor(index)))
}

export function getReadableContentUnit(book: Book, index: number): ReadableContentUnit | undefined {
    return getReadableContentIndex(book).units[clampReadableContentUnitIndex(book, index)]
}

export function resolveReadableContentUnitIndex(book: Book, href: string): number | undefined {
    if (book.sections.length > 0) {
        const sectionIndex = resolveTOCSectionIndex(book, href, getReadableContentIndex(book).sectionLookup)
        return sectionIndex >= 0 ? sectionIndex : undefined
    }

    const pageIndex = resolveFixedPageIndex(book, href)
    return typeof pageIndex === 'number' ? pageIndex : undefined
}

function createSectionReadableContentUnits(book: Book, sectionLookup: SectionIndexLookup): ReadableContentUnit[] {
    const tocBySection = new Map<number, TOCItem>()
    for (const item of flattenTOC(book.toc)) {
        const sectionIndex = resolveTOCSectionIndex(book, item.href, sectionLookup)
        if (sectionIndex < 0 || tocBySection.has(sectionIndex)) continue
        tocBySection.set(sectionIndex, item)
    }

    return book.sections.map((section, sectionIndex): ReadableContentUnit => {
        const tocItem = tocBySection.get(sectionIndex)
        return {
            index: sectionIndex,
            id: section.id,
            kind: 'section',
            title: tocItem?.label,
            href: tocItem?.href,
            sectionIndex,
            size: section.size,
            linear: section.linear,
            format: section.format,
        }
    })
}

function createFixedReadableContentUnits(book: Book): ReadableContentUnit[] {
    const fixedDocument = book.fixedDocument
    if (!fixedDocument) return []

    const pageTitles = getFixedPageTitles(book)
    const pageList = book.pageList ?? []
    return Array.from({ length: fixedDocument.pageCount }, (_, pageIndex): ReadableContentUnit => {
        const pageItem = pageList[pageIndex]
        const href = pageItem?.href ?? `${fixedDocument.format}:page:${pageIndex}`
        return {
            index: pageIndex,
            id: href,
            kind: 'page',
            title: pageTitles.get(pageIndex) ?? pageItem?.label ?? `Page ${pageIndex + 1}`,
            href,
            pageIndex,
            format: fixedDocument.format,
        }
    })
}

export async function getReadableContent(
    book: Book,
    unitIndex: number,
    options: ReadableContentOptions = {},
): Promise<ReadableContent> {
    const unit = getReadableContentUnit(book, unitIndex)
    if (!unit) {
        return {
            unit: {
                index: 0,
                id: 0,
                kind: 'section',
            },
            text: '',
            charCount: 0,
            blocks: options.includeBlocks ? [] : undefined,
        }
    }

    if (options.includeBlocks) {
        const blocks = await getReadableContentBlocks(book, unit)
        const text = blocks.map(block => block.text).filter(Boolean).join('\n')
        return {
            unit,
            text,
            blocks,
            charCount: text.length,
        }
    }

    const text = await getReadableContentText(book, unit)
    return {
        unit,
        text,
        charCount: text.length,
    }
}

export async function getReadableContentText(book: Book, unitOrIndex: ReadableContentUnit | number): Promise<string> {
    const unit = typeof unitOrIndex === 'number' ? getReadableContentUnit(book, unitOrIndex) : unitOrIndex
    if (!unit) return ''

    if (unit.kind === 'section') {
        const section = book.sections[unit.sectionIndex ?? unit.index]
        return section ? getSectionReadableText(section) : ''
    }

    const pageIndex = unit.pageIndex ?? unit.index
    const layer = await book.fixedDocument?.getPageText?.(pageIndex)
    return normalizeReadableText(layer?.text ?? layer?.runs.map(run => run.text).join('') ?? '')
}

export async function getReadableContentBlocks(book: Book, unitOrIndex: ReadableContentUnit | number): Promise<ReadableContentBlock[]> {
    const unit = typeof unitOrIndex === 'number' ? getReadableContentUnit(book, unitOrIndex) : unitOrIndex
    if (!unit) return []

    if (unit.kind === 'section') {
        const section = book.sections[unit.sectionIndex ?? unit.index]
        if (!section) return []
        return (await getSectionReadableBlocks(section))
            .map(block => ({
                id: block.id,
                type: block.type,
                text: textBlockToReadableText(block),
                sourceBlock: block,
            }))
            .filter(block => block.text)
    }

    const text = await getReadableContentText(book, unit)
    return text ? [{
        type: 'page',
        text,
    }] : []
}

async function getSectionReadableBlocks(section: Section): Promise<TextBlock[]> {
    if (section.getBlocks) return section.getBlocks()
    if (section.getSegments) {
        return [{
            id: `${section.id}-body`,
            type: 'container',
            segments: await section.getSegments(),
        }]
    }
    const text = await getSectionReadableText(section)
    return text ? [{
        id: `${section.id}-body`,
        type: 'paragraph',
        segments: [{ text }],
    }] : []
}

export async function getSectionReadableText(section: Section): Promise<string> {
    if (section.getBlocks) return blocksToReadableText(await section.getBlocks())
    if (section.getSegments) return segmentsToReadableText(await section.getSegments())
    if (section.getDocument) {
        const document = await section.getDocument()
        if (document) return normalizeReadableText(document.getText())
    }
    if (section.loadText) return normalizeReadableText(await section.loadText())
    if (section.format === 'image') return ''
    return htmlToReadableText(await section.load())
}

export function createReadableContentCitation(
    unit: ReadableContentUnit,
    block?: ReadableContentBlock,
): ReadableContentCitation {
    const label = [
        unit.title || (unit.kind === 'page' ? `Page ${unit.index + 1}` : `Section ${unit.index + 1}`),
        unit.kind === 'section' ? block?.id : undefined,
    ].filter(Boolean).join(' · ')
    const href = unit.kind === 'section' && block?.id
        ? `rebook://j/${unit.index}/${encodeURIComponent(block.id)}`
        : `rebook://j/${unit.index}`
    return {
        label,
        href,
        unitIndex: unit.index,
        unitId: unit.id,
        unitKind: unit.kind,
        sectionIndex: unit.sectionIndex,
        pageIndex: unit.pageIndex,
        blockId: unit.kind === 'section' ? block?.id : undefined,
        blockType: unit.kind === 'section' ? block?.type : undefined,
    }
}

function getFixedPageTitles(book: Book): Map<number, string> {
    const titles = new Map<number, string>()
    for (const item of flattenTOC(book.toc ?? [])) {
        const pageIndex = resolveFixedPageIndex(book, item.href)
        if (typeof pageIndex === 'number' && !titles.has(pageIndex)) {
            titles.set(pageIndex, item.label)
        }
    }
    return titles
}

function resolveFixedPageIndex(book: Book, href: string): number | undefined {
    const pageCount = book.fixedDocument?.pageCount ?? 0
    const resolved = book.resolveHref?.(href)
    if (typeof resolved?.index === 'number' && resolved.index >= 0 && resolved.index < pageCount) {
        return resolved.index
    }

    const [id] = book.splitTOCHref?.(href) ?? [href]
    if (typeof id === 'number' && id >= 0 && id < pageCount) return id

    const pageListIndex = book.pageList?.findIndex(item => item.href === href) ?? -1
    if (pageListIndex >= 0) return pageListIndex

    return undefined
}

function blocksToReadableText(blocks: readonly TextBlock[]): string {
    return normalizeReadableText(blocks.map(textBlockToReadableText).filter(Boolean).join('\n'))
}

function textBlockToReadableText(block: TextBlock): string {
    if (block.type === 'image') return normalizeReadableText(block.image?.alt ?? block.image?.title ?? '')
    if (block.type === 'table') return normalizeReadableText(block.table?.rows
        .flatMap(row => row.cells.map(cell => cell.text))
        .join(' ') ?? '')
    return segmentsToReadableText(block.segments)
}

function segmentsToReadableText(segments: readonly TextSegment[]): string {
    return normalizeReadableText(segments
        .filter(segment => segment.source?.nodeType !== 'img')
        .map(segment => segment.text)
        .join(''))
}

function htmlToReadableText(html: string): string {
    return normalizeReadableText(html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'"))
}

function normalizeReadableText(value: string): string {
    return value.replace(/\s+/g, ' ').trim()
}
