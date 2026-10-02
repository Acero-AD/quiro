# Quiro

A fast, plugin-extensible Markdown editor for Linux and Windows, written in Rust.

## Status

Early development. The project is scaffolded (Tauri v2 shell + Vite/TypeScript
frontend) and does not edit Markdown yet — the window shows Rust's reply to a
typed `ping` command, which proves the frontend-to-Rust channel.

## Stack

| Layer     | Choice                                                     |
| --------- | ---------------------------------------------------------- |
| Shell     | [Tauri v2](https://tauri.app) — native webview, Rust core   |
| Frontend  | TypeScript + Vite (CodeMirror 6 editor to come)             |
| Backend   | Rust — file I/O, Markdown export, plugin host               |

## Layout

```
index.html, src/       Frontend (TypeScript + Vite)
  bindings.ts          Generated IPC bindings — the only way to call Rust
src-tauri/             Rust backend and Tauri config
  src/lib.rs           App setup
  src/ipc.rs           IPC types, commands and bindings export
  tauri.conf.json      Window, bundle and build configuration
```

## Development

### Prerequisites

- Rust (stable)
- Node.js 26 or later
- On Linux, the WebKitGTK 4.1 system packages: `webkit2gtk-4.1` on Arch,
  `libwebkit2gtk-4.1-dev` on Debian and Ubuntu, plus the rest of the list on
  [Tauri's prerequisites](https://tauri.app/start/prerequisites/) page

### Setup and running

```sh
npm ci               # install the locked dependencies (includes the Tauri CLI)
PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium-headless-shell
npm run tauri dev    # run the app with hot reload
npm run tauri build  # produce a release build and installers
```

The second line downloads the headless Chromium that `npm test` runs the
browser tests in. It goes inside `node_modules`, so `npm ci` deletes it: run
the line again after every `npm ci`. On Debian and Ubuntu, adding `--with-deps`
also installs the system libraries Chromium needs, as CI does.

### Checks

Every check must pass before a change is accepted.

```sh
# Frontend, from the repository root
npm run lint     # Biome lint and format check; never writes files
npm test         # Vitest: unit tests under jsdom, *.browser.test.ts in headless Chromium
npm run build    # type-check with tsc, then bundle with Vite

# Rust, from src-tauri/
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
```

`npm run format` rewrites the frontend sources to Biome's formatting and
applies its safe lint fixes.

### IPC bindings

`src/bindings.ts` is generated from the Rust commands and checked in. `cargo
test` fails when it is stale. After changing an IPC type or command,
regenerate it:

```sh
cd src-tauri && UPDATE_BINDINGS=1 cargo test
```

Frontend code calls Rust only through these bindings; `npm run lint` rejects a
direct import of `@tauri-apps/api/core`.
