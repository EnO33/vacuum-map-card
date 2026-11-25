import { css, html, svg, type TemplateResult } from "lit";
import { guard } from "lit/directives/guard.js";
import { drawableRooms, type RoomsPlan } from "../domain/plan/rooms-plan";

/** A loaded picture's natural size, in pixels: the outlines' coordinate space. */
export interface PictureSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Two layers over the picture. Outlines are in the picture's own pixels, so they scale with it; at rest they are a
 * thin neutral line with no fill, leaving the accent colour to the selected room (ADR 0004). Labels are not scaled:
 * their size follows the theme's text sizes and the picture element's width (its host is the size container), at
 * least the theme's small text, so they stay readable on a phone or a tablet (ADR 0004 « Floors plans first »). The
 * halo, in the card's colour, keeps a name readable on any picture, light or dark.
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
    pointer-events: none;
  }
  .room {
    fill: none;
    stroke: var(--divider-color, rgba(0, 0, 0, 0.12));
    stroke-width: 1.5px;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }
  .labels {
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

function percent(value: number, of: number): string {
  return `${(value / of) * 100}%`;
}

/**
 * The plan's rooms over its picture. Rebuilt only when the plan object or the picture size changes (the floor model
 * keeps the same plan object for an unchanged rooms map); otherwise Lit reuses each room's elements and writes only
 * what changed. Names are text nodes.
 */
export function roomLayer(plan: RoomsPlan, size: PictureSize): TemplateResult {
  const { width, height } = size;
  return html`${guard([plan, width, height], () => {
    const rooms = drawableRooms(plan);
    const labelled = rooms.filter(({ shape }) => shape.anchor.distance > 0);
    return html`<svg class="rooms" viewBox="0 0 ${width} ${height}">
        ${rooms.map(({ shape }) => svg`<path class="room" d=${shape.path}></path>`)}
      </svg>
      <svg class="labels">
        ${labelled.map(
          ({ name, shape: { anchor } }) =>
            svg`<text x=${percent(anchor.point.x, width)} y=${percent(anchor.point.y, height)}>${name}</text>`,
        )}
      </svg>`;
  })}`;
}
