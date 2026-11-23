import type { Point } from "./types";

/** `M x y L x y … Z`, numbers rounded to 2 decimals, never `-0` nor an exponent; same input, same string. */
export function toSvgPath(outline: readonly Point[]): string {
  const [first, ...rest] = outline;
  if (!first) return "";
  return `M ${format(first.x)} ${format(first.y)}${rest.map((p) => ` L ${format(p.x)} ${format(p.y)}`).join("")} Z`;
}

/**
 * Rounded to 2 decimals and printed in its shortest form: `String(-0)` is `"0"`, and JavaScript writes no exponent
 * between 1e-6 and 1e21, which covers 0.01 up to the 1e7 coordinate limit.
 */
function format(value: number): string {
  return String(Math.round(value * 100) / 100);
}
