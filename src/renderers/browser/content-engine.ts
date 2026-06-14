import type {
    ContentEngine,
    ContentEngineRoute,
    ContentEngineRouteMatch,
} from '../../core/content-engine-router'

export type BrowserContentEngine = ContentEngine

export type BrowserContentEngineMatch = ContentEngineRouteMatch

export type BrowserContentEngineRoute = ContentEngineRoute<BrowserContentEngine>
