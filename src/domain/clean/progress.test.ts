import { describe, expect, it } from "vitest";
import type { CleanError } from "./clean-error";
import type { StoredOutcome } from "./outcome";
import { nextProgress, type Progress, type ProgressEvent, type ProgressPhase, SENDING } from "./progress";

const notLinked: CleanError = { kind: "rooms_not_linked", mayHaveStarted: "no" };
const unknownError: CleanError = { kind: "unknown", mayHaveStarted: "unknown" };
const possiblyError: CleanError = { kind: "area_not_linked", mayHaveStarted: "possibly" };

const outcome = (o: StoredOutcome): ProgressEvent => ({ kind: "outcome", outcome: o });
const vacuum = (state: string | undefined): ProgressEvent => ({ kind: "vacuum_state", state });
const at = (phase: ProgressPhase, extra: Partial<Progress> = {}): Progress => ({
  phase,
  statusUnknown: false,
  ...extra,
});

/** Runs the events from no progress, starting with a confirm while the robot is docked. */
function raw(...events: readonly ProgressEvent[]): Progress {
  return events.reduce(nextProgress, nextProgress(SENDING, { kind: "confirm_started", state: "docked" }));
}

/** What a progress shows: its phase, error and status flag, without what it keeps to read the next state. */
function run(...events: readonly ProgressEvent[]): Progress {
  const { phase, error, statusUnknown } = raw(...events);
  return error ? { phase, error, statusUnknown } : { phase, statusUnknown };
}

