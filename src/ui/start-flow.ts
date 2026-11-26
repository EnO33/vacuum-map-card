import type { NotStartableReason } from "../app/robots-for-item/choice";
import type { CleanController } from "../app/start-clean/clean-controller";
import type { Intent, PrepareResult } from "../app/start-clean/intent";
import type { ConfirmOutcome } from "../app/start-clean/outcomes";
import type { Answer } from "./ask-confirmation";
import type { RobotChosen } from "./robot-picker";

/**
 * A notice about one robot's start, by what the status line says. A sent start is told by its progress instead (ADR
 * 0003 « Progress on a room »): sending, then the outcome, on the room, under its plan and in the status line.
 */
export type RobotNoticeKind = "not_started" | "busy" | "nothing_sent" | "not_asked";

/** What the status line says after a choice (ADR 0003 « Amendment (2026-11-24) », « Where the result shows »). */
export type StartNotice =
  | { readonly kind: "preview" }
  | { readonly kind: "cannot_start"; readonly vacuumEntityId: string; readonly reasons: readonly NotStartableReason[] }
  | { readonly kind: RobotNoticeKind; readonly vacuumEntityId: string };

export interface StartFlowDeps {
  /** `true` in the card editor: nothing is prepared, asked or sent. */
  readonly preview: boolean;
  /** The running controller; `undefined` while the card has no adapters. */
  readonly controller: Pick<CleanController, "prepare" | "confirm" | "dismiss"> | undefined;
  /** Asks the user to confirm the intent. */
  ask(intent: Intent): Promise<Answer>;
  /** Called once the question is answered, before anything is sent: `true` when the user confirmed. */
  answered(confirmed: boolean): void;
}

/**
 * One choice of a robot, from the intent to the status line: `prepare` once, ask, then `confirm` once when the user
 * confirmed or `dismiss` otherwise, so one confirmation sends at most one call. A cancel says nothing; a question that
 * could not be asked says that nothing was sent.
 */
export async function startFlow(
  deps: StartFlowDeps,
  { item, vacuumEntityId }: RobotChosen,
): Promise<StartNotice | undefined> {
  if (deps.preview) return { kind: "preview" };
  const { controller } = deps;
  if (controller === undefined) return undefined;
  let prepared: PrepareResult;
  try {
    prepared = controller.prepare(item, vacuumEntityId);
  } catch {
    prepared = { kind: "not_listed" };
  }
  if (prepared.kind === "not_startable") return { kind: "cannot_start", vacuumEntityId, reasons: prepared.reasons };
  // Not listed any more: the plans changed since the picker opened.
  if (prepared.kind === "not_listed") return { kind: "not_started", vacuumEntityId };
  const { intent } = prepared;
  const answer = await deps.ask(intent).catch((): Answer => "unasked");
  deps.answered(answer === "confirmed");
  if (answer !== "confirmed") {
    controller.dismiss(intent);
    return answer === "unasked" ? { kind: "not_asked", vacuumEntityId } : undefined;
  }
  const kind = noticeKind(await controller.confirm(intent));
  return kind === undefined ? undefined : { kind, vacuumEntityId };
}

/** An outcome the controller stored is told by the robot's progress; one that sent nothing gets a notice. */
function noticeKind(outcome: ConfirmOutcome): RobotNoticeKind | undefined {
  switch (outcome.kind) {
    case "accepted":
    case "error":
    case "changed":
      return undefined;
    case "busy":
      return "busy";
    case "already_sent":
    case "discarded":
      return "nothing_sent";
  }
}
