import { forEachEdge } from "./edges";
import type { Point } from "./types";

/** Absolute area by the shoelace formula. */
export function polygonArea(outline: readonly Point[]): number {
  let twice = 0;
  forEachEdge(outline, (a, b) => {
    twice += a.x * b.y - b.x * a.y;
  });
  return Math.abs(twice) / 2;
}

/** Area centroid, or `undefined` for an outline without area (flat or empty). */
export function areaCentroid(outline: readonly Point[]): Point | undefined {
  let twice = 0;
  let cx = 0;
  let cy = 0;
  forEachEdge(outline, (a, b) => {
    const f = a.x * b.y - b.x * a.y;
    twice += f;
    cx += (a.x + b.x) * f;
    cy += (a.y + b.y) * f;
  });
  return twice === 0 ? undefined : { x: cx / (3 * twice), y: cy / (3 * twice) };
}
