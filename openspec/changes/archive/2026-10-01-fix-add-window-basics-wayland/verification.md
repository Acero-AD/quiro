# Manual verification: fix-add-window-basics-wayland

Linux check from `design.md` § Manual verification, run on `master` after the harness run. It re-checks what failed in [`add-window-basics`](../../archive/2026-09-30-add-window-basics/verification.md).

**Result: PASS.** Every Linux item passed. The Windows items stay in [Manual Windows check](https://github.com/Acero-AD/quiro/issues/22).

## Run

- **Date:** 2026-10-01
- **Commit:** d5be0f4 (`harness: fix-add-window-basics-wayland task 1`), on top of 7863711 (`harness: fix-add-window-basics-wayland prerequisites`).
- **Build:** `npm run tauri build -- --debug --no-bundle`, run as `src-tauri/target/debug/quiro`.
- **Machine:**
  - AMD Ryzen 7 5800X
  - Linux 7.2.5-3-omarchy
  - Hyprland 0.56.2 (Omarchy)
  - one monitor: DP-2, 1920×1080, scale 1, 26 px reserved at the top
- **Stack:** webkit2gtk-4.1 2.52.6, gtk3 3.24.52, `tauri` 2.12.1, `tao` 0.37.1, `wry` 0.57.0, `tauri-build` 2.7.1, `tauri-plugin-opener` 2.7.0.
- **Session:** native Wayland, with `WAYLAND_DISPLAY=wayland-1` and `GDK_BACKEND=wayland,x11,*`.
- **Method:** the same script as the `add-window-basics` check. It launched Quiro, read its window from `hyprctl clients -j`, closed it through Hyprland's close dispatcher, and read `window-state.json`.
  - The floating runs used a temporary runtime rule, added with `hyprctl eval 'hl.window_rule({ match = { class = "^(quiro)$" }, float = true })'` and removed with `hyprctl reload`.
  - The manual resize used `hl.dsp.window.resize({ x = 1200, y = 800, window = "pid:…" })`.

## Linux (Hyprland)

| Check | Result | Evidence |
| --- | --- | --- |
| Floating, no state file: the window opens at 1000×700 | PASS | 1000×700 at (460,203), centred in the work area. Saved `maximized: false`. |
| Floating, five restarts: the size hasn't grown | PASS | All six launches: 1000×700 at (460,203). Every saved state: 1000×700, `maximized: false`. |
| Floating, resized by hand, closed and restarted: it comes back at the new size | PASS | Resized to 1200×800 and closed: saved 1200×800, `maximized: false`. The next launch: 1200×800 at (360,153). |
| Tiled: the window fills its tile | PASS | The tile was 941×1030 at (967,38). A screenshot shows the page filling the tile. GTK draws no title bar of its own. |
| Tiled, five restarts: same tile, saved `maximized: false` | PASS | All six launches: 941×1030. Every saved state: 941×1030 (the tile), `maximized: false`. |
| Older file with `"maximized": true`: Quiro sends no `set_maximized` | PASS | Under `WAYLAND_DEBUG=1`, the trace has 0 `xdg_toplevel.set_maximized` requests. The state saved on close holds `maximized: false`. |
| Regression: a deleted state file gives the defaults | PASS | The first floating and first tiled runs started with no file. |
| Regression: a garbage state file gives the defaults, with no crash | PASS | With `this is not window state {` as the file: the window opened, the exit code was 0, and the file was overwritten with valid state on close. |

## Windows

Verified on Windows later. The existing restore items in [Manual Windows check](https://github.com/Acero-AD/quiro/issues/22) cover the maximized flag there, and now also cover Tauri 2.12. This change adds no new Windows items.
