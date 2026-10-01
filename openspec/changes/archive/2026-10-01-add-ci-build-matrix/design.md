## Context

After the other Phase 0 changes, the repo has Rust checks (fmt, clippy, test), frontend checks (`npm run lint`, `npm test`, `npm run build`) and a Tauri 2.12 app. Only the operator's Arch machine and the offline harness gate have ever built it.

Research: [How do Tauri v2 apps build and test on GitHub Actions for Linux and Windows?](https://github.com/Acero-AD/quiro/issues/3), in `docs/research/tauri-ci-github-actions.md` on branch `research/tauri-ci-github-actions`. Its findings:

- **Linux runners:** every Rust step on Linux, including clippy and tests, needs the WebKitGTK 4.1 development packages. `ubuntu-latest` switches from 24.04 to 26.04 between 2026-10-19 and 2026-11-19, and `ubuntu-22.04` retires on 2027-04-17.
- **Windows runners:** they check out with CRLF line endings, because Git for Windows is installed without a line-ending option.
- **Artifacts:** zipped artifacts lose the executable bit, and `actions/upload-artifact` v7's `archive: false` uploads a single file unzipped.
- **Cost:** standard runners are free for public repositories.

This change is applied by the operator in an interactive session, not by `harness run`. Its `tasks.md` is the operator's checklist.

## Goals / Non-Goals

**Goals:**

- G-003: every push runs the G-002 checks on Linux and Windows, and uploads each OS's built binary.
- G-001: prove that the release build works on Windows, not just Linux.
- A reproducible workflow: pinned runner images and pinned actions.

**Non-Goals:**

- Installers (deb, rpm, AppImage, MSI, NSIS), GitHub Releases, signing, or a glibc baseline for distributing Linux builds. Those belong to a future release goal, which should also reconsider `tauri-action`.
- Launching the app or GUI tests in CI. Launching `quiro.exe` is part of the manual Windows check, and GUI testing is decided in [How are WebKitGTK-only behaviours verified when the gate cannot run WebKitGTK?](https://github.com/Acero-AD/quiro/issues/20).
- Dependabot. Versions are bumped by hand.

## Decisions

### Triggers and concurrency

- `on: push` (all branches) and `workflow_dispatch`.
- No `pull_request` trigger. It's a solo repo, and that trigger would run everything twice for pull requests from its own branches.
- No path filters, because Markdown fixtures are `.md` files and are real test inputs.
- `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }`.

### Runners and toolchains

- `ubuntu-24.04` and `windows-2025`, pinned rather than `-latest`, so the images don't change under the workflow.
- Node 26 through `actions/setup-node`.
- Rust from the runner's preinstalled stable, which is 1.98.1 on both images today and includes clippy and rustfmt. There's no `rust-toolchain.toml`: the gate's Arch `cargo` isn't rustup and would ignore it.

### One job per OS, checks then build

A matrix over the two runners, with `fail-fast: false`, so one OS failing doesn't hide the other's result. The steps, in order:

1. `actions/checkout`
2. Ubuntu only: `sudo apt-get update && sudo apt-get install -y libwebkit2gtk-4.1-dev librsvg2-dev libxdo-dev`
3. `actions/setup-node` with `node-version: 26` and `cache: npm`
4. `Swatinem/rust-cache` with `workspaces: './src-tauri -> target'` and `save-if: ${{ github.ref == 'refs/heads/master' }}`
5. `npm ci`
6. `npm run lint`, `npm test`, `npm run build`
7. In `src-tauri`: `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test`
8. `npm run tauri build -- --no-bundle`
9. `actions/upload-artifact` with `archive: false` and `retention-days: 30`, uploading `src-tauri/target/release/quiro` on Linux and `src-tauri/target/release/quiro.exe` on Windows

All checks run on both OSes, because the window-state code has Windows-only branches that only a Windows clippy and test run exercise.

The apt list follows Tauri's prerequisites, minus the appindicator packages (there's no tray) and `xdg-utils` (nothing is bundled). `libxdo-dev` is there because Tauri's default menu support links against it. `build-essential`, `pkg-config` and `libssl-dev` are already on the image.

### Raw executables, plain steps

`--no-bundle` builds the release executable (the LTO profile Quiro ships) without installers. That avoids downloading WiX, NSIS and linuxdeploy on every run, and the MSI dependency on VBScript, which Windows is deprecating. G-003 asks for "the built binary", and the Windows `.exe` runs directly for the manual check.

Without bundles or releases, `tauri-action` would only run `tauri build`, so plain steps are used. Reconsider it when a release goal adds installers.

### Caching

- **rust-cache:** caches `~/.cargo` and dependency builds in `target/`, keyed per OS. Saving only on `master` keeps branch pushes from churning the cache, and branches still restore `master`'s entries.
- **setup-node:** `cache: npm` caches npm's download cache.
- **The 10 GB repository cap:** each OS caches both the debug profile (checks) and the release profile (build). If the total goes over 10 GB, drop the release profile from the cache first.

### Hardening

- `permissions: contents: read` at the top level, because the workflow writes nothing.
- First-party actions are pinned to major tags: `actions/checkout@v7`, `actions/setup-node@v7`, `actions/upload-artifact@v7`.
- Third-party actions are pinned to a full commit SHA with the version in a trailing comment: `Swatinem/rust-cache@<sha> # v2.9.2`, or its latest v2 release when this is applied.

### Line endings

`.gitattributes` contains `* text=auto eol=lf`. Without it, the Windows checkout converts files to CRLF, which fails `biome ci` and shifts byte offsets in Markdown fixtures. After adding it, `git add --renormalize .` should report no changes, since the repo is already LF.

### Harness baseline

`.github/workflows/ci.yml` is on the harness's list of gate runner files. Once this change is committed, take a new harness baseline before the next `harness run`.

## Risks / Trade-offs

- **[A cold release build with LTO and `codegen-units = 1` may be slow]** → Accepted for the first run. Record the time, and revisit (for example with a separate release-build job) only if it hurts.
- **[The cache goes over 10 GB with both profiles on two OSes]** → Drop the release profile from the cache.
- **[The apt list is incomplete for Tauri 2.12]** → The first run shows it. Add the missing package named in the build error.
- **[CI's Rust (runner stable) differs from the gate's (Arch `rust` package)]** → A clippy lint added in a newer Rust can fail in one place and pass in the other. Fix the code, and keep both on current stable.
- **[Pinned images eventually retire]** → Bump `ubuntu-24.04` and `windows-2025` deliberately when GitHub announces their retirement.

## Open Questions

- The cold release-build time on each runner, answered by the first run.
  - *Answered.* First green run on both OSes: [run 36765793604](https://github.com/Acero-AD/quiro/actions/runs/36765793604), commit `98ee867`, with both executables uploaded (`quiro` 6.0 MB, `quiro.exe` 4.3 MB).
  - `windows-2025`, cold (no cache found): job 12m 23s, of which the release build took 5m 54s.
  - `ubuntu-24.04`, warm (cache from the first run): job 3m 03s, of which the release build took 1m 31s. Its cold run ([run 36701677943](https://github.com/Acero-AD/quiro/actions/runs/36701677943)) took 6m 36s, with a 3m 14s release build.
  - The first two runs failed on Windows only, both in `cargo test`:
    - The test binary couldn't start (`STATUS_ENTRYPOINT_NOT_FOUND`), because `tauri-build` embeds the Common Controls v6 manifest only in the app binary. `src-tauri/build.rs` now has the MSVC linker embed `src-tauri/windows-app-manifest.xml` in every binary. That includes `quiro.exe`, so the manual Windows check should confirm that the app still launches.
    - Four `is_wayland` tests expected `true` on every OS, but the function is false off Linux by design. They now expect `true` only on Linux.
- Whether both OSes' debug and release caches fit in 10 GB.
  - *Partly answered.* After the green run, the caches total 2.1 GB: Rust 1.19 GB on Linux and 0.86 GB on Windows, npm about 50 MB per OS. Watch this as dependencies grow.
- Whether artifact and cache storage count against the Free plan's quotas for a public repository. GitHub's billing docs don't say.
- Whether the WebView2 Runtime is on `windows-2025`. It only matters if a CI launch test is ever added.
