import type { RoomsMapSnapshot } from "../../domain/plan/rooms-map-snapshot";
import type { ActionKind } from "../../domain/robot/action-kind";
import type { IntegrationErrorKind } from "../../domain/robot/integration-error";
import type { PictureState, StoredMap } from "../../domain/robot/stored-map";
import type { Unsupported } from "../../domain/unsupported";
import type { ServiceCall, ServiceError } from "./service-call";

/** The rooms map's attributes could not be read as the documented shape. */
export type RoomsMapFailure = "malformed_attributes";

/**
 * What the rooms map holds right now. The adapter reports `no_outlines` when the outline attributes are absent (no
 * cloud or no map loaded yet, never an error, `docs/research/roomba-plus.md` « No cloud, no map »); a snapshot with
 * an empty room list also gives `no_outlines` once `buildRoomsPlan` reads it.
 */
export type RoomsMapContent =
  | { readonly kind: "snapshot"; readonly snapshot: RoomsMapSnapshot }
  | { readonly kind: "no_outlines" }
  | Unsupported<RoomsMapFailure>;

/** The robot's rooms map: the one plan with outlines (ADR 0002 « What an adapter reports » item 1). */
export interface RoomsMap {
  readonly imageEntityId: string;
  readonly pictureState: PictureState;
  /**
   * The stored map the rooms map shows, only when the adapter can tell (ADR 0002 item 1; Roomba+ Classic: a robot
   * with one stored map, ADR 0005 « Rooms map pairing »), otherwise `undefined`. the domain's `pairRoomsMap` keeps ADR 0005's
   * other checks.
   */
  readonly shownMapId: string | undefined;
  readonly content: RoomsMapContent;
}

/**
 * One robot as its integration's adapter reports it. Its functions depend only on `storedMaps` and the integration's
 * fixed rules, so `app` can memoise on the data alone.
 */
export interface SourceRobot {
  /** Found by the registry entry's `platform` (ADR 0003 « Eligibility »). */
  readonly vacuumEntityId: string;
  /** What a start does, named in the confirmation (ADR 0003 « Confirmation »). */
  readonly action: ActionKind;
  /** Every floor plan registry entry of the robot, enabled or not (ADR 0005 « Plan pictures »). */
  readonly storedMaps: readonly StoredMap[];
  /** `undefined` when the robot has no rooms map entity. */
  readonly roomsMap: RoomsMap | undefined;
  /** The stored map a core segment id belongs to, in the integration's id format (ADR 0002 item 2), or `undefined`. */
  mapOfSegment(segmentId: string): string | undefined;
  /**
   * The core segment id of a room of a stored map (ADR 0002 item 2), or `undefined` when the integration cannot link
   * the room to a segment or the id would exceed the string cap (ADR 0002 item 3: never cut).
   */
  segmentOf(mapId: string, regionId: string): string | undefined;
  /** The integration's room action for path 2 (ADR 0003 « Path 2 »), or `undefined` when it has none. */
  roomAction(regionId: string): ServiceCall | undefined;
  /** Whether the room action resolves names before ids, so the shadow check of ADR 0003 « Path 2 » applies. */
  readonly roomActionMatchesNamesFirst: boolean;
  /**
   * The kind of a refusal raised by this integration before its start command, or `undefined` for any other error:
   * the card then reports it as unknown, possibly started (`mayHaveStartedAfter`, #55).
   */
  classifyError(error: ServiceError): IntegrationErrorKind | undefined;
}

/**
 * One vacuum integration's knowledge, implemented by `src/adapters/<integration>/` (Epic 4, `roomba-plus` first).
 * Integration specifics live only there (ADR 0002). The safety rules of `HassPort` apply: no `access_token`, picture
 * URL, `unique_id` or whole state object crosses this port; map ids and segment ids are never logged or put in a
 * reason; every integration string is within ADR 0002 « Parsing limits » item 3.
 */
export interface RoomSource {
  /** The integration's domain, matched against `ServiceError.translationDomain`. */
  readonly integration: string;
  /**
   * The robots, as the same objects while their sources are unchanged (the `hass.states` objects of their entities,
   * which Home Assistant replaces only when that entity changes, and the entity registry list, whose changes
   * `HassPort.subscribe` signals), so `app` can memoise by reference.
   */
  robots(): readonly SourceRobot[];
}
