import { commonmarkLanguage } from "@codemirror/lang-markdown";
import { yamlFrontmatter } from "@codemirror/lang-yaml";
import { Language, type LanguageSupport } from "@codemirror/language";
import { GFM, type MarkdownParser } from "@lezer/markdown";
import { quiroMarkdownTags } from "./highlighting";

// CommonMark plus exactly the GitHub extensions, not markdownLanguage, which
// also brings subscript, superscript and emoji. No codeLanguages: fenced code
// stays one block until G-307. The language adds no editing behaviour.
// markdown() isn't used: it always wraps the parser in a nested HTML and code
// parse, and inside yamlFrontmatter that nested parse reports position 0, so
// every keystroke discards the background parsing progress.
// The front-matter Document wraps the Markdown Document, so tree walkers see
// two Document nodes.
export function markdownMode(): LanguageSupport {
  const markdownLanguage = new Language(
    commonmarkLanguage.data,
    (commonmarkLanguage.parser as MarkdownParser).configure([
      GFM,
      quiroMarkdownTags,
    ]),
    [],
    "markdown",
  );
  return yamlFrontmatter({ content: markdownLanguage });
}
