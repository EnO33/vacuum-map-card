// Test helper: an entity registry fixture turned into the typed input an adapter would build (Epic 4 parses for real).
import type { RawAreaMapping } from "../../src/domain/mapping/area-mapping";
import type { LastSeenSegment } from "../../src/domain/mapping/last-seen";
import areaRegistry from "../fixtures/ha-core/area_registry_list.json" with { type: "json" };
import vacuum from "../fixtures/ha-core/entity_registry_get_vacuum_clean_area.json" with { type: "json" };
import mop from "../fixtures/ha-core/entity_registry_get_vacuum_no_clean_area.json" with { type: "json" };
import noMapping from "../fixtures/ha-core/synthetic/entity_registry_get_vacuum_clean_area_no_mapping.json" with {
  type: "json",
};
import deletedArea from "../fixtures/ha-core/synthetic/entity_registry_get_vacuum_deleted_area.json" with {
  type: "json",
};

interface VacuumOptions {
  readonly area_mapping?: Readonly<Record<string, readonly string[]>>;
  readonly last_seen_segments?: readonly LastSeenSegment[];
}

export interface EntityRegistryFixture {
  readonly options: Readonly<Record<string, unknown>> & { readonly vacuum?: VacuumOptions };
}

export const mappingFixtures = { vacuum, mop, noMapping, deletedArea } satisfies Record<string, EntityRegistryFixture>;

/** The area ids of the area registry fixture. */
export const knownAreaIds: ReadonlySet<string> = new Set(areaRegistry.map((area) => area.area_id));

/** The fixture's `area_mapping` as a fresh `Map`, as the adapter builds it. */
export function areaMappingOf(fixture: EntityRegistryFixture): RawAreaMapping | undefined {
  const mapping = fixture.options.vacuum?.area_mapping;
  return mapping === undefined ? undefined : new Map(Object.entries(mapping));
}

/** The fixture's `last_seen_segments` without the fields the card does not read. */
export function lastSeenOf(fixture: EntityRegistryFixture): LastSeenSegment[] | undefined {
  return fixture.options.vacuum?.last_seen_segments?.map(({ id, name }) => ({ id, name }));
}
