import type { AreaItemPath, RoomPath } from "../../domain/eligibility/decide-path";
import type { JoinPath } from "../../domain/eligibility/join-path";
import type { PathOne, PathOneRefusal } from "../../domain/eligibility/path-one";
import type { PathTwo, PathTwoRefusal } from "../../domain/eligibility/path-two";
import type { ActionKind } from "../../domain/robot/action-kind";

/** Why a listed robot cannot start the item. Codes only: never a map id or segment id. */
export type NotStartableReason = "unavailable" | "no_state" | PathOneRefusal | PathTwoRefusal;

/** What a robot would do for the item: path 1 with its area, path 2 with its own room, or why it cannot. */
export type Choice =
  | { readonly kind: "path1"; readonly areaId: string; readonly roomNames: readonly string[] }
  | { readonly kind: "path2"; readonly regionId: string; readonly ownRoomName: string }
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
export function roomChoice<C>(decision: RoomPath<C>, ownRoomName: string): Choice {
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
export function joinChoice<C>(decision: JoinPath<C>, ownRoomName: (regionId: string) => string): Choice {
  if (decision.kind !== "not_startable") return pathChoice(decision, ownRoomName);
  return notStartable(decision.reason === "no_path" ? decision.reasons : [decision.reason]);
}

/** Path 1 without its map id (a linking value only), or path 2 with the robot's own room name. */
function pathChoice<C>(
  path: Extract<PathOne, { kind: "path1" }> | Extract<PathTwo<C>, { kind: "path2" }>,
  ownRoomName: (regionId: string) => string,
): Choice {
  if (path.kind === "path1") return { kind: "path1", areaId: path.areaId, roomNames: path.roomNames };
  return { kind: "path2", regionId: path.regionId, ownRoomName: ownRoomName(path.regionId) };
}

function notStartable(reasons: readonly NotStartableReason[]): Choice {
  return { kind: "not_startable", reasons };
}
