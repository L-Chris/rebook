/**
 * Document Model tests.
 *
 * Tests the AI-friendly document model: DocumentNode, SectionDocument,
 * query API, mutation operations, and parser integration.
 */

import { describe, it, expect } from 'vitest'
import {
    textNode,
    elementNode,
    isTextNode,
    isElementNode,
    parseHTML,
    createSectionDocument,
} from '../src/core/document'
import { BrowserDOMAdapter } from '../src/adapters/browser'
import { NodeDOMAdapter } from '../src/adapters/node'

describe('Document Model', () => {
    describe('Node helpers', () => {
        it('should create text node', () => {
            const node = textNode('Hello')
            expect(node.type).toBe('text')
            expect(node.text).toBe('Hello')
            expect(isTextNode(node)).toBe(true)
            expect(isElementNode(node)).toBe(false)
        })

        it('should create element node', () => {
            const node = elementNode('p', { class: 'intro' }, [textNode('Hello')])
            expect(node.type).toBe('p')
            expect(node.attrs).toEqual({ class: 'intro' })
            expect(node.children).toHaveLength(1)
            expect(isElementNode(node)).toBe(true)
            expect(isTextNode(node)).toBe(false)
        })

        it('should create element without attrs or children', () => {
            const node = elementNode('br')
            expect(node.type).toBe('br')
            expect(node.attrs).toBeUndefined()
            expect(node.children).toBeUndefined()
        })
    })

    describe('parseHTML', () => {
        it('should parse simple HTML', () => {
            const html = '<p>Hello world</p>'
            const nodes = parseHTML(html, new NodeDOMAdapter())

            expect(nodes).toHaveLength(1)
            expect(nodes[0].type).toBe('p')
            expect(nodes[0].children).toHaveLength(1)
            expect(isTextNode(nodes[0].children![0])).toBe(true)
            expect(nodes[0].children![0].text).toBe('Hello world')
        })

        it('should parse nested elements', () => {
            const html = '<div><p>First</p><p>Second</p></div>'
            const nodes = parseHTML(html, new NodeDOMAdapter())

            expect(nodes).toHaveLength(1)
            expect(nodes[0].type).toBe('div')
            expect(nodes[0].children).toHaveLength(2)
            expect(nodes[0].children![0].type).toBe('p')
            expect(nodes[0].children![1].type).toBe('p')
        })

        it('should parse attributes', () => {
            const html = '<p class="intro" id="p1">Text</p>'
            const nodes = parseHTML(html, new NodeDOMAdapter())

            expect(nodes[0].attrs).toEqual({ class: 'intro', id: 'p1' })
        })

        it('should handle empty content', () => {
            const nodes = parseHTML('', new NodeDOMAdapter())
            expect(nodes).toHaveLength(0)
        })
    })

    describe('SectionDocument', () => {
        const domAdapter = new NodeDOMAdapter()

        it('should create document from nodes', () => {
            const nodes = [
                elementNode('p', {}, [textNode('Hello')]),
                elementNode('p', {}, [textNode('World')]),
            ]
            const doc = createSectionDocument(nodes, domAdapter)

            expect(doc.nodes).toHaveLength(2)
        })

        it('should query by tag name', () => {
            const html = '<div><p>First</p><p>Second</p></div>'
            const nodes = parseHTML(html, domAdapter)
            const doc = createSectionDocument(nodes, domAdapter)

            const paragraphs = doc.query('p')
            expect(paragraphs).toHaveLength(2)
        })

        it('should query by class', () => {
            const html = '<p class="intro">First</p><p>Second</p>'
            const nodes = parseHTML(html, domAdapter)
            const doc = createSectionDocument(nodes, domAdapter)

            const intro = doc.query('.intro')
            expect(intro).toHaveLength(1)
            expect(intro[0].attrs?.class).toBe('intro')
        })

        it('should query by id', () => {
            const html = '<p id="p1">First</p><p id="p2">Second</p>'
            const nodes = parseHTML(html, domAdapter)
            const doc = createSectionDocument(nodes, domAdapter)

            const p1 = doc.query('#p1')
            expect(p1).toHaveLength(1)
            expect(p1[0].attrs?.id).toBe('p1')
        })

        it('should query multiple selectors', () => {
            const html = '<h1>Title</h1><p>Text</p><h2>Subtitle</h2>'
            const nodes = parseHTML(html, domAdapter)
            const doc = createSectionDocument(nodes, domAdapter)

            const headings = doc.query('h1, h2')
            expect(headings).toHaveLength(2)
        })

        it('should get text content', () => {
            const html = '<p>Hello</p><p>World</p>'
            const nodes = parseHTML(html, domAdapter)
            const doc = createSectionDocument(nodes, domAdapter)

            expect(doc.getText()).toBe('HelloWorld')
        })

        it('should get images', () => {
            const html = '<p><img src="img1.jpg" /><img src="img2.png" /></p>'
            const nodes = parseHTML(html, domAdapter)
            const doc = createSectionDocument(nodes, domAdapter)

            const images = doc.getImages()
            expect(images).toHaveLength(2)
            expect(images[0].type).toBe('image')
            expect(images[0].mimeType).toBe('image/jpeg')
            expect(images[1].mimeType).toBe('image/png')
        })

        it('should insert node', () => {
            const nodes = [elementNode('p', {}, [textNode('First')])]
            const doc = createSectionDocument(nodes, domAdapter)

            const newDoc = doc.insertNode([1], elementNode('p', {}, [textNode('Second')]))
            expect(newDoc.nodes).toHaveLength(2)
            expect(doc.nodes).toHaveLength(1) // Original unchanged (immutable)
        })

        it('should remove node', () => {
            const nodes = [
                elementNode('p', {}, [textNode('First')]),
                elementNode('p', {}, [textNode('Second')]),
            ]
            const doc = createSectionDocument(nodes, domAdapter)

            const newDoc = doc.removeNode([0])
            expect(newDoc.nodes).toHaveLength(1)
            expect(doc.nodes).toHaveLength(2) // Original unchanged
        })

        it('should set node attributes', () => {
            const nodes = [elementNode('p', {}, [textNode('Text')])]
            const doc = createSectionDocument(nodes, domAdapter)

            const newDoc = doc.setNode([0], { class: 'highlight' })
            expect(newDoc.nodes[0].attrs?.class).toBe('highlight')
            expect(doc.nodes[0].attrs?.class).toBeUndefined() // Original unchanged
        })

        it('should replace text', () => {
            const nodes = [elementNode('p', {}, [textNode('Old text')])]
            const doc = createSectionDocument(nodes, domAdapter)

            const newDoc = doc.replaceText([0, 0], 'New text')
            expect(newDoc.nodes[0].children![0].text).toBe('New text')
            expect(doc.nodes[0].children![0].text).toBe('Old text') // Original unchanged
        })

        it('should serialize to HTML', () => {
            const nodes = [
                elementNode('p', { class: 'intro' }, [textNode('Hello')]),
            ]
            const doc = createSectionDocument(nodes, domAdapter)

            const html = doc.serialize()
            expect(html).toContain('<p')
            expect(html).toContain('class="intro"')
            expect(html).toContain('Hello')
            expect(html).toContain('</p>')
        })
    })

    describe('Parser integration', () => {
        it('should work with NodeDOMAdapter', () => {
            const domAdapter = new NodeDOMAdapter()
            const html = '<p>Test adapter</p>'
            const nodes = parseHTML(html, domAdapter)
            const doc = createSectionDocument(nodes, domAdapter)

            expect(doc.query('p')).toHaveLength(1)
            expect(doc.getText()).toBe('Test adapter')
        })
    })
})
