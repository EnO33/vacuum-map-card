import { css } from "lit";

/**
 * Two layers over the picture. Outlines are in the picture's own pixels, so they scale with it; at rest they are a
 * thin neutral line with no fill, leaving the accent colour to hover, focus and the selected room (ADR 0004). Each
 * room is one control: hover and focus add a light accent fill and an accent stroke; the selected room keeps a
 * thicker accent stroke. Focus also shows a ring of three bands around the outline, drawn under the room's own stroke
 * so the selection stays visible: a card-coloured halo, `--ha-color-focus` and a `--primary-text-color` line, so one
 * band reaches 3:1 on a light theme, a dark one or a picture (owner decision 2026-11-25, ADR 0004 « Focus »). Strokes
 * are in screen pixels whatever the picture's scale. Transitions use the theme's durations, which Home Assistant
 * shortens under `prefers-reduced-motion`; the card's own media query covers a theme without them.
 *
 * Labels are not scaled: their size follows the theme's text sizes and the picture element's width (its host is the
 * size container), at least the theme's small text, so they stay readable on a phone or a tablet (ADR 0004 « Floors
 * plans first »). The halo, in the card's colour, keeps a name readable on any picture, light or dark.
 */
export const roomLayerStyles = css`
  :host {
    container-type: inline-size;
  }
  .rooms,
  .labels {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  .room {
    cursor: pointer;
    outline: none;
  }
  .room path {
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }
  .room .shape {
    fill: var(--primary-color, #009ac7);
    fill-opacity: 0;
    stroke: var(--divider-color, rgba(0, 0, 0, 0.12));
    stroke-width: 1.5px;
    transition:
      fill-opacity var(--ha-animation-duration-fast, 150ms) ease-out,
      stroke var(--ha-animation-duration-fast, 150ms) ease-out;
  }
  .room:focus-visible .shape {
    fill-opacity: 0.12;
    stroke: var(--primary-color, #009ac7);
    stroke-width: 2px;
  }
  /* Only where hover is real: on a touch screen it would stick to the tapped room. */
  @media (hover: hover) {
    .room:hover .shape {
      fill-opacity: 0.12;
      stroke: var(--primary-color, #009ac7);
      stroke-width: 2px;
    }
  }
  .room.selected .shape {
    stroke: var(--primary-color, #009ac7);
    stroke-width: 4px;
  }
  .room .ring {
    display: none;
    fill: none;
    pointer-events: none;
  }
  .room:focus-visible .ring {
    display: inline;
  }
  /* Centred strokes: each band shows 2 px outside the room's own stroke (2 px on focus, 4 px when selected). */
  .ring-outer {
    stroke: var(--primary-text-color, #212121);
    stroke-width: 14px;
  }
  .ring-focus {
    stroke: var(--ha-color-focus, var(--primary-color, #009ac7));
    stroke-width: 10px;
  }
  .ring-halo {
    stroke: var(--card-background-color, #fff);
    stroke-width: 6px;
  }
  .room.selected .ring-outer {
    stroke-width: 16px;
  }
  .room.selected .ring-focus {
    stroke-width: 12px;
  }
  .room.selected .ring-halo {
    stroke-width: 8px;
  }
  /* Contrast themes: system colours, which the theme's variables may not follow. */
  @media (forced-colors: active) {
    .room .shape {
      stroke: CanvasText;
    }
    .room.selected .shape {
      stroke: Highlight;
    }
    .ring-outer,
    .ring-focus {
      stroke: Highlight;
    }
    .ring-halo {
      stroke: Canvas;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .room .shape {
      transition: none;
    }
  }
  /* The rooms layer takes every tap, so a tap just outside a small room can still select it; labels take none. */
  .labels {
    pointer-events: none;
    font-family: var(--ha-font-family-body, inherit);
    font-size: clamp(var(--ha-font-size-s, 12px), 4cqi, var(--ha-font-size-l, 16px));
    font-weight: var(--ha-font-weight-medium, 500);
  }
  .labels text {
    fill: var(--primary-text-color, #212121);
    stroke: var(--card-background-color, #fff);
    stroke-width: 3px;
    stroke-linejoin: round;
    paint-order: stroke;
    text-anchor: middle;
    dominant-baseline: central;
  }
`;
