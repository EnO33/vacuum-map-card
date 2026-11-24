// `failed()`: a list that could not be read is told apart from one still loading (#125).
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { FakeFrontendHass } from "../../../test/fakes/frontend-hass";
import { expectNoConsoleOutput } from "../../../test/helpers/no-console";
import { deferred, EVENT, type Things, thingsCollection } from "../../../test/helpers/ws-collection";
import type { WsCollection } from "./ws-collection";

let hass: FakeFrontendHass;
let collection: WsCollection<Things>;
let changes: Mock<() => void>;

expectNoConsoleOutput();

beforeEach(() => {
  vi.useFakeTimers();
  hass = new FakeFrontendHass();
  changes = vi.fn<() => void>();
  collection = thingsCollection(hass, changes);
});

afterEach(() => {
  collection.stop();
  vi.useRealTimers();
});

const succeeding = () => Promise.resolve(["a"]);

describe("failed", () => {
  it.each<[string, () => Promise<unknown>]>([
    ["rejects", () => Promise.reject(new Error("Connection lost"))],
    ["answers a value parse refuses", () => Promise.resolve({ not: "a list" })],
    [
      "throws at once",
      () => {
        throw new Error("boom");
      },
    ],
  ])("is true when the first fetch %s, notifies once, and ends on the next success", async (_, failing) => {
    hass.answerWS = failing;
    expect(collection.failed()).toBe(false);
    collection.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(collection.failed()).toBe(true);
    expect(collection.value()).toBeUndefined();
    expect(changes).toHaveBeenCalledTimes(1);
    hass.answerWS = succeeding;
    hass.connection.reconnect();
    await vi.advanceTimersByTimeAsync(0);
    expect(collection.failed()).toBe(false);
    expect(collection.value()).toStrictEqual({ names: ["a"] });
    expect(changes).toHaveBeenCalledTimes(2);
  });

  it("stays false while the fetch never answers", async () => {
    hass.answerWS = () => new Promise(() => undefined);
    collection.start();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(collection.failed()).toBe(false);
    expect(changes).not.toHaveBeenCalled();
  });

  it("notifies once for repeated failures, and recovers after an update event", async () => {
    hass.answerWS = () => Promise.reject(new Error("Connection lost"));
    collection.start();
    await vi.advanceTimersByTimeAsync(0);
    hass.connection.reconnect();
    await vi.advanceTimersByTimeAsync(0);
    expect(collection.failed()).toBe(true);
    expect(changes).toHaveBeenCalledTimes(1);
    hass.answerWS = succeeding;
    hass.connection.emit(EVENT);
    await vi.advanceTimersByTimeAsync(500);
    expect(collection.failed()).toBe(false);
  });

  it("stays false once a value is read: a failed re-fetch keeps the value and only unsettles it", async () => {
    hass.answerWS = succeeding;
    collection.start();
    await vi.advanceTimersByTimeAsync(0);
    hass.answerWS = () => Promise.reject(new Error("Connection lost"));
    hass.connection.reconnect();
    await vi.advanceTimersByTimeAsync(0);
    expect(collection.failed()).toBe(false);
    expect(collection.settled()).toBe(false);
    expect(changes).toHaveBeenCalledTimes(1);
  });

  it("ends when an older request succeeds after a newer one failed", async () => {
    const older = deferred();
    const newer = deferred();
    const answers = [older, newer];
    hass.answerWS = () => answers.shift()?.promise ?? Promise.reject(new Error("unexpected"));
    collection.start();
    hass.connection.reconnect();
    newer.reject(new Error("Connection lost"));
    await vi.advanceTimersByTimeAsync(0);
    expect(collection.failed()).toBe(true);
    older.resolve(["old"]);
    await vi.advanceTimersByTimeAsync(0);
    expect(collection.failed()).toBe(false);
    expect(collection.value()).toStrictEqual({ names: ["old"] });
  });

  it("ignores a failure answering after stop", async () => {
    const late = deferred();
    hass.answerWS = () => late.promise;
    collection.start();
    collection.stop();
    late.reject(new Error("Connection lost"));
    await vi.advanceTimersByTimeAsync(0);
    expect(collection.failed()).toBe(false);
    expect(changes).not.toHaveBeenCalled();
  });
});
