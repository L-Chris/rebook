import type { EventListener, ReaderMark } from './renderer'

type EventName<TEvents extends object> = Extract<keyof TEvents, string>
type TypedEventListener<TEvents extends object, TEvent extends EventName<TEvents>> = (event: TEvents[TEvent]) => void

export interface RendererEventTarget {
    on(event: string, listener: EventListener): void
    off(event: string, listener: EventListener): void
}

export class ReaderMarkStore {
    private readonly marks = new Map<string, ReaderMark>()

    set(mark: ReaderMark): void {
        this.marks.set(mark.id, mark)
    }

    remove(id: string): void {
        this.marks.delete(id)
    }

    clear(kind?: string): void {
        if (kind === undefined) {
            this.marks.clear()
            return
        }
        for (const [id, mark] of this.marks) {
            if (mark.kind === kind) this.marks.delete(id)
        }
    }

    getAll(): ReaderMark[] {
        return Array.from(this.marks.values())
    }

    values(): IterableIterator<ReaderMark> {
        return this.marks.values()
    }
}

export class RendererEventDispatcher<TEvents extends object = Record<string, unknown>> {
    private readonly listeners = new Map<string, Set<EventListener>>()

    on<TEvent extends EventName<TEvents>>(event: TEvent, listener: TypedEventListener<TEvents, TEvent>): void
    on(event: string, listener: EventListener): void
    on(event: string, listener: EventListener): void {
        let listeners = this.listeners.get(event)
        if (!listeners) {
            listeners = new Set()
            this.listeners.set(event, listeners)
        }
        listeners.add(listener)
    }

    off<TEvent extends EventName<TEvents>>(event: TEvent, listener: TypedEventListener<TEvents, TEvent>): void
    off(event: string, listener: EventListener): void
    off(event: string, listener: EventListener): void {
        this.listeners.get(event)?.delete(listener)
    }

    emit<TEvent extends EventName<TEvents>>(event: TEvent, payload: TEvents[TEvent]): void
    emit(event: string, payload: unknown): void
    emit(event: string, payload: unknown): void {
        for (const listener of this.listeners.get(event) ?? []) listener(payload)
    }

    replayTo(renderer: Pick<RendererEventTarget, 'on'>): void {
        for (const [event, listeners] of this.listeners) {
            for (const listener of listeners) renderer.on(event, listener)
        }
    }

    detachFrom(renderer: Pick<RendererEventTarget, 'off'>): void {
        for (const [event, listeners] of this.listeners) {
            for (const listener of listeners) renderer.off(event, listener)
        }
    }

    clear(): void {
        this.listeners.clear()
    }
}
