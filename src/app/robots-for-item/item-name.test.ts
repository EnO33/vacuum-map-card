import { describe, expect, it } from "vitest";
import { FakeHass } from "../../../test/fakes/fake-hass";
import { FakeRoomSource } from "../../../test/fakes/fake-room-source";
import { buildFloorModel } from "../floor-model/build-floor-model";
import { itemName } from "./robots-for-item";

const MAP_A = "image.robot_one_floor_plan_mapa_q1w2e3";
const ROOMS_MAP = "image.robot_one_rooms_map";
const model = buildFloorModel(new FakeHass({ services: ["vacuum.clean_area"] }), [new FakeRoomSource()]);

function firstRoomName(): { regionId: string; name: string } {
  const plan = model.robots.flatMap((r) => r.plans).find((p) => p.imageEntityId === ROOMS_MAP);
  const view = plan?.content.kind === "outlines" ? plan.content.rooms[0] : undefined;
  if (!view) throw new Error("the fixture has a rooms map with rooms");
  return { regionId: view.room.regionId, name: view.room.name };
}

describe("itemName", () => {
  it("names an area item of a room list", () => {
    expect(itemName(model, { kind: "area", imageEntityId: MAP_A, areaId: "library" })).toBe("Library");
  });

  it("names a room of a rooms map", () => {
    const { regionId, name } = firstRoomName();
    expect(itemName(model, { kind: "room", imageEntityId: ROOMS_MAP, regionId })).toBe(name);
  });

  it.each([
    ["an unknown plan", { kind: "area", imageEntityId: "image.none", areaId: "library" }],
    ["an unknown area", { kind: "area", imageEntityId: MAP_A, areaId: "attic" }],
    ["a room on a room list", { kind: "room", imageEntityId: MAP_A, regionId: "1" }],
    ["an area on a rooms map", { kind: "area", imageEntityId: ROOMS_MAP, areaId: "library" }],
    ["an unknown room", { kind: "room", imageEntityId: ROOMS_MAP, regionId: "no-such-region" }],
  ] as const)("has no name for %s", (_case, item) => {
    expect(itemName(model, item)).toBeUndefined();
  });
});
