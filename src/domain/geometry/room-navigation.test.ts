import { describe, expect, it } from "vitest";
import { type NavigationAnchor, nearestAnchorWithin, nextRoom, readingOrder } from "./room-navigation";

function ids(anchors: readonly NavigationAnchor[]): string[] {
  return anchors.map((a) => a.id);
}

function anchor(id: string, x: number, y: number): NavigationAnchor {
  return { id, point: { x, y } };
}

// a b c
// d e f
// g h i   (10 px apart, given out of order)
const grid = [
  anchor("i", 20, 20),
  anchor("e", 10, 10),
  anchor("a", 0, 0),
  anchor("f", 20, 10),
  anchor("c", 20, 0),
  anchor("g", 0, 20),
  anchor("b", 10, 0),
  anchor("h", 10, 20),
  anchor("d", 0, 10),
];

// k
// l m   (an L: nothing to the right of k)
const lShape = [anchor("k", 0, 0), anchor("l", 0, 10), anchor("m", 10, 10)];

describe("readingOrder", () => {
  it("reads a grid top to bottom, then left to right", () => {
    expect(ids(readingOrder(grid, 2))).toEqual(["a", "b", "c", "d", "e", "f", "g", "h", "i"]);
  });

  it("keeps anchors a little off level in one row, left to right", () => {
    const rooms = [anchor("right", 50, 0), anchor("left", 0, 4), anchor("below", 0, 20)];
    expect(ids(readingOrder(rooms, 5))).toEqual(["left", "right", "below"]);
  });

  it("starts a new row past the tolerance", () => {
    const rooms = [anchor("right", 50, 0), anchor("left", 0, 6)];
    expect(ids(readingOrder(rooms, 5))).toEqual(["right", "left"]);
  });

  it("measures the tolerance from the row's top anchor, so a slope does not chain into one row", () => {
    const rooms = [anchor("a", 30, 0), anchor("b", 20, 4), anchor("c", 10, 8)];
    expect(ids(readingOrder(rooms, 5))).toEqual(["b", "a", "c"]);
  });

  it("orders anchors at one point by id, in code units", () => {
    expect(ids(readingOrder([anchor("b", 5, 5), anchor("B", 5, 5), anchor("a", 5, 5)], 0))).toEqual(["B", "a", "b"]);
  });

  it("reads an L-shaped layout row by row", () => {
    expect(ids(readingOrder(lShape, 2))).toEqual(["k", "l", "m"]);
  });

  it("gives one room, or none", () => {
    expect(ids(readingOrder([anchor("only", 3, 3)], 2))).toEqual(["only"]);
    expect(ids(readingOrder([], 2))).toEqual([]);
  });
});

describe("nextRoom", () => {
  it.each([
    ["right", "f"],
    ["left", "d"],
    ["up", "b"],
    ["down", "h"],
  ] as const)("moves %s to the neighbour in a grid", (direction, expected) => {
    expect(nextRoom(grid, "e", direction)).toBe(expected);
  });

  it.each([
    ["c", "right"],
    ["a", "left"],
    ["b", "up"],
    ["h", "down"],
  ] as const)("finds nothing past the edge, from %s going %s", (from, direction) => {
    expect(nextRoom(grid, from, direction)).toBeUndefined();
  });

  it("follows an L-shaped layout", () => {
    expect(nextRoom(lShape, "k", "down")).toBe("l");
    expect(nextRoom(lShape, "l", "right")).toBe("m");
    expect(nextRoom(lShape, "m", "up")).toBe("k");
    expect(nextRoom(lShape, "k", "right")).toBe("m");
    expect(nextRoom(lShape, "m", "left")).toBe("l");
  });

  it("prefers a room in line over a nearer one off the arrow's axis", () => {
    const rooms = [anchor("from", 0, 0), anchor("off-axis", 10, 4), anchor("in-line", 14, 0)];
    expect(nextRoom(rooms, "from", "right")).toBe("in-line");
  });

  it("ignores a room level with the start on the arrow's axis", () => {
    const rooms = [anchor("from", 0, 0), anchor("above", 0, -10)];
    expect(nextRoom(rooms, "from", "right")).toBeUndefined();
  });

  it("breaks a tie by id, in code units", () => {
    const rooms = [anchor("from", 0, 0), anchor("b", 10, 2), anchor("a", 10, -2)];
    expect(nextRoom(rooms, "from", "right")).toBe("a");
    expect(nextRoom([...rooms].reverse(), "from", "right")).toBe("a");
  });

  it("finds nothing from a single room or an unknown one", () => {
    expect(nextRoom([anchor("only", 0, 0)], "only", "down")).toBeUndefined();
    expect(nextRoom(grid, "missing", "down")).toBeUndefined();
  });
});

describe("nearestAnchorWithin", () => {
  // Anchors 30 px apart; targets of 22 px each side overlap between them.
  const pair = [anchor("two", 35, 5), anchor("one", 5, 5)];

  it("finds the anchor whose target holds the point, on its edge too", () => {
    expect(nearestAnchorWithin(pair, { x: 5, y: 27 }, 22)).toBe("one");
    expect(nearestAnchorWithin(pair, { x: -17, y: -17 }, 22)).toBe("one");
  });

  it("takes the nearest anchor when two targets hold the point, then the smallest id", () => {
    expect(nearestAnchorWithin(pair, { x: 18, y: 5 }, 22)).toBe("one");
    expect(nearestAnchorWithin(pair, { x: 22, y: 5 }, 22)).toBe("two");
    expect(nearestAnchorWithin(pair, { x: 20, y: 5 }, 22)).toBe("one");
  });

  it("finds nothing outside every target", () => {
    expect(nearestAnchorWithin(pair, { x: 5, y: 28 }, 22)).toBeUndefined();
    expect(nearestAnchorWithin([], { x: 0, y: 0 }, 22)).toBeUndefined();
  });
});
