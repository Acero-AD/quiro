## Context

`src/styles.css`, left over from the Tauri starter, gives the page `#2f2f2f` with `#f6f6f6` text under `prefers-color-scheme: dark`, and `#f6f6f6` with `#0f0f0f` text otherwise. WebKitGTK reports dark on the operator's Omarchy desktop, so the page is dark. The editor itself has no notion of a scheme:
- `src/editor/theme.ts` (`add-markdown-mode`) declares one set of `--md-*` defaults on the editor root, chosen for the light page;
- no theme marks the editor as dark, so CodeMirror's base theme stays on its `&light` rules. Its cursor is `1.2px solid black` and its focused selection is `#d7d4f0` (`@codemirror/view` 6.43.13, `dist/index.js`, lines 6904 to 6937).

The `add-markdown-mode` Linux check found this ([`verification.md`](../2026-10-06-add-markdown-mode/verification.md), findings 1 and 2): the dialect fixture pasted into a dark dev build has headings, links, tables and quotes that are hard to read. The check itself passed, because it only asks that constructs look distinct. Contrast ratios against `#2f2f2f`, by the WCAG 2 formula:

| Colour | Ratio |
| --- | --- |
| `--md-heading` `#1f4f8f` | 1.64:1 |
| `--md-link` `#0b62c4` | 2.27:1 |
| `--md-list-marker` `#b4561f` | 2.74:1 |
| cursor `#000` | 1.57:1 |
| `#f6f6f6` text on the `#d7d4f0` selection | 1.33:1 |

There's no grilling ticket behind this change. Its decisions are made here, from the check, the CodeMirror source and the ratios above.

## Goals / Non-Goals

**Goals:**

- The editor follows the system colour scheme, at start and while running.
- Every Markdown colour, the cursor and the selection are readable in dark mode, with contrast targets that a test checks.
- Light mode looks exactly as it does today.

**Non-Goals:**

- A scheme setting or an in-app toggle (G-402, G-403).
- Themes, or a dark palette that's anything more than defaults (G-401).
- Moving the page colours out of `src/styles.css`, or changing them.
- Raising the light palette's contrast. See the open questions.
- Fonts. CodeMirror's default monospace stays until G-401.
- Forcing the window's theme through Tauri's `theme` setting.

## Operator prerequisites

None. The change adds no dependency, and the gate commands don't change.

## Decisions

### Follow `prefers-color-scheme`, with no setting

The editor is dark exactly when `window.matchMedia("(prefers-color-scheme: dark)")` matches. That's the same signal `src/styles.css` already uses, so the page and the editor can't disagree. If `window.matchMedia` doesn't exist, as under jsdom, the editor is light.

*Alternative:* a light/dark/system setting. Rejected for now: settings persistence is G-402, and a setting needs this mechanism underneath anyway.

### JavaScript and a compartment, not a CSS media query

A new internal file, `src/editor/colour-scheme.ts`, owns a CodeMirror `Compartment`:
- **in light mode,** it holds nothing;
- **in dark mode,** it holds `Prec.high(EditorView.theme(darkThemeSpec, { dark: true }))`.

`{ dark: true }` sets the `EditorView.darkTheme` facet, which switches CodeMirror's base theme to its `&dark` rules. That gives a `#ddd` cursor (9.86:1), a white caret, and dark colours for control-character placeholders. Later CodeMirror extensions, such as G-406's search panel and any tooltips, also have `&dark` rules, and they'll follow without more work.

*Alternative:* an `@media (prefers-color-scheme: dark)` block in a theme spec, with no JavaScript. Rejected, for two reasons:
- **A media query can't set a facet.** CodeMirror's dark base theme would stay off, and every `&dark` rule it carries would have to be copied by hand. That's the cursor and selection now, and panels and tooltips later.
- **It would break `add-markdown-mode`'s style test.** `src/editor/theme.test.ts` reads every value in `markdownThemeSpec` as a declaration. A nested `@media` key would fail its "only sets properties that keep the line height" check, and existing tests can't be edited.

### The editor module owns the query

`createEditor` reads the media query, and listens to its `change` event. `main.ts` doesn't change, and neither does the `Editor` interface.

