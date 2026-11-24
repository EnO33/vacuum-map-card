import { type Debounced, leadingDebounce, type Schedule, timerSchedule } from "./debounce";
import type { FrontendConnection, FrontendHass } from "./frontend-hass";
import { Listeners } from "./listeners";

/** The frontend's registry collections wait 500 ms (`docs/research/ha-core-registries.md` « Update signal »). */
const DEBOUNCE_MS = 500;

export interface WsCollectionOptions<T> {
  readonly getHass: () => FrontendHass;
  /** The list command, such as `config/entity_registry/list`. */
  readonly command: string;
  /** Its update event, such as `entity_registry_updated`. */
  readonly event: string;
  /** Parses the untrusted response; `undefined` refuses it, as a failed fetch. */
  readonly parse: (raw: unknown) => T | undefined;
  readonly equal: (a: T, b: T) => boolean;
  readonly schedule?: Schedule | undefined;
}

/**
 * One websocket list kept current, as the frontend keeps its own registries: fetched once, re-fetched whole on each
 * update event (debounced) and after a reconnection. Single use: after `stop`, make a new one to start again.
 */
export interface WsCollection<T> {
  /** The last list read, `undefined` until the first successful fetch; same object while nothing changed. */
  value(): T | undefined;
  /** Calls `listener` once each time the value changes; returns the function that removes it. */
  onChange(listener: () => void): () => void;
  start(): void;
  stop(): void;
}

type State = "idle" | "started" | "stopped";

/** Never throws and never logs: a failed fetch keeps the previous value, a failed subscription is dropped. */
export function createWsCollection<T>(options: WsCollectionOptions<T>): WsCollection<T> {
  return new ListCollection(options);
}

class ListCollection<T> implements WsCollection<T> {
  readonly #options: WsCollectionOptions<T>;
  readonly #listeners = new Listeners();
  readonly #debounced: Debounced;
  #state: State = "idle";
  #current: T | undefined;
  #latest = 0;
  /** The request whose answer the value reflects: an answer to an older one is never applied. */
  #applied = 0;
  #connection: FrontendConnection | undefined;
  #unsubscribe: (() => Promise<void>) | undefined;
  readonly #refetch = () => void this.#fetch();
  readonly #onEvent = () => {
    if (this.#state === "started") this.#debounced.call();
  };

  constructor(options: WsCollectionOptions<T>) {
    this.#options = options;
    this.#debounced = leadingDebounce(this.#refetch, DEBOUNCE_MS, options.schedule ?? timerSchedule);
  }

  value(): T | undefined {
    return this.#current;
  }

  onChange(listener: () => void): () => void {
    return this.#listeners.add(listener);
  }

  /** Does nothing while `hass` or its connection cannot be read: the collection stays idle, so a later start works. */
  start(): void {
    if (this.#state !== "idle") return;
    let connection: FrontendConnection;
    try {
      connection = this.#options.getHass().connection;
      connection.addEventListener("ready", this.#refetch);
    } catch {
      return;
    }
    this.#state = "started";
    this.#connection = connection;
    this.#subscribe(connection);
    this.#refetch();
  }

  stop(): void {
    if (this.#state !== "started") return;
    this.#state = "stopped";
    this.#debounced.cancel();
    this.#listeners.clear();
    try {
      this.#connection?.removeEventListener("ready", this.#refetch);
    } catch {
      // Nothing more to remove.
    }
    if (this.#unsubscribe) release(this.#unsubscribe);
    this.#unsubscribe = undefined;
  }

  /**
   * Fetches the whole list. While started, an answer replaces the value unless an answer to a newer request was
   * already applied; so a failed newer request leaves an older answer usable, and an older answer never wins.
   */
  async #fetch(): Promise<void> {
    const request = ++this.#latest;
    const { getHass, command, parse, equal } = this.#options;
    let next: T | undefined;
    try {
      const raw = await getHass().callWS({ type: command });
      if (request <= this.#applied || this.#state !== "started") return;
      next = parse(raw);
      if (next === undefined) return;
      this.#applied = request;
      if (this.#current !== undefined && equal(this.#current, next)) return;
    } catch {
      return;
    }
    this.#current = next;
    this.#listeners.notify();
  }

  #subscribe(connection: FrontendConnection): void {
    try {
      connection.subscribeEvents(this.#onEvent, this.#options.event).then(
        (unsubscribeEvents) => {
          if (this.#state === "started") this.#unsubscribe = unsubscribeEvents;
          else release(unsubscribeEvents);
        },
        () => {},
      );
    } catch {
      // No subscription: `ready` still re-fetches.
    }
  }
}

/** Unsubscribes, ignoring a lost connection. */
function release(unsubscribeEvents: () => Promise<void>): void {
  try {
    unsubscribeEvents().catch(() => {});
  } catch {
    // Already gone.
  }
}
