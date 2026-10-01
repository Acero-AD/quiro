## Why

The Linux manual check of `add-window-basics` failed ([`verification.md`](../archive/2026-09-30-add-window-basics/verification.md)). The Tauri upgrade in its operator prerequisites was never applied. On the still-locked `tauri` 2.11.5 and `tao` 0.35.3, a floating window grows by GTK's shadow margins on every restart. A throwaway build on Tauri 2.12.1 fixed the growth but showed two more problems on Hyprland:
- tao reports a window that was never maximized as maximized, so Quiro saves `maximized: true` and ignores every resize;
- on Wayland, the size clamp can only use the whole monitor, not its work area.

This is a Phase 0 fix, so it runs before every Phase 1 change.

## What Changes

- **Before the run, harness upgrades Tauri to 2.12.1** through the operator prerequisites in `design.md`: the `tauri` crates and the `@tauri-apps` npm packages. tao 0.37 fixes the growth and leaves the shadow margins out of the reported size.
- **On Wayland, Quiro ignores the maximized flag:**
  - it records the size from every resize, as long as the window isn't minimized;
  - it always saves `maximized: false`;
  - it never maximizes the window when restoring, even if an older file says `maximized: true`.

  Placement on Wayland already belongs to the compositor, and this extends that to the maximized state. Windows and X11 keep saving and restoring the maximized state.
- **The clamp wording changes:** the restored size is clamped to the monitor's work area, or to the whole monitor where the platform doesn't report a work area (Wayland).
- **The remaining window-state decisions move out of the `lib.rs` wiring** and into pure functions in `window_state.rs` that `cargo test` covers: which resize and move events update the remembered geometry, and what state is saved on close.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `window-state`:
  - "Window state is remembered": Wayland saves no maximized state, and remembers resizes of a floating window.
  - "Window state is restored within the screen": the clamp falls back to the whole monitor on Wayland, and Wayland never maximizes on restore.

## Impact

- **Operator prerequisites:** `src-tauri/Cargo.lock`, `package.json` and `package-lock.json` change in the prep commit that harness makes before the run. `src-tauri/Cargo.toml` keeps its `"2"` ranges. The crates are fetched into `~/.cargo/registry` so that the offline gate can build.
- **Code:** `src-tauri/src/window_state.rs` gains the Wayland rule and two pure functions with unit tests. `src-tauri/src/lib.rs` calls them instead of deciding itself.
- **No new dependencies.** The generated `src/bindings.ts` doesn't change: `cargo test`, including the drift test, passed on 2.12.1 in the experiment.
- **Run order:** before every Phase 1 change. Phase 1's prerequisites can then assume Tauri 2.12.
- **Manual check:** after the merge, the floating and tiled restart checks run again, and their results go into `add-window-basics`'s `verification.md`.
- **Not in this change:** reporting tao's maximized state upstream.
