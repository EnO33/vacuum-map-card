import { describe, expect, it, vi } from "vitest";
import { lastSeenOf, mappingFixtures } from "../../../test/helpers/area-mapping";
import { snapshotFixtures, snapshotOf } from "../../../test/helpers/rooms-snapshot";
import { type LastSeen, readLastSeen } from "../mapping/last-seen";
import { unsupported } from "../unsupported";
import { type PathTwoRobot, type PlanRoomName, pathTwo, shadowIndexOf } from "./path-two";

/** The three rooms of the synthetic fixture (region ids "1", "2", "3"), with names changed per test. */
const fixtureRooms: readonly PlanRoomName[] = snapshotOf(snapshotFixtures.threeRooms).rooms;

function roomsNamed(changes: ReadonlyMap<string, Partial<PlanRoomName>>): readonly PlanRoomName[] {
  return fixtureRooms.map((room) => ({ ...room, ...changes.get(room.regionId) }));
}

const byRegion = (rooms: readonly PlanRoomName[]) => new Map(rooms.map((room) => [room.regionId, room]));

const robot: PathTwoRobot<string> = {
  roomAction: (regionId) => `clean ${regionId}`,
  roomActionMatchesNamesFirst: true,
};
const context = (planRooms: readonly PlanRoomName[], lastSeen: LastSeen = readLastSeen(undefined)) =>
  shadowIndexOf(byRegion(planRooms), lastSeen);
const studio = (rooms: readonly PlanRoomName[]) => {
  const room = rooms.find((r) => r.regionId === "2");
  if (!room) throw new Error("the fixture has region 2");
  return room;
};

describe("pathTwo on the three-room fixture", () => {
  it("offers the room action when the fixture names shadow nothing", () => {
    expect(pathTwo(robot, studio(fixtureRooms), context(fixtureRooms))).toEqual({
      kind: "path2",
      regionId: "2",
      call: "clean 2",
    });
  });

  it.each([
    ["another room named « 2 »", new Map([["1", { name: "2" }]])],
    ["another room named « 2 » with spaces", new Map([["1", { name: " 2 " }]])],
    ["another room named with a fullwidth « ２ »", new Map([["3", { name: "２" }]])],
    ["another room whose room id is « 2 »", new Map([["1", { roomId: "2" }]])],
  ])("refuses when %s", (_, changes) => {
    const rooms = roomsNamed(changes);
    expect(pathTwo(robot, studio(rooms), context(rooms))).toEqual({ kind: "refused", reason: "name_shadows_id" });
  });

  it("does not compare the room with its own name or room id", () => {
    const rooms = roomsNamed(new Map([["2", { name: "2", roomId: "2" }]]));
    expect(pathTwo(robot, studio(rooms), context(rooms)).kind).toBe("path2");
  });

  it("refuses when a last seen name shadows the id", () => {
    const lastSeen = readLastSeen([...(lastSeenOf(mappingFixtures.vacuum) ?? []), { id: "MapZ_x_9", name: "2" }]);
    expect(pathTwo(robot, studio(fixtureRooms), context(fixtureRooms, lastSeen))).toEqual({
      kind: "refused",
      reason: "name_shadows_id",
    });
  });

  it("finds no shadow in the vacuum robot's last seen names", () => {
    const lastSeen = readLastSeen(lastSeenOf(mappingFixtures.vacuum));
    expect(pathTwo(robot, studio(fixtureRooms), context(fixtureRooms, lastSeen)).kind).toBe("path2");
  });
});

describe("pathTwo refusals, in order", () => {
  it("refuses a region id that is not plain, before anything else", () => {
    const roomAction = vi.fn(robot.roomAction);
    const room = { regionId: "2 ", name: "Studio", roomId: "studio" };
    expect(pathTwo({ ...robot, roomAction }, room, context(fixtureRooms))).toEqual({
      kind: "refused",
      reason: "region_id_unsafe",
    });
    expect(roomAction).not.toHaveBeenCalled();
  });

  it("refuses without a room action", () => {
    const none: PathTwoRobot<string> = { ...robot, roomAction: () => undefined };
    expect(pathTwo(none, studio(fixtureRooms), context(fixtureRooms))).toEqual({
      kind: "refused",
      reason: "no_room_action",
    });
  });

  it("refuses when the last seen names cannot be read", () => {
    const unreadable = context(fixtureRooms, unsupported("duplicate_segment_id"));
    expect(pathTwo(robot, studio(fixtureRooms), unreadable)).toEqual({
      kind: "refused",
      reason: "shadow_check_impossible",
    });
  });

  it("reports a shadow before an impossible check", () => {
    const rooms = roomsNamed(new Map([["1", { name: "2" }]]));
    expect(pathTwo(robot, studio(rooms), context(rooms, unsupported("too_many_entries")))).toMatchObject({
      reason: "name_shadows_id",
    });
  });

  it("skips the shadow check when the room action does not match names first", () => {
    const idsOnly: PathTwoRobot<string> = { ...robot, roomActionMatchesNamesFirst: false };
    const rooms = roomsNamed(new Map([["1", { name: "2" }]]));
    expect(pathTwo(idsOnly, studio(rooms), context(rooms)).kind).toBe("path2");
  });

  it("refuses unreadable last seen names even for a room action that matches ids only", () => {
    const idsOnly: PathTwoRobot<string> = { ...robot, roomActionMatchesNamesFirst: false };
    expect(pathTwo(idsOnly, studio(fixtureRooms), context(fixtureRooms, unsupported("too_many_entries")))).toEqual({
      kind: "refused",
      reason: "shadow_check_impossible",
    });
  });

  it("reports no room action before a shadow", () => {
    const none: PathTwoRobot<string> = { ...robot, roomAction: () => undefined };
    const rooms = roomsNamed(new Map([["1", { name: "2" }]]));
    expect(pathTwo(none, studio(rooms), context(rooms))).toMatchObject({ reason: "no_room_action" });
  });

  it("never checks a room against another plan's index", () => {
    const stranger = { regionId: "7", name: "Attic", roomId: "attic" };
    expect(pathTwo(robot, stranger, context(fixtureRooms))).toEqual({
      kind: "refused",
      reason: "shadow_check_impossible",
    });
  });
});
