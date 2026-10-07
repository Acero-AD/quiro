## Why

Run with the system in dark mode, the `add-markdown-mode` Linux check ([`verification.md`](../2026-10-06-add-markdown-mode/verification.md)) passed, but showed Markdown that's hard to read. `src/styles.css` switches the page to a `#2f2f2f` background under `prefers-color-scheme: dark`, but the editor doesn't know the page is dark:
- the `--md-*` colours were chosen for the light background. Against `#2f2f2f`, headings are 1.6:1, links 2.3:1 and list markers 2.7:1, and tables and quotes are about as faint;
- CodeMirror stays on its light base theme, so the cursor is black (1.6:1) and the focused selection is a light lavender under near-white text (1.3:1).

The desktop this is built on (Omarchy) runs dark, so every later phase would be developed on an editor that's hard to read.

## What Changes

- **The editor follows the system colour scheme.** It's dark when the webview reports `prefers-color-scheme: dark`, and light otherwise. It switches while running when the webview reports a change, without touching the document, the selection or the undo history.
- **Dark mode turns on CodeMirror's dark base theme,** so the cursor, caret and control-character placeholders use CodeMirror's dark colours.
- **Every `--md-*` custom property gets a dark value.** Text colours meet 4.5:1 against the dark background. Dimmed colours (syntax markers, URLs, front matter) meet 3:1 and stay well below the body text.
- **The selection gets its own dark colour,** because CodeMirror's dark default (`#233`) is 1.0:1 against `#2f2f2f`.
- **Light mode doesn't change.** The light values in `src/editor/theme.ts` and the page colours in `src/styles.css` stay as they are.
- **No setting or toggle.** Choosing a scheme or a theme belongs to G-401 to G-403.

## Capabilities

### New Capabilities

- `colour-scheme`: following the system colour scheme, switching while running, the dark Markdown colours and their contrast, the dark cursor and selection, and an unchanged light mode.

### Modified Capabilities

None. `markdown-highlighting`'s requirements (CSS-variable colours, body-size headings, one dimmed syntax-marker style) hold in both schemes.

## Impact

- **Operator prerequisites:** none. No new dependencies, and the gate commands don't change.
- **Code:** a new internal file in `src/editor/` for the scheme and the dark theme spec. `src/editor/state.ts` adds the scheme to every state, and `src/editor/index.ts` follows the system scheme. The editor interface doesn't change. `src/editor/theme.ts` and `src/styles.css` don't change.
- **Tests:** new jsdom tests with a stubbed `matchMedia`, a contrast test, and one test in the Chromium browser project. Existing test files are untouched.
- **Run order:** no constraint. It builds on `add-editor` and `add-markdown-mode`, which are both archived.
- **Manual check:** Linux items in dark and light mode, and a live switch. Windows items go to [Manual Windows check](https://github.com/Acero-AD/quiro/issues/22) when this change is archived.
