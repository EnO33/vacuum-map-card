// Test helper: a rooms map fixture turned into the typed snapshot an adapter would build (Epic 4 parses for real).
import type { CalibrationPair, Point } from "../../src/domain/geometry/types";
import type { RoomsMapSnapshot, SnapshotRoom } from "../../src/domain/plan/rooms-map-snapshot";
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

/** A square of `size` outline units at the origin. */
export function squareOutline(size = 1000): Point[] {
  return toPoints([
    [0, 0],
    [size, 0],
    [size, size],
    [0, size],
  ]);
}

/** A square room at the origin, for tests that need many rooms. */
export function squareRoom(regionId: string, size = 1000): SnapshotRoom {
  return { regionId, name: `Room ${regionId}`, roomId: `room_${regionId}`, outline: squareOutline(size) };
}
