// Patches @lezer/markdown's incremental parsing after install (npm
// postinstall), in two groups of edits that each carry a marker, so a
// group is applied once and a later group can be added to files that
// already have an earlier one.
//
// 1. Whole-chunk reuse: Lezer balances a long list of top-level blocks
//    into anonymous chunks and tags them for reuse, but FragmentCursor
//    walks past them, so every keystroke in a fully parsed large
//    document re-adds and rebalances every top-level block. The cursor
//    now sees the chunks, and a chunk counts as a place where reuse may
//    stop. Decided in fix-add-large-document-checks-end-typing.
// 2. Shallow reuse: reusing chunks whole let the tree grow one level
//    deeper about every other paragraph written in one place. Balanced
//    chunks now record their height and size, and are reused whole only
//    while that keeps the tree balanced. Decided in
//    fix-add-large-document-checks-tree-depth.
//
// Both are proposed upstream in lezer/markdown#68. Remove this script
// once @lezer/markdown ships an equivalent change.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] ?? join("node_modules", "@lezer", "markdown");
const patchedVersion = "1.8.0";

function fail(message) {
  console.error(`patch-lezer-markdown: ${message}`);
  process.exit(1);
}

const { version } = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8"),
);
if (version !== patchedVersion) {
  fail(
    `@lezer/markdown is ${version}, but the patch is for ${patchedVersion}. Update or remove scripts/patch-lezer-markdown.mjs.`,
  );
}

const wholeChunkMarker = "quiro patch: whole-chunk fragment reuse";
const shallowMarker = "quiro patch: shallow chunk reuse";

const wholeChunkHelper = (tree) => `// ${wholeChunkMarker}
// The type of the last top-level block inside a balance chunk, or null.
function lastBlockType(tree) {
    while (tree && tree.type.isAnonymous) {
        let last = tree.children[tree.children.length - 1];
        tree = last instanceof ${tree} ? last : null;
    }
    return tree && tree.type.is("Block") ? tree.type : null;
}
class FragmentCursor {`;

const wholeChunkEdits = (iterMode, tree) => [
  [
    "c = this.cursor = this.fragment.tree.cursor();",
    `c = this.cursor = this.fragment.tree.cursor(${iterMode}.IncludeAnonymous);`,
  ],
  [
    `            if (cur.type.is("Block")) {\n                if (NotLast.indexOf(cur.type.id) < 0) {`,
    `            let boundary = cur.type.is("Block") ? cur.type : cur.type.isAnonymous ? lastBlockType(cur.tree) : null;\n            if (boundary) {\n                if (NotLast.indexOf(boundary.id) < 0) {`,
  ],
  ["class FragmentCursor {", wholeChunkHelper(tree)],
];

const shallowHelpers = (nodeProp, nodeType, tree) => `// ${shallowMarker}
// Balanced chunks record their height (counted in such chunks) and how
// many children they hold.
const balanceInfo = new ${nodeProp}({ perNode: true });
function makeBalanced(children, positions, length, hashProp) {
    let height = 0, count = 0;
    for (let ch of children) {
        let info = ch instanceof ${tree} ? ch.prop(balanceInfo) : undefined;
        if (info) {
            height = Math.max(height, info.height);
            count += info.count;
        }
        else
            count++;
    }
    return new ${tree}(${nodeType}.none, children, positions, length, hashProp.concat([[balanceInfo, { height: height + 1, count }]]));
}
// A chunk is reused whole only when it's at most one level taller than a
// freshly balanced chunk (branch factor 8) with as many children.
function shallowEnough(tree) {
    let info = tree && tree.prop(balanceInfo);
    return !!info && info.height <= Math.ceil(Math.log(Math.max(info.count, 2)) / Math.log(8)) + 1;
}
class CompositeBlock {`;

const fragEndCheck = `            if (cur.to - off > fragEnd || cur.to - off > cx.to) {
                if (cur.type.isAnonymous && cur.firstChild())
                    continue;
                break;
            }`;

const shallowEdits = (nodeProp, nodeType, tree) => [
  ["class CompositeBlock {", shallowHelpers(nodeProp, nodeType, tree)],
  [
    `makeTree: (children, positions, length) => new ${tree}(${nodeType}.none, children, positions, length, this.hashProp)`,
    "makeTree: (children, positions, length) => makeBalanced(children, positions, length, this.hashProp)",
  ],
  [
    fragEndCheck,
    `${fragEndCheck}\n            if (cur.type.isAnonymous && !shallowEnough(cur.tree) && cur.firstChild())\n                continue;`,
  ],
];

const builds = [
  {
    file: join("dist", "index.js"),
    groups: [
      {
        marker: wholeChunkMarker,
        edits: [
          [
            "import { NodeType, NodeProp, NodeSet, Parser, Tree, parseMixed } from '@lezer/common';",
            "import { NodeType, NodeProp, NodeSet, Parser, Tree, parseMixed, IterMode } from '@lezer/common';",
          ],
          ...wholeChunkEdits("IterMode", "Tree"),
        ],
      },
      {
        marker: shallowMarker,
        edits: shallowEdits("NodeProp", "NodeType", "Tree"),
      },
    ],
  },
  {
    file: join("dist", "index.cjs"),
    groups: [
      {
        marker: wholeChunkMarker,
        edits: wholeChunkEdits("common.IterMode", "common.Tree"),
      },
      {
        marker: shallowMarker,
        edits: shallowEdits("common.NodeProp", "common.NodeType", "common.Tree"),
      },
    ],
  },
];

for (const { file, groups } of builds) {
  const path = join(root, file);
  let text = readFileSync(path, "utf8");
  const before = text;
  for (const { marker, edits } of groups) {
    if (text.includes(marker)) continue;
    for (const [from, to] of edits) {
      const count = text.split(from).length - 1;
      if (count !== 1) {
        fail(
          `${file}: expected this code once, found it ${count} times:\n${from}`,
        );
      }
      text = text.replace(from, () => to);
    }
  }
  if (text !== before) writeFileSync(path, text);
}
