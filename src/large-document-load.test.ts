import { afterEach, describe, expect, it } from "vitest";
import { createEditor, type Editor } from "./editor/index";
import {
  DEFAULT_LARGE_DOCUMENT_SEED,
  generateLargeDocument,
} from "./large-document";

describe("large document load budget", () => {
  let parent: HTMLElement | undefined;
  let editor: Editor | undefined;

  afterEach(() => {
    editor?.destroy();
    editor = undefined;
    parent?.remove();
  });

  // About ten times the expected cost: catches work that grows with the
  // whole document, such as a forced full parse, without being flaky.
  it("loads the generated document in under 250 ms", () => {
    const text = generateLargeDocument(DEFAULT_LARGE_DOCUMENT_SEED);
    parent = document.createElement("div");
    document.body.append(parent);
    editor = createEditor(parent);

    const start = performance.now();
    editor.load(text);
    const elapsed = performance.now() - start;

    expect(editor.text().length).toBe(text.length);
    expect(elapsed).toBeLessThan(250);
  });
});
