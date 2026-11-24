import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { FakeFrontendHass } from "../../../test/fakes/frontend-hass";
import { expectNoConsoleOutput } from "../../../test/helpers/no-console";
import { createWsCollection, type WsCollection } from "./ws-collection";

const COMMAND = "config/thing_registry/list";
const EVENT = "thing_registry_updated";

interface Things {
  readonly names: readonly string[];
}

/** Accepts an array of strings, refuses anything else. */
function parse(raw: unknown): Things | undefined {
  return Array.isArray(raw) && raw.every((item) => typeof item === "string") ? { names: raw } : undefined;
}

const equal = (a: Things, b: Things) => a.names.join("\n") === b.names.join("\n");

/** A deferred `callWS` answer the test settles by hand. */
function deferred() {
  let resolve: (value: unknown) => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  const promise = new Promise<unknown>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

let hass: FakeFrontendHass;
let answer: unknown;
let collection: WsCollection<Things>;
let changes: Mock<() => void>;

function make(): WsCollection<Things> {
  const made = createWsCollection({ getHass: () => hass, command: COMMAND, event: EVENT, parse, equal });
  made.onChange(changes);
  return made;
}

expectNoConsoleOutput();

beforeEach(() => {
  vi.useFakeTimers();
  hass = new FakeFrontendHass();
  answer = ["a", "b"];
  hass.answerWS = () => Promise.resolve(answer);
  changes = vi.fn<() => void>();
  collection = make();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("start", () => {
  it("has no value before the first successful fetch", async () => {
    expect(collection.value()).toBeUndefined();
    collection.start();
    expect(collection.value()).toBeUndefined();
    await vi.advanceTimersByTimeAsync(0);
    expect(collection.value()).toStrictEqual({ names: ["a", "b"] });
    expect(changes).toHaveBeenCalledTimes(1);
  });

  it("sends one fetch, opens one subscription and adds one ready listener, once", async () => {
    collection.start();
    collection.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(hass.wsCalls).toStrictEqual([{ type: COMMAND }]);
    expect(hass.connection.subscriptions.map((s) => s.eventType)).toStrictEqual([EVENT]);
    expect(hass.connection.readyListeners).toBe(1);
  });
});

describe("re-fetching", () => {
  it("debounces events like the frontend: 5 events within 500 ms give exactly 2 fetches", async () => {
    collection.start();
    await vi.advanceTimersByTimeAsync(0);
    hass.wsCalls.length = 0;
    for (let i = 0; i < 5; i++) {
      hass.connection.emit(EVENT);
      await vi.advanceTimersByTimeAsync(90);
    }
    await vi.advanceTimersByTimeAsync(500);
    expect(hass.wsCalls).toHaveLength(2);
  });

  it("ignores other events", async () => {
    collection.start();
    await vi.advanceTimersByTimeAsync(0);
    hass.connection.emit("state_changed");
    await vi.advanceTimersByTimeAsync(500);
    expect(hass.wsCalls).toHaveLength(1);
  });

  it("re-fetches when the connection is ready again", async () => {
    collection.start();
    await vi.advanceTimersByTimeAsync(0);
    answer = ["a", "b", "c"];
    hass.connection.reconnect();
    await vi.advanceTimersByTimeAsync(0);
    expect(hass.wsCalls).toHaveLength(2);
    expect(collection.value()).toStrictEqual({ names: ["a", "b", "c"] });
  });

  it("keeps the current object and notifies nothing when the new list is equal", async () => {
    collection.start();
    await vi.advanceTimersByTimeAsync(0);
    const first = collection.value();
    answer = ["a", "b"];
    hass.connection.emit(EVENT);
    await vi.advanceTimersByTimeAsync(0);
    expect(collection.value()).toBe(first);
    expect(changes).toHaveBeenCalledTimes(1);
  });

  it("replaces the value and notifies once when the list changed", async () => {
    collection.start();
    await vi.advanceTimersByTimeAsync(0);
    answer = ["a"];
    hass.connection.emit(EVENT);
    await vi.advanceTimersByTimeAsync(0);
    expect(collection.value()).toStrictEqual({ names: ["a"] });
    expect(changes).toHaveBeenCalledTimes(2);
  });

  it("keeps only the answer to the latest request when two fetches overlap", async () => {
    const older = deferred();
    const newer = deferred();
    const answers = [older, newer];
    hass.answerWS = () => answers.shift()?.promise ?? Promise.reject(new Error("unexpected"));
    collection.start();
    hass.connection.reconnect();
    newer.resolve(["new"]);
    await vi.advanceTimersByTimeAsync(0);
    older.resolve(["old"]);
    await vi.advanceTimersByTimeAsync(0);
    expect(collection.value()).toStrictEqual({ names: ["new"] });
    expect(changes).toHaveBeenCalledTimes(1);
  });

  it("removes a listener with the function onChange returns, and keeps calling the others", async () => {
    const removed = vi.fn();
    const remove = collection.onChange(removed);
    collection.onChange(() => {
      throw new Error("listener bug");
    });
    const after = vi.fn();
    collection.onChange(after);
    remove();
    collection.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(removed).not.toHaveBeenCalled();
    expect(after).toHaveBeenCalledTimes(1);
  });
});

describe("failures", () => {
  it.each<[string, () => Promise<unknown>]>([
    ["a rejection", () => Promise.reject(new Error("Connection lost"))],
    ["a value parse refuses", () => Promise.resolve({ not: "a list" })],
    [
      "a synchronous throw",
      () => {
        throw new Error("boom");
      },
    ],
  ])("keeps the previous value and notifies nothing on %s", async (_, failing) => {
    collection.start();
    await vi.advanceTimersByTimeAsync(0);
    const first = collection.value();
    hass.answerWS = failing;
    hass.connection.emit(EVENT);
    await vi.advanceTimersByTimeAsync(500);
    expect(collection.value()).toBe(first);
    expect(changes).toHaveBeenCalledTimes(1);
  });

  it("catches a refused subscription and still fetches", async () => {
    hass.connection.subscribeMode = "reject";
    collection.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(collection.value()).toStrictEqual({ names: ["a", "b"] });
  });

  it("catches a hass that throws on read", async () => {
    const broken = createWsCollection({
      getHass: () => {
        throw new Error("no hass yet");
      },
      command: COMMAND,
      event: EVENT,
      parse,
      equal,
    });
    expect(() => broken.start()).not.toThrow();
    await vi.advanceTimersByTimeAsync(0);
    expect(broken.value()).toBeUndefined();
    expect(() => broken.stop()).not.toThrow();
  });

  it("catches an unsubscribe that throws or rejects", async () => {
    const rejecting = () => Promise.reject(new Error("Connection lost"));
    vi.spyOn(hass.connection, "subscribeEvents").mockResolvedValueOnce(rejecting);
    collection.start();
    await vi.advanceTimersByTimeAsync(0);
    collection.stop();
    await vi.advanceTimersByTimeAsync(0);

    const throwing = make();
    vi.spyOn(hass.connection, "subscribeEvents").mockResolvedValueOnce(() => {
      throw new Error("boom");
    });
    throwing.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(() => throwing.stop()).not.toThrow();
  });
});

describe("stop", () => {
  it("cancels the pending debounce, removes the ready listener and unsubscribes", async () => {
    collection.start();
    await vi.advanceTimersByTimeAsync(0);
    hass.connection.emit(EVENT);
    hass.connection.emit(EVENT);
    await vi.advanceTimersByTimeAsync(0);
    collection.stop();
    await vi.advanceTimersByTimeAsync(1000);
    expect(hass.wsCalls).toHaveLength(2);
    expect(hass.connection.readyListeners).toBe(0);
    expect(hass.connection.unsubscribed).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("unsubscribes when the subscription resolves after stop", async () => {
    hass.connection.subscribeMode = "hold";
    collection.start();
    collection.stop();
    hass.connection.releaseSubscriptions();
    await vi.advanceTimersByTimeAsync(0);
    expect(hass.connection.unsubscribed).toBe(1);
    expect(hass.connection.subscriptions).toHaveLength(0);
  });

  it("ignores a fetch answering after stop and calls no listener", async () => {
    const late = deferred();
    hass.answerWS = () => late.promise;
    collection.start();
    collection.stop();
    late.resolve(["a"]);
    await vi.advanceTimersByTimeAsync(0);
    expect(collection.value()).toBeUndefined();
    expect(changes).not.toHaveBeenCalled();
  });

  it("does nothing before start, twice, or on an event still in flight", async () => {
    collection.stop();
    collection.start();
    await vi.advanceTimersByTimeAsync(0);
    const [subscription] = hass.connection.subscriptions;
    collection.stop();
    collection.stop();
    subscription?.callback({ event_type: EVENT });
    collection.start();
    await vi.advanceTimersByTimeAsync(1000);
    expect(hass.wsCalls).toHaveLength(1);
    expect(hass.connection.unsubscribed).toBe(1);
  });
});
