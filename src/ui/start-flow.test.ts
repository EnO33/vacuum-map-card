import { describe, expect, it, vi } from "vitest";
import type { ItemRef } from "../app/robots-for-item/robots-for-item";
import type { CleanController } from "../app/start-clean/clean-controller";
import type { Intent, PrepareResult } from "../app/start-clean/intent";
import type { ConfirmOutcome } from "../app/start-clean/outcomes";
import type { Answer } from "./ask-confirmation";
import { type StartFlowDeps, startFlow } from "./start-flow";

const ITEM: ItemRef = { kind: "room", imageEntityId: "image.a_rooms_map", regionId: "1" };
const ROBOT = "vacuum.robot_one";
const INTENT: Intent = {
  vacuumEntityId: ROBOT,
  action: "vacuum",
  item: ITEM,
  path: {
    path: 1,
    areaId: "kitchen",
    roomNames: ["Kitchen"],
    mapId: "m",
    segments: [{ segmentId: "1", name: "Kitchen" }],
  },
};

type Controller = Pick<CleanController, "prepare" | "confirm" | "dismiss">;

function controller(prepared: PrepareResult, outcome: ConfirmOutcome = { kind: "accepted" }) {
  return {
    prepare: vi.fn<Controller["prepare"]>(() => prepared),
    confirm: vi.fn<Controller["confirm"]>(() => Promise.resolve(outcome)),
    dismiss: vi.fn<Controller["dismiss"]>(),
  };
}

function deps(
  fake: Controller | undefined,
  answer: Answer | Error = "confirmed",
  preview = false,
): StartFlowDeps & { ask: ReturnType<typeof vi.fn>; answered: ReturnType<typeof vi.fn> } {
  return {
    preview,
    controller: fake,
    ask: vi.fn((_intent: Intent) => (answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer))),
    answered: vi.fn((_confirmed: boolean) => undefined),
  };
}

const CHOSEN = { item: ITEM, vacuumEntityId: ROBOT };

describe("startFlow", () => {
  it("in the editor preview, asks nothing and sends nothing", async () => {
    const fake = controller({ kind: "intent", intent: INTENT });
    const flow = deps(fake, "confirmed", true);
    await expect(startFlow(flow, CHOSEN)).resolves.toEqual({ kind: "preview" });
    expect(fake.prepare).not.toHaveBeenCalled();
    expect(flow.ask).not.toHaveBeenCalled();
    expect(flow.answered).not.toHaveBeenCalled();
  });

  it("does nothing while the card has no controller", async () => {
    const flow = deps(undefined);
    await expect(startFlow(flow, CHOSEN)).resolves.toBeUndefined();
    expect(flow.ask).not.toHaveBeenCalled();
  });

  it("says why the robot cannot start, with no dialog", async () => {
    const fake = controller({ kind: "not_startable", reasons: ["unavailable"] });
    const flow = deps(fake);
    await expect(startFlow(flow, CHOSEN)).resolves.toEqual({
      kind: "cannot_start",
      vacuumEntityId: ROBOT,
      reasons: ["unavailable"],
    });
    expect(fake.prepare.mock.calls).toEqual([[ITEM, ROBOT]]);
    expect(flow.ask).not.toHaveBeenCalled();
  });

  it("asks to choose the room again when the robot is no longer listed or preparing fails", async () => {
    const fake = controller({ kind: "not_listed" });
    await expect(startFlow(deps(fake), CHOSEN)).resolves.toEqual({ kind: "not_started", vacuumEntityId: ROBOT });
    fake.prepare.mockImplementation(() => {
      throw new Error("broken");
    });
    await expect(startFlow(deps(fake), CHOSEN)).resolves.toEqual({ kind: "not_started", vacuumEntityId: ROBOT });
  });

  it("dismisses the intent and says nothing on a cancel", async () => {
    const fake = controller({ kind: "intent", intent: INTENT });
    const flow = deps(fake, "cancelled");
    await expect(startFlow(flow, CHOSEN)).resolves.toBeUndefined();
    expect(flow.ask.mock.calls).toEqual([[INTENT]]);
    expect(flow.answered.mock.calls).toEqual([[false]]);
    expect(fake.dismiss.mock.calls).toEqual([[INTENT]]);
    expect(fake.confirm).not.toHaveBeenCalled();
  });

  it.each([["unasked" as const], [new Error("dialog failed")]])(
    "dismisses the intent and says nothing was sent when the question could not be asked (%s)",
    async (answer) => {
      const fake = controller({ kind: "intent", intent: INTENT });
      const flow = deps(fake, answer);
      await expect(startFlow(flow, CHOSEN)).resolves.toEqual({ kind: "not_asked", vacuumEntityId: ROBOT });
      expect(flow.answered.mock.calls).toEqual([[false]]);
      expect(fake.dismiss.mock.calls).toEqual([[INTENT]]);
      expect(fake.confirm).not.toHaveBeenCalled();
    },
  );

  it("tells the card the question was answered before the call is sent", async () => {
    const order: string[] = [];
    const fake = controller({ kind: "intent", intent: INTENT });
    fake.confirm.mockImplementation(() => {
      order.push("confirm");
      return Promise.resolve({ kind: "accepted" });
    });
    const flow = deps(fake);
    flow.answered.mockImplementation((confirmed: boolean) => order.push(`answered ${confirmed}`));
    await startFlow(flow, CHOSEN);
    expect(order).toEqual(["answered true", "confirm"]);
  });

  it.each([
    [{ kind: "busy" }, "busy"],
    [{ kind: "already_sent" }, "nothing_sent"],
    [{ kind: "discarded" }, "nothing_sent"],
  ] as const)("confirms the intent once and tells %j, which sent nothing, as %s", async (outcome, kind) => {
    const fake = controller({ kind: "intent", intent: INTENT }, outcome);
    await expect(startFlow(deps(fake), CHOSEN)).resolves.toEqual({ kind, vacuumEntityId: ROBOT });
    expect(fake.confirm.mock.calls).toEqual([[INTENT]]);
    expect(fake.dismiss).not.toHaveBeenCalled();
  });

  it.each([
    { kind: "accepted" },
    { kind: "error", error: { kind: "unknown", mayHaveStarted: "unknown" } },
    { kind: "error", error: { kind: "not_allowed", mayHaveStarted: "no" } },
    { kind: "changed" },
  ] as const)("leaves a stored outcome %j to the robot's progress", async (outcome) => {
    const fake = controller({ kind: "intent", intent: INTENT }, outcome);
    await expect(startFlow(deps(fake), CHOSEN)).resolves.toBeUndefined();
    expect(fake.confirm.mock.calls).toEqual([[INTENT]]);
  });
});
