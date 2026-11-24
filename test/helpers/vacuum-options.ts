// Test helper for `src/adapters/hass/vacuum-options.ts`: an entity registry over a fake hass, loaded per test.
import { vi } from "vitest";
import { createEntityRegistry, type EntityRegistry } from "../../src/adapters/hass/entity-registry";
import { vacuumOptionsReader } from "../../src/adapters/hass/vacuum-options";
import { FakeFrontendHass } from "../fakes/frontend-hass";

export const ROBOT = "vacuum.robot_one";

/** One vacuum entry whose `options` is `options`. */
export function vacuumWith(options: unknown): Record<string, unknown> {
  return { entity_id: ROBOT, id: "03030303030303030303030303030303", platform: "roomba_plus", options };
}

/** A registry and its options reader; `load` replaces both, since a registry is single use. */
export class OptionsHarness {
  readonly hass = new FakeFrontendHass();
  #registry: EntityRegistry = createEntityRegistry(() => this.hass);
  #read = vacuumOptionsReader(this.#registry);

  read(entityId: string): ReturnType<ReturnType<typeof vacuumOptionsReader>> {
    return this.#read(entityId);
  }

  /** Loads `list` into a new registry and waits for the fetch; `clone: false` keeps prototypes and proxies. */
  async load(list: unknown, clone = true): Promise<void> {
    this.#registry.stop();
    this.#registry = createEntityRegistry(() => this.hass);
    this.#read = vacuumOptionsReader(this.#registry);
    this.hass.answerWS = () => Promise.resolve(clone ? structuredClone(list) : list);
    this.#registry.start();
    await vi.advanceTimersByTimeAsync(0);
  }

  /** The options of a vacuum whose `options.vacuum` is `vacuum`. */
  async optionsOf(vacuum: unknown): Promise<ReturnType<ReturnType<typeof vacuumOptionsReader>>> {
    await this.load([vacuumWith({ vacuum })]);
    return this.read(ROBOT);
  }

  stop(): void {
    this.#registry.stop();
  }
}
