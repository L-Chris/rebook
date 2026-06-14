import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    dts({
      include: ['src/**/*.ts'],
      outDir: 'dist',
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'core/fixed-document': resolve(__dirname, 'src/core/fixed-document.ts'),
        'core/parser': resolve(__dirname, 'src/core/parser.ts'),
        'core/reader': resolve(__dirname, 'src/core/reader.ts'),
        'core/renderer-router': resolve(__dirname, 'src/core/renderer-router.ts'),
        'parsers/epub': resolve(__dirname, 'src/parsers/epub.ts'),
        'parsers/cbz': resolve(__dirname, 'src/parsers/cbz.ts'),
        'parsers/fb2': resolve(__dirname, 'src/parsers/fb2.ts'),
        'parsers/mobi': resolve(__dirname, 'src/parsers/mobi.ts'),
        'parsers/pdf': resolve(__dirname, 'src/parsers/pdf.ts'),
        'adapters/index': resolve(__dirname, 'src/adapters/index.ts'),
        'adapters/browser': resolve(__dirname, 'src/adapters/browser.ts'),
        'adapters/node': resolve(__dirname, 'src/adapters/node.ts'),
        'adapters/wechat-miniprogram': resolve(__dirname, 'src/adapters/wechat-miniprogram.ts'),
        'renderers/browser': resolve(__dirname, 'src/renderers/browser/index.ts'),
        'renderers/browser/fixed': resolve(__dirname, 'src/renderers/browser/fixed.ts'),
        'renderers/wechat-miniprogram': resolve(__dirname, 'src/renderers/wechat-miniprogram/index.ts'),
        'exporters/index': resolve(__dirname, 'src/exporters/index.ts'),
        'exporters/epub': resolve(__dirname, 'src/exporters/epub.ts'),
        'plugins/index': resolve(__dirname, 'src/plugins/index.ts'),
        'plugins/translation': resolve(__dirname, 'src/plugins/translation.ts'),
        'plugins/trial-limit': resolve(__dirname, 'src/plugins/trial-limit.ts'),
        search: resolve(__dirname, 'src/search.ts'),
        mcp: resolve(__dirname, 'src/mcp.ts'),
        'mcp-server': resolve(__dirname, 'src/mcp-server.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        /^node:/,
        '@modelcontextprotocol/sdk/server/mcp.js',
        '@modelcontextprotocol/sdk/server/stdio.js',
        'zod/v4',
      ],
    },
    target: 'es2018',
    minify: false,
  },
})
