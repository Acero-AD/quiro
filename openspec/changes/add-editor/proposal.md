## Why

Quiro has no editor yet: the window still shows the `ping` reference page. G-101 (editor mounts) and G-102 (undo and redo) are the first Phase 1 goals. Every later phase plugs into the editor module they create: files, live preview, settings and the plugin API. So this change also fixes the module's boundary. CodeMirror stays inside `src/editor/`, as ADR 0001 records.

The decisions come from the [Phase 0 remainder and Phase 1 editor core](https://github.com/Acero-AD/quiro/issues/1) wayfinder map:
- [Which editing features and keybindings does the Phase 1 editor ship?](https://github.com/Acero-AD/quiro/issues/13)
- [What interface does the editor module give the rest of the app?](https://github.com/Acero-AD/quiro/issues/16)
- [How are WebKitGTK-only behaviours verified when the gate cannot run WebKitGTK?](https://github.com/Acero-AD/quiro/issues/20)
- [How does the work split into OpenSpec changes and tasks.md sections?](https://github.com/Acero-AD/quiro/issues/19)

## What Changes

- **Before the run, harness installs** `@codemirror/state`, `@codemirror/view` and `@codemirror/commands`, pinned exactly, through the operator prerequisites in `design.md`.
- **A new editor module, `src/editor/`.** `src/editor/index.ts` is its only entry point. It exports `createEditor(parent)`, which returns an editor with `load(fileText)`, `text()`, `focus()` and `destroy()`.
  - `load` strips a leading BOM, stores the text with LF line breaks, clears undo history and puts the cursor at the start.
  - The rest of the interface, from `fileText()` to `applyEdits()`, is planned in `design.md` and built by the goals that need it.
- **`npm run lint` forbids CodeMirror and Lezer imports outside `src/editor/`.**
- **Editing is CodeMirror's minimal set:**
  - the default keymap without Ctrl+/;
  - undo history;
  - a drawn cursor and selection;
  - visible placeholders for control characters;
  - plain-text paste.
- **Undo and redo:** Ctrl+Z undoes. Ctrl+Shift+Z and Ctrl+Y redo on Linux and on Windows; CodeMirror binds Ctrl+Shift+Z on Linux only, so it's added for Windows.
  - An undo step is a burst of edits less than 500 ms apart, or one composed input sequence.
  - At least 100 steps are kept.
- **The editor never binds the keys reserved for the app:** Ctrl+N, Ctrl+O, Ctrl+S, Ctrl+Shift+S, Ctrl+,, Ctrl+Shift+P and Ctrl+/.
- **The window shows only the editor, filling it at every size.** **BREAKING** for the `ipc-bindings` spec: the page no longer shows Rust's reply to `ping`. The `ping` command, its client, its tests and the bindings drift test all stay, as the tested IPC reference example.

## Capabilities

### New Capabilities

- `editor`: the full-window editor, the module interface (`createEditor`, `load`, `text`, `focus`, `destroy`), Phase 1's editing set, plain-text paste, undo and redo keys per platform, undo steps, the keys reserved for the app, and composed input.

### Modified Capabilities

- `developer-checks`: an ADDED requirement. `npm run lint` fails when a file outside `src/editor/` imports `@codemirror/*` or `@lezer/*`.
- `ipc-bindings`: "The window shows Rust's reply" is REMOVED, because G-101 leaves nothing in the window but the editor.

## Impact

- **Operator prerequisites:** `package.json` and `package-lock.json` change in the prep commit that harness makes before the run. The gate commands don't change.
- **Code:**
  - new files under `src/editor/`;
  - `src/main.ts` mounts the editor instead of calling `ping`;
  - `index.html` and `src/styles.css` hold the full-window layout;
  - `biome.json` gains the import restriction.
- **Tests:** new jsdom tests under `src/editor/`. `src/ping.test.ts` and the Rust tests are untouched.
- **Run order:** first of the five Phase 1 changes. The next one, `add-webview-guard`, starts only after this change is archived.
- **Manual check:** after the merge, a Linux check on `master` covers typing, selection, the clipboard, resizing, the undo and redo keys, and composed input. Results go in `verification.md`, and the Windows items go to [Manual Windows check](https://github.com/Acero-AD/quiro/issues/22).
