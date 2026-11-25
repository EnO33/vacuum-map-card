// The demo's plan pictures: invented SVG files drawn from the invented outlines of `test/fixtures/roomba-plus/`, keyed
// by the fixture image entity they stand for. Vite serves each file and gives its URL on the page's own origin.
import robotOneGroundFloor from "./plans/robot-one-ground-floor.svg";
import robotOneRoomsMap from "./plans/robot-one-rooms-map.svg";
import robotTwoRoomsMap from "./plans/robot-two-rooms-map.svg";
import robotTwoUpperLevel from "./plans/robot-two-upper-level.svg";

/**
 * Each enabled picture of the demo home (`demo-hass.ts`). A rooms map shows its robot's active map with the same
 * outlines as that floor plan, but without room names, as Roomba+ draws it by default (the card adds its own labels). The disabled floor plan, `image.robot_two_floor_plan_mapc_k4l5m6`, has no picture.
 */
export const PLAN_PICTURES: ReadonlyMap<string, string> = new Map([
  ["image.robot_one_rooms_map", robotOneRoomsMap],
  ["image.robot_one_floor_plan_mapa_q1w2e3", robotOneGroundFloor],
  ["image.robot_two_rooms_map", robotTwoRoomsMap],
  ["image.robot_two_floor_plan_mapd_r7t8y9", robotTwoUpperLevel],
]);
