import { checkLayout, type LayoutViolation } from "./editor";

declare global {
  interface Window {
    quiroDev?: {
      checkLayout(): Promise<LayoutViolation[]>;
    };
  }
}

// Dev builds only: main.ts imports this module behind import.meta.env.DEV,
// so the production bundle never contains it.
export function installDevTools(): void {
  window.quiroDev = { checkLayout };
}
