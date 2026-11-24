import { describe, expect, it } from "vitest";
import { CALIBRATION, MALFORMED, room, withRooms } from "../../../test/helpers/rooms-map";
import { MAX_OUTLINE_POINTS } from "../../domain/geometry/limits";
import { MAX_PLAN_ROOMS } from "../../domain/plan/rooms-plan";
import { MAX_TEXT_LENGTH } from "../../domain/text/limits";
import { roomsMapContentOf } from "./rooms-map-attributes";

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

  it.each<[string, () => unknown]>([
    [
      "a state object",
      () =>
        new Proxy(
          {},
          {
            getOwnPropertyDescriptor: () => {
              throw new Error("trap");
            },
          },
        ),
    ],
    [
      "an attributes object",
      () => ({
        state: "2026",
        attributes: new Proxy(
          {},
          {
            getOwnPropertyDescriptor: () => {
              throw new Error("trap");
            },
          },
        ),
      }),
    ],
  ])("refuses %s whose traps throw, without throwing", (_, make) => {
    expect(roomsMapContentOf(make())).toStrictEqual(MALFORMED);
  });

  it("refuses rooms that are not a plain object", () => {
    expect(withRooms(new Map([["A", room("1")]]))).toStrictEqual(MALFORMED);
  });

  it("reads each array length once, so a shifting length cannot pass the caps", () => {
    let reads = 0;
    const outline = new Proxy(
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      {
        getOwnPropertyDescriptor(target, key) {
          if (key === "length") reads++;
          return Reflect.getOwnPropertyDescriptor(target, key);
        },
        get(target, key, receiver) {
          if (key === "length") return ++reads > 1 ? MAX_OUTLINE_POINTS + 5 : 3;
          return Reflect.get(target, key, receiver);
        },
      },
    );
    const content = withRooms({ A: room("1", { outline }) });
    expect(content.kind === "snapshot" && content.snapshot.rooms[0]?.outline).toHaveLength(3);
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
