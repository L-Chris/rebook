# Packaging

Marketplace artifacts are immutable, single-file ESM bundles accompanied by source metadata.

```text
com.example.reader-tools-1.0.0.zip
├── rebook-extension.json
├── dist/index.js
├── README.md
├── CHANGELOG.md
├── LICENSE
└── assets/icon.png
```

## Rules

- Paths must be relative and must not contain `..`, absolute paths, or executable native files. Archive entries are handled as bytes and links are never followed.
- The manifest entry must resolve inside the package.
- A published `(id, version)` can never be overwritten.
- The server calculates artifact size and `sha256-<base64>` integrity; publishers cannot choose these values.
- Production artifacts must be ESM and must not depend on unresolved bare imports.
- Source maps are optional but recommended for reviewed extensions.

The official template uses Vite library mode to produce `dist/index.js`.

## Local validation

Before submission:

```bash
npm install
npm run typecheck
npm run build
npm run pack:extension
```

The marketplace validator checks the same manifest, archive, entry, version, and permission invariants used by the host.
