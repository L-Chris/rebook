import { describe, expect, it } from 'vitest'
import { readRasterImageDimensions } from '../../src/core/image-size'

describe('readRasterImageDimensions', () => {
    it('reads PNG dimensions', () => {
        const bytes = new Uint8Array(24)
        bytes.set([0x89, 0x50, 0x4e, 0x47])
        writeUint32BE(bytes, 16, 640)
        writeUint32BE(bytes, 20, 480)

        expect(readRasterImageDimensions(bytes)).toEqual({ width: 640, height: 480 })
    })

    it('reads JPEG dimensions from the start-of-frame segment', () => {
        const bytes = new Uint8Array([
            0xff, 0xd8,
            0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
            0xff, 0xc0, 0x00, 0x11, 0x08,
            0x02, 0x58,
            0x03, 0x20,
            0x03, 0x01, 0x00, 0x00,
            0x02, 0x00, 0x00,
            0x03, 0x00, 0x00,
        ])

        expect(readRasterImageDimensions(bytes)).toEqual({ width: 800, height: 600 })
    })

    it('reads GIF dimensions', () => {
        const bytes = new Uint8Array([
            0x47, 0x49, 0x46, 0x38, 0x39, 0x61,
            0x40, 0x01,
            0xf0, 0x00,
        ])

        expect(readRasterImageDimensions(bytes)).toEqual({ width: 320, height: 240 })
    })

    it('reads WebP dimensions for VP8, VP8L, and VP8X chunks', () => {
        const vp8 = new Uint8Array(30)
        vp8.set([...fourCC('RIFF'), 0, 0, 0, 0, ...fourCC('WEBP'), ...fourCC('VP8 ')])
        vp8.set([0, 0, 0, 0], 16)
        vp8.set([0, 0, 0, 0x9d, 0x01, 0x2a], 20)
        writeUint16LE(vp8, 26, 1024)
        writeUint16LE(vp8, 28, 768)

        const vp8l = new Uint8Array(25)
        vp8l.set([...fourCC('RIFF'), 0, 0, 0, 0, ...fourCC('WEBP'), ...fourCC('VP8L')])
        vp8l.set([0, 0, 0, 0, 0x2f], 16)
        writeUint32LE(vp8l, 21, (480 - 1) << 14 | (640 - 1))

        const vp8x = new Uint8Array(30)
        vp8x.set([...fourCC('RIFF'), 0, 0, 0, 0, ...fourCC('WEBP'), ...fourCC('VP8X')])
        vp8x.set([0, 0, 0, 0, 0], 16)
        writeUint24LE(vp8x, 24, 300 - 1)
        writeUint24LE(vp8x, 27, 200 - 1)

        expect(readRasterImageDimensions(vp8)).toEqual({ width: 1024, height: 768 })
        expect(readRasterImageDimensions(vp8l)).toEqual({ width: 640, height: 480 })
        expect(readRasterImageDimensions(vp8x)).toEqual({ width: 300, height: 200 })
    })
})

function fourCC(value: string): number[] {
    return Array.from(value, char => char.charCodeAt(0))
}

function writeUint16LE(bytes: Uint8Array, offset: number, value: number): void {
    bytes[offset] = value & 0xff
    bytes[offset + 1] = value >> 8
}

function writeUint24LE(bytes: Uint8Array, offset: number, value: number): void {
    bytes[offset] = value & 0xff
    bytes[offset + 1] = (value >> 8) & 0xff
    bytes[offset + 2] = (value >> 16) & 0xff
}

function writeUint32LE(bytes: Uint8Array, offset: number, value: number): void {
    bytes[offset] = value & 0xff
    bytes[offset + 1] = (value >> 8) & 0xff
    bytes[offset + 2] = (value >> 16) & 0xff
    bytes[offset + 3] = (value >> 24) & 0xff
}

function writeUint32BE(bytes: Uint8Array, offset: number, value: number): void {
    bytes[offset] = (value >> 24) & 0xff
    bytes[offset + 1] = (value >> 16) & 0xff
    bytes[offset + 2] = (value >> 8) & 0xff
    bytes[offset + 3] = value & 0xff
}
