## Why

`fix-add-large-document-checks-end-typing` patched `@lezer/markdown` so that a keystroke reuses the old syntax tree's balanced chunks whole. When the change went upstream as lezer/markdown#68, its maintainer asked whether that would make trees deeper and unbalanced when a document is written top to bottom. It does.

Each re-parse keeps a chunk that already holds almost the whole document as one unit, and balances the few new blocks next to it. The next re-parse wraps that result again. Through CodeMirror state, after 300 paragraphs, the tree is 95 levels deep when writing at the end, 145 in the middle and 284 at the start, against 4 for a fresh parse of the same text. With Lezer alone, after 5,000 paragraphs, it reaches 2,493 levels at the end and 4,984 at the start.

The text and the highlighting stay correct, and opening a file starts a fresh tree. But anything that walks the tree gets slower as you write, and recursive tree code could eventually exceed the stack.

## What Changes

- **The patch script gains a second group of edits**, with its own marker. Chunks created by balancing record their height and how many children they hold. A chunk is reused whole only when it's at most one level taller than a freshly balanced chunk of the same size; otherwise its children are reused and rebalanced.
  - **Depth:** through CodeMirror state, the depth stays 3 levels above a fresh parse after 300 and 1,500 paragraphs, at the start, the middle and the end.
  - **Speed:** a keystroke on the fully parsed 5 MB document costs 0.07 ms, against 3.9 ms unpatched.
  - **Correctness:** 4,000 fuzzed edits matched a fresh parse, and the dialect listing doesn't change.
- **The first group is unchanged.** On a fresh install, both groups apply. On a `node_modules` that already has the first, only the second applies. Both paths give byte-identical files.
- **The chunk-reuse gate test changes.** With the bound, the old tree's very first chunk can be too tall to reuse whole, so the test now checks that at least 90% of the old tree's balanced chunks are in the new tree as the same objects. It was 5,918 of 5,923 in the experiment.
- **A new gate test** writes 300 paragraphs at the start, the middle and the end, and requires the tree to stay within 5 levels of a fresh parse. With the current patch, it's 91 to 280 levels off.
- **The same bound is proposed upstream** as a second commit on lezer/markdown#68.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `large-documents`:
  - "A keystroke reuses the unchanged tree whole": the scenario checks that most balanced chunks survive, instead of the first one;
  - new requirement "Writing in one place keeps the tree shallow".

## Impact

- **Operator prerequisites:** `scripts/patch-lezer-markdown.mjs` is replaced by this change's copy and run once. `package.json` and `package-lock.json` don't change, and CI's `npm ci` applies both groups.
- **Code:** nothing under `src/` except tests.
- **Tests:** `src/editor/chunk-reuse.test.ts` is rewritten, as `design.md` authorises, and there's one new test file.
- **Manual check:** a short WebKitGTK run to confirm typing is still fast. The depth itself is checked in the gate.
