# Worker and iframe sandbox

Sandbox protocol v1 is shared by the browser host, Worker guests, and iframe
guests. Messages are structured-clone RPC envelopes containing `protocol`, a
per-activation `channel`, request ids, methods, results, and sanitized errors.

## Worker runtime

Worker extensions run inside a Worker created by an opaque-origin sandboxed
iframe. This prevents access to the application origin's DOM, cookies,
IndexedDB, Cache Storage, credentials, and parent window. The sandbox document
also uses a restrictive CSP and removes direct network APIs before importing
the integrity-checked single-file bundle.

Host API v1 exposes manifest-declared commands and settings only. Worker
packages therefore declare no permissions. Book contents and reader handles are
not serialized into the guest.

## iframe runtime

iframe extensions run in `<iframe sandbox="allow-scripts">` without
`allow-same-origin`, navigation, forms, popups, or downloads. CSP disables
network, nested frames, objects, fonts, and media. The extension may render only
inside its isolated document.

Host API v1 requires `ui.panel`, at least one `contributes.panels` entry, and no
other iframe permission. A registered runtime may implement
`showPanel(panelId)` when one iframe serves multiple declared panels.

## Execution policy

- `trusted` executes only after manual approval and SHA-256 verification.
- `worker` and `iframe` may be discovered while unverified, but still require
  an official immutable artifact URL, exact size, and SHA-256 match.
- A module cannot replace the catalog Manifest, id, version, permissions, or
  contribution declarations at runtime.
- Revoked and rejected artifacts are no longer served.

The sandbox is a capability boundary, not an antivirus claim. Package limits,
static warnings, CSP, opaque origins, declarative contributions, timeouts, and
revocation are layered rather than relying on one control.
