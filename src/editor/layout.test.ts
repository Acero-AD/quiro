import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorThemeSpec } from "./extensions";
import { createEditor, type Editor } from "./index";
import { layoutThemeSpec } from "./layout";
import { markdownThemeSpec } from "./theme";

type ThemeSpec = Record<string, Record<string, string>>;

// style-mod accepts camelCase and kebab-case property names alike.
function kebab(property: string): string {
  return property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function properties(spec: ThemeSpec): [selector: string, property: string][] {
  return Object.entries(spec).flatMap(([selector, style]) =>
    Object.keys(style).map((property): [string, string] => [
      selector,
      kebab(property),
    ]),
  );
}

// G-104: properties that can change a line's height.
function changesLineGeometry(property: string): boolean {
  const name = kebab(property);
  if (
    [
      "font-size",
      "line-height",
      "vertical-align",
      "padding",
      "margin",
      "border",
    ].includes(name)
  ) {
    return true;
  }
  return /^(padding|margin|border)-(top|bottom|block)(-|$)/.test(name);
}

const quiroThemeSpecs: Record<string, ThemeSpec> = {
  editor: editorThemeSpec,
  markdown: markdownThemeSpec,
  layout: layoutThemeSpec,
};

describe("editor layout", () => {
  let parent: HTMLElement;
  let editor: Editor | undefined;

  beforeEach(() => {
    parent = document.createElement("div");
    document.body.append(parent);
  });

  afterEach(() => {
    editor?.destroy();
    editor = undefined;
    parent.remove();
  });

  it("wraps long lines", () => {
    editor = createEditor(parent);

    const content = parent.querySelector(".cm-content");
    expect(content).not.toBeNull();
    expect(content?.classList.contains("cm-lineWrapping")).toBe(true);
  });

  it("recognises forbidden properties in camelCase and kebab-case", () => {
    const forbidden = [
      "fontSize",
      "line-height",
      "verticalAlign",
      "padding",
      "margin",
      "border",
      "paddingTop",
      "margin-bottom",
      "borderBlock",
      "padding-block-start",
      "marginBlockEnd",
      "border-top-width",
    ];
    for (const property of forbidden) {
      expect(changesLineGeometry(property), property).toBe(true);
    }
    const allowed = ["paddingLeft", "padding-right", "border-left", "color"];
    for (const property of allowed) {
      expect(changesLineGeometry(property), property).toBe(false);
    }
  });

  it("never lets an md-* rule change line geometry", () => {
    const specs = [markdownThemeSpec, layoutThemeSpec];
    const mdRules = specs
      .flatMap(properties)
      .filter(([selector]) => selector.includes(".md-"));
    expect(mdRules.length).toBeGreaterThan(0);
    for (const [selector, property] of mdRules) {
      expect(changesLineGeometry(property), `${selector} ${property}`).toBe(
        false,
      );
    }
  });

  it("sets font size and line height once, from custom properties", () => {
    expect(layoutThemeSpec["&"]).toMatchObject({
      "--editor-font-size": "16px",
      "--editor-line-height": "1.6",
    });
    const scroller = Object.fromEntries(
      Object.entries(layoutThemeSpec[".cm-scroller"]).map(
        ([property, value]) => [kebab(property), value],
      ),
    );
    expect(scroller["font-size"]).toBe("var(--editor-font-size)");
    expect(scroller["line-height"]).toBe("var(--editor-line-height)");

    const setters = Object.entries(quiroThemeSpecs).flatMap(([name, spec]) =>
      properties(spec)
        .filter(
          ([, property]) =>
            property === "font-size" || property === "line-height",
        )
        .map(([selector, property]) => `${name} ${selector} ${property}`),
    );
    expect(setters).toEqual([
      "layout .cm-scroller font-size",
      "layout .cm-scroller line-height",
    ]);
  });

  it("leaves the font family alone", () => {
    for (const [, property] of properties(layoutThemeSpec)) {
      expect(property).not.toBe("font-family");
    }
  });
});
