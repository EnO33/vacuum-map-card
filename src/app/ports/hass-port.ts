import type { RawAreaMapping } from "../../domain/mapping/area-mapping";
import type { LastSeenSegment } from "../../domain/mapping/last-seen";
import type { Area, Floor } from "../../domain/registry/types";
import type { Unsupported } from "../../domain/unsupported";
import type { ServiceCall, ServiceResult } from "./service-call";

/** A vacuum entity's state, as far as eligibility needs it. */
export interface VacuumState {
  /** The entity state (`docked`, `cleaning`, `unavailable`…). */
  readonly state: string;
  /** The `supported_features` bit mask; `CLEAN_AREA` is read by `domain/robot/features.ts`. */
  readonly supportedFeatures: number;
}

/**
 * One list of `options.vacuum`: `absent` (never saved), the typed `list`, or `malformed` when it is present but not
 * the documented shape. A malformed list is never reported as absent: absent `last_seen_segments` would skip path 2's
 * shadow check, and absent `area_mapping` would show « not configured ».
 */
export type OptionsList<T> =
  | { readonly kind: "absent" }
  | { readonly kind: "list"; readonly list: T }
  | Unsupported<"malformed">;

/** The two core lists of `options.vacuum`, typed and read apart, so refusing one never hides the other (#46). */
export interface VacuumOptions {
  readonly kind: "options";
  /** `area_mapping` as a `Map`. */
  readonly areaMapping: OptionsList<RawAreaMapping>;
  /** `last_seen_segments` without `group`. */
  readonly lastSeenSegments: OptionsList<readonly LastSeenSegment[]>;
}

/**
 * `not_loaded`: the registry has not been read yet (`subscribe` notifies when it has). `registry_entry_unreadable`:
 * the vacuum has no readable registry entry. `malformed_options`: `options.vacuum` is present but not an object.
 */
export type VacuumOptionsFailure = "not_loaded" | "registry_entry_unreadable" | "malformed_options";

/**
 * How `app` reads Home Assistant core and starts a clean. Implemented by `src/adapters/hass/` (Epic 4), which parses
 * everything it reads from `hass` and the registries at its boundary.
 *
 * Safety rules every implementation keeps:
 * - no `access_token`, picture URL, `unique_id` or whole state object crosses this port;
 * - map ids and segment ids are sensitive: never logged, never put in a reason;
 * - integration strings are within ADR 0002 « Parsing limits » item 3 (255 UTF-16 code units) and never cut, except
 *   the `options.vacuum` lists: within the collection caps of ADR 0002 « Parsing limits » item 3 they are passed whole,
 *   because the domain readers of #46 own the string caps; over a cap the adapter copies nothing and reports `malformed`
 *   (sizes are counted before anything is copied); registry
 *   floor and area names and aliases are kept whole, while floor and area ids are within the cap everywhere (an entry
 *   with an over-cap id is skipped, an over-cap reference reads as none), so the same id matches in every source;
 * - no admin-only command is used (ADR 0005 « Permissions »).
 *
 * Reads keep their identity while their source does, so `app` can tell by reference that nothing changed: `floors`
 * and `vacuumOptions` until `subscribe` notifies, `areas` while `hass.areas` keeps its identity (the frontend keeps it
 * when nothing changed, `docs/research/ha-core-registries.md` « Update signal »).
 */
export interface HassPort {
  /**
   * Floors in `config/floor_registry/list` array order, never `hass.floors` order (ADR 0005 « Floors »); `undefined`
   * until the list is read, then `subscribe` notifies (an empty list means a home without floors).
   */
  floors(): readonly Floor[] | undefined;
  /**
   * Whether a list the floor model waits for (the floor list or the entity registry list) could not be read: it has no
   * value yet and its latest fetch failed (a websocket error, a refusal, or an answer that is not the documented shape).
   * `false` while a fetch is still pending, and again once a later fetch succeeds (after a reconnection or an update
   * event; there is no retry timer), then `subscribe` notifies. No error text crosses the port. The repair issue list is
   * not counted: until it is read, `segmentsChangedOpen` keeps its safe side and the card does not wait for it.
   */
  fetchFailed(): boolean;
  /** Areas keyed by area id, from own keys of `hass.areas` only (`Object.hasOwn`, never `in`). */
  areas(): ReadonlyMap<string, Area>;
  /** The vacuum's state from `hass.states`, or `undefined` when it has none (missing or disabled entity). */
  vacuum(entityId: string): VacuumState | undefined;
  /** Whether `hass.services` has the service, read through own keys only. */
  hasService(domain: string, service: string): boolean;
  /**
   * `options.vacuum` of the vacuum's entry in `config/entity_registry/list` (or `get`), the raw input of #46
   * (ADR 0003 « Permissions »: readable by every user).
   */
  vacuumOptions(entityId: string): VacuumOptions | Unsupported<VacuumOptionsFailure>;
  /**
   * Whether core's repair issue `segments_changed` is open for the vacuum: an issue of `repairs/list_issues` with
   * domain `vacuum` and `issue_id` `segments_changed_<vacuum registry entry id>` (its `translation_placeholders`
   * carry the entity id; there is no `data` field). `true` until both the entity registry list and the issue list are
   * read, while an update of the issue list has not been fetched successfully, and for a vacuum without a registry
   * entry: the safe side of ADR 0003 path 1 condition 6 (`docs/research/ha-core-vacuum.md` « When the integration
   * reports different segments »).
   */
  segmentsChangedOpen(entityId: string): boolean;
  /**
   * Whether the signed-in user is an administrator (`hass.user.is_admin`). It only decides whether a link to the
   * entity settings is shown (ADR 0003 « Permissions », ADR 0005 « Plan pictures » item 5); it never unlocks a call.
   */
  isAdmin(): boolean;
  /**
   * Sends the call with `notifyOnError = false` and `returnResponse = false` (ADR 0003 « Errors »). Resolves to the
   * outcome and never rejects: `hass.callService` rethrows on error, and the adapter turns that into a `ServiceError`.
   */
  callService(call: ServiceCall): Promise<ServiceResult>;
  /**
   * Calls `listener` when data the card fetched outside `hass` changes: the floor list, the entity registry list (vacuum
   * options, and the disabled floor plans and floor plan areas that room sources read) and the repair issues.
   * `hass` updates reach the card as new `hass` objects instead. Returns the function that unsubscribes.
   */
  subscribe(listener: () => void): () => void;
}
