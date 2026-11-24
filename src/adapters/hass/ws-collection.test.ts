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

  it("keeps an older answer when the newer request fails, but never after a newer answer", async () => {
    const older = deferred();
    const newer = deferred();
    const answers = [older, newer];
    hass.answerWS = () => answers.shift()?.promise ?? Promise.reject(new Error("unexpected"));
    collection.start();
    hass.connection.reconnect();
    newer.reject(new Error("Connection lost"));
    older.resolve(["old"]);
    await vi.advanceTimersByTimeAsync(0);
    expect(collection.value()).toStrictEqual({ names: ["old"] });
  });

  it("does not parse an answer older than the one applied", async () => {
    const parsed: unknown[] = [];
    const older = deferred();
    const newer = deferred();
    const answers = [older, newer];
    hass.answerWS = () => answers.shift()?.promise ?? Promise.reject(new Error("unexpected"));
    const counting = createWsCollection({
      getHass: () => hass,
      command: COMMAND,
      event: EVENT,
      parse: (raw) => {
        parsed.push(raw);
        return parse(raw);
      },
      equal,
    });
    counting.start();
    hass.connection.reconnect();
    newer.resolve(["new"]);
    await vi.advanceTimersByTimeAsync(0);
    older.resolve(["old"]);
    await vi.advanceTimersByTimeAsync(0);
    expect(parsed).toStrictEqual([["new"]]);
    counting.stop();
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
