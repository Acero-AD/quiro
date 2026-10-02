# ci-build Specification

## Purpose
TBD - created by archiving change add-ci-build-matrix. Update Purpose after archive.
## Requirements
### Requirement: CI runs on every push
The workflow `.github/workflows/ci.yml` SHALL run on every push to any branch and on manual dispatch. A newer push to the same ref SHALL cancel a run still in progress. It SHALL NOT use path filters.

#### Scenario: Push to a branch
- **WHEN** a commit is pushed to any branch
- **THEN** the CI workflow starts for that commit

#### Scenario: Superseded push
- **WHEN** a second commit is pushed to the same branch while the first run is still going
- **THEN** the first run is cancelled

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

### Requirement: Release executables build on Linux and Windows
Each CI job SHALL build the release executable with `npm run tauri build -- --no-bundle` after its checks pass.

#### Scenario: Windows build
- **WHEN** the Windows job's checks pass
- **THEN** it produces `src-tauri/target/release/quiro.exe`

#### Scenario: Linux build
- **WHEN** the Linux job's checks pass
- **THEN** it produces `src-tauri/target/release/quiro`

### Requirement: Executables are uploaded as artifacts
Each job SHALL upload its release executable as a single unzipped workflow artifact, kept for 30 days. CI SHALL NOT build or upload installers.

#### Scenario: Green run
- **WHEN** a run succeeds on both OSes
- **THEN** it has two artifacts, the Linux `quiro` executable and the Windows `quiro.exe`, each downloadable without unzipping

### Requirement: Builds are cached
CI SHALL cache Rust dependency builds per OS and npm's download cache. Rust caches SHALL be saved only from runs on `master`.

#### Scenario: Branch push
- **WHEN** a branch other than `master` is pushed
- **THEN** its jobs restore the Rust cache from `master` and don't save a new one

### Requirement: The workflow is hardened
The workflow SHALL grant only `contents: read`. It SHALL pin first-party GitHub actions to major-version tags, and third-party actions to full commit SHAs with the version in a comment.

#### Scenario: Reviewing the workflow
- **WHEN** a reviewer reads `.github/workflows/ci.yml`
- **THEN** the top-level permissions are `contents: read`, and every non-`actions/*` step uses a 40-character commit SHA

### Requirement: Checkouts use LF line endings on every OS
The repository SHALL declare `* text=auto eol=lf` in `.gitattributes`, so text files have LF line endings on Windows checkouts too.

#### Scenario: Windows checkout
- **WHEN** CI checks the repository out on `windows-2025`
- **THEN** source and fixture files have LF line endings, and `npm run lint` passes as it does on Linux

