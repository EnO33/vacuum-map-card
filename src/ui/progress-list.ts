import { css, html, nothing, type TemplateResult } from "lit";
import type { Plan } from "../app/floor-model/floor-model";
import type { ProgressEntry } from "../app/progress/progress-tracker";
import { type ItemRef, itemName } from "../app/robots-for-item/robots-for-item";
import type { Locale } from "../i18n/catalogs";
import { localize } from "../i18n/localize";
import type { ReadyView } from "./card-view";
import { robotNameIn } from "./plan-display";
import { PLAN_PICTURE_ELEMENT, PlanPicture } from "./plan-picture";
import { progressIcon, progressTone } from "./progress-marks";
import { type ProgressNames, progressLines } from "./progress-words";
import { settingsButton } from "./settings-button";

/** Fired by a « Dismiss » button: the card ends that robot's progress. Stays inside the card. */
export class ProgressDismissedEvent extends Event {
  static readonly type = "progress-dismissed";
  readonly vacuumEntityId: string;
  /** The room or area the robot was sent to: the focus goes back to it when no other entry is left in the list. */
  readonly item: ItemRef;
  constructor({ vacuumEntityId, item }: Pick<ProgressEntry, "vacuumEntityId" | "item">) {
    super(ProgressDismissedEvent.type, { bubbles: true, composed: false });
    this.vacuumEntityId = vacuumEntityId;
    this.item = item;
  }
}

/**
 * Ends a robot's progress from its « Dismiss » button, then moves the focus so it is not lost with the removed entry:
 * to the « Dismiss » button now in its place in the same list, or the one before it, else to the entry's room or area
 * through `focusItem` (given the entry's plan, `null` outside a plan).
 */
export async function dismissFrom(
  button: HTMLElement | null,
  dismiss: () => void,
  rendered: () => Promise<unknown>,
  focusItem: (plan: Element | null) => void,
): Promise<void> {
  const list = button?.closest(".progress-list") ?? null;
  const plan = button?.closest(".plan") ?? null;
  const buttons = () =>
    [...(list?.querySelectorAll(".progress-dismiss") ?? [])].filter((b) => b instanceof HTMLElement);
  const index = button === null ? -1 : buttons().indexOf(button);
  dismiss();
  await rendered();
  const next = list?.isConnected ? buttons() : [];
  const target = next[index] ?? next[index - 1];
  if (target) target.focus();
  else focusItem(plan);
}

/**
 * Focuses an item on its plan: the drawn room, or the area's button in the room list. `false` when the plan does not
 * show it (not drawn yet, re-mapped, or no plan), so the caller can focus something else.
 */
export function focusItem(
  plan: Element | null,
  item: ItemRef,
  plans: readonly Pick<Plan, "imageEntityId" | "content">[],
): boolean {
  if (plan === null) return false;
  if (item.kind === "room") {
    const picture = plan.querySelector(PLAN_PICTURE_ELEMENT);
    return picture instanceof PlanPicture && picture.focusRoom(item.regionId);
  }
  const content = plans.find((shown) => shown.imageEntityId === item.imageEntityId)?.content;
  const index = content?.kind === "areas" ? content.items.findIndex((area) => area.areaId === item.areaId) : -1;
  const button = index < 0 ? undefined : plan.querySelectorAll(".room-list button")[index];
  if (!(button instanceof HTMLElement)) return false;
  button.focus();
  return true;
}

/** What the card gives the dismiss of a robot's progress. */
export interface DismissHost {
  dismiss(vacuumEntityId: string): void;
  rendered(): Promise<unknown>;
  /** The plans shown, or `undefined` while none are. */
  plans(): readonly Pick<Plan, "imageEntityId" | "content">[] | undefined;
  /** Takes the focus when nothing else can: the card's content. */
  fallback(): void;
}

/**
 * Handles a « Dismiss » of the card: ends the robot's progress and keeps the focus in the card, on the next entry, the
 * entry's room or area, or else the card's content, never on the page.
 */
