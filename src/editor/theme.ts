import { EditorView } from "@codemirror/view";

const monospace = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const headings = [1, 2, 3, 4, 5, 6].map((n) => `.md-heading-${n}`).join(", ");

// G-104 limits: no rule changes a line's height, so no font-size,
// line-height, vertical-align or vertical padding, margin or border.
// Colours are variables only; themes (G-401) redefine them on the editor.
// Rule order matters: the list, task and quote marker rules follow the
// shared syntax-marker rule so their colours win.
export const markdownThemeSpec: Record<string, Record<string, string>> = {
  "&": {
    "--md-heading": "#1f4f8f",
    "--md-link": "#0b62c4",
    "--md-url": "#7b8794",
    "--md-code-background": "rgba(127, 127, 127, 0.14)",
    "--md-quote": "#5b6573",
    "--md-table": "#3d4a5c",
    "--md-front-matter": "#7b8794",
    "--md-syntax-marker": "#a0a8b3",
    "--md-list-marker": "#b4561f",
    "--md-task-marker": "#2f8a4c",
    "--md-quote-marker": "#8a5bb5",
  },
  [headings]: { color: "var(--md-heading)", fontWeight: "bold" },
  ".md-emphasis": { fontStyle: "italic" },
  ".md-strong": { fontWeight: "bold" },
  ".md-strikethrough": { textDecoration: "line-through" },
  ".md-code": {
    fontFamily: monospace,
    backgroundColor: "var(--md-code-background)",
    paddingLeft: "0.2em",
    paddingRight: "0.2em",
  },
  ".md-code-block": {
    fontFamily: monospace,
    backgroundColor: "var(--md-code-background)",
  },
  ".md-link": { color: "var(--md-link)" },
  ".md-url": { color: "var(--md-url)" },
  ".md-quote": { color: "var(--md-quote)", fontStyle: "italic" },
  ".md-table": { color: "var(--md-table)" },
  ".md-front-matter": { color: "var(--md-front-matter)" },
  ".md-syntax-marker": { color: "var(--md-syntax-marker)" },
  ".md-list-marker": { color: "var(--md-list-marker)" },
  ".md-task-marker": { color: "var(--md-task-marker)" },
  ".md-quote.md-syntax-marker": { color: "var(--md-quote-marker)" },
};

export const markdownTheme = EditorView.theme(markdownThemeSpec);
