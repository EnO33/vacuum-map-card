import type { Area, Floor } from "../../domain/registry/types";
import type { Unsupported } from "../../domain/unsupported";
import type { HassPort, VacuumOptions, VacuumOptionsFailure } from "../ports/hass-port";
import type { RoomSource, SourceRobot } from "../ports/room-source";

/** One robot with what the model reads about it from `HassPort`. */
export interface RobotInputs {
  readonly robot: SourceRobot;
  /**
   * `undefined` when the vacuum has no state (disabled, or not in `hass.states` yet). Only this, not the whole state:
   * a robot that starts cleaning changes nothing.
   */
  readonly supportedFeatures: number | undefined;
  readonly options: VacuumOptions | Unsupported<VacuumOptionsFailure>;
}

/** Everything the floor model is built from, read once from the ports. */
export interface FloorModelInputs {
  /** `undefined` before the floor list is read. */
  readonly floors: readonly Floor[] | undefined;
  /** `false` while a source has not read its robots yet. */
  readonly sourcesLoaded: boolean;
  readonly areas: ReadonlyMap<string, Area>;
  readonly robots: readonly RobotInputs[];
}

export function readInputs(hass: HassPort, sources: readonly RoomSource[]): FloorModelInputs {
  return {
    floors: hass.floors(),
    sourcesLoaded: sources.every((source) => source.loaded()),
    areas: hass.areas(),
    robots: sources
      .flatMap((source) => source.robots())
      .map((robot) => ({
        robot,
        supportedFeatures: hass.vacuum(robot.vacuumEntityId)?.supportedFeatures,
        options: hass.vacuumOptions(robot.vacuumEntityId),
      })),
  };
}

/** The inputs as plain data, without the robots' functions, for comparing by value. */
export function comparable(inputs: FloorModelInputs): unknown {
  return {
    floors: inputs.floors,
    sourcesLoaded: inputs.sourcesLoaded,
    areas: inputs.areas,
    robots: inputs.robots.map(({ robot, supportedFeatures, options }) => ({
      id: robot.vacuumEntityId,
      action: robot.action,
      storedMaps: robot.storedMaps,
      roomsMap: robot.roomsMap,
      supportedFeatures,
      options,
    })),
  };
}
