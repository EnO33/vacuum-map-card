/**
 * The part of the frontend `hass` object the adapters use (frontend 20261028.6, `src/types.ts`). Only what the card
 * calls is typed; everything the card reads back from it is untrusted and parsed at this boundary. Later adapter
 * issues add the members they read (#78).
 */
export interface FrontendHass {
  /**
   * `hass.callService(domain, service, serviceData?, target?, notifyOnError = true, returnResponse = false)`: resolves
   * with the websocket result and, on error, rethrows the error object (`docs/research/ha-core-vacuum.md` « Response »).
   */
  callService(
    domain: string,
    service: string,
    serviceData?: Readonly<Record<string, unknown>>,
    target?: { readonly entity_id: string },
    notifyOnError?: boolean,
    returnResponse?: boolean,
  ): Promise<unknown>;

  /** `hass.callWS(message)` (`src/types.ts` L278): resolves with the command's result, which is untrusted. */
  callWS(message: { readonly type: string }): Promise<unknown>;

  /** `hass.connection` (`src/types.ts` L303), a `home-assistant-js-websocket` 9.8.0 `Connection`. */
  readonly connection: FrontendConnection;

  /** `hass.areas`: area registry entries keyed by `area_id`, kept current by the frontend. Untrusted. */
  readonly areas: unknown;
  /** `hass.states`: state objects keyed by entity id. Untrusted. */
  readonly states: unknown;
  /** `hass.services`: services keyed by domain, then by service name. Untrusted. */
  readonly services: unknown;
  /** `hass.devices`: device registry entries keyed by device id, with `model` and `model_id`. Untrusted. */
  readonly devices: unknown;
  /** `hass.user`: the signed-in user, with `is_admin`. Untrusted. */
  readonly user: unknown;
}

/** The members of the websocket `Connection` the adapters use (`lib/connection.ts`, 9.8.0). */
export interface FrontendConnection {
  /** Resolves with the unsubscribe function; re-subscribed by the library after a reconnection. */
  subscribeEvents(callback: (event: unknown) => void, eventType: string): Promise<() => Promise<void>>;
  /** `ready` fires when the connection is back after a reconnection. */
  addEventListener(eventType: "ready", listener: () => void): void;
  removeEventListener(eventType: "ready", listener: () => void): void;
}