- **Start:** `newState(doc, scheme)` puts the compartment into every state. `scheme` defaults to `"light"`, so the layout check's hidden editor keeps calling `newState(layoutFixture)` unchanged. Colours don't affect layout.
- **Change:** the listener dispatches `compartment.reconfigure(...)` as a transaction. It doesn't call `setState`, because a new state is how `load` clears the undo history (`add-editor`), and a scheme switch mustn't. The document, the selection and the undo history all survive.
- **Load:** `load` passes the current scheme to `newState`, so a loaded document keeps it.
- **Destroy:** `destroy` removes the `change` listener before destroying the view.

*Alternative:* `main.ts` watches the scheme and tells the editor through a new interface method. Rejected: the interface's planned growth is recorded in `add-editor`'s design (`configure(partial: EditorOptions)` arrives with G-311), and a scheme option belongs there when settings exist. Until then the editor can follow the system on its own.

### The dark values only redefine variables

`darkThemeSpec` is exported inside `src/editor/` as a plain object, like `markdownThemeSpec`, so tests can read it. It holds:

- **on `&`:** a dark value for every `--md-*` custom property that `markdownThemeSpec` declares, plus `--editor-selection`;
- **the selection rules:** `&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground` and `.cm-selectionBackground`, each with only `backgroundColor: "var(--editor-selection)"`. These have the same specificity as CodeMirror's `&dark` selection rules, and theme modules are mounted after the base theme, so they win. It's the same pattern CodeMirror's own `one-dark` theme uses.

It sets no other property, so it can't change a line's height (G-104). The rules in `markdownThemeSpec` still take every colour from `var(--md-…)`, and `theme.ts` doesn't change.

**Precedence:** both specs declare the same custom properties on the editor root, with equal specificity. CodeMirror mounts style modules in reverse precedence order (`StyleModule.mount(this.root, this.styleModules.concat(baseTheme$1).reverse())`, `@codemirror/view` 6.43.13, `dist/index.js` line 8351). So the higher-precedence module comes later in the document and wins. `Prec.high` makes the dark theme win however `newState` orders its extensions. Only a real cascade can confirm this, so one test runs in the Chromium browser project.

### The dark palette

`--md-code-background` keeps its value: the 14 % grey tint is visible on both backgrounds. Every other value is new. Ratios are against `#2f2f2f`; the dark body text, `#f6f6f6`, is 12.39:1, so dimmed colours must be at most 6.19:1.

