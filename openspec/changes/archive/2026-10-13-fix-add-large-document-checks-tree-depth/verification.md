# Manual verification: fix-add-large-document-checks-tree-depth

Linux check from `design.md` § Manual verification.

**Result: NOT RUN.** On 2026-10-13 the operator closed Phase 1 and moved on to Phase 2 without running this check. Nothing here was measured on WebKitGTK. If typing ever feels slow, run the two items below and record the numbers in this file.

## What stands in for it

- **The tree depth is checked in the gate, not by hand.** `src/editor/tree-depth.test.ts` writes 300 paragraphs at the start, in the middle and at the end, and passed in the run's final gate and in CI on Linux and Windows (PR #31).
- **Whole-chunk reuse is still checked in the gate.** `src/editor/chunk-reuse.test.ts` requires at least 90% of the old tree's chunks to be reused after a keystroke. In `design.md`'s measurement, 5,918 of 5,923 chunks were reused, and a keystroke cost 0.07 ms, against 0.06 ms with whole-chunk reuse alone.
- **The last WebKitGTK measurement is from before this change.** `fix-add-large-document-checks-end-typing` measured a p95 of 6–7 ms when typing at the end. This change adds the height bound to that patch and doesn't re-measure it.

## Linux (WebKitGTK)

| Check | Result | Evidence |
| --- | --- | --- |
| 1. Steady state, end: p95 under 16 ms | NOT RUN | None. |
| 2. Writing a document: about 50 paragraphs typed into an empty document stay fluid | NOT RUN | None. |

## Windows

None.
