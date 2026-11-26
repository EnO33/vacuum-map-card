import type { ProgressEntry } from "../app/progress/progress-tracker";
import type { ProgressPhase } from "../domain/clean/progress";
import type { Locale } from "../i18n/catalogs";
import { type ProgressTone, progressTone } from "./progress-marks";
import { phaseLabel, roomNameWithProgress } from "./progress-words";

/**
 * A room's or an area's progress as the card draws it: its accessible name with each robot's phase, and the label,
 * colour and icon of the most urgent entry. Several robots sent to one item are all named; one is drawn.
 */
export interface ItemProgress {
  readonly name: string;
  readonly label: string;
  readonly tone: ProgressTone;
  readonly entry: ProgressEntry;
}

const NONE: readonly ProgressEntry[] = Object.freeze([]);

/** The entries by plan picture, worked out once per entries array (the tracker keeps it while nothing changed). */
const BY_PLAN = new WeakMap<readonly ProgressEntry[], ReadonlyMap<string, readonly ProgressEntry[]>>();

/**
 * The entries of the robots sent to an item of the plan with this picture: the same array while the progress does not
 * change, so the plan's picture is not updated by a render for something else.
 */
export function entriesOnPlan(entries: readonly ProgressEntry[], imageEntityId: string): readonly ProgressEntry[] {
  let byPlan = BY_PLAN.get(entries);
  if (byPlan === undefined) {
    const grouped = new Map<string, ProgressEntry[]>();
    for (const entry of entries) {
      const id = entry.item.imageEntityId;
      grouped.set(id, [...(grouped.get(id) ?? []), entry]);
    }
    byPlan = grouped;
    BY_PLAN.set(entries, byPlan);
  }
  return byPlan.get(imageEntityId) ?? NONE;
}

/** How urgent a phase is to see on a room shared by several robots: lower first. */
const URGENCY: Readonly<Record<ProgressPhase, number>> = {
  failed: 0,
  may_have_started: 1,
  not_started: 3,
  paused: 4,
  cleaning: 5,
  starting: 6,
  sending: 7,
  done: 8,
};

/** The entry to draw: a failure before a doubt, an unknown status, then work under way, and « done » last. */
function mostUrgent(entries: readonly ProgressEntry[]): ProgressEntry | undefined {
  const urgency = (entry: ProgressEntry) => (entry.statusUnknown ? 2 : URGENCY[entry.phase]);
  return entries.reduce<ProgressEntry | undefined>(
    (best, entry) => (best === undefined || urgency(entry) < urgency(best) ? entry : best),
    undefined,
  );
}

/** The progress of one item, from the entries on its plan; `undefined` when no robot was sent to it. */
export function itemProgress(
  locale: Locale,
  name: string,
  entries: readonly ProgressEntry[],
  robotName: (vacuumEntityId: string) => string,
): ItemProgress | undefined {
  const drawn = mostUrgent(entries);
  if (drawn === undefined) return undefined;
  return {
    name: roomNameWithProgress(locale, name, entries, robotName),
    label: phaseLabel(locale, drawn),
    tone: progressTone(drawn),
    entry: drawn,
  };
}

/** The entries on an area of a room list. */
export function entriesOnArea(entries: readonly ProgressEntry[], areaId: string): ProgressEntry[] {
  return entries.filter(({ item }) => item.kind === "area" && item.areaId === areaId);
}

/** Each room a robot was sent to, by region id, from the entries on its plan. */
export function roomsProgress(
  locale: Locale,
  rooms: readonly { readonly regionId: string; readonly name: string }[],
  entries: readonly ProgressEntry[],
  robotName: (vacuumEntityId: string) => string,
): ReadonlyMap<string, ItemProgress> {
  const byRoom = new Map<string, ProgressEntry[]>();
  for (const entry of entries) {
    const { item } = entry;
    if (item.kind === "room") byRoom.set(item.regionId, [...(byRoom.get(item.regionId) ?? []), entry]);
  }
  const shown = new Map<string, ItemProgress>();
  for (const { regionId, name } of rooms) {
    const found = itemProgress(locale, name, byRoom.get(regionId) ?? [], robotName);
    if (found) shown.set(regionId, found);
  }
  return shown;
}

/** Whether two progress lists hold the same entries, in the same order: a new array of them is no change. */
export function sameEntries(next: unknown, last: unknown): boolean {
  if (next === last) return true;
  if (!Array.isArray(next) || !Array.isArray(last) || next.length !== last.length) return false;
  return next.every((entry, i) => entry === last[i]);
}
