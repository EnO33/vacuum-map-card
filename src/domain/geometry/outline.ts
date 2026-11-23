import { type Unsupported, unsupported } from "../unsupported";
import { applyTransform } from "./affine";
import { type CoordinateFailure, checkCoordinates, isFinitePoint } from "./coordinates";
import { MAX_OUTLINE_POINTS, MIN_OUTLINE_POINTS } from "./limits";
import type { AffineTransform, Outline, Point } from "./types";

export type OutlineFailure = "too_few_points" | "too_many_points" | CoordinateFailure;

/** Checks a room outline against ADR 0002 « Parsing limits » item 1. Points are already typed by the adapter. */
export function validateOutline(
  points: readonly Point[],
): { readonly kind: "outline"; readonly outline: Outline } | Unsupported<OutlineFailure> {
  if (points.length < MIN_OUTLINE_POINTS) return unsupported("too_few_points");
  if (points.length > MAX_OUTLINE_POINTS) return unsupported("too_many_points");
  const coordinates = checkCoordinates(points);
  if (coordinates) return unsupported(coordinates);
  // Validated boundary: a frozen copy of points that satisfy every limit above, so the caller cannot change it later.
  return { kind: "outline", outline: Object.freeze([...points]) as Outline };
}

/**
 * Maps a validated outline to picture pixels and refuses it whole when any pixel is not finite or exceeds the
 * coordinate limit. The degeneracy test does not bound the scale, so a tiny calibration triangle can give huge pixels.
 */
export function toPixels(
  transform: AffineTransform,
  outline: Outline,
):
  | { readonly kind: "pixels"; readonly points: readonly Point[] }
  | Unsupported<"non_finite_result" | "out_of_range_result"> {
  const points: Point[] = [];
  for (const point of outline) {
    const pixel = applyTransform(transform, point);
    if (!isFinitePoint(pixel)) return unsupported("non_finite_result");
    points.push(pixel);
  }
  return checkCoordinates(points) ? unsupported("out_of_range_result") : { kind: "pixels", points };
}
