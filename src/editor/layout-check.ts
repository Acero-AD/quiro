import { ensureSyntaxTree } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import dialect from "./fixtures/dialect.md?raw";
import { newState } from "./state";

export interface LayoutViolation {
  rule: "line-height" | "jitter" | "inline-box" | "overflow";
  line: number;
  detail: string;
}

type Report = (
  rule: LayoutViolation["rule"],
  line: number,
  detail: string,
) => void;

// Sub-pixel rounding differs between engines, so heights are compared with
// the measured visual-line height, within half a pixel.
const tolerance = 0.5;

// The dialect fixture is frozen, so the font-fallback line and the long
// token are added here.
const emojiCjkLine = "Emoji 😀 🎉 ✅ and CJK 漢字 かな カナ 한국어";
const longToken = "x".repeat(2000);
const fixtureText = dialect.endsWith("\n") ? dialect : `${dialect}\n`;
const layoutFixture = `${fixtureText}${emojiCjkLine}\n${longToken}\n`;

function px(value: number): string {
  return `${Math.round(value * 100) / 100}px`;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function drawState(view: EditorView): string {
  return `${view.viewport.from}:${view.viewport.to}:${view.contentHeight}`;
}

// Two frames let CodeMirror draw and measure; a new viewport can take a few
// more measure cycles before its heights settle.
async function settle(view: EditorView): Promise<void> {
  await nextFrame();
  await nextFrame();
  for (let frame = 0; frame < 20; frame++) {
    const before = drawState(view);
    await nextFrame();
    if (drawState(view) === before) return;
  }
}

function drawnLines(view: EditorView): { dom: HTMLElement; line: number }[] {
  const lines =
    view.contentDOM.querySelectorAll<HTMLElement>(":scope > .cm-line");
  return Array.from(lines, (dom) => ({
    dom,
    line: view.state.doc.lineAt(view.posAtDOM(dom)).number,
  }));
}

// Counts the rows the line's text sits on, so a line drawn taller than its
// text needs is caught even when its height is a multiple of the row height.
function textRows(dom: HTMLElement, rowHeight: number): number {
  const centres: number[] = [];
  const walker = document.createTreeWalker(dom, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    range.selectNodeContents(node);
    for (const rect of Array.from(range.getClientRects())) {
      if (rect.height > 0) centres.push((rect.top + rect.bottom) / 2);
    }
  }
  centres.sort((a, b) => a - b);
  let rows = 0;
  let rowStart = Number.NEGATIVE_INFINITY;
  for (const centre of centres) {
    if (centre - rowStart > rowHeight / 2) {
      rows++;
      rowStart = centre;
    }
  }
  return rows;
}

function outsideLine(rect: DOMRect, box: DOMRect, rowHeight: number): boolean {
  return (
    rect.top < box.top - tolerance ||
    rect.bottom > box.bottom + tolerance ||
    rect.left < box.left - tolerance ||
    rect.right > box.right + tolerance ||
    rect.height > rowHeight + tolerance
  );
}

function checkDrawnLines(view: EditorView, report: Report): void {
  const rowHeight = view.defaultLineHeight;
  for (const { dom, line } of drawnLines(view)) {
    const box = dom.getBoundingClientRect();
    const visualLines = Math.round(box.height / rowHeight);
    if (
      visualLines < 1 ||
      Math.abs(box.height - visualLines * rowHeight) > tolerance
    ) {
      report(
        "line-height",
        line,
        `line is ${px(box.height)} tall, not a multiple of the ${px(rowHeight)} visual line`,
      );
    } else {
      const rows = textRows(dom, rowHeight);
      if (rows > 0 && rows !== visualLines) {
        report(
          "line-height",
          line,
          `line is ${px(box.height)} tall for ${rows} visual line(s) of ${px(rowHeight)}`,
        );
      }
    }

    for (const element of Array.from(dom.querySelectorAll("*"))) {
      const rects = Array.from(element.getClientRects());
      const rect = rects.find((r) => outsideLine(r, box, rowHeight));
      if (!rect) continue;
      const tag = element.tagName.toLowerCase();
      const name = `<${tag} class="${element.getAttribute("class") ?? ""}">`;
      report(
        "inline-box",
        line,
        `${name} is ${px(rect.height)} tall at ${px(rect.top - box.top)} from the top of a ${px(box.height)} line with ${px(rowHeight)} visual lines`,
      );
    }
  }
}

function checkOverflow(view: EditorView, report: Report): void {
  const scroller = view.scrollDOM;
  if (scroller.scrollWidth <= scroller.clientWidth) return;
  const lines = drawnLines(view);
  const wide = lines.find(({ dom }) => dom.scrollWidth > dom.clientWidth);
  report(
    "overflow",
    wide?.line ?? lines[0]?.line ?? 1,
    `scroller content is ${scroller.scrollWidth}px wide in a ${scroller.clientWidth}px scroller`,
  );
}

async function scrollThrough(view: EditorView, report: Report): Promise<void> {
  const scroller = view.scrollDOM;
  scroller.scrollTop = 0;
  // The step limit only guards against a scroller that never reaches its end.
  for (let step = 0; step < 1000; step++) {
    await settle(view);
    checkDrawnLines(view, report);
    checkOverflow(view, report);
    const top = scroller.scrollTop;
    if (top + scroller.clientHeight >= scroller.scrollHeight - 1) return;
    scroller.scrollTop = top + scroller.clientHeight;
    if (scroller.scrollTop === top) return;
  }
}

function lineHeights(view: EditorView): Map<number, number> {
  const heights = new Map<number, number>();
  for (const { dom, line } of drawnLines(view)) {
    heights.set(line, dom.getBoundingClientRect().height);
  }
  return heights;
}

async function compareHeights(
  view: EditorView,
  pos: number,
  what: string,
  act: () => unknown,
  report: Report,
): Promise<void> {
  view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: "center" }) });
  await settle(view);
  const before = lineHeights(view);
  await act();
  await settle(view);
  for (const [line, height] of lineHeights(view)) {
    const old = before.get(line);
    if (old !== undefined && Math.abs(height - old) > tolerance) {
      report(
        "jitter",
        line,
        `${what} changed the line's height from ${px(old)} to ${px(height)}`,
      );
    }
  }
}

