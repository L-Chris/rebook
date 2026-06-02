import * as csstree from 'css-tree'

export interface SimpleClassRule {
    matches(tagName: string, classNames: ReadonlySet<string>): boolean
    declarations: string
}

export function parseStyleDeclarations(style?: string): Array<[string, string]> {
    if (!style) return []
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
        return result
    } catch {
        return []
    }
}

export function normalizeStyleDeclarations(style: string): string {
    return parseStyleDeclarations(style)
        .map(([name, value]) => `${name}: ${value}`)
        .join('; ')
}

export function mergeStyleDeclarations(base: string, override: string): string {
    const merged = new Map<string, string>()
    for (const [name, value] of parseStyleDeclarations(base)) merged.set(name, value)
    for (const [name, value] of parseStyleDeclarations(override)) merged.set(name, value)
    return [...merged.entries()].map(([name, value]) => `${name}: ${value}`).join('; ')
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
                    declarations,
                    matches: (tagName, classNames) =>
                        (!parsed.tagName || parsed.tagName === tagName)
                        && parsed.classNames.every(className => classNames.has(className)),
                })
            }
        }})
    } catch {
        // ignore parse errors
    }
    return rules
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
