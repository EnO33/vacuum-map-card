import { describe, expect, it } from "vitest";
import { FakeHass } from "../../../test/fakes/fake-hass";
import { FakeRoomSource } from "../../../test/fakes/fake-room-source";
import { withRobot } from "../../../test/helpers/sources";
import { fixtureMaps } from "../../../test/helpers/stored-maps";
import { buildFloorModel } from "../floor-model/build-floor-model";
import type { FloorModel, RobotModel, RobotRoom } from "../floor-model/floor-model";
import type { HassPort } from "../ports/hass-port";
import type { RoomSource } from "../ports/room-source";
import { type ItemRef, robotsForItem } from "./robots-for-item";

const MAP_A = "image.robot_one_floor_plan_mapa_q1w2e3";
const hass = new FakeHass({ services: ["vacuum.clean_area"] });
const sources: RoomSource[] = [new FakeRoomSource()];
const model = buildFloorModel(hass, sources);
const libraryItem: ItemRef = { kind: "area", imageEntityId: MAP_A, areaId: "library" };

/** The mop robot with both stored maps on ground_floor: its unpaired rooms map is then shown there. */
const mopOnGround = withRobot(new FakeRoomSource(), "vacuum.robot_two", (robot) => ({
  storedMaps: robot.storedMaps.map((m) => (m.mapId === "MapD_r7T8y9" ? { ...m, ownAreaId: "library" } : m)),
}));

/** A hass whose vacuum states are replaced, the rest as the fixtures. */
function withStates(states: ReadonlyMap<string, { state: string } | undefined>): HassPort {
  const patched = new FakeHass({ services: ["vacuum.clean_area"] });
  const fixture = patched.vacuum.bind(patched);
  patched.vacuum = (entityId) => {
    if (!states.has(entityId)) return fixture(entityId);
    const state = states.get(entityId);
    return state && { state: state.state, supportedFeatures: fixture(entityId)?.supportedFeatures ?? 0 };
  };
  return patched;
}

describe("robotsForItem on the fixtures", () => {
  it("lists only the vacuum robot for the area item library on ground_floor", () => {
    expect(robotsForItem(model, libraryItem, hass, sources)).toEqual([
      {
        vacuumEntityId: "vacuum.robot_one",
        action: "vacuum",
        state: "docked",
        choice: { kind: "path1", areaId: "library", roomNames: ["Library"] },
      },
    ]);
  });

  it("lists the mop robot first with its room action, then the vacuum robot through its own area item", () => {
    const onGround = buildFloorModel(hass, [mopOnGround]);
    const shown = onGround.floors.find((f) => f.floorId === "ground_floor")?.plan;
    expect(shown?.imageEntityId).toBe("image.robot_two_rooms_map");
    const item: ItemRef = { kind: "room", imageEntityId: "image.robot_two_rooms_map", regionId: "1" };
    expect(robotsForItem(onGround, item, hass, [mopOnGround])).toEqual([
      {
        vacuumEntityId: "vacuum.robot_two",
        action: "mop",
        state: "docked",
        choice: { kind: "path2", regionId: "1", ownRoomName: "Library" },
      },
      {
        vacuumEntityId: "vacuum.robot_one",
        action: "vacuum",
        state: "docked",
        choice: { kind: "path1", areaId: "library", roomNames: ["Library"] },
      },
    ]);
  });

  it.each([
    ["unavailable", { state: "unavailable" }],
    ["no_state", undefined],
  ])("lists a robot that is %s as not startable, never with a path", (reason, state) => {
    const candidates = robotsForItem(model, libraryItem, withStates(new Map([["vacuum.robot_one", state]])), sources);
    expect(candidates.map((c) => c.choice)).toEqual([{ kind: "not_startable", reasons: [reason] }]);
  });

  it("lists nothing for an item that is not on the plan", () => {
    expect(robotsForItem(model, { ...libraryItem, areaId: "studio" }, hass, sources)).toEqual([]);
    expect(robotsForItem(model, { ...libraryItem, imageEntityId: "image.unknown" }, hass, sources)).toEqual([]);
  });

  it("puts no map id or segment id in a reason", () => {
    const noService = new FakeHass();
    const text = JSON.stringify(robotsForItem(model, libraryItem, noService, sources));
    expect(text).toContain("service_missing");
    expect(text).not.toMatch(/Map[A-D]_/);
  });
});

