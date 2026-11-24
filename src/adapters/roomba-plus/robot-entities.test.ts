import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeFrontendHass } from "../../../test/fakes/frontend-hass";
import registryList from "../../../test/fixtures/roomba-plus/entity_registry_list.json" with { type: "json" };
import { loadedRegistry } from "../../../test/helpers/entity-registry";
import type { EntityRegistry } from "../hass/entity-registry";
import { findRobots } from "./robot-entities";

let hass: FakeFrontendHass;

/** One raw registry entry on robot one's device. */
function entry(entityId: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    entity_id: entityId,
    id: `id_${entityId}`,
    platform: "roomba_plus",
    device_id: "01010101010101010101010101010101",
    translation_key: null,
    unique_id: `roomba_plus_ROBOTBLID0001_${entityId}`,
    ...overrides,
  };
}

const registries: EntityRegistry[] = [];

async function robotsOf(list: unknown) {
  const registry = await loadedRegistry(hass, list);
  registries.push(registry);
  return findRobots(registry);
}

beforeEach(() => {
  vi.useFakeTimers();
  hass = new FakeFrontendHass();
});

afterEach(() => {
  for (const registry of registries.splice(0)) registry.stop();
  vi.useRealTimers();
});

describe("findRobots", () => {
  it("finds the fixture robots in registry order, with their entities", async () => {
    const robots = await robotsOf(registryList);
    expect(robots.map((r) => r.vacuum.entityId)).toStrictEqual(["vacuum.robot_one", "vacuum.robot_two"]);
    const [one, two] = robots;
    expect(one?.floorPlans.map((e) => e.entityId)).toStrictEqual([
      "image.robot_one_floor_plan_mapa_q1w2e3",
      "image.robot_one_floor_plan_mapb_z9x8c7",
    ]);
    expect(one?.roomsMap?.entityId).toBe("image.robot_one_rooms_map");
    expect(one?.primeCleaningMode).toBeUndefined();
    expect(two?.roomsMap?.entityId).toBe("image.robot_two_rooms_map");
    expect(two?.primeCleaningMode?.entityId).toBe("select.robot_two_prime_cleaning_mode");
  });

  it("is empty before the registry list is read, and without roomba_plus vacuums", async () => {
    expect(
      findRobots({ version: () => undefined, entry: () => undefined, byPlatform: () => [], onChange: () => () => {} }),
    ).toStrictEqual([]);
    expect(await robotsOf([entry("vacuum.other", { platform: "other" })])).toStrictEqual([]);
  });

  it("finds entities by device and translation key, whatever their entity ids", async () => {
    const renamed = registryList.map((e, i) => ({ ...e, entity_id: `${e.entity_id.split(".")[0]}.renamed_${i}` }));
    const [one, two] = await robotsOf(renamed);
    expect(one?.vacuum.entityId).toBe("vacuum.renamed_0");
    expect(one?.floorPlans).toHaveLength(2);
    expect(one?.roomsMap).toBeDefined();
    expect(two?.primeCleaningMode).toBeDefined();
  });

  it("lists a disabled vacuum", async () => {
    const robots = await robotsOf([entry("vacuum.robot_one", { disabled_by: "user" })]);
    expect(robots.map((r) => r.vacuum.disabled)).toStrictEqual([true]);
  });

  it("does not take an entity whose id looks like a floor plan but whose translation key differs", async () => {
    const [one] = await robotsOf([
      entry("vacuum.robot_one"),
      entry("image.robot_one_floor_plan_mapa_q1w2e3", { translation_key: "map" }),
    ]);
    expect(one?.floorPlans).toStrictEqual([]);
  });

  it("takes a rooms map or a floor plan only from an image, and the mode only from a select", async () => {
    const [one] = await robotsOf([
      entry("vacuum.robot_one"),
      entry("sensor.a", { translation_key: "rooms_map" }),
      entry("sensor.b", { translation_key: "floor_plan" }),
      entry("image.c", { translation_key: "prime_cleaning_mode" }),
    ]);
    expect(one?.roomsMap).toBeUndefined();
    expect(one?.floorPlans).toStrictEqual([]);
    expect(one?.primeCleaningMode).toBeUndefined();
  });

  it("keeps a rooms map or a cleaning mode select only when there is exactly one", async () => {
    const [one] = await robotsOf([
      entry("vacuum.robot_one"),
      entry("image.a", { translation_key: "rooms_map" }),
      entry("image.b", { translation_key: "rooms_map" }),
      entry("select.a", { translation_key: "prime_cleaning_mode" }),
      entry("select.b", { translation_key: "prime_cleaning_mode" }),
    ]);
    expect(one?.roomsMap).toBeUndefined();
    expect(one?.primeCleaningMode).toBeUndefined();
  });

  it("gives a vacuum without device_id no related entity", async () => {
    const [one] = await robotsOf([
      entry("vacuum.robot_one", { device_id: null }),
      entry("image.loose", { device_id: null, translation_key: "floor_plan" }),
    ]);
    expect(one?.floorPlans).toStrictEqual([]);
    expect(one?.roomsMap).toBeUndefined();
  });

  it("takes only entities of the same device and platform", async () => {
    const [one] = await robotsOf([
      entry("vacuum.robot_one"),
      entry("image.other_device", { device_id: "02020202020202020202020202020202", translation_key: "floor_plan" }),
      entry("image.other_platform", { platform: "other", translation_key: "floor_plan" }),
    ]);
    expect(one?.floorPlans).toStrictEqual([]);
  });
});
