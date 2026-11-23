import { withinTextCap } from "./limits";

const MDI_ICON = /^mdi:[a-z0-9-]+$/;

/** The icon when it is a plain Material Design name within the cap (ADR 0002 item 1); otherwise Epic 5's default. */
export function safeIcon(icon: string): string | undefined {
  return withinTextCap(icon) && MDI_ICON.test(icon) ? icon : undefined;
}
