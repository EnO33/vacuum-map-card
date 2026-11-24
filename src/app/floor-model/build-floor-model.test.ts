import { describe, expect, it } from "vitest";
import { FakeHass } from "../../../test/fakes/fake-hass";
import { FakeRoomSource } from "../../../test/fakes/fake-room-source";
import { buildFloorModel } from "./build-floor-model";
import type { Plan } from "./floor-model";

/** Each plan as `[robot, picture, floor or "none"]`, for short expectations. */
const where = (plans: readonly Plan[]) =>
  plans.map((p) => [p.robot, p.imageEntityId, p.placement.kind === "floor" ? p.placement.floorId : "none"]);

describe("buildFloorModel on the fixtures", () => {
  const model = buildFloorModel(new FakeHass(), [new FakeRoomSource()]);

  it("shows ground_floor then upper_floor, each with the vacuum robot's room list", () => {
    expect(
      model.floors.map((f) => ({
        floorId: f.floorId,
        name: f.name,
        image: f.plan.imageEntityId,
        content: f.plan.content,
      })),
    ).toEqual([
      {
        floorId: "ground_floor",
        name: "Ground floor",
        image: "image.robot_one_floor_plan_mapa_q1w2e3",
        content: {
          kind: "areas",
          items: [
            { areaId: "library", name: "Library" },
            { areaId: "workshop", name: "Workshop" },
          ],
        },
      },
      {
        floorId: "upper_floor",
        name: "Upper floor",
        image: "image.robot_one_floor_plan_mapb_z9x8c7",
        content: {
          kind: "areas",
          items: [
            { areaId: "music_room", name: "Music room" },
            { areaId: "studio", name: "Studio" },
          ],
        },
      },
    ]);
  });

  it("puts the two rooms maps and the mop robot's « Upper level » in « no floor », in order, with their notes", () => {
    expect(where(model.noFloor)).toEqual([
      ["vacuum.robot_one", "image.robot_one_rooms_map", "none"],
      ["vacuum.robot_two", "image.robot_two_floor_plan_mapd_r7t8y9", "none"],
      ["vacuum.robot_two", "image.robot_two_rooms_map", "none"],
    ]);
    expect(model.noFloor.map((p) => p.placement)).toEqual([
      { kind: "no_floor", reasons: ["cannot_tell_shown_map"] },
      { kind: "no_floor", reasons: ["assign_area_to_floor_plan", "add_floor_alias"] },
      { kind: "no_floor", reasons: ["cannot_tell_shown_map"] },
    ]);
  });

  it("draws the unpaired rooms maps' outlines, with no core link", () => {
    const [vacuumRoomsMap] = model.noFloor;
    if (vacuumRoomsMap?.content.kind !== "outlines") throw new Error("expected outlines");
    expect(vacuumRoomsMap.content.rooms.map((r) => [r.room.name, r.area])).toEqual([["Library", { kind: "none" }]]);
  });

  it("keeps the mop robot's « Ground floor » plan on ground_floor without showing it", () => {
    const mop = model.robots.find((r) => r.vacuumEntityId === "vacuum.robot_two");
    expect(mop?.action).toBe("mop");
    expect(mop?.hasCleanArea).toBe(false);
    expect(mop?.plans.map((p) => [p.imageEntityId, p.placement, p.content])).toContainEqual([
      "image.robot_two_floor_plan_mapc_k4l5m6",
      { kind: "floor", floorId: "ground_floor" },
      { kind: "picture_only", reason: "no_clean_area" },
    ]);
    expect(model.floors.map((f) => f.plan.robot)).toEqual(["vacuum.robot_one", "vacuum.robot_one"]);
  });

  it("keeps each robot's own rooms with their area link and floor", () => {
    const vacuum = model.robots.find((r) => r.vacuumEntityId === "vacuum.robot_one");
    expect(vacuum?.rooms).toEqual([
      {
        imageEntityId: "image.robot_one_rooms_map",
        regionId: "1",
        name: "Library",
        area: { kind: "none" },
        floorId: undefined,
      },
    ]);
    expect(vacuum?.roomsMapIssue).toBeUndefined();
  });

  it("is not loading once the registries are read", () => {
    expect(model.loading).toBe(false);
  });

  it("puts no map id, segment id or token in a note or reason", () => {
    const notes = JSON.stringify(
      model.robots.map((r) => [
        r.roomsMapIssue,
        r.plans.map((p) => [p.placement, p.content.kind === "picture_only" ? p.content.reason : p.content.kind]),
      ]),
    );
    expect(notes).not.toMatch(/Map[A-D]_|token|0{20}/);
  });
});
