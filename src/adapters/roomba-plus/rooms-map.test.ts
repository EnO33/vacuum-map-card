import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeFrontendHass } from "../../../test/fakes/frontend-hass";
import registryList from "../../../test/fixtures/roomba-plus/entity_registry_list.json" with { type: "json" };
import mopPending from "../../../test/fixtures/roomba-plus/hass_state_rooms_map_mop_pending.json" with { type: "json" };
import aligned from "../../../test/fixtures/roomba-plus/hass_state_rooms_map_vacuum_aligned.json" with { type: "json" };
import noCloud from "../../../test/fixtures/roomba-plus/synthetic/hass_state_rooms_map_no_cloud.json" with {
  type: "json",
};
import withoutOutline from "../../../test/fixtures/roomba-plus/synthetic/hass_state_rooms_map_room_without_outline.json" with {
  type: "json",
};
import threeRooms from "../../../test/fixtures/roomba-plus/synthetic/hass_state_rooms_map_three_rooms.json" with {
  type: "json",
};
import { loadedRegistry } from "../../../test/helpers/entity-registry";
import { expectNoConsoleOutput } from "../../../test/helpers/no-console";
import { buildRoomsPlan } from "../../domain/plan/rooms-plan";
import type { EntityRegistry } from "../hass/entity-registry";
import { findRobots, type RobotEntities } from "./robot-entities";
import { roomsMapReader } from "./rooms-map";

let hass: FakeFrontendHass;
const registries: EntityRegistry[] = [];

async function robotsOf(list: unknown): Promise<readonly RobotEntities[]> {
  const registry = await loadedRegistry(hass, list);
  registries.push(registry);
  return findRobots(registry);
}

/** Robot one of the fixture registry, its rooms map state set to `state`. */
async function robotOne(state: unknown): Promise<RobotEntities> {
  hass.states = state === undefined ? {} : { "image.robot_one_rooms_map": structuredClone(state) };
  const [one] = await robotsOf(registryList);
  if (one === undefined) throw new Error("no robot");
  return one;
}

expectNoConsoleOutput();

beforeEach(() => {
  vi.useFakeTimers();
  hass = new FakeFrontendHass();
});

afterEach(() => {
  for (const registry of registries.splice(0)) registry.stop();
  vi.useRealTimers();
});

describe("roomsMapReader", () => {
  it("is undefined for a robot without a rooms map entry", async () => {
    const [one] = await robotsOf(registryList.filter((e) => e.translation_key !== "rooms_map"));
    expect(one && roomsMapReader(() => hass)(one)).toBeUndefined();
  });

  it("reports the entity, its picture state and no shown map for two stored maps", async () => {
    const roomsMap = roomsMapReader(() => hass)(await robotOne(aligned));
    expect(roomsMap).toMatchObject({
      imageEntityId: "image.robot_one_rooms_map",
      pictureState: "available",
      shownMapId: undefined,
      content: { kind: "snapshot" },
    });
  });

  it("reports the map id of the robot's only floor plan as the shown map", async () => {
    const list = registryList.filter((e) => e.entity_id !== "image.robot_one_floor_plan_mapb_z9x8c7");
    hass.states = { "image.robot_one_rooms_map": structuredClone(aligned) };
    const [one] = await robotsOf(list);
    expect(one && roomsMapReader(() => hass)(one)?.shownMapId).toBe("MapA_q1W2e3");
  });

  it.each<[string, string | null]>([
    ["an orphan with an unmatched unique_id", "roomba_plus_OTHER_floor_plan_MapX"],
    ["an orphan without unique_id", null],
  ])("reports no shown map when a second floor plan entry is %s", async (_, uniqueId) => {
    const orphan = {
      ...registryList.find((e) => e.entity_id === "image.robot_one_floor_plan_mapb_z9x8c7"),
      unique_id: uniqueId,
    };
    const list = registryList.filter((e) => e.entity_id !== "image.robot_one_floor_plan_mapb_z9x8c7");
    hass.states = { "image.robot_one_rooms_map": structuredClone(aligned) };
    const [one] = await robotsOf([...list, orphan]);
    expect(one?.floorPlans).toHaveLength(2);
    expect(one && roomsMapReader(() => hass)(one)?.shownMapId).toBeUndefined();
  });

  it("reports no shown map when the only floor plan entry gives no stored map", async () => {
    const list = registryList
      .filter((e) => e.entity_id !== "image.robot_one_floor_plan_mapb_z9x8c7")
      .map((e) => (e.entity_id === "image.robot_one_floor_plan_mapa_q1w2e3" ? { ...e, unique_id: "orphan" } : e));
    hass.states = { "image.robot_one_rooms_map": structuredClone(aligned) };
    const [one] = await robotsOf(list);
    expect(one && roomsMapReader(() => hass)(one)?.shownMapId).toBeUndefined();
  });

  it("is no_outlines with an unknown picture when the entity has no state", async () => {
    expect(roomsMapReader(() => hass)(await robotOne(undefined))).toMatchObject({
      pictureState: "unknown",
      content: { kind: "no_outlines" },
    });
  });

  it("reads a disabled rooms map as disabled with no outlines, even with a state", async () => {
    const list = registryList.map((e) => (e.translation_key === "rooms_map" ? { ...e, disabled_by: "user" } : e));
    hass.states = { "image.robot_one_rooms_map": structuredClone(aligned) };
    const [one] = await robotsOf(list);
    expect(one && roomsMapReader(() => hass)(one)).toMatchObject({
      pictureState: "disabled",
      content: { kind: "no_outlines" },
    });
  });

  it("keeps the same content object for the same state object, and reads hass on each call", async () => {
    const one = await robotOne(aligned);
    const read = roomsMapReader(() => hass);
    const first = read(one)?.content;
    expect(read(one)?.content).toBe(first);
    hass.states = { "image.robot_one_rooms_map": structuredClone(aligned) };
    expect(read(one)?.content).not.toBe(first);
    expect(read(one)?.content).toStrictEqual(first);
  });
});

describe("fixtures", () => {
  it.each<[string, unknown, readonly string[]]>([
    ["the aligned vacuum capture", aligned, ["1"]],
    ["the mop capture", mopPending, ["1"]],
    ["the three rooms synthetic", threeRooms, ["1", "2", "3"]],
  ])("builds a plan from %s, rooms in attribute order", async (_, state, regionIds) => {
    const content = roomsMapReader(() => hass)(await robotOne(state))?.content;
    if (content?.kind !== "snapshot") throw new Error("no snapshot");
    expect(content.snapshot.rooms.map((r) => r.regionId)).toStrictEqual(regionIds);
    expect(buildRoomsPlan(content.snapshot).kind).toBe("plan");
  });

  it("reads the no-cloud synthetic as no_outlines", async () => {
    expect(roomsMapReader(() => hass)(await robotOne(noCloud))?.content).toStrictEqual({ kind: "no_outlines" });
  });

  it("reads the room without outline without one", async () => {
    const content = roomsMapReader(() => hass)(await robotOne(withoutOutline))?.content;
    expect(content?.kind === "snapshot" && content.snapshot.rooms.map((r) => r.outline === undefined)).toStrictEqual([
      false,
      true,
    ]);
  });
});
