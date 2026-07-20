# Rebook extensions

Rebook extensions are installable packages with a versioned manifest, an activation lifecycle, and optional book transforms. They build on top of the low-level `RebookPlugin` middleware without conflating package distribution with a single function.

## Terminology

- **Plugin**: `(book: Book) => Book | Promise<Book>`. This is the lowest-level book transformation primitive.
- **Extension**: a distributable package containing a Manifest v1 and an exported `RebookExtension`.
- **Contribution**: declarative commands, panels, settings, or tools advertised by a manifest.
- **Capability**: a feature the extension provides, used for discovery and filtering.
- **Permission**: host data or platform access requested by the extension.
- **Trusted extension**: reviewed code allowed to execute in the host page.
- **Sandbox extension**: third-party code constrained to a Worker or sandboxed iframe.

## Start here

1. Copy [`templates/rebook-extension`](../../templates/rebook-extension).
2. Choose an immutable reverse-domain extension id.
3. Prefer the permissionless Worker runtime; declare only privileges the chosen runtime supports.
4. Export one ESM extension module from `src/index.ts`.
5. Build, test, and package the artifact described in [Packaging](./packaging.md).

```typescript
import type { RebookExtension } from 'rebook'
import manifest from '../rebook-extension.json'

const extension: RebookExtension = {
  manifest: manifest as RebookExtension['manifest'],
  activate(context) {
    context.commands.registerCommand('com.example.hello.sayHello', () => 'Hello')
  },
}

export default extension
```

## Contract versions

- Manifest schema: `manifestVersion: 1`
- Activation API: `context.apiVersion === 1`
- Catalog schema: `schemaVersion: 1`

Breaking changes require a new version. Existing versioned contracts are never silently reinterpreted.

## Reference

- [Manifest reference](./manifest-reference.md)
- [Host API and lifecycle](./host-api.md)
- [Contributions](./contributions.md)
- [Packaging](./packaging.md)
- [Security and permissions](./security.md)
- [Worker and iframe sandbox](./sandbox.md)
- [Publishing](./publishing.md)
- [Compatibility policy](./compatibility.md)

Official examples live in [`examples/extensions`](../../examples/extensions).
