# ADR 0005: Linking maps, rooms, areas and floors

- Status: accepted
- Date: 2026-11-23

## Context

The card shows one plan per Home Assistant floor and starts cleans per room (`docs/product.md`). That needs four links that no single source provides: floor order, stored robot map to floor, the rooms map (the only map with outlines) to a stored map, and room to area. ADR 0002 says floors and room-to-area links come from Home Assistant registries. The research of Epic 2 verified what the registries, the vacuum integration in core and Roomba+ actually expose, at Home Assistant core 2026.11.2, frontend 20261028.6 and Roomba+ 4.6.5, with live captures on 2026-11-23:

- [`ha-core-registries.md`](../research/ha-core-registries.md)
- [`ha-core-vacuum.md`](../research/ha-core-vacuum.md)
- [`roomba-plus.md`](../research/roomba-plus.md)
- fixtures in `test/fixtures/ha-core/` and `test/fixtures/roomba-plus/`

The owner decided floor order, the image URL rule and the minimum version (2026.3.0, `docs/standards.md`) on 2026-11-23 (comment on #29, #28).

Fixture names below are invented: they show shapes, not how real map names compare with real floor names.

## Decision

### Floors

1. Floors are shown in the array order of `config/floor_registry/list`. The card fetches the list once when it connects, re-fetches the whole list on each `floor_registry_updated` event (debounced, as the frontend does), and unsubscribes when it disconnects. It never sorts by `level` and never uses the order of `Object.values(hass.floors)`, which moves floors with an all-digit `floor_id` (a floor named « 1 ») first. Owner decision 1. Sources: [`ha-core-registries.md` « Floor order »](../research/ha-core-registries.md#floor-order), [« Update signal »](../research/ha-core-registries.md#update-signal).
2. Areas without a floor (`floor_id: null`, also after their floor is deleted) form one « no floor » group shown after all floors, as Home Assistant does. Source: [« Areas without a floor »](../research/ha-core-registries.md#areas-without-a-floor).
3. A floor with no linked map gets no plan; it is not shown as an empty frame. Source: [`ha-core-registries.md` « Gaps for this card », Epic 3 item 3](../research/ha-core-registries.md#epic-3-floor-model).

### Map to floor

Each stored robot map (one floor plan entity) gets at most one `floor_id`. The sources below are tried in order; the first that yields exactly one floor wins.

| # | Source | User action | Conflict | Source of the facts |
|---|---|---|---|---|
| 1 | The floor plan entity's **own** registry `area_id` (from `config/entity_registry/list`), then that area's `floor_id`. Never the device's area: every map of a robot shares one device, so the device area cannot tell floors apart | Once, in Home Assistant: assign an area to the floor plan entity | Not possible: one area, one floor (an area without a floor yields nothing and the next source is tried) | [`ha-core-registries.md` « Read paths »](../research/ha-core-registries.md#read-paths); [`roomba-plus.md` « Device link »](../research/roomba-plus.md#device-link) |
| 2 | The floors of the areas that the robot's `options.vacuum.area_mapping` assigns to this map's segments. The adapter tells which segment ids belong to the map (Roomba+ Classic: `<map id>_<region id>`, matched against known map ids, longest first). Areas without a floor are ignored | None once the core mapping exists | Several floors yields nothing | [`ha-core-vacuum.md` « Area-to-segment mapping »](../research/ha-core-vacuum.md#area-to-segment-mapping); [`roomba-plus.md` « Where a map id can be read »](../research/roomba-plus.md#where-a-map-id-can-be-read) |
| 3 | `map_name` equal to exactly one floor's name or alias, compared as the registries compare names (case folded, spaces removed). Skipped when `map_name` equals the map id. Applies only to an **enabled** floor plan: `map_name` is a state attribute and a disabled entity has no state | None; a mismatch is fixed in Home Assistant by adding the map name as a floor alias; a disabled floor plan is enabled first (« Plan pictures » item 5) | Several floors yields nothing | [`ha-core-registries.md` « Floors », « Fields »](../research/ha-core-registries.md#fields); [`roomba-plus.md` « Floor plans »](../research/roomba-plus.md#floor-plans-translation_key-floor_plan) |
| 4 | Nothing | — | The plan is shown in the « no floor » group with a readable reason and the two Home Assistant fixes (area on the floor plan entity, floor alias). It is never hidden | Design rule settled in #29, from « Honest state » (`docs/product.md`) |

Source 2 applies only to robots with `CLEAN_AREA` and a saved mapping (never a mop robot such as a Braava), and only to maps whose segments were offered when the mapping was saved.

Examples with the fixture ids (floors `ground_floor` « Ground floor » and `upper_floor` « Upper floor »):

- Source 1: if the floor plan `image.robot_one_floor_plan_mapb_z9x8c7` had the area `studio`, whose floor is `upper_floor`, map `MapB_z9X8c7` would link to `upper_floor`. The fixtures assign no area to floor plans, so source 1 yields nothing there.
- Source 2: the vacuum robot's `area_mapping` maps `library` to `MapA_q1W2e3_1` and `studio` to `MapB_z9X8c7_2`. `library` is on `ground_floor` and `studio` on `upper_floor`, so `MapA_q1W2e3` links to `ground_floor` and `MapB_z9X8c7` to `upper_floor`.
- Source 3: the mop robot's map `MapC_k4L5m6` is named « Ground floor », equal to the floor `ground_floor`, so it links there (the mop robot has no mapping, source 2 does not apply).
- Source 4: the mop robot's map `MapD_r7T8y9` is named « Upper level »; no floor has that name or alias, it has no area and no mapping, so it goes to the « no floor » group with a reason.

### Rooms map pairing

The rooms map is the only Roomba+ entity with outlines, and it does not say which stored map it shows ([`roomba-plus.md` « Which map it shows »](../research/roomba-plus.md#which-map-it-shows)).

1. **One stored map** (Roomba+ Classic): the rooms map shows that map. It is paired with it, takes that map's floor and gives its rooms the segment ids `<map id>_<region id>`. The card pairs only when all of these hold:
   - exactly one floor plan entry for the robot in the registry, enabled or not;
   - that floor plan's state is not `unavailable` (a map deleted in the app keeps its entry, unavailable, until the next setup); a disabled one cannot be checked this way;
   - no segment id in the robot's `area_mapping` or `last_seen_segments` matches no known map id.

   Floor plans are created only at the integration's setup (whether a reload is needed is still « à vérifier » live), so a map added or replaced since then has no floor plan yet ([`roomba-plus.md` « Floor plans »](../research/roomba-plus.md#floor-plans-translation_key-floor_plan)). When a check fails, the robot is treated as in item 2.
2. **Several stored maps, none, or a failed check**: not paired. The rooms map is shown as its own plan with its outlines. With several floor plans and every check above otherwise passing, it sits on a floor only when every stored map links to the same floor. In every other case (no floor plan, an unavailable one, a segment id of an unknown map, or maps on different floors) it goes to the « no floor » group with a note that the card cannot tell which stored map it shows. Its rooms get no segment id, so no core-mapping area (« Room to area » rule 1). This is option (a) of [`roomba-plus.md` « Gaps for this card », Epic 3 item 2](../research/roomba-plus.md#epic-3-floor-model-and-geometry).
3. Outlines are drawn only over the rooms map's own picture, never over a floor plan picture. That overlay is still « à vérifier » in the research ([`roomba-plus.md` « Floor plans », derived row](../research/roomba-plus.md#floor-plans-translation_key-floor_plan)).

### Room to area

For one room, tried in order:

1. **The core mapping.** Invert `options.vacuum.area_mapping` into a `Map` (segment ids are untrusted keys): the room's segment id listed under exactly one area that is an own key of `hass.areas` (`Object.hasOwn`, never `in`). Keys that are not areas and empty lists are ignored; a segment under two areas has no area by this rule. This is the only link that may feed ADR 0003 path 1 (`vacuum.clean_area`). Sources: [`ha-core-vacuum.md` « Area-to-segment mapping »](../research/ha-core-vacuum.md#area-to-segment-mapping), [« Gaps for this card », inputs 4 and 5](../research/ha-core-vacuum.md#epic-3-inputs-of-the--start-a-clean--use-case-adr-0003-path-1).
2. **The room name** equal to exactly one area's name or alias, compared as the registries compare names ([`ha-core-registries.md` « Areas », « Fields », `name`](../research/ha-core-registries.md#fields-1)). Used to group the rooms of several robots and to place a room on a floor. It is ignored when the area has a `floor_id` that differs from the plan's floor; for a plan in the « no floor » group it is kept only for an area without a floor. It **never** feeds `vacuum.clean_area`. This is the « otherwise by the integration's room name » of `docs/product.md` « MVP ».
3. **Nothing**: the room belongs to its robot only.

`get_rooms.area_id` is never used: it falls back to names, and the first area wins on ambiguity; the mop robot of the fixtures gets one with no mapping at all ([`roomba-plus.md` « `area_id` in `get_rooms` against core `area_mapping` »](../research/roomba-plus.md#area_id-in-get_rooms-against-core-area_mapping); `test/fixtures/roomba-plus/get_rooms_response.json`).

A floor shows one plan: a plan with clickable outlines before a picture-only plan, then the robot whose vacuum `entity_id` sorts first (design rule settled in #29, from « Core flow » 1 of `docs/product.md`). Other robots join a room through its area: a robot joins when one of its own rooms links to the same area, by rule 1 or rule 2. Each robot then starts the clean with its own link:

- through `vacuum.clean_area` only when its own room links to that area by rule 1 (its own core mapping);
- otherwise through its own room action (ADR 0003 path 2) with its own room id, and only when that room is on the same floor as the plan (its own map links to that floor). A room linked only by name on another floor, or on a map with no floor, never joins.

The confirmation of ADR 0003 names the robot's own room and, for `vacuum.clean_area`, the area it will receive (refinement for #37).

### Room lists

1. A plan without outlines lists the areas that the robot's `area_mapping` assigns to that map's segments, by area name; each is offered through ADR 0003 path 1, subject to ADR 0003's checks (for example an area whose segments span two maps is refused by Roomba+). Sources: [`ha-core-vacuum.md` « Area-to-segment mapping »](../research/ha-core-vacuum.md#area-to-segment-mapping), [`roomba-plus.md` « Gaps for this card », Epic 3 items 1 and 6](../research/roomba-plus.md#epic-3-floor-model-and-geometry).
2. A robot without `CLEAN_AREA` (a mop robot) has no room names for its other maps anywhere in Home Assistant state: its picture-only plans show the picture (room names are drawn into it) and say that rooms cannot be started from this plan. Sources: [`roomba-plus.md` « Gaps for this card », Epic 3 items 1 and 6](../research/roomba-plus.md#epic-3-floor-model-and-geometry), [« Which robots get `CLEAN_AREA` »](../research/roomba-plus.md#which-robots-get-clean_area).

### Plan pictures

1. **URL rule** (owner decision 2). The card builds `/api/image_proxy/<entity_id>?token=<token>&state=<state>` itself, as the frontend does, on that fixed path, each part URL-encoded. `<entity_id>` is an `image.` entity of a detected robot, read in the registry; `<token>` is the `access_token` **attribute** of that entity's state, never the user's session token (`hass.auth`). The path is made absolute by calling `hass.hassUrl(path)`, never by reading `hass.auth.data`. The card never uses `entity_picture` or any URL taken from an attribute, and never logs, stores, displays as text or puts in an error message the URL, the token, or a whole image or camera state object. Sources: [`ha-core-vacuum.md` « URL the frontend shows »](../research/ha-core-vacuum.md#url-the-frontend-shows), [« Security and privacy »](../research/ha-core-vacuum.md#security-and-privacy).
2. **Token rotation**: the token changes every 5 minutes and each rotation writes a new state object, so the URL is rebuilt whenever the entity's state object changes; the card never caches a URL ([« Access token and when it changes »](../research/ha-core-vacuum.md#access-token-and-when-it-changes)).
3. **Unavailable or restored** image entity: no `access_token`, so no picture; the plan shows a readable state instead. **`unknown`** state: no picture yet, same treatment. **Disabled** floor plan: no state at all ([« Disabled, unavailable or unknown image entity »](../research/ha-core-vacuum.md#disabled-unavailable-or-unknown-image-entity)).
4. **Picture size** is not in the state: read `naturalWidth` and `naturalHeight` of the loaded picture, never hard-code 600 ([« Image size »](../research/ha-core-vacuum.md#image-size)).
5. **Disabled floor plans** (Roomba+ creates them disabled) are found only through the shared `config/entity_registry/list` read, filtered by `platform` and device, re-fetched on `entity_registry_updated`, debounced as the frontend does. The card shows « enable this floor plan » guidance to every user and a link to the entity settings only when `hass.user.is_admin`. It never calls `config/entity_registry/update`. Sources: [`ha-core-registries.md` « Gaps for this card », Epic 4 items 2 and 3](../research/ha-core-registries.md#epic-4-robot-detection-and-data-access).

### Permissions

No command or subscription used here needs an admin at core 2026.11.2: `config/{floor,area,device,entity}_registry/list`, `config/entity_registry/get`, and the `floor_registry_updated`, `area_registry_updated`, `device_registry_updated` and `entity_registry_updated` subscriptions. Only registry writes need an admin, and the card makes none. `vacuum/get_segments` (admin only) is never called; segments come from `area_mapping` and `last_seen_segments`. This is verified at source; a live check with a non-admin user is still open. Sources: [`ha-core-registries.md` « Permissions in one place »](../research/ha-core-registries.md#permissions-in-one-place) and its « à vérifier » table, [`ha-core-vacuum.md` « What a non-admin user cannot do »](../research/ha-core-vacuum.md#what-a-non-admin-user-cannot-do).

### Rejected options

| Option | Why not |
|---|---|
| Segment `group` as the map's floor | In core it has no meaning. In Roomba+ a room segment's `group` is the robot's free-text floor label, one value per robot, not per map; a zone segment's `group` is the zone type. Live, room `group` was null. [`roomba-plus.md` « `async_get_segments` »](../research/roomba-plus.md#async_get_segments-what-cores-vacuumget_segments-returns), [« To confirm live (#27) », row 6](../research/roomba-plus.md#to-confirm-live-27) |
| The robot's position | Not readable on Classic robots. [`roomba-plus.md` « Which map it shows »](../research/roomba-plus.md#which-map-it-shows) |
| Cloud zone selects | `pmap_id` only on the enabled select, `is_active_map` fixed at setup. [`roomba-plus.md` « Where a map id can be read »](../research/roomba-plus.md#where-a-map-id-can-be-read) |
| `get_rooms` (`map_id`, `area_id`) | Cloud-active map only (Classic), and a service call; its `area_id` falls back to a name guess. [`roomba-plus.md` « `roomba_plus.get_rooms` »](../research/roomba-plus.md#roomba_plusget_rooms) |
| Floor `level` | Does not order floors and does not name them. [`ha-core-registries.md` « Floor order »](../research/ha-core-registries.md#floor-order) |
| Pairing a multi-map rooms map by matching region ids and names against `last_seen_segments` | Not adopted: it depends on the room-name override on a two-map account, still « à vérifier » ([`roomba-plus.md` « à vérifier », row 2](../research/roomba-plus.md#-à-vérifier-)). The upstream request for a `map_id` attribute stays a draft for the owner |
| A card option linking maps or floors | User maintenance inside the card, against « Zero maintenance » (`docs/product.md`); not needed now that two Home Assistant fixes exist (area on the floor plan, floor alias). If an option is ever added (`owner-only`), it keys plans and floors by the floor plan `entity_id`, never by a map id or `unique_id`, which embed the robot identifier ([`roomba-plus.md` « Gaps for this card », Security item 4](../research/roomba-plus.md#security)) |

## Consequences

- Every link the card needs works with no card option. The user acts only in Home Assistant, and only when the automatic sources fail: an area on a floor plan entity, a floor alias, or the core segment mapping.
- A robot with several stored maps shows its outlines on a floor only when all its maps link to the same floor; otherwise its rooms map appears in the « no floor » group with a note. An upstream `map_id` attribute on the rooms map would remove that limit.
- A mop robot without `CLEAN_AREA` offers no room list for its maps without outlines.
- The card reads the whole entity registry once and on each update; size and latency were measured on an installation of about 1,000 entities ([`ha-core-registries.md` « à vérifier »](../research/ha-core-registries.md#-à-vérifier-)).
- The wording of reasons and labels is decided in Epic 5, with `src/i18n/en.json` and `fr.json`.
