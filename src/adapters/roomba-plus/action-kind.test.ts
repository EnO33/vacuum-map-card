import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeRoomSource } from "../../../test/fakes/fake-room-source";
import { FakeFrontendHass } from "../../../test/fakes/frontend-hass";
import registryList from "../../../test/fixtures/roomba-plus/entity_registry_list.json" with { type: "json" };
import selectState from "../../../test/fixtures/roomba-plus/hass_state_select_mop_cleaning_mode.json" with {
  type: "json",
};
import vacuumStates from "../../../test/fixtures/roomba-plus/hass_states_vacuum.json" with { type: "json" };
import { loadedRegistry } from "../../../test/helpers/entity-registry";
import { expectNoConsoleOutput } from "../../../test/helpers/no-console";
import type { ActionKind } from "../../domain/robot/action-kind";
import type { EntityRegistry } from "../hass/entity-registry";
import { actionKindOf } from "./action-kind";
import { findRobots } from "./robot-entities";

const ROBOT = "vacuum.robot_one";
const SELECT = "select.robot_one_prime_cleaning_mode";
const DEVICE = "01010101010101010101010101010101";
const MODES = ["vacuum", "mop", "vacuum_and_mop", "vacuum_then_mop"];

let hass: FakeFrontendHass;
const registries: EntityRegistry[] = [];

async function actionOf(list: unknown, entityId: string): Promise<ActionKind | undefined> {
  const registry = await loadedRegistry(hass, list);
  registries.push(registry);
  const robot = findRobots(registry).find((r) => r.vacuum.entityId === entityId);
  return robot && actionKindOf(robot, () => hass);
}

/** Robot one with a cleaning mode select, or without one. */
function robotOne(withSelect: boolean): Record<string, unknown>[] {
  const vacuum = {
    entity_id: ROBOT,
    id: "03",
    platform: "roomba_plus",
    device_id: DEVICE,
    unique_id: "roomba_plus_B1",
  };
  const select = { ...vacuum, entity_id: SELECT, id: "04", translation_key: "prime_cleaning_mode", unique_id: "x" };
  return withSelect ? [vacuum, select] : [vacuum];
}

interface Case {
  readonly attributes?: Record<string, unknown>;
  readonly select?: unknown;
  readonly withSelect?: boolean;
  readonly device?: unknown;
}

/** The action of robot one in the state `c` describes. */
async function decide(c: Case): Promise<ActionKind | undefined> {
  hass.states = {
    [ROBOT]: { state: "docked", attributes: c.attributes ?? {} },
    ...(c.select === undefined ? {} : { [SELECT]: c.select }),
  };
  hass.devices = c.device === undefined ? {} : { [DEVICE]: c.device };
  return actionOf(robotOne(c.withSelect ?? true), ROBOT);
}

const select = (state: unknown, options: unknown = MODES) => ({ state, attributes: { options } });

expectNoConsoleOutput();

beforeEach(() => {
  vi.useFakeTimers();
  hass = new FakeFrontendHass();
});

afterEach(() => {
  for (const registry of registries.splice(0)) registry.stop();
  vi.useRealTimers();
});

