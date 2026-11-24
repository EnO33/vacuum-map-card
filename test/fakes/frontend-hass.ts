// A fake of the frontend `hass` object, the shape the adapters read (`src/adapters/hass/frontend-hass.ts`). It
// records calls and answers as configured; later issues extend it with states, registries and the connection.
import type { FrontendHass } from "../../src/adapters/hass/frontend-hass";

/** How `callService` answers: resolve with a value, reject with a value, or throw synchronously. */
export interface CallServiceBehaviour {
  readonly kind: "resolve" | "reject" | "throw";
  readonly value: unknown;
}

export class FakeFrontendHass implements FrontendHass {
  readonly calls: Parameters<FrontendHass["callService"]>[] = [];
  behaviour: CallServiceBehaviour = { kind: "resolve", value: { context: { id: "01JAAAAAAAAAAAAAAAAAAAAAAA" } } };

  callService(...args: Parameters<FrontendHass["callService"]>): Promise<unknown> {
    this.calls.push(args);
    const { kind, value } = this.behaviour;
    if (kind === "throw") throw value;
    return kind === "resolve" ? Promise.resolve(value) : Promise.reject(value);
  }
}
