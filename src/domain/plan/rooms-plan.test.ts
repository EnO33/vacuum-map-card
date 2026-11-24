import { describe, expect, it } from "vitest";
import { pixelRoom, toPixel } from "../../../test/helpers/pixel-rooms";
import { snapshotFixtures, snapshotOf, squareOutline, squareRoom } from "../../../test/helpers/rooms-snapshot";
import { containsPoint } from "../geometry/hit-test";
import type { Point } from "../geometry/types";
import { MAX_TEXT_LENGTH } from "../text/limits";
import type { RoomsMapSnapshot, SnapshotRoom } from "./rooms-map-snapshot";
import { buildRoomsPlan, MAX_PLAN_ROOMS, type PlanRoom, type RoomsPlan, roomAt } from "./rooms-plan";

const { threeRooms, vacuumAligned, mopPending, withoutOutline, noCloud } = snapshotFixtures;
const threeRoomsCalibration = snapshotOf(threeRooms).calibration;

function planOf(snapshot: RoomsMapSnapshot): RoomsPlan {
  const result = buildRoomsPlan(snapshot);
  if (result.kind !== "plan") throw new Error(`expected a plan, got ${JSON.stringify(result)}`);
  return result;
}

function roomOf(plan: RoomsPlan, regionId: string): PlanRoom {
  const room = plan.rooms.get(regionId);
  if (!room) throw new Error(`no room ${regionId}`);
  return room;
}

function snapshotWith(rooms: readonly SnapshotRoom[]): RoomsMapSnapshot {
  return { state: "2026-01-01T09:30:00+00:00", calibration: threeRoomsCalibration, rooms };
}

const long = "x".repeat(MAX_TEXT_LENGTH + 1);

describe("buildRoomsPlan on the fixtures", () => {
  it.each([
    ["vacuum aligned", vacuumAligned, ["1"]],
    ["mop pending", mopPending, ["1"]],
    ["three rooms", threeRooms, ["1", "2", "3"]],
  ])("draws every room of the %s fixture, with its label anchor inside", (_, fixture, ids) => {
    const plan = planOf(snapshotOf(fixture));
    expect([...plan.rooms.keys()]).toEqual(ids);
    for (const id of ids) {
      const { shape } = roomOf(plan, id);
      if (shape.kind !== "drawable") throw new Error(`room ${id}: ${shape.reason}`);
      expect(shape.pixels).toEqual(pixelRoom(fixture, id).outline);
      expect(shape.path).toMatch(/^M [-\d. L]+ Z$/);
      expect(shape.anchor.distance).toBeGreaterThan(0);
      expect(containsPoint(shape.pixels, shape.anchor.point)).toBe(true);
    }
  });

  it("keeps the room's threeRoomsCalibration and a safe icon", () => {
    expect(roomOf(planOf(snapshotOf(mopPending)), "1")).toMatchObject({
      regionId: "1",
      name: "Library",
      roomId: "library",
      icon: "mdi:sofa",
    });
  });

  it("keeps a room without an outline, not drawable, while the others stay drawable", () => {
    const plan = planOf(snapshotOf(withoutOutline));
    expect(roomOf(plan, "2")).toMatchObject({ name: "Studio", shape: { kind: "unsupported", reason: "no_outline" } });
    expect(roomOf(plan, "1").shape.kind).toBe("drawable");
  });

  it("reports no outlines, not an error, when the cloud gave nothing", () => {
    expect(buildRoomsPlan(snapshotOf(noCloud))).toEqual({ kind: "no_outlines" });
  });

  it.each(Object.entries(snapshotFixtures))("leaks no token, picture URL or map id from the %s fixture", (_, f) => {
    const result = buildRoomsPlan(snapshotOf(f));
    const text = JSON.stringify(result, (_key, value: unknown) => (value instanceof Map ? [...value] : value));
    expect(text).not.toMatch(/token|image_proxy|\/api\/|0{20}/);
  });
});

