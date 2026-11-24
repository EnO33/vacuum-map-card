import { describe, expect, it } from "vitest";
import { FakeHass } from "../../../test/fakes/fake-hass";
import { FakeRoomSource } from "../../../test/fakes/fake-room-source";
import { withRobot } from "../../../test/helpers/sources";
import { fixtureMaps } from "../../../test/helpers/stored-maps";
import type { PictureState, StoredMap } from "../../domain/robot/stored-map";
import { type Unsupported, unsupported } from "../../domain/unsupported";
import { buildFloorModel } from "./build-floor-model";

describe("buildFloorModel variants", () => {
  it("pairs a robot with one stored map, links its rooms by the core mapping and places them on its floor", () => {
    const hass = new FakeHass({
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
    const source = new FakeRoomSource();
    const [vacuum] = source.robots();
    const roomsMap = vacuum?.roomsMap;
    if (!roomsMap) throw new Error("the fake's vacuum robot has a rooms map");
    const oneMap = withRobot(source, "vacuum.robot_one", () => ({
      storedMaps: [fixtureMaps.mapA],
      roomsMap: { ...roomsMap, shownMapId: fixtureMaps.mapA.mapId },
    }));
    const model = buildFloorModel(hass, [oneMap]);
    const ground = model.floors.find((f) => f.floorId === "ground_floor");
    expect(ground?.plan.imageEntityId).toBe("image.robot_one_rooms_map");
    if (ground?.plan.content.kind !== "outlines") throw new Error("expected outlines");
    expect(ground.plan.content.rooms.map((r) => r.area)).toEqual([{ kind: "core", areaId: "library" }]);
    expect(model.robots[0]?.rooms[0]?.floorId).toBe("ground_floor");
  });

  it("shows a paired robot's outlines before another robot's room list, whatever their ids", () => {
    const source = new FakeRoomSource();
    const mop = source.robots()[1];
    const roomsMap = mop?.roomsMap;
    if (!roomsMap) throw new Error("the fake's mop robot has a rooms map");
    const pairedMop = withRobot(source, "vacuum.robot_two", () => ({
      storedMaps: [fixtureMaps.mapC],
      roomsMap: { ...roomsMap, shownMapId: fixtureMaps.mapC.mapId },
    }));
    const model = buildFloorModel(new FakeHass(), [pairedMop]);
    const ground = model.floors.find((f) => f.floorId === "ground_floor");
    expect([ground?.plan.robot, ground?.plan.content.kind]).toEqual(["vacuum.robot_two", "outlines"]);
  });

  it("says « enable this floor plan » for a disabled plan with no floor", () => {
    const source = new FakeRoomSource();
    const mop = source.robots()[1];
    if (!mop) throw new Error("the fake has a mop robot");
    const disabled = withRobot(source, "vacuum.robot_two", () => ({
      storedMaps: mop.storedMaps.map(
        (m): StoredMap => (m.mapId === "MapD_r7T8y9" ? { ...m, pictureState: "disabled", mapName: undefined } : m),
      ),
    }));
    const plan = buildFloorModel(new FakeHass(), [disabled]).noFloor.find((p) =>
      p.imageEntityId.endsWith("mapd_r7t8y9"),
    );
    expect(plan).toMatchObject({
      pictureState: "disabled",
      placement: { kind: "no_floor", reasons: ["assign_area_to_floor_plan", "add_floor_alias", "enable_floor_plan"] },
    });
  });

  it("is loading before the floor list is read", () => {
    const model = buildFloorModel(new FakeHass({ floorsNotLoaded: true }), [new FakeRoomSource()]);
    expect(model.loading).toBe(true);
    expect(model.loadFailed).toBe(false);
  });

  it("tells a list that could not be fetched from one still loading", () => {
    const failed = buildFloorModel(new FakeHass({ floorsNotLoaded: true, fetchFailed: true }), [new FakeRoomSource()]);
    expect(failed).toMatchObject({ loading: true, loadFailed: true });
    expect(buildFloorModel(new FakeHass(), [new FakeRoomSource()]).loadFailed).toBe(false);
  });

  it("is never loadFailed once loaded", () => {
    expect(buildFloorModel(new FakeHass({ fetchFailed: true }), [new FakeRoomSource()])).toMatchObject({
      loading: false,
      loadFailed: false,
    });
  });

  it("is loading before a robot's vacuum options are read", () => {
    const hass = new FakeHass({ vacuumOptions: new Map([["vacuum.robot_one", unsupported("not_loaded")]]) });
    expect(buildFloorModel(hass, [new FakeRoomSource()]).loading).toBe(true);
  });

  it("is loading before a source has read its robots, so « no robot » is never shown early", () => {
    const source = new FakeRoomSource();
    const notRead = {
      integration: source.integration,
      integrationName: source.integrationName,
      robots: () => [],
      loaded: () => false,
    };
    const model = buildFloorModel(new FakeHass(), [notRead]);
    expect(model.loading).toBe(true);
    expect(buildFloorModel(new FakeHass(), [{ ...notRead, loaded: () => true }]).loading).toBe(false);
  });

  it("keeps a disabled floor plan as a plan with its state", () => {
    const model = buildFloorModel(new FakeHass(), [new FakeRoomSource({ disabledFloorPlans: true })]);
    const plans = model.robots.flatMap((r) => r.plans);
    expect(plans.find((p) => p.imageEntityId === "image.robot_one_floor_plan_mapb_z9x8c7")).toMatchObject({
      pictureState: "disabled",
      placement: { kind: "floor", floorId: "upper_floor" },
    });
  });

  it.each<PictureState>(["unavailable", "unknown"])("keeps an %s picture with its state", (pictureState) => {
    const source = new FakeRoomSource();
    const mop = source.robots()[1];
    if (!mop) throw new Error("the fake has a mop robot");
    const changed = withRobot(source, "vacuum.robot_two", () => ({
      storedMaps: mop.storedMaps.map((m) => (m.mapId === "MapD_r7T8y9" ? { ...m, pictureState } : m)),
    }));
    const model = buildFloorModel(new FakeHass(), [changed]);
    expect(model.noFloor.find((p) => p.imageEntityId === "image.robot_two_floor_plan_mapd_r7t8y9")?.pictureState).toBe(
      pictureState,
    );
  });

  it("adds no plan for a rooms map without outlines, and keeps the reason on the robot", () => {
    const source = withRobot(new FakeRoomSource(), "vacuum.robot_two", () => ({
      roomsMap: {
        imageEntityId: "image.robot_two_rooms_map",
        pictureState: "available",
        shownMapId: undefined,
        content: { kind: "no_outlines" },
      },
    }));
    const model = buildFloorModel(new FakeHass(), [source]);
    const mop = model.robots.find((r) => r.vacuumEntityId === "vacuum.robot_two");
    expect(mop?.roomsMapIssue).toEqual({ kind: "no_outlines" });
    expect(mop?.plans.map((p) => p.imageEntityId)).not.toContain("image.robot_two_rooms_map");
  });

  it("reads a malformed list as unreadable: the vacuum robot's stored maps show their picture only", () => {
    const malformed: Unsupported<"malformed"> = { kind: "unsupported", reason: "malformed" };
    const hass = new FakeHass({
      vacuumOptions: new Map([
        ["vacuum.robot_one", { kind: "options", areaMapping: malformed, lastSeenSegments: malformed }],
      ]),
    });
    const vacuum = buildFloorModel(hass, [new FakeRoomSource()]).robots[0];
    expect(vacuum?.plans.slice(1).map((p) => p.content)).toEqual([
      { kind: "picture_only", reason: "mapping_unsupported" },
      { kind: "picture_only", reason: "mapping_unsupported" },
    ]);
  });

  it("treats a robot without a state as without CLEAN_AREA", () => {
    const source = withRobot(new FakeRoomSource(), "vacuum.robot_one", () => ({ vacuumEntityId: "vacuum.robot_gone" }));
    const gone = buildFloorModel(new FakeHass(), [source]).robots.find((r) => r.vacuumEntityId === "vacuum.robot_gone");
    expect(gone?.hasCleanArea).toBe(false);
    expect(gone?.hasState).toBe(false);
  });

  it("keeps a refused rooms plan's reason on the robot", () => {
    const source = new FakeRoomSource();
    const [vacuum] = source.robots();
    const roomsMap = vacuum?.roomsMap;
    if (roomsMap?.content.kind !== "snapshot") throw new Error("expected a snapshot");
    const snapshot = { ...roomsMap.content.snapshot, calibration: [] };
    const refused = withRobot(source, "vacuum.robot_one", () => ({
      roomsMap: { ...roomsMap, content: { kind: "snapshot", snapshot } },
    }));
    const model = buildFloorModel(new FakeHass(), [refused]);
    expect(model.robots[0]?.roomsMapIssue).toEqual({ kind: "unsupported", reason: "calibration_pair_count" });
  });

  it("adds no plan for an absent rooms map", () => {
    const source = withRobot(new FakeRoomSource(), "vacuum.robot_two", () => ({ roomsMap: undefined }));
    const mop = buildFloorModel(new FakeHass(), [source]).robots.find((r) => r.vacuumEntityId === "vacuum.robot_two");
    expect(mop?.roomsMapIssue).toEqual({ kind: "absent" });
  });
});
