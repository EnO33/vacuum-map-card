import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeFrontendHass } from "../../../test/fakes/frontend-hass";
import registryList from "../../../test/fixtures/roomba-plus/entity_registry_list.json" with { type: "json" };
import floorPlanStates from "../../../test/fixtures/roomba-plus/hass_states_floor_plans.json" with { type: "json" };
import floorPlanDisabled from "../../../test/fixtures/roomba-plus/synthetic/entity_registry_list_floor_plan_disabled.json" with {
  type: "json",
};
import { loadedRegistry } from "../../../test/helpers/entity-registry";
import { expectNoConsoleOutput } from "../../../test/helpers/no-console";
import { fixtureMaps } from "../../../test/helpers/stored-maps";
import { MAX_TEXT_LENGTH } from "../../domain/text/limits";
import type { EntityRegistry } from "../hass/entity-registry";
import { findRobots } from "./robot-entities";
import { storedMapsOf } from "./stored-maps";

const VACUUM = {
  entity_id: "vacuum.robot_one",
  id: "03030303030303030303030303030303",
  platform: "roomba_plus",
  device_id: "01010101010101010101010101010101",
  translation_key: null,
  unique_id: "roomba_plus_ROBOTBLID0001",
};

let hass: FakeFrontendHass;
const registries: EntityRegistry[] = [];

/** A floor plan of robot one whose `unique_id` ends with `suffix`. */
function floorPlan(entityId: string, suffix: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...VACUUM,
    entity_id: entityId,
    id: `id_${entityId}`,
    translation_key: "floor_plan",
    unique_id: `roomba_plus_ROBOTBLID0001_floor_plan_${suffix}`,
    ...overrides,
  };
}

/** The stored maps of every robot of `list`, keyed by vacuum entity id. */
async function mapsOf(list: unknown) {
  const registry = await loadedRegistry(hass, list);
  registries.push(registry);
  const robots = findRobots(registry);
  return new Map(robots.map((robot) => [robot.vacuum.entityId, storedMapsOf(robot, () => hass)]));
}

expectNoConsoleOutput();

beforeEach(() => {
  vi.useFakeTimers();
  hass = new FakeFrontendHass();
  hass.states = structuredClone(floorPlanStates);
});

afterEach(() => {
  for (const registry of registries.splice(0)) registry.stop();
  vi.useRealTimers();
});

describe("storedMapsOf, fixtures", () => {
  it("gives the fixture maps of both robots, as FakeRoomSource has them", async () => {
    const maps = await mapsOf(registryList);
    expect(maps.get("vacuum.robot_one")).toStrictEqual([fixtureMaps.mapA, fixtureMaps.mapB]);
    expect(maps.get("vacuum.robot_two")).toStrictEqual([fixtureMaps.mapC, fixtureMaps.mapD]);
    expect(maps.get("vacuum.robot_two")?.map((m) => m.mapName)).toStrictEqual(["Ground floor", "Upper level"]);
  });

  it("reads the disabled floor plan as disabled, without a name or an area, even with a state", async () => {
    const list = [VACUUM, floorPlan("image.robot_one_floor_plan_mapa_q1w2e3", "MapA_q1W2e3"), ...floorPlanDisabled];
    const [mapA, mapB] = (await mapsOf(list)).get("vacuum.robot_one") ?? [];
    expect(mapA?.pictureState).toBe("available");
    expect(mapB).toStrictEqual({
      floorPlanEntityId: "image.robot_one_floor_plan_mapb_z9x8c7",
      mapId: "MapB_z9X8c7",
      mapName: undefined,
      pictureState: "disabled",
      ownAreaId: null,
    });
  });

  it("carries no unique_id and no robot identifier", async () => {
    const serialised = JSON.stringify([...(await mapsOf(registryList)).values()]);
    expect(serialised).not.toMatch(/ROBOTBLID/i);
    expect(serialised).not.toMatch(/unique/i);
  });
});

