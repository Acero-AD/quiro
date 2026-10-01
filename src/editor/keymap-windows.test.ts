import type { EditorView } from "@codemirror/view";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { createEditor as CreateEditor, Editor } from "./index";

// @codemirror/view reads navigator.platform once, when it loads, so the stub
// goes in before the dynamic imports below. Static imports would be hoisted.
Object.defineProperty(navigator, "platform", {
  value: "Win32",
  configurable: true,
});

let EditorViewClass: typeof EditorView;
let createEditor: typeof CreateEditor;

beforeAll(async () => {
  ({ EditorView: EditorViewClass } = await import("@codemirror/view"));
  ({ createEditor } = await import("./index"));
});

interface Key {
  key: string;
  keyCode: number;
  shiftKey?: boolean;
}

const ctrlZ: Key = { key: "z", keyCode: 90 };
const ctrlShiftZ: Key = { key: "Z", keyCode: 90, shiftKey: true };
const ctrlY: Key = { key: "y", keyCode: 89 };

const reservedKeys: [string, Key][] = [
  ["Ctrl+N", { key: "n", keyCode: 78 }],
  ["Ctrl+O", { key: "o", keyCode: 79 }],
  ["Ctrl+S", { key: "s", keyCode: 83 }],
  ["Ctrl+Shift+S", { key: "S", keyCode: 83, shiftKey: true }],
  ["Ctrl+,", { key: ",", keyCode: 188 }],
  ["Ctrl+Shift+P", { key: "P", keyCode: 80, shiftKey: true }],
  ["Ctrl+/", { key: "/", keyCode: 191 }],
];

describe("keymap on Windows", () => {
  let parent: HTMLElement;
  let editor: Editor;
  let view: EditorView;

  function press({ key, keyCode, shiftKey = false }: Key): KeyboardEvent {
    const event = new KeyboardEvent("keydown", {
      key,
      keyCode,
      ctrlKey: true,
      shiftKey,
      bubbles: true,
      cancelable: true,
    });
    view.contentDOM.dispatchEvent(event);
    return event;
  }

  function type(text: string): void {
    const end = view.state.doc.length;
    view.dispatch({
      changes: { from: end, insert: text },
      selection: { anchor: end + text.length },
      userEvent: "input.type",
    });
  }

  beforeEach(() => {
    parent = document.createElement("div");
    document.body.append(parent);
    editor = createEditor(parent);
    const dom = parent.querySelector<HTMLElement>(".cm-editor");
    const found = dom && EditorViewClass.findFromDOM(dom);
    if (!found) throw new Error("no editor view in parent");
    view = found;
  });

  afterEach(() => {
    editor.destroy();
    parent.remove();
  });

  it("runs on the Windows platform", () => {
    expect(navigator.platform).toBe("Win32");
  });

  it("undoes with Ctrl+Z", () => {
    type("hello");
    press(ctrlZ);
    expect(editor.text()).toBe("");
  });

  it("redoes with Ctrl+Shift+Z", () => {
    type("hello");
    press(ctrlZ);
    expect(editor.text()).toBe("");
    press(ctrlShiftZ);
    expect(editor.text()).toBe("hello");
  });

  it("redoes with Ctrl+Y", () => {
    type("hello");
    press(ctrlZ);
    expect(editor.text()).toBe("");
    press(ctrlY);
    expect(editor.text()).toBe("hello");
  });

  it.each(reservedKeys)("leaves %s to the app", (_name, key) => {
    editor.load("some text");
    type(" more");
    const event = press(key);
    expect(event.defaultPrevented).toBe(false);
    expect(editor.text()).toBe("some text more");
  });
});
