## 1. Navigation guard

- [x] 1.1 A new module in `src-tauri/src/` defines a pure `is_app_url(url: &tauri::Url, dev: bool) -> bool`. It compares the URL's scheme, host and port: when `dev` is true, it allows only `http://localhost:1420`; otherwise only `tauri://localhost` and `http://tauri.localhost`.
- [x] 1.2 The same module builds a Tauri plugin with `tauri::plugin::Builder` whose `on_navigation` handler returns `is_app_url(url, tauri::is_dev())`, and `src-tauri/src/lib.rs` registers it.
- [x] 1.3 `cargo test` covers `is_app_url` with a table of URLs:
  - `http://localhost:1420/` and a path under it are allowed with `dev` true and refused with `dev` false;
  - `tauri://localhost/` and `http://tauri.localhost/` are allowed with `dev` false and refused with `dev` true;
  - `https://example.com/`, `http://localhost:1421/`, `https://tauri.localhost/`, a `file:///` URL and a `data:` URL are refused in both modes.
- [x] 1.4 The main window in `src-tauri/tauri.conf.json` sets `"zoomHotkeysEnabled": false` and `"dragDropEnabled": true`, and the file's other settings are unchanged.
- [x] 1.5 `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `package.json`, `package-lock.json` and `src/bindings.ts` are unchanged, and `tauri` doesn't enable the `devtools` feature.
- [x] 1.6 `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings` and `cargo test` pass in the gate.

## 2. Frontend guard

- [ ] 2.1 A new module outside `src/editor/` exports `installWebviewGuard(options: { dev: boolean }): () => void`. The returned function removes every listener it added.
- [ ] 2.2 The guard adds its `keydown` and `contextmenu` listeners on `window` in the bubble phase (not `capture`), and never calls `stopPropagation` or `stopImmediatePropagation`.
- [ ] 2.3 With `dev: false`, a `contextmenu` event on `window` is cancelled. With `dev: true`, the guard adds no `contextmenu` listener.
- [ ] 2.4 The guard cancels the default action of each key in the spec's list: F5, Ctrl+R, Ctrl+Shift+R, Ctrl+F5, Shift+F5, Ctrl+P, Ctrl+F, F3, Shift+F3, Ctrl+G, Ctrl+Shift+G, Alt+ArrowLeft, Alt+ArrowRight, BrowserBack, BrowserForward, Ctrl+J, F7, Ctrl+U, Ctrl+Minus, Ctrl+Plus, Ctrl+= and Ctrl+0. It also cancels F12, Ctrl+Shift+I, Ctrl+Shift+J and Ctrl+Shift+C, but only when `dev` is false.
- [ ] 2.5 The guard ignores a `keydown` with `isComposing` true or `keyCode` 229, and ignores Esc.
- [ ] 2.6 `src/vite-env.d.ts` contains `/// <reference types="vite/client" />`, and `src/main.ts` calls `installWebviewGuard({ dev: import.meta.env.DEV })` before creating the editor.
- [ ] 2.7 New jsdom tests check that:
  - each listed key, dispatched on an element inside the document, ends `defaultPrevented`;
  - the devtools keys end `defaultPrevented` with `dev: false` and not with `dev: true`;
  - a `keydown` listener on that element sees `defaultPrevented === false`, so the guard runs after the element's own handlers;
  - a listed key with `isComposing: true` isn't cancelled;
  - Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z, Ctrl+X, Ctrl+C, Ctrl+V, Ctrl+A, the four arrow keys, Home, End and Esc aren't cancelled;
  - `contextmenu` is cancelled with `dev: false` and not with `dev: true`;
  - after the returned function is called, nothing is cancelled.
- [ ] 2.8 Existing test files are unchanged, and `npm run lint`, `npm test` and `npm run build` pass in the gate.
