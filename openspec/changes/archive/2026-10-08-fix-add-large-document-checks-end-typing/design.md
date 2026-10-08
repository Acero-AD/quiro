## Context

After `fix-add-large-document-checks-catch-up`, G-105's Linux check passes everywhere except steady-state typing at the end of the generated document ([`verification.md`](../2026-10-07-fix-add-large-document-checks-catch-up/verification.md)). Three runs, each after the parse had reached the end, gave p95 16, 17 and 15 ms, with medians of 6 to 7 ms. At the start and in the middle, the medians were 0 to 2 ms.

The operator chose to make typing cheaper rather than revise G-105's target.

### Root cause

**It's not about the end; it's about a complete tree.** Keystroke transactions were measured with `EditorState.update` on the editor's current language, with `@lezer/markdown` 1.7.2 and the generated document. Medians, with p95 in brackets:

| Tree | Where the key lands | Cost per keystroke |
| --- | --- | --- |
| parsed to 100,000 characters | start | 0.09 ms (0.12) |
| whole document | start | 3.42 ms (6.15) |
| whole document | middle | 3.46 ms (4.50) |
| whole document | end | 3.29 ms (4.63) |

Once the tree covers the whole document, `LanguageState.apply` re-parses to its end after every change: `upto` is `undefined` when `treeLen` equals the document length (`@codemirror/language` 6.12.4, `dist/index.js` line 526). At the start and in the middle, the manual check never had a complete tree, which is why only the end was slow.

**Where the time goes.** A CPU profile of 600 keystrokes on the fully parsed document, with each function's time including what it calls:
- `reuseFragment` and `takeNodes`, which re-add the reused blocks: 36%;
- `finish`, `toTree` and `balance`, which rebuild the document's list of top-level blocks: 33%.

**The mechanism** (`@lezer/markdown` 1.8.0, `dist/index.js`):
- `CompositeBlock.toTree` balances a long list of top-level blocks into anonymous chunks, and gives each chunk the block's context hash. So the chunks are already marked for reuse.
- `FragmentCursor.moveTo` creates its cursor with `this.fragment.tree.cursor()`. That default mode skips anonymous nodes, so the cursor never stops on a chunk, and `takeNodes` walks every top-level block one at a time. `takeNodes` already checks `cur.type.isAnonymous`, which suggests chunks were meant to be visible.
- Even with chunks visible, `takeNodes` only treats a node of type `Block` as a place where reuse may stop. Any chunk taken after the last `Block` is popped again.

### Evidence for the patch

Gathered on 2026-10-08 with Node 26, the repo's packages, `src/editor/front-matter.ts`, and copies of `@lezer/markdown` 1.8.0.

Cost per keystroke on the fully parsed generated document (median):

| `@lezer/markdown` 1.8.0 | Start | Middle | End |
| --- | --- | --- | --- |
| as released | 3.73 ms | 3.75 ms | 3.52 ms |
| cursor includes anonymous chunks only | 16.69 ms | 0.06 ms | 0.04 ms |
| cursor change plus chunks as stopping points (the patch) | 0.06 ms | 0.19 ms | 0.04 ms |

The cursor change alone makes the start worse. Chunks get taken and then popped again, over and over, so both parts are needed.

**Correctness:** after seeded random edits, the incrementally maintained tree was compared with a fresh parse, by every node's name and range.
- The edits were insertions of Markdown constructs and line breaks, and deletions of up to 200 characters.
- The documents were 40 and 60 copies of the dialect fixture, and the generated document.
- Across 4,610 checks over 6 seeds, there were no mismatches, for either the released or the patched version.

**Identity:** after one keystroke at the end of the fully parsed document, the old tree's first top-level chunk (anonymous, about 1 MB) is the same object in the new tree with the patch, and isn't without it.

**Other checks:**
- `@lezer/markdown` 1.8.0 parses `src/editor/fixtures/dialect.md` into exactly the listing in `src/editor/fixtures/dialect.tree.txt`.
- The patch doesn't change catch-up on slow CPUs: in the slow-clock emulation from `fix-add-large-document-checks-catch-up`, it reached the end in 60 rounds at 3× slower, against 68 without it.

