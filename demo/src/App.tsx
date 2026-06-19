import { Fragment, isValidElement, useCallback, useEffect, useMemo, useRef, useState, type AnchorHTMLAttributes, type HTMLAttributes, type ReactElement, type ReactNode } from 'react'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Bug,
  ArrowUp,
  ExternalLink,
  Loader2,
  Maximize2,
  MessageSquareText,
  Minimize2,
  PanelLeft,
  Plus,
  Search,
  Settings,
  Trash2,
  Upload,
  Volume2,
  X,
} from 'lucide-react'
import { createOpenAI } from '@ai-sdk/openai'
import {
  BrowserDOMAdapter,
  BrowserURLFactory,
  EBookError,
  UnsupportedFormatError,
  createReader,
  getReadableContentUnit,
  getReadableContentUnits,
  registerBuiltInParsers,
  registry,
  resolveReadableContentUnitIndex,
  setRebookDebug,
  type BuiltInReaderThemeName,
} from '../../src/index.ts'
import { withTrialLimit } from '../../src/plugins/trial-limit.ts'
import { createBrowserTTSAudioPlayer, withTTS } from '../../src/plugins/tts.ts'
import { withProfessionalTranslation, withTranslation } from '../../src/plugins/translation.ts'
import { withAIChat } from '../../src/plugins/ai-chat.ts'

type Panel = 'search' | 'chat' | 'debug' | null
type SettingsSection = 'reading' | 'translation' | 'tts' | 'chat' | 'trial' | 'debug'

interface DemoConfig {
  layout: 'paginated' | 'scrolled'
  spread: string
  fixedPainter: string
  fontSize: string
  theme: BuiltInReaderThemeName
  hyphenate: boolean
  debug: boolean
  trial: boolean
  trialPages: string
  translate: boolean
  translateTOC: boolean
  professionalTranslation: boolean
  professionalServiceBaseUrl: string
  professionalBookId: string
  baseURL: string
  apiKey: string
  model: string
  translateMode: string
  prefetchPages: string
  tts: boolean
  ttsEndpoint: string
  ttsProvider: string
  ttsSoundEffectProvider: string
  ttsVoice: string
  ttsSegmentChars: string
  ttsSpeed: string
  ttsMultiSpeaker: boolean
  ttsAIBaseURL: string
  ttsAIAPIKey: string
  ttsModel: string
  ttsNarratorVoice: string
  ttsMaleVoices: string
  ttsFemaleVoices: string
  ttsOtherVoice: string
  chat: boolean
  chatBaseURL: string
  chatAPIKey: string
  chatModel: string
  chatMaxContentChars: string
  chatPanelWidth: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  displayContent?: string
  attachments?: ChatAttachment[]
  references?: ChatReference[]
  pending?: boolean
}

interface ChatAttachment {
  id: string
  name: string
  mediaType: string
  data: string
  previewUrl: string
}

interface ChatReference {
  id: string
  kind: 'section' | 'paragraph'
  label: string
  description: string
  href: string
  unitIndex: number
  blockId?: string
  excerpt?: string
}

interface SearchItem {
  unitIndex: number
  unitId: string | number
  unitKind: string
  unitTitle?: string
  sectionIndex?: number
  pageIndex?: number
  excerpt: string
  match: string
}

const CONFIG_KEY = 'rebook-demo-config'
const MAX_DEBUG_ENTRIES = 160
const MAX_SEARCH_RESULTS = 80
const MAX_CHAT_REFERENCE_OPTIONS = 120
const MAX_CHAT_REFERENCE_SUGGESTIONS = 8
const MAX_CHAT_REFERENCE_EXCERPT = 220

interface ChatCommand {
  name: '/summary' | '/search' | '/rewrite' | '/extract'
  description: string
  insertText: string
  requiresArgs?: boolean
  missingArgsMessage?: string
  buildPrompt(args: string): string
}

const CHAT_COMMANDS: ChatCommand[] = [
  {
    name: '/summary',
    description: '总结当前章节内容',
    insertText: '/summary',
    buildPrompt: () => '请总结当前章节内容。要求：用中文回答；先给出一句话概括，再列出关键要点；如果章节中有重要术语，请单独解释。',
  },
  {
    name: '/search',
    description: '搜索书籍内容并整理答案',
    insertText: '/search ',
    requiresArgs: true,
    missingArgsMessage: '请输入搜索关键词，例如 `/search feedback loops`。',
    buildPrompt: args => `请在本书中搜索与“${args}”相关的信息，优先使用搜索工具。请用中文回答，列出最相关的章节或段落，并简要解释上下文。`,
  },
  {
    name: '/rewrite',
    description: '改写当前章节正文',
    insertText: '/rewrite ',
    buildPrompt: args => {
      const extra = args
        ? `\n额外改写要求：${args}`
        : ''
      return `请改写当前章节正文，默认改成更通俗易懂的中文。必须调用 rewriteBlocks 修改实际渲染文本，不要只在回答中贴改写结果。保留原文核心信息、术语和逻辑；不要修改图片或表格；完成后只简要说明已改写完成。${extra}`
    },
  },
  {
    name: '/extract',
    description: '提取当前章节关键概念',
    insertText: '/extract',
    buildPrompt: () => '请提取当前章节的关键概念。要求：用中文回答；先列出概念清单，再分别解释每个概念的含义、它在本章中的作用，以及概念之间的关系；涉及本章具体内容时添加可点击引用。',
  },
]

const defaultConfig: DemoConfig = {
  layout: 'paginated',
  spread: '2',
  fixedPainter: 'canvas',
  fontSize: '16px',
  theme: 'normal',
  hyphenate: true,
  debug: false,
  trial: false,
  trialPages: '20',
  translate: false,
  translateTOC: false,
  professionalTranslation: false,
  professionalServiceBaseUrl: 'http://127.0.0.1:8083',
  professionalBookId: '',
  baseURL: '',
  apiKey: '',
  model: '',
  translateMode: 'bilingual',
  prefetchPages: '2',
  tts: false,
  ttsEndpoint: 'http://127.0.0.1:4177',
  ttsProvider: 'default',
  ttsSoundEffectProvider: 'elevenlabs',
  ttsVoice: 'zh-CN-XiaoyiNeural',
  ttsSegmentChars: '500',
  ttsSpeed: '1',
  ttsMultiSpeaker: false,
  ttsAIBaseURL: '',
  ttsAIAPIKey: '',
  ttsModel: '',
  ttsNarratorVoice: 'zh-CN-YunxiNeural',
  ttsMaleVoices: 'zh-CN-YunjianNeural, zh-CN-YunxiNeural',
  ttsFemaleVoices: 'zh-CN-XiaoyiNeural, zh-CN-XiaoxiaoNeural',
  ttsOtherVoice: 'zh-CN-XiaoxiaoNeural',
  chat: false,
  chatBaseURL: '',
  chatAPIKey: '',
  chatModel: '',
  chatMaxContentChars: '6000',
  chatPanelWidth: '420',
}

const domAdapter = new BrowserDOMAdapter()
const urlFactory = new BrowserURLFactory()
const parserOptions = { domAdapter, urlFactory }

registerBuiltInParsers(registry)

