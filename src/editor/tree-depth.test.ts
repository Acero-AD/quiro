import { ensureSyntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import { Tree } from "@lezer/common";
import { describe, expect, it } from "vitest";
import { markdownMode } from "./language";
import { newState } from "./state";

const paragraphs = 300;

// Levels of `Tree` nodes, not counting the tree buffers at the leaves.
function depth(tree: Tree): number {
  let deepest = 0;
  for (const child of tree.children) {
    if (child instanceof Tree) deepest = Math.max(deepest, depth(child));
  }
  return deepest + 1;
}

// Just after the last paragraph break before the midpoint, or the start.
function middle(state: EditorState): number {
  const text = state.doc.toString();
  const at = text.lastIndexOf("\n\n", Math.floor(text.length / 2));
  return at < 0 ? 0 : at + 2;
}

const places: [string, (state: EditorState) => number][] = [
  ["start", () => 0],
  ["middle", middle],
  ["end", (state) => state.doc.length],
];

describe("writing in one place", () => {
  // Needs the patched @lezer/markdown's height bound: with whole-chunk reuse
  // alone, each re-parse wraps the previous chunk in one more level.
  it.each(places)(
    "keeps the tree shallow at the %s",
    (_, place) => {
      let state = newState("");
      let tree: Tree | null = null;
      for (let i = 0; i < paragraphs; i++) {
        state = state.update({
          changes: {
            from: place(state),
            insert: `Paragraph ${i} with *some* text.\n\n`,
          },
        }).state;
        tree = ensureSyntaxTree(state, state.doc.length, 1e9);
        if (!tree) throw new Error("the parser did not finish");
      }

      const text = state.doc.toString();
      const fresh = markdownMode().language.parser.parse(text);
      expect(depth(tree as Tree)).toBeLessThanOrEqual(depth(fresh) + 5);
    },
    120_000,
  );
});
