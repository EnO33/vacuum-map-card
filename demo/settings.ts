// The demo page's settings, kept in the address so a screenshot can be reproduced from its URL.
import { isOutcome, isReport, type Outcome, type Report } from "./demo-hass";

export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

/** Card widths: a phone (about 400 px), a tablet (about 800 px), or the whole window. */
export const WIDTHS = ["phone", "tablet", "wide"] as const;
export type Width = (typeof WIDTHS)[number];

export interface DemoSettings {
  readonly theme: Theme;
  readonly width: Width;
  readonly outcome: Outcome;
  readonly report: Report;
}

export const DEFAULT_SETTINGS: DemoSettings = Object.freeze({
  theme: "light",
  width: "tablet",
  outcome: "accepted",
  report: "captured",
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
  };
}

/** The query string of the settings, in a fixed order. */
export function searchOf(settings: DemoSettings): string {
  const { theme, width, outcome, report } = settings;
  return `?${new URLSearchParams({ theme, width, outcome, report })}`;
}
