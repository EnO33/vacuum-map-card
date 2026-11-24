import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeFrontendHass } from "../../../test/fakes/frontend-hass";
import entityRegistryList from "../../../test/fixtures/ha-core/entity_registry_list.json" with { type: "json" };
import floorPlanDisabled from "../../../test/fixtures/roomba-plus/synthetic/entity_registry_list_floor_plan_disabled.json" with {
  type: "json",
};
import { expectNoConsoleOutput } from "../../../test/helpers/no-console";
import { MAX_TEXT_LENGTH } from "../../domain/text/limits";
import { createEntityRegistry, type EntityRegistry } from "./entity-registry";

const BASE_KEYS = [
  "areaId",
  "deviceId",
  "disabled",
  "entityId",
  "platform",
  "registryId",
  "translationKey",
  "uniqueId",
];

let hass: FakeFrontendHass;
let registry: EntityRegistry;

/** Starts the registry on `list` and waits for the first fetch. */
async function loaded(list: unknown): Promise<EntityRegistry> {
  hass.answerWS = () => Promise.resolve(structuredClone(list));
  registry.start();
  await vi.advanceTimersByTimeAsync(0);
  return registry;
}

/** One raw entry with every field the parser reads, changed by `overrides`. */
function raw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    entity_id: "sensor.robot_one_battery",
    id: "0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f",
    platform: "roomba_plus",
    device_id: "01010101010101010101010101010101",
    area_id: null,
    disabled_by: null,
    hidden_by: null,
    unique_id: "roomba_plus_ROBOTBLID0001_battery",
    translation_key: null,
    has_entity_name: true,
    ...overrides,
  };
}

expectNoConsoleOutput();

beforeEach(() => {
  vi.useFakeTimers();
  hass = new FakeFrontendHass();
  registry = createEntityRegistry(() => hass);
});

afterEach(() => {
  registry.stop();
  vi.useRealTimers();
});

