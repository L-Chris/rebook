import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { NodeDOMAdapter, NodeURLFactory } from '../../src/adapters/node'
import { EPUBParser } from '../../src/parsers/epub'
import { withTTS, type TTSBook } from '../../src/plugins/tts'
import type { Book, TextBlock } from '../../src/core/types'

const { generateTextMock, outputArrayMock, outputObjectMock } = vi.hoisted(() => ({
    generateTextMock: vi.fn(),
    outputArrayMock: vi.fn((options: any) => options),
    outputObjectMock: vi.fn((options: any) => options),
}))

vi.mock('ai', () => ({
    generateText: generateTextMock,
    Output: {
        array: outputArrayMock,
        object: outputObjectMock,
    },
    jsonSchema: (schema: any) => schema,
}))

const lolitaFixture = 'data/洛丽塔.epub'
const slayFixture = 'data/我在精神病院学斩神.epub'
const itWithLolita = existsSync(lolitaFixture) ? it : it.skip
const itWithSlayFixture = existsSync(slayFixture) ? it : it.skip
const mockModel = {}
const emptyScenePlanOutput = () => ({ output: { scenes: [] } })

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

const novelBlocks: TextBlock[] = [{
    id: 'novel-p1',
    type: 'paragraph',
    segments: [{
        text: '林七夜低声说道：“别动。”司小南回答：“我不会走。”夜色渐深。',
    }],
}]

const novelBlocks2: TextBlock[] = [{
    id: 'novel-p2',
    type: 'paragraph',
    segments: [{
        text: '林七夜说道：“跟上我。”赵空城笑道：“小子，别怕。”',
    }],
}]

const novelBook: Book = {
    sections: [
        {
            id: 'novel-1',
            size: 100,
            load: () => '',
            getBlocks: async () => novelBlocks,
        },
        {
            id: 'novel-2',
            size: 100,
            load: () => '',
            getBlocks: async () => novelBlocks2,
        },
    ],
}

