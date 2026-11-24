/** A value the card puts in service data: never an object built from untrusted input. */
export type ServiceValue = string | number | boolean | readonly string[];

/**
 * One Home Assistant service call, built by `app` (path 1) or by an adapter (path 2, `RoomSource.roomAction`).
 * `domain` and `service` are literals written in code, never read from a state, attribute, registry entry or error.
 */
export interface ServiceCall {
  readonly domain: string;
  readonly service: string;
  readonly data: Readonly<Record<string, ServiceValue>>;
  readonly target?: { readonly entity_id: string };
}

/**
 * A refused call, as the websocket error reports it (`docs/research/ha-core-vacuum.md` « Response »). The card shows
 * its own text, chosen from `code` and `translationKey` (ADR 0003 « Errors »). The adapter:
 * - drops `translation_placeholders`;
 * - keeps `message` only when the error has no `translation_key` (core case 4, `Unauthorized`): a translated
 *   `message` already has the placeholders filled in, such as Roomba+'s `known` (every room name, untrusted) and
 *   `pmap_ids` (map ids, sensitive), so neither enters `app`;
 * - drops any optional string over the cap of ADR 0002 « Parsing limits » item 3, never cuts it, and reports an
 *   over-cap `code` as `unknown_error`.
 * A `message` that does reach `app` is shown only as a fallback, as text. A translated error whose key the card does
 * not know therefore gets the card's generic text: stricter than ADR 0003 « Errors », on purpose.
 */
export interface ServiceError {
  readonly code: string;
  readonly message?: string;
  readonly translationDomain?: string;
  readonly translationKey?: string;
}

/** The outcome of `HassPort.callService`, which never rejects. */
export type ServiceResult = { readonly ok: true } | { readonly ok: false; readonly error: ServiceError };
