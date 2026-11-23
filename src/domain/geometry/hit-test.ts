import { polygonArea } from "./polygon";
import type { Point } from "./types";

/** Tolerance, in the outline's own units, for a point to count as on an edge. */
const ON_EDGE_EPSILON = 1e-9;

/** Even-odd rule; a point on an edge or a vertex counts as inside. Runs on every pointer event, so it allocates nothing. */
export function containsPoint(outline: readonly Point[], point: Point): boolean {
  let previous = outline.at(-1);
  if (!previous) return false;
  let inside = false;
  for (const current of outline) {
    const a = current;
    const b = previous;
    previous = current;
    if (a.y > point.y !== b.y > point.y) {
      const crossingX = ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
      if (Math.abs(point.x - crossingX) <= ON_EDGE_EPSILON) return true;
      if (point.x < crossingX) inside = !inside;
    } else if (onSegment(a, b, point)) {
      return true;
    }
  }
  return inside;
}

export interface HitRoom {
  readonly id: string;
  readonly outline: readonly Point[];
}

/** The room under a point: when several contain it, the smallest area wins, then the smallest id (code units). */
export function roomAt(rooms: readonly HitRoom[], point: Point): string | undefined {
  let best: { id: string; area: number } | undefined;
  for (const room of rooms) {
    if (!containsPoint(room.outline, point)) continue;
    const area = polygonArea(room.outline);
    if (!best || area < best.area || (area === best.area && room.id < best.id)) best = { id: room.id, area };
  }
  return best?.id;
}

/** Point on segment `ab`, for edges the ray test cannot decide (horizontal, or with an end at the point's height). */
function onSegment(a: Point, b: Point, p: Point): boolean {
  if (p.y < Math.min(a.y, b.y) - ON_EDGE_EPSILON || p.y > Math.max(a.y, b.y) + ON_EDGE_EPSILON) return false;
  if (p.x < Math.min(a.x, b.x) - ON_EDGE_EPSILON || p.x > Math.max(a.x, b.x) + ON_EDGE_EPSILON) return false;
  const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  const lengthSquared = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  return cross * cross <= ON_EDGE_EPSILON * ON_EDGE_EPSILON * Math.max(1, lengthSquared);
}
