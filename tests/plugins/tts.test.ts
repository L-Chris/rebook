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
                        segments: [
                            {
                                b: 0,
                                s: 0,
                                e: 8,
                                i: 0,
                            },
                            {
                                b: 0,
                                s: 9,
                                e: 12,
                                i: 1,
                                c: 0.92,
                            },
                            {
                                b: 0,
                                s: 13,
                                e: 19,
                                i: 0,
                            },
                            {
                                b: 0,
                                s: 20,
                                e: 25,
                                i: 2,
                                c: 0.88,
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
                    segments: [
                        {
                            b: 0,
                            s: 0,
                            e: 6,
                            i: 0,
                        },
                        {
                            b: 0,
                            s: 7,
                            e: 11,
                            i: 1,
                            c: 0.91,
                        },
                        {
                            b: 0,
                            s: 12,
                            e: 18,
                            i: 0,
                        },
                        {
                            b: 0,
                            s: 19,
                            e: 25,
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
        }])
        expect(JSON.parse(generateTextMock.mock.calls[1][0].prompt).nextSpeakerId).toBe(3)
        expect(JSON.parse(generateTextMock.mock.calls[1][0].prompt).knownSpeakers).toEqual(expect.arrayContaining([
            expect.objectContaining({ i: 0, n: '旁白', g: 0 }),
            expect.objectContaining({ i: 1, n: '林七夜', g: 1 }),
            expect.objectContaining({ i: 2, n: '司小南', g: 2 }),
        ]))
        expect(JSON.parse(generateTextMock.mock.calls[1][0].prompt).knownSpeakers.some((speaker: any) => speaker.v || speaker.d)).toBe(false)
        expect(outputObjectMock.mock.calls[0][0].schema.required).toEqual(['speakers', 'segments'])
        expect(outputObjectMock.mock.calls[0][0].schema.properties.segments.items.required).toEqual(['b', 's', 'e', 'i'])
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
        const expectedRoleCard = '角色：林七夜；性别：男；年龄：少年；身份/职业：盲眼学生；性格/气质：冷静克制，敏锐；声线/表演：清亮低沉，语速略慢'
        const expectedSpeakerHint = '林七夜=盲眼少年；林七夜说道/问道时引用内容归他；别人谈论林七夜不代表他说话'
        generateTextMock
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
                    segments: [
                        { b: 0, s: 0, e: 3, i: 0 },
                        { b: 0, s: 4, e: 7, i: 1, c: 0.93 },
                        { b: 0, s: 8, e: firstText.length, i: 0 },
                    ],
                },
            })
            .mockResolvedValueOnce({
                output: [],
            })
            .mockResolvedValueOnce({
                output: {
                    segments: [
                        { b: 0, s: 0, e: 6, i: 0 },
                        { b: 0, s: 7, e: 11, i: 1, c: 0.94 },
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

        expect(generateTextMock).toHaveBeenCalledTimes(4)
        const firstPlanPrompt = JSON.parse(generateTextMock.mock.calls[0][0].prompt)
        const firstSegmentPrompt = JSON.parse(generateTextMock.mock.calls[1][0].prompt)
        const secondPlanPrompt = JSON.parse(generateTextMock.mock.calls[2][0].prompt)
        const secondSegmentPrompt = JSON.parse(generateTextMock.mock.calls[3][0].prompt)
        expect(firstPlanPrompt.voiceDesign).toBeUndefined()
        expect(firstPlanPrompt.voices).toBeUndefined()
        expect(firstPlanPrompt.nextSpeakerId).toBe(1)
        expect(generateTextMock.mock.calls[0][0].system).toContain('角色规划和语音规划引擎')
        expect(generateTextMock.mock.calls[1][0].system).toContain('当前是角色设计后的文本分段阶段')
        expect(firstSegmentPrompt.nextSpeakerId).toBeUndefined()
        expect(firstSegmentPrompt.voices).toBeUndefined()
        expect(outputArrayMock.mock.calls[0][0].element.required).toEqual(['i', 'n', 'r', 'g'])
        expect(outputObjectMock.mock.calls[0][0].schema.required).toEqual(['segments'])
        expect(outputObjectMock.mock.calls[0][0].schema.properties.speakers).toBeUndefined()
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
        const expectedRoleCard = '角色：林七夜；性别：男；年龄：青年；身份/职业：学生；性格/气质：冷静克制；声线/表演：嗓音清亮'
        generateTextMock
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
                    segments: [
                        { b: 0, s: 0, e: 7, i: 0 },
                        { b: 0, s: 8, e: 11, i: 1 },
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

        expect(generateTextMock).toHaveBeenCalledTimes(2)
        const planPrompt = JSON.parse(generateTextMock.mock.calls[0][0].prompt)
        const segmentPrompt = JSON.parse(generateTextMock.mock.calls[1][0].prompt)
        expect(planPrompt.voiceDesign).toBeUndefined()
        expect(planPrompt.voices).toBeUndefined()
        expect(generateTextMock.mock.calls[0][0].system).toContain('角色规划和语音规划引擎')
        expect(generateTextMock.mock.calls[1][0].system).toContain('当前是角色设计后的文本分段阶段')
        expect(segmentPrompt.voices).toBeUndefined()
        expect(outputArrayMock.mock.calls[0][0].element.required).toEqual(['i', 'n', 'r', 'g'])
        expect(outputObjectMock.mock.calls[0][0].schema.required).toEqual(['segments'])
        expect(outputObjectMock.mock.calls[0][0].schema.properties.speakers).toBeUndefined()
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
                    segments: [{ b: 0, s: 0, e: mixedText.length, i: 1, c: 0.6 }],
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
                    k: expect.any(String),
                }])
                expect(body.knownSpeakers).toEqual(expect.arrayContaining([
                    expect.objectContaining({ i: 1, n: '林七夜', r: 'c', g: 1 }),
                ]))
                return {
                    output: {
                        speakers: [],
                        segments: [
                            { b: 0, s: 1, e: 12, i: 1, c: 0.95 },
                            { b: 0, s: 13, e: mixedText.length, i: 0, c: 0.95 },
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
                    segments: [
                        { b: 0, s: 0, e: 3, i: 0, c: 1 },
                        { b: 0, s: 3, e: 15, i: 1, c: 0.9 },
                        { b: 0, s: 15, e: 19, i: 0, c: 1 },
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
                    k: expect.any(String),
                }])
                expect(body.knownSpeakers).toEqual(expect.arrayContaining([
                    expect.objectContaining({ i: 1, n: '阿诺' }),
                    expect.objectContaining({ i: 2, n: '同伴' }),
                ]))
                return {
                    output: {
                        speakers: [],
                        segments: [
                            { b: 0, s: 1, e: 10, i: 2, c: 0.96 },
                            { b: 0, s: 11, e: mixedText.length, i: 0, c: 0.96 },
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
                    segments: [
                        { b: 0, s: 0, e: 14, i: 0, c: 0.9 },
                        { b: 0, s: 14, e: mixedText.length, i: 1, c: 0.9 },
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
                    k: expect.any(String),
                }])
                expect(options.system).toContain('同时跨过引号内对白和引号外叙述/归属文本')
                return {
                    output: {
                        speakers: [],
                        segments: [
                            { b: 0, s: 1, e: 7, i: 1, c: 0.96 },
                            { b: 0, s: 8, e: mixedText.length - 1, i: 1, c: 0.96 },
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
                segments: [{ b: 0, s: 0, e: text.length, i: 1 }],
            },
        })
        const wrapped = withTTS({
            fetch: vi.fn(async () => new Response(JSON.stringify({ voices: [] }))) as any,
            model: mockModel as any,
            speakerAnalysis: { timeoutMs: 12345 },
            voiceProfile: { male: 'male-voice' },
        })(punctuationBook) as TTSBook

        const segments = await wrapped.tts.prepareSection(0, {
            multiSpeaker: true,
            maxSegmentChars: 80,
        })

        expect(generateTextMock).toHaveBeenCalledTimes(1)
        const systemPrompt = generateTextMock.mock.calls[0][0].system
        expect(systemPrompt).toContain('任何引号外可读的旁白、动作或发言归属文本都必须是 i=0')
        expect(outputObjectMock.mock.calls[0][0].schema.properties.segments.items.properties.c.description)
            .toContain('仅当置信度 <= 0.8')
        expect(generateTextMock.mock.calls[0][0].timeout).toEqual({ totalMs: 12345 })
        expect(generateTextMock.mock.calls[0][0].abortSignal).toBeInstanceOf(AbortSignal)
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
                segments: [{ b: 0, s: 0, e: 12, i: 0 }],
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
            const quoteStart = block.x.indexOf('“')
            const quoteEnd = block.x.indexOf('”', quoteStart + 1)
            const hasQuote = quoteStart >= 0 && quoteEnd > quoteStart
            return {
                output: {
                    speakers: hasQuote
                        ? [{ i: 1, n: '林七夜', r: 'c', g: 1 }]
                        : [],
                    segments: hasQuote
                        ? [
                            {
                                b: block.b,
                                s: 0,
                                e: quoteStart,
                                i: 0,
                            },
                            {
                                b: block.b,
                                s: quoteStart + 1,
                                e: quoteEnd,
                                i: 1,
                                c: 0.8,
                            },
                        ]
                        : [{
                            b: block.b,
                            s: 0,
                            e: Math.min(block.x.length, 80),
                            i: 0,
                        }],
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