describe("buildRoomsPlan limits", () => {
  it("accepts the largest plan and refuses one room more", () => {
    const rooms = Array.from({ length: MAX_PLAN_ROOMS + 1 }, (_, i) => squareRoom(String(i)));
    expect(planOf(snapshotWith(rooms.slice(0, MAX_PLAN_ROOMS))).rooms.size).toBe(MAX_PLAN_ROOMS);
    expect(buildRoomsPlan(snapshotWith(rooms))).toEqual({ kind: "unsupported", reason: "too_many_rooms" });
  });

  it("refuses two rooms with the same region id", () => {
    const result = buildRoomsPlan(snapshotWith([squareRoom("4"), { ...squareRoom("5"), regionId: "4" }]));
    expect(result).toEqual({ kind: "unsupported", reason: "duplicate_region_id" });
  });

  it.each(["regionId", "name", "roomId", "icon"] as const)("refuses the whole map when a %s is too long", (key) => {
    const rooms = [squareRoom("1"), { ...squareRoom("2"), [key]: long }];
    expect(buildRoomsPlan(snapshotWith(rooms))).toEqual({ kind: "unsupported", reason: "text_too_long" });
  });

  it("accepts strings exactly at the cap", () => {
    const atCap = "x".repeat(MAX_TEXT_LENGTH);
    const plan = planOf(snapshotWith([{ ...squareRoom("1"), regionId: atCap, name: atCap, roomId: atCap }]));
    expect(roomOf(plan, atCap).name).toBe(atCap);
  });

  it.each([
    ["two pairs", threeRoomsCalibration.slice(1), "calibration_pair_count"],
    [
      "collinear vacuum points",
      threeRoomsCalibration.map((p) => ({ ...p, vacuum: { x: p.vacuum.x, y: 0 } })),
      "vacuum_points_collinear",
    ],
    [
      "a non-finite value",
      threeRoomsCalibration.map((p) => ({ ...p, map: { ...p.map, x: Number.NaN } })),
      "non_finite",
    ],
  ])("refuses the whole map with the calibration's own reason: %s", (_, calibration, reason) => {
    expect(buildRoomsPlan({ ...snapshotWith([squareRoom("1")]), calibration })).toEqual({
      kind: "unsupported",
      reason,
    });
  });

  it("drops an unsafe icon without refusing the room", () => {
    const unsafe = { ...squareRoom("1"), icon: "mdi:sofa<script>" };
    const plan = planOf(snapshotWith([unsafe, { ...squareRoom("2"), icon: "mdi:sofa" }]));
    expect(roomOf(plan, "1").icon).toBeUndefined();
    expect(roomOf(plan, "2").icon).toBe("mdi:sofa");
  });

  const bad = (outline: readonly Point[]) => snapshotWith([{ ...squareRoom("1"), outline }, squareRoom("2")]);
  const square = squareOutline();

  it.each([
    ["too few points", square.slice(0, 2), "too_few_points"],
    ["too many points", Array.from({ length: 1001 }, (_, i) => ({ x: i, y: i % 2 })), "too_many_points"],
    ["a non-finite point", [...square.slice(1), { x: Number.POSITIVE_INFINITY, y: 0 }], "non_finite"],
    ["a point out of range", [...square.slice(1), { x: 2e7, y: 0 }], "out_of_range"],
  ])("keeps a room with %s, not drawable, with the outline's reason", (_, outline, reason) => {
    const plan = planOf(bad(outline));
    expect(roomOf(plan, "1").shape).toEqual({ kind: "unsupported", reason });
    expect(roomOf(plan, "2").shape.kind).toBe("drawable");
  });

  it("keeps a room whose pixels overflow, not drawable, with the transform's reason", () => {
    // A tiny calibration triangle (1 mm per pixel side, 1e4 pixel side) multiplies outline units by 1e4.
    const calibration = [
      { vacuum: { x: 0, y: 0 }, map: { x: 0, y: 0 } },
      { vacuum: { x: 1, y: 0 }, map: { x: 1e4, y: 0 } },
      { vacuum: { x: 0, y: 1 }, map: { x: 0, y: 1e4 } },
    ];
    const plan = planOf({ ...snapshotWith([squareRoom("1", 5000)]), calibration });
    expect(roomOf(plan, "1").shape).toEqual({ kind: "unsupported", reason: "out_of_range_result" });
  });
});

describe("rooms keyed by region id, never by a plain object", () => {
  const names = ["__proto__", "constructor", "toString", "hasOwnProperty"];
  const rooms = names.map((name) => ({ ...squareRoom(name), name }));

  it("keeps and finds rooms whose name and region id are object property names", () => {
    const plan = planOf(snapshotWith(rooms));
    expect(plan.rooms).toBeInstanceOf(Map);
    expect(plan.rooms.size).toBe(names.length);
    for (const name of names) expect(roomOf(plan, name)).toMatchObject({ regionId: name, name });
    expect(plan.rooms.get("valueOf")).toBeUndefined();
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
  });

  it("does not take an inherited property name for a duplicate region id", () => {
    expect(buildRoomsPlan(snapshotWith([squareRoom("constructor"), squareRoom("valueOf")])).kind).toBe("plan");
  });
});

describe("roomAt", () => {
  const plan = planOf(snapshotOf(threeRooms));

  it.each([
    ["Gallery", { x: 3000, y: 600 }, "1"],
    ["Studio", { x: 1400, y: 2850 }, "2"],
    ["the body of the Music corner", { x: 5000, y: 2000 }, "3"],
    ["the cut-out corner, outside every room", { x: 3500, y: 4000 }, undefined],
    ["outside the plan", { x: 7000, y: 600 }, undefined],
  ])("finds the room under a point in %s", (_, mm, expected) => {
    expect(roomAt(plan, toPixel(threeRooms, mm))).toBe(expected);
  });

  it("hit-tests exactly the drawable rooms", () => {
    const plan = planOf(snapshotOf(withoutOutline));
    const drawable = [...plan.rooms.values()].filter((room) => room.shape.kind === "drawable");
    expect(plan.hitRooms.map((room) => room.id)).toEqual(drawable.map((room) => room.regionId));
    expect(plan.hitRooms.map((room) => room.id)).toEqual(["1"]);
  });
});
