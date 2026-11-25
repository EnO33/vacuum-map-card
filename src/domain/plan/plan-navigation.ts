import { type NavigationAnchor, nearestAnchorWithin, readingOrder } from "../geometry/room-navigation";
import type { Point } from "../geometry/types";
import { type DrawableRoom, drawableRooms, type RoomsPlan, roomAt } from "./rooms-plan";

/** A loaded picture's natural size, in pixels: the outlines' coordinate space. */
export interface PictureSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Anchors this far apart vertically, as a share of the picture's height, still read as one row: label anchors of
 * rooms side by side are rarely level.
 */
const ROW_TOLERANCE_RATIO = 0.05;

/** A plan's drawable rooms in reading order over a picture of `size`, with the anchors arrows and taps use. */
export interface PlanNavigation {
  readonly plan: RoomsPlan;
  readonly size: PictureSize;
  readonly rooms: readonly DrawableRoom[];
  readonly anchors: readonly NavigationAnchor[];
}

/** Worked out once per plan and picture size, never on a key press or a tap. */
export function planNavigation(plan: RoomsPlan, size: PictureSize): PlanNavigation {
  const placed = drawableRooms(plan).map((room) => ({ id: room.regionId, point: room.shape.anchor.point, room }));
  const ordered = readingOrder(placed, size.height * ROW_TOLERANCE_RATIO);
  return {
    plan,
    size,
    rooms: ordered.map(({ room }) => room),
    anchors: ordered.map(({ id, point }) => ({ id, point })),
  };
}

/**
 * The room a tap at a picture pixel selects (ADR 0004 « Amendment (2026-11-25) » item 2). A room too small for a
 * target of `targetHalf` pixels each side (its label anchor is nearer its edge) takes a tap within that target around
 * its anchor, even over the larger room next to it; the nearest anchor wins between two. Elsewhere the room under the
 * tap wins, the smallest where shapes overlap (`roomAt`).
 */
export function roomAtTap(navigation: PlanNavigation, point: Point, targetHalf: number): string | undefined {
  const under = roomAt(navigation.plan, point);
  const small = navigation.rooms
    .filter(({ shape }) => shape.anchor.distance < targetHalf)
    .map(({ regionId, shape }) => ({ id: regionId, point: shape.anchor.point }));
  if (under !== undefined && small.some(({ id }) => id === under)) return under;
  return nearestAnchorWithin(small, point, targetHalf) ?? under;
}
