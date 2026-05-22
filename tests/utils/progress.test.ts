/**
 * Progress utilities unit tests
 */

import { describe, it, expect } from 'vitest'
import { SectionProgress, TOCProgress } from '../../src/utils/progress'
import type { Section, TOCItem } from '../../src/core/types'

// Helper to create mock sections
const createSection = (size: number, linear = 'yes'): Section => ({
    id: `section-${Math.random()}`,
    size,
    linear,
    load: () => Promise.resolve(''),
})

describe('SectionProgress', () => {
    describe('constructor', () => {
        it('should initialize with sections', () => {
            const sections = [
                createSection(1000),
                createSection(2000),
                createSection(3000),
            ]
            const progress = new SectionProgress(sections)
            expect(progress).toBeDefined()
        })

        it('should ignore non-linear sections', () => {
            const sections = [
                createSection(1000),
                createSection(5000, 'no'), // should be ignored
                createSection(2000),
            ]
            const progress = new SectionProgress(sections)
            const result = progress.getProgress(1, 0) // second section (non-linear)

            // Non-linear section should contribute 0 to progress
            expect(result.section.total).toBe(3)
        })

        it('should ignore sections with size 0', () => {
            const sections = [
                createSection(1000),
                createSection(0),
                createSection(2000),
            ]
            const progress = new SectionProgress(sections)
            const fractions = progress.getFractions()

            expect(fractions.length).toBe(4) // 3 sections + initial 0
        })
    })

    describe('getProgress', () => {
        it('should return correct fraction at start', () => {
            const sections = [
                createSection(1000),
                createSection(1000),
            ]
            const progress = new SectionProgress(sections)
            const result = progress.getProgress(0, 0)

            expect(result.fraction).toBe(0)
            expect(result.section.current).toBe(0)
            expect(result.section.total).toBe(2)
        })

        it('should return correct fraction in middle of first section', () => {
            const sections = [
                createSection(1000),
                createSection(1000),
            ]
            const progress = new SectionProgress(sections)
            const result = progress.getProgress(0, 0.5)

            expect(result.fraction).toBe(0.25) // 500 / 2000
        })

        it('should return correct fraction at section boundary', () => {
            const sections = [
                createSection(1000),
                createSection(1000),
            ]
            const progress = new SectionProgress(sections)
            const result = progress.getProgress(1, 0)

            expect(result.fraction).toBe(0.5)
        })

        it('should return 1.0 at end', () => {
            const sections = [
                createSection(1000),
                createSection(1000),
            ]
            const progress = new SectionProgress(sections)
            const result = progress.getProgress(1, 1)

            expect(result.fraction).toBe(1)
        })

        it('should calculate locations', () => {
            const sections = [createSection(3000)] // 3000 bytes
            const progress = new SectionProgress(sections, 1000) // 1000 bytes per location

            const result = progress.getProgress(0, 0.5)
            expect(result.location.current).toBe(1) // 1500 / 1000 = 1
            expect(result.location.total).toBe(3) // 3000 / 1000 = 3
        })

        it('should calculate remaining', () => {
            const sections = [
                createSection(1000),
                createSection(1000),
            ]
            const progress = new SectionProgress(sections)
            const result = progress.getProgress(0, 0.5)

            expect(result.remaining.section).toBe(500) // 50% of 1000
            expect(result.remaining.total).toBe(1500) // 500 + 1000
        })

        it('should handle unequal section sizes', () => {
            const sections = [
                createSection(100),
                createSection(900),
            ]
            const progress = new SectionProgress(sections)

            // End of first section
            const result1 = progress.getProgress(0, 1)
            expect(result1.fraction).toBe(0.1) // 100 / 1000

            // Start of second section
            const result2 = progress.getProgress(1, 0)
            expect(result2.fraction).toBe(0.1)

            // Middle of second section
            const result3 = progress.getProgress(1, 0.5)
            expect(result3.fraction).toBe(0.55) // (100 + 450) / 1000
        })
    })

    describe('getSection', () => {
        it('should return [0, 0] for fraction 0', () => {
            const sections = [createSection(1000), createSection(1000)]
            const progress = new SectionProgress(sections)
            const [index, frac] = progress.getSection(0)

            expect(index).toBe(0)
            expect(frac).toBe(0)
        })

        it('should return last section for fraction 1', () => {
            const sections = [createSection(1000), createSection(1000)]
            const progress = new SectionProgress(sections)
            const [index, frac] = progress.getSection(1)

            expect(index).toBe(1)
            expect(frac).toBe(1)
        })

        it('should return correct section for middle fraction', () => {
            const sections = [createSection(1000), createSection(1000)]
            const progress = new SectionProgress(sections)
            const [index, frac] = progress.getSection(0.25)

            expect(index).toBe(0)
            expect(frac).toBeCloseTo(0.5, 5)
        })

        it('should return second section at 0.75', () => {
            const sections = [createSection(1000), createSection(1000)]
            const progress = new SectionProgress(sections)
            const [index, frac] = progress.getSection(0.75)

            expect(index).toBe(1)
            expect(frac).toBeCloseTo(0.5, 5)
        })

        it('should handle negative fraction', () => {
            const sections = [createSection(1000)]
            const progress = new SectionProgress(sections)
            const [index, frac] = progress.getSection(-0.5)

            expect(index).toBe(0)
            expect(frac).toBe(0)
        })

        it('should handle fraction > 1', () => {
            const sections = [createSection(1000)]
            const progress = new SectionProgress(sections)
            const [index, frac] = progress.getSection(1.5)

            expect(index).toBe(0)
            expect(frac).toBe(1)
        })
    })

    describe('getFractions', () => {
        it('should return section boundary fractions', () => {
            const sections = [
                createSection(1000),
                createSection(1000),
                createSection(1000),
            ]
            const progress = new SectionProgress(sections)
            const fractions = progress.getFractions()

            expect(fractions.length).toBe(4)
            expect(fractions[0]).toBeCloseTo(0, 5)
            expect(fractions[1]).toBeCloseTo(1/3, 5)
            expect(fractions[2]).toBeCloseTo(2/3, 5)
            expect(fractions[3]).toBeCloseTo(1, 5)
        })

        it('should handle single section', () => {
            const sections = [createSection(1000)]
            const progress = new SectionProgress(sections)
            const fractions = progress.getFractions()

            expect(fractions.length).toBe(2)
            expect(fractions[0]).toBeCloseTo(0, 5)
            expect(fractions[1]).toBeCloseTo(1, 5)
        })
    })
})

