import type { AreaItemPath, RoomPath } from "../../domain/eligibility/decide-path";
import type { JoinPath } from "../../domain/eligibility/join-path";
import type { PathOne, PathOneRefusal } from "../../domain/eligibility/path-one";
import type { PathTwo, PathTwoRefusal } from "../../domain/eligibility/path-two";
import type { ActionKind } from "../../domain/robot/action-kind";
import type { ServiceCall } from "../ports/service-call";

/** Why a listed robot cannot start the item. Codes only: never a map id or segment id. */
export type NotStartableReason =
  | "unavailable"
  | "no_state"
  | PathOneRefusal
  | PathTwoRefusal
  /** The adapter's room action names another robot: never sent. */
  | "room_action_wrong_robot";

/**
 * What a robot would do for the item: path 1 with its area, path 2 with its own room, or why it cannot. `mapId`,
 * `segments` and `call` are values for linking and for the intent (#56); the picker shows only names.
 */
export type Choice =
  | {
      readonly kind: "path1";
      readonly areaId: string;
      readonly roomNames: readonly string[];
      readonly mapId: string;
      readonly segments: readonly { readonly segmentId: string; readonly name: string }[];
    }
  | { readonly kind: "path2"; readonly regionId: string; readonly ownRoomName: string; readonly call: ServiceCall }
  | { readonly kind: "not_startable"; readonly reasons: readonly NotStartableReason[] };

/** One robot of the picker (`docs/product.md` « Core flow » 3). */
export interface Candidate {
  readonly vacuumEntityId: string;
  readonly action: ActionKind;
  /** The vacuum's state, or `undefined` when it has none. */
  readonly state: string | undefined;
  readonly choice: Choice;
}

/** The plan's own robot on one of its rooms (#53). */
export function roomChoice(decision: RoomPath<ServiceCall>, ownRoomName: string): Choice {
  if (decision.kind !== "not_startable") return pathChoice(decision, () => ownRoomName);
  if (decision.reason !== "no_path") return notStartable([decision.reason]);
  return notStartable([decision.pathOne, decision.pathTwo]);
}

/** The plan's own robot on one of its area items (#53). */
export function areaItemChoice(decision: AreaItemPath): Choice {
  if (decision.kind === "path1") return pathChoice(decision, () => "");
  return notStartable([decision.reason === "no_path" ? decision.pathOne : decision.reason]);
}

/** A robot joining through the item's area. */
export function joinChoice(decision: JoinPath<ServiceCall>, ownRoomName: (regionId: string) => string): Choice {
  if (decision.kind !== "not_startable") return pathChoice(decision, ownRoomName);
  return notStartable(decision.reason === "no_path" ? decision.reasons : [decision.reason]);
}

function pathChoice(
  path: Extract<PathOne, { kind: "path1" }> | Extract<PathTwo<ServiceCall>, { kind: "path2" }>,
  ownRoomName: (regionId: string) => string,
): Choice {
  if (path.kind === "path1") {
    const { areaId, roomNames, mapId, segments } = path;
    return { kind: "path1", areaId, roomNames, mapId, segments };
  }
  return { kind: "path2", regionId: path.regionId, ownRoomName: ownRoomName(path.regionId), call: path.call };
}

function notStartable(reasons: readonly NotStartableReason[]): Choice {
  return { kind: "not_startable", reasons };
}

/** The call names this robot and no other, by its data or its target. */
export function targetsRobot(call: ServiceCall, vacuumEntityId: string): boolean {
  const named = [new Map(Object.entries(call.data)).get("entity_id"), call.target?.entity_id].filter(
    (id) => id !== undefined,
  );
  return named.length > 0 && named.every((id) => id === vacuumEntityId);
}

/** A path 2 candidate whose call names another robot is listed as not startable, never offered. */
export function guardedCandidate(candidate: Candidate): Candidate {
  const { choice } = candidate;
  if (choice.kind !== "path2" || targetsRobot(choice.call, candidate.vacuumEntityId)) return candidate;
  return { ...candidate, choice: notStartable(["room_action_wrong_robot"]) };
}
