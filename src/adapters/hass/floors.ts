import type { Floor } from "../../domain/registry/types";
import type { Schedule } from "./debounce";
import type { FrontendHass } from "./frontend-hass";
import { isObject, ownStrings, ownValue } from "./own-property";
import { createWsCollection, type WsCollection } from "./ws-collection";

/** The floor registry list, kept current: `value()` is `HassPort.floors()`. */
export type FloorList = WsCollection<readonly Floor[]>;

/**
 * `config/floor_registry/list`, re-fetched on `floor_registry_updated` (ADR 0005 « Floors » item 1). Its array order
 * is kept, never sorted by `level` nor taken from `hass.floors`, whose all-digit `floor_id` keys move first.
 */
export function createFloorList(getHass: () => FrontendHass, schedule?: Schedule): FloorList {
  return createWsCollection({
    getHass,
    command: "config/floor_registry/list",
    event: "floor_registry_updated",
    parse: parseFloors,
    equal: sameFloors,
    schedule,
  });
}

/**
 * The frozen floors of an untrusted list, or `undefined` (a failed fetch) when it is not an array. An entry needs a
 * non-empty string `floor_id` and a string `name`; a repeated `floor_id` keeps the first. Names and aliases are
 * registry names, kept whole.
 */
function parseFloors(raw: unknown): readonly Floor[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const floors: Floor[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const floor = parseFloor(item);
    if (floor === undefined || seen.has(floor.floorId)) continue;
    seen.add(floor.floorId);
    floors.push(floor);
  }
  return Object.freeze(floors);
}

function parseFloor(raw: unknown): Floor | undefined {
  if (!isObject(raw)) return undefined;
  const floorId = ownValue(raw, "floor_id");
  const name = ownValue(raw, "name");
  if (typeof floorId !== "string" || floorId === "" || typeof name !== "string") return undefined;
  return Object.freeze({ floorId, name, aliases: ownStrings(ownValue(raw, "aliases")) });
}

function sameFloors(a: readonly Floor[], b: readonly Floor[]): boolean {
  return a.length === b.length && a.every((floor, i) => sameFloor(floor, b[i]));
}

function sameFloor(a: Floor, b: Floor | undefined): boolean {
  return (
    b !== undefined &&
    a.floorId === b.floorId &&
    a.name === b.name &&
    a.aliases.length === b.aliases.length &&
    a.aliases.every((alias, i) => alias === b.aliases[i])
  );
}
