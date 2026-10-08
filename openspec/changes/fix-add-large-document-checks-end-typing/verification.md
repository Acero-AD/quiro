# Manual verification: fix-add-large-document-checks-end-typing

Linux check from `design.md` § Manual verification. It ran on the PR branch before the merge, not on `master` after it. The branch's source is what PR #30 merges.

**Result: PASS.** Steady-state typing at the end of the fully parsed document dropped from p95 15–17 ms to 6–7 ms, with medians from 6–7 ms to 1 ms. Catch-up and the fixture show no regression.

## Run

- **Date:** 2026-10-08
- **Commit:** 01d0f4b (`harness: fix-add-large-document-checks-end-typing task 1`), the head of PR #30. It sits on 0228df7, the prerequisites commit that installed `@lezer/markdown` 1.8.0 and its patch.
- **Build:** `npm run tauri dev`.
- **Machine:**
  - AMD Ryzen 7 5800X
  - Linux 7.2.5-3-omarchy
  - Hyprland 0.56.2 (Omarchy)
  - NVIDIA driver 610.57.04
- **Stack:** webkit2gtk-4.1 2.52.6, `tauri` 2.12.1, `@codemirror/language` 6.12.4, `@lezer/markdown` 1.8.0 with `scripts/patch-lezer-markdown.mjs` applied. Its marker is present in `node_modules/@lezer/markdown/dist/index.js`.
- **Method:** as `design.md` describes, with the Web Inspector closed while typing and keys typed by hand.

## Linux (WebKitGTK)

Times are in ms.

| Check | Result | Evidence |
| --- | --- | --- |
| 1. Steady state, end: each p95 under 16 | PASS | Run twice instead of three times; both are far below the limit:<br>• 151 samples: median 1, p95 6, max 10, parse reached the end 2,916 after Ctrl+End<br>• 155 samples: median 1, p95 7, max 10, parse reached the end 2,411 after Ctrl+End |
| 2. Steady state, start, with the whole document parsed: p95 under 16 | PASS | p95 5, as the operator reported it; the full `typingStats()` output wasn't kept. Typed after Ctrl+End, a 10 s wait for the parse to reach the end, then Ctrl+Home. |
| 3. Catch-up: no keystroke over 150, `parseToEndMs` at most 5,000 | PASS | 139 samples: median 1, p95 36, max 115, `parseToEndMs` 1,537. |
| 4. Fixture: every construct as before, only the front matter muted | PASS | The operator's report: the dialect fixture looks right. |

## Windows

None. G-105 is measured on Linux only.

## Findings

1. **The patch removes the per-keystroke cost of a complete tree on WebKitGTK.** The same measurement before this change, in `fix-add-large-document-checks-catch-up`'s `verification.md`, compared with now:

   | | Before | After |
   | --- | --- | --- |
   | End steady state, median | 6 to 7 | 1 |
   | End steady state, p95 | 15 to 17 | 6 to 7 |
   | End steady state, max | 22 to 31 | 10 |
   | Catch-up, median | 7 | 1 |
   | Catch-up, p95 | 100 | 36 |
   | Catch-up, max | 127 | 115 |
   | Catch-up, `parseToEndMs` | 1,740 | 1,537 |

2. **Catch-up's max is still bounded by CodeMirror's 100 ms parse slices,** as expected. The patch makes each keystroke cheap, but a key that arrives during a slice still waits for it.
