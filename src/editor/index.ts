import { EditorView } from "@codemirror/view";
import { newState } from "./state";
import { rememberView } from "./typing-probe";

export { checkLayout, type LayoutViolation } from "./layout-check";
export {
  startTypingProbe,
  summarizeSamples,
  type TypingProbe,
  type TypingStats,
} from "./typing-probe";

export interface Editor {
  load(fileText: string): void;
  text(): string;
  focus(): void;
  destroy(): void;
}

export function createEditor(parent: HTMLElement): Editor {
  const view = new EditorView({ state: newState(""), parent });

  const editor: Editor = {
    load(fileText) {
      const doc = fileText.startsWith("﻿") ? fileText.slice(1) : fileText;
      // A new state is the only way to clear CodeMirror's undo history.
      view.setState(newState(doc));
    },
    text() {
      return view.state.doc.toString();
    },
    focus() {
      view.focus();
    },
    destroy() {
      view.destroy();
    },
  };
  rememberView(editor, view);
  return editor;
}
