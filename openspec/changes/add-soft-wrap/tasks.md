## 1. Wrapping and one line height

- [x] 1.1 A new internal layout theme in `src/editor/` adds `EditorView.lineWrapping` and an `EditorView.theme`. The theme declares `--editor-font-size: 16px` and `--editor-line-height: 1.6` on the editor root, and sets `.cm-scroller`'s `font-size` to `var(--editor-font-size)` and its `line-height` to `var(--editor-line-height)`. `src/editor/index.ts` adds it to the editor's extensions.
- [x] 1.2 The layout theme is the only Quiro theme spec that sets `font-size` or `line-height`, and it doesn't set `font-family`.
- [x] 1.3 A jsdom test checks that an editor made with `createEditor` has `cm-lineWrapping` on its content element.
- [x] 1.4 A jsdom test reads the Markdown theme spec exported by `add-markdown-mode` and the layout theme. It checks, in camelCase and kebab-case, that no rule targeting an `md-*` class sets `font-size`, `line-height`, `vertical-align`, `padding`, `margin`, `border`, or any `-top`, `-bottom`, `-block`, `-block-start` or `-block-end` form of padding, margin or border.
- [x] 1.5 A jsdom test checks that the layout theme's `font-size` and `line-height` values are `var(--editor-font-size)` and `var(--editor-line-height)`, and that no other Quiro theme spec sets either property.
- [x] 1.6 `src/editor/fixtures/dialect.md`, `src/editor/fixtures/dialect.tree.txt` and every test file from earlier changes are unchanged, and `npm run lint`, `npm test` and `npm run build` pass in the gate.

## 2. The layout check

- [x] 2.1 `src/editor/index.ts` exports `checkLayout(): Promise<LayoutViolation[]>` and the `LayoutViolation` type: `{ rule: "line-height" | "jitter" | "inline-box" | "overflow"; line: number; detail: string }`. Neither mentions a CodeMirror or Lezer type.
- [x] 2.2 `checkLayout` builds an editor with the same extensions as `createEditor`, in a container appended to `document.body`. The container is `position: fixed` at the top left, 480 px wide and 600 px tall, with `visibility: hidden` and `pointer-events: none`.
- [x] 2.3 The layout fixture is `src/editor/fixtures/dialect.md`, imported with `?raw`, followed in code by a line of emoji and CJK text and a line holding one 2,000-character token with no spaces.
- [x] 2.4 `checkLayout` scrolls the hidden editor's scroller through the whole document in viewport-sized steps, waiting for CodeMirror to draw at each step. At each step it reports:
  - a `line-height` violation for any drawn `.cm-line` whose height isn't an integer multiple of `view.defaultLineHeight`, within 0.5 px;
  - an `inline-box` violation for any element inside a line with a client rect outside the line's box, or taller than `view.defaultLineHeight` plus 0.5 px.
- [x] 2.5 `checkLayout` reports an `overflow` violation when the scroller's `scrollWidth` exceeds its `clientWidth`.
- [x] 2.6 `checkLayout` reports a `jitter` violation when inserting `# ` at the start of a plain line, inserting `**x**` inside another line, or moving the cursor across lines changes the height of any drawn line.
- [x] 2.7 `checkLayout` destroys the hidden editor and removes its container in a `finally` block, and never reads or changes any other editor.
- [x] 2.8 A new `src/editor/*.browser.test.ts` checks that `checkLayout()` resolves to `[]`. With a temporary global `<style>` setting `.md-heading-1 { font-size: 2em !important }`, it checks that `checkLayout()` reports at least one `line-height` violation, then removes the style.
- [x] 2.9 In `vitest.config.ts`, the browser project, and only that project, sets `optimizeDeps.include` to `@codemirror/commands`, `@codemirror/lang-markdown`, `@codemirror/lang-yaml`, `@codemirror/language`, `@codemirror/state`, `@codemirror/view`, `@lezer/highlight` and `@lezer/markdown`. The rest of the file is unchanged.
- [x] 2.10 Earlier test files and the fixture files are unchanged, and `npm run lint`, `npm test` (both projects) and `npm run build` pass in the gate.

## 3. Dev tools and the production bundle

- [x] 3.1 `src/dev-tools.ts`, outside `src/editor/`, exports `installDevTools(): void`, which sets `window.quiroDev = { checkLayout }`, and declares `Window.quiroDev` with `declare global`.
- [x] 3.2 `src/main.ts` imports `./dev-tools` only through a dynamic `import()` inside `if (import.meta.env.DEV)`, and calls `installDevTools()` from it. No other file imports `./dev-tools`.
- [x] 3.3 A new test file under `src/`, with `// @vitest-environment node`, calls Vite's `build()` with `build: { write: false }` and `logLevel: "silent"`. It asserts that no output chunk's `code` and no output asset's `source` contains `quiroDev`, and it imports no `node:` module.
- [x] 3.4 The README's setup section shows `PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium-headless-shell` after `npm ci`, and notes that it must be rerun after `npm ci`. Every check command listed before is still listed.
- [x] 3.5 `package.json`, `package-lock.json`, `vitest.config.ts`, `.github/workflows/ci.yml` and `.harness/config.json` are unchanged by this section, earlier test files are unchanged, and `npm run lint`, `npm test` and `npm run build` pass in the gate.
