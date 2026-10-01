## MODIFIED Requirements

### Requirement: Every check passes from a clean clone
From a clean clone, after `npm ci` and then `PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium-headless-shell`, these commands SHALL all pass:
- `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings` and `cargo test`, run in `src-tauri/`;
- `npm run lint`, `npm test` and `npm run build`.

#### Scenario: Fresh checkout
- **WHEN** a developer clones the repository, runs `npm ci`, installs Playwright's Chromium headless shell as above, and runs each check command
- **THEN** every command exits with status 0

### Requirement: Frontend unit tests under jsdom
`npm test` SHALL run the frontend unit tests (`src/**/*.test.ts`, except `*.browser.test.ts`) with Vitest in the jsdom environment, and SHALL run at least one real test. A test file MAY select Vitest's `node` environment instead. The same command SHALL also run the browser tests (`src/**/*.browser.test.ts`) through Vitest browser mode in Playwright's headless Chromium, which is installed inside `node_modules`.

#### Scenario: Ping client test
- **WHEN** `npm test` runs
- **THEN** it runs tests of the `ping` client that mock the IPC call and check the display text for a reply and for each ping error

#### Scenario: Browser test
- **WHEN** `npm test` runs in the harness gate, whose environment is cleared
- **THEN** it also runs the `*.browser.test.ts` files in headless Chromium, with no network and no extra setup

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

## ADDED Requirements

### Requirement: Dev-only tooling stays out of production builds
`window.quiroDev` and everything it exposes SHALL exist only in dev builds. The production bundle that `npm run build` produces SHALL NOT contain the string `quiroDev`.

#### Scenario: Production build
- **WHEN** the frontend is built for production
- **THEN** no output file contains `quiroDev`
