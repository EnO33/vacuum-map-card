import { css, html, LitElement, nothing, type PropertyValues, type TemplateResult } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import type { ItemRef } from "../app/robots-for-item/robots-for-item";
import { type PictureSize, type PlanNavigation, planNavigation, roomAtTap } from "../domain/plan/plan-navigation";
import type { RoomsPlan } from "../domain/plan/rooms-plan";
import type { Locale } from "../i18n/catalogs";
import { localize } from "../i18n/localize";
import { picturePoint, roomKeyAction, selectsOnKeyUp, TAP_TARGET_HALF_PX } from "./room-input";
import { type RoomLayerListeners, roomElementAt, roomIndexOf, roomLayer } from "./room-layer";
import { roomLayerStyles } from "./room-layer.styles";

/** Custom element name of one plan's picture. */
export const PLAN_PICTURE_ELEMENT = "vmc-plan-picture";

/**
 * Fired by a plan picture when a room is chosen with Enter, Space or a tap; `detail` is the room's `ItemRef`. It
 * bubbles inside the card's shadow tree and never leaves the card (`composed: false`).
 */
export const ROOM_SELECTED_EVENT = "room-selected";

/** The one way to build {@link ROOM_SELECTED_EVENT}, for a drawn room and for a listed area alike. */
export function roomSelectedEvent(detail: ItemRef): CustomEvent<ItemRef> {
  return new CustomEvent(ROOM_SELECTED_EVENT, { detail, bubbles: true, composed: false });
}

/** A readable state shown in place of a plan picture: the card's and the picture element's. */
export const planMessageStyles = css`
  .plan-message {
    box-sizing: border-box;
    margin: 0;
    padding: var(--ha-space-6, 24px) var(--ha-space-4, 16px);
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    border-radius: var(--ha-border-radius-md, 8px);
    color: var(--secondary-text-color, #5e5e5e);
    text-align: center;
  }
`;

export function planMessage(text: string): TemplateResult {
  return html`<p class="plan-message">${text}</p>`;
}

/**
 * One plan's picture: an `<img>` sized from the loaded picture's `naturalWidth` and `naturalHeight` (ADR 0005 « Plan
 * pictures » item 4), or a readable message when it fails to load. A new `src` (the image state changed, item 2) tries
 * again. The URL is only ever the `src`: never text, `title`, `aria-*` or a log (item 1). A rooms map's `rooms` are
 * drawn over its own picture once that size is known (ADR 0005 « Rooms map pairing » item 3), each one a control
 * reached with Tab and the arrow keys and chosen with Enter, Space or a tap (ADR 0004 « Accessibility »).
 */
export class PlanPicture extends LitElement {
  static override styles = [
    planMessageStyles,
    roomLayerStyles,
    css`
      :host {
        display: block;
      }
      /* The frame is as wide as the picture, so the room layer sits exactly over it. */
      .frame {
        position: relative;
        width: fit-content;
        max-width: 100%;
        border-radius: var(--ha-border-radius-md, 8px);
        overflow: hidden;
      }
      /* Never wider than the picture itself: an upscaled plan blurs and outgrows the screen on a wide card. */
      img {
        display: block;
        width: auto;
        max-width: 100%;
        height: auto;
      }
    `,
  ];

  static override properties = {
    src: { attribute: false },
    alt: { attribute: false },
    locale: { attribute: false },
    rooms: { attribute: false },
    imageEntityId: { attribute: false },
    label: { attribute: false },
    selected: { attribute: false },
  };

  declare src: string;
  declare alt: string;
  declare locale: Locale;
  /** The rooms map's plan, drawn over its own picture; `undefined` for a picture without outlines. */
  declare rooms: RoomsPlan | undefined;
  /** The plan's image entity, for the `ItemRef` of a chosen room. */
  declare imageEntityId: string;
  /** The plan's name (its floor, or its map and robot), so each plan's rooms group has its own name. */
  declare label: string;
  /** The region id of the room drawn as selected, if any. */
  declare selected: string | undefined;

  /** The loaded picture's natural size. */
  #size: PictureSize | undefined;
  #failed = false;
  #navigation: PlanNavigation | undefined;
  /** The room that takes Tab: the last one focused, while it is still drawn. */
  #tabStop: string | undefined;

