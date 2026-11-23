// Geometry limits from ADR 0002, amendment, « Parsing limits », item 1: coordinates, outline points, calibration.
// The room count per plan (item 1) and the string and collection caps (item 3) live with the modules that read
// rooms and mappings, each in its own limits file. Generous against real homes; outside them is « unsupported ».

/** Largest accepted absolute value of any coordinate, in outline units (mm) or pixels. */
export const MAX_ABS_COORDINATE = 1e7;

/** Fewest points of a room outline. */
export const MIN_OUTLINE_POINTS = 3;

/** Most points of a room outline. */
export const MAX_OUTLINE_POINTS = 1000;

/** Exact number of calibration pairs (vacuum point, picture point). */
export const CALIBRATION_PAIRS = 3;

/**
 * A calibration triangle is degenerate when twice its area, divided by its longest edge squared, is below this value.
 * That ratio is the triangle's height over its longest edge: it catches near-collinear points (which give enormous,
 * unstable scales), not only an exact zero, and it does not depend on the unit (mm or pixels).
 */
export const DEGENERACY_TOLERANCE = 1e-3;
