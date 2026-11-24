// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { expectNoConsoleOutput } from "../../test/helpers/no-console";
import { shadowOf } from "../../test/helpers/shadow";
import { PLAN_PICTURE_ELEMENT, PlanPicture } from "./plan-picture";
import { defineOnce } from "./register";

const URL_ONE = "https://ha.example.invalid/api/image_proxy/image.a?token=1&state=s";
const URL_TWO = "https://ha.example.invalid/api/image_proxy/image.a?token=2&state=s";

expectNoConsoleOutput();

beforeAll(() => {
  defineOnce(customElements, PLAN_PICTURE_ELEMENT, PlanPicture);
});

afterEach(() => {
  document.body.replaceChildren();
});

async function picture(src: string, locale: "en" | "fr" = "en"): Promise<PlanPicture> {
  const element = document.createElement(PLAN_PICTURE_ELEMENT);
  if (!(element instanceof PlanPicture)) throw new Error("not a PlanPicture");
  Object.assign(element, { src, alt: "Floor plan, Ground floor", locale });
  document.body.append(element);
  await element.updateComplete;
  return element;
}

function img(element: PlanPicture): HTMLImageElement {
  const found = shadowOf(element).querySelector("img");
  if (!(found instanceof HTMLImageElement)) throw new Error("no img");
  return found;
}

function loaded(image: HTMLImageElement, width: number, height: number): void {
  Object.defineProperty(image, "naturalWidth", { value: width, configurable: true });
  Object.defineProperty(image, "naturalHeight", { value: height, configurable: true });
  image.dispatchEvent(new Event("load"));
}

describe("PlanPicture", () => {
  it("shows the picture with its src and alt, and no size before it loads", async () => {
    const element = await picture(URL_ONE);
    expect(img(element).getAttribute("src")).toBe(URL_ONE);
    expect(img(element).alt).toBe("Floor plan, Ground floor");
    expect(img(element).style.aspectRatio).toBe("");
  });

  it("is never drawn wider than the picture itself", () => {
    const rules = PlanPicture.elementStyles.map((style) => ("cssText" in style ? style.cssText : "")).join("\n");
    expect(rules).toMatch(/img\s*\{[^}]*width:\s*auto;[^}]*max-width:\s*100%/);
  });

  it("takes its aspect ratio from the loaded picture's natural size", async () => {
    const element = await picture(URL_ONE);
    loaded(img(element), 1024, 768);
    await element.updateComplete;
    expect(img(element).style.aspectRatio).toBe("1024 / 768");
  });

  it("re-renders on a reload only when the picture's size changed", async () => {
    const element = await picture(URL_ONE);
    loaded(img(element), 600, 600);
    await element.updateComplete;
    loaded(img(element), 600, 600);
    expect(element.isUpdatePending).toBe(false);
    loaded(img(element), 800, 600);
    expect(element.isUpdatePending).toBe(true);
    await element.updateComplete;
    expect(img(element).style.aspectRatio).toBe("800 / 600");
  });

  it("ignores a load that reports no size", async () => {
    const element = await picture(URL_ONE);
    loaded(img(element), 0, 0);
    await element.updateComplete;
    expect(img(element).style.aspectRatio).toBe("");
  });

  it("says the picture could not be loaded when it fails, in the user's language", async () => {
    const element = await picture(URL_ONE, "fr");
    img(element).dispatchEvent(new Event("error"));
    await element.updateComplete;
    expect(shadowOf(element).querySelector("img")).toBeNull();
    expect(shadowOf(element).textContent?.trim()).toBe(
      "L'image du plan n'a pas pu être chargée. La carte réessaiera quand le plan changera.",
    );
  });

  it("tries again with a new src after a failure", async () => {
    const element = await picture(URL_ONE);
    img(element).dispatchEvent(new Event("error"));
    await element.updateComplete;
    element.src = URL_TWO;
    await element.updateComplete;
    expect(img(element).getAttribute("src")).toBe(URL_TWO);
  });

  it("never puts the URL in its text or another attribute", async () => {
    const element = await picture(URL_ONE);
    img(element).dispatchEvent(new Event("error"));
    await element.updateComplete;
    expect(shadowOf(element).innerHTML).not.toContain("token");
    expect([...element.attributes].map((a) => a.value).join(" ")).not.toContain("token");
  });
});
