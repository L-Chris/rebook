/**
 * Progress tracking utilities.
 * Calculates reading progress at section, TOC, and page levels.
 */

import type { Section, TOCItem } from '../core/types'

// ============================================================================
// Section Progress
// ============================================================================

/**
 * Tracks overall reading progress based on section byte sizes.
 */
export class SectionProgress {
    private sizes: number[]
    private sizePerLoc: number
    private sizeTotal: number
    private sectionFractions: number[]

    constructor(sections: Section[], sizePerLoc = 1500) {
        this.sizes = sections.map(s => s.linear !== 'no' && s.size > 0 ? s.size : 0)
        this.sizePerLoc = sizePerLoc
        this.sizeTotal = this.sizes.reduce((a, b) => a + b, 0)
        this.sectionFractions = this.calcSectionFractions()
    }

    private calcSectionFractions(): number[] {
        const results = [0]
        let sum = 0
        for (const size of this.sizes) {
            results.push((sum += size) / this.sizeTotal)
        }
        return results
    }

    /**
     * Get progress info given section index and fraction within section.
     */
    getProgress(index: number, fractionInSection: number) {
        const { sizes, sizePerLoc, sizeTotal } = this
        const sizeInSection = sizes[index] ?? 0
        const sizeBefore = sizes.slice(0, index).reduce((a, b) => a + b, 0)
        const size = sizeBefore + fractionInSection * sizeInSection
        const remaining = sizeTotal - size

        return {
            fraction: sizeTotal > 0 ? size / sizeTotal : 0,
            section: {
                current: index,
                total: sizes.length,
            },
            location: {
                current: Math.floor(size / sizePerLoc),
                total: Math.ceil(sizeTotal / sizePerLoc),
            },
            remaining: {
                section: (1 - fractionInSection) * sizeInSection,
                total: remaining,
            },
        }
    }

    /**
     * Get section index and fraction from total fraction (inverse of getProgress).
     */
    getSection(fraction: number): [index: number, fractionInSection: number] {
        if (fraction <= 0) return [0, 0]
        if (fraction >= 1) return [this.sizes.length - 1, 1]

        fraction = fraction + Number.EPSILON
        let index = this.sectionFractions.findIndex(x => x > fraction) - 1
        if (index < 0) return [0, 0]
        while (!this.sizes[index]) index++

        const fractionInSection = (fraction - this.sectionFractions[index])
            / (this.sizes[index] / this.sizeTotal)
        return [index, fractionInSection]
    }

    /**
     * Get section boundary fractions (for progress bar tick marks).
     */
    getFractions(): number[] {
        return this.sectionFractions.map(x => x + Number.EPSILON)
    }
}

// ============================================================================
// TOC Progress
// ============================================================================

/**
 * Assign unique IDs to TOC items (depth-first).
 */
function assignIDs(items: TOCItem[], startId = 0): number {
    let id = startId
    for (const item of items) {
        (item as TOCItem & { id: number }).id = id++
        if (item.subitems?.length) {
            id = assignIDs(item.subitems, id)
        }
    }
    return id
}

/**
 * Flatten nested TOC items into a single array.
 */
function flattenTOC(items: TOCItem[]): TOCItem[] {
    return items.flatMap(item =>
        item.subitems?.length
            ? [item, ...flattenTOC(item.subitems)]
            : [item]
    )
}

/**
 * Tracks which TOC item corresponds to the current reading position.
 */
export class TOCProgress {
    private ids: (string | number)[] = []
    private map: Map<string | number, { prev?: TOCItem; items: Array<{ fragment: string | null; item: TOCItem }> }> = new Map()
    private getFragment?: (doc: Document, id: string | number) => Element | null

    async init(options: {
        toc: TOCItem[]
        sectionIds: (string | number)[]
        splitHref: (href: string) => [id: string | number, fragment: string | null] | undefined
        getFragment: (doc: Document, id: string | number) => Element | null
    }): Promise<void> {
        const { toc, sectionIds, splitHref, getFragment } = options

        assignIDs(toc)
        const items = flattenTOC(toc)
        const grouped = new Map<string | number, { prev?: TOCItem; items: Array<{ fragment: string | null; item: TOCItem }> }>()

        for (const [i, item] of items.entries()) {
            const result = splitHref(item.href)
            if (!result) continue
            const [id, fragment] = result
            const value = { fragment, item }
            if (grouped.has(id)) {
                grouped.get(id)!.items.push(value)
            } else {
                grouped.set(id, { prev: items[i - 1], items: [value] })
            }
        }

        const map = new Map<string | number, { prev?: TOCItem; items: Array<{ fragment: string | null; item: TOCItem }> }>()
        for (const [i, id] of sectionIds.entries()) {
            if (grouped.has(id)) {
                map.set(id, grouped.get(id)!)
            } else {
                map.set(id, map.get(sectionIds[i - 1])!)
            }
        }

        this.ids = sectionIds
        this.map = map
        this.getFragment = getFragment
    }

    /**
     * Get the current TOC item for a given section index and visible range.
     */
    getProgress(index: number, range?: Range): TOCItem | null | undefined {
        if (!this.ids.length) return undefined
        const id = this.ids[index]
        const obj = this.map.get(id)
        if (!obj) return null

        const { prev, items } = obj
        if (!items?.length) return prev
        if (!range || (items.length === 1 && !items[0].fragment)) {
            return items[0].item
        }

        const doc = range.startContainer.getRootNode() as Document
        for (const [i, { fragment }] of items.entries()) {
            if (!fragment) continue
            const el = this.getFragment?.(doc, fragment)
            if (!el) continue
            if (range.comparePoint(el, 0) > 0) {
                return items[i - 1]?.item ?? prev
            }
        }
        return items[items.length - 1].item
    }
}
