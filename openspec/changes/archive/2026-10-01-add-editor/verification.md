# Manual verification: add-editor

Linux check from `design.md` § Manual verification. This change was archived before its Linux check ran, so this file was added to the archive afterwards.

**Result: PASS.** Every Linux item passed, except the IME word, which is "verified later" because no fcitx5 input engine is installed, as `design.md` allows. The Windows items go to [Manual Windows check](https://github.com/Acero-AD/quiro/issues/22).

## Run

- **Date:** 2026-10-07
- **Commit:** 7693cd3 (`record the add-dark-colour-scheme linux check`), whose source is that of ffb1d36 (`Merge pull request #28`). The editor runs with `add-dark-colour-scheme` in place.
- **Build:** `npm run tauri dev`.
- **Machine:**
  - AMD Ryzen 7 5800X
  - Linux 7.2.5-3-omarchy
  - Hyprland 0.56.2 (Omarchy)
- **Stack:** webkit2gtk-4.1 2.52.6, gtk3 3.24.52, `tauri` 2.12.1, `tao` 0.37.1, `wry` 0.57.0.
- **Input:** layout `us` with no variant; `kb_options` is `compose:caps,shift:both_capslock_cancel`, so Compose is on Caps Lock. fcitx5 5.1.22 is installed with `fcitx5-gtk` and `fcitx5-qt`, but no input engine.
- **Method:** the operator ran each item by hand. The evidence is their report, "everything else in the add-editor works smooth", and a screenshot of the floating window.

## Linux (WebKitGTK)

| Check | Result | Evidence |
| --- | --- | --- |
| Window: the editor fills the window when tiled, with no other UI | PASS | Operator report, and screenshots from the `add-markdown-mode` and `add-dark-colour-scheme` runs. |
| Window: the editor fills the window when floating | PASS | Screenshot after Super+T: a floating 944×1032 window at the centre of the screen, with the editor filling it and no other UI. |
| Window: the editor fills the window at the minimum size | PASS | Operator report. |
| Window: the cursor is in the editor at start | PASS | Operator report. |
| Editing: typing, word jumps, Home/End, Shift+arrow and mouse selection, Backspace/Delete, Enter, Ctrl+A; the selection is drawn | PASS | Operator report. |
| Clipboard: cut and copy in Quiro paste into another app | PASS | Operator report. |
| Clipboard: text copied in another app pastes into Quiro | PASS | Operator report. |
| Clipboard: HTML copied from a web page pastes as plain text | PASS | Operator report. |
| Resize: shrinking to the minimum and back leaves the text unchanged | PASS | Operator report. |
| Undo and redo: Ctrl+Z undoes, and Ctrl+Shift+Z and Ctrl+Y redo | PASS | Operator report. |
| Composed input: a dead-key accent (`intl` variant, `'` then `e`) is one undo step | PASS | Operator report. |
| Composed input: a Compose sequence (Caps Lock, `o`, `"`) is one undo step | PASS | Operator report. |
| Composed input: an IME word through fcitx5 | verified later | No fcitx5 input engine is installed. The criterion isn't weakened. |

## Windows

Verified on Windows later, through [Manual Windows check](https://github.com/Acero-AD/quiro/issues/22):
- Ctrl+Shift+Z and Ctrl+Y redo, and Ctrl+Z undoes.
- A dead-key accent and an IME word insert correctly.
- Content copied from a web page pastes as plain text.

## Findings

1. **The IME item is still open.** Installing an engine, such as `fcitx5-mozc`, and typing one word would close it. This is `design.md`'s first open question.
