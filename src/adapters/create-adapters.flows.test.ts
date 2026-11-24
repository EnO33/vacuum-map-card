import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import repairs from "../../test/fixtures/ha-core/synthetic/repairs_list_issues.json" with { type: "json" };
import serviceErrors from "../../test/fixtures/ha-core/synthetic/service_errors.json" with { type: "json" };
import roomsMapOne from "../../test/fixtures/roomba-plus/hass_state_rooms_map_vacuum_aligned.json" with {
  type: "json",
};
import { type AdaptersHarness, adaptersHarness, registryList, started } from "../../test/helpers/adapters";
import { expectNoConsoleOutput } from "../../test/helpers/no-console";
import { buildFloorModel } from "../app/floor-model/build-floor-model";
import type { ItemRef } from "../app/robots-for-item/robots-for-item";
import { createCleanController } from "../app/start-clean/clean-controller";
import type { Intent, PrepareResult } from "../app/start-clean/intent";

const LIBRARY: ItemRef = { kind: "area", imageEntityId: "image.robot_one_floor_plan_mapa_q1w2e3", areaId: "library" };
const MOP_ROOM: ItemRef = { kind: "room", imageEntityId: "image.robot_two_rooms_map", regionId: "1" };

let harness: AdaptersHarness;

function prepared(result: PrepareResult): Intent {
  if (result.kind !== "intent") throw new Error(`not prepared: ${JSON.stringify(result)}`);
  return result.intent;
}

function controllerOf({ adapters }: AdaptersHarness) {
  return createCleanController({ hass: adapters.hass, sources: adapters.sources });
}

expectNoConsoleOutput();

beforeEach(async () => {
  vi.useFakeTimers();
  harness = await started(adaptersHarness());
});

afterEach(() => {
  harness.adapters.stop();
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
});

describe("prepare and confirm on the real adapters", () => {
  it("sends exactly one vacuum.clean_area for the library on vacuum.robot_one (path 1)", async () => {
    const controller = controllerOf(harness);
    const outcome = await controller.confirm(prepared(controller.prepare(LIBRARY, "vacuum.robot_one")));
    expect(outcome).toStrictEqual({ kind: "accepted" });
    expect(harness.hass.calls).toStrictEqual([
      ["vacuum", "clean_area", { cleaning_area_id: ["library"] }, { entity_id: "vacuum.robot_one" }, false, false],
    ]);
  });

  it("sends exactly one roomba_plus.clean_room for region 1 on vacuum.robot_two (path 2)", async () => {
    const controller = controllerOf(harness);
    const outcome = await controller.confirm(prepared(controller.prepare(MOP_ROOM, "vacuum.robot_two")));
    expect(outcome).toStrictEqual({ kind: "accepted" });
    expect(harness.hass.calls).toStrictEqual([
      ["roomba_plus", "clean_room", { entity_id: "vacuum.robot_two", room_name: "1" }, undefined, false, false],
    ]);
  });

  it("reports unknown_rooms as room_not_found, not started, sent once, without the known names", async () => {
    const unknownRooms = serviceErrors.find((r) => r.row.startsWith("Roomba+ unknown_rooms"));
    expect(unknownRooms).toBeDefined();
    harness.hass.behaviour = { kind: "reject", value: unknownRooms?.error };
    const controller = controllerOf(harness);
    const intent = prepared(controller.prepare(MOP_ROOM, "vacuum.robot_two"));
    const outcome = await controller.confirm(intent);
    expect(outcome).toStrictEqual({ kind: "error", error: { kind: "room_not_found", mayHaveStarted: "no" } });
    expect(await controller.confirm(intent)).toStrictEqual({ kind: "already_sent" });
    expect(harness.hass.calls).toHaveLength(1);
    expect(JSON.stringify([outcome, controller.outcomeOf("vacuum.robot_two")])).not.toMatch(/Larder|Snug|Orangery/);
  });
});

describe("updates", () => {
  it("enables a disabled floor plan after one debounced re-fetch, and notifies once", async () => {
    harness.adapters.stop();
    harness = await started(adaptersHarness({ disabledFloorPlan: true }));
    const mapB = () =>
      harness.adapters
        .sources()[0]
        ?.robots()[0]
        ?.storedMaps.find((m) => m.mapId === "MapB_z9X8c7");
    expect(mapB()?.pictureState).toBe("disabled");
    const listener = vi.fn();
    harness.adapters.hass.subscribe(listener);
    const fetches = harness.hass.wsCalls.length;
    harness.lists.set("config/entity_registry/list", registryList(false));
    harness.hass.connection.emit("entity_registry_updated");
    await vi.advanceTimersByTimeAsync(500);
    expect(harness.hass.wsCalls.length - fetches).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(mapB()?.pictureState).toBe("available");
  });

  it("confirms a prepared path 1 intent as changed once segments_changed opens, and sends nothing", async () => {
    const controller = controllerOf(harness);
    const intent = prepared(controller.prepare(LIBRARY, "vacuum.robot_one"));
    expect(harness.adapters.hass.segmentsChangedOpen("vacuum.robot_one")).toBe(false);
    harness.lists.set("repairs/list_issues", repairs);
    harness.hass.connection.emit("repairs_issue_registry_updated");
    await vi.advanceTimersByTimeAsync(500);
    expect(harness.adapters.hass.segmentsChangedOpen("vacuum.robot_one")).toBe(true);
    expect(await controller.confirm(intent)).toStrictEqual({ kind: "changed" });
    expect(harness.hass.calls).toStrictEqual([]);
  });

  it("keeps the plans equal on a token rotation, while pictureUrl gives the new token", async () => {
    const { hass, sources, pictureUrl } = harness.adapters;
    const before = buildFloorModel(hass, sources());
    const rotated = structuredClone(roomsMapOne);
    rotated.attributes.access_token = "rotated-token";
    harness.hass.states = { ...statesOf(harness), "image.robot_one_rooms_map": rotated };
    expect(buildFloorModel(hass, sources())).toEqual(before);
    expect(pictureUrl("image.robot_one_rooms_map")).toContain("token=rotated-token");
  });
});

/** The fake's current `hass.states`, as a record. */
function statesOf({ hass }: AdaptersHarness): Record<string, unknown> {
  const states: unknown = hass.states;
  return typeof states === "object" && states !== null ? { ...states } : {};
}
