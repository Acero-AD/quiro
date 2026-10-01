import { EditorView } from "@codemirror/view";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEditor, type Editor } from "./index";

function viewOf(parent: HTMLElement): EditorView {
  const dom = parent.querySelector<HTMLElement>(".cm-editor");
  const view = dom && EditorView.findFromDOM(dom);
  if (!view) throw new Error("no editor view in parent");
  return view;
}

describe("editing behaviour", () => {
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

  it("does not undo past a load", () => {
    const view = viewOf(parent);
    view.dispatch({
      changes: { from: 0, insert: "before load" },
      userEvent: "input.type",
    });

    editor.load("loaded text");
    const content = viewOf(parent).contentDOM;
    const event = new KeyboardEvent("keydown", {
      key: "z",
      code: "KeyZ",
      keyCode: 90,
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    content.dispatchEvent(event);

    expect(editor.text()).toBe("loaded text");
    expect(viewOf(parent).state.selection.main.head).toBe(0);
  });

  it("pastes the clipboard's plain text, not its HTML", () => {
    const content = viewOf(parent).contentDOM;
    const clipboard: Record<string, string> = {
      "text/html": "<b>RICH</b>",
      "text/plain": "plain",
    };
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", {
      value: { getData: (type: string) => clipboard[type] ?? "" },
    });

    content.dispatchEvent(event);

    expect(editor.text()).toContain("plain");
    expect(editor.text()).not.toContain("RICH");
  });
});
