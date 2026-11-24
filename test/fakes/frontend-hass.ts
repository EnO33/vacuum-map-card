// A fake of the frontend `hass` object, the shape the adapters read (`src/adapters/hass/frontend-hass.ts`). It
// records calls and answers as configured; later issues extend it with what they read.
import type { FrontendConnection, FrontendHass } from "../../src/adapters/hass/frontend-hass";
import entityRegistryList from "../fixtures/ha-core/entity_registry_list.json" with { type: "json" };
import floorRegistryList from "../fixtures/ha-core/floor_registry_list.json" with { type: "json" };
import hassAreas from "../fixtures/ha-core/hass_areas.json" with { type: "json" };
import hassStates from "../fixtures/ha-core/hass_states_vacuum_docked.json" with { type: "json" };

/** How `callService` answers: resolve with a value, reject with a value, or throw synchronously. */
export interface CallServiceBehaviour {
  readonly kind: "resolve" | "reject" | "throw";
  readonly value: unknown;
}

/** The list commands the fake answers by default, from the anonymised captures of `test/fixtures/ha-core/`. */
export const fixtureLists: Readonly<Record<string, unknown>> = {
  "config/entity_registry/list": entityRegistryList,
  "config/floor_registry/list": floorRegistryList,
};

type ReadyListener = () => void;

/** The frontend `hass.connection`: event subscriptions and the `ready` event of a reconnection. */
export class FakeConnection implements FrontendConnection {
  readonly subscriptions: { readonly eventType: string; readonly callback: (event: unknown) => void }[] = [];
  unsubscribed = 0;
  /** How `subscribeEvents` answers: at once, never until `releaseSubscriptions`, or with a rejection. */
  subscribeMode: "resolve" | "hold" | "reject" = "resolve";
  private readonly held: (() => void)[] = [];
  private readonly ready = new Set<ReadyListener>();

  subscribeEvents(callback: (event: unknown) => void, eventType: string): Promise<() => Promise<void>> {
    const subscription = { eventType, callback };
    this.subscriptions.push(subscription);
    const unsubscribe = (): Promise<void> => {
      this.unsubscribed++;
      const index = this.subscriptions.indexOf(subscription);
      if (index >= 0) this.subscriptions.splice(index, 1);
      return Promise.resolve();
    };
    if (this.subscribeMode === "reject") return Promise.reject(new Error("subscription refused"));
    if (this.subscribeMode === "resolve") return Promise.resolve(unsubscribe);
    return new Promise((resolve) => this.held.push(() => resolve(unsubscribe)));
  }

  releaseSubscriptions(): void {
    for (const release of this.held.splice(0)) release();
  }

  /** Fires `eventType` to every live subscription, as Home Assistant does. */
  emit(eventType: string): void {
    for (const { eventType: type, callback } of [...this.subscriptions]) {
      if (type === eventType) callback({ event_type: eventType, data: {} });
    }
  }

  addEventListener(_eventType: "ready", listener: ReadyListener): void {
    this.ready.add(listener);
  }

  removeEventListener(_eventType: "ready", listener: ReadyListener): void {
    this.ready.delete(listener);
  }

  get readyListeners(): number {
    return this.ready.size;
  }

  /** The connection came back: `home-assistant-js-websocket` fires `ready`. */
  reconnect(): void {
    for (const listener of [...this.ready]) listener();
  }
}

export class FakeFrontendHass implements FrontendHass {
  readonly calls: Parameters<FrontendHass["callService"]>[] = [];
  readonly wsCalls: { readonly type: string }[] = [];
  readonly connection = new FakeConnection();
  /** `hass.areas`, `hass.states`, `hass.services` and `hass.user`, from the captures; replace them per test. */
  areas: unknown = structuredClone(hassAreas);
  states: unknown = structuredClone(hassStates);
  services: unknown = { vacuum: { clean_area: {}, start: {} } };
  user: unknown = { id: "0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a", is_admin: false };
  behaviour: CallServiceBehaviour = { kind: "resolve", value: { context: { id: "01JAAAAAAAAAAAAAAAAAAAAAAA" } } };
  /** Answers a `callWS` message; replace it per test. By default, a list command from `fixtureLists`. */
  answerWS: (message: { readonly type: string }) => Promise<unknown> = (message) =>
    message.type in fixtureLists
      ? Promise.resolve(structuredClone(fixtureLists[message.type]))
      : Promise.reject({ code: "unknown_command", message: "Unknown command." });

  callService(...args: Parameters<FrontendHass["callService"]>): Promise<unknown> {
    this.calls.push(args);
    const { kind, value } = this.behaviour;
    if (kind === "throw") throw value;
    return kind === "resolve" ? Promise.resolve(value) : Promise.reject(value);
  }

  callWS(message: { readonly type: string }): Promise<unknown> {
    this.wsCalls.push(message);
    return this.answerWS(message);
  }
}
