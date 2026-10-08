import { ensureSyntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import { IterMode, type Tree } from "@lezer/common";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_LARGE_DOCUMENT_SEED,
  generateLargeDocument,
} from "../large-document";
import { newState } from "./state";

function parseAll(state: EditorState): Tree {
  const tree = ensureSyntaxTree(state, state.doc.length, 1e9);
  if (!tree) throw new Error("the parser did not finish");
  return tree;
}

// Walks the top-level blocks and the anonymous chunks that group them,
// without entering the blocks themselves.
function reaches(tree: Tree, chunk: Tree): boolean {
  const cursor = tree.cursor(IterMode.IncludeAnonymous);
  if (!cursor.firstChild()) return false;
  do {
    if (cursor.tree === chunk) return true;
  } while (cursor.next(cursor.type.isAnonymous && cursor.tree !== null));
  return false;
}

describe("incremental parsing of a complete tree", () => {
  // Needs the patched @lezer/markdown: as released, its reuse cursor skips
  // anonymous chunks and re-adds every top-level block on each keystroke.
  it("reuses the unchanged first chunk as the same object", () => {
    const state = newState(generateLargeDocument(DEFAULT_LARGE_DOCUMENT_SEED));
    const tree = parseAll(state);

    const cursor = tree.cursor(IterMode.IncludeAnonymous);
    expect(cursor.firstChild()).toBe(true);
    expect(cursor.type.isAnonymous).toBe(true);
    const chunk = cursor.tree;
    expect(chunk).not.toBeNull();

    const next = state.update({
      changes: { from: state.doc.length, insert: "x" },
    }).state;
    expect(reaches(parseAll(next), chunk as Tree)).toBe(true);
  }, 120_000);
});
