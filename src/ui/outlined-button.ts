import { css } from "lit";
import { twoToneRing } from "./focus-ring.styles";

/**
 * The card's own buttons (room list, entity settings): Home Assistant's outlined look from theme variables, a 44 px
 * touch target (ADR 0004 « Touch targets »). `ha-button` is not used: it is not promised on a dashboard and defaults to
 * 40 px (`docs/research/ha-frontend.md` « Gaps for this card » items 1 and 7).
 */
export const outlinedButtonStyles = css`
  .outlined-button {
    box-sizing: border-box;
    min-width: 44px;
    min-height: 44px;
    padding: 0 var(--ha-space-4, 16px);
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    border-radius: var(--ha-border-radius-md, 8px);
    background: none;
    color: var(--primary-text-color, #141414);
    font: inherit;
    cursor: pointer;
  }
  .outlined-button:hover {
    border-color: var(--primary-color, #03a9f4);
  }
  .outlined-button:focus-visible {
    ${twoToneRing}
  }
`;
