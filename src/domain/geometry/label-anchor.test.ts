import { describe, expect, it } from "vitest";
import { fixtures, pixelRoom, pixelRooms, toPoints } from "../../../test/helpers/pixel-rooms";
import { containsPoint } from "./hit-test";
import { LABEL_PRECISION_PX, type LabelAnchor, labelAnchor } from "./label-anchor";
import type { Point } from "./types";

const allRooms = [
  ...pixelRooms(fixtures.vacuumAligned),
  ...pixelRooms(fixtures.mopPending),
  ...pixelRooms(fixtures.threeRooms),
];

function expectStrictlyInside(outline: readonly Point[], anchor: LabelAnchor): void {
  expect(containsPoint(outline, anchor.point)).toBe(true);
  expect(anchor.distance).toBeGreaterThan(0);
}

describe("labelAnchor", () => {
  it.each(allRooms)("puts the anchor strictly inside fixture room %#", (room) => {
    expectStrictlyInside(room.outline, labelAnchor(room.outline));
  });

  it("stays inside the U-shaped room although its vertex mean is outside", () => {
    const room = pixelRoom(fixtures.mopPending, "1");
    expect(containsPoint(room.outline, room.vertexMean)).toBe(false);
    expectStrictlyInside(room.outline, labelAnchor(room.outline));
  });

  it("finds the pole of inaccessibility of a rectangle within the precision", () => {
    const anchor = labelAnchor(
      toPoints([
        [0, 0],
        [100, 0],
        [100, 40],
        [0, 40],
      ]),
    );
    expect(anchor.point.y).toBeCloseTo(20, 0);
    expect(anchor.distance).toBeGreaterThanOrEqual(20 - LABEL_PRECISION_PX);
  });

  it("finds an inside point in a thin room (3 px wide)", () => {
    const thin = toPoints([
      [0, 0],
      [300, 0],
      [300, 3],
      [0, 3],
    ]);
    const anchor = labelAnchor(thin);
    expectStrictlyInside(thin, anchor);
    expect(anchor.distance).toBeGreaterThan(1);
  });

  it.each([
    ["an empty outline", [], { point: { x: 0, y: 0 }, distance: 0 }],
    [
      "an outline reduced to one point",
      toPoints([
        [7, 8],
        [7, 8],
        [7, 8],
      ]),
      { point: { x: 7, y: 8 }, distance: 0 },
    ],
  ])("returns a zero-distance anchor for %s", (_name, outline, expected) => {
    expect(labelAnchor(outline)).toEqual(expected);
  });

  it("returns a zero-distance anchor on a flat outline (no area, no centroid)", () => {
    const flat = toPoints([
      [0, 0],
      [50, 0],
      [100, 0],
    ]);
    expect(labelAnchor(flat).distance).toBe(0);
  });

  it("finds an inside point in a very long, very thin room", () => {
    const sliver = toPoints([
      [0, 0],
      [1e7, 0],
      [1e7, 0.01],
      [0, 0.01],
    ]);
    expectStrictlyInside(sliver, labelAnchor(sliver));
  });

  it("finds an inside point in a thin, bent room (0.3 px high chevron) before pruning on precision", () => {
    // Pruning on precision while no inside point is known used to end here outside the room.
    const chevron = toPoints([
      [0, 0],
      [10, 20],
      [20, 0],
      [20, 0.3],
      [10, 20.3],
      [0, 0.3],
    ]);
    expectStrictlyInside(chevron, labelAnchor(chevron));
  });

  it("ends within the cell cap on a near-flat outline whose cells are below the precision of its coordinates", {
    timeout: 2000,
  }, () => {
    // Points 2 and 4 units in the last place apart at x = 1e6: accepted by validateOutline, yet a float-stepped
    // `x += size` grid (size = width / 64, below one unit in the last place) would never advance.
    const nearFlat = toPoints([
      [1e6, 500],
      [1e6 + 2 ** -32, 500],
      [1e6 + 2 ** -31, 500],
    ]);
    expect(labelAnchor(nearFlat).distance).toBeLessThanOrEqual(0);
  });
});
