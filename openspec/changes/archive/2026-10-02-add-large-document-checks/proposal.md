## Why

G-105 asks that a 50,000-line Markdown file opens in under 1 s and that typing stays under 16 ms. Phase 1 has no file opening. Its share of "opens" is `load()` up to the first paint, and the real typing numbers can only come from WebKitGTK, which the gate can't run. This change adds what measures both:
- a seeded large-document generator;
- a gate test that catches work growing with the whole document;
- dev-only timing tools for the manual WebKitGTK check.

The decisions come from:
- [How is the large-document budget measured and enforced?](https://github.com/Acero-AD/quiro/issues/17);
- [How are WebKitGTK-only behaviours verified when the gate cannot run WebKitGTK?](https://github.com/Acero-AD/quiro/issues/20), which rejected a Chromium typing benchmark;
- research [How does lang-markdown parse and highlight GFM, and how does CodeMirror 6 scale to 50,000 lines?](https://github.com/Acero-AD/quiro/issues/7);
- [How does the work split into OpenSpec changes and tasks.md sections?](https://github.com/Acero-AD/quiro/issues/19).

End-to-end open time, from Ctrl+O to text on screen, moved to G-202 in Phase 2.

## What Changes

- **A seeded, deterministic generator** builds the large document at run time: 50,000 lines, about 5 MB, using every construct of the dialect. The same seed always gives the same text, and no large file is checked in.
- **A gate test:** under jsdom, `load()` of the generated document returns in under 250 ms, about 10 times the expected cost. It catches work that grows with the whole document, such as a forced full parse, without being flaky on a busy machine.
- **A dev-only timing probe inside the editor module.** It measures keystroke processing time, from the key event's timestamp until the editor has applied the change, and notes when parsing reaches the end of the document.
- **Dev builds add two functions to `window.quiroDev`:**
  - `loadLargeFixture()` loads the generated document and logs load-to-first-paint;
  - `typingStats()` prints and resets the median, p95 and max keystroke time, plus how long parsing took to reach the end after a jump to the end.

  The production bundle contains neither, which is checked by `add-soft-wrap`'s bundle test, unchanged.
- **The real thresholds are a recorded manual check on WebKitGTK:**
  - load-to-first-paint under 1 s;
  - in steady state, a p95 under 16 ms at the start, middle and end;
  - in catch-up after a jump to the end, no keystroke over 150 ms, and parsing reaching the end within 5 s.

## Capabilities

### New Capabilities

- `large-documents`: the seeded generator, the jsdom load budget, the dev-only `loadLargeFixture()` and `typingStats()`, and the WebKitGTK thresholds checked by hand.

### Modified Capabilities

None. `window.quiroDev` staying out of production is already a `developer-checks` requirement, added by `add-soft-wrap`.

## Impact

- **Operator prerequisites:** none. There are no new packages, and nothing changes in the configuration.
- **Code:**
  - a new generator module outside `src/editor/`;
  - a timing probe inside `src/editor/`, exported from `index.ts` for the dev tools only;
  - `src/dev-tools.ts` gains the two functions, and `installDevTools` now takes the editor;
  - `src/main.ts` passes the editor in.
- **Tests:** new jsdom tests for the generator, the load budget and the stats calculation. Earlier tests are untouched.
- **CI:** no performance checks, because shared runners are too noisy. The jsdom budget test runs there like any other test.
- **Run order:** fifth and last Phase 1 change, after `add-soft-wrap` is archived.
- **Manual check:** the WebKitGTK numbers after the merge, recorded with the CPU and WebKitGTK version. There are no Windows items.
