import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  type EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";

// Whole-line classes, so a block's background spans its full width.
const blockClasses: Record<string, Decoration> = {
  FencedCode: Decoration.line({ class: "md-code-block" }),
  Frontmatter: Decoration.line({ class: "md-front-matter" }),
};

function buildBlocks(view: EditorView): DecorationSet {
  const { doc } = view.state;
  const builder = new RangeSetBuilder<Decoration>();
  const tree = syntaxTree(view.state);
  // Visible ranges can share a line; a line is decorated once.
  let nextLine = 0;
  for (const { from, to } of view.visibleRanges) {
    tree.iterate({
      from,
      to,
      enter(node) {
        const decoration = blockClasses[node.name];
        if (!decoration) return;
        // Front matter ends after its closing line break; that next line
        // isn't part of the block.
        let last = doc.lineAt(node.to);
        if (last.from === node.to && node.to > node.from) {
          last = doc.line(last.number - 1);
        }
        const start = doc.lineAt(Math.max(node.from, from));
        const end = Math.min(last.number, doc.lineAt(to).number);
        for (let n = start.number; n <= end; n++) {
          const line = doc.line(n);
          if (line.from < nextLine) continue;
          builder.add(line.from, line.from, decoration);
          nextLine = line.to + 1;
        }
        return false;
      },
    });
  }
  return builder.finish();
}

export const blockLines = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildBlocks(view);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        syntaxTree(update.startState) !== syntaxTree(update.state)
      ) {
        this.decorations = buildBlocks(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);
