# Rebook extension template

Rename the package, change the reverse-domain id in `rebook-extension.json`, and keep command ids prefixed with that id.

The template starts in the permissionless `worker` runtime. Keep that default
for commands and settings; request `trusted` only when a reviewed book-transform
API genuinely requires it, or `iframe` for isolated panel UI.

```bash
npm install
npm run typecheck
npm run build
npm run pack:extension
```

`npm run pack:extension` writes the upload-ready immutable ZIP to `package/`.

Submit the manifest, `dist/index.js`, README, changelog, license, and assets as one ZIP package. See [`docs/extensions`](../../docs/extensions/README.md).
