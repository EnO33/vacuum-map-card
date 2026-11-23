# ADR 0002: Room sources, one adapter per integration

- Status: accepted
- Date: 2026-11-20

## Context

Room geometry is not standardised in Home Assistant. Each vacuum integration exposes it differently, or not at all: as image entity attributes, camera attributes, service responses or nothing. Integration data models also change between releases. The card must adapt by itself to re-mapping, new rooms and new floors.

## Decision

- The `app` layer defines a `RoomSource` port. For one robot it returns, per stored map: the floor plan image entity, the map name, the rooms (id, name, outline in image pixels or with a calibration to convert them), whether the map is the robot's active one, and how to start a room.
- Each integration gets one adapter in `src/adapters/<integration>/` that implements `RoomSource` from Home Assistant state only (no network). Detection is automatic from the entity registry (`platform`), never from entity id patterns written by hand.
- Adapters parse every attribute defensively; an unknown shape returns a typed « unsupported » result with the reason, never a throw.
- The first adapter is Roomba+; its data model is documented in `docs/research/roomba-plus.md`.
- Floors and room-to-area links come from Home Assistant registries (floors, areas, vacuum segment mapping), not from adapters, so they work the same for every integration.

## Consequences

- A new integration is one folder plus one research document (`/add-adapter`).
- When an integration only exposes geometry for its active map (Roomba+ today), other floors show their plan with a room list instead of clickable outlines, and say why. A robot without area cleaning (a mop robot) has no room list for those other maps: its plan shows the picture only and says that rooms cannot be started from it (ADR 0005 « Room lists »).

## Amendment (2026-11-23)

The research of Epic 2 (`docs/research/`) refines this decision. ADR 0005 records how maps, rooms, areas and floors link.

### What an adapter reports

1. **Which map has outlines.** « Whether the map is the robot's active one » has three meanings in Roomba+: the cloud-active map (newest version), the map the rooms map shows (last command, else newest), and where the robot is (not readable on Classic). An adapter reports only « this plan has outlines » (the rooms map). It reports which stored map that is only when it can tell (Roomba+: a robot with one stored map, ADR 0005 « Rooms map pairing »). Sources: [`roomba-plus.md` « Which map it shows »](../research/roomba-plus.md#which-map-it-shows), [« Relation to ADR 0002, ADR 0003 and the core documents »](../research/roomba-plus.md#relation-to-adr-0002-adr-0003-and-the-core-documents).
2. **Room to segment, segment to map.** Linking a room to a core segment id, and a segment id to a stored map, needs the integration's id format (Roomba+ Classic: `<map id>_<region id>`, map id read from the floor plan `unique_id`, matched longest first). The adapter provides these links; only segment → area → floor comes from the registries. This narrows « room-to-area links come from Home Assistant registries » above. Sources: [`roomba-plus.md` « Where a map id can be read »](../research/roomba-plus.md#where-a-map-id-can-be-read), [« Gaps for this card », Epic 3 item 4](../research/roomba-plus.md#epic-3-floor-model-and-geometry).
3. **Room identity.** Rooms are keyed by the integration's stable room id (Roomba+: `region_id`) in a `Map`, never by the display name used as the attribute key (duplicates collapse; `__proto__` is a valid name) nor by a slug of the name. Sources: [`roomba-plus.md` « Attributes »](../research/roomba-plus.md#attributes), [« Gaps for this card », Security item 3](../research/roomba-plus.md#security).
4. **Map names.** A map name equal to the map id, or containing the vacuum's `unique_id` suffix, is not shown as a label (Roomba+ Prime map ids contain the robot identifier); a generic label is used instead, worded in Epic 5. Source: [`roomba-plus.md` « Gaps for this card », Security item 4](../research/roomba-plus.md#security).

### Parsing limits

1. Geometry is accepted only when every number is finite with an absolute value of at most 1e7 mm, each outline has 3 to 1000 points, a plan has at most 100 rooms, and there are exactly 3 calibration pairs whose determinant, in absolute value, exceeds a small tolerance (not collinear, and not degenerate after the integer truncation of pixel values; the sign is negative with Roomba+'s y flip). Every transformed point must be finite. Geometry outside these limits is a typed « unsupported » result with the reason. An `icon` is used only if it matches `^mdi:[a-z0-9-]+$`; otherwise a default icon is shown. These limits are generous against real homes. Source: [`roomba-plus.md` « Gaps for this card », Security item 2](../research/roomba-plus.md#security).
2. The calibration is solved again whenever the picture `state`, `calibration_points` or `rooms` changes; the three are one snapshot. The code never assumes a scale or a picture size. Outlines are drawn only over the picture they were calibrated for (the rooms map's own picture). Sources: [`roomba-plus.md` « Coordinate system, unit and calibration »](../research/roomba-plus.md#coordinate-system-unit-and-calibration), [« When the attributes change »](../research/roomba-plus.md#when-the-attributes-change).
