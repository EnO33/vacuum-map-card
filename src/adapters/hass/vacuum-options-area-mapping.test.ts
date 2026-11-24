import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OptionsHarness, ROBOT, vacuumWith } from "../../../test/helpers/vacuum-options";
import { MAX_AREA_MAPPING_KEYS, MAX_MAPPED_SEGMENTS, MAX_SEGMENTS_PER_AREA } from "../../domain/mapping/limits";

let h: OptionsHarness;
const loaded = (list: unknown) => h.load(list);
const read = (entityId: string) => h.read(entityId);
const optionsOf = (vacuum: unknown) => h.optionsOf(vacuum);

beforeEach(() => {
  vi.useFakeTimers();
  h = new OptionsHarness();
});

afterEach(() => {
  h.stop();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("area_mapping", () => {
  const mapping = async (areaMapping: unknown) => {
    const options = await optionsOf({ area_mapping: areaMapping });
    return options.kind === "options" ? options.areaMapping : options;
  };
  const malformed = { kind: "unsupported", reason: "malformed" };

  it("gives an empty Map for {}, and keeps an empty list", async () => {
    const empty = await mapping({});
    expect(empty.kind === "list" && empty.list.size).toBe(0);
    const emptyList = await mapping({ library: [] });
    expect(emptyList.kind === "list" && emptyList.list.get("library")).toStrictEqual([]);
  });

  it("reads __proto__ as an ordinary key, and no inherited key", async () => {
    const proto = await mapping(JSON.parse('{"__proto__": ["MapA_1"]}'));
    expect(proto.kind === "list" && [...proto.list.entries()]).toStrictEqual([["__proto__", ["MapA_1"]]]);
  });

  /** Answers the registry with `areaMapping` as is, without the structured clone that drops prototypes and traps. */
  async function rawMapping(areaMapping: object) {
    await h.load([vacuumWith({ vacuum: { area_mapping: areaMapping } })], false);
    const options = read(ROBOT);
    return options.kind === "options" ? options.areaMapping : options;
  }

  it("ignores inherited keys", async () => {
    const read = await rawMapping(Object.assign(Object.create({ inherited: ["x"] }), { library: ["1"] }));
    expect(read.kind === "list" && [...read.list.keys()]).toStrictEqual(["library"]);
  });

  it("is malformed when a value changes between counting and copying", async () => {
    // The value turns into a string once the copying pass lists the keys (the second `ownKeys`).
    let listings = 0;
    const shifty = new Proxy(
      { library: ["1"] },
      {
        ownKeys(target) {
          listings++;
          return Reflect.ownKeys(target);
        },
        getOwnPropertyDescriptor(target, key) {
          const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
          return listings >= 2 && descriptor ? { ...descriptor, value: "1" } : descriptor;
        },
      },
    );
    expect(await rawMapping(shifty)).toStrictEqual(malformed);
  });

  it("passes strings whole: the domain reader owns the string cap", async () => {
    const long = "s".repeat(1000);
    const read = await mapping({ [long]: [long] });
    expect(read.kind === "list" && read.list.get(long)).toStrictEqual([long]);
  });

  it.each<[string, unknown]>([
    ["an array", [["library", ["1"]]]],
    ["a string", "library"],
    ["a value that is not an array", { library: "1" }],
    ["a non-string segment id", { library: ["1", 2] }],
    ["a null segment id", { library: [null] }],
  ])("is malformed for %s", async (_, value) => {
    expect(await mapping(value)).toStrictEqual(malformed);
  });

  it("is absent when missing or null", async () => {
    expect(await mapping(undefined)).toStrictEqual({ kind: "absent" });
    expect(await mapping(null)).toStrictEqual({ kind: "absent" });
  });

  it("counts keys before building anything: 501 keys build no Map", async () => {
    const keys = Object.fromEntries(Array.from({ length: MAX_AREA_MAPPING_KEYS + 1 }, (_, i) => [`a${i}`, ["1"]]));
    await loaded([vacuumWith({ vacuum: { area_mapping: keys } })]);
    read("vacuum.robot_nine"); // builds the reader's cache for this list version
    const maps = vi.spyOn(globalThis, "Map");
    const options = read(ROBOT);
    expect(options.kind === "options" && options.areaMapping).toStrictEqual(malformed);
    expect(maps).not.toHaveBeenCalled();
  });

  it("accepts the caps exactly", async () => {
    const atCap = Object.fromEntries(Array.from({ length: MAX_AREA_MAPPING_KEYS }, (_, i) => [`a${i}`, []]));
    expect((await mapping(atCap)).kind).toBe("list");
    expect((await mapping({ a: Array(MAX_SEGMENTS_PER_AREA).fill("s") })).kind).toBe("list");
    const total = Object.fromEntries(
      Array.from({ length: MAX_MAPPED_SEGMENTS / MAX_SEGMENTS_PER_AREA }, (_, i) => [
        `a${i}`,
        Array(MAX_SEGMENTS_PER_AREA).fill("s"),
      ]),
    );
    expect((await mapping(total)).kind).toBe("list");
  });

  it("is malformed over 100 ids in one area or 2,000 in total", async () => {
    expect(await mapping({ a: Array(MAX_SEGMENTS_PER_AREA + 1).fill("s") })).toStrictEqual(malformed);
    const total = Object.fromEntries(
      Array.from({ length: MAX_MAPPED_SEGMENTS / MAX_SEGMENTS_PER_AREA + 1 }, (_, i) => [
        `a${i}`,
        Array(MAX_SEGMENTS_PER_AREA).fill("s"),
      ]),
    );
    expect(await mapping(total)).toStrictEqual(malformed);
  });
});
