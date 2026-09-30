## Why

Quiro opens at the Tauri starter's 800×600 every time and forgets its window between runs. G-004 asks for a sensible first-run window, a minimum size, and remembered geometry. Its original wording ("restores last size/position", "centered") is impossible on Wayland, where an app can't place its own window. The criteria were revised in [What should window basics promise on Wayland, X11 and Windows?](https://github.com/Acero-AD/quiro/issues/11). This is the first Phase 0 change in run order.

## What Changes

- The operator upgrades Tauri to the latest stable 2.x (2.12.x) before the run. The upgrade picks up the tao 0.36 fix for the window growing on every restart under GTK client-side decorations.
- The first-run window is 1000×700 logical pixels, titled "Quiro", and centred where the platform lets an app place its window.
- The minimum window size is 480×320 logical pixels, enforced where the platform honours it.
- Quiro remembers its **window state** in `window-state.json` in the app's local data directory:
  - logical size and the maximized flag everywhere;
  - position only on Windows and X11, never on Wayland.
- On restore:
  - the size is clamped to the monitor's work area;
  - a position that's off every monitor falls back to centred;
  - the window stays hidden until its geometry is applied.
- A missing, unreadable or invalid state file falls back to the first-run defaults and never crashes the app.
- Quiro ships no compositor rules. It accepts whatever tile a tiling window manager gives it.
- `tauri-plugin-window-state` is not used. Quiro owns this code.

## Capabilities

### New Capabilities

- `window-state`: the first-run window, the minimum size, and how window state is remembered, stored and restored on Wayland, X11 and Windows.

### Modified Capabilities

None.

## Impact

- **Operator prerequisites, before the run:**
  - the Tauri upgrade touches `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `package.json` and `package-lock.json`, which are gate runner files;
  - then a new harness baseline.
- **Code:** a new pure Rust window-state module in `src-tauri/src/` with unit tests, window wiring in `src-tauri/src/lib.rs`, and the window entry in `src-tauri/tauri.conf.json`.
- **No new crates:** `serde` and `serde_json` are already dependencies.
- **Run order:** this change runs first, before `add-typed-ipc`, `add-frontend-tooling` and `add-ci-build-matrix`.
