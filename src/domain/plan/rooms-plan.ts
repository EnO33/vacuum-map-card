import { type CalibrationFailure, solveCalibration } from "../geometry/affine";
import { type HitRoom, roomAt as roomUnder } from "../geometry/hit-test";
import { type LabelAnchor, labelAnchor } from "../geometry/label-anchor";
import { type OutlineFailure, toPixels, validateOutline } from "../geometry/outline";
import { toSvgPath } from "../geometry/svg-path";
import type { AffineTransform, Point } from "../geometry/types";
import { safeIcon } from "../text/icon";
import { withinTextCap } from "../text/limits";
import { type Unsupported, unsupported } from "../unsupported";
import type { RoomsMapSnapshot, SnapshotRoom } from "./rooms-map-snapshot";

/** Most rooms in one plan (ADR 0002 « Parsing limits » item 1). */
export const MAX_PLAN_ROOMS = 100;

export type RoomsPlanFailure = "too_many_rooms" | "duplicate_region_id" | "text_too_long" | CalibrationFailure;

export type RoomShapeFailure = "no_outline" | OutlineFailure | "non_finite_result" | "out_of_range_result";

/** A room ready to draw, in picture pixels. */
export interface DrawableShape {
  readonly kind: "drawable";
  readonly pixels: readonly Point[];
  readonly path: string;
  readonly anchor: LabelAnchor;
}

/**
 * A room of the plan. One that cannot be drawn stays in the plan with its reason: its name still counts for the
 * shadow check and for naming (ADR 0003), but it is not clickable.
 */
export interface PlanRoom {
  readonly regionId: string;
  readonly name: string;
  readonly roomId: string;
  /** A safe Material Design icon, or `undefined` for Epic 5's default. */
  readonly icon: string | undefined;
  readonly shape: DrawableShape | Unsupported<RoomShapeFailure>;
}

export interface RoomsPlan {
  readonly kind: "plan";
  /** Keyed by region id, in the snapshot's order; never a plain object (`__proto__` is a valid name). */
  readonly rooms: ReadonlyMap<string, PlanRoom>;
  /** The drawable rooms in pixels, gathered once per plan rather than on every pointer event. */
  readonly hitRooms: readonly HitRoom[];
}

export type RoomsPlanResult = RoomsPlan | { readonly kind: "no_outlines" } | Unsupported<RoomsPlanFailure>;

/**
 * Turns one rooms map snapshot into a plan. A snapshot without rooms means « no outlines right now » (no cloud,
 * no map), never an error. Any failure of the map as a whole (room count, string cap, duplicate region id,
 * calibration) refuses every room, because the shadow check needs every name on the map (ADR 0002 item 3).
 */
export function buildRoomsPlan(snapshot: RoomsMapSnapshot): RoomsPlanResult {
  const { rooms } = snapshot;
  if (rooms.length === 0) return { kind: "no_outlines" };
  const refused = refuseMap(rooms);
  if (refused) return unsupported(refused);
  const solved = solveCalibration(snapshot.calibration);
  if (solved.kind !== "transform") return solved;

  const planRooms = new Map<string, PlanRoom>();
  const hitRooms: HitRoom[] = [];
  for (const room of rooms) {
    const shape = shapeOf(room.outline, solved.transform);
    const { regionId, name, roomId } = room;
    planRooms.set(regionId, {
      regionId,
      name,
      roomId,
      icon: room.icon === undefined ? undefined : safeIcon(room.icon),
      shape,
    });
    if (shape.kind === "drawable") hitRooms.push({ id: regionId, outline: shape.pixels });
  }
  return { kind: "plan", rooms: planRooms, hitRooms };
}

/** A room of the plan that can be drawn. */
export type DrawableRoom = PlanRoom & { readonly shape: DrawableShape };

function isDrawable(room: PlanRoom): room is DrawableRoom {
  return room.shape.kind === "drawable";
}

/** The plan's rooms that can be drawn, in plan order. */
export function drawableRooms(plan: RoomsPlan): DrawableRoom[] {
  return [...plan.rooms.values()].filter(isDrawable);
}

/** The plan's rooms that cannot be drawn, in plan order: the UI names them, so none silently disappears. */
export function undrawableRooms(plan: RoomsPlan): PlanRoom[] {
  return [...plan.rooms.values()].filter((room) => !isDrawable(room));
}

/** The region id of the drawable room under a picture pixel, by the rule of the geometry hit test. */
export function roomAt(plan: RoomsPlan, point: Point): string | undefined {
  return roomUnder(plan.hitRooms, point);
}

function refuseMap(rooms: readonly SnapshotRoom[]): RoomsPlanFailure | undefined {
  if (rooms.length > MAX_PLAN_ROOMS) return "too_many_rooms";
  if (!rooms.every(withinCaps)) return "text_too_long";
  const regionIds = new Set(rooms.map((room) => room.regionId));
  return regionIds.size === rooms.length ? undefined : "duplicate_region_id";
}

function withinCaps({ regionId, name, roomId, icon }: SnapshotRoom): boolean {
  return [regionId, name, roomId, icon ?? ""].every(withinTextCap);
}

function shapeOf(
  outline: readonly Point[] | undefined,
  transform: AffineTransform,
): DrawableShape | Unsupported<RoomShapeFailure> {
  if (!outline) return unsupported("no_outline");
  const validated = validateOutline(outline);
  if (validated.kind !== "outline") return validated;
  const pixels = toPixels(transform, validated.outline);
  if (pixels.kind !== "pixels") return pixels;
  return {
    kind: "drawable",
    pixels: pixels.points,
    path: toSvgPath(pixels.points),
    anchor: labelAnchor(pixels.points),
  };
}
