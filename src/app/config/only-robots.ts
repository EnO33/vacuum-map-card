import type { RoomSource, SourceRobot } from "../ports/room-source";

/**
 * The sources with only the robots of the `robots` option (#115), or the sources themselves when it is not set. Made
 * before the floor model, so the plans, the robots offered for an item and the clean controller see the same set: a
 * robot not listed is never offered. A listed id that no source reports is ignored. Each filtered source gives the
 * same list while its own list is the same, as `RoomSource.robots` asks.
 */
export function onlyRobots(
  sources: readonly RoomSource[],
  robots: readonly string[] | undefined,
): readonly RoomSource[] {
  if (robots === undefined) return sources;
  const listed: ReadonlySet<string> = new Set(robots);
  return Object.freeze(sources.map((source) => filtered(source, listed)));
}

function filtered(source: RoomSource, listed: ReadonlySet<string>): RoomSource {
  let last: { readonly all: readonly SourceRobot[]; readonly kept: readonly SourceRobot[] } | undefined;
  return Object.freeze({
    integration: source.integration,
    integrationName: source.integrationName,
    loaded: () => source.loaded(),
    robots: () => {
      const all = source.robots();
      if (last?.all !== all) last = { all, kept: Object.freeze(all.filter((r) => listed.has(r.vacuumEntityId))) };
      return last.kept;
    },
  });
}
