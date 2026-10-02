# developer-checks Specification

## Purpose
TBD - created by archiving change add-frontend-tooling. Update Purpose after archive.
## Requirements
### Requirement: Every check passes from a clean clone
From a clean clone, after `npm ci` and then `PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium-headless-shell`, these commands SHALL all pass:
- `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings` and `cargo test`, run in `src-tauri/`;
- `npm run lint`, `npm test` and `npm run build`.

#### Scenario: Fresh checkout
- **WHEN** a developer clones the repository, runs `npm ci`, installs Playwright's Chromium headless shell as above, and runs each check command
- **THEN** every command exits with status 0

### Requirement: Frontend lint and format check
`npm run lint` SHALL fail on any lint error, and on any TypeScript, JavaScript, CSS or JSON file in the project's sources that isn't formatted. It SHALL never modify files. The generated `src/bindings.ts` SHALL be excluded.

#### Scenario: Unformatted file
- **WHEN** a file under `src/` has formatting that differs from Biome's output
- **THEN** `npm run lint` fails and the file is unchanged

#### Scenario: Generated bindings
- **WHEN** `src/bindings.ts` doesn't match Biome's formatting
- **THEN** `npm run lint` still passes

### Requirement: Formatting on request
`npm run format` SHALL rewrite the project's sources to Biome's formatting.

#### Scenario: Fixing formatting
- **WHEN** a developer runs `npm run format` and then `npm run lint`
- **THEN** `npm run lint` reports no formatting errors

### Requirement: No direct Tauri invoke in app code
`npm run lint` SHALL fail when any linted file imports `@tauri-apps/api/core`.

#### Scenario: Direct invoke added
- **WHEN** a file under `src/` imports `invoke` from `@tauri-apps/api/core`
- **THEN** `npm run lint` fails with a message pointing to `src/bindings.ts`

### Requirement: Frontend unit tests under jsdom
`npm test` SHALL run the frontend unit tests (`src/**/*.test.ts`, except `*.browser.test.ts`) with Vitest in the jsdom environment, and SHALL run at least one real test. A test file MAY select Vitest's `node` environment instead. The same command SHALL also run the browser tests (`src/**/*.browser.test.ts`) through Vitest browser mode in Playwright's headless Chromium, which is installed inside `node_modules`.

#### Scenario: Ping client test
- **WHEN** `npm test` runs
- **THEN** it runs tests of the `ping` client that mock the IPC call and check the display text for a reply and for each ping error

#### Scenario: Browser test
- **WHEN** `npm test` runs in the harness gate, whose environment is cleared
- **THEN** it also runs the `*.browser.test.ts` files in headless Chromium, with no network and no extra setup

### Requirement: Supported Node version
The project SHALL declare Node 26 or later in `package.json` `engines.node`.

#### Scenario: Engines field
- **WHEN** a developer reads `package.json`
- **THEN** `engines.node` is `>=26`

### Requirement: Setup and checks are documented
The README SHALL document:
- the prerequisites: Rust stable, Node 26 or later, and the WebKitGTK 4.1 system packages on Linux;
- setup, including installing Playwright's Chromium headless shell after `npm ci`;
- running the app;
- every check command;
- `npm run format`;
- the bindings regeneration command.

#### Scenario: New contributor
- **WHEN** a developer follows the README on a machine with the prerequisites
- **THEN** they can install dependencies, run the app, and run every check without other instructions

### Requirement: CodeMirror stays inside the editor module
`npm run lint` SHALL fail when any linted file outside `src/editor/` imports a module whose name starts with `@codemirror/` or `@lezer/`. Files under `src/editor/` MAY import them.

#### Scenario: Import outside the editor module
- **WHEN** `src/main.ts` imports anything from `@codemirror/view`
- **THEN** `npm run lint` fails with a message saying that only `src/editor/` may use CodeMirror

#### Scenario: Import inside the editor module
- **WHEN** a file under `src/editor/` imports from `@codemirror/view`
- **THEN** `npm run lint` passes

### Requirement: Dev-only tooling stays out of production builds
`window.quiroDev` and everything it exposes SHALL exist only in dev builds. The production bundle that `npm run build` produces SHALL NOT contain the string `quiroDev`.

#### Scenario: Production build
- **WHEN** the frontend is built for production
- **THEN** no output file contains `quiroDev`

