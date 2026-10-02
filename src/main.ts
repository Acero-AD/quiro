import { createEditor } from "./editor";
import { installWebviewGuard } from "./webview-guard";

installWebviewGuard({ dev: import.meta.env.DEV });

window.addEventListener("DOMContentLoaded", () => {
  const container = document.querySelector<HTMLElement>("#editor");
  if (container) {
    const editor = createEditor(container);
    editor.focus();

    // Vite replaces import.meta.env.DEV with false in production and drops
    // this branch, so the dev tools chunk is never emitted.
    if (import.meta.env.DEV) {
      import("./dev-tools").then(({ installDevTools }) =>
        installDevTools(editor),
      );
    }
  }
});
