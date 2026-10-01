import { ensureSyntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import fixture from "./fixtures/dialect.md?raw";
import listing from "./fixtures/dialect.tree.txt?raw";
import { markdownMode } from "./language";

const listingPath = "src/editor/fixtures/dialect.tree.txt";

interface ParsedNode {
  name: string;
  from: number;
  to: number;
}

// Walks the fully parsed tree, including the Markdown tree mounted inside the
// front-matter wrapper. Tree.toString() would drop the mount and positions.
function parse(doc: string): ParsedNode[] {
  const state = EditorState.create({ doc, extensions: markdownMode() });
  const tree = ensureSyntaxTree(state, state.doc.length, 5000);
  if (!tree) throw new Error("the parser did not finish in time");
  const nodes: ParsedNode[] = [];
  tree.iterate({
    enter(node) {
      nodes.push({ name: node.name, from: node.from, to: node.to });
    },
  });
  return nodes;
}

function names(doc: string): string[] {
  return parse(doc).map((node) => node.name);
}

describe("dialect fixture", () => {
  it("is short, LF-only and free of raw HTML", () => {
    expect(fixture.length).toBeLessThan(3000);
    expect(fixture).not.toContain("\r");
    expect(names(fixture)).not.toContain("HTMLTag");
    expect(names(fixture)).not.toContain("HTMLBlock");
  });

  it("parses to the checked-in tree listing", () => {
    const actual = parse(fixture)
      .map(({ name, from, to }) => `${name} ${from}-${to}\n`)
      .join("");
    if (actual !== listing) {
      const message = [
        "The parse tree of the dialect fixture changed.",
        `Write the listing between the markers to ${listingPath}.`,
        `----- BEGIN ${listingPath} -----`,
        `${actual}----- END ${listingPath} -----`,
      ].join("\n");
      throw new Error(message);
    }
  });
});

describe("dialect", () => {
  it("leaves a single tilde as plain text", () => {
    const found = names("a ~x~ b\n");
    expect(found).not.toContain("Subscript");
    expect(found).not.toContain("Strikethrough");
  });

  it("has no emoji shortcodes", () => {
    expect(names("a :smile: b\n")).not.toContain("Emoji");
  });

  it("strikes through two tildes", () => {
    const strike = parse("a ~~gone~~ b\n").find(
      (node) => node.name === "Strikethrough",
    );
    expect(strike).toMatchObject({ from: 2, to: 10 });
  });

  it("reads a leading YAML block as front matter", () => {
    const found = names("---\ntitle: Notes\n---\n\nText\n");
    expect(found).toContain("Frontmatter");
    expect(found).not.toContain("HorizontalRule");
    expect(found).not.toContain("SetextHeading2");
  });
});
