/**
 * Metadata normalization tests
 */

import { describe, it, expect } from 'vitest'
import {
    normalizeLanguage,
    normalizeTitle,
    normalizePublisher,
    normalizeContributors,
    normalizeSubjects,
} from '../../src/core/metadata'

describe('Metadata normalization', () => {
    describe('normalizeLanguage', () => {
        it('should return undefined for undefined input', () => {
            expect(normalizeLanguage(undefined)).toBeUndefined()
        })

        it('should return string as-is', () => {
            expect(normalizeLanguage('en')).toBe('en')
            expect(normalizeLanguage('zh-CN')).toBe('zh-CN')
        })

        it('should return first element of array', () => {
            expect(normalizeLanguage(['en', 'fr'])).toBe('en')
            expect(normalizeLanguage(['zh-CN'])).toBe('zh-CN')
        })

        it('should return undefined for empty array', () => {
            expect(normalizeLanguage([])).toBeUndefined()
        })
    })

    describe('normalizeTitle', () => {
        it('should return undefined for undefined input', () => {
            expect(normalizeTitle(undefined)).toBeUndefined()
        })

        it('should return string as-is', () => {
            expect(normalizeTitle('My Book')).toBe('My Book')
        })

        it('should return first value of LanguageMap object', () => {
            expect(normalizeTitle({ en: 'My Book', zh: '我的书' })).toBe('My Book')
            expect(normalizeTitle({ zh: '我的书' })).toBe('我的书')
        })

        it('should return undefined for empty object', () => {
            expect(normalizeTitle({})).toBeUndefined()
        })
    })

    describe('normalizePublisher', () => {
        it('should return undefined for undefined input', () => {
            expect(normalizePublisher(undefined)).toBeUndefined()
        })

        it('should return string as-is', () => {
            expect(normalizePublisher('Publisher Inc')).toBe('Publisher Inc')
        })

        it('should extract name from Contributor object', () => {
            expect(normalizePublisher({ name: 'Publisher Inc' })).toBe('Publisher Inc')
            expect(normalizePublisher({ name: { en: 'Publisher Inc', zh: '出版社' } })).toBe('Publisher Inc')
        })

        it('should return first value of LanguageMap object', () => {
            expect(normalizePublisher({ en: 'Publisher Inc', zh: '出版社' })).toBe('Publisher Inc')
        })
    })

    describe('normalizeContributors', () => {
        it('should return undefined for undefined input', () => {
            expect(normalizeContributors(undefined)).toBeUndefined()
        })

        it('should wrap single string in array', () => {
            expect(normalizeContributors('John Doe')).toEqual([{ name: 'John Doe' }])
        })

        it('should convert string array to Contributor array', () => {
            expect(normalizeContributors(['John', 'Jane'])).toEqual([
                { name: 'John' },
                { name: 'Jane' },
            ])
        })

        it('should wrap single Contributor in array', () => {
            const contrib = { name: 'John Doe', sortAs: 'Doe, John' }
            expect(normalizeContributors(contrib)).toEqual([contrib])
        })

        it('should return Contributor array as-is', () => {
            const contribs = [
                { name: 'John Doe' },
                { name: 'Jane Smith', role: 'editor' },
            ]
            expect(normalizeContributors(contribs)).toEqual(contribs)
        })

        it('should normalize Contributor name to string', () => {
            const contrib = { name: { en: 'John Doe', zh: '约翰' } }
            expect(normalizeContributors(contrib)).toEqual([{ name: 'John Doe' }])
        })

        it('should filter out falsy values', () => {
            expect(normalizeContributors(['', 'John', ''])).toEqual([{ name: 'John' }])
        })
    })

    describe('normalizeSubjects', () => {
        it('should return undefined for undefined input', () => {
            expect(normalizeSubjects(undefined)).toBeUndefined()
        })

        it('should wrap single string in array', () => {
            expect(normalizeSubjects('Fiction')).toEqual(['Fiction'])
        })

        it('should return array as-is', () => {
            expect(normalizeSubjects(['Fiction', 'Fantasy'])).toEqual(['Fiction', 'Fantasy'])
        })

        it('should filter out falsy values', () => {
            expect(normalizeSubjects(['', 'Fiction', ''])).toEqual(['Fiction'])
        })
    })
})
