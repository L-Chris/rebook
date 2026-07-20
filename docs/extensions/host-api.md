# Host API and lifecycle

An extension exports a `RebookExtension` object or a factory returning one. The host validates its manifest before activation.

```typescript
export interface RebookExtension {
  readonly manifest: RebookExtensionManifest
  readonly plugin?: RebookPlugin
  readonly plugins?: readonly RebookPlugin[]
  activate?(context: RebookExtensionContext):
    | void
    | RebookPlugin
    | readonly RebookPlugin[]
    | Promise<void | RebookPlugin | readonly RebookPlugin[]>
}
```

## Activation context

- `apiVersion`: frozen host API version, currently `1`.
- `extensionId` and `manifest`: identity validated by the host.
- `commands`: register and execute commands.
- `settings`: inspect and update extension-scoped values.
- `runtime`: expose one host-queryable runtime object.
- `subscriptions`: disposables released on deactivation.

Always register cleanup:

```typescript
activate(context) {
  const unsubscribe = subscribeToSomething()
  context.subscriptions.push({ dispose: unsubscribe })
}
```

Activation must not access undeclared privileges. Trusted code still follows the declared permission contract; marketplace review treats undeclared access as a policy violation.

## Module exports

The ESM entry may export one of:

- `default`
- `extension`
- `rebookExtension`
- `manifest` plus `activate`, `plugin`, or `plugins`

The runtime manifest id and exact version must match the catalog. The reviewed
catalog Manifest remains authoritative, so module exports cannot widen
permissions or replace contributions after review.

## Sandbox subset

Worker Host API v1 exposes declared commands and settings. iframe Host API v1
adds isolated panel rendering through `ui.panel`. Neither sandbox receives raw
book objects, reader instances, application storage, cookies, or credentials.
See [Worker and iframe sandbox](./sandbox.md).
