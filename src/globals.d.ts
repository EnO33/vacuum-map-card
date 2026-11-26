/** Card version, replaced at build and test time from package.json (see vite.config.ts). */
declare const __CARD_VERSION__: string;

interface Window {
  /** Card picker list, shared with Home Assistant and other cards: untrusted. */
  customCards?: unknown;
  /** Set by the dashboard panel (`docs/research/ha-frontend.md` § 3); absent outside a dashboard: untrusted. */
  loadCardHelpers?: unknown;
}
