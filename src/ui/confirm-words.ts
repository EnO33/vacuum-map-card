import type { Intent } from "../app/start-clean/intent";
import type { ActionKind } from "../domain/robot/action-kind";
import type { Locale, MessageKey } from "../i18n/catalogs";
import { localize } from "../i18n/localize";
import type { ConfirmDialogParams } from "./confirm-dialog";

/** Every action as the verb of the question: a typed `Record`, so a new `ActionKind` without a verb is a type error. */
export const VERB_KEYS: Readonly<Record<ActionKind, MessageKey>> = {
  vacuum: "verb.vacuum",
  mop: "verb.mop",
  vacuum_and_mop: "verb.vacuum_and_mop",
  vacuum_then_mop: "verb.vacuum_then_mop",
  clean: "verb.clean",
};

/**
 * The confirmation of one start (ADR 0003 « Confirmation »): a question naming the robot, the action and the room,
 * the robot's own room on path 2 and the area on path 1 (`shownName`, the selected item's name, when the area has no
 * name). When the area maps to several rooms, the text names every room that will be cleaned. Plain text only: names
 * are inserted as they are, and no id, URL or call data is used.
 */
export function confirmParams(
  locale: Locale,
  { action, path }: Pick<Intent, "action" | "path">,
  robot: string,
  shownName: string,
): ConfirmDialogParams {
  const room = path.path === 2 ? path.roomName : (path.areaName ?? shownName);
  const verb = localize(locale, VERB_KEYS[action]);
  const rooms = path.path === 1 && path.roomNames.length > 1 ? path.roomNames : [];
  return {
    title: localize(locale, "confirm.question", { robot, verb, room }),
    text:
      rooms.length > 0
        ? localize(locale, "confirm.cleans", {
            rooms: new Intl.ListFormat(locale, { type: "conjunction" }).format(rooms),
          })
        : "",
    confirmText: localize(locale, "confirm.start"),
    dismissText: localize(locale, "confirm.cancel"),
  };
}
