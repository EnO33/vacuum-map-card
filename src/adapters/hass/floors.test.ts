import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeFrontendHass } from "../../../test/fakes/frontend-hass";
import floorRegistryList from "../../../test/fixtures/ha-core/floor_registry_list.json" with { type: "json" };
import floorWithoutAreas from "../../../test/fixtures/ha-core/synthetic/floor_registry_list_floor_without_areas.json" with {
  type: "json",
};
import { expectNoConsoleOutput } from "../../../test/helpers/no-console";
import { MAX_TEXT_LENGTH } from "../../domain/text/limits";
import { createFloorList, type FloorList } from "./floors";

let hass: FakeFrontendHass;
let floors: FloorList;

/** Starts the floor list on `list` and waits for the first fetch. */
async function loaded(list: unknown): Promise<FloorList> {
  hass.answerWS = () => Promise.resolve(structuredClone(list));
  floors.start();
  await vi.advanceTimersByTimeAsync(0);
  return floors;
}

function floor(floorId: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { floor_id: floorId, name: `Floor ${floorId}`, aliases: [], level: 0, icon: null, ...overrides };
}

expectNoConsoleOutput();

beforeEach(() => {
  vi.useFakeTimers();
  hass = new FakeFrontendHass();
  floors = createFloorList(() => hass);
});

afterEach(() => {
  floors.stop();
  vi.useRealTimers();
});

describe("createFloorList", () => {
  it("lists config/floor_registry/list and follows floor_registry_updated", async () => {
    floors.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(hass.wsCalls).toStrictEqual([{ type: "config/floor_registry/list" }]);
    expect(hass.connection.subscriptions.map((s) => s.eventType)).toStrictEqual(["floor_registry_updated"]);
  });

  it("is undefined until the first fetch, and empty for a home without floors", async () => {
    expect(floors.value()).toBeUndefined();
    await loaded([]);
    expect(floors.value()).toStrictEqual([]);
  });

  it("keeps the fixture's list order", async () => {
    await loaded(floorRegistryList);
    expect(floors.value()).toStrictEqual([
      { floorId: "ground_floor", name: "Ground floor", aliases: [] },
      { floorId: "upper_floor", name: "Upper floor", aliases: [] },
    ]);
  });

  it("keeps a floor without areas last, as listed", async () => {
    await loaded(floorWithoutAreas);
    expect(floors.value()?.map((f) => f.floorId)).toStrictEqual(["ground_floor", "upper_floor", "basement"]);
  });

  it("never sorts: an all-digit floor_id listed second stays second, whatever the levels", async () => {
    await loaded([floor("attic", { level: 0 }), floor("1", { level: 5 }), floor("cellar", { level: -3 })]);
    expect(floors.value()?.map((f) => f.floorId)).toStrictEqual(["attic", "1", "cellar"]);
  });

  it("freezes the result", async () => {
    await loaded([floor("a", { aliases: ["x"] })]);
    const value = floors.value();
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value?.[0])).toBe(true);
    expect(Object.isFrozen(value?.[0]?.aliases)).toBe(true);
  });

  it("keeps names and aliases whole, with string aliases only", async () => {
    const long = "N".repeat(1000);
    await loaded([floor("a", { name: long, aliases: [null, "Top", 3, long] }), floor("b", { aliases: "Top" })]);
    expect(floors.value()).toStrictEqual([
      { floorId: "a", name: long, aliases: ["Top", long] },
      { floorId: "b", name: "Floor b", aliases: [] },
    ]);
  });

  it.each<[string, unknown]>([
    ["not an object", "ground_floor"],
    ["null", null],
    ["with an empty floor_id", floor("")],
    ["with a numeric floor_id", floor("x", { floor_id: 1 })],
    ["without a string name", floor("x", { name: null })],
    ["with an over-cap floor_id", floor("f".repeat(MAX_TEXT_LENGTH + 1))],
  ])("skips an entry %s", async (_, entry) => {
    await loaded([entry, floor("kept")]);
    expect(floors.value()?.map((f) => f.floorId)).toStrictEqual(["kept"]);
  });

  it("keeps the first of a repeated floor_id", async () => {
    await loaded([floor("a", { name: "First" }), floor("a", { name: "Second" })]);
    expect(floors.value()).toStrictEqual([{ floorId: "a", name: "First", aliases: [] }]);
  });

  it("treats a non-array response as a failed fetch", async () => {
    await loaded({ floors: [] });
    expect(floors.value()).toBeUndefined();
  });
});

describe("live hass", () => {
  it("reads hass again on each re-fetch", async () => {
    await loaded([floor("a")]);
    const other = new FakeFrontendHass();
    other.answerWS = () => Promise.resolve([floor("b")]);
    const first = hass;
    hass = other;
    first.connection.emit("floor_registry_updated");
    await vi.advanceTimersByTimeAsync(500);
    expect(other.wsCalls).toStrictEqual([{ type: "config/floor_registry/list" }]);
    expect(floors.value()?.map((f) => f.floorId)).toStrictEqual(["b"]);
  });
});

describe("identity", () => {
  async function refetchWith(list: unknown): Promise<void> {
    hass.answerWS = () => Promise.resolve(structuredClone(list));
    hass.connection.emit("floor_registry_updated");
    await vi.advanceTimersByTimeAsync(500);
  }

  it("keeps the same object on an equal re-fetch and notifies nothing", async () => {
    const changes = vi.fn();
    floors.onChange(changes);
    await loaded(floorRegistryList);
    const first = floors.value();
    await refetchWith(floorRegistryList);
    expect(floors.value()).toBe(first);
    expect(changes).toHaveBeenCalledTimes(1);
  });

  it.each<[string, unknown]>([
    ["a renamed floor", [floor("a", { name: "Renamed" }), floor("b")]],
    ["a new alias", [floor("a", { aliases: ["Top", "Up"] }), floor("b")]],
    ["a removed alias", [floor("a"), floor("b")]],
    ["a changed alias", [floor("a", { aliases: ["Other"] }), floor("b")]],
    ["another order", [floor("b"), floor("a")]],
    ["a removed floor", [floor("a")]],
  ])("replaces the list on %s", async (_, next) => {
    await loaded([floor("a", { aliases: ["Top"] }), floor("b")]);
    const first = floors.value();
    await refetchWith(next);
    expect(floors.value()).not.toBe(first);
  });
});
