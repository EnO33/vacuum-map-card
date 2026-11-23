import { type Unsupported, unsupported } from "../unsupported";
import { type CoordinateFailure, checkCoordinates } from "./coordinates";
import { CALIBRATION_PAIRS, DEGENERACY_TOLERANCE } from "./limits";
import type { AffineTransform, CalibrationPair, Point } from "./types";

export type CalibrationFailure =
  | "calibration_pair_count"
  | CoordinateFailure
  | "vacuum_points_collinear"
  | "map_points_collinear";

export type CalibrationResult =
  | { readonly kind: "transform"; readonly transform: AffineTransform }
  | Unsupported<CalibrationFailure>;

type Triangle = readonly [Point, Point, Point];

/** Solves the affine map from outline units to pixels given exactly three calibration pairs (ADR 0002). */
export function solveCalibration(pairs: readonly CalibrationPair[]): CalibrationResult {
  const [p1, p2, p3] = pairs;
  if (pairs.length !== CALIBRATION_PAIRS || !p1 || !p2 || !p3) return unsupported("calibration_pair_count");
  const vacuum: Triangle = [p1.vacuum, p2.vacuum, p3.vacuum];
  const map: Triangle = [p1.map, p2.map, p3.map];
  const coordinates = checkCoordinates([...vacuum, ...map]);
  if (coordinates) return unsupported(coordinates);
  if (isDegenerate(vacuum)) return unsupported("vacuum_points_collinear");
  if (isDegenerate(map)) return unsupported("map_points_collinear");

  const det = cross(vacuum);
  const [a, b, c] = solveRow(vacuum, det, [p1.map.x, p2.map.x, p3.map.x]);
  const [d, e, f] = solveRow(vacuum, det, [p1.map.y, p2.map.y, p3.map.y]);
  return { kind: "transform", transform: { a, b, c, d, e, f } };
}

export function applyTransform(t: AffineTransform, p: Point): Point {
  return { x: t.a * p.x + t.b * p.y + t.c, y: t.d * p.x + t.e * p.y + t.f };
}

/** Determinant of the linear part; negative when the picture flips y. */
export function linearDeterminant(t: AffineTransform): number {
  return t.a * t.e - t.b * t.d;
}

/** Twice the signed area of the triangle. */
function cross([p, q, r]: Triangle): number {
  return (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
}

function isDegenerate(t: Triangle): boolean {
  const [p, q, r] = t;
  const longest = Math.max(squaredDistance(p, q), squaredDistance(q, r), squaredDistance(r, p));
  return longest === 0 || Math.abs(cross(t)) / longest < DEGENERACY_TOLERANCE;
}

function squaredDistance(p: Point, q: Point): number {
  return (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
}

/** Solves `out_i = k1·x_i + k2·y_i + k3` for the three points by Cramer's rule; `det` is `cross(t)`, non-zero. */
function solveRow(t: Triangle, det: number, [o1, o2, o3]: readonly [number, number, number]): [number, number, number] {
  const [p, q, r] = t;
  const k1 = (o1 * (q.y - r.y) + o2 * (r.y - p.y) + o3 * (p.y - q.y)) / det;
  const k2 = (o1 * (r.x - q.x) + o2 * (p.x - r.x) + o3 * (q.x - p.x)) / det;
  return [k1, k2, o1 - k1 * p.x - k2 * p.y];
}
