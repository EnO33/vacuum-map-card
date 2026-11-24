import type { FloorModel } from "../floor-model/floor-model";

/**
 * The model with only the floors of the `floors` option (#115), or the model itself when it is not set. The floors
 * keep the model's order, which is Home Assistant's (ADR 0005 « Floors » item 1), whatever the order of the list; a
 * listed id that matches no floor is ignored, so a floor deleted later just disappears. The « no floor » group is
 * shown only when the option is not set. The robots are kept: they are what the picker offers.
 */
export function onlyFloors(model: FloorModel, floors: readonly string[] | undefined): FloorModel {
  if (floors === undefined) return model;
  const listed: ReadonlySet<string> = new Set(floors);
  return { ...model, floors: model.floors.filter((floor) => listed.has(floor.floorId)), noFloor: [] };
}
