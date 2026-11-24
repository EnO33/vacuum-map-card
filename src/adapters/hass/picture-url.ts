import type { RoomSource } from "../../app/ports/room-source";
import type { FrontendHass } from "./frontend-hass";
import { boundedText, isObject, ownValue } from "./own-property";
import { shownStateOf, stateObjectOf } from "./picture-state";

const IMAGE_PROXY = "/api/image_proxy/";

/**
 * A plan picture's absolute URL, built as the frontend builds it (ADR 0005 « Plan pictures » item 1):
 * `/api/image_proxy/<entity id>?token=<access_token>&state=<state>`, each part URL-encoded, through `hass.hassUrl`.
 * Only for an `image.` entity a room source reports, not disabled, with a usable state and its own `access_token`
 * attribute; `entity_picture` is never read. Not a port member: tokens and URLs never cross a port. Read on every call
 * (the token rotates every 5 minutes, item 2), never cached, logged or thrown.
 */
export function pictureUrl(
  getHass: () => FrontendHass,
  sources: readonly RoomSource[],
  entityId: string,
): string | undefined {
  try {
    if (!entityId.startsWith("image.") || !reportedPicture(sources, entityId)) return undefined;
    const hass = getHass();
    const parts = tokenAndState(hass.states, entityId);
    if (parts === undefined) return undefined;
    const path = `${IMAGE_PROXY}${encodeURIComponent(entityId)}?token=${encodeURIComponent(parts.token)}&state=${encodeURIComponent(parts.state)}`;
    return hass.hassUrl(path);
  } catch {
    // Never an exception that could carry the token or the URL.
    return undefined;
  }
}

/** Whether a room source reports `entityId` as a floor plan or a rooms map that is not disabled. */
function reportedPicture(sources: readonly RoomSource[], entityId: string): boolean {
  return sources.some((source) =>
    source.robots().some((robot) => {
      const plan = robot.storedMaps.find((map) => map.floorPlanEntityId === entityId);
      if (plan !== undefined) return plan.pictureState !== "disabled";
      return robot.roomsMap?.imageEntityId === entityId && robot.roomsMap.pictureState !== "disabled";
    }),
  );
}

/** The shown state (`shownStateOf`) and own `access_token` (non-empty, within the cap) of the entity. */
function tokenAndState(states: unknown, entityId: string): { token: string; state: string } | undefined {
  const stateObject = stateObjectOf(states, entityId);
  const state = shownStateOf(stateObject);
  if (stateObject === undefined || state === undefined) return undefined;
  const attributes = ownValue(stateObject, "attributes");
  const token = isObject(attributes) ? boundedText(ownValue(attributes, "access_token")) : undefined;
  return token === undefined || token === "" ? undefined : { token, state };
}
