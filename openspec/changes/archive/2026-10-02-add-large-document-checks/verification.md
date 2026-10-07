# Manual verification: add-large-document-checks

Linux check from `design.md` § Manual verification. This change was archived before its Linux check ran, so this file was added to the archive afterwards.

**Result: FAIL.** Load time passes everywhere, and typing passes at the start and middle of the document. Typing at the end fails, and so does the catch-up after a jump: one keystroke took 151 ms (limit 150), and the parse took 19,926 ms to reach the end (limit 5,000). The fix goes in a follow-up `fix-add-large-document-checks-<what>` change.

## Run

- **Date:** 2026-10-07
- **Commit:** the source of ffb1d36 (`Merge pull request #28`), which includes `add-dark-colour-scheme`. Later commits only add verification records.
- **Build:** `npm run tauri dev`, so `window.quiroDev` exists.
- **Machine:**
  - AMD Ryzen 7 5800X
  - Linux 7.2.5-3-omarchy
  - Hyprland 0.56.2 (Omarchy)
  - NVIDIA driver 610.57.04
- **Stack:** webkit2gtk-4.1 2.52.6, gtk3 3.24.52, `tauri` 2.12.1, `tao` 0.37.1, `wry` 0.57.0, `@codemirror/language` 6.12.4.
- **Method:** as `design.md` describes, with one change. The Web Inspector was **closed while typing**, and opened only to run `loadLargeFixture()` and `typingStats()`. The first attempt kept it open, and that inflated every figure (finding 1). Keys were typed by hand, about 100 per position or more; the sample counts are below.

## Linux (WebKitGTK)

Times are in ms.

| Check | Result | Evidence |
| --- | --- | --- |
| 1. Load: load-to-first-paint under 1 s | PASS | 32 to 79 over eight loads. |
| 2. Steady state, start: p95 under 16 | PASS | 156 samples: median −1, p95 3, max 26. The negative median is finding 2. |
| 2. Steady state, middle: p95 under 16 | PASS | 178 samples: median 4, p95 11, max 16. |
| 2. Steady state, end: p95 under 16 | **FAIL** | 168 samples: median 11, p95 29, max 44, `parseToEndMs` null. The parse hadn't reached the end, so part of this run was really catch-up (finding 4). |
| 3. Catch-up: no keystroke over 150 | **FAIL** | 170 samples: median 22.5, p95 126, max 151.0. |
| 3. Catch-up: `parseToEndMs` at most 5,000 | **FAIL** | 19,926, while typing. |

**Extra diagnostic** (not in `design.md`): `loadLargeFixture()`, then Ctrl+End, then 60 s without typing, then one key. `parseToEndMs` was 3,519, so the parse reaches the end in 3.5 s when nobody types. That one key took 25.

## Windows

None. G-105 is measured on Linux only.

## Findings

1. **An open inspector inflates the figures roughly fivefold.** With it open, the start and middle gave p95 22 and 18, the end p95 151 and 122, and the catch-up max 139 with `parseToEndMs` null. The method in `design.md` runs its commands in the inspector console but doesn't say to close it while typing. Re-runs and the fix change should.
2. **`event.timeStamp` and `performance.now()` don't line up exactly in WebKitGTK 2.52.6.** At the start, more than half the samples were negative, with a median of −1. The two are either different clocks or rounded differently, so each sample is off by about a millisecond. That answers part of `design.md`'s first open question. It doesn't change any verdict, which are all several milliseconds from their thresholds, except the catch-up max of 151 against 150.
3. **Parsing to the end takes 3.5 s idle, but about 20 s while typing.** The likely mechanism, read from `@codemirror/language` 6.12.4 and **not yet confirmed**:
   - WebKitGTK has no `requestIdleCallback`, so CodeMirror's background parser schedules each 100 ms slice with a 500 ms `setTimeout` (`Work.Slice`, `Work.MaxPause`). A slice blocks any keystroke that arrives during it.
   - Every document change also runs up to 20 ms of parsing synchronously (`Work.Apply`). That fits the catch-up median of 22.5.
   - Background parsing is capped at 3 s of work per 30 s (`Work.ChunkBudget`).
4. **Step 2's "wait 2 s" doesn't give a steady state at the end.** CodeMirror parses at most 100,000 characters past the viewport (`Work.MaxParseAhead`), so the rest of the 50,000 lines is parsed only after the jump to the end. A steady-state reading at the end has to wait until the parse is done: 3.5 s or more after Ctrl+End, without typing.
5. **CodeMirror logs "Measure loop restarted more than 5 times"** after loads and jumps in this document. Its measure cycle didn't settle, probably while estimating wrapped line heights. Nothing visibly misbehaved.
6. **Two `WebKitWebProcess` crashes during the run** (09:07:01 and 09:08:46, SIGSEGV). Both crashed inside `exit()`, in NVIDIA's EGL driver (`libEGL_nvidia`, `libnvidia-eglcore`, `libnvidia-gpucomp` 610.57.04). Quiro's page process (started 08:51) kept running. They were probably Web Inspector processes exiting as the inspector closed. This isn't a Quiro bug, and it didn't affect the measurements.

## Follow-up

- A `fix-add-large-document-checks-<what>` change for the catch-up. Its first step is to confirm finding 3's mechanism.
- Not yet measured: the end-of-document steady state after the parse completes (finding 4). That reading decides whether the fix also covers steady-state typing at the end.