describe("nextProgress", () => {
  it("shows sending while confirm runs", () => {
    expect(run()).toEqual({ phase: "sending", statusUnknown: false });
  });

  it.each([
    ["accepted then docked stays starting", [outcome({ kind: "accepted" }), vacuum("docked")], at("starting")],
    ["accepted then idle stays starting", [outcome({ kind: "accepted" }), vacuum("idle")], at("starting")],
    ["accepted then returning stays starting", [outcome({ kind: "accepted" }), vacuum("returning")], at("starting")],
    ["starting then cleaning gives cleaning", [outcome({ kind: "accepted" }), vacuum("cleaning")], at("cleaning")],
    [
      "cleaning then returning gives done",
      [outcome({ kind: "accepted" }), vacuum("cleaning"), vacuum("returning")],
      at("done"),
    ],
    [
      "cleaning then docked gives done",
      [outcome({ kind: "accepted" }), vacuum("cleaning"), vacuum("docked")],
      at("done"),
    ],
    ["cleaning then idle gives done", [outcome({ kind: "accepted" }), vacuum("cleaning"), vacuum("idle")], at("done")],
    [
      "cleaning then paused gives paused",
      [outcome({ kind: "accepted" }), vacuum("cleaning"), vacuum("paused")],
      at("paused"),
    ],
    [
      "paused then cleaning gives cleaning",
      [outcome({ kind: "accepted" }), vacuum("cleaning"), vacuum("paused"), vacuum("cleaning")],
      at("cleaning"),
    ],
    [
      "paused then docked gives done",
      [outcome({ kind: "accepted" }), vacuum("cleaning"), vacuum("paused"), vacuum("docked")],
      at("done"),
    ],
    ["starting then paused gives paused", [outcome({ kind: "accepted" }), vacuum("paused")], at("paused")],
    ["the error state after the start gives failed", [outcome({ kind: "accepted" }), vacuum("error")], at("failed")],
    [
      "the error state while cleaning gives failed",
      [outcome({ kind: "accepted" }), vacuum("cleaning"), vacuum("error")],
      at("failed"),
    ],
    ["a changed outcome gives not started", [outcome({ kind: "changed" })], at("not_started")],
    [
      "an error outcome that cannot have started gives failed with its error",
      [outcome({ kind: "error", error: notLinked })],
      at("failed", { error: notLinked }),
    ],
    [
      "an error outcome that may have started gives may have started with its error",
      [outcome({ kind: "error", error: unknownError })],
      at("may_have_started", { error: unknownError }),
    ],
    [
      "an error outcome that possibly started gives may have started",
      [outcome({ kind: "error", error: possiblyError })],
      at("may_have_started", { error: possiblyError }),
    ],
    [
      "may have started then docked keeps it and its error",
      [outcome({ kind: "error", error: unknownError }), vacuum("docked")],
      at("may_have_started", { error: unknownError }),
    ],
    [
      "may have started then cleaning applies the cleaning row",
      [outcome({ kind: "error", error: unknownError }), vacuum("cleaning")],
      at("cleaning"),
    ],
    [
      "may have started then cleaning then returning gives done",
      [outcome({ kind: "error", error: unknownError }), vacuum("cleaning"), vacuum("returning")],
      at("done"),
    ],
    [
      "may have started then the error state gives failed",
      [outcome({ kind: "error", error: unknownError }), vacuum("error")],
      at("failed"),
    ],
  ] as const)("%s", (_name, events, expected) => {
    expect(run(...events)).toEqual(expected);
  });

  describe("status unknown", () => {
    it.each(["unavailable", "unknown", undefined, "an_unlisted_state"])("keeps the phase and flags %s", (state) => {
      expect(run(outcome({ kind: "accepted" }), vacuum("cleaning"), vacuum(state))).toEqual(
        at("cleaning", { statusUnknown: true }),
      );
    });

    it("applies the rows again when a known state comes back", () => {
      expect(run(outcome({ kind: "accepted" }), vacuum("cleaning"), vacuum("unavailable"), vacuum("cleaning"))).toEqual(
        at("cleaning"),
      );
      expect(run(outcome({ kind: "accepted" }), vacuum("cleaning"), vacuum(undefined), vacuum("returning"))).toEqual(
        at("done"),
      );
    });

    it("keeps the error of may have started", () => {
      expect(run(outcome({ kind: "error", error: unknownError }), vacuum("unavailable"))).toEqual(
        at("may_have_started", { error: unknownError, statusUnknown: true }),
      );
    });
  });

  describe("states reported while sending", () => {
    it("applies the latest one once the call is accepted", () => {
      expect(run(vacuum("cleaning"), outcome({ kind: "accepted" }))).toEqual(at("cleaning"));
      expect(run(vacuum("cleaning"), vacuum("unavailable"), outcome({ kind: "accepted" }))).toEqual(
        at("starting", { statusUnknown: true }),
      );
    });

    it("applies the latest one after an error that may have started", () => {
      expect(run(vacuum("cleaning"), outcome({ kind: "error", error: unknownError }))).toEqual(at("cleaning"));
    });

    it("flags status unknown while sending", () => {
      expect(run(vacuum("unavailable"))).toMatchObject({ phase: "sending", statusUnknown: true });
      expect(run(vacuum("unavailable"), vacuum("docked"))).toMatchObject({ phase: "sending", statusUnknown: false });
    });

    it("drops them on an outcome that ends the progress", () => {
      expect(run(vacuum("cleaning"), outcome({ kind: "changed" }))).toEqual(at("not_started"));
      expect(run(vacuum("unavailable"), outcome({ kind: "error", error: notLinked }))).toEqual(
        at("failed", { error: notLinked }),
      );
    });
  });

  describe("what changes nothing", () => {
    // `busy`, `already_sent` and `discarded` never reach the progress: the controller sends nothing and stores
    // nothing, so no start begins (`app/progress/progress-tracker.test.ts`).
    it("an outcome after the one that ended sending", () => {
      const starting = raw(outcome({ kind: "accepted" }));
      expect(nextProgress(starting, outcome({ kind: "changed" }))).toBe(starting);
    });

    it.each(["cleaning", "paused", "error", "unavailable", undefined])("%s once the progress has ended", (state) => {
      for (const ended of [
        raw(outcome({ kind: "accepted" }), vacuum("cleaning"), vacuum("docked")),
        raw(outcome({ kind: "changed" })),
        raw(outcome({ kind: "error", error: notLinked })),
      ]) {
        expect(nextProgress(ended, vacuum(state))).toBe(ended);
      }
    });

    it("the same state again", () => {
      const cleaning = raw(outcome({ kind: "accepted" }), vacuum("cleaning"));
      expect(nextProgress(cleaning, vacuum("cleaning"))).toBe(cleaning);
      const unknown = nextProgress(cleaning, vacuum("unavailable"));
      expect(nextProgress(unknown, vacuum("unknown"))).toBe(unknown);
      const sending = raw(vacuum("idle"));
      expect(nextProgress(sending, vacuum("idle"))).toBe(sending);
    });
  });

  describe("the state at the confirm", () => {
    it("starts over on a new confirm, whatever the progress was", () => {
      const failed = raw(outcome({ kind: "error", error: notLinked }));
      expect(nextProgress(failed, { kind: "confirm_started", state: "error" })).toEqual({
        phase: "sending",
        statusUnknown: false,
      });
    });

    it.each(["unknown", "unavailable", undefined])("flags status unknown from a confirm while %s", (state) => {
      const sending = nextProgress(SENDING, { kind: "confirm_started", state });
      expect(sending).toEqual({ phase: "sending", statusUnknown: true });
      expect(nextProgress(sending, outcome({ kind: "accepted" }))).toEqual({ phase: "starting", statusUnknown: true });
      expect(nextProgress(sending, outcome({ kind: "error", error: unknownError }))).toEqual({
        phase: "may_have_started",
        error: unknownError,
        statusUnknown: true,
      });
    });
  });

  describe("paused before any cleaning", () => {
    it("waits again on a return or a dock, never done", () => {
      expect(run(outcome({ kind: "accepted" }), vacuum("paused"), vacuum("docked"))).toEqual(at("starting"));
      expect(run(outcome({ kind: "accepted" }), vacuum("paused"), vacuum("returning"))).toEqual(at("starting"));
    });

    it("is done once it cleaned", () => {
      expect(run(outcome({ kind: "accepted" }), vacuum("paused"), vacuum("cleaning"), vacuum("docked"))).toEqual(
        at("done"),
      );
    });

    it("remembers the cleaning through status unknown and pauses", () => {
      expect(
        run(
          outcome({ kind: "accepted" }),
          vacuum("cleaning"),
          vacuum("unavailable"),
          vacuum("paused"),
          vacuum("cleaning"),
          vacuum("paused"),
          vacuum("idle"),
        ),
      ).toEqual(at("done"));
    });
  });

  it("never puts more than the phase, the error and the status flag in what it shows", () => {
    expect(Object.keys(raw(outcome({ kind: "error", error: notLinked }))).sort()).toEqual([
      "error",
      "phase",
      "statusUnknown",
    ]);
  });
});
