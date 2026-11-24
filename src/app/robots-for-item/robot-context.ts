import type { VacuumStateInput } from "../../domain/eligibility/decide-path";
import type { PathOneContext } from "../../domain/eligibility/path-one";
import type { PlanContent, RobotModel } from "../floor-model/floor-model";
import type { HassPort } from "../ports/hass-port";
import type { SourceRobot } from "../ports/room-source";

/** The robot's own rooms map content, when it has outlines (a robot has at most one rooms map). */
export type OutlinesContent = Extract<PlanContent, { kind: "outlines" }>;

/** One robot with everything its paths are decided with: its model (#51), its source robot and live port reads. */
export interface RobotContext {
  readonly model: RobotModel;
  readonly source: SourceRobot;
  readonly vacuum: VacuumStateInput;
  readonly pathOne: PathOneContext;
  readonly outlines: OutlinesContent | undefined;
}

/** The mapping, last seen names, pairing and shadow index come from the model; availability and repairs are live. */
export function robotContextOf(model: RobotModel, source: SourceRobot, hass: HassPort): RobotContext {
  const id = model.vacuumEntityId;
  const outlines = outlinesOf(model);
  const pathOne: PathOneContext = {
    ...model.options,
    hasCleanArea: model.hasCleanArea,
    hasCleanAreaService: hass.hasService("vacuum", "clean_area"),
    mapOfSegment: (segmentId) => source.mapOfSegment(segmentId),
    segmentsChangedOpen: hass.segmentsChangedOpen(id),
    pairedRooms: outlines?.pairedRooms,
  };
  return { model, source, vacuum: hass.vacuum(id), pathOne, outlines };
}

function outlinesOf(model: RobotModel): OutlinesContent | undefined {
  for (const { content } of model.plans) if (content.kind === "outlines") return content;
  return undefined;
}
