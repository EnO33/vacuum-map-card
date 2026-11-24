// The anonymised fixture home loaded into a fake frontend `hass`: both Roomba+ robots, their plans and the registry
// lists. No Vitest import, so the demo page (`demo/`) loads it in the browser as the tests do.
import entityRegistryList from "../fixtures/ha-core/entity_registry_list.json" with { type: "json" };
import floorPlanDisabled from "../fixtures/roomba-plus/synthetic/entity_registry_list_floor_plan_disabled.json" with {
  type: "json",
};
import { roombaPlusStates } from "../helpers/roomba-plus-states";
import type { FakeFrontendHass } from "./frontend-hass";

/** The services the fixture home offers: core's `clean_area` and Roomba+'s `clean_room`. */
const FIXTURE_SERVICES = { vacuum: { clean_area: {} }, roomba_plus: { clean_room: {} } };

/** The capture's entity registry list, the vacuum's second floor plan disabled when asked. */
export function registryList(disabledFloorPlan = false): unknown[] {
  const replacements = new Map<string, unknown>(floorPlanDisabled.map((e) => [e.entity_id, e]));
  const list = disabledFloorPlan
    ? entityRegistryList.map((e) => replacements.get(e.entity_id) ?? e)
    : entityRegistryList;
  return structuredClone(list);
}

export interface FixtureHomeOptions {
  readonly disabledFloorPlan?: boolean;
}

/**
 * Loads the fixture home into `hass`: Roomba+ states, services, and answers to the entity registry list and the repair
 * issues (none open); other commands keep the fake's answers. Returns those list answers, replaceable per test.
 */
export function loadFixtureHome(hass: FakeFrontendHass, options: FixtureHomeOptions = {}): Map<string, unknown> {
  hass.states = roombaPlusStates();
  hass.services = structuredClone(FIXTURE_SERVICES);
  const lists = new Map<string, unknown>([
    ["config/entity_registry/list", registryList(options.disabledFloorPlan)],
    ["repairs/list_issues", { issues: [] }],
  ]);
  const fixtures = hass.answerWS;
  hass.answerWS = (message) =>
    lists.has(message.type) ? Promise.resolve(structuredClone(lists.get(message.type))) : fixtures(message);
  return lists;
}
