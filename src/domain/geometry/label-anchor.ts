import { forEachEdge } from "./edges";
import { areaCentroid } from "./polygon";
import type { Point } from "./types";

export interface LabelAnchor {
  /** When `distance` is positive, a point inside the outline near its pole of inaccessibility; otherwise no label. */
  readonly point: Point;
  /** Distance from that point to the nearest edge; Epic 5 hides a label that does not fit. */
  readonly distance: number;
}

/**
 * When the search ends before the cell cap, the anchor's distance to the nearest edge is at least the best possible
 * distance (the pole of inaccessibility's) minus this many pixels.
 */
export const LABEL_PRECISION_PX = 0.5;

/** Most cells the search examines; bounds the work on any outline, however long and thin. */
export const LABEL_MAX_CELLS = 10_000;

/** Most cells along one axis of the starting grid, so a long, thin outline cannot explode the grid. */
const MAX_START_CELLS_PER_AXIS = 64;

interface Cell {
  readonly x: number;
  readonly y: number;
  /** Half the cell size. */
  readonly h: number;
  /** Signed distance from the centre to the outline: positive inside. */
  readonly d: number;
  /** Best distance any point of the cell can reach. */
  readonly max: number;
}

interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Pole of inaccessibility by cell subdivision (the « polylabel » method). Cells that lie wholly outside are dropped;
 * once an inside point is known, so are cells that cannot beat it by more than the precision. Deterministic,
 * iterative, with a bounded starting grid and at most `LABEL_MAX_CELLS` examined cells. A `distance` of 0 or less
 * means no inside point was found: a degenerate outline, or one far thinner than its length (under about 1 px across
 * thousands of pixels), where the cap ends the search first. The caller shows no label then; the hit test still works.
 */
export function labelAnchor(outline: readonly Point[]): LabelAnchor {
  const [first] = outline;
  if (!first) return { point: { x: 0, y: 0 }, distance: 0 };
  const { minX, minY, width, height } = bounds(outline, first);
  const longest = Math.max(width, height);
  if (longest === 0) return { point: first, distance: 0 };

  // Integer indices: `x += size` could stop moving when `size` is below the precision of `x`.
  const size = Math.max(Math.min(width, height), longest / MAX_START_CELLS_PER_AXIS);
  const columns = Math.min(MAX_START_CELLS_PER_AXIS, Math.max(1, Math.ceil(width / size)));
  const rows = Math.min(MAX_START_CELLS_PER_AXIS, Math.max(1, Math.ceil(height / size)));
  const queue = new CellQueue();
  for (let i = 0; i < columns; i++) {
    for (let j = 0; j < rows; j++) {
      queue.push(makeCell(minX + (i + 0.5) * size, minY + (j + 0.5) * size, size / 2, outline));
    }
  }
  let best = makeCell(minX + width / 2, minY + height / 2, 0, outline);
  const centroid = areaCentroid(outline);
  if (centroid) best = better(best, makeCell(centroid.x, centroid.y, 0, outline));

  for (let examined = 0; examined < LABEL_MAX_CELLS; examined++) {
    const cell = queue.pop();
    if (!cell) break;
    best = better(best, cell);
    if (cell.max <= 0) continue;
    if (best.d > 0 && cell.max - best.d <= LABEL_PRECISION_PX) continue;
    const h = cell.h / 2;
    queue.push(makeCell(cell.x - h, cell.y - h, h, outline));
    queue.push(makeCell(cell.x + h, cell.y - h, h, outline));
    queue.push(makeCell(cell.x - h, cell.y + h, h, outline));
    queue.push(makeCell(cell.x + h, cell.y + h, h, outline));
  }
  return { point: { x: best.x, y: best.y }, distance: best.d };
}

function bounds(outline: readonly Point[], first: Point): Bounds {
  let minX = first.x;
  let minY = first.y;
  let maxX = first.x;
  let maxY = first.y;
  for (const { x, y } of outline) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

function better(a: Cell, b: Cell): Cell {
  return b.d > a.d ? b : a;
}

function makeCell(x: number, y: number, h: number, outline: readonly Point[]): Cell {
  const d = signedDistance({ x, y }, outline);
  return { x, y, h, d, max: d + h * Math.SQRT2 };
}

/** Distance to the nearest edge, positive inside (even-odd), in one pass over the edges. */
function signedDistance(p: Point, outline: readonly Point[]): number {
  let inside = false;
  let min = Number.POSITIVE_INFINITY;
  forEachEdge(outline, (a, b) => {
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    min = Math.min(min, segmentDistanceSquared(p, a, b));
  });
  const distance = Math.sqrt(min);
  // A point on an edge is at distance 0, never -0.
  return inside || distance === 0 ? distance : -distance;
}

function segmentDistanceSquared(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
  return (p.x - (a.x + t * dx)) ** 2 + (p.y - (a.y + t * dy)) ** 2;
}

/** Max-heap of cells by `max`, for best-first search under the cell cap. */
class CellQueue {
  readonly #items: Cell[] = [];

  push(cell: Cell): void {
    const items = this.#items;
    items.push(cell);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.#greater(i, parent)) break;
      this.#swap(i, parent);
      i = parent;
    }
  }

  pop(): Cell | undefined {
    const items = this.#items;
    const top = items[0];
    const last = items.pop();
    if (items.length === 0 || !last) return top;
    items[0] = last;
    for (let i = 0; ; ) {
      const left = 2 * i + 1;
      const right = left + 1;
      let largest = i;
      if (left < items.length && this.#greater(left, largest)) largest = left;
      if (right < items.length && this.#greater(right, largest)) largest = right;
      if (largest === i) return top;
      this.#swap(i, largest);
      i = largest;
    }
  }

  #greater(i: number, j: number): boolean {
    return (this.#items[i]?.max ?? Number.NEGATIVE_INFINITY) > (this.#items[j]?.max ?? Number.NEGATIVE_INFINITY);
  }

  #swap(i: number, j: number): void {
    const items = this.#items;
    const a = items[i];
    const b = items[j];
    if (!a || !b) return;
    items[i] = b;
    items[j] = a;
  }
}
