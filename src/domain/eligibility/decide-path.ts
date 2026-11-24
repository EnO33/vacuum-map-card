import { type Availability, robotAvailability } from "./availability";
import { type PathOne, type PathOneContext, type PathOneRefusal, pathOne } from "./path-one";
import {
  type PathTwo,
  type PathTwoRefusal,
  type PathTwoRobot,
  type PlanRoomName,
  pathTwo,
  type ShadowIndex,
} from "./path-two";

/** The vacuum's state (`HassPort.vacuum`), or `undefined` when it has none. */
export type VacuumStateInput = Parameters<typeof robotAvailability>[0];

type PathOneSuccess = Extract<PathOne, { kind: "path1" }>;

/** Not startable: the robot itself is not (ADR 0003 « Eligibility »), and then no path is tried. */
type RobotNotStartable = Extract<Availability, { kind: "not_startable" }>;

export type RoomPath<C> =
  | PathOneSuccess
  | Extract<PathTwo<C>, { kind: "path2" }>
  | RobotNotStartable
  | {
      readonly kind: "not_startable";
      readonly reason: "no_path";
      readonly pathOne: PathOneRefusal;
      readonly pathTwo: PathTwoRefusal;
    };

export type AreaItemPath =
  | PathOneSuccess
  | RobotNotStartable
  | { readonly kind: "not_startable"; readonly reason: "no_path"; readonly pathOne: PathOneRefusal };

export interface DecideRoomContext {
  readonly vacuum: VacuumStateInput;
  readonly pathOne: PathOneContext;
  /** The rooms plan's shadow index, built once with `shadowIndexOf` from its rooms and `pathOne.lastSeen`. */
  readonly shadows: ShadowIndex;
}

/**
 * How a robot starts a room of its own rooms plan (ADR 0003): not at all when the robot is not startable; else
 * `vacuum.clean_area` when path 1 applies; else its own room action when path 2 applies; else not startable with both
 * reasons. Path 2 is tried only after path 1 was refused, so its call is never built when path 1 applies.
 */
export function decideRoomPath<C>(robot: PathTwoRobot<C>, room: PlanRoomName, context: DecideRoomContext): RoomPath<C> {
  const availability = robotAvailability(context.vacuum);
  if (availability.kind === "not_startable") return availability;
  const first = pathOne({ kind: "room", regionId: room.regionId }, context.pathOne);
  if (first.kind === "path1") return first;
  const second = pathTwo(robot, room, context.shadows);
  if (second.kind === "path2") return second;
  return { kind: "not_startable", reason: "no_path", pathOne: first.reason, pathTwo: second.reason };
}

/** How a robot starts an area item of a room list: path 1 only, since an area item has no region id (ADR 0003). */
export function decideAreaItemPath(vacuum: VacuumStateInput, areaId: string, context: PathOneContext): AreaItemPath {
  const availability = robotAvailability(vacuum);
  if (availability.kind === "not_startable") return availability;
  const path = pathOne({ kind: "area", areaId }, context);
  return path.kind === "path1" ? path : { kind: "not_startable", reason: "no_path", pathOne: path.reason };
}
