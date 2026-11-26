import { css } from "lit";
import { twoToneRing } from "./focus-ring.styles";

/**
 * The card's round icon buttons (robot details, closing the picker): Home Assistant's icon button look from theme
 * variables, a 44 px touch target (ADR 0004 « Touch targets ») around a 24 px icon. The button is named by its
 * `aria-label`; the icon is decoration.
 */
export const iconButtonStyles = css`
  .icon-button {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    margin: 0;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: none;
    color: var(--secondary-text-color, #5e5e5e);
    font: inherit;
    cursor: pointer;
  }
  @media (hover: hover) {
    .icon-button:hover {
      background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.08);
    }
  }
  .icon-button:focus-visible {
    ${twoToneRing}
  }
  .icon-button svg {
    width: 24px;
    height: 24px;
  }
`;
