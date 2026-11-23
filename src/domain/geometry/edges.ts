import type { Point } from "./types";

/**
 * Calls `visit(previous, point)` for every edge of a closed outline, the last edge closing back to the first point.
 * A plain loop with a callback: no generator and no tuple per edge, because hit tests and the label search run it hot.
 */
export function forEachEdge(outline: readonly Point[], visit: (a: Point, b: Point) => void): void {
  let previous = outline.at(-1);
  if (!previous) return;
  for (const point of outline) {
    visit(previous, point);
    previous = point;
  }
}
