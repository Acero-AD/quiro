import { forceParsing } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it } from "vitest";
import type { ColourScheme } from "./colour-scheme";
import { newState } from "./state";

describe("colour scheme cascade", () => {
  const views: EditorView[] = [];

  afterEach(() => {
    for (const view of views.splice(0)) {
      view.destroy();
      view.dom.remove();
    }
  });

  function titleColour(scheme?: ColourScheme): string {
    const view = new EditorView({ state: newState("# Title", scheme) });
    views.push(view);
    document.body.append(view.dom);
    forceParsing(view, view.state.doc.length, 5000);
    const walker = document.createTreeWalker(
      view.contentDOM,
      NodeFilter.SHOW_TEXT,
    );
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.textContent?.includes("Title") && node.parentElement) {
        return getComputedStyle(node.parentElement).color;
      }
    }
    throw new Error("no Title text in the editor");
  }

  it("shows a dark heading in the dark --md-heading", () => {
    expect(titleColour("dark")).toBe("rgb(143, 184, 240)");
  });

  it("shows a light heading in the light --md-heading", () => {
    expect(titleColour()).toBe("rgb(31, 79, 143)");
  });
});
