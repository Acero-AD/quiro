## ADDED Requirements

### Requirement: Every check passes from a clean clone
From a clean clone, after `npm ci`, these commands SHALL all pass:
- `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings` and `cargo test`, run in `src-tauri/`;
- `npm run lint`, `npm test` and `npm run build`.

#### Scenario: Fresh checkout
- **WHEN** a developer clones the repository, runs `npm ci`, and runs each check command
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
`npm test` SHALL run the frontend unit tests (`src/**/*.test.ts`) with Vitest in the jsdom environment, and SHALL run at least one real test.

#### Scenario: Ping client test
- **WHEN** `npm test` runs
- **THEN** it runs tests of the `ping` client that mock the IPC call and check the display text for a reply and for each ping error

### Requirement: Supported Node version
The project SHALL declare Node 26 or later in `package.json` `engines.node`.

#### Scenario: Engines field
- **WHEN** a developer reads `package.json`
- **THEN** `engines.node` is `>=26`

### Requirement: Setup and checks are documented
The README SHALL document:
- the prerequisites: Rust stable, Node 26 or later, and the WebKitGTK 4.1 system packages on Linux;
- setup;
- running the app;
- every check command;
- `npm run format`;
- the bindings regeneration command.

#### Scenario: New contributor
- **WHEN** a developer follows the README on a machine with the prerequisites
- **THEN** they can install dependencies, run the app, and run every check without other instructions
