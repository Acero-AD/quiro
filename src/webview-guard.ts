// Cancels the browser behaviours that leak through the webview: its context
// menu and WebView2's built-in shortcuts. Listeners run in the bubble phase,
// because CodeMirror ignores events that are already defaultPrevented, and
// they never stop an event, so the editor's own bindings still run.

const browserShortcuts = [
  // Reload
  "F5",
  "Ctrl+R",
  "Ctrl+Shift+R",
  "Ctrl+F5",
  "Shift+F5",
  // Print
  "Ctrl+P",
  // Find
  "Ctrl+F",
  "F3",
  "Shift+F3",
  "Ctrl+G",
  "Ctrl+Shift+G",
  // History
  "Alt+ArrowLeft",
  "Alt+ArrowRight",
  "BrowserBack",
  "BrowserForward",
  // Downloads, caret browsing, view source
  "Ctrl+J",
  "F7",
  "Ctrl+U",
  // Zoom; Ctrl+Plus usually comes with Shift held, as on a US layout
  "Ctrl+-",
  "Ctrl++",
  "Ctrl+Shift++",
  "Ctrl+=",
  "Ctrl+0",
];

const devtoolsShortcuts = [
  "F12",
  "Ctrl+Shift+I",
  "Ctrl+Shift+J",
  "Ctrl+Shift+C",
];

function shortcutName(event: KeyboardEvent): string {
  const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
  return [
    event.metaKey ? "Meta+" : "",
    event.ctrlKey ? "Ctrl+" : "",
    event.shiftKey ? "Shift+" : "",
    event.altKey ? "Alt+" : "",
    key,
  ].join("");
}

export function installWebviewGuard(options: { dev: boolean }): () => void {
  const cancelled = new Set(
    options.dev
      ? browserShortcuts
      : [...browserShortcuts, ...devtoolsShortcuts],
  );

  const onKeydown = (event: KeyboardEvent) => {
    if (event.isComposing || event.keyCode === 229 || event.key === "Escape") {
      return;
    }
    if (cancelled.has(shortcutName(event))) {
      event.preventDefault();
    }
  };
  const onContextmenu = (event: MouseEvent) => {
    event.preventDefault();
  };

  window.addEventListener("keydown", onKeydown);
  if (!options.dev) {
    window.addEventListener("contextmenu", onContextmenu);
  }

  return () => {
    window.removeEventListener("keydown", onKeydown);
    if (!options.dev) {
      window.removeEventListener("contextmenu", onContextmenu);
    }
  };
}
