import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  BookOpen,
  Bug,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageSquareText,
  PanelLeft,
  Search,
  Settings,
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
  registerBuiltInParsers,
  registry,
  setRebookDebug,
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
  theme: 'light' | 'dark' | 'sepia'
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
  chatMaxSectionChars: string
  chatPanelWidth: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  pending?: boolean
}

interface SearchItem {
  sectionIndex: number
  chapterLabel?: string
  excerpt: string
  match: string
  sectionId: string | number
}

const CONFIG_KEY = 'rebook-demo-config'
const MAX_DEBUG_ENTRIES = 160
const MAX_SEARCH_RESULTS = 80

const defaultConfig: DemoConfig = {
  layout: 'paginated',
  spread: '2',
  fixedPainter: 'canvas',
  fontSize: '16px',
  theme: 'light',
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
  chatMaxSectionChars: '6000',
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
  const [searchScope, setSearchScope] = useState<'chapter' | 'book'>('chapter')
  const [searchResults, setSearchResults] = useState<SearchItem[]>([])
  const [searchStatus, setSearchStatus] = useState('Open a book to search.')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
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
          maxSectionChars: () => Number(configRef.current.chatMaxSectionChars) || Number(defaultConfig.chatMaxSectionChars),
          maxContextChars: () => Math.max(Number(configRef.current.chatMaxSectionChars) || Number(defaultConfig.chatMaxSectionChars), 20000),
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
      scope: searchScope === 'chapter' ? 'chapter' : 'book',
      chapterIndex: location?.index ?? 0,
      maxResults: MAX_SEARCH_RESULTS,
      contextChars: 96,
    })
    setSearchResults(results)
    setSearchStatus(results.length ? `${results.length} result${results.length === 1 ? '' : 's'}.` : 'No results.')
  }

  const goToSearchResult = async (item: SearchItem) => {
    if (!readerRef.current?.canGoTo?.(item.sectionIndex)) {
      setStatus('Trial limit reached.')
      return
    }
    await readerRef.current.goTo(item.sectionIndex)
  }

  const sendChatMessage = async () => {
    const content = chatInput.trim()
    const aiChat = bookRef.current?.aiChat
    if (!content || chatBusy) return
    if (!aiChat) {
      setChatMessages(messages => [...messages, {
        role: 'assistant',
        content: config.chat ? '请先在设置中填写 AI Chat API Key 并重新应用配置。' : '请先在设置中启用 AI Chat。',
      }])
      return
    }

    const nextMessages: ChatMessage[] = [
      ...chatMessages.filter(message => !message.pending),
      { role: 'user', content },
    ]
    setChatMessages([...nextMessages, { role: 'assistant', content: 'Thinking...', pending: true }])
    setChatInput('')
    setChatBusy(true)
    try {
      const current = getCurrentChatContext(readerRef.current, bookRef.current)
      const response = await aiChat.ask({
        messages: nextMessages.map(({ role, content }) => ({ role, content })),
        currentSectionIndex: current.sectionIndex,
        current,
      })
      setChatMessages([...nextMessages, { role: 'assistant', content: response.text || '(empty response)' }])
      appendDebug('ai chat response', {
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
        title={bookTitle}
        busy={busy}
        sidebarOpen={sidebarOpen}
        activePanel={activePanel}
        onToggleSidebar={() => setSidebarOpen(open => !open)}
        onOpenFile={() => fileInputRef.current?.click()}
        onOpenSettings={() => {
          setDraftConfig(config)
          setSettingsOpen(true)
        }}
        onTogglePanel={panel => setActivePanel(activePanel === panel ? null : panel)}
        onPrev={() => void readerRef.current?.prev?.()}
        onNext={() => void readerRef.current?.next?.()}
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
          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-slate-500">
            <span className="truncate">{status}</span>
            <span>{formatProgress(location)}</span>
          </div>
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
                enabled={Boolean(bookRef.current?.aiChat)}
                messages={chatMessages}
                input={chatInput}
                busy={chatBusy}
                setInput={setChatInput}
                onSend={() => void sendChatMessage()}
                onClear={() => setChatMessages([])}
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
        location={location}
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
  title: string
  busy: boolean
  sidebarOpen: boolean
  activePanel: Panel
  onToggleSidebar(): void
  onOpenFile(): void
  onOpenSettings(): void
  onTogglePanel(panel: Panel): void
  onPrev(): void
  onNext(): void
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white/92 px-3 backdrop-blur">
      <button className="icon-button" type="button" onClick={props.onToggleSidebar} title="Toggle sidebar">
        <PanelLeft className="h-4 w-4" />
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <BookOpen className="h-4 w-4 shrink-0 text-blue-600" />
        <h1 className="truncate text-sm font-semibold text-slate-900">{props.title}</h1>
      </div>
      <button className="toolbar-button" type="button" onClick={props.onOpenFile}>
        {props.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        Open
      </button>
      <button className="icon-button" type="button" onClick={props.onPrev} title="Previous">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button className="icon-button" type="button" onClick={props.onNext} title="Next">
        <ChevronRight className="h-4 w-4" />
      </button>
      <button className={panelButtonClass(props.activePanel === 'search')} type="button" onClick={() => props.onTogglePanel('search')}>
        <Search className="h-4 w-4" />
        Search
      </button>
      <button className={panelButtonClass(props.activePanel === 'chat')} type="button" onClick={() => props.onTogglePanel('chat')}>
        <MessageSquareText className="h-4 w-4" />
        Chat
      </button>
      <button className={panelButtonClass(props.activePanel === 'debug')} type="button" onClick={() => props.onTogglePanel('debug')}>
        <Bug className="h-4 w-4" />
        Debug
      </button>
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
          <button className="icon-button" type="button" onClick={props.onClose} title="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">{props.children}</div>
      </div>
    </aside>
  )
}

function SearchPanel(props: {
  query: string
  setQuery(value: string): void
  scope: 'chapter' | 'book'
  setScope(value: 'chapter' | 'book'): void
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
            <option value="chapter">This chapter</option>
            <option value="book">Whole book</option>
          </select>
          <button className="toolbar-button" type="button" onClick={props.onClear}>Clear</button>
        </div>
        <p className="text-xs text-slate-500">{props.status}</p>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
        {props.results.map((item, index) => (
          <button
            key={`${item.sectionIndex}-${item.match}-${index}`}
            type="button"
            className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left text-sm hover:border-blue-300 hover:bg-blue-50"
            onClick={() => props.onNavigate(item)}
          >
            <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
              <span>#{index + 1}</span>
              <span className="truncate">{item.chapterLabel || `Section ${item.sectionIndex + 1}`}</span>
            </div>
            <p className="line-clamp-4 text-slate-700">{item.excerpt}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

function ChatPanel(props: {
  enabled: boolean
  messages: ChatMessage[]
  input: string
  busy: boolean
  setInput(value: string): void
  onSend(): void
  onClear(): void
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-slate-200 p-3 text-xs text-slate-500">
        {props.enabled ? 'AI can search and read the current book.' : 'Enable AI Chat in Settings and apply configuration.'}
      </div>
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
            {message.role === 'assistant' && !message.pending ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]} className="markdown-body">
                {message.content}
              </ReactMarkdown>
            ) : (
              <p className="whitespace-pre-wrap">{message.content}</p>
            )}
          </div>
        )) : (
          <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
            Ask for a chapter summary, explain a passage, or search for a concept.
          </div>
        )}
      </div>
      <div className="space-y-2 border-t border-slate-200 p-3">
        <textarea
          className="input min-h-24 w-full resize-y"
          value={props.input}
          placeholder="Ask about this book. Shift+Enter for a new line."
          onChange={event => props.setInput(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              props.onSend()
            }
          }}
        />
        <div className="flex justify-between">
          <button className="toolbar-button" type="button" onClick={props.onClear}>Clear</button>
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50" type="button" disabled={props.busy} onClick={props.onSend}>
            {props.busy ? 'Thinking...' : 'Send'}
          </button>
        </div>
      </div>
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
        <SelectField label="Theme" value={config.theme} onChange={value => update('theme', value as DemoConfig['theme'])} options={[['light', 'Light'], ['dark', 'Dark'], ['sepia', 'Sepia']]} />
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
        <TextField label="Section chars" value={config.chatMaxSectionChars} type="number" onChange={value => update('chatMaxSectionChars', value)} />
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

function Footer({ location, ttsStatus, onPlayTTS, onStopTTS }: { location: any; ttsStatus: string; onPlayTTS(): void; onStopTTS(): void }) {
  return (
    <footer className="flex h-11 shrink-0 items-center gap-3 border-t border-slate-200 bg-white/92 px-4 text-xs text-slate-500">
      <div className="h-1.5 w-36 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.round((location?.totalFraction ?? 0) * 100)}%` }} />
      </div>
      <span className="w-12">{formatProgress(location)}</span>
      <div className="min-w-0 flex-1 truncate">{ttsStatus}</div>
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

function getReaderStyles(config: DemoConfig) {
  const theme = {
    light: { color: '#111827', background: '#ffffff' },
    dark: { color: '#e5e7eb', background: '#111827' },
    sepia: { color: '#4b382c', background: '#f8eedc' },
  }[config.theme]
  return {
    ...theme,
    fontSize: config.fontSize,
    hyphenate: config.hyphenate,
    lineHeight: 1.72,
    minColumnWidth: '320px',
    maxColumnWidth: '720px',
    margin: '36px',
  }
}

function getCurrentChatContext(reader: any, book: any) {
  const loc = reader?.getLocation?.()
  const sectionIndex = typeof loc?.index === 'number' ? loc.index : 0
  const section = book?.sections?.[sectionIndex]
  return {
    sectionIndex,
    sectionId: section?.id,
    sectionTitle: loc?.tocItem?.label,
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
  return Math.max(320, Math.min(760, Number.isFinite(number) ? number : 420))
}

function panelButtonClass(active: boolean) {
  return active
    ? 'toolbar-button bg-blue-50 text-blue-700 ring-1 ring-blue-200'
    : 'toolbar-button'
}

export default App
