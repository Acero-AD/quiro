## Context

`add-large-document-checks`' Linux check failed on catch-up ([`verification.md`](../2026-10-02-add-large-document-checks/verification.md)). With the inspector closed:
- **steady state:** p95 3 at the start and 11 in the middle;
- **end:** p95 29, measured while parsing was still catching up;
- **catch-up:** max 151, and `parseToEndMs` 19,926. With no typing after the jump, the parse reached the end in 3,519.

The editor's language comes from `src/editor/language.ts` (`add-markdown-mode`):

```ts
yamlFrontmatter({ content: markdown({ base: commonmarkLanguage, extensions: [GFM, quiroMarkdownTags], addKeymap: false, completeHTMLTags: false, pasteURLAsLink: false }) })
```

### Root cause

Every keystroke throws away all the background parsing done since the last finished parse. Three facts combine:

1. **CodeMirror saves a partial parse on every document change.** `ParseContext.changes` calls `takeTree`, which stops the running parse at its `parsedPos`, keeps the tree up to there, and turns it into fragments for the next parse (`@codemirror/language` 6.12.4, `dist/index.js` lines 381 and 411). Then `LanguageState.apply` gives the new parse 20 ms (line 536). Between keystrokes, the background worker keeps its parse running without saving it, until it's done or out of budget.
2. **A nested parse reports position 0 while its outer parse runs.** `MixedParse.parsedPos` returns `0` while `baseParse` is set (`@lezer/common` 1.5.3, `dist/index.js` line 1855).
3. **Quiro's Markdown is nested twice.** `markdown()` always adds `parseCode`, a `parseMixed` wrapper for HTML and code (`@codemirror/lang-markdown` 6.5.2, `dist/index.js` line 422), even without code languages. `yamlFrontmatter` then mounts that parser as the inner parse of the document body (`@codemirror/lang-yaml` 6.1.3). So the body's parse reports 0, and the save keeps nothing of it.

**Evidence,** gathered on 2026-10-07 with Node 26 and the repo's pinned packages, on the generated document (seed 105):
- **A trace with real CodeMirror state.** Starting from `EditorState.create`, the trace alternates `ensureSyntaxTree(state, doc.length, F / 5)` with a one-character insertion at the end, where F is one full parse (about 600 ms).
  - With today's language, `parsedPos` stays 0, and the saved tree stays at 3,000 characters (the initial viewport) for all 60 rounds.
  - With the fix below, every round keeps its progress, and the tree covers the whole document after 36 to 41 rounds in three runs.
- **A replay of CodeMirror's scheduling in virtual time:** 100 ms slices 500 ms apart, as on WebKitGTK; a keystroke every 140 ms; 20 ms of parsing per keystroke.

  | Language | Idle | 170 keys, then idle | Typing throughout |
  | --- | --- | --- | --- |
  | today's | 3.5 s | 27 s | never |
  | the fix | 3.0 s | 3.5 s | 3.5 s |

  It reproduces the manual check's 3,519 ms idle and roughly its 19,926 ms after typing.
- **Faster parse slices alone don't help:** with a `requestIdleCallback` stand-in (25 ms slices, 100 ms apart), today's language still never reaches the end while typing.
- **The pinned listing is the same:** today's and the fixed parser give the same node listing for `src/editor/fixtures/dialect.md`, and it equals `src/editor/fixtures/dialect.tree.txt`. The fixture has no raw HTML and no code languages, so `parseCode` never mounted anything in it.

## Goals / Non-Goals

**Goals:**

- Typing keeps background parsing progress, so catch-up meets G-105 on WebKitGTK.
- A gate test that fails if the progress loss comes back.
- A manual check that measures steady state at the end correctly, and isn't skewed by the inspector.

**Non-Goals:**

- Changing CodeMirror's scheduling, such as a `requestIdleCallback` stand-in. That's the fallback below.
- Moving front matter out of `yamlFrontmatter`. That's G-307's problem; see the risks.
- Changing the dialect, the tree shape, the classes or the styles.
- Changing G-105's thresholds.

## Operator prerequisites

None. No dependency is added or removed, and the gate commands don't change.

## Decisions

### Build the Markdown language without `markdown()`

`markdownMode()` in `src/editor/language.ts` becomes:

```ts
const markdownLanguage = new Language(
  commonmarkLanguage.data,
  (commonmarkLanguage.parser as MarkdownParser).configure([GFM, quiroMarkdownTags]),
  [],
  "markdown",
);
return yamlFrontmatter({ content: markdownLanguage });
```

This is the same `Language` that `markdown()` builds internally (its `mkLang`), minus the `parseCode` extension and the support extensions.
- `MarkdownParser` comes from `@lezer/markdown`. At run time, `commonmarkLanguage.parser` is one: `markdown()` itself checks with `instanceof`.
- The function keeps its name, its signature and its comment's intent. The comment changes to say why `markdown()` isn't used.

