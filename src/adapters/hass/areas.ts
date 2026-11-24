import type { Area } from "../../domain/registry/types";
import type { FrontendHass } from "./frontend-hass";
import { isObject, ownStrings, ownValue } from "./own-property";

const NO_AREAS: ReadonlyMap<string, Area> = new Map();

/**
 * `HassPort.areas()` over the live `hass.areas`: the same map while `hass.areas` keeps its identity (the frontend
 * keeps it when nothing changed, `docs/research/ha-core-registries.md` « Update signal »), a new map for a new object.
 */
export function areasReader(getHass: () => FrontendHass): () => ReadonlyMap<string, Area> {
  let source: unknown;
  let areas = NO_AREAS;
  return () => {
    const current = getHass().areas;
    if (current !== source) {
      source = current;
      areas = parseAreas(current);
    }
    return areas;
  };
}

/**
 * Areas from own keys of `hass.areas` only, never `in`, so a `__proto__` key is an ordinary area (#46 security note).
 * An entry whose `area_id` differs from its key, or without a string `name`, is skipped. Names and aliases are
 * registry names, kept whole.
 */
function parseAreas(raw: unknown): ReadonlyMap<string, Area> {
  if (!isObject(raw)) return NO_AREAS;
  const areas = new Map<string, Area>();
  for (const key of Object.keys(raw)) {
    const area = parseArea(key, ownValue(raw, key));
    if (area) areas.set(key, area);
  }
  return areas;
}

function parseArea(key: string, raw: unknown): Area | undefined {
  if (!isObject(raw) || ownValue(raw, "area_id") !== key) return undefined;
  const name = ownValue(raw, "name");
  if (typeof name !== "string") return undefined;
  const floorId = ownValue(raw, "floor_id");
  return Object.freeze({
    areaId: key,
    name,
    aliases: ownStrings(ownValue(raw, "aliases")),
    floorId: typeof floorId === "string" ? floorId : null,
  });
}
