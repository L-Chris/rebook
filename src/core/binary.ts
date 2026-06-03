/**
 * Environment-neutral binary helpers.
 *
 * WeChat Mini Program and some JS runtimes can handle ArrayBuffer data but do
 * not expose browser File/Blob constructors. Runtime checks must therefore use
 * duck typing and ArrayBuffer-backed adapters instead of direct instanceof
 * checks against browser globals.
 */

export interface BlobLike {
    size: number
    type?: string
    name?: string
    slice(start?: number, end?: number, contentType?: string): BlobLike
    arrayBuffer(): Promise<ArrayBuffer>
    text?(): Promise<string>
    stream?(): ReadableStream<Uint8Array>
}

export class ArrayBufferBlob implements BlobLike {
    readonly size: number

    constructor(
        private readonly buffer: ArrayBuffer,
        readonly type = '',
        readonly name?: string,
    ) {
        this.size = buffer.byteLength
    }

    slice(start = 0, end = this.size, contentType = this.type): BlobLike {
        const normalizedStart = Math.max(0, start < 0 ? this.size + start : start)
        const normalizedEnd = Math.max(normalizedStart, Math.min(this.size, end < 0 ? this.size + end : end))
        return new ArrayBufferBlob(this.buffer.slice(normalizedStart, normalizedEnd), contentType)
    }

    async arrayBuffer(): Promise<ArrayBuffer> {
        return this.buffer.slice(0)
    }

    async text(): Promise<string> {
        return new TextDecoder().decode(this.buffer)
    }

    stream(): ReadableStream<Uint8Array> {
        if (typeof ReadableStream === 'undefined') {
            throw new Error('ReadableStream is not available in this environment')
        }
        const bytes = new Uint8Array(this.buffer)
        return new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(bytes)
                controller.close()
            },
        })
    }
}

export function hasBlobConstructor(): boolean {
    return typeof Blob !== 'undefined'
}

export function isNativeBlob(input: unknown): input is Blob {
    return hasBlobConstructor() && input instanceof Blob
}

export function isBlobLike(input: unknown): input is BlobLike {
    return !!input
        && typeof input === 'object'
        && typeof (input as BlobLike).arrayBuffer === 'function'
        && typeof (input as BlobLike).slice === 'function'
        && typeof (input as BlobLike).size === 'number'
}

export function getInputName(input: unknown): string | undefined {
    const name = (input as { name?: unknown })?.name
    return typeof name === 'string' ? name : undefined
}

export function isFileLike(input: unknown): input is BlobLike & { name: string } {
    return isBlobLike(input) && typeof input.name === 'string'
}

export function toBlobLike(input: ArrayBuffer | BlobLike | Blob, type = ''): BlobLike {
    if (input instanceof ArrayBuffer) return new ArrayBufferBlob(input, type)
    if (isBlobLike(input)) return input
    throw new TypeError('Expected ArrayBuffer or Blob-like input')
}

export async function blobLikeToNativeBlob(input: BlobLike, type = input.type ?? ''): Promise<Blob> {
    if (!hasBlobConstructor()) {
        throw new Error('Blob is not available in this environment')
    }
    if (isNativeBlob(input)) return input
    return new Blob([await input.arrayBuffer()], { type })
}
