# Vacuum Map Card

Une carte de tableau de bord Home Assistant pour nettoyer n'importe quelle pièce de la maison avec n'importe lequel de vos robots : tous vos plans côte à côte, touchez une pièce, choisissez un robot, confirmez, c'est parti.

> **État : en développement.** Rien n'est encore publié. La configuration ci-dessous est la cible et peut changer avant la 1.0.

[Read in English](README.md)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/images/card-dark.png">
  <img alt="Carte Home Assistant vide intitulée Vacuum Map Card" src="./docs/images/card-light.png" width="463">
</picture>

*La carte pour l'instant : seulement son titre. Les plans et les pièces arrivent ensuite.*

## Pourquoi

Les cartes d'aspirateur montrent en général un robot sur un plan. Une maison a souvent plusieurs étages et plusieurs robots (un aspirateur et un laveur, un robot par étage). Cette carte part de la maison plutôt que du robot :

- **Tous les étages d'un coup.** Un plan par étage, côte à côte, dans l'ordre des étages de Home Assistant.
- **Touchez une pièce, choisissez un robot.** La carte liste les robots capables de nettoyer cette pièce ; vous en choisissez un et confirmez : « Envoyer Roomba S9+ aspirer la chambre ? »
- **Aucune coordonnée à entretenir.** Pièces, contours et étages viennent de vos intégrations et de Home Assistant. Refaites la carte d'un étage dans l'application du fabricant, ajoutez une pièce ou un étage : la carte suit.
- **L'allure de Home Assistant.** Composants natifs, couleurs de votre thème en mode clair et sombre, utilisable au clavier et avec un lecteur d'écran.

## Fonctionnement

1. **Les étages et les pièces** viennent de Home Assistant : étages et pièces, et l'association entre les segments de l'aspirateur et vos pièces (réglages de l'entité aspirateur, Home Assistant 2026.3 ou plus récent, « à vérifier »).
2. **Les contours des pièces** viennent d'un *adaptateur de source de pièces* propre à l'intégration de l'aspirateur. Le premier prend en charge [Roomba+](https://github.com/johnnyh1975/ha_roomba_plus) (iRobot). D'autres adaptateurs peuvent s'ajouter sans toucher au reste de la carte.
3. **Le nettoyage** passe par l'action `vacuum.clean_area` de Home Assistant quand la pièce est associée à une pièce Home Assistant, sinon par l'action de l'intégration.

## Intégrations prises en charge

| Intégration | Contours des pièces | Plans d'étage | Lancer une pièce | État |
|---|---|---|---|---|
| Roomba+ (iRobot) | Oui, carte active | Oui, toutes les cartes | Oui | Prévue pour la 0.1 |
| Autres | Contributions bienvenues, voir `CONTRIBUTING.md` | | | |

## Installation

Pas encore disponible. L'objectif est de publier la carte dans le Marketplace de Home Assistant ; d'ici là, elle s'installera comme dépôt personnalisé (type Tableau de bord).

## Configuration

Cible, pas définitive :

```yaml
type: custom:vacuum-map-card
# Tout est découvert par défaut : étages, pièces, robots.
# Réglages facultatifs :
floors: [ground_floor, first_floor]   # identifiants d'étages Home Assistant, dans l'ordre d'affichage
robots: [vacuum.my_vacuum, vacuum.my_mop]
```

Un éditeur visuel fait partie de la première version.

## Prérequis

- Home Assistant « à vérifier » ou plus récent.
- Une intégration d'aspirateur prise en charge (voir plus haut).

## Contribuer

Issues et pull requests bienvenues. Lisez d'abord [CONTRIBUTING.md](CONTRIBUTING.md), en particulier la partie sur l'ajout d'une intégration.

## Licence

[MIT](LICENSE).
