# Manual verification: add-soft-wrap

Linux check from `design.md` § Manual verification. This change was archived before its Linux check ran, so this file was added to the archive afterwards.

**Result: PASS.** `checkLayout()` found no violation on WebKitGTK, including on emoji and CJK fallback. A 2,000-character token wraps at the minimum window size. The production-build item is covered by the gate. The Windows items go to [Manual Windows check](https://github.com/Acero-AD/quiro/issues/22).

## Run

- **Date:**
  - layout check: 2026-10-07, and it returned `[]` again in later sessions on 2026-10-07 and 2026-10-08;
  - long token: reported by the operator on 2026-10-08.
- **Commit:** the layout check first ran on the source of ffb1d36 (`Merge pull request #28`). `src/editor/layout.ts` and `src/editor/layout-check.ts` are unchanged since 3a3f3a3, this change's task 2. Later changes only affect colours and parsing.
- **Build:** `npm run tauri dev`.
- **Machine:**
  - AMD Ryzen 7 5800X
  - Linux 7.2.5-3-omarchy
  - Hyprland 0.56.2 (Omarchy)
- **Stack:** webkit2gtk-4.1 2.52.6, gtk3 3.24.52, `tauri` 2.12.1, `wry` 0.57.0.
- **Fonts** (fontconfig):
  - sans-serif: Liberation Sans;
  - monospace: JetBrainsMono Nerd Font. The editor's text uses CodeMirror's default monospace font until G-401;
  - emoji: Noto Color Emoji;
  - CJK: `fc-match` gives Liberation Sans for `lang=ja` and `lang=zh-cn`, which has no CJK glyphs, so the characters fall back to the installed Noto Sans and Noto Serif CJK families. 65 installed faces cover Japanese.

## Linux (WebKitGTK)

| Check | Result | Evidence |
| --- | --- | --- |
| Layout check: `await window.quiroDev.checkLayout()` returns `[]` | PASS | The console showed `[Info] [] (0)`: an empty array. Its fixture includes the line `Emoji 😀 🎉 ✅ and CJK 漢字 かな カナ 한국어`, so WebKitGTK's emoji and CJK fallback were measured. |
| Long token: at the minimum window size, a 2,000-character token wraps with no horizontal scrollbar | PASS | Operator report. |
| Production build: `window.quiroDev` doesn't exist in a release build | covered by the gate | `src/production-bundle.test.ts` checks the production bundle for the dev tools. |

## Windows

Verified on Windows later, through [Manual Windows check](https://github.com/Acero-AD/quiro/issues/22):
- In a dev build, `await window.quiroDev.checkLayout()` returns `[]` in WebView2.
- At the minimum window size, a 2,000-character token wraps with no horizontal scrollbar.

## Findings

1. **Both open questions in `design.md` are answered for this machine.**
   - Emoji and CJK fallback at 16 px with a 1.6 line-height ratio don't overflow a visual line.
   - Two animation frames per scroll step were enough: no intermittent violations appeared in repeated runs.