## Goals / Non-Goals

**Goals:**

- A keystroke's parsing cost no longer grows with the document once the tree is complete, so steady-state typing at the end meets G-105 on WebKitGTK.
- Gate tests that catch losing the patch, and any tree corruption from it.
- A patch that's easy to drop once upstream has an equivalent.

**Non-Goals:**

- Catch-up on slow CPUs, which this patch doesn't change.
- Changing CodeMirror's re-parse-to-the-end policy.
- Any change to the dialect, the tree's shape, the classes or the styles.
- Changing G-105's thresholds.

## Operator prerequisites

Harness applies these on the host before the run, after a plan review and a diff review. Then it commits the prep commit and recaptures the baseline. The script comes from this change's folder.

```harness-run
mkdir -p scripts
cp openspec/changes/fix-add-large-document-checks-end-typing/patch-lezer-markdown.mjs scripts/patch-lezer-markdown.mjs
npm pkg set scripts.postinstall="node scripts/patch-lezer-markdown.mjs"
npm install -E @lezer/markdown@1.8.0
node scripts/patch-lezer-markdown.mjs
```

Check that the patch is applied to both builds, that there's one copy of `@lezer/markdown`, and that every frontend check passes before anything is committed:

```harness-run
grep -c "quiro patch: whole-chunk fragment reuse" node_modules/@lezer/markdown/dist/index.js node_modules/@lezer/markdown/dist/index.cjs
npm ls @lezer/markdown
npm run lint
npm test
npm run build
```

In the diff review, expect:
- **`package.json`:** `@lezer/markdown` at exactly `1.8.0`, and a `postinstall` script;
- **`package-lock.json`:** only `@lezer/markdown` changes;
- **`scripts/patch-lezer-markdown.mjs`:** new, and identical to this change's copy.

The gate commands don't change.

## Decisions

### Patch `@lezer/markdown` rather than revise the target

The cost sits in `@lezer/markdown`'s fragment reuse, and the fix there is two small changes. It makes the cost per keystroke roughly constant, whatever the document's size.

*Alternative:* revise G-105's steady-state target at the end. Rejected by the operator, who chose to improve it.

*Alternative:* wait for an upstream release. The change goes upstream anyway, but the release date isn't Quiro's to choose.

*Alternative:* work around it in Quiro, for example with a wrapper parser that reuses whole chunks itself. Rejected: it would re-implement Lezer's resynchronisation of block boundaries, which is where the risk lies.

### Apply it with a postinstall script

