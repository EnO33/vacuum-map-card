import { type ArrowDirection, nextRoom } from "../domain/geometry/room-navigation";
import type { Point } from "../domain/geometry/types";
import type { PictureSize, PlanNavigation } from "../domain/plan/plan-navigation";

/** Half of the 44 px touch target around a room's label anchor, in screen pixels (ADR 0004 « Touch targets »). */
export const TAP_TARGET_HALF_PX = 22;

/**
 * What a key pressed on a focused room does: move the focus to a room (maybe the same one), select the room, or only
 * keep the browser's default (a page scroll on Space, a repeated Enter).
 */
export type RoomKeyAction =
  | { readonly kind: "move"; readonly id: string }
  | { readonly kind: "select" }
  | { readonly kind: "hold" };

export type RoomKey = Pick<KeyboardEvent, "key" | "altKey" | "ctrlKey" | "metaKey" | "repeat">;

const VERTICAL: Readonly<Record<string, ArrowDirection>> = { ArrowUp: "up", ArrowDown: "down" };
const STEPS: Readonly<Record<string, number>> = { ArrowLeft: -1, ArrowRight: 1 };

function withModifier(event: RoomKey): boolean {
  return event.altKey || event.ctrlKey || event.metaKey;
}

/**
 * A key down on a focused room (ADR 0004 « Amendment (2026-11-25) » item 3). Left and Right step through the reading
 * order, Up and Down go to the nearest room that way; every arrow stays put at the plan's edge, so the focus never
 * leaves the plan. Home and End go to the first and last room. Enter selects, once while it repeats; Space selects on
 * key up (`selectsOnKeyUp`). A key with Alt, Ctrl or Meta, and any other key, is the browser's.
 */
export function roomKeyAction(event: RoomKey, from: string, navigation: PlanNavigation): RoomKeyAction | undefined {
  const { key } = event;
  if (withModifier(event)) return undefined;
  if (key === "Enter") return event.repeat ? { kind: "hold" } : { kind: "select" };
  if (key === " ") return { kind: "hold" };
  const { rooms, anchors } = navigation;
  const edge = key === "Home" ? rooms[0] : key === "End" ? rooms.at(-1) : undefined;
  if (edge) return { kind: "move", id: edge.regionId };
  if (Object.hasOwn(STEPS, key)) {
    const index = rooms.findIndex((room) => room.regionId === from) + (STEPS[key] ?? 0);
    return { kind: "move", id: rooms[index]?.regionId ?? from };
  }
  const direction = Object.hasOwn(VERTICAL, key) ? VERTICAL[key] : undefined;
  if (direction === undefined) return undefined;
  return { kind: "move", id: nextRoom(anchors, from, direction) ?? from };
}

/** Space selects when it comes up, as on a button. */
export function selectsOnKeyUp(event: RoomKey): boolean {
  return event.key === " " && !withModifier(event);
}

/** A pointer position over the layer, in picture pixels, with how many picture pixels one screen pixel spans. */
export interface PicturePoint {
  readonly point: Point;
  readonly scale: number;
}

/**
 * The layer is drawn at the picture's aspect ratio, so one scale maps both axes. `undefined` while the layer has no
 * size on screen.
 */
export function picturePoint(layer: DOMRect, size: PictureSize, client: Point): PicturePoint | undefined {
  if (!(layer.width > 0)) return undefined;
  const scale = size.width / layer.width;
  return { point: { x: (client.x - layer.left) * scale, y: (client.y - layer.top) * scale }, scale };
}
