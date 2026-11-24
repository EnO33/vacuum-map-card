import { type AreaMappingResult, readAreaMapping } from "../../domain/mapping/area-mapping";
import { type LastSeen, readLastSeen } from "../../domain/mapping/last-seen";
import { type Unsupported, unsupported } from "../../domain/unsupported";
import type { OptionsList, VacuumOptions, VacuumOptionsFailure } from "../ports/hass-port";

/** A robot's core mapping and `last_seen_segments` (#46), read from `HassPort.vacuumOptions`. */
export interface RobotOptions {
  readonly mapping: AreaMappingResult;
  readonly lastSeen: LastSeen;
}

/** `options.vacuum` read through #46; a list the port could not give is `unreadable`, never `absent`. */
export function robotOptions(
  options: VacuumOptions | Unsupported<VacuumOptionsFailure>,
  areaIds: ReadonlySet<string>,
): RobotOptions {
  if (options.kind !== "options") return { mapping: unsupported("unreadable"), lastSeen: unsupported("unreadable") };
  const { areaMapping, lastSeenSegments } = options;
  return {
    mapping:
      areaMapping.kind === "unsupported" ? unsupported("unreadable") : readAreaMapping(listOf(areaMapping), areaIds),
    lastSeen:
      lastSeenSegments.kind === "unsupported" ? unsupported("unreadable") : readLastSeen(listOf(lastSeenSegments)),
  };
}

function listOf<T>(list: Exclude<OptionsList<T>, { kind: "unsupported" }>): T | undefined {
  return list.kind === "list" ? list.list : undefined;
}
