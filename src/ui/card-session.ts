import type { Adapters } from "../adapters/create-adapters";
import { createDisplay } from "../adapters/hass/display";
import { type FrontendHass, isFrontendHass } from "../adapters/hass/frontend-hass";
import type { FloorModel } from "../app/floor-model/floor-model";
import type { FloorModelBuilder } from "../app/floor-model/memo";
import { sameValue } from "../app/floor-model/same-value";
import type { Candidate } from "../app/robots-for-item/choice";
import { type ItemRef, itemName, robotsForItem } from "../app/robots-for-item/robots-for-item";
import type { Locale } from "../i18n/catalogs";
import { resolveLocale } from "../i18n/locale";
import { type PlanDisplays, planDisplaysOf, type RobotNames, robotNamesOf } from "./plan-display";

/** What the session makes for each attachment of the card; the card passes the real ones, tests pass fakes. */
export interface SessionDependencies {
  createAdapters(getHass: () => FrontendHass): Adapters;
  createModelBuilder(): FloorModelBuilder;
}

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
    };

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

const LOADING: CardView = Object.freeze({ kind: "loading" });
const FAILED: CardView = Object.freeze({ kind: "failed" });
const LOAD_FAILED: CardView = Object.freeze({ kind: "load_failed" });

interface Running {
  readonly adapters: Adapters;
  readonly build: FloorModelBuilder;
  readonly unsubscribe: () => void;
}

function attempt(action: () => void): void {
  try {
    action();
  } catch {
    // Dropped: nothing the card calls may break the dashboard.
  }
}

/** The shown value when `next` equals it, so an element given it sees no change when another part of the view does. */
function kept<T>(shown: T | undefined, next: T): T {
  return shown !== undefined && sameValue(shown, next) ? shown : next;
}

function sameView(a: CardView, b: CardView): boolean {
  if (a.kind !== "ready" || b.kind !== "ready") return a.kind === b.kind;
  return (
    a.model === b.model &&
    a.integrations === b.integrations &&
    a.isAdmin === b.isAdmin &&
    sameValue(a.plans, b.plans) &&
    sameValue(a.robotNames, b.robotNames) &&
    sameValue(a.picked, b.picked)
  );
}

/**
 * The card's lifecycle without the DOM: adapters run while the card is connected and has a `hass` that passes the
 * boundary check, a spent object is never restarted (a new attachment makes new adapters), and `onChange` is called
 * only when the state the card renders changes, so an unrelated `hass` update costs one model lookup and no render.
 * Nothing it calls may break the dashboard: any exception becomes the `failed` view.
 */
export class CardSession {
  /** Read at each start, so a subclass of the card can replace them after construction. */
  readonly #dependencies: () => SessionDependencies;
  readonly #onChange: () => void;
  /** The last value that passed the check, kept after a failed one so a late read by stopped adapters never fails. */
  #hass: FrontendHass | undefined;
  /** Whether the value set last passed the check. */
  #accepted = false;
  #connected = false;
  /** `failed` when the adapters could not start: shown until they are stopped (detached or an invalid `hass`). */
  #running: Running | "failed" | undefined;
  #state: CardState = { locale: "en", view: LOADING };
  #selected: ItemRef | undefined;
  /** The language of the last accepted `hass`, read without the adapters, so every state speaks it. */
  readonly #display = createDisplay(() => this.#hass);

  constructor(dependencies: () => SessionDependencies, onChange: () => void) {
    this.#dependencies = dependencies;
    this.#onChange = onChange;
  }

  get state(): CardState {
    return this.#state;
  }

  /** Selects a room or area: the view then carries it with its robots while the model has it. Nothing is sent. */
  select(item: ItemRef): void {
    this.#selected = item;
    this.#refresh();
  }

  /** A value that fails the boundary check stops the adapters and shows the loading state. */
  setHass(value: unknown): void {
    this.#accepted = false;
    if (isFrontendHass(value)) {
      this.#hass = value;
      this.#accepted = true;
      this.#start();
    } else {
      this.#stop();
    }
    this.#refresh();
  }

  connect(): void {
    this.#connected = true;
    this.#start();
    this.#refresh();
  }

  disconnect(): void {
    this.#connected = false;
    this.#stop();
  }

  #start(): void {
    if (!this.#connected || !this.#accepted || this.#running !== undefined) return;
    try {
      // Nothing can throw between `subscribe` and `#running`, so `#stop` always releases what was taken.
      const dependencies = this.#dependencies();
      const build = dependencies.createModelBuilder();
      const adapters = dependencies.createAdapters(() => this.#latestHass());
      this.#running = { adapters, build, unsubscribe: adapters.hass.subscribe(() => this.#refresh()) };
      adapters.start();
    } catch {
      this.#stop();
      this.#running = "failed";
    }
  }

  /** Read through `this` only, so the adapters keep no older `hass` object alive. */
  #latestHass(): FrontendHass {
    // Unreachable: adapters are only made once a value passed the check, and `#hass` is never cleared.
    if (this.#hass === undefined) throw new Error("no hass yet");
    return this.#hass;
  }

  #stop(): void {
    const running = this.#running;
    this.#running = undefined;
    if (running === undefined || running === "failed") return;
    // Best effort, each step on its own so one that throws never keeps the other's subscriptions alive.
    attempt(() => running.adapters.stop());
    attempt(running.unsubscribe);
  }

  #refresh(): void {
    const next = this.#next();
    if (next.locale === this.#state.locale && sameView(next.view, this.#state.view)) return;
    this.#state = next;
    this.#onChange();
  }

  #next(): CardState {
    return { locale: resolveLocale(this.#display.language()), view: this.#view() };
  }

  #view(): CardView {
    const running = this.#running;
    if (running === undefined) return LOADING;
    if (running === "failed") return FAILED;
    try {
      const { adapters } = running;
      const model = running.build(adapters.hass, adapters.sources());
      if (model.loading) return model.loadFailed ? LOAD_FAILED : LOADING;
      const shown = this.#state.view.kind === "ready" ? this.#state.view : undefined;
      return {
        kind: "ready",
        model,
        integrations: adapters.integrations,
        plans: planDisplaysOf(model, adapters),
        robotNames: kept(shown?.robotNames, robotNamesOf(model.robots, adapters)),
        isAdmin: adapters.hass.isAdmin(),
        picked: kept(shown?.picked, this.#picked(model, adapters)),
      };
    } catch {
      return FAILED;
    }
  }

  /** The selected item with its robots (`robotsForItem`); `undefined` when the model has no such item or the read fails. */
  #picked(model: FloorModel, adapters: Adapters): PickedItem | undefined {
    const item = this.#selected;
    const name = item && itemName(model, item);
    if (item === undefined || name === undefined) return undefined;
    try {
      return { item, name, candidates: robotsForItem(model, item, adapters.hass, adapters.sources()) };
    } catch {
      return undefined;
    }
  }
}
