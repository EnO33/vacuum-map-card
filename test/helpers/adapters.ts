// Test helper: the real adapters on a fake frontend `hass` loaded from the anonymised captures, with an injected timer.
import { vi } from "vitest";
import { type Adapters, createAdapters } from "../../src/adapters/create-adapters";
import { FakeFrontendHass } from "../fakes/frontend-hass";
import entityRegistryList from "../fixtures/ha-core/entity_registry_list.json" with { type: "json" };
import floorPlanDisabled from "../fixtures/roomba-plus/synthetic/entity_registry_list_floor_plan_disabled.json" with {
  type: "json",
};
import { roombaPlusStates } from "./roomba-plus-states";

/** The services the fixture home offers: core's `clean_area` and Roomba+'s `clean_room`. */
export const FIXTURE_SERVICES = { vacuum: { clean_area: {} }, roomba_plus: { clean_room: {} } };

/** The capture's entity registry list, the vacuum's second floor plan disabled when asked. */
export function registryList(disabledFloorPlan = false): unknown[] {
  const replacements = new Map<string, unknown>(floorPlanDisabled.map((e) => [e.entity_id, e]));
  const list = disabledFloorPlan
    ? entityRegistryList.map((e) => replacements.get(e.entity_id) ?? e)
    : entityRegistryList;
  return structuredClone(list);
}

export interface AdaptersHarness {
  readonly hass: FakeFrontendHass;
  readonly adapters: Adapters;
  /** The answers to the three list commands; replace one before an update event. */
  readonly lists: Map<string, unknown>;
}

/** A fake frontend `hass` on the captures (no open repair issue), with the real adapters over it, not started. */
export function adaptersHarness(options: { readonly disabledFloorPlan?: boolean } = {}): AdaptersHarness {
  const hass = new FakeFrontendHass();
  hass.states = roombaPlusStates();
  hass.services = structuredClone(FIXTURE_SERVICES);
  const lists = new Map<string, unknown>([
    ["config/entity_registry/list", registryList(options.disabledFloorPlan)],
    ["repairs/list_issues", { issues: [] }],
  ]);
  const fixtures = hass.answerWS;
  hass.answerWS = (message) =>
    lists.has(message.type) ? Promise.resolve(structuredClone(lists.get(message.type))) : fixtures(message);
  return { hass, adapters: createAdapters(() => hass), lists };
}

/** Starts the adapters and waits for the three lists (fake timers must be on). */
export async function started(harness: AdaptersHarness): Promise<AdaptersHarness> {
  harness.adapters.start();
  await vi.advanceTimersByTimeAsync(0);
  return harness;
}
