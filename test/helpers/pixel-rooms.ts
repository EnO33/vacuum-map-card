// Test helpers: points from `[x, y]` pairs, and the rooms of a rooms-map fixture in pixel space through the #42 geometry.
import { applyTransform, solveCalibration } from "../../src/domain/geometry/affine";
import { toPixels, validateOutline } from "../../src/domain/geometry/outline";
import type { CalibrationPair, Point } from "../../src/domain/geometry/types";
import mopPending from "../fixtures/roomba-plus/hass_state_rooms_map_mop_pending.json" with { type: "json" };
import vacuumAligned from "../fixtures/roomba-plus/hass_state_rooms_map_vacuum_aligned.json" with { type: "json" };
import threeRooms from "../fixtures/roomba-plus/synthetic/hass_state_rooms_map_three_rooms.json" with { type: "json" };

/** Points from `[x, y]` pairs; a pair with a missing value becomes NaN, which the geometry refuses. */
export function toPoints(pairs: readonly (readonly number[])[]): Point[] {
  return pairs.map(([x, y]) => ({ x: x ?? Number.NaN, y: y ?? Number.NaN }));
}

export interface PixelRoom {
  readonly id: string;
  readonly outline: readonly Point[];
  /** The integration's vertex mean (`x`, `y`), mapped to pixels. */
  readonly vertexMean: Point;
}

interface RoomsMapFixture {
  readonly attributes: {
    readonly calibration_points: readonly CalibrationPair[];
    readonly rooms: Readonly<
      Record<
        string,
        { readonly region_id: string; readonly outline: number[][]; readonly x: number; readonly y: number }
      >
    >;
  };
}

export const fixtures = { vacuumAligned, mopPending, threeRooms } satisfies Record<string, RoomsMapFixture>;

export function pixelRooms(fixture: RoomsMapFixture): PixelRoom[] {
  const solved = solveCalibration(fixture.attributes.calibration_points);
  if (solved.kind !== "transform") throw new Error(solved.reason);
  return Object.values(fixture.attributes.rooms).map((room) => {
    const validated = validateOutline(toPoints(room.outline));
    if (validated.kind !== "outline") throw new Error(validated.reason);
    const pixels = toPixels(solved.transform, validated.outline);
    if (pixels.kind !== "pixels") throw new Error(pixels.reason);
    return { id: room.region_id, outline: pixels.points, vertexMean: applyTransform(solved.transform, room) };
  });
}

/** A point in the fixture's outline units (mm), mapped to its picture's pixels. */
export function toPixel(fixture: RoomsMapFixture, point: Point): Point {
  const solved = solveCalibration(fixture.attributes.calibration_points);
  if (solved.kind !== "transform") throw new Error(solved.reason);
  return applyTransform(solved.transform, point);
}

/** A room's outline in the fixture's own units (mm). */
export function mmOutline(fixture: RoomsMapFixture, name: string): Point[] {
  const room = fixture.attributes.rooms[name];
  if (!room) throw new Error(`no room ${name} in the fixture`);
  return toPoints(room.outline);
}

/** One room of a fixture by region id; throws when it is missing, so tests need no `undefined` handling. */
export function pixelRoom(fixture: RoomsMapFixture, regionId: string): PixelRoom {
  const room = pixelRooms(fixture).find((r) => r.id === regionId);
  if (!room) throw new Error(`no room ${regionId} in the fixture`);
  return room;
}
