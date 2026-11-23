# Roomba+ fixtures

Anonymised shapes of what the card reads from the Roomba+ integration, for the adapter (Epic 4) and the geometry code (Epic 3). Numbers and names are made up; only the shape is real. **All room geometry is invented**: no outline or calibration of the real home is here, not even rotated, scaled or shifted.

## Capture

- Roomba+ 4.6.5 (read with `manifest/get`), Home Assistant 2026.11.2. Same as `docs/research/roomba-plus.md`; no shape difference beyond the corrections recorded there on the same date.
- Date: 2026-11-23.
- Method: a browser session signed in as an administrator; `hass.states`, `vacuum/get_segments`, and `roomba_plus.get_rooms` (response only, no side effect per `docs/research/roomba-plus.md`). Names and ids were replaced in the page; only key sets, types, counts, magnitudes and whether the documented calibration formula reproduces the captured values left the browser for the geometry, never coordinates. Fixtures were then written by a script outside the repository.
- Installation: one Classic vacuum robot with `CLEAN_AREA` (`robot_one`) and one Classic mop robot (`robot_two`), two stored maps each. No robot was started and no setting was changed; the only service called was `roomba_plus.get_rooms`.
- Ids are those of `test/fixtures/ha-core/`: devices `0101…` (`robot_one`) and `0202…` (`robot_two`), areas (`library`), map ids (`MapA_q1W2e3` and `MapB_z9X8c7` for `robot_one`, `MapC_k4L5m6` and `MapD_r7T8y9` for `robot_two`), segment ids and names. `entity_registry_list.json` is a subset of `test/fixtures/ha-core/entity_registry_list.json`.

## What was replaced or invented

- Replaced as in `test/fixtures/ha-core/README.md`: entity ids, robot unique ids, map ids, room, map, area and floor names, firmware, context ids, timestamps, tokens (a made-up 64-hex value).
- Invented: every `outline`, the room centres `x` / `y` (vertex mean of the invented outline, as the integration computes them) and every `calibration_points` entry, computed from the invented outlines with Roomba+'s frame function (`image.py` L5184-L5188 at v4.6.5; rotation 0): `s = 600 / max(w + 100, h + 100)`, `px = trunc((x − min x + 50) · s)`, `py = trunc(600 − (y − min y + 50) · s)`, so a frame wider than tall sits at the bottom of the picture. That function reproduced every captured `map` value exactly. Every outline maps inside the picture.
- Replaced usage data: `favorites` names (`Favorite n`) and ids, `mission_id`, `room_coverage` values, `estimate_sec` of `get_rooms`, room names in `last_cleaned_rooms` and `room_coverage` keys.
- Kept as captured: key sets and order, types (integers and floats mixed in outlines, float `vacuum` and integer `map` calibration values), `alignment_pending` of each robot, `last_cleaned_rooms_source`, `estimate_quality.runs` and `rating`, the number of favorites, rooms and zones per map, the mop robot's `fan_speed` `"Deep-3"` (not in its `fan_speed_list`), `region_id` values (per-map ordinals `1`, `2`, `3` and zone ids `zid_0`…`zid_2` that every Classic map numbers the same way; they say nothing about the home and are already the suffixes of the segment ids in `test/fixtures/ha-core/`; the anonymisation rule in `docs/research/roomba-plus.md` lists region ids, so this exception is for the owner to confirm), room `icon` and `type` (integration mappings), segment `group` values, the trailing space of `"Reading table "`, `supported_features`, the mop robot's `detected_pad`, tank keys, cleaning mode select `unknown` with four options, and entity names from the integration's French translation.

## Files

| File | Source | Notes |
|---|---|---|
| `hass_states_vacuum.json` | `hass.states` | Both robots docked, all attributes. Vacuum: `bin_*`, `supported_features` 29500. Mop: `detected_pad`, `lid_closed`, `tank_*`, 13116 |
| `hass_state_rooms_map_vacuum_aligned.json` | `hass.states` | Vacuum robot's rooms map, `alignment_pending: false` (pose frame, third calibration corner `(max x, max y)`); one non-convex room. No `zones`, `door_markers`, `furniture_candidates`, as captured |
| `hass_state_rooms_map_mop_pending.json` | `hass.states` | Mop robot's rooms map, `alignment_pending: true` (cloud frame, third corner `(min x, max y)`): the « not aligned » state, real; one non-convex room |
| `hass_states_floor_plans.json` | `hass.states` | Four floor plans, two per robot; `room_count` null as captured |
| `hass_state_select_mop_cleaning_mode.json` | `hass.states` | Mop robot's cleaning mode select (`translation_key` `prime_cleaning_mode`) |
| `entity_registry_list.json` | `config/entity_registry/list` | The nine entities above |
| `get_rooms_response.json` | `roomba_plus.get_rooms` | The `response` member of each robot's call, keyed here by the entity id passed in `entity_id` (the real response is `{rooms: [...]}`) |
| `get_segments_response.json` | `vacuum/get_segments` | Vacuum robot only (the mop robot answers `not_supported`); both maps, then zones |

## Synthetic cases

Built from the documented shapes; the installation did not show them during the capture.

| File | Case |
|---|---|
| `synthetic/hass_state_rooms_map_three_rooms.json` | The vacuum robot's rooms map showing its other map, three rooms: `Gallery` and `Studio` share an edge, `Music corner` is non-convex and shares edges with both; `alignment_pending: true`; wider than tall, so the picture sits at the bottom (`map.y` 152 to 595). Coherent only if that map has become the cloud's active map: otherwise Roomba+ takes names and icons from the active map's regions with the same ids |
| `synthetic/hass_state_rooms_map_room_without_outline.json` | A room entry without `outline`. Defensive only: Roomba+ 4.6.5 builds every room from a polygon and cannot produce it; the calibration still spans the missing room's extent |
| `synthetic/hass_state_rooms_map_no_cloud.json` | No cloud or no map loaded yet: core attributes only, no `alignment_pending`, `calibration_points` or `rooms`. Not the « cloud unreachable after a load » case, which keeps the last map's attributes |
| `synthetic/entity_registry_list_floor_plan_disabled.json` | A floor plan registry entry with `disabled_by: "integration"`, the integration's default; absent from `hass.states` and `hass.entities` |
