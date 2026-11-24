import type { PairedRooms } from "../../domain/eligibility/path-one";
import type { ShadowIndex } from "../../domain/eligibility/path-two";
import type { NoFloorReason } from "../../domain/floors/map-to-floor";
import type { RoomList } from "../../domain/plan/room-list";
import type { AreaLink } from "../../domain/plan/room-to-area";
import type { PlanRoom, RoomsPlan, RoomsPlanFailure } from "../../domain/plan/rooms-plan";
import type { ActionKind } from "../../domain/robot/action-kind";
import type { PictureState } from "../../domain/robot/stored-map";
import type { RoomsMapFailure } from "../ports/room-source";
import type { RobotOptions } from "./robot-options";

/** Why a plan sits in « no floor »: the floor link's fixes (#48), or the unpaired rooms map's note (#49). */
export type NoFloorNote = NoFloorReason | "cannot_tell_shown_map";

export type Placement =
  | { readonly kind: "floor"; readonly floorId: string }
  | { readonly kind: "no_floor"; readonly reasons: readonly NoFloorNote[] };

/** A room of a rooms map with its area link (#50). */
export interface RoomView {
  readonly room: PlanRoom;
  readonly area: AreaLink;
}

export type PlanContent =
  /** The rooms map's outlines, drawn only over its own picture (ADR 0005 « Rooms map pairing » item 3). */
  | {
      readonly kind: "outlines";
      readonly plan: RoomsPlan;
      readonly rooms: readonly RoomView[];
      /** The paired stored map's rooms, for path 1 (#49, #52); `undefined` when the rooms map is not paired. */
      readonly pairedRooms: PairedRooms | undefined;
      /** The plan's shadow index (#53), built once with the robot's `last_seen_segments`. */
      readonly shadows: ShadowIndex;
    }
  /** A stored map's room list or picture-only state (#50). */
  | RoomList;

/** One picture of one robot, where it is shown and what can be picked on it. */
export interface Plan {
  /** The robot's vacuum entity id. */
  readonly robot: string;
  readonly imageEntityId: string;
  /** `unavailable`, `unknown` and `disabled` pictures are kept with their state (ADR 0005 « Plan pictures »). */
  readonly pictureState: PictureState;
  readonly placement: Placement;
  readonly content: PlanContent;
}

/** Why a robot's rooms map adds no plan: absent, without outlines, or refused (with the reason code). */
export type RoomsMapIssue =
  | { readonly kind: "absent" }
  | { readonly kind: "no_outlines" }
  | { readonly kind: "unsupported"; readonly reason: RoomsMapFailure | RoomsPlanFailure };

/** A room of a robot's own outlines, with its area link and its plan's floor, for robots joining through areas (#54). */
export interface RobotRoom {
  readonly imageEntityId: string;
  readonly regionId: string;
  readonly name: string;
  readonly roomId: string;
  readonly area: AreaLink;
  /** `undefined` when its plan is in « no floor ». */
  readonly floorId: string | undefined;
}

/** Everything the card knows about one robot, including plans that no floor shows. */
export interface RobotModel {
  readonly vacuumEntityId: string;
  readonly action: ActionKind;
  readonly hasCleanArea: boolean;
  /** `false` when the vacuum has no state (disabled or not loaded): the UI says the robot is unavailable. */
  readonly hasState: boolean;
  /** The robot's core mapping and `last_seen_segments` (#46), as the model read them. */
  readonly options: RobotOptions;
  readonly plans: readonly Plan[];
  readonly rooms: readonly RobotRoom[];
  readonly roomsMapIssue: RoomsMapIssue | undefined;
}

export interface FloorView {
  readonly floorId: string;
  readonly name: string;
  /** The one plan shown on this floor; the others stay in `robots`. */
  readonly plan: Plan;
}

/** What the UI renders: floors in list order with one plan each, then every unplaced plan (ADR 0005 « Floors »). */
export interface FloorModel {
  /**
   * `true` while the floor list, a source's robots or a robot's vacuum options are not read yet: placements and reasons
   * (and « no robot ») are provisional,
   * so the UI shows a loading state rather than fixes the user does not need.
   */
  readonly loading: boolean;
  readonly floors: readonly FloorView[];
  readonly noFloor: readonly Plan[];
  readonly robots: readonly RobotModel[];
}
