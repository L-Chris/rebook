const DEBUG_FLAG = '__REBOOK_DEBUG__'

type DebugGlobal = typeof globalThis & {
    __REBOOK_DEBUG__?: boolean
}

export function setRebookDebug(enabled: boolean): void {
    ;(globalThis as DebugGlobal)[DEBUG_FLAG] = enabled
}

export function isRebookDebugEnabled(): boolean {
    return (globalThis as DebugGlobal)[DEBUG_FLAG] === true
}

export function debugRebook(scope: string, message: string, details?: Record<string, unknown>): void {
    if (!isRebookDebugEnabled()) return
    console.log(`[rebook:${scope}] ${message}`, details ?? {})
}
