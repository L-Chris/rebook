import { describe, it, expect } from 'vitest'
import {
    parseStyleDeclarations,
    normalizeStyleDeclarations,
    mergeStyleDeclarations,
    parseSimpleClassRules,
    parseSimpleClassRuleIndex,
    extractImportURLs,
} from '../../src/core/css'

describe('parseStyleDeclarations', () => {
    it('parses normal declarations', () => {
        expect(parseStyleDeclarations('color: red; font-size: 12px')).toEqual([
            ['color', 'red'],
            ['font-size', '12px'],
        ])
    })

    it('handles values containing colons (data URIs)', () => {
        const result = parseStyleDeclarations('background: url(data:image/png;base64,abc123)')
        expect(result).toEqual([['background', 'url(data:image/png;base64,abc123)']])
    })

    it('lowercases property names', () => {
        expect(parseStyleDeclarations('Color: Red')).toEqual([['color', 'Red']])
    })

    it('returns empty array for undefined', () => {
        expect(parseStyleDeclarations(undefined)).toEqual([])
    })

    it('returns empty array for empty string', () => {
        expect(parseStyleDeclarations('')).toEqual([])
    })

    it('ignores declarations without values', () => {
        expect(parseStyleDeclarations('color:; font-size: 14px')).toEqual([['font-size', '14px']])
    })
})

describe('mergeStyleDeclarations', () => {
    it('override wins on conflict', () => {
        const result = mergeStyleDeclarations('color: red', 'color: blue')
        expect(result).toBe('color: blue')
    })

    it('merges additive declarations', () => {
        const result = mergeStyleDeclarations('color: red', 'font-size: 12px')
        expect(result).toContain('color: red')
        expect(result).toContain('font-size: 12px')
    })
})

describe('parseSimpleClassRules', () => {
    it('parses simple class rule', () => {
        const rules = parseSimpleClassRules('.foo { color: red }')
        expect(rules).toHaveLength(1)
        expect(rules[0].order).toBe(0)
        expect(rules[0].classNames).toEqual(['foo'])
        expect(rules[0].declarations).toBe('color: red')
        expect(rules[0].matches('p', new Set(['foo']))).toBe(true)
        expect(rules[0].matches('p', new Set(['bar']))).toBe(false)
    })

    it('parses tag + class rule', () => {
        const rules = parseSimpleClassRules('p.bar { font-size: 14px }')
        expect(rules).toHaveLength(1)
        expect(rules[0].matches('p', new Set(['bar']))).toBe(true)
        expect(rules[0].matches('div', new Set(['bar']))).toBe(false)
    })

    it('parses multiple classes', () => {
        const rules = parseSimpleClassRules('.a.b { color: blue }')
        expect(rules).toHaveLength(1)
        expect(rules[0].matches('div', new Set(['a', 'b']))).toBe(true)
        expect(rules[0].matches('div', new Set(['a']))).toBe(false)
    })

    it('rejects complex selectors', () => {
        const rules = parseSimpleClassRules('.a > .b { color: red }')
        expect(rules).toHaveLength(0)
    })

    it('rejects id selectors', () => {
        const rules = parseSimpleClassRules('#id { color: red }')
        expect(rules).toHaveLength(0)
    })

    it('rejects attribute selectors', () => {
        const rules = parseSimpleClassRules('[attr] { color: red }')
        expect(rules).toHaveLength(0)
    })

    it('strips pseudo-selectors without rejecting', () => {
        const rules = parseSimpleClassRules('a.link:hover { color: blue }')
        expect(rules).toHaveLength(1)
        expect(rules[0].matches('a', new Set(['link']))).toBe(true)
    })

    it('handles comma-separated selectors', () => {
        const rules = parseSimpleClassRules('.a, .b { color: red }')
        expect(rules).toHaveLength(2)
    })

    it('includes rules inside @media queries', () => {
        const css = '@media (min-width: 600px) { .foo { color: red } }'
        const rules = parseSimpleClassRules(css)
        expect(rules).toHaveLength(1)
        expect(rules[0].matches('div', new Set(['foo']))).toBe(true)
    })

    it('strips CSS comments', () => {
        const rules = parseSimpleClassRules('/* comment */ .foo { color: red }')
        expect(rules).toHaveLength(1)
    })

    it('returns empty array on empty input', () => {
        expect(parseSimpleClassRules('')).toEqual([])
    })

    it('returns empty array on malformed CSS', () => {
        expect(parseSimpleClassRules('{ broken')).toEqual([])
    })
})

describe('parseSimpleClassRuleIndex', () => {
    it('returns matching rules in stylesheet order', () => {
        const index = parseSimpleClassRuleIndex([
            '.a { color: red }',
            '.unrelated { color: black }',
            '.b { font-size: 14px }',
            'p.a.b { font-weight: bold }',
            '.a.c { text-align: center }',
        ].join('\n'))

        const matches = index.getMatchingRules('p', new Set(['a', 'b']))

        expect(matches.map(rule => rule.declarations)).toEqual([
            'color: red',
            'font-size: 14px',
            'font-weight: bold',
        ])
    })

    it('matches single-class elements through the same rule semantics', () => {
        const index = parseSimpleClassRuleIndex('.a { color: red } p.a { font-weight: bold } div.a { color: blue }')

        expect(index.getMatchingRules('p', new Set(['a'])).map(rule => rule.declarations)).toEqual([
            'color: red',
            'font-weight: bold',
        ])
    })
})

describe('extractImportURLs', () => {
    it('extracts quoted import', () => {
        expect(extractImportURLs('@import "base.css";')).toEqual(['base.css'])
    })

    it('extracts url() import', () => {
        expect(extractImportURLs('@import url("print.css");')).toEqual(['print.css'])
    })

    it('extracts bare url() import', () => {
        expect(extractImportURLs('@import url(bare.css);')).toEqual(['bare.css'])
    })

    it('extracts import with media query', () => {
        expect(extractImportURLs('@import "print.css" print;')).toEqual(['print.css'])
    })

    it('extracts multiple imports', () => {
        const css = '@import "a.css";\n@import url("b.css");'
        expect(extractImportURLs(css)).toEqual(['a.css', 'b.css'])
    })

    it('returns empty array when no imports', () => {
        expect(extractImportURLs('.foo { color: red }')).toEqual([])
    })
})
