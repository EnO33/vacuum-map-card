// Test helper: asserts that nothing is logged during each test of the file that calls it.
import { afterEach, beforeEach, expect, type MockInstance, vi } from "vitest";

const methods: ("log" | "info" | "warn" | "error" | "debug")[] = ["log", "info", "warn", "error", "debug"];

/** Spies on every `console` method before each test and asserts after it that none was called. */
export function expectNoConsoleOutput(): void {
  let spies: MockInstance[] = [];
  beforeEach(() => {
    spies = methods.map((method) => vi.spyOn(console, method));
  });
  afterEach(() => {
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    for (const spy of spies) spy.mockRestore();
  });
}
