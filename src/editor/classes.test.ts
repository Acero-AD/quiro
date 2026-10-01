import { forceParsing } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEditor, type Editor } from "./index";

describe("semantic classes", () => {
  let parent: HTMLElement;
  let editor: Editor;

  beforeEach(() => {
    parent = document.createElement("div");
    document.body.append(parent);
    editor = createEditor(parent);
  });

  afterEach(() => {
    editor.destroy();
    parent.remove();
  });

  function show(doc: string): EditorView {
    editor.load(doc);
    const dom = parent.querySelector<HTMLElement>(".cm-editor");
    const view = dom && EditorView.findFromDOM(dom);
    if (!view) throw new Error("no editor view in parent");
    forceParsing(view, view.state.doc.length, 5000);
    return view;
  }

  // The text of every element carrying the class, trimmed.
  function texts(view: EditorView, className: string): string[] {
    return Array.from(
      view.contentDOM.querySelectorAll(`.${className}`),
      (element) => element.textContent?.trim() ?? "",
    );
  }

  it.each([1, 2, 3, 4, 5, 6])("marks a level %i heading", (level) => {
    const view = show(`${"#".repeat(level)} Title`);
    expect(texts(view, `md-heading-${level}`)).toContain("Title");
  });

  it("gives a second-level heading only its own level", () => {
    const view = show("## Section");
    expect(texts(view, "md-heading-2")).toContain("Section");
    expect(texts(view, "md-heading-1")).toEqual([]);
  });

  it.each([
    ["md-emphasis", "a *word* b", "word"],
    ["md-strong", "a **word** b", "word"],
    ["md-strikethrough", "a ~~gone~~ b", "gone"],
    ["md-code", "a `code` b", "code"],
    ["md-link", "[text](https://example.com)", "text"],
    ["md-url", "[text](https://example.com)", "https://example.com"],
    ["md-url", "see <https://example.com>", "https://example.com"],
    ["md-list-marker", "- item", "-"],
    ["md-list-marker", "1. item", "1."],
    ["md-quote", "> quoted", "quoted"],
    ["md-table", "| a | b |\n| - | - |\n| c | d |", "c"],
    ["md-task-marker", "- [ ] todo", "[ ]"],
    ["md-task-marker", "- [x] done", "[x]"],
  ])("gives %s to %j", (className, doc, text) => {
    expect(texts(show(doc), className)).toContain(text);
  });

  it("marks the heading marker but not the heading text", () => {
    const view = show("# Title");
    const markers = texts(view, "md-syntax-marker");
    expect(markers).toContain("#");
    expect(markers.some((marker) => marker.includes("Title"))).toBe(false);
  });

  it.each([
    ["a *word* b", "*"],
    ["a **word** b", "**"],
    ["a ~~gone~~ b", "~~"],
    ["a `code` b", "`"],
    ["[text](https://example.com)", "]("],
    ["| a | b |\n| - | - |", "|"],
    ["> quoted", ">"],
    ["- item", "-"],
    ["- [ ] todo", "[ ]"],
  ])("gives md-syntax-marker to the markers of %j", (doc, marker) => {
    const markers = texts(show(doc), "md-syntax-marker");
    expect(markers.join("")).toContain(marker);
    expect(markers.every((text) => !/\w{2,}/.test(text))).toBe(true);
  });

  it("marks every fenced code line, and inline code elsewhere", () => {
    const view = show("```\nlet x = 1;\n```\n\nand `y`");
    expect(texts(view, "cm-line.md-code-block")).toEqual([
      "```",
      "let x = 1;",
      "```",
    ]);
    expect(texts(view, "md-code")).toEqual(["y"]);
  });

  it("marks every line of the front matter and nothing after it", () => {
    const view = show("---\ntitle: Notes\n---\n\nText");
    expect(texts(view, "cm-line.md-front-matter")).toEqual([
      "---",
      "title: Notes",
      "---",
    ]);
  });
});
