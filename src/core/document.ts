/**
 * Document Model — AI-friendly structured content representation.
 *
 * Inspired by SlateJS's tree-based editor model. Provides:
 * - Immutable document tree (mutations return new instances)
 * - CSS-like query selectors
 * - Granular mutation operations (insert, remove, set, replace)
 * - Serialization back to HTML
 */

import type { DocumentNode, SectionDocument, DocumentResource } from './types'
import type { DOMAdapter, XMLElement, XMLDocument } from './dom-adapter'
import { escapeHTML } from './utils'

/**
 * Mutable version of DocumentNode for internal use during cloning and mutation.
 */
type MutableDocumentNode = {
    type: string
    attrs?: Record<string, string>
    children?: MutableDocumentNode[]
    text?: string
}

// ============================================================================
// Document Node Helpers
// ============================================================================

/**
 * Create a text node.
 */
export function textNode(text: string): DocumentNode {
    return { type: 'text', text }
}

/**
 * Create an element node.
 */
export function elementNode(
    type: string,
    attrs?: Record<string, string>,
    children?: DocumentNode[]
): DocumentNode {
    return { type, attrs, children }
}

/**
 * Check if a node is a text node.
 */
export function isTextNode(node: DocumentNode): node is DocumentNode & { text: string } {
    return node.type === 'text' && typeof node.text === 'string'
}

/**
 * Check if a node is an element node.
 */
export function isElementNode(node: DocumentNode): node is DocumentNode & { children: DocumentNode[] } {
    return node.type !== 'text' && Array.isArray(node.children)
}

// ============================================================================
// DOM to DocumentNode Conversion
// ============================================================================

/**
 * Convert a DOM element to a DocumentNode tree.
 */
function domToNode(element: XMLElement, domAdapter: DOMAdapter): DocumentNode {
    const type = element.localName
    const attrs: Record<string, string> = {}
    for (const attr of element.attributes) {
        attrs[attr.localName] = attr.value
    }

    const children: DocumentNode[] = []

    // Use getChildNodes if available (includes text nodes), otherwise use children
    const childNodes = domAdapter.getChildNodes
        ? domAdapter.getChildNodes(element)
        : element.children

    for (const child of childNodes) {
        if (child.nodeType === 1) { // Element
            children.push(domToNode(child as XMLElement, domAdapter))
        } else if (child.nodeType === 3) { // Text
            const text = child.textContent || ''
            if (text) {
                children.push(textNode(text))
            }
        }
    }

    return elementNode(type, Object.keys(attrs).length > 0 ? attrs : undefined, children)
}

/**
 * Parse HTML string into DocumentNode tree using DOMAdapter.
 */
export function parseHTML(html: string, domAdapter: DOMAdapter): DocumentNode[] {
    // Wrap fragment in full HTML document for consistent parsing across adapters.
    // xmldom (test adapter) doesn't auto-wrap fragments in <html><body> the way
    // browser DOMParser does, so we do it explicitly.
    const wrapped = `<html><body>${html}</body></html>`
    const doc = domAdapter.parseHTML(wrapped, 'text/html')
    const body = doc.querySelector('body') || doc.documentElement

    const nodes: DocumentNode[] = []

    // Use getChildNodes if available, otherwise use children
    const childNodes = domAdapter.getChildNodes
        ? domAdapter.getChildNodes(body)
        : body.children

    for (const child of childNodes) {
        if (child.nodeType === 1) { // Element
            nodes.push(domToNode(child as XMLElement, domAdapter))
        } else if (child.nodeType === 3) { // Text
            const text = child.textContent || ''
            if (text.trim()) {
                nodes.push(textNode(text))
            }
        }
    }

    return nodes
}

// ============================================================================
// Section Document Implementation
// ============================================================================

/**
 * Create a SectionDocument from nodes.
 */
export function createSectionDocument(
    nodes: DocumentNode[],
    domAdapter: DOMAdapter
): SectionDocument {
    return new SectionDocumentImpl(nodes, domAdapter)
}

/**
 * SectionDocument implementation.
 */
class SectionDocumentImpl implements SectionDocument {
    constructor(
        public nodes: DocumentNode[],
        private domAdapter: DOMAdapter
    ) {}

