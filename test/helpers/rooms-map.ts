// Test helper for `src/adapters/roomba-plus/rooms-map-attributes.ts`: rooms map attributes built room by room.
import { roomsMapContentOf } from "../../src/adapters/roomba-plus/rooms-map-attributes";
import aligned from "../fixtures/roomba-plus/hass_state_rooms_map_vacuum_aligned.json" with { type: "json" };

export const MALFORMED = { kind: "unsupported", reason: "malformed_attributes" };

/** The three calibration pairs of the aligned capture. */
export const CALIBRATION = aligned.attributes.calibration_points;

/** One Roomba+ Classic room attribute, a triangle, changed by `overrides`. */
export function room(regionId: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    outline: [
      [0, 0],
      [100, 0],
      [100, 100],
    ],
    name: `Room ${regionId}`,
    room_id: `room_${regionId}`,
    region_id: regionId,
    icon: "mdi:sofa",
    x: 50,
    y: 33,
    ...overrides,
  };
}

/** The content of a state whose attributes are `attributes`. */
export function contentOf(attributes: unknown, state: unknown = "2026-01-01T09:30:00+00:00") {
  return roomsMapContentOf({ state, attributes });
}

/** The content of a rooms map with `rooms` and `calibration`, next to a token that must never be copied. */
export function withRooms(rooms: unknown, calibration: unknown = CALIBRATION) {
  return contentOf({ rooms, calibration_points: calibration, access_token: "0001" });
}
