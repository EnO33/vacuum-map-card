import { describe, expect, it } from "vitest";
import { FakeHass } from "../../../test/fakes/fake-hass";
import { FakeRoomSource } from "../../../test/fakes/fake-room-source";
import { buildFloorModel } from "../floor-model/build-floor-model";
import type { RoomSource, SourceRobot } from "../ports/room-source";
import { type ItemRef, robotsForItem } from "../robots-for-item/robots-for-item";
import { onlyRobots } from "./only-robots";

const fixtureRobot = new FakeRoomSource().robots()[0];

function robot(vacuumEntityId: string): SourceRobot {
  if (fixtureRobot === undefined) throw new Error("the fixtures have no robot");
  return { ...fixtureRobot, vacuumEntityId };
}

function sourceOf(robots: () => readonly SourceRobot[], loaded = () => true): RoomSource {
  return { integration: "x", integrationName: "X", loaded, robots };
}

describe("onlyRobots", () => {
  it("gives the sources themselves when no robot is listed", () => {
    const sources = [new FakeRoomSource()];
    expect(onlyRobots(sources, undefined)).toBe(sources);
  });

  it("keeps only the listed robots, as the same objects, and every other member of the source", () => {
    const source = new FakeRoomSource();
    const [filtered] = onlyRobots([source], ["vacuum.robot_two", "vacuum.absent"]);
    expect(filtered?.robots().map((r) => r.vacuumEntityId)).toStrictEqual(["vacuum.robot_two"]);
    expect(filtered?.robots()[0]).toBe(source.robots()[1]);
    expect(filtered?.integration).toBe(source.integration);
    expect(filtered?.integrationName).toBe(source.integrationName);
    expect(filtered?.loaded()).toBe(true);
  });

  it("follows the source's loaded state", () => {
    let loaded = false;
    const [filtered] = onlyRobots(
      [
        sourceOf(
          () => [],
          () => loaded,
        ),
      ],
      ["vacuum.a"],
    );
    expect(filtered?.loaded()).toBe(false);
    loaded = true;
    expect(filtered?.loaded()).toBe(true);
  });

  it("gives the same list while the source gives the same list, and a new one when it changes", () => {
    let list: readonly SourceRobot[] = [robot("vacuum.a"), robot("vacuum.b")];
    const [filtered] = onlyRobots([sourceOf(() => list)], ["vacuum.b"]);
    const first = filtered?.robots();
    expect(filtered?.robots()).toBe(first);
    list = [robot("vacuum.b"), robot("vacuum.c")];
    expect(filtered?.robots()).not.toBe(first);
    expect(filtered?.robots().map((r) => r.vacuumEntityId)).toStrictEqual(["vacuum.b"]);
  });

  it("leaves a robot that is not listed out of the floor model and out of the robots offered for a room", () => {
    const hass = new FakeHass({ services: ["vacuum.clean_area"] });
    const item: ItemRef = { kind: "area", imageEntityId: "image.robot_one_floor_plan_mapa_q1w2e3", areaId: "library" };
    const offered = (sources: readonly RoomSource[]) =>
      robotsForItem(buildFloorModel(hass, sources), item, hass, sources).map((c) => c.vacuumEntityId);
    const all = [new FakeRoomSource()];
    expect(offered(all)).toStrictEqual(["vacuum.robot_one"]);

    const filtered = onlyRobots(all, ["vacuum.robot_two"]);
    expect(buildFloorModel(hass, filtered).robots.map((r) => r.vacuumEntityId)).toStrictEqual(["vacuum.robot_two"]);
    expect(offered(filtered)).toStrictEqual([]);
  });
});
