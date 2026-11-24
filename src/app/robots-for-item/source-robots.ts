import type { RoomSource, SourceRobot } from "../ports/room-source";

/** A source robot with the room source that reported it. */
export interface SourcedRobot {
  readonly source: RoomSource;
  readonly robot: SourceRobot;
}

/**
 * Source robots by vacuum id, each with its room source. An id reported more than once (by two sources, or twice by
 * one) is dropped, so rooms, actions and error classification never mix robots.
 */
export function sourcedRobots(sources: readonly RoomSource[]): ReadonlyMap<string, SourcedRobot> {
  const all = sources.flatMap((source) => source.robots().map((robot) => ({ source, robot })));
  const counts = new Map<string, number>();
  for (const { robot } of all) counts.set(robot.vacuumEntityId, (counts.get(robot.vacuumEntityId) ?? 0) + 1);
  return new Map(
    all.filter(({ robot }) => counts.get(robot.vacuumEntityId) === 1).map((s) => [s.robot.vacuumEntityId, s]),
  );
}

/** Source robots by vacuum id, without the ids reported more than once. */
export function uniqueSourceRobots(sources: readonly RoomSource[]): ReadonlyMap<string, SourceRobot> {
  return new Map([...sourcedRobots(sources)].map(([id, { robot }]) => [id, robot]));
}
