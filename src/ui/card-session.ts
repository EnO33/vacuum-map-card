import type { Adapters } from "../adapters/create-adapters";
import { createDisplay } from "../adapters/hass/display";
import { type FrontendHass, isFrontendHass } from "../adapters/hass/frontend-hass";
import { type CardConfig, NO_OPTIONS } from "../app/config/card-config";
import { type ConfiguredBuilder, createConfiguredBuilder } from "../app/config/configured-builder";
import { createConfiguredSources } from "../app/config/configured-sources";
import type { FloorModel } from "../app/floor-model/floor-model";
import type { FloorModelBuilder } from "../app/floor-model/memo";
import type { RoomSource } from "../app/ports/room-source";
import { createProgressTracker } from "../app/progress/progress-tracker";
import { type ItemRef, robotsForItem } from "../app/robots-for-item/robots-for-item";
import { type CleanController, createCleanController } from "../app/start-clean/clean-controller";
import { resolveLocale } from "../i18n/locale";
import { followModel, NO_SELECTION, type Selection } from "./card-selection";
import {
  type CardState,
  type CardView,
  FAILED,
  kept,
  LOAD_FAILED,
  LOADING,
  type PickedItem,
  sameView,
} from "./card-view";
import { planDisplaysOf, robotNamesOf } from "./plan-display";

/** What the session makes for each attachment of the card; the card passes the real ones, tests pass fakes. */
export interface SessionDependencies {
  createAdapters(getHass: () => FrontendHass): Adapters;
  createModelBuilder(): FloorModelBuilder;
}

interface Running {
  readonly adapters: Adapters;
  /** The sources of the `robots` option: the model, the picker and the controller read the same set. */
  readonly sources: () => readonly RoomSource[];
  readonly build: ConfiguredBuilder;
  /** One per attachment: its outcomes stay while the card is attached, whatever happens to the dialogs. */
  readonly controller: CleanController;
  /** Stops the card's progress from following this attachment's controller. */
  readonly stopFollowing: () => void;
  readonly unsubscribe: () => void;
}

function attempt(action: () => void): void {
  try {
    action();
  } catch {
    // Dropped: nothing the card calls may break the dashboard.
  }
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
  #selection: Selection = NO_SELECTION;
  /**
   * The progress of the card's starts, kept while the card leaves the page and comes back (a view switch, a masonry
   * column change), until dismissed or replaced: only a page reload loses it (ADR 0003 « Progress on a room »).
   */
  readonly #tracker = createProgressTracker();
  /** The language of the last accepted `hass`, read without the adapters, so every state speaks it. */
  readonly #display = createDisplay(() => this.#hass);
  #config: CardConfig = NO_OPTIONS;

  constructor(dependencies: () => SessionDependencies, onChange: () => void) {
    this.#dependencies = dependencies;
    this.#onChange = onChange;
    this.#tracker.subscribe(() => this.#refresh());
  }

  get state(): CardState {
    return this.#state;
  }

  /** Selects a room or area: the view then carries it with its robots while the model has it. Nothing is sent. */
  select(item: ItemRef): void {
    this.#selection = { kind: "open", item };
    this.#refresh();
  }

  /** Clears the selection: the picker closed without a choice. */
  deselect(): void {
    this.#selection = NO_SELECTION;
    this.#refresh();
  }

  /** Ends a robot's progress on its room: the user dismissed it. */
  dismiss(vacuumEntityId: string): void {
    this.#tracker.dismiss(vacuumEntityId);
  }

  /** The clean controller of the running adapters; `undefined` while they are not running. */
  get controller(): CleanController | undefined {
    return typeof this.#running === "object" ? this.#running.controller : undefined;
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

  /** The card's parsed options: `robots` narrows the sources, `floors` the model's floors. */
  setConfig(config: CardConfig): void {
    this.#config = config;
    this.#refresh();
  }

  connect(): void {
    this.#connected = true;
    this.#start();
    this.#refresh();
  }

  /** Ends the selection too: a picker opens only from a tap or a key, never on its own when the card comes back. */
  disconnect(): void {
    this.#connected = false;
    this.#selection = NO_SELECTION;
    this.#stop();
  }

  #start(): void {
    if (!this.#connected || !this.#accepted || this.#running !== undefined) return;
    try {
      // Nothing can throw between `subscribe` and `#running`, so `#stop` always releases what was taken.
      const dependencies = this.#dependencies();
      const build = createConfiguredBuilder(dependencies.createModelBuilder());
      const adapters = dependencies.createAdapters(() => this.#latestHass());
      const sources = createConfiguredSources(
        () => adapters.sources(),
        () => this.#config.robots,
      );
      const controller = createCleanController({ hass: adapters.hass, sources });
      this.#running = {
        adapters,
        sources,
        build,
        controller,
        stopFollowing: this.#tracker.follow(controller),
        unsubscribe: adapters.hass.subscribe(() => this.#refresh()),
      };
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
    attempt(running.stopFollowing);
  }

  #refresh(): void {
    const next = this.#next();
    // The picker is gone with the plans (loading, failed): the selection ends with it rather than reopen later.
    if (next.view.kind !== "ready" && this.#selection.kind === "open") this.#selection = NO_SELECTION;
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
      const tracker = this.#tracker;
      const model = running.build(adapters.hass, running.sources(), this.#config.floors);
      tracker.observe(adapters.hass);
      if (model.loading) return model.loadFailed ? LOAD_FAILED : LOADING;
      const shown = this.#state.view.kind === "ready" ? this.#state.view : undefined;
      this.#selection = followModel(this.#selection, model);
      const selection = this.#selection;
      return {
        kind: "ready",
        model,
        integrations: adapters.integrations,
        plans: planDisplaysOf(model, adapters),
        robotNames: kept(shown?.robotNames, robotNamesOf(model.robots, adapters)),
        isAdmin: adapters.hass.isAdmin(),
        picked: kept(shown?.picked, this.#picked(model, running)),
        gone: selection.kind === "gone" ? selection.name : undefined,
        progress: tracker.entries(),
        narrowed: { robots: this.#config.robots !== undefined, floors: this.#config.floors !== undefined },
      };
    } catch {
      return FAILED;
    }
  }

  /**
   * The selected item with its robots (`robotsForItem`); `undefined` when nothing is selected. A failed read ends the
   * selection, so the picker closes and does not come back by itself.
   */
  #picked(model: FloorModel, { adapters, sources }: Running): PickedItem | undefined {
    const selection = this.#selection;
    if (selection.kind !== "open" || selection.name === undefined) return undefined;
    const { item, name } = selection;
    try {
      return { item, name, candidates: robotsForItem(model, item, adapters.hass, sources()) };
    } catch {
      this.#selection = NO_SELECTION;
      return undefined;
    }
  }
}
