// Test helper: registry list fixtures turned into the domain's registry types, as the adapter would.
import type { Area, Floor } from "../../src/domain/registry/types";

interface FloorFixture {
  readonly floor_id: string;
  readonly name: string;
  readonly aliases: readonly string[];
}

interface AreaFixture {
  readonly area_id: string;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly floor_id: string | null;
}

/** Floors of a `config/floor_registry/list` fixture, in list order. */
export function floorsOf(list: readonly FloorFixture[]): Floor[] {
  return list.map(({ floor_id, name, aliases }) => ({ floorId: floor_id, name, aliases }));
}

/** Areas of an area registry fixture, keyed by area id. */
export function areasOf(list: readonly AreaFixture[]): Map<string, Area> {
  return new Map(
    list.map(({ area_id, name, aliases, floor_id }) => [
      area_id,
      { areaId: area_id, name, aliases, floorId: floor_id },
    ]),
  );
}
