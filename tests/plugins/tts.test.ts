import { describe, expect, it, vi } from 'vitest'
import { withTTS, type TTSBook } from '../../src/plugins/tts'
import type { Book, TextBlock } from '../../src/core/types'

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
        expect(segments[1].startOffset).toBe(12)
        expect(segments[1].text).toBe('Hello world.')
        expect(segments[2].text).toBe('This is a section for speech synthesis.')
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
})
