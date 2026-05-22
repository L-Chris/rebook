/**
 * Zip-based loader using @zip.js/zip.js.
 * Provides file-level access to zip archive contents.
 */

import type { Loader, LoaderEntry } from '../core/loader'

// Type for zip.js entries (FileEntry has getData, DirectoryEntry does not)
interface ZipFileEntry {
    filename: string
    uncompressedSize: number
    getData(writer: unknown): Promise<unknown>
}

/** Input types accepted by the zip loader */
export type ZipInput = File | Blob | ArrayBuffer

/** Duck-type check for Blob-like objects */
const isBlobLike = (obj: unknown): obj is Blob =>
    obj != null && typeof obj === 'object' && 'arrayBuffer' in obj && typeof (obj as Blob).slice === 'function'

/**
 * Create a Loader from a File/Blob/ArrayBuffer that is a zip archive.
 * Uses @zip.js/zip.js for efficient random access.
 */
export async function createZipLoader(input: ZipInput): Promise<Loader> {
    const { configure, ZipReader, BlobReader, Uint8ArrayReader, TextWriter, BlobWriter } =
        await import('@zip.js/zip.js')

    configure({ useWebWorkers: false })

    // Create appropriate reader based on input type
    const reader = isBlobLike(input)
        ? new ZipReader(new BlobReader(input))
        : new ZipReader(new Uint8ArrayReader(new Uint8Array(input)))

    const entries = await reader.getEntries() as unknown as ZipFileEntry[]
    const map = new Map(entries.map(entry => [entry.filename, entry]))

    const loaderEntries: LoaderEntry[] = entries.map(entry => ({
        filename: entry.filename,
        size: entry.uncompressedSize,
    }))

    const loadText = async (filename: string): Promise<string | null> => {
        const entry = map.get(filename)
        if (!entry) return null
        return entry.getData(new TextWriter()) as Promise<string>
    }

    const loadBlob = async (filename: string, type?: string): Promise<Blob | null> => {
        const entry = map.get(filename)
        if (!entry) return null
        return entry.getData(new BlobWriter(type)) as Promise<Blob>
    }

    const getSize = (filename: string): number => {
        return map.get(filename)?.uncompressedSize ?? 0
    }

    return {
        entries: loaderEntries,
        loadText,
        loadBlob,
        getSize,
    }
}

/**
 * Check if a File/Blob is a zip archive by reading its magic bytes.
 */
export async function isZipFile(input: ZipInput): Promise<boolean> {
    let buffer: ArrayBuffer
    if (isBlobLike(input)) {
        buffer = await input.slice(0, 4).arrayBuffer()
    } else {
        buffer = input.slice(0, 4)
    }
    const arr = new Uint8Array(buffer)
    return arr[0] === 0x50 && arr[1] === 0x4b && arr[2] === 0x03 && arr[3] === 0x04
}
