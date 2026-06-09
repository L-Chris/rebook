# rebook

[English](./README.md) | [API 参考](./docs/API.md) | [架构设计](./docs/ARCHITECTURE.md) | [经验总结](./docs/EXPERIENCE.md)

rebook 是一个 TypeScript 电子书工具库，用来构建高性能阅读器和电子书处理流程，支持浏览器、微信小程序、Node.js 和 worker 类运行环境。

它把 EPUB、MOBI/AZW3、FB2、CBZ 解析成统一的 `Book` 契约。浏览器和微信小程序渲染器、导出、搜索、插件以及 AI 文档处理工作流都基于同一套契约。

## 主要特性

- **高性能翻页**：rebook 先把章节排成 Pretext line ranges，再只渲染当前可见行。普通翻页只更新 page index 和一小段 DOM/snapshot，不需要重排整章 DOM 或 iframe。
- **跨平台渲染**：浏览器端渲染轻量 DOM 行；微信小程序端输出可序列化 snapshot，适合 WXML 渲染。
- **多格式解析**：支持 EPUB 2/3、MOBI/AZW/AZW3、FictionBook 2、CBZ。
- **环境无关解析器**：通过 parser adapters，让同一套解析器运行在浏览器、Node.js、小程序和 worker 中。
- **模块化架构**：解析器、渲染器、导出器、插件、适配器相互独立。
- **AI 友好内容模型**：章节可暴露结构块、样式片段、可搜索文本和可修改文档树。
- **内置工作流能力**：搜索、前 N 个 section 导出、试读限制、TTS 播放钩子、专业翻译流水线、MCP server。

## 安装

```bash
npm install rebook
```

## 浏览器阅读器

```typescript
import { registry, createReader } from 'rebook'
import { epub } from 'rebook/parsers/epub'
import { mobi } from 'rebook/parsers/mobi'
import { fb2 } from 'rebook/parsers/fb2'
import { cbz } from 'rebook/parsers/cbz'

registry.register('epub', epub)
registry.register('mobi', mobi)
registry.register('fb2', fb2)
registry.register('cbz', cbz)

const reader = createReader({
    container: document.getElementById('viewer')!,
    layout: 'paginated',
    maxColumnCount: 2,
    styles: {
        fontSize: '18px',
        lineHeight: 1.7,
        minColumnWidth: '320px',
        maxColumnWidth: '720px',
        margin: '32px',
    },
})

const book = await reader.open(file)
await reader.next()
await reader.goTo('chapter.xhtml#section')
```

## 微信小程序阅读器

没有 DOM 的小程序环境使用平台 reader。它默认安装小程序 parser adapters，并可通过 `wx.createOffscreenCanvas` 做文本测量。

```typescript
import { registry } from 'rebook'
import { epub } from 'rebook/parsers/epub'
import { createWechatMiniProgramReader } from 'rebook/renderers/wechat-miniprogram'

registry.register('epub', epub)

const fs = wx.getFileSystemManager()
const arrayBuffer = fs.readFileSync(filePath) as ArrayBuffer
const unitlessStyles = new Set(['fontWeight', 'opacity', 'zIndex'])
const toStyleText = (style: Record<string, string | number> = {}) =>
    Object.entries(style)
        .map(([key, value]) => {
            const cssKey = key.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)
            const cssValue = typeof value === 'number' && !unitlessStyles.has(key)
                ? `${value}px`
                : String(value)
            return `${cssKey}:${cssValue}`
        })
        .join(';')

const reader = createWechatMiniProgramReader({
    width: 375,
    height: 667,
    wx,
    layout: 'paginated',
    styles: { fontSize: '18px', lineHeight: 1.7 },
    setData: snapshot => this.setData({
        reader: {
            ...snapshot,
            lines: snapshot.lines.map(line => ({
                ...line,
                styleText: toStyleText(line.style),
                fragments: 'fragments' in line
                    ? line.fragments.map(fragment => ({
                        ...fragment,
                        styleText: toStyleText(fragment.style),
                    }))
                    : undefined,
            })),
        },
    }),
})

await reader.open(arrayBuffer)
await reader.next()
```

在 WXML 中渲染 snapshot 里的 `reader.lines`。每个 line node 都包含布局 style 以及文本、图片或表格数据。传给 WXML 前需要把 style object 转成 CSS 字符串。更完整的接入方式见 [API 参考：微信小程序 Reader](./docs/API.md#wechat-mini-program-reader)。

## MCP Server

`rebook-mcp` 可以通过 Model Context Protocol 把本地书籍暴露给 AI 助手。支持 EPUB、MOBI/AZW3、FB2 和 CBZ。

```json
{
  "mcpServers": {
    "book": {
      "command": "npx",
      "args": ["-y", "--package", "rebook", "rebook-mcp", "/absolute/path/book.epub"]
    }
  }
}
```

内置工具包括章节列表、章节正文读取、元数据读取、整本书或单章节搜索。嵌入式 API 见 [MCP Tools](./docs/API.md#mcp-tools)。

## 支持格式

| 格式 | 扩展名 |
|------|--------|
| EPUB 2/3 | `.epub` |
| Mobipocket / Kindle | `.mobi`、`.azw`、`.azw3` |
| FictionBook 2 | `.fb2`、`.fbz`、`.fb2.zip` |
| Comic Book Zip | `.cbz` |

## 更多 API

- **试读限制**：`withTrialLimit({ maxPages })`、试读感知目录、受限导航。见 [Plugins](./docs/API.md#plugins)。
- **导出**：`exportFirstSections()` 和 `exportBook()` 支持 EPUB、CBZ、TXT、HTML 输出。见 [First Sections Export](./docs/API.md#first-sections-export)。
- **搜索**：`searchBook()`、`searchChapters()`、`reader.search()`、`reader.searchChapters()`。见 [Search](./docs/API.md#search)。
- **文档模型**：查询和修改章节文档树，用于 AI 工作流、标注、转换和序列化。见 [Document Model](./docs/API.md#document-model)。
- **Pretext 排版**：直接使用 `prepareBlocks()`、`layout()`、`getVisibleLines()` 构建自定义渲染器。见 [Pretext Layout](./docs/API.md#pretext-layout)。

## 文档

- [**API 参考**](./docs/API.md) - readers、parsers、renderers、plugins、exporters、adapters、search、MCP 和文档 API。
- [**架构设计**](./docs/ARCHITECTURE.md) - 解析器/渲染器分离、adapter 设计、渲染管线和项目结构。
- [**经验总结**](./docs/EXPERIENCE.md) - 设计取舍、性能说明、AI 工作流想法和实现经验。

## 开发

```bash
npm install
npm run dev
npm run typecheck
npm run build
npm test
```

## 许可证

MIT

## 致谢

基于 John Factotum 优秀的 [foliate-js](https://github.com/johnfactotum/foliate-js)。
