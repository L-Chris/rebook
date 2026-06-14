import type { Renderer } from '../../core/renderer'
import type { Book } from '../../core/types'

export type BrowserContentEngine = Renderer

export type BrowserContentEngineMatch = boolean | number

export interface BrowserContentEngineRoute {
    readonly id: string
    match(book: Book): BrowserContentEngineMatch
    createEngine(): BrowserContentEngine
}
