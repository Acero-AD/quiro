// Patches @lezer/markdown's fragment reuse after install (npm postinstall).
// Lezer balances a long list of top-level blocks into anonymous chunks and
// tags them for reuse, but FragmentCursor walks past them, so every keystroke
// in a fully parsed large document re-adds and rebalances every top-level
// block. The patch lets the cursor see the chunks and lets a chunk count as a
// place where reuse may stop, so unchanged chunks are reused whole.
// Decided in fix-add-large-document-checks-end-typing. Remove this script
// once @lezer/markdown ships an equivalent change.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] ?? join("node_modules", "@lezer", "markdown");
const patchedVersion = "1.8.0";
const marker = "quiro patch: whole-chunk fragment reuse";

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

const helper = (tree) => `// ${marker}
// The type of the last top-level block inside a balance chunk, or null.
function lastBlockType(tree) {
    while (tree && tree.type.isAnonymous) {
        let last = tree.children[tree.children.length - 1];
        tree = last instanceof ${tree} ? last : null;
    }
    return tree && tree.type.is("Block") ? tree.type : null;
}
class FragmentCursor {`;

const sharedEdits = (iterMode, tree) => [
  [
    "c = this.cursor = this.fragment.tree.cursor();",
    `c = this.cursor = this.fragment.tree.cursor(${iterMode}.IncludeAnonymous);`,
  ],
  [
    `            if (cur.type.is("Block")) {\n                if (NotLast.indexOf(cur.type.id) < 0) {`,
    `            let boundary = cur.type.is("Block") ? cur.type : cur.type.isAnonymous ? lastBlockType(cur.tree) : null;\n            if (boundary) {\n                if (NotLast.indexOf(boundary.id) < 0) {`,
  ],
  ["class FragmentCursor {", helper(tree)],
];

const builds = [
  {
    file: join("dist", "index.js"),
    edits: [
      [
        "import { NodeType, NodeProp, NodeSet, Parser, Tree, parseMixed } from '@lezer/common';",
        "import { NodeType, NodeProp, NodeSet, Parser, Tree, parseMixed, IterMode } from '@lezer/common';",
      ],
      ...sharedEdits("IterMode", "Tree"),
    ],
  },
  {
    file: join("dist", "index.cjs"),
    edits: sharedEdits("common.IterMode", "common.Tree"),
  },
];

for (const { file, edits } of builds) {
  const path = join(root, file);
  let text = readFileSync(path, "utf8");
  if (text.includes(marker)) continue;
  for (const [from, to] of edits) {
    const count = text.split(from).length - 1;
    if (count !== 1) {
      fail(`${file}: expected this code once, found it ${count} times:\n${from}`);
    }
    text = text.replace(from, () => to);
  }
  writeFileSync(path, text);
}
