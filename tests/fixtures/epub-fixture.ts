/**
 * Test fixture: minimal EPUB generator
 * Creates a valid EPUB file as ArrayBuffer for testing the parser.
 */

import { configure, ZipWriter, BlobWriter, TextReader, Uint8ArrayReader } from '@zip.js/zip.js'

configure({ useWebWorkers: false })

export interface MinimalEPUBOptions {
    title?: string
    author?: string
    language?: string
    identifier?: string
    chapters?: Array<{
        id: string
        title: string
        content: string
    }>
    resources?: Array<{
        id: string
        href: string
        mediaType: string
        properties?: string
        data: Uint8Array | string
    }>
}

const defaultChapter = {
    id: 'chapter1',
    title: 'Chapter 1',
    content: '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter 1</title></head><body><h1 id="ch1">Chapter 1</h1><p>Hello, world!</p></body></html>',
}

const containerXML = `<?xml version="1.0" encoding="UTF-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
    <rootfiles>
        <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
    </rootfiles>
</container>`

const generateOPF = (options: MinimalEPUBOptions): string => {
    const title = options.title ?? 'Test Book'
    const author = options.author ?? 'Test Author'
    const language = options.language ?? 'en'
    const identifier = options.identifier ?? 'test-book-123'
    const chapters = options.chapters ?? [defaultChapter]

    const manifestItems = chapters.map(ch =>
        `        <item id="${ch.id}" href="${ch.id}.xhtml" media-type="application/xhtml+xml"/>`
    ).join('\n')
    const resourceItems = (options.resources ?? []).map(resource =>
        `        <item id="${resource.id}" href="${resource.href}" media-type="${resource.mediaType}"${resource.properties ? ` properties="${resource.properties}"` : ''}/>`
    ).join('\n')

    const spineItems = chapters.map(ch =>
        `        <itemref idref="${ch.id}"/>`
    ).join('\n')

    return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id" xml:lang="${language}">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
        <dc:identifier id="pub-id">${identifier}</dc:identifier>
        <dc:title>${title}</dc:title>
        <dc:creator>${author}</dc:creator>
        <dc:language>${language}</dc:language>
        <meta property="dcterms:modified">2024-01-01T00:00:00Z</meta>
    </metadata>
    <manifest>
        <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
${manifestItems}
${resourceItems}
    </manifest>
    <spine>
${spineItems}
    </spine>
</package>`
}

const generateNav = (chapters: Array<{ id: string; title: string }>): string => {
    const navItems = chapters.map(ch =>
        `            <li><a href="${ch.id}.xhtml">${ch.title}</a></li>`
    ).join('\n')

    return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Table of Contents</title></head>
<body>
    <nav epub:type="toc" id="toc">
        <h1>Table of Contents</h1>
        <ol>
${navItems}
        </ol>
    </nav>
    <nav epub:type="landmarks">
        <h1>Landmarks</h1>
        <ol>
            <li><a epub:type="toc" href="nav.xhtml">Table of Contents</a></li>
            <li><a epub:type="bodymatter" href="${chapters[0]?.id ?? 'chapter1'}.xhtml">Begin Reading</a></li>
        </ol>
    </nav>
</body>
</html>`
}

/**
 * Generate a minimal valid EPUB as ArrayBuffer.
 */
export async function createTestEPUB(options: MinimalEPUBOptions = {}): Promise<ArrayBuffer> {
    const chapters = options.chapters ?? [defaultChapter]
    const opf = generateOPF(options)
    const nav = generateNav(chapters)

    const blobWriter = new BlobWriter()
    const zipWriter = new ZipWriter(blobWriter)

    // Add mimetype (must be first, uncompressed)
    await zipWriter.add('mimetype', new TextReader('application/epub+zip'), { level: 0 })

    // Add container.xml
    await zipWriter.add('META-INF/container.xml', new TextReader(containerXML))

    // Add OPF
    await zipWriter.add('OEBPS/content.opf', new TextReader(opf))

    // Add navigation
    await zipWriter.add('OEBPS/nav.xhtml', new TextReader(nav))

    // Add chapters
    for (const chapter of chapters) {
        await zipWriter.add(`OEBPS/${chapter.id}.xhtml`, new TextReader(chapter.content))
    }
    for (const resource of options.resources ?? []) {
        const reader = typeof resource.data === 'string'
            ? new TextReader(resource.data)
            : new Uint8ArrayReader(resource.data)
        await zipWriter.add(`OEBPS/${resource.href}`, reader)
    }

    await zipWriter.close()
    const blob = await blobWriter.getData()
    return blob.arrayBuffer()
}

/**
 * Generate an EPUB with NCX navigation (EPUB 2.x style).
 */
export async function createTestEPUBWithNCX(options: MinimalEPUBOptions = {}): Promise<ArrayBuffer> {
    const chapters = options.chapters ?? [defaultChapter]

    const generateNCX = (chapters: Array<{ id: string; title: string }>, title: string): string => {
        const navPoints = chapters.map((ch, i) =>
            `        <navPoint id="navpoint-${i + 1}" playOrder="${i + 1}">
            <navLabel><text>${ch.title}</text></navLabel>
            <content src="${ch.id}.xhtml"/>
        </navPoint>`
        ).join('\n')

        return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
    <head>
        <meta name="dtb:uid" content="${options.identifier ?? 'test-book-123'}"/>
    </head>
    <docTitle><text>${title}</text></docTitle>
    <navMap>
${navPoints}
    </navMap>
</ncx>`
    }

    const title = options.title ?? 'Test Book'
    const author = options.author ?? 'Test Author'
    const language = options.language ?? 'en'
    const identifier = options.identifier ?? 'test-book-123'

    const generateOPF2 = (): string => {
        const manifestItems = chapters.map(ch =>
            `        <item id="${ch.id}" href="${ch.id}.xhtml" media-type="application/xhtml+xml"/>`
        ).join('\n')

        const spineItems = chapters.map(ch =>
            `        <itemref idref="${ch.id}"/>`
        ).join('\n')

        return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="pub-id">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
        <dc:identifier id="pub-id">${identifier}</dc:identifier>
        <dc:title>${title}</dc:title>
        <dc:creator opf:role="aut">${author}</dc:creator>
        <dc:language>${language}</dc:language>
    </metadata>
    <manifest>
        <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
${manifestItems}
    </manifest>
    <spine toc="ncx">
${spineItems}
    </spine>
</package>`
    }

    const blobWriter = new BlobWriter()
    const zipWriter = new ZipWriter(blobWriter)

    await zipWriter.add('mimetype', new TextReader('application/epub+zip'), { level: 0 })
    await zipWriter.add('META-INF/container.xml', new TextReader(containerXML))
    await zipWriter.add('OEBPS/content.opf', new TextReader(generateOPF2()))
    await zipWriter.add('OEBPS/toc.ncx', new TextReader(generateNCX(chapters, title)))

    for (const chapter of chapters) {
        await zipWriter.add(`OEBPS/${chapter.id}.xhtml`, new TextReader(chapter.content))
    }

    await zipWriter.close()
    const blob = await blobWriter.getData()
    return blob.arrayBuffer()
}
