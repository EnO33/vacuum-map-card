import { css, svg, type TemplateResult } from "lit";
import type { ProgressEntry } from "../app/progress/progress-tracker";
import type { ProgressPhase } from "../domain/clean/progress";
import { circleIcon } from "./notice";
import { STATE_COLORS } from "./state-colors";

/** A progress colour (ADR 0004 « State colours »); `none` where the label and the icon carry the phase alone. */
export type ProgressTone = "cleaning" | "paused" | "failed" | "done" | "unknown" | "none";

type Mark = "send" | "cleaning" | "pause" | "check" | "alert" | "question";

interface Look {
  readonly tone: ProgressTone;
  readonly mark: Mark;
}

/** Each phase's colour and icon. */
const PHASE_LOOKS: Readonly<Record<ProgressPhase, Look>> = {
  sending: { tone: "none", mark: "send" },
  starting: { tone: "none", mark: "send" },
  cleaning: { tone: "cleaning", mark: "cleaning" },
  paused: { tone: "paused", mark: "pause" },
  done: { tone: "done", mark: "check" },
  failed: { tone: "failed", mark: "alert" },
  may_have_started: { tone: "none", mark: "question" },
  not_started: { tone: "none", mark: "alert" },
};

const STATUS_UNKNOWN: Look = { tone: "unknown", mark: "question" };

/** An entry's look: the unavailable colour and a « ? » while its state cannot be read, else its phase's. */
function lookOf({ phase, statusUnknown }: ProgressEntry): Look {
  return statusUnknown ? STATUS_UNKNOWN : PHASE_LOOKS[phase];
}

export function progressTone(entry: ProgressEntry): ProgressTone {
  return lookOf(entry).tone;
}

/** The classes of a coloured item: `filled` and its tone; none for a phase without a colour. */
export function toneClasses(tone: ProgressTone): string {
  return tone === "none" ? "" : `filled tone-${tone}`;
}

/** `--progress-color` per tone: a vacuum state's colour, or the theme's success colour for done (ADR 0004). */
export const progressToneStyles = css`
  .tone-cleaning {
    --progress-color: ${STATE_COLORS.cleaning};
  }
  .tone-paused {
    --progress-color: ${STATE_COLORS.paused};
  }
  .tone-failed {
    --progress-color: ${STATE_COLORS.error};
  }
  .tone-done {
    --progress-color: var(--success-color);
  }
  .tone-unknown {
    --progress-color: ${STATE_COLORS.unavailable};
  }
`;

/** Each mark inside the icon's circle: an arrow, a dot, two bars, a check, a « ! » or a « ? ». */
const MARK_PATHS: Readonly<Record<Mark, TemplateResult>> = {
  send: svg`<path d="M8 12h8M13 8.5l3.5 3.5-3.5 3.5" />`,
  cleaning: svg`<circle cx="12" cy="12" r="3.5" fill="currentColor" />`,
  pause: svg`<path d="M10 8.5v7M14 8.5v7" />`,
  check: svg`<path d="M8 12.5l2.5 2.5 5.5-6" />`,
  alert: svg`<path d="M12 7v6M12 17v.01" />`,
  question: svg`<path d="M9.75 9.75a2.25 2.25 0 1 1 3.2 2.04c-.57.27-.95.82-.95 1.45v.26M12 16.5v.01" />`,
};

/** The icon's shapes in a 24 × 24 box, for an SVG the caller places. */
export function progressMark(entry: ProgressEntry): TemplateResult {
  return svg`<circle cx="12" cy="12" r="9" />${MARK_PATHS[lookOf(entry).mark]}`;
}

/** The phase's icon in HTML, decorative: the label next to it says what it means, so the phase is not colour alone. */
export function progressIcon(entry: ProgressEntry): TemplateResult {
  return circleIcon(MARK_PATHS[lookOf(entry).mark], "progress-icon");
}