  constructor() {
    super();
    this.src = "";
    this.alt = "";
    this.locale = "en";
    this.imageEntityId = "";
    this.label = "";
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has("src")) this.#failed = false;
    // A new plan with a new picture (another map): its outlines wait for that picture, never sit over the previous one.
    // A new `src` alone is the same picture with a rotated token, so its outlines stay.
    if (changed.has("src") && changed.has("rooms")) this.#size = undefined;
  }

  readonly #onLoad = (event: Event): void => {
    const image = event.currentTarget;
    if (!(image instanceof HTMLImageElement) || image.naturalWidth <= 0 || image.naturalHeight <= 0) return;
    const { naturalWidth: width, naturalHeight: height } = image;
    // The token rotates every 5 minutes and reloads the picture, usually at the same size.
    if (width === this.#size?.width && height === this.#size.height) return;
    this.#size = { width, height };
    this.requestUpdate();
  };

  readonly #onError = (): void => {
    this.#failed = true;
    this.requestUpdate();
  };

  protected override render(): TemplateResult {
    if (this.#failed) return planMessage(localize(this.locale, "plan.load_failed"));
    const size = this.#size;
    return html`<div class="frame">
      <img
        src=${this.src}
        alt=${this.alt}
        style=${styleMap({ aspectRatio: size && `${size.width} / ${size.height}` })}
        @load=${this.#onLoad}
        @error=${this.#onError}
      />
      ${this.#layer()}
    </div>`;
  }

  #layer(): TemplateResult | typeof nothing {
    const navigation = this.#currentNavigation();
    if (!navigation) return nothing;
    const { rooms } = navigation;
    const tabStop = rooms.some((room) => room.regionId === this.#tabStop) ? this.#tabStop : rooms[0]?.regionId;
    const name = localize(this.locale, "plan.rooms", { name: this.label });
    return roomLayer({ navigation, tabStop, selected: this.selected, name }, this.#listeners);
  }

  /** The reading order and anchors, worked out again only for a new plan or picture size. */
  #currentNavigation(): PlanNavigation | undefined {
    const plan = this.rooms;
    const size = this.#size;
    if (!plan || !size) return undefined;
    if (this.#navigation?.plan !== plan || this.#navigation.size !== size) {
      this.#navigation = planNavigation(plan, size);
    }
    return this.#navigation;
  }

  /** The region id of the drawn room an event comes from. */
  #roomOf(target: EventTarget | null): string | undefined {
    const index = roomIndexOf(target);
    return index === undefined ? undefined : this.#navigation?.rooms[index]?.regionId;
  }

  readonly #listeners: RoomLayerListeners = {
    focusin: (event) => {
      const regionId = this.#roomOf(event.target);
      if (regionId === undefined || regionId === this.#tabStop) return;
      this.#tabStop = regionId;
      this.requestUpdate();
    },
    // The room acted on is the one the key comes from: the one a screen reader announced.
    keydown: (event) => {
      const navigation = this.#navigation;
      const from = this.#roomOf(event.target);
      if (!navigation || from === undefined) return;
      const action = roomKeyAction(event, from, navigation);
      if (!action) return;
      event.preventDefault();
      if (action.kind === "select") this.#select(from);
      else if (action.kind === "move") this.#focusRoom(action.id);
    },
    keyup: (event) => {
      const from = this.#roomOf(event.target);
      if (from !== undefined && selectsOnKeyUp(event)) this.#select(from);
    },
    click: (event) => {
      // A screen reader activates a button with a click that has no pointer (`detail` 0) and no useful position.
      const clicked = event.detail === 0 ? this.#roomOf(event.target) : undefined;
      const regionId = clicked ?? this.#tappedRoom(event);
      if (regionId === undefined) return;
      this.#focusRoom(regionId);
      this.#select(regionId);
    },
  };

  #tappedRoom(event: MouseEvent): string | undefined {
    const layer = event.currentTarget;
    const navigation = this.#navigation;
    if (!(layer instanceof Element) || !navigation) return undefined;
    const at = picturePoint(layer.getBoundingClientRect(), navigation.size, { x: event.clientX, y: event.clientY });
    return at && roomAtTap(navigation, at.point, TAP_TARGET_HALF_PX * at.scale);
  }

  /** Focuses a drawn room; the layer's `focusin` listener makes it the tab stop. */
  #focusRoom(regionId: string): void {
    const index = this.#navigation?.rooms.findIndex((room) => room.regionId === regionId) ?? -1;
    roomElementAt(this.renderRoot, index)?.focus();
  }

  #select(regionId: string): void {
    this.dispatchEvent(roomSelectedEvent({ kind: "room", imageEntityId: this.imageEntityId, regionId }));
  }
}
