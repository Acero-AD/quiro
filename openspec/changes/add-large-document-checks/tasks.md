## 1. Generator and load budget

- [ ] 1.1 A new module outside `src/editor/` exports `generateLargeDocument(seed: number): string` and a default seed constant. It uses a seeded PRNG, never `Math.random`, and imports nothing from `@codemirror/*` or `@lezer/*`.
- [ ] 1.2 The generated text starts with front matter, and its sections use headings of several levels, prose with emphasis, strong, strikethrough, inline code and links, bullet and ordered lists, `- [ ]` and `- [x]` task items, `> ` quotes, fenced code blocks and tables.
- [ ] 1.3 A jsdom test checks that the same seed gives identical text and that two different seeds give different text.
- [ ] 1.4 A jsdom test checks that the default-seed text has exactly 50,000 lines, a length between 4,000,000 and 6,000,000 characters, and contains front matter at the start, an ATX heading, `**`, `~~`, a fenced code block, a table delimiter row, `- [ ]`, `- [x]` and `> `.
- [ ] 1.5 A jsdom test generates the default-seed text first, then times one `load(text)` call on a new editor made with `createEditor`, and asserts that it took under 250 ms.
- [ ] 1.6 No large Markdown file is added to the repository, earlier test files are unchanged, and `npm run lint`, `npm test` and `npm run build` pass in the gate.

## 2. Timing probe and dev tools

- [ ] 2.1 `src/editor/index.ts` exports `startTypingProbe(editor: Editor): TypingProbe`, the `TypingProbe` type (`read()`, `reset()`, `stop()`), the `TypingStats` type, and a pure `summarizeSamples(samples: number[])` returning `{ count, medianMs, p95Ms, maxMs }`. None mentions a CodeMirror or Lezer type.
- [ ] 2.2 The probe records each `keydown` event's `timeStamp` with a capture-phase listener on the content element. It adds an update listener to the running view with `StateEffect.appendConfig`, and on the first document change after a recorded key, stores `performance.now() - timeStamp` as one sample.
- [ ] 2.3 The probe records when the main cursor first lands on the document's last line, and when `syntaxTreeAvailable(state, state.doc.length)` first becomes true after that. `read()` reports the difference as `parseToEndMs`, or `null`.
- [ ] 2.4 `stop()` removes the probe's `keydown` listener and stops recording.
- [ ] 2.5 `src/dev-tools.ts`'s `installDevTools` takes the window's `Editor` and sets `window.quiroDev = { checkLayout, loadLargeFixture, typingStats }`. `src/main.ts` passes the editor in, still only inside `if (import.meta.env.DEV)`.
- [ ] 2.6 `loadLargeFixture()` generates the default-seed text, then calls `editor.load(text)`. After the next animation frame and a zero-delay timeout, it logs the milliseconds since just before `load` as load-to-first-paint. It then stops any earlier probe and starts a new one.
- [ ] 2.7 `typingStats()` prints the probe's `read()` result with `console.table`, returns it, and resets the probe. Without an earlier `loadLargeFixture()`, it prints a hint to run it.
- [ ] 2.8 A jsdom test checks `summarizeSamples`: the median of `[3, 1, 2]` is 2 and of `[1, 2, 3, 4]` is 2.5, the p95 of the numbers 1 to 100 is 95 and the max is 100, and an empty input gives `count` 0.
- [ ] 2.9 `add-soft-wrap`'s production-bundle test and every other earlier test file are unchanged, and `npm run lint`, `npm test` and `npm run build` pass in the gate.