| Property | Light (unchanged) | Dark | Ratio | Target |
| --- | --- | --- | --- | --- |
| `--md-heading` | `#1f4f8f` | `#8fb8f0` | 6.56 | ≥ 4.5 |
| `--md-link` | `#0b62c4` | `#6cb4ff` | 6.13 | ≥ 4.5 |
| `--md-quote` | `#5b6573` | `#b6bfca` | 7.20 | ≥ 4.5 |
| `--md-table` | `#3d4a5c` | `#c9d3df` | 8.84 | ≥ 4.5 |
| `--md-list-marker` | `#b4561f` | `#f0a066` | 6.33 | ≥ 4.5 |
| `--md-task-marker` | `#2f8a4c` | `#6cc98a` | 6.60 | ≥ 4.5 |
| `--md-quote-marker` | `#8a5bb5` | `#c49df0` | 6.01 | ≥ 4.5 |
| `--md-syntax-marker` | `#a0a8b3` | `#8d949d` | 4.37 | 3 to 6.19 |
| `--md-url` | `#7b8794` | `#9aa4b0` | 5.30 | 3 to 6.19 |
| `--md-front-matter` | `#7b8794` | `#9aa4b0` | 5.30 | 3 to 6.19 |
| `--md-code-background` | `rgba(127, 127, 127, 0.14)` | same | — | — |
| `--editor-selection` | none (CodeMirror's) | `#264f78` | 1.58; body text on it 7.86 | ≥ 1.5; body ≥ 4.5 |

- **Targets:** 4.5:1 is WCAG 2 AA for body-size text. Dimmed colours mark syntax that Phase 3 hides off the cursor line, so they only need 3:1. The upper bound of half the body text's ratio keeps them visibly dimmer than the text.
- **Hues** follow the light palette: blue headings and links, orange list markers, green task markers and purple quote markers, so the two schemes read alike.
- **Selection:** CodeMirror's dark default, `#233`, is 1.01:1 against `#2f2f2f`; it was made for darker backgrounds. `#264f78` is VS Code's dark selection colour.

### Tests

All tests are new files. Existing test files don't change.

- **Scheme tests (jsdom),** under `src/editor/`. A fake `MediaQueryList` is installed with `vi.stubGlobal("matchMedia", …)`, with `matches` and `change` events that the test controls. Tests reach the view with `EditorView.findFromDOM`, as `add-editor`'s tests do, and read `view.state.facet(EditorView.darkTheme)`. Edits are dispatched to the view directly, and undo steps are counted with `undoDepth` from `@codemirror/commands`.
- **Spec test (jsdom):** `darkThemeSpec` declares the same `--md-*` names as `markdownThemeSpec`, plus `--editor-selection`. Its selection rules set only `background-color: var(--editor-selection)`.
- **Contrast test (jsdom):** computes WCAG 2 ratios from the hex values in `darkThemeSpec`. It takes the dark background and body text from the `prefers-color-scheme: dark` block of `src/styles.css`, imported with `?raw` as `dialect.test.ts` imports its fixture. So if the page colours change, the test checks the palette against the new ones.
- **Cascade test (Chromium browser project),** in a new `*.browser.test.ts` file: a view mounted with `newState("# Title", "dark")` shows `Title` in `rgb(143, 184, 240)`, and one with `newState("# Title")` shows `rgb(31, 79, 143)`. It uses `newState` directly, so the cascade is checked in section 1, before `createEditor` watches the media query. The test destroys its views and removes their elements.

## Manual verification

Run these after this change's PR is merged, on `master`, in `npm run tauri dev`. Record the date, the commit, the machine (CPU, WebKitGTK version, compositor) and the Omarchy theme in each mode, then pass or fail for each item, in this change's `verification.md`. This change is archived only when every Linux item passes. A failed item becomes a `fix-add-dark-colour-scheme-<what>` change.

**Linux (WebKitGTK), with Omarchy on a dark theme:**
- **Fixture:** paste `src/editor/fixtures/dialect.md`. Every construct is easy to read, each looks distinct from body text and from the others, and syntax markers are dimmer than body text.
- **Cursor:** the cursor is clearly visible, and blinks.
- **Selection:** a selected word sits on a visibly blue background and stays readable, both with the window focused and after focusing another window.

**Linux, switching while running:**
- With some text typed, switch Omarchy to a light theme. Quiro turns light without a restart, keeps the text and selection, and Ctrl+Z still undoes the typing. Then switch back to dark.
- If Quiro doesn't switch, run `matchMedia("(prefers-color-scheme: dark)").matches` in the inspector console (right-click, then Inspect Element):
  - if it still reports the old scheme, WebKitGTK didn't report the change. The requirement only covers changes the webview reports, so record "not reported by WebKitGTK" and the item passes. See the open questions;
  - if it reports the new scheme, the editor missed the change, and the item fails.

**Linux, light mode:** after a restart in light mode, the fixture looks the same as before this change.

**Windows** (verified on Windows later; added to [Manual Windows check](https://github.com/Acero-AD/quiro/issues/22) when this change is archived):
- With Windows in dark app mode, the editor is dark, with a visible cursor and selection.
- Switching Windows between light and dark app mode switches Quiro while it runs.

## Risks / Trade-offs

- **[G-401 themes must beat a `Prec.high` theme]** → A G-401 theme that redefines `--md-*` on the editor has to outrank the dark theme, or replace the compartment's content. G-401 decides where themes live; the compartment is the natural place to swap one in.
- **[WebKitGTK may not report a scheme change while running]** → Start-up still follows the system, so a restart fixes it. The manual check records which happens.
- **[Two places know the dark background]** → `src/styles.css` sets it, and the palette is checked against it. The contrast test reads it from `src/styles.css`, so changing the background re-checks the palette.
- **[The light palette has its own low ratios]** → Against `#f6f6f6`, `--md-task-marker` is 4.00:1 and `--md-syntax-marker` 2.22:1. They're unchanged here, by the goal of leaving light mode alone.
- **[A listener per editor]** → `destroy` removes it, and a test checks that it does.

## Open Questions

- What drives `prefers-color-scheme` in WebKitGTK under Omarchy: the GTK theme's name, `gtk-application-prefer-dark-theme`, or the desktop portal's `color-scheme`? And does WebKitGTK fire `change` when it changes while Quiro runs? The manual check answers the second.
- Should the light palette meet the same contrast targets? If so, that's its own change, because it changes how light mode looks.
- Should G-402 offer a scheme setting that overrides the system, and should it also set Tauri's window `theme` so the GTK header bar matches?
