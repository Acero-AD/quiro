import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

// G-104: the only rule that sets the editor's font size and line height.
// An explicit line height keeps bold, monospace, emoji and CJK fallbacks
// from growing a line. It must be an EditorView.theme: CodeMirror's base
// theme sets line-height on .cm-scroller and wins over plain global CSS.
// The font family is left to the themes (G-401).
export const layoutThemeSpec: Record<string, Record<string, string>> = {
  "&": {
    "--editor-font-size": "16px",
    "--editor-line-height": "1.6",
  },
  ".cm-scroller": {
    fontSize: "var(--editor-font-size)",
    lineHeight: "var(--editor-line-height)",
  },
};

export function softWrapLayout(): Extension {
  return [EditorView.lineWrapping, EditorView.theme(layoutThemeSpec)];
}
