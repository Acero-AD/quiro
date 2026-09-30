## Context

The scaffold's frontend calls `invoke("greet", { name })` with a hand-written command name and argument key. Nothing checks either against the Rust signature.

Research: [What are the options for sharing command types between Rust and TypeScript in Tauri v2?](https://github.com/Acero-AD/quiro/issues/5), in `docs/research/tauri-ipc-type-sharing.md` on branch `research/tauri-ipc-type-sharing`. It compared tauri-specta, ts-rs, typeshare and a hand-written mirror. Its experiment E1 built tauri-specta 2.0.0-rc.25 into a copy of Quiro, and it passed `cargo test`, clippy, `tsc` and `vite build` against Tauri 2.11.5. E1 also showed that a drift test fails `cargo test` on a Rust rename, and that `tsc` fails on frontend misuse.

Harness constraints:
- Workers can't edit `Cargo.toml` or `Cargo.lock`.
- Workers can't run `cargo`: their allowlist is `git status`, `git diff`, `git log` and `openspec`, and the guard blocks the gate commands.
- Reviewers are read-only.
- The gate runs `cargo test` in a throwaway sandbox copy, with a writable `/tmp` and no network.

## Goals / Non-Goals

**Goals:**

- One typed path from the frontend to Rust, with command names, argument keys, results and errors all generated.
- Drift fails the gate on both sides: Rust in `cargo test`, TypeScript in `npm run build`.
- A harness worker can produce the exact bindings file without running anything.
- `ping` becomes a reference example that covers a request struct, a reply struct and a typed error enum.

**Non-Goals:**

- Typed events. There's no event yet; tauri-specta supports them when one is needed.
- Frontend unit tests. Vitest arrives with `add-frontend-tooling`, which tests `src/ping.ts`.
- A lint rule against direct `invoke`. Biome arrives with `add-frontend-tooling`, which adds the rule. Until then, a reviewer checks it from the files.
- Removing `tauri-plugin-opener`. That's a dependency change outside G-005.

## Operator prerequisites

Do these in one prep commit before `harness run add-typed-ipc`, after `add-window-basics` has been accepted.

1. In `src-tauri/Cargo.toml`:
   - add the feature `specta` to `tauri`;
   - add `specta = { version = "=2.0.0-rc.25", features = ["derive"] }`;
   - add `specta-typescript = "=0.0.12"`;
   - add `tauri-specta = { version = "=2.0.0-rc.25", features = ["derive", "typescript"] }`.

   These are the pins the tauri-specta docs recommend. Keep them exact.
2. `cd src-tauri && cargo fetch`, then confirm that `cargo build`, `cargo test`, `cargo fmt --check` and `cargo clippy --all-targets -- -D warnings` pass on the upgraded Tauri 2.12.x.
3. Commit, then run `harness baseline` and `harness doctor` until it says READY.

If rc.25 doesn't build against Tauri 2.12, stop. Revisit the decision (its exit plan is ts-rs plus a hand-written command module) before running.

## Decisions

### tauri-specta, pinned exactly

It's the only surveyed option that generates the command wrappers themselves, including names, argument keys, `Result` errors and events, not just types. It's a release candidate: 25 RCs since 2023, rc.25 from 2026-05, and no stable 2.0. So both crates are pinned with `=`, and upgrades happen in lockstep.

*Exit plan:* ts-rs 12 (stable) for types, plus a hand-written command module. Only the bindings layer would change.

### A shared builder in `src-tauri/src/ipc.rs`

`ipc.rs` owns:
- the IPC types;
- the `ping` command;
- a function returning the configured `tauri_specta::Builder<tauri::Wry>`, with `collect_commands![ping]` and the default `Result` error mode.

`lib.rs` uses `builder.invoke_handler()` in place of `tauri::generate_handler!`. The drift test uses the same builder, so the app and the bindings can't disagree about which commands exist.

### The `ping` reference command

```rust
struct PingRequest { message: String }
struct PingReply { echo: String, version: String }

#[serde(tag = "kind", content = "data", rename_all = "camelCase")]
enum PingError { Empty, TooLong { max: u32 } }

fn ping(request: PingRequest) -> Result<PingReply, PingError>
```

- **Success:** `ping` echoes the message and returns the crate version (`env!("CARGO_PKG_VERSION")`).
- **Errors:** an empty message returns `Empty`. A message longer than 256 characters (counted as `char`s) returns `TooLong { max: 256 }`.
- **Why this shape:**
  - the fields are single words, so casing can't differ between Rust and TypeScript;
  - the error enum uses adjacent tagging, as decided for every data-carrying IPC enum, because rc.25 has known internally-tagged regressions;
  - no 64-bit integers cross IPC, because specta refuses them by default.
- **The JSON shapes:**
  - `{"echo":"hello","version":"0.1.0"}`
  - `{"kind":"empty"}`
  - `{"kind":"tooLong","data":{"max":256}}`

### Export and drift test

A function in `ipc.rs` exports the builder's bindings with `specta_typescript::Typescript` to a given path. If the exporter supports a header, it adds one saying the file is generated and naming the regeneration command.

A `#[test]` in `ipc.rs`:
1. exports to a unique file under `std::env::temp_dir()`;
2. reads the checked-in `src/bindings.ts` (`concat!(env!("CARGO_MANIFEST_DIR"), "/../src/bindings.ts")`);
3. compares the two byte for byte.

- **When `UPDATE_BINDINGS=1` is set:** it writes the fresh output to `src/bindings.ts` and passes.
- **When they differ:** it fails with a message that says how to fix it and contains the complete fresh file between two marker lines:

  ```
  src/bindings.ts is stale. Write exactly the text between the markers to src/bindings.ts,
  or run `cd src-tauri && UPDATE_BINDINGS=1 cargo test` locally.
  ----- BEGIN src/bindings.ts -----
  <generated file>
  ----- END src/bindings.ts -----
  ```

The app never exports bindings at startup. Regenerating is always explicit.

**The worker's loop:**
1. It writes the Rust side and `src/ping.ts`, then reports ready.
2. The gate's `cargo test` fails on the drift test (and `npm run build` may fail too).
3. On its fix round, the worker writes the text between the markers to `src/bindings.ts`.

This costs one of the two fix rounds by design. The file is a few KB, well under the gate's 64 KB output cap.

### Frontend: one client module, one page

- **`src/ping.ts`:**
  - exports a function that calls `commands.ping` from `./bindings` and returns the text to display;
  - on success: `Quiro <version> replied: <echo>`;
  - on `Empty`: `Rust rejected an empty ping`;
  - on `TooLong`: `Rust rejected a ping longer than <max> characters`.

  It's the only place app code calls a command. `add-frontend-tooling` tests it with `mockIPC`.
- **The page:**
  - `index.html` becomes a minimal page titled "Quiro" with one element for the reply;
  - `src/main.ts` fills that element with the result of pinging `"hello"` on load;
  - `src/styles.css` keeps only what that page needs;
  - the greet form, the logos in `src/assets/` and their links are removed.
- **Only one file touches Tauri's `invoke`:** no file under `src/` other than the generated `src/bindings.ts` imports `@tauri-apps/api/core`.

## Risks / Trade-offs

- **[rc.25 fails to build against Tauri 2.12]** → Found by the operator's prep step before any run. Revisit the decision instead of patching around it.
- **[tauri-specta stalls, or rc.26 changes argument casing]** → Upgrades are deliberate, lockstep and exact. The exit plan is above.
- **[Copying from gate output costs a fix round on every IPC change]** → Accepted. If the bindings grow past about 32 KB, raise the gate output cap or adopt a harness generate step.
- **[The generated file fails `tsc` under the repo's strict options]** → E1 passed `tsc` with this `tsconfig.json`. If a later version doesn't, add a header to the generated file rather than loosening `tsconfig.json`.

## Open Questions

- Whether specta-typescript 0.0.12 supports a file header. If not, the file ships without one, and the drift test's message is what tells people how to regenerate.
- When specta and tauri-specta will ship rc.26 or 2.0, and what upgrading from rc.25 will cost.
