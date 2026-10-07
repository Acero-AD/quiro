import { ensureSyntaxTree, syntaxTreeAvailable } from "@codemirror/language";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_LARGE_DOCUMENT_SEED,
  generateLargeDocument,
} from "../large-document";
import { newState } from "./state";

describe("background parsing", () => {
  // Slices are a fraction of one full parse on the same machine, so the round
  // count doesn't depend on its speed. If a document change discards the
  // parse's progress, the tree never gets past the first slices.
  it("keeps its progress when a keystroke follows every slice", () => {
    const doc = generateLargeDocument(DEFAULT_LARGE_DOCUMENT_SEED);

    const full = newState(doc);
    const start = performance.now();
    ensureSyntaxTree(full, full.doc.length, 1e9);
    const fullParseMs = performance.now() - start;

    let state = newState(doc);
    for (let round = 0; round < 100; round++) {
      ensureSyntaxTree(state, state.doc.length, fullParseMs / 5);
      if (syntaxTreeAvailable(state, state.doc.length)) break;
      state = state.update({
        changes: { from: state.doc.length, insert: "x" },
      }).state;
    }

    expect(syntaxTreeAvailable(state, state.doc.length)).toBe(true);
  }, 60_000);
});
