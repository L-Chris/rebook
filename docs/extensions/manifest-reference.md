# Manifest v1 reference

Every distributable extension must contain `rebook-extension.json`.

```json
{
  "manifestVersion": 1,
  "id": "com.example.reader-tools",
  "name": "reader-tools",
  "displayName": "Reader Tools",
  "version": "1.0.0",
  "publisher": "example",
  "description": "Small reading utilities.",
  "license": "MIT",
  "entry": "dist/index.js",
  "engines": {
    "rebook": "^0.8.0",
    "hostApi": "1"
  },
  "runtime": { "kind": "trusted" },
  "capabilities": ["reader.access"],
  "permissions": ["reader.read"],
  "contributes": {
    "commands": [
      { "id": "com.example.reader-tools.showProgress", "title": "Show progress" }
    ]
  }
}
```

## Required fields

| Field | Requirement |
| --- | --- |
| `manifestVersion` | Must be `1`. |
| `id` | Stable reverse-domain identifier matching `[a-z0-9._-]+`. |
| `name` | Non-empty package name. |
| `version` | Exact SemVer version. Published versions are immutable. |
| `entry` | ESM entry inside the uploaded package. Required for marketplace packages. |
| `engines.rebook` | Rebook package compatibility range. |
| `engines.hostApi` | Host API major version, currently `1`. |

The ids used by Rebook's built-in extensions are reserved and cannot be claimed
by marketplace uploads.

## Capabilities and permissions

Capabilities describe what an extension provides. Permissions describe what it may access. Declaring a capability never grants a permission.

Current permissions:

- `book.read`, `book.write`
- `reader.read`, `reader.navigate`
- `storage`, `network`
- `clipboard.read`, `clipboard.write`
- `audio.playback`, `ui.panel`

When `network` is requested, `allowedHosts` must list permitted hosts. `"*"` is reserved for reviewed built-ins.

## Runtime

- `trusted`: reviewed ESM running in the host page.
- `worker`: sandboxed computation through the Worker bridge.
- `iframe`: sandboxed UI through the iframe bridge.

The marketplace may force a stricter runtime than the extension requests.

## Contributions

Manifest v1 supports `commands`, `panels`, `settings`, and `tools`. See [Contributions](./contributions.md).
