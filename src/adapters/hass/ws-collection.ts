import { type Debounced, leadingDebounce, type Schedule, timerSchedule } from "./debounce";
import type { FrontendConnection, FrontendHass } from "./frontend-hass";

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
  readonly schedule?: Schedule;
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
  readonly #listeners = new Set<() => void>();
  readonly #debounced: Debounced;
  #state: State = "idle";
  #current: T | undefined;
  #latest = 0;
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
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  start(): void {
    if (this.#state !== "idle") return;
    this.#state = "started";
    try {
      const connection = this.#options.getHass().connection;
      this.#connection = connection;
      connection.addEventListener("ready", this.#refetch);
      this.#subscribe(connection);
    } catch {
      // No connection yet: the fetch below fails the same way and the value stays `undefined`.
    }
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

  /** Fetches the whole list; only the answer to the latest request, while started, can replace the value. */
  async #fetch(): Promise<void> {
    const request = ++this.#latest;
    const { getHass, command, parse, equal } = this.#options;
    let next: T | undefined;
    try {
      next = parse(await getHass().callWS({ type: command }));
      if (next === undefined || request !== this.#latest || this.#state !== "started") return;
      if (this.#current !== undefined && equal(this.#current, next)) return;
    } catch {
      return;
    }
    this.#current = next;
    this.#notify();
  }

  #notify(): void {
    for (const listener of [...this.#listeners]) {
      try {
        listener();
      } catch {
        // A failing listener must not stop the others.
      }
    }
  }

  #subscribe(connection: FrontendConnection): void {
    connection.subscribeEvents(this.#onEvent, this.#options.event).then(
      (unsubscribeEvents) => {
        if (this.#state === "started") this.#unsubscribe = unsubscribeEvents;
        else release(unsubscribeEvents);
      },
      () => {},
    );
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
