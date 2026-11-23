import { describe, expect, it } from "vitest";
import { toPoints } from "../../../test/helpers/pixel-rooms";
import { areaCentroid, polygonArea } from "./polygon";

const lShape = toPoints([
  [0, 0],
  [4, 0],
  [4, 1],
  [1, 1],
  [1, 3],
  [0, 3],
]);

describe("polygonArea", () => {
  it("measures a non-convex outline in either winding", () => {
    expect(polygonArea(lShape)).toBe(6);
    expect(polygonArea([...lShape].reverse())).toBe(6);
  });

  it("is 0 for a flat or empty outline", () => {
    expect(
      polygonArea(
        toPoints([
          [0, 0],
          [5, 0],
          [9, 0],
        ]),
      ),
    ).toBe(0);
    expect(polygonArea([])).toBe(0);
  });
});

describe("areaCentroid", () => {
  it("weights by area, not by vertex", () => {
    // Rectangles 4 × 1 (centre 2, 0.5) and 1 × 2 (centre 0.5, 2): ((2·4 + 0.5·2) / 6, (0.5·4 + 2·2) / 6).
    expect(areaCentroid(lShape)).toEqual({ x: 1.5, y: 1 });
  });

  it("is undefined for an outline without area", () => {
    expect(areaCentroid([])).toBeUndefined();
  });
});
