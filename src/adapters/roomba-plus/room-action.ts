import type { ServiceCall } from "../../app/ports/service-call";
import { withinTextCap } from "../../domain/text/limits";
import { PLATFORM } from "./robot-entities";

/**
 * The robot's path 2 call (ADR 0003 « Path 2 », « Call »): `roomba_plus.clean_room` with `entity_id` and `room_name`
 * set to the region id only, no `target` and no run option, the form proven live (#27). `undefined` for an empty or
 * over-cap region id. Roomba+ resolves names before ids, so the caller's shadow check applies.
 */
export function roomActionOf(vacuumEntityId: string): (regionId: string) => ServiceCall | undefined {
  return (regionId) =>
    regionId === "" || !withinTextCap(regionId)
      ? undefined
      : Object.freeze({
          domain: PLATFORM,
          service: "clean_room",
          data: Object.freeze({ entity_id: vacuumEntityId, room_name: regionId }),
        });
}
