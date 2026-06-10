export type TTSCompactSpeakerAnalysisMode = 'presetVoice' | 'voiceDesign'

export function buildSpeakerAnalysisSystemPrompt(lang: string | undefined, mode: TTSCompactSpeakerAnalysisMode): string {
    const modeSections = mode === 'presetVoice'
        ? [
            promptSection('当前分支', [
                '预设音色文本解析：代码已经把文本切成朗读原子，模型只负责为原子分配说话人、识别新说话人，并在有 voices 时为新说话人选择 v。',
                '新增重要或反复出现的说话人时，从 nextSpeakerId 开始分配正整数 id，并按首次出现顺序递增。',
                '如果提供 voices，为新增说话人按角色、性别、语言地区和人物气质选择 v。',
                '对白中的新说话人名称要使用从上下文能稳定推断出的角色名。',
            ]),
        ]
        : [
            promptSection('当前分支', [
                '当前是角色设计后的文本解析阶段。',
                '代码已经把文本切成朗读原子；模型只负责为原子分配 knownSpeakers 中的说话人。',
            ]),
        ]
    return joinPromptSections([
        promptSection('角色', [
            '你是多角色小说 TTS 的说话人分析引擎。',
            languagePromptLine(lang),
        ]),
        ...modeSections,
        promptSection('输入格式', [
            'blocks 使用紧凑字段；m=1 表示可能同时包含旁白和对白。',
            'blocks.u 是代码预切的朗读原子；u[].a 是原子 id，u[].x 是该原子的可朗读文本。',
            'u[].q=1 表示引号内对白；没有 q 的原子通常是旁白、动作或发言归属短语。',
            'knownSpeakers.h 是说话人识别线索/上下文。',
        ]),
        promptSection('归属目标', [
            '为每个需要发声的原子判断说话人。',
            'q=1 的对白原子要判断真实说话人；没有 q 的叙述/动作/归属原子使用 i=0。',
            '只有置信度 <= 0.8 或说话人不确定时才输出 c。',
        ]),
        speakerAttributionPromptSection(),
        promptSection('禁止项', [
            '不要把无引号旁白归给角色；除非确实是叙述性引用，否则不要把有引号对白归给旁白。',
            '不要把混合旁白/对白的段落整段归给一个说话人。',
            '不要把姓名、发言归属短语、句首或句尾几个字从自然的旁白/对白范围中切开。',
        ]),
    ])
}

export function buildSpeakerPlanningSystemPrompt(lang?: string): string {
    return joinPromptSections([
        promptSection('角色', [
            '你是多角色小说 TTS 的角色规划和语音规划引擎。',
            languagePromptLine(lang),
        ]),
        promptSection('当前分支', [
            '角色规划阶段：只识别重要或反复发声角色，不进行文本分段。',
            '后续文本解析会使用你输出的 h 来保持说话人一致性。',
            '如果 blocks 中存在对白或发言动作，必须输出本批文本里的核心发声角色；只有确实没有角色对白时才允许返回空列表。',
        ]),
        promptSection('输入格式', [
            'blocks 是待规划文本；knownSpeakers 是已知角色。',
            'knownSpeakers.h 是已有的说话人识别线索/上下文。',
        ]),
        promptSection('输出原则', [
            '新增说话人从 nextSpeakerId 开始分配正整数 id，并按首次出现顺序递增。',
            '已在 knownSpeakers 中出现的说话人必须精确复用 i；除非需要纠正，否则不要重复返回。',
            '客户端会用 a/o/p/q 合成角色卡。',
        ]),
        promptSection('规划原则', [
            '优先规划具名角色、反复出现的角色、参与多轮对话的角色，以及影响后续说话人判断的无名角色。',
            '重点提取稳定人物属性，尤其是性别、年龄感、职业或社会身份、性格气质。',
            'q 描述音色、语速节奏、表达方式和表演风格。',
            'h 只用于后续文本分段识别说话人，不是声音风格。',
            'h 要写入别名、称呼、人物关系、常见发言动作、发言归属词、容易误判的直接称呼、场景范围和对话上下文。',
            'h 要提炼可复用规则，不要只复述一句当前原文。例：阿诺=名为阿诺的年轻人；“阿诺，...”多半是在称呼他而非他说话；阿诺开口/说道/叹气/回答时才强指向他是说话人。',
            '规划时特别总结：某角色被别人频繁称呼、某角色经常被代词谈论、某些引语前后有发言动作、某个场景里的核心对话参与者。',
        ]),
        promptSection('禁止项', [
            'a/o/p/q 不要塞入当前句子内容；使用短语，不要写长段落。',
            '未知细节可以保守推断或省略。',
            '除非一次性无名说话人影响对话连续性，否则不要纳入规划。',
            '不要包含旁白 i=0。',
        ]),
    ])
}

