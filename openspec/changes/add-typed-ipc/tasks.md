## 1. Typed ping command

- [ ] 1.1 `src-tauri/src/ipc.rs` defines `PingRequest { message }`, `PingReply { echo, version }` and `PingError` (`Empty`, `TooLong { max: u32 }`, adjacently tagged with `kind`/`data` and camelCase variant names), each deriving serde and `specta::Type`
- [ ] 1.2 `ping` is a `#[tauri::command]` and `#[specta::specta]` function returning `Result<PingReply, PingError>`: it echoes the message with `env!("CARGO_PKG_VERSION")`, returns `Empty` for an empty message and `TooLong { max: 256 }` for a message over 256 characters
- [ ] 1.3 `ipc.rs` exposes a function returning the configured `tauri_specta::Builder` with `collect_commands![ping]`, and `lib.rs` registers commands only through its `invoke_handler()`
- [ ] 1.4 The `greet` command is removed from `src-tauri/src/lib.rs`
- [ ] 1.5 `cargo test` covers the success reply, the empty and the 257-character cases, and asserts the JSON of `PingReply` and both `PingError` variants against the shapes in `design.md`

## 2. Bindings export and drift test

- [ ] 2.1 `ipc.rs` has a function that exports the builder's TypeScript bindings to a given path, and the app never calls it at startup
- [ ] 2.2 A drift test exports to a unique file under `std::env::temp_dir()` and compares it byte for byte with `src/bindings.ts`; with `UPDATE_BINDINGS=1` it writes `src/bindings.ts` and passes instead
- [ ] 2.3 On a mismatch the drift test fails with a message that names the regeneration command and contains the complete generated file between `----- BEGIN src/bindings.ts -----` and `----- END src/bindings.ts -----` lines
- [ ] 2.4 `src/bindings.ts` is checked in and equals the generated output, so the gate's `cargo test` passes (when it doesn't, copy the text between the markers from the gate output)

## 3. Minimal ping page

- [ ] 3.1 `src/ping.ts` exports a function that calls `commands.ping` from `./bindings` and returns the display text for a reply and for each `PingError` variant, as worded in `design.md`
- [ ] 3.2 `index.html` is a minimal page titled "Quiro" with one element for the reply, and `src/main.ts` fills it with the text for pinging "hello" on load
- [ ] 3.3 The greet form and code, the starter logos in `src/assets/` and their links, and styles only they used are removed
- [ ] 3.4 No file under `src/` other than `src/bindings.ts` imports `@tauri-apps/api/core`, and `npm run build` passes in the gate
