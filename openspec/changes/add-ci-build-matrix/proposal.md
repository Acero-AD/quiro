## Why

Nothing builds or checks Quiro outside the operator's Arch machine. Quiro's Windows build (G-001) has never been verified, and G-003 asks for CI on Linux and Windows that runs the G-002 checks and uploads the built binary. The workflow was decided in [What do the harness gate and CI run, on which OSes, and what does CI upload?](https://github.com/Acero-AD/quiro/issues/10). It's infrastructure, so the operator applies this change interactively (`/opsx:apply`), never through `harness run`.

## What Changes

- **Triggers:** a GitHub Actions workflow, `.github/workflows/ci.yml`, runs on every push to any branch and on manual dispatch. A newer push to the same ref cancels a run already in progress.
- **Matrix:** pinned `ubuntu-24.04` and `windows-2025` with `fail-fast: false`, on Node 26 and the runner's stable Rust.
- **Steps in each job:**
  1. install Linux system packages (Linux only);
  2. `npm ci`;
  3. `npm run lint`, `npm test`, `npm run build`;
  4. `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test`;
  5. `npm run tauri build -- --no-bundle`.
- **Artifacts:** each job uploads its raw release executable as an unzipped artifact, kept for 30 days. No installers.
- **Caching:** Rust dependency builds are cached and saved only from `master`. npm downloads are cached too.
- **Security:** workflow permissions are `contents: read`. First-party actions are pinned to major tags, and third-party actions to full commit SHAs. Plain steps are used, with no `tauri-action`.
- **Line endings:** a `.gitattributes` forces LF line endings, so Windows checkouts match Linux.
- **G-001:** the Windows build is verified by the first green Windows job. Launching the executable is left to the manual Windows check.

## Capabilities

### New Capabilities

- `ci-build`: what CI runs, where, on which triggers, what it uploads and caches, and how the workflow is hardened. It also covers G-001's requirement that a release executable builds on Linux and Windows.

### Modified Capabilities

None.

## Impact

- **New files:** `.gitattributes` and `.github/workflows/ci.yml`. The harness treats `ci.yml` as a gate runner file, so the harness baseline must be taken again afterwards.
- **External:** GitHub Actions runs on the public repository, where standard-runner minutes are free.
- **Run order:** fourth and last in Phase 0. It needs the `lint` and `test` scripts from `add-frontend-tooling`.
