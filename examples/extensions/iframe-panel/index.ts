import type { RebookExtension } from '../../../src/index'
import manifestJSON from './rebook-extension.json'

export default {
  manifest: manifestJSON as RebookExtension['manifest'],
  activate(context) {
    const title = document.createElement('h1')
    title.textContent = 'Hello from an isolated Rebook iframe'
    document.body.replaceChildren(title)
    context.runtime.register({
      showPanel(panelId: string) {
        title.dataset.panelId = panelId
      },
    })
  },
} satisfies RebookExtension
