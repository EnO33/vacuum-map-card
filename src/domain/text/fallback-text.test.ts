import { describe, expect, it } from "vitest";
import { fallbackText } from "./fallback-text";
import { MAX_TEXT_LENGTH } from "./limits";

describe("fallbackText", () => {
  it("keeps a short message as it is", () => {
    expect(fallbackText("Something odd")).toBe("Something odd");
  });

  it("cuts a long message to the cap", () => {
    expect(fallbackText("x".repeat(MAX_TEXT_LENGTH + 10))).toHaveLength(MAX_TEXT_LENGTH);
  });

  it("never splits a surrogate pair", () => {
    const message = `${"x".repeat(MAX_TEXT_LENGTH - 1)}😀tail`;
    const text = fallbackText(message);
    expect(text).toBe("x".repeat(MAX_TEXT_LENGTH - 1));
  });

  it("keeps a pair that fits exactly", () => {
    const message = `${"x".repeat(MAX_TEXT_LENGTH - 2)}😀tail`;
    expect(fallbackText(message)).toBe(`${"x".repeat(MAX_TEXT_LENGTH - 2)}😀`);
  });
});