describe('TOCProgress', () => {
    describe('init', () => {
        it('should initialize with TOC items', async () => {
            const toc: TOCItem[] = [
                { label: 'Chapter 1', href: 'ch1.xhtml' },
                { label: 'Chapter 2', href: 'ch2.xhtml' },
            ]

            const progress = new TOCProgress()
            await progress.init({
                toc,
                sectionIds: ['ch1.xhtml', 'ch2.xhtml'],
                splitHref: (href) => {
                    const [path, frag] = href.split('#')
                    return [path, frag ?? null]
                },
                getFragment: () => null,
            })

            expect(progress).toBeDefined()
        })

        it('should handle nested TOC', async () => {
            const toc: TOCItem[] = [
                {
                    label: 'Part 1',
                    href: 'part1.xhtml',
                    subitems: [
                        { label: 'Chapter 1', href: 'ch1.xhtml' },
                        { label: 'Chapter 2', href: 'ch2.xhtml' },
                    ],
                },
            ]

            const progress = new TOCProgress()
            await progress.init({
                toc,
                sectionIds: ['part1.xhtml', 'ch1.xhtml', 'ch2.xhtml'],
                splitHref: (href) => {
                    const [path, frag] = href.split('#')
                    return [path, frag ?? null]
                },
                getFragment: () => null,
            })

            expect(progress).toBeDefined()
        })
    })

    describe('getProgress', () => {
        it('should return undefined before init', () => {
            const progress = new TOCProgress()
            const result = progress.getProgress(0)
            expect(result).toBeUndefined()
        })

        it('should return current TOC item by section index', async () => {
            const toc: TOCItem[] = [
                { label: 'Chapter 1', href: 'ch1.xhtml' },
                { label: 'Chapter 2', href: 'ch2.xhtml' },
                { label: 'Chapter 3', href: 'ch3.xhtml' },
            ]

            const progress = new TOCProgress()
            await progress.init({
                toc,
                sectionIds: ['ch1.xhtml', 'ch2.xhtml', 'ch3.xhtml'],
                splitHref: (href) => {
                    const [path, frag] = href.split('#')
                    return [path, frag ?? null]
                },
                getFragment: () => null,
            })

            expect(progress.getProgress(0)?.label).toBe('Chapter 1')
            expect(progress.getProgress(1)?.label).toBe('Chapter 2')
            expect(progress.getProgress(2)?.label).toBe('Chapter 3')
        })

        it('should return previous TOC item for sections without TOC entry', async () => {
            const toc: TOCItem[] = [
                { label: 'Chapter 1', href: 'ch1.xhtml' },
                { label: 'Chapter 3', href: 'ch3.xhtml' },
            ]

            const progress = new TOCProgress()
            await progress.init({
                toc,
                sectionIds: ['ch1.xhtml', 'ch2.xhtml', 'ch3.xhtml'],
                splitHref: (href) => {
                    const [path, frag] = href.split('#')
                    return [path, frag ?? null]
                },
                getFragment: () => null,
            })

            // ch2 has no TOC entry, should return ch1
            expect(progress.getProgress(1)?.label).toBe('Chapter 1')
        })

        it('should return null for index beyond sections', async () => {
            const toc: TOCItem[] = [
                { label: 'Chapter 1', href: 'ch1.xhtml' },
            ]

            const progress = new TOCProgress()
            await progress.init({
                toc,
                sectionIds: ['ch1.xhtml'],
                splitHref: (href) => {
                    const [path, frag] = href.split('#')
                    return [path, frag ?? null]
                },
                getFragment: () => null,
            })

            expect(progress.getProgress(99)).toBeNull()
        })
    })
})
