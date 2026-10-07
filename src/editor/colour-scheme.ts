import {
  Compartment,
  type Extension,
  Prec,
  type StateEffect,
} from "@codemirror/state";
import { EditorView } from "@codemirror/view";

export type ColourScheme = "light" | "dark";

// Dark values for the variables markdownThemeSpec declares, checked against
// the dark page background in src/styles.css. Only variables and the
// selection background are set, so no rule changes a line's height (G-104).
export const darkThemeSpec: Record<string, Record<string, string>> = {
  "&": {
    "--md-heading": "#8fb8f0",
    "--md-link": "#6cb4ff",
    "--md-url": "#9aa4b0",
    "--md-code-background": "rgba(127, 127, 127, 0.14)",
    "--md-quote": "#b6bfca",
    "--md-table": "#c9d3df",
    "--md-front-matter": "#9aa4b0",
    "--md-syntax-marker": "#8d949d",
    "--md-list-marker": "#f0a066",
    "--md-task-marker": "#6cc98a",
    "--md-quote-marker": "#c49df0",
    "--editor-selection": "#264f78",
  },
  // Same specificity as CodeMirror's &dark selection rules; theme modules
  // mount after the base theme, so these win.
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
    backgroundColor: "var(--editor-selection)",
  },
  ".cm-selectionBackground": {
    backgroundColor: "var(--editor-selection)",
  },
};

const darkTheme = Prec.high(EditorView.theme(darkThemeSpec, { dark: true }));

const scheme = new Compartment();

function schemeExtension(value: ColourScheme): Extension {
  return value === "dark" ? darkTheme : [];
}

export function colourScheme(value: ColourScheme): Extension {
  return scheme.of(schemeExtension(value));
}

// Switches a running editor without replacing its state, so the document,
// the selection and the undo history survive.
export function reconfigureColourScheme(
  value: ColourScheme,
): StateEffect<unknown> {
  return scheme.reconfigure(schemeExtension(value));
}
