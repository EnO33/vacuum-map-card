import { describe, expect, it } from "vitest";
import { jsonEqual } from "./json-equal";

describe("jsonEqual", () => {
  it.each<[string, unknown, unknown]>([
    ["equal primitives", "a", "a"],
    ["null and null", null, null],
    ["undefined and undefined", undefined, undefined],
    ["equal arrays", [1, "a", null], [1, "a", null]],
    ["equal nested objects, keys in another order", { a: [{ b: 1 }], c: "d" }, { c: "d", a: [{ b: 1 }] }],
  ])("is true for %s", (_, a, b) => {
    expect(jsonEqual(a, b)).toBe(true);
  });

  it.each<[string, unknown, unknown]>([
    ["different primitives", "a", "b"],
    ["null and an object", null, {}],
    ["an object and null", {}, null],
    ["an array and an object", [], {}],
    ["an object and an array", {}, []],
    ["arrays of different lengths", [1], [1, 2]],
    ["arrays with a different item", [1, 2], [1, 3]],
    ["objects with a missing key", { a: 1 }, { a: 1, b: 2 }],
    ["objects with another key", { a: 1 }, { b: 1 }],
    ["objects with a different nested value", { a: { b: 1 } }, { a: { b: 2 } }],
  ])("is false for %s", (_, a, b) => {
    expect(jsonEqual(a, b)).toBe(false);
  });

  it("never runs a getter", () => {
    let reads = 0;
    const accessor = Object.defineProperty({}, "a", {
      enumerable: true,
      get: () => {
        reads++;
        return 1;
      },
    });
    expect(jsonEqual(accessor, { a: 1 })).toBe(false);
    expect(reads).toBe(0);
  });
});
