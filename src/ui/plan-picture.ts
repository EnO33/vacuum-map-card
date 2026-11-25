import { css, html, LitElement, nothing, type PropertyValues, type TemplateResult } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import type { RoomsPlan } from "../domain/plan/rooms-plan";
import type { Locale } from "../i18n/catalogs";
import { localize } from "../i18n/localize";
import { type PictureSize, roomLayer, roomLayerStyles } from "./room-layer";

/** Custom element name of one plan's picture. */
export const PLAN_PICTURE_ELEMENT = "vmc-plan-picture";

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
 * drawn over its own picture once that size is known (ADR 0005 « Rooms map pairing » item 3).
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
  };

  declare src: string;
  declare alt: string;
  declare locale: Locale;
  /** The rooms map's plan, drawn over its own picture; `undefined` for a picture without outlines. */
  declare rooms: RoomsPlan | undefined;

  /** The loaded picture's natural size. */
  #size: PictureSize | undefined;
  #failed = false;

  constructor() {
    super();
    this.src = "";
    this.alt = "";
    this.locale = "en";
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
      ${this.rooms && size ? roomLayer(this.rooms, size) : nothing}
    </div>`;
  }
}
