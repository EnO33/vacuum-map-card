import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { FakeFrontendHass } from "../../../test/fakes/frontend-hass";
import { expectNoConsoleOutput } from "../../../test/helpers/no-console";
import {
  COMMAND,
  deferred,
  EVENT,
  equal,
  parse,
  type Things,
  thingsCollection,
} from "../../../test/helpers/ws-collection";
import { createWsCollection, type WsCollection } from "./ws-collection";

let hass: FakeFrontendHass;
let answer: unknown;
let collection: WsCollection<Things>;
let changes: Mock<() => void>;

const make = () => thingsCollection(hass, changes);

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

  it("catches a subscription that throws at once, still fetches and still follows ready", async () => {
    vi.spyOn(hass.connection, "subscribeEvents").mockImplementationOnce(() => {
      throw new Error("not connected");
    });
    collection.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(collection.value()).toStrictEqual({ names: ["a", "b"] });
    hass.connection.reconnect();
    await vi.advanceTimersByTimeAsync(0);
    expect(hass.wsCalls).toHaveLength(2);
  });

  it("catches a refused subscription and still fetches", async () => {
    hass.connection.subscribeMode = "reject";
    collection.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(collection.value()).toStrictEqual({ names: ["a", "b"] });
  });

  it("stays idle when hass cannot be read yet, so a later start works", async () => {
    let ready = false;
    const late = createWsCollection({
      getHass: () => {
        if (!ready) throw new Error("no hass yet");
        return hass;
      },
      command: COMMAND,
      event: EVENT,
      parse,
      equal,
    });
    expect(() => late.start()).not.toThrow();
    await vi.advanceTimersByTimeAsync(0);
    expect(late.value()).toBeUndefined();
    expect(hass.wsCalls).toHaveLength(0);
    ready = true;
    late.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(late.value()).toStrictEqual({ names: ["a", "b"] });
    expect(hass.connection.readyListeners).toBe(1);
    late.stop();
  });

  it("calls no listener after one of them stops the collection, nor one removed during the pass", async () => {
    const second = vi.fn();
    let removeSecond = () => {};
    collection.onChange(() => removeSecond());
    removeSecond = collection.onChange(second);
    collection.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(second).not.toHaveBeenCalled();

    const other = make();
    const afterStop = vi.fn();
    other.onChange(() => other.stop());
    other.onChange(afterStop);
    other.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(afterStop).not.toHaveBeenCalled();
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

describe("settled", () => {
  it("is false before the first fetch and true once it is applied", async () => {
    expect(collection.settled()).toBe(false);
    collection.start();
    expect(collection.settled()).toBe(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(collection.settled()).toBe(true);
  });

  it("is false from an update event until a fetch made after it is applied, equal or not", async () => {
    collection.start();
    await vi.advanceTimersByTimeAsync(0);
    hass.connection.emit(EVENT);
    expect(collection.settled()).toBe(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(collection.settled()).toBe(true);
  });

  it("stays false while a trailing fetch is pending after the leading one answered", async () => {
    collection.start();
    await vi.advanceTimersByTimeAsync(0);
    hass.connection.emit(EVENT);
    await vi.advanceTimersByTimeAsync(0);
    hass.connection.emit(EVENT);
    await vi.advanceTimersByTimeAsync(100);
    expect(collection.settled()).toBe(false);
    await vi.advanceTimersByTimeAsync(500);
    expect(collection.settled()).toBe(true);
  });

  it.each<[string, () => Promise<unknown>]>([
    ["rejected", () => Promise.reject(new Error("Connection lost"))],
    ["refused by parse", () => Promise.resolve({ not: "a list" })],
  ])("stays false when the fetch after an event is %s, until one succeeds", async (_, failing) => {
    collection.start();
    await vi.advanceTimersByTimeAsync(0);
    const answer = hass.answerWS;
    hass.answerWS = failing;
    hass.connection.emit(EVENT);
    await vi.advanceTimersByTimeAsync(500);
    expect(collection.settled()).toBe(false);
    hass.answerWS = answer;
    hass.connection.reconnect();
    await vi.advanceTimersByTimeAsync(0);
    expect(collection.settled()).toBe(true);
  });

  it("is false after a reconnection until its fetch is applied, and not settled by an older answer", async () => {
    const older = deferred();
    const newer = deferred();
    const answers = [older, newer];
    hass.answerWS = () => answers.shift()?.promise ?? Promise.reject(new Error("unexpected"));
    collection.start();
    hass.connection.reconnect();
    older.resolve(["a"]);
    await vi.advanceTimersByTimeAsync(0);
    expect(collection.value()).toBeDefined();
    expect(collection.settled()).toBe(false);
    newer.resolve(["a"]);
    await vi.advanceTimersByTimeAsync(0);
    expect(collection.settled()).toBe(true);
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
