## Context

After `add-soft-wrap`:
- the editor parses and highlights the dialect and wraps lines;
- dev builds load `src/dev-tools.ts`, which sets `window.quiroDev = { checkLayout }`;
- a `node` test proves that the production bundle contains no `quiroDev`;
- `npm test` runs a jsdom project and a Chromium browser project.

Sources:
- [How is the large-document budget measured and enforced?](https://github.com/Acero-AD/quiro/issues/17): what "opens" means in Phase 1, the fixture, what typing latency means, the scenarios and thresholds, and the dev console API;
- [How are WebKitGTK-only behaviours verified when the gate cannot run WebKitGTK?](https://github.com/Acero-AD/quiro/issues/20): no Chromium typing benchmark, and results recorded in `verification.md`;
- research [How does lang-markdown parse and highlight GFM, and how does CodeMirror 6 scale to 50,000 lines?](https://github.com/Acero-AD/quiro/issues/7), in `docs/research/cm6-markdown-and-large-docs.md` on branch `research/cm6-markdown-and-large-docs`. Its findings §5 to §8 are cited below;
- [How does the work split into OpenSpec changes and tasks.md sections?](https://github.com/Acero-AD/quiro/issues/19).

The research measured, in V8, on a 5.2 MB, 50,000-line document:
- opening to first paint took 10–50 ms, because only the viewport is parsed and drawn;
- keystrokes took 1–2 ms with a partial tree, about 7 ms once a complete tree exists, and up to about 25 ms while parsing catches up;
- a full parse took about 0.5–0.6 s.

WebKitGTK has no `requestIdleCallback`, so CodeMirror parses there in 100 ms slices that typing can't interrupt (§5, §8). No WebKitGTK number was measured.

## Goals / Non-Goals

**Goals:**

- G-105, in Phase 1's terms: `load()` to first paint, and keystroke processing time, both measured on WebKitGTK.
- A gate test that catches work growing with the whole document.
- One generator shared by the gate test and the dev tools, so both measure the same document.

**Non-Goals:**

- End-to-end open time from Ctrl+O, which moved to G-202.
- Performance checks in CI, because shared runners are too noisy.
- A Chromium typing benchmark, which #20 rejected.
- An on-screen overlay. Phase 1 has no app chrome.

## Operator prerequisites

None. This change adds no package and changes no configuration or gate command.

## Decisions

### The generator: seeded, outside the editor module

A new module outside `src/editor/`, for example `src/large-document.ts`, exports `generateLargeDocument(seed: number): string` and a default seed constant.

- **Randomness:** a small seeded PRNG, such as mulberry32. Never `Math.random`.
- **Shape:** the text starts with front matter, then repeats sections built from every construct: headings of several levels, prose paragraphs with emphasis, strong, strikethrough, inline code and links, bullet and ordered lists, task items, quotes, fenced code blocks and tables.
- **Size:** it stops at exactly 50,000 lines, with a total length between 4 and 6 MB. The research document averaged about 104 characters per line (§7), which is heavy for prose. Whether the mix is representative stays an open question.
- **Not bundled:** it doesn't depend on CodeMirror. Only tests and `src/dev-tools.ts` import it, so it never reaches the production bundle.

### The gate budget: `load()` under 250 ms under jsdom

A jsdom test generates the document first, outside the measurement. It then times one `editor.load(text)` call on a new editor with `performance.now()`, and asserts it's under 250 ms.

CodeMirror's own cost here is a state creation that parses at most 3,000 characters, plus drawing the viewport (§5). A forced full parse would cost about 0.5 s in V8, so the test catches that kind of regression with room to spare on a busy machine. Typing isn't tested in the gate: the public interface can't type, and gate timings are noisy.

### The timing probe: inside `src/editor/`, started by the dev tools

ADR 0001 allows a dev-only hook inside `src/editor/`. `src/editor/index.ts` exports:
- `startTypingProbe(editor: Editor): TypingProbe`, where `TypingProbe` has `read(): TypingStats`, `reset(): void` and `stop(): void`;
- a pure `summarizeSamples(samples: number[]): { count: number; medianMs: number; p95Ms: number; maxMs: number }`.

`TypingStats` adds `parseToEndMs: number | null` to that summary. No exported type mentions CodeMirror. Only `src/dev-tools.ts` imports these, so production tree-shakes them away. `add-soft-wrap`'s bundle test covers that unchanged, because everything hangs off `quiroDev`.

**Finding the view:** inside the module, `createEditor` records each editor's view in a module-private `WeakMap`, which the probe uses.

**How it measures:**
- **The key:** a capture-phase `keydown` listener on the content element records the event's `timeStamp`. That's the key event's time on the same clock as `performance.now()`, whether or not this holds in WebKitGTK stays an open question.
- **The change:** the probe adds an update listener to the running view with `StateEffect.appendConfig`. On the first document change after a recorded key, it stores `performance.now() - timeStamp` as one sample and clears the recorded key. This is the time until the editor has applied the change, and it includes any wait behind a parse slice. It excludes the wait for the next frame, which the research found is dominated by vsync (§7B).
- **Parsing reaching the end:** the same listener records the time when the main cursor first lands on the last line (the jump), and the time when `syntaxTreeAvailable(state, state.doc.length)` first becomes true afterwards. `parseToEndMs` is the difference, or `null` if either hasn't happened. CodeMirror's background parser dispatches an update as the tree grows, so the listener sees it.
- **Why the probe starts after `load`:** `load` installs a new state and drops appended configuration. So `loadLargeFixture()` starts the probe after loading, and stops the previous probe first.
- **Percentiles:** p95 uses the nearest-rank method. With about 100 samples, it's the 95th smallest.

### `window.quiroDev` gains two functions

`installDevTools(editor: Editor)` now takes the window's editor, and `src/main.ts` passes it in, still only inside `if (import.meta.env.DEV)`. It sets `window.quiroDev = { checkLayout, loadLargeFixture, typingStats }`:

- **`loadLargeFixture()`:**
  1. generates the document with the default seed;
  2. records `performance.now()` and calls `editor.load(text)`;
  3. waits for the next animation frame and then a zero-delay timeout, which runs just after that frame is painted;
  4. logs the elapsed time as load-to-first-paint;
  5. stops any earlier probe and starts a new one.
- **`typingStats()`** reads the probe and prints the result with `console.table`. It returns the same object, and resets the samples and the jump and parse marks. It prints a hint if `loadLargeFixture()` hasn't run.

### Tests

All tests are new files under `src/`. Earlier test files, including the production-bundle test, are unchanged.
- **Generator:**
  - the same seed gives identical text;
  - two seeds give different text;
  - the line count is exactly 50,000, and the length is between 4,000,000 and 6,000,000 characters;
  - the text contains front matter at the start, ATX headings, `**`, `~~`, a fenced code block, a table delimiter row, `- [ ]` and `- [x]` task items, and `> ` quotes.
- **Budget:** `load()` of the generated document under 250 ms, as above.
- **Stats:** `summarizeSamples` on known inputs: the median of an odd and an even count, the nearest-rank p95 of 1 to 100 (95), the max, and an empty input (count 0).

## Manual verification

Run these after this change's PR is merged, on `master`, in `npm run tauri dev`, with the editor focused. Record:
- the date, the commit and the machine (CPU model, WebKitGTK version, compositor);
- every `typingStats()` output and the load-to-first-paint figure, in this change's `verification.md`.

This change is archived only when every Linux item passes. A failed item becomes a `fix-add-large-document-checks-<what>` change.

**Linux (WebKitGTK),** in the inspector console (right-click, then Inspect Element):
1. **Load:** run `window.quiroDev.loadLargeFixture()`. Load-to-first-paint is under 1 s.
2. **Steady state:** wait 2 s. Then type about 100 keys at each position below, running `window.quiroDev.typingStats()` after each. Each p95 is under 16 ms.
   - the start of the document;
   - the middle (Ctrl+Home, then PageDown until about line 25,000; or click in the middle of the scrollbar);
   - the end (Ctrl+End).
3. **Catch-up:** run `loadLargeFixture()` again, press Ctrl+End at once, and type about 100 keys. Then run `typingStats()`. No keystroke is over 150 ms, and `parseToEndMs` is at most 5,000.

**Windows:** none. G-105 is measured on Linux only.

## Risks / Trade-offs

- **[WebKit rounds `performance.now()` to 1 ms]** → Single-key samples are quantised to 1 ms. A p95 against a 16 ms threshold still has room, and the max against 150 ms is unaffected. Batching keys would trade per-key data for precision. That's left open, and the threshold isn't changed.
- **[The probe changes what it measures]** → The update listener does constant work per transaction, small next to the measured costs.
- **[250 ms is too tight or too loose on the gate machine]** → Tune it once real gate numbers exist, keeping its purpose: catching work that grows with the whole document.
- **[The generator's mix differs from real notes]** → The thresholds hold for a heavy document. Real notes are expected to be 1–3 MB (§7, open question 8).

## Open Questions

From [How is the large-document budget measured and enforced?](https://github.com/Acero-AD/quiro/issues/17):

- WebKit rounds `performance.now()` to 1 ms outside cross-origin isolation. Is that precise enough for a p95 over about 100 keys? Is `event.timeStamp` on the same clock in WebKitGTK, as the spec says?
- Is the generator's line-length mix representative? The research used about 104 characters per line on average.
- Does 250 ms hold on the gate machine under load?
