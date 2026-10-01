## Why

Quiro's window is a webview, and it still behaves like a browser in places:
- a plain link click or a dropped URL replaces the app's page;
- on Linux the page's context menu offers Back, Forward, Stop and Reload, even in release builds;
- on Windows, WebView2 keeps its reload, print, find and history shortcuts.

G-106 is the goal that makes the webview behave like an app. Now that `add-editor` has put an editor in the window, there's text to drop files onto and right-click over, so its manual checks can run.

The decisions come from [What must the webview stop doing to feel like an app?](https://github.com/Acero-AD/quiro/issues/18), based on the research in [Which browser behaviours leak through the Tauri v2 webview on WebKitGTK and WebView2?](https://github.com/Acero-AD/quiro/issues/8). The order and scope come from [How does the work split into OpenSpec changes and tasks.md sections?](https://github.com/Acero-AD/quiro/issues/19).

## What Changes

- **A Rust navigation guard:** a small in-crate Tauri plugin using `on_navigation`. It refuses every navigation outside the app's own origin, in dev and release, which covers link clicks, dropped URLs and `file:` loads. With no navigation ever succeeding, Back and Forward have nowhere to go.
- **A frontend guard,** a small module outside `src/editor/` that `main.ts` installs before the editor mounts:
  - **context menu:** cancelled in release builds; dev builds keep the engine's menu, with Inspect Element;
  - **WebView2 shortcuts:** the default action of WebView2's built-in browser shortcuts is cancelled (reload, print, find, history, downloads, caret browsing, view source and zoom), plus the devtools keys in release only;
  - it never stops an event, runs after the editor's own handlers, and ignores keys pressed during composition.
- **`tauri.conf.json` sets `zoomHotkeysEnabled: false` and `dragDropEnabled: true` explicitly** on the main window. Both are Tauri's defaults.
  - **Zoom:** stays off.
  - **File drops:** Tauri swallows them, so they never navigate or paste the file into the document, and their paths stay available for G-202.
- **No new dependencies.** Release builds keep devtools off, because Tauri's `devtools` Cargo feature stays disabled.

## Capabilities

### New Capabilities

- `webview-behaviour`: navigation is confined to the app's origin, dropped files are ignored, there's no context menu in release, browser shortcuts are cancelled, zoom is off, and release builds have no devtools.

### Modified Capabilities

None.

## Impact

- **Operator prerequisites:** none. There are no new crates or npm packages, and `tauri.conf.json` isn't a runner file.
- **Code:**
  - `src-tauri/src/` gains the navigation-guard plugin with its unit tests, registered in `lib.rs`;
  - `src-tauri/tauri.conf.json` sets the two window flags;
  - a new frontend module, its jsdom tests, and `src/vite-env.d.ts` for Vite's client types (`import.meta.env.DEV`);
  - `src/main.ts` installs the guard.
- **Run order:** second Phase 1 change, after `add-editor` is archived and before `add-markdown-mode`.
- **Manual check:** a Linux check on a release build after the merge, plus one dev-build item. The Windows items (shortcuts, context menu, side buttons and file drop) go to [Manual Windows check](https://github.com/Acero-AD/quiro/issues/22).
- **Windows cost:** with `dragDropEnabled: true`, WebView2 gets no in-page drag-and-drop. Selected text can't be dragged within the editor, or dragged in from other apps.
