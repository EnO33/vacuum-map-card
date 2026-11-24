import type { ActionKind } from "../../domain/robot/action-kind";
import type { FrontendHass } from "../hass/frontend-hass";
import { isObject, ownValue } from "../hass/own-property";
import { stateObjectOf } from "./picture-state";
import type { RobotEntities } from "./robot-entities";

/**
 * What the robot does when started, from Home Assistant state only, in ADR 0003 « Confirmation » order, first match
 * wins: a `detected_pad` key on the vacuum (a mop robot); the cleaning mode select, whose state names the action or,
 * while `unknown` or unavailable with both a vacuum and a mop option, gives the neutral `clean` (#37); no select means
 * vacuum only; then the SKU (`model_id`, else `model`: `m…` is a mop robot). When nothing decides: `clean` (owner
 * decision, 2026-11-24). Own keys only; the SKU is never returned.
 */
export function actionKindOf(robot: RobotEntities, getHass: () => FrontendHass): ActionKind {
  const hass = getHass();
  const vacuumState = stateObjectOf(hass.states, robot.vacuum.entityId);
  const attributes = vacuumState === undefined ? undefined : ownValue(vacuumState, "attributes");
  if (isObject(attributes) && Object.hasOwn(attributes, "detected_pad")) return "mop";
  const select = robot.primeCleaningMode;
  if (select === undefined) return "vacuum";
  return (
    selectAction(stateObjectOf(hass.states, select.entityId)) ??
    skuAction(hass.devices, robot.vacuum.deviceId) ??
    "clean"
  );
}

/** The action the select names, `clean` while it names none but offers both modes, else `undefined`. */
function selectAction(stateObject: object | undefined): ActionKind | undefined {
  if (stateObject === undefined) return undefined;
  const state = ownValue(stateObject, "state");
  const mode = typeof state === "string" ? modeOf(state) : undefined;
  if (mode !== undefined) return mode;
  if (state !== "unknown" && state !== "unavailable") return undefined;
  const attributes = ownValue(stateObject, "attributes");
  const options = isObject(attributes) ? ownValue(attributes, "options") : undefined;
  return hasOption(options, "vacuum") && hasOption(options, "mop") ? "clean" : undefined;
}

/** The action a cleaning mode names, narrowed without a cast. */
function modeOf(state: string): ActionKind | undefined {
  switch (state) {
    case "vacuum":
    case "mop":
    case "vacuum_and_mop":
    case "vacuum_then_mop":
      return state;
    default:
      return undefined;
  }
}

/** Whether an untrusted array holds `option`, read item by item without copying it. */
function hasOption(options: unknown, option: string): boolean {
  if (!Array.isArray(options)) return false;
  const length = options.length;
  for (let i = 0; i < length; i++) {
    if (ownValue(options, String(i)) === option) return true;
  }
  return false;
}

/** `mop` for a SKU starting with `m` (the integration's Braava class), `vacuum` for any other, else `undefined`. */
function skuAction(devices: unknown, deviceId: string | null): ActionKind | undefined {
  if (deviceId === null || !isObject(devices)) return undefined;
  const device = ownValue(devices, deviceId);
  if (!isObject(device)) return undefined;
  const sku = nonEmpty(ownValue(device, "model_id")) ?? nonEmpty(ownValue(device, "model"));
  if (sku === undefined) return undefined;
  return sku.startsWith("m") ? "mop" : "vacuum";
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}
