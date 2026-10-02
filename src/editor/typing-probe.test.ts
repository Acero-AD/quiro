import { afterEach, describe, expect, it } from "vitest";
import {
  createEditor,
  type Editor,
  startTypingProbe,
  summarizeSamples,
} from "./index";

describe("summarizeSamples", () => {
  it("takes the median of an odd count", () => {
    expect(summarizeSamples([3, 1, 2]).medianMs).toBe(2);
  });

  it("averages the middle two of an even count", () => {
    expect(summarizeSamples([1, 2, 3, 4]).medianMs).toBe(2.5);
  });

  it("uses the nearest rank for p95, and reports the max", () => {
    const samples = Array.from({ length: 100 }, (_, i) => 100 - i);
    const summary = summarizeSamples(samples);
    expect(summary.count).toBe(100);
    expect(summary.p95Ms).toBe(95);
    expect(summary.maxMs).toBe(100);
  });

  it("gives count 0 for no samples", () => {
    expect(summarizeSamples([]).count).toBe(0);
  });
});

describe("startTypingProbe", () => {
  let parent: HTMLElement | undefined;
  let editor: Editor | undefined;

  afterEach(() => {
    editor?.destroy();
    editor = undefined;
    parent?.remove();
  });

  it("starts with no samples and empties them on reset", () => {
    parent = document.createElement("div");
    document.body.append(parent);
    editor = createEditor(parent);
    editor.load("# Title\n\ntext");

    const probe = startTypingProbe(editor);
    expect(probe.read().count).toBe(0);
    probe.reset();
    expect(probe.read()).toEqual({
      count: 0,
      medianMs: 0,
      p95Ms: 0,
      maxMs: 0,
      parseToEndMs: null,
    });
    probe.stop();
  });

  it("rejects an object that createEditor did not make", () => {
    const fake: Editor = {
      load() {},
      text: () => "",
      focus() {},
      destroy() {},
    };
    expect(() => startTypingProbe(fake)).toThrow();
  });
});
