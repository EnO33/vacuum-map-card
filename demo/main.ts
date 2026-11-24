// The demo page: the card as built from `src/`, on the fake `hass` of the fixture home, with the theme, the card width
// and the answer to an action chosen on the page and kept in the address.
import "../src/index";
import { VacuumMapCard } from "../src/ui/vacuum-map-card";
import { DemoHass } from "./demo-hass";
import { defineHaCard } from "./ha-card";
import { type DemoSettings, searchOf, settingsOf } from "./settings";

const NAMES = ["theme", "width", "outcome"] as const;

defineHaCard();
const hass = new DemoHass();
const form = document.querySelector("form");
const card = document.querySelector("vacuum-map-card");
const calls = document.querySelector(".calls ol");
const noCall = document.querySelector(".calls-empty");

/** The query string of the radio buttons checked in the form. */
function formSearch(settings: HTMLFormElement): string {
  const query = new URLSearchParams();
  for (const name of NAMES) {
    const checked = settings.querySelector(`input[name="${name}"]:checked`);
    if (checked instanceof HTMLInputElement) query.set(name, checked.value);
  }
  return `?${query}`;
}

function apply(settings: DemoSettings, form: HTMLFormElement): void {
  document.documentElement.setAttribute("data-theme", settings.theme);
  document.documentElement.setAttribute("data-width", settings.width);
  hass.outcome = settings.outcome;
  for (const input of form.querySelectorAll("input")) {
    input.checked = NAMES.some((name) => input.name === name && settings[name] === input.value);
  }
  history.replaceState(null, "", searchOf(settings));
}

/** Lists an action the card sent, as text only. */
function showCall([domain, service, data, target]: Parameters<DemoHass["callService"]>): void {
  const item = document.createElement("li");
  item.textContent = `${domain}.${service} ${JSON.stringify(data ?? {})} ${JSON.stringify(target ?? {})} -> ${hass.outcome}`;
  calls?.append(item);
  noCall?.remove();
}

if (form === null || !(card instanceof VacuumMapCard)) throw new Error("demo page markup is incomplete");
const settingsForm = form;
apply(settingsOf(location.search), settingsForm);
settingsForm.addEventListener("change", () => apply(settingsOf(formSearch(settingsForm)), settingsForm));
hass.onCall = showCall;
card.setConfig({ type: "custom:vacuum-map-card" });
card.hass = hass;
