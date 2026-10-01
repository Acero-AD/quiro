import { describe, expect, it } from "vitest";
import {
  DEFAULT_LARGE_DOCUMENT_SEED,
  generateLargeDocument,
} from "./large-document";

describe("large document generator", () => {
  const text = generateLargeDocument(DEFAULT_LARGE_DOCUMENT_SEED);

  it("gives identical text for the same seed", () => {
    expect(generateLargeDocument(DEFAULT_LARGE_DOCUMENT_SEED)).toBe(text);
  });

  it("gives different text for different seeds", () => {
    expect(generateLargeDocument(DEFAULT_LARGE_DOCUMENT_SEED + 1)).not.toBe(
      text,
    );
  });

  it("has exactly 50,000 lines and between 4 and 6 MB", () => {
    expect(text.split("\n")).toHaveLength(50_000);
    expect(text.length).toBeGreaterThanOrEqual(4_000_000);
    expect(text.length).toBeLessThanOrEqual(6_000_000);
  });

  it("uses every construct of the dialect", () => {
    expect(text).toMatch(/^---\n(?:[^\n]*\n)*?---\n/);
    expect(text).toMatch(/^#{1,6} \S/m);
    expect(text).toContain("**");
    expect(text).toContain("~~");
    expect(text).toMatch(/^```[^\n]*\n(?:[^\n]*\n)*?```$/m);
    expect(text).toMatch(/^\|(?: *:?-+:? *\|)+$/m);
    expect(text).toMatch(/^- \[ \] /m);
    expect(text).toMatch(/^- \[x\] /m);
    expect(text).toMatch(/^> /m);
  });
});
