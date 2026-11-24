import type { CardView } from "./card-session";
import { planCount } from "./plan-display";

/** Masonry units are 50 px: the title, then about 350 px per plan (a picture in a column about 400 px wide, its heading and label). */
const TITLE_SIZE = 1;
const PLAN_SIZE = 7;
const HEADING_SIZE = 1;
/** The title and one line of status, before the plans are read or when there is none. */
const STATUS_SIZE = 2;

/**
 * The masonry view's estimate, synchronous (Home Assistant waits 500 ms, then assumes 1): plans are counted stacked, as
 * in a masonry column, plus the « no floor » heading.
 */
export function cardSize(view: CardView): number {
  if (view.kind !== "ready") return STATUS_SIZE;
  const plans = planCount(view.model);
  if (plans === 0) return STATUS_SIZE;
  return TITLE_SIZE + plans * PLAN_SIZE + (view.model.noFloor.length > 0 ? HEADING_SIZE : 0);
}
