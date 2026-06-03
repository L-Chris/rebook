/**
 * WeChat Mini Program adapter implementations.
 *
 * These use @xmldom/xmldom without Node-specific APIs, allowing parsers to run
 * inside Mini Program JavaScriptCore contexts where DOMParser, Blob URLs, and
 * node:module are unavailable.
 */

import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import type { DOMAdapter, XMLAttr, XMLDocument, XMLElement, XMLNode, XMLText } from '../core/dom-adapter'
import type { URLFactory } from '../core/url-factory'
import { EBookError } from '../core/errors'
import { debugRebook } from '../core/debug'

type NativeNodeList = {
  length: number
  item(index: number): any
}

type NativeNamedNodeMap = NativeNodeList

const XLINK_NS = 'http://www.w3.org/1999/xlink'

type WechatMiniProgramFileSystemManager = {
  writeFileSync(filePath: string, data: string | ArrayBuffer, encoding?: string): void
  unlinkSync?(filePath: string): void
}

type WechatMiniProgramGlobal = typeof globalThis & {
  wx?: {
    env?: { USER_DATA_PATH?: string }
    arrayBufferToBase64?: (buffer: ArrayBuffer) => string
    getFileSystemManager?: () => WechatMiniProgramFileSystemManager
  }
}

function nodeListToArray<T = any>(list?: NativeNodeList | null): T[] {
  const result: T[] = []
  if (!list) return result
  for (let i = 0; i < list.length; i++) {
    const item = list.item(i)
    if (item) result.push(item)
  }
  return result
}

function getElementChildren(el: any): any[] {
  return nodeListToArray(el.childNodes).filter(child => child.nodeType === 1)
}

function normalizeHTMLVoidTags(str: string): string {
  return str
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(
      /<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)(\s[^<>]*?)?>/gi,
      (match, tagName: string, attrs = '') =>
        match.endsWith('/>') ? match : `<${tagName}${attrs}/>`
    )
}

function encodeBase64(data: string | ArrayBuffer): string {
  const wxLike = globalThis as typeof globalThis & {
    wx?: { arrayBufferToBase64?: (buffer: ArrayBuffer) => string }
  }
  const toBase64 = wxLike.wx?.arrayBufferToBase64
  const buffer = typeof data === 'string' ? stringToArrayBuffer(data) : data
  if (toBase64) return toBase64(buffer)

  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])

  const btoa = (globalThis as typeof globalThis & { btoa?: (value: string) => string }).btoa
  if (btoa) return btoa(binary)

  throw new EBookError('No base64 encoder available in this environment', 'ADAPTER_ERROR')
}

function stringToArrayBuffer(value: string): ArrayBuffer {
  const buffer = new ArrayBuffer(value.length)
  const view = new Uint8Array(buffer)
  for (let i = 0; i < value.length; i++) view[i] = value.charCodeAt(i)
  return buffer
}

function isBlobLike(value: unknown): value is Blob {
  return !!value && typeof value === 'object' && 'type' in value && 'arrayBuffer' in value
}

function getWechatMiniProgramFileSystem(): { fs: WechatMiniProgramFileSystemManager; root: string } | null {
  const wxLike = (globalThis as WechatMiniProgramGlobal).wx
  const root = wxLike?.env?.USER_DATA_PATH
  const fs = wxLike?.getFileSystemManager?.()
  return root && fs ? { fs, root } : null
}

function getMimeExtension(mimeType: string): string {
  const normalized = mimeType.split(';', 1)[0].trim().toLowerCase()
  switch (normalized) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/gif':
      return 'gif'
    case 'image/webp':
      return 'webp'
    case 'image/svg+xml':
      return 'svg'
    case 'image/bmp':
      return 'bmp'
    default:
      return 'bin'
  }
}

function debugResource(message: string, details?: Record<string, unknown>): void {
  debugRebook('wechat-url', message, details)
}

class MiniProgramXMLNode implements XMLNode {
  constructor(protected node: any, private parent: XMLElement | null = null) {}

