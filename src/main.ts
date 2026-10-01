import { createEditor } from "./editor";

window.addEventListener("DOMContentLoaded", () => {
  const container = document.querySelector<HTMLElement>("#editor");
  if (container) {
    createEditor(container).focus();
  }
});