async function checkJitter(view: EditorView, report: Report): Promise<void> {
  const { doc } = view.state;
  let plain = doc.line(1);
  for (let n = 1; n <= doc.lines; n++) {
    if (doc.line(n).text === emojiCjkLine) plain = doc.line(n);
  }
  // `**x**` goes at the end of the first list item, a short line that stays
  // one visual line long.
  let listItem = -1;
  ensureSyntaxTree(view.state, doc.length, 1000)?.iterate({
    enter(node) {
      if (listItem < 0 && node.name === "ListItem") listItem = node.from;
      return listItem < 0;
    },
  });
  const other = doc.lineAt(Math.max(listItem, 0)).number;

  await compareHeights(
    view,
    plain.from,
    "inserting `# `",
    () => view.dispatch({ changes: { from: plain.from, insert: "# " } }),
    report,
  );

  const end = view.state.doc.line(other).to;
  await compareHeights(
    view,
    end,
    "inserting `**x**`",
    () => view.dispatch({ changes: { from: end, insert: " **x**" } }),
    report,
  );

  await compareHeights(
    view,
    view.state.doc.line(other).from,
    "moving the cursor",
    async () => {
      const last = Math.min(other + 5, view.state.doc.lines);
      for (let n = other; n <= last; n++) {
        view.dispatch({ selection: { anchor: view.state.doc.line(n).from } });
        await nextFrame();
      }
    },
    report,
  );
}

// G-104's layout rules, checked on a hidden editor holding the layout
// fixture at the minimum window width. The window's own editor is never
// touched.
export async function checkLayout(): Promise<LayoutViolation[]> {
  const found = new Map<string, LayoutViolation>();
  const report: Report = (rule, line, detail) => {
    const key = `${rule}:${line}`;
    if (!found.has(key)) found.set(key, { rule, line, detail });
  };

  // CodeMirror only draws what is inside the window, so the editor stays on
  // screen and is hidden with visibility, which keeps its layout.
  const container = document.createElement("div");
  Object.assign(container.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "480px",
    height: "600px",
    visibility: "hidden",
    pointerEvents: "none",
  });
  document.body.append(container);
  let view: EditorView | undefined;
  try {
    view = new EditorView({
      state: newState(layoutFixture),
      parent: container,
    });
    await scrollThrough(view, report);
    await checkJitter(view, report);
  } finally {
    view?.destroy();
    container.remove();
  }
  return Array.from(found.values());
}
