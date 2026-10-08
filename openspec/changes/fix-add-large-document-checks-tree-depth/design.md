## Context

`scripts/patch-lezer-markdown.mjs`, from `fix-add-large-document-checks-end-typing`, makes `@lezer/markdown` 1.8.0 reuse balanced chunks of the previous tree whole. It took steady-state typing at the end of the 50,000-line document from p95 15–17 ms to 6–7 ms on WebKitGTK. The same change went upstream as lezer/markdown#68, whose maintainer asked: "won't this create increasingly deep unbalanced trees if a document is added to top-to-bottom?"

### What happens

Lezer's balancing groups a block's children into anonymous chunks, and treats any child it's given as a leaf. Suppose the next re-parse reuses a chunk that already holds most of the document. Balancing then puts that chunk next to the few new blocks and wraps them in a new chunk, one level taller. The re-parse after that reuses the new chunk whole, and wraps it again.

### Measurements

Gathered on 2026-10-08 with Node 26 and the repo's packages. "Through CodeMirror state" means `EditorState.update` and `ensureSyntaxTree`, as the editor does. "Lezer alone" means `parser.parse(doc, fragments)` with `TreeFragment.applyChanges` and `addTree`.

Tree depth after writing paragraphs one at a time into an empty document. Each row shows start / middle / end, then a fresh parse of the same text:

| Version | Lezer alone, 5,000 paragraphs | Through CodeMirror state, 300 paragraphs |
| --- | --- | --- |
| `@lezer/markdown` 1.8.0 as released | 8 / 8 / 8 (fresh 8) | 4 / 4 / 4 (fresh 4) |
| the current patch (whole-chunk reuse only) | 4,984 / 1,186 / 2,493 (fresh 8) | 284 / 145 / 95 (fresh 4) |
| reuse limited to chunks ≤ 1/8 of the document | end only: 108 (fresh 8) | not run |
| reuse limited to chunks ≤ 1/32 of the document | end only: 39 (fresh 8) | not run |
| this change: height-bounded reuse | 10 / 11 / 11 (fresh 8) | 7 / 7 / 7 (fresh 4); after 1,500 paragraphs, 8 / 8 / 8 (fresh 5) |

The size limits only slow the growth. A small chunk can still be deep inside, because it was built from earlier deep chunks. Bounding by recorded height stops it.

**Freshly balanced chunks** are all within one level of `ceil(log8(children))`. In a fresh parse of the generated document:
- 5,763 chunks are exactly at that height;
- 130 are one level below;
- 30 are one level above.

So a bound of "+1" never rejects a freshly balanced chunk.

**Reuse and cost** after one keystroke at the end of the fully parsed generated document, through CodeMirror state:

| Version | Balanced chunks reused as the same object | Keystroke cost (median) |
| --- | --- | --- |
| as released | 0 of 5,923 | 3.92 ms |
| the current patch | 5,920 of 5,923 | 0.06 ms |
| this change | 5,918 of 5,923 | 0.07 ms |

**Correctness with this change:** the 4,000 seeded edits from the previous change's design, compared with a fresh parse each time, gave no mismatches. The dialect listing equals `src/editor/fixtures/dialect.tree.txt`.

**Upstream:** the same bound, written in `@lezer/markdown`'s TypeScript, passes its 740 tests. Its new depth test fails without the bound.

## Goals / Non-Goals

**Goals:**

- Incremental trees stay about as deep as fresh ones, however the document is written.
- Keystrokes keep the speed that the whole-chunk reuse gave.
- Upgrading an already-patched `node_modules` needs no reinstall.

**Non-Goals:**

- Changing `@lezer/common`'s balancing.
- Following upstream's final design. When lezer/markdown#68, or an equivalent fix, is released, a later change replaces this script with the release.
- Anything outside parsing.

## Operator prerequisites

Harness applies these on the host before the run, after a plan review and a diff review. Then it commits the prep commit and recaptures the baseline.

```harness-run
cp openspec/changes/fix-add-large-document-checks-tree-depth/patch-lezer-markdown.mjs scripts/patch-lezer-markdown.mjs
node scripts/patch-lezer-markdown.mjs
```

The installed package already has the first group, so the second command adds only the second. Check that both markers are present in both builds, and that every frontend check passes, before anything is committed:

```harness-run
grep -c "quiro patch" node_modules/@lezer/markdown/dist/index.js node_modules/@lezer/markdown/dist/index.cjs
npm run lint
npm test
npm run build
```

