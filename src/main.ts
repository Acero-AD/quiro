import { ping } from "./ping";

window.addEventListener("DOMContentLoaded", async () => {
  const replyEl = document.querySelector("#ping-reply");
  if (replyEl) {
    replyEl.textContent = await ping("hello");
  }
});
