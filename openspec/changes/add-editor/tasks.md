## 1. Editor module and full-window mount

- [ ] 1.1 `src/editor/index.ts` exports `createEditor(parent: HTMLElement): Editor` and the `Editor` interface with `load(fileText: string): void`, `text(): string`, `focus(): void` and `destroy(): void`. No exported type mentions a `@codemirror/*` or `@lezer/*` type.
- [ ] 1.2 The editor's extensions are `highlightSpecialChars()`, `history()` with default options, `drawSelection()`, and one keymap built from `defaultKeymap` without its `Mod-/` binding, then `historyKeymap`. The module doesn't import `minimalSetup`, `basicSetup` or the `codemirror` package.
- [ ] 1.3 `load` strips a leading U+FEFF, builds a new `EditorState` with the same extensions and the remaining text, and installs it with `view.setState`. `text()` returns `view.state.doc.toString()`.
- [ ] 1.4 Editor styling inside `src/editor/` is an `EditorView.theme` that makes the editor root fill its parent's height.
- [ ] 1.5 `index.html`'s body holds a single editor container and no `#ping-reply` element. `src/styles.css` makes `html`, `body` and that container fill the viewport with no margin, and no longer contains the starter `.container` rules.
- [ ] 1.6 `src/main.ts` creates the editor in the container on `DOMContentLoaded` and focuses it, and doesn't import `ping`.
- [ ] 1.7 `biome.json`'s `style/noRestrictedImports` forbids the `@codemirror/*` and `@lezer/*` patterns, with a message saying that only `src/editor/` may use CodeMirror. An `overrides` entry for `src/editor/**` drops those patterns, and the existing `@tauri-apps/api/core` rule applies everywhere.
- [ ] 1.8 New jsdom tests under `src/editor/` use only `createEditor` and the `Editor` methods to check that:
  - `load("﻿# Title\r\n\r\nText\r\n")` makes `text()` return `"# Title\n\nText\n"`;
  - `load("one line")` makes `text()` return `"one line"`;
  - `text()` of a new editor is `""`;
  - after `destroy()`, the parent no longer contains the editor's elements.
- [ ] 1.9 A jsdom test reaches the view with `EditorView.findFromDOM`, edits the document through a dispatched transaction, calls `load` with new text, then sends a Ctrl+Z `keydown` to the content element. The document still equals the loaded text.
- [ ] 1.10 A jsdom test dispatches a `paste` event on the content element whose stubbed `clipboardData.getData` returns `<b>RICH</b>` for `text/html` and `plain` for `text/plain`. The document then contains `plain` and not `RICH`.
- [ ] 1.11 `src/ping.ts`, `src/ping.test.ts`, `src/bindings.ts` and every file under `src-tauri/` are unchanged, and the section doesn't touch `package.json`, `package-lock.json`, `.harness/config.json` or `.github/workflows/ci.yml`.
- [ ] 1.12 `npm run lint`, `npm test` and `npm run build` pass in the gate.

## 2. Keymap and undo history

- [ ] 2.1 The editor's keymap includes `{ win: "Ctrl-Shift-z", run: redo, preventDefault: true }` after `historyKeymap`.
- [ ] 2.2 A keymap test file for Linux stubs `navigator.platform` as `"Linux x86_64"` before loading the editor with a dynamic `import()`. It checks that Ctrl+Z undoes an edit, and that Ctrl+Shift+Z and Ctrl+Y each redo it, by sending `keydown` events to the content element.
- [ ] 2.3 A separate keymap test file for Windows stubs `navigator.platform` as `"Win32"` the same way and makes the same three checks.
- [ ] 2.4 In both keymap test files, a `keydown` for each of Ctrl+N, Ctrl+O, Ctrl+S, Ctrl+Shift+S, Ctrl+, (comma), Ctrl+Shift+P and Ctrl+/ isn't `defaultPrevented` and leaves the document unchanged.
- [ ] 2.5 A history test dispatches 100 adjacent `input.type` edits, each with a `Transaction.time` 600 ms after the last. Undoing 100 times restores each earlier text in turn and ends at the starting text.
- [ ] 2.6 A history test dispatches five adjacent `input.type` edits 100 ms apart. One undo removes all five, and a further edit 600 ms later undoes separately.
- [ ] 2.7 A history test dispatches a typed edit, then, 600 ms later, an `input.type.compose.start` edit followed by `input.type.compose` edits spread over several seconds. One undo removes the whole composed sequence and leaves the typed edit.
- [ ] 2.8 No test file from section 1 is deleted or loses assertions, and `npm run lint`, `npm test` and `npm run build` pass in the gate.
