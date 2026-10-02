import { EditorState } from "@codemirror/state";
import { blockLines } from "./blocks";
import { editorExtensions } from "./extensions";
import { markdownHighlighting } from "./highlighting";
import { markdownMode } from "./language";
import { softWrapLayout } from "./layout";
import { markdownTheme } from "./theme";

// Every editor, including the layout check's hidden one, starts here.
export function newState(doc: string): EditorState {
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
