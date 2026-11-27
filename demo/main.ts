// The demo page: the card as built from `src/`, on the fake `hass` of the fixture home, with the theme, the card width,
// the answer to an action, what the robots report and which plans are shown chosen on the page and kept in the address.
import "../src/index";
import { VacuumMapCard } from "../src/ui/vacuum-map-card";
import { DemoHass } from "./demo-hass";
import { defineHaCard } from "./ha-card";
import { cardConfigOf, type DemoSettings, type Plans, SETTING_NAMES, searchOf, settingsOf } from "./settings";

defineHaCard();
const hass = new DemoHass();
const form = document.querySelector("form");
const card = document.querySelector("vacuum-map-card");
const calls = document.querySelector(".calls ol");
const noCall = document.querySelector(".calls-empty");

/** The query string of the radio buttons checked in the form. */
function formSearch(settings: HTMLFormElement): string {
  const query = new URLSearchParams();
  for (const name of SETTING_NAMES) {
    const checked = settings.querySelector(`input[name="${name}"]:checked`);
    if (checked instanceof HTMLInputElement) query.set(name, checked.value);
  }
  return `?${query}`;
}

/** The plans setting the card was last configured with: only a change sets its configuration again. */
let configuredPlans: Plans | undefined;

function apply(settings: DemoSettings, form: HTMLFormElement, card: VacuumMapCard): void {
  document.documentElement.setAttribute("data-theme", settings.theme);
  if (settings.plans !== configuredPlans) {
    card.setConfig(cardConfigOf(settings.plans));
    configuredPlans = settings.plans;
  }
  document.documentElement.setAttribute("data-width", settings.width);
  hass.outcome = settings.outcome;
  hass.report(settings.report);
  for (const input of form.querySelectorAll("input")) {
    input.checked = SETTING_NAMES.some((name) => input.name === name && settings[name] === input.value);
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
apply(settingsOf(location.search), settingsForm, card);
settingsForm.addEventListener("change", () => {
  apply(settingsOf(formSearch(settingsForm)), settingsForm, card);
  // A new state, as Home Assistant pushes one: the card reads the robots again.
  card.hass = hass;
});
hass.onCall = showCall;
card.hass = hass;
