// The demo page's `hass`: the fake frontend `hass` of the tests on the anonymised fixture home, with one floor plan
// disabled, plan pictures served from `demo/plans/`, and a chosen answer to every action. Nothing leaves the page.
import type { FrontendHass } from "../src/adapters/hass/frontend-hass";
import { loadFixtureHome } from "../test/fakes/fixture-home";
import { FakeFrontendHass } from "../test/fakes/frontend-hass";
import entityRegistryList from "../test/fixtures/ha-core/entity_registry_list.json" with { type: "json" };
import floorRegistryList from "../test/fixtures/ha-core/floor_registry_list.json" with { type: "json" };
import serviceErrors from "../test/fixtures/ha-core/synthetic/service_errors.json" with { type: "json" };
import { roombaPlusStates } from "../test/helpers/roomba-plus-states";
import { PLAN_PICTURES } from "./plans";

/** How the fake answers an action: it is accepted, refused with one error, or never answered. */
export const OUTCOMES = ["accepted", "refused", "never"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export function isOutcome(value: string): value is Outcome {
  return OUTCOMES.some((outcome) => outcome === value);
}

/** The refusal: core's `area_mapping_not_configured` validation error, as captured in the synthetic fixture. */
const REFUSAL = serviceErrors.find(
  ({ error }) => "translation_key" in error && error.translation_key === "area_mapping_not_configured",
)?.error;

const IMAGE_PROXY = /^\/api\/image_proxy\/([^?/]+)\?/;

/** The demo picture of an image proxy path; any other path stays on the page's own origin. */
function demoUrl(path = "/"): string {
  const entityId = IMAGE_PROXY.exec(path)?.[1];
  return (entityId === undefined ? undefined : PLAN_PICTURES.get(decodeURIComponent(entityId))) ?? path;
}

/**
 * The vacuum's second stored map, left out (its floor plan and its segments) so the vacuum has one stored map and its
 * rooms map pairs with it: its outlines then show on that map's floor (ADR 0005 « Rooms map pairing »).
 */
const REMOVED_PLAN = "image.robot_one_floor_plan_mapb_z9x8c7";
const REMOVED_SEGMENTS = "MapB_z9X8c7_";
/** The mop's ground floor plan, disabled as the integration does by default. */
const DISABLED_PLAN = "image.robot_two_floor_plan_mapc_k4l5m6";
/** The mop's other plan is named « Upper level »: a floor alias puts it on the upper floor (ADR 0005 « Map to floor »). */
const UPPER_FLOOR = { floorId: "upper_floor", alias: "Upper level" };

type RegistryEntry = (typeof entityRegistryList)[number];

const kept = (segmentId: string) => !segmentId.startsWith(REMOVED_SEGMENTS);

/** A registry entry of the demo: the disabled plan marked, a core mapping without the removed map's segments. */
function demoEntry(entry: RegistryEntry): unknown {
  const changed = entry.entity_id === DISABLED_PLAN ? { ...entry, disabled_by: "integration" } : entry;
  if (!("vacuum" in entry.options)) return changed;
  const { area_mapping, last_seen_segments } = entry.options.vacuum;
  const mapping = Object.entries(area_mapping)
    .map(([areaId, segmentIds]) => [areaId, segmentIds.filter(kept)] as const)
    .filter(([, segmentIds]) => segmentIds.length > 0);
  const vacuum = {
    area_mapping: Object.fromEntries(mapping),
    last_seen_segments: last_seen_segments.filter((segment) => kept(segment.id)),
  };
  return { ...changed, options: { ...entry.options, vacuum } };
}

function demoRegistry(): unknown[] {
  return structuredClone(entityRegistryList)
    .filter((entry) => entry.entity_id !== REMOVED_PLAN)
    .map(demoEntry);
}

function demoFloors(): unknown[] {
  return structuredClone(floorRegistryList).map((floor) =>
    floor.floor_id === UPPER_FLOOR.floorId ? { ...floor, aliases: [UPPER_FLOOR.alias] } : floor,
  );
}

/** The fixture states without the two plans above: Home Assistant leaves a disabled entity out of `hass.states`. */
function demoStates(): Record<string, unknown> {
  const absent = new Set([REMOVED_PLAN, DISABLED_PLAN]);
  return Object.fromEntries(Object.entries(roombaPlusStates()).filter(([entityId]) => !absent.has(entityId)));
}

/**
 * The fixture home, changed only so that it shows the cases of #103: the vacuum with outlines on one floor, the mop
 * with a picture only on another, and one disabled floor plan.
 */
export class DemoHass extends FakeFrontendHass {
  outcome: Outcome = "accepted";
  override hassUrl: (path?: string) => string = demoUrl;
  /** Told of every action the card sends, so the page can show it. */
  onCall: (args: Parameters<FrontendHass["callService"]>) => void = () => undefined;

  constructor() {
    super();
    const lists = loadFixtureHome(this);
    lists.set("config/entity_registry/list", demoRegistry());
    lists.set("config/floor_registry/list", demoFloors());
    this.states = demoStates();
  }

  override callService(...args: Parameters<FrontendHass["callService"]>): Promise<unknown> {
    this.onCall(args);
    if (this.outcome === "never") {
      this.calls.push(args);
      return new Promise(() => undefined);
    }
    if (this.outcome === "refused") this.behaviour = { kind: "reject", value: structuredClone(REFUSAL) };
    else this.behaviour = { kind: "resolve", value: { context: { id: "01JAAAAAAAAAAAAAAAAAAAAAAA" } } };
    return super.callService(...args);
  }
}
