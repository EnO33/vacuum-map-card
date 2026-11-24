# Home Assistant core fixtures

Anonymised shapes of what the card reads from Home Assistant core, for the tests of Epics 3 and 4. Numbers and names are made up; only the shape is real.

## Capture

- Home Assistant 2026.11.2 (read from `hass.config.version`); frontend as shipped with that release, 20261028.6 according to the core manifest (`docs/research/ha-core-registries.md`). The frontend version was not read live.
- Date: 2026-11-23.
- Method: a browser session signed in as an administrator; `hass` fields and read-only websocket commands (`config/*_registry/list`, `config/entity_registry/get`, `vacuum/get_segments`) run from the page. The data was anonymised in the page before it left the browser, then split into these files by a script outside the repository.
- Scope: every floor and area of the installation; only the two robots' devices and their `vacuum`, `image` and `select` entities, plus one disabled `sensor` entity. Vacuum integration: Roomba+ 4.6.5 (`platform` `roomba_plus`); its own data is covered by #27.
- Before the capture, with the owner's agreement, two floors were created and areas were assigned to them through the registry websocket commands. The area-to-segment mapping was not saved through the Home Assistant dialog: it was written by a direct `config/entity_registry/update` call (`options_domain: "vacuum"`, `options: {area_mapping, last_seen_segments}`), with `last_seen_segments` set to the `vacuum/get_segments` response, as the dialog does per `docs/research/ha-core-vacuum.md`. The `options.vacuum` shape is therefore the one written by the capture, not one observed from the dialog. No service was called and no robot was started.

## What was replaced

- Floor, area, device, config entry, entity registry and context ids; floor and area names and area icons; device names, models, manufacturer, serial numbers, MAC addresses, firmware versions; entity id prefixes; robot unique ids (`ROBOTBLID0001`, `ROBOTBLID0002`); map ids (`MapA_q1W2e3`, `MapB_z9X8c7`, `MapC_k4L5m6`, `MapD_r7T8y9`); map names inside `original_name` and `friendly_name` (`Plan <map>`); segment names. Area and segment names are invented, not translations of the real ones.
- Kept as captured: list order, the number of areas and which floor each belongs to (`greenhouse` has no floor), segment `group` values (Roomba+ zone types), the trailing space in the segment name `"Reading table "` (a real quirk of the zone name; do not trim it in tests), the mop robot's `fan_speed` that is not in its `fan_speed_list`.
- Replacements are consistent across files: each `floor_id` names a fixture floor, each `area_id` and `area_mapping` key a fixture area, each `device_id` a fixture device, each segment id a `last_seen_segments` entry.
- Timestamps: `created_at` and `modified_at` replaced by whole seconds from 1767225660 (the originals are floats). In `hass.states`, `last_changed` and `last_updated` keep the frontend's `toISOString()` form (`…T08:00:00.000Z`); the image entity's `state` keeps the server form with microseconds (`…T08:04:00.123456+00:00`).
- `context.user_id` was `null` in every captured state; nothing to replace. `access_token` and the `token` query of `entity_picture` replaced by a made-up 64-hex value.
- State attributes: only core attributes are kept. Vacuum: `fan_speed_list`, `fan_speed`, `friendly_name`, `supported_features`. Image: `access_token`, `entity_picture`, `friendly_name`. The Roomba+ attributes captured alongside them (for the image: `map_name`, `map_version`, `room_count`) were dropped (#27).
- Entity names come from the integration's French translation (`original_name`, `hass.entities` `name`), kept except where they carried a map name.
- Context ids and config entry ids are made-up ULIDs (`01JAAAAAAAAAAAAAAAAAAAAA01`…).

## Files

| File | Read path | Notes |
|---|---|---|
| `floor_registry_list.json` | `config/floor_registry/list` | Two floors, in list order |
| `hass_floors.json` | `hass.floors` | Identical to the list, keyed by `floor_id` (checked in the page) |
| `area_registry_list.json` | `config/area_registry/list` | Eight areas; `greenhouse` has no floor (real) |
| `hass_areas.json` | `hass.areas` | Identical to the list, keyed by `area_id`, same order (checked in the page) |
| `device_registry_list.json` | `config/device_registry/list` | The two robots' devices only |
| `hass_devices.json` | `hass.devices` | Identical to the list for these main devices (checked in the page) |
| `entity_registry_list.json` | `config/entity_registry/list` | Includes disabled entries (`disabled_by: "integration"`), absent from `hass.entities` |
| `hass_entities.json` | `hass.entities` | Enabled entries only. Keys the server did not send are `undefined` in the page and therefore absent here |
| `entity_registry_get_vacuum_clean_area.json` | `config/entity_registry/get` | Vacuum with `CLEAN_AREA` (`supported_features` 29500) and a saved `options.vacuum` mapping, including a zone segment |
| `entity_registry_get_vacuum_no_clean_area.json` | `config/entity_registry/get` | Mop robot without `CLEAN_AREA` (13116) and without `options.vacuum` |
| `hass_states_vacuum_docked.json` | `hass.states` | Both robots docked. The mop robot's `fan_speed` is not in its `fan_speed_list` (real) |
| `hass_state_image_floor_plan.json` | `hass.states` | A floor plan image entity, token removed |

## Synthetic cases

Built from the captured shapes; the installation does not have them.

| File | Case |
|---|---|
| `synthetic/hass_state_vacuum_cleaning.json` | The vacuum robot `cleaning` (the robot was not started for the capture) |
| `synthetic/hass_state_vacuum_unavailable.json` | The vacuum robot `unavailable`: `fan_speed` gone, `fan_speed_list` and `supported_features` kept (`docs/research/ha-core-vacuum.md`) |
| `synthetic/floor_registry_list_floor_without_areas.json` | A third floor, `basement`, with no area |
| `synthetic/entity_registry_get_vacuum_deleted_area.json` | An `area_mapping` key, `deleted_room`, that names no area |
| `synthetic/entity_registry_get_vacuum_clean_area_no_mapping.json` | A vacuum with `CLEAN_AREA` and no mapping saved (`options.vacuum` absent) |
| `synthetic/service_errors.json` | Rejection values of `hass.callService`, built from the sources cited in `docs/research/ha-core-vacuum.md` « Errors » rows 1, 3, 4, 6, 7 and 10 and « Response » (no call made, 2026-11-24): websocket error objects, Roomba+ `unknown_rooms` with invented room names and `room_list_not_read`, and the connection-lost result message of `home-assistant-js-websocket` 9.8.0. Translated messages of rows 6, 7 and `room_list_not_read` use the bare key, as core sends when translations are not cached |
| `synthetic/repairs_list_issues.json` | `repairs/list_issues`, built from the example in `docs/research/ha-core-vacuum.md` « Anonymised examples » and the source cited in « When the integration reports different segments » (no call made, 2026-11-24): an open `segments_changed` issue for `vacuum.robot_one` (id from its registry `id` in `entity_registry_list.json`), an ignored one for an invented entry id, and a `roomba_plus` issue with `vacuum.robot_two`'s id suffix |
