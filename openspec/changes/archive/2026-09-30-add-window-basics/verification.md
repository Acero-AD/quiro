# Manual verification: add-window-basics

Linux check from `design.md` § Manual verification. This change was archived before the rule that archiving waits for the Linux check, so this file was added to the archive afterwards, as a one-time exception ([How are WebKitGTK-only behaviours verified when the gate cannot run WebKitGTK?](https://github.com/Acero-AD/quiro/issues/20)).

**Result: FAIL.** The window grows on every restart when it floats. The fix goes in a follow-up change.

## Run

- **Date:** 2026-10-01
- **Commit:** 5c6d003. The source is unchanged since 5c94d5a.
- **Build:** `npm run tauri build -- --debug --no-bundle`, run as `src-tauri/target/debug/quiro`.
- **Machine:**
  - AMD Ryzen 7 5800X
  - Linux 7.2.5-3-omarchy
  - Hyprland 0.56.2 (Omarchy)
  - one monitor: DP-2, 1920×1080, scale 1, 26 px reserved at the top, so the work area is 1920×1054
- **Stack:** webkit2gtk-4.1 2.52.6, gtk3 3.24.52, `tauri` 2.11.5, `tao` 0.35.3, `wry` 0.55.1. These come from `Cargo.lock`; see the findings.
- **Session:** native Wayland, with `WAYLAND_DISPLAY=wayland-1` and `GDK_BACKEND=wayland,x11,*`. The window is not XWayland.
- **Method:** a script launched Quiro and read its window from `hyprctl clients -j`. It closed the window through Hyprland's close dispatcher, so Quiro got `CloseRequested` and saved its state, then read `window-state.json`. For the floating runs, a temporary runtime rule (`float = true` for class `quiro`) was added with `hyprctl eval` and removed with `hyprctl reload`. `WAYLAND_DEBUG=1` traced the xdg-shell messages.

## Linux (Hyprland)

| Check | Result | Evidence |
| --- | --- | --- |
| The window tiles, and the page fills the tile | PASS | The window tiled at 941×1030, position (967,38). A screenshot shows the page filling the tile under a GTK client-side header bar titled "Quiro". |
| Close and restart five times: the size hasn't grown (tiled) | PASS | All six launches got the same 941×1030 tile. The saved state stayed at 1000×1085, apart from one 998×1083. |
| Close and restart five times: the size hasn't grown (floating) | **FAIL** | The window grows by about 50×49 px on each restart; see the table below. From run 5 it's taller than the 1054 px work area and placed at y = −11. |
| Deleting `window-state.json` gives the first-run defaults | PASS | When tiled, the tile overrides the size. When floating from the start, the window is 1000×747: a 1000×700 page plus a 47 px header bar. |
| Writing garbage into it gives the defaults and no crash | PASS | With `this is not window state {` as the file: the window opened, the exit code was 0, and the file was overwritten with valid state on close. |

Floating restarts, starting with no state file:

| Run | Hyprland window size | Position | Saved state after close |
| --- | --- | --- | --- |
| 1 (first run) | 1000×747 | (460,180) | 1050×798, `maximized: true` |
| 2 | 1050×845 | (435,131) | 1100×896, `maximized: true` |
| 3 | 1100×943 | (410,82) | 1150×994, `maximized: true` |
| 4 | 1150×1041 | (385,33) | 1200×1092, `maximized: true` |
| 5 | 1200×1128 | (360,−11) | 1250×1178, `maximized: true` |
| 6 | 1250×1128 | (335,−11) | 1302×1180, `maximized: true` |

## Linux (X11, optional)

Not run. Hyprland tiles XWayland windows too, so testing a restored position needs a float rule in place before the window opens. The position logic is covered by the `plan_restore` unit tests, and Windows checks it again in [Manual Windows check](https://github.com/Acero-AD/quiro/issues/22).

## Findings

1. **The Tauri upgrade in the operator prerequisites was never applied.** `Cargo.lock` has pinned `tauri` 2.11.5 and `tao` 0.35.3 since the scaffold commit. Step 2 of the prerequisites, the upgrade to the latest stable 2.x for tao 0.36's fix for the window growing on restart under GTK client-side decorations, didn't happen. On 2026-10-01, crates.io has `tauri` 2.12.1 and `tao` 0.36.0 and 0.37.1. The floating growth above matches that bug.
2. **`maximized: true` is saved on every close, whether tiled or floating, and the window is never maximized.** This breaks the "Closing a normal window" scenario of the "Window state is remembered" requirement. Quiro sends no `set_maximized` on a first run, but once Hyprland's second configure arrives, `is_maximized()` reports true. From then on `Resized` events are ignored, so the saved size is whatever was recorded before that point. On the next start Quiro calls `maximize()`, which Omarchy suppresses.
3. **The saved size includes GTK's client-side shadow margins.** The first configure is 950×1034. GTK sets the window geometry at offset (25,23), so the surface comes to about 1000×1085, and that is what gets saved. When floating, the saved size (inner size plus margins) is requested again on the next start, so the window grows by the margins each time.
4. **The size clamp ignores the header bar.** `plan_restore` clamps the requested inner size to the work area (height 1054). The 47 px header bar sits outside that inner size, so the window can still be taller than the work area (1128 px) and is placed partly off-screen.
5. **Open question from `design.md`:**
   - `inner_size()` on the first configure includes the client-side shadow margins.
   - After that, Quiro sees the window as maximized whether it's tiled or floating, so no later size is recorded.
   - `outer_position()` wasn't observed: Wayland doesn't expose a position, and Quiro doesn't save one there.

## Experiment: Tauri 2.12 in a throwaway worktree

These results are not on `master`. The worktree was a detached checkout of 5c6d003 with:
- `cargo update -p tauri -p tauri-build -p tauri-plugin-opener`, giving `tauri` 2.12.1, `tao` 0.37.1, `wry` 0.57.0 and `tauri-plugin-opener` 2.7.0;
- npm `@tauri-apps/cli` and `@tauri-apps/api` 2.12.1, and `@tauri-apps/plugin-opener` 2.7.0.

`cargo test` passed (29 tests). The same machine and method gave:

| Check | Result | Evidence |
| --- | --- | --- |
| Floating, first run and five restarts | PASS | All six launches: 1000×700 at (460,203), centred in the work area. The saved state was 1000×700 each time. GTK no longer draws its own title bar, and the page fills the window. |
| Tiled, three launches | PASS | The tile stayed 941×1030. The saved state was 950×1034, Hyprland's first configure, with no shadow margins. |
| `maximized` on close | **still wrong** | `maximized: true` was saved after every run, including a floating window that was never maximized. Omarchy's global rule `o.window(".*", { suppress_event = "maximize" })` swallows Quiro's `maximize()` on the next start. On plain Hyprland, the window would maximize itself from the second start. While Quiro thinks the window is maximized it ignores `Resized` events, so resizing a floating window by hand is never remembered. |
| Oversized saved state (2500×1600, floating) | clamped to the monitor, not the work area | The window opened at 1920×1080 at (0,13), so its bottom 13 px were off-screen. On Wayland, tao reports the whole monitor as the work area (the fallback `design.md` expected), so the 26 px bar isn't subtracted. The spec scenario "Restoring a size larger than the screen" promises the work area. |

So the upgrade fixes findings 1, 3 and 4 (the growth, the shadow margins, and the title-bar overflow). Finding 2, the `maximized` flag, needs a code change. The work-area clamp on Wayland needs a decision.

## Follow-up

Decided on 2026-10-01 for the fix change, `fix-add-window-basics-wayland`, not yet proposed:

1. **Upgrade to Tauri 2.12.1 as operator prerequisites.** These are `harness-run` blocks under `## Operator prerequisites` in its `design.md`:
   - `cargo update -p tauri -p tauri-build -p tauri-plugin-opener` in `src-tauri/`;
   - `@tauri-apps/api` 2.12.1, `@tauri-apps/plugin-opener` 2.7.0 and `@tauri-apps/cli` 2.12.1 (dev).
2. **Wayland ignores the `maximized` flag.** Quiro records every resize, always saves `maximized: false`, and never calls `maximize()` when restoring. This matches the existing rule that the compositor owns placement on Wayland. The cost: a window really maximized on a non-tiling Wayland desktop comes back at its large size, not maximized. Why tao reports a non-maximized Hyprland window as maximized gets reported upstream later.
3. **The clamp wording changes.** The spec clamps to "the monitor's work area, or the whole monitor where the platform doesn't report one (Wayland)".
4. **One change** carries the upgrade, one `tasks.md` section for (2) with unit tests, and a spec delta for (2) and (3).
5. **After it merges,** the floating and tiled restart checks run again, and their results are added here.

**Result (2026-10-01): PASS.** The re-check on `master` at d5be0f4 passed every Linux item. See [`fix-add-window-basics-wayland`'s `verification.md`](../2026-10-01-fix-add-window-basics-wayland/verification.md).
