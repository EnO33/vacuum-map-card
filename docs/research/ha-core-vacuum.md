# Home Assistant core: floors, areas and vacuum area cleaning

Status: **to verify**. Collected on 2026-11-20 from secondary reading only (the Roomba+ docs and a summary of https://www.home-assistant.io/integrations/vacuum/). Nothing here may be used in code before it is checked against developers.home-assistant.io and the Home Assistant source at the pinned version (`/check-versions`), with the date of the check.

## Claims to verify

| Claim | Source read | Status |
|---|---|---|
| `vacuum.clean_area` cleans « specific mapped areas using vacuum segments » | home-assistant.io vacuum integration page | à vérifier: exact fields (`cleaning_area_id`?), target, response |
| Segments are mapped to areas in the vacuum entity settings (« Map vacuum segments to areas ») | same | à vérifier: where the mapping is stored and how to read it from the frontend (registry option? websocket command?) |
| The option only appears when the entity supports area cleaning | same | à vérifier: the `VacuumEntityFeature` flag name and value |
| Minimum Home Assistant version 2026.3 | Roomba+ docs | à vérifier |
| Floors registry (floor id, name, level, aliases) readable from the frontend | general knowledge | à vérifier: websocket command and fields |
| Areas carry a `floor_id` | general knowledge | à vérifier |

## How to verify

1. Read the vacuum integration developer docs and `homeassistant/components/vacuum/` at the pinned Home Assistant version.
2. In a real Home Assistant (`/ha-live-test`), read the registries from the frontend (`hass.connection` websocket) and record the anonymised shapes here.