function App() {
  const viewerRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const readerRef = useRef<any>(null)
  const bookRef = useRef<any>(null)
  const currentFileRef = useRef<File | null>(null)
  const ttsAbortRef = useRef<AbortController | null>(null)
  const ttsPlayer = useMemo(() => createBrowserTTSAudioPlayer(), [])

  const [config, setConfig] = useState<DemoConfig>(() => loadConfig())
  const configRef = useRef(config)
  const [draftConfig, setDraftConfig] = useState<DemoConfig>(config)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('reading')
  const [book, setBook] = useState<any>(null)
  const [bookTitle, setBookTitle] = useState('rebook Demo')
  const [tocItems, setTocItems] = useState<any[]>([])
  const [location, setLocation] = useState<any>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activePanel, setActivePanel] = useState<Panel>('chat')
  const [status, setStatus] = useState('Drop an e-book here or open a file.')
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [debugEntries, setDebugEntries] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchScope, setSearchScope] = useState<'unit' | 'book'>('unit')
  const [searchResults, setSearchResults] = useState<SearchItem[]>([])
  const [searchStatus, setSearchStatus] = useState('Open a book to search.')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatAttachments, setChatAttachments] = useState<ChatAttachment[]>([])
  const [chatReferences, setChatReferences] = useState<ChatReference[]>([])
  const [chatReferenceOptions, setChatReferenceOptions] = useState<ChatReference[]>([])
  const [chatBusy, setChatBusy] = useState(false)
  const [chatPanelWidth, setChatPanelWidth] = useState(() => clampPanelWidth(config.chatPanelWidth))
  const [ttsStatus, setTTSStatus] = useState('TTS plugin disabled.')

  configRef.current = config

  const appendDebug = useCallback((label: string, payload: unknown = {}) => {
    if (!configRef.current.debug) return
    const entry = `[${new Date().toLocaleTimeString()}] ${label}\n${safeStringify(payload)}`
    setDebugEntries(items => [entry, ...items].slice(0, MAX_DEBUG_ENTRIES))
    console.log(`[demo] ${label}`, payload)
  }, [])

  const createModel = useCallback((apiKey: string, baseURL: string, model: string) => {
    if (!apiKey.trim()) return null
    const openaiOptions: { apiKey: string; baseURL?: string } = { apiKey: apiKey.trim() }
    if (baseURL.trim()) openaiOptions.baseURL = baseURL.trim()
    return createOpenAI(openaiOptions).chat(model.trim() || 'gpt-4o-mini')
  }, [])

  const buildPlugins = useCallback((cfg: DemoConfig) => {
    const plugins: any[] = []

    if (cfg.trial) {
      plugins.push(withTrialLimit({ maxPages: Number(cfg.trialPages) || 0 }))
    }

    if (cfg.translate) {
      const onUpdate = ({ sectionIndex }: { sectionIndex: number }) => {
        if (readerRef.current?.getLocation?.()?.index === sectionIndex) {
          void readerRef.current?.refresh?.()
        }
      }
      if (cfg.professionalTranslation) {
        if (cfg.professionalServiceBaseUrl.trim() && cfg.professionalBookId.trim()) {
          plugins.push(withProfessionalTranslation({
            serviceBaseUrl: cfg.professionalServiceBaseUrl.trim(),
            bookId: cfg.professionalBookId.trim(),
            targetLanguage: 'zh-CN',
            mode: () => configRef.current.translateMode,
            prefetchPages: () => Number(configRef.current.prefetchPages) || 0,
            onUpdate,
            onStatus: status => appendDebug('translation status', status),
            pipeline: {
              audience: 'general demo readers',
              style: 'Faithful, precise, publication-quality Chinese.',
            },
          }))
        }
      } else if (cfg.apiKey.trim()) {
        const model = createModel(cfg.apiKey, cfg.baseURL, cfg.model)
        if (model) {
          plugins.push(withTranslation({
            model,
            targetLanguage: 'zh-CN',
            mode: () => configRef.current.translateMode,
            translateTOC: () => configRef.current.translateTOC,
            prefetchPages: () => Number(configRef.current.prefetchPages) || 0,
            onTOCUpdate: () => refreshTOC(),
            onUpdate,
          }))
        }
      }
    }

    if (cfg.tts) {
      const ttsOptions: any = {
        endpoint: cfg.ttsEndpoint.trim() || defaultConfig.ttsEndpoint,
        provider: cfg.ttsProvider.trim() || undefined,
        soundEffectProvider: cfg.ttsSoundEffectProvider.trim() || defaultConfig.ttsSoundEffectProvider,
        voice: getTTSVoiceValue(cfg),
        speed: Number(cfg.ttsSpeed) || undefined,
        maxSegmentChars: Number(cfg.ttsSegmentChars) || Number(defaultConfig.ttsSegmentChars),
        player: ttsPlayer,
      }
      if (cfg.ttsMultiSpeaker) {
        const model = createModel(cfg.ttsAIAPIKey, cfg.ttsAIBaseURL, cfg.ttsModel)
        if (model) {
          ttsOptions.model = model
          ttsOptions.multiSpeaker = true
          ttsOptions.speakerAnalysis = {
            onLog: (event: unknown) => appendDebug('tts llm', event),
          }
          ttsOptions.voiceProfile = createTTSVoiceProfile(cfg)
        }
      }
      plugins.push(withTTS(ttsOptions))
    }

    if (cfg.chat) {
      const model = createModel(cfg.chatAPIKey, cfg.chatBaseURL, cfg.chatModel)
      if (model) {
        plugins.push(withAIChat({
          model,
          maxContentChars: () => Number(configRef.current.chatMaxContentChars) || Number(defaultConfig.chatMaxContentChars),
          maxContextChars: () => Math.max(Number(configRef.current.chatMaxContentChars) || Number(defaultConfig.chatMaxContentChars), 20000),
          onDocumentEdit: event => {
            appendDebug('ai chat document edit', {
              type: event.type,
              unitIndexes: event.unitIndexes,
              edits: event.edits.length,
              version: event.version,
            })
            const reader = readerRef.current
            const currentIndex = reader?.getLocation?.()?.index
            if (reader && typeof currentIndex === 'number' && event.unitIndexes.includes(currentIndex)) {
              void reader.refresh?.().catch((error: unknown) => appendDebug('ai chat document edit refresh failed', formatError(error)))
            }
          },
        }))
      }
    }

    return plugins
  }, [appendDebug, createModel, ttsPlayer])

  const createDemoReader = useCallback((cfg: DemoConfig) => {
    if (!viewerRef.current) return null
    return createReader({
      container: viewerRef.current,
      layout: cfg.layout,
      maxColumnCount: Number(cfg.spread),
      parserOptions,
      plugins: buildPlugins(cfg),
      fixedPainter: cfg.fixedPainter,
      beforeNavigate: direction => {
        if (direction === 'next' && cfg.trial && readerRef.current && !readerRef.current.canGoNext()) {
          setStatus('Trial limit reached.')
          return false
        }
        return true
      },
      styles: getReaderStyles(cfg),
    })
  }, [buildPlugins])

  const wireReaderEvents = useCallback((reader: any) => {
    reader.on('relocate', (event: any) => {
      setLocation(event)
      refreshTOC(reader, event)
      appendDebug('relocate', summarizeLocation(event))
    })
    reader.on('link', (event: any) => {
      if (event.external) window.open(event.href, '_blank', 'noopener,noreferrer')
      else void reader.goTo(event.href).catch((error: unknown) => appendDebug('link navigation failed', formatError(error)))
    })
    reader.on('block-window', (event: any) => appendDebug('block window', event))
  }, [appendDebug])

  const resetReader = useCallback(async (nextConfig: DemoConfig, reopen = currentFileRef.current) => {
    const previous = readerRef.current
    if (previous) previous.destroy()
    if (viewerRef.current) viewerRef.current.textContent = ''

    setRebookDebug(nextConfig.debug)
    const nextReader = createDemoReader(nextConfig)
    if (!nextReader) return
    readerRef.current = nextReader
    wireReaderEvents(nextReader)

    if (reopen) await openFileWithReader(reopen, nextReader, { preserveFile: true })
  }, [createDemoReader, wireReaderEvents])

  useEffect(() => {
    void resetReader(config, null)
    return () => {
      readerRef.current?.destroy?.()
      ttsPlayer.destroy?.()
    }
  }, [])

  useEffect(() => {
    document.title = `${bookTitle} - rebook`
  }, [bookTitle])

  useEffect(() => {
    const reader = readerRef.current
    const currentBook = bookRef.current
    if (!reader || !currentBook) {
      setChatReferenceOptions([])
      return
    }

    let cancelled = false
    void buildChatReferenceOptions(reader, currentBook)
      .then(options => {
        if (!cancelled) setChatReferenceOptions(options)
      })
      .catch(error => {
        appendDebug('chat reference options failed', formatError(error))
        if (!cancelled) setChatReferenceOptions([])
      })

    return () => {
      cancelled = true
    }
  }, [appendDebug, book, location])

  const openFileWithReader = async (file: File, targetReader = readerRef.current, options: { preserveFile?: boolean } = {}) => {
    if (!targetReader) return
    setBusy(true)
    setStatus(`Opening ${file.name}...`)
    try {
      if (!options.preserveFile) currentFileRef.current = file
      const started = performance.now()
      const openedBook = await targetReader.open(file)
      bookRef.current = openedBook
      setBook(openedBook)
      setBookTitle(formatLanguageMap(openedBook.metadata?.title) || file.name || 'Untitled')
      setChatMessages([])
      setSearchResults([])
      setSearchStatus('Enter a search term.')
      refreshTOC(targetReader)
      await targetReader.goTo(0)
      setStatus(`Opened ${file.name} in ${formatMs(performance.now() - started)}.`)
      setTTSStatus(openedBook.tts ? 'TTS ready.' : 'TTS plugin disabled.')
      appendDebug('book opened', {
        name: file.name,
        sections: openedBook.sections.length,
        title: formatLanguageMap(openedBook.metadata?.title),
        toc: flattenTOCItems(openedBook.toc ?? []).length,
      })
    } catch (error) {
      const detail = error instanceof UnsupportedFormatError
        ? 'Unsupported file format. Please open an EPUB, MOBI, FB2, CBZ, or PDF file.'
        : error instanceof EBookError
          ? `Error (${error.code}): ${error.message}`
          : formatError(error)
      setStatus(`Failed to open file: ${detail}`)
      setBook(null)
      bookRef.current = null
      appendDebug('open failed', detail)
    } finally {
      setBusy(false)
    }
  }

  const openPickedFiles = (files: FileList | File[]) => {
    const file = Array.from(files).find(Boolean)
    if (file) void openFileWithReader(file)
  }

  const refreshTOC = (reader = readerRef.current, currentLocation = reader?.getLocation?.()) => {
    if (!reader) return
    setTocItems(reader.getTOCViewItems({ location: currentLocation }))
  }

  const applyConfig = async () => {
    const next = { ...draftConfig, chatPanelWidth: String(chatPanelWidth) }
    setConfig(next)
    configRef.current = next
    saveConfig(next)
    setSettingsOpen(false)
    await resetReader(next)
  }

  const runSearch = async () => {
    const reader = readerRef.current
    if (!reader || !bookRef.current) {
      setSearchStatus('Open a book to search.')
      return
    }
    const query = searchQuery.trim()
    if (!query) {
      setSearchStatus('Enter a search term.')
      return
    }
    setSearchStatus('Searching...')
    const results = await reader.search(query, {
      scope: searchScope === 'unit' ? 'unit' : 'book',
      unitIndex: location?.index ?? 0,
      maxResults: MAX_SEARCH_RESULTS,
      contextChars: 96,
    })
    setSearchResults(results)
    setSearchStatus(results.length ? `${results.length} result${results.length === 1 ? '' : 's'}.` : 'No results.')
  }

  const goToSearchResult = async (item: SearchItem) => {
    if (!readerRef.current?.canGoTo?.(item.unitIndex)) {
      setStatus('Trial limit reached.')
      return
    }
    await readerRef.current.goTo(item.unitIndex)
  }

  const sendChatMessage = async () => {
    const rawContent = chatInput.trim()
    const commandResult = resolveChatCommand(rawContent)
    const content = buildChatMessageContentWithReferences(commandResult?.prompt ?? rawContent, chatReferences)
    const attachments = chatAttachments
    const references = chatReferences
    const aiChat = bookRef.current?.aiChat
    if ((!rawContent && !attachments.length && !references.length) || chatBusy) return
    if (commandResult?.error && !attachments.length) {
      const nextMessages: ChatMessage[] = [
        ...chatMessages.filter(message => !message.pending),
        { role: 'user', content: rawContent, displayContent: rawContent, references },
        { role: 'assistant', content: commandResult.error },
      ]
      setChatMessages(nextMessages)
      setChatInput(commandResult.insertText ?? rawContent)
      return
    }
    if (!aiChat) {
      setChatMessages(messages => [...messages, {
        role: 'assistant',
        content: config.chat ? '请先在设置中填写 AI Chat API Key 并重新应用配置。' : '请先在设置中启用 AI Chat。',
      }])
      return
    }

    const nextMessages: ChatMessage[] = [
      ...chatMessages.filter(message => !message.pending),
      {
        role: 'user',
        content: content || '请分析这些图片。',
        displayContent: commandResult || references.length ? rawContent : undefined,
        attachments,
        references,
      },
    ]
    setChatMessages([...nextMessages, { role: 'assistant', content: '', pending: true }])
    setChatInput('')
    setChatAttachments([])
    setChatReferences([])
    setChatBusy(true)
    try {
      const current = getCurrentChatContext(readerRef.current, bookRef.current)
      const askOptions = {
        messages: nextMessages.map(toAIChatMessage),
        currentUnitIndex: current.unitIndex,
        current,
      }
      if (typeof aiChat.stream === 'function') {
        const stream = aiChat.stream(askOptions)
        let streamedText = ''
        for await (const chunk of stream.textStream) {
          streamedText += chunk
          setChatMessages([...nextMessages, { role: 'assistant', content: streamedText, pending: true }])
        }
        const response = await stream.response
        setChatMessages([...nextMessages, { role: 'assistant', content: response.text || streamedText || '(empty response)' }])
        appendDebug('ai chat response', {
          streamed: true,
          toolCalls: response.toolCalls?.length ?? 0,
          toolResults: response.toolResults?.length ?? 0,
          finishReason: response.finishReason,
          usage: response.usage,
        })
        return
      }
      const response = await aiChat.ask(askOptions)
      setChatMessages([...nextMessages, { role: 'assistant', content: response.text || '(empty response)' }])
      appendDebug('ai chat response', {
        streamed: false,
        toolCalls: response.toolCalls?.length ?? 0,
        toolResults: response.toolResults?.length ?? 0,
        finishReason: response.finishReason,
        usage: response.usage,
      })
    } catch (error) {
      setChatMessages([...nextMessages, { role: 'assistant', content: `Chat failed: ${formatError(error)}` }])
      appendDebug('ai chat failed', formatError(error))
    } finally {
      setChatBusy(false)
    }
  }

  const addChatImages = async (files: FileList | File[]) => {
    const images = Array.from(files).filter(file => file.type.startsWith('image/'))
    if (!images.length) return
    const attachments = await Promise.all(images.slice(0, 6).map(readChatImageAttachment))
    setChatAttachments(items => [...items, ...attachments].slice(0, 6))
  }

  const removeChatAttachment = (id: string) => {
    setChatAttachments(items => {
      const attachment = items.find(item => item.id === id)
      if (attachment) URL.revokeObjectURL(attachment.previewUrl)
      return items.filter(item => item.id !== id)
    })
  }

  const addChatReference = (reference: ChatReference) => {
    setChatReferences(items => items.some(item => item.id === reference.id) ? items : [...items, reference].slice(0, 8))
  }

  const removeChatReference = (id: string) => {
    setChatReferences(items => items.filter(item => item.id !== id))
  }

  const openChatCitation = async (href: string) => {
    const citation = parseRebookJumpHref(href)
    if (!citation || !readerRef.current) return
    if (!readerRef.current.canGoTo?.(citation.unitIndex)) {
      setStatus('Trial limit reached.')
      return
    }
    const section = bookRef.current?.sections[citation.unitIndex]
    await readerRef.current.goTo(citation.blockId && section ? `${citation.unitIndex}#${citation.blockId}` : citation.unitIndex)
    readerRef.current.clearMarks?.('citation')
    if (citation.blockId && section) {
      readerRef.current.setMark?.({
        id: 'ai-chat-citation',
        kind: 'citation',
        location: {
          type: 'reflowable',
          sectionIndex: citation.unitIndex,
          blockId: citation.blockId,
        },
      })
    }
  }

  const playTTS = async () => {
    const currentBook = bookRef.current
    if (!currentBook?.tts || !readerRef.current) {
      setTTSStatus('Enable TTS and apply settings first.')
      return
    }
    stopTTS()
    const abortController = new AbortController()
    ttsAbortRef.current = abortController
    const cfg = configRef.current
    const sectionIndex = readerRef.current.getLocation?.()?.index ?? 0
    try {
      setTTSStatus(`Preparing section ${sectionIndex + 1} audio...`)
      const prefetchOptions: any = {
        voice: getTTSVoiceValue(cfg),
        maxSegmentChars: Number(cfg.ttsSegmentChars) || Number(defaultConfig.ttsSegmentChars),
        provider: cfg.ttsProvider.trim() || undefined,
        soundEffectProvider: cfg.ttsSoundEffectProvider.trim() || defaultConfig.ttsSoundEffectProvider,
        speed: Number(cfg.ttsSpeed) || undefined,
        concurrency: isMimoTTSProvider(cfg) ? 1 : 2,
      }
      if (cfg.ttsMultiSpeaker) {
        const model = createModel(cfg.ttsAIAPIKey, cfg.ttsAIBaseURL, cfg.ttsModel)
        if (!model) throw new Error('Multi voice TTS needs TTS AI API key.')
        prefetchOptions.model = model
        prefetchOptions.multiSpeaker = true
        prefetchOptions.speakerAnalysis = { onLog: (event: unknown) => appendDebug('tts llm', event) }
        prefetchOptions.voiceProfile = createTTSVoiceProfile(cfg)
      }
      const prefetch = await currentBook.tts.prefetchSection(sectionIndex, prefetchOptions)
      await currentBook.tts.playPrefetchedSection(prefetch, {
        signal: abortController.signal,
        preloadAhead: 3,
        onSegmentQueued: ({ index, total }: any) => setTTSStatus(`Queued ${index + 1}/${total}`),
        onSegmentStart: ({ index, total, segment }: any) => {
          setTTSStatus(`Playing ${index + 1}/${total}`)
          markTTSSegment(sectionIndex, segment)
        },
        onSegmentEnd: () => readerRef.current?.clearMarks?.('tts'),
        onSegmentError: ({ error }: any) => appendDebug('tts segment skipped', formatError(error)),
      })
      setTTSStatus('TTS finished.')
    } catch (error) {
      if (!abortController.signal.aborted) setTTSStatus(`TTS failed: ${formatError(error)}`)
    } finally {
      if (ttsAbortRef.current === abortController) ttsAbortRef.current = null
      readerRef.current?.clearMarks?.('tts')
    }
  }

  const stopTTS = () => {
    ttsAbortRef.current?.abort()
    ttsAbortRef.current = null
    bookRef.current?.tts?.stopPlayback?.()
    ttsPlayer.stop()
    readerRef.current?.clearMarks?.('tts')
    setTTSStatus(bookRef.current?.tts ? 'TTS stopped.' : 'TTS plugin disabled.')
  }

  const markTTSSegment = (sectionIndex: number, segment: any) => {
    if (!segment?.blockId) return
    readerRef.current?.setMark?.({
      id: 'tts-current',
      kind: 'tts',
      location: {
        start: { type: 'reflowable', sectionIndex, blockId: segment.blockId, offset: segment.startOffset ?? 0 },
        end: { type: 'reflowable', sectionIndex, blockId: segment.blockId, offset: segment.endOffset ?? Math.max(1, segment.text?.length ?? 1) },
      },
      className: 'rebook-tts-current',
    })
  }

  return (
    <div
      className="reader-shell flex h-full min-h-0 flex-col"
      data-reader-theme={config.theme}
      onDragOver={event => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={event => {
        event.preventDefault()
        setDragging(false)
        openPickedFiles(event.dataTransfer.files)
      }}
    >
      <Header
        busy={busy}
        sidebarOpen={sidebarOpen}
        activePanel={activePanel}
        debugEnabled={config.debug}
        onToggleSidebar={() => setSidebarOpen(open => !open)}
        onOpenFile={() => fileInputRef.current?.click()}
        onOpenSettings={() => {
          setDraftConfig(config)
          setSettingsOpen(true)
        }}
        onTogglePanel={panel => setActivePanel(activePanel === panel ? null : panel)}
      />

      <input
        ref={fileInputRef}
        hidden
        type="file"
        accept=".epub,.mobi,.azw,.azw3,.fb2,.cbz,.pdf"
        onChange={event => {
          if (event.target.files) openPickedFiles(event.target.files)
          event.currentTarget.value = ''
        }}
      />

      <main className="flex min-h-0 flex-1">
        {sidebarOpen && (
          <TOCSidebar
            items={tocItems}
            onNavigate={target => void readerRef.current?.goTo?.(target)}
          />
        )}

        <section className="relative flex min-w-0 flex-1 flex-col px-4 pb-4 pt-3">
          <div className="reader-canvas relative min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div ref={viewerRef} id="viewer" />
            {!book && (
              <div className={`absolute inset-0 grid place-items-center p-8 transition ${dragging ? 'bg-blue-50' : 'bg-white/92'}`}>
                <div className="max-w-md rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
                  <Upload className="mx-auto mb-4 h-10 w-10 text-blue-500" />
                  <h2 className="text-lg font-semibold text-slate-900">Open an e-book</h2>
                  <p className="mt-2 text-sm text-slate-500">Drop a file here or use Open File. EPUB, MOBI, AZW3, FB2, CBZ and PDF are supported.</p>
                  <button
                    type="button"
                    className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Open File
                  </button>
                </div>
              </div>
            )}
          </div>
          <ProgressBar value={location?.totalFraction ?? 0} />
        </section>

        {activePanel && (
          <RightPanel
            panel={activePanel}
            width={activePanel === 'chat' ? chatPanelWidth : 420}
            onClearChat={activePanel === 'chat' ? () => {
              setChatMessages(messages => {
                revokeChatAttachmentURLs(messages.flatMap(message => message.attachments ?? []))
                return []
              })
              setChatReferences([])
              setChatAttachments(items => {
                revokeChatAttachmentURLs(items)
                return []
              })
            } : undefined}
            setWidth={value => {
              const width = clampPanelWidth(value)
              setChatPanelWidth(width)
              const next = { ...configRef.current, chatPanelWidth: String(width) }
              configRef.current = next
              setConfig(next)
              saveConfig(next)
            }}
            onClose={() => setActivePanel(null)}
          >
            {activePanel === 'search' && (
              <SearchPanel
                query={searchQuery}
                setQuery={setSearchQuery}
                scope={searchScope}
                setScope={setSearchScope}
                status={searchStatus}
                results={searchResults}
                onRun={() => void runSearch()}
                onClear={() => {
                  setSearchQuery('')
                  setSearchResults([])
                  setSearchStatus(bookRef.current ? 'Enter a search term.' : 'Open a book to search.')
                }}
                onNavigate={goToSearchResult}
              />
            )}
            {activePanel === 'chat' && (
              <ChatPanel
                messages={chatMessages}
                input={chatInput}
                attachments={chatAttachments}
                references={chatReferences}
                referenceOptions={chatReferenceOptions}
                busy={chatBusy}
                setInput={setChatInput}
                onAddImages={files => void addChatImages(files)}
                onRemoveAttachment={removeChatAttachment}
                onAddReference={addChatReference}
                onRemoveReference={removeChatReference}
                onSend={() => void sendChatMessage()}
                onCitation={href => void openChatCitation(href)}
              />
            )}
            {activePanel === 'debug' && (
              <DebugPanel
                entries={debugEntries}
                onClear={() => setDebugEntries([])}
                onCopy={() => void navigator.clipboard?.writeText(debugEntries.join('\n\n'))}
              />
            )}
          </RightPanel>
        )}
      </main>

      <Footer
        ttsEnabled={config.tts}
        ttsStatus={ttsStatus}
        onPlayTTS={() => void playTTS()}
        onStopTTS={stopTTS}
      />

      {settingsOpen && (
        <SettingsDialog
          section={settingsSection}
          setSection={setSettingsSection}
          config={draftConfig}
          setConfig={setDraftConfig}
          onClose={() => setSettingsOpen(false)}
          onApply={() => void applyConfig()}
        />
      )}
    </div>
  )
}

