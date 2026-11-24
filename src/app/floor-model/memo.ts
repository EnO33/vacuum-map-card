import { type RoomsMapSnapshot, sameRoomsSnapshot } from "../../domain/plan/rooms-map-snapshot";
import { buildRoomsPlan, type RoomsPlanResult } from "../../domain/plan/rooms-plan";
import type { HassPort } from "../ports/hass-port";
import type { RoomSource } from "../ports/room-source";
import { floorModelOf } from "./build-floor-model";
import type { FloorModel } from "./floor-model";
import { comparable, readInputs } from "./inputs";
import { sameValue } from "./same-value";

/** A memoised floor model builder: the same model object for equal inputs. */
export type FloorModelBuilder = (hass: HassPort, sources: readonly RoomSource[]) => FloorModel;

interface CachedPlan {
  readonly snapshot: RoomsMapSnapshot;
  readonly result: RoomsPlanResult;
}

/**
 * A floor model builder that remembers its last inputs by value (`CLAUDE.md`: re-render only what changed). The ports
 * are read once per call; equal inputs in new objects give the same model object. A robot's rooms plan, and so its
 * calibration, is rebuilt only when its snapshot changes (ADR 0002 « Parsing limits » item 2).
 */
export function createFloorModelBuilder(): FloorModelBuilder {
  let last: { readonly inputs: unknown; readonly model: FloorModel } | undefined;
  let plans = new Map<string, CachedPlan>();

  return (hass, sources) => {
    const read = readInputs(hass, sources);
    const inputs = comparable(read);
    if (last && sameValue(last.inputs, inputs)) return last.model;
    const used = new Map<string, CachedPlan>();
    const model = floorModelOf(read, (vacuumEntityId, snapshot) => {
      const cached = plans.get(vacuumEntityId);
      const entry =
        cached && sameRoomsSnapshot(cached.snapshot, snapshot)
          ? cached
          : { snapshot, result: buildRoomsPlan(snapshot) };
      used.set(vacuumEntityId, entry);
      return entry.result;
    });
    plans = used;
    last = { inputs, model };
    return model;
  };
}
