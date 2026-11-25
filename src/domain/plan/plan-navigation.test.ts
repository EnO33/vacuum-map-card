import { describe, expect, it } from "vitest";
import { pixelPlan, pixelSquare as square } from "../../../test/helpers/rooms-snapshot";
import { planNavigation, roomAtTap } from "./plan-navigation";

/** Half of a 44 px target. */
const HALF = 22;

describe("planNavigation", () => {
  // The left room's anchor sits 25 px below the right room's.
  const plan = pixelPlan([square("below", 0, 300, 100), square("right", 300, 0, 100), square("left", 0, 25, 100)]);
  const order = (height: number) => planNavigation(plan, { width: 600, height }).rooms.map((room) => room.regionId);

  it("lists the drawable rooms in reading order, with their anchors, plan and size", () => {
    const size = { width: 600, height: 600 };
    const navigation = planNavigation(plan, size);
    expect(navigation.rooms.map((room) => room.regionId)).toEqual(["left", "right", "below"]);
    expect(navigation.anchors).toEqual(
      navigation.rooms.map((room) => ({ id: room.regionId, point: room.shape.anchor.point })),
    );
    expect(navigation.plan).toBe(plan);
    expect(navigation.size).toBe(size);
  });

  it("reads anchors within 5 % of the picture's height as one row", () => {
    expect(order(520)).toEqual(["left", "right", "below"]);
    expect(order(480)).toEqual(["right", "left", "below"]);
  });
});

describe("roomAtTap", () => {
  // A large room with a 10 px room just past its right edge; a hall sharing a wall with a 10 px WC; a room drawn
  // inside another; two 10 px rooms 30 px apart.
  const navigation = planNavigation(
    pixelPlan([
      square("big", 0, 0, 400),
      square("edge", 402, 100, 10),
      square("hall", 0, 500, 300),
      square("wc", 300, 600, 10),
      square("outer", 500, 0, 300),
      square("inner", 550, 50, 100),
      square("one", 600, 600, 10),
      square("two", 630, 600, 10),
    ]),
    { width: 1000, height: 1000 },
  );

  it("takes the room under the point", () => {
    expect(roomAtTap(navigation, { x: 200, y: 200 }, HALF)).toBe("big");
    expect(roomAtTap(navigation, { x: 605, y: 605 }, HALF)).toBe("one");
  });

  it("takes the smallest room where shapes overlap", () => {
    expect(roomAtTap(navigation, { x: 600, y: 100 }, HALF)).toBe("inner");
    expect(roomAtTap(navigation, { x: 750, y: 250 }, HALF)).toBe("outer");
  });

  it("prefers a small room's target over the larger room under the point", () => {
    expect(roomAtTap(navigation, { x: 398, y: 105 }, HALF)).toBe("edge");
    expect(roomAtTap(navigation, { x: 290, y: 605 }, HALF)).toBe("wc");
    expect(roomAtTap(navigation, { x: 280, y: 605 }, HALF)).toBe("hall");
  });

  it("selects a small room from a tap within its target, outside its drawn shape", () => {
    expect(roomAtTap(navigation, { x: 425, y: 105 }, HALF)).toBe("edge");
    expect(roomAtTap(navigation, { x: 405, y: 85 }, HALF)).toBe("edge");
  });

  it("takes the nearest anchor when two targets hold the point", () => {
    expect(roomAtTap(navigation, { x: 618, y: 605 }, HALF)).toBe("one");
    expect(roomAtTap(navigation, { x: 622, y: 605 }, HALF)).toBe("two");
  });

  it("selects nothing past the target or on bare picture", () => {
    expect(roomAtTap(navigation, { x: 430, y: 105 }, HALF)).toBeUndefined();
    expect(roomAtTap(navigation, { x: 900, y: 900 }, HALF)).toBeUndefined();
  });
});
