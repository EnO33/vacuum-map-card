// The demo page's settings, kept in the address so a screenshot can be reproduced from its URL.
import type { CardConfig } from "../src/app/config/card-config";
import { DEMO_FLOOR_IDS, isOutcome, isReport, type Outcome, type Report } from "./demo-hass";

export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

/** Card widths: a phone (about 400 px), a tablet (about 800 px), or the whole window. */
export const WIDTHS = ["phone", "tablet", "wide"] as const;
export type Width = (typeof WIDTHS)[number];

/** Which plans the card shows: all of them, or only those on a floor (the card's `floors` option). */
export const PLANS = ["all", "floors"] as const;
export type Plans = (typeof PLANS)[number];

export const SETTING_NAMES = [
  "theme",
  "width",
  "outcome",
  "report",
  "plans",
] as const satisfies readonly (keyof DemoSettings)[];

export interface DemoSettings {
  readonly theme: Theme;
  readonly width: Width;
  readonly outcome: Outcome;
  readonly report: Report;
  readonly plans: Plans;
}

export const DEFAULT_SETTINGS: DemoSettings = Object.freeze({
  theme: "light",
  width: "tablet",
  outcome: "accepted",
  report: "captured",
  plans: "all",
});

function oneOf<T extends string>(values: readonly T[], value: string | null): T | undefined {
  return values.find((known) => known === value);
}

/** The settings of a query string; a missing or unknown value takes its default. */
export function settingsOf(search: string): DemoSettings {
  const query = new URLSearchParams(search);
  const outcome = query.get("outcome") ?? "";
  const report = query.get("report") ?? "";
  return {
    theme: oneOf(THEMES, query.get("theme")) ?? DEFAULT_SETTINGS.theme,
    width: oneOf(WIDTHS, query.get("width")) ?? DEFAULT_SETTINGS.width,
    outcome: isOutcome(outcome) ? outcome : DEFAULT_SETTINGS.outcome,
    report: isReport(report) ? report : DEFAULT_SETTINGS.report,
    plans: oneOf(PLANS, query.get("plans")) ?? DEFAULT_SETTINGS.plans,
  };
}

/** The query string of the settings, in a fixed order. */
export function searchOf(settings: DemoSettings): string {
  return `?${new URLSearchParams(SETTING_NAMES.map((name) => [name, settings[name]]))}`;
}

/** The demo's card configuration; `floors` is typed from the card's own, so a renamed option fails to compile. */
export type DemoCardConfig = { readonly type: "custom:vacuum-map-card" } & Partial<Pick<CardConfig, "floors">>;

/** The card's configuration: with "floors", every demo floor is listed, so plans on no floor are hidden. */
export function cardConfigOf(plans: Plans): DemoCardConfig {
  const type = "custom:vacuum-map-card";
  return plans === "floors" ? { type, floors: DEMO_FLOOR_IDS } : { type };
}