  get nodeType(): number {
    return this.node.nodeType
  }

  get textContent(): string | null {
    return this.node.textContent ?? null
  }

  set textContent(value: string | null) {
    this.node.textContent = value ?? ''
  }

  get parentNode(): XMLElement | null {
    if (this.parent) return this.parent
    const parent = this.node.parentNode
    return parent?.nodeType === 1 ? new MiniProgramXMLElement(parent) : null
  }
}

class MiniProgramXMLText extends MiniProgramXMLNode implements XMLText {
  constructor(node: any, parent: XMLElement | null = null) {
    super(node, parent)
  }

  get nodeType(): 3 {
    return 3
  }

  get textContent(): string {
    return this.node.textContent || ''
  }

  set textContent(value: string) {
    this.node.textContent = value
  }
}

class MiniProgramXMLElement extends MiniProgramXMLNode implements XMLElement {
  constructor(private el: any) {
    super(el)
  }

  get nodeType(): 1 {
    return 1
  }

  get localName(): string {
    return this.el.localName || this.el.nodeName
  }

  get namespaceURI(): string | null {
    return this.el.namespaceURI || null
  }

  get children(): XMLElement[] {
    return getElementChildren(this.el).map(child => new MiniProgramXMLElement(child))
  }

  get textContent(): string | null {
    return this.el.textContent ?? null
  }

  set textContent(value: string | null) {
    this.el.textContent = value ?? ''
  }

  get attributes(): XMLAttr[] {
    return nodeListToArray<any>(this.el.attributes as NativeNamedNodeMap).map(attr => ({
      localName: attr.localName || attr.name,
      namespaceURI: attr.namespaceURI || null,
      value: attr.value,
    }))
  }

  get ownerDocument(): XMLDocument | null {
    return this.el.ownerDocument ? new MiniProgramXMLDocument(this.el.ownerDocument) : null
  }

  getAttribute(name: string): string | null {
    return this.el.getAttribute(name)
  }

  getAttributeNS(ns: string | null, name: string): string | null {
    return this.el.getAttributeNS(ns, name)
  }

  hasAttribute(name: string): boolean {
    return this.el.hasAttribute(name)
  }

  setAttribute(name: string, value: string): void {
    this.el.setAttribute(name, value)
  }

  setAttributeNS(ns: string | null, name: string, value: string): void {
    this.el.setAttributeNS(ns, name, value)
  }

  querySelector(selector: string): XMLElement | null {
    if (selector === 'parsererror') return null
    if (selector.startsWith('#')) {
      const el = this.el.ownerDocument?.getElementById(selector.slice(1))
      return el ? new MiniProgramXMLElement(el) : null
    }

    const attrValueMatch = selector.match(/^\[(\w+)="([^"]+)"\]$/)
    if (attrValueMatch) {
      const [, attrName, attrValue] = attrValueMatch
      const found = this.findByAttribute(attrName, attrValue)
      return found ? new MiniProgramXMLElement(found) : null
    }

    if (/^[a-zA-Z][\w-]*$/.test(selector)) {
      const elements = this.el.getElementsByTagName(selector)
      return elements.length > 0 ? new MiniProgramXMLElement(elements.item(0)) : null
    }

    return null
  }

  querySelectorAll(selector: string): XMLElement[] {
    if (/^[a-zA-Z][\w-]*$/.test(selector)) {
      return nodeListToArray(this.el.getElementsByTagName(selector)).map(
        child => new MiniProgramXMLElement(child)
      )
    }

    const results: any[] = []
    const tagAttrMatch = selector.match(/^(\w+)\[(\w+)\]$/)
    if (tagAttrMatch) {
      const [, tagName, attrName] = tagAttrMatch
      nodeListToArray(this.el.getElementsByTagName(tagName)).forEach(el => {
        if (el.hasAttribute(attrName)) results.push(el)
      })
      return results.map(el => new MiniProgramXMLElement(el))
    }

    const attrMatch = selector.match(/^\[(?:\*\|)?(\w+)\]/)
    if (!attrMatch) return []

    this.collectWithAttribute(attrMatch[1], results)
    return results.map(el => new MiniProgramXMLElement(el))
  }

