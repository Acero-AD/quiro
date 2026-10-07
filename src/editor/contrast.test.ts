import { describe, expect, it } from "vitest";
import styles from "../styles.css?raw";
import { darkThemeSpec } from "./colour-scheme";

type Rgb = [number, number, number];

function hex(value: string): Rgb {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!match) throw new Error(`not a hex colour: ${value}`);
  const digits =
    match[1].length === 3
      ? Array.from(match[1], (digit) => digit + digit).join("")
      : match[1];
  return [0, 2, 4].map((i) =>
    Number.parseInt(digits.slice(i, i + 2), 16),
  ) as Rgb;
}

// WCAG 2 relative luminance and contrast ratio.
function luminance([r, g, b]: Rgb): number {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(hex(a)), luminance(hex(b))].sort(
    (x, y) => y - x,
  );
  return (light + 0.05) / (dark + 0.05);
}

// The page colours under prefers-color-scheme: dark, from src/styles.css.
function darkPage(): { background: string; text: string } {
  const start = styles.indexOf("prefers-color-scheme: dark");
  if (start < 0) throw new Error("no dark block in src/styles.css");
  const block = styles.slice(start);
  const background = /background-color:\s*(#[0-9a-f]+)/i.exec(block);
  const text = /(?:^|[\s;{])color:\s*(#[0-9a-f]+)/i.exec(block);
  if (!background || !text) throw new Error("no dark page colours");
  return { background: background[1], text: text[1] };
}

const page = darkPage();
const dark = darkThemeSpec["&"];
const bodyRatio = contrast(page.text, page.background);

describe("dark palette contrast", () => {
  it("reads the dark page colours", () => {
    expect(page.background).toMatch(/^#/);
    expect(page.text).toMatch(/^#/);
  });

  it.each([
    "--md-heading",
    "--md-link",
    "--md-quote",
    "--md-table",
    "--md-list-marker",
    "--md-task-marker",
    "--md-quote-marker",
  ])("gives %s at least 4.5:1", (name) => {
    expect(contrast(dark[name], page.background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["--md-syntax-marker", "--md-url", "--md-front-matter"])(
    "keeps %s between 3:1 and half the body text's ratio",
    (name) => {
      const ratio = contrast(dark[name], page.background);
      expect(ratio).toBeGreaterThanOrEqual(3);
      expect(ratio).toBeLessThanOrEqual(bodyRatio / 2);
    },
  );

  it("makes the selection visible and readable", () => {
    const selection = dark["--editor-selection"];
    expect(contrast(selection, page.background)).toBeGreaterThanOrEqual(1.5);
    expect(contrast(page.text, selection)).toBeGreaterThanOrEqual(4.5);
  });
});
