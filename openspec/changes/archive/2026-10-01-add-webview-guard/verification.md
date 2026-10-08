# Manual verification: add-webview-guard

Linux check from `design.md` § Manual verification. This change was archived before its Linux check ran, so this file was added to the archive afterwards.

**Result: PASS.** Every Linux item passed, in the release build and in the dev build. The Windows items go to [Manual Windows check](https://github.com/Acero-AD/quiro/issues/22).

## Run

- **Date:**
  - dev build: 2026-10-07;
  - release build: 2026-10-08.
- **Commit:**
  - **Release build:** made with `npm run tauri build -- --no-bundle` at 11:54 on 2026-10-08, after 1cd2fdf (`Merge pull request #30`, 09:35). It was run as `src-tauri/target/release/quiro`.
  - **Dev build:** `npm run tauri dev` on the source of ffb1d36.
  - The guard's code is unchanged since 2ab5787, this change's task 2: `src/webview-guard.ts`, the Rust navigation guard under `src-tauri/src` and `src-tauri/tauri.conf.json`. Later commits to `src/main.ts` only add the dev-only tools.
- **Machine:**
  - AMD Ryzen 7 5800X
  - Linux 7.2.5-3-omarchy
  - Hyprland 0.56.2 (Omarchy)
- **Stack:** webkit2gtk-4.1 2.52.6, gtk3 3.24.52, `tauri` 2.12.1, `tao` 0.37.1, `wry` 0.57.0.
- **Method:** the operator ran each item by hand and reported pass or fail.

## Linux, release build

| Check | Result | Evidence |
| --- | --- | --- |
| Drops: a file dropped onto the text, a file dropped onto empty space below it, and a link dragged from a browser onto empty space each leave the document unchanged, with the editor still shown | PASS | Operator report. |
| Context menu: right-clicking over the text and over empty space shows no menu | PASS | Operator report. |
| Zoom and side buttons: Ctrl+wheel, a touchpad pinch and the mouse side buttons do nothing | PASS | Operator report ("as expected"). |
| Devtools: F12 and Ctrl+Shift+I open nothing | PASS | Operator report ("as expected"). |

## Linux, dev build

| Check | Result | Evidence |
| --- | --- | --- |
| Right-clicking shows the engine's menu with Inspect Element | PASS | Used throughout the `add-soft-wrap` and `add-large-document-checks` runs to open the inspector. The console shows "Selected Element", which comes from Inspect Element. |

## Windows

Verified on Windows later, through [Manual Windows check](https://github.com/Acero-AD/quiro/issues/22), in a release build:
- the listed browser shortcuts do nothing;
- right-click shows no menu;
- the mouse side buttons don't navigate;
- a dropped file leaves the document unchanged.

## Findings

1. **Open questions from `design.md`, as far as this run answers them:**
   - A touchpad pinch doesn't change the page scale in this WebKitGTK window. This is the operator's report for the release build.
   - Whether Ctrl+Shift+I opens the inspector in a Linux dev build wasn't checked. The inspector was always opened from the context menu.
   - The two WebView2 questions are for the Windows check.
2. **Closing the inspector in a dev build can trigger a `WebKitWebProcess` crash alert** on this machine. It happens inside NVIDIA's EGL driver (610.57.04) as the inspector's process exits, and Quiro's page keeps running. See `add-large-document-checks`' `verification.md`, finding 6. It doesn't affect release builds, which have no inspector.
