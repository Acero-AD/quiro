import {
  defaultKeymap,
  history,
  historyKeymap,
  redo,
} from "@codemirror/commands";
import type { Extension } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightSpecialChars,
  keymap,
} from "@codemirror/view";

// Ctrl+/ is reserved for the app (G-311), so CodeMirror's toggleComment goes.
const editingKeymap = defaultKeymap.filter(
  (binding) => binding.key !== "Mod-/",
);

// Editor styles live here, never in global CSS: CodeMirror's scoped base
// theme wins over plain global rules.
const layoutTheme = EditorView.theme({
  "&": { height: "100%" },
});

export function editorExtensions(): Extension[] {
  return [
    highlightSpecialChars(),
    history(),
    drawSelection(),
    keymap.of([
      ...editingKeymap,
      ...historyKeymap,
      // CodeMirror binds Ctrl+Shift+Z to redo on Linux only.
      { win: "Ctrl-Shift-z", run: redo, preventDefault: true },
    ]),
    layoutTheme,
  ];
}
