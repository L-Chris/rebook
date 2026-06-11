import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)

describe('tts replay script', () => {
    it('reports gaps, invalid atom assignments, and mixed single-speaker blocks', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'rebook-tts-replay-'))
        try {
            const reqPath = join(dir, 'req.json')
            const resPath = join(dir, 'res.json')
            await writeFile(reqPath, JSON.stringify({
                messages: [{
                    role: 'user',
                    content: JSON.stringify({
                        sectionIndex: 1,
                        nextSpeakerId: 1,
                        voiceLanguage: 'zh-CN',
                        voices: [],
                        knownSpeakers: [{ i: 0, n: '旁白', r: 'n', g: 0 }],
                        blocks: [
                            {
                                b: 0,
                                t: 'paragraph',
                                x: '“你好。”他说。',
                                m: 1,
                                u: [
                                    { a: 0, s: 1, e: 4, x: '你好。', q: 1 },
                                    { a: 1, s: 5, e: 8, x: '他说。' },
                                ],
                            },
                            {
                                b: 1,
                                t: 'paragraph',
                                x: '天气很好。',
                                u: [{ a: 0, s: 0, e: 5, x: '天气很好。' }],
                            },
                            {
                                b: 2,
                                t: 'paragraph',
                                x: '他继续向前走。',
                                u: [{ a: 0, s: 0, e: 7, x: '他继续向前走。' }],
                            },
                            {
                                b: 3,
                                t: 'paragraph',
                                x: '“走。”林七夜笑道。',
                                m: 1,
                                u: [
                                    { a: 0, s: 1, e: 3, x: '走。', q: 1 },
                                    { a: 1, s: 4, e: 10, x: '林七夜笑道。' },
                                ],
                            },
                        ],
                    }),
                }],
            }))
            await writeFile(resPath, JSON.stringify({
                speakers: [{ i: 1, n: '他说', r: 'c', g: 0 }],
                assignments: [
                    { b: 0, a: 0, i: 1 },
                    { b: 1, a: 0, i: 0 },
                    { b: 2, a: 0, i: 0 },
                    { b: 3, a: 0, i: 1, p: '轻笑' },
                    { b: 3, a: 1, i: 0, k: 'm' },
                    { b: 99, a: 0, i: 0 },
                ],
            }))

            const { stdout } = await execFileAsync(process.execPath, [
                'scripts/tts-replay.mjs',
                reqPath,
                resPath,
                '--json',
            ])
            const report = JSON.parse(stdout)

            expect(report.summary.blocks).toBe(4)
            expect(report.summary.gapCount).toBe(1)
            expect(report.summary.tailGapCount).toBe(1)
            expect(report.summary.invalidSegmentCount).toBe(1)
            expect(report.summary.mixedSingleSpeakerCount).toBe(1)
            expect(report.examples.gaps[0]).toMatchObject({ b: 0, kind: 'tail' })
            expect(report.examples.gaps.some((gap) => gap.b === 3)).toBe(false)
        } finally {
            await rm(dir, { recursive: true, force: true })
        }
    })
})
