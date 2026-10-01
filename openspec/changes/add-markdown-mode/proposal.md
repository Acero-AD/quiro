## Why

After `add-editor`, Quiro edits plain text. G-103 attaches the Markdown parser and gives each construct a distinct, themeable style. Phase 3's live preview, G-307's code highlighting and the G-401 themes all build on the tree and on the classes this change introduces.

The decisions come from:
- [Which Markdown dialect and highlighting does G-103 cover?](https://github.com/Acero-AD/quiro/issues/14);
- research [How does lang-markdown parse and highlight GFM, and how does CodeMirror 6 scale to 50,000 lines?](https://github.com/Acero-AD/quiro/issues/7);
- [What does stable line height mean under soft wrap?](https://github.com/Acero-AD/quiro/issues/15), for the style limits this change must already respect;
- [How does the work split into OpenSpec changes and tasks.md sections?](https://github.com/Acero-AD/quiro/issues/19).

## What Changes

- **Before the run, harness installs** `@codemirror/language`, `@codemirror/lang-markdown`, `@codemirror/lang-yaml`, `@lezer/markdown`, `@lezer/highlight` and `@lezer/common`, pinned exactly.
- **The editor parses Quiro's dialect:** CommonMark plus the GitHub extensions (tables, task lists, two-tilde strikethrough and autolinks), with YAML front matter.
  - `~x~` isn't subscript and `:x:` isn't emoji.
  - Fenced code is one monospace block, with no per-language highlighting until G-307.
- **Each construct gets a stable semantic class:** `md-heading-1` to `md-heading-6`, `md-emphasis`, `md-strong`, `md-strikethrough`, `md-code`, `md-code-block`, `md-link`, `md-url`, `md-list-marker`, `md-quote`, `md-table`, `md-task-marker`, `md-front-matter` and `md-syntax-marker`.
  - Every syntax marker shares `md-syntax-marker`.
  - Colours come only from CSS custom properties, so the G-401 themes only redefine variables.
- **The styles respect G-104's limits from the start:**
  - headings stay at body size;
  - styles set only colour, weight, italics, decoration, font family and background;
  - inline code uses horizontal padding only.
- **The language adds no editing behaviour.** `lang-markdown`'s list-continuation keymap, HTML tag completion and paste-as-link are turned off, so Phase 1's minimal editing set and plain-text paste stay as `add-editor` left them.
- **A checked-in dialect fixture uses every construct,** and a test compares every node's name and range in its parse tree with a checked-in listing. The fixture is frozen after this change; `add-soft-wrap` and `add-large-document-checks` reuse it.

## Capabilities

### New Capabilities

- `markdown-highlighting`: the dialect, the semantic class per construct, the shared syntax-marker class, body-size headings, CSS-variable colours, a language that adds no editing behaviour, and the pinned parse tree of the dialect fixture.

### Modified Capabilities

None.

## Impact

- **Operator prerequisites:** `package.json` and `package-lock.json` change in the prep commit. The gate commands don't change.
- **Code:** new files under `src/editor/` for the language, the highlighter, the theme and the block classes, plus the fixture and its tree listing under `src/editor/fixtures/`. `src/editor/index.ts` adds the language to the editor's extensions. The interface doesn't change.
- **Tests:** new jsdom tests under `src/editor/`. `add-editor`'s tests are untouched.
- **Run order:** third Phase 1 change, after `add-webview-guard` is archived and before `add-soft-wrap`.
- **Manual check:** one Linux item after the merge: the fixture pasted into a dev build looks right. There are no Windows items.