describe("map names", () => {
  /** Robot one's map A, whose `map_name` is `name`. */
  async function nameOf(name: string, mapSuffix = "MapA_q1W2e3") {
    hass.states = { "image.plan": { state: "2026-01-01T09:30:00+00:00", attributes: { map_name: name } } };
    return (await mapsOf([VACUUM, floorPlan("image.plan", mapSuffix)])).get("vacuum.robot_one") ?? [];
  }

  it.each<[string, string]>([
    ["a Prime-like name holding the robot identifier", "ROBOTBLID0001-1767225600"],
    ["the identifier in lower case", "robotblid0001"],
    ["the map id in another case", "mapa_q1w2e3"],
  ])("hides %s", async (_, name) => {
    const maps = await nameOf(name);
    expect(maps.map((m) => m.mapName)).toStrictEqual([undefined]);
    expect(JSON.stringify(maps)).not.toMatch(/ROBOTBLID/i);
  });

  it("keeps a Prime map id whole, which may hold the robot identifier, and hides its fallback name", async () => {
    const maps = await nameOf("ROBOTBLID0001-1767225600", "ROBOTBLID0001-1767225600");
    expect(maps).toMatchObject([{ mapId: "ROBOTBLID0001-1767225600", mapName: undefined }]);
  });
});

describe("which floor plans count", () => {
  it.each<[string, Record<string, unknown>]>([
    ["a prefix of another robot", { unique_id: "roomba_plus_ROBOTBLID0002_floor_plan_MapC_k4L5m6" }],
    ["no unique_id", { unique_id: null }],
    ["an over-cap unique_id", { unique_id: `roomba_plus_ROBOTBLID0001_floor_plan_${"m".repeat(MAX_TEXT_LENGTH)}` }],
    ["an empty map id", { unique_id: "roomba_plus_ROBOTBLID0001_floor_plan_" }],
    ["an entity that is not an image", { entity_id: "sensor.plan" }],
  ])("skips a floor plan with %s", async (_, overrides) => {
    const maps = await mapsOf([VACUUM, floorPlan("image.plan", "MapA_q1W2e3", overrides)]);
    expect(maps.get("vacuum.robot_one")).toStrictEqual([]);
  });

  it("has no floor plans when the vacuum has no unique_id", async () => {
    const maps = await mapsOf([{ ...VACUUM, unique_id: null }, floorPlan("image.plan", "MapA_q1W2e3")]);
    expect(maps.get("vacuum.robot_one")).toStrictEqual([]);
  });

  it("keeps the map id's case and its own area", async () => {
    const maps = await mapsOf([VACUUM, floorPlan("image.plan", "MapA_q1W2e3", { area_id: "library" })]);
    expect(maps.get("vacuum.robot_one")).toMatchObject([{ mapId: "MapA_q1W2e3", ownAreaId: "library" }]);
  });
});

describe("picture state", () => {
  async function stateOf(state: unknown) {
    hass.states = state === undefined ? {} : { "image.plan": { state, attributes: { map_name: "Den" } } };
    const [map] = (await mapsOf([VACUUM, floorPlan("image.plan", "MapA_q1W2e3")])).get("vacuum.robot_one") ?? [];
    return map;
  }

  it.each<[string, unknown, string]>([
    ["a missing state", undefined, "unknown"],
    ["unavailable", "unavailable", "unavailable"],
    ["unknown", "unknown", "unknown"],
    ["a timestamp", "2026-01-01T09:30:00+00:00", "available"],
    ["a non-string state", 3, "unknown"],
  ])("reads %s", async (_, state, expected) => {
    expect((await stateOf(state))?.pictureState).toBe(expected);
  });

  it("reads the name of an unavailable entity that still has a state, and none without a state", async () => {
    expect((await stateOf("unavailable"))?.mapName).toBe("Den");
    expect((await stateOf(undefined))?.mapName).toBeUndefined();
  });

  it("reads unknown when hass.states is not an object", async () => {
    hass.states = null;
    const [map] = (await mapsOf([VACUUM, floorPlan("image.plan", "MapA_q1W2e3")])).get("vacuum.robot_one") ?? [];
    expect(map).toMatchObject({ pictureState: "unknown", mapName: undefined });
  });

  it("reads only own keys of hass.states", async () => {
    hass.states = Object.create({ "image.plan": { state: "2026", attributes: { map_name: "Den" } } });
    const [map] = (await mapsOf([VACUUM, floorPlan("image.plan", "MapA_q1W2e3")])).get("vacuum.robot_one") ?? [];
    expect(map).toMatchObject({ pictureState: "unknown", mapName: undefined });
  });
});
