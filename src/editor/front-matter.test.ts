import { describe, expect, it } from "vitest";
import { markdownMode } from "./language";

// The first child of the top Document, as the editor's language parses it.
function firstBlock(doc: string) {
  const tree = markdownMode().language.parser.parse(doc);
  expect(tree.topNode.name).toBe("Document");
  return tree.topNode.firstChild;
}

describe("front matter", () => {
  it.each([
    ["closed by ---", "---\ntitle: a\n---\n# x\n", 16],
    ["at the very end, without a final line break", "---\ntitle: a\n---", 16],
    ["empty", "---\n---\ntext\n", 7],
  ])("is recognised when %s", (_, doc, to) => {
    const block = firstBlock(doc);
    expect(block?.name).toBe("Frontmatter");
    expect(block?.from).toBe(0);
    expect(block?.to).toBe(to);
  });

  it.each([
    ["... doesn't close it", "---\ntitle: a\n...\n# x\n"],
    ["it is unterminated", "---\ntitle: a\n# x\n"],
  ])("runs to the end of the document when %s", (_, doc) => {
    const block = firstBlock(doc);
    expect(block?.name).toBe("Frontmatter");
    expect(block?.from).toBe(0);
    expect(block?.to).toBe(doc.length);
  });

  it.each([
    ["the first line has a trailing space", "--- \ntitle: a\n---\n"],
    ["the first line is ----", "----\ntitle: a\n----\n"],
    ["the first line is blank", "\n---\ntitle: a\n---\n"],
    ["text comes first", "text\n---\n"],
  ])("isn't recognised when %s", (_, doc) => {
    expect(firstBlock(doc)?.name).not.toBe("Frontmatter");
  });

  it("splits into dash lines and content", () => {
    const block = firstBlock("---\ntitle: a\n---\n# x\n");
    const children: string[] = [];
    for (let child = block?.firstChild; child; child = child.nextSibling) {
      children.push(`${child.name} ${child.from}-${child.to}`);
    }
    expect(children).toEqual([
      "DashLine 0-3",
      "FrontmatterContent 4-12",
      "DashLine 13-16",
    ]);
  });
});
