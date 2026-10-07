## Context

`add-large-document-checks`' Linux check failed on catch-up ([`verification.md`](../2026-10-02-add-large-document-checks/verification.md)). With the inspector closed:
- **steady state:** p95 3 at the start and 11 in the middle;
- **end:** p95 29, measured while parsing was still catching up;
- **catch-up:** max 151, and `parseToEndMs` 19,926. With no typing after the jump, the parse reached the end in 3,519.

Before this change, the editor's language in `src/editor/language.ts` (`add-markdown-mode`) was:

```ts
yamlFrontmatter({ content: markdown({ base: commonmarkLanguage, extensions: [GFM, quiroMarkdownTags], addKeymap: false, completeHTMLTags: false, pasteURLAsLink: false }) })
```

### Root cause

Typing throws away the background parsing done since the last finished parse. Three facts combine:

1. **CodeMirror saves a running parse at the position the parser reports.** On every document change, `ParseContext.changes` calls `takeTree`, which stops the running parse at its `parsedPos`, keeps the tree up to there, and turns it into fragments for the next parse (`@codemirror/language` 6.12.4, `dist/index.js` lines 381 and 411). `LanguageState.apply` then gives the new parse 20 ms (line 536). If those 20 ms don't get back to the old position, `takeTree` saves less than before.
2. **A nested parse reports position 0 until its outer pass is done.** `MixedParse.parsedPos` returns `0` while `baseParse` is set (`@lezer/common` 1.5.3, `dist/index.js` line 1855).
3. **The old language nested the Markdown parse twice.**
   - `markdown()` always adds `parseCode`, a `parseMixed` wrapper for HTML and code, even without code languages (`@codemirror/lang-markdown` 6.5.2, `dist/index.js` line 422).
   - `yamlFrontmatter` (`@codemirror/lang-yaml` 6.1.3) wraps the whole document in another `parseMixed`. Its outer pass parses every line of the document to find the front matter's end. On the generated document, that pass alone takes 53 to 65 ms: 50,001 `advance()` calls, all reporting position 0.

### What section 1 showed

Section 1 removed the inner wrapper. On the developer's machine, a trace with real CodeMirror state then reached the end of the document, where the old language never got past 3,000 characters. CI failed on Ubuntu and Windows, though: the timed test ran 100 rounds without reaching the end.

**Evidence.** All of it was gathered on 2026-10-07 with Node 26, the repo's pinned packages and the generated document (seed 105). To imitate slower machines, the clocks CodeMirror reads were made to run k times faster, so that each time-bounded slice does 1/k of the work. Rounds needed to reach the end, in section 1's test loop:

