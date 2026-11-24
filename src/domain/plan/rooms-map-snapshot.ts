import type { CalibrationPair, Point } from "../geometry/types";

/** One room as the integration reports it, already typed; `outline` is in outline units (mm), unchecked. */
export interface SnapshotRoom {
  /** The integration's stable room id (Roomba+: `region_id`); rooms are keyed by it (ADR 0002 « Room identity »). */
  readonly regionId: string;
  readonly name: string;
  /** A slug of the name, not an id (`docs/research/roomba-plus.md` « Attributes »). */
  readonly roomId: string;
  readonly icon?: string;
  readonly outline?: readonly Point[];
}

/**
 * The picture `state`, calibration pairs and rooms of one rooms map, captured together because they change together
 * (ADR 0002 « Parsing limits » item 2). The adapter builds it from the entity's attributes; it holds no token, picture
 * URL or attributes object, so none of them can reach the domain.
 */
export interface RoomsMapSnapshot {
  readonly state: string;
  readonly calibration: readonly CalibrationPair[];
  readonly rooms: readonly SnapshotRoom[];
}

/** Compares captured values, never identity, so a new `hass` object with the same rooms map does not rebuild the plan. */
export function sameRoomsSnapshot(a: RoomsMapSnapshot, b: RoomsMapSnapshot): boolean {
  return (
    a.state === b.state && sameList(a.calibration, b.calibration, samePair) && sameList(a.rooms, b.rooms, sameRoom)
  );
}

function sameRoom(a: SnapshotRoom, b: SnapshotRoom): boolean {
  return (
    a.regionId === b.regionId &&
    a.name === b.name &&
    a.roomId === b.roomId &&
    a.icon === b.icon &&
    sameOptional(a.outline, b.outline, (x, y) => sameList(x, y, samePoint))
  );
}

function samePair(a: CalibrationPair, b: CalibrationPair): boolean {
  return samePoint(a.vacuum, b.vacuum) && samePoint(a.map, b.map);
}

/** `Object.is`, so a non-finite value equals itself and a refused snapshot is not rebuilt on every update. */
function samePoint(a: Point, b: Point): boolean {
  return Object.is(a.x, b.x) && Object.is(a.y, b.y);
}

function sameOptional<T>(a: T | undefined, b: T | undefined, same: (x: T, y: T) => boolean): boolean {
  return a === b || (a !== undefined && b !== undefined && same(a, b));
}

function sameList<T>(a: readonly T[], b: readonly T[], same: (x: T, y: T) => boolean): boolean {
  return a.length === b.length && a.every((x, i) => sameOptional(x, b[i], same));
}
