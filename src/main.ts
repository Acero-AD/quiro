import { createEditor } from "./editor";
import { installWebviewGuard } from "./webview-guard";

installWebviewGuard({ dev: import.meta.env.DEV });

window.addEventListener("DOMContentLoaded", () => {
  const container = document.querySelector<HTMLElement>("#editor");
  if (container) {
    createEditor(container).focus();
  }
});