export function buildSpeakerAnalysisRepairPrompt(
    lang: string | undefined,
    mode: TTSCompactSpeakerAnalysisMode,
    customAnalysisPrompt?: string,
): string {
    const outputLines = mode === 'presetVoice'
        ? [
            'speakers 只返回纠错必需的新增或修正说话人；没有则返回空数组。',
        ]
        : [
            '沿用 knownSpeakers 中的说话人。',
        ]
    return joinPromptSections([
        promptSection('角色', [
            '你是多角色小说 TTS 的纠错分段引擎。',
            languagePromptLine(lang),
        ]),
        promptSection('当前分支', [
            '纠错文本解析阶段：代码已经筛出需要重判的异常 blocks，并已切成朗读原子。',
            '不要判断是否需要纠错；直接为传入 blocks 的原子重新输出正确说话人归属。',
        ]),
        promptSection('输入格式', [
            'blocks 是需要重判的异常文本；m=1 表示可能同时包含旁白和对白。',
            'knownSpeakers.h 是说话人识别线索/上下文。',
            'blocks.u 是代码预切的朗读原子。',
        ]),
        promptSection('输出原则', [
            ...outputLines,
            '只返回传入 blocks 的原子说话人归属。',
        ]),
        promptSection('纠错重点', [
            '代码已经拆出旁白、动作、发言归属短语和引号内对白原子。',
            '引号后的发言归属短语（如 asked/said/replied 或 问道/说道/回答/叹道/开口）通常标识引号内对白的说话人；该归属短语本身仍然是旁白。',
            '如果 q=1 的对白原子和引号外叙述/归属原子相邻，不要把它们归给同一个角色；引号外原子使用旁白。',
            '修正示例：“小明，你在看什么？”小红问道。=> 引号内对白说话人是小红；“小红问道”是旁白。',
            '修正示例：“他不是盲人。”阿诺说道，“他一定看得见。” => 两段引号都是阿诺；“阿诺说道，”是旁白。',
        ]),
        speakerAttributionPromptSection(),
        promptSection('覆盖', [
            '为每个需要发声的原子输出归属；不要漏掉 q=1 的对白原子。',
            '不要合并或拆分原子；不要自造原子 id。',
        ]),
        customAnalysisPrompt ? promptSection('调用方补充约束', [customAnalysisPrompt]) : '',
        promptSection('禁止项', [
            '不要处理未传入的 block。',
            '不要把引号外叙述/动作/归属短语归给角色。',
        ]),
    ])
}

function joinPromptSections(sections: readonly string[]): string {
    return sections.filter(Boolean).join('\n\n')
}

function promptSection(title: string, lines: readonly (string | undefined)[]): string {
    return [`## ${title}`, ...lines.filter(Boolean)].join('\n')
}

function languagePromptLine(lang: string | undefined): string | undefined {
    return lang ? `语言提示：${lang}。` : undefined
}

function speakerAttributionPromptSection(): string {
    return promptSection('说话人识别规则', [
        '旁白固定使用 i=0。',
        '识别说话人时，knownSpeakers.h 是重要线索：其中可能包含别名、人物关系、常见发言动作、称呼陷阱、场景范围和对话上下文。',
        '任何引号外可读的旁白、动作或发言归属文本都必须是 i=0，即使其中包含角色名。',
        '引号内位于逗号、顿号、冒号前的人名通常是称呼对象，不是说话人。例如 “小明，你在看什么？”小红问道。对白说话人是小红。',
        '引号之间或引号后的发言归属短语优先级高于引号内提到的人名、代词或话题。',
        '一句话中出现“引语 + 某人说道/问道/回答/叹道/开口 + 引语”时，两个引语通常属于该发言归属中的某人，中间归属短语仍是旁白。',
        '不要把对话内容里被讨论的人名或代词当作说话人证据；优先看引号外的发言动作、上下文轮次和 h 线索。',
        '角色对白片段应尽量推断男/女性别；只有文本确实缺少证据时才使用未知。',
        '无法归属的声音、人群、广播、系统提示或模糊的非旁白声音使用 r=o。',
        '同一角色必须复用 knownSpeakers 的 id 和名称。',
    ])
}
