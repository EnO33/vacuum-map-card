// Test helper: a `RoomSource` with one robot changed, for variants of the fixture-backed fakes.
import type { RoomSource, SourceRobot } from "../../src/app/ports/room-source";

/** The source with robot `entityId` changed by `change`; the other robots are kept as they are. */
export function withRobot(
  source: RoomSource,
  entityId: string,
  change: (robot: SourceRobot) => Partial<SourceRobot>,
): RoomSource {
  const robots = source
    .robots()
    .map((robot) => (robot.vacuumEntityId === entityId ? { ...robot, ...change(robot) } : robot));
  return { ...pick(source), robots: () => robots };
}

/** The source's members other than `robots`, bound to it. */
function pick(source: RoomSource): Omit<RoomSource, "robots"> {
  return {
    integration: source.integration,
    integrationName: source.integrationName,
    loaded: () => source.loaded(),
  };
}