describe("robotsForItem never lets a robot join through", () => {
  const onGround = buildFloorModel(hass, [mopOnGround]);
  const item: ItemRef = { kind: "room", imageEntityId: "image.robot_two_rooms_map", regionId: "1" };

  /** The vacuum robot as a joiner with only its rooms map and the given own room. */
  function joinerWith(room: Partial<RobotRoom>): FloorModel {
    const robots = onGround.robots.map((robot): RobotModel => {
      if (robot.vacuumEntityId !== "vacuum.robot_one") return robot;
      const plans = robot.plans.filter((p) => p.content.kind === "outlines");
      const own: RobotRoom = {
        imageEntityId: "image.robot_one_rooms_map",
        regionId: "1",
        name: "Library",
        roomId: "library",
        area: { kind: "name", areaId: "library" },
        floorId: "ground_floor",
        ...room,
      };
      return { ...robot, plans, rooms: [own] };
    });
    return { ...onGround, robots };
  }

  const listed = (m: FloorModel) => robotsForItem(m, item, hass, [mopOnGround]).map((c) => c.vacuumEntityId);

  it("a room on the same floor linked by name: it joins with its own room action", () => {
    expect(robotsForItem(joinerWith({}), item, hass, [mopOnGround])[1]).toMatchObject({
      vacuumEntityId: "vacuum.robot_one",
      choice: { kind: "path2", regionId: "1", ownRoomName: "Library" },
    });
  });

  it("a room on another floor linked by name", () => {
    expect(listed(joinerWith({ floorId: "upper_floor" }))).toEqual(["vacuum.robot_two"]);
  });

  it("a room in « no floor »", () => {
    expect(listed(joinerWith({ floorId: undefined }))).toEqual(["vacuum.robot_two"]);
  });

  it("another robot's region id: a joiner uses its own room, or does not join", () => {
    const foreign = joinerWith({ regionId: "9" });
    expect(robotsForItem(foreign, item, hass, [mopOnGround])[1]).toMatchObject({
      vacuumEntityId: "vacuum.robot_one",
      choice: { kind: "not_startable", reasons: ["shadow_check_impossible"] },
    });
  });

  it("a room linked to another area", () => {
    expect(listed(joinerWith({ area: { kind: "name", areaId: "workshop" } }))).toEqual(["vacuum.robot_two"]);
  });
});

describe("robotsForItem for a room of the plan's own robot", () => {
  const onGround = buildFloorModel(hass, [mopOnGround]);
  const item: ItemRef = { kind: "room", imageEntityId: "image.robot_two_rooms_map", regionId: "1" };

  it("is not startable when the robot is unavailable", () => {
    const unavailable = withStates(new Map([["vacuum.robot_two", { state: "unavailable" }]]));
    expect(robotsForItem(onGround, item, unavailable, [mopOnGround])[0]?.choice).toEqual({
      kind: "not_startable",
      reasons: ["unavailable"],
    });
  });

  it("is not startable with both paths' reasons when neither applies", () => {
    const noAction = withRobot(mopOnGround, "vacuum.robot_two", () => ({ roomAction: () => undefined }));
    expect(robotsForItem(onGround, item, hass, [noAction])[0]?.choice).toEqual({
      kind: "not_startable",
      reasons: ["no_clean_area", "no_room_action"],
    });
  });

  it("uses path 1 on a paired rooms map, through the robot's own core link", () => {
    const pairedHass = new FakeHass({
      services: ["vacuum.clean_area"],
      vacuumOptions: new Map([
        [
          "vacuum.robot_one",
          {
            kind: "options",
            areaMapping: { kind: "list", list: new Map([["library", ["MapA_q1W2e3_1"]]]) },
            lastSeenSegments: { kind: "list", list: [{ id: "MapA_q1W2e3_1", name: "Library" }] },
          },
        ],
      ]),
    });
    const paired = withRobot(new FakeRoomSource(), "vacuum.robot_one", (robot) => ({
      storedMaps: [fixtureMaps.mapA],
      roomsMap: robot.roomsMap && { ...robot.roomsMap, shownMapId: fixtureMaps.mapA.mapId },
    }));
    const pairedModel = buildFloorModel(pairedHass, [paired]);
    const room: ItemRef = { kind: "room", imageEntityId: "image.robot_one_rooms_map", regionId: "1" };
    expect(robotsForItem(pairedModel, room, pairedHass, [paired])[0]?.choice).toEqual({
      kind: "path1",
      areaId: "library",
      roomNames: ["Library"],
    });
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
