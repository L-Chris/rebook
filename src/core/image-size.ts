export interface ImageDimensions {
    width: number
    height: number
}

const IMAGE_DIMENSION_PREFIX_SIZES = [4096, 16384, 65536, 262144] as const

export function readRasterImageDimensions(data: ArrayBuffer | Uint8Array): ImageDimensions | null {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    return readPNGDimensions(bytes, view)
        ?? readJPEGDimensions(bytes, view)
        ?? readGIFDimensions(bytes, view)
        ?? readWebPDimensions(bytes, view)
}

export async function readRasterImageDimensionsFromBlobPrefix(blob: Blob): Promise<ImageDimensions | null> {
    let lastReadSize = 0
    for (const prefixSize of IMAGE_DIMENSION_PREFIX_SIZES) {
        const readSize = Math.min(blob.size, prefixSize)
        if (readSize <= lastReadSize) continue
        const dimensions = readRasterImageDimensions(await blob.slice(0, readSize).arrayBuffer())
        if (dimensions) return dimensions
        lastReadSize = readSize
        if (readSize >= blob.size) break
    }
    return null
}

function readPNGDimensions(bytes: Uint8Array, view: DataView): ImageDimensions | null {
    if (
        bytes.length < 24
        || bytes[0] !== 0x89
        || bytes[1] !== 0x50
        || bytes[2] !== 0x4e
        || bytes[3] !== 0x47
    ) return null
    return { width: view.getUint32(16, false), height: view.getUint32(20, false) }
}

function readJPEGDimensions(bytes: Uint8Array, view: DataView): ImageDimensions | null {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null

    let offset = 2
    while (offset + 9 < bytes.length) {
        if (bytes[offset] !== 0xff) {
            offset++
            continue
        }

        const marker = bytes[offset + 1]
        if (marker === 0xd9 || marker === 0xda) return null
        const length = view.getUint16(offset + 2, false)
        if (length < 2) return null
        if (isJPEGStartOfFrame(marker)) {
            return {
                width: view.getUint16(offset + 7, false),
                height: view.getUint16(offset + 5, false),
            }
        }
        offset += 2 + length
    }
    return null
}

function readGIFDimensions(bytes: Uint8Array, view: DataView): ImageDimensions | null {
    if (
        bytes.length < 10
        || bytes[0] !== 0x47
        || bytes[1] !== 0x49
        || bytes[2] !== 0x46
    ) return null
    return { width: view.getUint16(6, true), height: view.getUint16(8, true) }
}

function readWebPDimensions(bytes: Uint8Array, view: DataView): ImageDimensions | null {
    if (
        bytes.length < 20
        || bytes[0] !== 0x52
        || bytes[1] !== 0x49
        || bytes[2] !== 0x46
        || bytes[3] !== 0x46
        || bytes[8] !== 0x57
        || bytes[9] !== 0x45
        || bytes[10] !== 0x42
        || bytes[11] !== 0x50
    ) return null

    if (hasFourCC(bytes, 12, 'VP8X')) {
        if (bytes.length < 30) return null
        return {
            width: readUint24LE(bytes, 24) + 1,
            height: readUint24LE(bytes, 27) + 1,
        }
    }

    if (hasFourCC(bytes, 12, 'VP8L')) {
        if (bytes.length < 25 || bytes[20] !== 0x2f) return null
        const bits = view.getUint32(21, true)
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
    }

    if (hasFourCC(bytes, 12, 'VP8 ')) {
        if (
            bytes.length < 30
            || bytes[23] !== 0x9d
            || bytes[24] !== 0x01
            || bytes[25] !== 0x2a
        ) return null
        return {
            width: view.getUint16(26, true) & 0x3fff,
            height: view.getUint16(28, true) & 0x3fff,
        }
    }

    return null
}

function hasFourCC(bytes: Uint8Array, offset: number, fourCC: string): boolean {
    return bytes.length >= offset + fourCC.length
        && bytes[offset] === fourCC.charCodeAt(0)
        && bytes[offset + 1] === fourCC.charCodeAt(1)
        && bytes[offset + 2] === fourCC.charCodeAt(2)
        && bytes[offset + 3] === fourCC.charCodeAt(3)
}

function readUint24LE(bytes: Uint8Array, offset: number): number {
    return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16)
}

function isJPEGStartOfFrame(marker: number): boolean {
    return marker >= 0xc0
        && marker <= 0xcf
        && marker !== 0xc4
        && marker !== 0xc8
        && marker !== 0xcc
}
