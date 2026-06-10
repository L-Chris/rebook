import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)

describe('tts replay script', () => {
    it('reports gaps, out-of-range segments, and mixed single-speaker blocks', async () => {
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
                            { b: 0, t: 'paragraph', x: '“你好。”他说。', m: 1 },
                            { b: 1, t: 'paragraph', x: '天气很好。' },
                            { b: 2, t: 'paragraph', x: '他继续向前走。' },
                        ],
                    }),
                }],
            }))
            await writeFile(resPath, JSON.stringify({
                speakers: [{ i: 1, n: '他说', r: 'c', g: 0 }],
                segments: [
                    { b: 0, s: 0, e: 7, i: 1 },
                    { b: 1, s: 0, e: 99, i: 0 },
                    { b: 2, s: 0, e: 2, i: 0 },
                ],
            }))

            const { stdout } = await execFileAsync(process.execPath, [
                'scripts/tts-replay.mjs',
                reqPath,
                resPath,
                '--json',
            ])
            const report = JSON.parse(stdout)

            expect(report.summary.blocks).toBe(3)
            expect(report.summary.gapCount).toBe(1)
            expect(report.summary.tailGapCount).toBe(1)
            expect(report.summary.outOfRangeCount).toBe(1)
            expect(report.summary.mixedSingleSpeakerCount).toBe(1)
            expect(report.examples.gaps[0]).toMatchObject({ b: 2, kind: 'tail' })
        } finally {
            await rm(dir, { recursive: true, force: true })
        }
    })
})
