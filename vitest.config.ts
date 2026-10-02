// @ts-expect-error type error without @types/node package
import process from "node:process";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// Playwright's Chromium is installed inside node_modules. The harness gate
// clears the environment, so the browsers path is set here; Playwright reads
// it when the browser project starts.
process.env.PLAYWRIGHT_BROWSERS_PATH ??= "0";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.browser.test.ts"],
        },
      },
      {
        test: {
          name: "browser",
          include: ["src/**/*.browser.test.ts"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
