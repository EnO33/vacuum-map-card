import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeRoomSource } from "../../../test/fakes/fake-room-source";
import { FakeFrontendHass } from "../../../test/fakes/frontend-hass";
import entityRegistryList from "../../../test/fixtures/ha-core/entity_registry_list.json" with { type: "json" };
import hassDevices from "../../../test/fixtures/ha-core/hass_devices.json" with { type: "json" };
import registryList from "../../../test/fixtures/roomba-plus/entity_registry_list.json" with { type: "json" };
import floorPlanDisabled from "../../../test/fixtures/roomba-plus/synthetic/entity_registry_list_floor_plan_disabled.json" with {
  type: "json",
};
import { loadedRegistry } from "../../../test/helpers/entity-registry";
import { expectNoConsoleOutput } from "../../../test/helpers/no-console";
import { roombaPlusStates } from "../../../test/helpers/roomba-plus-states";
import type { RoomSource, SourceRobot } from "../../app/ports/room-source";
import { sameRoomsSnapshot } from "../../domain/plan/rooms-map-snapshot";
import type { EntityRegistry } from "../hass/entity-registry";
import { createRoombaPlusSource } from "./roomba-plus-source";

let hass: FakeFrontendHass;
const registries: EntityRegistry[] = [];
let states: Record<string, unknown>;
let devices: Record<string, unknown>;

/** Replaces `hass.states` with a new object; `entityId`, when given, gets a new state object. */
function newStates(entityId?: string): void {
  states = entityId === undefined ? { ...states } : { ...states, [entityId]: roombaPlusStates()[entityId] };
  hass.states = states;
}

/** Replaces `hass.devices` with a new object holding `changes`. */
function newDevices(changes: Record<string, unknown> = {}): void {
  devices = { ...devices, ...changes };
  hass.devices = devices;
}

async function sourceOn(list: unknown) {
  const registry = await loadedRegistry(hass, list);
  registries.push(registry);
  return { registry, source: createRoombaPlusSource({ registry, getHass: () => hass }) };
}

/** Every `last_seen_segments` id of the fixture vacuum. */
const lastSeenIds = (
  entityRegistryList.find((e) => e.entity_id === "vacuum.robot_one")?.options.vacuum?.last_seen_segments ?? []
).map((s) => s.id);

expectNoConsoleOutput();

beforeEach(() => {
  vi.useFakeTimers();
  hass = new FakeFrontendHass();
  states = roombaPlusStates();
  hass.states = states;
  devices = structuredClone(hassDevices);
  hass.devices = devices;
});

afterEach(() => {
  for (const registry of registries.splice(0)) registry.stop();
  vi.useRealTimers();
});

describe("createRoombaPlusSource", () => {
  it("satisfies RoomSource for roomba_plus", async () => {
    const { source } = await sourceOn(registryList);
    const typed: RoomSource = source;
    expect(typed.integration).toBe("roomba_plus");
  });

  it("returns one frozen empty array before the registry list is read", () => {
    const source = createRoombaPlusSource({
      registry: { version: () => undefined, entry: () => undefined, byPlatform: () => [], onChange: () => () => {} },
      getHass: () => hass,
    });
    expect(source.robots()).toStrictEqual([]);
    expect(source.robots()).toBe(source.robots());
    expect(Object.isFrozen(source.robots())).toBe(true);
  });

  it("binds each robot's functions to its own maps and vacuum", async () => {
    const { source } = await sourceOn(registryList);
    const [one, two] = source.robots();
    expect(one?.mapOfSegment("MapA_q1W2e3_zid_2")).toBe("MapA_q1W2e3");
    expect(one?.mapOfSegment("MapC_k4L5m6_1")).toBeUndefined();
    expect(two?.segmentOf("MapA_q1W2e3", "1")).toBeUndefined();
    expect(two?.roomAction("1")?.data).toStrictEqual({ entity_id: "vacuum.robot_two", room_name: "1" });
    expect(one?.roomActionMatchesNamesFirst).toBe(true);
    const mapUpdating = { code: "x", translationDomain: "roomba_plus", translationKey: "map_updating" };
    expect(one?.classifyError(mapUpdating)).toBe("map_updating");
  });

  it("lets nothing sensitive cross the port, and freezes each robot", async () => {
    const { source } = await sourceOn(registryList);
    const robots = source.robots();
    expect(robots.every((r) => Object.isFrozen(r))).toBe(true);
    const serialised = JSON.stringify(robots);
    for (const leak of ["access_token", "entity_picture", "ROBOTBLID", "unique", "attributes", "context"]) {
      expect(serialised).not.toContain(leak);
    }
  });
});

