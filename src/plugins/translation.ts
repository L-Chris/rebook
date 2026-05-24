import { generateText, type LanguageModel } from 'ai'
import type { Book, RebookPlugin, TextBlock, TextSegment } from '../core/types'

export interface TranslationOptions {
    /** The language model to use for translation (from @ai-sdk/...) */
    model: LanguageModel
    /** Target language (default: 'zh-CN') */
    targetLanguage?: string
    /** 
     * Display mode:
     * - 'replace': Replace original text with translated text
     * - 'bilingual': Show original text followed by translated text
     * Default: 'bilingual'
     */
    mode?: 'replace' | 'bilingual'
    /** Max concurrency for translation requests (default: 3) */
    concurrency?: number
    /** 
     * Approximate maximum tokens (or characters) per translation batch.
     * The plugin will group as many blocks as possible until this limit is reached.
     * (default: 10000)
     */
    tokensPerBatch?: number
}

/**
 * A plugin that translates the text blocks of a book using Vercel AI SDK.
 */
export function withTranslation(options: TranslationOptions): RebookPlugin {
    const { 
        model, 
        targetLanguage = 'zh-CN', 
        mode = 'bilingual',
        concurrency = 3,
        tokensPerBatch = 10000
    } = options

    return (book: Book): Book => {
        const wrappedSections = book.sections.map(section => {
            const originalGetBlocks = section.getBlocks?.bind(section)

            if (!originalGetBlocks) {
                return section
            }

            return {
                ...section,
                getBlocks: async () => {
                    const blocks = await originalGetBlocks()
                    return translateBlocks(blocks, model, targetLanguage, mode, concurrency, tokensPerBatch)
                }
            }
        })

        return {
            ...book,
            sections: wrappedSections
        }
    }
}

async function translateBlocks(
    blocks: TextBlock[], 
    model: LanguageModel, 
    targetLanguage: string, 
    mode: 'replace' | 'bilingual',
    concurrency: number,
    tokensPerBatch: number
): Promise<TextBlock[]> {
    const result: (TextBlock | TextBlock[])[] = new Array(blocks.length)
    
    // 1. Separate translatable blocks from non-translatable
    const translatableItems: { block: TextBlock, index: number }[] = []

    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i]
        if (['paragraph', 'heading', 'listItem', 'blockquote'].includes(block.type) && block.segments.length > 0) {
            const fullText = block.segments.map(s => s.text).join('')
            if (fullText.trim().length >= 2) {
                translatableItems.push({ block, index: i })
                continue
            }
        }
        // Non-translatable or too short
        result[i] = block
    }

    // 2. Group into batches
    const batches: { block: TextBlock, index: number }[][] = []
    let currentBatch: { block: TextBlock, index: number }[] = []
    let currentBatchTokens = 0

    for (const item of translatableItems) {
        const fullText = item.block.segments.map(s => s.text).join('')
        const estimatedTokens = fullText.length
        
        if (currentBatch.length > 0 && currentBatchTokens + estimatedTokens > tokensPerBatch) {
            batches.push(currentBatch)
            currentBatch = []
            currentBatchTokens = 0
        }
        
        currentBatch.push(item)
        currentBatchTokens += estimatedTokens
    }
    
    if (currentBatch.length > 0) {
        batches.push(currentBatch)
    }

    // 3. Process batches concurrently
    const active = new Set<Promise<void>>()
    let currentBatchIndex = 0

    const processBatch = async (batch: { block: TextBlock, index: number }[]) => {
        const payload = batch.map(b => ({
            id: b.block.id,
            text: b.block.segments.map(s => s.text).join('')
        }))

        try {
            const { text: responseText } = await generateText({
                model,
                system: `You are a professional translator. Translate the given JSON array of texts into ${targetLanguage}. Maintain the original tone and style.
Return ONLY a JSON array with the exact same 'id' fields and the translated 'text' fields. Do not wrap with markdown blocks like \`\`\`json.`,
                prompt: JSON.stringify(payload, null, 2)
            })

            // Attempt to parse JSON
            const jsonStr = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim()
            const translations = JSON.parse(jsonStr) as { id: string, text: string }[]
            const transMap = new Map(translations.map(t => [t.id, t.text]))

            for (const { block, index } of batch) {
                const translatedText = transMap.get(block.id)
                if (translatedText) {
                    const translatedSegments: TextSegment[] = [{ text: translatedText, style: block.segments[0]?.style }]
                    const translatedBlock: TextBlock = {
                        ...block,
                        id: `${block.id}-tr`,
                        segments: translatedSegments
                    }

                    if (mode === 'bilingual') {
                        result[index] = [block, translatedBlock]
                    } else {
                        result[index] = { ...block, segments: translatedSegments }
                    }
                } else {
                    // Missing from translation response, fallback
                    result[index] = block
                }
            }
        } catch (error) {
            console.error(`Batch translation failed:`, error)
            // Fallback to original
            for (const { block, index } of batch) {
                result[index] = block
            }
        }
    }

    while (currentBatchIndex < batches.length) {
        if (active.size >= concurrency) {
            await Promise.race(active)
            continue
        }
        
        const batch = batches[currentBatchIndex++]
        const promise = processBatch(batch).then(() => {
            active.delete(promise)
        })
        active.add(promise)
    }

    await Promise.all(active)

    // Flatten result array
    return result.flat()
}
