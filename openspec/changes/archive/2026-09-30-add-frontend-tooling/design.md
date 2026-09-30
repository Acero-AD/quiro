## Context

After `add-typed-ipc`, the frontend is a minimal page:
- `src/main.ts` and `src/ping.ts`;
- the generated `src/bindings.ts`;
- `src/styles.css` and `index.html`.

`npm run build` (`tsc && vite build`) is its only check.

Research: [Which frontend test and lint tools can run inside the harness gate sandbox?](https://github.com/Acero-AD/quiro/issues/2), in `docs/research/frontend-tooling-in-gate-sandbox.md` on branch `research/frontend-tooling-in-gate-sandbox`.
- **The sandbox:** the gate runs each command in a bubblewrap sandbox with no network, an empty `$HOME`, and the system Node (26.8.1). It can only use packages already in the checkout's `node_modules/`.
- **Tools that worked there:** Vitest 5.0.2 with jsdom 30.1.1 ran CodeMirror state, history, syntax-tree and view-creation tests, and Biome 2.5.14 ran unchanged.
- **A trap:** a worker edit to `package.json` or `package-lock.json` fails the gate's integrity check, and so does changing or deleting a test that existed at the baseline. Tests written here must be ones that last.

## Goals / Non-Goals

**Goals:**

- G-002: every check passes from a clean clone, both locally and in the gate.
- A frontend test runner that fails loudly on layout-dependent code, rather than passing with wrong geometry.
- One fast tool for linting and formatting TypeScript, CSS and JSON.
- The direct-`invoke` ban from `add-typed-ipc` enforced by the gate.

**Non-Goals:**

- Layout tests in a real browser engine (Vitest browser mode). That's decided in [How are WebKitGTK-only behaviours verified when the gate cannot run WebKitGTK?](https://github.com/Acero-AD/quiro/issues/20).
- Formatting Markdown. Biome doesn't format it, which keeps Markdown fixtures byte-exact.
- CI. That's `add-ci-build-matrix`.

## Operator prerequisites

Do these in one prep commit before `harness run add-frontend-tooling`, after `add-typed-ipc` has been accepted. The commit must leave every gate command passing, or the baseline fails.

1. `npm install -D -E vitest@5 jsdom@30 @biomejs/biome@2`. The research tested 5.0.2, 30.1.1 and 2.5.14; take the latest patch releases, pinned exactly.
2. In `package.json`:
   - add the script `lint`: `biome ci .`;
   - add the script `format`: `biome check --write .`;
   - add the script `test`: `vitest run --passWithNoTests`;
   - set `"engines": { "node": ">=26" }`.
3. Add `biome.json` as described under "Biome configuration" below.
4. Run `npm run format` once, and review the diff: it should only touch formatting.
5. In `.harness/config.json`:
   - set `test` to `npm test && cd src-tauri && cargo test`;
   - set `lint` to `npm run lint && cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings`;
   - leave `typecheck` as `npm run build`.

   Rerun `harness setup` if the commands need confirming again.
6. Check that `npm run lint`, `npm test`, `npm run build` and the cargo checks all pass.
7. Commit, then run `harness approve` if doctor asks, then `harness baseline`, then `harness doctor` until it says READY.

## Decisions

### Vitest with jsdom, not happy-dom

jsdom throws on layout APIs such as `coordsAtPos` and `getClientRects`, so a test that silently depends on layout fails. happy-dom returns `null` or wrong geometry and lets such a test pass. Both ran in the sandbox.

*Alternative:* Vitest browser mode with headless Chromium. It measures Blink, not WebKitGTK, and it's deferred to the WebKitGTK verification ticket.

### Biome for lint and format

It's one tool and one config for TypeScript, JavaScript, CSS and JSON. It was about 20× faster than ESLint in the sandbox, and unlike typescript-eslint it doesn't cap the TypeScript version.

*Alternatives:*
- ESLint with typescript-eslint and Prettier: more packages, slower, and blocks TypeScript 7.
- oxlint with oxfmt: faster still, but oxfmt is 0.x.

`biome ci .` is read-only, which the lint criterion requires.

### Biome configuration

- **Formatter:** spaces with width 2, to match the existing code and `tauri.conf.json`. Other options stay at their defaults, including double quotes.
- **Linter:** the recommended rules, plus `style/noRestrictedImports` forbidding `@tauri-apps/api/core`. The rule's message says to call Rust through `src/bindings.ts`. Test files may import `@tauri-apps/api/mocks`.
- **Files:** Biome only sees the project's own sources:
  - `src/**`, except the generated `src/bindings.ts`;
  - `vite.config.ts` and `vitest.config.ts`;
  - `tsconfig.json` and `biome.json`;
  - `src-tauri/tauri.conf.json` and `src-tauri/capabilities/**`.

  It never sees `dist/`, `node_modules/`, `src-tauri/target/`, `src-tauri/gen/`, or the harness- and agent-managed files (`.claude/`, `.codex/`, `.harness/`, `openspec/`). `package.json` and the lockfile are left to npm's own formatting, so `npm install` never produces a Biome failure.

### Scripts and `--passWithNoTests`

`vitest run` exits 1 when it finds no test files. That would fail the prep commit's baseline, because the first test is written by the worker. `--passWithNoTests` makes the baseline pass.

A placeholder test isn't used instead: the integrity check blocks a worker from later changing or deleting a baseline test, so a placeholder would become permanent. The flag stays. The gate's integrity check, not Vitest, guards against tests disappearing.

### The first test targets `src/ping.ts`

`src/ping.test.ts` tests the `ping` client through `mockIPC` and `clearMocks` from `@tauri-apps/api/mocks`. `ping` and its tests stay as the IPC reference example, so this test won't need changing when G-101 replaces the page.

The test covers:
- the display text for a reply, and for each `PingError` variant;
- that the command called is `ping`, with `{ request: { message } }`.

A mocked error is thrown as a plain object, which is how tauri-specta's `Result` mode reports command errors.

### Vitest configuration

`vitest.config.ts` at the root sets `environment: "jsdom"` and includes `src/**/*.test.ts`. Tests import `describe`, `it` and `expect` from `vitest` explicitly, with no globals, so `tsc`, which checks `src/`, needs no extra types.

## Risks / Trade-offs

- **[The gate's system Node (26.8.1) differs from the operator's shell Node (mise, 26.10.x)]** → Both satisfy `>=26`. Behaviour differences would show up as a failing baseline.
- **[Biome's formatting pass touches files that other tools also write]** → Biome's file list only covers files the project owns.
- **[`--passWithNoTests` hides a missing test directory]** → Existing tests are protected by the gate's integrity check, and the spec requires at least one real test.

## Open Questions

None. The layout-test question lives in [How are WebKitGTK-only behaviours verified when the gate cannot run WebKitGTK?](https://github.com/Acero-AD/quiro/issues/20).
