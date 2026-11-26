import { compareCodeUnits } from "../text/compare";
import type { Point } from "./types";

/** A room's place for keyboard navigation and tap targets: its label anchor, in picture pixels. */
export interface NavigationAnchor {
  readonly id: string;
  readonly point: Point;
}

export type ArrowDirection = "up" | "down" | "left" | "right";

/** How much more a step across the arrow's axis costs than a step along it. */
const CROSS_WEIGHT = 2;

/**
 * Anchors in reading order: rows top to bottom, each row left to right. A row takes every anchor at most
 * `rowTolerance` below its top anchor, so rooms a little off level read as one row and a slope never chains into one.
 * Equal points are ordered by id, in code units, so the order never depends on the input order.
 */
export function readingOrder<T extends NavigationAnchor>(anchors: readonly T[], rowTolerance: number): T[] {
  const byHeight = [...anchors].sort((a, b) => a.point.y - b.point.y || byPosition(a, b));
  const order: T[] = [];
  let row: T[] = [];
  for (const current of byHeight) {
    const [top] = row;
    if (top && current.point.y - top.point.y > rowTolerance) {
      order.push(...row.sort(byPosition));
      row = [];
    }
    row.push(current);
  }
  order.push(...row.sort(byPosition));
  return order;
}

/**
 * The room an arrow key moves to from `fromId`: among the anchors strictly ahead in the arrow's direction, the lowest
 * distance along the axis plus `CROSS_WEIGHT` times the distance across it, then the smallest id. `undefined` when no
 * room lies ahead or `fromId` is not among the anchors.
 */
export function nextRoom(
  anchors: readonly NavigationAnchor[],
  fromId: string,
  direction: ArrowDirection,
): string | undefined {
  const from = anchors.find((a) => a.id === fromId)?.point;
  if (!from) return undefined;
  const [alongX, alongY] = AXES[direction];
  return lowestScore(anchors, ({ point }) => {
    const dx = point.x - from.x;
    const dy = point.y - from.y;
    const along = dx * alongX + dy * alongY;
    return along > 0 ? along + CROSS_WEIGHT * Math.abs(dx * alongY + dy * alongX) : undefined;
  });
}

/**
 * The anchor nearest `point` among those whose square target, `targetHalf` pixels each side of the anchor, holds it;
 * then the smallest id. `undefined` when no target holds the point.
 */
export function nearestAnchorWithin(
  anchors: readonly NavigationAnchor[],
  point: Point,
  targetHalf: number,
): string | undefined {
  return lowestScore(anchors, (anchor) => {
    const dx = point.x - anchor.point.x;
    const dy = point.y - anchor.point.y;
    return Math.abs(dx) > targetHalf || Math.abs(dy) > targetHalf ? undefined : Math.hypot(dx, dy);
  });
}

/** Unit vector of each arrow: `along = dx·x + dy·y`; the other component is the distance across. */
const AXES: Readonly<Record<ArrowDirection, readonly [number, number]>> = {
  right: [1, 0],
  left: [-1, 0],
  down: [0, 1],
  up: [0, -1],
};

/** The id with the lowest score, then the smallest id in code units; `undefined` scores are left out. */
function lowestScore(
  anchors: readonly NavigationAnchor[],
  score: (anchor: NavigationAnchor) => number | undefined,
): string | undefined {
  let best: { id: string; score: number } | undefined;
  for (const anchor of anchors) {
    const value = score(anchor);
    if (value === undefined) continue;
    if (!best || value < best.score || (value === best.score && compareCodeUnits(anchor.id, best.id) < 0)) {
      best = { id: anchor.id, score: value };
    }
  }
  return best?.id;
}

function byPosition(a: NavigationAnchor, b: NavigationAnchor): number {
  return a.point.x - b.point.x || compareCodeUnits(a.id, b.id);
}