**What goes, and why it doesn't matter today:**
- **The `parseCode` wrapper:** raw HTML in a document gets no HTML subtree. The highlighter never gave HTML a class (`add-markdown-mode`), and the Markdown parser still produces its own `HTMLBlock` and `HTMLTag` nodes. Fenced code had no code languages, so nothing was mounted there.
- **lang-html's support extensions,** which `markdown()` installs through its default `htmlTagLanguage`. The spec says the language adds no editing behaviour, so dropping them is in line with it.
- **`headerIndent`,** which despite its name is a fold service for heading sections. Quiro has no folding.
- `addKeymap`, `completeHTMLTags` and `pasteURLAsLink` were already off. There's nothing left to turn off.

*Alternative:* write front matter as a Lezer Markdown block extension and drop `yamlFrontmatter`. Markdown would then be the outer parse, and later nested parses inside it, such as G-307's code languages, would be safe. Rejected for now:
- it's a much bigger change: a block parser that has to decide what an unterminated `---` means, a different tree shape, and a rewritten pinned listing;
- `@codemirror/lang-yaml` would become unused, which means a dependency change;
- the minimal fix is enough for G-105.

It's the likely path for G-307 (see the risks).

*Alternative:* a `requestIdleCallback` stand-in, so that CodeMirror parses in 25 ms slices that give way to input. Rejected as the fix: the replay shows it doesn't stop the loss. It's kept as the fallback if catch-up's max stays over 150 ms after this change.

*Alternative:* wait for `@lezer/common` to report a nested parse's real position. That isn't in Quiro's control. See the open questions.

### A gate test that reproduces the loss

A new jsdom test file in `src/editor/` uses only public CodeMirror APIs:
1. It builds a state with `newState` (the editor's full extension set) on `generateLargeDocument(DEFAULT_LARGE_DOCUMENT_SEED)`.
2. It times one full parse, F, with `ensureSyntaxTree(state, state.doc.length, 1e9)` on a fresh state.
3. On a second fresh state, it alternates `ensureSyntaxTree(state, state.doc.length, F / 5)` with `state.update({ changes: { from: state.doc.length, insert: "x" } }).state`. It stops when `syntaxTreeAvailable(state, state.doc.length)` is true, or after 100 rounds.
4. It expects `syntaxTreeAvailable` to be true.

Slices are a fraction of F measured on the same machine, so the round count doesn't depend on the machine's speed. Today's language never moves past 3,000 characters, so even 100 rounds can't pass by chance. The fix needed 36 to 41. The test takes about 5 s, so it sets a 60 s timeout; Vitest's default is 5 s.

### The manual check, corrected

The re-run follows `add-large-document-checks`' method with two changes, which the modified requirement now states:
- **The Web Inspector stays closed while typing.** Open it only to run `loadLargeFixture()` and `typingStats()`.
- **Steady state at the end waits for the parse.** CodeMirror parses at most 100,000 characters past the viewport (`Work.MaxParseAhead`), so the end isn't parsed until the view goes there. Press Ctrl+End, wait without typing until parsing has reached the end, and only then type. With this fix, that's about 3.5 s; `typingStats()`' `parseToEndMs` shows when it happened.

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

If item 4's max is over 150 ms but `parseToEndMs` passes, the progress fix worked, but CodeMirror's 100 ms parse slices are still too long on WebKitGTK. Record it, and propose the `requestIdleCallback` stand-in as a follow-up change. It would be its own change, because it brings its own decisions.

**Windows:** none. G-105 is measured on Linux only.

## Risks / Trade-offs

- **[G-307 brings the loss back]** → Highlighting inside fenced code needs a nested parse of the Markdown body (`parseCode` or `parseMixed`). Under `yamlFrontmatter`, that makes the body report position 0 again, and the new gate test fails. G-307 must then move front matter into a Markdown block extension (the first alternative), or solve the reported position some other way. The test makes the trap visible rather than silent.
- **[HTML inside Markdown has no HTML subtree]** → Nothing uses it now. A later goal that needs it (images in G-308, or rendered HTML) meets the same constraint as G-307.
- **[Catch-up max is still bounded by 100 ms slices]** → Without the restart cost, the worst keystroke should wait behind at most one slice plus its own 20 ms. That's an estimate of about 130 ms on WebKitGTK, which the manual check confirms or refutes. The fallback is the `requestIdleCallback` stand-in.
- **[`as MarkdownParser`]** → It's a cast over a type that `@codemirror/lang-markdown` declares as `Parser`. The exact version pin and the gate's tests keep it honest.

## Open Questions

- Should `@lezer/common`'s `MixedParse.parsedPos` report the inner parse's progress while the outer parse runs? Worth reporting upstream, with the Node trace above as the reproduction.
- After this change, is steady-state typing at the end under 16 ms? The first run's p95 of 29 was measured during catch-up, so it isn't known yet.
