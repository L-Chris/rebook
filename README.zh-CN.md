# ebook-js

[English](./README.md) | [API 参考](./docs/API.md) | [架构设计](./docs/ARCHITECTURE.md) | [经验总结](./docs/EXPERIENCE.md)

模块化、可扩展的 Web 电子书解析与渲染库。

灵感来自 [foliate-js](https://github.com/johnfactotum/foliate-js)，但对其架构进行了重构——**解析器**（文件格式处理）与**渲染器**（平台相关展示）完全解耦。

## 特性

- **模块化架构**：解析器与渲染器相互独立，可自由组合
- **TypeScript**：完整的类型安全，提供全面的接口定义
- **多格式支持**：EPUB 2.x/3.x、MOBI/AZW/AZW3、FictionBook 2、CBZ
- **AI 友好的文档模型**：受 SlateJS 启发的树形结构，提供查询和修改 API，支持内容操作（翻译、标注、重构）
- **环境无关的解析器**：所有解析器通过适配器注入，可在浏览器、Node.js 或 Worker 中运行
- **浏览器渲染器**：支持分页和滚动两种阅读模式，宽屏自动切换双页布局
- **畸形 EPUB 容错**：多层回退策略处理损坏的 zip 归档
- **框架无关**：核心库兼容任意框架；React/Vue 封装计划中

## 安装

```bash
npm install ebook-js
```

## 支持格式

| 格式 | 扩展名 | 解析器 | 说明 |
|------|--------|--------|------|
| EPUB 2/3 | `.epub` | `EPUBParser` | 完整支持：导航、书脊、字体解密、landmarks |
| Mobipocket / Kindle | `.mobi`、`.azw`、`.azw3` | `MOBIParser` | MOBI6 + KF8、PalmDOC + HUFF/CDIC、EXTH 元数据、NCX |
| FictionBook 2 | `.fb2`、`.fbz`、`.fb2.zip` | `FB2Parser` | FB2 XML 转 XHTML、FBZ 归档支持 |
| Comic Book Zip | `.cbz` | `CBZParser` | 从 zip 归档中读取顺序图片 |

## 快速开始

```typescript
import { registry, createReader, UnsupportedFormatError } from 'ebook-js'
import { epub } from 'ebook-js/parsers/epub'
import { mobi } from 'ebook-js/parsers/mobi'
import { fb2 } from 'ebook-js/parsers/fb2'
import { cbz } from 'ebook-js/parsers/cbz'

// 注册解析器（支持自动检测格式）
registry.register('epub', epub)
registry.register('mobi', mobi)
registry.register('fb2', fb2)
registry.register('cbz', cbz)

// 创建阅读器（启用自动双页布局）
const reader = createReader({
    container: document.getElementById('viewer')!,
    layout: 'paginated',
    maxColumnCount: 2, // 宽屏时显示两页并排（默认值：2）
    styles: {
        fontSize: '16px',
        maxInlineSize: '720px', // 每页最大宽度
        gap: '48px', // 页间距
    },
})

// 打开书籍并导航
const book = await reader.open(file)
await reader.next()
await reader.goTo('/path/to/chapter.xhtml#section')

// 运行时控制布局
reader.setSpread(2) // 启用自动双页（宽屏显示两页）
reader.setSpread(1) // 强制单页
```

### 自动双页布局

在分页模式下，当容器足够宽时，渲染器会自动并排显示两页：

- **容器宽度 ≥ 2 × `maxInlineSize` + `gap`**：显示 2 页（双页）
- **容器宽度 < 2 × `maxInlineSize` + `gap`**：显示 1 页（单页）
- **窗口缩放**：自动在双页和单页之间切换

`maxColumnCount` 配置选项（默认值：`2`）控制最多显示的页数。设为 `1` 始终使用单页布局。

## 文档模型（AI 友好）

每个章节暴露一个结构化的文档树，提供查询和修改 API：

```typescript
const section = book.sections[0]
const doc = await section.getDocument()

// CSS 风格的选择器查询
const paragraphs = doc.query('p')
const images = doc.getImages()
const text = doc.getText()

// 不可变修改（返回新文档）
const newDoc = doc
    .setNode([0], { class: 'highlight' })
    .insertNode([1], elementNode('p', {}, [textNode('AI 添加的内容')]))
    .replaceText([0, 0], '翻译后的文本')

// 序列化回 HTML
const html = newDoc.serialize()
```

支持 AI 驱动的工作流：翻译、内容摘要、标注、无障碍增强、布局适配等。详见 [API 参考](./docs/API.md#document-model)。

## 文档

- [**API 参考**](./docs/API.md) — 完整 API 文档：解析器、渲染器、适配器、文档模型、错误类型、元数据标准化
- [**架构设计**](./docs/ARCHITECTURE.md) — 设计决策、解析器/渲染器分离、适配器系统、跨平台渲染
- [**经验总结**](./docs/EXPERIENCE.md) — AI 友好设计理念、SlateJS 模式借鉴、畸形 EPUB 处理、性能注意事项

## 开发

```bash
npm install       # 安装依赖
npm run dev       # 运行示例
npm run typecheck # 类型检查
npm run build     # 构建
npm test          # 运行测试
```

## 与 foliate-js 的对比

| 特性 | foliate-js | ebook-js |
|------|-----------|----------|
| 语言 | JavaScript | TypeScript |
| 架构 | 单体 view.js | 解析器/渲染器分离 |
| 浏览器耦合 | 解析器使用 DOM API | 解析器环境无关（适配器） |
| 文档模型 | 无 | SlateJS 启发的树形结构，支持修改 |
| 格式支持 | EPUB、MOBI、FB2、CBZ、PDF | EPUB、MOBI/AZW3、FB2、CBZ |
| 测试 | 无 | Vitest（208 个测试） |
| 畸形 EPUB 容错 | 无（仅 zip.js） | CD 校正 + 逐条目 LFH 扫描 |

## 许可证

MIT

## 致谢

基于 John Factotum 优秀的 [foliate-js](https://github.com/johnfactotum/foliate-js)。
