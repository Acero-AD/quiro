import { EditorState } from "@codemirror/state";
import { blockLines } from "./blocks";
import { type ColourScheme, colourScheme } from "./colour-scheme";
import { editorExtensions } from "./extensions";
import { markdownHighlighting } from "./highlighting";
import { markdownMode } from "./language";
import { softWrapLayout } from "./layout";
import { markdownTheme } from "./theme";

// Every editor, including the layout check's hidden one, starts here.
export function newState(
  doc: string,
  scheme: ColourScheme = "light",
): EditorState {
  return EditorState.create({
    doc,
    extensions: [
      editorExtensions(),
      markdownMode(),
      markdownHighlighting(),
      blockLines,
      markdownTheme,
      softWrapLayout(),
      colourScheme(scheme),
    ],
  });
}
