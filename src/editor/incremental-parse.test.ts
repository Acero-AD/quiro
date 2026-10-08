import { ensureSyntaxTree } from "@codemirror/language";
import type { Tree } from "@lezer/common";
import { describe, expect, it } from "vitest";
import fixture from "./fixtures/dialect.md?raw";
import { markdownMode } from "./language";
import { newState } from "./state";

const insertions = [
  "x",
  "\n",
  "\n\n",
  "```\n",
  "# ",
  "> ",
  "- ",
  "1. ",
  "    ",
  "| a | b |\n| - | - |\n",
  "*",
  "**",
  "~~",
  "`",
  "---\n",
  "- [ ] ",
  "<div>\n",
];

// Every node's name and range, as `Name from-to` lines.
function listing(tree: Tree): string {
  const lines: string[] = [];
  tree.iterate({
    enter(node) {
      lines.push(`${node.name} ${node.from}-${node.to}\n`);
    },
  });
  return lines.join("");
}

// A linear congruential generator, so every run applies the same edits.
function generator(seed: number): (below: number) => number {
  let state = seed >>> 0;
  return (below) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return Math.floor((state / 2 ** 32) * below);
  };
}

describe("incremental parsing", () => {
  it("matches a fresh parse after every seeded edit", () => {
    const random = generator(20261008);
    const parser = markdownMode().language.parser;
    let state = newState(fixture.repeat(20));

    for (let edit = 0; edit < 300; edit++) {
      const length = state.doc.length;
      let changes: { from: number; to?: number; insert?: string };
      if (random(4) < 3) {
        const insert = insertions[random(insertions.length)];
        changes = { from: random(length + 1), insert };
      } else {
        const from = random(length);
        changes = { from, to: Math.min(length, from + 1 + random(200)) };
      }
      state = state.update({ changes }).state;

      const tree = ensureSyntaxTree(state, state.doc.length, 1e9);
      if (!tree) throw new Error("the parser did not finish");
      const text = state.doc.toString();
      expect(listing(tree), `after edit ${edit}`).toBe(
        listing(parser.parse(text)),
      );
    }
  }, 120_000);
});
