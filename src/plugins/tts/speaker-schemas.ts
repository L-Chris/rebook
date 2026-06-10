import type { TextBlock } from '../../core/types'
import type { TTSCompactSpeakerAnalysisMode } from './speaker-prompts'

export interface TTSCompactSpeakerAttribution {
    b: number
    a: number
    i: number
    c?: number
}

export interface TTSCompactSpeakerAnalysisSegment {
    b: number
    s: number
    e: number
    i: number
    c?: number
}

export interface TTSCompactSpeakerAnalysisOutput {
    speakers?: readonly TTSCompactSpeakerInfo[]
    assignments: readonly TTSCompactSpeakerAttribution[]
}

export interface TTSCompactSpeakerAnalysis {
    speakers?: readonly TTSCompactSpeakerInfo[]
    segments: readonly TTSCompactSpeakerAnalysisSegment[]
}

export interface TTSCompactSpeakerPlan {
    speakers: readonly TTSCompactSpeakerInfo[]
}

export interface TTSCompactSpeakerAnalysisBlock {
    b: number
    t: TextBlock['type']
    l: number
    x: string
    m?: 1
    u?: readonly TTSCompactSpeakerAtom[]
}

export interface TTSCompactSpeakerAtom {
    a: number
    s: number
    e: number
    x: string
    q?: 1
}

export interface TTSCompactSpeakerInfo {
    i: number
    n: string
    r?: 'n' | 'c' | 'o'
    g?: 0 | 1 | 2
    v?: string
    d?: string
    a?: string
    o?: string
    p?: string
    q?: string
    h?: string
}

export interface TTSCompactVoice {
    v: string
    n?: string
    l?: string
    g?: 0 | 1 | 2
    p?: string
}

export type TTSCompactKnownSpeaker = TTSCompactSpeakerInfo

export interface TTSCompactSpeakerAnalysisRequest {
    sectionIndex: number
    nextSpeakerId: number
    voiceLanguage: string
    voices?: readonly TTSCompactVoice[]
    blocks: readonly TTSCompactSpeakerAnalysisBlock[]
    knownSpeakers: readonly TTSCompactKnownSpeaker[]
    voiceDesign?: 1
}

export interface TTSCompactSpeakerModelRequest {
    nextSpeakerId?: number
    voices?: readonly TTSCompactVoice[]
    blocks: readonly TTSCompactSpeakerAnalysisBlock[]
    knownSpeakers: readonly TTSCompactKnownSpeaker[]
}

export type TTSCompactSpeakerModelRequestKind = 'plan' | 'initial' | 'repair'

export const speakerAnalysisSchema = {
    type: 'object',
    description: '预设音色文本解析结果；必须返回 assignments，不要返回 segments；仅在需要新增或修正说话人时返回 speakers。',
    properties: {
        assignments: {
            type: 'array',
            description: 'TTS 朗读原子归属。a 对应输入 blocks[].u[].a；不要输出 offset。',
            items: {
                type: 'object',
                properties: {
                    b: { type: 'number', description: 'block index，对应输入 blocks[].b。' },
                    a: { type: 'number', description: 'atom id，对应该 block 的 u[].a。' },
                    i: { type: 'number', description: 'speaker id；旁白使用 0。' },
                    c: { type: 'number', description: 'confidence；仅当置信度 <= 0.8 或分配不确定时输出。' },
                },
                required: ['b', 'a', 'i'],
                additionalProperties: false,
            },
        },
        speakers: {
            type: 'array',
            description: '新增或必须纠正的说话人；不要重复返回已知说话人。',
            items: {
                type: 'object',
                properties: {
                    i: { type: 'number', description: 'speaker id；新增说话人从 nextSpeakerId 开始递增。' },
                    n: { type: 'string', description: '稳定角色名。' },
                    r: { type: 'string', enum: ['n', 'c', 'o'], description: 'role code：n=旁白，c=角色对白，o=其他/无法归属声音。' },
                    g: { type: 'number', enum: [0, 1, 2], description: 'gender code：0=未知，1=男，2=女。' },
                    v: { type: 'string', description: 'voice id；从输入 voices 中选择。' },
                    h: { type: 'string', maxLength: 260, description: '说话人识别线索/上下文，用于后续保持身份一致。' },
                },
                required: ['i', 'n', 'r', 'g'],
                additionalProperties: false,
            },
        },
    },
    required: ['speakers', 'assignments'],
    additionalProperties: false,
} as const

export const voiceDesignSpeakerAnalysisSchema = {
    type: 'object',
    description: '角色设计后的文本解析结果；必须返回 assignments，不要返回 segments；speaker id 必须来自 knownSpeakers。',
    properties: {
        assignments: {
            type: 'array',
            description: 'TTS 朗读原子归属。a 对应输入 blocks[].u[].a；不要输出 offset。',
            items: {
                type: 'object',
                properties: {
                    b: { type: 'number', description: 'block index，对应输入 blocks[].b。' },
                    a: { type: 'number', description: 'atom id，对应该 block 的 u[].a。' },
                    i: { type: 'number', description: 'speaker id；必须来自 knownSpeakers，旁白使用 0。' },
                    c: { type: 'number', description: 'confidence；仅当置信度 <= 0.8 或分配不确定时输出。' },
                },
                required: ['b', 'a', 'i'],
                additionalProperties: false,
            },
        },
    },
    required: ['assignments'],
    additionalProperties: false,
} as const

export const speakerPlanItemSchema = {
    type: 'object',
    description: '规划出的重要或反复发声角色；只识别角色，不进行文本分段。',
    properties: {
        i: { type: 'number', description: 'speaker id；新增说话人从 nextSpeakerId 开始递增。' },
        n: { type: 'string', description: '稳定角色名。' },
        r: { type: 'string', enum: ['c', 'o'], description: 'role code：c=角色对白，o=其他/无法归属声音。' },
        g: { type: 'number', enum: [0, 1, 2], description: 'gender code：0=未知，1=男，2=女。' },
        a: { type: 'string', maxLength: 80, description: '年龄或年龄感。' },
        o: { type: 'string', maxLength: 120, description: '职业、身份或社会角色。' },
        p: { type: 'string', maxLength: 160, description: '性格、气质和行为特征。' },
        q: { type: 'string', maxLength: 160, description: '声音与表演风格，用于生成角色卡。' },
        h: { type: 'string', maxLength: 260, description: '说话人识别线索/上下文，不是声音风格。' },
    },
    required: ['i', 'n', 'r', 'g'],
    additionalProperties: false,
} as const

export function getSpeakerAnalysisSchema(mode: TTSCompactSpeakerAnalysisMode) {
    return mode === 'voiceDesign' ? voiceDesignSpeakerAnalysisSchema : speakerAnalysisSchema
}
