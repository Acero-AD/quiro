## Context

Quiro is a Tauri v2 app (Rust core, TypeScript and Vite frontend). Its one window comes from the scaffold's `tauri.conf.json`: 800×600 and titled "Quiro", with no minimum and no memory between runs. The target platforms behave very differently. Research: [How does Tauri v2 handle window size, position and minimum size on Wayland, X11 and Windows?](https://github.com/Acero-AD/quiro/issues/4), in `docs/research/tauri-window-geometry.md` on branch `research/tauri-window-geometry`.

- **Wayland (the operator's Omarchy/Hyprland session):**
  - Tauri runs as a native Wayland client.
  - Position, `center` and `set_outer_position` do nothing.
  - Size and minimum size are only requests.
  - Hyprland tiles the window unless a float rule applies, and Omarchy refuses maximize.
- **X11 and Windows:** size, position, minimum size and maximize are honoured as configured.
- **`tauri-plugin-window-state` 2.5.0:**
  - it can't restore position on Wayland and never clamps size to the screen;
  - it stores physical sizes in the config directory;
  - with the locked tao 0.35.3, it hits an open bug where the window grows on every restart under GTK client-side decorations. tao 0.36, which comes with Tauri 2.12, fixes it.

Decisions come from [What should window basics promise on Wayland, X11 and Windows?](https://github.com/Acero-AD/quiro/issues/11). The terms **window state** and **setting** are defined in `CONTEXT.md`.

## Goals / Non-Goals

**Goals:**

- Tauri is on the latest stable 2.x.
- A predictable first-run window and a minimum size.
- Window state is remembered and restored within what each platform allows. It never jumps visibly and never ends up off-screen.
- All geometry decisions live in pure Rust that `cargo test` covers without a display.

**Non-Goals:**

- Compositor rules (a Hyprland float rule) or any attempt to position the window on Wayland.
- Multiple windows, fullscreen, or remembering which monitor the window was on beyond its position.
- Settings (G-402). Window state is not a setting and doesn't share its file.
- Editor layout: the editor filling the window is G-101.

## Operator prerequisites

Do these in one prep commit before `harness run add-window-basics`. Workers can't edit these files, because they're gate runner files.

1. Use a harness build that accepts `sandbox_read_only_paths` (harness PR #9, `sandbox-toolchain-paths`). Otherwise `harness doctor` reports NOT READY.
2. Upgrade Tauri to the latest stable 2.x (2.12.x at the time of writing) across the crates and packages:
   - the crates `tauri`, `tauri-build` and `tauri-plugin-opener`;
   - the npm packages `@tauri-apps/cli`, `@tauri-apps/api` and `@tauri-apps/plugin-opener`.

   Update both lockfiles, then `cargo fetch` in `src-tauri/`. Don't move to 3.0 alphas.
3. Check that `npm run tauri dev` still opens the starter window, and that `cargo test`, `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings` and `npm run build` pass.
4. Commit, then run `harness approve` if doctor asks, then `harness baseline`, then `harness doctor` until it says READY.

## Decisions

### Our own window-state code, no plugin

The plugin can't express the Wayland rules (no position, and a tiled size that doesn't count), stores physical sizes, doesn't clamp, and keeps its file in the config directory next to future settings. The logic is small and pure, so owning it costs little and makes it testable.

*Alternative:* the plugin configured with `StateFlags` without `POSITION`. Rejected: it still doesn't clamp or centre, and it still uses physical sizes.

### A pure core with thin wiring

A new module `src-tauri/src/window_state.rs` holds everything that can be decided without a window:

- **The state record:** logical `width` and `height`, `maximized`, and an optional physical `x`/`y`. It comes with the first-run defaults (1000×700) and the minimum (480×320).
- **`load(path)` and `save(path, state)`:**
  - `load` returns `None` for a missing, unreadable, invalid or unknown-schema file, and never panics.
  - `save` creates the directory and writes atomically, to a temp file in the same directory and then renamed.
- **`is_wayland(wayland_display, gdk_backend)`:** see below.
- **`plan_restore(saved, monitors, can_position)`:**
  - it takes the saved state (or none) and the monitors' work areas (physical rectangle plus scale factor);
  - it returns the logical size to request, the placement (`Center`, `At(x, y)` or `Leave`) and whether to maximize.

`lib.rs` only gathers the inputs from Tauri (paths, monitors, environment), applies the plan, and records state on window events. Tests go through the pure functions. Nothing in the wiring decides geometry.

### Where the state is stored

The state is stored in `window-state.json` in `app.path().app_local_data_dir()`:
- Linux: `~/.local/share/com.somosbytes.quiro/`
- Windows: `%LOCALAPPDATA%\com.somosbytes.quiro\`

It's a data directory, as decided. It's the *local* one because geometry belongs to one machine and shouldn't roam with a Windows profile. Settings will live in the config directory (G-402).

The file format is JSON:

```json
{ "schema": 1, "width": 1000.0, "height": 700.0, "maximized": false, "x": 120, "y": 80 }
```

`x` and `y` are left out where position isn't saved. An unknown `schema` counts as invalid.

### Detecting Wayland

The check is `is_wayland = target_os == "linux" && WAYLAND_DISPLAY is non-empty && GDK_BACKEND's first entry is "wayland" or "*" (or GDK_BACKEND is unset)`. It's a pure function of the two variables, read once at startup.

It mirrors how GDK 3 picks a backend. By default it tries Wayland before X11, and `GDK_BACKEND` is an ordered list that overrides that order. Tao never pins a backend. Omarchy exports `GDK_BACKEND=wayland,x11,*`.

*Alternative:* asking GDK for its display type. Rejected: it needs the `gtk` crate as a direct dependency (an operator change) for no practical gain.

### Restore rules (`plan_restore`)

1. **No saved state:** 1000×700, centred where `can_position`, otherwise left where it opens.
2. **Size:** raised to at least 480×320, then clamped to the work area of the target monitor, converted to logical pixels with that monitor's scale factor. The target monitor is the one whose work area contains the saved position. Failing that, it's the first reported monitor, and with no monitors reported there's no clamping.
3. **Position:** used only where `can_position`, which is false on Wayland.
   - If the saved top-left corner lies inside some monitor's work area, the window is placed there, shifted as needed so the whole clamped window fits inside that work area.
   - Otherwise it's centred.
4. **Maximized:** carried over as is.

### Hidden until placed

The window is created with `visible: false`. In `setup`, Quiro:
1. sets the size (the normal, unmaximized size);
2. places the window;
3. shows it;
4. maximizes it last if needed.

Maximizing after showing avoids the old Wayland protocol error when a buffer size was committed while maximized (tao#977). If loading or planning fails, the window is still shown with the defaults. It must never stay hidden.

### What gets saved, and when

- **While running:** Quiro keeps the last *normal* geometry, from `Resized` and `Moved` events received while the window is neither maximized nor minimized.
- **On `CloseRequested`:** it saves that normal size, the current maximized flag, and the normal position where `can_position`.

Unmaximizing after a restart therefore gives a sensible size. On a tiled Wayland window the saved size is the tile. That's harmless: the tile wins again on the next start.

### Window configuration

In `tauri.conf.json` the window gets:
- `label: "main"` and title "Quiro";
- `width` 1000, `height` 700, `minWidth` 480, `minHeight` 320;
- `visible: false`.

`center` is left unset, because `plan_restore` decides placement. The capability file already targets `main`.

### Tiling window managers

Quiro ships no float rule. It accepts the tile it's given, and its UI must fill any size at or above the minimum.

## Manual verification

These checks sit outside `tasks.md`, because the gate can't run a real window. How they're recorded is decided in [How are WebKitGTK-only behaviours verified when the gate cannot run WebKitGTK?](https://github.com/Acero-AD/quiro/issues/20).

- **Linux (Hyprland):**
  - The window tiles, and the page fills the tile.
  - Close and restart five times: the size hasn't grown.
  - Deleting `window-state.json` gives the first-run defaults.
  - Writing garbage into it gives the defaults and no crash.
- **Linux (X11, optional):** with `GDK_BACKEND=x11` and the window floating, the position is restored across restarts.
- **Windows (verified on Windows later):**
  - 1000×700 centred on first run;
  - size, position and maximized restored;
  - the minimum enforced;
  - a position on a disconnected monitor falls back to centred.

## Risks / Trade-offs

- **[`Monitor::work_area()` missing or wrong on some platform]** → Fall back to the monitor's full rectangle (`position()` and `size()`). The pure planner only sees rectangles, so this affects nothing else.
- **[Win32 may not enforce the minimum on programmatic sizing]** → `plan_restore` raises the size to the minimum itself.
- **[The Tauri upgrade breaks something]** → The operator's prep step runs every check before committing, and a failure blocks the baseline.
- **[The size is clamped on a smaller monitor and then saved, so it stays smaller later]** → Accepted: the saved size is what the user last saw.
- **[`GDK_BACKEND` points at an unavailable backend]** → GDK falls back or fails before Quiro's code runs. The detection only picks whether to set a position, so the worst case is a no-op position request.

## Open Questions

- How the manual checks above are recorded. That's decided in [How are WebKitGTK-only behaviours verified when the gate cannot run WebKitGTK?](https://github.com/Acero-AD/quiro/issues/20).
- What `inner_size()` and `outer_position()` return for a tiled versus a floating Quiro window on Hyprland. The research couldn't verify this at runtime, and the manual Hyprland check answers it.
