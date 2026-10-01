## Why

G-104 asks for prose-friendly layout: long lines wrap, there's no horizontal scrollbar, and line height stays constant whatever the inline content. CodeMirror doesn't wrap by default. Its base theme sets its own line height, and only a real layout engine can show whether a style makes a line taller. The gate can't run WebKitGTK, so this change also brings headless Chromium into `npm test`, through Vitest browser mode, for the layout checks. The same check runs on WebKitGTK in dev builds through `window.quiroDev.checkLayout()`.

The decisions come from:
- [What does stable line height mean under soft wrap?](https://github.com/Acero-AD/quiro/issues/15);
- [How are WebKitGTK-only behaviours verified when the gate cannot run WebKitGTK?](https://github.com/Acero-AD/quiro/issues/20);
- [How does the work split into OpenSpec changes and tasks.md sections?](https://github.com/Acero-AD/quiro/issues/19): this change owns `window.quiroDev` and the production-bundle check, and its prerequisites write `ci.yml`.

## What Changes

- **Before the run, harness:**
  - installs `playwright` and `@vitest/browser-playwright`, pinned exactly;
  - downloads Playwright's Chromium headless shell into `node_modules`;
  - rewrites `vitest.config.ts` with a second, browser-mode project;
  - rewrites `.github/workflows/ci.yml` so CI installs the same Chromium on both runners.

  `npm test` stays the gate command and runs both projects.
- **The editor wraps long lines at its width,** including one unbroken 2,000-character token. It never shows a horizontal scrollbar.
- **One rule sets the editor's font size and line height,** from the CSS custom properties `--editor-font-size` (default `16px`) and `--editor-line-height` (default `1.6`). It overrides CodeMirror's base theme.
- **No highlight style may set** `font-size`, `line-height`, `vertical-align`, or any vertical padding, margin or border. A jsdom test checks this.
- **`checkLayout()`, exported from the editor module,** builds its own hidden fixture editor at a fixed narrow width. The fixture is the dialect fixture, a line of emoji and CJK text, and a 2,000-character token. `checkLayout()` returns any violation of four rules:
  - every visual line has the same height;
  - typing a construct or moving the cursor changes no height;
  - inline boxes stay inside their visual line;
  - nothing overflows horizontally.

  A Chromium browser test asserts that it returns no violations.
- **Dev builds expose `window.quiroDev.checkLayout()`.** A `node` test builds the production bundle with Vite and asserts that it contains no `quiroDev`.
- **The README documents installing Playwright's Chromium after `npm ci`.**

## Capabilities

### New Capabilities

- `editor-layout`: soft wrap with no horizontal scrollbar, one font size and line height from custom properties, highlight styles that never change line geometry, the four layout rules with their check, and the dev-only `window.quiroDev.checkLayout()`.

### Modified Capabilities

- `developer-checks`:
  - "Every check passes from a clean clone" adds Playwright's Chromium install after `npm ci`;
  - "Frontend unit tests under jsdom" adds the browser-mode project inside `npm test`;
  - "Setup and checks are documented" adds the Chromium install;
  - a new requirement says dev-only tooling stays out of the production bundle.
- `ci-build`: "Checks run on Linux and Windows" installs Playwright's Chromium after `npm ci`, before the checks.

## Impact

- **Operator prerequisites:**
  - `package.json`, `package-lock.json`, `vitest.config.ts` and `.github/workflows/ci.yml` change in the prep commit;
  - Chromium (about 261 MB) lands in `node_modules/playwright-core/.local-browsers/`, which the gate copies on every run (about 0.1 s);
  - the gate commands don't change.
- **Code:**
  - new files under `src/editor/` for wrapping, the layout theme and `checkLayout()`;
  - a new `src/dev-tools.ts` outside the editor;
  - `src/main.ts` loads the dev tools only in dev;
  - `README.md` gains the Chromium step.
- **Tests:** new jsdom tests, a new `*.browser.test.ts`, and a new `node` build test. Earlier changes' tests are untouched.
- **Run order:** fourth Phase 1 change, after `add-markdown-mode` is archived, whose fixture and theme it relies on, and before `add-large-document-checks`, which adds to `window.quiroDev`.
- **Manual check:** after the merge, `window.quiroDev.checkLayout()` on WebKitGTK and the minimum-size scrollbar check. Windows items go to [Manual Windows check](https://github.com/Acero-AD/quiro/issues/22).
