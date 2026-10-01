## Context

After `add-markdown-mode`, the editor parses the dialect and styles each construct through a Markdown theme spec exported inside `src/editor/`. All editor styling is in `EditorView.theme` specs. CodeMirror's base theme still sets `.cm-scroller` to `font-family: monospace` and `line-height: 1.4`, and lines don't wrap. `npm test` runs one Vitest project, jsdom, which can't measure layout. `src/editor/fixtures/dialect.md` holds every construct of the dialect and is frozen.

Sources:
- [What does stable line height mean under soft wrap?](https://github.com/Acero-AD/quiro/issues/15): what "constant line height" means, the forbidden properties, and wrapping;
- [How are WebKitGTK-only behaviours verified when the gate cannot run WebKitGTK?](https://github.com/Acero-AD/quiro/issues/20): one layout-check function, Chromium in the gate and CI, `window.quiroDev.checkLayout()` on WebKitGTK, and the revised G-104 criterion;
- [How does the work split into OpenSpec changes and tasks.md sections?](https://github.com/Acero-AD/quiro/issues/19): this change owns `window.quiroDev` and the production-bundle test, and it closes two open questions from #20, on where Chromium lives and what `checkLayout()` measures;
- research:
  - [What does CodeMirror 6 give Phase 1 out of the box for editing, undo and line layout?](https://github.com/Acero-AD/quiro/issues/6), `docs/research/cm6-editing-undo-layout.md` F5;
  - [Which frontend test and lint tools can run inside the harness gate sandbox?](https://github.com/Acero-AD/quiro/issues/2), `docs/research/frontend-tooling-in-gate-sandbox.md` on branch `research/frontend-tooling-in-gate-sandbox`.

The terms **line** and **visual line** are defined in `CONTEXT.md`.

## Goals / Non-Goals

**Goals:**

- G-104: wrapping with no horizontal scrollbar, one line height set once, and highlight styles that can't change line geometry.
- One layout-check function that runs the same way in the gate (Chromium), in CI (Chromium on Linux and Windows) and on WebKitGTK (dev builds).
- `window.quiroDev` as dev-only tooling, proven absent from the production bundle.

**Non-Goals:**

- Choosing the editor's font. CodeMirror's default stays until the themes (G-401) choose fonts.
- Heading sizes (G-302) and any pixel-exact match between WebKitGTK and WebView2.
- A Chromium typing benchmark, which [#20](https://github.com/Acero-AD/quiro/issues/20) rejected.
- `loadLargeFixture()` and `typingStats()`, which `add-large-document-checks` adds.

## Operator prerequisites

Harness applies these on the host before the run, after a plan review and a diff review, then commits the prep commit and recaptures the baseline. The versions are the ones the research ran in the gate sandbox: Playwright 1.63.0 and `@vitest/browser-playwright` 5.0.2. The latter requires `vitest` at exactly 5.0.2, which is the locked version.

Install the packages, then download Playwright's Chromium headless shell into `node_modules/playwright-core/.local-browsers/`. `PLAYWRIGHT_BROWSERS_PATH=0` puts it there. The gate copies `node_modules` but hides `~/.cache`, and prerequisites can't declare sandbox paths.

```harness-run
npm install -D -E playwright@1.63.0 @vitest/browser-playwright@5.0.2
PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium-headless-shell
```

Split the tests into a jsdom project and a browser-mode project, both run by `npm test`:

```harness-file vitest.config.ts
// @ts-expect-error type error without @types/node package
import process from "node:process";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// Playwright's Chromium is installed inside node_modules. The harness gate
// clears the environment, so the browsers path is set here; Playwright reads
// it when the browser project starts.
process.env.PLAYWRIGHT_BROWSERS_PATH ??= "0";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.browser.test.ts"],
        },
      },
      {
        test: {
          name: "browser",
          include: ["src/**/*.browser.test.ts"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
```

Install the same Chromium in CI, on both runners. The workflow is otherwise unchanged:

```harness-file .github/workflows/ci.yml
name: CI

on:
  push:
  workflow_dispatch:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  check-and-build:
    name: ${{ matrix.os }}
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        include:
          - os: ubuntu-24.04
            executable: src-tauri/target/release/quiro
          - os: windows-2025
            executable: src-tauri/target/release/quiro.exe
    steps:
      - uses: actions/checkout@v7

      - name: Install Linux system packages
        if: runner.os == 'Linux'
        run: sudo apt-get update && sudo apt-get install -y libwebkit2gtk-4.1-dev librsvg2-dev libxdo-dev

      - uses: actions/setup-node@v7
        with:
          node-version: 26
          cache: npm

      - uses: Swatinem/rust-cache@6323deb102c322ba6fcbdcafc7e3dddab59af2b6 # v2.9.2
        with:
          workspaces: './src-tauri -> target'
          save-if: ${{ github.ref == 'refs/heads/master' }}

      - run: npm ci

      - name: Install Playwright's Chromium (Linux)
        if: runner.os == 'Linux'
        run: npx playwright install --with-deps chromium-headless-shell
        env:
          PLAYWRIGHT_BROWSERS_PATH: "0"

      - name: Install Playwright's Chromium (Windows)
        if: runner.os == 'Windows'
        run: npx playwright install chromium-headless-shell
        env:
          PLAYWRIGHT_BROWSERS_PATH: "0"

      - run: npm run lint
      - run: npm test
      - run: npm run build

      - run: cargo fmt --check
        working-directory: src-tauri
      - run: cargo clippy --all-targets -- -D warnings
        working-directory: src-tauri
      - run: cargo test
        working-directory: src-tauri

      - run: npm run tauri build -- --no-bundle

      - uses: actions/upload-artifact@v7
        with:
          path: ${{ matrix.executable }}
          archive: false
          retention-days: 30
          if-no-files-found: error
```

Check that every frontend check still passes before anything is committed. No browser test exists yet, so `npm test` passes with the empty browser project:

```harness-run
npm run lint
npm test
npm run build
```

In the diff review, expect:
- `package.json` (two new `devDependencies`) and `package-lock.json`;
- `vitest.config.ts`, replaced;
- `.github/workflows/ci.yml`, with only the two Playwright steps added.

The gate commands don't change. If `ci.yml` changed on `master` after this change was proposed, update the `harness-file` block before the run, because the block replaces the whole file.

## Decisions

### Chromium inside `node_modules`

This closes an open question from [#20](https://github.com/Acero-AD/quiro/issues/20). With `PLAYWRIGHT_BROWSERS_PATH=0`, Playwright installs browsers under `node_modules/playwright-core/.local-browsers/` and looks for them there.
- **Why not `~/.cache/ms-playwright`:** the gate's home directory is an empty tmpfs, so the default path fails with "Executable doesn't exist" (research #2).
- **Why not a declared sandbox path:** that would need `harness setup` and a manual re-baseline, outside the prerequisites.
- **Cost:** the gate copies `node_modules` on every run, and copying the 261 MB headless shell took about 0.12 s.
- **Setting the variable:** the gate clears the environment, so `vitest.config.ts` sets it with `??=` before any browser starts. `@vitest/browser-playwright` 5.0.2 loads `playwright` lazily, with `await import('playwright')` when it opens the browser. The variable is therefore in place before Playwright resolves its browsers directory. The same line makes local runs and CI work without extra environment.
- **Which Chromium:** Playwright's pinned build, not Arch's `/usr/bin/chromium`. The engine version then moves only with the lockfile, and the gate and CI run the same build.

### The layout rule: one theme spec, two custom properties

A new internal layout theme in `src/editor/` adds `EditorView.lineWrapping` and one rule:

```ts
".cm-scroller": {
  fontSize: "var(--editor-font-size)",
  lineHeight: "var(--editor-line-height)",
}
```

The defaults `--editor-font-size: 16px` and `--editor-line-height: 1.6` are declared on the editor root (`&`). This is an `EditorView.theme`, because CodeMirror's base theme sets `line-height: 1.4` on `.cm-scroller` under a generated class, and plain global CSS loses to it (F5).

An explicit line height stops bold, monospace, emoji and CJK fallbacks from growing a line. Only a larger `font-size` or `vertical-align` still grows it (F5), and those are forbidden in highlight styles. The ratio 1.6 is the value [#15](https://github.com/Acero-AD/quiro/issues/15) suggested. The font family is left alone.

### Checking the styles under jsdom

A jsdom test reads the Markdown theme spec that `add-markdown-mode` exports inside `src/editor/`, plus this change's layout theme. It checks that no rule targeting an `md-*` class sets:
- `font-size`, `line-height` or `vertical-align`;
- the `padding`, `margin` or `border` shorthands;
- or any `-top`, `-bottom`, `-block` or `-block-start`/`-block-end` form of them.

Property names are compared in both camelCase and kebab-case. Another test checks that the layout theme is the only Quiro theme setting `font-size` or `line-height`, and that its values are the two `var(--editor-…)` references.

### `checkLayout()`: its own hidden editor, scrolled through

This closes the other open question from #20. `checkLayout(): Promise<LayoutViolation[]>` is exported from `src/editor/index.ts`, with `LayoutViolation` a plain object: `{ rule: "line-height" | "jitter" | "inline-box" | "overflow"; line: number; detail: string }`.

1. **It builds a hidden editor** with the same extensions as `createEditor`, in a container appended to `document.body`. The container is `position: fixed` at the top left, 480 px wide (the minimum window width) and 600 px tall, with `visibility: hidden` and `pointer-events: none`.
   - It stays inside the window, because CodeMirror decides what to draw from the part of its scroller that's visible in the window. Off-screen positioning would stop it drawing.
   - `visibility: hidden` keeps the layout but shows nothing.
2. **It loads the layout fixture:** `dialect.md`, imported with `?raw`, then a line mixing emoji and CJK text, then a line holding one 2,000-character token with no spaces. Both extra lines are added in code, because the dialect fixture is frozen.
3. **It scrolls the hidden editor's scroller through the document** in viewport-sized steps. At each step it waits for CodeMirror to draw and measure, for example two animation frames, then checks every drawn `.cm-line`, using `view.defaultLineHeight` as the visual-line height H:
   - **line-height:** the line's height is an integer multiple of H, within 0.5 px. Research saw sub-pixel rounding differ between engines (F5), so heights are compared with H rather than with pixel constants;
   - **inline-box:** every client rect of every element inside the line lies within the line's box and is no taller than H, within 0.5 px.
4. **overflow:** the scroller's `scrollWidth` is at most its `clientWidth`.
5. **jitter:** it records every drawn line's height, inserts `# ` at the start of a plain line and `**x**` inside another, moves the cursor across several lines, then measures again after a frame. Any height that changed is a violation.
6. **It destroys the hidden editor and removes the container,** even when a check throws. The window's own editor is never touched.

A browser test checks two things:
- `checkLayout()` resolves to `[]`;
- the check isn't vacuous: with a temporary global `<style>` setting `.md-heading-1 { font-size: 2em !important }`, `checkLayout()` reports a `line-height` violation. The `!important` beats the scoped theme. The test removes the style afterwards.

Vitest browser mode serves the `?raw` import through Vite, as in the app.

### `window.quiroDev`: loaded only in dev

- **`src/dev-tools.ts`** (outside `src/editor/`) exports `installDevTools(): void`, which sets `window.quiroDev = { checkLayout }`, and declares the `Window.quiroDev` type with `declare global`.
- **`src/main.ts`** loads it only inside `if (import.meta.env.DEV) { … import("./dev-tools") … }`. Vite replaces `import.meta.env.DEV` with `false` in production and drops the branch, so the dynamic chunk is never emitted. `checkLayout` is then unused in production and tree-shaken.
- **`add-large-document-checks` adds `loadLargeFixture()` and `typingStats()` to the same object.**

The production-bundle test is a `.test.ts` in the jsdom project that switches to `// @vitest-environment node`.
- It calls Vite's `build()` with `build: { write: false }` and `logLevel: "silent"`, which loads `vite.config.ts` and returns the output in memory.
- It asserts that no chunk's code and no asset's source contains `quiroDev`.
- It uses no `node:` imports, because `tsc` checks every file under `src/` and the repo has no `@types/node`.
- It's written to last: the dev tools added later hang off the same name.

### README

The setup section gains `PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium-headless-shell` after `npm ci`. It notes that `npm ci` removes the browser along with `node_modules`, so the step has to be repeated.

## Manual verification

Run these after this change's PR is merged, on `master`. Record the date, the commit and the machine (CPU, WebKitGTK version, compositor, and the fonts used for sans, monospace, emoji and CJK), then each result, including `checkLayout()`'s output, in this change's `verification.md`. This change is archived only when every Linux item passes. A failed item becomes a `fix-add-soft-wrap-<what>` change.

**Linux (WebKitGTK):**
- **Layout check:** in `npm run tauri dev`, open the inspector (right-click, then Inspect Element) and run `await window.quiroDev.checkLayout()`. It returns `[]`. This is the run that catches WebKitGTK's own emoji and CJK font fallback, which Chromium can't.
- **Long token:** with the window at its minimum size, paste a 2,000-character token with no spaces (for example from `python -c "print('x'*2000)" | wl-copy`). It wraps, and there's no horizontal scrollbar.
- **Production build:** in a release build (`npm run tauri build -- --no-bundle`), `window.quiroDev` doesn't exist. Check by temporarily enabling devtools, or trust the gate's bundle test and record "covered by the gate".

**Windows** (verified on Windows later; added to [Manual Windows check](https://github.com/Acero-AD/quiro/issues/22) when this change is archived):
- In a dev build, `await window.quiroDev.checkLayout()` returns `[]` in WebView2.
- At the minimum window size, a 2,000-character token wraps with no horizontal scrollbar.

## Risks / Trade-offs

- **[`npm ci` deletes the browser]** → The README says to rerun the install, and CI always does. Later prerequisites use `npm install`, which leaves existing packages, and the browser inside them, in place.
- **[Playwright reads its browsers path before `vitest.config.ts` sets it]** → The provider imports `playwright` lazily (`@vitest/browser-playwright` 5.0.2 `dist/index.js`). If a future version imports it eagerly, the browser test fails with "Executable doesn't exist", and the fix moves the assignment before that import.
- **[CodeMirror draws only part of the hidden editor]** → `checkLayout()` scrolls through the document and checks what's drawn at each step, rather than assuming everything is in the DOM.
- **[The `ci.yml` block replaces the whole file]** → The diff review shows exactly what changed, and the prerequisites section says to refresh the block if `ci.yml` moved since this proposal.
- **[Chromium passes and WebKitGTK fails]** → The checks test rules, not pixel values, so a CSS rule that breaks them breaks them in both engines. What only WebKitGTK can show, its font fallback, is the manual run.
- **[`--with-deps` on the Ubuntu runner needs `sudo apt-get`]** → The runner already runs `sudo apt-get` for the WebKitGTK packages.

## Open Questions

- Does WebKitGTK's emoji or CJK font fallback overflow a visual line at 16 px with a 1.6 ratio? Only the manual run can tell. This is from [#15](https://github.com/Acero-AD/quiro/issues/15) and [#20](https://github.com/Acero-AD/quiro/issues/20).
- Is two animation frames always enough for CodeMirror to draw and measure after a scroll step on WebKitGTK? If the manual run reports intermittent violations, wait on CodeMirror's measure cycle instead.
