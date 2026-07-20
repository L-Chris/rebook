import type { RebookExtension } from 'rebook'
import manifestJSON from '../rebook-extension.json'

const manifest = manifestJSON as RebookExtension['manifest']

const extension: RebookExtension = {
  manifest,
  activate(context) {
    context.commands.registerCommand(`${context.extensionId}.sayHello`, () =>
      context.settings.get('greeting', 'Hello from Rebook'),
    )
  },
}

export default extension
