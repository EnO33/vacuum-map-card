import { html, nothing, svg, type TemplateResult } from "lit";
import type { PlanNavigation } from "../domain/plan/plan-navigation";
import type { DrawableRoom } from "../domain/plan/rooms-plan";

/** What the layer shows beyond the plan: the room that takes Tab, the selected room, the layer's accessible name. */
export interface RoomLayerState {
  readonly navigation: PlanNavigation;
  readonly tabStop: string | undefined;
  readonly selected: string | undefined;
  readonly name: string;
}

/** The layer's listeners: stable functions, so a re-render never rebinds them. */
export interface RoomLayerListeners {
  readonly focusin: (event: FocusEvent) => void;
  readonly keydown: (event: KeyboardEvent) => void;
  readonly keyup: (event: KeyboardEvent) => void;
  readonly click: (event: MouseEvent) => void;
}

function percent(value: number, of: number): string {
  return `${(value / of) * 100}%`;
}

/**
 * The plan's rooms over its picture, in reading order, so a screen reader meets them as the eye does. Each room is a
 * button named after it, with one tab stop for the plan (roving `tabindex`). Only the tab stop can hold the focus, so
 * only it carries the focus ring, drawn under its own stroke. Labels are hidden from assistive tech, which already has
 * each room's name. Lit reuses each room's elements and writes only what changed. Names are text nodes and attribute
 * values, never markup.
 */
export function roomLayer(state: RoomLayerState, on: RoomLayerListeners): TemplateResult {
  const { navigation, tabStop, selected, name } = state;
  const { rooms, size } = navigation;
  const { width, height } = size;
  const labelled = rooms.filter(({ shape }) => shape.anchor.distance > 0);
  return html`<svg
      class="rooms"
      viewBox="0 0 ${width} ${height}"
      role="group"
      aria-label=${name}
      @focusin=${on.focusin}
      @keydown=${on.keydown}
      @keyup=${on.keyup}
      @click=${on.click}
    >
      ${rooms.map((room, index) => roomControl(room, index, room.regionId === tabStop, room.regionId === selected))}
    </svg>
    <svg class="labels" aria-hidden="true">
      ${labelled.map(
        ({ name: label, shape: { anchor } }) =>
          svg`<text x=${percent(anchor.point.x, width)} y=${percent(anchor.point.y, height)}>${label}</text>`,
      )}
    </svg>`;
}

function roomControl(room: DrawableRoom, index: number, tabStop: boolean, selected: boolean): TemplateResult {
  const { name, shape } = room;
  return svg`<g
    class=${selected ? "room selected" : "room"}
    role="button"
    tabindex=${tabStop ? 0 : -1}
    aria-label=${name}
    data-index=${index}
  >
    ${tabStop ? focusRing(shape.path) : nothing}
    <path class="shape" d=${shape.path}></path>
  </g>`;
}

function focusRing(path: string): TemplateResult {
  return svg`<path class="ring ring-outer" d=${path}></path>
    <path class="ring ring-focus" d=${path}></path>
    <path class="ring ring-halo" d=${path}></path>`;
}

/** The index in reading order of the room an event's target is, or `undefined` for anything else. */
export function roomIndexOf(target: EventTarget | null): number | undefined {
  if (!(target instanceof SVGElement) || !target.classList.contains("room")) return undefined;
  const index = Number(target.getAttribute("data-index") ?? Number.NaN);
  return Number.isInteger(index) ? index : undefined;
}

/** The drawn room at an index in reading order. */
export function roomElementAt(root: ParentNode, index: number): SVGElement | undefined {
  const found = root.querySelector(`.rooms > .room[data-index="${index}"]`);
  return found instanceof SVGElement ? found : undefined;
}
