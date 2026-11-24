import type { Schedule } from "./debounce";
import { type EntityRegistryEntry, entryEqual, parseEntityRegistryEntry } from "./entity-registry-entry";
import type { FrontendHass } from "./frontend-hass";
import { createWsCollection } from "./ws-collection";

export type { EntityRegistryEntry } from "./entity-registry-entry";

/**
 * The full entity registry list, disabled entries included, kept current for `HassPort` and every room source
 * (`docs/research/ha-core-registries.md` « Gaps for this card », Epic 4, item 2). Only the parsed entries are kept,
 * indexed by `Map`s, and nothing is logged (item 7). Single use, like its collection: `start` does nothing until
 * `hass` can be read, and a stopped registry is replaced by a new one, never restarted.
 */
export interface EntityRegistry {
  /** The parsed list in registry order; the same object while an update leaves it equal, so consumers can memoise. */
  version(): readonly EntityRegistryEntry[] | undefined;
  entry(entityId: string): EntityRegistryEntry | undefined;
  /** The entries of one integration, in list order. */
  byPlatform(platform: string): readonly EntityRegistryEntry[];
  onChange(listener: () => void): () => void;
  start(): void;
  stop(): void;
}

interface Index {
  readonly list: readonly EntityRegistryEntry[];
  readonly byId: ReadonlyMap<string, EntityRegistryEntry>;
  readonly byPlatform: ReadonlyMap<string, readonly EntityRegistryEntry[]>;
}

const NONE: readonly EntityRegistryEntry[] = Object.freeze([]);

export function createEntityRegistry(getHass: () => FrontendHass, schedule?: Schedule): EntityRegistry {
  const collection = createWsCollection({
    getHass,
    command: "config/entity_registry/list",
    event: "entity_registry_updated",
    parse: parseIndex,
    equal: (a, b) => a.list.length === b.list.length && a.list.every((entry, i) => sameAt(entry, b.list, i)),
    schedule,
  });
  return {
    version: () => collection.value()?.list,
    entry: (entityId) => collection.value()?.byId.get(entityId),
    byPlatform: (platform) => collection.value()?.byPlatform.get(platform) ?? NONE,
    onChange: (listener) => collection.onChange(listener),
    start: () => collection.start(),
    stop: () => collection.stop(),
  };
}

function sameAt(entry: EntityRegistryEntry, list: readonly EntityRegistryEntry[], i: number): boolean {
  const other = list[i];
  return other !== undefined && entryEqual(entry, other);
}

/** The parsed list and its indexes; `undefined` (a failed fetch) when the response is not an array. */
function parseIndex(raw: unknown): Index | undefined {
  if (!Array.isArray(raw)) return undefined;
  const list: EntityRegistryEntry[] = [];
  const byId = new Map<string, EntityRegistryEntry>();
  const byPlatform = new Map<string, EntityRegistryEntry[]>();
  for (const item of raw) {
    const entry = parseEntityRegistryEntry(item);
    if (entry === undefined || byId.has(entry.entityId)) continue;
    list.push(entry);
    byId.set(entry.entityId, entry);
    const platformEntries = byPlatform.get(entry.platform);
    if (platformEntries) platformEntries.push(entry);
    else byPlatform.set(entry.platform, [entry]);
  }
  return { list, byId, byPlatform };
}
