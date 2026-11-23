import { describe, expect, it } from "vitest";
import { fixtures, mmOutline, pixelRoom, pixelRooms, toPixel, toPoints } from "../../../test/helpers/pixel-rooms";
import { containsPoint, roomAt } from "./hit-test";

const square = toPoints([
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
]);
// The fixtures' invented outlines, in mm (the test is unit-agnostic).
const aligned = mmOutline(fixtures.vacuumAligned, "Library");
const uShape = mmOutline(fixtures.mopPending, "Library");
const musicCorner = mmOutline(fixtures.threeRooms, "Music corner");
// Two squares touching at one vertex, drawn as one outline.
const bowTie = toPoints([
  [0, 0],
  [10, 0],
  [10, 10],
  [20, 10],
  [20, 20],
  [10, 20],
  [10, 10],
  [0, 10],
]);

describe("containsPoint", () => {
  it.each([
    ["inside a convex room", square, { x: 5, y: 5 }, true],
    ["outside a convex room", square, { x: 15, y: 5 }, false],
    ["on a vertical edge", square, { x: 10, y: 5 }, true],
    ["on a horizontal edge", square, { x: 5, y: 10 }, true],
    ["on a vertex", square, { x: 0, y: 0 }, true],
    ["level with an edge but outside it", square, { x: 15, y: 10 }, false],
    ["in the body of a non-convex room", aligned, { x: 0, y: 0 }, true],
    ["in the notch of a non-convex room", aligned, { x: -4000, y: 1800 }, false],
    ["in the cut-out corner of a non-convex room", aligned, { x: 0, y: 3000 }, false],
    ["in a leg of the U-shaped room", uShape, { x: -2800, y: 4000 }, true],
    ["in the notch of the U-shaped room", uShape, { x: -1325, y: 3425.1875 }, false],
    ["in the body of the synthetic non-convex room", musicCorner, { x: 5000, y: 2000 }, true],
    ["in the notch of the synthetic non-convex room", musicCorner, { x: 3500, y: 4000 }, false],
    ["in one half of a self-touching outline", bowTie, { x: 5, y: 5 }, true],
    ["in the other half of a self-touching outline", bowTie, { x: 15, y: 15 }, true],
    ["outside both halves of a self-touching outline", bowTie, { x: 15, y: 5 }, false],
    ["on the touching vertex", bowTie, { x: 10, y: 10 }, true],
    ["anywhere, for an empty outline", [], { x: 0, y: 0 }, false],
  ])("%s", (_name, outline, point, inside) => {
    expect(containsPoint(outline, point)).toBe(inside);
  });
});

describe("roomAt", () => {
  const rooms = pixelRooms(fixtures.threeRooms);

  it("finds the room under a point", () => {
    expect(roomAt(rooms, pixelRoom(fixtures.threeRooms, "2").vertexMean)).toBe("2");
  });

  it("returns nothing outside every room", () => {
    expect(roomAt(rooms, { x: -50, y: -50 })).toBeUndefined();
  });

  it("gives a shared edge to the smallest room", () => {
    // Gallery (1, 6000 × 1200 mm) and Studio (2, 2800 × 3300 mm) share the line y = 1200 mm; Gallery is smaller.
    const studio = pixelRoom(fixtures.threeRooms, "2");
    const edgePoint = pixelRoom(fixtures.threeRooms, "1").outline.find((p) =>
      studio.outline.some((q) => q.x === p.x && q.y === p.y),
    );
    expect(edgePoint && roomAt(rooms, edgePoint)).toBe("1");
  });

  it("decides a shared edge by area alone", () => {
    // Studio (2, 9.24 M mm²) and Music corner (3, 8.61 M mm²) share the line x = 2800 mm; only the area favours 3.
    expect(roomAt(rooms, toPixel(fixtures.threeRooms, { x: 2800, y: 2000 }))).toBe("3");
  });

  it("breaks an area tie by the smallest id in code-unit order", () => {
    const twin = [
      { id: "b", outline: square },
      { id: "B", outline: square },
      { id: "a", outline: square },
    ];
    expect(roomAt(twin, { x: 5, y: 5 })).toBe("B");
  });
});
