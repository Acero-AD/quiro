## MODIFIED Requirements

### Requirement: Checks run on Linux and Windows
CI SHALL run one job on `ubuntu-24.04` and one on `windows-2025`, on Node 26 and the runner's stable Rust, with `fail-fast: false`. Each job SHALL run, in order:
1. `npm ci`;
2. installing Playwright's Chromium headless shell into `node_modules` with `PLAYWRIGHT_BROWSERS_PATH=0`, together with its system dependencies on Linux;
3. `npm run lint`, `npm test` and `npm run build`;
4. in `src-tauri/`: `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings` and `cargo test`.

#### Scenario: A check fails on one OS
- **WHEN** `cargo clippy` fails on Windows only
- **THEN** the Windows job fails, and the Linux job still runs to completion

#### Scenario: Browser tests in CI
- **WHEN** a job runs `npm test`
- **THEN** the browser-mode tests run in Playwright's Chromium on that runner's OS
