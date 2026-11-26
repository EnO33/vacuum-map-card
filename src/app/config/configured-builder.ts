import type { FloorModel } from "../floor-model/floor-model";
import type { FloorModelBuilder } from "../floor-model/memo";
import type { HassPort } from "../ports/hass-port";
import type { RoomSource } from "../ports/room-source";
import { lastResult } from "./last-result";
import { onlyFloors } from "./only-floors";

/** The floor model the card shows for its `floors` option, built from the sources of its `robots` option. */
export type ConfiguredBuilder = (
  hass: HassPort,
  sources: readonly RoomSource[],
  floors: readonly string[] | undefined,
) => FloorModel;

/**
 * Applies the `floors` option (#115) after a memoised builder. The `robots` option is already in `sources`
 * (`createConfiguredSources`). The filter remembers its last result, so an unrelated `hass` update gives the same
 * model object and costs no render.
 */
export function createConfiguredBuilder(build: FloorModelBuilder): ConfiguredBuilder {
  const floorsOf = lastResult(onlyFloors);
  return (hass, sources, floors) => floorsOf(build(hass, sources), floors);
}
