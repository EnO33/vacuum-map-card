// @vitest-environment happy-dom
import { render } from "lit";
import { describe, expect, it } from "vitest";
import type { StartNotice } from "./start-flow";
import { startNoticeLines, startNoticeView } from "./start-notice";

const NAME = (id: string): string => (id === "vacuum.robot_one" ? "Robot <one>" : id);
const ROBOT = "vacuum.robot_one";
const NB = " ";

describe("startNoticeLines", () => {
  it.each([
    [
      { kind: "preview" },
      ["Starting is turned off in the editor preview."],
      ["Le lancement est désactivé dans l'aperçu de l'éditeur."],
    ],
    [
      { kind: "not_started", vacuumEntityId: ROBOT },
      ["Robot <one> was not started: its state or rooms changed. Choose the room again."],
      [`Robot <one> n'a pas été lancé${NB}: son état ou ses pièces ont changé. Choisissez à nouveau la pièce.`],
    ],
    [
      { kind: "busy", vacuumEntityId: ROBOT },
      ["Nothing was sent: a start is already being sent to Robot <one>."],
      [`Rien n'a été envoyé${NB}: une demande est déjà en cours d'envoi à Robot <one>.`],
    ],
    [
      { kind: "nothing_sent", vacuumEntityId: ROBOT },
      ["Nothing was sent to Robot <one>."],
      ["Rien n'a été envoyé à Robot <one>."],
    ],
    [
      { kind: "not_asked", vacuumEntityId: ROBOT },
      ["The confirmation could not be shown, so nothing was sent to Robot <one>."],
      [`La confirmation n'a pas pu s'afficher${NB}: rien n'a été envoyé à Robot <one>.`],
    ],
    [
      { kind: "cannot_start", vacuumEntityId: ROBOT, reasons: ["unavailable"] },
      ["Robot <one> cannot start this clean now.", "Check that the robot is on and connected to Home Assistant."],
      [
        "Robot <one> ne peut pas faire ce nettoyage pour le moment.",
        "Vérifiez que le robot est allumé et connecté à Home Assistant.",
      ],
    ],
  ] satisfies [StartNotice, string[], string[]][])("words %j in English and French", (notice, en, fr) => {
    expect(startNoticeLines("en", notice, NAME)).toEqual(en);
    expect(startNoticeLines("fr", notice, NAME)).toEqual(fr);
  });
});

describe("startNoticeView", () => {
  function shown(notice: StartNotice): HTMLElement {
    const host = document.createElement("div");
    render(startNoticeView("en", notice, NAME), host);
    return host;
  }

  it.each([
    [{ kind: "busy", vacuumEntityId: ROBOT }, "notice-info"],
    [{ kind: "not_asked", vacuumEntityId: ROBOT }, "notice-warning"],
  ] satisfies [StartNotice, string][])("shows %j in a box of its tone, with its icon", (notice, tone) => {
    const box = shown(notice).querySelector(".notice");
    expect(box?.classList.contains(tone)).toBe(true);
    expect(box?.querySelector("svg")).not.toBeNull();
  });

  it("puts the reasons under the sentence, as text", () => {
    const host = shown({ kind: "cannot_start", vacuumEntityId: ROBOT, reasons: ["unavailable"] });
    const lines = [...host.querySelectorAll("p")].map((p) => [p.className, p.textContent]);
    expect(lines).toEqual([
      ["", "Robot <one> cannot start this clean now."],
      ["secondary", "Check that the robot is on and connected to Home Assistant."],
    ]);
  });
});
