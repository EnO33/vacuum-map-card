import type { OptionsList, VacuumOptions, VacuumOptionsFailure } from "../../app/ports/hass-port";
import type { RawAreaMapping } from "../../domain/mapping/area-mapping";
import type { LastSeenSegment } from "../../domain/mapping/last-seen";
import {
  MAX_AREA_MAPPING_KEYS,
  MAX_LAST_SEEN_SEGMENTS,
  MAX_MAPPED_SEGMENTS,
  MAX_SEGMENTS_PER_AREA,
} from "../../domain/mapping/limits";
import { type Unsupported, unsupported } from "../../domain/unsupported";
import type { EntityRegistry } from "./entity-registry";
import { isObject, ownValue } from "./own-property";

type Result = VacuumOptions | Unsupported<VacuumOptionsFailure>;

const NOT_LOADED: Result = Object.freeze(unsupported("not_loaded"));
const NO_ENTRY: Result = Object.freeze(unsupported("registry_entry_unreadable"));
const MALFORMED_OPTIONS: Result = Object.freeze(unsupported("malformed_options"));
const ABSENT = Object.freeze({ kind: "absent" });
const MALFORMED = Object.freeze(unsupported("malformed"));
const NO_OPTIONS: Result = Object.freeze({ kind: "options", areaMapping: ABSENT, lastSeenSegments: ABSENT });

/**
 * `HassPort.vacuumOptions()` from the entity registry list: the same object per entity until the list object changes.
 * Collection sizes are checked against ADR 0002 « Parsing limits » item 3 before anything is copied; over a cap
 * nothing is copied and the list is `malformed`. Strings are passed whole: the domain readers own the string cap.
 */
export function vacuumOptionsReader(registry: EntityRegistry): (entityId: string) => Result {
  let version: unknown;
  let read = new Map<string, Result>();
  return (entityId) => {
    const current = registry.version();
    if (current === undefined) return NOT_LOADED;
    if (current !== version) {
      version = current;
      read = new Map();
    }
    let result = read.get(entityId);
    if (result === undefined) {
      const entry = registry.entry(entityId);
      result = entry === undefined ? NO_ENTRY : parseVacuumOptions(entry.rawVacuumOptions);
      read.set(entityId, result);
    }
    return result;
  };
}

function parseVacuumOptions(raw: unknown): Result {
  if (raw === undefined || raw === null) return NO_OPTIONS;
  if (!isPlainObject(raw)) return MALFORMED_OPTIONS;
  return Object.freeze({
    kind: "options",
    areaMapping: parseAreaMapping(ownValue(raw, "area_mapping")),
    lastSeenSegments: parseLastSeen(ownValue(raw, "last_seen_segments")),
  });
}

function isPlainObject(value: unknown): value is object {
  return isObject(value) && !Array.isArray(value);
}

/** Own keys only (`__proto__` is an ordinary key); every value an array of string ids; caps counted first. */
function parseAreaMapping(raw: unknown): OptionsList<RawAreaMapping> {
  if (raw === undefined || raw === null) return ABSENT;
  if (!isPlainObject(raw) || !areaMappingWithinCaps(raw)) return MALFORMED;
  const mapping = new Map<string, readonly string[]>();
  for (const key of Object.keys(raw)) {
    const ids = stringItems(ownValue(raw, key));
    if (ids === undefined) return MALFORMED;
    mapping.set(key, ids);
  }
  return Object.freeze({ kind: "list", list: mapping });
}

/** Counts keys and ids without building anything, stopping at the first cap passed. */
function areaMappingWithinCaps(raw: object): boolean {
  let keys = 0;
  let ids = 0;
  for (const key in raw) {
    if (!Object.hasOwn(raw, key)) continue;
    if (++keys > MAX_AREA_MAPPING_KEYS) return false;
    const value = ownValue(raw, key);
    if (!Array.isArray(value) || value.length > MAX_SEGMENTS_PER_AREA) return false;
    ids += value.length;
    if (ids > MAX_MAPPED_SEGMENTS) return false;
  }
  return true;
}

/** A frozen copy of an array whose items are all strings, or `undefined`. */
function stringItems(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items: string[] = [];
  for (let i = 0; i < value.length; i++) {
    const item = ownValue(value, String(i));
    if (typeof item !== "string") return undefined;
    items.push(item);
  }
  return Object.freeze(items);
}

/** Entries with string `id` and `name` (`group` dropped); the length is checked before copying. */
function parseLastSeen(raw: unknown): OptionsList<readonly LastSeenSegment[]> {
  if (raw === undefined || raw === null) return ABSENT;
  if (!Array.isArray(raw) || raw.length > MAX_LAST_SEEN_SEGMENTS) return MALFORMED;
  const segments: LastSeenSegment[] = [];
  for (let i = 0; i < raw.length; i++) {
    const entry = ownValue(raw, String(i));
    const id = isObject(entry) ? ownValue(entry, "id") : undefined;
    const name = isObject(entry) ? ownValue(entry, "name") : undefined;
    if (typeof id !== "string" || typeof name !== "string") return MALFORMED;
    segments.push(Object.freeze({ id, name }));
  }
  return Object.freeze({ kind: "list", list: Object.freeze(segments) });
}
