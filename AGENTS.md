# Agent Notes

## Project Commands

- Install dependencies with `npm install` if `node_modules/` is missing.
- Type-check with `npm run typecheck`.
- Run focused tests with `npx vitest run <test-file>`.
- Run the full test suite with `npm test -- --run`, but prefer focused tests while iterating.
- Start the demo reader with `npm run dev -- --host 127.0.0.1 --port 3131`. If that port is busy, choose another explicit port and keep the URL stable in notes.

## Node And Vitest Workflow

- This package is ESM (`"type": "module"`). For one-off Node probes, use `node --input-type=module -e "..."` or a temporary `.mjs` script pattern; do not expect CommonJS `require` to work.
- Prefer project scripts and Vitest over ad-hoc Node imports of `.ts` files. The test environment is configured in `vitest.config.ts` as `environment: 'node'`, and tests should import source files the same way existing tests do.
- When using the Codex Node REPL for plugin/browser control, remember bindings persist between calls. Use `var` for reusable top-level handles, or pick fresh names; repeated `const` declarations often cause avoidable failures.
- Keep Node probes small and deterministic. If a probe needs project source behavior, turn it into a focused Vitest test rather than growing a long REPL snippet.
- Some broad checks can depend on local sample files or environment configuration. If `npm test -- --run` fails on unrelated missing `data/*` assets or optional service config, record that separately and still run the focused tests for the files you changed.

## Browser Debug Workflow

- Use the demo URL form `http://127.0.0.1:3131/?book=%2F%40fs%2FF%3A%2Fprojects%2Febook%2Frebook%2Fdata%2FThinking%20in%20Systems%20A%20Primer.epub` when reproducing the Thinking in Systems EPUB issue locally.
- The reader exposes debug helpers on `window.rebookDebug` and the compatible alias `window.__rebookDebug`.
- Useful calls:

```js
await window.rebookDebug.go(11)
await window.rebookDebug.block('image-116')
window.rebookDebug.figures().issues
await window.rebookDebug.scan({ pages: 20, stopOnIssue: true })
window.rebookDebug.sections()
window.rebookDebug.help()
```

- `go(11)` jumps to `One: The Basics` for `Thinking in Systems A Primer.epub`.
- `block('image-116')` jumps to the Figure 10 image area that previously reproduced the image/caption pagination bug.
- `figures()` returns the current visual figure/caption snapshot; check `issues` first for a quick pass/fail signal.

## Chrome Session Testing

- Use the Chrome plugin when the user mentions `@chrome` or the task depends on the user's Chrome session.
- Chrome/Playwright `tab.playwright.evaluate(...)` runs in a read-only page scope. It can read DOM state, but it may not see page globals such as `window.rebookDebug`, and it should not be used for mutating DOM state.
- For direct calls into the page's main JavaScript world, use the tab `cdp` capability and `Runtime.evaluate`.

```js
var cdp = await tab.capabilities.get('cdp')
await cdp.send('Runtime.evaluate', {
  expression: `(async () => {
    await window.rebookDebug.go(11)
    const snapshot = await window.rebookDebug.block('image-116')
    return {
      location: snapshot.location,
      pageIndex: snapshot.pageIndex,
      issues: snapshot.issues.map(pair => ({
        issue: pair.issue,
        image: pair.image.blockId,
        caption: pair.caption && pair.caption.blockId,
      })),
    }
  })()`,
  awaitPromise: true,
  returnByValue: true,
})
```

- After browser testing, call `browser.tabs.finalize({ keep: [] })` unless the user needs the tab left open.
- If code changes affect the demo while the dev server is running, reload the tab before verifying the debug API again.

## Figure Pagination Regression Checks

- For the Thinking in Systems issue, a healthy result around `image-116` has `issues: []`.
- Always verify at least one targeted unit test for pagination changes, for example:

```powershell
npx vitest run tests/core/reflowable-page-model.test.ts tests/core/pretext.test.ts
```

- Pair the browser check with `npm run typecheck` before reporting the fix.
