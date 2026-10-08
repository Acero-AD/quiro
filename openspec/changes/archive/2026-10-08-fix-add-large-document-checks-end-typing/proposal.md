## Why

`fix-add-large-document-checks-catch-up` fixed catch-up. Its Linux check still failed on one item ([`verification.md`](../2026-10-07-fix-add-large-document-checks-catch-up/verification.md)): typing at the end of the fully parsed 50,000-line document gave p95 16, 17 and 15 ms in three runs, against "under 16 ms".

The cost isn't specific to the end. Once the syntax tree covers the whole document, every keystroke costs about 3.5 ms of parsing in Node, wherever it lands. With only the first 100,000 characters parsed, it costs 0.09 ms. After each change, CodeMirror re-parses to the end of the document, reusing the unchanged parts of the old tree. `@lezer/markdown` reuses them one top-level block at a time, then rebuilds and rebalances the document's whole list of blocks. In a profile, those two steps are 34% and 33% of the time.

The parser already groups those blocks into balanced chunks, and tags the chunks for reuse. But its reuse cursor skips anonymous nodes, so it never sees the chunks.

## What Changes

- **`@lezer/markdown` moves to 1.8.0.** It came out on 2026-10-07 and fixes a corrupted-tree bug with partially parsed fragments, which is exactly what CodeMirror passes in while catching up. The pinned dialect listing doesn't change.
- **A postinstall script patches the installed `@lezer/markdown`** with two changes to its fragment reuse:
  - the reuse cursor includes anonymous chunks;
  - a chunk counts as a place where reuse may stop, when its last block allows it.

  Unchanged chunks are then reused whole. In Node, a keystroke on the fully parsed document drops from about 3.5 ms to 0.04 to 0.19 ms, at the start, the middle and the end. Over 4,610 seeded random edits, the incremental tree matched a fresh parse every time.
- **The script fails the install loudly** if the installed version or the code it patches isn't what it expects. It changes nothing when the patch is already applied.
- **Two gate tests:**
  - after a keystroke on the fully parsed document, the old tree's first chunk is reused as the same object;
  - after seeded random edits, the incremental tree equals a fresh parse.
- **The patch goes upstream.** The script is removed once `@lezer/markdown` ships an equivalent change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `large-documents`: new requirements "A keystroke reuses the unchanged tree whole" and "The incremental tree matches a fresh parse", both checked in the gate. The WebKitGTK budget doesn't change.

## Impact

- **Operator prerequisites:**
  - `package.json` pins `@lezer/markdown` 1.8.0 and gains a `postinstall` script;
  - `package-lock.json` changes;
  - a new `scripts/patch-lezer-markdown.mjs` is copied from this change's folder.

  CI runs `npm ci`, which runs `postinstall`.
- **Code:** nothing under `src/` except two new test files.
- **Dependencies:** no new package. The patch is a script, not `patch-package`.
- **Manual check:** the steady-state and catch-up items run again on WebKitGTK. Their results go in this change's `verification.md`.
