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

// The anonymous chunks that balancing groups blocks into, found by walking
// the tree without entering any named node.
function chunks(tree: Tree): Tree[] {
  const found: Tree[] = [];
  const cursor = tree.cursor(IterMode.IncludeAnonymous);
  if (!cursor.firstChild()) return found;
  let anonymous: boolean;
  do {
    anonymous = cursor.type.isAnonymous;
    if (anonymous && cursor.tree) found.push(cursor.tree);
  } while (cursor.next(anonymous));
  return found;
}

describe("incremental parsing of a complete tree", () => {
  // Needs the patched @lezer/markdown: as released, its reuse cursor skips
  // anonymous chunks and re-adds every top-level block on each keystroke.
  it("reuses most unchanged chunks as the same objects", () => {
    const state = newState(generateLargeDocument(DEFAULT_LARGE_DOCUMENT_SEED));
    const tree = parseAll(state);
    const before = chunks(tree);
    expect(before.length).toBeGreaterThanOrEqual(100);

    const next = state.update({
      changes: { from: state.doc.length, insert: "x" },
    }).state;
    // A new tree, so reuse isn't trivially the old tree itself.
    const nextTree = parseAll(next);
    expect(nextTree).not.toBe(tree);
    expect(nextTree.length).toBe(tree.length + 1);
    const after = new Set(chunks(nextTree));
    const reused = before.filter((chunk) => after.has(chunk)).length;
    expect(reused).toBeGreaterThanOrEqual(0.9 * before.length);
  }, 120_000);
});