| Emulated CPU | Section 1 (outer `yamlFrontmatter` kept) | Section 2 (front matter in the Markdown parser) |
| --- | --- | --- |
| 1× (developer's Ryzen 7 5800X) | 40 | 20 |
| 2× slower | never; stalls at about 1.6 MB | 41 |
| 3× slower | never; back to 0 | 68 |
| 4× slower | never; back to 0 | 85 |

The outer `yamlFrontmatter` pass has to fit in the 20 ms that CodeMirror gives each keystroke. When it doesn't, the save keeps nothing.

**Replay of CodeMirror's WebKitGTK scheduling,** in virtual time: 100 ms slices 500 ms apart, because WebKitGTK has no `requestIdleCallback`; a keystroke every 140 ms; 20 ms of parsing per keystroke. Section 2's language reaches the end in 1.8 s while typing, and in 3.7 to 3.9 s on a 2× slower CPU. The slowest keystroke is about 105 ms. The replay of the old language reproduced the manual check: 3.5 s idle, and 27 s after 170 keys.

**Reported progress, by counting parse steps.** After 1,000, 2,000 and 3,000 `advance()` calls on the generated document:
- the old language reports `parsedPos` 0 / 0 / 0;
- section 1's language also reports 0 / 0 / 0;
- section 2's reports 251,634 / 501,668 / 746,593.

## Goals / Non-Goals

**Goals:**

- Typing keeps background parsing progress on any reasonable machine, so catch-up meets G-105 on WebKitGTK.
- A deterministic gate test that fails if the parser stops reporting its progress.
- A manual check that measures steady state at the end correctly, and isn't skewed by the inspector.

**Non-Goals:**

- Changing CodeMirror's scheduling, such as a `requestIdleCallback` stand-in. That's the fallback below.
- Changing what counts as front matter, the dialect, the classes or the styles.
- Parsing or styling the YAML inside front matter.
- Removing `@codemirror/lang-yaml` from `package.json`. It's a dependency change, so it's a separate cleanup.
- Changing G-105's thresholds.

## Operator prerequisites

None. No dependency is added or removed, and the gate commands don't change.

## Decisions

### Build the Markdown language without `markdown()` (section 1)

The language is `new Language(commonmarkLanguage.data, (commonmarkLanguage.parser as MarkdownParser).configure([...]), [], "markdown")`. That's the same `Language` that `markdown()` builds internally (its `mkLang`), minus `parseCode` and the support extensions.
- `MarkdownParser` comes from `@lezer/markdown`. At run time, `commonmarkLanguage.parser` is one: `markdown()` itself checks with `instanceof`.

**What goes, and why it doesn't matter today:**
- **The `parseCode` wrapper:** raw HTML in a document gets no HTML subtree. The highlighter never gave HTML a class, and the Markdown parser still produces its own `HTMLBlock` and `HTMLTag` nodes. Fenced code had no code languages.
- **lang-html's support extensions.** The spec says the language adds no editing behaviour, so dropping them is in line with it.
- **`headerIndent`,** a fold service for heading sections. Quiro has no folding.

### Recognise front matter in the Markdown parser (section 2)

`yamlFrontmatter` goes. A new internal file, `src/editor/front-matter.ts`, exports a `MarkdownConfig` called `frontMatter`, and the language's parser is configured with `[GFM, quiroMarkdownTags, frontMatter]`. `markdownMode()` returns `new LanguageSupport(language)`.

`frontMatter`:
- **Nodes:** it defines `Frontmatter` as a block node, plus `DashLine` and `FrontmatterContent`.
  - `Frontmatter` keeps its name, so `src/editor/blocks.ts` still gives its lines `md-front-matter`.
  - `DashLine` keeps the name `lang-yaml` used.
- **Block parser:** it has one, named `Frontmatter`, with `before: "LinkReference"`, so it runs before every built-in block parser. It matches only when the line starts at document position 0 and its text is exactly `---`. Then it consumes lines until it has consumed one whose text is exactly `---`. Without such a line, it consumes to the end of the document.
- **Ranges:**
  - `Frontmatter` runs from 0 to the end of its last line, not including that line's break;
  - each `---` line is a `DashLine` of 3 characters;
  - the text between them, if there is any, is one `FrontmatterContent`. Unterminated front matter has no closing `DashLine`.

This recognises exactly what `yamlFrontmatter` did today. Both were probed on the same inputs:

| Input | Today and with `frontMatter` |
| --- | --- |
| `---`, `title: a`, `---`, `# x` | front matter |
| front matter at the very end, without a final line break | front matter |
| `---`, `---`, `text` (empty) | front matter |
| `---`, `title: a`, `...`, `# x` | front matter to the end of the document (`...` doesn't close it) |
| `---`, `title: a`, `# x` (unterminated) | front matter to the end of the document |
| `--- ` with a trailing space | not front matter |
| `----` | not front matter |
| a blank first line, then `---` | not front matter |
| `text`, then `---` | not front matter |

**What changes in the tree:**
- there's no outer front-matter `Document` and no YAML subtree;
- `Frontmatter` no longer includes the line break after its closing line;
- an unterminated block has no error node.

In the dialect fixture's listing, lines 2 to 13 become `Frontmatter 0-30`, `DashLine 0-3`, `FrontmatterContent 4-26` and `DashLine 27-30`. Every other line is identical, as checked against the prototype. So `src/editor/fixtures/dialect.tree.txt` is rewritten from the dialect test's failure output, as `add-markdown-mode`'s design foresaw for a deliberate change.

`src/editor/blocks.ts` doesn't change its logic. Its comment that front matter "ends after its closing line break" becomes wrong, and is reworded.

*Alternative:* keep `yamlFrontmatter` around the plain Markdown language, which is section 1 alone. Rejected by CI and by the emulation above: its outer pass doesn't fit in 20 ms on a machine about twice as slow as the developer's.

*Alternative:* a `requestIdleCallback` stand-in, so that CodeMirror parses in 25 ms slices. Rejected as the fix: in the replay, the old language still never reaches the end while typing. It stays the fallback if catch-up's max is over 150 ms.

*Alternative:* wait for `@lezer/common` to report a nested parse's real position. That isn't in Quiro's control. See the open questions.

### A gate test that counts parse steps (section 2 replaces section 1's)

Section 1's test timed slices as a fraction of one full parse. That couldn't work: CodeMirror's 20 ms per keystroke doesn't scale with the machine, so the result depended on the runner's speed.

Section 2 rewrites `src/editor/parse-progress.test.ts`. This design decision authorises it, because the test was added by this same, unmerged change. The new test:
1. calls `markdownMode().language.parser.startParse(doc)` on `generateLargeDocument(DEFAULT_LARGE_DOCUMENT_SEED)`;
2. calls `advance()` 1,000 times, and expects `parsedPos` above 0;
3. calls `advance()` 1,000 more times, and expects `parsedPos` to be higher than before.

No clock is involved, so the result is the same on every machine, and it takes milliseconds. Any `parseMixed` wrapper around the whole parser reports 0 and fails it.

A second new jsdom test file checks the front-matter cases in the table above, with the editor's language.

### The manual check, corrected

The re-run follows `add-large-document-checks`' method with two changes, which the modified requirement now states:
- **The Web Inspector stays closed while typing.** Open it only to run `loadLargeFixture()` and `typingStats()`.
- **Steady state at the end waits for the parse.** CodeMirror parses at most 100,000 characters past the viewport (`Work.MaxParseAhead`), so the end isn't parsed until the view goes there. Press Ctrl+End, wait without typing until parsing has reached the end, and only then type.

## Manual verification

Run these after this change's PR is merged, on `master`, in `npm run tauri dev`, with the Web Inspector closed whenever you type. Record:
- the date, the commit, and the machine (CPU, WebKitGTK version, compositor);
- every `typingStats()` output and load-to-first-paint figure.

Put them in this change's `verification.md`. This change is archived only when every Linux item passes.

**Linux (WebKitGTK):**
1. **Load:** `await window.quiroDev.loadLargeFixture()`. Load-to-first-paint is under 1 s.
2. **Steady state, start and middle:** wait 2 s. Close the inspector, click into the editor, and type about 100 keys at the start (Ctrl+Home). Reopen the inspector and run `window.quiroDev.typingStats()`. Do the same in the middle (click halfway down the scrollbar). Each p95 is under 16 ms.
3. **Steady state, end:** load the fixture again and close the inspector. Click into the editor, press Ctrl+End, and wait 10 s without typing. Then type about 100 keys, reopen the inspector, and run `typingStats()`. The p95 is under 16 ms.
4. **Catch-up:** load the fixture again and close the inspector. Click into the editor, press Ctrl+End at once, and type about 100 keys. Reopen the inspector and run `typingStats()`. The max is at most 150 ms, and `parseToEndMs` is at most 5,000.
5. **Front matter still looks the same:** paste `src/editor/fixtures/dialect.md`. Its first three lines are muted as front matter, and nothing after them is.

If item 4's max is over 150 ms but `parseToEndMs` passes, the parse fix worked, but CodeMirror's 100 ms slices are still too long on WebKitGTK. Record it, and propose the `requestIdleCallback` stand-in as a follow-up change.

**Windows:** none. G-105 is measured on Linux only.

## Risks / Trade-offs

- **[G-307 can't simply wrap the parser]** → Highlighting inside fenced code is usually done with `parseCode` or `parseMixed` around the whole Markdown parser, which reports 0 and fails the new gate test. G-307 has to decide how to nest code languages without hiding the parser's progress. That might be a wrapper that reports the base parse's position, or evidence that a top-level wrapper is harmless enough to relax the test. The test makes the choice explicit rather than silent.
- **[CodeMirror's 20 ms per keystroke is fixed]** → Even with no nesting, after each keystroke CodeMirror re-parses from fragments for 20 ms and saves only what it reached. On very slow machines (6× slower in the emulation), typing continuously through a 5 MB catch-up still makes slow progress. That's CodeMirror's design and outside G-105, which is measured on the developer's machine.
- **[HTML inside Markdown has no HTML subtree]** → Nothing uses it now. A later goal that needs it (images in G-308, or rendered HTML) meets the same constraint as G-307.
- **[The YAML in front matter isn't parsed]** → Nothing styles it, and no goal reads it yet. A later goal that needs the YAML can parse `FrontmatterContent`'s text separately, without nesting the editor's parse.
- **[Catch-up max is bounded by 100 ms slices]** → In the replay, the slowest keystroke was about 105 ms. The manual check confirms or refutes this on WebKitGTK; the fallback is the `requestIdleCallback` stand-in.
- **[`@codemirror/lang-yaml` stays installed but unused]** → Nothing imports it, so it isn't bundled. Remove it in a later cleanup with an operator prerequisite.
- **[`as MarkdownParser`]** → It's a cast over a type that `@codemirror/lang-markdown` declares as `Parser`. The exact version pin and the gate's tests keep it honest.

## Open Questions

- Should `@lezer/common`'s `MixedParse.parsedPos` report the base parse's progress? Worth reporting upstream, with the count-based reproduction above. A fix there would also open up G-307's options.
- After this change, is steady-state typing at the end under 16 ms? The first run's p95 of 29 was measured during catch-up, so it isn't known yet.
