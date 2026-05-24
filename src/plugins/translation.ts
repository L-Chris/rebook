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
}

/**
 * A plugin that translates the text blocks of a book using Vercel AI SDK.
 */
export function withTranslation(options: TranslationOptions): RebookPlugin {
    const { 
        model, 
        targetLanguage = 'zh-CN', 
        mode = 'bilingual',
        concurrency = 3 
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
                    return translateBlocks(blocks, model, targetLanguage, mode, concurrency)
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
    concurrency: number
): Promise<TextBlock[]> {
    const result: (TextBlock | TextBlock[])[] = new Array(blocks.length)
    
    // Simple concurrency queue
    let currentIndex = 0
    const active = new Set<Promise<void>>()

    const processBlock = async (block: TextBlock, index: number) => {
        // Only translate text-heavy blocks
        if (['paragraph', 'heading', 'listItem', 'blockquote'].includes(block.type) && block.segments.length > 0) {
            // Combine text
            const fullText = block.segments.map(s => s.text).join('')
            
            // Skip short or empty text
            if (fullText.trim().length < 2) {
                result[index] = block
                return
            }

            try {
                const { text: translatedText } = await generateText({
                    model,
                    system: `You are a professional translator. Translate the following text into ${targetLanguage}. Maintain the original tone and style. Return ONLY the translated text without any quotes or explanations.`,
                    prompt: fullText
                })

                const translatedSegments: TextSegment[] = [{ text: translatedText, style: block.segments[0]?.style }]
                const translatedBlock: TextBlock = {
                    ...block,
                    id: `${block.id}-tr`,
                    segments: translatedSegments
                }

                if (mode === 'bilingual') {
                    // Push original then translated
                    result[index] = [block, translatedBlock]
                } else {
                    // Replace original
                    result[index] = {
                        ...block,
                        segments: translatedSegments
                    }
                }
            } catch (error) {
                console.error(`Translation failed for block ${block.id}:`, error)
                // Fallback to original
                result[index] = block
            }
        } else {
            // Unchanged
            result[index] = block
        }
    }

    while (currentIndex < blocks.length) {
        if (active.size >= concurrency) {
            await Promise.race(active)
            continue
        }
        
        const index = currentIndex++
        const block = blocks[index]
        const promise = processBlock(block, index).then(() => {
            active.delete(promise)
        })
        active.add(promise)
    }

    await Promise.all(active)

    // Flatten result array
    return result.flat()
}