Each `grep` count is 2. In the diff review, expect only `scripts/patch-lezer-markdown.mjs` to change, identical to this change's copy. `package.json` and `package-lock.json` don't change.

## Decisions

### Bound reuse by recorded height

The second group of edits:
- adds a per-node `NodeProp`, `balanceInfo`, holding `{height, count}`;
- `makeBalanced` gives each chunk that `CompositeBlock.toTree` creates through `balance({makeTree})` its height and count. The height is one more than the tallest child chunk's, and the count is the sum of the child chunks' counts, plus one for each other child;
- `takeNodes` enters a chunk instead of taking it whole when `shallowEnough` is false. That's when the chunk has no `balanceInfo`, or its height is more than `ceil(log8(count)) + 1`. The chunk's children are then reused, and the final balance regroups them.

A chunk that `addChild` re-creates under another context hash loses its `balanceInfo`, and so isn't reused whole. That's conservative, and it costs nothing in correctness.

*Alternative:* limit whole reuse to chunks that are small relative to the document. Rejected: at 1/8 the depth still reached 108, and at 1/32 it reached 39, after 5,000 paragraphs.

*Alternative:* go back to the released parser and accept steady-state typing at the end failing G-105. Rejected: the bound keeps the speed and fixes the depth.

### Two marker groups in one script

The script keeps the first group's edits and marker exactly as they are, and adds a second group with the marker `quiro patch: shallow chunk reuse`. The groups touch different code, so each applies on its own:
- on a fresh install, both apply;
- on a `node_modules` with the first group, only the second applies;
- on a fully patched one, nothing happens.

These were tested on clean copies of 1.8.0. Fresh and upgraded give byte-identical `dist/index.js` and `dist/index.cjs`, and a rerun changes nothing. The CommonJS build loads and parses. The version check and the "this code exactly once" check still fail the install loudly.

### Gate tests

- **`src/editor/chunk-reuse.test.ts` is rewritten.** This design decision authorises it, because the test expresses the requirement this change modifies. CodeMirror builds its first complete tree in several runs, and with the bound, the old tree's first chunk can be too tall to reuse whole. The experiment shows it isn't reused. The test therefore:
  1. collects the old tree's balanced chunks, walking a cursor in `IterMode.IncludeAnonymous` that enters only anonymous nodes;
  2. does the same for the new tree after one keystroke at the end;
  3. expects the old tree to have at least 100 chunks, and at least 90% of them to be in the new tree as the same objects.

  The released parser reuses none of them.
- **A new depth test** writes 300 paragraphs one at a time into a `newState("")` state, at the start, in the middle and at the end, and completes the parse after each.
  - The middle is just after the last paragraph break before the document's midpoint, or the start if there's none.
  - It compares the depth with a fresh `markdownMode().language.parser.parse` of the final text. Depth counts trees only, not tree buffers.
  - It expects the incremental tree to be at most 5 levels deeper. This change gives 3, and the current patch gives 91 to 280.

  The documents stay small, so CodeMirror's time-bounded parsing finishes inside each update, and the result doesn't depend on the machine's speed.

## Manual verification

Run these after this change's PR is merged, on `master`, in `npm run tauri dev`, with the Web Inspector closed whenever you type. Record the results in this change's `verification.md`. The depth is checked in the gate, so this run only confirms that typing is still fast on WebKitGTK.

**Linux (WebKitGTK):**
1. **Steady state, end:**
   - load the fixture with `await window.quiroDev.loadLargeFixture()`, then close the inspector;
   - click into the editor, press Ctrl+End, and wait 10 s;
   - type about 100 keys, then run `window.quiroDev.typingStats()`.

   The p95 is under 16 ms.
2. **Writing a document:** in a new empty document, type about 50 short paragraphs, each followed by Enter twice. Typing stays fluid throughout.

**Windows:** none.

## Risks / Trade-offs

- **[The bound rejects a chunk that was fine to reuse]** → That chunk's children are reused instead. It's a little more work but always correct, and the cost per keystroke stayed at 0.07 ms.
- **[Upstream picks a different design]** → Quiro's script follows the release, as planned.
- **[A third group of edits later]** → The marker-per-group structure takes it. Each group still checks its code exactly once.

## Open Questions

- Will lezer/markdown#68 take this bound, or a balancing change in `@lezer/common`?