function Header(props: {
  busy: boolean
  sidebarOpen: boolean
  activePanel: Panel
  debugEnabled: boolean
  onToggleSidebar(): void
  onOpenFile(): void
  onOpenSettings(): void
  onTogglePanel(panel: Panel): void
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white/92 px-3 backdrop-blur">
      <button className="icon-button" type="button" onClick={props.onToggleSidebar} title="Toggle sidebar">
        <PanelLeft className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1" />
      <button className="toolbar-button" type="button" onClick={props.onOpenFile}>
        {props.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        Open
      </button>
      <button className={panelButtonClass(props.activePanel === 'search')} type="button" onClick={() => props.onTogglePanel('search')}>
        <Search className="h-4 w-4" />
        Search
      </button>
      <button className={panelButtonClass(props.activePanel === 'chat')} type="button" onClick={() => props.onTogglePanel('chat')}>
        <MessageSquareText className="h-4 w-4" />
        Chat
      </button>
      {props.debugEnabled ? (
        <button className={panelButtonClass(props.activePanel === 'debug')} type="button" onClick={() => props.onTogglePanel('debug')}>
          <Bug className="h-4 w-4" />
          Debug
        </button>
      ) : null}
      <button className="icon-button" type="button" onClick={props.onOpenSettings} title="Settings">
        <Settings className="h-4 w-4" />
      </button>
    </header>
  )
}

function TOCSidebar({ items, onNavigate }: { items: any[]; onNavigate(target: string): void }) {
  return (
    <aside className="w-72 shrink-0 overflow-hidden border-r border-slate-200 bg-white/84">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Table of Contents</div>
      </div>
      <div className="h-full overflow-auto pb-16">
        {items.length ? (
          <TOCTree items={items} onNavigate={onNavigate} depth={0} />
        ) : (
          <p className="px-4 py-5 text-sm text-slate-500">Open a book to show its contents.</p>
        )}
      </div>
    </aside>
  )
}

function TOCTree({ items, onNavigate, depth }: { items: any[]; onNavigate(target: string): void; depth: number }) {
  return (
    <ul>
      {items.map(item => (
        <li key={item.id || item.target}>
          <button
            type="button"
            disabled={item.disabled}
            onClick={() => onNavigate(item.target)}
            className={[
              'block w-full truncate px-3 py-1.5 text-left text-sm transition',
              item.active ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-100',
              item.disabled ? 'cursor-not-allowed opacity-40' : '',
            ].join(' ')}
            style={{ paddingLeft: 12 + depth * 16 }}
            title={item.label}
          >
            {item.label}
          </button>
          {item.children?.length ? <TOCTree items={item.children} onNavigate={onNavigate} depth={depth + 1} /> : null}
        </li>
      ))}
    </ul>
  )
}

function RightPanel(props: {
  panel: Panel
  width: number
  setWidth(value: number): void
  onClose(): void
  onClearChat?: () => void
  children: React.ReactNode
}) {
  const dragRef = useRef<{ right: number } | null>(null)
  return (
    <aside className="relative shrink-0 border-l border-slate-200 bg-white" style={{ width: props.width }}>
      {props.panel === 'chat' && (
        <div
          className="absolute inset-y-0 left-0 z-10 w-2 cursor-col-resize hover:bg-blue-200/50"
          onPointerDown={event => {
            dragRef.current = { right: event.currentTarget.parentElement!.getBoundingClientRect().right }
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={event => {
            if (!dragRef.current) return
            props.setWidth(dragRef.current.right - event.clientX)
          }}
          onPointerUp={() => {
            dragRef.current = null
          }}
        />
      )}
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-200 px-3">
          <span className="text-sm font-semibold capitalize text-slate-900">{props.panel}</span>
          <div className="flex items-center gap-1">
            {props.panel === 'chat' && props.onClearChat ? (
              <button className="icon-button" type="button" onClick={props.onClearChat} title="Clear chat">
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
            <button className="icon-button" type="button" onClick={props.onClose} title="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">{props.children}</div>
      </div>
    </aside>
  )
}

function SearchPanel(props: {
  query: string
  setQuery(value: string): void
  scope: 'unit' | 'book'
  setScope(value: 'unit' | 'book'): void
  status: string
  results: SearchItem[]
  onRun(): void
  onClear(): void
  onNavigate(item: SearchItem): void
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b border-slate-200 p-3">
        <div className="flex gap-2">
          <input
            className="input flex-1"
            value={props.query}
            placeholder="Search text"
            onChange={event => props.setQuery(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') props.onRun()
            }}
          />
          <button className="toolbar-button" type="button" onClick={props.onRun}>Run</button>
        </div>
        <div className="flex items-center gap-2">
          <select className="input flex-1" value={props.scope} onChange={event => props.setScope(event.target.value as any)}>
            <option value="unit">Current unit</option>
            <option value="book">Whole book</option>
          </select>
          <button className="toolbar-button" type="button" onClick={props.onClear}>Clear</button>
        </div>
        <p className="text-xs text-slate-500">{props.status}</p>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
        {props.results.map((item, index) => (
          <button
            key={`${item.unitIndex}-${item.match}-${index}`}
            type="button"
            className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left text-sm hover:border-blue-300 hover:bg-blue-50"
            onClick={() => props.onNavigate(item)}
          >
            <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
              <span>#{index + 1}</span>
              <span className="truncate">{item.unitTitle || `${item.unitKind} ${item.unitIndex + 1}`}</span>
            </div>
            <p className="line-clamp-4 text-slate-700">{item.excerpt}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

function ChatPanel(props: {
  messages: ChatMessage[]
  input: string
  attachments: ChatAttachment[]
  references: ChatReference[]
  referenceOptions: ChatReference[]
  busy: boolean
  setInput(value: string): void
  onAddImages(files: FileList | File[]): void
  onRemoveAttachment(id: string): void
  onAddReference(reference: ChatReference): void
  onRemoveReference(id: string): void
  onSend(): void
  onCitation(href: string): void
}) {
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const [cursorIndex, setCursorIndex] = useState(props.input.length)
  const referenceToken = useMemo(
    () => getChatReferenceToken(props.input, cursorIndex, props.references),
    [cursorIndex, props.input, props.references],
  )
  const referenceSuggestions = useMemo(
    () => referenceToken ? getChatReferenceSuggestions(props.referenceOptions, props.references, referenceToken.query) : [],
    [props.referenceOptions, props.references, referenceToken],
  )
  const commandSuggestions = useMemo(
    () => referenceToken ? [] : getChatCommandSuggestions(props.input),
    [props.input, referenceToken],
  )
  const activeSuggestionCount = referenceSuggestions.length || commandSuggestions.length
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0)
  const applyCommand = (command: ChatCommand) => {
    props.setInput(command.insertText)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      const position = command.insertText.length
      inputRef.current?.setSelectionRange(position, position)
      setCursorIndex(position)
    })
  }
  const applyReference = (reference: ChatReference) => {
    props.onAddReference(reference)
    const token = getChatReferenceToken(props.input, inputRef.current?.selectionStart ?? cursorIndex)
    if (!token) {
      requestAnimationFrame(() => inputRef.current?.focus())
      return
    }
    const insertText = `@${reference.label} `
    const nextInput = `${props.input.slice(0, token.start)}${insertText}${props.input.slice(token.end)}`
    const nextCursor = token.start + insertText.length
    props.setInput(nextInput)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(nextCursor, nextCursor)
      setCursorIndex(nextCursor)
    })
  }

  useEffect(() => {
    if (selectedCommandIndex >= activeSuggestionCount) {
      setSelectedCommandIndex(0)
    }
  }, [activeSuggestionCount, selectedCommandIndex])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
        {props.messages.length ? props.messages.map((message, index) => (
          <div
            key={index}
            className={[
              'rounded-xl border p-3 text-sm',
              message.role === 'user' ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white',
              message.pending ? 'text-slate-500' : '',
            ].join(' ')}
          >
            {message.attachments?.length ? (
              <div className="mb-2 flex flex-wrap gap-2">
                {message.attachments.map(attachment => (
                  <img
                    key={attachment.id}
                    src={attachment.previewUrl}
                    alt={attachment.name}
                    className="h-20 w-20 rounded-lg border border-slate-200 object-cover"
                  />
                ))}
              </div>
            ) : null}
            {message.role === 'assistant' && message.content ? (
              <ChatMarkdownContent
                content={message.content}
                streaming={message.pending === true}
                onCitation={props.onCitation}
              />
            ) : (
              <p className="whitespace-pre-wrap">
                {message.role === 'assistant' && message.pending && !message.content
                  ? 'Thinking...'
                  : message.displayContent ?? message.content}
              </p>
            )}
            {message.references?.length ? (
              <ChatReferenceChips references={message.references} />
            ) : null}
          </div>
        )) : (
          <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
            Ask for a chapter summary, explain a passage, or search for a concept.
          </div>
        )}
      </div>
      <div className="border-t border-slate-200 p-3">
        <input
          ref={imageInputRef}
          hidden
          type="file"
          accept="image/*"
          multiple
          onChange={event => {
            if (event.currentTarget.files) props.onAddImages(event.currentTarget.files)
            event.currentTarget.value = ''
          }}
        />
        <div className="chat-composer">
          {referenceSuggestions.length ? (
            <div className="chat-command-menu">
              {referenceSuggestions.map((reference, index) => (
                <button
                  key={reference.id}
                  type="button"
                  className={`chat-command-option ${index === selectedCommandIndex ? 'is-active' : ''}`}
                  onMouseDown={event => {
                    event.preventDefault()
                    applyReference(reference)
                  }}
                >
                  <span className="chat-reference-kind">{reference.kind === 'section' ? '章节' : '段落'}</span>
                  <span className="chat-command-name">{reference.label}</span>
                  <span className="chat-command-description">{reference.description}</span>
                </button>
              ))}
            </div>
          ) : commandSuggestions.length ? (
            <div className="chat-command-menu">
              {commandSuggestions.map((command, index) => (
                <button
                  key={command.name}
                  type="button"
                  className={`chat-command-option ${index === selectedCommandIndex ? 'is-active' : ''}`}
                  onMouseDown={event => {
                    event.preventDefault()
                    applyCommand(command)
                  }}
                >
                  <span className="chat-command-name">{command.name}</span>
                  <span className="chat-command-description">{command.description}</span>
                </button>
              ))}
            </div>
          ) : null}
          {props.references.length ? (
            <ChatReferenceChips references={props.references} onRemove={props.onRemoveReference} />
          ) : null}
          {props.attachments.length ? (
            <div className="chat-composer-attachments">
              {props.attachments.map(attachment => (
                <div key={attachment.id} className="chat-composer-attachment">
                  <img src={attachment.previewUrl} alt={attachment.name} />
                  <button type="button" onClick={() => props.onRemoveAttachment(attachment.id)} title="Remove image">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <div className="chat-composer-row">
            <button
              className="chat-composer-icon"
              type="button"
              onClick={() => imageInputRef.current?.click()}
              title="Attach image"
            >
              <Plus className="h-5 w-5" />
            </button>
            <textarea
              ref={inputRef}
              className="chat-composer-input"
              value={props.input}
              rows={1}
              placeholder="Ask about this book"
              onChange={event => {
                props.setInput(event.target.value)
                setCursorIndex(event.currentTarget.selectionStart ?? event.currentTarget.value.length)
              }}
              onClick={event => setCursorIndex(event.currentTarget.selectionStart ?? props.input.length)}
              onKeyUp={event => setCursorIndex(event.currentTarget.selectionStart ?? props.input.length)}
              onKeyDown={event => {
                if (referenceSuggestions.length || commandSuggestions.length) {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    setSelectedCommandIndex(index => (index + 1) % activeSuggestionCount)
                    return
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    setSelectedCommandIndex(index => (index - 1 + activeSuggestionCount) % activeSuggestionCount)
                    return
                  }
                  if (event.key === 'Tab') {
                    event.preventDefault()
                    const selectedReference = referenceSuggestions[Math.min(selectedCommandIndex, referenceSuggestions.length - 1)]
                    const selectedCommand = commandSuggestions[Math.min(selectedCommandIndex, commandSuggestions.length - 1)]
                    if (selectedReference) applyReference(selectedReference)
                    else if (selectedCommand) applyCommand(selectedCommand)
                    return
                  }
                  if (event.key === 'Enter' && !event.shiftKey) {
                    if (referenceSuggestions.length) {
                      event.preventDefault()
                      const selectedReference = referenceSuggestions[Math.min(selectedCommandIndex, referenceSuggestions.length - 1)]
                      if (selectedReference) applyReference(selectedReference)
                      return
                    }
                    const selected = commandSuggestions[Math.min(selectedCommandIndex, commandSuggestions.length - 1)]
                    const token = getChatCommandToken(props.input)
                    if (selected && (selected.name !== token || selected.requiresArgs)) {
                      event.preventDefault()
                      applyCommand(selected)
                      return
                    }
                  }
                }
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  props.onSend()
                }
              }}
            />
            <button
              className="chat-composer-send"
              type="button"
              disabled={props.busy || (!props.input.trim() && !props.attachments.length && !props.references.length)}
              onClick={props.onSend}
              title="Send"
            >
              {props.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChatReferenceChips({ references, onRemove }: { references: ChatReference[]; onRemove?(id: string): void }) {
  return (
    <div className="chat-reference-chips">
      {references.map(reference => (
        <span key={reference.id} className="chat-reference-chip" title={reference.excerpt || reference.description}>
          <span className="chat-reference-chip-kind">{reference.kind === 'section' ? '章节' : '段落'}</span>
          <span className="chat-reference-chip-label">{reference.label}</span>
          {onRemove ? (
            <button type="button" onClick={() => onRemove(reference.id)} title="Remove reference">
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </span>
      ))}
    </div>
  )
}

function DebugPanel({ entries, onClear, onCopy }: { entries: string[]; onClear(): void; onCopy(): void }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex gap-2 border-b border-slate-200 p-3">
        <button className="toolbar-button" type="button" onClick={onCopy}>Copy</button>
        <button className="toolbar-button" type="button" onClick={onClear}>Clear</button>
      </div>
      <pre className="debug-log min-h-0 flex-1 overflow-auto whitespace-pre-wrap p-3 text-xs text-slate-700">
        {entries.join('\n\n') || 'Debug disabled or no entries yet.'}
      </pre>
    </div>
  )
}

function ChatMarkdownLink({
  href,
  children,
  onCitation,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { onCitation(href: string): void }) {
  if (href && isRebookJumpHref(href)) {
    const label = flattenReactText(children) || 'Open citation'
    return <ChatCitationLink {...props} href={href} label={label} onCitation={onCitation} />
  }
  return (
    <a {...props} href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  )
}

function ChatCitationLink({
  href,
  label,
  onCitation,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; label: string; onCitation(href: string): void }) {
  const pointerHandledRef = useRef(false)
  const openCitation = () => {
    onCitation(href)
  }
  return (
    <a
      {...props}
      href={href}
      data-rebook-citation="true"
      title={label}
      aria-label={label}
      onPointerDown={event => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
        event.preventDefault()
        pointerHandledRef.current = true
        openCitation()
        window.setTimeout(() => {
          pointerHandledRef.current = false
        }, 500)
      }}
      onClick={event => {
        event.preventDefault()
        if (pointerHandledRef.current) return
        openCitation()
      }}
    >
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </a>
  )
}

function ChatMarkdownContent({
  content,
  streaming,
  onCitation,
}: {
  content: string
  streaming: boolean
  onCitation(href: string): void
}) {
  const parts = useMemo(() => splitRenderableMarkdownPreviews(content), [content])
  return (
    <div className="chat-markdown">
      {parts.map(part => {
        if (part.type === 'preview') {
          return (
            <ChatCodePreview
              key={`preview-${part.ordinal}`}
              preview={part.preview}
              preProps={{}}
              streaming={streaming}
            />
          )
        }
        const citationDraft = extractStreamingCitationDraft(part.markdown, streaming)
        const markdown = citationDraft?.markdown ?? part.markdown
        return (
          <Fragment key={part.key}>
            {markdown ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkLooseStrong]}
                urlTransform={transformChatMarkdownUrl}
                components={{
                  a: ({ node: _node, href, children, ...linkProps }) => (
                    <ChatMarkdownLink href={href} onCitation={onCitation} {...linkProps}>
                      {children}
                    </ChatMarkdownLink>
                  ),
                  pre: ({ node: _node, children, ...preProps }) => (
                    <ChatMarkdownPre streaming={streaming} {...preProps}>{children}</ChatMarkdownPre>
                  ),
                }}
              >
                {markdown}
              </ReactMarkdown>
            ) : null}
            {citationDraft ? (
              <ChatCitationLink
                href={citationDraft.href}
                label={citationDraft.label}
                onCitation={onCitation}
              />
            ) : null}
          </Fragment>
        )
      })}
    </div>
  )
}

type ChatMarkdownPart =
  | { type: 'markdown'; key: string; markdown: string }
  | { type: 'preview'; ordinal: number; preview: RenderableCodePreview }

function splitRenderableMarkdownPreviews(markdown: string): ChatMarkdownPart[] {
  const parts: ChatMarkdownPart[] = []
  const fencePattern = /(^|\n)(```|~~~)([^\n]*)\n/g
  let cursor = 0
  let previewOrdinal = 0

  while (true) {
    const match = fencePattern.exec(markdown)
    if (!match) break

    const fenceStart = match.index + match[1].length
    const fence = match[2]
    const info = match[3] ?? ''
    const codeStart = fencePattern.lastIndex
    const closePattern = new RegExp(`\\n${escapeRegExp(fence)}[ \\t]*(?=\\n|$)`, 'g')
    closePattern.lastIndex = codeStart
    const close = closePattern.exec(markdown)
    const codeEnd = close ? close.index : markdown.length
    const code = markdown.slice(codeStart, codeEnd)
    const preview = getRenderableCodePreviewFromCode(info, code)

    if (!preview) {
      fencePattern.lastIndex = codeStart
      continue
    }

    appendMarkdownPart(parts, markdown.slice(cursor, fenceStart), `markdown-${parts.length}`)
    parts.push({
      type: 'preview',
      ordinal: previewOrdinal++,
      preview,
    })
    cursor = close ? close.index + close[0].length : markdown.length
    fencePattern.lastIndex = cursor
  }

  appendMarkdownPart(parts, markdown.slice(cursor), `markdown-${parts.length}`)
  return parts
}

function appendMarkdownPart(parts: ChatMarkdownPart[], markdown: string, key: string): void {
  if (!markdown) return
  parts.push({ type: 'markdown', key, markdown })
}

function extractStreamingCitationDraft(markdown: string, streaming: boolean): { markdown: string; href: string; label: string } | null {
  if (!streaming) return null
  const match = /\[([^\]\n]{0,80})\]\((rebook:\/\/j\/[^)\s]*)$/.exec(markdown)
  if (!match) return null
  const href = match[2]
  if (!parseRebookJumpHref(href)) return null
  return {
    markdown: markdown.slice(0, match.index),
    href,
    label: match[1] || '出处',
  }
}

function ChatMarkdownPre({ children, streaming, ...props }: HTMLAttributes<HTMLPreElement> & { streaming?: boolean }) {
  const preview = getRenderableCodePreview(children)
  if (!preview) return <pre {...props}>{children}</pre>
  return <ChatCodePreview preview={preview} preProps={props} streaming={streaming === true} />
}

function ChatCodePreview({
  preview,
  preProps,
  streaming,
}: {
  preview: RenderableCodePreview
  preProps: HTMLAttributes<HTMLPreElement>
  streaming: boolean
}) {
  const [tab, setTab] = useState<'preview' | 'code'>('preview')
  const [collapsed, setCollapsed] = useState(false)
  const [frameHeight, setFrameHeight] = useState(360)
  const [mermaidResult, setMermaidResult] = useState<MermaidPreviewResult | null>(null)
  const frameRef = useRef<HTMLIFrameElement | null>(null)
  const pendingPreviewWriteRef = useRef<number | null>(null)
  const lastFrameWidthRef = useRef(0)
  const mermaidAttemptedCodeRef = useRef('')
  const mermaidInFlightRef = useRef(false)
  const mermaidLatestCodeRef = useRef('')
  const mermaidRenderSessionRef = useRef(0)
  const mermaidRenderTimerRef = useRef<number | null>(null)
  const mermaidStreamingRef = useRef(streaming)
  const framePreview = getPreviewFrameContent(preview, mermaidResult, streaming)
  mermaidStreamingRef.current = streaming

  const scheduleMermaidRender = (delay: number) => {
    if (mermaidRenderTimerRef.current != null || mermaidInFlightRef.current) return
    mermaidRenderTimerRef.current = window.setTimeout(() => {
      mermaidRenderTimerRef.current = null
      void runMermaidRender()
    }, delay)
  }

  const runMermaidRender = async () => {
    if (mermaidInFlightRef.current) return
    const session = mermaidRenderSessionRef.current
    const code = mermaidLatestCodeRef.current
    if (!code || code === mermaidAttemptedCodeRef.current) return

    mermaidAttemptedCodeRef.current = code
    mermaidInFlightRef.current = true
    try {
      const svg = await renderMermaidDiagram(code)
      if (session === mermaidRenderSessionRef.current) {
        setMermaidResult({ code, svg })
      }
    } catch (error) {
      if (session === mermaidRenderSessionRef.current) {
        setMermaidResult(current => mermaidStreamingRef.current && current?.svg ? current : {
          code,
          error: mermaidStreamingRef.current ? undefined : formatError(error),
        })
      }
    } finally {
      mermaidInFlightRef.current = false
      if (session === mermaidRenderSessionRef.current && mermaidLatestCodeRef.current !== mermaidAttemptedCodeRef.current) {
        scheduleMermaidRender(mermaidStreamingRef.current ? 120 : 0)
      }
    }
  }

  const measureFrameHeight = useCallback((mode: 'fit' | 'grow' = 'fit') => {
    const doc = frameRef.current?.contentDocument
    if (!doc) return
    const body = doc.body
    const previewRoot = doc.getElementById('preview-root')
    const bodyStyle = body ? doc.defaultView?.getComputedStyle(body) : null
    const verticalPadding = bodyStyle
      ? Number.parseFloat(bodyStyle.paddingTop || '0') + Number.parseFloat(bodyStyle.paddingBottom || '0')
      : 0
    const rootRect = previewRoot?.getBoundingClientRect()
    const svgRect = previewRoot?.querySelector('svg')?.getBoundingClientRect()
    const height = Math.max(
      previewRoot?.scrollHeight ?? 0,
      previewRoot?.offsetHeight ?? 0,
      rootRect?.height ?? 0,
      svgRect?.height ?? 0,
    ) + verticalPadding
    if (height > 0) {
      const safetyPadding = body?.dataset.previewKind === 'svg' ? 24 : 2
      const nextHeight = clampPreviewFrameHeight(height + safetyPadding)
      setFrameHeight(current => mode === 'grow' ? Math.max(current, nextHeight) : nextHeight)
    }
  }, [])

  const scheduleFrameMeasure = useCallback((mode: 'fit' | 'grow') => {
    requestAnimationFrame(() => {
      measureFrameHeight(mode)
      requestAnimationFrame(() => measureFrameHeight(mode))
    })
  }, [measureFrameHeight])

  useEffect(() => {
    setFrameHeight(360)
    setCollapsed(false)
  }, [preview.kind])

  useEffect(() => {
    if (preview.kind !== 'mermaid') {
      mermaidAttemptedCodeRef.current = ''
      mermaidLatestCodeRef.current = ''
      mermaidRenderSessionRef.current += 1
      if (mermaidRenderTimerRef.current != null) {
        window.clearTimeout(mermaidRenderTimerRef.current)
        mermaidRenderTimerRef.current = null
      }
      setMermaidResult(null)
    }
  }, [preview.kind])

  useEffect(() => {
    const code = getMermaidRenderCode(preview.code, streaming)
    if (preview.kind !== 'mermaid') return
    if (!code) {
      if (!streaming) setMermaidResult(null)
      return
    }

    mermaidLatestCodeRef.current = code
    scheduleMermaidRender(streaming ? 80 : 0)
  }, [preview.code, preview.kind, streaming])

  useEffect(() => {
    return () => {
      mermaidRenderSessionRef.current += 1
      if (mermaidRenderTimerRef.current != null) {
        window.clearTimeout(mermaidRenderTimerRef.current)
        mermaidRenderTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (tab !== 'preview') return
    if (pendingPreviewWriteRef.current != null) window.clearTimeout(pendingPreviewWriteRef.current)
    pendingPreviewWriteRef.current = window.setTimeout(() => {
      pendingPreviewWriteRef.current = null
      const wrote = writePreviewFrameContent(frameRef.current, framePreview)
      if (streaming) {
        if (wrote) scheduleFrameMeasure('grow')
        return
      }
      scheduleFrameMeasure('fit')
    }, streaming ? 120 : 0)
    return () => {
      if (pendingPreviewWriteRef.current != null) {
        window.clearTimeout(pendingPreviewWriteRef.current)
        pendingPreviewWriteRef.current = null
      }
    }
  }, [framePreview.html, framePreview.kind, scheduleFrameMeasure, streaming, tab])

  useEffect(() => {
    if (tab !== 'preview') return
    const frame = frameRef.current
    if (!frame || typeof ResizeObserver === 'undefined') return
    let frameId: number | null = null
    lastFrameWidthRef.current = frame.getBoundingClientRect().width
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width ?? frame.getBoundingClientRect().width
      if (Math.abs(width - lastFrameWidthRef.current) < 1) return
      lastFrameWidthRef.current = width
      if (frameId != null) cancelAnimationFrame(frameId)
      frameId = requestAnimationFrame(() => {
        frameId = null
        scheduleFrameMeasure('fit')
      })
    })
    observer.observe(frame)
    return () => {
      if (frameId != null) cancelAnimationFrame(frameId)
      observer.disconnect()
    }
  }, [scheduleFrameMeasure, tab])

  const effectiveFrameHeight = collapsed ? Math.min(frameHeight, 260) : frameHeight

  return (
    <div className="chat-code-preview">
      <div className="chat-code-preview-header">
        <span>{preview.label}</span>
        <div className="chat-code-preview-actions">
          {tab === 'preview' ? (
            <button
              type="button"
              className="chat-code-preview-icon"
              onClick={() => setCollapsed(value => !value)}
              title={collapsed ? 'Expand preview height' : 'Collapse preview height'}
            >
              {collapsed ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
            </button>
          ) : null}
          <div className="chat-code-preview-tabs">
            <button
              type="button"
              className={tab === 'preview' ? 'is-active' : ''}
              onClick={() => setTab('preview')}
            >
              Preview
            </button>
            <button
              type="button"
              className={tab === 'code' ? 'is-active' : ''}
              onClick={() => setTab('code')}
            >
              Code
            </button>
          </div>
        </div>
      </div>
      {tab === 'preview' ? (
        <iframe
          ref={frameRef}
          className="chat-code-preview-frame"
          sandbox="allow-same-origin"
          srcDoc={PREVIEW_SHELL_DOCUMENT}
          style={{ height: effectiveFrameHeight }}
          title={`${preview.label} preview`}
          onLoad={() => {
            writePreviewFrameContent(frameRef.current, framePreview)
            scheduleFrameMeasure(streaming ? 'grow' : 'fit')
          }}
        />
      ) : (
        <pre {...preProps}><code className={preview.className}>{preview.code}</code></pre>
      )}
    </div>
  )
}

function clampPreviewFrameHeight(height: number): number {
  return Math.max(260, Math.min(3600, Math.ceil(height)))
}

interface RenderableCodePreview {
  label: string
  kind: RenderableCodePreviewKind
  html: string
  code: string
  className?: string
}

type RenderableCodePreviewKind = PreviewFrameKind | 'mermaid'
type PreviewFrameKind = 'svg' | 'html'

interface PreviewFrameContent {
  kind: PreviewFrameKind
  html: string
}

interface MermaidPreviewResult {
  code: string
  svg?: string
  error?: string
}

function getRenderableCodePreview(children: ReactNode): RenderableCodePreview | null {
  const child = Array.isArray(children) ? children.find(isValidElement) : children
  if (!isValidElement(child)) return null
  const element = child as ReactElement<{ className?: string; children?: ReactNode }>
  const className = element.props.className ?? ''
  const language = normalizeCodeLanguage(/\blanguage-([^\s]+)\b/i.exec(className)?.[1])
  const code = flattenReactText(element.props.children).trim()
  return getRenderableCodePreviewFromCode(language, code, className)
}

function getRenderableCodePreviewFromCode(language: string | undefined, rawCode: string, className?: string): RenderableCodePreview | null {
  const normalizedLanguage = normalizeCodeLanguage(language)
  const code = rawCode.trim()
  if (!code) return null
  if (normalizedLanguage === 'mermaid' || normalizedLanguage === 'mmd') {
    const mermaidCode = rawCode.trimStart()
    return {
      label: 'Mermaid',
      kind: 'mermaid',
      html: mermaidCode,
      code: mermaidCode,
      className,
    }
  }
  if (normalizedLanguage === 'svg' || looksLikeSVG(code)) {
    return {
      label: 'SVG',
      kind: 'svg',
      html: code,
      code,
      className,
    }
  }
  if (normalizedLanguage === 'html' || looksLikeHTML(code)) {
    return {
      label: 'HTML',
      kind: 'html',
      html: code,
      code,
      className,
    }
  }
  return null
}

function normalizeCodeLanguage(value: string | undefined): string | undefined {
  return value?.trim().split(/\s+/, 1)[0]?.replace(/^language-/i, '').toLowerCase()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function looksLikeSVG(value: string): boolean {
  return /^\s*<svg[\s>]/i.test(value)
}

function looksLikeHTML(value: string): boolean {
  return /^\s*(?:<!doctype\s+html|<html[\s>]|<body[\s>]|<(?:div|main|section|article|style|canvas|table|form|button|h[1-6]|p|ul|ol|svg)[\s>])/i.test(value)
}

const PREVIEW_SHELL_DOCUMENT = [
  '<!doctype html><html><head><meta charset="utf-8"><base target="_blank">',
  '<style>',
  'html,body{margin:0;min-height:100%;overflow:hidden;background:#fff;color:#111827;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}',
  'body{box-sizing:border-box}',
  'body[data-preview-kind="svg"]{display:block;padding:16px}',
  'body[data-preview-kind="html"]{display:block;padding:0}',
  '#preview-root,#preview-buffer{width:100%;box-sizing:border-box}',
  'body[data-preview-kind="svg"] #preview-root{display:block;text-align:center}',
  'body[data-preview-kind="html"] #preview-root{display:flow-root}',
  '#preview-buffer{position:absolute;left:-100000px;top:0;visibility:hidden;pointer-events:none;overflow:hidden}',
  '.preview-status{display:grid;min-height:220px;place-items:center;padding:24px;color:#64748b;font:14px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-align:center}',
  '.preview-status.is-error{color:#b91c1c;white-space:pre-wrap}',
  'svg{max-width:100%;height:auto;overflow:visible}',
  '</style></head><body data-preview-kind="html"><div id="preview-root"></div><div id="preview-buffer"></div></body></html>',
].join('')

const previewFrameContentCache = new WeakMap<HTMLIFrameElement, string>()

function getPreviewFrameContent(preview: RenderableCodePreview, mermaidResult: MermaidPreviewResult | null, streaming: boolean): PreviewFrameContent {
  if (preview.kind !== 'mermaid') return { kind: preview.kind, html: preview.html }
  if (mermaidResult?.svg) return { kind: 'svg', html: mermaidResult.svg }
  if (mermaidResult?.error && !streaming) {
    return {
      kind: 'html',
      html: `<div class="preview-status is-error">Mermaid render failed:\n${escapeHTML(mermaidResult.error)}</div>`,
    }
  }
  return {
    kind: 'html',
    html: '<div class="preview-status">Rendering Mermaid diagram...</div>',
  }
}

function writePreviewFrameContent(frame: HTMLIFrameElement | null, preview: PreviewFrameContent): boolean {
  const doc = frame?.contentDocument
  const root = doc?.getElementById('preview-root')
  const buffer = doc?.getElementById('preview-buffer')
  const cacheKey = `${preview.kind}\n${preview.html}`
  if (!frame || !doc || !root || !buffer || previewFrameContentCache.get(frame) === cacheKey) return false
  doc.body.dataset.previewKind = preview.kind
  buffer.innerHTML = getPreviewParseHTML(preview)
  if (!hasRenderablePreviewContent(buffer, preview.kind)) return false
  root.replaceChildren(...Array.from(buffer.childNodes).map(node => node.cloneNode(true)))
  buffer.replaceChildren()
  previewFrameContentCache.set(frame, cacheKey)
  return true
}

function getPreviewParseHTML(preview: PreviewFrameContent): string {
  if (preview.kind !== 'svg' || /<\/svg\s*>/i.test(preview.html)) return preview.html
  return `${preview.html}\n</svg>`
}

function hasRenderablePreviewContent(root: HTMLElement, kind: PreviewFrameKind): boolean {
  if (kind === 'svg') return Boolean(root.querySelector('svg'))
  return root.childNodes.length > 0
}

let mermaidModulePromise: Promise<typeof import('mermaid')> | null = null
let mermaidRenderCounter = 0

async function getMermaidModule(): Promise<typeof import('mermaid')> {
  if (!mermaidModulePromise) {
    mermaidModulePromise = import('mermaid').then(module => {
      module.default.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'default',
      })
      return module
    })
  }
  return mermaidModulePromise
}

async function renderMermaidDiagram(code: string): Promise<string> {
  const { default: mermaid } = await getMermaidModule()
  const id = `rebook-mermaid-${++mermaidRenderCounter}`
  const result = await mermaid.render(id, code)
  return result.svg
}

function getMermaidRenderCode(code: string, streaming: boolean): string {
  const value = code.trimStart()
  if (!streaming) return value.trim()
  if (/\r?\n\s*$/.test(value)) return value.trim()
  const trimmed = value.trimEnd()
  const lines = trimmed.split(/\r?\n/)
  if (lines.length <= 1) return trimmed.trim()
  return lines.slice(0, -1).join('\n').trim()
}

function escapeHTML(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function flattenReactText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map(flattenReactText).join('')
  return ''
}

function SettingsDialog(props: {
  section: SettingsSection
  setSection(section: SettingsSection): void
  config: DemoConfig
  setConfig(config: DemoConfig): void
  onClose(): void
  onApply(): void
}) {
  const sections: Array<{ id: SettingsSection; label: string }> = [
    { id: 'reading', label: 'Reading' },
    { id: 'translation', label: 'Translation' },
    { id: 'tts', label: 'Text to Speech' },
    { id: 'chat', label: 'AI Chat' },
    { id: 'trial', label: 'Trial' },
    { id: 'debug', label: 'Debug' },
  ]
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4">
      <div className="flex h-[min(760px,92vh)] w-[min(980px,96vw)] overflow-hidden rounded-2xl bg-white shadow-2xl">
        <aside className="w-56 shrink-0 border-r border-slate-200 bg-slate-50 p-3">
          <div className="mb-3 px-2 text-sm font-semibold text-slate-900">Settings</div>
          <nav className="space-y-1">
            {sections.map(section => (
              <button
                key={section.id}
                type="button"
                className={[
                  'block w-full rounded-lg px-3 py-2 text-left text-sm',
                  props.section === section.id ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-white',
                ].join(' ')}
                onClick={() => props.setSection(section.id)}
              >
                {section.label}
              </button>
            ))}
          </nav>
        </aside>
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-14 items-center justify-between border-b border-slate-200 px-5">
            <h2 className="text-base font-semibold text-slate-900">{sections.find(item => item.id === props.section)?.label}</h2>
            <button className="icon-button" type="button" onClick={props.onClose}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-5">
            <SettingsSectionForm section={props.section} config={props.config} setConfig={props.setConfig} />
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
            <button className="toolbar-button" type="button" onClick={props.onClose}>Cancel</button>
            <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" type="button" onClick={props.onApply}>Apply</button>
          </div>
        </section>
      </div>
    </div>
  )
}

function SettingsSectionForm({ section, config, setConfig }: { section: SettingsSection; config: DemoConfig; setConfig(config: DemoConfig): void }) {
  const update = <K extends keyof DemoConfig>(key: K, value: DemoConfig[K]) => setConfig({ ...config, [key]: value })
  if (section === 'reading') {
    return (
      <FormGrid>
        <SelectField label="Layout" value={config.layout} onChange={value => update('layout', value as DemoConfig['layout'])} options={[['paginated', 'Paginated'], ['scrolled', 'Scrolled']]} />
        <SelectField label="Spread" value={config.spread} onChange={value => update('spread', value)} options={[['2', 'Auto spread'], ['1', 'Single page']]} />
        <SelectField label="Fixed painter" value={config.fixedPainter} onChange={value => update('fixedPainter', value)} options={[['auto', 'Auto'], ['canvas', 'Canvas 2D'], ['webgpu', 'WebGPU']]} />
        <SelectField label="Font size" value={config.fontSize} onChange={value => update('fontSize', value)} options={[['14px', 'Small'], ['16px', 'Medium'], ['18px', 'Large'], ['20px', 'X-Large']]} />
        <SelectField label="Theme" value={config.theme} onChange={value => update('theme', value as DemoConfig['theme'])} options={[['normal', 'Normal'], ['night', 'Night']]} />
        <CheckField label="Hyphenate" checked={config.hyphenate} onChange={value => update('hyphenate', value)} />
      </FormGrid>
    )
  }
  if (section === 'translation') {
    return (
      <FormGrid>
        <CheckField label="Enable" checked={config.translate} onChange={value => update('translate', value)} />
        <CheckField label="Professional" checked={config.professionalTranslation} onChange={value => update('professionalTranslation', value)} />
        {config.professionalTranslation ? (
          <>
            <TextField label="Service URL" value={config.professionalServiceBaseUrl} onChange={value => update('professionalServiceBaseUrl', value)} />
            <TextField label="Book ID" value={config.professionalBookId} onChange={value => update('professionalBookId', value)} />
          </>
        ) : (
          <>
            <TextField label="Base URL" value={config.baseURL} onChange={value => update('baseURL', value)} />
            <TextField label="API key" value={config.apiKey} type="password" onChange={value => update('apiKey', value)} />
            <TextField label="Model" value={config.model} onChange={value => update('model', value)} placeholder="gpt-4o-mini" />
            <CheckField label="Translate TOC" checked={config.translateTOC} onChange={value => update('translateTOC', value)} />
          </>
        )}
        <SelectField label="Mode" value={config.translateMode} onChange={value => update('translateMode', value)} options={[['bilingual', 'Bilingual'], ['replace', 'Replace']]} />
        <TextField label="Prefetch pages" value={config.prefetchPages} type="number" onChange={value => update('prefetchPages', value)} />
      </FormGrid>
    )
  }
  if (section === 'tts') {
    return (
      <FormGrid>
        <CheckField label="Enable" checked={config.tts} onChange={value => update('tts', value)} />
        <TextField label="Endpoint" value={config.ttsEndpoint} onChange={value => update('ttsEndpoint', value)} />
        <TextField label="Provider" value={config.ttsProvider} onChange={value => update('ttsProvider', value)} />
        <TextField label="SFX provider" value={config.ttsSoundEffectProvider} onChange={value => update('ttsSoundEffectProvider', value)} />
        <TextField label="Voice" value={config.ttsVoice} onChange={value => update('ttsVoice', value)} />
        <TextField label="Segment chars" value={config.ttsSegmentChars} type="number" onChange={value => update('ttsSegmentChars', value)} />
        <TextField label="Speed" value={config.ttsSpeed} type="number" onChange={value => update('ttsSpeed', value)} />
        <CheckField label="Multi voice" checked={config.ttsMultiSpeaker} onChange={value => update('ttsMultiSpeaker', value)} />
        <TextField label="TTS AI Base URL" value={config.ttsAIBaseURL} onChange={value => update('ttsAIBaseURL', value)} />
        <TextField label="TTS AI API key" value={config.ttsAIAPIKey} type="password" onChange={value => update('ttsAIAPIKey', value)} />
        <TextField label="TTS AI model" value={config.ttsModel} onChange={value => update('ttsModel', value)} placeholder="gpt-4o-mini" />
        <TextField label="Narrator voice" value={config.ttsNarratorVoice} onChange={value => update('ttsNarratorVoice', value)} />
        <TextField label="Male voices" value={config.ttsMaleVoices} onChange={value => update('ttsMaleVoices', value)} />
        <TextField label="Female voices" value={config.ttsFemaleVoices} onChange={value => update('ttsFemaleVoices', value)} />
        <TextField label="Other voice" value={config.ttsOtherVoice} onChange={value => update('ttsOtherVoice', value)} />
      </FormGrid>
    )
  }
  if (section === 'chat') {
    return (
      <FormGrid>
        <CheckField label="Enable" checked={config.chat} onChange={value => update('chat', value)} />
        <TextField label="Base URL" value={config.chatBaseURL} onChange={value => update('chatBaseURL', value)} />
        <TextField label="API key" value={config.chatAPIKey} type="password" onChange={value => update('chatAPIKey', value)} />
        <TextField label="Model" value={config.chatModel} onChange={value => update('chatModel', value)} placeholder="gpt-4o-mini" />
        <TextField label="Content chars" value={config.chatMaxContentChars} type="number" onChange={value => update('chatMaxContentChars', value)} />
      </FormGrid>
    )
  }
  if (section === 'trial') {
    return (
      <FormGrid>
        <CheckField label="Enable" checked={config.trial} onChange={value => update('trial', value)} />
        <TextField label="Trial pages" value={config.trialPages} type="number" onChange={value => update('trialPages', value)} />
      </FormGrid>
    )
  }
  return (
    <FormGrid>
      <CheckField label="Debug logging" checked={config.debug} onChange={value => update('debug', value)} />
    </FormGrid>
  )
}

function Footer({
  ttsEnabled,
  ttsStatus,
  onPlayTTS,
  onStopTTS,
}: {
  ttsEnabled: boolean
  ttsStatus: string
  onPlayTTS(): void
  onStopTTS(): void
}) {
  if (!ttsEnabled) return null
  return (
    <footer className="flex h-11 shrink-0 items-center gap-3 border-t border-slate-200 bg-white/92 px-4 text-xs text-slate-500">
      <div className="min-w-0 flex-1" />
      <div className="min-w-0 max-w-xs truncate">{ttsStatus}</div>
      <button className="toolbar-button" type="button" onClick={onPlayTTS}>
        <Volume2 className="h-4 w-4" />
        Speak
      </button>
      <button className="toolbar-button" type="button" onClick={onStopTTS}>Stop</button>
    </footer>
  )
}

function FormGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid max-w-2xl gap-4">{children}</div>
}

function TextField({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange(value: string): void; type?: string; placeholder?: string }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <input className="input" type={type} value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} />
    </label>
  )
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange(value: string): void; options: Array<[string, string]> }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <select className="input" value={value} onChange={event => onChange(event.target.value)}>
        {options.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}
      </select>
    </label>
  )
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange(value: boolean): void }) {
  return (
    <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />
    </label>
  )
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-200">
      <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  )
}

function loadConfig(): DemoConfig {
  try {
    return { ...defaultConfig, ...JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}') }
  } catch {
    return { ...defaultConfig }
  }
}

function saveConfig(config: DemoConfig) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
}

function getChatCommandToken(input: string): string | null {
  const value = input.trimStart()
  if (!value.startsWith('/')) return null
  return /^\/[^\s]*/.exec(value)?.[0].toLowerCase() ?? null
}

function getChatCommandSuggestions(input: string): ChatCommand[] {
  const value = input.trimStart()
  const token = getChatCommandToken(value)
  if (!token) return []
  const exactCommand = CHAT_COMMANDS.find(command => command.name === token)
  const hasArgs = /\s/.test(value.slice(token.length))
  if (exactCommand && hasArgs) return []
  return CHAT_COMMANDS.filter(command => command.name.startsWith(token))
}

function resolveChatCommand(input: string): { prompt?: string; error?: string; insertText?: string } | null {
  const match = /^(\/[^\s]+)(?:\s+([\s\S]*))?$/.exec(input.trim())
  if (!match) return null
  const command = CHAT_COMMANDS.find(item => item.name === match[1].toLowerCase())
  if (!command) return null
  const args = (match[2] ?? '').trim()
  if (command.requiresArgs && !args) {
    return { error: command.missingArgsMessage, insertText: command.insertText }
  }
  return { prompt: command.buildPrompt(args) }
}

interface ChatReferenceToken {
  start: number
  end: number
  query: string
}

function getChatReferenceToken(
  input: string,
  cursorIndex: number,
  selectedReferences: readonly ChatReference[] = [],
): ChatReferenceToken | null {
  const end = Math.max(0, Math.min(input.length, cursorIndex))
  const beforeCursor = input.slice(0, end)
  const start = beforeCursor.lastIndexOf('@')
  if (start < 0) return null
  const previous = input[start - 1]
  if (previous && /[\w.@-]/.test(previous)) return null
  const query = beforeCursor.slice(start + 1)
  if (query.includes('\n') || /^\s/.test(query)) return null
  const normalizedQuery = normalizeReferenceSearchText(query)
  if (selectedReferences.some(reference => {
    const label = normalizeReferenceSearchText(reference.label)
    return normalizedQuery === label || normalizedQuery.startsWith(`${label} `)
  })) {
    return null
  }
  return { start, end, query }
}

function getChatReferenceSuggestions(
  options: readonly ChatReference[],
  selected: readonly ChatReference[],
  query: string,
): ChatReference[] {
  const normalizedQuery = normalizeReferenceSearchText(query)
  const selectedIds = new Set(selected.map(reference => reference.id))
  if (normalizedQuery && selected.some(reference => normalizeReferenceSearchText(reference.label) === normalizedQuery)) {
    return []
  }

  const scored = options
    .filter(reference => !selectedIds.has(reference.id))
    .map((reference, index) => {
      const label = normalizeReferenceSearchText(reference.label)
      const description = normalizeReferenceSearchText(reference.description)
      const excerpt = normalizeReferenceSearchText(reference.excerpt ?? '')
      const searchable = `${label} ${description} ${excerpt}`
      const labelIndex = normalizedQuery ? label.indexOf(normalizedQuery) : 0
      const searchIndex = normalizedQuery ? searchable.indexOf(normalizedQuery) : 0
      if (normalizedQuery && searchIndex < 0) return null
      return {
        reference,
        index,
        score: (reference.kind === 'paragraph' ? 0 : 12)
          + (labelIndex >= 0 ? labelIndex : 80)
          + Math.min(searchIndex, 80),
      }
    })
    .filter((item): item is { reference: ChatReference; index: number; score: number } => item !== null)

  return scored
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, MAX_CHAT_REFERENCE_SUGGESTIONS)
    .map(item => item.reference)
}

async function buildChatReferenceOptions(reader: any, book: any): Promise<ChatReference[]> {
  const currentPageReferences = await buildCurrentPageReferenceOptions(reader, book)
  const sectionReferences = buildSectionReferenceOptions(book)
  return dedupeChatReferences([...currentPageReferences, ...sectionReferences]).slice(0, MAX_CHAT_REFERENCE_OPTIONS)
}

function buildSectionReferenceOptions(book: any): ChatReference[] {
  const references: ChatReference[] = []
  const units = getReadableContentUnits(book)
  const tocItems = flattenTOCItems(book.toc ?? [])

  for (const item of tocItems) {
    const unitIndex = resolveReadableContentUnitIndex(book, item.href)
    if (typeof unitIndex !== 'number') continue
    const unit = getReadableContentUnit(book, unitIndex)
    const blockId = getTOCHrefFragment(item.href)
    references.push({
      id: `section:${unitIndex}:${blockId ?? ''}:${item.label}`,
      kind: 'section',
      label: item.label,
      description: unit?.title && unit.title !== item.label
        ? `章节 ${unitIndex + 1} · ${unit.title}`
        : `章节 ${unitIndex + 1}`,
      href: createChatReferenceHref(unitIndex, blockId),
      unitIndex,
      blockId,
      excerpt: unit?.title,
    })
  }

  for (const unit of units) {
    if (!unit.title) continue
    references.push({
      id: `section:${unit.index}:unit`,
      kind: 'section',
      label: unit.title,
      description: unit.kind === 'page' ? `页面 ${unit.index + 1}` : `章节 ${unit.index + 1}`,
      href: createChatReferenceHref(unit.index),
      unitIndex: unit.index,
      excerpt: unit.title,
    })
  }

  return dedupeChatReferences(references)
}

async function buildCurrentPageReferenceOptions(reader: any, book: any): Promise<ChatReference[]> {
  const loc = reader?.getLocation?.()
  const unitIndex = typeof loc?.index === 'number' ? loc.index : 0
  const unit = getReadableContentUnit(book, unitIndex)
  const chunks = await reader?.getCurrentText?.()
  if (!Array.isArray(chunks) || !chunks.length) return []

  const groups = new Map<string, { blockId?: string; texts: string[]; order: number }>()
  chunks.forEach((chunk: any, index: number) => {
    const text = normalizeReferenceText(chunk?.text ?? '')
    if (!text) return
    const blockId = chunk?.location?.type === 'reflowable' ? chunk.location.blockId : undefined
    const key = blockId ? `block:${blockId}` : `chunk:${index}`
    const group = groups.get(key) ?? { blockId, texts: [], order: index }
    group.texts.push(text)
    groups.set(key, group)
  })

  return Array.from(groups.values())
    .sort((a, b) => a.order - b.order)
    .map((group): ChatReference | null => {
      const excerpt = clipChatReferenceExcerpt(joinReferenceText(group.texts))
      if (!excerpt || excerpt.length < 2) return null
      const label = excerpt.length > 32 ? `${excerpt.slice(0, 32)}...` : excerpt
      return {
        id: `paragraph:${unitIndex}:${group.blockId ?? group.order}`,
        kind: 'paragraph',
        label,
        description: unit?.title ? `当前页 · ${unit.title}` : `当前页 · ${unitIndex + 1}`,
        href: createChatReferenceHref(unitIndex, group.blockId),
        unitIndex,
        blockId: group.blockId,
        excerpt,
      }
    })
    .filter((reference): reference is ChatReference => reference !== null)
}

function buildChatMessageContentWithReferences(content: string, references: readonly ChatReference[]): string {
  if (!references.length) return content
  const base = content.trim() || '请结合我引用的内容回答。'
  const referenceText = references.map((reference, index) => [
    `${index + 1}. ${reference.kind === 'section' ? '章节' : '段落'}：${reference.label}`,
    `href: ${reference.href}`,
    reference.description ? `位置: ${reference.description}` : '',
    reference.excerpt ? `摘录: ${reference.excerpt}` : '',
  ].filter(Boolean).join('\n')).join('\n\n')
  return [
    base,
    '用户在输入框中引用了以下书籍位置。回答涉及这些引用内容时，请优先使用对应 href 作为出处链接：',
    referenceText,
  ].join('\n\n')
}

function dedupeChatReferences(references: readonly ChatReference[]): ChatReference[] {
  const seen = new Set<string>()
  const next: ChatReference[] = []
  for (const reference of references) {
    const key = `${reference.href}\n${normalizeReferenceSearchText(reference.label)}`
    if (seen.has(key)) continue
    seen.add(key)
    next.push(reference)
  }
  return next
}

function createChatReferenceHref(unitIndex: number, blockId?: string): string {
  return blockId ? `rebook://j/${unitIndex}/${encodeURIComponent(blockId)}` : `rebook://j/${unitIndex}`
}

function getTOCHrefFragment(href: string | undefined): string | undefined {
  if (!href) return undefined
  const index = href.indexOf('#')
  if (index < 0 || index === href.length - 1) return undefined
  try {
    return decodeURIComponent(href.slice(index + 1))
  } catch {
    return href.slice(index + 1)
  }
}

function normalizeReferenceSearchText(value: string): string {
  return value.toLocaleLowerCase().replace(/\s+/g, ' ').trim()
}

function normalizeReferenceText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function joinReferenceText(parts: readonly string[]): string {
  let output = ''
  for (const part of parts) {
    if (!part) continue
    if (!output) {
      output = part
      continue
    }
    output += shouldJoinReferenceTextWithSpace(output, part) ? ` ${part}` : part
  }
  return output
}

function shouldJoinReferenceTextWithSpace(left: string, right: string): boolean {
  return /[A-Za-z0-9]$/.test(left) && /^[A-Za-z0-9]/.test(right)
}

function clipChatReferenceExcerpt(value: string): string {
  return value.length > MAX_CHAT_REFERENCE_EXCERPT
    ? `${value.slice(0, MAX_CHAT_REFERENCE_EXCERPT).trimEnd()}...`
    : value
}

interface RebookJumpTarget {
  unitIndex: number
  blockId?: string
}

function isRebookJumpHref(href: string): boolean {
  return href.startsWith('rebook://j/')
}

function transformChatMarkdownUrl(value: string): string {
  if (isRebookJumpHref(value)) return value
  return defaultUrlTransform(value)
}

function parseRebookJumpHref(href: string): RebookJumpTarget | null {
  try {
    const url = new URL(href)
    if (url.protocol !== 'rebook:' || url.hostname !== 'j') return null
    const [rawUnitIndex, ...rawBlockParts] = url.pathname.split('/').filter(Boolean)
    const unitIndex = Number(rawUnitIndex)
    if (!Number.isInteger(unitIndex) || unitIndex < 0) return null
    const rawBlockId = rawBlockParts.join('/')
    return {
      unitIndex,
      blockId: rawBlockId ? decodeURIComponent(rawBlockId) : undefined,
    }
  } catch {
    return null
  }
}

function toAIChatMessage(message: ChatMessage) {
  if (message.role !== 'user' || !message.attachments?.length) {
    return { role: message.role, content: message.content }
  }
  return {
    role: message.role,
    content: [
      { type: 'text', text: message.content || '请分析这些图片。' },
      ...message.attachments.map(attachment => ({
        type: 'image',
        image: attachment.data,
        mediaType: attachment.mediaType,
      })),
    ],
  }
}

async function readChatImageAttachment(file: File): Promise<ChatAttachment> {
  const dataUrl = await readFileAsDataURL(file)
  const base64 = dataUrl.split(',')[1] || ''
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: file.name || 'image',
    mediaType: file.type || 'image/png',
    data: base64,
    previewUrl: URL.createObjectURL(file),
  }
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('Failed to read image.'))
    reader.readAsDataURL(file)
  })
}

function revokeChatAttachmentURLs(attachments: readonly ChatAttachment[]) {
  attachments.forEach(attachment => URL.revokeObjectURL(attachment.previewUrl))
}

interface MarkdownNode {
  type?: string
  value?: string
  children?: MarkdownNode[]
}

function remarkLooseStrong() {
  return (tree: MarkdownNode) => {
    normalizeLooseStrong(tree)
  }
}

function normalizeLooseStrong(node: MarkdownNode) {
  if (!node.children?.length) return
  const nextChildren: MarkdownNode[] = []
  for (const child of node.children) {
    if (child.type === 'text' && typeof child.value === 'string') {
      nextChildren.push(...splitLooseStrongText(child.value))
      continue
    }
    normalizeLooseStrong(child)
    nextChildren.push(child)
  }
  node.children = nextChildren
}

function splitLooseStrongText(value: string): MarkdownNode[] {
  const nodes: MarkdownNode[] = []
  let cursor = 0
  let changed = false

  while (cursor < value.length) {
    const start = value.indexOf('**', cursor)
    if (start === -1) break
    const end = value.indexOf('**', start + 2)
    if (end === -1) break
    const strongText = value.slice(start + 2, end)
    if (!strongText.trim()) {
      break
    }
    if (start > cursor) {
      nodes.push({ type: 'text', value: value.slice(cursor, start) })
    }
    nodes.push({
      type: 'strong',
      children: [{ type: 'text', value: strongText }],
    })
    changed = true
    cursor = end + 2
  }

  if (!changed) return [{ type: 'text', value }]
  if (cursor < value.length) {
    nodes.push({ type: 'text', value: value.slice(cursor) })
  }
  return nodes
}

function getReaderStyles(config: DemoConfig) {
  return {
    theme: config.theme,
    fontSize: config.fontSize,
    hyphenate: config.hyphenate,
    lineHeight: 1.72,
    minColumnWidth: '360px',
    maxColumnWidth: '960px',
    margin: '36px',
  }
}

function getCurrentChatContext(reader: any, book: any) {
  const loc = reader?.getLocation?.()
  const unitIndex = typeof loc?.index === 'number' ? loc.index : 0
  const unit = book ? getReadableContentUnit(book, unitIndex) : undefined
  return {
    unitIndex,
    unitId: unit?.id,
    unitKind: unit?.kind,
    unitTitle: unit?.title ?? loc?.tocItem?.label,
    sectionIndex: unit?.sectionIndex,
    sectionId: unit?.kind === 'section' ? unit.id : undefined,
    sectionTitle: unit?.kind === 'section' ? unit.title ?? loc?.tocItem?.label : undefined,
    tocLabel: loc?.tocItem?.label,
    tocHref: loc?.tocItem?.href,
    sectionFraction: typeof loc?.fraction === 'number' ? loc.fraction : undefined,
    totalFraction: typeof loc?.totalFraction === 'number' ? loc.totalFraction : undefined,
    pageIndex: typeof loc?.pageIndex === 'number' ? loc.pageIndex : undefined,
    pageCount: typeof loc?.pageCount === 'number' ? loc.pageCount : undefined,
  }
}

function createTTSVoiceProfile(config: DemoConfig) {
  if (isMimoTTSProvider(config)) {
    const narrator = normalizeMimoVoice(config.ttsNarratorVoice || config.ttsVoice)
    return { narrator, unknown: narrator, other: narrator }
  }
  return {
    narrator: config.ttsNarratorVoice.trim() || undefined,
    male: splitVoiceList(config.ttsMaleVoices),
    female: splitVoiceList(config.ttsFemaleVoices),
    other: config.ttsOtherVoice.trim() || undefined,
    unknown: config.ttsOtherVoice.trim() || config.ttsNarratorVoice.trim() || undefined,
  }
}

function getTTSVoiceValue(config: DemoConfig) {
  return isMimoTTSProvider(config)
    ? normalizeMimoVoice(config.ttsVoice)
    : (config.ttsVoice.trim() || undefined)
}

function isMimoTTSProvider(config: DemoConfig) {
  return (config.ttsProvider.trim() || defaultConfig.ttsProvider).toLowerCase() === 'mimo'
}

function normalizeMimoVoice(value: string, fallback = 'mimo_default') {
  const voice = value.trim()
  if (!voice || /Neural$/i.test(voice) || /^(?:zh|en)-[A-Z]{2}-/i.test(voice)) return fallback
  return voice
}

function splitVoiceList(value: string) {
  return value.split(',').map(item => item.trim()).filter(Boolean)
}

function formatLanguageMap(value: any): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  return value.en || value.zh || Object.values(value)[0] as string || ''
}

function flattenTOCItems(items: any[]): any[] {
  return items.flatMap(item => item.subitems?.length ? [item, ...flattenTOCItems(item.subitems)] : [item])
}

function summarizeLocation(location: any) {
  if (!location) return null
  return {
    index: location.index,
    fraction: location.fraction,
    totalFraction: location.totalFraction,
    tocLabel: location.tocItem?.label,
    reason: location.reason,
  }
}

function formatProgress(location: any) {
  const value = typeof location?.totalFraction === 'number' ? location.totalFraction : 0
  return `${Math.round(value * 100)}%`
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function formatMs(value: number) {
  if (value < 10) return `${value.toFixed(2)}ms`
  if (value < 100) return `${value.toFixed(1)}ms`
  return `${Math.round(value)}ms`
}

function clampPanelWidth(value: string | number) {
  const number = typeof value === 'number' ? value : Number(value)
  const viewportMax = typeof window === 'undefined' ? 1120 : Math.max(420, window.innerWidth - 160)
  return Math.max(320, Math.min(1120, viewportMax, Number.isFinite(number) ? number : 420))
}

function panelButtonClass(active: boolean) {
  return active
    ? 'toolbar-button bg-blue-50 text-blue-700 ring-1 ring-blue-200'
    : 'toolbar-button'
}

export default App
