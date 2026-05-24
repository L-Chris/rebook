import { generateObject, jsonSchema, type LanguageModel } from 'ai'
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
     * (default: 2000)
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
        tokensPerBatch = 2000
    } = options

    return (book: Book): Book => {
        const fetchers = new Map<number, () => Promise<TextBlock[]>>()

        const wrappedSections = book.sections.map((section, index) => {
            const originalGetBlocks = section.getBlocks?.bind(section)

            if (!originalGetBlocks) {
                return section
            }

            let cachedPromise: Promise<TextBlock[]> | null = null

            const fetchAndTranslate = () => {
                if (!cachedPromise) {
                    cachedPromise = originalGetBlocks().then(blocks => 
                        translateBlocks(blocks, model, targetLanguage, mode, concurrency, tokensPerBatch)
                    ).catch(err => {
                        cachedPromise = null // Reset on error so we can retry
                        throw err
                    })
                }
                return cachedPromise
            }

            fetchers.set(index, fetchAndTranslate)

            return {
                ...section,
                getBlocks: () => {
                    const promise = fetchAndTranslate()

                    // Aggressively prefetch the next section in the background 
                    // after a short delay to allow current layout/render to prioritize
                    setTimeout(() => {
                        const nextFetcher = fetchers.get(index + 1)
                        if (nextFetcher) {
                            // Fire and forget
                            nextFetcher().catch(console.error)
                        }
                    }, 500)

                    return promise
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
        const payload = batch.map(b => b.block.segments.map(s => s.text).join(''))

        try {
            const { object: translations } = await generateObject({
                model,
                system: `You are a professional translator. Translate the given JSON array of strings into ${targetLanguage}. Maintain the original tone and style.
Return ONLY a JSON array of strings, where each string is the translation of the corresponding string in the input array. Maintain the exact same array length and order.`,
                prompt: JSON.stringify(payload, null, 2),
                schema: jsonSchema({
                    type: 'array',
                    items: { type: 'string' }
                })
            })

            for (let i = 0; i < batch.length; i++) {
                const { block, index } = batch[i]
                const translatedText = translations[i]
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
