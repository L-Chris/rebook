#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const DEFAULT_REQUEST_PATH = 'data/req.json'
const DEFAULT_RESPONSE_PATH = 'data/res.json'

async function main() {
    const options = parseArgs(process.argv.slice(2))
    const requestRaw = await readJsonFile(options.requestPath)
    const responseRaw = await readJsonFile(options.responsePath)
    const request = extractSpeakerRequest(requestRaw)
    const response = extractSpeakerResponse(responseRaw)
    const report = analyzeReplay(request, response, options)

    if (options.json) {
        console.log(JSON.stringify(report, null, 2))
    } else {
        console.log(formatReport(report, options))
    }

    const failOn = options.failOn
    if (failOn === 'error' && report.summary.errorCount > 0) process.exitCode = 1
    if (failOn === 'warning' && (report.summary.errorCount > 0 || report.summary.warningCount > 0)) process.exitCode = 1
}

function parseArgs(argv) {
    const positional = []
    const options = {
        requestPath: DEFAULT_REQUEST_PATH,
        responsePath: DEFAULT_RESPONSE_PATH,
        json: false,
        maxExamples: 8,
        maxMergeChars: 500,
        tinyChars: 4,
        failOn: 'none',
    }

    for (let index = 0; index < argv.length; index++) {
        const arg = argv[index]
        if (arg === '--json') {
            options.json = true
        } else if (arg === '--max-examples') {
            options.maxExamples = Number(argv[++index] ?? options.maxExamples)
        } else if (arg === '--max-merge-chars') {
            options.maxMergeChars = Number(argv[++index] ?? options.maxMergeChars)
        } else if (arg === '--tiny-chars') {
            options.tinyChars = Number(argv[++index] ?? options.tinyChars)
        } else if (arg === '--fail-on') {
            options.failOn = argv[++index] ?? options.failOn
        } else if (arg === '--help' || arg === '-h') {
            printHelp()
            process.exit(0)
        } else {
            positional.push(arg)
        }
    }

    options.requestPath = positional[0] ?? options.requestPath
    options.responsePath = positional[1] ?? options.responsePath
    if (!['none', 'error', 'warning'].includes(options.failOn)) {
        throw new Error('--fail-on must be one of: none, error, warning')
    }
    return options
}

function printHelp() {
    console.log(`Usage: node scripts/tts-replay.mjs [req.json] [res.json] [options]

Options:
  --json                 Print machine-readable JSON.
  --max-examples N       Limit examples per finding type. Default: 8.
  --max-merge-chars N    Adjacent same-speaker merge-risk threshold. Default: 500.
  --tiny-chars N         Tiny segment threshold. Default: 4.
  --fail-on LEVEL        none, error, or warning. Default: none.
`)
}

async function readJsonFile(path) {
    const text = await readFile(path, 'utf8')
    if (!text.trim()) throw new Error(`${path} is empty`)
    return JSON.parse(text)
}

export function extractSpeakerRequest(value) {
    if (value && typeof value === 'object' && Array.isArray(value.messages)) {
        const userMessage = value.messages.find(message => message?.role === 'user')
        if (!userMessage) throw new Error('OpenAI request does not contain a user message')
        return parseJsonContent(userMessage.content, 'request user message')
    }
    if (value && typeof value === 'object' && Array.isArray(value.blocks)) return value
    throw new Error('Unsupported request shape')
}

export function extractSpeakerResponse(value) {
    const content = value?.choices?.[0]?.message?.content ?? value?.output ?? value
    const response = parseJsonContent(content, 'response')
    if (!response || typeof response !== 'object' || !Array.isArray(response.assignments)) {
        throw new Error('Unsupported response shape')
    }
    return response
}

function parseJsonContent(value, label) {
    if (typeof value === 'string') return JSON.parse(value)
    if (value && typeof value === 'object') return value
    throw new Error(`Unsupported ${label} content`)
}

