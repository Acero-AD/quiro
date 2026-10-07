import type { Element, MarkdownConfig } from "@lezer/markdown";

const dashLine = "---";

// A function, not an inline comparison: cx.nextLine() changes line.text, and
// an inline comparison would narrow its type across that call.
function isDashLine(text: string): boolean {
  return text === dashLine;
}

// Front matter, recognised by the Markdown parser itself so the document is
// one parse: an exact `---` first line, closed by the next exact `---` line,
// or running to the end of the document if there is none. The block ends at
// the end of its last line, without that line's break.
export const frontMatter: MarkdownConfig = {
  defineNodes: [
    { name: "Frontmatter", block: true },
    "DashLine",
    "FrontmatterContent",
  ],
  parseBlock: [
    {
      name: "Frontmatter",
      before: "LinkReference",
      parse(cx, line) {
        if (cx.lineStart !== 0 || !isDashLine(line.text)) return false;
        const children: Element[] = [cx.elt("DashLine", 0, dashLine.length)];
        const contentFrom = dashLine.length + 1;
        let end = dashLine.length;
        let closingFrom = -1;
        while (cx.nextLine()) {
          if (isDashLine(line.text)) {
            closingFrom = cx.lineStart;
            end = closingFrom + dashLine.length;
            cx.nextLine();
            break;
          }
          end = cx.lineStart + line.text.length;
        }
        const contentTo = closingFrom < 0 ? end : closingFrom - 1;
        if (contentTo > contentFrom) {
          children.push(cx.elt("FrontmatterContent", contentFrom, contentTo));
        }
        if (closingFrom >= 0) {
          children.push(cx.elt("DashLine", closingFrom, end));
        }
        cx.addElement(cx.elt("Frontmatter", 0, end, children));
        return true;
      },
    },
  ],
};
