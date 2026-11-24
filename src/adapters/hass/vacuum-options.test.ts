import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import noCleanArea from "../../../test/fixtures/ha-core/entity_registry_get_vacuum_no_clean_area.json" with {
  type: "json",
};
import entityRegistryList from "../../../test/fixtures/ha-core/entity_registry_list.json" with { type: "json" };
import noMapping from "../../../test/fixtures/ha-core/synthetic/entity_registry_get_vacuum_clean_area_no_mapping.json" with {
  type: "json",
};
import deletedArea from "../../../test/fixtures/ha-core/synthetic/entity_registry_get_vacuum_deleted_area.json" with {
  type: "json",
};
import { OptionsHarness, ROBOT, vacuumWith } from "../../../test/helpers/vacuum-options";
import { MAX_LAST_SEEN_SEGMENTS } from "../../domain/mapping/limits";

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

describe("vacuumOptions failures", () => {
  it("is not_loaded before the registry list is read", () => {
    expect(read(ROBOT)).toStrictEqual({ kind: "unsupported", reason: "not_loaded" });
  });

  it("is registry_entry_unreadable for an entity without an entry", async () => {
    await loaded(entityRegistryList);
    expect(read("vacuum.robot_nine")).toStrictEqual({ kind: "unsupported", reason: "registry_entry_unreadable" });
  });

  it.each<[string, unknown]>([
    ["an array", []],
    ["a string", "options"],
    ["a number", 3],
  ])("is malformed_options when options.vacuum is %s", async (_, vacuum) => {
    expect(await optionsOf(vacuum)).toStrictEqual({ kind: "unsupported", reason: "malformed_options" });
  });

  it.each<[string, unknown]>([
    ["options missing", undefined],
    ["options null", null],
    ["options.vacuum missing", {}],
    ["options.vacuum null", { vacuum: null }],
  ])("gives both lists absent with %s", async (_, options) => {
    await loaded([vacuumWith(options)]);
    expect(read(ROBOT)).toStrictEqual({
      kind: "options",
      areaMapping: { kind: "absent" },
      lastSeenSegments: { kind: "absent" },
    });
  });
});

describe("fixtures", () => {
  it("reads vacuum.robot_one's mapping and last seen segments without group", async () => {
    await loaded(entityRegistryList);
    const options = read(ROBOT);
    expect(options.kind).toBe("options");
    if (options.kind !== "options" || options.areaMapping.kind !== "list") throw new Error("no mapping");
    expect(options.areaMapping.list.get("library")).toStrictEqual(["MapA_q1W2e3_1"]);
    expect(options.lastSeenSegments).toStrictEqual({
      kind: "list",
      list: [
        { id: "MapA_q1W2e3_1", name: "Library" },
        { id: "MapB_z9X8c7_1", name: "Gallery" },
        { id: "MapB_z9X8c7_3", name: "Music corner" },
        { id: "MapB_z9X8c7_2", name: "Studio" },
        { id: "MapA_q1W2e3_zid_0", name: "Reading table " },
        { id: "MapA_q1W2e3_zid_1", name: "Mat" },
        { id: "MapA_q1W2e3_zid_2", name: "Workshop" },
      ],
    });
  });

  it.each<[string, unknown, string]>([
    ["vacuum.robot_two in the list", entityRegistryList, "vacuum.robot_two"],
    ["the no clean area capture", [noCleanArea], "vacuum.robot_two"],
    ["the no mapping synthetic", [noMapping], ROBOT],
  ])("gives both lists absent for %s", async (_, list, entityId) => {
    await loaded(list);
    expect(read(entityId)).toStrictEqual({
      kind: "options",
      areaMapping: { kind: "absent" },
      lastSeenSegments: { kind: "absent" },
    });
  });

  it("keeps a deleted area's key: the domain reader ignores it", async () => {
    await loaded([deletedArea]);
    const options = read(ROBOT);
    if (options.kind !== "options" || options.areaMapping.kind !== "list") throw new Error("no mapping");
    expect(options.areaMapping.list.get("deleted_room")).toStrictEqual(["MapB_z9X8c7_1"]);
  });
});

describe("last_seen_segments", () => {
  const segments = async (lastSeen: unknown) => {
    const options = await optionsOf({ last_seen_segments: lastSeen });
    return options.kind === "options" ? options.lastSeenSegments : options;
  };
  const malformed = { kind: "unsupported", reason: "malformed" };

  it("is absent when missing or null, and keeps an empty list", async () => {
    expect(await segments(undefined)).toStrictEqual({ kind: "absent" });
    expect(await segments(null)).toStrictEqual({ kind: "absent" });
    expect(await segments([])).toStrictEqual({ kind: "list", list: [] });
  });

  it("keeps id and name only", async () => {
    expect(await segments([{ id: "1", name: "Den", group: "Rooms", extra: true }])).toStrictEqual({
      kind: "list",
      list: [{ id: "1", name: "Den" }],
    });
  });

  it.each<[string, unknown]>([
    ["an object", { id: "1", name: "Den" }],
    ["an entry that is not an object", ["1"]],
    ["an entry without a string id", [{ id: 1, name: "Den" }]],
    ["an entry without a string name", [{ id: "1", name: null }]],
    ["an entry whose id is inherited", [Object.create({ id: "1", name: "Den" })]],
  ])("is malformed for %s", async (_, value) => {
    expect(await segments(value)).toStrictEqual(malformed);
  });

  it("counts entries before copying: over 2,000 is malformed, 2,000 is read", async () => {
    const entry = { id: "1", name: "Den" };
    expect(await segments(Array(MAX_LAST_SEEN_SEGMENTS + 1).fill(entry))).toStrictEqual(malformed);
    expect((await segments(Array(MAX_LAST_SEEN_SEGMENTS).fill(entry))).kind).toBe("list");
  });
});

describe("identity", () => {
  it("returns the same object until the registry list changes", async () => {
    await loaded(entityRegistryList);
    const first = read(ROBOT);
    expect(read(ROBOT)).toBe(first);
    expect(read("vacuum.robot_nine")).toBe(read("vacuum.robot_nine"));
    h.hass.answerWS = () => Promise.resolve(structuredClone(entityRegistryList));
    h.hass.connection.emit("entity_registry_updated");
    await vi.advanceTimersByTimeAsync(500);
    expect(read(ROBOT)).toBe(first);
    h.hass.answerWS = () =>
      Promise.resolve([
        ...structuredClone(entityRegistryList),
        { entity_id: "sensor.new", id: "0d0d", platform: "demo" },
      ]);
    h.hass.connection.emit("entity_registry_updated");
    await vi.advanceTimersByTimeAsync(500);
    expect(read(ROBOT)).not.toBe(first);
    expect(read(ROBOT)).toStrictEqual(first);
  });

  it("freezes what it returns", async () => {
    await loaded(entityRegistryList);
    const options = read(ROBOT);
    expect(Object.isFrozen(options)).toBe(true);
    if (options.kind !== "options" || options.lastSeenSegments.kind !== "list") throw new Error("no list");
    expect(Object.isFrozen(options.lastSeenSegments.list)).toBe(true);
    expect(Object.isFrozen(options.lastSeenSegments.list[0])).toBe(true);
  });
});
