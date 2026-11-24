import type { RoomsMapContent } from "../../app/ports/room-source";
import { CALIBRATION_PAIRS, MAX_OUTLINE_POINTS } from "../../domain/geometry/limits";
import type { CalibrationPair, Point } from "../../domain/geometry/types";
import type { SnapshotRoom } from "../../domain/plan/rooms-map-snapshot";
import { MAX_PLAN_ROOMS } from "../../domain/plan/rooms-plan";
import { unsupported } from "../../domain/unsupported";
import { boundedText, isObject, ownValue } from "../hass/own-property";

export const NO_OUTLINES: RoomsMapContent = Object.freeze({ kind: "no_outlines" });
const MALFORMED: RoomsMapContent = Object.freeze(unsupported("malformed_attributes"));

/** Thrown inside the parser only, to give up on the whole rooms map at the first malformed value. */
class Malformed extends Error {}

/**
 * A rooms map's content from its state object (`docs/research/roomba-plus.md` « Attributes »): `no_outlines` without a
 * state or without `rooms` and `calibration_points` (« No cloud, no map »); otherwise a snapshot of the state,
 * calibration and rooms only, typed and size-checked (ADR 0002 « Parsing limits »): counts are checked before anything
 * is copied, and any malformed or over-cap value refuses the whole map. Value checks (finite, ranges, minimums,
 * duplicates, the icon pattern) stay with the domain, so its reasons stay precise.
 */
export function roomsMapContentOf(stateObject: unknown): RoomsMapContent {
  try {
    return contentOf(stateObject);
  } catch {
    // A malformed value, or a hostile object whose traps throw: never an exception that breaks the dashboard.
    return MALFORMED;
  }
}

function contentOf(stateObject: unknown): RoomsMapContent {
  if (!isObject(stateObject)) return NO_OUTLINES;
  const state = boundedText(ownValue(stateObject, "state"));
  const attributes = ownValue(stateObject, "attributes");
  if (state === undefined || !isObject(attributes)) return NO_OUTLINES;
  const rooms = ownValue(attributes, "rooms");
  const calibration = ownValue(attributes, "calibration_points");
  if (rooms === undefined || rooms === null || calibration === undefined || calibration === null) return NO_OUTLINES;
  const checked = checkedRoomsOf(rooms);
  const pairs = calibrationOf(calibration);
  return Object.freeze({
    kind: "snapshot",
    snapshot: Object.freeze({ state, calibration: pairs, rooms: Object.freeze(checked.map(roomOf)) }),
  });
}

/** A room value with its outline and the outline length, each read once and size-checked. */
interface CheckedRoom {
  readonly raw: object;
  readonly outline: { readonly items: readonly unknown[]; readonly length: number } | undefined;
}

/** The rooms in attribute order, after every size check (room count, then each outline length); nothing copied yet. */
function checkedRoomsOf(rooms: unknown): readonly CheckedRoom[] {
  if (!isPlainObject(rooms)) throw new Malformed();
  const keys = Object.keys(rooms);
  if (keys.length > MAX_PLAN_ROOMS) throw new Malformed();
  return keys.map((key) => {
    const raw = ownValue(rooms, key);
    if (!isObject(raw)) throw new Malformed();
    const outline = ownValue(raw, "outline");
    if (outline === undefined) return { raw, outline };
    if (!Array.isArray(outline)) throw new Malformed();
    const length = outline.length;
    if (length > MAX_OUTLINE_POINTS) throw new Malformed();
    return { raw, outline: { items: outline, length } };
  });
}

/** One room: `region_id`, `name` and `room_id` required within the cap; `icon` kept when it is; `x` and `y` ignored. */
function roomOf({ raw, outline }: CheckedRoom): SnapshotRoom {
  const regionId = requiredText(raw, "region_id");
  const name = requiredText(raw, "name");
  const roomId = requiredText(raw, "room_id");
  const icon = boundedText(ownValue(raw, "icon"));
  return Object.freeze({
    regionId,
    name,
    roomId,
    ...(icon === undefined ? {} : { icon }),
    ...(outline === undefined ? {} : { outline: pointsOf(outline) }),
  });
}

function requiredText(raw: object, name: string): string {
  const text = boundedText(ownValue(raw, name));
  if (text === undefined) throw new Malformed();
  return text;
}

/** `[[x, y], …]` with `typeof` number values, up to the length checked before. */
function pointsOf({
  items,
  length,
}: {
  readonly items: readonly unknown[];
  readonly length: number;
}): readonly Point[] {
  const points: Point[] = [];
  for (let i = 0; i < length; i++) {
    const pair = ownValue(items, String(i));
    if (!Array.isArray(pair) || pair.length !== 2) throw new Malformed();
    points.push(Object.freeze({ x: numberAt(pair, "0"), y: numberAt(pair, "1") }));
  }
  return Object.freeze(points);
}

/** At most `CALIBRATION_PAIRS` items `{vacuum: {x, y}, map: {x, y}}`; fewer are passed on for the domain to refuse. */
function calibrationOf(raw: unknown): readonly CalibrationPair[] {
  if (!Array.isArray(raw)) throw new Malformed();
  const length = raw.length;
  if (length > CALIBRATION_PAIRS) throw new Malformed();
  const pairs: CalibrationPair[] = [];
  for (let i = 0; i < length; i++) {
    const item = ownValue(raw, String(i));
    if (!isObject(item)) throw new Malformed();
    pairs.push(Object.freeze({ vacuum: pointOf(ownValue(item, "vacuum")), map: pointOf(ownValue(item, "map")) }));
  }
  return Object.freeze(pairs);
}

/** A JSON object: not an array, a `Map` or a class instance. */
function isPlainObject(value: unknown): value is object {
  if (!isObject(value) || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function pointOf(raw: unknown): Point {
  if (!isObject(raw)) throw new Malformed();
  return Object.freeze({ x: numberAt(raw, "x"), y: numberAt(raw, "y") });
}

function numberAt(source: object, key: string): number {
  const value = ownValue(source, key);
  if (typeof value !== "number") throw new Malformed();
  return value;
}
