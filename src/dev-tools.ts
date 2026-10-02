import {
  checkLayout,
  type Editor,
  type LayoutViolation,
  startTypingProbe,
  type TypingProbe,
  type TypingStats,
} from "./editor";
import {
  DEFAULT_LARGE_DOCUMENT_SEED,
  generateLargeDocument,
} from "./large-document";

declare global {
  interface Window {
    quiroDev?: {
      checkLayout(): Promise<LayoutViolation[]>;
      loadLargeFixture(): Promise<number>;
      typingStats(): TypingStats | undefined;
    };
  }
}

let probe: TypingProbe | undefined;

// Dev builds only: main.ts imports this module behind import.meta.env.DEV,
// so the production bundle never contains it.
export function installDevTools(editor: Editor): void {
  window.quiroDev = {
    checkLayout,
    loadLargeFixture: () => loadLargeFixture(editor),
    typingStats,
  };
}

async function loadLargeFixture(editor: Editor): Promise<number> {
  const text = generateLargeDocument(DEFAULT_LARGE_DOCUMENT_SEED);
  const start = performance.now();
  editor.load(text);
  // A zero-delay timeout queued from the frame callback runs just after that
  // frame is painted.
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve, 0));
  });
  const elapsed = performance.now() - start;
  console.log(`load-to-first-paint: ${elapsed.toFixed(1)} ms`);

  // load() installs a new state, which drops the previous probe's listener.
  probe?.stop();
  probe = startTypingProbe(editor);
  return elapsed;
}

function typingStats(): TypingStats | undefined {
  if (!probe) {
    console.log("Run window.quiroDev.loadLargeFixture() first.");
    return undefined;
  }
  const stats = probe.read();
  console.table(stats);
  probe.reset();
  return stats;
}
