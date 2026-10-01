## 1. Wayland leaves the maximized state to the compositor

- [x] 1.1 `plan_restore` in `src-tauri/src/window_state.rs` returns `maximized: true` only when `can_position` is true and the saved state holds `maximized: true`. Its size, placement and clamping are unchanged.
- [x] 1.2 `can_position`'s doc comment in `window_state.rs` says it means the app may place its own window, covering both position and maximized state, and that it's false on Wayland.
- [x] 1.3 `window_state.rs` defines `tracks_normal_geometry(maximized: bool, minimized: bool, can_position: bool) -> bool`. It returns `!minimized && (!can_position || !maximized)`.
- [x] 1.4 `window_state.rs` defines `closing_state(normal_width: f64, normal_height: f64, normal_position: Option<(i32, i32)>, maximized: bool, can_position: bool) -> WindowState`. It returns the normal size; `maximized` only when `can_position`; and `x`/`y` from `normal_position` only when `can_position`.
- [x] 1.5 In `src-tauri/src/lib.rs`, the `Resized` and `Moved` handlers decide whether to record geometry only through `tracks_normal_geometry`. The `CloseRequested` handler builds the saved state only through `closing_state`. `lib.rs` has no other check of `is_maximized()` or `is_minimized()` besides fetching the values it passes to these two functions.
- [x] 1.6 `cargo test` covers each of these:
  - `plan_restore` with a saved `maximized: true` gives `maximized: false` when `can_position` is false, and `true` when it's true;
  - `tracks_normal_geometry` for all eight combinations of its three inputs;
  - `closing_state` with `can_position` false, given `maximized: true` and a position: it gives `maximized: false` and no `x`/`y`;
  - `closing_state` with `can_position` true: it keeps `maximized` and the position, and gives no `x`/`y` when `normal_position` is `None`.
- [x] 1.7 Every test that existed in `window_state.rs` before this change is still there, unchanged, and passing.
- [x] 1.8 This section adds no crate or npm dependency and doesn't touch `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `package.json`, `package-lock.json` or `src/bindings.ts`.
