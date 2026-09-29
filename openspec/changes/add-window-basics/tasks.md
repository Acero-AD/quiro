## 1. Window state record and file

- [x] 1.1 `src-tauri/src/window_state.rs` defines the window state record (logical `width` and `height`, `maximized`, optional physical `x`/`y`), with constants for the 1000×700 first-run size and the 480×320 minimum, and is declared as a module in `lib.rs`
- [x] 1.2 The record serialises to the JSON format in `design.md` with `"schema": 1`, and leaves out `x`/`y` when there is no position
- [x] 1.3 `load(path)` returns no state for a missing file, unreadable file, malformed JSON, or an unknown `schema`, without panicking
- [x] 1.4 `save(path, state)` creates the parent directory if needed and writes through a temporary file in the same directory that is then renamed
- [x] 1.5 `cargo test` covers a save-then-load round trip, a missing file, malformed JSON and an unknown `schema` value, using files under `std::env::temp_dir()`

## 2. Restore planning

- [x] 2.1 `is_wayland(wayland_display, gdk_backend)` implements the rule in `design.md`, and `cargo test` covers: `WAYLAND_DISPLAY` unset or empty; `GDK_BACKEND` unset, `wayland`, `x11`, `wayland,x11,*`, `x11,wayland` and `*`
- [x] 2.2 `plan_restore(saved, monitors, can_position)` returns the logical size, the placement (`Center`, `At(x, y)` or `Leave`) and the maximize flag, following the four restore rules in `design.md`
- [x] 2.3 `cargo test` covers first run with and without `can_position`, a size below the minimum being raised, a size larger than the work area being clamped (including a monitor with scale factor 2), a saved position off every monitor falling back to `Center`, a partly off-screen position being shifted inside the work area, `can_position = false` never giving `At` or `Center`, the maximized flag being carried over, and an empty monitor list

## 3. Wire window state into the app

- [ ] 3.1 `src-tauri/tauri.conf.json` gives the window `label: "main"`, title "Quiro", `width` 1000, `height` 700, `minWidth` 480, `minHeight` 320 and `visible: false`, with no `center` key
- [ ] 3.2 In `setup`, `lib.rs` resolves `app_local_data_dir()/window-state.json`, loads it, builds the monitor work areas and `can_position` (not Wayland), then applies the plan in the order: size, placement, show, maximize
- [ ] 3.3 The window is shown even when resolving the path, loading, or applying the plan fails (reviewer can see a code path that always calls `show()`)
- [ ] 3.4 `lib.rs` records the last normal size and position from `Resized` and `Moved` events while the window is neither maximized nor minimized, and on `CloseRequested` saves that size, the current maximized flag, and the position only when `can_position`
- [ ] 3.5 No crate or npm dependency is added by this section, and `tauri-plugin-window-state` is not used
