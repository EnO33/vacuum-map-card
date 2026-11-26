import { css } from "lit";

/**
 * The rooms' two-tone ring (ADR 0004 « Amendment (2026-11-25) » item 1) for the card's HTML buttons, as declarations
 * for a `:focus-visible` rule: three 2 px bands, a card-coloured halo (the outline's offset over a shadow), the focus
 * colour, then a text-coloured line, so one band reaches 3:1 on any theme. The outline alone stays in forced colours,
 * where shadows are not drawn.
 */
export const twoToneRing = css`
  outline: 2px solid var(--ha-color-focus, var(--primary-color, #009ac7));
  outline-offset: 2px;
  box-shadow:
    0 0 0 2px var(--card-background-color, #fff),
    0 0 0 6px var(--primary-text-color, #212121);
`;
