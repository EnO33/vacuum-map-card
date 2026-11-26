// Test helpers for `src/ui/plan-picture.ts`: a mounted picture element and a fake load at a natural size.
import { PLAN_PICTURE_ELEMENT, PlanPicture } from "../../src/ui/plan-picture";
import { shadowOf } from "./shadow";

/** A plan picture with `props`, attached to the document and rendered. */
export async function mountPicture(
  props: Partial<
    Pick<
      PlanPicture,
      "src" | "alt" | "locale" | "rooms" | "imageEntityId" | "label" | "selected" | "progress" | "robotNames"
    >
  >,
): Promise<PlanPicture> {
  const element = document.createElement(PLAN_PICTURE_ELEMENT);
  if (!(element instanceof PlanPicture)) throw new Error("not a PlanPicture");
  Object.assign(element, props);
  document.body.append(element);
  await element.updateComplete;
  return element;
}

export function img(element: PlanPicture): HTMLImageElement {
  const found = shadowOf(element).querySelector("img");
  if (!(found instanceof HTMLImageElement)) throw new Error("no img");
  return found;
}

/** Fires `load` with a natural size: happy-dom loads no picture, so its `naturalWidth` and `naturalHeight` are 0. */
export function loaded(image: HTMLImageElement, width: number, height: number): void {
  Object.defineProperty(image, "naturalWidth", { value: width, configurable: true });
  Object.defineProperty(image, "naturalHeight", { value: height, configurable: true });
  image.dispatchEvent(new Event("load"));
}

/** One of the picture's two layers: the rooms (controls) or their labels. */
export function layer(element: PlanPicture, name: "rooms" | "labels" = "rooms"): SVGSVGElement {
  const found = shadowOf(element).querySelector(`svg.${name}`);
  if (!(found instanceof SVGSVGElement)) throw new Error(`no ${name} svg`);
  return found;
}
