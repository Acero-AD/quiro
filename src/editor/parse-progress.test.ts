import { describe, expect, it } from "vitest";
import {
  DEFAULT_LARGE_DOCUMENT_SEED,
  generateLargeDocument,
} from "../large-document";
import { markdownMode } from "./language";

describe("background parsing", () => {
  // CodeMirror keeps a running parse's work up to the position the parser
  // reports. A nested parse reports 0 until its outer pass ends, so a
  // keystroke would discard everything parsed since the last finished parse.
  it("reports its progress as it parses", () => {
    const doc = generateLargeDocument(DEFAULT_LARGE_DOCUMENT_SEED);
    const parse = markdownMode().language.parser.startParse(doc);

    for (let step = 0; step < 1000; step++) parse.advance();
    const first = parse.parsedPos;
    expect(first).toBeGreaterThan(0);

    for (let step = 0; step < 1000; step++) parse.advance();
    expect(parse.parsedPos).toBeGreaterThan(first);
  });
});