describe('TTS Plugin', () => {
    beforeEach(() => {
        generateTextMock.mockReset()
        outputArrayMock.mockClear()
        outputObjectMock.mockClear()
    })

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

    it('batches adjacent paragraph narrator segments with ranges while leaving headings separate', async () => {
        const p1 = `${'甲'.repeat(45)}。`
        const p2 = `${'乙'.repeat(45)}。`
        const p3 = `${'丙'.repeat(12)}。`
        const batchBook: Book = {
            sections: [{
                id: 'narrator-batch',
                size: 100,
                load: () => '',
                getBlocks: async () => [
                    { id: 'title', type: 'heading', segments: [{ text: '标题' }] },
                    { id: 'p1', type: 'paragraph', segments: [{ text: p1 }] },
                    { id: 'p2', type: 'paragraph', segments: [{ text: p2 }] },
                    { id: 'p3', type: 'paragraph', segments: [{ text: p3 }] },
                    { id: 'subtitle', type: 'heading', segments: [{ text: '小标题' }] },
                    { id: 'p4', type: 'paragraph', segments: [{ text: '标题后的旁白。' }] },
                ],
            }],
        }
        const wrapped = withTTS({ fetch: vi.fn() as any })(batchBook) as TTSBook

        const segments = await wrapped.tts.prepareSection(0, { maxSegmentChars: 500 })

        expect(segments.map(segment => segment.blockId)).toEqual(['title', 'p1', 'p3', 'subtitle', 'p4'])
        expect(segments[1]).toMatchObject({
            blockId: 'p1',
            blockType: 'paragraph',
            text: p1 + p2,
            ranges: [
                { blockId: 'p1', blockType: 'paragraph', startOffset: 0, endOffset: p1.length },
                { blockId: 'p2', blockType: 'paragraph', startOffset: 0, endOffset: p2.length },
            ],
        })
        expect(segments[1].text.length).toBeLessThanOrEqual(100)
        expect(segments[1].text.length + segments[2].text.length).toBeGreaterThan(100)
        expect(segments[3]).toMatchObject({ blockId: 'subtitle', blockType: 'heading', text: '小标题' })
        expect(segments[4].ranges).toBeUndefined()
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

    it('uses AI speaker analysis by default and keeps character voices consistent', async () => {
        let analysisCall = 0
        generateTextMock.mockImplementation(async (options: any) => {
            analysisCall += 1
            if (analysisCall === 1) {
                return {
                    output: {
                        speakers: [
                            { i: 1, n: '林七夜', r: 'c', g: 1, v: 'voice-lin' },
                            { i: 2, n: '司小南', r: 'c', g: 2, v: 'voice-si' },
                        ],
                        assignments: [
                            {
                                b: 0,
                                a: 0,
                                i: 0,
                            },
                            {
                                b: 0,
                                a: 1,
                                i: 1,
                                c: 0.92,
                            },
                            {
                                b: 0,
                                a: 2,
                                i: 0,
                            },
                            {
                                b: 0,
                                a: 3,
                                i: 2,
                                c: 0.88,
                            },
                            {
                                b: 0,
                                a: 4,
                                i: 0,
                            },
                        ],
                    },
                }
            }
            return {
                output: {
                    speakers: [
                        { i: 3, n: '赵空城', r: 'c', g: 1, v: 'voice-zhao' },
                    ],
                    assignments: [
                        {
                            b: 0,
                            a: 0,
                            i: 0,
                        },
                        {
                            b: 0,
                            a: 1,
                            i: 1,
                            c: 0.91,
                        },
                        {
                            b: 0,
                            a: 2,
                            i: 0,
                        },
                        {
                            b: 0,
                            a: 3,
                            i: 3,
                            c: 0.86,
                        },
                    ],
                },
            }
        })
        const fetchMock = vi.fn(async (url: string) => {
            if (url.includes('/v1/tts/voices')) {
                return new Response(JSON.stringify({
                    voices: [
                        { id: 'voice-lin', name: 'Lin voice', locale: 'zh-CN', gender: 'Male', provider: 'edge' },
                        { id: 'voice-si', name: 'Si voice', locale: 'zh-CN', gender: 'Female', provider: 'edge' },
                        { id: 'voice-zhao', name: 'Zhao voice', locale: 'zh-CN', gender: 'Male', provider: 'edge' },
                    ],
                }))
            }
            return new Response(JSON.stringify({}))
        })
        const wrapped = withTTS({
            endpoint: 'http://tts.test',
            provider: 'edge',
            fetch: fetchMock as any,
            model: mockModel as any,
            voiceProfile: {
                narrator: 'narrator-voice',
                male: ['male-voice-a', 'male-voice-b'],
                female: ['female-voice-a'],
            },
        })(novelBook) as TTSBook
        const first = await wrapped.tts.prepareSection(0, {
            multiSpeaker: true,
            maxSegmentChars: 80,
        })
        const second = await wrapped.tts.prepareSection(1, {
            multiSpeaker: true,
            maxSegmentChars: 80,
        })

        expect(generateTextMock).toHaveBeenCalledTimes(2)
        expect(JSON.parse(generateTextMock.mock.calls[0][0].prompt).nextSpeakerId).toBe(1)
        expect(JSON.parse(generateTextMock.mock.calls[0][0].prompt).knownSpeakers).toEqual([{
            i: 0,
            n: '旁白',
            r: 'n',
            g: 0,
        }])
        expect(JSON.parse(generateTextMock.mock.calls[0][0].prompt).voiceLanguage).toBeUndefined()
        expect(generateTextMock.mock.calls[0][0].system).toContain('语言提示：zh-CN')
        expect(JSON.parse(generateTextMock.mock.calls[0][0].prompt).voices).toEqual(expect.arrayContaining([
            { v: 'voice-lin', n: 'Lin voice', l: 'zh-CN', g: 1, p: 'edge' },
            { v: 'voice-si', n: 'Si voice', l: 'zh-CN', g: 2, p: 'edge' },
            { v: 'voice-zhao', n: 'Zhao voice', l: 'zh-CN', g: 1, p: 'edge' },
        ]))
        expect(JSON.parse(generateTextMock.mock.calls[0][0].prompt).blocks).toEqual([{
            b: 0,
            t: 'paragraph',
            l: novelBlocks[0].segments[0].text.length,
            x: novelBlocks[0].segments[0].text,
            m: 1,
            u: [
                expect.objectContaining({ a: 0 }),
                expect.objectContaining({ a: 1, q: 1 }),
                expect.objectContaining({ a: 2 }),
                expect.objectContaining({ a: 3, q: 1 }),
                expect.objectContaining({ a: 4 }),
            ],
        }])
        expect(JSON.parse(generateTextMock.mock.calls[1][0].prompt).nextSpeakerId).toBe(3)
        expect(JSON.parse(generateTextMock.mock.calls[1][0].prompt).knownSpeakers).toEqual(expect.arrayContaining([
            expect.objectContaining({ i: 0, n: '旁白', g: 0 }),
            expect.objectContaining({ i: 1, n: '林七夜', g: 1 }),
            expect.objectContaining({ i: 2, n: '司小南', g: 2 }),
        ]))
        expect(JSON.parse(generateTextMock.mock.calls[1][0].prompt).knownSpeakers.some((speaker: any) => speaker.v || speaker.d)).toBe(false)
        expect(outputObjectMock.mock.calls[0][0].schema.required).toEqual(['speakers', 'assignments'])
        expect(outputObjectMock.mock.calls[0][0].schema.properties.assignments.items.required).toEqual(['b', 'a', 'i'])
        expect(outputObjectMock.mock.calls[0][0].schema.properties.speakers.items.properties.g.enum).toEqual([0, 1, 2])
        expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/v1/tts/voices'))).toHaveLength(1)

        expect(first.map(segment => ({
            text: segment.text,
            speakerId: segment.speakerId,
            speaker: segment.speaker,
            role: segment.speakerRole,
            gender: segment.speakerGender,
            voice: segment.voice,
        }))).toEqual([
            {
                text: '林七夜低声说道：',
                speakerId: 0,
                speaker: '旁白',
                role: 'narrator',
                gender: 'unknown',
                voice: 'narrator-voice',
            },
            {
                text: '别动。',
                speakerId: 1,
                speaker: '林七夜',
                role: 'character',
                gender: 'male',
                voice: 'voice-lin',
            },
            {
                text: '司小南回答：',
                speakerId: 0,
                speaker: '旁白',
                role: 'narrator',
                gender: 'unknown',
                voice: 'narrator-voice',
            },
            {
                text: '我不会走。',
                speakerId: 2,
                speaker: '司小南',
                role: 'character',
                gender: 'female',
                voice: 'voice-si',
            },
            {
                text: '夜色渐深。',
                speakerId: 0,
                speaker: '旁白',
                role: 'narrator',
                gender: 'unknown',
                voice: 'narrator-voice',
            },
        ])
        expect(second.find(segment => segment.speaker === '林七夜')?.voice).toBe('voice-lin')
        expect(second.find(segment => segment.speaker === '林七夜')?.speakerId).toBe(1)
        expect(second.find(segment => segment.speaker === '赵空城')?.voice).toBe('voice-zhao')
        expect(second.find(segment => segment.speaker === '赵空城')?.speakerId).toBe(3)
    })

    it('filters punctuation-only blocks before multi-speaker analysis', async () => {
        const punctBook: Book = {
            sections: [{
                id: 'punct-filter',
                size: 100,
                load: () => '',
                getBlocks: async () => [
                    {
                        id: 'punct-only',
                        type: 'paragraph',
                        segments: [{ text: '......' }],
                    },
                    {
                        id: 'speech',
                        type: 'paragraph',
                        segments: [{ text: '林七夜说道：“走。”' }],
                    },
                ],
            }],
        }
        generateTextMock.mockResolvedValueOnce({
            output: {
                speakers: [{ i: 1, n: '林七夜', r: 'c', g: 1, v: 'male-voice' }],
                assignments: [
                    { b: 0, a: 0, i: 0 },
                    { b: 0, a: 1, i: 1 },
                ],
            },
        })
        const wrapped = withTTS({
            endpoint: 'http://tts.test',
            provider: 'edge',
            fetch: vi.fn(async () => new Response(JSON.stringify({ voices: [] }))) as any,
            model: mockModel as any,
        })(punctBook) as TTSBook

        const segments = await wrapped.tts.prepareSection(0, { multiSpeaker: true, maxSegmentChars: 80 })

        expect(generateTextMock).toHaveBeenCalledTimes(1)
        const prompt = JSON.parse(generateTextMock.mock.calls[0][0].prompt)
        expect(prompt.blocks).toHaveLength(1)
        expect(prompt.blocks[0].x).toBe('林七夜说道：“走。”')
        expect(segments.map(segment => segment.blockId)).not.toContain('punct-only')
        expect(segments.map(segment => segment.text)).toEqual(['林七夜说道：', '走。'])
    })

    it('routes sound-effect atoms to the configured sound effect provider', async () => {
        const soundBook: Book = {
            sections: [{
                id: 'sound-effect',
                size: 100,
                load: () => '',
                getBlocks: async () => [{
                    id: 'sound-effect-p1',
                    type: 'paragraph',
                    segments: [{ text: '滴滴滴——！' }],
                }],
            }],
        }
        generateTextMock.mockResolvedValueOnce({
            output: {
                speakers: [],
                assignments: [{
                    b: 0,
                    a: 0,
                    i: 0,
                    k: 's',
                    fx: 'rapid electronic beeping alarm, short alert',
                    dur: 1.2,
                }],
            },
        })
        const wrapped = withTTS({
            endpoint: 'http://tts.test',
            provider: 'edge',
            fetch: vi.fn(async () => new Response(JSON.stringify({ voices: [] }))) as any,
            model: mockModel as any,
        })(soundBook) as TTSBook

        const segments = await wrapped.tts.prepareSection(0, { multiSpeaker: true, maxSegmentChars: 80 })

        expect(generateTextMock).toHaveBeenCalledTimes(1)
        expect(outputObjectMock.mock.calls[0][0].schema.properties.assignments.items.properties.k.description)
            .toContain('动物叫声')
        expect(outputObjectMock.mock.calls[0][0].schema.properties.assignments.items.properties.fx.description)
            .toContain('ElevenLabs')
        expect(segments).toHaveLength(1)
        expect(segments[0]).toMatchObject({
            blockId: 'sound-effect-p1',
            provider: 'elevenlabs',
            soundEffectPrompt: 'rapid electronic beeping alarm, short alert',
            soundEffectDurationSeconds: 1.2,
            speaker: 'sound-effect',
            speakerRole: 'other',
            text: '滴滴滴——！',
        })
    })

    it('absorbs short speech cue narration into MiMo audio tags', async () => {
        const text = '“姨妈，政府给残疾人的补贴就是用来生活的。”林七夜笑道。'
        const cueBook: Book = {
            sections: [{
                id: 'speech-cue',
                size: 100,
                load: () => '',
                getBlocks: async () => [{
                    id: 'speech-cue-p1',
                    type: 'paragraph',
                    segments: [{ text }],
                }],
            }],
        }
        generateTextMock
            .mockResolvedValueOnce(emptyScenePlanOutput())
            .mockResolvedValueOnce({
                output: [{
                    i: 1,
                    n: '林七夜',
                    r: 'c',
                    g: 1,
                    a: '少年',
                    o: '学生',
                    p: '冷静克制',
                    q: '清亮低沉，语速略慢',
                    h: '林七夜笑道/说道时引用内容归他',
                }],
            })
            .mockResolvedValueOnce({
                output: {
                    assignments: [
                        { b: 0, a: 0, i: 1 },
                        { b: 0, a: 1, i: 0, k: 'm', p: '轻笑' },
                    ],
                },
            })
        const wrapped = withTTS({
            endpoint: 'http://tts.test',
            provider: 'mimo',
            fetch: vi.fn(async (url: string) => {
                if (url.includes('/v1/tts/providers')) {
                    return new Response(JSON.stringify({
                        providers: [{ id: 'mimo', name: 'MiMo', capabilities: { voiceDesign: true } }],
                    }))
                }
                return new Response(JSON.stringify({ voices: [] }))
            }) as any,
            model: mockModel as any,
        })(cueBook) as TTSBook

        const segments = await wrapped.tts.prepareSection(0, { multiSpeaker: true, maxSegmentChars: 80 })

        expect(generateTextMock).toHaveBeenCalledTimes(3)
        expect(generateTextMock.mock.calls[2][0].system).toContain('优先使用 MiMo 推荐音频标签')
        expect(segments).toHaveLength(1)
        expect(segments[0]).toMatchObject({
            speakerId: 1,
            speaker: '林七夜',
            text: '（轻笑）姨妈，政府给残疾人的补贴就是用来生活的。',
            stylePrompt: '轻笑',
        })
        expect(segments[0].voicePrompt).toContain('音色设计：清亮低沉，语速略慢')
        expect(segments[0].voicePrompt).toContain('可听辨差异')
        expect(segments[0].voicePrompt).toContain('同一角色必须一致')
    })

    it('keeps ordinary action narration even if the model marks it as a muted cue', async () => {
        const text = '“怎么了？”阿诺注意到他的目光。'
        const actionBook: Book = {
            sections: [{
                id: 'action-cue',
                size: 100,
                load: () => '',
                getBlocks: async () => [{
                    id: 'action-cue-p1',
                    type: 'paragraph',
                    segments: [{ text }],
                }],
            }],
        }
        generateTextMock.mockResolvedValueOnce({
            output: {
                speakers: [{ i: 1, n: '阿诺', r: 'c', g: 1, v: 'male-voice' }],
                assignments: [
                    { b: 0, a: 0, i: 1 },
                    { b: 0, a: 1, i: 0, k: 'm' },
                ],
            },
        })
        const wrapped = withTTS({
            endpoint: 'http://tts.test',
            provider: 'edge',
            fetch: vi.fn(async () => new Response(JSON.stringify({ voices: [] }))) as any,
            model: mockModel as any,
        })(actionBook) as TTSBook

        const segments = await wrapped.tts.prepareSection(0, { multiSpeaker: true, maxSegmentChars: 80 })

        expect(segments.map(segment => ({
            speaker: segment.speaker,
            role: segment.speakerRole,
            text: segment.text,
        }))).toEqual([
            { speaker: '阿诺', role: 'character', text: '怎么了？' },
            { speaker: '旁白', role: 'narrator', text: '阿诺注意到他的目光。' },
        ])
    })

    it('merges same-speaker dialogue separated only by a muted speech attribution', async () => {
        const text = '“他不是盲人。”阿诺说道，“他一定看得见。”'
        const mergeBook: Book = {
            sections: [{
                id: 'merge-cue',
                size: 100,
                load: () => '',
                getBlocks: async () => [{
                    id: 'merge-cue-p1',
                    type: 'paragraph',
                    segments: [{ text }],
                }],
            }],
        }
        generateTextMock.mockResolvedValueOnce({
            output: {
                speakers: [{ i: 1, n: '阿诺', r: 'c', g: 1, v: 'male-voice' }],
                assignments: [
                    { b: 0, a: 0, i: 1 },
                    { b: 0, a: 1, i: 0, k: 'm' },
                    { b: 0, a: 2, i: 1 },
                ],
            },
        })
        const wrapped = withTTS({
            endpoint: 'http://tts.test',
            provider: 'edge',
            fetch: vi.fn(async () => new Response(JSON.stringify({ voices: [] }))) as any,
            model: mockModel as any,
        })(mergeBook) as TTSBook

        const segments = await wrapped.tts.prepareSection(0, { multiSpeaker: true, maxSegmentChars: 80 })

        expect(segments).toHaveLength(1)
        expect(segments[0]).toMatchObject({
            speaker: '阿诺',
            speakerId: 1,
            speakerRole: 'character',
            text: '他不是盲人。他一定看得见。',
            voice: 'male-voice',
        })
    })

    it('uses model-provided MiMo tags for pause and attribution cues', async () => {
        const cueBook: Book = {
            sections: [{
                id: 'mimo-cue-tags',
                size: 100,
                load: () => '',
                getBlocks: async () => [
                    {
                        id: 'pause-between',
                        type: 'paragraph',
                        segments: [{ text: '“不知道。”他顿了顿，“不过……听说是比那更离谱的事情。”' }],
                    },
                    {
                        id: 'sigh-between',
                        type: 'paragraph',
                        segments: [{ text: '“是个苦命人。”阿诺叹了口气，“他叫什么名字？”' }],
                    },
                    {
                        id: 'pause-before',
                        type: 'paragraph',
                        segments: [{ text: '李医生沉吟半晌，“你是不是改过名字？”' }],
                    },
                    {
                        id: 'joking-before',
                        type: 'paragraph',
                        segments: [{ text: '李医生半开玩笑的说道，“就算你跟我说你是被太上老君拉进了炼丹炉里，我也会信的。”' }],
                    },
                    {
                        id: 'apology-after',
                        type: 'paragraph',
                        segments: [{ text: '“不好意思。”李医生有些抱歉的开口。' }],
                    },
                ],
            }],
        }
        generateTextMock
            .mockResolvedValueOnce(emptyScenePlanOutput())
            .mockResolvedValueOnce({
                output: [{
                    i: 1,
                    n: '李医生',
                    r: 'c',
                    g: 1,
                    a: '年轻',
                    o: '医生',
                    p: '温和礼貌',
                    q: '斯文温和',
                }],
            })
            .mockResolvedValueOnce({
                output: {
                    assignments: [
                        { b: 0, a: 0, i: 1 },
                        { b: 0, a: 1, i: 0, k: 'm', p: '沉默片刻' },
                        { b: 0, a: 2, i: 1 },
                        { b: 1, a: 0, i: 1 },
                        { b: 1, a: 1, i: 0, k: 'm', p: '叹气' },
                        { b: 1, a: 2, i: 1 },
                        { b: 2, a: 0, i: 0, k: 'm', p: '沉默片刻' },
                        { b: 2, a: 1, i: 1 },
                        { b: 3, a: 0, i: 0, k: 'm', p: '俏皮' },
                        { b: 3, a: 1, i: 1 },
                        { b: 4, a: 0, i: 1 },
                        { b: 4, a: 1, i: 0, k: 'm', p: '愧疚' },
                    ],
                },
            })
        const wrapped = withTTS({
            endpoint: 'http://tts.test',
            provider: 'mimo',
            fetch: vi.fn(async (url: string) => {
                if (url.includes('/v1/tts/providers')) {
                    return new Response(JSON.stringify({
                        providers: [{ id: 'mimo', name: 'MiMo', capabilities: { voiceDesign: true } }],
                    }))
                }
                return new Response(JSON.stringify({ voices: [] }))
            }) as any,
            model: mockModel as any,
        })(cueBook) as TTSBook

        const segments = await wrapped.tts.prepareSection(0, { multiSpeaker: true, maxSegmentChars: 120 })

        expect(segments.map(segment => ({
            blockId: segment.blockId,
            text: segment.text,
            stylePrompt: segment.stylePrompt,
        }))).toEqual([
            {
                blockId: 'pause-between',
                text: '不知道。（沉默片刻）不过……听说是比那更离谱的事情。',
                stylePrompt: '沉默片刻',
            },
            {
                blockId: 'sigh-between',
                text: '是个苦命人。（叹气）他叫什么名字？',
                stylePrompt: '叹气',
            },
            {
                blockId: 'pause-before',
                text: '（沉默片刻）你是不是改过名字？',
                stylePrompt: '沉默片刻',
            },
            {
                blockId: 'joking-before',
                text: '（俏皮）就算你跟我说你是被太上老君拉进了炼丹炉里，我也会信的。',
                stylePrompt: '俏皮',
            },
            {
                blockId: 'apology-after',
                text: '（愧疚）不好意思。',
                stylePrompt: '愧疚',
            },
        ])
    })

    it('repairs styled dialogue when an adjacent attribution cue was left spoken', async () => {
        const text = '“是个苦命人。”阿诺叹了口气，“他叫什么名字？”'
        const cueBook: Book = {
            sections: [{
                id: 'styled-cue-repair',
                size: 100,
                load: () => '',
                getBlocks: async () => [{
                    id: 'styled-cue-repair-p1',
                    type: 'paragraph',
                    segments: [{ text }],
                }],
            }],
        }
        generateTextMock
            .mockResolvedValueOnce(emptyScenePlanOutput())
            .mockResolvedValueOnce({
                output: [{
                    i: 1,
                    n: '阿诺',
                    r: 'c',
                    g: 1,
                    a: '青年',
                    p: '随性好奇',
                    q: '清亮偏年轻，语速中等略快',
                }],
            })
            .mockResolvedValueOnce({
                output: {
                    assignments: [
                        { b: 0, a: 0, i: 1, p: '叹气' },
                        { b: 0, a: 1, i: 0 },
                        { b: 0, a: 2, i: 1 },
                    ],
                },
            })
            .mockImplementationOnce(async (options: any) => {
                const body = JSON.parse(options.prompt)
                expect(body.blocks).toEqual([expect.objectContaining({
                    b: 0,
                    x: text,
                    u: [
                        expect.objectContaining({ a: 0, q: 1 }),
                        expect.objectContaining({ a: 1, x: '阿诺叹了口气，' }),
                        expect.objectContaining({ a: 2, q: 1 }),
                    ],
                })])
                expect(options.system).toContain('p 不能替代 k=m')
                return {
                    output: {
                        assignments: [
                            { b: 0, a: 0, i: 1 },
                            { b: 0, a: 1, i: 0, k: 'm', p: '叹气' },
                            { b: 0, a: 2, i: 1 },
                        ],
                    },
                }
            })
        const wrapped = withTTS({
            endpoint: 'http://tts.test',
            provider: 'mimo',
            fetch: vi.fn(async (url: string) => {
                if (url.includes('/v1/tts/providers')) {
                    return new Response(JSON.stringify({
                        providers: [{ id: 'mimo', name: 'MiMo', capabilities: { voiceDesign: true } }],
                    }))
                }
                return new Response(JSON.stringify({ voices: [] }))
            }) as any,
            model: mockModel as any,
        })(cueBook) as TTSBook

        const segments = await wrapped.tts.prepareSection(0, { multiSpeaker: true, maxSegmentChars: 120 })

        expect(generateTextMock).toHaveBeenCalledTimes(4)
        expect(segments.map(segment => ({
            blockId: segment.blockId,
            speaker: segment.speaker,
            text: segment.text,
            stylePrompt: segment.stylePrompt,
        }))).toEqual([{
            blockId: 'styled-cue-repair-p1',
            speaker: '阿诺',
            text: '是个苦命人。（叹气）他叫什么名字？',
            stylePrompt: '叹气',
        }])
    })

    it('keeps MiMo voice design role cards consistent by speaker id', async () => {
        const firstText = '他说：“别动。”夜色很深。'
        const secondText = '林七夜说道：“跟上我。”'
        const mimoBook: Book = {
            sections: [
                {
                    id: 'mimo-1',
                    size: 100,
                    load: () => '',
                    getBlocks: async () => [{
                        id: 'mimo-p1',
                        type: 'paragraph',
                        segments: [{ text: firstText }],
                    }],
                },
                {
                    id: 'mimo-2',
                    size: 100,
                    load: () => '',
                    getBlocks: async () => [{
                        id: 'mimo-p2',
                        type: 'paragraph',
                        segments: [{ text: secondText }],
                    }],
                },
            ],
        }
        const expectedSpeakerHint = '林七夜=盲眼少年；林七夜说道/问道时引用内容归他；别人谈论林七夜不代表他说话'
        const expectedRoleCard = `角色：林七夜，男性；年龄感：少年；身份：盲眼学生；性格底色：冷静克制，敏锐 场景：小说多人对白配音；识别上下文：${expectedSpeakerHint} 音色：音色设计：清亮低沉，语速略慢；如果原文声音信息不足，可基于角色年龄、身份和性格合理补足音色质感；必须和同篇章其他核心角色保持可听辨差异 指导：保持男性声线，不要贴近旁白默认音色；语速、停顿、能量和口吻要稳定，后续同一角色必须一致`
        generateTextMock
            .mockResolvedValueOnce(emptyScenePlanOutput())
            .mockResolvedValueOnce({
                output: [{
                    i: 1,
                    n: '林七夜',
                    r: 'c',
                    g: 1,
                    a: '少年',
                    o: '盲眼学生',
                    p: '冷静克制，敏锐',
                    q: '清亮低沉，语速略慢',
                    h: expectedSpeakerHint,
                }],
            })
            .mockResolvedValueOnce({
                output: {
                    assignments: [
                        { b: 0, a: 0, i: 0 },
                        { b: 0, a: 1, i: 1, c: 0.93 },
                        { b: 0, a: 2, i: 0 },
                    ],
                },
            })
            .mockResolvedValueOnce(emptyScenePlanOutput())
            .mockResolvedValueOnce({
                output: [],
            })
            .mockResolvedValueOnce({
                output: {
                    assignments: [
                        { b: 0, a: 0, i: 0 },
                        { b: 0, a: 1, i: 1, c: 0.94 },
                    ],
                },
            })
        const fetchMock = vi.fn(async (url: string) => {
            if (url.includes('/v1/tts/voices')) {
                return new Response(JSON.stringify({
                    voices: [
                        { id: '冰糖', name: '冰糖', locale: 'zh-CN', gender: 'Female', provider: 'mimo' },
                        { id: '苏打', name: '苏打', locale: 'zh-CN', gender: 'Male', provider: 'mimo' },
                        { id: '白桦', name: '白桦', locale: 'zh-CN', gender: 'Male', provider: 'mimo' },
                    ],
                }))
            }
            return new Response(JSON.stringify({}))
        })
        const wrapped = withTTS({
            endpoint: 'http://tts.test',
            provider: 'mimo',
            fetch: fetchMock as any,
            model: mockModel as any,
        })(mimoBook) as TTSBook

        const first = await wrapped.tts.prepareSection(0, { multiSpeaker: true, maxSegmentChars: 80 })
        const second = await wrapped.tts.prepareSection(1, { multiSpeaker: true, maxSegmentChars: 80 })

        expect(generateTextMock).toHaveBeenCalledTimes(6)
        const firstScenePrompt = JSON.parse(generateTextMock.mock.calls[0][0].prompt)
        const firstPlanPrompt = JSON.parse(generateTextMock.mock.calls[1][0].prompt)
        const firstSegmentPrompt = JSON.parse(generateTextMock.mock.calls[2][0].prompt)
        const secondScenePrompt = JSON.parse(generateTextMock.mock.calls[3][0].prompt)
        const secondPlanPrompt = JSON.parse(generateTextMock.mock.calls[4][0].prompt)
        const secondSegmentPrompt = JSON.parse(generateTextMock.mock.calls[5][0].prompt)
        expect(generateTextMock.mock.calls[0][0].system).toContain('场景规划阶段')
        expect(firstScenePrompt.blocks[0].u).toBeUndefined()
        expect(firstPlanPrompt.voiceDesign).toBeUndefined()
        expect(firstPlanPrompt.voices).toBeUndefined()
        expect(firstPlanPrompt.nextSpeakerId).toBe(1)
        expect(generateTextMock.mock.calls[1][0].system).toContain('角色规划和语音规划引擎')
        expect(generateTextMock.mock.calls[1][0].system).toContain('音色/质感、语速/节奏、音高/能量、口吻/表演')
        expect(generateTextMock.mock.calls[1][0].system).toContain('原文描述不多')
        expect(generateTextMock.mock.calls[1][0].system).toContain('核心角色的 g 必须稳定')
        expect(generateTextMock.mock.calls[1][0].system).toContain('避免互相冲突')
        expect(generateTextMock.mock.calls[2][0].system).toContain('当前是角色设计后的文本解析阶段')
        expect(secondScenePrompt.blocks[0].u).toBeUndefined()
        expect(firstSegmentPrompt.nextSpeakerId).toBeUndefined()
        expect(firstSegmentPrompt.voices).toBeUndefined()
        expect(outputArrayMock.mock.calls[0][0].element.required).toEqual(['i', 'n', 'r', 'g'])
        expect(outputObjectMock.mock.calls[0][0].schema.required).toEqual(['scenes'])
        expect(outputObjectMock.mock.calls[1][0].schema.required).toEqual(['assignments'])
        expect(outputObjectMock.mock.calls[1][0].schema.properties.speakers).toBeUndefined()
        expect(firstSegmentPrompt.knownSpeakers).toEqual(expect.arrayContaining([
            expect.objectContaining({ i: 1, n: '林七夜', h: expectedSpeakerHint }),
        ]))
        expect(secondPlanPrompt.knownSpeakers).toEqual(expect.arrayContaining([
            expect.objectContaining({ i: 1, n: '林七夜', h: expectedSpeakerHint }),
        ]))
        expect(secondPlanPrompt.nextSpeakerId).toBe(2)
        expect(secondSegmentPrompt.nextSpeakerId).toBeUndefined()
        expect(secondSegmentPrompt.knownSpeakers).toEqual(expect.arrayContaining([
            expect.objectContaining({ i: 1, n: '林七夜', h: expectedSpeakerHint }),
        ]))
        expect(firstSegmentPrompt.knownSpeakers.some((speaker: any) => speaker.d || speaker.v)).toBe(false)
        expect(secondPlanPrompt.knownSpeakers.some((speaker: any) => speaker.d || speaker.v)).toBe(false)
        expect(secondSegmentPrompt.knownSpeakers.some((speaker: any) => speaker.d || speaker.v)).toBe(false)
        expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/v1/tts/voices'))).toBe(false)
        expect(first.find(segment => segment.speakerId === 1)).toMatchObject({
            speaker: '林七夜',
            speakerRole: 'character',
            speakerGender: 'male',
            voicePrompt: expectedRoleCard,
            voice: undefined,
        })
        expect(first.find(segment => segment.speakerRole === 'narrator')?.voice).toBe('mimo_default')
        expect(second.find(segment => segment.speakerId === 1)).toMatchObject({
            speaker: '林七夜',
            voicePrompt: expectedRoleCard,
        })
    })

    it('uses provider capabilities to enable voice design planning', async () => {
        const text = '林七夜低声说道：“别动。”'
        const capableBook: Book = {
            sections: [{
                id: 'capable-provider',
                size: 100,
                load: () => '',
                getBlocks: async () => [{
                    id: 'capable-provider-p1',
                    type: 'paragraph',
                    segments: [{ text }],
                }],
            }],
        }
        const expectedRoleCard = '角色：林七夜，男性；年龄感：青年；身份：学生；性格底色：冷静克制 场景：小说多人对白配音；需要和旁白及其他角色形成清晰区分。 音色：音色设计：嗓音清亮；如果原文声音信息不足，可基于角色年龄、身份和性格合理补足音色质感；必须和同篇章其他核心角色保持可听辨差异 指导：保持男性声线，不要贴近旁白默认音色；语速、停顿、能量和口吻要稳定，后续同一角色必须一致'
        generateTextMock
            .mockResolvedValueOnce(emptyScenePlanOutput())
            .mockResolvedValueOnce({
                output: [{
                    i: 1,
                    n: '林七夜',
                    r: 'c',
                    g: 1,
                    a: '青年',
                    o: '学生',
                    p: '冷静克制',
                    q: '嗓音清亮',
                }],
            })
            .mockResolvedValueOnce({
                output: {
                    assignments: [
                        { b: 0, a: 0, i: 0 },
                        { b: 0, a: 1, i: 1 },
                    ],
                },
            })
        const fetchMock = vi.fn(async (url: string) => {
            if (url.includes('/v1/tts/providers')) {
                return new Response(JSON.stringify({
                    providers: [{
                        id: 'design-lab',
                        name: 'Design Lab',
                        capabilities: { voiceDesign: true },
                    }],
                }))
            }
            if (url.includes('/v1/tts/voices')) {
                return new Response(JSON.stringify({
                    voices: [
                        { id: 'voice-a', name: 'Voice A', locale: 'zh-CN', gender: 'Male', provider: 'design-lab' },
                    ],
                }))
            }
            return new Response(JSON.stringify({}))
        })
        const wrapped = withTTS({
            endpoint: 'http://tts.test',
            provider: 'design-lab',
            fetch: fetchMock as any,
            model: mockModel as any,
        })(capableBook) as TTSBook

        const segments = await wrapped.tts.prepareSection(0, { multiSpeaker: true, maxSegmentChars: 80 })

        expect(generateTextMock).toHaveBeenCalledTimes(3)
        const scenePrompt = JSON.parse(generateTextMock.mock.calls[0][0].prompt)
        const planPrompt = JSON.parse(generateTextMock.mock.calls[1][0].prompt)
        const segmentPrompt = JSON.parse(generateTextMock.mock.calls[2][0].prompt)
        expect(scenePrompt.blocks[0].u).toBeUndefined()
        expect(planPrompt.voiceDesign).toBeUndefined()
        expect(planPrompt.voices).toBeUndefined()
        expect(planPrompt.blocks[0].u).toBeUndefined()
        expect(generateTextMock.mock.calls[0][0].system).toContain('场景规划阶段')
        expect(generateTextMock.mock.calls[1][0].system).toContain('角色规划和语音规划引擎')
        expect(generateTextMock.mock.calls[2][0].system).toContain('当前是角色设计后的文本解析阶段')
        expect(segmentPrompt.voices).toBeUndefined()
        expect(segmentPrompt.blocks[0].u).toEqual([
            expect.objectContaining({ a: 0 }),
            expect.objectContaining({ a: 1, q: 1 }),
        ])
        expect(outputArrayMock.mock.calls[0][0].element.required).toEqual(['i', 'n', 'r', 'g'])
        expect(outputArrayMock.mock.calls[0][0].element.properties.q.description).toContain('音色/质感')
        expect(outputObjectMock.mock.calls[0][0].schema.required).toEqual(['scenes'])
        expect(outputObjectMock.mock.calls[1][0].schema.required).toEqual(['assignments'])
        expect(outputObjectMock.mock.calls[1][0].schema.properties.speakers).toBeUndefined()
        expect(segmentPrompt.knownSpeakers).toEqual(expect.arrayContaining([
            expect.objectContaining({ i: 1, n: '林七夜', r: 'c', g: 1 }),
        ]))
        expect(segmentPrompt.knownSpeakers.some((speaker: any) => speaker.d || speaker.v)).toBe(false)
        expect(segments.find(segment => segment.speakerId === 1)).toMatchObject({
            speaker: '林七夜',
            voicePrompt: expectedRoleCard,
        })
        expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/v1/tts/voices'))).toBe(false)
    })

    it('uses scene planning to guide speaker planning and voice design cards', async () => {
        const text = '教室里一片吵闹。“老师来了！”一个同学喊道。'
        const sceneBook: Book = {
            sections: [{
                id: 'scene-context',
                size: 100,
                load: () => '',
                getBlocks: async () => [{
                    id: 'scene-context-p1',
                    type: 'paragraph',
                    segments: [{ text }],
                }],
            }],
        }
        generateTextMock
            .mockResolvedValueOnce({
                output: {
                    scenes: [{
                        i: 1,
                        n: '高中教室',
                        b: [0],
                        loc: '教室',
                        a: '课前嘈杂',
                        c: '高中学生为主',
                        q: '匿名同学多为少年/少女音，语速自然偏快，口吻带课堂里的随意和紧张',
                        h: '教室里吵闹，同学提醒老师来了',
                        fx: ['教室嘈杂'],
                    }],
                },
            })
            .mockResolvedValueOnce({
                output: [{
                    i: 1,
                    n: '喊话同学',
                    r: 'c',
                    g: 0,
                    a: '高中生',
                    o: '学生',
                    p: '提醒众人，语气急促',
                    q: '偏亮的学生声线，语速快，声音清晰但带一点紧张',
                    h: '高中教室场景中喊“老师来了”的同学',
                    s: [1],
                }],
            })
            .mockResolvedValueOnce({
                output: {
                    assignments: [
                        { b: 0, a: 0, i: 0 },
                        { b: 0, a: 1, i: 1 },
                        { b: 0, a: 2, i: 0, k: 'm', p: '紧张' },
                    ],
                },
            })
        const wrapped = withTTS({
            endpoint: 'http://tts.test',
            provider: 'mimo',
            fetch: vi.fn(async (url: string) => {
                if (url.includes('/v1/tts/providers')) {
                    return new Response(JSON.stringify({
                        providers: [{ id: 'mimo', name: 'MiMo', capabilities: { voiceDesign: true } }],
                    }))
                }
                return new Response(JSON.stringify({}))
            }) as any,
            model: mockModel as any,
        })(sceneBook) as TTSBook

        const segments = await wrapped.tts.prepareSection(0, { multiSpeaker: true, maxSegmentChars: 120 })

        const scenePrompt = JSON.parse(generateTextMock.mock.calls[0][0].prompt)
        const speakerPrompt = JSON.parse(generateTextMock.mock.calls[1][0].prompt)
        const analysisPrompt = JSON.parse(generateTextMock.mock.calls[2][0].prompt)
        expect(generateTextMock.mock.calls[0][0].system).toContain('场景规划阶段')
        expect(scenePrompt.blocks[0].u).toBeUndefined()
        expect(speakerPrompt.knownScenes).toEqual([expect.objectContaining({ i: 1, n: '高中教室', c: '高中学生为主' })])
        expect(speakerPrompt.blocks[0].s).toBe(1)
        expect(analysisPrompt.knownScenes).toEqual([expect.objectContaining({ i: 1, n: '高中教室' })])
        expect(analysisPrompt.blocks[0].s).toBe(1)
        expect(segments.find(segment => segment.speakerId === 1)).toMatchObject({
            speaker: '喊话同学',
            text: '（紧张）老师来了！',
            stylePrompt: '紧张',
        })
        expect(segments.find(segment => segment.speakerId === 1)?.voicePrompt).toContain('相关场景：高中教室')
        expect(segments.find(segment => segment.speakerId === 1)?.voicePrompt).toContain('默认人群=高中学生为主')
        expect(segments.find(segment => segment.speakerId === 1)?.voicePrompt).toContain('场景声音约束(高中教室)')
        expect(segments.find(segment => segment.speakerId === 1)?.voicePrompt).toContain('匿名同学多为少年/少女音')
    })

    it('uses one configured model for all voice design speaker analysis phases', async () => {
        const text = '“别动。”林七夜说道。'
        const phaseBook: Book = {
            sections: [{
                id: 'phase-models',
                size: 100,
                load: () => '',
                getBlocks: async () => [{
                    id: 'phase-models-p1',
                    type: 'paragraph',
                    segments: [{ text }],
                }],
            }],
        }
        const analysisModel = { phase: 'all' }
        generateTextMock
            .mockResolvedValueOnce(emptyScenePlanOutput())
            .mockResolvedValueOnce({
                output: [{ i: 1, n: '林七夜', r: 'c', g: 1 }],
            })
            .mockResolvedValueOnce({
                output: {
                    assignments: [{ b: 0, a: 0, i: 1, c: 0.6 }],
                },
            })
            .mockResolvedValueOnce({
                output: {
                    assignments: [
                        { b: 0, a: 0, i: 1, c: 0.95 },
                        { b: 0, a: 1, i: 0, c: 0.95 },
                    ],
                },
            })
        const fetchMock = vi.fn(async (url: string) => {
            if (url.includes('/v1/tts/providers')) {
                return new Response(JSON.stringify({
                    providers: [{
                        id: 'design-lab',
                        name: 'Design Lab',
                        capabilities: { voiceDesign: true },
                    }],
                }))
            }
            return new Response(JSON.stringify({}))
        })
        const wrapped = withTTS({
            endpoint: 'http://tts.test',
            provider: 'design-lab',
            fetch: fetchMock as any,
            speakerAnalysis: { model: analysisModel as any },
        })(phaseBook) as TTSBook

        await wrapped.tts.prepareSection(0, { multiSpeaker: true, maxSegmentChars: 80 })

        expect(generateTextMock).toHaveBeenCalledTimes(4)
        expect(generateTextMock.mock.calls.map(call => call[0].model)).toEqual([
            analysisModel,
            analysisModel,
            analysisModel,
            analysisModel,
        ])
    })

    it('keeps simultaneous dialogue as one group speaker segment', async () => {
        const text = '“跑！！”林七夜和李毅飞同时大吼！'
        const groupBook: Book = {
            sections: [{
                id: 'simultaneous',
                size: 100,
                load: () => '',
                getBlocks: async () => [{
                    id: 'simultaneous-p1',
                    type: 'paragraph',
                    segments: [{ text }],
                }],
            }],
        }
        generateTextMock
            .mockResolvedValueOnce(emptyScenePlanOutput())
            .mockResolvedValueOnce({
                output: [
                    { i: 1, n: '林七夜', r: 'c', g: 1, q: '清亮偏低的少年音，冷静克制。' },
                    { i: 2, n: '李毅飞', r: 'c', g: 1, q: '更外放的青年男声，语速偏快。' },
                ],
            })
            .mockResolvedValueOnce({
                output: {
                    assignments: [
                        { b: 0, a: 0, i: 1, is: [1, 2], p: '大吼' },
                        { b: 0, a: 1, i: 0, k: 'm', p: '大吼' },
                    ],
                },
            })
        const wrapped = withTTS({
            endpoint: 'http://tts.test',
            provider: 'mimo',
            fetch: vi.fn(async (url: string) => {
                if (url.includes('/v1/tts/providers')) {
                    return new Response(JSON.stringify({
                        providers: [{ id: 'mimo', name: 'MiMo', capabilities: { voiceDesign: true } }],
                    }))
                }
                return new Response(JSON.stringify({ voices: [] }))
            }) as any,
            model: mockModel as any,
        })(groupBook) as TTSBook

        const segments = await wrapped.tts.prepareSection(0, { multiSpeaker: true, maxSegmentChars: 80 })

        const assignmentSchemaCall = outputObjectMock.mock.calls.find(call => call[0].schema?.properties?.assignments)
        expect(assignmentSchemaCall?.[0].schema.properties.assignments.items.properties.is.description)
            .toContain('simultaneous')
        expect(segments).toHaveLength(1)
        expect(segments[0]).toMatchObject({
            speakerIds: [1, 2],
            speaker: '林七夜、李毅飞',
            speakerRole: 'character',
            speakerGender: 'male',
            text: '（大吼）跑！',
            stylePrompt: '大吼',
        })
        expect(segments[0].speakerId).toBeUndefined()
        expect(segments[0].voicePrompt).toContain('多人同声/齐声对白')
        expect(segments[0].voicePrompt).toContain('林七夜')
        expect(segments[0].voicePrompt).toContain('李毅飞')
    })

    it('repairs mixed AI blocks that were assigned to one speaker', async () => {
        const mixedText = '“不，我看到了一个天使。”林七夜认真开口。'
        const mixedBook: Book = {
            sections: [{
                id: 'mixed',
                size: 100,
                load: () => '',
                getBlocks: async () => [{
                    id: 'mixed-p1',
                    type: 'paragraph',
                    segments: [{ text: mixedText }],
                }],
            }],
        }
        generateTextMock
            .mockResolvedValueOnce({
                output: {
                    speakers: [{ i: 1, n: '林七夜', r: 'c', g: 1 }],
                    assignments: [{ b: 0, a: 0, i: 1, c: 0.6 }],
                },
            })
            .mockImplementationOnce(async (options: any) => {
                const body = JSON.parse(options.prompt)
                expect(body.blocks).toEqual([{
                    b: 0,
                    t: 'paragraph',
                    l: mixedText.length,
                    x: mixedText,
                    m: 1,
                    u: [
                        expect.objectContaining({ a: 0, q: 1 }),
                        expect.objectContaining({ a: 1 }),
                    ],
                }])
                expect(body.knownSpeakers).toEqual(expect.arrayContaining([
                    expect.objectContaining({ i: 1, n: '林七夜', r: 'c', g: 1 }),
                ]))
                return {
                    output: {
                        speakers: [],
                        assignments: [
                            { b: 0, a: 0, i: 1, c: 0.95 },
                            { b: 0, a: 1, i: 0, c: 0.95 },
                        ],
                    },
                }
            })
        const wrapped = withTTS({
            fetch: vi.fn(async () => new Response(JSON.stringify({ voices: [] }))) as any,
            model: mockModel as any,
            voiceProfile: {
                narrator: 'narrator-voice',
                male: 'male-voice',
            },
        })(mixedBook) as TTSBook

        const segments = await wrapped.tts.prepareSection(0, {
            multiSpeaker: true,
            maxSegmentChars: 80,
        })

        expect(generateTextMock).toHaveBeenCalledTimes(2)
        expect(segments.map(segment => ({
            text: segment.text,
            speakerId: segment.speakerId,
            speaker: segment.speaker,
            role: segment.speakerRole,
            voice: segment.voice,
        }))).toEqual([
            {
                text: '不，我看到了一个天使。',
                speakerId: 1,
                speaker: '林七夜',
                role: 'character',
                voice: 'male-voice',
            },
            {
                text: '林七夜认真开口。',
                speakerId: 0,
                speaker: '旁白',
                role: 'narrator',
                voice: 'narrator-voice',
            },
        ])
    })

    it('repairs mixed AI blocks with suspicious tiny speaker fragments', async () => {
        const mixedText = '“阿诺，你在看什么？”他身旁的同伴问道。'
        const mixedBook: Book = {
            sections: [{
                id: 'tiny-repair',
                size: 100,
                load: () => '',
                getBlocks: async () => [{
                    id: 'tiny-repair-p1',
                    type: 'paragraph',
                    segments: [{ text: mixedText }],
                }],
            }],
        }
        generateTextMock
            .mockResolvedValueOnce({
                output: {
                    speakers: [
                        { i: 1, n: '阿诺', r: 'c', g: 1 },
                        { i: 2, n: '同伴', r: 'c', g: 1 },
                    ],
                    assignments: [
                        { b: 0, a: 1, i: 0, c: 1 },
                    ],
                },
            })
            .mockImplementationOnce(async (options: any) => {
                const body = JSON.parse(options.prompt)
                expect(body.blocks).toEqual([{
                    b: 0,
                    t: 'paragraph',
                    l: mixedText.length,
                    x: mixedText,
                    m: 1,
                    u: [
                        expect.objectContaining({ a: 0, q: 1 }),
                        expect.objectContaining({ a: 1 }),
                    ],
                }])
                expect(body.knownSpeakers).toEqual(expect.arrayContaining([
                    expect.objectContaining({ i: 1, n: '阿诺' }),
                    expect.objectContaining({ i: 2, n: '同伴' }),
                ]))
                return {
                    output: {
                        speakers: [],
                        assignments: [
                            { b: 0, a: 0, i: 2, c: 0.96 },
                            { b: 0, a: 1, i: 0, c: 0.96 },
                        ],
                    },
                }
            })
        const wrapped = withTTS({
            fetch: vi.fn(async () => new Response(JSON.stringify({ voices: [] }))) as any,
            model: mockModel as any,
            voiceProfile: {
                narrator: 'narrator-voice',
                male: ['male-voice-a', 'male-voice-b'],
            },
        })(mixedBook) as TTSBook

        const segments = await wrapped.tts.prepareSection(0, {
            multiSpeaker: true,
            maxSegmentChars: 80,
        })

        expect(generateTextMock).toHaveBeenCalledTimes(2)
        expect(segments.map(segment => ({
            text: segment.text,
            speakerId: segment.speakerId,
            speaker: segment.speaker,
            role: segment.speakerRole,
        }))).toEqual([
            {
                text: '阿诺，你在看什么？',
                speakerId: 2,
                speaker: '同伴',
                role: 'character',
            },
            {
                text: '他身旁的同伴问道。',
                speakerId: 0,
                speaker: '旁白',
                role: 'narrator',
            },
        ])
    })

    it('repairs mixed AI blocks with quote boundary crossing segments', async () => {
        const mixedText = '“他不是盲人。”阿诺笃定地说道，“他一定看得见。”'
        const mixedBook: Book = {
            sections: [{
                id: 'quote-boundary',
                size: 100,
                load: () => '',
                getBlocks: async () => [{
                    id: 'quote-boundary-p1',
                    type: 'paragraph',
                    segments: [{ text: mixedText }],
                }],
            }],
        }
        generateTextMock
            .mockResolvedValueOnce({
                output: {
                    speakers: [{ i: 1, n: '阿诺', r: 'c', g: 1 }],
                    assignments: [
                        { b: 0, a: 0, i: 0, c: 0.9 },
                    ],
                },
            })
            .mockImplementationOnce(async (options: any) => {
                const body = JSON.parse(options.prompt)
                expect(body.blocks).toEqual([{
                    b: 0,
                    t: 'paragraph',
                    l: mixedText.length,
                    x: mixedText,
                    m: 1,
                    u: [
                        expect.objectContaining({ a: 0, q: 1 }),
                        expect.objectContaining({ a: 1 }),
                        expect.objectContaining({ a: 2, q: 1 }),
                    ],
                }])
                expect(options.system).toContain('代码已经拆出旁白、动作、发言归属短语和引号内对白原子')
                return {
                    output: {
                        speakers: [],
                        assignments: [
                            { b: 0, a: 0, i: 1, c: 0.96 },
                            { b: 0, a: 1, i: 0, c: 0.96 },
                            { b: 0, a: 2, i: 1, c: 0.96 },
                        ],
                    },
                }
            })
        const wrapped = withTTS({
            fetch: vi.fn(async () => new Response(JSON.stringify({ voices: [] }))) as any,
            model: mockModel as any,
            voiceProfile: {
                narrator: 'narrator-voice',
                male: 'male-voice',
            },
        })(mixedBook) as TTSBook

        const segments = await wrapped.tts.prepareSection(0, {
            multiSpeaker: true,
            maxSegmentChars: 80,
        })

        expect(generateTextMock).toHaveBeenCalledTimes(2)
        expect(segments.map(segment => ({
            text: segment.text,
            speakerId: segment.speakerId,
            speaker: segment.speaker,
            role: segment.speakerRole,
        }))).toEqual([
            {
                text: '他不是盲人。',
                speakerId: 1,
                speaker: '阿诺',
                role: 'character',
            },
            {
                text: '阿诺笃定地说道，',
                speakerId: 0,
                speaker: '旁白',
                role: 'narrator',
            },
            {
                text: '他一定看得见。',
                speakerId: 1,
                speaker: '阿诺',
                role: 'character',
            },
        ])
    })

    it('trims leading speech boundary punctuation from compact AI segments', async () => {
        const text = '，“不过……听说是比那更离谱的事情。”'
        const onLog = vi.fn()
        const punctuationBook: Book = {
            sections: [{
                id: 'punctuation-boundary',
                size: 100,
                load: () => '',
                getBlocks: async () => [{
                    id: 'punctuation-boundary-p1',
                    type: 'paragraph',
                    segments: [{ text }],
                }],
            }],
        }
        generateTextMock.mockResolvedValueOnce({
            output: {
                speakers: [{ i: 1, n: '同伴', r: 'c', g: 1 }],
                assignments: [{ b: 0, a: 0, i: 1 }],
            },
        })
        const wrapped = withTTS({
            fetch: vi.fn(async () => new Response(JSON.stringify({ voices: [] }))) as any,
            model: mockModel as any,
            speakerAnalysis: { timeoutMs: 12345, onLog },
            voiceProfile: { male: 'male-voice' },
        })(punctuationBook) as TTSBook

        const segments = await wrapped.tts.prepareSection(0, {
            multiSpeaker: true,
            maxSegmentChars: 80,
        })

        expect(generateTextMock).toHaveBeenCalledTimes(1)
        const systemPrompt = generateTextMock.mock.calls[0][0].system
        expect(systemPrompt).toContain('任何引号外可读的旁白、动作或发言归属文本都必须是 i=0')
        expect(systemPrompt).toContain('引号内不一定是对白')
        expect(outputObjectMock.mock.calls[0][0].schema.properties.assignments.items.properties.c.description)
            .toContain('仅当置信度 <= 0.8')
        expect(generateTextMock.mock.calls[0][0].timeout).toEqual({ totalMs: 12345 })
        expect(generateTextMock.mock.calls[0][0].abortSignal).toBeInstanceOf(AbortSignal)
        expect(onLog).toHaveBeenCalledWith(expect.objectContaining({
            phase: 'initial',
            response: {
                speakers: [{ i: 1, n: '同伴', r: 'c', g: 1 }],
                assignments: [{ b: 0, a: 0, i: 1 }],
            },
        }))
        expect(segments).toHaveLength(1)
        expect(segments[0]).toMatchObject({
            startOffset: 2,
            endOffset: text.length - 1,
            text: '不过……听说是比那更离谱的事情。',
            speakerId: 1,
            speaker: '同伴',
            voice: 'male-voice',
        })
    })

    it('logs failed AI speaker analysis phases', async () => {
        const onLog = vi.fn()
        generateTextMock.mockRejectedValueOnce(new Error('LLM timed out'))
        const wrapped = withTTS({
            fetch: vi.fn(async () => new Response(JSON.stringify({ voices: [] }))) as any,
            model: mockModel as any,
            speakerAnalysis: { timeoutMs: 1, onLog },
        })(novelBook) as TTSBook

        await expect(wrapped.tts.prepareSection(0, {
            multiSpeaker: true,
            maxSegmentChars: 80,
        })).rejects.toThrow('LLM timed out')

        expect(onLog).toHaveBeenCalledWith(expect.objectContaining({
            phase: 'initial',
            sectionIndex: 0,
            response: null,
            error: 'LLM timed out',
            durationMs: expect.any(Number),
        }))
    })

    it('merges adjacent same-speaker segments to avoid artificial playback gaps', async () => {
        const text = '林七夜继续向前走，没有停下脚步。'
        const mergeBook: Book = {
            sections: [{
                id: 'merge',
                size: 100,
                load: () => '',
                getBlocks: async () => [{
                    id: 'merge-p1',
                    type: 'paragraph',
                    segments: [{ text }],
                }],
            }],
        }
        const analyzer = vi.fn(async () => ({
            segments: [
                {
                    blockId: 'merge-p1',
                    startOffset: 0,
                    endOffset: 8,
                    text: '林七夜继续向前走',
                    speaker: '旁白',
                    role: 'narrator' as const,
                    gender: 'unknown' as const,
                },
                {
                    blockId: 'merge-p1',
                    startOffset: 8,
                    endOffset: text.length,
                    text: '，没有停下脚步。',
                    speaker: '旁白',
                    role: 'narrator' as const,
                    gender: 'unknown' as const,
                },
            ],
        }))
        const wrapped = withTTS({
            fetch: vi.fn() as any,
            voiceProfile: { narrator: 'narrator-voice' },
        })(mergeBook) as TTSBook

        const segments = await wrapped.tts.prepareSection(0, {
            multiSpeaker: true,
            speakerAnalyzer: analyzer,
            maxSegmentChars: 80,
        })

        expect(segments).toHaveLength(1)
        expect(segments[0]).toMatchObject({
            blockId: 'merge-p1',
            text,
            speaker: '旁白',
            speakerRole: 'narrator',
            voice: 'narrator-voice',
        })
    })

    it('can use an AI speaker analyzer result for multi-speaker segments', async () => {
        const analyzer = vi.fn(async () => ({
            segments: [
                {
                    blockId: 'novel-p1',
                    startOffset: 0,
                    endOffset: 6,
                    text: '男人低声',
                    speaker: '林七夜',
                    role: 'character' as const,
                    gender: 'male' as const,
                    voice: 'lin-voice',
                    confidence: 0.94,
                },
                {
                    blockId: 'novel-p1',
                    startOffset: 6,
                    endOffset: 9,
                    text: '说道：',
                    speaker: '旁白',
                    role: 'narrator' as const,
                    gender: 'unknown' as const,
                },
            ],
        }))
        const wrapped = withTTS({
            fetch: vi.fn() as any,
            voiceProfile: { narrator: 'narrator-voice' },
        })(novelBook) as TTSBook
        const segments = await wrapped.tts.prepareSection(0, {
            multiSpeaker: true,
            speakerAnalyzer: analyzer,
        })

        expect(analyzer).toHaveBeenCalledWith({
            sectionIndex: 0,
            blocks: [{
                blockId: 'novel-p1',
                blockType: 'paragraph',
                text: novelBlocks[0].segments[0].text,
            }],
            knownSpeakers: [],
        })
        expect(segments).toMatchObject([
            {
                text: '男人低声',
                speaker: '林七夜',
                speakerRole: 'character',
                speakerGender: 'male',
                speakerConfidence: 0.94,
                voice: 'lin-voice',
            },
            {
                text: '说道：',
                speaker: '旁白',
                speakerRole: 'narrator',
                speakerGender: 'unknown',
                voice: 'narrator-voice',
            },
        ])
    })

    it('sends only language-relevant voices to AI speaker analysis', async () => {
        generateTextMock.mockResolvedValue({
            output: {
                speakers: [],
                assignments: [
                    { b: 0, a: 0, i: 0 },
                    { b: 0, a: 1, i: 0 },
                    { b: 0, a: 2, i: 0 },
                ],
            },
        })
        const englishBook: Book = {
            sections: [{
                id: 'en-1',
                size: 100,
                load: () => '',
                getBlocks: async () => [{
                    id: 'en-p1',
                    type: 'paragraph',
                    segments: [{ text: 'Alice said, "Follow me." The night was quiet.' }],
                }],
            }],
        }
        const voices = [
            { id: 'zh-CN-XiaoxiaoNeural', name: 'Xiaoxiao', locale: 'zh-CN', gender: 'Female', provider: 'edge' },
            { id: 'zh-CN-YunxiNeural', name: 'Yunxi', locale: 'zh-CN', gender: 'Male', provider: 'edge' },
            ...Array.from({ length: 30 }, (_, index) => ({
                id: `en-US-Test${index}Neural`,
                name: `English ${index}`,
                locale: 'en-US',
                gender: index % 2 === 0 ? 'Female' : 'Male',
                provider: 'edge',
            })),
            { id: 'ja-JP-NanamiNeural', name: 'Nanami', locale: 'ja-JP', gender: 'Female', provider: 'edge' },
        ]
        const wrapped = withTTS({
            endpoint: 'http://tts.test',
            fetch: vi.fn(async (url: string) => {
                if (url.includes('/v1/tts/voices')) return new Response(JSON.stringify({ voices }))
                return new Response(JSON.stringify({}))
            }) as any,
            model: mockModel as any,
        })(englishBook) as TTSBook

        await wrapped.tts.prepareSection(0, { multiSpeaker: true })

        const prompt = JSON.parse(generateTextMock.mock.calls.at(-1)![0].prompt)
        expect(prompt.voiceLanguage).toBeUndefined()
        expect(generateTextMock.mock.calls.at(-1)![0].system).toContain('语言提示：en-US')
        expect(prompt.voices.length).toBeLessThanOrEqual(24)
        expect(prompt.voices.some((voice: any) => voice.l === 'en-US')).toBe(true)
        expect(prompt.voices.some((voice: any) => voice.l === 'ja-JP')).toBe(false)
    })

    it('requires a model or custom analyzer for multi-speaker analysis', async () => {
        const wrapped = withTTS({ fetch: vi.fn() as any })(novelBook) as TTSBook
        await expect(wrapped.tts.prepareSection(0, { multiSpeaker: true }))
            .rejects.toThrow('TTS multiSpeaker requires a LanguageModel')
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

    itWithSlayFixture('prepares multi-speaker segments from the sample web novel EPUB', async () => {
        generateTextMock.mockImplementation(async (options: any) => {
            const body = JSON.parse(options.prompt)
            const block = body.blocks.find((item: any) => /“[^”]{1,40}”/.test(item.x)) ?? body.blocks[0]
            const atoms = Array.isArray(block.u) ? block.u : []
            const hasQuote = atoms.some((atom: any) => atom.q === 1)
            return {
                output: {
                    speakers: hasQuote
                        ? [{ i: 1, n: '林七夜', r: 'c', g: 1 }]
                        : [],
                    assignments: atoms.length
                        ? atoms.map((atom: any) => ({
                            b: block.b,
                            a: atom.a,
                            i: atom.q === 1 ? 1 : 0,
                            c: atom.q === 1 ? 0.8 : undefined,
                        }))
                        : [],
                },
            }
        })

        const parser = new EPUBParser()
        const data = await readFile(slayFixture)
        const parsed = await parser.parse(data.buffer.slice(
            data.byteOffset,
            data.byteOffset + data.byteLength,
        ), {
            domAdapter: new NodeDOMAdapter(),
            urlFactory: new NodeURLFactory(),
        })
        let sectionIndex = -1
        for (let index = 0; index < parsed.sections.length; index++) {
            const section = parsed.sections[index]
            if (Number(section.size) < 200 || !section.getBlocks) continue
            const blocks = await section.getBlocks()
            const hasDialogue = blocks.some(block =>
                block.segments?.some(segment => /“[^”]{1,80}”/.test(segment.text))
            )
            if (hasDialogue) {
                sectionIndex = index
                break
            }
        }
        expect(sectionIndex).toBeGreaterThanOrEqual(0)

        const wrapped = withTTS({
            fetch: vi.fn() as any,
            model: mockModel as any,
            voiceProfile: {
                narrator: 'narrator-voice',
                male: 'male-voice',
            },
        })(parsed) as TTSBook
        const segments = await wrapped.tts.prepareSection(sectionIndex, { multiSpeaker: true })

        expect(segments.length).toBeGreaterThan(0)
        expect(segments.some(segment => segment.speakerRole === 'narrator')).toBe(true)
        expect(segments.some(segment => segment.speaker === '林七夜' && segment.voice === 'male-voice')).toBe(true)
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
