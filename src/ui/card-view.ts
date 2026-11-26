import type { FloorModel } from "../app/floor-model/floor-model";
import { sameValue } from "../app/floor-model/same-value";
import type { ProgressEntry } from "../app/progress/progress-tracker";
import type { Candidate } from "../app/robots-for-item/choice";
import type { ItemRef } from "../app/robots-for-item/robots-for-item";
import type { Locale } from "../i18n/catalogs";
import type { PlanDisplays, RobotNames } from "./plan-display";

/**
 * What the card shows: `ready` only once the model is no longer loading; `load_failed` while it is loading because a
 * list could not be fetched (`FloorModel.loadFailed`), until a later fetch succeeds.
 */
export type CardView =
  | { readonly kind: "loading" }
  | { readonly kind: "load_failed" }
  | { readonly kind: "failed" }
  | {
      readonly kind: "ready";
      readonly model: FloorModel;
      readonly integrations: readonly string[];
      /** Read again on every refresh, so a new image state gives a new picture URL (ADR 0005 « Plan pictures »). */
      readonly plans: PlanDisplays;
      /** Every robot's name, for its plans' labels and the notes on robots whose rooms map adds no plan. */
      readonly robotNames: RobotNames;
      /** `HassPort.isAdmin()`: a non-administrator is told to ask one (ADR 0003 « Permissions »). */
      readonly isAdmin: boolean;
      /** The selected item with its robots, read on every refresh so their states stay current; `undefined` when none. */
      readonly picked: PickedItem | undefined;
      /** The name of the item whose picker closed because the model no longer has it (re-mapping); `undefined` else. */
      readonly gone: string | undefined;
      /** Every started robot's progress (`ProgressTracker.entries`): the same array while none changed. */
      readonly progress: readonly ProgressEntry[];
    };

export type ReadyView = Extract<CardView, { kind: "ready" }>;

/** A selected item with its name and its robots, read once at selection. */
export interface PickedItem {
  readonly item: ItemRef;
  readonly name: string;
  readonly candidates: readonly Candidate[];
}

export interface CardState {
  readonly locale: Locale;
  readonly view: CardView;
}

export const LOADING: CardView = Object.freeze({ kind: "loading" });
export const FAILED: CardView = Object.freeze({ kind: "failed" });
export const LOAD_FAILED: CardView = Object.freeze({ kind: "load_failed" });

/** The shown value when `next` equals it, so an element given it sees no change when another part of the view does. */
export function kept<T>(shown: T | undefined, next: T): T {
  return shown !== undefined && sameValue(shown, next) ? shown : next;
}

export function sameView(a: CardView, b: CardView): boolean {
  if (a.kind !== "ready" || b.kind !== "ready") return a.kind === b.kind;
  return (
    a.model === b.model &&
    a.integrations === b.integrations &&
    a.isAdmin === b.isAdmin &&
    sameValue(a.plans, b.plans) &&
    sameValue(a.robotNames, b.robotNames) &&
    sameValue(a.picked, b.picked) &&
    a.gone === b.gone &&
    a.progress === b.progress
  );
}
