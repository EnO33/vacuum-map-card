// Test helper: Home Assistant's `window.loadCardHelpers`, set per test. Call `useCardHelpers()` once per test file.
import { afterEach } from "vitest";

/** Removes `window.loadCardHelpers` after each test. */
export function useCardHelpers(): void {
  afterEach(() => {
    Reflect.deleteProperty(window, "loadCardHelpers");
  });
}

/** Sets `window.loadCardHelpers` to `loader`, any value, as the dashboard panel would. */
export function setCardHelpers(loader: unknown): void {
  Object.defineProperty(window, "loadCardHelpers", { value: loader, configurable: true, writable: true });
}
