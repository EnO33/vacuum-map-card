import type { AreaLink } from "../plan/room-to-area";
import { robotAvailability } from "./availability";
import type { RoomPath, VacuumStateInput } from "./decide-path";
import { type PathOneContext, type PathOneItem, type PathOneRefusal, pathOne } from "./path-one";
import { type PathTwoRefusal, type PathTwoRobot, type PlanRoomName, pathTwo, type ShadowIndex } from "./path-two";

/** A room of the joining robot's own rooms plan, with its area link (#50) and its plan's floor (#51). */
export interface JoinRoom extends PlanRoomName {
  readonly area: AreaLink;
  /** `undefined` when its plan is in « no floor ». */
  readonly floorId: string | undefined;
}

export interface JoinContext {
  readonly vacuum: VacuumStateInput;
  /** The item's area. */
  readonly areaId: string;
  /** The shown plan's floor, or `undefined` for « no floor ». */
  readonly planFloorId: string | undefined;
  /** The robot's own room lists list this area (a rule 1 link by construction, #50). */
  readonly hasAreaItem: boolean;
  /** The robot's own rooms (any area; only those linked to `areaId` count). */
  readonly rooms: readonly JoinRoom[];
  readonly pathOne: PathOneContext;
  /** The shadow index of the robot's own rooms plan (#53), when it has one. */
  readonly shadows: ShadowIndex | undefined;
}

/** How a joining robot would start the item, or why it cannot; `undefined` when it does not join. */
export type JoinPath<C> =
  | Exclude<RoomPath<C>, { reason: "no_path" }>
  | {
      readonly kind: "not_startable";
      readonly reason: "no_path";
      readonly reasons: readonly (PathOneRefusal | PathTwoRefusal)[];
    };

/**
 * ADR 0005 « Room to area », last paragraph; ADR 0003, end of « Path 2 ». Another robot joins an item when its own
 * area item lists the item's area, or one of its own rooms links to it by rule 1 (`core`), or by either rule on the
 * shown plan's floor. A room linked only by name on another floor, or in « no floor », never joins. A joining robot
 * then starts with its own link: `vacuum.clean_area` for that same area (its area item or core room), else its own
 * room action on a same-floor room; else it is listed as not startable with every reason.
 */
export function decideJoinPath<C>(robot: PathTwoRobot<C>, context: JoinContext): JoinPath<C> | undefined {
  const { areaId, planFloorId } = context;
  const linked = context.rooms.filter((room) => linksArea(room, areaId));
  const coreRooms = linked.filter((room) => room.area.kind === "core");
  const sameFloor = planFloorId === undefined ? [] : linked.filter((room) => room.floorId === planFloorId);
  if (!context.hasAreaItem && coreRooms.length === 0 && sameFloor.length === 0) return undefined;

  const availability = robotAvailability(context.vacuum);
  if (availability.kind === "not_startable") return availability;
  const reasons: (PathOneRefusal | PathTwoRefusal)[] = [];
  const items: PathOneItem[] = coreRooms.map((room) => ({ kind: "room", regionId: room.regionId }));
  if (context.hasAreaItem) items.unshift({ kind: "area", areaId });
  for (const item of items) {
    const path = pathOne(item, context.pathOne);
    // Path 1 must clean the item's own area, whatever the room's link said when the model was built.
    if (path.kind === "path1" && path.areaId === areaId) return path;
    reasons.push(path.kind === "path1" ? "no_core_area" : path.reason);
  }
  for (const room of sameFloor) {
    const path = context.shadows ? pathTwo(robot, room, context.shadows) : undefined;
    if (path?.kind === "path2") return path;
    reasons.push(path ? path.reason : "shadow_check_impossible");
  }
  return { kind: "not_startable", reason: "no_path", reasons: [...new Set(reasons)] };
}

/** Whether a room links to the area, by either rule (#50). */
export function linksArea(room: { readonly area: AreaLink }, areaId: string): boolean {
  return room.area.kind !== "none" && room.area.areaId === areaId;
}
