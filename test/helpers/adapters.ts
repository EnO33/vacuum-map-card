// Test helper: the real adapters on a fake frontend `hass` loaded from the anonymised captures, with an injected timer.
import { vi } from "vitest";
import { type Adapters, createAdapters } from "../../src/adapters/create-adapters";
import { type FixtureHomeOptions, loadFixtureHome } from "../fakes/fixture-home";
import { FakeFrontendHass } from "../fakes/frontend-hass";

export { registryList } from "../fakes/fixture-home";

export interface AdaptersHarness {
  readonly hass: FakeFrontendHass;
  readonly adapters: Adapters;
  /** The answers to the three list commands; replace one before an update event. */
  readonly lists: Map<string, unknown>;
}

/** A fake frontend `hass` on the captures (no open repair issue), with the real adapters over it, not started. */
export function adaptersHarness(options: FixtureHomeOptions = {}): AdaptersHarness {
  const hass = new FakeFrontendHass();
  const lists = loadFixtureHome(hass, options);
  return { hass, adapters: createAdapters(() => hass), lists };
}

/** Starts the adapters and waits for the three lists (fake timers must be on). */
export async function started(harness: AdaptersHarness): Promise<AdaptersHarness> {
  harness.adapters.start();
  await vi.advanceTimersByTimeAsync(0);
  return harness;
}
