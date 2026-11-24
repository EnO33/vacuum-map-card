/**
 * The part of the frontend `hass` object the adapters use (frontend 20261028.6, `src/types.ts`). Only what the card
 * calls is typed; everything the card reads back from it is untrusted and parsed at this boundary. Later adapter
 * issues add the members they read (#76, #77, #78).
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
}