export function analyzeReplay(request, response, options = {}) {
    options = {
        maxExamples: 8,
        maxMergeChars: 500,
        tinyChars: 4,
        ...options,
    }
    const blocks = Array.isArray(request.blocks) ? request.blocks : []
    const speakers = Array.isArray(response.speakers) ? response.speakers : []
    const rawSegments = Array.isArray(response.assignments) ? response.assignments : []
    const blockById = new Map(blocks.map(block => [block.b, block]))
    const segments = []
    const invalidSegments = []

    rawSegments.forEach((segment, index) => {
        if (!isFiniteNumber(segment?.b) || !isFiniteNumber(segment?.a) || !isFiniteNumber(segment?.i)) {
            invalidSegments.push({ index, segment })
            return
        }
        const block = blockById.get(segment.b)
        const atom = Array.isArray(block?.u)
            ? block.u.find(item => item?.a === segment.a)
            : undefined
        if (!atom || !isFiniteNumber(atom.s) || !isFiniteNumber(atom.e)) {
            invalidSegments.push({ index, segment, reason: 'unknown atom' })
            return
        }
        segments.push({
            index,
            b: segment.b,
            a: segment.a,
            s: atom.s,
            e: atom.e,
            i: block?.m === 1 && atom.q !== 1 ? 0 : segment.i,
            c: isFiniteNumber(segment.c) ? segment.c : undefined,
            k: segment.k === 's' || segment.k === 'm' ? segment.k : undefined,
        })
    })

    const segmentsByBlock = new Map()
    for (const segment of segments) {
        const list = segmentsByBlock.get(segment.b)
        if (list) list.push(segment)
        else segmentsByBlock.set(segment.b, [segment])
    }

    const examples = {
        gaps: [],
        outOfRange: [],
        overlaps: [],
        mixedSingleSpeaker: [],
        adjacentSameSpeaker: [],
        tinySegments: [],
        invalidSegments,
    }
    const counters = {
        gapCount: 0,
        tailGapCount: 0,
        outOfRangeCount: 0,
        overlapCount: 0,
        mixedSingleSpeakerCount: 0,
        adjacentSameSpeakerCount: 0,
        tinySegmentCount: 0,
        unknownBlockSegmentCount: 0,
        invalidSegmentCount: invalidSegments.length,
    }

    for (const segment of segments) {
        const block = blockById.get(segment.b)
        if (!block) {
            counters.unknownBlockSegmentCount += 1
            continue
        }
        if (segment.s < 0 || segment.e > block.x.length || segment.e < segment.s) {
            counters.outOfRangeCount += 1
            pushExample(examples.outOfRange, options, {
                b: segment.b,
                s: segment.s,
                e: segment.e,
                i: segment.i,
                blockLength: block.x.length,
                text: clipText(block.x),
            })
        }
        const start = clamp(segment.s, 0, block.x.length)
        const end = clamp(Math.max(segment.e, start), 0, block.x.length)
        if (!isMutedSegment(segment) && hasSpeakableText(block.x.slice(start, end)) && end - start <= options.tinyChars) {
            counters.tinySegmentCount += 1
            pushExample(examples.tinySegments, options, {
                b: segment.b,
                s: segment.s,
                e: segment.e,
                i: segment.i,
                text: block.x.slice(start, end),
            })
        }
    }

    for (const block of blocks) {
        const list = (segmentsByBlock.get(block.b) ?? [])
            .slice()
            .sort((a, b) => a.s - b.s || a.e - b.e)
        let cursor = 0
        const speakerIds = new Set()
        for (let index = 0; index < list.length; index++) {
            const segment = list[index]
            const start = clamp(segment.s, 0, block.x.length)
            const end = clamp(Math.max(segment.e, start), 0, block.x.length)
            if (!isMutedSegment(segment) && hasSpeakableText(block.x.slice(start, end))) speakerIds.add(normalizeSpeakerId(segment.i))
            if (start < cursor) {
                counters.overlapCount += 1
                pushExample(examples.overlaps, options, {
                    b: block.b,
                    cursor,
                    s: segment.s,
                    e: segment.e,
                    i: segment.i,
                    text: clipText(block.x),
                })
            }
            if (start > cursor) {
                const gapText = block.x.slice(cursor, start)
                if (hasSpeakableText(gapText)) {
                    counters.gapCount += 1
                    pushExample(examples.gaps, options, {
                        b: block.b,
                        kind: 'gap',
                        from: cursor,
                        to: start,
                        text: gapText,
                    })
                }
            }
            const next = list[index + 1]
            if (next && !isMutedSegment(segment) && !isMutedSegment(next)) addAdjacentSameSpeakerFinding(block, segment, next, counters, examples, options)
            cursor = Math.max(cursor, end)
        }
        if (cursor < block.x.length) {
            const gapText = block.x.slice(cursor)
            if (hasSpeakableText(gapText)) {
                counters.gapCount += 1
                counters.tailGapCount += 1
                pushExample(examples.gaps, options, {
                    b: block.b,
                    kind: 'tail',
                    from: cursor,
                    to: block.x.length,
                    text: gapText,
                })
            }
        }
        if (isLikelyMixedNarrationDialogue(block.x) && speakerIds.size <= 1 && hasRequiredSpokenNarration(block, list)) {
            counters.mixedSingleSpeakerCount += 1
            pushExample(examples.mixedSingleSpeaker, options, {
                b: block.b,
                speakers: [...speakerIds],
                segments: list.length,
                text: clipText(block.x),
            })
        }
    }

    const errorCount = counters.gapCount
        + counters.outOfRangeCount
        + counters.overlapCount
        + counters.unknownBlockSegmentCount
        + counters.invalidSegmentCount
    const warningCount = counters.mixedSingleSpeakerCount
        + counters.adjacentSameSpeakerCount
        + counters.tinySegmentCount

    return {
        summary: {
            blocks: blocks.length,
            speakers: speakers.length,
            segments: segments.length,
            ...counters,
            errorCount,
            warningCount,
        },
        examples,
    }
}

