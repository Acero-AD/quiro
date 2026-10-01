import { commonmarkLanguage, markdown } from "@codemirror/lang-markdown";
import { yamlFrontmatter } from "@codemirror/lang-yaml";
import type { LanguageSupport } from "@codemirror/language";
import { GFM } from "@lezer/markdown";
import { quiroMarkdownTags } from "./highlighting";

// CommonMark plus exactly the GitHub extensions, not markdownLanguage, which
// also brings subscript, superscript and emoji. No codeLanguages: fenced code
// stays one block until G-307. The keymap, tag completion and paste-as-link
// are off so the language adds no editing behaviour.
// The front-matter Document wraps the Markdown Document, so tree walkers see
// two Document nodes.
export function markdownMode(): LanguageSupport {
  return yamlFrontmatter({
    content: markdown({
      base: commonmarkLanguage,
      extensions: [GFM, quiroMarkdownTags],
      addKeymap: false,
      completeHTMLTags: false,
      pasteURLAsLink: false,
    }),
  });
}
