import { deflateSync } from 'node:zlib'

export function makeSimplePdf(): Uint8Array {
    return buildClassicXrefPdf(makePageObjects(
        makeContentStream('BT /F1 18 Tf 48 96 Td (Hello Rebook PDF) Tj T* (Fast path) Tj ET'),
    ))
}

export function makeFlatePdf(): Uint8Array {
    const content = new TextEncoder().encode('BT /F1 18 Tf 48 96 Td (Compressed Rebook PDF) Tj ET')
    return buildClassicXrefPdf(makePageObjects(
        makeContentStream(deflateSync(content), '/Filter /FlateDecode '),
    ))
}

export function makeOutlinePdf(options: { titleObject?: string } = {}): Uint8Array {
    const titleObject = options.titleObject ?? pdfLiteralString('Chapter 1')
    return buildClassicXrefPdf([
        '1 0 obj\n<< /Type /Catalog /Pages 2 0 R /Outlines 6 0 R >>\nendobj\n',
        '2 0 obj\n<< /Type /Pages /MediaBox [0 0 300 144] /Kids [3 0 R] /Count 1 >>\nendobj\n',
        '3 0 obj\n<< /Type /Page /Parent 2 0 R /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
        makeContentStream('BT /F1 18 Tf 48 96 Td (Outlined page) Tj ET'),
        '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
        '6 0 obj\n<< /Type /Outlines /First 7 0 R /Last 7 0 R /Count 1 >>\nendobj\n',
        `7 0 obj\n<< /Title ${titleObject} /Parent 6 0 R /Dest [3 0 R /XYZ 0 144 null] >>\nendobj\n`,
    ])
}

export function pdfUtf16BeHexString(value: string): string {
    let hex = 'FEFF'
    for (let index = 0; index < value.length; index++) {
        hex += value.charCodeAt(index).toString(16).padStart(4, '0')
    }
    return `<${hex.toUpperCase()}>`
}

export function pdfUtf8HexString(value: string): string {
    const bytes = new TextEncoder().encode(value)
    let hex = 'EFBBBF'
    for (const byte of bytes) hex += byte.toString(16).padStart(2, '0')
    return `<${hex.toUpperCase()}>`
}

function makePageObjects(contentObject: string): string[] {
    return [
        '1 0 obj\n<< /Type /Catalog /Pages 2 0 R /PageLabels 6 0 R >>\nendobj\n',
        '2 0 obj\n<< /Type /Pages /MediaBox [0 0 300 144] /Kids [3 0 R] /Count 1 >>\nendobj\n',
        '3 0 obj\n<< /Type /Page /Parent 2 0 R /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
        contentObject,
        '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
        '6 0 obj\n<< /Nums [0 << /S /D /St 1 >>] >>\nendobj\n',
    ]
}

function makeContentStream(content: string | Uint8Array, extraDict = ''): string {
    const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content
    const body = bytesToLatin1(bytes)
    const length = bytes.byteLength
    return `4 0 obj\n<< ${extraDict}/Length ${length} >>\nstream\n${body}\nendstream\nendobj\n`
}

function pdfLiteralString(value: string): string {
    return `(${value.replace(/[\\()]/g, match => `\\${match}`)})`
}

function buildClassicXrefPdf(objects: string[]): Uint8Array {
    let output = '%PDF-1.7\n%\x80\x80\x80\x80\n'
    const offsets = [0]
    for (const object of objects) {
        offsets.push(output.length)
        output += object
    }

    const xrefOffset = output.length
    output += `xref\n0 ${objects.length + 1}\n`
    output += '0000000000 65535 f \n'
    for (const offset of offsets.slice(1)) {
        output += `${offset.toString().padStart(10, '0')} 00000 n \n`
    }
    output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
    return latin1ToBytes(output)
}

function bytesToLatin1(bytes: Uint8Array): string {
    let output = ''
    for (const byte of bytes) output += String.fromCharCode(byte)
    return output
}

function latin1ToBytes(value: string): Uint8Array {
    const bytes = new Uint8Array(value.length)
    for (let index = 0; index < value.length; index++) {
        bytes[index] = value.charCodeAt(index) & 0xff
    }
    return bytes
}
