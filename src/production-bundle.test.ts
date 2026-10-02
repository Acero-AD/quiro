// @vitest-environment node
import { build } from "vite";
import { afterEach, describe, expect, it, vi } from "vitest";

// Any dev tool added later hangs off window.quiroDev, so one name covers them
// all. The build loads vite.config.ts and keeps its output in memory.
describe("production bundle", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("contains no quiroDev", async () => {
    // Vitest sets NODE_ENV to "test", and Vite keeps a set NODE_ENV, which
    // would build with import.meta.env.DEV true. `npm run build` leaves it
    // unset, so Vite builds for production.
    vi.stubEnv("NODE_ENV", "production");

    const result = await build({
      build: { write: false },
      logLevel: "silent",
    });
    const outputs = Array.isArray(result) ? result : [result];
    const files = outputs.flatMap((output) =>
      "output" in output ? output.output : [],
    );
    const decoder = new TextDecoder();

    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text =
        file.type === "chunk"
          ? file.code
          : typeof file.source === "string"
            ? file.source
            : decoder.decode(file.source);
      expect(text, file.fileName).not.toContain("quiroDev");
    }
  }, 60_000);
});
