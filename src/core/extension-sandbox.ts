import type { RebookDisposable, RebookExtensionManifest } from './extensions'

export const REBOOK_EXTENSION_SANDBOX_PROTOCOL_VERSION = 1 as const

export type RebookExtensionSandboxRuntime = 'worker' | 'iframe'

export interface RebookExtensionSandboxError {
    readonly name: string
    readonly message: string
    readonly code?: string
}

interface RebookExtensionSandboxMessageBase {
    readonly protocol: typeof REBOOK_EXTENSION_SANDBOX_PROTOCOL_VERSION
    readonly channel: string
}

export interface RebookExtensionSandboxRequest extends RebookExtensionSandboxMessageBase {
    readonly type: 'request'
    readonly id: string
    readonly method: string
    readonly params?: unknown
}

export interface RebookExtensionSandboxResponse extends RebookExtensionSandboxMessageBase {
    readonly type: 'response'
    readonly id: string
    readonly result?: unknown
    readonly error?: RebookExtensionSandboxError
}

export interface RebookExtensionSandboxEvent extends RebookExtensionSandboxMessageBase {
    readonly type: 'event'
    readonly event: string
    readonly data?: unknown
}

export type RebookExtensionSandboxMessage =
    | RebookExtensionSandboxRequest
    | RebookExtensionSandboxResponse
    | RebookExtensionSandboxEvent

export interface RebookExtensionSandboxEndpoint {
    postMessage(message: RebookExtensionSandboxMessage): void
    subscribe(listener: (message: unknown) => void): RebookDisposable
    terminate?(): void
}

export interface RebookExtensionSandboxInit {
    readonly manifest: RebookExtensionManifest
    readonly settings: Record<string, unknown>
    readonly locale?: string
}

export interface RebookExtensionSandboxRequestOptions {
    readonly timeoutMs?: number
}

export type RebookExtensionSandboxRequestHandler = (params: unknown) => unknown | Promise<unknown>
export type RebookExtensionSandboxEventHandler = (data: unknown) => void

type PendingRequest = {
    resolve(value: unknown): void
    reject(error: Error): void
    timer: ReturnType<typeof setTimeout>
}

/**
 * Runtime-neutral RPC bridge shared by Worker and sandboxed iframe hosts.
 * The endpoint owns the actual browser boundary; this class owns protocol
 * validation, request correlation, timeouts, errors, and disposal.
 */
export class RebookExtensionSandboxBridge implements RebookDisposable {
    private readonly pending = new Map<string, PendingRequest>()
    private readonly requestHandlers = new Map<string, RebookExtensionSandboxRequestHandler>()
    private readonly eventHandlers = new Map<string, Set<RebookExtensionSandboxEventHandler>>()
    private readonly subscription: RebookDisposable
    private sequence = 0
    private disposed = false

    constructor(
        readonly channel: string,
        private readonly endpoint: RebookExtensionSandboxEndpoint,
        private readonly defaultTimeoutMs = 15_000,
    ) {
        if (!channel.trim()) throw new Error('Rebook extension sandbox channel must be non-empty.')
        this.subscription = endpoint.subscribe(message => this.accept(message))
    }