export function onDismissed(event: ProgressDismissedEvent, host: DismissHost): Promise<void> {
  const { vacuumEntityId, item } = event;
  return dismissFrom(
    event.target instanceof HTMLElement ? event.target : null,
    () => host.dismiss(vacuumEntityId),
    () => host.rendered(),
    (plan) => {
      const plans = host.plans();
      if (plans === undefined || !focusItem(plan, item, plans)) host.fallback();
    },
  );
}

/** What the list needs from the card. */
export interface ProgressContext {
  readonly locale: Locale;
  readonly isAdmin: boolean;
  robotName(vacuumEntityId: string): string;
  /** The item's name, or `undefined` when the plans no longer have it. */
  itemName(item: ItemRef): string | undefined;
}

/** What the progress needs from a ready view: build it once per render. */
export function progressContext(view: ReadyView, locale: Locale): ProgressContext {
  return {
    locale,
    isAdmin: view.isAdmin,
    robotName: (id) => robotNameIn(view.robotNames, id),
    itemName: (item) => itemName(view.model, item),
  };
}

export const progressListStyles = css`
  .progress-list {
    margin: var(--ha-space-2, 8px) 0 0;
    padding: 0;
    list-style: none;
  }
  .progress-item {
    display: flex;
    gap: var(--ha-space-2, 8px);
    align-items: flex-start;
    padding: var(--ha-space-2, 8px) 0;
    border-top: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
  }
  .progress-item .progress-icon {
    flex: none;
    width: 24px;
    height: 24px;
    color: var(--progress-color, var(--secondary-text-color, #5e5e5e));
  }
  .progress-text {
    flex: 1;
    min-width: 0;
  }
  .progress-text p {
    margin: 0;
    overflow-wrap: anywhere;
  }
  .progress-text p + p {
    margin-top: var(--ha-space-1, 4px);
  }
  .progress-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ha-space-2, 8px);
    margin-top: var(--ha-space-2, 8px);
  }
`;

/**
 * The progress of the robots sent to a plan's items, one entry per robot, under the plan (ADR 0003 « Progress on a
 * room »): its icon, its sentences (the phase, why a start was refused, what to do), and a « Dismiss » button. Not a
 * live region: the card's status line announces the changes. `name` is the list's accessible name. Every value is text.
 */
export function progressList(
  entries: readonly ProgressEntry[],
  name: string,
  context: ProgressContext,
): TemplateResult | typeof nothing {
  if (entries.length === 0) return nothing;
  return html`<ul class="progress-list" aria-label=${name}>
    ${entries.map((entry) => progressItem(entry, context))}
  </ul>`;
}

/** A room's name as a sentence quotes it, or « a room no longer on the plans », which is not quoted. */
function roomName(name: string | undefined, locale: Locale): string {
  return name === undefined
    ? localize(locale, "progress.unknown_room")
    : localize(locale, "progress.room_name", { name });
}

/** The names the progress of an entry speaks of: its robot, and its item or « a room no longer on the plans ». */
export function progressNames(entry: ProgressEntry, context: ProgressContext): ProgressNames {
  return {
    robot: context.robotName(entry.vacuumEntityId),
    room: roomName(context.itemName(entry.item), context.locale),
  };
}

function progressItem(entry: ProgressEntry, context: ProgressContext): TemplateResult {
  const { locale, isAdmin } = context;
  const names = progressNames(entry, context);
  const { lines, vacuumSettings } = progressLines(locale, entry, names, isAdmin);
  const dismiss = localize(locale, "progress.dismiss");
  const onDismiss = (event: Event) => event.currentTarget?.dispatchEvent(new ProgressDismissedEvent(entry));
  return html`<li class=${`progress-item tone-${progressTone(entry)}`}>
    ${progressIcon(entry)}
    <div class="progress-text">
      ${lines.map((line) => html`<p>${line}</p>`)}
      <div class="progress-actions">
        ${
          vacuumSettings
            ? settingsButton(entry.vacuumEntityId, localize(locale, "settings.open_vacuum"), names.robot)
            : nothing
        }
        <button
          type="button"
          class="outlined-button progress-dismiss"
          aria-label=${`${dismiss}, ${names.robot}, ${names.room}`}
          @click=${onDismiss}
        >
          ${dismiss}
        </button>
      </div>
    </div>
  </li>`;
}
