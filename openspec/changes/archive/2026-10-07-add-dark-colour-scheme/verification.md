# Manual verification: add-dark-colour-scheme

Linux check from `design.md` § Manual verification. It ran on the PR branch before the merge, not on `master` after it. The branch's source is what PR #28 merges. The change was archived on the branch before this record was written.

**Result: PASS.** The operator reported every Linux item as passing. The Windows items go to [Manual Windows check](https://github.com/Acero-AD/quiro/issues/22).

## Run

- **Date:** 2026-10-07
- **Commit:** 956ef03 (`archive spec`), the head of `harness/add-dark-colour-scheme`, on top of 5d122a8 (`harness: add-dark-colour-scheme task 2`).
- **Build:** `npm run tauri dev`.
- **Machine:**
  - AMD Ryzen 7 5800X
  - Linux 7.2.5-3-omarchy
  - Hyprland 0.56.2 (Omarchy)
- **Stack:** webkit2gtk-4.1 2.52.6, gtk3 3.24.52, `tauri` 2.12.1, `tao` 0.37.1, `wry` 0.57.0.
- **Colour scheme:** dark at the start, with GTK theme `Adwaita-dark`. The Omarchy theme names for each mode weren't recorded.
- **Method:** the operator ran each item by hand. The evidence below is their report, "it looks good, changing and everything", not a screenshot per item.

## Linux (WebKitGTK)

| Check | Result | Evidence |
| --- | --- | --- |
| Dark: the fixture is easy to read, every construct is distinct, and syntax markers are dimmer than body text | PASS | Operator report. |
| Dark: the cursor is clearly visible and blinks | PASS | Operator report. |
| Dark: a selected word is on a visible blue background and readable, focused and unfocused | PASS | Operator report. |
| Switching while running: Quiro turns light without a restart, keeps the text and selection, and Ctrl+Z still undoes; then back to dark | PASS | Operator report ("changing"). Quiro switched live, so the `matchMedia` fallback wasn't needed. |
| Light mode after a restart: the fixture looks as it did before this change | PASS | Operator report. |

## Windows

Verified on Windows later, through [Manual Windows check](https://github.com/Acero-AD/quiro/issues/22):
- With Windows in dark app mode, the editor is dark, with a visible cursor and selection.
- Switching Windows between light and dark app mode switches Quiro while it runs.

## Findings

1. **WebKitGTK reports a scheme change while running.** This answers the second half of `design.md`'s first open question: switching the Omarchy theme reached Quiro without a restart. What drives `prefers-color-scheme` underneath (the GTK theme name, `gtk-application-prefer-dark-theme` or the portal's `color-scheme`) is still open.