describe("actionKindOf", () => {
  it.each<[string, Case, ActionKind]>([
    [
      "step 1: a detected_pad key, even null, over everything",
      { attributes: { detected_pad: null }, select: select("vacuum") },
      "mop",
    ],
    ["step 2: select vacuum", { select: select("vacuum") }, "vacuum"],
    ["step 2: select mop", { select: select("mop") }, "mop"],
    ["step 2: select vacuum_and_mop", { select: select("vacuum_and_mop") }, "vacuum_and_mop"],
    ["step 2: select vacuum_then_mop", { select: select("vacuum_then_mop") }, "vacuum_then_mop"],
    ["step 2: select unknown with vacuum and mop options", { select: select("unknown") }, "clean"],
    ["step 2: select unavailable with vacuum and mop options", { select: select("unavailable") }, "clean"],
    ["step 2: no select state, so options unknown, then nothing", { device: undefined }, "clean"],
    ["step 2: non-string options ignored", { select: select("unknown", [1, "vacuum", null, "mop"]) }, "clean"],
    ["step 3: no select", { withSelect: false }, "vacuum"],
    ["step 3: no select, even with a mop SKU", { withSelect: false, device: { model_id: "m611" } }, "vacuum"],
    [
      "step 4: unknown select without mop option, SKU m",
      { select: select("unknown", ["vacuum"]), device: { model_id: "m611" } },
      "mop",
    ],
    [
      "step 4: a select state naming no mode, SKU s",
      { select: select("turbo"), device: { model_id: "s955" } },
      "vacuum",
    ],
    [
      "step 4: model when model_id is not a string",
      { select: select("turbo"), device: { model_id: 3, model: "m611" } },
      "mop",
    ],
    [
      "step 4: model when model_id is empty",
      { select: select("turbo"), device: { model_id: "", model: "i755" } },
      "vacuum",
    ],
    [
      "step 4: a non-string select state, SKU m",
      { select: { state: 3, attributes: { options: MODES } }, device: { model_id: "m611" } },
      "mop",
    ],
    [
      "nothing readable: an unknown select without attributes",
      { select: { state: "unknown", attributes: null } },
      "clean",
    ],
    ["step 4: a select without state, SKU m", { device: { model_id: "m611" } }, "mop"],
    [
      "step 4: an upper-case M SKU, as the integration reads it",
      { select: select("turbo"), device: { model_id: "M611" } },
      "mop",
    ],
    [
      "step 4: model_id wins over model",
      { select: select("turbo"), device: { model_id: "s955", model: "m611" } },
      "vacuum",
    ],
    ["nothing readable: no SKU", { select: select("turbo"), device: { model: "" } }, "clean"],
    ["nothing readable: options not an array", { select: select("unknown", "vacuum,mop"), device: undefined }, "clean"],
  ])("%s", async (_, c, expected) => {
    expect(await decide(c)).toBe(expected);
  });

  it("goes to the SKU, not to vacuum only, when the device has two cleaning mode selects", async () => {
    const twoSelects = [
      ...robotOne(true),
      { ...robotOne(true)[1], entity_id: "select.robot_one_second_mode", id: "05" },
    ];
    hass.states = {};
    hass.devices = { [DEVICE]: { model_id: "m611" } };
    expect(await actionOf(twoSelects, ROBOT)).toBe("mop");
  });

  it("reads only own keys of hass.states and hass.devices", async () => {
    hass.states = Object.create({ [ROBOT]: { state: "docked", attributes: { detected_pad: "x" } } });
    hass.devices = Object.create({ [DEVICE]: { model_id: "m611" } });
    expect(await actionOf(robotOne(true), ROBOT)).toBe("clean");
    hass.states = { [ROBOT]: { state: "docked", attributes: Object.create({ detected_pad: "x" }) } };
    expect(await actionOf(robotOne(false), ROBOT)).toBe("vacuum");
  });

  it("has no SKU without hass.devices or a device id", async () => {
    hass.states = { [SELECT]: select("turbo") };
    hass.devices = undefined;
    expect(await actionOf(robotOne(true), ROBOT)).toBe("clean");
    hass.devices = { [DEVICE]: { model_id: "m611" } };
    const noDevice = robotOne(true).map((e) => ({ ...e, device_id: null }));
    expect(await actionOf(noDevice, ROBOT)).toBe("vacuum");
  });
});

describe("fixtures", () => {
  it("gives the actions FakeRoomSource hard-codes", async () => {
    hass.states = { ...structuredClone(vacuumStates), [selectState.entity_id]: structuredClone(selectState) };
    const actions = [
      await actionOf(registryList, "vacuum.robot_one"),
      await actionOf(registryList, "vacuum.robot_two"),
    ];
    expect(actions).toStrictEqual(["vacuum", "mop"]);
    const fake = new FakeRoomSource();
    expect(fake.robots().map((r) => r.action)).toStrictEqual(actions);
  });
});
