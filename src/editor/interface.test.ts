import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEditor, type Editor } from "./index";

describe("editor interface", () => {
  let parent: HTMLElement;
  let editor: Editor | undefined;

  beforeEach(() => {
    parent = document.createElement("div");
    document.body.append(parent);
  });

  afterEach(() => {
    editor?.destroy();
    editor = undefined;
    parent.remove();
  });

  it("starts with an empty document", () => {
    editor = createEditor(parent);

    expect(parent.childElementCount).toBeGreaterThan(0);
    expect(editor.text()).toBe("");
  });

  it("strips a leading BOM and stores CRLF line breaks as LF", () => {
    editor = createEditor(parent);

    editor.load("﻿# Title\r\n\r\nText\r\n");

    expect(editor.text()).toBe("# Title\n\nText\n");
  });

  it("loads a document with no line break unchanged", () => {
    editor = createEditor(parent);

    editor.load("one line");

    expect(editor.text()).toBe("one line");
  });

  it("removes its elements from the parent on destroy", () => {
    const destroyed = createEditor(parent);
    expect(parent.childElementCount).toBeGreaterThan(0);

    destroyed.destroy();

    expect(parent.childElementCount).toBe(0);
  });
});
