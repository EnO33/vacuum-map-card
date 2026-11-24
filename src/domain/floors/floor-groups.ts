import type { Floor } from "../registry/types";
import { compareCodeUnits } from "../text/compare";

/** A plan with the floor it was linked to, or `undefined` for none; reasons stay on the caller's type. */
export interface PlacedPlan {
  readonly vacuumEntityId: string;
  readonly planEntityId: string;
  readonly floorId: string | undefined;
}

export type FloorGroup<P extends PlacedPlan> =
  | { readonly kind: "floor"; readonly floor: Floor; readonly plans: readonly P[] }
  | { readonly kind: "no_floor"; readonly plans: readonly P[] };

/**
 * Plans grouped by floor in the given list order (`config/floor_registry/list`, ADR 0005 « Floors » item 1), keeping
 * only floors with a plan (item 3), then one « no floor » group (item 2) with every other plan, sorted by vacuum, then
 * plan entity id, in code-unit order. Give it the same floor list the plans were linked with (`floorOfStoredMap`):
 * a plan whose floor is not in it lands in « no floor » without the caller's reasons.
 */
export function groupByFloor<P extends PlacedPlan>(floors: readonly Floor[], plans: readonly P[]): FloorGroup<P>[] {
  const byFloor = new Map<string, { readonly kind: "floor"; readonly floor: Floor; readonly plans: P[] }>();
  for (const floor of floors) byFloor.set(floor.floorId, { kind: "floor", floor, plans: [] });
  const unplaced: P[] = [];
  for (const plan of plans) {
    const group = plan.floorId === undefined ? undefined : byFloor.get(plan.floorId);
    if (group) group.plans.push(plan);
    else unplaced.push(plan);
  }
  const groups: FloorGroup<P>[] = [...byFloor.values()].filter((group) => group.plans.length > 0);
  if (unplaced.length > 0) groups.push({ kind: "no_floor", plans: unplaced.sort(byVacuumThenPlan) });
  return groups;
}

/**
 * The one plan a floor shows (ADR 0005 « Room to area », last paragraph): a plan with outlines before a picture-only
 * plan, then the smallest vacuum entity id, then the smallest plan entity id, in code-unit order.
 */
export function planShownOnFloor<P extends PlacedPlan & { readonly outlines: boolean }>(
  plans: readonly P[],
): P | undefined {
  return [...plans].sort((a, b) => Number(b.outlines) - Number(a.outlines) || byVacuumThenPlan(a, b))[0];
}

function byVacuumThenPlan(a: PlacedPlan, b: PlacedPlan): number {
  return compareCodeUnits(a.vacuumEntityId, b.vacuumEntityId) || compareCodeUnits(a.planEntityId, b.planEntityId);
}