describe("robots() identity", () => {
  it("keeps the same array and robots while their sources keep their identity", async () => {
    const { source } = await sourceOn(registryList);
    const first = source.robots();
    expect(source.robots()).toBe(first);
    newStates();
    newDevices();
    expect(source.robots()).toBe(first);
  });

  it("renews only the robot whose rooms map state changed, as on a token rotation", async () => {
    const { source } = await sourceOn(registryList);
    const first = source.robots();
    newStates("image.robot_two_rooms_map");
    const next = source.robots();
    expect(next).not.toBe(first);
    expect(next[0]).toBe(first[0]);
    expect(next[1]).not.toBe(first[1]);
  });

  it.each<[string, string]>([
    ["vacuum", "vacuum.robot_one"],
    ["floor plan", "image.robot_one_floor_plan_mapa_q1w2e3"],
    ["rooms map", "image.robot_one_rooms_map"],
  ])("renews a robot when its %s state object changes", async (_, entityId) => {
    const { source } = await sourceOn(registryList);
    const [one] = source.robots();
    newStates(entityId);
    expect(source.robots()[0]).not.toBe(one);
  });

  it("renews a robot when its select state or its device entry changes", async () => {
    const { source } = await sourceOn(registryList);
    const [, two] = source.robots();
    newStates("select.robot_two_prime_cleaning_mode");
    const afterSelect = source.robots()[1];
    expect(afterSelect).not.toBe(two);
    newDevices({ "02020202020202020202020202020202": { model_id: "m6" } });
    expect(source.robots()[1]).not.toBe(afterSelect);
  });

  it("builds robots without hass.devices, and keeps them while it stays missing", async () => {
    hass.devices = undefined;
    const { source } = await sourceOn(registryList);
    const first = source.robots();
    expect(first.map((r) => r.action)).toStrictEqual(["vacuum", "mop"]);
    newStates();
    expect(source.robots()).toBe(first);
  });

  it("renews every robot when the registry list object changes", async () => {
    const { registry, source } = await sourceOn(registryList);
    const first = source.robots();
    const before = registry.version();
    const replaced = new Set(floorPlanDisabled.map((e) => e.entity_id));
    const disabledList = [...registryList.filter((e) => !replaced.has(e.entity_id)), ...floorPlanDisabled];
    hass.answerWS = () => Promise.resolve(structuredClone(disabledList));
    hass.connection.emit("entity_registry_updated");
    await vi.advanceTimersByTimeAsync(500);
    expect(registry.version()).not.toBe(before);
    expect(source.robots()).not.toBe(first);
    expect(source.robots()[1]).not.toBe(first[1]);
  });
});

describe("parity with FakeRoomSource", () => {
  const comparable = (robot: SourceRobot | undefined) =>
    robot && { vacuumEntityId: robot.vacuumEntityId, action: robot.action, storedMaps: robot.storedMaps };

  it.each<[string, boolean]>([
    ["the fixtures", false],
    ["the fixtures with the disabled floor plan", true],
  ])("reports what the fake reports on %s", async (_, disabled) => {
    const replaced = new Set(floorPlanDisabled.map((e) => e.entity_id));
    const list = disabled
      ? [...registryList.filter((e) => !replaced.has(e.entity_id)), ...floorPlanDisabled]
      : registryList;
    const real = (await sourceOn(list)).source.robots();
    const expected = new FakeRoomSource({ disabledFloorPlans: disabled }).robots();
    expect(real).toHaveLength(expected.length);
    for (const [i, robot] of real.entries()) {
      const twin = expected[i];
      expect(comparable(robot)).toStrictEqual(comparable(twin));
      const content = robot.roomsMap?.content;
      const twinContent = twin?.roomsMap?.content;
      const same =
        content?.kind === "snapshot" &&
        twinContent?.kind === "snapshot" &&
        sameRoomsSnapshot(content.snapshot, twinContent.snapshot);
      expect(same).toBe(true);
      expect(robot.roomAction("1")).toStrictEqual(twin?.roomAction("1"));
    }
    for (const id of lastSeenIds) expect(real[0]?.mapOfSegment(id)).toBe(expected[0]?.mapOfSegment(id));
    expect(real[0]?.segmentOf("MapA_q1W2e3", "1")).toBe(expected[0]?.segmentOf("MapA_q1W2e3", "1"));
    // Intended difference: the fake builds a segment id from any map id; the real source only from the robot's own
    // maps (ADR 0003 « Checks before calling »), so robot two refuses robot one's map.
    expect(expected[1]?.segmentOf("MapA_q1W2e3", "1")).toBe("MapA_q1W2e3_1");
    expect(real[1]?.segmentOf("MapA_q1W2e3", "1")).toBeUndefined();
  });
});
