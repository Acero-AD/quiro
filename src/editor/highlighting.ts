import { syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { styleTags, Tag, tagHighlighter, tags } from "@lezer/highlight";
import type { MarkdownConfig } from "@lezer/markdown";

// Quiro's own tags, for nodes Lezer leaves untagged or tags too broadly. The
// class mapping never relies on generic tags such as atom, which YAML uses too.
const inlineCode = Tag.define();
const listMarker = Tag.define();
const table = Tag.define();
const taskMarker = Tag.define();
const syntaxMarker = Tag.define();

// These rules replace Lezer's own rules for the same nodes, so each lists
// every tag its node needs.
export const quiroMarkdownTags: MarkdownConfig = {
  props: [
    styleTags({
      InlineCode: inlineCode,
      "Table/...": table,
      ListMark: [listMarker, syntaxMarker],
      TaskMarker: [taskMarker, syntaxMarker],
      HeaderMark: syntaxMarker,
      EmphasisMark: syntaxMarker,
      StrikethroughMark: syntaxMarker,
      CodeMark: syntaxMarker,
      LinkMark: syntaxMarker,
      TableDelimiter: syntaxMarker,
      QuoteMark: syntaxMarker,
    }),
  ],
};

const markdownHighlighter = tagHighlighter([
  { tag: tags.heading1, class: "md-heading-1" },
  { tag: tags.heading2, class: "md-heading-2" },
  { tag: tags.heading3, class: "md-heading-3" },
  { tag: tags.heading4, class: "md-heading-4" },
  { tag: tags.heading5, class: "md-heading-5" },
  { tag: tags.heading6, class: "md-heading-6" },
  { tag: tags.emphasis, class: "md-emphasis" },
  { tag: tags.strong, class: "md-strong" },
  { tag: tags.strikethrough, class: "md-strikethrough" },
  { tag: tags.link, class: "md-link" },
  { tag: tags.url, class: "md-url" },
  { tag: tags.quote, class: "md-quote" },
  { tag: inlineCode, class: "md-code" },
  { tag: listMarker, class: "md-list-marker" },
  { tag: table, class: "md-table" },
  { tag: taskMarker, class: "md-task-marker" },
  { tag: syntaxMarker, class: "md-syntax-marker" },
]);

export function markdownHighlighting(): Extension {
  return syntaxHighlighting(markdownHighlighter);
}
