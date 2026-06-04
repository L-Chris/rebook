import { describe, expect, it } from 'vitest'
import type { Book } from '../../src/core/types'
import type { Renderer } from '../../src/core/renderer'
import { ReaderSession } from '../../src/core/reader'
import {
    estimateBookPageCount,
    estimateTrialLimitState,
    withTrialLimit,
    type TrialLimitedBook,
} from '../../src/plugins/trial-limit'

const sectionFractions = [0, 0.2, 0.7, 1]

const createNoopRenderer = (overrides: Partial<Renderer> = {}): Renderer => ({
    open: async () => {},
    goTo: async () => {},
    next: async () => {},
    prev: async () => {},
    goToFraction: async () => {},
    setStyles: () => {},
    setLayout: () => {},
    setSpread: () => {},
    getLocation: () => ({ index: 1, fraction: 0.2 }),
    getSectionFractions: () => sectionFractions,
    refresh: async () => {},
    on: () => {},
    off: () => {},
    destroy: () => {},
    ...overrides,
})

const makeBook = (): Book => ({
    metadata: {},
    sections: [
        {
            id: 'OEBPS/Text/cover.xhtml',
            format: 'xhtml',
            size: 3000,
            load: async () => '',
            getBlocks: async () => [{
                id: 'cover',
                type: 'paragraph',
                segments: [{ text: '汉'.repeat(1000) }],
            }],
        },
        {
            id: 'OEBPS/Text/chapter-1.xhtml',
            format: 'xhtml',
            size: 3000,
            load: async () => '',
            getBlocks: async () => [{
                id: 'chapter-1',
                type: 'paragraph',
                segments: [{ text: '字'.repeat(1000) }],
            }],
        },
        {
            id: 'OEBPS/Text/chapter-2.xhtml',
            format: 'xhtml',
            size: 3000,
            load: async () => '',
            getBlocks: async () => [{
                id: 'chapter-2',
                type: 'paragraph',
                segments: [{ text: '文'.repeat(1000) }],
            }],
        },
    ],
    toc: [
        { label: 'Cover', href: 'Text/cover.xhtml' },
        {
            label: 'Part One',
            href: 'Text/chapter-1.xhtml#start',
            subitems: [
                { label: 'Chapter One Note', href: 'Text/chapter-1.xhtml#note' },
                { label: 'Chapter Two', href: 'Text/chapter-2.xhtml' },
            ],
        },
    ],
    resolveHref: (href: string) => {
        if (href === 'Text/chapter-1.xhtml#start') return { index: 1 }
        if (href === 'Text/chapter-1.xhtml#note') return { index: 1 }
        return null
    },
})

