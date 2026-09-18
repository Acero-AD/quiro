# Quiro

A fast, plugin-extensible Markdown editor for Linux and Windows, written in Rust.

## Status

Early development. The project is scaffolded (Tauri v2 shell + Vite/TypeScript
frontend) and does not edit Markdown yet — the window still shows the stock
Tauri starter page.

## Stack

| Layer     | Choice                                                     |
| --------- | ---------------------------------------------------------- |
| Shell     | [Tauri v2](https://tauri.app) — native webview, Rust core   |
| Frontend  | TypeScript + Vite (CodeMirror 6 editor to come)             |
| Backend   | Rust — file I/O, Markdown export, plugin host               |

## Layout

```
index.html, src/       Frontend (TypeScript + Vite)
src-tauri/             Rust backend and Tauri config
  src/lib.rs           App setup and #[tauri::command] handlers
  tauri.conf.json      Window, bundle and build configuration
```

## Development

Prerequisites: Rust (stable), Node.js 20+, and the Tauri v2 system
dependencies for your platform — on Linux that means `webkit2gtk-4.1`
and friends; see [Tauri's prerequisites](https://tauri.app/start/prerequisites/).

```sh
npm install        # frontend dependencies (includes the Tauri CLI)
npm run tauri dev  # run the app with hot reload
npm run tauri build # produce a release build and installers
```

The frontend alone can be run with `npm run dev` and type-checked and bundled
with `npm run build`.
