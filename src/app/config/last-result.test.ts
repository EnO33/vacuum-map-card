import { describe, expect, it } from "vitest";
import { lastResult } from "./last-result";

describe("lastResult", () => {
  it("calls again only when an argument is another object", () => {
    let calls = 0;
    const pair = lastResult((a: object, b: object | undefined) => {
      calls++;
      return { a, b };
    });
    const a = {};
    const b = {};
    const first = pair(a, b);
    expect(pair(a, b)).toBe(first);
    expect(calls).toBe(1);
    expect(pair(a, {})).not.toBe(first);
    expect(pair({}, b)).not.toBe(first);
    expect(pair(a, undefined)).toStrictEqual({ a, b: undefined });
    expect(calls).toBe(4);
  });
});
