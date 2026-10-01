<!-- Operator checklist: apply interactively with /opsx:apply, never with `harness run`. -->

## 1. Line endings

- [x] 1.1 `.gitattributes` exists at the repository root with `* text=auto eol=lf`
- [x] 1.2 `git add --renormalize .` reports no content changes, or its changes are committed in the same commit as `.gitattributes`

## 2. CI workflow

- [x] 2.1 `.github/workflows/ci.yml` triggers on `push` (all branches) and `workflow_dispatch`, with a `ci-${{ github.ref }}` concurrency group that cancels runs in progress, and no path filters
- [x] 2.2 The workflow's top-level `permissions` are `contents: read`
- [x] 2.3 One matrix job runs on `ubuntu-24.04` and `windows-2025` with `fail-fast: false`, sets up Node 26 with `cache: npm`, and installs `libwebkit2gtk-4.1-dev librsvg2-dev libxdo-dev` on Ubuntu only
- [x] 2.4 `Swatinem/rust-cache` is pinned to a full commit SHA with its version in a comment, uses `workspaces: './src-tauri -> target'`, and saves only when the ref is `refs/heads/master`
- [x] 2.5 Each job runs, in order: `npm ci`; `npm run lint`, `npm test` and `npm run build`; `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings` and `cargo test` in `src-tauri/`; then `npm run tauri build -- --no-bundle`
- [x] 2.6 Each job uploads its executable (`src-tauri/target/release/quiro` or `quiro.exe`) with `actions/upload-artifact@v7`, `archive: false` and `retention-days: 30`
- [x] 2.7 First-party actions use major tags (`actions/checkout@v7`, `actions/setup-node@v7`, `actions/upload-artifact@v7`)

## 3. First run and baseline

- [x] 3.1 A push to `master` produces a green run on both OSes with both executables uploaded, and its URL and each job's duration are recorded under Open Questions in `design.md`
- [x] 3.2 The harness baseline is taken again after `ci.yml` is committed, and `harness doctor` reports READY