`scripts/patch-lezer-markdown.mjs` (this change's copy is the source) runs on `postinstall`. It:
- refuses to run unless `node_modules/@lezer/markdown` is version 1.8.0, and exits 1 with a message naming itself;
- edits `dist/index.js` and `dist/index.cjs`:
  - `IterMode` is added to the ESM import from `@lezer/common`. The CommonJS build uses `common.IterMode` instead;
  - `moveTo`'s cursor is created with `IterMode.IncludeAnonymous`;
  - `takeNodes` treats an anonymous chunk like a block, using the type of the chunk's last top-level block. A new function, `lastBlockType`, finds it. A chunk that ends in a `NotLast` block, such as indented code, follows the same rule as that block;
- replaces each piece of code only if it occurs exactly once. Otherwise it exits 1 and prints the code it expected;
- does nothing to a file that already has its marker comment, so running it twice is safe.

`npm ci` in CI runs `postinstall`, so both runners test the patched parser. Bumping `@lezer/markdown` without updating the script fails the install, which is deliberate.

*Alternative:* `patch-package`. Rejected: it adds 14 direct dependencies and its own postinstall step, for a change of about ten lines.

*Alternative:* vendor a patched copy and alias it in Vite and Vitest. Rejected: it needs changes in three configs, and it fights Vite's dependency pre-bundling, which has already been fragile in the browser project.

### Move to `@lezer/markdown` 1.8.0

1.8.0 fixes "passing in a tree fragment that contained blocks sticking out of the parsed range could produce a corrupted tree". CodeMirror passes exactly such partial fragments while catching up. Its only change to `FragmentCursor` is that `takeNodes` also stops at the parse range's end. The patch is written against 1.8.0, and the dialect listing doesn't change.

### Gate tests

Both are new jsdom files in `src/editor/`, so they may use CodeMirror and Lezer directly.

- **Chunk reuse:**
  1. a state from `newState(generateLargeDocument(DEFAULT_LARGE_DOCUMENT_SEED))`, parsed completely with `ensureSyntaxTree(state, state.doc.length, 1e9)`;
  2. the tree's first top-level child, read with a cursor in `IterMode.IncludeAnonymous`, must be anonymous;
  3. after inserting `"x"` at the end with `state.update` and completing the parse again, a cursor over the new tree in `IterMode.IncludeAnonymous` must find that same object (`cursor.tree === chunk`).

  It's deterministic, and unpatched `@lezer/markdown` fails it.
- **Incremental equals fresh:**
  1. a state from `newState` on 20 copies of `src/editor/fixtures/dialect.md`;
  2. 300 edits from a linear congruential generator with a fixed seed. Three in four insert one of a fixed list of strings at a random position: `x`, a line break, two line breaks, a code fence, `# `, `> `, `- `, `1. `, four spaces, a two-row table, `*`, `**`, `~~`, a backtick, `---` with a line break, `- [ ] ` and `<div>` with a line break. One in four deletes 1 to 200 characters at a random position;
  3. after each edit, the parse is completed, and its `Name from-to` listing (from `tree.iterate`) must equal that of `markdownMode().language.parser.parse(text)`.

### Upstream

The two changes, the reproduction and the measurements above go to `@lezer/markdown`'s maintainer. When a release includes an equivalent change, a follow-up change bumps the version, removes the script and the `postinstall` entry, and keeps the gate tests.

## Manual verification

Run these after this change's PR is merged, on `master`, in `npm run tauri dev`, with the Web Inspector closed whenever you type. Record the date, the commit, the machine, and every `typingStats()` output, in this change's `verification.md`. This change is archived only when every Linux item passes. Together with the passing items from `fix-add-large-document-checks-catch-up`, that completes G-105.

**Linux (WebKitGTK):**
1. **Steady state, end,** three times:
   - load the fixture with `await window.quiroDev.loadLargeFixture()`, then close the inspector;
   - click into the editor, press Ctrl+End, and wait 10 s without typing;
   - type about 100 keys, then reopen the inspector and run `window.quiroDev.typingStats()`.

   Each p95 is under 16 ms.
2. **Steady state, start, with the whole document parsed:** after item 1, press Ctrl+Home and type about 100 keys, then run `typingStats()`. The p95 is under 16 ms.
3. **Catch-up, no regression:** load the fixture again, then press Ctrl+End at once and type about 100 keys. The max is at most 150 ms, and `parseToEndMs` is at most 5,000.
4. **Fixture, no regression:** paste `src/editor/fixtures/dialect.md`. Every construct looks as before, and only the front matter is muted.

**Windows:** none. G-105 is measured on Linux only.

## Risks / Trade-offs

- **[Quiro now carries a patch to a dependency]** → The script checks the version and every piece of code it replaces, so a bump that changes them fails the install instead of shipping an unpatched or half-patched parser. The gate's chunk-reuse test fails if the patch is missing, for example after `npm ci --ignore-scripts`.
- **[The patch could corrupt trees in a case the fuzzing didn't reach]** → It changes where reuse may stop, so a wrong tree is the failure to fear. The checks so far: 4,610 fuzzed comparisons with no mismatches, the pinned dialect listing, the existing class and highlighting tests, and the gate's seeded comparison on every run.
- **[Upstream may solve it differently]** → The follow-up then takes their version and drops Quiro's.
- **[Catch-up on slow CPUs stays as it was]** → This change doesn't target it, and G-105 is measured on the developer's machine. It's recorded in `fix-add-large-document-checks-catch-up`'s risks.

## Open Questions

- Will `@lezer/markdown`'s maintainer take the change, and in what form?
- How much of the per-keystroke cost on WebKitGTK is left after the patch? The view update's share was never measured on its own.
