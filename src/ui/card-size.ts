import type { CardView } from "./card-view";
import { hasPlanExtras } from "./plan-content";
import { shownPlans } from "./plan-display";
import { hasRobotNotes } from "./robot-notes";

/** Masonry units are 50 px: the title, then about 350 px per plan (a picture in a column about 400 px wide, its heading and label). */
const TITLE_SIZE = 1;
const PLAN_SIZE = 7;
const HEADING_SIZE = 1;
/** The title and one line of status, before the plans are read or when there is none. */
const STATUS_SIZE = 2;
/** A plan's room list or note, a robot's progress with its button, and the robots' notes: a few lines each. */
const EXTRAS_SIZE = 2;

/**
 * The masonry view's estimate, synchronous (Home Assistant waits 500 ms, then assumes 1): plans are counted stacked, as
 * in a masonry column, with their room list or note, plus the « no floor » heading and the robots' notes.
 */
export function cardSize(view: CardView): number {
  if (view.kind !== "ready") return STATUS_SIZE;
  const plans = shownPlans(view.model);
  const robotNotes = hasRobotNotes(view.model.robots) ? EXTRAS_SIZE : 0;
  const progress = view.progress.length * EXTRAS_SIZE;
  if (plans.length === 0) return STATUS_SIZE + progress + robotNotes;
  const extras = plans.filter(hasPlanExtras).length * EXTRAS_SIZE + progress;
  return (
    TITLE_SIZE + plans.length * PLAN_SIZE + extras + robotNotes + (view.model.noFloor.length > 0 ? HEADING_SIZE : 0)
  );
}
