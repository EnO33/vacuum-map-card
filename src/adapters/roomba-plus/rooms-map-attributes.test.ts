import { describe, expect, it } from "vitest";
import aligned from "../../../test/fixtures/roomba-plus/hass_state_rooms_map_vacuum_aligned.json" with { type: "json" };
import { MAX_OUTLINE_POINTS } from "../../domain/geometry/limits";
import { buildRoomsPlan, MAX_PLAN_ROOMS } from "../../domain/plan/rooms-plan";
import { MAX_TEXT_LENGTH } from "../../domain/text/limits";
import { roomsMapContentOf } from "./rooms-map-attributes";

const MALFORMED = { kind: "unsupported", reason: "malformed_attributes" };
const CALIBRATION = aligned.attributes.calibration_points;

function room(regionId: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    outline: [
      [0, 0],
      [100, 0],
      [100, 100],
    ],
    name: `Room ${regionId}`,
    room_id: `room_${regionId}`,
    region_id: regionId,
    icon: "mdi:sofa",
    x: 50,
    y: 33,
    ...overrides,
  };
}

/** The content of a state whose attributes are `attributes`. */
function contentOf(attributes: unknown, state: unknown = "2026-01-01T09:30:00+00:00") {
  return roomsMapContentOf({ state, attributes });
}

function withRooms(rooms: unknown, calibration: unknown = CALIBRATION) {
  return contentOf({ rooms, calibration_points: calibration, access_token: "0001" });
}

describe("no outlines", () => {
  it.each<[string, unknown]>([
    ["no state object", undefined],
    ["no attributes", { state: "2026" }],
    ["a non-string state", { state: 3, attributes: { rooms: {}, calibration_points: CALIBRATION } }],
    ["no rooms", { state: "2026", attributes: { calibration_points: CALIBRATION } }],
    ["null rooms", { state: "2026", attributes: { rooms: null, calibration_points: CALIBRATION } }],
    ["no calibration", { state: "2026", attributes: { rooms: {} } }],
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
    expect(fewPoints.kind).toBe("snapshot");
    const fewPairs = withRooms({}, CALIBRATION.slice(0, 2));
    expect(fewPairs.kind === "snapshot" && fewPairs.snapshot.calibration).toHaveLength(2);
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

describe("malformed attributes", () => {
  it.each<[string, unknown]>([
    ["rooms as an array", []],
    ["rooms as a string", "rooms"],
    ["a room that is not an object", { A: "room" }],
    [
      "a Prime-shaped room without region_id",
      {
        r1: {
          outline: [
            [0, 0],
            [1, 0],
            [1, 1],
          ],
          name: "Den",
          room_id: "r1",
        },
      },
    ],
    ["a non-string name", { A: room("1", { name: 3 }) }],
    ["a non-string room_id", { A: room("1", { room_id: null }) }],
    ["an over-cap region_id", { A: room("r".repeat(MAX_TEXT_LENGTH + 1)) }],
    ["an over-cap name", { A: room("1", { name: "n".repeat(MAX_TEXT_LENGTH + 1) }) }],
    ["an outline that is not an array", { A: room("1", { outline: "0,0" }) }],
    ["a null outline", { A: room("1", { outline: null }) }],
    [
      "a point that is not a pair",
      {
        A: room("1", {
          outline: [
            [0, 0, 0],
            [1, 0],
            [1, 1],
          ],
        }),
      },
    ],
    [
      "a point with a string",
      {
        A: room("1", {
          outline: [
            ["0", 0],
            [1, 0],
            [1, 1],
          ],
        }),
      },
    ],
    ["a point that is an object", { A: room("1", { outline: [{ x: 0, y: 0 }, [1, 0], [1, 1]] }) }],
    ["too many points", { A: room("1", { outline: Array(MAX_OUTLINE_POINTS + 1).fill([0, 0]) }) }],
  ])("refuses %s", (_, rooms) => {
    expect(withRooms(rooms)).toStrictEqual(MALFORMED);
  });

  it("accepts the caps exactly", () => {
    const many = Object.fromEntries(Array.from({ length: MAX_PLAN_ROOMS }, (_, i) => [`R${i}`, room(`${i}`)]));
    expect(withRooms(many).kind).toBe("snapshot");
    expect(withRooms({ A: room("1", { outline: Array(MAX_OUTLINE_POINTS).fill([0, 0]) }) }).kind).toBe("snapshot");
  });

  it.each<[string, unknown]>([
    ["not an array", { 0: CALIBRATION[0] }],
    ["over three pairs", [...CALIBRATION, CALIBRATION[0]]],
    ["a pair without map", [{ vacuum: { x: 0, y: 0 } }]],
    ["a pair with a string value", [{ vacuum: { x: "0", y: 0 }, map: { x: 0, y: 0 } }]],
    ["a pair that is null", [null]],
  ])("refuses calibration %s", (_, calibration) => {
    expect(withRooms({}, calibration)).toStrictEqual(MALFORMED);
  });

  it("counts rooms before reading any of them: 101 rooms read no room", () => {
    const read: (string | symbol)[] = [];
    const watched = () =>
      new Proxy(room("1"), {
        getOwnPropertyDescriptor(target, key) {
          read.push(key);
          return Reflect.getOwnPropertyDescriptor(target, key);
        },
      });
    const rooms = Object.fromEntries(Array.from({ length: MAX_PLAN_ROOMS + 1 }, (_, i) => [`R${i}`, watched()]));
    expect(withRooms(rooms)).toStrictEqual(MALFORMED);
    expect(read).toStrictEqual([]);
  });

  it("refuses a hostile rooms object whose traps throw, without throwing", () => {
    const hostile = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("trap");
        },
      },
    );
    expect(withRooms(hostile)).toStrictEqual(MALFORMED);
  });

  it("never runs a getter of a room", () => {
    const getterRoom = Object.defineProperty(room("1"), "name", {
      enumerable: true,
      get: () => {
        throw new Error("read");
      },
    });
    expect(withRooms({ A: getterRoom })).toStrictEqual(MALFORMED);
  });
});
