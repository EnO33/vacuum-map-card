import { MAX_ABS_COORDINATE } from "./limits";
import type { Point } from "./types";

export type CoordinateFailure = "non_finite" | "out_of_range";

/**
 * Checks every coordinate in one pass, without allocating. `non_finite` wins over `out_of_range` anywhere in the list.
 * `Math.abs(v) <= MAX` is false for NaN and ±Infinity, so the common path needs one comparison per value.
 */
export function checkCoordinates(points: readonly Point[]): CoordinateFailure | undefined {
  let outOfRange = false;
  for (const { x, y } of points) {
    if (Math.abs(x) <= MAX_ABS_COORDINATE && Math.abs(y) <= MAX_ABS_COORDINATE) continue;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return "non_finite";
    outOfRange = true;
  }
  return outOfRange ? "out_of_range" : undefined;
}

export function isFinitePoint({ x, y }: Point): boolean {
  return Number.isFinite(x) && Number.isFinite(y);
}