function addAdjacentSameSpeakerFinding(block, previous, next, counters, examples, options) {
    if (normalizeSpeakerId(previous.i) !== normalizeSpeakerId(next.i)) return
    const previousStart = clamp(previous.s, 0, block.x.length)
    const previousEnd = clamp(Math.max(previous.e, previousStart), 0, block.x.length)
    const nextStart = clamp(next.s, 0, block.x.length)
    const nextEnd = clamp(Math.max(next.e, nextStart), 0, block.x.length)
    if (nextStart < previousEnd || nextStart - previousEnd > 8) return
    const previousText = block.x.slice(previousStart, previousEnd)
    const nextText = block.x.slice(nextStart, nextEnd)
    if (!hasSpeakableText(previousText) || !hasSpeakableText(nextText)) return
    if (joinSegmentText(previousText, nextText).length > options.maxMergeChars) return
    counters.adjacentSameSpeakerCount += 1
    pushExample(examples.adjacentSameSpeaker, options, {
        b: block.b,
        i: previous.i,
        first: { s: previous.s, e: previous.e, text: clipText(previousText, 60) },
        second: { s: next.s, e: next.e, text: clipText(nextText, 60) },
    })
}

export function formatReport(report, options = {}) {
    options = {
        maxExamples: 8,
        ...options,
    }
    const lines = [
        'TTS replay report',
        '',
        `Blocks: ${report.summary.blocks}`,
        `Speakers: ${report.summary.speakers}`,
        `Segments: ${report.summary.segments}`,
        `Errors: ${report.summary.errorCount}`,
        `Warnings: ${report.summary.warningCount}`,
        '',
        'Findings:',
        `- gaps: ${report.summary.gapCount} (tail: ${report.summary.tailGapCount})`,
        `- out-of-range segments: ${report.summary.outOfRangeCount}`,
        `- overlaps: ${report.summary.overlapCount}`,
        `- mixed blocks with one speaker: ${report.summary.mixedSingleSpeakerCount}`,
        `- adjacent same-speaker split risks: ${report.summary.adjacentSameSpeakerCount}`,
        `- tiny segments: ${report.summary.tinySegmentCount}`,
    ]

    for (const [name, items] of Object.entries(report.examples)) {
        if (!items.length) continue
        lines.push('', `${name} examples:`)
        for (const item of items.slice(0, options.maxExamples)) {
            lines.push(`- ${JSON.stringify(item)}`)
        }
    }
    return lines.join('\n')
}

function pushExample(list, options, value) {
    if (list.length < options.maxExamples) list.push(value)
}

function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value)
}

function normalizeSpeakerId(value) {
    return isFiniteNumber(value) ? Math.max(0, Math.floor(value)) : undefined
}

function isMutedSegment(segment) {
    return segment?.k === 's' || segment?.k === 'm'
}

function hasRequiredSpokenNarration(block, segments) {
    const muted = segments.filter(isMutedSegment)
    for (const atom of block.u ?? []) {
        if (atom?.q === 1) continue
        const text = block.x.slice(atom.s, atom.e)
        if (!hasSpeakableText(text)) continue
        if (muted.some(segment => segment.s <= atom.s && segment.e >= atom.e)) continue
        return true
    }
    return false
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value))
}

function hasSpeakableText(text) {
    return normalizeText(text).replace(/[\s"'“”‘’「」『』()[\]{}<>《》。，、？！：；,.!?;:\-—–…]+/g, '').length > 0
}

function normalizeText(text) {
    return String(text ?? '').replace(/\s+/g, ' ').trim()
}

function isLikelyMixedNarrationDialogue(text) {
    const ranges = findQuotedRanges(text)
    if (!ranges.length) return false
    let outsideText = ''
    let hasQuotedSpeech = false
    let cursor = 0
    for (const range of ranges) {
        outsideText += text.slice(cursor, range.start)
        if (hasSpeakableText(text.slice(range.start + 1, range.end))) hasQuotedSpeech = true
        cursor = Math.max(cursor, range.end + 1)
    }
    outsideText += text.slice(cursor)
    return hasQuotedSpeech && hasSpeakableText(outsideText)
}

function findQuotedRanges(text) {
    const ranges = []
    for (const [openQuote, closeQuote] of [['“', '”'], ['「', '」'], ['『', '』'], ['"', '"']]) {
        let searchFrom = 0
        while (searchFrom < text.length) {
            const start = text.indexOf(openQuote, searchFrom)
            if (start < 0) break
            const end = text.indexOf(closeQuote, start + 1)
            if (end < 0) break
            ranges.push({ start, end })
            searchFrom = end + 1
        }
    }
    return ranges.sort((a, b) => a.start - b.start || a.end - b.end)
}

function joinSegmentText(previous, next) {
    if (!previous) return next
    if (!next) return previous
    if (/\s$/.test(previous) || /^\s/.test(next)) return previous + next
    const left = previous[previous.length - 1] ?? ''
    const right = next[0] ?? ''
    return /[A-Za-z0-9]/.test(left) && /[A-Za-z0-9]/.test(right)
        ? `${previous} ${next}`
        : previous + next
}

function clipText(text, length = 120) {
    const value = String(text ?? '')
    return value.length <= length ? value : `${value.slice(0, length)}...`
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch(error => {
        console.error(error instanceof Error ? error.message : String(error))
        process.exit(1)
    })
}
