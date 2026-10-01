## Context

Phase 0 is fully archived. The app runs on Tauri 2.12.1, with typed IPC through `src/bindings.ts`, Vitest with jsdom, Biome, and CI on Linux and Windows. The window shows a minimal page from `index.html` and `src/main.ts` that displays Rust's reply to `ping`. No CodeMirror package is installed yet.

Sources:
- the [Phase 0 remainder and Phase 1 editor core](https://github.com/Acero-AD/quiro/issues/1) wayfinder map, in particular:
  - [Which editing features and keybindings does the Phase 1 editor ship?](https://github.com/Acero-AD/quiro/issues/13): the editing set, undo semantics and the Windows redo binding;
  - [What interface does the editor module give the rest of the app?](https://github.com/Acero-AD/quiro/issues/16): the module boundary, interface and reserved keys (ADR 0001, `docs/adr/0001-codemirror-stays-inside-the-editor-module.md`);
  - [How are WebKitGTK-only behaviours verified when the gate cannot run WebKitGTK?](https://github.com/Acero-AD/quiro/issues/20): manual checks and composed input;
  - [How does the work split into OpenSpec changes and tasks.md sections?](https://github.com/Acero-AD/quiro/issues/19): this change's scope, the test rules and the run order;
- research [What does CodeMirror 6 give Phase 1 out of the box for editing, undo and line layout?](https://github.com/Acero-AD/quiro/issues/6), in `docs/research/cm6-editing-undo-layout.md` on branch `research/cm6-editing-undo-layout`. Its sections F1 to F9 are cited below.

The terms **document**, **file**, **undo step** and **composed input** are defined in `CONTEXT.md`.

## Goals / Non-Goals

**Goals:**

- G-101: a single full-window CodeMirror 6 editor with Phase 1's editing set and plain-text paste.
- G-102: Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y on Linux and Windows, with at least 100 undo steps and burst grouping.
- The editor module boundary from ADR 0001, enforced by lint, with the Phase 1 slice of its interface.
- Tests that will outlast later phases: no later change needs to edit them.

**Non-Goals:**

- Markdown parsing and highlighting (`add-markdown-mode`), soft wrap and line height (`add-soft-wrap`), and large-document checks (`add-large-document-checks`).
- Webview hardening (`add-webview-guard`).
- The rest of the planned interface (listed below), and the Phase 2 app keymap.
- Editing features beyond the minimal set: multiple cursors, bracket handling, auto-indent and Tab, active-line highlight, formatting shortcuts and search. Each belongs to a later goal.
- Line numbers and autocompletion, which are never included.

## Operator prerequisites

Harness applies these on the host before the run, after a plan review and a diff review. It then commits them as the prep commit and recaptures the baseline. The versions are the ones the research tested ([#6](https://github.com/Acero-AD/quiro/issues/6), "Experiments run"), pinned exactly. They're runtime dependencies, because they're bundled into the app.

```harness-run
npm install -E @codemirror/state@6.7.6 @codemirror/view@6.43.13 @codemirror/commands@6.11.1
```

Check that every frontend check still passes before anything is committed:

```harness-run
npm run lint
npm test
npm run build
```

In the diff review, expect changes to `package.json` (three new `dependencies`) and `package-lock.json`. The gate commands don't change.

## Decisions

### One entry point, `src/editor/index.ts`

The module lives in `src/editor/`. Only `index.ts` is imported from outside. Internal files, such as the extension list and the keymap, are free to change. The exported `Editor` type is a plain interface:

```ts
export interface Editor {
  load(fileText: string): void;
  text(): string;
  focus(): void;
  destroy(): void;
}
export function createEditor(parent: HTMLElement): Editor;
```

`createEditor` takes no options in Phase 1. `configure(partial: EditorOptions)` and an options argument arrive with G-311. No CodeMirror or Lezer type appears in the exported types, so callers can't reach the view or state.

*Alternative:* exporting the `EditorView` so later phases can reach in. Rejected in ADR 0001: it would spread CodeMirror knowledge across every phase.

### Lint rule: CodeMirror and Lezer only inside `src/editor/`

`biome.json`'s `style/noRestrictedImports` gains `patterns` for `@codemirror/*` and `@lezer/*`, with a message that only `src/editor/` may use CodeMirror. An `overrides` entry for `src/editor/**` keeps the existing `@tauri-apps/api/core` path rule but drops the CodeMirror patterns. That rule stays in force everywhere, including tests outside `src/editor/`. Biome 2.5.14's schema supports both `paths` and `patterns` in this rule's options.

### The extension list is built by hand, not `minimalSetup`

`minimalSetup` also installs `syntaxHighlighting(defaultHighlightStyle, {fallback: true})`, which imports `@codemirror/language`. That package arrives with `add-markdown-mode`, along with Quiro's own highlighter (F1). So the editor builds the same set itself:
- `highlightSpecialChars()`;
- `history()`, with its defaults: `minDepth` 100 and `newGroupDelay` 500 ms;
- `drawSelection()`;
- `keymap.of([...])`, made from `defaultKeymap` without its `Mod-/` binding, then `historyKeymap`, then one extra binding: `{ win: "Ctrl-Shift-z", run: redo, preventDefault: true }`.

CodeMirror binds Ctrl+Shift+Z to redo on Linux only (`historyKeymap`, F2). On Windows it's unbound and does nothing, so the extra `win` binding meets G-102 there. It doesn't affect Linux.

`EditorState.allowMultipleSelections` stays off, so multiple cursors stay out of Phase 1. Every other `defaultKeymap` binding stays as CodeMirror ships it, including Ctrl+I `selectParentSyntax`, which G-405 settles.

### Keys reserved for the app

Ctrl+N (G-201), Ctrl+O (G-202), Ctrl+S (G-203), Ctrl+Shift+S (G-204), Ctrl+, (G-403), Ctrl+Shift+P (G-605) and Ctrl+/ (G-311) belong to the app. Phase 2 adds a window-level app keymap outside this module. It skips events the editor handled and keys pressed mid-composition.

CodeMirror's Linux and Windows keymaps bind only one of these, Ctrl+/ (`toggleComment`), and it's removed above. The keymap test proves that none of them is bound: a `keydown` for each, sent to the content element, isn't `defaultPrevented` and leaves the document unchanged.

### `load` installs a new state

CodeMirror has no clear-history API. The maintainer's advice is to create a new state (F3). `load(fileText)`:
1. strips a leading U+FEFF;
2. creates a new `EditorState` with the same extensions and the remaining text, with CodeMirror's default line splitting, which treats `\r\n`, `\r` and `\n` as breaks and joins lines with `\n` (F4);
3. installs it with `view.setState`, which leaves an empty undo history and the cursor at offset 0.

`text()` returns `view.state.doc.toString()`, which always joins with `\n`.

The interface plans for `load` to remember the file's BOM and first line ending for `fileText()` (G-203). Phase 1 has no reader for them, and `noUnusedLocals` would reject a field that's never read. So they're stored when G-203 builds `fileText()`. Nothing observable changes, because only `fileText()` would reveal them. Likewise, `load` gives the document a new **document version** only once `version()` exists (G-606).

### Full-window layout

- `index.html`'s body holds one container element for the editor and nothing else. The `#ping-reply` paragraph and the starter `.container` styles are removed.
- `src/styles.css` makes `html`, `body` and the container fill the viewport with no margin and no page scrollbars.
- Inside the module, an `EditorView.theme` sets the editor root (`&`) to `height: 100%`. The `.cm-scroller` scrolls the document.

Editor styles live in `EditorView.theme` specs inside `src/editor/`, never in global CSS. CodeMirror's base theme is scoped under a generated class, and plain global rules on `.cm-scroller` silently lose to it (F5). A theme spec also applies the same way in the app, under jsdom, and in the browser-mode tests that `add-soft-wrap` adds.

`src/main.ts` creates the editor in the container on `DOMContentLoaded` and focuses it. It no longer imports `ping`.

### `ping` stays as the reference example

The `ping` command, `src/ping.ts`, `src/ping.test.ts` and the drift test stay unchanged. Only the page stops calling `ping`. `src/ping.ts` then has no runtime caller, but it remains the tested example of a typed IPC call, as decided in [How do Rust and TypeScript share IPC command types?](https://github.com/Acero-AD/quiro/issues/12).

### Tests: the interface where possible, CodeMirror where needed

This amends the test rule in [What interface does the editor module give the rest of the app?](https://github.com/Acero-AD/quiro/issues/16), as decided in [How does the work split into OpenSpec changes and tasks.md sections?](https://github.com/Acero-AD/quiro/issues/19):

- **Interface tests** use only `createEditor` and the `Editor` methods, under jsdom: `load` with a BOM and CRLF, a document with no line break, and undo right after `load`.
- **Editing-behaviour tests** inside `src/editor/` may drive CodeMirror's state and view directly. They reach the view of an editor made by `createEditor` with `EditorView.findFromDOM(parent.querySelector(".cm-editor"))`, so the interface needs no test-only export. Phase 1's interface has no way to edit (`applyEdits` waits for G-607), so:
  - **undo grouping:** tests dispatch transactions with an explicit `Transaction.time` and `userEvent`, `"input.type"` for typing and `"input.type.compose"` for a composition (F3, F6). The behaviour runs in plain jsdom.
  - **keymaps:** tests send `KeyboardEvent`s to the content element (`.cm-content`).
- **Paste:** jsdom has no `ClipboardEvent` or `DataTransfer` (F7). The paste test dispatches a plain `Event("paste", { bubbles: true, cancelable: true })` on the content element, with a stubbed `clipboardData` whose `getData` returns the HTML and the plain text by type. CodeMirror only calls `getData("text/plain")` (and `text/uri-list`) on it.
- **One keymap test file per platform.** `@codemirror/view` reads `navigator.platform` once, when it loads (F2). Each file stubs `navigator.platform`, to `"Linux x86_64"` in one and `"Win32"` in the other, then loads the editor with a dynamic `import()`, because static imports are hoisted above the stub. Vitest isolates modules per test file, so each file gets its own `@codemirror/view` instance.
- Test files are new files under `src/editor/`. Later Phase 1 changes write their own tests in new files and never edit these.

### Planned interface (not in this change's spec)

From [What interface does the editor module give the rest of the app?](https://github.com/Acero-AD/quiro/issues/16). Each item is built by the goal named, which also adds it to the spec:

- **`fileText(): string` (G-203):** returns the document with its BOM and remembered line ending restored. Mixed line endings are written back with the first line's ending everywhere.
- **`isModified()` and `markSaved()` (G-205):** content-based. Undoing back to the saved text makes the document unmodified.
- **`version()` and `onChange(listener) → unsubscribe` (G-606):** the listener receives `{version, modified}`. The version goes up on every change and every `load`, and is never reused within a run.
- **`selection(): {anchor, head}` (G-606):** the main selection only.
- **`applyEdits(version, edits: {from, to, text}[])` (G-607):**
  - offsets are UTF-16 code units, and all edits refer to that version;
  - it's all or nothing, returning `{ok, version}` or `{ok: false, reason: "stale-version" | "out-of-range" | "overlapping"}`;
  - one call is one isolated undo step.
- **`configure(partial: EditorOptions)` (G-311):** each option maps to a CodeMirror compartment, and `livePreview` is the first. Themes switch through CSS custom properties, never through the editor.
- **Parse queries** such as `headings(): {level, text, from}[]` (G-408). The raw tree is never exposed.

## Manual verification

The gate can't drive a real window, a real clipboard or an input method, so these checks sit outside `tasks.md`. Run them after this change's PR is merged, on `master`, in `npm run tauri dev`. Record the date, the commit and the machine (CPU, WebKitGTK version, compositor), then pass or fail for each item, in this change's `verification.md`. This change is archived only when every Linux item passes. A failed item becomes a `fix-add-editor-<what>` change.

**Linux (WebKitGTK):**
- **Window:** the editor fills the window when tiled, when floating, and at the minimum window size, with no other UI, and the cursor is in it at start.
- **Editing:** typing, word jumps, Home/End, Shift+arrow and mouse selection, Backspace/Delete, Enter and Ctrl+A all work. The selection is drawn.
- **Clipboard:**
  - cut and copy in Quiro paste into another app;
  - text copied in another app pastes into Quiro;
  - content copied from a web page (HTML) pastes as plain text.
- **Resize:** after typing several lines, resizing the window to the minimum and back leaves the text unchanged.
- **Undo and redo:** Ctrl+Z undoes, and Ctrl+Shift+Z and Ctrl+Y both redo.
- **Composed input,** with one undo per composed sequence and undo never splitting one:
  - a dead-key accent: switch on dead keys with `hyprctl keyword input:kb_variant intl`, type `'` then `e` to get `é`, then restore the layout;
  - a compose sequence: Compose is on Caps Lock, so Caps Lock, `o`, `"` gives `ö`;
  - an IME word, through an fcitx5 engine. Without an installed engine, mark this item "verified later". The criterion isn't weakened.

**Windows** (verified on Windows later; added to [Manual Windows check](https://github.com/Acero-AD/quiro/issues/22) when this change is archived):
- Ctrl+Shift+Z and Ctrl+Y redo, and Ctrl+Z undoes.
- A dead-key accent and an IME word insert correctly.
- Content copied from a web page pastes as plain text.

## Risks / Trade-offs

- **[CodeMirror's view isn't officially supported under jsDOM]** → The tests stay within what research ran there: state, history, keymap dispatch and view creation (F9). Nothing measures layout under jsdom.
- **[Stubbing `navigator.platform` misses a later platform check]** → The research ran exactly this stub in jsdom and in Chromium with a spoofed `Win32` (F2). WebView2's real `navigator.platform` was never measured, so the Windows keybinding item stays in the manual Windows check.
- **[WebKitGTK looks like Safari to CodeMirror]** → Safari-only code paths, such as the dead-key `compositionend` workaround, run in WebKitGTK (F6). Whether they help is unknown, and the composed-input manual check is where it would show.
- **[`history()` trims at `minDepth + 20`]** → After 121 steps the oldest are dropped back to about 101 (F3). "At least 100" holds.
- **[Global CSS loses to CodeMirror's base theme]** → All editor styling goes through `EditorView.theme` (F5).

## Open Questions

- Which fcitx5 engine to install for the IME item, for example fcitx5-mozc. This is from [How are WebKitGTK-only behaviours verified when the gate cannot run WebKitGTK?](https://github.com/Acero-AD/quiro/issues/20).
- WebView2's `navigator.platform` value was never measured. It's expected to be `Win32` (research F2, "Windows was not measured").
- WebKit bug 325166 (input-method delete-surrounding offsets in contenteditable) is fixed upstream but not in a WebKitGTK release. Whether it affects Quiro is unverified (research F6).
