import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installWebviewGuard } from "./webview-guard";

interface Key {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  isComposing?: boolean;
  keyCode?: number;
}

const listedKeys: [string, Key][] = [
  ["F5", { key: "F5" }],
  ["Ctrl+R", { key: "r", ctrlKey: true }],
  ["Ctrl+Shift+R", { key: "R", ctrlKey: true, shiftKey: true }],
  ["Ctrl+F5", { key: "F5", ctrlKey: true }],
  ["Shift+F5", { key: "F5", shiftKey: true }],
  ["Ctrl+P", { key: "p", ctrlKey: true }],
  ["Ctrl+F", { key: "f", ctrlKey: true }],
  ["F3", { key: "F3" }],
  ["Shift+F3", { key: "F3", shiftKey: true }],
  ["Ctrl+G", { key: "g", ctrlKey: true }],
  ["Ctrl+Shift+G", { key: "G", ctrlKey: true, shiftKey: true }],
  ["Alt+ArrowLeft", { key: "ArrowLeft", altKey: true }],
  ["Alt+ArrowRight", { key: "ArrowRight", altKey: true }],
  ["BrowserBack", { key: "BrowserBack" }],
  ["BrowserForward", { key: "BrowserForward" }],
  ["Ctrl+J", { key: "j", ctrlKey: true }],
  ["F7", { key: "F7" }],
  ["Ctrl+U", { key: "u", ctrlKey: true }],
  ["Ctrl+Minus", { key: "-", ctrlKey: true }],
  ["Ctrl+Plus", { key: "+", ctrlKey: true, shiftKey: true }],
  ["Ctrl+Plus on the keypad", { key: "+", ctrlKey: true }],
  ["Ctrl+=", { key: "=", ctrlKey: true }],
  ["Ctrl+0", { key: "0", ctrlKey: true }],
];

const devtoolsKeys: [string, Key][] = [
  ["F12", { key: "F12" }],
  ["Ctrl+Shift+I", { key: "I", ctrlKey: true, shiftKey: true }],
  ["Ctrl+Shift+J", { key: "J", ctrlKey: true, shiftKey: true }],
  ["Ctrl+Shift+C", { key: "C", ctrlKey: true, shiftKey: true }],
];

const editingKeys: [string, Key][] = [
  ["Ctrl+Z", { key: "z", ctrlKey: true }],
  ["Ctrl+Y", { key: "y", ctrlKey: true }],
  ["Ctrl+Shift+Z", { key: "Z", ctrlKey: true, shiftKey: true }],
  ["Ctrl+X", { key: "x", ctrlKey: true }],
  ["Ctrl+C", { key: "c", ctrlKey: true }],
  ["Ctrl+V", { key: "v", ctrlKey: true }],
  ["Ctrl+A", { key: "a", ctrlKey: true }],
  ["ArrowLeft", { key: "ArrowLeft" }],
  ["ArrowRight", { key: "ArrowRight" }],
  ["ArrowUp", { key: "ArrowUp" }],
  ["ArrowDown", { key: "ArrowDown" }],
  ["Home", { key: "Home" }],
  ["End", { key: "End" }],
  ["Esc", { key: "Escape" }],
];

let target: HTMLElement;
let uninstall: (() => void) | undefined;

function install(dev: boolean) {
  uninstall = installWebviewGuard({ dev });
}

function press(key: Key): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    ...key,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
}

function rightClick(): MouseEvent {
  const event = new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  target = document.createElement("div");
  document.body.append(target);
});

afterEach(() => {
  uninstall?.();
  uninstall = undefined;
  target.remove();
});

describe("webview guard", () => {
  it.each(listedKeys)("cancels %s in release", (_, key) => {
    install(false);
    expect(press(key).defaultPrevented).toBe(true);
  });

  it.each(listedKeys)("cancels %s in dev", (_, key) => {
    install(true);
    expect(press(key).defaultPrevented).toBe(true);
  });

  it.each(devtoolsKeys)("cancels %s in release", (_, key) => {
    install(false);
    expect(press(key).defaultPrevented).toBe(true);
  });

  it.each(devtoolsKeys)("leaves %s alone in dev", (_, key) => {
    install(true);
    expect(press(key).defaultPrevented).toBe(false);
  });

  it("runs after the element's own keydown handlers", () => {
    install(false);
    let seen: boolean | undefined;
    target.addEventListener("keydown", (event) => {
      seen = event.defaultPrevented;
    });
    const event = press({ key: "ArrowRight", altKey: true });
    expect(seen).toBe(false);
    expect(event.defaultPrevented).toBe(true);
  });

  it("leaves a listed key alone during composition", () => {
    install(false);
    expect(
      press({ key: "r", ctrlKey: true, isComposing: true }).defaultPrevented,
    ).toBe(false);
  });

  it("leaves a listed key alone with keyCode 229", () => {
    install(false);
    expect(press({ key: "F5", keyCode: 229 }).defaultPrevented).toBe(false);
  });

  it.each(editingKeys)("leaves %s alone", (_, key) => {
    install(false);
    expect(press(key).defaultPrevented).toBe(false);
  });

  it("cancels contextmenu in release", () => {
    install(false);
    expect(rightClick().defaultPrevented).toBe(true);
  });

  it("leaves contextmenu alone in dev", () => {
    install(true);
    expect(rightClick().defaultPrevented).toBe(false);
  });

  it.each([false, true])("cancels nothing once removed (dev: %s)", (dev) => {
    install(dev);
    uninstall?.();
    uninstall = undefined;
    for (const [, key] of [...listedKeys, ...devtoolsKeys]) {
      expect(press(key).defaultPrevented).toBe(false);
    }
    expect(rightClick().defaultPrevented).toBe(false);
  });
});
