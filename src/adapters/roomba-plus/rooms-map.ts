import type { RoomsMap, RoomsMapContent } from "../../app/ports/room-source";
import type { FrontendHass } from "../hass/frontend-hass";
import { pictureStateOf, stateObjectOf } from "./picture-state";
import type { RobotEntities } from "./robot-entities";
import { roomsMapContentOf } from "./rooms-map-attributes";
import { storedMapsOf } from "./stored-maps";

const NO_STATE: RoomsMapContent = Object.freeze({ kind: "no_outlines" });

/**
 * The robot's rooms map (ADR 0002 « What an adapter reports » item 1), or `undefined` without a rooms map entry. It
 * reads the live `hass` on each call; the content is parsed once per state object. `shownMapId` is the map id of the
 * robot's only floor plan, enabled or not (ADR 0005 « Rooms map pairing » item 1); `pairRoomsMap` keeps the other
 * checks.
 */
export function roomsMapReader(getHass: () => FrontendHass): (robot: RobotEntities) => RoomsMap | undefined {
  const contents = new WeakMap<object, RoomsMapContent>();
  const contentOf = (stateObject: object | undefined): RoomsMapContent => {
    if (stateObject === undefined) return NO_STATE;
    let content = contents.get(stateObject);
    if (content === undefined) {
      content = roomsMapContentOf(stateObject);
      contents.set(stateObject, content);
    }
    return content;
  };
  return (robot) => {
    const entry = robot.roomsMap;
    if (entry === undefined) return undefined;
    const stateObject = entry.disabled ? undefined : stateObjectOf(getHass().states, entry.entityId);
    const [only, ...others] = storedMapsOf(robot, getHass);
    return Object.freeze({
      imageEntityId: entry.entityId,
      pictureState: pictureStateOf(entry, stateObject),
      shownMapId: only !== undefined && others.length === 0 ? only.mapId : undefined,
      content: contentOf(stateObject),
    });
  };
}
