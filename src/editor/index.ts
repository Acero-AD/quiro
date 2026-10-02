import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { blockLines } from "./blocks";
import { editorExtensions } from "./extensions";
import { markdownHighlighting } from "./highlighting";
import { markdownMode } from "./language";
import { softWrapLayout } from "./layout";
import { markdownTheme } from "./theme";

export interface Editor {
  load(fileText: string): void;
  text(): string;
  focus(): void;
  destroy(): void;
}

function newState(doc: string): EditorState {
  return EditorState.create({
    doc,
    extensions: [
      editorExtensions(),
      markdownMode(),
      markdownHighlighting(),
      blockLines,
      markdownTheme,
      softWrapLayout(),
    ],
  });
}

export function createEditor(parent: HTMLElement): Editor {
  const view = new EditorView({ state: newState(""), parent });

  return {
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
}
