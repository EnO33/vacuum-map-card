// Test helper: an entity registry over a fake hass, loaded from a list (fake timers must be on).
import { vi } from "vitest";
import { createEntityRegistry, type EntityRegistry } from "../../src/adapters/hass/entity-registry";
import type { FakeFrontendHass } from "../fakes/frontend-hass";

/**
 * A started registry whose first fetch answered `list` as is (no clone: prototypes and proxies are kept). The caller
 * stops it after the test.
 */
export async function loadedRegistry(hass: FakeFrontendHass, list: unknown): Promise<EntityRegistry> {
  const registry = createEntityRegistry(() => hass);
  const answer = hass.answerWS;
  hass.answerWS = (message) =>
    message.type === "config/entity_registry/list" ? Promise.resolve(list) : answer(message);
  registry.start();
  await vi.advanceTimersByTimeAsync(0);
  hass.answerWS = answer;
  return registry;
}
