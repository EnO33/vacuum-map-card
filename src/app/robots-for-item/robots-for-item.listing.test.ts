import { describe, expect, it } from "vitest";
import { FakeHass } from "../../../test/fakes/fake-hass";
import { FakeRoomSource } from "../../../test/fakes/fake-room-source";
import { withStates } from "../../../test/helpers/clean-state";
import { withRobot } from "../../../test/helpers/sources";
import { buildFloorModel } from "../floor-model/build-floor-model";
import type { FloorModel, RobotModel, RobotRoom, RoomView } from "../floor-model/floor-model";
import type { RoomSource } from "../ports/room-source";
import { type ItemRef, robotsForItem } from "./robots-for-item";

const hass = new FakeHass({ services: ["vacuum.clean_area"] });

/** The mop robot with both stored maps on ground_floor: its unpaired rooms map is then shown there. */
const mopOnGround = withRobot(new FakeRoomSource(), "vacuum.robot_two", (robot) => ({
  storedMaps: robot.storedMaps.map((m) => (m.mapId === "MapD_r7T8y9" ? { ...m, ownAreaId: "library" } : m)),
}));

describe("robotsForItem listing rules", () => {
  const onGround = buildFloorModel(hass, [mopOnGround]);
  const item: ItemRef = { kind: "room", imageEntityId: "image.robot_two_rooms_map", regionId: "1" };

  it("orders joining robots by vacuum entity id in code-unit order", () => {
    const vacuum = onGround.robots.find((r) => r.vacuumEntityId === "vacuum.robot_one");
    if (!vacuum) throw new Error("the model has the vacuum robot");
    const early = { ...vacuum, vacuumEntityId: "vacuum.Robot_z" };
    const source: RoomSource = {
      integration: "roomba_plus",
      robots: () => [
        ...mopOnGround.robots(),
        ...mopOnGround
          .robots()
          .filter((r) => r.vacuumEntityId === "vacuum.robot_one")
          .map((r) => ({ ...r, vacuumEntityId: "vacuum.Robot_z" })),
      ],
    };
    const three = { ...onGround, robots: [...onGround.robots, early] };
    expect(robotsForItem(three, item, hass, [source]).map((c) => c.vacuumEntityId)).toEqual([
      "vacuum.robot_two",
      "vacuum.Robot_z",
      "vacuum.robot_one",
    ]);
  });

  it("lists only the plan's robot for a room linked to no area", () => {
    const unlinked = onGround.robots.map((robot): RobotModel => {
      if (robot.vacuumEntityId !== "vacuum.robot_two") return robot;
      const plans = robot.plans.map((plan) =>
        plan.content.kind === "outlines"
          ? {
              ...plan,
              content: {
                ...plan.content,
                rooms: plan.content.rooms.map((r): RoomView => ({ ...r, area: { kind: "none" } })),
              },
            }
          : plan,
      );
      return { ...robot, plans };
    });
    expect(
      robotsForItem({ ...onGround, robots: unlinked }, item, hass, [mopOnGround]).map((c) => c.vacuumEntityId),
    ).toEqual(["vacuum.robot_two"]);
  });

  it("sends nothing", () => {
    const recording = new FakeHass({ services: ["vacuum.clean_area"] });
    robotsForItem(onGround, item, recording, [mopOnGround]);
    expect(recording.calls).toEqual([]);
  });

  it("lists nothing when the plan's robot has no source robot", () => {
    const empty: RoomSource = { integration: "roomba_plus", robots: () => [] };
    expect(robotsForItem(onGround, item, hass, [empty])).toEqual([]);
  });

  it("never lists a vacuum reported by two sources", () => {
    expect(robotsForItem(onGround, item, hass, [mopOnGround, mopOnGround])).toEqual([]);
  });

  it("drops a joining robot that has no source robot", () => {
    const mopOnly: RoomSource = {
      integration: "roomba_plus",
      robots: () => mopOnGround.robots().filter((r) => r.vacuumEntityId === "vacuum.robot_two"),
    };
    expect(robotsForItem(onGround, item, hass, [mopOnly]).map((c) => c.vacuumEntityId)).toEqual(["vacuum.robot_two"]);
  });
});

describe("robotsForItem joining edge cases", () => {
  const onGround = buildFloorModel(hass, [mopOnGround]);
  const item: ItemRef = { kind: "room", imageEntityId: "image.robot_two_rooms_map", regionId: "1" };

  function joiner(change: (robot: RobotModel) => Partial<RobotModel>): FloorModel {
    const robots = onGround.robots.map((robot) =>
      robot.vacuumEntityId === "vacuum.robot_one" ? { ...robot, ...change(robot) } : robot,
    );
    return { ...onGround, robots };
  }

  const room: RobotRoom = {
    imageEntityId: "image.robot_one_rooms_map",
    regionId: "1",
    name: "Library",
    roomId: "library",
    area: { kind: "core", areaId: "library" },
    floorId: "upper_floor",
  };

  it("lists a core room on another floor with its path 1 reason (ADR 0005: a rule 1 link joins)", () => {
    const m = joiner((robot) => ({ plans: robot.plans.filter((p) => p.content.kind === "outlines"), rooms: [room] }));
    expect(robotsForItem(m, item, hass, [mopOnGround])[1]).toMatchObject({
      vacuumEntityId: "vacuum.robot_one",
      choice: { kind: "not_startable", reasons: ["no_core_area"] },
    });
  });

  it("refuses a same-floor room when the joiner has no rooms map to check names against", () => {
    const m = joiner(() => ({ plans: [], rooms: [{ ...room, floorId: "ground_floor" }] }));
    expect(robotsForItem(m, item, hass, [mopOnGround])[1]?.choice).toEqual({
      kind: "not_startable",
      reasons: ["no_core_area", "shadow_check_impossible"],
    });
  });

  it("lists a joiner that is unavailable as not startable", () => {
    const unavailable = withStates(new Map([["vacuum.robot_one", { state: "unavailable" }]]));
    expect(robotsForItem(onGround, item, unavailable, [mopOnGround])[1]?.choice).toEqual({
      kind: "not_startable",
      reasons: ["unavailable"],
    });
  });
});
