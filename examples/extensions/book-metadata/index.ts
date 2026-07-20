import type { RebookExtension } from '../../../src/index'
import manifestJSON from './rebook-extension.json'

export default {
  manifest: manifestJSON as RebookExtension['manifest'],
  plugin: book => ({
    ...book,
    metadata: {
      ...book.metadata,
      subtitle: book.metadata?.subtitle ?? 'Enhanced by a Rebook extension',
    },
  }),
} satisfies RebookExtension
