import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it } from "vitest";
import { darkThemeSpec } from "./colour-scheme";
import { newState } from "./state";
import { markdownThemeSpec } from "./theme";

// style-mod accepts camelCase and kebab-case property names alike.
function kebab(property: string): string {
  return property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function mdNames(spec: Record<string, Record<string, string>>): string[] {
  return Object.keys(spec["&"])
    .filter((name) => name.startsWith("--md-"))
    .sort();
}

describe("dark theme spec", () => {
  it("declares the same --md- properties as the light theme", () => {
    expect(mdNames(darkThemeSpec)).toEqual(mdNames(markdownThemeSpec));
  });

  it("declares --editor-selection", () => {
    expect(darkThemeSpec["&"]["--editor-selection"]).toBeDefined();
  });

  it("only sets the selection background outside the root", () => {
    const others = Object.entries(darkThemeSpec).filter(
      ([selector]) => selector !== "&",
    );
    expect(others.length).toBeGreaterThan(0);
    for (const [, style] of others) {
      const declarations = Object.entries(style).map(([property, value]) => [
        kebab(property),
        value,
      ]);
      expect(declarations).toEqual([
        ["background-color", "var(--editor-selection)"],
      ]);
    }
  });
});

describe("colour scheme per state", () => {
  const views: EditorView[] = [];

  afterEach(() => {
    for (const view of views.splice(0)) {
      view.destroy();
      view.dom.remove();
    }
  });

  function mount(view: EditorView): EditorView {
    document.body.append(view.dom);
    views.push(view);
    return view;
  }

  it("uses CodeMirror's dark base theme for a dark state", () => {
    const view = mount(new EditorView({ state: newState("text", "dark") }));
    expect(view.state.facet(EditorView.darkTheme)).toBe(true);
  });

  it("uses CodeMirror's light base theme by default", () => {
    const view = mount(new EditorView({ state: newState("text") }));
    expect(view.state.facet(EditorView.darkTheme)).toBe(false);
  });
});
