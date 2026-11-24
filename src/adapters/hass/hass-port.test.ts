import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeFrontendHass } from "../../../test/fakes/frontend-hass";
import entityRegistryList from "../../../test/fixtures/ha-core/entity_registry_list.json" with { type: "json" };
import floorRegistryList from "../../../test/fixtures/ha-core/floor_registry_list.json" with { type: "json" };
import { expectNoConsoleOutput } from "../../../test/helpers/no-console";
import type { HassPort } from "../../app/ports/hass-port";
import { createHassPort } from "./hass-port";

const LIST_COMMANDS = ["config/entity_registry/list", "config/floor_registry/list", "repairs/list_issues"];
const EVENTS = ["entity_registry_updated", "floor_registry_updated", "repairs_issue_registry_updated"];

let hass: FakeFrontendHass;
let port: ReturnType<typeof createHassPort>;

expectNoConsoleOutput();

beforeEach(() => {
  vi.useFakeTimers();
  hass = new FakeFrontendHass();
  port = createHassPort(() => hass);
});

afterEach(() => {
  port.stop();
  vi.useRealTimers();
});

/** Re-fetches every list after `event`, waiting out the debounce. */
async function updated(event: string): Promise<void> {
  hass.connection.emit(event);
  await vi.advanceTimersByTimeAsync(500);
}

describe("createHassPort", () => {
  it("satisfies HassPort", () => {
    const typed: HassPort = port;
    expect(typed).toBe(port);
  });

  it("sends only the three list commands and subscribes only to their three events", async () => {
    port.start();
    port.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(hass.wsCalls.map((m) => m.type).sort()).toStrictEqual(LIST_COMMANDS);
    expect(hass.connection.subscriptions.map((s) => s.eventType).sort()).toStrictEqual(EVENTS);
    for (const event of EVENTS) await updated(event);
    expect(new Set(hass.wsCalls.map((m) => m.type))).toStrictEqual(new Set(LIST_COMMANDS));
    port.callService({ domain: "vacuum", service: "clean_area", data: {}, target: { entity_id: "vacuum.robot_one" } });
    expect(hass.wsCalls.map((m) => m.type).every((type) => LIST_COMMANDS.includes(type))).toBe(true);
  });

  it("reads every member from the fixtures once started", async () => {
    expect(port.floors()).toBeUndefined();
    expect(port.vacuumOptions("vacuum.robot_one")).toStrictEqual({ kind: "unsupported", reason: "not_loaded" });
    expect(port.segmentsChangedOpen("vacuum.robot_two")).toBe(true);
    port.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(port.floors()?.map((f) => f.floorId)).toStrictEqual(["ground_floor", "upper_floor"]);
    expect(port.areas().get("greenhouse")?.floorId).toBeNull();
    expect(port.vacuum("vacuum.robot_one")).toStrictEqual({ state: "docked", supportedFeatures: 29500 });
    expect(port.hasService("vacuum", "clean_area")).toBe(true);
    expect(port.isAdmin()).toBe(false);
    expect(port.vacuumOptions("vacuum.robot_one").kind).toBe("options");
    expect(port.segmentsChangedOpen("vacuum.robot_one")).toBe(true);
    expect(port.segmentsChangedOpen("vacuum.robot_two")).toBe(false);
  });

  it("sends a service call through hass, never rejecting", async () => {
    hass.behaviour = { kind: "reject", value: { code: "home_assistant_error", message: "Unauthorized" } };
    await expect(port.callService({ domain: "vacuum", service: "start", data: {} })).resolves.toStrictEqual({
      ok: false,
      error: { code: "home_assistant_error", message: "Unauthorized" },
    });
    expect(hass.calls).toHaveLength(1);
  });
});

describe("subscribe", () => {
  it("notifies once per changed list, and never on an equal re-fetch", async () => {
    const listener = vi.fn();
    port.subscribe(listener);
    port.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(listener).toHaveBeenCalledTimes(3);
    for (const event of EVENTS) await updated(event);
    expect(listener).toHaveBeenCalledTimes(3);

    hass.answerWS = (message) =>
      Promise.resolve(
        message.type === "config/floor_registry/list"
          ? floorRegistryList.slice(1)
          : message.type === "config/entity_registry/list"
            ? entityRegistryList.slice(1)
            : { issues: [] },
      );
    for (const event of EVENTS) await updated(event);
    expect(listener).toHaveBeenCalledTimes(6);
  });

  it("keeps calling the others when one throws, and unsubscribes with the returned function", async () => {
    const removed = vi.fn();
    const kept = vi.fn();
    port.subscribe(() => {
      throw new Error("listener bug");
    });
    const unsubscribe = port.subscribe(removed);
    port.subscribe(kept);
    unsubscribe();
    port.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(removed).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledTimes(3);
  });

  it("notifies nothing after stop, and releases every subscription", async () => {
    const listener = vi.fn();
    port.subscribe(listener);
    port.start();
    port.stop();
    await vi.advanceTimersByTimeAsync(1000);
    expect(listener).not.toHaveBeenCalled();
    expect(hass.connection.unsubscribed).toBe(3);
    expect(hass.connection.readyListeners).toBe(0);
  });

  it("calls no listener after one of them stops the port", async () => {
    const after = vi.fn();
    port.subscribe(() => port.stop());
    port.subscribe(after);
    port.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(after).not.toHaveBeenCalled();
  });
});