    query(selector: string): DocumentNode[] {
        const results: DocumentNode[] = []
        const selectorParts = selector.split(',').map(s => s.trim())

        const matchesSelector = (node: DocumentNode, sel: string): boolean => {
            if (isTextNode(node)) return false

            // Parse selector (simplified: tag, .class, #id, [attr])
            if (sel.startsWith('.')) {
                return node.attrs?.class?.split(/\s+/).includes(sel.slice(1)) || false
            }
            if (sel.startsWith('#')) {
                return node.attrs?.id === sel.slice(1)
            }
            if (sel.startsWith('[') && sel.endsWith(']')) {
                const attrMatch = sel.slice(1, -1).split('=')
                const attrName = attrMatch[0]
                const attrValue = attrMatch[1]?.replace(/['"]/g, '')
                if (!node.attrs?.[attrName]) return false
                return attrValue === undefined || node.attrs[attrName] === attrValue
            }
            // Tag name
            return node.type === sel
        }

        const walk = (node: DocumentNode) => {
            for (const sel of selectorParts) {
                if (matchesSelector(node, sel)) {
                    results.push(node)
                    break
                }
            }
            if (node.children) {
                for (const child of node.children) {
                    walk(child)
                }
            }
        }

        for (const node of this.nodes) {
            walk(node)
        }

        return results
    }

    getText(): string {
        const parts: string[] = []

        const walk = (node: DocumentNode) => {
            if (isTextNode(node)) {
                parts.push(node.text)
            } else if (node.children) {
                for (const child of node.children) {
                    walk(child)
                }
            }
        }

        for (const node of this.nodes) {
            walk(node)
        }

        return parts.join('')
    }

    getImages(): DocumentResource[] {
        const images: DocumentResource[] = []
        const imgNodes = this.query('img')

        for (const node of imgNodes) {
            const src = node.attrs?.src
            if (!src) continue

            const mimeType = getMimeTypeFromSrc(src)
            images.push({
                id: `img-${images.length}`,
                type: 'image',
                mimeType,
                url: src,
            })
        }

        return images
    }

    insertNode(path: number[], node: DocumentNode): SectionDocument {
        const newNodes = cloneNodes(this.nodes)
        if (path.length === 0) {
            newNodes.push(cloneNode(node))
        } else if (path.length === 1) {
            // Insert at root level
            newNodes.splice(path[0], 0, cloneNode(node))
        } else {
            const parent = getNodeAtPath(newNodes, path.slice(0, -1))
            if (!parent || !parent.children) return this
            const index = path[path.length - 1]
            parent.children.splice(index, 0, cloneNode(node))
        }
        return new SectionDocumentImpl(newNodes, this.domAdapter)
    }

    removeNode(path: number[]): SectionDocument {
        if (path.length === 0) return this
        const newNodes = cloneNodes(this.nodes)

        if (path.length === 1) {
            newNodes.splice(path[0], 1)
        } else {
            const parent = getNodeAtPath(newNodes, path.slice(0, -1))
            if (!parent || !parent.children) return this
            parent.children.splice(path[path.length - 1], 1)
        }

        return new SectionDocumentImpl(newNodes, this.domAdapter)
    }

    setNode(path: number[], attrs: Record<string, string>): SectionDocument {
        const newNodes = cloneNodes(this.nodes)
        const target = getNodeAtPath(newNodes, path)
        if (!target) return this

        target.attrs = { ...target.attrs, ...attrs }
        return new SectionDocumentImpl(newNodes, this.domAdapter)
    }

    replaceText(path: number[], text: string): SectionDocument {
        const newNodes = cloneNodes(this.nodes)
        const target = getNodeAtPath(newNodes, path)
        if (!target || !isTextNode(target)) return this

        target.text = text
        return new SectionDocumentImpl(newNodes, this.domAdapter)
    }

    serialize(): string {
        // Check if DOMAdapter supports document creation
        if (!this.domAdapter.createDocument || !this.domAdapter.createElement || !this.domAdapter.createTextNode || !this.domAdapter.appendChild) {
            // Fallback: serialize without mutation support
            return this.serializeSimple()
        }

        const doc = this.domAdapter.createDocument()
        const body = doc.querySelector('body') || doc.documentElement

        for (const node of this.nodes) {
            this.nodeToDOM(node, doc, body)
        }

        // Serialize body contents
        const serialized = this.domAdapter.serialize(doc)
        const bodyMatch = serialized.match(/<body[^>]*>([\s\S]*)<\/body>/i)
        return bodyMatch ? bodyMatch[1] : serialized
    }

    /**
     * Convert a DocumentNode to DOM and append to parent.
     */
    private nodeToDOM(node: DocumentNode, doc: XMLDocument, parent: XMLElement): void {
        if (isTextNode(node)) {
            const textNode = this.domAdapter.createTextNode!(doc, node.text)
            this.domAdapter.appendChild!(parent, textNode)
            return
        }

        const element = this.domAdapter.createElement!(doc, node.type)
        if (node.attrs) {
            for (const [key, value] of Object.entries(node.attrs)) {
                element.setAttribute(key, value)
            }
        }

        if (node.children) {
            for (const child of node.children) {
                this.nodeToDOM(child, doc, element)
            }
        }

        this.domAdapter.appendChild!(parent, element)
    }

    /**
     * Simple serialization fallback without DOM manipulation.
     */
    private serializeSimple(): string {
        const parts: string[] = []
        for (const node of this.nodes) {
            parts.push(this.nodeToHTML(node))
        }
        return parts.join('')
    }

    /**
     * Convert a DocumentNode to HTML string.
     */
    private nodeToHTML(node: DocumentNode): string {
        if (isTextNode(node)) {
            return escapeHTML(node.text)
        }

        const attrs = node.attrs
            ? Object.entries(node.attrs).map(([k, v]) => `${k}="${escapeHTML(v)}"`).join(' ')
            : ''
        const attrsStr = attrs ? ` ${attrs}` : ''

        if (!node.children || node.children.length === 0) {
            // Self-closing tags
            if (['img', 'br', 'hr', 'input', 'meta', 'link'].includes(node.type)) {
                return `<${node.type}${attrsStr} />`
            }
            return `<${node.type}${attrsStr}></${node.type}>`
        }

        const children = node.children.map(c => this.nodeToHTML(c)).join('')
        return `<${node.type}${attrsStr}>${children}</${node.type}>`
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Deep clone a DocumentNode tree.
 */
function cloneNode(node: DocumentNode): MutableDocumentNode {
    if (isTextNode(node)) {
        return { type: 'text', text: node.text }
    }
    const cloned: MutableDocumentNode = { type: node.type }
    if (node.attrs) {
        cloned.attrs = { ...node.attrs }
    }
    if (node.children) {
        cloned.children = node.children.map(cloneNode)
    }
    return cloned
}

/**
 * Deep clone an array of DocumentNodes.
 */
function cloneNodes(nodes: readonly DocumentNode[]): MutableDocumentNode[] {
    return nodes.map(cloneNode)
}

/**
 * Get a node at a specific path in the tree.
 */
function getNodeAtPath(nodes: MutableDocumentNode[], path: number[]): MutableDocumentNode | null {
    if (path.length === 0) return null

    let current: MutableDocumentNode | undefined = nodes[path[0]]
    for (let i = 1; i < path.length; i++) {
        if (!current || !current.children) return null
        current = current.children[path[i]] as MutableDocumentNode
    }

    return current || null
}

/**
 * Guess MIME type from image src.
 */
function getMimeTypeFromSrc(src: string): string {
    const lower = src.toLowerCase()
    if (lower.includes('.jpg') || lower.includes('.jpeg')) return 'image/jpeg'
    if (lower.includes('.png')) return 'image/png'
    if (lower.includes('.gif')) return 'image/gif'
    if (lower.includes('.webp')) return 'image/webp'
    if (lower.includes('.svg')) return 'image/svg+xml'
    if (lower.startsWith('data:image/')) {
        const match = src.match(/^data:([^;]+)/)
        return match ? match[1] : 'image/unknown'
    }
    return 'application/octet-stream'
}
