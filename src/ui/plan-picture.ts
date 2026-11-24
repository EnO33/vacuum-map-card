import { css, html, LitElement, type PropertyValues, type TemplateResult } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import type { Locale } from "../i18n/catalogs";
import { localize } from "../i18n/localize";

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
 * again. The URL is only ever the `src`: never text, `title`, `aria-*` or a log (item 1).
 */
export class PlanPicture extends LitElement {
  static override styles = [
    planMessageStyles,
    css`
      :host {
        display: block;
      }
      /* Never wider than the picture itself: an upscaled plan blurs and outgrows the screen on a wide card. */
      img {
        display: block;
        width: auto;
        max-width: 100%;
        height: auto;
        border-radius: var(--ha-border-radius-md, 8px);
      }
    `,
  ];

  static override properties = {
    src: { attribute: false },
    alt: { attribute: false },
    locale: { attribute: false },
  };

  declare src: string;
  declare alt: string;
  declare locale: Locale;

  /** The loaded picture's width and height, as an `aspect-ratio` value. */
  #ratio: string | undefined;
  #failed = false;

  constructor() {
    super();
    this.src = "";
    this.alt = "";
    this.locale = "en";
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has("src")) this.#failed = false;
  }

  readonly #onLoad = (event: Event): void => {
    const image = event.currentTarget;
    if (!(image instanceof HTMLImageElement) || image.naturalWidth <= 0 || image.naturalHeight <= 0) return;
    const ratio = `${image.naturalWidth} / ${image.naturalHeight}`;
    // The token rotates every 5 minutes and reloads the picture, usually at the same size.
    if (ratio === this.#ratio) return;
    this.#ratio = ratio;
    this.requestUpdate();
  };

  readonly #onError = (): void => {
    this.#failed = true;
    this.requestUpdate();
  };

  protected override render(): TemplateResult {
    if (this.#failed) return planMessage(localize(this.locale, "plan.load_failed"));
    return html`<img
      src=${this.src}
      alt=${this.alt}
      style=${styleMap({ aspectRatio: this.#ratio })}
      @load=${this.#onLoad}
      @error=${this.#onError}
    />`;
  }
}
