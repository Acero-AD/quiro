import { commonmarkLanguage } from "@codemirror/lang-markdown";
import { Language, LanguageSupport } from "@codemirror/language";
import { GFM, type MarkdownParser } from "@lezer/markdown";
import { frontMatter } from "./front-matter";
import { quiroMarkdownTags } from "./highlighting";

// CommonMark plus exactly the GitHub extensions, not markdownLanguage, which
// also brings subscript, superscript and emoji. No codeLanguages: fenced code
// stays one block until G-307. The language adds no editing behaviour.
// The whole document is one Markdown parse, front matter included, with no
// nested parse: a nested parse reports position 0 until its outer pass ends,
// so every keystroke would discard the background parsing progress. That's
// why neither markdown() nor yamlFrontmatter is used.
export function markdownMode(): LanguageSupport {
  return new LanguageSupport(
    new Language(
      commonmarkLanguage.data,
      (commonmarkLanguage.parser as MarkdownParser).configure([
        GFM,
        quiroMarkdownTags,
        frontMatter,
      ]),
      [],
      "markdown",
    ),
  );
}