describe('Trial limit plugin', () => {
    it('uses sampled text density for more precise reflowable page estimates', async () => {
        const result = await estimateBookPageCount(makeBook(), {
            sampleSections: 1,
            estimatedTextUnitsPerPage: 500,
        })

        expect(result).toEqual({
            pageCount: 6,
            estimatedBy: 'sampled-text',
        })
    })

    it('trusts explicit page lists and pre-paginated sections when available', async () => {
        expect(await estimateBookPageCount({
            ...makeBook(),
            pageList: Array.from({ length: 42 }, (_, index) => ({
                label: String(index + 1),
                href: `page-${index + 1}.xhtml`,
            })),
        })).toEqual({ pageCount: 42, estimatedBy: 'page-list' })

        expect(await estimateBookPageCount({
            ...makeBook(),
            rendition: { layout: 'pre-paginated' },
            sections: [
                ...makeBook().sections,
                { id: 'nav', size: 10, linear: 'no', load: async () => '' },
            ],
        })).toEqual({ pageCount: 3, estimatedBy: 'pre-paginated-sections' })
    })

    it('adds a trialLimit controller to the book', async () => {
        const plugin = withTrialLimit({
            maxPages: 2,
            sampleSections: 1,
            estimatedTextUnitsPerPage: 500,
        })
        const book = await plugin(makeBook()) as TrialLimitedBook

        expect(book.trialLimit.state).toMatchObject({
            maxPages: 2,
            estimatedPageCount: 6,
            limitFraction: 1 / 3,
            pageStepFraction: 1 / 6,
            estimatedBy: 'sampled-text',
        })

        const items = book.trialLimit.getTOCItems(sectionFractions)
        expect(items.map(item => ({
            label: item.label,
            depth: item.depth,
            parentHrefs: item.parentHrefs,
            hasChildren: item.hasChildren,
            sectionIndex: item.sectionIndex,
            disabled: item.disabled,
        }))).toEqual([
            { label: 'Cover', depth: 0, parentHrefs: [], hasChildren: false, sectionIndex: 0, disabled: false },
            { label: 'Part One', depth: 0, parentHrefs: [], hasChildren: true, sectionIndex: 1, disabled: false },
            {
                label: 'Chapter One Note',
                depth: 1,
                parentHrefs: ['Text/chapter-1.xhtml#start'],
                hasChildren: false,
                sectionIndex: 1,
                disabled: false,
            },
            {
                label: 'Chapter Two',
                depth: 1,
                parentHrefs: ['Text/chapter-1.xhtml#start'],
                hasChildren: false,
                sectionIndex: 2,
                disabled: true,
            },
        ])
        expect(book.trialLimit.getAllowedTOCHrefs(sectionFractions)).toEqual([
            'Text/cover.xhtml',
            'Text/chapter-1.xhtml',
            'Text/chapter-1.xhtml',
        ])
        expect(book.trialLimit.canGoTo('Text/chapter-2.xhtml', sectionFractions)).toBe(false)
        expect(book.trialLimit.getCurrentTOCItem(items, { index: 2, fraction: 0 })?.label).toBe('Chapter Two')
        expect(book.trialLimit.getCurrentTOCItem(items, {
            index: 1,
            tocItem: { label: 'Chapter One Note', href: 'Text/chapter-1.xhtml#note' },
        })?.label).toBe('Chapter One Note')
        expect(book.trialLimit.getNextTotalFraction({
            sectionIndex: 1,
            sectionCount: 3,
            pageIndex: 0,
            pageCount: 3,
            fraction: 0,
        }, sectionFractions)).toBeCloseTo(0.45)
        expect(book.trialLimit.canGoNext({ index: 1, fraction: 0.2 }, sectionFractions)).toBe(false)
    })

    it('exposes reader-level trial navigation helpers', async () => {
        let nextCalls = 0
        const goToTargets: Array<string | number> = []
        const reader = new ReaderSession({
            createRenderer: () => createNoopRenderer({
                goTo: async target => { goToTargets.push(target) },
                next: async () => { nextCalls++ },
            }),
            plugins: [withTrialLimit({
                maxPages: 2,
                sampleSections: 1,
                estimatedTextUnitsPerPage: 500,
            })],
        })

        expect(reader.canGoTo('Text/chapter-2.xhtml')).toBe(true)
        expect(reader.canGoNext()).toBe(true)

        await reader.openBook(makeBook())

        expect(reader.getTrialLimit()).toBeDefined()
        expect(reader.canGoTo('Text/chapter-1.xhtml')).toBe(true)
        expect(reader.canGoTo('Text/chapter-2.xhtml')).toBe(false)
        expect(reader.canGoNext()).toBe(false)
        expect(reader.getAllowedTOCHrefs()).toEqual([
            'Text/cover.xhtml',
            'Text/chapter-1.xhtml',
            'Text/chapter-1.xhtml',
        ])
        expect(reader.getTrialTOCItems().at(-1)?.disabled).toBe(true)
        expect(reader.getCurrentTrialTOCItem()?.label).toBe('Part One')
        expect(reader.getTOCViewItems().map(item => ({
            label: item.label,
            depth: item.depth,
            active: item.active,
            disabled: item.disabled,
        }))).toEqual([
            { label: 'Cover', depth: 0, active: false, disabled: false },
            { label: 'Part One', depth: 0, active: true, disabled: false },
            { label: 'Chapter One Note', depth: 1, active: false, disabled: false },
            { label: 'Chapter Two', depth: 1, active: false, disabled: true },
        ])
        expect(reader.getTOCViewItems({
            location: {
                index: 1,
                fraction: 0,
                tocItem: { label: 'Chapter One Note', href: 'Text/chapter-1.xhtml#note' },
            },
        }).map(item => ({ label: item.label, active: item.active }))).toEqual([
            { label: 'Cover', active: false },
            { label: 'Part One', active: false },
            { label: 'Chapter One Note', active: true },
            { label: 'Chapter Two', active: false },
        ])

        await reader.next()
        await reader.goTo('Text/chapter-2.xhtml')
        expect(nextCalls).toBe(0)
        expect(goToTargets).toEqual([])

        await reader.goTo('Text/chapter-1.xhtml')
        expect(goToTargets).toEqual(['Text/chapter-1.xhtml'])

        reader.destroy()
    })

    it('leaves trial access unrestricted when maxPages is not set', async () => {
        const state = await estimateTrialLimitState(makeBook(), { estimatedTextUnitsPerPage: 500 })

        expect(state.limitFraction).toBe(1)
        expect(state.pageStepFraction).toBe(1)
    })
})
