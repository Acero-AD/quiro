## 1. Dark colours, chosen per state

- [x] 1.1 A new file, `src/editor/colour-scheme.ts`, exports `type ColourScheme = "light" | "dark"` and `darkThemeSpec`, a plain object. On `&`, `darkThemeSpec` declares every `--md-*` custom property that `markdownThemeSpec` declares, plus `--editor-selection`, with exactly the dark values in the palette table of `design.md`.
- [x] 1.2 `darkThemeSpec`'s only other rules are `&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground` and `.cm-selectionBackground`. Each sets only `backgroundColor: "var(--editor-selection)"`.
- [x] 1.3 `colour-scheme.ts` holds one module-level `Compartment`. `newState` in `src/editor/state.ts` takes `(doc: string, scheme: ColourScheme = "light")` and adds the compartment. For `"light"` it holds nothing. For `"dark"` it holds `Prec.high(EditorView.theme(darkThemeSpec, { dark: true }))`. A function exported from `colour-scheme.ts` returns the `reconfigure` effect for a given scheme.
- [x] 1.4 `src/editor/theme.ts`, `src/styles.css`, `src/main.ts` and `src/editor/layout-check.ts` are unchanged, and `layout-check.ts` still calls `newState` with one argument.
- [x] 1.5 A jsdom spec test checks that the set of `--md-*` names on `darkThemeSpec`'s `&` equals the set on `markdownThemeSpec`'s `&`, that `--editor-selection` is declared, and that every rule other than `&` sets only `background-color`, to `var(--editor-selection)`.
- [x] 1.6 A jsdom contrast test imports `src/styles.css` with `?raw`, takes `background-color` and `color` from its `prefers-color-scheme: dark` block, and computes WCAG 2 contrast ratios from `darkThemeSpec`'s hex values. It checks that:
  - `--md-heading`, `--md-link`, `--md-quote`, `--md-table`, `--md-list-marker`, `--md-task-marker` and `--md-quote-marker` are at least 4.5:1 against the background;
  - `--md-syntax-marker`, `--md-url` and `--md-front-matter` are at least 3:1, and at most half of the body text's ratio;
  - `--editor-selection` is at least 1.5:1 against the background, and the body text on it at least 4.5:1.
- [x] 1.7 A jsdom test checks that a view made from `newState(doc, "dark")` has `EditorView.darkTheme` true, and one made from `newState(doc)` has it false.
- [x] 1.8 A new `*.browser.test.ts` file mounts an `EditorView` with `newState("# Title", "dark")` and checks that `Title`'s computed `color` is `rgb(143, 184, 240)`. With `newState("# Title")` it's `rgb(31, 79, 143)`. The test destroys its views and removes their elements.
- [x] 1.9 No test file that existed before this change is modified. No dependency is added, and `package.json` and `package-lock.json` are unchanged. `npm run lint`, `npm test` and `npm run build` pass in the gate.

## 2. The editor follows the system scheme

- [ ] 2.1 `createEditor` calls `window.matchMedia("(prefers-color-scheme: dark)")` once and creates its first state with `"dark"` when the query matches, and `"light"` otherwise. When `window.matchMedia` isn't a function, it uses `"light"` and doesn't throw.
- [ ] 2.2 `createEditor` listens with `addEventListener("change", …)` on the query list. On a change, it dispatches the reconfigure effect from `colour-scheme.ts` as a transaction, and doesn't call `setState`.
- [ ] 2.3 `load` passes the current scheme to `newState`. `destroy` removes the `change` listener before destroying the view.
- [ ] 2.4 `createEditor`'s signature, the exported `Editor` type and the exports of `src/editor/index.ts` are unchanged.
- [ ] 2.5 New jsdom tests install a fake `MediaQueryList` with `vi.stubGlobal("matchMedia", …)`, whose `matches` and `change` events the test controls, and remove it afterwards. Each test reaches the view with `EditorView.findFromDOM` and reads `EditorView.darkTheme` from its state. They check that:
  - with `matchMedia` absent, `createEditor` doesn't throw and the editor is light;
  - when the query matches at creation, the editor is dark;
  - after edits dispatched to the view and a non-empty selection, a `change` to dark and back to light flips `EditorView.darkTheme` each time, and leaves the text, the selection and `undoDepth` (from `@codemirror/commands`) unchanged;
  - an editor that's dark stays dark after `load`;
  - after `destroy`, the fake query list has no `change` listener left.
- [ ] 2.6 No test file that existed before this change is modified, including section 1's. `npm run lint`, `npm test` and `npm run build` pass in the gate.
