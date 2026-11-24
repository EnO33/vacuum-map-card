import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeHass } from "../../test/fakes/fake-hass";
import { FakeRoomSource } from "../../test/fakes/fake-room-source";
import { type AdaptersHarness, adaptersHarness, started } from "../../test/helpers/adapters";
import { expectNoConsoleOutput } from "../../test/helpers/no-console";
import { buildFloorModel } from "../app/floor-model/build-floor-model";
import type { Plan } from "../app/floor-model/floor-model";
import type { DisplayPort } from "../app/ports/display-port";
import type { HassPort } from "../app/ports/hass-port";
import type { RoomSource } from "../app/ports/room-source";
import { createAdapters } from "./create-adapters";

/** Each plan as `[robot, picture, floor or "none"]`. */
const where = (plans: readonly Plan[]) =>
  plans.map((p) => [p.robot, p.imageEntityId, p.placement.kind === "floor" ? p.placement.floorId : "none"]);

let harness: AdaptersHarness;

expectNoConsoleOutput();

beforeEach(() => {
  vi.useFakeTimers();
  harness = adaptersHarness();
});

afterEach(() => {
  harness.adapters.stop();
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
});

describe("createAdapters", () => {
  it("gives a HassPort with the port's members only, and the Roomba+ source as the only one", () => {
    const { hass, sources } = harness.adapters;
    const port: HassPort = hass;
    expect(Object.keys(port).sort()).toStrictEqual([
      "areas",
      "callService",
      "floors",
      "hasService",
      "isAdmin",
      "segmentsChangedOpen",
      "subscribe",
      "vacuum",
      "vacuumOptions",
    ]);
    expect(Object.isFrozen(port)).toBe(true);
    const list: readonly RoomSource[] = sources();
    expect(list.map((s) => s.integration)).toStrictEqual(["roomba_plus"]);
    expect(sources()).toBe(list);
  });

  it("gives a DisplayPort with its two members only, over the live hass", () => {
    const display: DisplayPort = harness.adapters.display;
    expect(Object.keys(display).sort()).toStrictEqual(["language", "robotName"]);
    expect(Object.isFrozen(display)).toBe(true);
    harness.hass.locale = { language: "fr" };
    expect(display.language()).toBe("fr");
    expect(display.robotName("vacuum.robot_one")).toBe("Robot One");
  });

  it("names the supported integrations as their users know them, in a frozen list", () => {
    const { integrations } = harness.adapters;
    expect(integrations).toStrictEqual(["Roomba+"]);
    expect(Object.isFrozen(integrations)).toBe(true);
  });

  it("debounces updates on the injected timer", async () => {
    const waits: number[] = [];
    const adapters = createAdapters(() => harness.hass, {
      schedule: (_, ms) => {
        waits.push(ms);
        return () => {};
      },
    });
    try {
      adapters.start();
      await vi.advanceTimersByTimeAsync(0);
      harness.hass.connection.emit("floor_registry_updated");
      expect(waits).toStrictEqual([500]);
    } finally {
      adapters.stop();
    }
  });

  it("fetches and subscribes once, however often started, and releases everything on stop", async () => {
    harness.adapters.start();
    harness.adapters.start();
    await vi.advanceTimersByTimeAsync(0);
    harness.adapters.start();
    await vi.advanceTimersByTimeAsync(0);
    const { hass } = harness;
    expect(hass.wsCalls.map((m) => m.type).sort()).toStrictEqual([
      "config/entity_registry/list",
      "config/floor_registry/list",
      "repairs/list_issues",
    ]);
    expect(hass.connection.subscriptions).toHaveLength(3);
    expect(hass.connection.readyListeners).toBe(3);
    harness.adapters.stop();
    await vi.advanceTimersByTimeAsync(0);
    expect(hass.connection.subscriptions).toHaveLength(0);
    expect(hass.connection.unsubscribed).toBe(3);
    expect(hass.connection.readyListeners).toBe(0);
    const fetches = hass.wsCalls.length;
    harness.adapters.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(hass.wsCalls).toHaveLength(fetches);
    expect(hass.connection.subscriptions).toHaveLength(0);
  });
});

describe("before the lists load", () => {
  it("knows no floor, no robot, keeps path 1 on the safe side and calls nothing", () => {
    const { hass, sources } = harness.adapters;
    expect(hass.floors()).toBeUndefined();
    expect(hass.segmentsChangedOpen("vacuum.robot_one")).toBe(true);
    expect(sources()[0]?.robots()).toStrictEqual([]);
    const model = buildFloorModel(hass, sources());
    expect(model.loading).toBe(true);
    expect(model.floors).toStrictEqual([]);
    expect(harness.hass.calls).toStrictEqual([]);
  });
});

describe("after load, the floor model on the real adapters", () => {
  it("places plans as ADR 0005's examples", async () => {
    const { hass, sources } = (await started(harness)).adapters;
    const model = buildFloorModel(hass, sources());
    expect(model.loading).toBe(false);
    expect(model.floors.map((f) => [f.floorId, f.plan.imageEntityId])).toStrictEqual([
      ["ground_floor", "image.robot_one_floor_plan_mapa_q1w2e3"],
      ["upper_floor", "image.robot_one_floor_plan_mapb_z9x8c7"],
    ]);
    const mop = model.robots.find((r) => r.vacuumEntityId === "vacuum.robot_two");
    expect(where(mop?.plans ?? [])).toStrictEqual([
      ["vacuum.robot_two", "image.robot_two_rooms_map", "none"],
      ["vacuum.robot_two", "image.robot_two_floor_plan_mapc_k4l5m6", "ground_floor"],
      ["vacuum.robot_two", "image.robot_two_floor_plan_mapd_r7t8y9", "none"],
    ]);
    expect(model.noFloor[0]?.placement).toStrictEqual({ kind: "no_floor", reasons: ["cannot_tell_shown_map"] });
    expect(model.noFloor[0]?.imageEntityId).toBe("image.robot_one_rooms_map");
  });

  it("equals the model built on FakeHass and FakeRoomSource with the same services", async () => {
    const { hass, sources } = (await started(harness)).adapters;
    const fake = buildFloorModel(new FakeHass({ services: ["vacuum.clean_area", "roomba_plus.clean_room"] }), [
      new FakeRoomSource(),
    ]);
    expect(buildFloorModel(hass, sources())).toEqual(fake);
  });

  it("answers every port member through the narrowed HassPort", async () => {
    const { hass } = (await started(harness)).adapters;
    expect(hass.areas().get("greenhouse")?.floorId).toBeNull();
    expect(hass.vacuum("vacuum.robot_one")?.state).toBe("docked");
    expect(hass.hasService("roomba_plus", "clean_room")).toBe(true);
    expect(hass.isAdmin()).toBe(false);
    expect(hass.vacuumOptions("vacuum.robot_one").kind).toBe("options");
    const listener = vi.fn();
    const unsubscribe = hass.subscribe(listener);
    unsubscribe();
    harness.hass.connection.emit("repairs_issue_registry_updated");
    await vi.advanceTimersByTimeAsync(500);
    expect(listener).not.toHaveBeenCalled();
  });

  it("builds a plan picture URL for a reported plan only", async () => {
    const { pictureUrl } = (await started(harness)).adapters;
    expect(pictureUrl("image.robot_one_floor_plan_mapa_q1w2e3")).toMatch(
      /^https:\/\/ha\.example\.invalid\/api\/image_proxy\/image\.robot_one_floor_plan_mapa_q1w2e3\?token=0+1&state=/,
    );
    expect(pictureUrl("image.not_a_plan")).toBeUndefined();
  });
});
