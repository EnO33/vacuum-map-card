import type { RoomSource } from "../ports/room-source";
import { lastResult } from "./last-result";
import { onlyRobots } from "./only-robots";

/**
 * The room sources for the card's `robots` option (#115), read again on each call. The floor model, the robots offered
 * for an item and the clean controller all read them, so a robot not listed is never offered nor started. The same
 * sources and list give the same objects, so an unrelated `hass` update costs no render.
 */
export function createConfiguredSources(
  all: () => readonly RoomSource[],
  robots: () => readonly string[] | undefined,
): () => readonly RoomSource[] {
  const robotsOf = lastResult(onlyRobots);
  return () => robotsOf(all(), robots());
}
