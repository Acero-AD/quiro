import { EditorView } from "@codemirror/view";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEditor, type Editor } from "./index";

function viewOf(parent: HTMLElement): EditorView {
  const dom = parent.querySelector<HTMLElement>(".cm-editor");
  const view = dom && EditorView.findFromDOM(dom);
  if (!view) throw new Error("no editor view in parent");
  return view;
}

describe("the Markdown language adds no editing behaviour", () => {
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

  it("does not continue a list on Enter", () => {
    editor.load("- item");
    const view = viewOf(parent);
    view.dispatch({ selection: { anchor: view.state.doc.length } });
    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      bubbles: true,
      cancelable: true,
    });
    view.contentDOM.dispatchEvent(event);

    const lines = editor.text().split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("- item");
    expect(lines[1].startsWith("- ")).toBe(false);
  });

  it("pastes a URL over a selection as plain text", () => {
    editor.load("word");
    const view = viewOf(parent);
    view.dispatch({ selection: { anchor: 0, head: 4 } });
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", {
      value: {
        getData: (type: string) =>
          type === "text/plain" ? "https://example.com" : "",
      },
    });

    view.contentDOM.dispatchEvent(event);

    expect(editor.text()).toBe("https://example.com");
  });
});
