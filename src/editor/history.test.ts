import { undo } from "@codemirror/commands";
import { Transaction } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEditor, type Editor } from "./index";

const start = 1_000_000;

describe("undo history", () => {
  let parent: HTMLElement;
  let editor: Editor;
  let view: EditorView;

  // Replaces from..to with text at the given time, as one user edit.
  function edit(
    from: number,
    to: number,
    text: string,
    time: number,
    userEvent: string,
  ): void {
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
      userEvent,
      annotations: Transaction.time.of(time),
    });
  }

  function type(text: string, time: number): void {
    const end = view.state.doc.length;
    edit(end, end, text, time, "input.type");
  }

  beforeEach(() => {
    parent = document.createElement("div");
    document.body.append(parent);
    editor = createEditor(parent);
    const dom = parent.querySelector<HTMLElement>(".cm-editor");
    const found = dom && EditorView.findFromDOM(dom);
    if (!found) throw new Error("no editor view in parent");
    view = found;
  });

  afterEach(() => {
    editor.destroy();
    parent.remove();
  });

  it("keeps 100 separate steps and undoes them one by one", () => {
    const texts = [editor.text()];
    for (let i = 0; i < 100; i++) {
      type(String(i % 10), start + i * 600);
      texts.push(editor.text());
    }
    expect(editor.text()).toHaveLength(100);

    for (let i = 99; i >= 0; i--) {
      expect(undo(view)).toBe(true);
      expect(editor.text()).toBe(texts[i]);
    }
    expect(editor.text()).toBe("");
  });

  it("undoes a burst of typing in one step", () => {
    for (const [i, char] of [..."abcde"].entries()) {
      type(char, start + i * 100);
    }
    expect(editor.text()).toBe("abcde");

    undo(view);
    expect(editor.text()).toBe("");
  });

  it("undoes an edit 600 ms after a burst separately", () => {
    for (const [i, char] of [..."abcde"].entries()) {
      type(char, start + i * 100);
    }
    type("f", start + 400 + 600);
    expect(editor.text()).toBe("abcdef");

    undo(view);
    expect(editor.text()).toBe("abcde");
    undo(view);
    expect(editor.text()).toBe("");
  });

  it("undoes a whole composed sequence in one step", () => {
    type("a", start);
    // An input method starts a composition 600 ms later and keeps
    // replacing its preedit text over several seconds.
    edit(1, 1, "n", start + 600, "input.type.compose.start");
    edit(1, 2, "に", start + 2600, "input.type.compose");
    edit(1, 2, "にh", start + 4600, "input.type.compose");
    edit(1, 3, "にほ", start + 6600, "input.type.compose");
    edit(1, 3, "日本", start + 8600, "input.type.compose");
    expect(editor.text()).toBe("a日本");

    undo(view);
    expect(editor.text()).toBe("a");
    undo(view);
    expect(editor.text()).toBe("");
  });
});
