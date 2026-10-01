## Context

`add-window-basics` added window state for G-004: a pure core in `src-tauri/src/window_state.rs` (`load`, `save`, `is_wayland`, `plan_restore`), plus wiring in `src-tauri/src/lib.rs`. Its Linux manual check failed afterwards. Evidence is in [`verification.md`](../archive/2026-09-30-add-window-basics/verification.md), from a Hyprland 0.56.2 session on Omarchy.

- **The prerequisite upgrade to Tauri 2.12 never happened.** `Cargo.lock` still has `tauri` 2.11.5 and `tao` 0.35.3. There, the saved size includes GTK's client-side shadow margins, so a floating window grows by about 50 px on every restart. GTK's own title bar also lets the window outgrow the clamp.
- **A throwaway build on 2.12.1** (`tao` 0.37.1, `wry` 0.57.0, `tauri-plugin-opener` 2.7.0) fixed both:
  - a floating window stayed at 1000×700 across six launches;
  - the saved size had no margins;
  - GTK drew no title bar of its own;
  - `cargo test` passed, including the IPC bindings drift test.
- **Two problems remained on 2.12.1:**
  - **Maximized state.** `is_maximized()` is true for every Quiro window on Hyprland, tiled or floating, even though Quiro never asked to maximize. So `lib.rs` ignores every `Resized` event after the first configure and saves `maximized: true`. On the next start Quiro calls `maximize()`. Omarchy's global `suppress_event = "maximize"` rule hides that; plain Hyprland would maximize the window.
  - **Work area.** On Wayland, `Monitor::work_area()` returns the whole monitor, because the protocol doesn't tell apps about bars and other reserved space. A saved 2500×1600 was clamped to 1920×1080 instead of the 1920×1054 below the bar.

The decisions below were made with the operator on 2026-10-01 and recorded in that `verification.md`.

## Goals / Non-Goals

**Goals:**

- Quiro runs on Tauri 2.12.1, which brings the fixes for the growth and the shadow margins.
- On Wayland, a maximized state that the toolkit reports by mistake can't change what Quiro saves or restores.
- Every window-state decision sits in pure functions that `cargo test` covers. `lib.rs` only gathers inputs and applies results.
- The spec describes what Wayland can actually do for clamping.

**Non-Goals:**

- Finding out why tao reports maximized on Hyprland, or reporting it upstream. That's a later follow-up.
- Detecting the reserved areas on Wayland (bars, layer-shell exclusive zones). Apps get no protocol for it.
- Any change on Windows or X11.
- Anything from Phase 1.

## Operator prerequisites

Harness applies these on the host before the run, after a plan review and a diff review. It then commits them as the prep commit and recaptures the baseline. The versions are the ones the experiment tested. `src-tauri/Cargo.toml` keeps its `"2"` ranges, so the lockfile is what pins them.

Upgrade the Rust crates, then fetch them into `~/.cargo/registry`, because the gate builds offline:

```harness-run
cd src-tauri && cargo update -p tauri --precise 2.12.1
cd src-tauri && cargo update -p tauri-plugin-opener --precise 2.7.0
cd src-tauri && cargo fetch
```

Upgrade the npm packages to match. The Tauri CLI refuses to build when its version doesn't match the crates' major.minor:

```harness-run
npm install @tauri-apps/api@2.12.1 @tauri-apps/plugin-opener@2.7.0
npm install -D @tauri-apps/cli@2.12.1
```

Check the upgrade before anything is committed. This includes the drift test, which fails if the generated `src/bindings.ts` would change:

```harness-run
cd src-tauri && cargo test
```

In the diff review, expect changes to `src-tauri/Cargo.lock`, `package.json` (the three `@tauri-apps` ranges) and `package-lock.json`. The gate commands don't change.

## Decisions

### Upgrade through prerequisites, pinned to what was tested

`cargo update -p tauri --precise 2.12.1` and `tauri-plugin-opener --precise 2.7.0` reproduce the experiment, even if a newer 2.x comes out before the run. `tao`, `wry` and `tauri-build` follow `tauri`'s own requirements. A `--dry-run` on 2026-10-01 moved them to 0.37.1, 0.57.0 and 2.7.1.

*Alternative:* plain `cargo update`. Rejected: it would take whatever is newest on the day, not the versions that passed the floating check.

### On Wayland, the compositor owns the maximized state

On Wayland, Quiro already leaves placement to the compositor. This change extends that to the maximized state:
- every resize updates the remembered size unless the window is minimized;
- on close, `maximized` is always `false`;
- on restore, the window is never maximized, even when an older file says `maximized: true`. The operator's own files currently do.

*Alternatives:*
- **Find out why tao reports maximized on Hyprland and fix the detection.** Deferred: it may be a tao or GTK issue outside this repo, and the simple rule is correct whatever the cause.
- **Trust the flag except on Hyprland.** Rejected: it would detect a specific compositor, and other tiling compositors may behave the same way.

