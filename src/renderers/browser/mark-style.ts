import type { ReaderMark } from '../../core/renderer'

const DEFAULT_MARK_COLOR = 'rgba(255, 214, 10, 0.35)'

export function getBrowserMarkClassNames(mark: ReaderMark): string[] {
    const names = mark.className?.trim().split(/\s+/).filter(Boolean) ?? []
    if (mark.kind) names.push(`rebook-mark-${toKebabCase(mark.kind)}`)
    return names.length ? names : ['rebook-mark']
}

export function getBrowserMarkColor(mark: ReaderMark, fallback = DEFAULT_MARK_COLOR): string {
    const color = mark.data?.color
    return typeof color === 'string' ? color : fallback
}

export function applyBrowserMarkDataset(element: HTMLElement, mark: ReaderMark): void {
    for (const [key, value] of Object.entries(mark.data ?? {})) {
        element.dataset[`mark${toPascalCase(key)}`] = String(value)
    }
}

function toKebabCase(value: string): string {
    return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase()
}

function toPascalCase(value: string): string {
    return value
        .replace(/[^a-zA-Z0-9]+(.)/g, (_, char: string) => char.toUpperCase())
        .replace(/^[a-z]/, char => char.toUpperCase())
}
