import { describe, expect, it } from "vitest";
import mopPending from "../../../test/fixtures/roomba-plus/hass_state_rooms_map_mop_pending.json" with { type: "json" };
import vacuumAligned from "../../../test/fixtures/roomba-plus/hass_state_rooms_map_vacuum_aligned.json" with {
  type: "json",
};
import threeRooms from "../../../test/fixtures/roomba-plus/synthetic/hass_state_rooms_map_three_rooms.json" with {
  type: "json",
};
import { applyTransform, linearDeterminant, solveCalibration } from "./affine";
import { MAX_ABS_COORDINATE } from "./limits";
import type { AffineTransform, CalibrationPair, Point } from "./types";

const pair = (vx: number, vy: number, mx: number, my: number): CalibrationPair => ({
  vacuum: { x: vx, y: vy },
  map: { x: mx, y: my },
});

const valid: readonly CalibrationPair[] = [pair(0, 0, 10, 590), pair(1000, 0, 60, 590), pair(0, 1000, 10, 540)];

function expectTransform(pairs: readonly CalibrationPair[]): AffineTransform {
  const result = solveCalibration(pairs);
  if (result.kind !== "transform") throw new Error(`expected a transform, got ${result.reason}`);
  return result.transform;
}

describe("solveCalibration", () => {
  it.each([
    ["vacuum robot, aligned", vacuumAligned],
    ["mop robot, pending", mopPending],
    ["three rooms, wider than tall", threeRooms],
  ])("maps every captured-shape calibration point within 1 px (%s)", (_name, fixture) => {
    const pairs = fixture.attributes.calibration_points;
    const transform = expectTransform(pairs);
    for (const { vacuum, map } of pairs) {
      const pixel = applyTransform(transform, vacuum);
      expect(Math.abs(pixel.x - map.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(pixel.y - map.y)).toBeLessThanOrEqual(1);
    }
  });

  it("gives a negative linear determinant when the picture flips y", () => {
    expect(linearDeterminant(expectTransform(vacuumAligned.attributes.calibration_points))).toBeLessThan(0);
  });

  it.each([
    [0, 1, 0],
    [1, 0, 1],
    [2, -1, 0],
    [3, 0, -1],
  ])("assumes no scale or picture size (%i quarter turns, 800 × 450 picture)", (_turns, cos, sin) => {
    // A known map: 0.05 px per mm, y flipped, turned clockwise, centred in a non-square picture.
    const truth = (p: Point): Point => {
      const sx = 0.05 * p.x;
      const sy = -0.05 * p.y;
      return { x: cos * sx - sin * sy + 400, y: sin * sx + cos * sy + 225 };
    };
    const pairs = [
      { x: 0, y: 0 },
      { x: 3000, y: 0 },
      { x: 0, y: 2000 },
    ].map((vacuum) => ({ vacuum, map: truth(vacuum) }));
    const probe = { x: 1234.5, y: -876.25 };
    const actual = applyTransform(expectTransform(pairs), probe);
    const expected = truth(probe);
    expect(actual.x).toBeCloseTo(expected.x, 9);
    expect(actual.y).toBeCloseTo(expected.y, 9);
  });

  it("solves a different scale on each axis (no similarity assumed)", () => {
    // 0.05 px per mm across, 0.03 px per mm down, quarter turn, y flipped.
    const truth = (p: Point): Point => ({ x: 0.03 * p.y + 100, y: 0.05 * p.x + 50 });
    const pairs = [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 0, y: 3000 },
    ].map((vacuum) => ({ vacuum, map: truth(vacuum) }));
    const probe = { x: -2500, y: 7000.5 };
    const actual = applyTransform(expectTransform(pairs), probe);
    expect(actual.x).toBeCloseTo(truth(probe).x, 9);
    expect(actual.y).toBeCloseTo(truth(probe).y, 9);
  });

  it.each([
    [
      "a vacuum triangle just above the tolerance",
      [pair(0, 0, 10, 590), pair(1000, 0, 60, 590), pair(2000, 4.1, 10, 540)],
    ],
    ["a tiny but well-shaped pixel triangle", [pair(0, 0, 0, 0), pair(1000, 0, 2, 0), pair(0, 1000, 0, 2)]],
  ])("accepts %s (the degeneracy test is relative, not absolute)", (_name, pairs) => {
    expect(solveCalibration(pairs).kind).toBe("transform");
  });

  it.each([
    ["two pairs", valid.slice(0, 2), "calibration_pair_count"],
    ["four pairs", [...valid, pair(5, 5, 5, 5)], "calibration_pair_count"],
    ["a NaN", [pair(Number.NaN, 0, 10, 590), ...valid.slice(1)], "non_finite"],
    ["an infinite pixel", [pair(0, 0, Number.POSITIVE_INFINITY, 590), ...valid.slice(1)], "non_finite"],
    ["a vacuum value above the limit", [pair(MAX_ABS_COORDINATE + 1, 0, 10, 590), ...valid.slice(1)], "out_of_range"],
    ["a pixel value above the limit", [pair(0, 0, 10, -(MAX_ABS_COORDINATE + 1)), ...valid.slice(1)], "out_of_range"],
    [
      "exactly collinear vacuum points",
      [pair(0, 0, 10, 590), pair(1000, 0, 60, 590), pair(2000, 0, 10, 540)],
      "vacuum_points_collinear",
    ],
    [
      "nearly collinear vacuum points",
      [pair(0, 0, 10, 590), pair(1000, 0, 60, 590), pair(2000, 0.5, 10, 540)],
      "vacuum_points_collinear",
    ],
    [
      "pixel points truncated to the same pixel",
      [pair(0, 0, 5, 5), pair(1000, 0, 5, 5), pair(0, 1000, 5, 5)],
      "map_points_collinear",
    ],
    [
      "nearly collinear pixel points",
      [pair(0, 0, 0, 0), pair(1000, 0, 500, 0), pair(0, 1000, 1000, 1)],
      "map_points_collinear",
    ],
    [
      "both triangles collinear (vacuum reported first)",
      [pair(0, 0, 5, 5), pair(1000, 0, 5, 5), pair(2000, 0, 5, 5)],
      "vacuum_points_collinear",
    ],
    [
      "an out-of-range pair before a NaN pair (non-finite reported first)",
      [pair(MAX_ABS_COORDINATE + 1, 0, 10, 590), pair(Number.NaN, 0, 60, 590), valid[2] ?? pair(0, 1000, 10, 540)],
      "non_finite",
    ],
  ])("refuses %s", (_name, pairs, reason) => {
    expect(solveCalibration(pairs)).toEqual({ kind: "unsupported", reason });
  });
});
