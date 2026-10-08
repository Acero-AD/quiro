# Manual verification: fix-add-large-document-checks-catch-up

Linux check from `design.md` § Manual verification, run on `master` after PR #29 merged. It re-checks what failed in [`add-large-document-checks`](../2026-10-02-add-large-document-checks/verification.md). This change was archived before its Linux check ran.

**Result: FAIL, at the limit.** Catch-up, the failure this change targeted, now passes: the parse reached the end in 1,740 ms, against 19,926 ms before, and the slowest key took 127 ms. Steady-state typing at the end of the document doesn't reliably meet "p95 under 16 ms": three runs gave p95 16, 17 and 15. Every other item passes.

## Run

- **Date:** 2026-10-08
- **Commit:** 78c7d49 (`Merge pull request #29`).
- **Build:** `npm run tauri dev`, restarted after the merge. The catch-up figures confirm it ran the new parser.
- **Machine:**
  - AMD Ryzen 7 5800X
  - Linux 7.2.5-3-omarchy
  - Hyprland 0.56.2 (Omarchy)
  - NVIDIA driver 610.57.04
- **Stack:** webkit2gtk-4.1 2.52.6, gtk3 3.24.52, `tauri` 2.12.1, `tao` 0.37.1, `wry` 0.57.0, `@codemirror/language` 6.12.4, `@lezer/markdown` 1.7.2.
- **Method:** as `design.md` describes. The Web Inspector was closed while typing, and opened only to run `loadLargeFixture()` and `typingStats()`. Keys were typed by hand.

## Linux (WebKitGTK)

Times are in ms.

| Check | Result | Evidence |
| --- | --- | --- |
| 1. Load: load-to-first-paint under 1 s | PASS | 44. |
| 2. Steady state, start: p95 under 16 | PASS | 103 samples: median 0, p95 4, max 23. |
| 2. Steady state, middle: p95 under 16 | PASS | 154 samples: median 2, p95 6, max 14. |
| 3. Steady state, end, after the parse reached the end: p95 under 16 | **FAIL** | Three runs, each typed after waiting 10 s. The parse had reached the end 2,407, 2,928 and 2,921 after Ctrl+End, before typing started:<br>• 147 samples: median 6, p95 **16**, max 22<br>• 138 samples: median 6, p95 **17**, max 31<br>• 135 samples: median 7, p95 **15**, max 22 |
| 4. Catch-up: no keystroke over 150 | PASS | 155 samples: median 7, p95 100, max 127. |
| 4. Catch-up: `parseToEndMs` at most 5,000 | PASS | 1,740. |
| 5. Front matter still looks the same | PASS | With `dialect.md` pasted, only its first three lines are muted. `.cm-line.md-front-matter` matched exactly `---`, `title: Dialect fixture` and `---`. |

## Windows

None. G-105 is measured on Linux only.

## Findings

1. **The catch-up fix works on WebKitGTK.** Typing no longer discards the parse. The parse reached the end in 1,740 ms while typing, close to the 1.8 s that `design.md`'s replay predicted. The slowest key, 127 ms, is bounded by CodeMirror's 100 ms parse slices, as expected.
2. **Typing at the end of the fully parsed document costs about 6 to 7 ms per key** (median), against 0 to 2 ms at the start and in the middle. That puts p95 at 15 to 17 ms, right at the threshold. Timer resolution is about 1 ms (see `add-large-document-checks` finding 2), so the three runs can't separate 15.9 from 16.1. Taken together, though, they don't show a p95 reliably under 16.
3. **Likely cause, not confirmed by profiling:** once the tree covers the whole document, CodeMirror re-parses after each change up to the end of the document (`LanguageState.apply` with no `upto`). The Markdown parser then has to walk the reused fragments of the whole 5 MB document. At the start and in the middle, only up to about 100,000 characters past the viewport are parsed, so there's less to walk. In Node, getting back to 2.5 MB through fragments took about 5 ms, which fits a median of 6 to 7 for 5 MB.
4. **Previous figures, for comparison:**

   | | Before this change | After |
   | --- | --- | --- |
   | Catch-up max | 151 | 127 |
   | Catch-up `parseToEndMs` | 19,926 | 1,740 |
   | End steady state p95 | 29, measured mid catch-up | 15 to 17, measured after the parse |

## Follow-up

Item 3 needs a decision: either revise G-105's steady-state target for the end of the 50,000-line document, or open a change to make per-keystroke parsing cheaper on a fully parsed huge document.
