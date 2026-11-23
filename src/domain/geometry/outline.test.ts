import { describe, expect, it } from "vitest";
import vacuumAligned from "../../../test/fixtures/roomba-plus/hass_state_rooms_map_vacuum_aligned.json" with {
  type: "json",
};
import { MAX_ABS_COORDINATE, MAX_OUTLINE_POINTS, MIN_OUTLINE_POINTS } from "./limits";
import { toPixels, validateOutline } from "./outline";
import type { AffineTransform, Outline, Point } from "./types";

const square: readonly Point[] = [
  { x: 0, y: 0 },
  { x: 1000, y: 0 },
  { x: 1000, y: 1000 },
  { x: 0, y: 1000 },
];

const points = (n: number): Point[] => Array.from({ length: n }, (_, i) => ({ x: i, y: i % 2 }));

const identity: AffineTransform = { a: 1, b: 0, c: 0, d: 0, e: 1, f: 0 };

function outline(input: readonly Point[]): Outline {
  const result = validateOutline(input);
  if (result.kind !== "outline") throw new Error(`expected an outline, got ${result.reason}`);
  return result.outline;
}

describe("validateOutline", () => {
  it.each([MIN_OUTLINE_POINTS, MAX_OUTLINE_POINTS])("accepts %i points", (n) => {
    expect(validateOutline(points(n)).kind).toBe("outline");
  });

  it.each([
    ["too_few_points", points(MIN_OUTLINE_POINTS - 1)],
    ["too_many_points", points(MAX_OUTLINE_POINTS + 1)],
    ["non_finite", [...square.slice(0, 3), { x: Number.NaN, y: 0 }]],
    ["non_finite", [...square.slice(0, 3), { x: 0, y: Number.NEGATIVE_INFINITY }]],
    ["out_of_range", [...square.slice(0, 3), { x: 0, y: -(MAX_ABS_COORDINATE + 1) }]],
    ["non_finite", [{ x: MAX_ABS_COORDINATE + 1, y: 0 }, ...square.slice(1, 3), { x: Number.NaN, y: 0 }]],
  ])("refuses an outline: %s", (reason, input) => {
    expect(validateOutline(input)).toEqual({ kind: "unsupported", reason });
  });

  it("accepts values exactly at the limit and keeps the points", () => {
    const edge = [
      { x: -MAX_ABS_COORDINATE, y: 0 },
      { x: MAX_ABS_COORDINATE, y: 0 },
      { x: 0, y: MAX_ABS_COORDINATE },
    ];
    expect(validateOutline(edge)).toEqual({ kind: "outline", outline: edge });
  });

  it("returns a frozen copy, so later changes to the input cannot break the checks", () => {
    const input = [...square];
    const validated = outline(input);
    input.push({ x: Number.NaN, y: 0 });
    expect(validated).toHaveLength(4);
    expect(Object.isFrozen(validated)).toBe(true);
  });

  it("accepts the captured-shape room outline", () => {
    const room = vacuumAligned.attributes.rooms.Library;
    expect(validateOutline(room.outline.map(([x, y]) => ({ x: x ?? Number.NaN, y: y ?? Number.NaN }))).kind).toBe(
      "outline",
    );
  });
});

describe("toPixels", () => {
  it("maps every outline point through the transform", () => {
    const shift: AffineTransform = { a: 2, b: 0, c: 5, d: 0, e: -1, f: 600 };
    expect(toPixels(shift, outline(square.slice(0, 3)))).toEqual({
      kind: "pixels",
      points: [
        { x: 5, y: 600 },
        { x: 2005, y: 600 },
        { x: 2005, y: -400 },
      ],
    });
  });

  it("keeps finite results for values at the limit", () => {
    const input = [
      { x: MAX_ABS_COORDINATE, y: -MAX_ABS_COORDINATE },
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ];
    expect(toPixels(identity, outline(input))).toEqual({ kind: "pixels", points: input });
  });

  it("refuses pixels beyond the coordinate limit (a tiny calibration triangle gives a huge scale)", () => {
    const zoom: AffineTransform = { ...identity, a: 1e3 };
    expect(toPixels(zoom, outline([{ x: MAX_ABS_COORDINATE, y: 0 }, ...square.slice(1)]))).toEqual({
      kind: "unsupported",
      reason: "out_of_range_result",
    });
  });

  it("refuses a result that overflows to Infinity", () => {
    const huge: AffineTransform = { ...identity, a: 1e305 };
    expect(toPixels(huge, outline([{ x: MAX_ABS_COORDINATE, y: 0 }, ...square.slice(1)]))).toEqual({
      kind: "unsupported",
      reason: "non_finite_result",
    });
  });
});