describe("createEntityRegistry", () => {
  it("lists config/entity_registry/list and follows entity_registry_updated", async () => {
    registry.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(hass.wsCalls).toStrictEqual([{ type: "config/entity_registry/list" }]);
    expect(hass.connection.subscriptions.map((s) => s.eventType)).toStrictEqual(["entity_registry_updated"]);
    expect(registry.version()).toHaveLength(entityRegistryList.length);
  });

  it("debounces updates on the injected schedule", async () => {
    const waits: number[] = [];
    const injected = createEntityRegistry(
      () => hass,
      (_, ms) => {
        waits.push(ms);
        return () => {};
      },
    );
    injected.start();
    await vi.advanceTimersByTimeAsync(0);
    hass.connection.emit("entity_registry_updated");
    expect(waits).toStrictEqual([500]);
    injected.stop();
  });

  it("is empty until the first fetch", () => {
    expect(registry.version()).toBeUndefined();
    expect(registry.entry("vacuum.robot_one")).toBeUndefined();
    expect(registry.byPlatform("roomba_plus")).toStrictEqual([]);
  });

  it("reads each entry into exactly the fields the card uses", async () => {
    await loaded([raw(), raw({ entity_id: "vacuum.robot_one", options: { vacuum: { area_mapping: {} } } })]);
    expect(Object.keys(registry.entry("sensor.robot_one_battery") ?? {}).sort()).toStrictEqual(BASE_KEYS);
    expect(Object.keys(registry.entry("vacuum.robot_one") ?? {}).sort()).toStrictEqual(
      [...BASE_KEYS, "rawVacuumOptions"].sort(),
    );
    expect(registry.entry("sensor.robot_one_battery")).toStrictEqual({
      entityId: "sensor.robot_one_battery",
      registryId: "0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f",
      platform: "roomba_plus",
      deviceId: "01010101010101010101010101010101",
      areaId: null,
      disabled: false,
      uniqueId: "roomba_plus_ROBOTBLID0001_battery",
      translationKey: null,
    });
  });

  it("keeps the raw options.vacuum of the fixture vacuum, unparsed", async () => {
    await loaded(entityRegistryList);
    const vacuum = entityRegistryList.find((e) => e.entity_id === "vacuum.robot_one");
    expect(registry.entry("vacuum.robot_one")?.rawVacuumOptions).toStrictEqual(vacuum?.options.vacuum);
    expect(registry.entry("vacuum.robot_one")).toMatchObject({ disabled: false, platform: "roomba_plus" });
  });

  it("keeps the disabled floor plan, with disabled true", async () => {
    await loaded(floorPlanDisabled);
    expect(registry.entry("image.robot_one_floor_plan_mapb_z9x8c7")).toMatchObject({
      disabled: true,
      translationKey: "floor_plan",
      uniqueId: "roomba_plus_ROBOTBLID0001_floor_plan_MapB_z9X8c7",
    });
  });

  it("keeps list order in byPlatform", async () => {
    await loaded(entityRegistryList);
    expect(registry.byPlatform("roomba_plus").map((e) => e.entityId)).toStrictEqual(
      entityRegistryList.filter((e) => e.platform === "roomba_plus").map((e) => e.entity_id),
    );
    expect(registry.byPlatform("other")).toStrictEqual([]);
  });

  it.each<[string, unknown]>([
    ["hass", "hass"],
    ["user", "user"],
    ["an unknown value", "someday"],
  ])("reads disabled_by %s as disabled", async (_, disabledBy) => {
    await loaded([raw({ disabled_by: disabledBy })]);
    expect(registry.entry("sensor.robot_one_battery")?.disabled).toBe(true);
  });

  it("keeps hidden entities and never reads has_entity_name or hidden_by", async () => {
    const read: (string | symbol)[] = [];
    const entry = new Proxy(raw({ hidden_by: "user" }), {
      getOwnPropertyDescriptor(target, key) {
        read.push(key);
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    hass.answerWS = () => Promise.resolve([entry]);
    registry.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(registry.entry("sensor.robot_one_battery")).toBeDefined();
    expect(read).toContain("entity_id");
    expect(read).not.toContain("has_entity_name");
    expect(read).not.toContain("hidden_by");
  });
});

describe("defensive parsing", () => {
  it("treats a non-array response as a failed fetch", async () => {
    await loaded({ entities: [] });
    expect(registry.version()).toBeUndefined();
  });

  it.each<[string, unknown]>([
    ["not an object", "vacuum.robot_one"],
    ["null", null],
    ["without a string entity_id", raw({ entity_id: 3 })],
    ["without a platform", raw({ platform: undefined })],
    ["without a string id", raw({ id: null })],
    ["with an over-cap entity_id", raw({ entity_id: `sensor.${"x".repeat(MAX_TEXT_LENGTH)}` })],
  ])("skips an entry %s", async (_, entry) => {
    await loaded([entry, raw({ entity_id: "sensor.kept" })]);
    expect(registry.version()?.map((e) => e.entityId)).toStrictEqual(["sensor.kept"]);
  });

  it("drops over-cap or non-string optional fields, never cuts them", async () => {
    const long = "x".repeat(MAX_TEXT_LENGTH + 1);
    await loaded([raw({ unique_id: long, area_id: long, device_id: long, translation_key: long })]);
    expect(registry.entry("sensor.robot_one_battery")).toMatchObject({
      uniqueId: undefined,
      areaId: null,
      deviceId: null,
      translationKey: null,
    });
  });

  it("reads non-string optional fields, and an empty area_id, as absent", async () => {
    await loaded([raw({ unique_id: 1, area_id: "", device_id: 7, translation_key: false })]);
    expect(registry.entry("sensor.robot_one_battery")).toMatchObject({
      uniqueId: undefined,
      areaId: null,
      deviceId: null,
      translationKey: null,
    });
  });

  it("reads no inherited property", async () => {
    const entry = Object.assign(Object.create({ platform: "roomba_plus" }), raw({ platform: undefined }));
    await loaded([entry]);
    expect(registry.version()).toStrictEqual([]);
  });

  it("keeps the first of two entries with the same entity_id", async () => {
    await loaded([raw({ id: "first" }), raw({ id: "second" })]);
    expect(registry.entry("sensor.robot_one_battery")?.registryId).toBe("first");
  });

  it("reads options.vacuum as undefined when options is not an object", async () => {
    await loaded([raw({ entity_id: "vacuum.robot_one", options: "odd" })]);
    expect(registry.entry("vacuum.robot_one")).toHaveProperty("rawVacuumOptions", undefined);
  });
});

describe("version and equality", () => {
  async function refetchWith(list: unknown): Promise<void> {
    hass.answerWS = () => Promise.resolve(structuredClone(list));
    hass.connection.emit("entity_registry_updated");
    await vi.advanceTimersByTimeAsync(500);
  }

  it("keeps the same list object on an equal re-fetch", async () => {
    await loaded(entityRegistryList);
    const first = registry.version();
    await refetchWith(entityRegistryList);
    expect(registry.version()).toBe(first);
  });

  it.each<[string, Record<string, unknown>]>([
    ["entity_id", { entity_id: "sensor.renamed" }],
    ["id", { id: "other" }],
    ["platform", { platform: "other" }],
    ["device_id", { device_id: null }],
    ["area_id", { area_id: "library" }],
    ["disabled_by", { disabled_by: "user" }],
    ["unique_id", { unique_id: "other" }],
    ["translation_key", { translation_key: "battery" }],
  ])("replaces the list when %s changes", async (_, change) => {
    const changes = vi.fn();
    registry.onChange(changes);
    await loaded([raw()]);
    await refetchWith([raw(change)]);
    expect(changes).toHaveBeenCalledTimes(2);
  });

  it("compares options.vacuum structurally", async () => {
    const changes = vi.fn();
    registry.onChange(changes);
    const vacuum = (mapping: unknown) => raw({ entity_id: "vacuum.robot_one", options: { vacuum: mapping } });
    await loaded([vacuum({ area_mapping: { library: ["1"] } })]);
    await refetchWith([vacuum({ area_mapping: { library: ["1"] } })]);
    expect(changes).toHaveBeenCalledTimes(1);
    await refetchWith([vacuum({ area_mapping: { library: ["2"] } })]);
    expect(changes).toHaveBeenCalledTimes(2);
    expect(registry.entry("vacuum.robot_one")?.rawVacuumOptions).toStrictEqual({ area_mapping: { library: ["2"] } });
  });

  it("replaces the list when an entry is added or removed", async () => {
    await loaded([raw()]);
    const first = registry.version();
    await refetchWith([raw(), raw({ entity_id: "sensor.new" })]);
    expect(registry.version()).not.toBe(first);
    expect(registry.entry("sensor.new")).toBeDefined();
  });
});
