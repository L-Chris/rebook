/**
 * DOM Adapter interfaces.
 *
 * These interfaces abstract DOM parsing and querying operations,
 * allowing the EPUB parser to run in any environment (browser, Node.js, workers).
 *
 * Implementations:
 * - Browser: wraps native DOMParser/XMLSerializer
 * - Test: uses linkedom or a lightweight parser
 */

/**
 * Minimal attribute representation.
 */
export interface XMLAttr {
  localName: string
  namespaceURI: string | null
  value: string
}

/**
 * Node type constants (matching DOM spec).
 */
export const NodeType = {
  ELEMENT_NODE: 1,
  TEXT_NODE: 3,
} as const

/**
 * Minimal node interface (base for elements and text).
 */
export interface XMLNode {
  nodeType: number
  textContent: string | null
  parentNode: XMLElement | null
}

/**
 * Minimal text node interface.
 */
export interface XMLText extends XMLNode {
  nodeType: typeof NodeType.TEXT_NODE
  textContent: string
}

/**
 * Minimal element interface for XML/HTML querying.
 */
export interface XMLElement extends XMLNode {
  nodeType: typeof NodeType.ELEMENT_NODE
  localName: string
  namespaceURI: string | null
  children: XMLElement[]
  attributes: XMLAttr[]

  getAttribute(name: string): string | null
  getAttributeNS(ns: string | null, name: string): string | null
  hasAttribute(name: string): boolean
  setAttribute(name: string, value: string): void
  setAttributeNS(ns: string | null, name: string, value: string): void

  querySelector(selector: string): XMLElement | null
  querySelectorAll(selector: string): XMLElement[]
  getElementsByTagNameNS(ns: string, name: string): XMLElement[]
  getElementsByTagName(name: string): XMLElement[]

  ownerDocument: XMLDocument | null
  lookupNamespaceURI(prefix: string | null): string | null
  lookupPrefix(ns: string): string | null
}

/**
 * Minimal document interface for XML/HTML parsing.
 */
export interface XMLDocument {
  documentElement: XMLElement
  getElementById(id: string): XMLElement | null
  getElementsByTagNameNS(ns: string, name: string): XMLElement[]
  getElementsByTagName(name: string): XMLElement[]
  querySelector(selector: string): XMLElement | null
  querySelectorAll(selector: string): XMLElement[]
  lookupNamespaceURI(prefix: string | null): string | null
  lookupPrefix(ns: string): string | null

  /**
   * Return the underlying native document object.
   * Used by adapters that need to unwrap the document (e.g. for serialization).
   */
  toNative?(): unknown
}

/**
 * DOM adapter for parsing and serializing XML/HTML.
 */
export interface DOMAdapter {
  /**
   * Parse an XML string into a document.
   * @throws Error if parsing fails
   */
  parseXML(str: string): XMLDocument

  /**
   * Parse an HTML/XHTML string into a document.
   * @param mimeType - The MIME type (e.g., 'application/xhtml+xml', 'text/html')
   */
  parseHTML(str: string, mimeType?: string): XMLDocument

  /**
   * Serialize a document back to a string.
   */
  serialize(doc: XMLDocument): string

  /**
   * Get all child nodes (elements and text nodes) of an element.
   * Optional: used by Document Model for tree traversal.
   */
  getChildNodes?(element: XMLElement): XMLNode[]

  /**
   * Create an empty HTML document.
   * Optional: used by Document Model for mutation.
   */
  createDocument?(): XMLDocument

  /**
   * Create an element node.
   * Optional: used by Document Model for mutation.
   */
  createElement?(doc: XMLDocument, tagName: string): XMLElement

  /**
   * Create a text node.
   * Optional: used by Document Model for mutation.
   */
  createTextNode?(doc: XMLDocument, text: string): XMLText

  /**
   * Append a child node to a parent element.
   * Optional: used by Document Model for mutation.
   */
  appendChild?(parent: XMLElement, child: XMLNode): void
}
