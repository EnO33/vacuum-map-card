import { describe, expect, it } from "vitest";
import { forEachEdge } from "./edges";
import type { Point } from "./types";

const collect = (outline: readonly Point[]): Point[][] => {
  const seen: Point[][] = [];
  forEachEdge(outline, (a, b) => seen.push([a, b]));
  return seen;
};

describe("forEachEdge", () => {
  it("closes the outline back to its first point", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 1, y: 0 };
    const c = { x: 0, y: 1 };
    expect(collect([a, b, c])).toEqual([
      [c, a],
      [a, b],
      [b, c],
    ]);
  });

  it("visits nothing for an empty outline", () => {
    expect(collect([])).toEqual([]);
  });
});
