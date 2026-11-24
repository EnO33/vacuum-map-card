import type { RoomsMap, RoomsMapContent } from "../../app/ports/room-source";
import type { FrontendHass } from "../hass/frontend-hass";
import { pictureStateOf, stateObjectOf } from "./picture-state";
import type { RobotEntities } from "./robot-entities";
import { NO_OUTLINES, roomsMapContentOf } from "./rooms-map-attributes";
import { storedMapsOf } from "./stored-maps";

/**
 * The robot's rooms map (ADR 0002 « What an adapter reports » item 1), or `undefined` without a rooms map entry. It
 * reads the live `hass` on each call; the content is parsed once per state object. `shownMapId` is the map id of the
 * robot's only floor plan registry entry, enabled or not (ADR 0005 « Rooms map pairing » item 1); `pairRoomsMap`
 * keeps the other checks.
 */
export function roomsMapReader(getHass: () => FrontendHass): (robot: RobotEntities) => RoomsMap | undefined {
  const contents = new WeakMap<object, RoomsMapContent>();
  const contentOf = (stateObject: object | undefined): RoomsMapContent => {
    if (stateObject === undefined) return NO_OUTLINES;
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
    return Object.freeze({
      imageEntityId: entry.entityId,
      pictureState: pictureStateOf(entry, stateObject),
      shownMapId: onlyMapId(robot, getHass),
      content: contentOf(stateObject),
    });
  };
}

/**
 * The map id of the robot's floor plan when the registry has exactly one floor plan entry and it gives a stored map.
 * Counting entries, not stored maps, keeps an orphan floor plan (an unmatched `unique_id`) from hiding a second map.
 */
function onlyMapId(robot: RobotEntities, getHass: () => FrontendHass): string | undefined {
  if (robot.floorPlans.length !== 1) return undefined;
  const [only] = storedMapsOf(robot, getHass);
  return only?.mapId;
}
