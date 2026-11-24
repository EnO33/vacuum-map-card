import { beforeEach, describe, expect, it } from "vitest";
import { FakeFrontendHass } from "../../../test/fakes/frontend-hass";
import { MAX_TEXT_LENGTH } from "../../domain/text/limits";
import { areasReader } from "./areas";

let hass: FakeFrontendHass;
let areas: ReturnType<typeof areasReader>;

function area(areaId: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { area_id: areaId, name: `Area ${areaId}`, aliases: [], floor_id: "ground_floor", icon: null, ...overrides };
}

beforeEach(() => {
  hass = new FakeFrontendHass();
  areas = areasReader(() => hass);
});

describe("areasReader", () => {
  it("reads the fixture's areas, with greenhouse on no floor", () => {
    const read = areas();
    expect(read.size).toBe(8);
    expect(read.get("greenhouse")).toStrictEqual({
      areaId: "greenhouse",
      name: "Greenhouse",
      aliases: [],
      floorId: null,
    });
  });

  it("returns the same map while hass.areas keeps its identity, and a new one for a new object", () => {
    const first = areas();
    expect(areas()).toBe(first);
    hass.areas = structuredClone(hass.areas);
    const second = areas();
    expect(second).not.toBe(first);
    expect(second).toStrictEqual(first);
  });

  it("reads hass again on each call", () => {
    expect(areas().has("library")).toBe(true);
    const other = new FakeFrontendHass();
    other.areas = { attic: area("attic") };
    hass = other;
    expect([...areas().keys()]).toStrictEqual(["attic"]);
  });

  it("reads a key named __proto__ as an ordinary area, and no inherited key", () => {
    const parsed: unknown = JSON.parse('{"__proto__": {"area_id": "__proto__", "name": "Proto", "aliases": []}}');
    hass.areas = parsed;
    expect([...areas().keys()]).toStrictEqual(["__proto__"]);
    hass.areas = Object.create({ inherited: area("inherited") });
    expect(areas().size).toBe(0);
  });

  it.each<[string, unknown]>([
    ["missing", undefined],
    ["null", null],
    ["a string", "areas"],
  ])("gives an empty map when hass.areas is %s", (_, value) => {
    hass.areas = value;
    expect(areas().size).toBe(0);
  });

  it.each<[string, unknown]>([
    ["not an object", "kitchen"],
    ["with another area_id than its key", area("pantry")],
    ["without a string name", area("kitchen", { name: 3 })],
  ])("skips an entry %s", (_, entry) => {
    hass.areas = { kitchen: entry, kept: area("kept") };
    expect([...areas().keys()]).toStrictEqual(["kept"]);
  });

  it("keeps string aliases only, and reads a non-string floor_id as null", () => {
    hass.areas = {
      a: area("a", { aliases: [null, "Den"], floor_id: 4 }),
      b: area("b", { aliases: "Den", floor_id: undefined }),
      c: area("c", { floor_id: "" }),
      d: area("d", { floor_id: "f".repeat(MAX_TEXT_LENGTH + 1) }),
    };
    expect([...areas().values()]).toStrictEqual([
      { areaId: "a", name: "Area a", aliases: ["Den"], floorId: null },
      { areaId: "b", name: "Area b", aliases: [], floorId: null },
      { areaId: "c", name: "Area c", aliases: [], floorId: null },
      { areaId: "d", name: "Area d", aliases: [], floorId: null },
    ]);
  });

  it("skips an area whose id is over the cap, as the entity registry drops such an area_id", () => {
    const long = "a".repeat(MAX_TEXT_LENGTH + 1);
    hass.areas = { [long]: area(long), kept: area("kept") };
    expect([...areas().keys()]).toStrictEqual(["kept"]);
  });

  it("never runs a getter of an entry", () => {
    const entry = Object.defineProperty(area("a"), "name", {
      enumerable: true,
      get: () => {
        throw new Error("read");
      },
    });
    hass.areas = { a: entry };
    expect(areas().size).toBe(0);
  });
});
