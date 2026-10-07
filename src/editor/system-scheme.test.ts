import { undoDepth } from "@codemirror/commands";
import { EditorView } from "@codemirror/view";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEditor, type Editor } from "./index";

type ChangeListener = (event: MediaQueryListEvent) => void;

// A MediaQueryList whose matches and change events the test controls.
class FakeQueryList {
  matches: boolean;
  readonly media: string;
  readonly listeners = new Set<ChangeListener>();

  constructor(media: string, matches: boolean) {
    this.media = media;
    this.matches = matches;
  }

  addEventListener(type: string, listener: ChangeListener): void {
    if (type === "change") this.listeners.add(listener);
  }

  removeEventListener(type: string, listener: ChangeListener): void {
    if (type === "change") this.listeners.delete(listener);
  }

  change(matches: boolean): void {
    this.matches = matches;
    const event = { matches, media: this.media } as MediaQueryListEvent;
    for (const listener of [...this.listeners]) listener(event);
  }
}

describe("system colour scheme", () => {
  let parent: HTMLElement;
  let editor: Editor | undefined;
  let queries: FakeQueryList[];

  function installMatchMedia(matches: boolean): void {
    vi.stubGlobal("matchMedia", (media: string) => {
      const query = new FakeQueryList(media, matches);
      queries.push(query);
      return query;
    });
  }

  // The editor's own query list, made before CodeMirror makes any.
  function schemeQuery(): FakeQueryList {
    const query = queries.find(
      (query) => query.media === "(prefers-color-scheme: dark)",
    );
    if (!query) throw new Error("no colour-scheme query");
    return query;
  }

  function viewOf(): EditorView {
    const dom = parent.querySelector<HTMLElement>(".cm-editor");
    const found = dom && EditorView.findFromDOM(dom);
    if (!found) throw new Error("no editor view in parent");
    return found;
  }

  function isDark(): boolean {
    return viewOf().state.facet(EditorView.darkTheme);
  }

  beforeEach(() => {
    queries = [];
    parent = document.createElement("div");
    document.body.append(parent);
  });

  afterEach(() => {
    editor?.destroy();
    editor = undefined;
    parent.remove();
    vi.unstubAllGlobals();
  });

  it("starts light without matchMedia", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(() => {
      editor = createEditor(parent);
    }).not.toThrow();
    expect(isDark()).toBe(false);
  });

  it("starts light when the query doesn't match", () => {
    installMatchMedia(false);
    editor = createEditor(parent);
    expect(isDark()).toBe(false);
  });

  it("starts dark when the query matches", () => {
    installMatchMedia(true);
    editor = createEditor(parent);
    // CodeMirror makes its own queries; the editor makes exactly one.
    const dark = queries.filter(
      (query) => query.media === "(prefers-color-scheme: dark)",
    );
    expect(dark).toHaveLength(1);
    expect(isDark()).toBe(true);
  });

  it("switches without touching the text, selection or history", () => {
    installMatchMedia(false);
    editor = createEditor(parent);
    const view = viewOf();
    view.dispatch({
      changes: { from: 0, insert: "# Title" },
      userEvent: "input.type",
    });
    view.dispatch({
      changes: { from: view.state.doc.length, insert: "\n\nbody" },
      userEvent: "input.type",
    });
    view.dispatch({ selection: { anchor: 2, head: 7 } });

    const text = editor.text();
    const selection = view.state.selection;
    const depth = undoDepth(view.state);
    expect(depth).toBeGreaterThan(0);
    expect(selection.main.empty).toBe(false);

    schemeQuery().change(true);
    expect(viewOf()).toBe(view);
    expect(isDark()).toBe(true);
    expect(editor.text()).toBe(text);
    expect(view.state.selection.eq(selection)).toBe(true);
    expect(undoDepth(view.state)).toBe(depth);

    schemeQuery().change(false);
    expect(isDark()).toBe(false);
    expect(editor.text()).toBe(text);
    expect(view.state.selection.eq(selection)).toBe(true);
    expect(undoDepth(view.state)).toBe(depth);
  });

  it("stays dark after load", () => {
    installMatchMedia(true);
    editor = createEditor(parent);
    editor.load("# Loaded");
    expect(editor.text()).toBe("# Loaded");
    expect(isDark()).toBe(true);
  });

  it("stays dark after load when switched while running", () => {
    installMatchMedia(false);
    editor = createEditor(parent);
    schemeQuery().change(true);
    editor.load("# Loaded");
    expect(isDark()).toBe(true);
  });

  it("removes its change listener on destroy", () => {
    installMatchMedia(false);
    editor = createEditor(parent);
    const query = schemeQuery();
    expect(query.listeners.size).toBe(1);
    editor.destroy();
    editor = undefined;
    expect(query.listeners.size).toBe(0);
  });
});
