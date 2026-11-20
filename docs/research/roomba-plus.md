# Roomba+ data model

- Integration: [johnnyh1975/ha_roomba_plus](https://github.com/johnnyh1975/ha_roomba_plus) **4.6.3**, Home Assistant **2026.11.2**.
- Robots seen: one Roomba s9+ (vacuum) and one Braava jet m6 (mop), « Classic » family (local MQTT), iRobot account connected for maps.
- Captured: 2026-11-20, from the frontend `hass` object and `roomba_plus.get_rooms` responses. Values below are **anonymised** (`<robot>`, `<map_id>`, room names and coordinates replaced).

## Entities that matter

| Entity | Content | Notes |
|---|---|---|
| `vacuum.<robot>` | State `docked`, `cleaning`, `returning`, `paused`, `idle`, `error` | Braava keeps a `detected_pad` attribute (`reusableWet`, `invalid`…) |
| `image.<robot>_rooms_map` | Room map of **one** map (see below) | Attributes `rooms`, `calibration_points`, `alignment_pending` |
| `image.<robot>_floor_plan_<map_id>` | Floor plan of one stored map, rooms drawn and labelled in the picture | **Disabled by default**, one per stored map; attributes `map_name`, `map_version`, `room_count`. `<map_id>` is the iRobot map id in lower case |
| `image.<robot>_map` | Live cleaning path (local) | No room data |
| `image.<robot>_coverage_map` | Coverage heat map | Diagnostic |
| `select.<robot>_cloud_zone_<map_id>` | Cloud clean zones of one map | Options = zone names; attribute `is_active_map`; disabled for non-active maps |

The integration and the companion card find entities through the entity registry (`platform: roomba_plus`), not by id pattern.

## `image.<robot>_rooms_map` attributes

```json
{
  "alignment_pending": true,
  "calibration_points": [
    { "vacuum": { "x": -1000.0, "y": -500.0 }, "map": { "x": 10, "y": 400 } }
  ],
  "rooms": {
    "<Room A>": {
      "name": "<Room A>",
      "room_id": "1",
      "region_id": "<region>",
      "icon": "mdi:sofa",
      "x": 0, "y": 0,
      "outline": [[1000.0, 3000.0], [-1500.0, 3000.0], [-1500.0, 2000.0]]
    }
  }
}
```

- Numbers above are made up; only the shape is real.
- `outline` is in **robot coordinates** (millimetres, « à vérifier »); `calibration_points` map robot coordinates to image pixels. Count of points in the capture: « à vérifier » (an affine transform needs 3).
- `alignment_pending: true` means the plan is not yet aligned with the robot's position data; per the companion card, coverage, doors and position appear « after a few cleans » (« à vérifier » how it changes `calibration_points`).
- Which map it shows: per the Roomba+ docs, the map the robot's **last command** went to, else the most recently edited map; not necessarily the account's active map.

## `roomba_plus.get_rooms`

Called with `service_data: { entity_id: "vacuum.<robot>" }` and `return_response: true` (a `target` is rejected: « value should be a string at 'entity_id' »).

```json
{
  "rooms": [
    {
      "id": "1",
      "name": "<Room A>",
      "map_id": "<MapId>",
      "type": "living_room",
      "area_id": "<area_id>",
      "area_name": "<Area>",
      "estimate_sec": null,
      "estimate_quality": { "runs": 0, "spread_sec": null, "rating": "none" }
    }
  ]
}
```

- Returns the rooms of **one** map only (the same as the rooms map). `map_id` matches the floor plan entity suffix once lower-cased.
- `area_id` / `area_name`: the Home Assistant area the room is linked to.

## Actions

| Action | Fields (from the service schema) | Notes |
|---|---|---|
| `roomba_plus.clean_room` | `room_name`, `ordered`, `cleaning_mode` (`vacuum`, `mop`, …), `two_pass`, `smart_scrub`, `pad_wetness` (`1`–`3`), `room_passes` | No `map_id`: per the docs a room command « goes to the map of its room » |
| `roomba_plus.clean_zone` | `zone_name` or `zone_id` | Cloud zones |
| `roomba_plus.get_rooms` | `entity_id` | Response only |
| `roomba_plus.run_favorite` | « à vérifier » | Favourites carry their own map |

Exact field types and the entity field of `clean_room`: « à vérifier » in the integration's `services.yaml` at the pinned version.

## Gaps for this card

1. Room outlines exist for one map at a time. Other floors only have a picture (`floor_plan`) and a room count: no outlines, no names in attributes.
2. Floor plan entities are created disabled: the card must detect « map exists but plan disabled » (entity registry `disabled_by`) and tell the user how to enable it.
3. Braava jet m6 has no Map tab in the companion card; its room data does exist in `image.<braava>_rooms_map`.

Open questions for the integration author (to draft as an issue, posted by the owner): exposing outlines and calibration for every stored map (for example on each `floor_plan` image), and a stable link between a floor plan and a Home Assistant floor.