    request<T = unknown>(method: string, params?: unknown, options: RebookExtensionSandboxRequestOptions = {}): Promise<T> {
        this.assertActive()
        assertNonEmpty(method, 'sandbox request method')
        const id = `${this.channel}:${++this.sequence}`
        const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs
        if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('Sandbox request timeout must be positive.')
        return new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id)
                reject(new Error(`Sandbox request "${method}" timed out after ${timeoutMs} ms.`))
            }, timeoutMs)
            this.pending.set(id, {
                resolve: value => resolve(value as T),
                reject,
                timer,
            })
            try {
                this.endpoint.postMessage({
                    protocol: REBOOK_EXTENSION_SANDBOX_PROTOCOL_VERSION,
                    channel: this.channel,
                    type: 'request',
                    id,
                    method,
                    params,
                })
            } catch (error) {
                clearTimeout(timer)
                this.pending.delete(id)
                reject(toError(error))
            }
        })
    }

    handle(method: string, handler: RebookExtensionSandboxRequestHandler): RebookDisposable {
        this.assertActive()
        assertNonEmpty(method, 'sandbox request method')
        if (this.requestHandlers.has(method)) throw new Error(`Sandbox request handler "${method}" is already registered.`)
        this.requestHandlers.set(method, handler)
        return { dispose: () => { if (this.requestHandlers.get(method) === handler) this.requestHandlers.delete(method) } }
    }

    emit(event: string, data?: unknown): void {
        this.assertActive()
        assertNonEmpty(event, 'sandbox event')
        this.endpoint.postMessage({
            protocol: REBOOK_EXTENSION_SANDBOX_PROTOCOL_VERSION,
            channel: this.channel,
            type: 'event',
            event,
            data,
        })
    }

    on(event: string, handler: RebookExtensionSandboxEventHandler): RebookDisposable {
        this.assertActive()
        assertNonEmpty(event, 'sandbox event')
        const handlers = this.eventHandlers.get(event) ?? new Set<RebookExtensionSandboxEventHandler>()
        handlers.add(handler)
        this.eventHandlers.set(event, handlers)
        return {
            dispose: () => {
                handlers.delete(handler)
                if (!handlers.size) this.eventHandlers.delete(event)
            },
        }
    }

    dispose(): void {
        if (this.disposed) return
        this.disposed = true
        this.subscription.dispose()
        this.endpoint.terminate?.()
        for (const pending of this.pending.values()) {
            clearTimeout(pending.timer)
            pending.reject(new Error('Sandbox bridge was disposed.'))
        }
        this.pending.clear()
        this.requestHandlers.clear()
        this.eventHandlers.clear()
    }

    private accept(value: unknown): void {
        if (this.disposed || !isRebookExtensionSandboxMessage(value) || value.channel !== this.channel) return
        if (value.type === 'response') {
            const pending = this.pending.get(value.id)
            if (!pending) return
            clearTimeout(pending.timer)
            this.pending.delete(value.id)
            if (value.error) pending.reject(fromSandboxError(value.error))
            else pending.resolve(value.result)
            return
        }
        if (value.type === 'event') {
            for (const handler of this.eventHandlers.get(value.event) ?? []) handler(value.data)
            return
        }
        void this.respond(value)
    }

    private async respond(request: RebookExtensionSandboxRequest): Promise<void> {
        const handler = this.requestHandlers.get(request.method)
        if (!handler) {
            this.sendResponse(request.id, undefined, new Error(`Sandbox method "${request.method}" is not available.`))
            return
        }
        try {
            this.sendResponse(request.id, await handler(request.params))
        } catch (error) {
            this.sendResponse(request.id, undefined, toError(error))
        }
    }

    private sendResponse(id: string, result?: unknown, error?: Error): void {
        if (this.disposed) return
        this.endpoint.postMessage({
            protocol: REBOOK_EXTENSION_SANDBOX_PROTOCOL_VERSION,
            channel: this.channel,
            type: 'response',
            id,
            result: error ? undefined : result,
            error: error ? serializeError(error) : undefined,
        })
    }

    private assertActive(): void {
        if (this.disposed) throw new Error('Sandbox bridge is disposed.')
    }
}

export function createRebookExtensionSandboxBridge(
    channel: string,
    endpoint: RebookExtensionSandboxEndpoint,
    defaultTimeoutMs?: number,
): RebookExtensionSandboxBridge {
    return new RebookExtensionSandboxBridge(channel, endpoint, defaultTimeoutMs)
}

export function isRebookExtensionSandboxMessage(value: unknown): value is RebookExtensionSandboxMessage {
    if (!value || typeof value !== 'object') return false
    const message = value as Record<string, unknown>
    if (message.protocol !== REBOOK_EXTENSION_SANDBOX_PROTOCOL_VERSION) return false
    if (typeof message.channel !== 'string' || !message.channel) return false
    if (message.type === 'request') {
        return typeof message.id === 'string' && Boolean(message.id)
            && typeof message.method === 'string' && Boolean(message.method)
    }
    if (message.type === 'response') {
        return typeof message.id === 'string' && Boolean(message.id)
            && (message.error === undefined || isSandboxError(message.error))
    }
    if (message.type === 'event') return typeof message.event === 'string' && Boolean(message.event)
    return false
}

function serializeError(error: Error): RebookExtensionSandboxError {
    const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined
    return { name: error.name || 'Error', message: error.message || 'Sandbox request failed.', code }
}

function fromSandboxError(value: RebookExtensionSandboxError): Error {
    const error = new Error(value.message)
    error.name = value.name || 'Error'
    if (value.code) Object.assign(error, { code: value.code })
    return error
}

function isSandboxError(value: unknown): value is RebookExtensionSandboxError {
    return Boolean(value && typeof value === 'object'
        && typeof (value as Record<string, unknown>).name === 'string'
        && typeof (value as Record<string, unknown>).message === 'string')
}

function toError(value: unknown): Error {
    return value instanceof Error ? value : new Error(String(value))
}

function assertNonEmpty(value: string, label: string): void {
    if (!value.trim()) throw new Error(`${label} must be non-empty.`)
}
