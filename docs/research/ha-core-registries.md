# Home Assistant core: floor, area, device and entity registries

Status: **verified at source** on 2026-11-23 (date read for every fact below) against Home Assistant core `2026.11.2` (commit `ff5d56b825a0fb66b03d01bc297d49e206cdaba3`) and the frontend it ships, `20261028.6`. Not yet checked against a live instance: every JSON example is built from the source, and the live capture is #26. Re-check at every `/check-versions` that moves the latest Home Assistant release.

Method: files read with `gh api repos/home-assistant/{core,frontend}/contents/<path>?ref=<tag>` (base64 decoded), line numbers taken from that output. Links below point to the same tag. `C:` means `https://github.com/home-assistant/core/blob/2026.11.2/`, `F:` means `https://github.com/home-assistant/frontend/blob/20261028.6/`; every link is written in full.

Out of scope: vacuum services, segments, the vacuum segment-to-area mapping and image entities (#24); live captures and fixtures (#26).

## Versions covered

| Fact | Source | Checked |
|---|---|---|
| Core `2026.11.2` is commit `ff5d56b825a0fb66b03d01bc297d49e206cdaba3`, released 2026-11-16, latest stable on the date read | `gh api repos/home-assistant/core/commits/2026.11.2`, `gh api repos/home-assistant/core/releases` | 2026-11-23 |
| Core `2026.11.2` pins `home-assistant-frontend==20261028.6` | [C: homeassistant/components/frontend/manifest.json#L25](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/components/frontend/manifest.json#L25) | 2026-11-23 |
| Frontend `20261028.8` (released 2026-11-20) is the latest frontend release and is pinned on core `dev`, not in `2026.11.2` | `gh api repos/home-assistant/frontend/releases`; `homeassistant/components/frontend/manifest.json` at `ref=dev` | 2026-11-23 |
| Between frontend `20261028.6` and `20261028.8` only 5 files changed (`pyproject.toml`, `src/components/ha-hls-player.ts`, `src/components/ha-web-rtc-player.ts`, `src/data/weather.ts`, `src/panels/config/integrations/integration-panels/mqtt/mqtt-subscribe-card.ts`); none of the files cited here | `gh api repos/home-assistant/frontend/compare/20261028.6...20261028.8` | 2026-11-23 |

**Version note.** Issue #23 says « frontend 20261028.8 ». The frontend actually shipped with core 2026.11.2 is `20261028.6` (manifest above), which `docs/research/ha-frontend.md` already states; `docs/standards.md` lists `20261028.8` as the latest frontend *release*, which is also true. This document cites `20261028.6`; every fact holds for `20261028.8` too because none of the cited files changed between the two tags.

## Permissions in one place

| Fact | Source |
|---|---|
| `require_admin` raises `Unauthorized` when the connection's user is missing or not admin | [C: homeassistant/components/websocket_api/decorators.py#L54-L69](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/components/websocket_api/decorators.py#L54-L69) |
| In the four `config/*_registry.py` files, `require_admin` decorates only write commands (`create`, `update`, `delete`/`remove`, `reorder`, `settings/update`). No read command (`list`, `list_for_display`, `get`, `get_entries`, `list_linked_devices`, `list_composite_splits`, `get_automatic_entity_ids`, `settings/get`) carries it | floor: [L51, L83, L109, L141](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/components/config/floor_registry.py#L51); area: [L53, L91, L123, L161](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/components/config/area_registry.py#L53); device: [L150, L282, L299](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/components/config/device_registry.py#L150); entity: [L153, L296, L378](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/components/config/entity_registry.py#L153) |
| No read command filters entries by the user's entity permissions: they return the whole registry to any authenticated user | same files, list bodies cited per section below |
| `subscribe_events` refuses an event type that is not in `SUBSCRIBE_ALLOWLIST` unless the user is admin | [C: homeassistant/components/websocket_api/commands.py#L186-L225](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/components/websocket_api/commands.py#L186-L225) (check at L199-L205) |
| `SUBSCRIBE_ALLOWLIST` contains `area_registry_updated`, `device_registry_updated`, `entity_registry_updated` and `floor_registry_updated` (plus `state_changed`, `label_registry_updated` and others) | [C: homeassistant/auth/permissions/events.py#L30-L50](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/auth/permissions/events.py#L30-L50) |
| The frontend exposes the current user as `hass.user` (`CurrentUser`, with `is_admin: boolean`) | [F: src/types.ts#L112-L116](https://github.com/home-assistant/frontend/blob/20261028.6/src/types.ts#L112-L116), [L330](https://github.com/home-assistant/frontend/blob/20261028.6/src/types.ts#L330) |

So at 2026.11.2 a non-admin dashboard user can read all four registries and subscribe to their update events; only changing them (for example enabling a disabled entity) needs an admin.

## Floors

### Fields

`config/floor_registry/list` returns an array of `_entry_dict(entry)` ([C: homeassistant/components/config/floor_registry.py#L25-L39](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/components/config/floor_registry.py#L25-L39), [L157-L168](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/components/config/floor_registry.py#L157-L168)). Types from `FloorEntry` ([C: homeassistant/helpers/floor_registry.py#L74-L81](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/floor_registry.py#L74-L81)) and its base `NormalizedNameBaseRegistryEntry` ([C: homeassistant/helpers/normalized_name_base_registry.py#L13-L24](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/normalized_name_base_registry.py#L13-L24)); frontend type `FloorRegistryEntry` ([F: src/data/floor_registry.ts#L7-L13](https://github.com/home-assistant/frontend/blob/20261028.6/src/data/floor_registry.ts#L7-L13), with `RegistryEntry` [F: src/data/registry.ts#L3-L6](https://github.com/home-assistant/frontend/blob/20261028.6/src/data/registry.ts#L3-L6)).

| Field | Wire type | Null? | Notes |
|---|---|---|---|
| `floor_id` | string | no | Generated once from the name with `slugify`, suffixed `_2`, `_3`… on collision ([C: normalized_name_base_registry.py#L70-L77](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/normalized_name_base_registry.py#L70-L77)); renaming the floor does not change it |
| `name` | string | no | Unique after case folding and space removal ([C: floor_registry.py#L207-L210](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/floor_registry.py#L207-L210)) |
| `level` | integer | yes | Any integer or null ([C: config/floor_registry.py#L48, L105](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/components/config/floor_registry.py#L48)) |
| `icon` | string | yes | |
| `aliases` | string[] | no | Stored as a set: order not meaningful |
| `created_at` | number (Unix seconds, float) | no | `0` for floors created before storage version 1.2 ([C: floor_registry.py#L99-L103](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/floor_registry.py#L99-L103)) |
| `modified_at` | number (Unix seconds, float) | no | |

There is no order field: the order is the array position (next section).

### Floor order

| Fact | Source |
|---|---|
| The registry keeps floors in a Python dict; `async_list_floors` returns `self.floors.values()`, so the list command returns floors in dict order | [C: homeassistant/helpers/floor_registry.py#L187-L190](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/floor_registry.py#L187-L190), [C: homeassistant/helpers/registry.py#L29-L37](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/registry.py#L29-L37) |
| `config/floor_registry/reorder` (admin, `floor_ids: [str]`) rebuilds that dict in the given order. It only checks that the *set* of ids equals the set of existing floors ([L292-L295](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/floor_registry.py#L292-L295)); « exactly once » is the wording of its error message, and a duplicated id is accepted (the dict keeps its first position, [L297-L301](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/floor_registry.py#L297-L301)). It it fires `floor_registry_updated` with `{"action": "reorder"}` (no `floor_id`) | [C: config/floor_registry.py#L135-L154](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/components/config/floor_registry.py#L135-L154), [C: helpers/floor_registry.py#L288-L307](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/floor_registry.py#L288-L307), event types [L53-L69](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/floor_registry.py#L53-L69) |
| The order is persisted: storage writes `self.floors.values()` in order and loads them back in file order | [C: helpers/floor_registry.py#L309-L347](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/floor_registry.py#L309-L347) |
| A new floor is appended at the end; updating a floor (name, level, icon, aliases) keeps its position (assignment to an existing dict key) | [C: helpers/floor_registry.py#L212-L221](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/floor_registry.py#L212-L221), [L275](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/floor_registry.py#L275), [C: helpers/registry.py#L47-L54](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/registry.py#L47-L54) |
| `level` is used for ordering only once: the storage migration to version 1.3 sorted existing floors by `level` **descending** (highest first), floors without a level last, then by name. After that, `level` does not move a floor | [C: helpers/floor_registry.py#L105-L113](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/floor_registry.py#L105-L113) |
| The frontend's own areas page and dialog build the floor order from `Object.values(hass.floors)` and save it with `config/floor_registry/reorder` | [F: src/panels/config/areas/ha-config-areas-dashboard.ts#L148-L153](https://github.com/home-assistant/frontend/blob/20261028.6/src/panels/config/areas/ha-config-areas-dashboard.ts#L148-L153), [F: src/panels/config/areas/dialog-areas-floors-order.ts#L397-L412](https://github.com/home-assistant/frontend/blob/20261028.6/src/panels/config/areas/dialog-areas-floors-order.ts#L397-L412), [F: src/common/areas/areas-floor-hierarchy.ts#L12-L53](https://github.com/home-assistant/frontend/blob/20261028.6/src/common/areas/areas-floor-hierarchy.ts#L12-L53) |
| Frontend view strategies (for example the lights view) use the same `Object.values(hass.floors)` order | [F: src/panels/light/strategies/light-view-strategy.ts#L196-L198](https://github.com/home-assistant/frontend/blob/20261028.6/src/panels/light/strategies/light-view-strategy.ts#L196-L198) |
| `hass.floors` is built by inserting floors in list order into a plain object keyed by `floor_id` | [F: src/state/connection-mixin.ts#L332-L346](https://github.com/home-assistant/frontend/blob/20261028.6/src/state/connection-mixin.ts#L332-L346) |

**What the card sorts by to match « Home Assistant floor order »:** the array order of `config/floor_registry/list`, which is what `Object.values(hass.floors)` reproduces. Never sort by `level`: `level` and list order agree only until the user reorders floors or adds one.

**All-digit floor ids (verified at source).** Home Assistant's `slugify` calls `slugify.slugify(text, separator=separator)` from python-slugify ([C: homeassistant/util/__init__.py#L13](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/util/__init__.py#L13), [L39-L44](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/util/__init__.py#L39-L44)), pinned at `python-slugify==9.1.3` ([C: homeassistant/package_constraints.txt#L64](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/package_constraints.txt#L64), [C: pyproject.toml#L72](https://github.com/home-assistant/core/blob/2026.11.2/pyproject.toml#L72)). In 9.1.3 a call without `algorithm` runs the legacy pipeline ([slugify/slugify.py#L202](https://github.com/un33k/python-slugify/blob/v9.1.3/slugify/slugify.py#L202), [L218-L226](https://github.com/un33k/python-slugify/blob/v9.1.3/slugify/slugify.py#L218-L226)), which lowercases, drops commas between digits and replaces every run of characters outside `[-a-zA-Z0-9]` with the separator ([slugify/_legacy.py#L23](https://github.com/un33k/python-slugify/blob/v9.1.3/slugify/_legacy.py#L23), [L26](https://github.com/un33k/python-slugify/blob/v9.1.3/slugify/_legacy.py#L26), [L144-L150](https://github.com/un33k/python-slugify/blob/v9.1.3/slugify/_legacy.py#L144-L150), [L161](https://github.com/un33k/python-slugify/blob/v9.1.3/slugify/_legacy.py#L161)). Digits are kept, so a floor named « 1 » or « 0 » gets `floor_id` `"1"` or `"0"` (python-slugify read at tag `v9.1.3` on 2026-11-23). Such a key is an array index, and JavaScript enumerates array-index keys first, in ascending numeric order, before the other string keys in insertion order (ECMAScript `OrdinaryOwnPropertyKeys`, https://tc39.es/ecma262/#sec-ordinaryownpropertykeys). `Object.values(hass.floors)` therefore moves such a floor to the front, in Home Assistant's own areas page as well, while `config/floor_registry/list` keeps it in place. A name like « 1st floor » gives `1st_floor`, which is not an array index and is not affected.

## Areas

### Fields

`config/area_registry/list` returns `entry.json_fragment` for each area ([C: homeassistant/components/config/area_registry.py#L23-L37](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/components/config/area_registry.py#L23-L37)), defined in [C: homeassistant/helpers/area_registry.py#L87-L104](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/area_registry.py#L87-L104); types from `AreaEntry` ([L73-L85](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/area_registry.py#L73-L85)); frontend `AreaRegistryEntry` ([F: src/data/area/area_registry.ts#L11-L21](https://github.com/home-assistant/frontend/blob/20261028.6/src/data/area/area_registry.ts#L11-L21)).

| Field | Wire type | Null? | Notes |
|---|---|---|---|
| `area_id` | string | no | Serialised from `AreaEntry.id`; generated once from the name like `floor_id` ([C: helpers/area_registry.py#L271-L273](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/area_registry.py#L271-L273), [L307](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/area_registry.py#L307)) |
| `name` | string | no | Unique after case folding and space removal: create refuses a taken name ([C: helpers/area_registry.py#L291-L294](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/area_registry.py#L291-L294)) and a rename is checked by the name index ([C: normalized_name_base_registry.py#L27-L30](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/normalized_name_base_registry.py#L27-L30), [L47-L60](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/normalized_name_base_registry.py#L47-L60)) |
| `floor_id` | string | **yes** | `null` when the area has no floor |
| `icon` | string | yes | |
| `picture` | string | yes | |
| `aliases` | string[] | no | |
| `labels` | string[] | no | |
| `humidity_entity_id` | string | yes | |
| `temperature_entity_id` | string | yes | |
| `created_at`, `modified_at` | number (Unix seconds) | no | `0` for areas older than storage 1.7 ([L145-L149](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/area_registry.py#L145-L149)) |

### Areas without a floor

| Fact | Source |
|---|---|
| An area without a floor has `"floor_id": null`; it is a normal area in every other way | [C: helpers/area_registry.py#L78](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/area_registry.py#L78), [L93](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/area_registry.py#L93) |
| Deleting a floor sets `floor_id` to `null` on every area of that floor (each change fires `area_registry_updated`) | [C: helpers/area_registry.py#L527-L540](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/area_registry.py#L527-L540) |
| The frontend groups areas without a floor in a separate « unassigned » list placed after all floors | [F: src/common/areas/areas-floor-hierarchy.ts#L19-L50](https://github.com/home-assistant/frontend/blob/20261028.6/src/common/areas/areas-floor-hierarchy.ts#L19-L50) |
| Areas have their own user order, stored and changed like floors (`config/area_registry/reorder`, admin; migration 1.9 sorted them by name once); `area_registry_updated` carries `{"action": "reorder", "area_id": null}` | [C: helpers/area_registry.py#L439-L456](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/area_registry.py#L439-L456), [L157-L162](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/area_registry.py#L157-L162), [L66-L70](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/area_registry.py#L66-L70) |

## Devices

`config/device_registry/list` concatenates `entry.json_repr` of every main device then every child device, with no `disabled_by` filter ([C: homeassistant/components/config/device_registry.py#L74-L101](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/components/config/device_registry.py#L74-L101)). Since 2026.9.0 the list mixes two shapes:

- main devices, `DeviceEntry.dict_repr` ([C: homeassistant/helpers/device_registry.py#L750-L791](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/device_registry.py#L750-L791));
- child devices (« a lightweight logical part of a parent device »), `ChildDeviceEntry.dict_repr`, with fewer fields ([C: helpers/device_registry.py#L891-L910](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/device_registry.py#L891-L910)). The frontend tells them apart by the absence of `connections` and fills the missing fields from the parent before storing them in `hass.devices` ([F: src/data/ws-device_registry.ts#L18-L85](https://github.com/home-assistant/frontend/blob/20261028.6/src/data/ws-device_registry.ts#L18-L85)).

Fields the card needs to group the entities of one robot (types from `BaseDeviceEntry`, [C: helpers/device_registry.py#L563-L579](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/device_registry.py#L563-L579); frontend `DeviceRegistryEntry`, [F: src/data/device/device_registry.ts#L23-L48](https://github.com/home-assistant/frontend/blob/20261028.6/src/data/device/device_registry.ts#L23-L48)):

| Field | Wire type | Null? | In child entries | Use for the card |
|---|---|---|---|---|
| `id` | string (uuid hex) | no | yes | Join key: entity `device_id` → device |
| `name` | string | yes | yes | Robot name as set by the integration |
| `name_by_user` | string | yes | yes | User's rename; display `name_by_user ?? name` |
| `area_id` | string | yes | yes | Device's own area; a child without one inherits its parent's ([C: helpers/device_registry.py#L4986-L5002](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/device_registry.py#L4986-L5002)) |
| `parent_device_id` | string | yes (always `null` on main devices) | yes (never null) | Climb from a child device to the robot |
| `disabled_by` | `"config_entry"` \| `"device"` \| `"integration"` \| `"user"` | yes | yes | `"device"` = child disabled because its parent is ([C: L124-L131](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/device_registry.py#L124-L131)) |
| `config_entry_id` | string | no | yes | One config entry per device since 2026.8.0 |
| `identifiers` | `[string, string][]` | no | yes | `[domain, id]` pairs set by the integration |
| `manufacturer`, `model`, `model_id` | string | yes | no (frontend copies the parent's) | Display only |

Other main-device fields on the wire: `configuration_url`, `config_entries` and `config_entries_subentries` (deprecated, removal announced for 2027.8 in the code comment at [L760-L762](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/device_registry.py#L760-L762)), `config_subentry_id`, `connections`, `created_at`, `entry_type`, `hw_version`, `labels`, `modified_at`, `next_name_part`, `primary_config_entry` (deprecated), `serial_number`, `sw_version`, `via_device_id`.

Entity areas: an entity's registry `area_id` is its **own** area only. Its effective area is its own, else its device's effective area ([C: homeassistant/helpers/entity_registry.py#L2797-L2813](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/entity_registry.py#L2797-L2813)). The card must resolve this itself; no read path returns the effective area.

## Entity registry

### Read paths

| Read path | `platform` | `device_id` | `area_id` | `disabled_by` | `hidden_by` | `unique_id` | `options` | Disabled entities | Admin |
|---|---|---|---|---|---|---|---|---|---|
| `hass.entities` (frontend) | yes, `platform` | yes; key always present, value `undefined` when not sent | yes, same; own area only | no | only `hidden: true` (who hid it is lost) | no | no (only sensor `display_precision`) | **excluded** | no |
| `config/entity_registry/list_for_display` | yes, key `pl` | yes, `di` | yes, `ai` | no | only `hb: true` | no | no (only `dp`) | **excluded** | no |
| `config/entity_registry/list` | yes | yes (null allowed) | yes | yes | yes | yes | yes | included | no |
| `config/entity_registry/get` (`entity_id`) | yes | yes | yes | yes | yes | yes | yes | included | no |
| `config/entity_registry/get_entries` (`entity_ids`) | yes | yes | yes | yes | yes | yes | yes | included | no |

Sources:

- `hass.entities`: type `Record<string, EntityRegistryDisplayEntry>` ([F: src/types.ts#L224-L229](https://github.com/home-assistant/frontend/blob/20261028.6/src/types.ts#L224-L229), entry type [F: src/data/entity/entity_registry.ts#L15-L29](https://github.com/home-assistant/frontend/blob/20261028.6/src/data/entity/entity_registry.ts#L15-L29)), filled from `list_for_display` with the short keys mapped to long names ([F: src/state/connection-mixin.ts#L270-L302](https://github.com/home-assistant/frontend/blob/20261028.6/src/state/connection-mixin.ts#L270-L302)). The mapping assigns every key on every entry (`device_id: entity.di`, `area_id: entity.ai`, `hidden: entity.hb`…, [L273-L289](https://github.com/home-assistant/frontend/blob/20261028.6/src/state/connection-mixin.ts#L273-L289)), so a key the wire did not send is present with value `undefined`: test the value, not the key (`in` and `hasOwnProperty` are always true).
- `list_for_display`: [C: homeassistant/components/config/entity_registry.py#L69-L94](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/components/config/entity_registry.py#L69-L94), disabled filter at [L90](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/components/config/entity_registry.py#L90); keys from `DISPLAY_DICT_OPTIONAL` and `_as_display_dict` ([C: homeassistant/helpers/entity_registry.py#L221-L229](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/entity_registry.py#L221-L229), [L343-L368](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/entity_registry.py#L343-L368)): always `ei` (entity id), `pl` (platform), `lb` (labels); when set `ai`, `di`, `np`, `ic`, `tk`, `ec` (index into `entity_categories`), `hb`, `en` (name), `dp`. The response is `{"entity_categories": {...}, "entities": [...]}`.
- `list`: [C: config/entity_registry.py#L38-L63](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/components/config/entity_registry.py#L38-L63), every entry of `registry.entities` as `as_partial_dict` ([C: helpers/entity_registry.py#L392-L425](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/entity_registry.py#L392-L425)): `area_id`, `categories`, `config_entry_id`, `config_subentry_id`, `created_at`, `device_id`, `disabled_by`, `entity_category`, `entity_id`, `hidden_by`, `icon`, `id`, `labels`, `modified_at`, `name`, `next_name_part`, `options`, `original_name`, `platform`, `translation_key`, `unique_id`.
- `get`: [C: config/entity_registry.py#L97-L123](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/components/config/entity_registry.py#L97-L123), returns `extended_dict` = `as_partial_dict` plus `aliases`, `capabilities`, `device_class`, `original_device_class`, `original_icon` ([C: helpers/entity_registry.py#L427-L440](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/entity_registry.py#L427-L440)); an unknown id gives error `not_found` ([L115-L119](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/components/config/entity_registry.py#L115-L119)).
- `get_entries`: [C: config/entity_registry.py#L126-L150](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/components/config/entity_registry.py#L126-L150), returns an object keyed by entity id, `extended_dict` or `null` for an unknown id.
- Disabled entries are kept in `registry.entities` (that is why `list_for_display` has to filter them out at L90), so `list`, `get` and `get_entries` return them.

Values and types (`RegistryEntry`, [C: helpers/entity_registry.py#L263-L301](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/entity_registry.py#L263-L301)):

| Field | Type | Notes |
|---|---|---|
| `platform` | string | The integration domain that created the entity: the key ADR 0002 uses to detect an integration |
| `unique_id` | string | Unique per (entity domain, platform): the registry indexes entries by `(domain, platform, unique_id)` and refuses a duplicate on update ([C: helpers/entity_registry.py#L1141](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/entity_registry.py#L1141), [L1420-L1428](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/entity_registry.py#L1420-L1428), [L2147-L2155](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/entity_registry.py#L2147-L2155)); set by the integration, may contain a hardware identifier |
| `device_id`, `area_id` | string \| null | |
| `disabled_by` | `"config_entry"` \| `"device"` \| `"hass"` \| `"integration"` \| `"user"` \| null | [L140-L147](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/entity_registry.py#L140-L147). An entity created with `entity_registry_enabled_default = False` gets `"integration"` ([C: homeassistant/helpers/entity_platform.py#L1107-L1109](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/entity_platform.py#L1107-L1109)). The frontend type omits `"hass"` ([F: src/data/entity/entity_registry.ts#L62](https://github.com/home-assistant/frontend/blob/20261028.6/src/data/entity/entity_registry.ts#L62)): the card parses its own union |
| `hidden_by` | `"integration"` \| `"user"` \| null | [L172-L176](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/entity_registry.py#L172-L176) |
| `options` | object keyed by domain, then option name | Read-only mapping; content per domain. The frontend types a `vacuum` key (`area_mapping`, `last_seen_segments`, [F: src/data/entity/entity_registry.ts#L167-L170](https://github.com/home-assistant/frontend/blob/20261028.6/src/data/entity/entity_registry.ts#L167-L170)): its meaning belongs to #24 |

Consequence for disabled entities: a disabled entity is not added to its platform, so it has **no state** in `hass.states` ([C: homeassistant/helpers/entity_platform.py#L1206-L1214](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/entity_platform.py#L1206-L1214)) and is absent from `hass.entities`. Only `list`, `get` and `get_entries` show it; `get`/`get_entries` need its entity id, which the card cannot guess (ADR 0002 forbids id patterns), so `list` is the only way to discover a disabled entity.

Not on the wire at 2026.11.2: `has_entity_name`. It was in `as_partial_dict` and in `list_for_display` (`hn`) up to 2026.10.0 and is gone from both at 2026.11.0 (method below); the frontend still declares and maps it ([F: src/data/entity/entity_registry.ts#L28](https://github.com/home-assistant/frontend/blob/20261028.6/src/data/entity/entity_registry.ts#L28), [F: src/state/connection-mixin.ts#L285](https://github.com/home-assistant/frontend/blob/20261028.6/src/state/connection-mixin.ts#L285)). The card must not rely on it.

### Floors, areas and devices: `hass.*` against the websocket list

| Registry | `hass.*` field | Websocket list | Same fields? | Disabled or empty entries | Admin |
|---|---|---|---|---|---|
| Floors | `hass.floors: Record<floor_id, FloorRegistryEntry>` | `config/floor_registry/list` | Yes: each value is the list entry as received ([F: connection-mixin.ts#L332-L346](https://github.com/home-assistant/frontend/blob/20261028.6/src/state/connection-mixin.ts#L332-L346)) | n/a | no |
| Areas | `hass.areas: Record<area_id, AreaRegistryEntry>` | `config/area_registry/list` | Yes ([F: connection-mixin.ts#L317-L331](https://github.com/home-assistant/frontend/blob/20261028.6/src/state/connection-mixin.ts#L317-L331)) | n/a | no |
| Devices | `hass.devices: Record<id, DeviceRegistryEntry>` | `config/device_registry/list` | Main devices yes; child devices are completed by the frontend (parent's manufacturer, model…, `connections: []`, deprecated `config_entries`) ([F: ws-device_registry.ts#L37-L85](https://github.com/home-assistant/frontend/blob/20261028.6/src/data/ws-device_registry.ts#L37-L85), [F: connection-mixin.ts#L303-L316](https://github.com/home-assistant/frontend/blob/20261028.6/src/state/connection-mixin.ts#L303-L316)) | Disabled devices included in both | no |

`hass.entities`, `hass.devices`, `hass.areas`, `hass.floors` are declared in `HomeAssistantRegistries` ([F: src/types.ts#L224-L229](https://github.com/home-assistant/frontend/blob/20261028.6/src/types.ts#L224-L229)), which `HomeAssistant` extends ([L335-L337](https://github.com/home-assistant/frontend/blob/20261028.6/src/types.ts#L335-L337)). The card also has `hass.callWS` ([L278](https://github.com/home-assistant/frontend/blob/20261028.6/src/types.ts#L278)) and `hass.connection` ([L302-L303](https://github.com/home-assistant/frontend/blob/20261028.6/src/types.ts#L302-L303)).

## Update signal

| Fact | Source |
|---|---|
| The frontend keeps each `hass.*` registry current with a collection: fetch the list once, then `conn.subscribeEvents(…, "<registry>_registry_updated")` and re-fetch the **whole** list on each event, debounced 500 ms with a leading call | floors [F: src/data/ws-floor_registry.ts#L7-L38](https://github.com/home-assistant/frontend/blob/20261028.6/src/data/ws-floor_registry.ts#L7-L38); areas [F: src/data/ws-area_registry.ts#L7-L38](https://github.com/home-assistant/frontend/blob/20261028.6/src/data/ws-area_registry.ts#L7-L38); devices [F: src/data/ws-device_registry.ts#L80-L113](https://github.com/home-assistant/frontend/blob/20261028.6/src/data/ws-device_registry.ts#L80-L113); entities (display) [F: src/data/ws-entity_registry_display.ts#L8-L34](https://github.com/home-assistant/frontend/blob/20261028.6/src/data/ws-entity_registry_display.ts#L8-L34); debounce [F: src/common/util/debounce.ts#L1-L44](https://github.com/home-assistant/frontend/blob/20261028.6/src/common/util/debounce.ts#L1-L44) |
| On each re-fetch the frontend keeps the previous object (same identity) when nothing changed, and keeps unchanged items' identity otherwise; for `hass.areas` and `hass.floors` a change of order alone counts as a change (`compareOrder = true`) | [F: src/common/util/preserve-unchanged-record.ts#L11-L39](https://github.com/home-assistant/frontend/blob/20261028.6/src/common/util/preserve-unchanged-record.ts#L11-L39), calls at [F: connection-mixin.ts#L292-L344](https://github.com/home-assistant/frontend/blob/20261028.6/src/state/connection-mixin.ts#L292-L344) |
| So a card detects a registry change by comparing `hass.floors !== oldHass.floors` (and the same for `areas`, `devices`, `entities`) in `updated`/`willUpdate`, as the frontend's own areas page does | [F: ha-config-areas-dashboard.ts#L136-L145](https://github.com/home-assistant/frontend/blob/20261028.6/src/panels/config/areas/ha-config-areas-dashboard.ts#L136-L145) |
| For data the card fetched itself (`config/entity_registry/list`, for disabled entries and `options`), the signal is the `entity_registry_updated` event, through `hass.connection.subscribeEvents(callback, "entity_registry_updated")`; allowed for non-admin users (allowlist above). The frontend's own full-registry collection does exactly this ([F: src/data/entity/entity_registry.ts#L316-L342](https://github.com/home-assistant/frontend/blob/20261028.6/src/data/entity/entity_registry.ts#L316-L342)) | [C: commands.py#L186-L225](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/components/websocket_api/commands.py#L186-L225), [C: auth/permissions/events.py#L35](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/auth/permissions/events.py#L35) |
| `entity_registry_updated` data: `action` (`create`, `remove`, `update`), `entity_id`; for `update` also `changes` (old values of changed fields) and, on rename, `old_entity_id` | [C: helpers/entity_registry.py#L86-L88](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/entity_registry.py#L86-L88), [L196-L215](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/entity_registry.py#L196-L215); `changes` maps each changed field to its **old** value and `old_entity_id` is set only when the entity id changed ([L2083](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/entity_registry.py#L2083), [L2114-L2116](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/entity_registry.py#L2114-L2116), [L2226-L2233](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/entity_registry.py#L2226-L2233)) |
| `device_registry_updated` data: `action` (`create`, `remove`, `update`), `device_id`; `remove` adds `device`, `update` adds `changes` | [C: helpers/device_registry.py#L334-L361](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/device_registry.py#L334-L361) |
| `area_registry_updated` data: `action` (`create`, `remove`, `update`, `reorder`), `area_id` (null on `reorder`) | [C: helpers/area_registry.py#L36-L38](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/area_registry.py#L36-L38), [L66-L70](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/area_registry.py#L66-L70) |
| `floor_registry_updated` data: `action` (`create`, `remove`, `update`) with `floor_id`, or `{"action": "reorder"}` | [C: helpers/floor_registry.py#L27-L29](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/floor_registry.py#L27-L29), [L53-L69](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/floor_registry.py#L53-L69) |
| An event reaches the client as `{"type": "event", "event": {"event_type", "data", "origin", "time_fired", "context"}, "id": <subscription id>}` | [C: homeassistant/components/websocket_api/messages.py#L125-L155](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/components/websocket_api/messages.py#L125-L155), [C: homeassistant/core.py#L1459-L1474](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/core.py#L1459-L1474) |

The card never polls. It relies on `hass` updates for the four `hass.*` fields, and on one `entity_registry_updated` subscription (unsubscribed in `disconnectedCallback`) for the full entity list it fetches itself.

## First versions

Method: for each fact, the file at monthly release tags `YYYY.M.0` was read with `gh api repos/home-assistant/core/contents/<path>?ref=<tag>` and searched for the command string or field; « first » is the first `.0` tag where it is present after a `.0` tag where it is absent. Rows marked « ≤ » are upper bounds only: the feature is at least that old, which is enough because it predates any minimum version the card could pick. Patch tags were not checked (except 2024.3.0, 2024.3.1 and 2024.3.3 for area `floor_id`), so a feature could have landed in a patch of the previous month. For the frontend, the version pinned in `homeassistant/components/frontend/manifest.json` at each core tag was read, then `src/types.ts` at that frontend tag. Read on 2026-11-23.

| Read path or field | First present | Last checked absent | File checked |
|---|---|---|---|
| `config/area_registry/list`, `config/device_registry/list`, `config/entity_registry/list`, `config/entity_registry/get` | ≤ 2022.12.0 (upper bound: earliest tag checked) | not searched further back | `components/config/{area,device,entity}_registry.py` |
| `options`, `platform`, `unique_id`, `disabled_by`, `hidden_by` in `config/entity_registry/list` | ≤ 2023.3.0 (upper bound: earliest tag checked) | not searched further back | `helpers/entity_registry.py` (`as_partial_dict`) |
| `config/entity_registry/get_entries` | 2023.2.0 | 2023.1.0 | `components/config/entity_registry.py` |
| `config/entity_registry/list_for_display` (with `pl`, `hb`, disabled filter) | 2023.3.0 | 2023.2.0 | same, and `helpers/entity_registry.py` |
| `config/floor_registry/list` (floors exist) | 2024.3.0 | 2024.2.0 | `components/config/floor_registry.py` |
| Areas carry `floor_id` in `config/area_registry/list` | **2024.4.0** | 2024.3.3 (the registry stored `floor_id` from 2024.3.0, but the list command did not send it) | `components/config/area_registry.py` (`_entry_dict`) |
| `floor_registry_updated` subscribable by non-admin users (`SUBSCRIBE_ALLOWLIST`) | 2024.8.0 | 2024.7.0 | `auth/permissions/events.py` |
| `config/floor_registry/reorder`, `config/area_registry/reorder`, one-time sort by `level` (floors) and by name (areas) | 2025.12.0 | 2025.11.0 | `components/config/{floor,area}_registry.py`, `helpers/{floor,area}_registry.py` |
| Devices have a single `config_entry_id` (`list_composite_splits`) | 2026.8.0 | 2026.7.0 | `components/config/device_registry.py`, `helpers/device_registry.py` |
| Child devices (`parent_device_id`) in `config/device_registry/list` | 2026.9.0 | 2026.8.0 | same |
| `has_entity_name` / `hn` **removed** from `list`, `get`, `list_for_display` | 2026.11.0 (removed) | present at 2026.10.0 | `helpers/entity_registry.py` |
| Frontend `hass.entities`, `hass.devices`, `hass.areas` | ≤ frontend 20221005.0 (core 2022.10.0; upper bound: earliest tag checked) | not searched further back | `src/types.ts` |
| `hass.entities` holds display entries (`EntityRegistryDisplayEntry`, with `platform`) instead of full entries | frontend 20230301.0 (core 2023.3.0) | 20230201.0 (core 2023.2.0) | `src/types.ts`, `src/data/entity_registry.ts` |
| Frontend `hass.floors` (subscribed in `connection-mixin.ts`) | frontend 20241002.2 (core **2024.10.0**) | 20240904.0 (core 2024.9.0) | `src/types.ts`, `src/state/connection-mixin.ts` |

Before 2025.12.0 there is no reorder command: list order was creation order and nothing could change it. How the frontend ordered floors on those versions: « à vérifier » (read `ha-config-areas-dashboard.ts` at the frontend pinned by core 2025.11.0).

## Anonymised examples

Numbers and names are made up; only the shape is real. Shapes are built from the source cited above; #26 replaces them with live captures.

`config/floor_registry/list` (order = Home Assistant floor order; note `level` does not follow it after a reorder):

```json
[
  { "aliases": [], "created_at": 1730000000.12, "floor_id": "upper_level", "icon": "mdi:home-floor-1", "level": 1, "name": "Upper level", "modified_at": 1730000000.12 },
  { "aliases": ["Cellar"], "created_at": 1731000000.5, "floor_id": "lower_level_2", "icon": null, "level": -1, "name": "Lower level", "modified_at": 1732000000.75 },
  { "aliases": [], "created_at": 0.0, "floor_id": "street_level", "icon": null, "level": 0, "name": "Street level", "modified_at": 0.0 }
]
```

`config/area_registry/list` (the last area has no floor):

```json
[
  { "aliases": [], "area_id": "library", "floor_id": "upper_level", "humidity_entity_id": null, "icon": null, "labels": [], "name": "Library", "picture": null, "temperature_entity_id": null, "created_at": 1730000100.0, "modified_at": 1730000100.0 },
  { "aliases": [], "area_id": "garden_shed", "floor_id": null, "humidity_entity_id": null, "icon": "mdi:shovel", "labels": ["outdoor"], "name": "Garden shed", "picture": null, "temperature_entity_id": null, "created_at": 1730000200.0, "modified_at": 1730000300.0 }
]
```

`config/device_registry/list`, one main device then one child device:

```json
[
  { "area_id": "library", "configuration_url": null, "config_entries": ["0a1b2c3d4e5f60718293a4b5c6d7e8f9"], "config_entries_subentries": { "0a1b2c3d4e5f60718293a4b5c6d7e8f9": [null] }, "config_entry_id": "0a1b2c3d4e5f60718293a4b5c6d7e8f9", "config_subentry_id": null, "connections": [], "created_at": 1730000400.0, "disabled_by": null, "entry_type": null, "hw_version": null, "id": "f0e1d2c3b4a5968778695a4b3c2d1e0f", "identifiers": [["example_vacuum", "ROBOT0001"]], "labels": [], "manufacturer": "Example Robotics", "model": "Model X", "model_id": null, "modified_at": 1730000400.0, "name_by_user": null, "name": "Robot one", "next_name_part": "area", "parent_device_id": null, "primary_config_entry": "0a1b2c3d4e5f60718293a4b5c6d7e8f9", "serial_number": null, "sw_version": "1.2.3", "via_device_id": null },
  { "area_id": null, "config_entry_id": "0a1b2c3d4e5f60718293a4b5c6d7e8f9", "config_subentry_id": null, "created_at": 1730000500.0, "disabled_by": null, "id": "11223344556677889900aabbccddeeff", "identifiers": [["example_vacuum", "ROBOT0001-dock"]], "labels": [], "modified_at": 1730000500.0, "name_by_user": null, "name": "Dock", "next_name_part": "parent_device", "parent_device_id": "f0e1d2c3b4a5968778695a4b3c2d1e0f" }
]
```

`config/entity_registry/list`, one entry disabled by its integration (wire `options` shown empty; its per-domain content is #24):

```json
[
  { "area_id": null, "categories": {}, "config_entry_id": "0a1b2c3d4e5f60718293a4b5c6d7e8f9", "config_subentry_id": null, "created_at": 1730000600.0, "device_id": "f0e1d2c3b4a5968778695a4b3c2d1e0f", "disabled_by": "integration", "entity_category": null, "entity_id": "image.robot_one_floor_plan_map_b", "hidden_by": null, "icon": null, "id": "9f8e7d6c5b4a39281706f5e4d3c2b1a0", "labels": [], "modified_at": 1730000600.0, "name": null, "next_name_part": "area", "options": {}, "original_name": "Floor plan Map B", "platform": "example_vacuum", "translation_key": "floor_plan", "unique_id": "ROBOT0001_floor_plan_MAPB" }
]
```

`config/entity_registry/get` adds to the same object: `"aliases": [], "capabilities": null, "device_class": null, "original_device_class": null, "original_icon": null`. `config/entity_registry/get_entries` with `{"entity_ids": ["image.robot_one_floor_plan_map_b", "image.does_not_exist"]}`:

```json
{ "image.robot_one_floor_plan_map_b": { "entity_id": "image.robot_one_floor_plan_map_b", "platform": "example_vacuum", "disabled_by": "integration", "...": "same fields as get" }, "image.does_not_exist": null }
```

`config/entity_registry/list_for_display` (the disabled entry above is absent):

```json
{
  "entity_categories": { "0": "config", "1": "diagnostic" },
  "entities": [
    { "ei": "vacuum.robot_one", "pl": "example_vacuum", "lb": [], "di": "f0e1d2c3b4a5968778695a4b3c2d1e0f", "np": "area", "tk": "robot" },
    { "ei": "sensor.robot_one_battery", "pl": "example_vacuum", "lb": [], "di": "f0e1d2c3b4a5968778695a4b3c2d1e0f", "np": "area", "ec": 1, "hb": true, "en": "Battery", "dp": 0 }
  ]
}
```

The same entity in `hass.entities`. Keys the wire did not send are present with value `undefined` ([F: connection-mixin.ts#L273-L289](https://github.com/home-assistant/frontend/blob/20261028.6/src/state/connection-mixin.ts#L273-L289)); JSON cannot show `undefined`, so they are left out here (`area_id`, `translation_key`, `has_entity_name`, `icon`):

```json
{ "sensor.robot_one_battery": { "entity_id": "sensor.robot_one_battery", "device_id": "f0e1d2c3b4a5968778695a4b3c2d1e0f", "next_name_part": "area", "labels": [], "platform": "example_vacuum", "entity_category": "diagnostic", "name": "Battery", "hidden": true, "display_precision": 0 } }
```

`entity_categories` is `dict(enumerate(EntityCategory))` ([C: helpers/entity_registry.py#L102](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/helpers/entity_registry.py#L102)), and `EntityCategory` declares `CONFIG = "config"` then `DIAGNOSTIC = "diagnostic"` ([C: homeassistant/const.py#L1026-L1039](https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/const.py#L1026-L1039)), so index `0` is `config` and `1` is `diagnostic`. The card does not need this field.

Event after the user enables the floor plan (message shape from the source; `changes` holds old values):

```json
{ "type": "event", "event": { "event_type": "entity_registry_updated", "data": { "action": "update", "entity_id": "image.robot_one_floor_plan_map_b", "changes": { "disabled_by": "integration" } }, "origin": "LOCAL", "time_fired": "2026-01-02T03:04:05.678901+00:00", "context": { "id": "01JABCDEFGHJKMNPQRSTVWXYZ0", "parent_id": null, "user_id": null } }, "id": 42 }
```

On a re-enable `changes` holds `disabled_by` with its old value, as above (source: same lines as the event row in « Update signal »).

## « à vérifier »

| Claim | What would confirm it |
|---|---|
| All JSON shapes above match a live 2026.11.2 instance | Live capture with `hass.callWS` (#26) |
| A non-admin user can call every read command and subscribe to the four `*_registry_updated` events | Same capture with a non-admin user (#26) |
| Floor order shown by the frontend before core 2025.12.0 | Frontend source at the version pinned by core 2025.11.0 |
| Whether a vacuum integration (Roomba+ first) puts some entities on child devices, so grouping must climb `parent_device_id` | Roomba+ device list capture (#26) |
| Size and latency of `config/entity_registry/list` on a large installation | Measure in #26 |

Capture rule for #26 (security): capture only the robots' devices and entities. Replace `serial_number`, `connections`, `configuration_url`, `identifiers`, `unique_id`, `id`, `config_entry_id`, `device_id` and `context.user_id` with made-up values of the same shape. `unique_id` and `identifiers` are set by the integration and can embed a robot identifier; for some integrations that identifier also serves as a login, so treat it as a secret (whether it does for Roomba+ is « à vérifier » against its source, see `docs/research/roomba-plus.md`).

## Gaps for this card

### Epic 3: floor model

1. **Order.** Never by `level`. `Object.values(hass.floors)` equals the `config/floor_registry/list` order, except that floors with an all-digit `floor_id` (a floor named « 1 » or « 0 ») come first, in ascending numeric order. Options considered: (a) follow `Object.values(hass.floors)`, exactly as Home Assistant's own areas page and views do, with no websocket call, re-rendering when `hass.floors` identity changes (a reorder alone changes it); or (b) use the true list order from `config/floor_registry/list`, refreshed on `floor_registry_updated` (non-admin allowed since 2024.8.0), at the cost of one call and one subscription. **Owner decision (2026-11-23): (b), the true list order**, so a floor named « 1 » keeps the position the user gave it. To be recorded in the ADR of #29.
2. **Areas without a floor** (`floor_id: null`) are normal and become `null` again when a floor is deleted. The model needs an explicit « no floor » group (Home Assistant puts it after the floors), or a rule that a map whose areas have no floor is shown without a floor heading. Owner decision on wording (`owner-only`).
3. **Floors with no area, or no robot map**, exist; the model must not create an empty plan for them unless a robot map links to them (link itself: #24).
4. **Effective area.** Entity `area_id` → else device `area_id` → else parent device `area_id`. No read path gives the effective area.
5. **Minimum Home Assistant version** (`owner-only`, `docs/standards.md` still says « à vérifier »): the registry side requires only `hass.floors` (core 2024.10.0) and area `floor_id` (2024.4.0, implied by the former). User floor order (2025.12.0) and child devices (2026.9.0) are behaviours to handle when present, not requirements. The vacuum side (#24) may raise the minimum further.
6. **Untrusted strings (security).** Floor, area and device names, aliases, `icon`, `picture` and `configuration_url` are set by users or integrations. Render them only through Lit text bindings; pass `icon` only to `ha-icon`; never use an area `picture` or a device `configuration_url` as an `img src` or an `href`. Parse every field at the adapter boundary.

### Epic 4: robot detection and data access

1. **Detection by `platform`**: `hass.entities[*].platform` is enough for enabled entities, with no websocket call.
2. **Disabled floor plans** are invisible in `hass.entities` and `hass.states`. Discovering them needs `config/entity_registry/list` (whole registry, filter on `platform` and `device_id`, read `disabled_by`), refreshed on `entity_registry_updated`, debounced like the frontend. `get`/`get_entries` cannot discover them. This full-registry read and its `entity_registry_updated` subscription are one shared `HassPort` capability that every room source consumes, not code inside an integration adapter (ADR 0002).
3. **Admin-only operations**: no read is admin-only at 2026.11.2. Enabling a disabled entity is (`config/entity_registry/update`, `require_admin`). The card shows « enable this floor plan » guidance to everyone, and an action that opens the entity settings only when `hass.user.is_admin` is true; it never calls `update` itself without the owner deciding so (`owner-only`).
4. **`hidden_by`**: `hass.entities` only says `hidden: true`. Hidden entities still have a state and should still be used by the adapter. Whether Roomba+ hides any entity: « à vérifier » (#26).
5. **Device grouping**: group a robot's entities by `device_id`, climbing `parent_device_id` for child devices (2026.9.0 and later).
6. **Do not use** `has_entity_name` (gone from the wire in 2026.11.0) or deprecated device fields `config_entries`, `config_entries_subentries`, `primary_config_entry`; parse `disabled_by` as a string union that includes `"hass"`.
7. **Registry data handling (security).** Index entities by `device_id` or `unique_id` in a `Map`, not a plain object (the ids are untrusted keys). Keep only entries filtered by `platform` or `device_id`; never log the raw registry list or put it in an error message.

### Upstream

No upstream gap blocks the card, so no issue draft. Observation only: frontend `20261028.6` still types and maps `has_entity_name` / `hn`, which core 2026.11.x no longer sends, and its `EntityRegistryEntry.disabled_by` type omits `"hass"`. This does not affect the card, which parses registry data itself.

## Relation to the previous document

`docs/research/ha-core-vacuum.md` (unverified, rewritten by #24) claimed floors have « floor id, name, level, aliases » and areas carry `floor_id`. Both are confirmed; floors also have `icon`, `created_at`, `modified_at`. Nothing in it contradicts this document. New and not in any earlier document: floor order is the list order, not `level`; floors became reorderable in 2025.12.0; devices can be child devices since 2026.9.0; `has_entity_name` left the wire in 2026.11.0.