  getElementsByTagNameNS(ns: string, name: string): XMLElement[] {
    return nodeListToArray(this.el.getElementsByTagNameNS(ns, name)).map(
      child => new MiniProgramXMLElement(child)
    )
  }

  getElementsByTagName(name: string): XMLElement[] {
    return nodeListToArray(this.el.getElementsByTagName(name)).map(
      child => new MiniProgramXMLElement(child)
    )
  }

  lookupNamespaceURI(prefix: string | null): string | null {
    return this.el.lookupNamespaceURI(prefix)
  }

  lookupPrefix(ns: string): string | null {
    return this.el.lookupPrefix(ns)
  }

  toNative(): unknown {
    return this.el
  }

  private findByAttribute(name: string, value: string): any | null {
    if (this.el.getAttribute(name) === value) return this.el
    for (const child of getElementChildren(this.el)) {
      const found = new MiniProgramXMLElement(child).findByAttribute(name, value)
      if (found) return found
    }
    return null
  }

  private collectWithAttribute(attrName: string, results: any[]): void {
    if (
      this.el.hasAttribute(attrName) ||
      (attrName === 'href' && this.el.getAttributeNS(XLINK_NS, 'href')) ||
      this.el.getAttributeNS(XLINK_NS, attrName)
    ) {
      results.push(this.el)
    }

    getElementChildren(this.el).forEach(child => {
      new MiniProgramXMLElement(child).collectWithAttribute(attrName, results)
    })
  }
}

class MiniProgramXMLDocument implements XMLDocument {
  constructor(private doc: any) {}

  get documentElement(): XMLElement {
    return new MiniProgramXMLElement(this.doc.documentElement)
  }

  getElementById(id: string): XMLElement | null {
    const el = this.doc.getElementById(id)
    return el ? new MiniProgramXMLElement(el) : null
  }

  getElementsByTagNameNS(ns: string, name: string): XMLElement[] {
    return nodeListToArray(this.doc.getElementsByTagNameNS(ns, name)).map(
      child => new MiniProgramXMLElement(child)
    )
  }

  getElementsByTagName(name: string): XMLElement[] {
    return nodeListToArray(this.doc.getElementsByTagName(name)).map(
      child => new MiniProgramXMLElement(child)
    )
  }

  querySelector(selector: string): XMLElement | null {
    if (selector === 'parsererror') return null
    if (selector.startsWith('#')) return this.getElementById(selector.slice(1))

    const attrValueMatch = selector.match(/^\[(\w+)="([^"]+)"\]$/)
    if (attrValueMatch) {
      const [, attrName, attrValue] = attrValueMatch
      return this.querySelectorAll(`[${attrName}]`).find(
        el => el.getAttribute(attrName) === attrValue
      ) || null
    }

    if (/^[a-zA-Z][\w-]*$/.test(selector)) {
      const elements = this.doc.getElementsByTagName(selector)
      return elements.length > 0 ? new MiniProgramXMLElement(elements.item(0)) : null
    }

    return null
  }

  querySelectorAll(selector: string): XMLElement[] {
    if (/^[a-zA-Z][\w-]*$/.test(selector)) {
      return this.getElementsByTagName(selector)
    }

    const tagAttrMatch = selector.match(/^(\w+)\[(\w+)\]$/)
    if (tagAttrMatch) {
      const [, tagName, attrName] = tagAttrMatch
      return this.getElementsByTagName(tagName).filter(el => el.hasAttribute(attrName))
    }

    const attrMatch = selector.match(/^\[(?:\*\|)?(\w+)\]/)
    if (!attrMatch) return []

    const attrName = attrMatch[1]
    const results: XMLElement[] = []
    const walk = (el: XMLElement) => {
      if (
        el.hasAttribute(attrName) ||
        (attrName === 'href' && el.getAttributeNS(XLINK_NS, 'href')) ||
        el.getAttributeNS(XLINK_NS, attrName)
      ) {
        results.push(el)
      }
      el.children.forEach(walk)
    }
    walk(this.documentElement)
    return results
  }

