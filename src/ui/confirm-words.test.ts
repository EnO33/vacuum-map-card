import { describe, expect, it } from "vitest";
import type { Intent, PathIntent } from "../app/start-clean/intent";
import type { ActionKind } from "../domain/robot/action-kind";
import { CATALOGS, isLocale, type Locale } from "../i18n/catalogs";
import { confirmParams, VERB_KEYS } from "./confirm-words";

const LOCALES = Object.keys(CATALOGS).filter(isLocale);

const PATH2: PathIntent = {
  path: 2,
  regionId: "r7",
  roomName: "Bedroom",
  mapId: "map-secret",
  call: { domain: "roomba_plus", service: "clean_room", data: { room: "r7" } },
  roomsMap: { state: "s", rooms: [{ regionId: "r7", name: "Bedroom", roomId: "7" }] },
};

function path1(rooms: readonly string[]): Extract<PathIntent, { path: 1 }> {
  return {
    path: 1,
    areaId: "area_secret_id",
    roomNames: rooms,
    mapId: "map-secret",
    segments: rooms.map((name, index) => ({ segmentId: `seg-${index}`, name })),
  };
}

function intent(action: ActionKind, path: PathIntent): Pick<Intent, "action" | "path"> {
  return { action, path };
}

/** Every action with its verb in each locale, as the question reads it. */
const VERBS: Readonly<Record<Locale, Readonly<Record<ActionKind, string>>>> = {
  en: {
    vacuum: "vacuum",
    mop: "mop",
    vacuum_and_mop: "vacuum and mop",
    vacuum_then_mop: "vacuum then mop",
    clean: "clean",
  },
  fr: {
    vacuum: "aspirer",
    mop: "laver le sol",
    vacuum_and_mop: "aspirer et laver le sol",
    vacuum_then_mop: "aspirer, puis laver le sol",
    clean: "nettoyer",
  },
};

const QUESTION: Readonly<Record<Locale, (robot: string, verb: string, room: string) => string>> = {
  en: (robot, verb, room) => `Send ${robot} to ${verb} ${room}?`,
  fr: (robot, verb, room) => `Envoyer ${robot} ${verb} dans « ${room} » ?`,
};

const ACTIONS = Object.keys(VERB_KEYS).filter((key): key is ActionKind => Object.hasOwn(VERB_KEYS, key));
const CASES = LOCALES.flatMap((locale) => ACTIONS.map((action) => [locale, action] as const));

describe("confirmation words", () => {
  it.each(LOCALES)("gives every action its own verb in %s", (locale) => {
    const catalog = new Map(Object.entries(CATALOGS[locale]));
    const verbs = Object.values(VERB_KEYS).map((key) => catalog.get(key) ?? "");
    expect(verbs.every((verb) => verb !== "")).toBe(true);
    expect(new Set(verbs).size).toBe(verbs.length);
  });

  it.each(CASES)("asks in %s to %s the robot's own room on path 2", (locale, action) => {
    const params = confirmParams(locale, intent(action, PATH2), "Robot A", "Unused area");
    expect(params.title).toBe(QUESTION[locale]("Robot A", VERBS[locale][action], "Bedroom"));
    expect(params.text).toBe("");
  });

  it.each(CASES)("asks in %s to %s the area on path 1 with one room", (locale, action) => {
    const params = confirmParams(locale, intent(action, path1(["Kitchen"])), "Robot A", "Kitchen area");
    expect(params.title).toBe(QUESTION[locale]("Robot A", VERBS[locale][action], "Kitchen area"));
    expect(params.text).toBe("");
  });

  it.each(CASES)("names the area and every room in %s to %s on path 1 with several rooms", (locale, action) => {
    const params = confirmParams(locale, intent(action, path1(["Kitchen", "Pantry", "Hall"])), "Robot A", "Ground");
    expect(params.title).toBe(QUESTION[locale]("Robot A", VERBS[locale][action], "Ground"));
    expect(params.text).toBe(
      locale === "en"
        ? "Cleans the whole area: Kitchen, Pantry, and Hall."
        : "Toutes ces pièces sont nettoyées : Kitchen, Pantry et Hall.",
    );
  });

  it("names the area as Home Assistant lists it, over the selected item's name", () => {
    const withName: PathIntent = { ...path1(["Kitchen"]), areaName: "Kitchen area" };
    expect(confirmParams("en", intent("vacuum", withName), "Robot A", "Kitchen").title).toBe(
      "Send Robot A to vacuum Kitchen area?",
    );
  });

  it.each(LOCALES)("names its own buttons in %s, so Home Assistant's « OK » never shows", (locale) => {
    const params = confirmParams(locale, intent("vacuum", PATH2), "Robot A", "Area");
    expect([params.confirmText, params.dismissText]).toEqual(
      locale === "en" ? ["Start", "Cancel"] : ["Lancer", "Annuler"],
    );
  });

  it("keeps names as plain text and leaves out every id", () => {
    const params = confirmParams("en", intent("mop", path1(["<b>A</b>", "{robot}"])), "<i>R</i>", "{room}");
    expect(params.title).toBe("Send <i>R</i> to mop {room}?");
    expect(params.text).toBe("Cleans the whole area: <b>A</b> and {robot}.");
    const all = JSON.stringify(confirmParams("en", intent("vacuum", PATH2), "Robot A", "Area"));
    for (const id of ["r7", "map-secret", "area_secret_id", "seg-0", "roomba_plus", "clean_room"]) {
      expect(all).not.toContain(id);
    }
  });
});
