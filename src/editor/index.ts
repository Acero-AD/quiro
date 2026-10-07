import { EditorView } from "@codemirror/view";
import { type ColourScheme, reconfigureColourScheme } from "./colour-scheme";
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

// The same query src/styles.css uses, so the page and the editor agree.
// Without matchMedia, as under jsdom, the editor stays light.
function darkQuery(): MediaQueryList | null {
  if (typeof window.matchMedia !== "function") return null;
  return window.matchMedia("(prefers-color-scheme: dark)");
}

export function createEditor(parent: HTMLElement): Editor {
  const query = darkQuery();
  let scheme: ColourScheme = query?.matches ? "dark" : "light";
  const view = new EditorView({ state: newState("", scheme), parent });

  // A transaction, not setState, so the document, the selection and the
  // undo history survive the switch.
  const onSchemeChange = (event: MediaQueryListEvent) => {
    scheme = event.matches ? "dark" : "light";
    view.dispatch({ effects: reconfigureColourScheme(scheme) });
  };
  query?.addEventListener("change", onSchemeChange);

  const editor: Editor = {
    load(fileText) {
      const doc = fileText.startsWith("﻿") ? fileText.slice(1) : fileText;
      // A new state is the only way to clear CodeMirror's undo history.
      view.setState(newState(doc, scheme));
    },
    text() {
      return view.state.doc.toString();
    },
    focus() {
      view.focus();
    },
    destroy() {
      query?.removeEventListener("change", onSchemeChange);
      view.destroy();
    },
  };
  rememberView(editor, view);
  return editor;
}
