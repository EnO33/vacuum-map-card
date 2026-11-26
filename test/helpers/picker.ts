// Test helper: the card's robot picker window, and a room selected from a plan picture as a tap does.
import type { ItemRef } from "../../src/app/robots-for-item/robots-for-item";
import { PICKER_DIALOG_ELEMENT, PickerDialog } from "../../src/ui/picker-dialog";
import { ROBOT_PICKER_ELEMENT, RobotPicker } from "../../src/ui/robot-picker";
import { roomSelectedEvent } from "../../src/ui/room-selected";
import { pictures, shadowOf, type TestCard } from "./card";

export function pickerDialog(card: TestCard): PickerDialog | undefined {
  const found = shadowOf(card).querySelector(PICKER_DIALOG_ELEMENT);
  return found instanceof PickerDialog ? found : undefined;
}

/** Waits for the card, then its picker window and the robot list in it. */
export async function settlePicker(card: TestCard): Promise<void> {
  await card.updateComplete;
  const host = pickerDialog(card);
  await host?.updateComplete;
  const list = host && shadowOf(host).querySelector(ROBOT_PICKER_ELEMENT);
  if (list instanceof RobotPicker) await list.updateComplete;
  await host?.updateComplete;
}

/**
 * The first room of the card's first outlines plan, selected from its picture as a tap does. The picture has no size
 * here, so it draws no room: a focused button on the page stands for the drawn room.
 */
export async function selectFirstRoom(card: TestCard): Promise<{ item: ItemRef; name: string; opener: HTMLElement }> {
  const picture = pictures(card).find((p) => p.rooms !== undefined && p.rooms.rooms.size > 0);
  const [room] = picture?.rooms?.rooms.values() ?? [];
  if (!picture || !room) throw new Error("no room");
  const item: ItemRef = { kind: "room", imageEntityId: picture.imageEntityId, regionId: room.regionId };
  const opener = document.createElement("button");
  document.body.append(opener);
  opener.focus();
  picture.dispatchEvent(roomSelectedEvent(item, opener));
  await settlePicker(card);
  return { item, name: room.name, opener };
}
