## Why

Only the Rust half of Quiro has checks. The frontend has no tests, no linter and no formatter, and the harness gate only type-checks it. Phase 1 is almost entirely frontend (CodeMirror), so G-002's checks have to exist before Phase 1 starts.

The toolchain was decided in [Which frontend test runner, linter and formatter does the repo adopt?](https://github.com/Acero-AD/quiro/issues/9). How it reaches the offline gate was decided in [What do the harness gate and CI run, on which OSes, and what does CI upload?](https://github.com/Acero-AD/quiro/issues/10).

## What Changes

- The operator installs Vitest, jsdom and Biome, adds the `lint`, `format` and `test` scripts, sets `engines.node` to `>=26`, adds `biome.json`, formats the existing code once, and switches the harness gate to run the frontend checks. All of this happens before the run.
- `npm run lint` runs `biome ci .`. It's a lint and format check that never writes files. The Biome config forbids importing `@tauri-apps/api/core` outside the generated bindings, so the "no direct `invoke`" rule from `add-typed-ipc` becomes a gate check.
- `npm run format` runs `biome check --write .`.
- `npm test` runs Vitest with jsdom. The first real test covers the `ping` client from `add-typed-ipc`, with IPC mocked.
- The README documents the prerequisites (Rust stable, Node 26 or later, WebKitGTK 4.1), setup, and every check command.

## Capabilities

### New Capabilities

- `developer-checks`: the check commands that must pass from a clean clone, how frontend lint, format and tests behave, the forbidden direct-IPC import, and the README's setup and check documentation.

### Modified Capabilities

None.

## Impact

- **Operator prerequisites, before the run:**
  - `package.json` and `package-lock.json` (new dev dependencies, scripts, `engines`);
  - `biome.json`;
  - a one-time Biome formatting pass over `src/` and the config files;
  - `.harness/config.json` gate commands;
  - then a new baseline.
- **Code:** `vitest.config.ts`, `src/ping.test.ts` and `README.md`.
- **Gate:** `test` becomes `npm test && cd src-tauri && cargo test`, and `lint` becomes `npm run lint && cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings`. `typecheck` stays `npm run build`.
- **Run order:** third, after `add-typed-ipc`, whose `src/ping.ts` this change tests, and before `add-ci-build-matrix`, whose workflow calls these scripts.