  lookupNamespaceURI(prefix: string | null): string | null {
    return this.doc.lookupNamespaceURI(prefix)
  }

  lookupPrefix(ns: string): string | null {
    return this.doc.lookupPrefix(ns)
  }

  toNative(): unknown {
    return this.doc
  }
}

export class WechatMiniProgramDOMAdapter implements DOMAdapter {
  private serializer = new XMLSerializer()

  parseXML(str: string): XMLDocument {
    return new MiniProgramXMLDocument(new DOMParser().parseFromString(str, 'application/xml'))
  }

  parseHTML(str: string, _mimeType: string = 'text/html'): XMLDocument {
    return new MiniProgramXMLDocument(
      new DOMParser().parseFromString(normalizeHTMLVoidTags(str), 'text/html')
    )
  }

  serialize(doc: XMLDocument): string {
    const nativeDoc = doc.toNative?.()
    if (!nativeDoc) throw new EBookError('XMLDocument does not support toNative()', 'ADAPTER_ERROR')
    return this.serializer.serializeToString(nativeDoc as any)
  }

  getChildNodes(element: XMLElement): XMLNode[] {
    const nativeElement = (element as MiniProgramXMLElement).toNative?.()
    if (!nativeElement || !(nativeElement as any).childNodes) return element.children

    return nodeListToArray((nativeElement as any).childNodes).map(child => {
      if (child.nodeType === 1) return new MiniProgramXMLElement(child)
      if (child.nodeType === 3) return new MiniProgramXMLText(child, element)
      return new MiniProgramXMLNode(child, element)
    })
  }
}

export class WechatMiniProgramURLFactory implements URLFactory {
  private counter = 0
  private urls = new Map<string, { data: string | ArrayBuffer | Blob; mimeType: string; localPath?: string }>()

  createURL(data: string | ArrayBuffer | Blob, mimeType = 'application/octet-stream'): string {
    if (isBlobLike(data)) {
      throw new EBookError(
        'WechatMiniProgramURLFactory cannot synchronously encode Blob data; pass ArrayBuffer or string data instead',
        'ADAPTER_ERROR'
      )
    }

    const fsInfo = getWechatMiniProgramFileSystem()
    if (fsInfo && mimeType.startsWith('image/')) {
      const ext = getMimeExtension(mimeType)
      const url = `${fsInfo.root}/rebook-resource-${Date.now()}-${this.counter++}.${ext}`
      try {
        if (typeof data === 'string') {
          fsInfo.fs.writeFileSync(url, data, 'utf8')
        } else {
          fsInfo.fs.writeFileSync(url, data)
        }
        this.urls.set(url, { data, mimeType, localPath: url })
        debugResource('wrote image resource', {
          url,
          mimeType,
          bytes: typeof data === 'string' ? data.length : data.byteLength,
        })
        return url
      } catch (error) {
        debugResource('failed to write image resource, falling back to data URL', {
          mimeType,
          error: error instanceof Error ? error.message : String(error),
        })
        // Fall back to data URLs when local file writes are unavailable.
      }
    } else if (mimeType.startsWith('image/')) {
      debugResource('mini program filesystem unavailable, falling back to data URL', { mimeType })
    }

    const url = `data:${mimeType};base64,${encodeBase64(data)}`
    this.urls.set(url, { data, mimeType })
    return url
  }

  revokeURL(url: string): void {
    const entry = this.urls.get(url)
    if (entry?.localPath) {
      try {
        getWechatMiniProgramFileSystem()?.fs.unlinkSync?.(entry.localPath)
      } catch {
        // Best-effort cleanup only.
      }
    }
    this.urls.delete(url)
  }

  getData(url: string): { data: string | ArrayBuffer | Blob; mimeType: string } | undefined {
    return this.urls.get(url)
  }
}
