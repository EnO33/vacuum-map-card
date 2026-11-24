import type { Adapters } from "../adapters/create-adapters";
import type { FloorModel, Plan } from "../app/floor-model/floor-model";

/** What a shown plan displays beyond the floor model, read from the adapters on every refresh, never kept longer. */
export interface PlanDisplay {
  /**
   * `Adapters.pictureUrl` for an available picture: a new one whenever the image state changes (ADR 0005 « Plan
   * pictures » item 2). Only ever an `<img>` `src`: never logged, shown as text or put in another attribute (item 1).
   */
  readonly url: string | undefined;
  /** The robot's name, or its entity id when it has none, as Home Assistant shows it. */
  readonly robotName: string;
}

/** By plan picture entity id; compared with `sameValue`, so an unrelated `hass` update costs no render. */
export type PlanDisplays = ReadonlyMap<string, PlanDisplay>;

/** The plans the card shows: each floor's plan, then the « no floor » group. */
function shownPlans(model: FloorModel): readonly Plan[] {
  return [...model.floors.map((floor) => floor.plan), ...model.noFloor];
}

/** How many plans the card shows. */
export function planCount(model: FloorModel): number {
  return shownPlans(model).length;
}

export function planDisplaysOf(model: FloorModel, adapters: Pick<Adapters, "pictureUrl" | "display">): PlanDisplays {
  return new Map(
    shownPlans(model).map((plan) => [
      plan.imageEntityId,
      {
        url: plan.pictureState === "available" ? adapters.pictureUrl(plan.imageEntityId) : undefined,
        robotName: adapters.display.robotName(plan.robot) ?? plan.robot,
      },
    ]),
  );
}
