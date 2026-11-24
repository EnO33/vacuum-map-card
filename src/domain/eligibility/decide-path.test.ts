import { describe, expect, it, vi } from "vitest";
import { FakeRoomSource } from "../../../test/fakes/fake-room-source";
import { areaMappingOf, knownAreaIds, lastSeenOf, mappingFixtures } from "../../../test/helpers/area-mapping";
import { snapshotFixtures, snapshotOf } from "../../../test/helpers/rooms-snapshot";
import { mapOfSegmentIn, segmentIdIn } from "../../../test/helpers/stored-maps";
import { readAreaMapping } from "../mapping/area-mapping";
import { readLastSeen } from "../mapping/last-seen";
import { type DecideRoomContext, decideAreaItemPath, decideRoomPath } from "./decide-path";
import type { PathOneContext } from "./path-one";
import { shadowIndexOf } from "./path-two";

const [vacuumRobot, mopRobot] = new FakeRoomSource().robots();
if (!vacuumRobot || !mopRobot) throw new Error("the fake has two robots");

const rooms = (fixture: keyof typeof snapshotFixtures) =>
  new Map(snapshotOf(snapshotFixtures[fixture]).rooms.map((room) => [room.regionId, room]));

/** The vacuum robot as captured: CLEAN_AREA, its mapping, two stored maps, so its rooms map is not paired. */
const vacuumPathOne: PathOneContext = {
  hasCleanArea: true,
  hasCleanAreaService: true,
  mapping: readAreaMapping(areaMappingOf(mappingFixtures.vacuum), knownAreaIds),
  lastSeen: readLastSeen(lastSeenOf(mappingFixtures.vacuum)),
  mapOfSegment: (segmentId) => vacuumRobot.mapOfSegment(segmentId),
  segmentsChangedOpen: false,
  pairedRooms: undefined,
};

const vacuumContext: DecideRoomContext = {
  vacuum: { state: "docked" },
  pathOne: vacuumPathOne,
  shadows: shadowIndexOf(rooms("vacuumAligned"), vacuumPathOne.lastSeen),
};

const library = rooms("vacuumAligned").get("1") ?? { regionId: "", name: "", roomId: "" };

describe("decideRoomPath on the fixtures", () => {
  it("gives the vacuum robot's « Library » on its unpaired rooms map the room action", () => {
    expect(decideRoomPath(vacuumRobot, library, vacuumContext)).toStrictEqual({
      kind: "path2",
      regionId: "1",
      call: { domain: "roomba_plus", service: "clean_room", data: { entity_id: "vacuum.robot_one", room_name: "1" } },
    });
  });

  it("gives the mop robot's room the room action: path 1 is refused for no CLEAN_AREA", () => {
    const noMapping = readAreaMapping(undefined, knownAreaIds);
    const mopPathOne: PathOneContext = {
      ...vacuumPathOne,
      hasCleanArea: false,
      mapping: noMapping,
      lastSeen: readLastSeen(undefined),
      mapOfSegment: (segmentId) => mopRobot.mapOfSegment(segmentId),
    };
    const mopContext: DecideRoomContext = {
      vacuum: { state: "docked" },
      pathOne: mopPathOne,
      shadows: shadowIndexOf(rooms("mopPending"), mopPathOne.lastSeen),
    };
    expect(decideRoomPath(mopRobot, library, mopContext)).toMatchObject({
      kind: "path2",
      call: { data: { entity_id: "vacuum.robot_two", room_name: "1" } },
    });
    const withoutAction = { ...mopRobot, roomAction: () => undefined };
    expect(decideRoomPath(withoutAction, library, mopContext)).toMatchObject({
      pathOne: "no_clean_area",
      pathTwo: "no_room_action",
    });
  });

  it("uses path 1 when it applies, and never builds the room action", () => {
    const roomAction = vi.fn(vacuumRobot.roomAction);
    const paired: DecideRoomContext = {
      ...vacuumContext,
      pathOne: {
        ...vacuumPathOne,
        mapping: readAreaMapping(new Map([["library", ["MapA_q1W2e3_1"]]]), knownAreaIds),
        mapOfSegment: mapOfSegmentIn(["MapA_q1W2e3"]),
        pairedRooms: { mapId: "MapA_q1W2e3", segmentIdOf: (r) => segmentIdIn("MapA_q1W2e3", r), rooms: [library] },
      },
    };
    expect(decideRoomPath({ ...vacuumRobot, roomAction }, library, paired)).toEqual({
      kind: "path1",
      areaId: "library",
      roomNames: ["Library"],
      mapId: "MapA_q1W2e3",
    });
    expect(roomAction).not.toHaveBeenCalled();
  });
});

describe("decideRoomPath falls back to the room action after any path 1 refusal", () => {
  it.each<[string, Partial<PathOneContext>]>([
    ["segments_changed_open", { segmentsChangedOpen: true }],
    ["mapping_unsupported", { mapping: { kind: "unsupported", reason: "too_many_keys" } }],
  ])("after %s", (_, change) => {
    const context = { ...vacuumContext, pathOne: { ...vacuumPathOne, ...change } };
    expect(decideRoomPath(vacuumRobot, library, context).kind).toBe("path2");
  });
});

describe("decideRoomPath refusals", () => {
  it.each([
    ["unavailable", { state: "unavailable" }],
    ["no_state", undefined],
  ])("is not startable when the robot is %s, and tries no path", (reason, vacuum) => {
    const roomAction = vi.fn(vacuumRobot.roomAction);
    expect(decideRoomPath({ ...vacuumRobot, roomAction }, library, { ...vacuumContext, vacuum })).toEqual({
      kind: "not_startable",
      reason,
    });
    expect(roomAction).not.toHaveBeenCalled();
  });

  it("is not startable with both reasons when neither path applies", () => {
    const shadowed = {
      ...vacuumContext,
      shadows: shadowIndexOf(
        new Map([
          ["1", library],
          ["2", { ...library, regionId: "2", name: "1" }],
        ]),
        vacuumPathOne.lastSeen,
      ),
    };
    expect(decideRoomPath(vacuumRobot, library, shadowed)).toEqual({
      kind: "not_startable",
      reason: "no_path",
      pathOne: "no_core_area",
      pathTwo: "name_shadows_id",
    });
  });
});

describe("decideAreaItemPath", () => {
  it("uses path 1 for an area item", () => {
    expect(decideAreaItemPath({ state: "docked" }, "library", vacuumPathOne)).toMatchObject({
      kind: "path1",
      areaId: "library",
    });
  });

  it("never falls back to a room action: an area item has no region id", () => {
    expect(decideAreaItemPath({ state: "docked" }, "library", { ...vacuumPathOne, hasCleanArea: false })).toEqual({
      kind: "not_startable",
      reason: "no_path",
      pathOne: "no_clean_area",
    });
  });

  it("is not startable when the robot is unavailable", () => {
    expect(decideAreaItemPath({ state: "unavailable" }, "library", vacuumPathOne)).toEqual({
      kind: "not_startable",
      reason: "unavailable",
    });
  });
});
