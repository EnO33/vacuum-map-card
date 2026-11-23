import { describe, expect, it } from "vitest";
import { fixtures, pixelRoom } from "../../../test/helpers/pixel-rooms";
import { toSvgPath } from "./svg-path";

describe("toSvgPath", () => {
  it("draws a closed path with numbers rounded to 2 decimals", () => {
    expect(
      toSvgPath([
        { x: 1.005, y: 2 },
        { x: 1.23456, y: -0.004 },
        { x: 10, y: 20.5 },
      ]),
    ).toBe("M 1 2 L 1.23 0 L 10 20.5 Z");
  });

  it("never writes -0 or an exponent", () => {
    const path = toSvgPath([
      { x: -0, y: 1e-7 },
      { x: -0.001, y: 9_999_999.999 },
      { x: 1e-10, y: -1e7 },
    ]);
    expect(path).toBe("M 0 0 L 0 10000000 L 0 -10000000 Z");
    expect(path).not.toMatch(/e|-0\b/);
  });

  it("draws the fixture room as a whole, stable string", () => {
    expect(toSvgPath(pixelRoom(fixtures.mopPending, "1").outline)).toBe(
      "M 4 595 L 430 595 L 430 4 L 284.77 4 L 284.77 333.34 L 139.55 333.34 L 139.55 4 L 4 4 Z",
    );
  });

  it("returns an empty path for an empty outline", () => {
    expect(toSvgPath([])).toBe("");
  });
});
