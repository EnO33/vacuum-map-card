import type { CardView } from "./card-view";
import { hasPlanExtras } from "./plan-content";
import { shownPlans } from "./plan-display";
import { hasRobotNotes } from "./robot-notes";

/** Masonry units are 50 px: the title, then about 350 px per plan (a picture in a column about 400 px wide, its heading and label). */
const TITLE_SIZE = 1;
const PLAN_SIZE = 7;
const HEADING_SIZE = 1;
/** One line of status, before the plans are read or when there is none. */
const STATUS_SIZE = 1;
/** A plan's room list or note, a robot's progress with its button, and the robots' notes: a few lines each. */
const EXTRAS_SIZE = 2;

/**
 * The masonry view's estimate, synchronous (Home Assistant waits 500 ms, then assumes 1): the title when the card has
 * one, then the plans counted stacked, as in a masonry column, with their room list or note, plus the « no floor »
 * heading and the robots' notes, or one line of status.
 */
export function cardSize(view: CardView, titled: boolean): number {
  const title = titled ? TITLE_SIZE : 0;
  if (view.kind !== "ready") return title + STATUS_SIZE;
  const plans = shownPlans(view.model);
  const robotNotes = hasRobotNotes(view.model.robots) ? EXTRAS_SIZE : 0;
  const progress = view.progress.length * EXTRAS_SIZE;
  if (plans.length === 0) return title + STATUS_SIZE + progress + robotNotes;
  const extras = plans.filter(hasPlanExtras).length * EXTRAS_SIZE + progress;
  return title + plans.length * PLAN_SIZE + extras + robotNotes + (view.model.noFloor.length > 0 ? HEADING_SIZE : 0);
}
