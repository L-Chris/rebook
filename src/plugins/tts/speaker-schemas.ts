import type { TextBlock } from '../../core/types'
import type { TTSCompactSpeakerAnalysisMode } from './speaker-prompts'

export type TTSCompactSpeakerTier = 'S' | 'A' | 'B' | 'C'

export interface TTSCompactSpeakerAttribution {
    b: number
    a: number
    i: number
    is?: readonly number[]
    c?: number
    k?: 's' | 'm'
    p?: string
    fx?: string
    dur?: number
    l?: 'f' | 'm' | 'b'
    pan?: number
}

export interface TTSCompactSpeakerAnalysisSegment {
    b: number
    s: number
    e: number
    i: number
    is?: readonly number[]
    c?: number
    k?: 's' | 'm'
    p?: string
    fx?: string
    dur?: number
    l?: 'f' | 'm' | 'b'
    pan?: number
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

export interface TTSCompactScenePlan {
    scenes: readonly TTSCompactSceneInfo[]
}

export interface TTSCompactSceneInfo {
    i: number
    n: string
    b?: readonly number[]
    loc?: string
    a?: string
    c?: string
    q?: string
    h?: string
    fx?: readonly string[]
}

export interface TTSCompactSpeakerAnalysisBlock {
    b: number
    t: TextBlock['type']
    l: number
    x: string
    s?: number
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
    t?: TTSCompactSpeakerTier
    v?: string
    d?: string
    a?: string
    o?: string
    p?: string
    q?: string
    h?: string
    s?: readonly number[]
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
    knownScenes?: readonly TTSCompactSceneInfo[]
    voiceDesign?: 1
}

export interface TTSCompactSpeakerModelRequest {
    nextSpeakerId?: number
    voices?: readonly TTSCompactVoice[]
    blocks: readonly TTSCompactSpeakerAnalysisBlock[]
    knownSpeakers: readonly TTSCompactKnownSpeaker[]
    knownScenes?: readonly TTSCompactSceneInfo[]
}

export type TTSCompactSpeakerModelRequestKind = 'scene' | 'plan' | 'initial' | 'repair'

export const scenePlanSchema = {
    type: 'object',
    description: '小说 TTS 场景规划；输出 scenes，每个 scene 内用 b 数组列出所属 block id，暂不生成实际音效。',
    properties: {
        scenes: {
            type: 'array',
            description: '稳定场景列表；用于角色规划、说话人归属和声音设计上下文。',
            items: {
                type: 'object',
                properties: {
                    i: { type: 'number', description: 'scene id；从 1 开始递增。' },
                    n: { type: 'string', description: '短场景名，如 高中教室、医院诊室、街道路口。' },
                    b: {
                        type: 'array',
                        description: '属于该场景的 block id 数组；元素来自输入 blocks[].b，只输出能判断场景的 block。',
                        items: { type: 'number' },
                    },
                    loc: { type: 'string', maxLength: 80, description: '地点或空间。' },
                    a: { type: 'string', maxLength: 120, description: '场景氛围，如 嘈杂、安静、紧张。' },
                    c: { type: 'string', maxLength: 160, description: '默认人群画像，如 高中学生、医生和病人、路边小年轻。' },
                    q: { type: 'string', maxLength: 220, description: '场景内默认声音设计约束，特别是匿名/路人角色的年龄、身份、语速和辨识度。' },
                    h: { type: 'string', maxLength: 220, description: '场景识别线索和边界。' },
                    fx: {
                        type: 'array',
                        description: '可选效果音意图，暂不播放，仅为后续预留。',
                        items: { type: 'string', maxLength: 40 },
                    },
                },
                required: ['i', 'n', 'b'],
                additionalProperties: false,
            },
        },
    },
    required: ['scenes'],
    additionalProperties: false,
} as const

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
                    is: {
                        type: 'array',
                        description: 'simultaneous speaker ids；仅多人同时说同一句对白时输出，包含所有共同发声角色 id，也必须包含 i。',
                        items: { type: 'number' },
                    },
                    c: { type: 'number', description: 'confidence；仅当置信度 <= 0.8 或分配不确定时输出。' },
                    k: { type: 'string', enum: ['s', 'm'], description: '可选静音类型：s=拟声词/动物叫声/环境音/效果音；m=只用于表演提示的发言归属短语，不朗读。如果 p 来自该归属原子，必须输出 k=m。' },
                    p: { type: 'string', maxLength: 24, description: '可选短表演标签，如 轻笑、低声、叹气；仅在文本有明确证据时输出。' },
                    fx: { type: 'string', maxLength: 220, description: 'ElevenLabs sound effect prompt；仅 k=s 时输出。用简洁英文描述声音来源、强度、环境和质感，不写对白或旁白。' },
                    dur: { type: 'number', description: 'sound effect duration seconds；仅 k=s 时输出。根据声音持续时间给 0.5-30 秒，拿不准可省略。' },
                    l: { type: 'string', enum: ['f', 'm', 'b'], description: 'sound effect mix layer；仅 k=s 时输出。f=foreground 近处关键音效，m=midground 中景事件音，b=background 远处/环境音。' },
                    pan: { type: 'number', description: 'optional stereo pan；-1=left，0=center，1=right。仅当原文明确声源在左/右/身后偏侧/远处偏侧等方位时输出；不确定则省略，由代码自动分配。' },
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
                    is: {
                        type: 'array',
                        description: 'simultaneous speaker ids；仅多人同时说同一句对白时输出，包含所有共同发声角色 id，也必须包含 i。',
                        items: { type: 'number' },
                    },
                    c: { type: 'number', description: 'confidence；仅当置信度 <= 0.8 或分配不确定时输出。' },
                    k: { type: 'string', enum: ['s', 'm'], description: '可选静音类型：s=拟声词/动物叫声/环境音/效果音；m=只用于表演提示的发言归属短语，不朗读。如果 p 来自该归属原子，必须输出 k=m。' },
                    p: { type: 'string', maxLength: 24, description: '可选短表演标签，如 轻笑、低声、叹气；仅在文本有明确证据时输出。' },
                    fx: { type: 'string', maxLength: 220, description: 'ElevenLabs sound effect prompt；仅 k=s 时输出。用简洁英文描述声音来源、强度、环境和质感，不写对白或旁白。' },
                    dur: { type: 'number', description: 'sound effect duration seconds；仅 k=s 时输出。根据声音持续时间给 0.5-30 秒，拿不准可省略。' },
                    l: { type: 'string', enum: ['f', 'm', 'b'], description: 'sound effect mix layer；仅 k=s 时输出。f=foreground 近处关键音效，m=midground 中景事件音，b=background 远处/环境音。' },
                    pan: { type: 'number', description: 'optional stereo pan；-1=left，0=center，1=right。仅当原文明确声源在左/右/身后偏侧/远处偏侧等方位时输出；不确定则省略，由代码自动分配。' },
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
        t: { type: 'string', enum: ['S', 'A', 'B', 'C'], description: '声音/叙事层级：S=主角/视角人物，A=重要配角，B=临时关键角色，C=路人/短暂角色；当前 TTS 只支持单人音色，最低层级为 C，所有层级仍保留 voice design。' },
        a: { type: 'string', maxLength: 80, description: '年龄或年龄感；可从对白措辞、称呼、价值判断和场景人群画像保守推断。' },
        o: { type: 'string', maxLength: 120, description: '职业、身份或社会角色；匿名/路人也尽量写可复用身份，如 年长路人、围观学生、年轻护士。' },
        p: { type: 'string', maxLength: 160, description: '性格、气质和行为特征；可从对白语气和轮次功能推断。' },
        q: { type: 'string', maxLength: 220, description: '声音设计短语；覆盖音色/质感、语速/节奏、音高/能量、口吻/表演；匿名/路人也要和同场景其他人可听辨地区分。' },
        h: { type: 'string', maxLength: 260, description: '说话人识别线索/上下文，不是声音风格；匿名/路人要写对白线索和轮次线索。' },
        s: {
            type: 'array',
            description: '角色主要出现或用于推断身份的 scene id；来自 knownScenes。',
            items: { type: 'number' },
        },
    },
    required: ['i', 'n', 'r', 'g'],
    additionalProperties: false,
} as const

export function getSpeakerAnalysisSchema(mode: TTSCompactSpeakerAnalysisMode) {
    return mode === 'voiceDesign' ? voiceDesignSpeakerAnalysisSchema : speakerAnalysisSchema
}
