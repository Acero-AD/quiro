import { describe, expect, it } from "vitest";
import { markdownThemeSpec } from "./theme";

interface Rule {
  selector: string;
  declarations: [property: string, value: string][];
}

// style-mod accepts camelCase and kebab-case property names alike.
function kebab(property: string): string {
  return property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

const rules: Rule[] = [];
for (const [selector, style] of Object.entries(markdownThemeSpec)) {
  const declarations: Rule["declarations"] = [];
  for (const [property, value] of Object.entries(style)) {
    declarations.push([kebab(property), value]);
  }
  rules.push({ selector, declarations });
}

describe("Markdown theme", () => {
  it("takes every colour from an --md- custom property", () => {
    for (const { declarations } of rules) {
      for (const [property, value] of declarations) {
        if (property === "color" || property === "background-color") {
          expect(value.startsWith("var(--md-")).toBe(true);
        }
      }
    }
  });

  it("keeps headings at body size", () => {
    const headings = rules.filter(({ selector }) => selector.includes("md-h"));
    expect(headings.length).toBeGreaterThan(0);
    for (const { declarations } of headings) {
      for (const [property] of declarations) {
        expect(property).not.toBe("font-size");
      }
    }
  });

  it("only sets properties that keep the line height", () => {
    const allowed = [
      "color",
      "background-color",
      "font-weight",
      "font-style",
      "text-decoration",
      "font-family",
    ];
    const inlineCodePadding = ["padding-left", "padding-right"];
    for (const { selector, declarations } of rules) {
      for (const [property] of declarations) {
        if (property.startsWith("--md-")) continue;
        if (selector === ".md-code" && inlineCodePadding.includes(property)) {
          continue;
        }
        expect(allowed).toContain(property);
      }
    }
  });

  it("puts the list, task and quote marker colours last", () => {
    const selectors = rules.map(({ selector }) => selector);
    const shared = selectors.indexOf(".md-syntax-marker");
    expect(shared).toBeGreaterThanOrEqual(0);
    const markers = [
      ".md-list-marker",
      ".md-task-marker",
      ".md-quote.md-syntax-marker",
    ];
    for (const marker of markers) {
      expect(selectors.indexOf(marker)).toBeGreaterThan(shared);
    }
  });
});
