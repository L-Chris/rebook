import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { NodeDOMAdapter, NodeURLFactory } from '../../src/adapters/node'
import { EPUBParser } from '../../src/parsers/epub'
import { withTTS, type TTSBook } from '../../src/plugins/tts'
import type { Book, TextBlock } from '../../src/core/types'

const lolitaFixture = 'data/洛丽塔.epub'
const itWithLolita = existsSync(lolitaFixture) ? it : it.skip

const blocks: TextBlock[] = [
    {
        id: 'h1',
        type: 'heading',
        segments: [{ text: 'Chapter One' }],
    },
    {
        id: 'p1',
        type: 'paragraph',
        segments: [{ text: 'Hello world. This is a section for speech synthesis.' }],
    },
    {
        id: 'img',
        type: 'image',
        segments: [],
    },
    {
        id: 'tbl',
        type: 'table',
        segments: [],
        table: {
            columnCount: 2,
            rowIndex: 0,
            rowCount: 1,
            rows: [{ cells: [{ text: 'Term' }, { text: 'Meaning' }] }],
        },
    },
]

const book: Book = {
    sections: [{
        id: 's1',
        size: 100,
        load: () => '',
        getBlocks: async () => blocks,
    }],
}

const annotationBlocks: TextBlock[] = [
    {
        id: 'p-note-ref',
        type: 'paragraph',
        segments: [
            { text: '洛丽塔' },
            { text: '[1]', source: { nodeType: 'text', attrs: { 'data-rebook-role': 'noteref' } } },
            { text: '是我的生命之光。' },
        ],
    },
    {
        id: 'note-1',
        type: 'paragraph',
        attrs: { id: 'm1', class: 'note', 'data-rebook-role': 'footnote' },
        segments: [{ text: '[1] “洛丽塔”这个名字是本书《序文》中的第一个词。' }],
    },
]

const annotationBook: Book = {
    sections: [{
        id: 'annotations',
        size: 100,
        load: () => '',
        getBlocks: async () => annotationBlocks,
    }],
}

