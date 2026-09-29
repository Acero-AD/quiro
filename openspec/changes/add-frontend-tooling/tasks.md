## 1. Vitest with jsdom and the first test

- [ ] 1.1 `vitest.config.ts` at the repository root sets `environment: "jsdom"` and includes `src/**/*.test.ts`
- [ ] 1.2 `src/ping.test.ts` mocks IPC with `mockIPC` from `@tauri-apps/api/mocks`, calls `clearMocks` after each test, and imports `describe`, `it` and `expect` from `vitest` explicitly
- [ ] 1.3 `src/ping.test.ts` asserts the display text for a successful reply, for `{ kind: "empty" }` and for `{ kind: "tooLong", data: { max: 256 } }` (the errors thrown as plain objects from the mock), and that the command invoked is `ping` with `{ request: { message } }`
- [ ] 1.4 `npm test`, `npm run lint` and `npm run build` pass in the gate with the new files

## 2. README

- [ ] 2.1 The README's prerequisites list Rust stable, Node 26 or later, and the WebKitGTK 4.1 system packages on Linux, linking Tauri's prerequisites page
- [ ] 2.2 The README shows setup with `npm ci` and running the app with `npm run tauri dev`
- [ ] 2.3 The README lists every check (`cargo fmt --check`, `cargo clippy --all-targets -- -D warnings` and `cargo test` in `src-tauri/`, plus `npm run lint`, `npm test` and `npm run build`), `npm run format`, and the bindings regeneration command `cd src-tauri && UPDATE_BINDINGS=1 cargo test`
- [ ] 2.4 The README's status text no longer describes the Tauri starter page
