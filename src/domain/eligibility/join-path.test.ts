import { describe, expect, it, vi } from "vitest";
import { areaMappingOf, knownAreaIds, lastSeenOf, mappingFixtures } from "../../../test/helpers/area-mapping";
import { mapOfSegmentIn, segmentIdIn } from "../../../test/helpers/stored-maps";
import { readAreaMapping } from "../mapping/area-mapping";
import { readLastSeen } from "../mapping/last-seen";
import { decideJoinPath, type JoinContext, type JoinRoom } from "./join-path";
import type { PathOneContext } from "./path-one";
import { type PathTwoRobot, shadowIndexOf } from "./path-two";

const pathOneContext: PathOneContext = {
  hasCleanArea: true,
  hasCleanAreaService: true,
  mapping: readAreaMapping(areaMappingOf(mappingFixtures.vacuum), knownAreaIds),
  lastSeen: readLastSeen(lastSeenOf(mappingFixtures.vacuum)),
  mapOfSegment: mapOfSegmentIn(["MapA_q1W2e3", "MapB_z9X8c7"]),
  segmentsChangedOpen: false,
  pairedRooms: undefined,
};

const library: JoinRoom = {
  regionId: "1",
  name: "Library",
  roomId: "library",
  area: { kind: "name", areaId: "library" },
  floorId: "ground_floor",
};

const robot: PathTwoRobot<string> = { roomAction: (r) => `clean ${r}`, roomActionMatchesNamesFirst: true };

function context(change: Partial<JoinContext>): JoinContext {
  return {
    vacuum: { state: "docked" },
    areaId: "library",
    planFloorId: "ground_floor",
    hasAreaItem: false,
    rooms: [],
    pathOne: pathOneContext,
    shadows: shadowIndexOf(new Map([["1", library]]), pathOneContext.lastSeen),
    ...change,
  };
}

describe("decideJoinPath", () => {
  it("joins by its own area item with path 1", () => {
    expect(decideJoinPath(robot, context({ hasAreaItem: true }))).toEqual({
      kind: "path1",
      areaId: "library",
      roomNames: ["Library"],
      mapId: "MapA_q1W2e3",
      segments: [{ segmentId: "MapA_q1W2e3_1", name: "Library" }],
    });
  });

  it("joins by its own room on the plan's floor with its own room action", () => {
    expect(decideJoinPath(robot, context({ rooms: [library] }))).toEqual({
      kind: "path2",
      regionId: "1",
      call: "clean 1",
    });
  });

  it.each([
    ["a name link on another floor", { ...library, floorId: "upper_floor" }],
    ["a name link in « no floor »", { ...library, floorId: undefined }],
  ])("never joins by %s", (_, room) => {
    expect(decideJoinPath(robot, context({ rooms: [room] }))).toBeUndefined();
  });

  it("never joins by path 2 when the shown plan is in « no floor »", () => {
    expect(
      decideJoinPath(robot, context({ rooms: [{ ...library, floorId: undefined }], planFloorId: undefined })),
    ).toBeUndefined();
  });

  it("joins by a core room on another floor, with path 1 or its reason", () => {
    const core: JoinRoom = { ...library, area: { kind: "core", areaId: "library" }, floorId: "upper_floor" };
    expect(decideJoinPath(robot, context({ rooms: [core] }))).toEqual({
      kind: "not_startable",
      reason: "no_path",
      reasons: ["no_core_area"],
    });
  });

  it("refuses path 1 that would clean another area than the item's", () => {
    const paired: PathOneContext = {
      ...pathOneContext,
      mapping: readAreaMapping(new Map([["workshop", ["MapA_q1W2e3_1"]]]), knownAreaIds),
      mapOfSegment: mapOfSegmentIn(["MapA_q1W2e3"]),
      pairedRooms: { mapId: "MapA_q1W2e3", segmentIdOf: (r) => segmentIdIn("MapA_q1W2e3", r), rooms: [library] },
    };
    const core: JoinRoom = { ...library, area: { kind: "core", areaId: "library" }, floorId: "upper_floor" };
    expect(decideJoinPath(robot, context({ rooms: [core], pathOne: paired }))).toMatchObject({
      reasons: ["no_core_area"],
    });
  });

  it.each([
    ["unavailable", { state: "unavailable" }],
    ["no_state", undefined],
  ])("is not startable when %s, and tries no path", (reason, vacuum) => {
    const roomAction = vi.fn(robot.roomAction);
    expect(decideJoinPath({ ...robot, roomAction }, context({ vacuum, rooms: [library] }))).toEqual({
      kind: "not_startable",
      reason,
    });
    expect(roomAction).not.toHaveBeenCalled();
  });

  it("does not list an unavailable robot whose only link never joins", () => {
    const elsewhere = { ...library, floorId: "upper_floor" };
    expect(decideJoinPath(robot, context({ vacuum: { state: "unavailable" }, rooms: [elsewhere] }))).toBeUndefined();
  });

  it("gives every reason, once each, when no link starts", () => {
    const none: PathTwoRobot<string> = { ...robot, roomAction: () => undefined };
    expect(
      decideJoinPath(
        none,
        context({ hasAreaItem: true, rooms: [library], pathOne: { ...pathOneContext, hasCleanArea: false } }),
      ),
    ).toEqual({ kind: "not_startable", reason: "no_path", reasons: ["no_clean_area", "no_room_action"] });
  });

  it("refuses a same-floor room without a shadow index", () => {
    expect(decideJoinPath(robot, context({ rooms: [library], shadows: undefined }))).toMatchObject({
      reasons: ["shadow_check_impossible"],
    });
  });

  it("ignores rooms linked to another area", () => {
    const workshop: JoinRoom = { ...library, area: { kind: "core", areaId: "workshop" } };
    expect(decideJoinPath(robot, context({ rooms: [workshop] }))).toBeUndefined();
  });
});
