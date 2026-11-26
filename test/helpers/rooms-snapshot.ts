// Test helper: a rooms map fixture turned into the typed snapshot an adapter would build (Epic 4 parses for real).
import type { CalibrationPair, Point } from "../../src/domain/geometry/types";
import type { RoomsMapSnapshot, SnapshotRoom } from "../../src/domain/plan/rooms-map-snapshot";
import { buildRoomsPlan, type RoomsPlan } from "../../src/domain/plan/rooms-plan";
import noCloud from "../fixtures/roomba-plus/synthetic/hass_state_rooms_map_no_cloud.json" with { type: "json" };
import withoutOutline from "../fixtures/roomba-plus/synthetic/hass_state_rooms_map_room_without_outline.json" with {
  type: "json",
};
import { fixtures, toPoints } from "./pixel-rooms";

interface FixtureRoom {
  readonly name: string;
  readonly room_id: string;
  readonly region_id: string;
  readonly icon?: string;
  readonly outline?: readonly (readonly number[])[];
}

interface RoomsMapFixture {
  readonly state: string;
  readonly attributes: {
    /** Present in every capture; required so a fixture without rooms still type-checks as one. */
    readonly friendly_name: string;
    readonly calibration_points?: readonly CalibrationPair[];
    readonly rooms?: Readonly<Record<string, FixtureRoom>>;
  };
}

export const snapshotFixtures = { ...fixtures, withoutOutline, noCloud } satisfies Record<string, RoomsMapFixture>;

/** A fresh snapshot on every call, so two calls give equal values that are different objects. */
export function snapshotOf(fixture: RoomsMapFixture): RoomsMapSnapshot {
  const { calibration_points = [], rooms = {} } = fixture.attributes;
  return {
    state: fixture.state,
    calibration: calibration_points.map((p) => ({ vacuum: { ...p.vacuum }, map: { ...p.map } })),
    rooms: Object.values(rooms).map(toSnapshotRoom),
  };
}

function toSnapshotRoom(room: FixtureRoom): SnapshotRoom {
  return {
    regionId: room.region_id,
    name: room.name,
    roomId: room.room_id,
    ...(room.icon === undefined ? {} : { icon: room.icon }),
    ...(room.outline === undefined ? {} : { outline: toPoints(room.outline) }),
  };
}

/** A square of `size` outline units with its first corner at `x`, `y` (the origin by default). */
export function squareOutline(size = 1000, x = 0, y = 0): Point[] {
  return toPoints([
    [x, y],
    [x + size, y],
    [x + size, y + size],
    [x, y + size],
  ]);
}

/** A square room at the origin, for tests that need many rooms. */
export function squareRoom(regionId: string, size = 1000): SnapshotRoom {
  return { regionId, name: `Room ${regionId}`, roomId: `room_${regionId}`, outline: squareOutline(size) };
}

/** The plan of a snapshot; throws when the snapshot gives no plan, so tests need no narrowing. */
export function planOf(snapshot: RoomsMapSnapshot): RoomsPlan {
  const result = buildRoomsPlan(snapshot);
  if (result.kind !== "plan") throw new Error(`expected a plan, got ${JSON.stringify(result)}`);
  return result;
}

/** A calibration that maps outline units to the same picture pixels, for tests that place rooms by pixel. */
const identityCalibration = [
  { vacuum: { x: 0, y: 0 }, map: { x: 0, y: 0 } },
  { vacuum: { x: 1000, y: 0 }, map: { x: 1000, y: 0 } },
  { vacuum: { x: 0, y: 1000 }, map: { x: 0, y: 1000 } },
];

/** A square room of `size` picture pixels with its top left corner at `x`, `y`, named after its region id. */
export function pixelSquare(regionId: string, x: number, y: number, size: number): SnapshotRoom {
  return { regionId, name: regionId, roomId: regionId, outline: squareOutline(size, x, y) };
}

/** The plan of rooms placed in picture pixels. */
export function pixelPlan(rooms: readonly SnapshotRoom[]): RoomsPlan {
  return planOf({ state: "2026-01-01T09:30:00+00:00", calibration: identityCalibration, rooms: [...rooms] });
}
