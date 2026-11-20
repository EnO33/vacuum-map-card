# Vacuum Map Card

A Home Assistant dashboard card to clean any room of your home with any of your robots: all your floor plans side by side, tap a room, pick a robot, confirm, done.

> **Status: early development.** Nothing is released yet. The configuration shown below is the target design and may change before 1.0.

[Lire en français](README.fr.md)

## Why

Vacuum map cards usually show one robot on one map. Homes have several floors and often several robots (a vacuum and a mop, one robot per floor). This card starts from your home instead of from a robot:

- **Every floor at once.** One plan per floor, side by side, in your Home Assistant floor order.
- **Tap a room, pick a robot.** The card lists the robots able to clean that room; you choose one and confirm: « Send Roomba S9+ to vacuum the bedroom? »
- **No coordinates to maintain.** Rooms, outlines and floors come from your integrations and from Home Assistant. Re-map a floor in the vendor app, add a room or a floor: the card follows.
- **Looks like Home Assistant.** Native components, your theme's colours in light and dark mode, keyboard and screen-reader friendly.

## How it works

1. **Floors and rooms** come from Home Assistant: floors and areas, and the mapping between your vacuum's segments and your areas (vacuum entity settings, Home Assistant 2026.3 or later, « à vérifier »).
2. **Room outlines** come from a *room source* adapter for your vacuum integration. The first one supports [Roomba+](https://github.com/johnnyh1975/ha_roomba_plus) (iRobot). More adapters can be added without touching the rest of the card.
3. **Cleaning** uses Home Assistant's own `vacuum.clean_area` action when the room is mapped to an area, or the integration's room action otherwise.

## Supported integrations

| Integration | Room outlines | Floor plans | Start a room | Status |
|---|---|---|---|---|
| Roomba+ (iRobot) | Yes, active map | Yes, every stored map | Yes | Planned for 0.1 |
| Others | Contributions welcome, see `CONTRIBUTING.md` | | | |

## Installation

Not available yet. The plan is to list the card in the Home Assistant Marketplace; until then it will be installable as a custom repository (Dashboard type).

## Configuration

Target design, not final:

```yaml
type: custom:vacuum-map-card
# Everything is discovered by default: floors, rooms, robots.
# Optional overrides:
floors: [ground_floor, first_floor]   # Home Assistant floor ids, in display order
robots: [vacuum.my_vacuum, vacuum.my_mop]
```

A visual editor is part of the first release.

## Requirements

- Home Assistant « à vérifier » or later.
- A supported vacuum integration (see above).

## Contributing

Issues and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first, in particular the section on adding a new integration.

## Licence

[MIT](LICENSE).
