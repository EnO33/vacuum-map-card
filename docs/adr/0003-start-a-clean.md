# ADR 0003: Starting a clean

- Status: accepted
- Date: 2026-11-23 (proposed 2026-11-20)

## Context

Home Assistant core cleans by area: `vacuum.clean_area` takes area ids and cleans the vacuum segments mapped to them in the vacuum's entity settings. It first shipped in 2026.3.0, the card's minimum version (`docs/standards.md`). Integrations keep their own room actions (Roomba+: `roomba_plus.clean_room`).

The facts below were verified at source on 2026-11-23, at Home Assistant core 2026.11.2, frontend 20261028.6 and Roomba+ 4.6.5, with live captures where stated. No service that moves a robot was called:

- [`ha-core-vacuum.md`](../research/ha-core-vacuum.md)
- [`roomba-plus.md`](../research/roomba-plus.md)
- fixtures in `test/fixtures/`

ADR 0005 covers how rooms link to areas, which rooms map is paired with a stored map, and which robots may join a room.

## Decision

### Eligibility (both paths)

A robot is offered for a room only when its vacuum entity was found by registry `platform` (ADR 0002) and is present in `hass.states` with a state other than `unavailable`. Otherwise the robot is shown as not startable, with a reason; it never falls back to another path. Calls to a missing, disabled or unavailable vacuum succeed and do nothing ([`ha-core-vacuum.md` « Calls that succeed and do nothing »](../research/ha-core-vacuum.md#calls-that-succeed-and-do-nothing)).

### Path 1: `vacuum.clean_area`

**Where it applies.** It applies in two places:
- a room of a paired rooms map (ADR 0005 « Rooms map pairing », one stored map), through the room's segment id `<map id>_<region id>`;
- an area item of a plan without outlines (ADR 0005 « Room lists » item 1), whose area is given.

**Condition.** All of these hold:

1. `supported_features & 16384` (`CLEAN_AREA`) is set. A mop robot (Roomba+ Braava) never has it.
2. `hass.services.vacuum.clean_area` exists.
3. The vacuum's `options.vacuum.area_mapping` is present and parses as area id → list of segment ids. Keys that are not own keys of `hass.areas` and empty lists are ignored.
4. For a room: its area comes from ADR 0005 « Room to area » rule 1, that is, exactly one area of **this robot's** mapping lists the room's segment id.
5. All segments of that area are on one stored map. Roomba+ refuses a mix with `rooms_different_floors`.
6. Every segment of that area can be named in the confirmation:
   - on a paired rooms map, it is a region currently on that map;
   - otherwise, it is in `last_seen_segments`.

   In both cases, no `segments_changed` repair issue is open for the robot. Core never updates the mapping when segments change, and Roomba+ replaces a vanished region by a room with the same stored label, or drops it.

The mapping is read from the shared `config/entity_registry/list` (or `config/entity_registry/get`), re-fetched on `entity_registry_updated`. Repair issues are listed without admin. Sources:
- [`ha-core-vacuum.md` « Gaps for this card », inputs 1 to 5](../research/ha-core-vacuum.md#epic-3-inputs-of-the--start-a-clean--use-case-adr-0003-path-1)
- [« Target and feature flag »](../research/ha-core-vacuum.md#target-and-feature-flag)
- [« When the integration reports different segments »](../research/ha-core-vacuum.md#when-the-integration-reports-different-segments)
- [`roomba-plus.md` « Which robots get `CLEAN_AREA` »](../research/roomba-plus.md#which-robots-get-clean_area)
- [« `async_clean_segments` »](../research/roomba-plus.md#async_clean_segments-what-vacuumclean_area-calls-and-the--active-map-filter-)
- [« Gaps for this card », Epic 4 item 3](../research/roomba-plus.md#epic-4-adapter)

When a condition fails for an area item of a room list, that item is not startable on this robot, with a reason. When it fails for a room of a rooms map, the robot falls back to path 2 under that path's rules.

**Call.** One robot and one area per call, only after confirmation, never on hover, load or re-render:

```
hass.callService("vacuum", "clean_area", { cleaning_area_id: [areaId] }, { entity_id }, false, false)
```

There is no `return_response`: the service has no response. One area per call avoids a partial start, because `areas_not_mapped` is raised after the robots with mapped areas were called. Sources: [`ha-core-vacuum.md` « Fields »](../research/ha-core-vacuum.md#fields), [« Response »](../research/ha-core-vacuum.md#response), [« Gaps for this card », inputs 6 and 7](../research/ha-core-vacuum.md#epic-3-inputs-of-the--start-a-clean--use-case-adr-0003-path-1).

**Example.** In the fixtures, `vacuum.robot_one` has `supported_features` 29500 (`29500 & 16384` is set; `test/fixtures/ha-core/hass_states_vacuum_docked.json`) and two stored maps, so its rooms map is not paired (ADR 0005). Its mapping lists `library` → `["MapA_q1W2e3_1"]` (`entity_registry_get_vacuum_clean_area.json`). The plan of map `MapA_q1W2e3` therefore lists the area `library`, and choosing it calls `clean_area` with `["library"]`.

**Counter-example.** `vacuum.robot_two` has `supported_features` 13116 (no `CLEAN_AREA`, same states fixture) and no `options.vacuum` (`entity_registry_get_vacuum_no_clean_area.json`), so it uses path 2 only.

### Path 2: the integration's room action

**When.** Only for a room of a rooms map, when any path 1 condition fails:
- no `clean_area` service;
- no `CLEAN_AREA`;
- no mapping;
- the room's segment is in no area, or in an empty one;
- the room's segment is under several areas;
- the area's segments span two maps (condition 5);
- a segment of the area cannot be named (condition 6).

Path 2 needs the room's `region_id` from the rooms map, so an area item of a room list never uses it. Sources: [`ha-core-vacuum.md` « Fallback (ADR 0003 path 2) »](../research/ha-core-vacuum.md#fallback-adr-0003-path-2), [`roomba-plus.md` « Gaps for this card », Epic 4 item 3](../research/roomba-plus.md#epic-4-adapter) (« or the card uses path 2 »).

**Call.** For Roomba+, `roomba_plus.clean_room`, after confirmation, with the data field `entity_id` (one id) and `room_name` set to the room's `region_id` **only**, never the room name:

```
hass.callService("roomba_plus", "clean_room", { entity_id, room_name: regionId }, undefined, false, false)
```

The data field is the form proven live with `get_rooms` (#27). At source, `target: {entity_id}` is equivalent for `clean_room` (`cv.entity_ids` plus core's merge of the target into the data).

**Not offered when a name can shadow the id.** Roomba+ resolves `room_name` by case-insensitive name first, then by slug, then by bare region id. So path 2 is not offered for a room when another room of the same rooms map has a `name` or a `room_id` equal to this room's `region_id`. For a robot with a mapping, the same check runs against the names in `last_seen_segments`. Names are normalised generously before comparing (ASCII-folded, non-alphanumerics dropped, lower-cased), because Roomba+ also matches by slug: matching too much only withdraws path 2, which is the safe side. The room is then offered through path 1 only, or shown as not startable with a reason.

**Errors and risks.**
- `unknown_rooms` is shown as a readable error and never retried with the name.
- Residual risks (owner decision, 2026-11-23, comment on #37: path 2 stays allowed on robots with several stored maps; risks recorded):
  - names on other maps and stored names are not visible to the card, so the shadow check above can miss one;
  - on a robot whose several maps are offered, a region id shared by two maps is refused (`unknown_rooms`). Region ids are per-map ordinals, so this is frequent on multi-map robots;
  - after the robot reported error 224, the rooms map shows the newest map ([`roomba-plus.md` « Which map it shows »](../research/roomba-plus.md#which-map-it-shows)), while the maps Roomba+ offers for room targeting follow where the robot says it is, with no 224 exception ([room_cleaning.py#L306-L349](https://github.com/johnnyh1975/ha_roomba_plus/blob/v4.6.5/custom_components/roomba_plus/room_cleaning.py#L306-L349), `_maps_to_offer`). A region id can then target the same number on another map. Whether `clean_room` resolves through those offered maps, and what the robot then does (fail to localise with 224, or clean that region of the other map), is « à vérifier »;
  - between a re-map and Roomba+'s `segments_changed` issue (opened only after 3 differing cloud refreshes in a row, with the cloud), condition 6 cannot see a vanished segment on a map without a paired rooms map, because `last_seen_segments` is a snapshot ([`roomba-plus.md` « `async_clean_segments` », last row](../research/roomba-plus.md#async_clean_segments-what-vacuumclean_area-calls-and-the--active-map-filter-)). Roomba+ then cleans a same-label room or drops the segment.
- Residual risks on the same map (owner decision, 2026-11-24, security review of #53: accepted, the card does not read these names). Roomba+ also resolves `room_name` against names the rooms map does not show, so the shadow check cannot see them:
  - the active map's cloud zones, added to the name list as `zid_<id>` ([room_cleaning.py#L2082-L2110](https://github.com/johnnyh1975/ha_roomba_plus/blob/v4.6.5/custom_components/roomba_plus/room_cleaning.py#L2082-L2110)); a zone whose name reduces to a region id would be cleaned instead of that room;
  - a room's iRobot account name, which stays matchable when the room has an alias ([L2224-L2259](https://github.com/johnnyh1975/ha_roomba_plus/blob/v4.6.5/custom_components/roomba_plus/room_cleaning.py#L2224-L2259)), while the rooms map shows the alias; an account name that reduces to another room's region id would send the robot there;
  - a region of the active map with no cloud name is skipped from the name list ([L2087](https://github.com/johnnyh1975/ha_roomba_plus/blob/v4.6.5/custom_components/roomba_plus/room_cleaning.py#L2087)), while the rooms map still draws it; its bare id can then resolve to the same region id of another offered map ([L125-L139](https://github.com/johnnyh1975/ha_roomba_plus/blob/v4.6.5/custom_components/roomba_plus/room_cleaning.py#L125-L139)), on a multi-map robot whose location is unknown. What the robot then does is « à vérifier ».

  Reading the cloud zone selects and `get_rooms` account names into the check is possible later (Epic 4 adapter); it is not part of the MVP.

**Run options.**
- The MVP sends no `cleaning_mode`, so the cleaning mode select's state applies, as in path 1.
- If a later feature lets the user choose a mode, only a value from that select's `options` is sent.
- `pad_wetness`, `smart_scrub` and `two_pass` are never sent (point 4).

Sources:
- [`roomba-plus.md` « `roomba_plus.clean_room` »](../research/roomba-plus.md#roomba_plusclean_room) (resolution order, known risk)
- [« `cleaning_mode` for a vacuum robot and a mop robot »](../research/roomba-plus.md#cleaning_mode-for-a-vacuum-robot-and-a-mop-robot)
- [« Which map it shows »](../research/roomba-plus.md#which-map-it-shows)
- [« `async_get_segments` »](../research/roomba-plus.md#async_get_segments-what-cores-vacuumget_segments-returns) (maps offered)
- [« Gaps for this card », Epic 4 item 3](../research/roomba-plus.md#epic-4-adapter)

A robot that joins a room of another robot's plan through a name link uses path 2, and only for its own room on the same floor (ADR 0005 « Room to area »).

### Checks before calling

Some calls succeed and do nothing. The card prevents them with checks before the call, not with error handling.

| Silent case | Check that prevents it |
|---|---|
| Target vacuum unavailable, disabled or missing: dropped by core, success returned | « Eligibility »: the robot is not startable |
| Area mapped to `[]`: counted as handled, nothing sent | Condition 3: empty lists are ignored, so such an area is not offered |
| On core 2026.3.x and 2026.4.x, an area that is not a key of the mapping: success, nothing sent (`areas_not_mapped` exists from 2026.5.0) | Condition 4 and room lists: the area comes from this robot's own mapping |
| Roomba+: a segment id naming no known map: dropped with a warning | ADR 0005 « Rooms map pairing »: segment ids are built only from a known map id |
| Roomba+: a segment that vanished after a re-map: replaced by a room with the same stored label, or dropped | Condition 6 narrows it; a window remains (« Path 2 », residual risks) |

**When the checks run.** Opening the dialog captures one immutable intent:
- the robot's `entity_id` and the path;
- `areaId` or `regionId`, and the map id when known;
- the names shown.

On confirm, the card re-evaluates « Eligibility » and the conditions of that path against the current `hass`. If anything differs from the intent, it sends nothing and asks the user to try again; the wording is decided in Epic 5. That covers the robot's availability, the area mapping, the rooms map snapshot and the chosen path. The comparison uses captured values, never object identity: core rewrites every image state every 5 minutes (token rotation), which must not refuse an open dialog. For the rooms map, the intent keeps only its `state` string and a projection of `rooms` (`region_id`, `name`, `room_id`) plus the map id, never the state object or `attributes`, which carry `access_token` (ADR 0005 « Plan pictures »). A state change between opening and confirming therefore never sends a different room.

A successful call means « accepted », not « cleaning ». Progress comes only from later state changes of the vacuum entity. Sources:
- [`ha-core-vacuum.md` « Calls that succeed and do nothing »](../research/ha-core-vacuum.md#calls-that-succeed-and-do-nothing)
- [« First versions »](../research/ha-core-vacuum.md#first-versions)
- [« Gaps for this card », input 8](../research/ha-core-vacuum.md#epic-3-inputs-of-the--start-a-clean--use-case-adr-0003-path-1)
- [« Fallback »](../research/ha-core-vacuum.md#fallback-adr-0003-path-2)
- [`roomba-plus.md` « `async_clean_segments` »](../research/roomba-plus.md#async_clean_segments-what-vacuumclean_area-calls-and-the--active-map-filter-)
- [« When the attributes change »](../research/roomba-plus.md#when-the-attributes-change)

### Confirmation

Every start is confirmed by the user in a dialog (point 3). The dialog names the robot, the action and the robot's own room.

- **The area for path 1.** For path 1 it also names the area that `vacuum.clean_area` receives (ADR 0005). Because the call cleans the whole area, when that area maps to several segments the dialog names every room that will be cleaned ([`ha-core-vacuum.md` « How the call resolves »](../research/ha-core-vacuum.md#how-the-call-resolves)).
- **The action** comes from the adapter, never from core, which has no notion of mopping. Roomba+ order, first match wins:
  1. a `detected_pad` key on the vacuum means a mop robot (a Braava always reads « mop »);
  2. else, when the robot has a cleaning mode select:
     - its state `vacuum`, `mop`, `vacuum_and_mop` or `vacuum_then_mop` names the action;
     - if its state is `unknown` or `unavailable` and its `options` include both a vacuum mode and a mop mode, the dialog uses the neutral verb « clean » (exception below);
  3. else no select on a Classic robot means vacuum only;
  4. the SKU prefix last.

  Sources: [`ha-core-vacuum.md` « Mopping versus vacuuming »](../research/ha-core-vacuum.md#mopping-versus-vacuuming), [`roomba-plus.md` « Vacuum robot or mop robot, from Home Assistant state only »](../research/roomba-plus.md#vacuum-robot-or-mop-robot-from-home-assistant-state-only).
- **Exception to point 3** (owner decision, 2026-11-23, #37). Step 2 above is the only case where the dialog does not name vacuum or mop. No mode is sent and the robot uses its own setting, so the dialog says « Send <robot> to clean <room>? », and the robot stays in the picker.

  Live, a cleaning mode select was `unknown` with all four options. That robot was a mop robot, which step 1 reads as « mop » ([`roomba-plus.md` « Gaps for this card », Epic 4 item 4](../research/roomba-plus.md#epic-4-adapter), [« To confirm live (#27) », row 7](../research/roomba-plus.md#to-confirm-live-27)).
- **One send per confirmation.** The card never retries, and one confirmation sends at most one call (how the dialog and the call follow each other: « Amendment (2026-11-24) », « Where the result shows »): Roomba+ may already re-send an ignored start once on its own ([`roomba-plus.md` « Gaps for this card », Security item 5](../research/roomba-plus.md#security)).
- **No path switch after an error.** The card never falls back to path 2 after a path 1 error, in particular after `Unauthorized`.

The final wording is decided in Epic 5, with `src/i18n/en.json` and `fr.json`.

### Errors

Calls use `notifyOnError = false`, so the error is shown by the card only, on the room and in its status line after the dialog closes (« Amendment (2026-11-24) »), not also as a Home Assistant toast ([`ha-core-vacuum.md` « Response »](../research/ha-core-vacuum.md#response)).

The card shows its own localised text, chosen from `error.code` and `error.translation_key`. It shows the raw `message` only as a fallback, and as text. Placeholders are shown only as text: Roomba+'s `known` lists every room name, which is untrusted. This replaces the earlier consequence « with the integration's message » ([`ha-core-vacuum.md` « Relation to ADR 0003 »](../research/ha-core-vacuum.md#relation-to-adr-0003-and-to-the-previous-document)).

Core cases ([`ha-core-vacuum.md` « Errors »](../research/ha-core-vacuum.md#errors)):

| Case | `code` / `translation_key` | The user is told | Robot may have started? |
|---|---|---|---|
| 1. Bad call data | `invalid_format` | The card could not start the clean (a card problem) | No |
| 2. `return_response` sent | `service_does_not_support_response` | Same as 1 (never sent by the card) | No |
| 3. Robot lacks area cleaning | `service_not_supported` | This robot cannot clean by area | No |
| 4. User not allowed to control the robot | `home_assistant_error`, message `Unauthorized`, no key | You are not allowed to control this robot; ask an administrator | No |
| 5. Robot has no registry entry | `unknown_error` | Shown as an unknown error (see the note below) | Unknown |
| 6. No mapping saved | `area_mapping_not_configured` | The robot's rooms are not linked to areas; how to link them in Home Assistant | No |
| 7. Area not mapped | `areas_not_mapped` | This area is not linked to the robot | Possibly, with several areas; never with the card's one area per call |
| 8. The integration refused | the integration's key (Roomba+ table below) | The integration's reason, mapped below | Integration-specific |
| 9. The integration does not implement area cleaning | `unknown_error` | Same as 5 | Unknown |
| 10. Service missing | `not_found` / `service_not_found` | This Home Assistant version cannot clean by area | No |

`unknown_error` (cases 5 and 9) is also the code core sends for any unexpected exception in the called service ([commands.py#L397-L399](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/components/websocket_api/commands.py#L397-L399)), including one raised after the integration sent the start command (Roomba+ 4.6.5 records the command after `send_command("start")` outside any `try`). The card cannot tell these apart, so `unknown_error` is shown as an unknown error that may have started the robot, without its message, which is the exception text (owner decision, 2026-11-24, reviews of #55).

Roomba+ cases, `translation_domain` `roomba_plus`, websocket code usually `service_validation_error` ([`roomba-plus.md` « `roomba_plus.clean_room` »](../research/roomba-plus.md#roomba_plusclean_room), [« `async_clean_segments` »](../research/roomba-plus.md#async_clean_segments-what-vacuumclean_area-calls-and-the--active-map-filter-)).

Every key below is raised before the start command is published. The handler checks run before `backend.clean_rooms` ([services.py#L670-L820](https://github.com/johnnyh1975/ha_roomba_plus/blob/v4.6.5/custom_components/roomba_plus/services.py#L670-L820), [L1146-L1185](https://github.com/johnnyh1975/ha_roomba_plus/blob/v4.6.5/custom_components/roomba_plus/services.py#L1146-L1185), [service_guard.py#L55-L62](https://github.com/johnnyh1975/ha_roomba_plus/blob/v4.6.5/custom_components/roomba_plus/service_guard.py#L55-L62)). The Classic backend raises in `clean_rooms` before `send_command("start")` at [room_cleaning.py#L2592](https://github.com/johnnyh1975/ha_roomba_plus/blob/v4.6.5/custom_components/roomba_plus/room_cleaning.py#L2592) ([L2350-L2365](https://github.com/johnnyh1975/ha_roomba_plus/blob/v4.6.5/custom_components/roomba_plus/room_cleaning.py#L2350-L2365)), and in `clean_segments` before [L3018](https://github.com/johnnyh1975/ha_roomba_plus/blob/v4.6.5/custom_components/roomba_plus/room_cleaning.py#L3018) ([L2778-L2930](https://github.com/johnnyh1975/ha_roomba_plus/blob/v4.6.5/custom_components/roomba_plus/room_cleaning.py#L2778-L2930)).

| `translation_key` | The user is told | Robot may have started? |
|---|---|---|
| `not_smart_map` | This robot has no room map | No |
| `no_rooms_configured` | The robot's account lists no room yet | No |
| `no_rooms_resolved` | Nothing to clean was sent (a card problem) | No |
| `room_name_is_a_zone` | This is a zone, not a room | No |
| `unknown_rooms` | The robot could not find this room, or found it on several of its maps; try from the robot's app | No |
| `cloud_required` | Room cleaning needs the iRobot account in the integration | No |
| `map_updating` | The robot is rebuilding its map; try later | No |
| `entity_not_found`, `config_entry_not_found`, `entry_not_loaded` | The integration is not ready for this robot | No |
| `rooms_different_floors` | These rooms are on different maps; clean them one map at a time | No |
| `no_valid_segments` | The robot's current map does not contain this room | No |
| `room_list_not_read` (a `HomeAssistantError`, websocket code `home_assistant_error`; not in the research table, [room_cleaning.py#L2345-L2347](https://github.com/johnnyh1975/ha_roomba_plus/blob/v4.6.5/custom_components/roomba_plus/room_cleaning.py#L2345-L2347)) | The robot's room list is not loaded yet; try later | No |
| `room_map_unknown` (not in the research table, [room_cleaning.py#L2383-L2387](https://github.com/johnnyh1975/ha_roomba_plus/blob/v4.6.5/custom_components/roomba_plus/room_cleaning.py#L2383-L2387)) | The robot does not know which map this room is on | No |

### Permissions

The flow needs no admin-only command at core 2026.11.2. Verified at source; a live call as a non-admin user was not made.

- **Reading `area_mapping`** (`config/entity_registry/list` or `get`) and listing repair issues are allowed for every user.
- **`vacuum.clean_area`** is allowed unless the user's entity permissions deny `control` on the vacuum (case 4).
- **`roomba_plus.clean_room`** is a plain domain service: Roomba+ 4.6.5 checks no entity permission ([`roomba-plus.md` « Actions »](../research/roomba-plus.md#actions)). The card adds no capability a user does not already have through Home Assistant.
- **`vacuum/get_segments`** (admin only) is never called, and the card never writes the mapping.

When the mapping is missing, a non-admin user is told to ask an administrator. An administrator also gets a link to the vacuum's entity settings, built from the registry entity id on a fixed Home Assistant path and shown only when `hass.user.is_admin`. The wording is decided in Epic 5. Source: [`ha-core-vacuum.md` « What a non-admin user cannot do »](../research/ha-core-vacuum.md#what-a-non-admin-user-cannot-do).

### Points kept

3. Every start is confirmed by the user in a dialog that names the robot, the action (vacuum or mop) and the room, with the one exception in « Confirmation ».
4. The card never chains robots, adds conditions (pad state, water level) or sets run options (`pad_wetness`, `smart_scrub`, `two_pass`): that belongs to the user's automations and scripts. Pad state is shown in the picker after the first release (owner decision 2026-11-24, epic #97 « Owner decisions », item 3), never blocking ([`roomba-plus.md` « States and eligibility attributes »](../research/roomba-plus.md#states-and-eligibility-attributes), [« Gaps for this card », Epic 4 item 7](../research/roomba-plus.md#epic-4-adapter)). An option may later let the user point a robot to a script instead of a direct action.

## Consequences

- Path 1 works the same for every integration that supports core area cleaning, once the vacuum's segments are mapped to areas. The adapter still names the action and links rooms to segments (ADR 0002 amendment).
- Errors are shown on the card and the room in plain words chosen by the card, with the integration's message only as a fallback.
- A mop robot without area cleaning always uses its integration's action, through its adapter, with the residual risks recorded under « Path 2 ».
- On robots with several stored maps, a tapped outline uses path 2 (the rooms map is not paired), where a shared region id is often refused (`unknown_rooms`). The room lists of their plans start areas through path 1, which does not depend on region ids.

## Amendment (2026-11-24)

Epic 5 settled how the confirmation is shown: Home Assistant's standard confirmation through the card helpers, with the card's own dialog only as a fallback (owner decision 2026-11-24, epic #97 « Owner decisions », item 1; ADR 0004 « Amendment (2026-11-24) », « Confirmation »). This amendment says where the result of a start shows and how progress on a room is derived. Eligibility, the two paths, the checks before calling, the error tables and the permissions are unchanged.

### Where the result shows

1. When the picker's choice is made, the card captures the intent with the clean controller's `prepare` (« When the checks run »), then opens the confirmation: `showConfirmationDialog` from the card helpers, or the card's own dialog when the helpers are missing.
2. The card does not pass the start as the dialog's `action`. With `action`, a rejected promise leaves the standard dialog open with no message, so an error could not be shown there ([`ha-frontend.md` § 3 « Dialogs »](../research/ha-frontend.md#3-dialogs), [« Gaps for this card », item 3](../research/ha-frontend.md#gaps-for-this-card)).
3. The dialog resolves first. On `true`, the card calls the controller's `confirm` once with that intent. On `false` (Cancel, or Escape), it calls `dismiss` and nothing is sent. The card's own fallback dialog behaves the same way: it closes when the user confirms, before the call.
4. The outcome shows on the room and in a status line of the card that is announced to screen readers (`role="status"`, present in the page before its text changes, so that the change is announced). The room's accessible name includes its progress. The stored outcomes are `accepted`, `changed` and `error` (`src/app/start-clean/outcomes.ts`). An error uses the card's own text, chosen as in « Errors ». When the error is a missing mapping, the administrator's link to the vacuum's entity settings (« Permissions ») shows on the card with it.
5. A `busy`, `already_sent` or `discarded` answer stores nothing; the status line says that nothing was sent.
6. When the card is shown in the card editor (`preview` is `true`), it never starts a robot ([`ha-frontend.md` § 7 « Card sizing »](../research/ha-frontend.md#7-card-sizing), [« Gaps for this card », item 10](../research/ha-frontend.md#gaps-for-this-card)).

This replaces « the error is shown once, in the dialog » (« Errors ») and « the confirm button is disabled while the call runs » (« Confirmation »): with the standard confirmation, the dialog is closed while the call runs. The one-send rule is unchanged. One confirmation leads to at most one `confirm` call, and the controller sends nothing for an intent already confirmed (`already_sent`) or for a robot whose start is still in flight (`busy`).

### Progress on a room

Progress belongs to the robot that was started and shows on the room it was sent to. It is derived from the stored outcome of `confirm` and from the states the vacuum entity reports after it. `accepted` means Home Assistant accepted the call, never « cleaning » (« When the checks run »).

| Progress | When |
|---|---|
| Sending | While `confirm` runs |
| Starting | After `accepted`, until the vacuum reports `cleaning` |
| Cleaning | While the vacuum reports `cleaning` |
| Paused | On `paused` |
| Done | On the first `returning`, `docked` or `idle` after `cleaning` |
| Failed | On an `error` outcome whose robot cannot have started (`mayHaveStarted` is `no`), or on the `error` state after the start |
| May have started | On an `error` outcome whose robot may have started (`mayHaveStarted` is `possibly` or `unknown`, « Errors »). The error is shown, and the rows of this table apply again from the next vacuum state |
| Not started | On a `changed` outcome: nothing was sent, and the user is asked to try again |
| Status unknown | On `unavailable` or `unknown`, or when the vacuum leaves `hass.states`. It does not end the progress: when a state above comes back, its row applies again |

The vacuum states are `cleaning`, `docked`, `idle`, `paused`, `returning` and `error`, plus `unavailable` and `unknown`; a disabled or removed vacuum has no state at all ([`ha-core-vacuum.md` « States the card can see »](../research/ha-core-vacuum.md#states-the-card-can-see), [const.py#L32-L40](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/components/vacuum/const.py#L32-L40) at core 2026.11.2).

Progress is kept in memory until the user dismisses it (the controller's `acknowledge`, through a keyboard-reachable control) or starts that robot again. Nothing is persisted: a page reload loses it (epic #97 « Non-goals »). The colours of these states are in ADR 0004 « Amendment (2026-11-24) », « State colours ».

### Open points

These are left to the issue that builds the progress, and go to the owner when they change what the user is told:

1. « Starting » has no end when the robot accepts the call but never reports `cleaning`.
2. A robot that docks in the middle of a job (to recharge or empty its bin) and then resumes would read as « Done ». Whether Roomba+ robots do this, and in which states, is « à vérifier ».
3. A robot that was not docked or idle when it was started (already `cleaning`, `paused` or `returning`, which « Eligibility » allows) can show « Cleaning » and « Done » for a job that is not this room's.
4. Two robots sent to the same room show two progresses on one room; how they are drawn together is not decided.
