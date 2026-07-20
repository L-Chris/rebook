import { describe, expect, it } from 'vitest'
import {
    createRebookExtensionSandboxBridge,
    isRebookExtensionSandboxMessage,
    type RebookExtensionSandboxEndpoint,
    type RebookExtensionSandboxMessage,
} from '../../src/core/extension-sandbox'

describe('RebookExtensionSandboxBridge', () => {
    it('correlates requests and responses across a structured-clone boundary', async () => {
        const [hostEndpoint, sandboxEndpoint] = createEndpointPair()
        const host = createRebookExtensionSandboxBridge('channel-a', hostEndpoint)
        const sandbox = createRebookExtensionSandboxBridge('channel-a', sandboxEndpoint)
        sandbox.handle('sum', params => {
            const values = params as number[]
            return values.reduce((total, value) => total + value, 0)
        })

        await expect(host.request('sum', [2, 3, 5])).resolves.toBe(10)

        host.dispose()
        sandbox.dispose()
    })

    it('propagates sanitized remote errors', async () => {
        const [hostEndpoint, sandboxEndpoint] = createEndpointPair()
        const host = createRebookExtensionSandboxBridge('channel-b', hostEndpoint)
        const sandbox = createRebookExtensionSandboxBridge('channel-b', sandboxEndpoint)
        sandbox.handle('fail', () => { throw Object.assign(new Error('denied'), { code: 'DENIED' }) })

        await expect(host.request('fail')).rejects.toMatchObject({ message: 'denied', code: 'DENIED' })

        host.dispose()
        sandbox.dispose()
    })

    it('delivers events only on the matching channel', async () => {
        const [hostEndpoint, sandboxEndpoint] = createEndpointPair()
        const host = createRebookExtensionSandboxBridge('channel-c', hostEndpoint)
        const sandbox = createRebookExtensionSandboxBridge('channel-c', sandboxEndpoint)
        const values: unknown[] = []
        host.on('log', value => values.push(value))

        sandbox.emit('log', { message: 'ready' })
        await Promise.resolve()
        expect(values).toEqual([{ message: 'ready' }])

        host.dispose()
        sandbox.dispose()
    })

    it('rejects pending work when disposed', async () => {
        const endpoint: RebookExtensionSandboxEndpoint = {
            postMessage() {},
            subscribe() { return { dispose() {} } },
        }
        const host = createRebookExtensionSandboxBridge('channel-d', endpoint, 30_000)
        const pending = host.request('never')
        host.dispose()
        await expect(pending).rejects.toThrow('disposed')
    })

    it('validates protocol envelopes', () => {
        expect(isRebookExtensionSandboxMessage({
            protocol: 1,
            channel: 'valid',
            type: 'event',
            event: 'ready',
        })).toBe(true)
        expect(isRebookExtensionSandboxMessage({
            protocol: 2,
            channel: 'valid',
            type: 'event',
            event: 'ready',
        })).toBe(false)
    })
})

function createEndpointPair(): [RebookExtensionSandboxEndpoint, RebookExtensionSandboxEndpoint] {
    const listeners: Array<Set<(message: unknown) => void>> = [new Set(), new Set()]
    const endpoint = (own: number, other: number): RebookExtensionSandboxEndpoint => ({
        postMessage(message: RebookExtensionSandboxMessage) {
            const cloned = structuredClone(message)
            queueMicrotask(() => {
                for (const listener of listeners[other]) listener(cloned)
            })
        },
        subscribe(listener) {
            listeners[own].add(listener)
            return { dispose: () => { listeners[own].delete(listener) } }
        },
    })
    return [endpoint(0, 1), endpoint(1, 0)]
}
