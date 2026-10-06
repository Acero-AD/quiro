## Context

After `add-editor` and `add-webview-guard`, `src/editor/` holds a CodeMirror editor with Phase 1's minimal editing set, its styling lives in `EditorView.theme` specs, and `src/vite-env.d.ts` loads Vite's client types. No language package is installed.

Sources:
- [Which Markdown dialect and highlighting does G-103 cover?](https://github.com/Acero-AD/quiro/issues/14): the dialect, front matter, fenced code, the distinct styles, semantic classes, CSS variables and the fixture test;
- research [How does lang-markdown parse and highlight GFM, and how does CodeMirror 6 scale to 50,000 lines?](https://github.com/Acero-AD/quiro/issues/7), in `docs/research/cm6-markdown-and-large-docs.md` on branch `research/cm6-markdown-and-large-docs`. Its findings §1 to §9 are cited below;
- [What does stable line height mean under soft wrap?](https://github.com/Acero-AD/quiro/issues/15): the style limits;
- [How does the work split into OpenSpec changes and tasks.md sections?](https://github.com/Acero-AD/quiro/issues/19): this change carries G-104's style limits, so `add-soft-wrap` only adds tests, and the fixture is frozen after this change.

The terms **dialect**, **front matter** and **syntax marker** are defined in `CONTEXT.md`.

## Goals / Non-Goals

**Goals:**

- G-103: the dialect is parsed, and each construct has a distinct class and style.
- Classes and CSS variables that Phase 3's live preview and the G-401 themes can rely on.
- Styles that already obey G-104's limits.
- A pinned parse tree that catches parser changes on dependency bumps.

**Non-Goals:**

- Per-language highlighting inside fenced code (G-307).
- Line wrapping, the editor's line height and the layout checks (`add-soft-wrap`).
- Heading sizes (G-302).
- Any editing behaviour that comes with `lang-markdown`, such as list continuation; that belongs to later editing goals.
- Themes (G-401). This change declares default values only.

## Operator prerequisites

Harness applies these on the host before the run, after a plan review and a diff review, then commits the prep commit and recaptures the baseline. The versions are the ones the research tested (§"Current versions"), pinned exactly. They're runtime dependencies.

```harness-run
npm install -E @codemirror/language@6.12.4 @codemirror/lang-markdown@6.5.2 @codemirror/lang-yaml@6.1.3 @lezer/markdown@1.7.2 @lezer/highlight@1.2.5 @lezer/common@1.5.3
```

Check that every frontend check still passes before anything is committed:

```harness-run
npm run lint
npm test
npm run build
```

In the diff review, expect six new `dependencies` in `package.json`, and `package-lock.json` gaining these packages and their own dependencies, such as `@codemirror/lang-html`. The gate commands don't change.

## Decisions

### The language: `commonmarkLanguage` plus GFM, wrapped by `yamlFrontmatter`

```ts
markdown({
  base: commonmarkLanguage,
  extensions: [GFM, quiroMarkdownTags],
  addKeymap: false,
  completeHTMLTags: false,
  pasteURLAsLink: false,
})
```

This is wrapped as `yamlFrontmatter({ content: … })` from `@codemirror/lang-yaml`.

- **`commonmarkLanguage` with `GFM`, not `markdownLanguage`.** `markdownLanguage` also turns on Subscript, Superscript and Emoji, which makes `~x~` subscript (§1). `GFM` from `@lezer/markdown` is exactly Table, TaskList, Strikethrough and Autolink. The HTML export (G-409) uses pulldown-cmark in GFM mode, and the editor should highlight what the export renders.
- **`yamlFrontmatter` wraps the Markdown language.** The top node is the front-matter `Document`, and the Markdown `Document` sits inside it (§1). Any code that walks the tree must allow for that wrapper, including the fixture test here, Phase 3's decorations and the Phase 6 plugin queries.
- **`addKeymap: false`:** `lang-markdown`'s keymap makes Enter continue list and quote markup and Backspace delete markup. Phase 1 ships CodeMirror's minimal set ([#13](https://github.com/Acero-AD/quiro/issues/13)), and these belong to later editing goals.
- **`completeHTMLTags: false`:** autocompletion is never included, and its data source would be dead weight.
- **`pasteURLAsLink: false`:** by default, pasting a URL over a selection inserts `[selection](url)`. G-101 requires paste to insert plain text.
- **No `codeLanguages`:** fences stay one monospace block until G-307. `markdown()` still parses inline and block HTML through `@codemirror/lang-html` (§1). The highlighter gives HTML no class.

The language extension is built in its own internal file and added to the editor's extensions by `index.ts`. `createEditor`'s signature doesn't change.

### Classes: one `tagHighlighter`, Quiro's own tags, and two block classes

`classHighlighter` can't meet G-103: it has one class for all heading levels and none for code, lists, quotes or strikethrough (§2). So:

- **One `tagHighlighter`** from `@lezer/highlight`, installed with `syntaxHighlighting(...)` from `@codemirror/language`, maps tags to `md-*` classes.
- **Quiro's own tags.** For nodes that Lezer leaves untagged, or tags too broadly, Quiro defines tags with `Tag.define()`. It attaches them with `styleTags` in the `props` of a small `MarkdownConfig` (`quiroMarkdownTags` above), so the class mapping never depends on generic tags such as `atom`, which YAML also uses.
- **Block classes.** Fenced code and front matter get their class as a `Decoration.line` on each of their lines, so the whole block can carry a background. One view plugin computes these from the syntax tree over the visible ranges. Every other class is a mark from the highlighter.

| Construct | Nodes | Class | How |
| --- | --- | --- | --- |
| heading level *n* | `ATXHeadingn`, `SetextHeadingn` and descendants | `md-heading-n` | highlighter (`heading1`…`heading6`) |
| emphasis | `Emphasis` | `md-emphasis` | highlighter |
| strong | `StrongEmphasis` | `md-strong` | highlighter |
| strikethrough | `Strikethrough` | `md-strikethrough` | highlighter |
| inline code | `InlineCode` | `md-code` | highlighter (Quiro tag; `monospace` also covers fenced `CodeText`) |
| fenced code | `FencedCode` lines | `md-code-block` | line decoration |
| link text | `Link` | `md-link` | highlighter |
| URL | `URL`, `Autolink` | `md-url` | highlighter |
| list marker | `ListMark` | `md-list-marker` + `md-syntax-marker` | highlighter (Quiro tag) |
| blockquote | `Blockquote` | `md-quote` | highlighter |
| table | `Table` | `md-table` | highlighter (Quiro tag) |
| task marker | `TaskMarker` | `md-task-marker` + `md-syntax-marker` | highlighter (Quiro tag) |
| front matter | `Frontmatter` lines | `md-front-matter` | line decoration |
| syntax marker | `HeaderMark`, `EmphasisMark`, `StrikethroughMark`, `CodeMark`, `LinkMark`, `TableDelimiter`, `QuoteMark`, `ListMark`, `TaskMarker` | `md-syntax-marker` | highlighter |

Children inherit their parents' classes, so the `#` of a heading carries both `md-heading-1` and `md-syntax-marker`.

[#14](https://github.com/Acero-AD/quiro/issues/14) asks both that "list and quote markers are coloured" and that "every syntax marker shares one dimmed style". It's read like this:
- `md-syntax-marker` marks what Phase 3 hides off the cursor line, and gives the shared dimmed colour.
- `md-list-marker`, `md-task-marker` and the quote's `>` (inside `md-quote`) get their own colour, declared after the syntax-marker rule so that it wins.

### Styles: one theme spec, variables declared on the editor

The Markdown styles are one `EditorView.theme` spec in `src/editor/`, exported inside the module as a plain object so tests can read it. Global CSS would lose to CodeMirror's scoped base theme, and a theme spec applies the same way in the app, under jsdom, and in `add-soft-wrap`'s browser tests.

- **Colours:** every colour and background value is a `var(--md-…)` reference, such as `var(--md-heading)`, `var(--md-syntax-marker)` or `var(--md-code-background)`. The defaults are declared as custom properties on the editor root (`&`) in the same spec. G-401 decides where themes redefine them.
- **Allowed properties:** `color`, `background-color`, `font-weight`, `font-style`, `text-decoration`, `font-family`, and for inline code only, `padding-left` and `padding-right`. No rule sets `font-size`, `line-height` or `vertical-align`, or any vertical `padding`, `margin` or `border`. This includes the `padding` shorthand, which sets vertical padding too. These are G-104's limits ([#15](https://github.com/Acero-AD/quiro/issues/15)), which `add-soft-wrap` tests.
- **Headings** are bold and coloured, all at body size. Heading sizes belong to G-302.
- **Emphasis** is italic, **strong** is bold, and **strikethrough** is struck through.
- **Code:** inline code is monospace on a tinted background. Fenced code lines are monospace on a tinted background.
- **Links and URLs:** link text is coloured, and the URL is dimmed.
- **Front matter** is one muted style; its YAML gets no further classes.

### The dialect fixture and its pinned tree

- **The fixture,** `src/editor/fixtures/dialect.md`, is checked in with LF line endings, which `.gitattributes` enforces on every OS. It uses every construct listed in the spec, and no raw HTML, because cursors don't enter overlay-mounted HTML trees (§4). It stays under 3,000 characters. It's frozen after this change: later changes reuse it and add to it only in code.
- **The tree test** builds an `EditorState` with the editor's language, parses it fully with `ensureSyntaxTree(state, state.doc.length, 5000)`, and walks it with `tree.iterate`. It writes one line per node, `Name from-to`, and compares the result with the checked-in listing `src/editor/fixtures/dialect.tree.txt`. `Tree.toString()` isn't used: it's internal, has no positions, and drops overlay mounts (§4). The front-matter wrapper appears in the listing as the outer `Document`.
- **On a mismatch,** the test fails with a message containing the complete actual listing between clear begin and end markers, plus the path to write it to. Workers can't run the gate commands. So, as with the bindings drift test ([#21](https://github.com/Acero-AD/quiro/issues/21)), the worker writes the listing from the gate output on its fix round, after checking that the listing shows the dialect: Strikethrough, Table, Task and Frontmatter nodes, and no Subscript, Superscript or Emoji. The listing is a few KB, well inside the gate's 64 KB output cap.
- **Dialect tests:** separate tests parse `~x~`, `:smile:` and `~~gone~~` and check which nodes appear.

Node names aren't a declared Lezer API, and patch releases change the tree's shape (§4). The exact pins in the prerequisites keep the listing stable, and a deliberate bump updates it.

### Class tests under jsdom

- **The class test** loads one short snippet per construct through `createEditor` and `load`, calls `forceParsing` on the view (reached with `EditorView.findFromDOM`), and checks that the expected class is in the DOM on the expected text. Short snippets keep every line inside the viewport that jsdom draws: in research, jsdom drew only 36 lines of a long document (§7C). `forceParsing` keeps the test independent of parse timing.
- **The style test** reads the exported theme spec and checks:
  - that every `color` and `background-color` value starts with `var(--md-`;
  - that no heading rule sets `font-size`.
- **The editing tests** send Enter at the end of `- item`, and a `paste` event carrying a URL over a selection, as `add-editor`'s paste test does. They check that the language added no editing behaviour.

All of these are new files under `src/editor/`. `add-editor`'s test files are untouched.

## Manual verification

Run this after this change's PR is merged, on `master`, in `npm run tauri dev`. Record the date, the commit and the machine (CPU, WebKitGTK version, compositor), then the result, in this change's `verification.md`. This change is archived only when the Linux item passes.

**Linux (WebKitGTK):**
- Paste the contents of `src/editor/fixtures/dialect.md` into the editor. Each construct looks distinct from body text and from the others, syntax markers are dimmed, headings are bold and coloured at body size, and both kinds of code are monospace on a tint.

**Windows:** none.

## Risks / Trade-offs

- **[A dependency bump changes the tree's shape]** → The pinned listing fails loudly and prints the new listing. Pins are exact, and a bump is a deliberate change.
- **[Markers that are both coloured and dimmed]** → This interpretation of #14 is recorded above. Phase 3 can only rely on `md-syntax-marker` for hiding.
- **[HTML in a document is parsed but unstyled]** → It reads as plain text, and no G-103 construct needs it.
- **[`yamlFrontmatter` changes the top node]** → Every tree walker must handle the wrapper, as recorded above for later phases.

## Open Questions

- Lezer's strikethrough needs two tildes, but the GFM spec also accepts one (`~x~`). It's unverified whether pulldown-cmark's GFM strikethrough, used by the export (G-409), accepts one tilde. If it does, the editor and the export disagree on `~x~`. This is from [Which Markdown dialect and highlighting does G-103 cover?](https://github.com/Acero-AD/quiro/issues/14).
- Node names and tree shape aren't a declared Lezer API (research, open question 11). This change pins exact versions; whether to assert through highlighting instead stays open.
