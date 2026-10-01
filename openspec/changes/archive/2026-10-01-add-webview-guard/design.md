## Context

After `add-editor`, the window shows a full-window CodeMirror editor, and `src/main.ts` mounts it on `DOMContentLoaded`. Tauri runs with its defaults:
- `tauri.conf.json` sets none of `zoomHotkeysEnabled`, `dragDropEnabled` or `devtools`;
- `src-tauri/Cargo.toml` enables no `devtools` feature;
- `lib.rs` registers `tauri_plugin_opener::init()`.

Sources:
- [What must the webview stop doing to feel like an app?](https://github.com/Acero-AD/quiro/issues/18): the mechanism, the key list, dev versus release, and the revised G-106 criteria;
- research [Which browser behaviours leak through the Tauri v2 webview on WebKitGTK and WebView2?](https://github.com/Acero-AD/quiro/issues/8), in `docs/research/tauri-webview-browser-behaviours.md` on branch `research/tauri-webview-browser-behaviours`;
- [How are WebKitGTK-only behaviours verified when the gate cannot run WebKitGTK?](https://github.com/Acero-AD/quiro/issues/20): manual checks;
- [How does the work split into OpenSpec changes and tasks.md sections?](https://github.com/Acero-AD/quiro/issues/19): scope and order.

What the research found:
- **Config knobs:** Tauri exposes only `zoomHotkeysEnabled`, `dragDropEnabled` and `devtools`, and zoom is already off by default.
- **WebView2** keeps reload, print, find, history and other browser shortcuts in release builds.
- **WebKitGTK** has no such shortcuts, but its page context menu shows Back, Forward, Stop and Reload in release builds, and Tauri has no setting for it.
- **Links:** a plain link click navigates the whole webview, unless an `on_navigation` handler refuses it.
- **Drops:** with `dragDropEnabled: true`, Tauri consumes file drops, which then never navigate.
- **Devtools** are the only dev/release difference.

## Goals / Non-Goals

**Goals:**

- G-106: the webview never leaves the app's page, shows no context menu in release, ignores browser shortcuts and file drops, doesn't zoom, and has no devtools in release.
- Every rule that can be checked in the gate is checked there: a Rust unit test of the URL check, and jsdom tests of the frontend guard.
- No new dependencies.

**Non-Goals:**

- **Making UI text unselectable.** Phase 1 has no UI besides the editor. That's out of scope on the map.
- **An app-drawn context menu (Cut, Copy, Paste).** It belongs to a later goal.
- **Tab moving focus out of the editor.** That's G-305's.
- **WebKitGTK's Ctrl+B and Ctrl+I bindings.** CodeMirror re-reads the unchanged text, and formatting keys belong to G-405.
- **Link clicking in rendered Markdown.** That's a Phase 3 decision. The opener plugin stays as it is.
- **WebView2 settings through `with_webview`.** Recorded below as the Windows fallback, not built.

## Operator prerequisites

None. This change adds no crate or npm package, and the only configuration it edits, `src-tauri/tauri.conf.json`, isn't a runner file.

## Decisions

### Rust navigation guard: an in-crate plugin

`on_navigation` is available on window and plugin builders, but not in `tauri.conf.json` (research, "Navigation on link clicks"). A plugin's handler also applies to the window declared in config, so the guard is a small plugin in a new module, for example `src-tauri/src/navigation_guard.rs`:

- **A pure function, `is_app_url(url: &tauri::Url, dev: bool) -> bool`,** compares the URL's scheme, host and port with the app's origins:
  - **dev** (`tauri dev`): `http://localhost:1420`, the `devUrl` in `tauri.conf.json`;
  - **otherwise:** the custom-protocol origins `tauri://localhost` (Linux) and `http://tauri.localhost` (Windows). Quiro doesn't set `useHttpsScheme`, so `https://tauri.localhost` isn't allowed. Both release origins are accepted on every platform, which keeps the function free of `cfg` branches.

  It compares components rather than `Url::origin()`, because a custom scheme such as `tauri:` has an opaque origin in the `url` crate.
- **The plugin** is built with `tauri::plugin::Builder::new(...).on_navigation(|_, url| is_app_url(url, tauri::is_dev()))` and registered in `lib.rs` next to the opener plugin. A refused navigation is silent: no dialog and no log.
- **Coverage:** this one guard covers links, dropped URLs, including drops on empty space that CodeMirror doesn't handle, `file:` loads, and back/forward. With no navigation ever succeeding, history keeps a single entry.
- **Reload:** a reload of the same URL would still pass, but it can't be reached once the shortcuts and the menu are gone.

`tauri::Url` is Tauri's re-export of `url::Url`, so the guard needs no new crate.

*Rejected:*
- **Allowing only the first load:** it's unverified whether Tauri navigates for its own purposes, and dev needs Vite's full reloads.
- **Native GTK and WebView2 settings as the main mechanism:** they add direct dependencies, the Windows code compiles only in CI, and whether they cover the first page load is unverified.
- **`tauri-plugin-prevent-default`:** a third-party plugin.

### Frontend guard: one small module outside the editor

A new module, for example `src/webview-guard.ts`, exports `installWebviewGuard(options: { dev: boolean }): () => void`. The returned function removes the listeners, so tests can isolate themselves. `src/main.ts` calls it with `import.meta.env.DEV` before the editor mounts. It's separate from the Phase 2 app keymap and doesn't depend on it.

- **Context menu:** in release mode, a `contextmenu` listener on `window` calls `preventDefault()`. In dev mode, none is added.
- **Shortcuts:** a `keydown` listener on `window` calls `preventDefault()` for the keys in the spec. It never calls `stopPropagation()`. It ignores events with `isComposing` set or `keyCode` 229, as well as Esc, which also cancels an IME composition and does nothing useful in WebView2 on a loaded page. Letters are matched case-insensitively on `event.key`, with the Ctrl, Shift and Alt states compared exactly.
- **Not handled:** drops, wheel events and mouse side buttons. Zoom stays off through config. A window-level wheel listener that can cancel can't be passive, which would cost scrolling performance on large documents.

**The listeners use the bubble phase, not the capture phase.** CodeMirror ignores any event that's already `defaultPrevented`: `eventBelongsToEditor` returns false for it, and `runHandlers` stops at it (`@codemirror/view` 6.43.13, `dist/index.js`). A capture-phase listener on `window` would cancel the event before the editor saw it. CodeMirror's own Alt+←/→ bindings, and G-406's later Ctrl+F search, would then stop working. In the bubble phase, the editor's handlers on its content element run first, and the guard cancels the browser's default action afterwards.

This refines the mechanism in [What must the webview stop doing to feel like an app?](https://github.com/Acero-AD/quiro/issues/18) without changing its intent: "cancels the browser's default action only and never stops the event, so editor bindings still run".

**What counts as dev:**
- **Frontend:** `import.meta.env.DEV`, which Vite replaces at build time.
- **Navigation guard:** `tauri::is_dev()`, which is true under `tauri dev`. `npm run tauri build -- --debug` counts as release, because it serves the custom protocol.

`import.meta.env` needs Vite's client types, which `tsconfig.json` doesn't load yet. So this change adds `src/vite-env.d.ts` with `/// <reference types="vite/client" />`. Later changes rely on it for `import.meta.env` and `?raw` imports.

### Config: two explicit defaults

The main window in `tauri.conf.json` gets `"zoomHotkeysEnabled": false` and `"dragDropEnabled": true`. Both are Tauri's defaults, written down so that a later edit can't flip them without anyone noticing.
- **`dragDropEnabled: true`:** Tauri swallows file drops on both engines and emits drop events with file paths, which G-202 can use.
- **Why not `false`:** CodeMirror's drop handler would read a dropped file and paste its text into the document, and a later drop-to-open would get no paths.

**Windows cost:** WebView2 then gets no in-page drag-and-drop at all. Selected text can't be dragged within the editor, and text can't be dragged in from other apps.

### No devtools in release

Tauri turns devtools off in release builds unless its `devtools` Cargo feature is enabled. `src-tauri/Cargo.toml` already enables only `specta` on `tauri` and stays untouched. That's checked from the file. Dev builds keep devtools and the engine's menu. On Linux, the menu's Inspect Element is the only confirmed way in.

### Windows fallback (not built)

Suppose the manual Windows check finds that JS cancellation leaks: a shortcut, the context menu or a side button still acts. Then set WebView2's `AreBrowserAcceleratorKeysEnabled = false` and `AreDefaultContextMenusEnabled = false` through `with_webview` → `controller().CoreWebView2()` → `ICoreWebView2Settings3`. This needs `webview2-com` and `windows` crates at the versions Tauri uses, and whether the settings apply to the first page load is unverified. It would be its own `fix-add-webview-guard-<what>` change.

## Manual verification

These checks sit outside `tasks.md`. Run them after this change's PR is merged, on `master`. Record the date, the commit and the machine (CPU, WebKitGTK version, compositor), then pass or fail for each item, in this change's `verification.md`. This change is archived only when every Linux item passes. A failed item becomes a `fix-add-webview-guard-<what>` change.

**Linux, release build** (`npm run tauri build -- --no-bundle` and run `src-tauri/target/release/quiro`, or the CI artifact):
- **Drops:** dropping a file onto the text, dropping a file onto empty space below it, and dragging a link from a browser onto empty space each leave the document unchanged, and the window keeps showing the editor.
- **Context menu:** right-clicking over the text and over empty space shows no menu.
- **Zoom and side buttons:** Ctrl+wheel, a touchpad pinch, and the mouse side buttons do nothing.
- **Devtools:** F12 and Ctrl+Shift+I open nothing.

**Linux, dev build** (`npm run tauri dev`):
- Right-clicking shows the engine's menu with Inspect Element.

**Windows** (verified on Windows later; added to [Manual Windows check](https://github.com/Acero-AD/quiro/issues/22) when this change is archived), in a release build:
- the listed browser shortcuts do nothing;
- right-click shows no menu;
- the mouse side buttons don't navigate;
- a dropped file leaves the document unchanged.

## Risks / Trade-offs

- **[Tauri navigates to a URL outside the app's origin for its own purposes, such as `about:blank`]** → The refused navigation would leave a blank or broken page. The first manual check, the app starting with the editor visible, shows it at once. The fix would add that URL to `is_app_url`.
- **[JS cancellation doesn't stop WebView2's accelerators or side buttons]** → This is unverified (research, open questions 2 and 3). The Windows check finds out, and the `with_webview` fallback above is ready.
- **[A Ctrl-key shortcut is matched on `event.key` under a non-Latin keyboard layout]** → Such a layout may report a different `key`. Accepted for Phase 1; the Windows check covers the default layout.
- **[`dragDropEnabled: true` blocks in-page drag-and-drop on Windows]** → Accepted, and recorded above.

## Open Questions

From the research behind [Which browser behaviours leak through the Tauri v2 webview on WebKitGTK and WebView2?](https://github.com/Acero-AD/quiro/issues/8):

- Does JS `keydown` `preventDefault` reliably suppress WebView2's F5, Ctrl+R, Ctrl+P, Ctrl+F and Alt+←/→?
- Does JS `mouseup` `preventDefault` cancel XButton1/2 navigation in WebView2?
- Does Ctrl+Shift+I open the inspector in Linux dev builds? The Tauri docs say so, but no binding was found in WebKitGTK.
- Does a touchpad pinch change the page scale in a WebKitGTK Tauri window?
