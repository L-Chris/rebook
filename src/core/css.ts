import * as csstree from 'css-tree'

export interface SimpleClassRule {
    order: number
    tagName?: string
    classNames: readonly string[]
    matches(tagName: string, classNames: ReadonlySet<string>): boolean
    declarations: string
}

export interface SimpleClassRuleIndex {
    rules: readonly SimpleClassRule[]
    getMatchingRules(tagName: string, classNames: ReadonlySet<string>): readonly SimpleClassRule[]
}

interface SimpleClassRuleBucket {
    allTags: SimpleClassRule[]
    byTagName: Map<string, SimpleClassRule[]>
    mergedByTagName: Map<string, readonly SimpleClassRule[]>
}

const MAX_STYLE_CACHE_ENTRIES = 4096
const parsedStyleDeclarationCache = new Map<string, Array<[string, string]>>()
const mergedStyleDeclarationCache = new Map<string, string>()

export function parseStyleDeclarations(style?: string): Array<[string, string]> {
    if (!style) return []
    const cached = parsedStyleDeclarationCache.get(style)
    if (cached) return cached

    try {
        const ast = csstree.parse(style, { context: 'declarationList' })
        const result: Array<[string, string]> = []
        csstree.walk(ast, (node) => {
            if (node.type === 'Declaration') {
                const name = node.property.trim().toLowerCase()
                const value = csstree.generate(node.value).trim()
                if (name && value) result.push([name, value])
            }
        })
        setBoundedCache(parsedStyleDeclarationCache, style, result)
        return result
    } catch {
        setBoundedCache(parsedStyleDeclarationCache, style, [])
        return []
    }
}

export function normalizeStyleDeclarations(style: string): string {
    return parseStyleDeclarations(style)
        .map(([name, value]) => `${name}: ${value}`)
        .join('; ')
}

export function mergeStyleDeclarations(base: string, override: string): string {
    const cacheKey = `${base}\u0000${override}`
    const cached = mergedStyleDeclarationCache.get(cacheKey)
    if (cached !== undefined) return cached

    const merged = new Map<string, string>()
    for (const [name, value] of parseStyleDeclarations(base)) merged.set(name, value)
    for (const [name, value] of parseStyleDeclarations(override)) merged.set(name, value)
    const result = [...merged.entries()].map(([name, value]) => `${name}: ${value}`).join('; ')
    setBoundedCache(mergedStyleDeclarationCache, cacheKey, result)
    return result
}

function setBoundedCache<T>(cache: Map<string, T>, key: string, value: T): void {
    if (cache.size >= MAX_STYLE_CACHE_ENTRIES && !cache.has(key)) {
        const oldest = cache.keys().next().value
        if (oldest !== undefined) cache.delete(oldest)
    }
    cache.set(key, value)
}

export function parseSimpleClassRules(css: string): SimpleClassRule[] {
    const rules: SimpleClassRule[] = []
    try {
        const ast = csstree.parse(css, { context: 'stylesheet' })
        csstree.walk(ast, { visit: 'Rule', enter(rule) {
            const block = csstree.generate(rule.block)
            const declarations = normalizeStyleDeclarations(block.replace(/^\{/, '').replace(/\}$/, ''))
            if (!declarations) return

            if (rule.prelude.type !== 'SelectorList') return

            for (const selector of rule.prelude.children) {
                const parsed = parseSimpleClassSelector(selector as csstree.Selector)
                if (!parsed) continue
                rules.push({
                    order: rules.length,
                    tagName: parsed.tagName,
                    classNames: parsed.classNames,
                    declarations,
                    matches: (tagName, classNames) => matchesSimpleClassRule(parsed, tagName, classNames),
                })
            }
        }})
    } catch {
        // ignore parse errors
    }
    return rules
}

export function parseSimpleClassRuleIndex(css: string): SimpleClassRuleIndex {
    return createSimpleClassRuleIndex(parseSimpleClassRules(css))
}

export function createSimpleClassRuleIndex(rules: readonly SimpleClassRule[]): SimpleClassRuleIndex {
    const byClassName = new Map<string, SimpleClassRuleBucket>()
    for (const rule of rules) {
        const key = rule.classNames[0]
        if (!key) continue
        let bucket = byClassName.get(key)
        if (!bucket) {
            bucket = { allTags: [], byTagName: new Map(), mergedByTagName: new Map() }
            byClassName.set(key, bucket)
        }
        if (rule.tagName) {
            let tagRules = bucket.byTagName.get(rule.tagName)
            if (!tagRules) {
                tagRules = []
                bucket.byTagName.set(rule.tagName, tagRules)
            }
            tagRules.push(rule)
        } else {
            bucket.allTags.push(rule)
        }
    }

    return {
        rules,
        getMatchingRules(tagName, classNames) {
            if (!classNames.size) return []

            if (classNames.size === 1) {
                let onlyClass: string | undefined
                for (const className of classNames) onlyClass = className
                return getRuleBucketCandidates(onlyClass ? byClassName.get(onlyClass) : undefined, tagName)
                    ?.filter(rule => rule.matches(tagName, classNames))
                    ?? []
            }

            const candidates: SimpleClassRule[] = []
            const seen = new Set<number>()
            for (const className of classNames) {
                for (const rule of getRuleBucketCandidates(byClassName.get(className), tagName) ?? []) {
                    if (seen.has(rule.order)) continue
                    seen.add(rule.order)
                    candidates.push(rule)
                }
            }

            return candidates
                .filter(rule => rule.matches(tagName, classNames))
                .sort((a, b) => a.order - b.order)
        },
    }
}

function getRuleBucketCandidates(
    bucket: SimpleClassRuleBucket | undefined,
    tagName: string,
): readonly SimpleClassRule[] | undefined {
    if (!bucket) return undefined
    const tagRules = bucket.byTagName.get(tagName)
    if (!tagRules?.length) return bucket.allTags
    if (!bucket.allTags.length) return tagRules
    let merged = bucket.mergedByTagName.get(tagName)
    if (!merged) {
        merged = [...bucket.allTags, ...tagRules].sort((a, b) => a.order - b.order)
        bucket.mergedByTagName.set(tagName, merged)
    }
    return merged
}

function parseSimpleClassSelector(selector: csstree.Selector): { tagName?: string; classNames: string[] } | null {
    let tagName: string | undefined
    const classNames: string[] = []

    for (const child of selector.children) {
        if (child.type === 'TypeSelector') {
            tagName = child.name.toLowerCase()
        } else if (child.type === 'ClassSelector') {
            classNames.push(child.name)
        } else if (child.type === 'PseudoClassSelector' || child.type === 'PseudoElementSelector') {
            // skip pseudo-selectors
        } else {
            return null
        }
    }

    if (!classNames.length) return null
    return { tagName, classNames }
}

function matchesSimpleClassRule(
    rule: { tagName?: string; classNames: readonly string[] },
    tagName: string,
    classNames: ReadonlySet<string>,
): boolean {
    return (!rule.tagName || rule.tagName === tagName)
        && rule.classNames.every(className => classNames.has(className))
}

export function extractImportURLs(css: string): string[] {
    const urls: string[] = []
    try {
        const ast = csstree.parse(css, { context: 'stylesheet' })
        csstree.walk(ast, (node) => {
            if (node.type === 'Atrule' && node.name === 'import' && node.prelude) {
                csstree.walk(node.prelude, (n) => {
                    if (n.type === 'Url') {
                        urls.push(n.value)
                    } else if (n.type === 'String') {
                        urls.push(n.value)
                    }
                })
            }
        })
    } catch {
        // ignore parse errors
    }
    return urls
}