describe('TTS Plugin', () => {
    it('builds section segments with block ids and offsets', async () => {
        const wrapped = withTTS({ fetch: vi.fn() as any })(book) as TTSBook
        const segments = await wrapped.tts.prepareSection(0, {
            voice: 'voice-a',
            maxSegmentChars: 24,
        })

        expect(segments.map(segment => segment.blockId)).toEqual(['h1', 'p1', 'p1', 'tbl'])
        expect(segments[0]).toMatchObject({
            id: '0:h1:0',
            sectionIndex: 0,
            startOffset: 0,
            endOffset: 11,
            speaker: 'narrator',
            text: 'Chapter One',
            voice: 'voice-a',
        })
        expect(segments[1].startOffset).toBe(0)
        expect(segments[1].text).toBe('Hello world.')
        expect(segments[2].text).toBe('This is a section for speech synthesis.')
        expect(segments[2].startOffset).toBe(13)
        expect(segments[3].text).toBe('Term Meaning')
    })

    it('sends synthesize requests to the configured backend', async () => {
        const fetchMock = vi.fn(async () => new Response(JSON.stringify({
            segmentId: '0:p1:0',
            audioUrl: '/v1/tts/audio/demo.wav',
            fileName: 'demo.wav',
            mimeType: 'audio/wav',
            durationMs: 1000,
            cacheHit: false,
        })))
        const wrapped = withTTS({
            endpoint: 'http://tts.test/',
            provider: 'mock',
            voice: 'voice-a',
            fetch: fetchMock as any,
        })(book) as TTSBook
        const segment = (await wrapped.tts.prepareSection(0))[1]
        const result = await wrapped.tts.synthesizeSegment(segment, { rate: '10%' })

        expect(fetchMock).toHaveBeenCalledWith('http://tts.test/v1/tts/synthesize', expect.objectContaining({
            method: 'POST',
        }))
        const body = JSON.parse(fetchMock.mock.calls[0][1].body)
        expect(body).toMatchObject({
            provider: 'mock',
            voice: 'voice-a',
            rate: '10%',
            segment: { id: '0:p1:0', text: 'Hello world. This is a section for speech synthesis.' },
        })
        expect(result.audioUrl).toBe('http://tts.test/v1/tts/audio/demo.wav')
    })

    it('creates section jobs from prepared segments', async () => {
        const fetchMock = vi.fn(async () => new Response(JSON.stringify({
            id: 'job-1',
            status: 'queued',
            provider: 'mock',
            total: 4,
            completed: 0,
            failed: 0,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            results: [],
        })))
        const wrapped = withTTS({
            endpoint: 'http://tts.test',
            fetch: fetchMock as any,
        })(book) as TTSBook
        const job = await wrapped.tts.createSectionJob(0, { concurrency: 2 })

        expect(job.id).toBe('job-1')
        expect(fetchMock).toHaveBeenCalledWith('http://tts.test/v1/tts/jobs', expect.objectContaining({
            method: 'POST',
        }))
        const body = JSON.parse(fetchMock.mock.calls[0][1].body)
        expect(body.concurrency).toBe(2)
        expect(body.segments).toHaveLength(3)
    })

    it('skips annotation references and footnote blocks by default', async () => {
        const wrapped = withTTS({ fetch: vi.fn() as any })(annotationBook) as TTSBook
        const segments = await wrapped.tts.prepareSection(0)

        expect(segments).toHaveLength(1)
        expect(segments[0].blockId).toBe('p-note-ref')
        expect(segments[0].text).toBe('洛丽塔是我的生命之光。')
        expect(segments[0].startOffset).toBe(0)
        expect(segments[0].endOffset).toBe('洛丽塔[1]是我的生命之光。'.length)
    })

    it('can include annotation references and footnotes explicitly', async () => {
        const wrapped = withTTS({ fetch: vi.fn() as any })(annotationBook) as TTSBook
        const segments = await wrapped.tts.prepareSection(0, {
            includeAnnotationRefs: true,
            includeFootnotes: true,
        })

        expect(segments.map(segment => segment.text)).toEqual([
            '洛丽塔[1]是我的生命之光。',
            '[1] “洛丽塔”这个名字是本书《序文》中的第一个词。',
        ])
    })

    itWithLolita('filters note references and note paragraphs from a real EPUB section', async () => {
        const parser = new EPUBParser()
        const data = await readFile(lolitaFixture)
        const book = await parser.parse(data.buffer.slice(
            data.byteOffset,
            data.byteOffset + data.byteLength,
        ), {
            domAdapter: new NodeDOMAdapter(),
            urlFactory: new NodeURLFactory(),
        })
        const sectionIndex = book.sections.findIndex(section => String(section.id).endsWith('part0370.xhtml'))
        expect(sectionIndex).toBeGreaterThanOrEqual(0)

        const wrapped = withTTS({ fetch: vi.fn() as any })(book) as TTSBook
        const text = (await wrapped.tts.prepareSection(sectionIndex))
            .map(segment => segment.text)
            .join('\n')

        expect(text).toContain('洛丽塔是我的生命之光')
        expect(text).not.toContain('洛丽塔[1]是我的生命之光')
        expect(text).not.toContain('“洛丽塔”这个名字是本书《序文》中的第一个词')
    })

    it('prefetches section audio and waits for a generated segment', async () => {
        const fetchMock = vi.fn(async (url: string) => {
            if (url.endsWith('/v1/tts/jobs')) {
                return new Response(JSON.stringify({
                    id: 'job-1',
                    status: 'running',
                    provider: 'mock',
                    total: 3,
                    completed: 0,
                    failed: 0,
                    createdAt: '2026-01-01T00:00:00.000Z',
                    updatedAt: '2026-01-01T00:00:00.000Z',
                    results: [],
                }))
            }
            return new Response(JSON.stringify({
                id: 'job-1',
                status: 'done',
                provider: 'mock',
                total: 3,
                completed: 3,
                failed: 0,
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:01.000Z',
                results: [{
                    segmentId: '0:p1:0',
                    audioUrl: '/v1/tts/audio/p1.wav',
                    fileName: 'p1.wav',
                    mimeType: 'audio/wav',
                    durationMs: 1000,
                    cacheHit: false,
                }],
            }))
        })
        const wrapped = withTTS({
            endpoint: 'http://tts.test',
            provider: 'mock',
            fetch: fetchMock as any,
        })(book) as TTSBook

        const prefetch = await wrapped.tts.prefetchSection(0, { concurrency: 2, pollIntervalMs: 1 })
        const result = await prefetch.waitForSegment('0:p1:0', { pollIntervalMs: 1 })

        expect(prefetch.segments).toHaveLength(3)
        expect(prefetch.jobId).toBe('job-1')
        expect(result.audioUrl).toBe('http://tts.test/v1/tts/audio/p1.wav')
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('delegates playback to the configured audio player', async () => {
        const fetchMock = vi.fn(async () => new Response(JSON.stringify({
            id: 'job-1',
            status: 'queued',
            provider: 'mock',
            total: 3,
            completed: 0,
            failed: 0,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            results: [],
        })))
        const player = {
            playPrefetchedSection: vi.fn(async () => {}),
            stop: vi.fn(),
        }
        const wrapped = withTTS({
            endpoint: 'http://tts.test',
            fetch: fetchMock as any,
            player,
        })(book) as TTSBook

        const prefetch = await wrapped.tts.prefetchSection(0)
        const playbackOptions = { preloadAhead: 4 }
        await wrapped.tts.playPrefetchedSection(prefetch, playbackOptions)
        wrapped.tts.stopPlayback()

        expect(wrapped.tts.player).toBe(player)
        expect(player.playPrefetchedSection).toHaveBeenCalledWith(prefetch, playbackOptions)
        expect(player.stop).toHaveBeenCalledOnce()
    })
})
