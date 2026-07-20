import type { RebookExtension } from '../../../src/index'
import manifestJSON from './rebook-extension.json'

export default {
  manifest: manifestJSON as RebookExtension['manifest'],
  activate(context) {
    context.commands.registerCommand(`${context.extensionId}.count`, () =>
      context.settings.get('sample', '').length,
    )
  },
} satisfies RebookExtension
