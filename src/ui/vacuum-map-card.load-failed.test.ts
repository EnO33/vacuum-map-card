// @vitest-environment happy-dom
// A list the card waits for could not be fetched: the card says so instead of loading forever (#125).
import { describe, expect, it } from "vitest";
import type { FakeFrontendHass } from "../../test/fakes/frontend-hass";
import { fixtureHass, LOADING, mount, settle, shadowOf, statusText, useTestCard } from "../../test/helpers/card";
import { expectNoConsoleOutput } from "../../test/helpers/no-console";
import { bodyStyles } from "./card-body";

const FAILED_EN =
  "Could not load the floor plans. The card tries again when Home Assistant reconnects. You can also reload the page.";
const FAILED_FR =
  "Impossible de charger les plans. La carte réessaie quand Home Assistant se reconnecte. Vous pouvez aussi recharger la page.";
const SECRET = "boom /api/websocket?token=abc vacuum.robot_one";

useTestCard();
expectNoConsoleOutput();

/** The fixture `hass`, with the fetch of `command` rejecting; returns the function that lets it succeed again. */
function failing(hass: FakeFrontendHass, command: string): () => void {
  const fixtures = hass.answerWS;
  hass.answerWS = (message) => (message.type === command ? Promise.reject(new Error(SECRET)) : fixtures(message));
  return () => {
    hass.answerWS = fixtures;
  };
}

describe("VacuumMapCard when a list cannot be fetched", () => {
  it.each(["config/floor_registry/list", "config/entity_registry/list"])(
    "says %s could not be loaded, without any detail, and recovers on a reconnection",
    async (command) => {
      const hass = fixtureHass();
      const recover = failing(hass, command);
      const card = await mount(hass);
      expect(statusText(card)).toBe(FAILED_EN);
      expect(shadowOf(card).innerHTML).not.toContain("token");
      expect(shadowOf(card).innerHTML).not.toContain("vacuum.robot_one");
      recover();
      hass.connection.reconnect();
      await settle(card);
      expect(statusText(card)).toBe("");
      expect(shadowOf(card).querySelector("li")?.textContent?.trim()).toBe("Ground floor");
    },
  );

  it("marks the message with the error state colour, in the same status region as the loading", async () => {
    const hass = fixtureHass();
    failing(hass, "config/floor_registry/list");
    const card = await mount(hass);
    const message = shadowOf(card).querySelector('[role="status"] .load-failed');
    expect(message).not.toBeNull();
    expect(bodyStyles.cssText).toContain(
      "var(--state-vacuum-error-color, var(--state-vacuum-active-color, var(--state-active-color)))",
    );
  });

  it("speaks French", async () => {
    const hass = fixtureHass();
    hass.language = "fr";
    hass.locale = { language: "fr" };
    failing(hass, "config/floor_registry/list");
    expect(statusText(await mount(hass))).toBe(FAILED_FR);
  });

  it("keeps loading while a list never answers", async () => {
    const hass = fixtureHass();
    const fixtures = hass.answerWS;
    hass.answerWS = (message) =>
      message.type === "config/floor_registry/list" ? new Promise(() => undefined) : fixtures(message);
    expect(statusText(await mount(hass))).toBe(LOADING);
  });
});
