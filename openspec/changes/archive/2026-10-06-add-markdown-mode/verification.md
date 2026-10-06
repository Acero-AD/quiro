# Manual verification: add-markdown-mode

Linux check from `design.md` § Manual verification, run on `master` after the harness run.

**Result: PASS.** The one Linux item passed as written. In dark mode, though, several colours are hard to read; see the findings. That's fixed by the `add-dark-colour-scheme` change, not by a fix change, because the item doesn't cover contrast. There are no Windows items.

## Run

- **Date:** 2026-10-06
- **Commit:** a1aa2c9 (`archive spec`). The next commit, 909b6b4, adds only OpenSpec files.
- **Build:** `npm run tauri dev`.
- **Machine:**
  - AMD Ryzen 7 5800X
  - Linux 7.2.5-3-omarchy
  - Hyprland 0.56.2 (Omarchy)
- **Stack:** webkit2gtk-4.1 2.52.6, gtk3 3.24.52, `tauri` 2.12.1, `tao` 0.37.1, `wry` 0.57.0.
- **Colour scheme:** dark. GTK theme `Adwaita-dark`, and `org.gnome.desktop.interface color-scheme` is `prefer-dark`. WebKitGTK reported `prefers-color-scheme: dark`, so `src/styles.css` gave the page its `#2f2f2f` background.
- **Method:** the operator pasted `src/editor/fixtures/dialect.md` into the editor and took a screenshot. The criteria were judged from that screenshot.

## Linux (WebKitGTK)

| Criterion | Result | Evidence |
| --- | --- | --- |
| Each construct looks distinct from body text and from the others | PASS | Front matter is grey. Headings are bold blue. Emphasis is italic, strong is bold, and strikethrough is struck through. Link text is blue and its URL grey, and the autolink is grey. List markers are orange, task markers green, and the quote's `>` purple, with the quote's text grey and italic. Table cells are slate. Headings and links are both blue, but only headings are bold. |
| Syntax markers are dimmed | PASS | The `#`, `*`, `~~`, backticks, brackets, parentheses and table pipes are grey (`#a0a8b3`, 5.58:1), against near-white body text (`#f6f6f6`, 12.39:1). |
| Headings are bold and coloured at body size | PASS | All six levels are bold blue, on lines as tall as body text. |
| Both kinds of code are monospace on a tint | PASS | Inline `code` and the fenced block both sit on the grey tint, and the block's tint spans the full width. |

## Windows

None. `design.md` lists no Windows items.

## Findings

1. **In dark mode, the Markdown colours are hard to read.** The `--md-*` defaults were chosen for the light page. Against `#2f2f2f`, by the WCAG 2 formula:

   | Property | Value | Ratio |
   | --- | --- | --- |
   | `--md-table` | `#3d4a5c` | 1.49:1 |
   | `--md-heading` | `#1f4f8f` | 1.64:1 |
   | `--md-link` | `#0b62c4` | 2.27:1 |
   | `--md-quote` | `#5b6573` | 2.27:1 |
   | `--md-quote-marker` | `#8a5bb5` | 2.71:1 |
   | `--md-list-marker` | `#b4561f` | 2.74:1 |
   | `--md-task-marker` | `#2f8a4c` | 3.10:1 |

   The table cells are almost invisible. The item only asks that constructs look distinct, and they do, so this doesn't fail it.
2. **CodeMirror's own colours stay light** (from `add-editor`, seen in an earlier screenshot of the same build). The cursor is black (1.57:1), and selected text is near-white on a `#d7d4f0` selection (1.33:1).
3. **Body text is monospace.** CodeMirror's default font applies until G-401, so the code styles stand out by their tint only. That's what the item asks for.
4. **Light mode wasn't run.** The item doesn't name a scheme, and the run used the desktop's.

Findings 1 and 2 are fixed by `add-dark-colour-scheme`, proposed in 909b6b4.
