import { describe, expect, it } from "vitest";
import aligned from "../../../test/fixtures/roomba-plus/hass_state_rooms_map_vacuum_aligned.json" with { type: "json" };
import { CALIBRATION, room, withRooms } from "../../../test/helpers/rooms-map";
import { buildRoomsPlan } from "../../domain/plan/rooms-plan";
import { MAX_TEXT_LENGTH } from "../../domain/text/limits";
import { roomsMapContentOf } from "./rooms-map-attributes";

describe("no outlines", () => {
  it.each<[string, unknown]>([
    ["no state object", undefined],
    ["no attributes", { state: "2026" }],
    ["a non-string state", { state: 3, attributes: { rooms: {}, calibration_points: CALIBRATION } }],
    ["no rooms", { state: "2026", attributes: { calibration_points: CALIBRATION } }],
    ["null rooms", { state: "2026", attributes: { rooms: null, calibration_points: CALIBRATION } }],
    ["no calibration", { state: "2026", attributes: { rooms: {} } }],
    ["null calibration", { state: "2026", attributes: { rooms: {}, calibration_points: null } }],
    ["inherited rooms", { state: "2026", attributes: Object.create({ rooms: {}, calibration_points: CALIBRATION }) }],
  ])("is no_outlines with %s", (_, stateObject) => {
    expect(roomsMapContentOf(stateObject)).toStrictEqual({ kind: "no_outlines" });
  });
});

describe("snapshot", () => {
  it("types the captured rooms map into state, calibration and rooms only", () => {
    const content = roomsMapContentOf(aligned);
    expect(content.kind).toBe("snapshot");
    if (content.kind !== "snapshot") return;
    expect(Object.keys(content.snapshot).sort()).toStrictEqual(["calibration", "rooms", "state"]);
    expect(content.snapshot.state).toBe(aligned.state);
    expect(content.snapshot.calibration[0]).toStrictEqual({ vacuum: { x: -4200, y: -1500 }, map: { x: 4, y: 595 } });
    expect(content.snapshot.rooms.map((r) => [r.regionId, r.name, r.roomId, r.icon])).toStrictEqual([
      ["1", "Library", "library", "mdi:sofa"],
    ]);
    expect(content.snapshot.rooms[0]?.outline?.[2]).toStrictEqual({ x: 1300, y: 1200.5 });
    const serialised = JSON.stringify(content);
    for (const leak of ["access_token", "entity_picture", "friendly_name", "attributes", "0000000000"]) {
      expect(serialised).not.toContain(leak);
    }
  });

  it("gives no rooms for rooms: {}", () => {
    expect(withRooms({})).toMatchObject({ kind: "snapshot", snapshot: { rooms: [] } });
  });

  it("keeps a room named __proto__ as a room", () => {
    const rooms: unknown = JSON.parse(
      JSON.stringify({ __proto__x: room("7", { name: "__proto__" }) }).replace("__proto__x", "__proto__"),
    );
    const content = withRooms(rooms);
    expect(content.kind === "snapshot" && content.snapshot.rooms.map((r) => r.name)).toStrictEqual(["__proto__"]);
  });

  it("keeps rooms in attribute order and ignores x, y, the key and other keys", () => {
    const content = withRooms({ B: room("2", { extra: true }), A: room("1") });
    expect(content.kind === "snapshot" && content.snapshot.rooms).toStrictEqual([
      {
        regionId: "2",
        name: "Room 2",
        roomId: "room_2",
        icon: "mdi:sofa",
        outline: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
        ],
      },
      {
        regionId: "1",
        name: "Room 1",
        roomId: "room_1",
        icon: "mdi:sofa",
        outline: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
        ],
      },
    ]);
  });

  it("omits an icon that is not a string within the cap, and an absent outline", () => {
    const content = withRooms({
      A: room("1", { icon: 3 }),
      B: room("2", { icon: "i".repeat(MAX_TEXT_LENGTH + 1), outline: undefined }),
    });
    expect(
      content.kind === "snapshot" && content.snapshot.rooms.map((r) => ["icon" in r, "outline" in r]),
    ).toStrictEqual([
      [false, true],
      [false, false],
    ]);
  });

  it("passes on duplicate region ids and too few points or pairs, for the domain to refuse", () => {
    const duplicates = withRooms({ A: room("1"), B: room("1") });
    expect(duplicates.kind === "snapshot" && buildRoomsPlan(duplicates.snapshot)).toMatchObject({
      kind: "unsupported",
      reason: "duplicate_region_id",
    });
    const fewPoints = withRooms({ A: room("1", { outline: [[0, 0]] }) });
    const plan = fewPoints.kind === "snapshot" ? buildRoomsPlan(fewPoints.snapshot) : undefined;
    expect(plan?.kind === "plan" && plan.rooms.get("1")?.shape).toStrictEqual({
      kind: "unsupported",
      reason: "too_few_points",
    });
    const fewPairs = withRooms({ A: room("1") }, CALIBRATION.slice(0, 2));
    expect(fewPairs.kind === "snapshot" && buildRoomsPlan(fewPairs.snapshot)).toStrictEqual({
      kind: "unsupported",
      reason: "calibration_pair_count",
    });
  });

  it("passes on non-finite numbers, for the domain to refuse", () => {
    const content = withRooms({
      A: room("1", {
        outline: [
          [Number.NaN, 0],
          [1, 1],
          [2, 2],
        ],
      }),
    });
    expect(content.kind).toBe("snapshot");
  });
});
