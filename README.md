# Vacuum Map Card

A Home Assistant dashboard card to clean any room of your home with any of your robots: all your floor plans side by side, tap a room, pick a robot, confirm, done.

> **Status: early development.** Version 0.1.0 is a preview: it installs from the Marketplace and shows only its title. Floor plans, rooms and robots come in later versions.

[Lire en français](README.fr.md)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/images/card-dark.png">
  <img alt="Empty Home Assistant card titled Vacuum Map Card" src="./docs/images/card-light.png" width="463">
</picture>

*The card today: only its title. Floor plans and rooms come next.*

## Why

Vacuum map cards usually show one robot on one map. Homes have several floors and often several robots (a vacuum and a mop, one robot per floor). This card starts from your home instead of from a robot:

- **Every floor at once.** One plan per floor, side by side, in your Home Assistant floor order.
- **Tap a room, pick a robot.** The card lists the robots able to clean that room; you choose one and confirm: « Send Roomba S9+ to vacuum the bedroom? »
- **No coordinates to maintain.** Rooms, outlines and floors come from your integrations and from Home Assistant. Re-map a floor in the vendor app, add a room or a floor: the card follows.
- **Looks like Home Assistant.** Your theme's colours in light and dark mode, keyboard and screen-reader friendly: Tab reaches a plan, Left and Right go through its rooms in reading order, Up and Down to the nearest room that way, Home and End go to the first and last room, Enter or Space chooses one. A room too small for a finger can be tapped just next to its name.

## How it works

1. **Floors and rooms** come from Home Assistant: floors and areas, and the mapping between your vacuum's segments and your areas (vacuum entity settings, available since Home Assistant 2026.3).
2. **Room outlines** come from a *room source* adapter for your vacuum integration. The first one supports [Roomba+](https://github.com/johnnyh1975/ha_roomba_plus) (iRobot). More adapters can be added without touching the rest of the card. The card draws the outlines and room names over the rooms map picture itself, so keep the Roomba+ option « Draw room names on the map image » off (its default): with it on, each name shows twice; rooms it cannot draw are listed under the plan.
3. **Cleaning** uses Home Assistant's own `vacuum.clean_area` action when the room is mapped to an area, or the integration's room action otherwise.

## When a floor or room is missing

The card says on the plan what is missing and what you can change in Home Assistant:

- **« This floor plan is turned off in Home Assistant »**: Roomba+ creates its floor plan entities disabled. To enable one, go to Settings › Devices & services › Entities, set the Status filter to Disabled, search for the floor plan entity and open it, open its Settings, then select Enable under « This entity is disabled. ». Administrators get an « Open entity settings » button that opens these settings directly; the card itself never changes them.
- **A plan is under « Plans without a floor »**: assign the floor plan entity to an area that is on a floor, assign a floor to that area, or add the map's name as an alias of a floor. A disabled floor plan also needs to be enabled to show its picture.
- **A plan shows its picture but no room**: the robot has no area cleaning (a mop robot, for example), so its rooms can only be chosen on the plan where the card draws them, or its segments are not mapped to areas yet. An administrator maps them in the vacuum entity's settings, which the card's « Open vacuum settings » button opens; other users are asked to ask an administrator.
- **« no room outlines yet »** under the plans: the robot's rooms map has no outlines (no cloud map loaded yet), or the robot has no rooms map entity (missing or disabled). **« room outlines could not be read »** comes with a short code to quote in a bug report.

## Supported integrations

| Integration | Room outlines | Floor plans | Start a room | Status |
|---|---|---|---|---|
| Roomba+ (iRobot) | Yes, active map | Yes, every stored map | Yes | Planned |
| Others | Contributions welcome, see `CONTRIBUTING.md` | | | |

## Installation

The card is not in the Marketplace catalog yet. Add it as a custom repository:

1. In Home Assistant, go to **Settings > Marketplace > Add from link**.
2. Enter `EnO33/vacuum-map-card` and choose the **Dashboard** type if asked.
3. Install the repository and reload the browser page.
4. On a dashboard, add a **Manual** card with `type: custom:vacuum-map-card`.

The Marketplace also creates an update entity named « Vacuum Map Card ». A tile showing « Up-to-date » under that name is the update entity, not the card.

## Configuration

```yaml
type: custom:vacuum-map-card
```

The card has no option yet. Planned options (target design, not final, ignored by 0.1.0):

```yaml
# Everything will be discovered by default: floors, rooms, robots.
# Optional overrides:
floors: [ground_floor, first_floor]   # Home Assistant floor ids, in display order
robots: [vacuum.my_vacuum, vacuum.my_mop]
```

A visual editor is planned.

## Requirements

- Home Assistant 2026.3.0 or later for the card itself, for example with a dashboard resource added by hand.
- Home Assistant 2026.11 or later, to install from the Marketplace.
- A supported vacuum integration (see above).

## Contributing

Issues and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first, in particular the section on adding a new integration.

## Licence

[MIT](LICENSE).
