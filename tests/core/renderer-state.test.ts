import { describe, expect, it, vi } from 'vitest'
import type { EventListener, ReaderMark } from '../../src/core/renderer'
import { ReaderMarkStore, RendererEventDispatcher } from '../../src/core/renderer-state'

describe('renderer state core', () => {
    it('stores and clears reader marks by kind', () => {
        const store = new ReaderMarkStore()
        const tts: ReaderMark = {
            id: 'tts-1',
            kind: 'tts',
            location: { type: 'reflowable', sectionIndex: 0, blockId: 'p1' },
        }
        const highlight: ReaderMark = {
            id: 'highlight-1',
            kind: 'highlight',
            location: { type: 'fixed', format: 'pdf', pageIndex: 0 },
        }

        store.set(tts)
        store.set(highlight)
        store.clear('tts')

        expect(store.getAll()).toEqual([highlight])
        store.remove('highlight-1')
        expect(store.getAll()).toEqual([])
    })

    it('dispatches renderer events and replays listeners to another target', () => {
        const events = new RendererEventDispatcher<{ relocate: { index: number } }>()
        const first = vi.fn()
        const replayed = vi.fn()
        const target = {
            listeners: new Map<string, EventListener>(),
            on(event: string, listener: EventListener) {
                this.listeners.set(event, listener)
                replayed(event)
            },
        }

        events.on('relocate', first)
        events.emit('relocate', { index: 3 })
        events.replayTo(target)
        target.listeners.get('relocate')?.({ index: 4 })

        expect(first).toHaveBeenCalledWith({ index: 3 })
        expect(first).toHaveBeenCalledWith({ index: 4 })
        expect(replayed).toHaveBeenCalledWith('relocate')
    })
})
