// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { expectNoConsoleOutput } from "../../test/helpers/no-console";
import { img, loaded, mountPicture } from "../../test/helpers/plan-picture";
import { planOf, snapshotFixtures, snapshotOf, squareRoom } from "../../test/helpers/rooms-snapshot";
import { shadowOf, stylesText } from "../../test/helpers/shadow";
import { drawableRooms, type RoomsPlan } from "../domain/plan/rooms-plan";
import { PLAN_PICTURE_ELEMENT, PlanPicture } from "./plan-picture";
import { defineOnce } from "./register";

const URL = "https://ha.example.invalid/api/image_proxy/image.a?token=1&state=s";
const base = snapshotOf(snapshotFixtures.vacuumAligned);

expectNoConsoleOutput();

beforeAll(() => {
  defineOnce(customElements, PLAN_PICTURE_ELEMENT, PlanPicture);
});

afterEach(() => {
  document.body.replaceChildren();
});

function picture(rooms: RoomsPlan | undefined): Promise<PlanPicture> {
  return mountPicture({ src: URL, alt: "Floor plan, Ground floor", locale: "en", rooms });
}

async function load(element: PlanPicture, width: number, height: number): Promise<void> {
  loaded(img(element), width, height);
  await element.updateComplete;
}

function layer(element: PlanPicture, name: "rooms" | "labels" = "rooms"): SVGSVGElement {
  const found = shadowOf(element).querySelector(`svg.${name}`);
  if (!(found instanceof SVGSVGElement)) throw new Error(`no ${name} svg`);
  return found;
}

function labels(element: PlanPicture): string[] {
  return [...layer(element, "labels").querySelectorAll("text")].map((t) => t.textContent ?? "");
}

/** A plan whose rooms map counts how often its rooms are read, to tell a rebuilt layer from a kept one. */
function countingPlan(plan: RoomsPlan): { readonly plan: RoomsPlan; readonly reads: () => number } {
  let reads = 0;
  const rooms = new Map(plan.rooms);
  const values = rooms.values.bind(rooms);
  rooms.values = () => {
    reads += 1;
    return values();
  };
  return { plan: { ...plan, rooms }, reads: () => reads };
}

describe("PlanPicture room layer", () => {
  it("draws nothing before the picture's size is known", async () => {
    const element = await picture(planOf(base));
    expect(shadowOf(element).querySelector("svg")).toBeNull();
  });

  it("sizes its viewBox from the picture's natural size", async () => {
    const element = await picture(planOf(base));
    await load(element, 600, 400);
    expect(layer(element).getAttribute("viewBox")).toBe("0 0 600 400");
  });

  it("draws no layer for a plan without rooms", async () => {
    const element = await picture(undefined);
    await load(element, 600, 600);
    expect(shadowOf(element).querySelector("svg")).toBeNull();
  });

  it("draws and names each drawable room at its anchor, and no shape for an undrawable room", async () => {
    const plan = planOf(snapshotOf(snapshotFixtures.withoutOutline));
    const element = await picture(plan);
    await load(element, 600, 400);
    const drawable = drawableRooms(plan);
    expect(drawable.length).toBeLessThan(plan.rooms.size);
    expect([...layer(element).querySelectorAll("path")].map((p) => p.getAttribute("d"))).toEqual(
      drawable.map((room) => room.shape.path),
    );
    const texts = [...layer(element, "labels").querySelectorAll("text")].map((t) => ({
      name: t.textContent,
      x: t.getAttribute("x"),
      y: t.getAttribute("y"),
    }));
    expect(texts).toEqual(
      drawable.map(({ name, shape }) => ({
        name,
        x: `${(shape.anchor.point.x / 600) * 100}%`,
        y: `${(shape.anchor.point.y / 400) * 100}%`,
      })),
    );
  });

  it("renders a name as text, never as markup", async () => {
    const element = await picture(planOf({ ...base, rooms: [{ ...squareRoom("1"), name: "<b>Hall</b>" }] }));
    await load(element, 600, 600);
    expect(labels(element)).toEqual(["<b>Hall</b>"]);
    expect(layer(element, "labels").querySelector("b")).toBeNull();
  });

  it("draws a room with no inside point for its label, without a label", async () => {
    const plan = planOf({ ...base, rooms: [squareRoom("1")] });
    const [room] = drawableRooms(plan);
    if (!room) throw new Error("not drawable");
    const shape = { ...room.shape, anchor: { point: { x: 0, y: 0 }, distance: 0 } };
    const element = await picture({ ...plan, rooms: new Map([["1", { ...room, shape }]]) });
    await load(element, 600, 600);
    expect(layer(element).querySelectorAll("path")).toHaveLength(1);
    expect(labels(element)).toEqual([]);
  });

  it("draws labels unscaled, sized by the theme within bounds that follow the card's width", async () => {
    const element = await picture(planOf(base));
    await load(element, 600, 600);
    expect(layer(element, "labels").hasAttribute("viewBox")).toBe(false);
    const rules = stylesText(PlanPicture);
    expect(rules).toMatch(/:host\s*\{[^}]*container-type:\s*inline-size/);
    expect(rules).toMatch(
      /font-size:\s*clamp\(var\(--ha-font-size-s, 12px\),\s*[\d.]+cqi,\s*var\(--ha-font-size-l, 16px\)\)/,
    );
  });

  it("does not rebuild the layers when the plan is unchanged", async () => {
    const counting = countingPlan(planOf(base));
    const element = await picture(counting.plan);
    await load(element, 600, 600);
    const svg = layer(element);
    const reads = counting.reads();
    element.alt = "Floor plan, Upper floor";
    await element.updateComplete;
    expect(layer(element)).toBe(svg);
    expect(counting.reads()).toBe(reads);
  });

  it("draws no outlines of a new plan over the previous picture until the new one loads", async () => {
    const element = await picture(planOf(base));
    await load(element, 600, 600);
    Object.assign(element, { src: `${URL}&map=2`, rooms: planOf({ ...base, rooms: [squareRoom("1")] }) });
    await element.updateComplete;
    expect(shadowOf(element).querySelector("svg")).toBeNull();
    await load(element, 600, 600);
    expect(layer(element).querySelectorAll("path")).toHaveLength(1);
  });

  it("keeps drawing the same plan while its picture reloads with a new token", async () => {
    const element = await picture(planOf(base));
    await load(element, 600, 600);
    element.src = `${URL}&token=2`;
    await element.updateComplete;
    expect(shadowOf(element).querySelector("svg.rooms")).not.toBeNull();
  });

  it("keeps a room's elements when another room changes", async () => {
    const element = await picture(planOf({ ...base, rooms: [squareRoom("1"), squareRoom("2", 500)] }));
    await load(element, 600, 600);
    const first = layer(element).querySelector("path");
    element.rooms = planOf({ ...base, rooms: [squareRoom("1"), squareRoom("2", 800)] });
    await element.updateComplete;
    expect(layer(element).querySelector("path")).toBe(first);
  });

  it("draws resting rooms in neutral theme colours, leaving the accent to selection", () => {
    const rules = stylesText(PlanPicture);
    expect(rules).toMatch(/\.room\s*\{[^}]*fill:\s*none;[^}]*stroke:\s*var\(--divider-color,/);
    expect(rules).not.toMatch(/primary-color/);
  });
});
