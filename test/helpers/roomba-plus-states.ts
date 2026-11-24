// Test helper: the `hass.states` of both Roomba+ fixture robots, as one fresh object per call.

import roomsMapTwo from "../fixtures/roomba-plus/hass_state_rooms_map_mop_pending.json" with { type: "json" };
import roomsMapOne from "../fixtures/roomba-plus/hass_state_rooms_map_vacuum_aligned.json" with { type: "json" };
import selectTwo from "../fixtures/roomba-plus/hass_state_select_mop_cleaning_mode.json" with { type: "json" };
import floorPlans from "../fixtures/roomba-plus/hass_states_floor_plans.json" with { type: "json" };
import vacuums from "../fixtures/roomba-plus/hass_states_vacuum.json" with { type: "json" };

/** Vacuums, floor plans, rooms maps and the mop robot's select, keyed by entity id. */
export function roombaPlusStates(): Record<string, unknown> {
  return structuredClone({
    ...vacuums,
    ...floorPlans,
    [roomsMapOne.entity_id]: roomsMapOne,
    [roomsMapTwo.entity_id]: roomsMapTwo,
    [selectTwo.entity_id]: selectTwo,
  });
}