*Cost:* on a non-tiling Wayland desktop (GNOME, KDE), a window the user really maximized comes back at its large normal size, not maximized.

### Keep `can_position` as the single Wayland switch

`plan_restore` already takes `can_position`, which `lib.rs` sets to `!is_wayland(...)`. Both Wayland rules have the same cause: the app doesn't control its own placement there. So `can_position` now means "the app may place its own window: position and maximized state", and its doc comment says so. Passing the same value twice would just add a second argument with no new information.

*Alternative:* a second flag such as `can_maximize`. Rejected: it would always equal `can_position`.

### Move the remaining decisions out of `lib.rs`

`window_state.rs` gains two pure functions, and `plan_restore` gains one rule:

- `tracks_normal_geometry(maximized: bool, minimized: bool, can_position: bool) -> bool`. It decides whether a `Resized` or `Moved` event updates the remembered normal geometry: `!minimized && (!can_position || !maximized)`.
- `closing_state(normal_width: f64, normal_height: f64, normal_position: Option<(i32, i32)>, maximized: bool, can_position: bool) -> WindowState`. It builds the state saved on `CloseRequested`:
  - the normal size;
  - `maximized` only when `can_position`;
  - `x` and `y` from `normal_position` only when `can_position`.
- `plan_restore` returns `maximized: can_position && saved.maximized`. Its size, placement and clamping are unchanged.

In `lib.rs`:
- the `Resized` and `Moved` handlers pass `is_maximized()` and `is_minimized()` to `tracks_normal_geometry` instead of building their own `is_normal`;
- the `CloseRequested` handler passes the tracker's fields and `is_maximized()` to `closing_state`, then saves the result.

The setup order stays the same: size, placement, show, then maximize only if the plan says so. All existing tests keep passing unchanged. `plan_restore_carries_over_maximized_flag` uses `can_position = true`.

*Alternative:* leave the decisions in `lib.rs` and only add `!can_position ||` there. Rejected: `cargo test` can't reach `lib.rs` without a display, so the fix would be unverifiable in the gate.

### The clamp needs no code change, only spec wording

`monitor_work_area` in `lib.rs` already passes on whatever `Monitor::work_area()` returns, and on Wayland that's the whole monitor. The add-window-basics design expected this fallback. The spec now says so.

## Manual verification

The gate can't run a real window, so these checks sit outside `tasks.md`. Run them after this change's PR is merged, on `master`, from a debug build (`npm run tauri build -- --debug --no-bundle`). Record the results in this change's `verification.md`, and add a link to it from `add-window-basics`'s `verification.md`. This change is archived only when every Linux item passes.

- **Linux (Hyprland), floating.** Add a temporary rule, `hyprctl eval 'hl.window_rule({ match = { class = "^(quiro)$" }, float = true })'`, and remove it with `hyprctl reload` afterwards.
  - With no state file, the window opens at 1000×700.
  - Close and restart five times: the size hasn't grown.
  - Resize the window by hand, close, and restart: it comes back at the new size, and the saved state holds that size with `maximized: false`.
- **Linux (Hyprland), tiled:**
  - The window fills its tile.
  - Five restarts give the same tile, and the saved state holds `maximized: false`.
- **Linux (Hyprland), older file.** Start with a state file holding `"maximized": true`: a `WAYLAND_DEBUG=1` trace shows no `set_maximized` request from Quiro.
- **Regression:** a deleted state file and a garbage state file still give the defaults with no crash.
- **Windows:** no new items. The existing restore checks in [Manual Windows check](https://github.com/Acero-AD/quiro/issues/22) cover the maximized flag there, and now also cover Tauri 2.12.

## Risks / Trade-offs

- **[`--precise` can't be satisfied because another crate pins a different version]** → The step fails before anything is committed. Drop `--precise` for that crate and check the versions in the diff review.
- **[The upgrade changes the generated IPC bindings]** → The prerequisite `cargo test` fails on the drift test before the prep commit. The experiment found no drift.
- **[A user really maximizes Quiro on GNOME or KDE Wayland and expects it back maximized]** → Accepted. The window comes back at its large normal size. The upstream investigation could restore this later.
- **[wry 0.57 changes webview behaviour that Phase 1 relies on]** → Phase 1 runs after this change, so its research and checks see 2.12. The G-106 decisions (`on_navigation`, `zoomHotkeysEnabled`, `dragDropEnabled`) are Tauri 2.x APIs that exist in 2.12.

## Open Questions

- Why does tao 0.37.1 report a never-maximized Hyprland window as maximized: Hyprland's xdg-toplevel states, GTK 3's mapping of them, or tao? This is for the later upstream report.
- Do GNOME and KDE on Wayland report the maximized state correctly? Unverified. It only matters for undoing the cost described above.
