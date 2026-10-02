import { describe, expect, it } from "vitest";
import { checkLayout } from "./index";

describe("layout check", () => {
  it("finds no violation in the layout fixture", async () => {
    expect(await checkLayout()).toEqual([]);
  });

  it("reports a line-height violation for a larger heading", async () => {
    const style = document.createElement("style");
    style.textContent = ".md-heading-1 { font-size: 2em !important }";
    document.head.append(style);
    try {
      const violations = await checkLayout();

      expect(violations.map(({ rule }) => rule)).toContain("line-height");
    } finally {
      style.remove();
    }
  });

  it("removes its hidden editor", async () => {
    const before = document.body.childElementCount;

    await checkLayout();

    expect(document.body.childElementCount).toBe(before);
    expect(document.querySelector(".cm-editor")).toBeNull();
  });
});
