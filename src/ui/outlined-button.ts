import { css } from "lit";

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
  /*
   * The rooms' two-tone ring (ADR 0004 « Amendment (2026-11-25) » item 1), three 2 px bands: a card-coloured halo (the
   * outline's offset over a shadow), the focus colour, then a text-coloured line, so one band reaches 3:1 on any theme.
   * The outline alone stays in forced colours, where shadows are not drawn.
   */
  .outlined-button:focus-visible {
    outline: 2px solid var(--ha-color-focus, var(--primary-color, #009ac7));
    outline-offset: 2px;
    box-shadow:
      0 0 0 2px var(--card-background-color, #fff),
      0 0 0 6px var(--primary-text-color, #212121);
  }
`;
