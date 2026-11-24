// A `HassPort` built from the anonymised fixtures of `test/fixtures/ha-core/`. It reimplements no adapter rule: it
// hands the fixtures' values over in the port's shape, records calls and never calls anything real.
import type {
  HassPort,
  OptionsList,
  VacuumOptions,
  VacuumOptionsFailure,
  VacuumState,
} from "../../src/app/ports/hass-port";
import type { ServiceCall, ServiceResult } from "../../src/app/ports/service-call";
import type { Area, Floor } from "../../src/domain/registry/types";
import { type Unsupported, unsupported } from "../../src/domain/unsupported";
import areaRegistry from "../fixtures/ha-core/area_registry_list.json" with { type: "json" };
import floorRegistry from "../fixtures/ha-core/floor_registry_list.json" with { type: "json" };
import vacuumStates from "../fixtures/ha-core/hass_states_vacuum_docked.json" with { type: "json" };
import { areaMappingOf, type EntityRegistryFixture, lastSeenOf, mappingFixtures } from "../helpers/area-mapping";
import { areasOf, floorsOf } from "../helpers/registry";

export interface FakeHassSettings {
  /** Services present, as `domain.service`. */
  readonly services?: readonly string[];
  /** Vacuums with an open `segments_changed` repair issue. */
  readonly segmentsChanged?: readonly string[];
  readonly admin?: boolean;
  /** What every `callService` resolves to. */
  readonly result?: ServiceResult;
}

function optionsOf(entry: EntityRegistryFixture): VacuumOptions {
  return { kind: "options", areaMapping: listOf(areaMappingOf(entry)), lastSeenSegments: listOf(lastSeenOf(entry)) };
}

function listOf<T>(list: T | undefined): OptionsList<T> {
  return list === undefined ? { kind: "absent" } : { kind: "list", list };
}

const vacuumOptionsOf: ReadonlyMap<string, VacuumOptions> = new Map(
  [mappingFixtures.vacuum, mappingFixtures.mop].map((entry) => [entry.entity_id, optionsOf(entry)]),
);

const floors: readonly Floor[] = floorsOf(floorRegistry);
const areas: ReadonlyMap<string, Area> = areasOf(areaRegistry);
const vacuumStateOf = new Map(Object.entries(vacuumStates));

export class FakeHass implements HassPort {
  /** Every call received, in order. */
  readonly calls: ServiceCall[] = [];
  readonly #settings: FakeHassSettings;
  readonly #listeners = new Set<() => void>();

  constructor(settings: FakeHassSettings = {}) {
    this.#settings = settings;
  }

  floors(): readonly Floor[] | undefined {
    return floors;
  }

  areas(): ReadonlyMap<string, Area> {
    return areas;
  }

  vacuum(entityId: string): VacuumState | undefined {
    const entry = vacuumStateOf.get(entityId);
    return entry && { state: entry.state, supportedFeatures: entry.attributes.supported_features };
  }

  hasService(domain: string, service: string): boolean {
    return this.#settings.services?.includes(`${domain}.${service}`) ?? false;
  }

  vacuumOptions(entityId: string): VacuumOptions | Unsupported<VacuumOptionsFailure> {
    return vacuumOptionsOf.get(entityId) ?? unsupported("registry_entry_unreadable");
  }

  segmentsChangedOpen(entityId: string): boolean {
    return this.#settings.segmentsChanged?.includes(entityId) ?? false;
  }

  isAdmin(): boolean {
    return this.#settings.admin ?? false;
  }

  callService(call: ServiceCall): Promise<ServiceResult> {
    this.calls.push(call);
    return Promise.resolve(this.#settings.result ?? { ok: true });
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Simulates a registry change fetched outside `hass`. */
  emit(): void {
    for (const listener of this.#listeners) listener();
  }
}
