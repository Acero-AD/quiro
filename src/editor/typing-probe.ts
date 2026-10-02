import { syntaxTreeAvailable } from "@codemirror/language";
import { StateEffect } from "@codemirror/state";
import { EditorView, type ViewUpdate } from "@codemirror/view";
import type { Editor } from "./index";

// Dev-only: only src/dev-tools.ts imports the probe, so production
// tree-shakes it away (ADR 0001 allows this hook inside the editor module).

export interface SampleSummary {
  count: number;
  medianMs: number;
  p95Ms: number;
  maxMs: number;
}

export interface TypingStats extends SampleSummary {
  parseToEndMs: number | null;
}

export interface TypingProbe {
  read(): TypingStats;
  reset(): void;
  stop(): void;
}

const views = new WeakMap<Editor, EditorView>();

export function rememberView(editor: Editor, view: EditorView): void {
  views.set(editor, view);
}

export function summarizeSamples(samples: number[]): SampleSummary {
  const count = samples.length;
  if (count === 0) {
    return { count: 0, medianMs: 0, p95Ms: 0, maxMs: 0 };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const middle = Math.floor(count / 2);
  const medianMs =
    count % 2 === 1
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
  // Nearest rank: the smallest sample with at least 95% of samples at or below it.
  const p95Ms = sorted[Math.ceil(0.95 * count) - 1];
  return { count, medianMs, p95Ms, maxMs: sorted[count - 1] };
}

export function startTypingProbe(editor: Editor): TypingProbe {
  const view = views.get(editor);
  if (!view) {
    throw new Error("startTypingProbe: not an editor made by createEditor");
  }

  let samples: number[] = [];
  let keyTimeStamp: number | null = null;
  let jumpAt: number | null = null;
  let parsedAt: number | null = null;
  let stopped = false;

  // event.timeStamp is on the same clock as performance.now().
  const onKeydown = (event: KeyboardEvent) => {
    keyTimeStamp = event.timeStamp;
  };
  view.contentDOM.addEventListener("keydown", onKeydown, true);

  const onUpdate = (update: ViewUpdate) => {
    if (stopped) return;
    const now = performance.now();
    // Measured once the change is applied, before the next frame is drawn.
    if (update.docChanged && keyTimeStamp !== null) {
      samples.push(now - keyTimeStamp);
      keyTimeStamp = null;
    }
    const { state } = update;
    if (jumpAt === null) {
      const head = state.selection.main.head;
      if (state.doc.lineAt(head).number === state.doc.lines) {
        jumpAt = now;
      }
    }
    // The background parser dispatches an update as the tree grows.
    if (
      jumpAt !== null &&
      parsedAt === null &&
      syntaxTreeAvailable(state, state.doc.length)
    ) {
      parsedAt = now;
    }
  };
  view.dispatch({
    effects: StateEffect.appendConfig.of(
      EditorView.updateListener.of(onUpdate),
    ),
  });

  return {
    read() {
      return {
        ...summarizeSamples(samples),
        parseToEndMs:
          jumpAt !== null && parsedAt !== null ? parsedAt - jumpAt : null,
      };
    },
    reset() {
      samples = [];
      keyTimeStamp = null;
      jumpAt = null;
      parsedAt = null;
    },
    stop() {
      stopped = true;
      keyTimeStamp = null;
      view.contentDOM.removeEventListener("keydown", onKeydown, true);
    },
  };
}
