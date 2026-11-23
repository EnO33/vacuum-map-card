/** A point in outline units (mm) or in picture pixels. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** One calibration pair: a point in outline units and the same point in picture pixels. */
export interface CalibrationPair {
  readonly vacuum: Point;
  readonly map: Point;
}

/**
 * Affine map from outline units to pixels: `px = a·x + b·y + c`, `py = d·x + e·y + f`.
 * The linear part is `[[a, b], [d, e]]`; its determinant is negative when the picture flips y.
 */
export interface AffineTransform {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
}

declare const outlineBrand: unique symbol;

/** A room outline that passed `validateOutline`; only that function builds one. */
export type Outline = readonly Point[] & { readonly [outlineBrand]: true };
