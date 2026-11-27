# Home Assistant Marketplace: publishing a dashboard card

Status: **verified** on 2026-11-20 against Home Assistant **2026.11.2** (Marketplace integration `marketplace`, tag `2026.11.2` = commit `ff5d56b825a0fb66b03d01bc297d49e206cdaba3`) and its frontend **20261028.6** (tag = commit `92bcd97390e7f684df4bf3738aec812ff427d46e`). **Re-verified** on 2026-11-27 (#147) at the stable **2026.11.3** (frontend 20261028.8) and the beta **2026.12.0b2** (frontend 20261125.1): see « Re-check on 2026-11-27 ». Line numbers in the sections before « Re-check on 2026-11-27 » are at the 2026-11-20 tags; the re-check gives where they moved and uses the new tags. Re-check when `/check-versions` moves the latest Home Assistant release, and before each release that goes to the catalog.

Method: source read at the pinned tags with `gh api repos/<owner>/<repo>/contents/<path>?ref=<tag or sha>`; documentation read with a web fetch on 2026-11-20. No capture from a real installation was needed: nothing in this document comes from the owner's home.

## Where things live (2026-11-20)

| What | Where | Source |
|---|---|---|
| Marketplace code (backend) | `homeassistant/components/marketplace/` in `home-assistant/core`; `integration_type: system`, requirement `aiogithubapi==26.0.0` | https://github.com/home-assistant/core/tree/2026.11.2/homeassistant/components/marketplace , `manifest.json` |
| Marketplace panel (frontend) | `src/panels/marketplace/` and `src/data/marketplace/` in `home-assistant/frontend` | https://github.com/home-assistant/frontend/tree/20261028.6/src/panels/marketplace |
| User documentation | https://www.home-assistant.io/integrations/marketplace/ (page source last changed in commit `dc7a69447476f548a4688da9281ecda881c3547f`, 2026-11-11) | https://github.com/home-assistant/home-assistant.io/blob/dc7a69447476f548a4688da9281ecda881c3547f/source/_integrations/marketplace.markdown |
| Catalog list (what is « in the catalog ») | Repository `hacs/default`, one JSON array of `owner/repo` per category; dashboard cards are in the file `plugin`. The Marketplace names it `CATALOG_REPOSITORY = "hacs/default"` | `const.py` L43-45 at tag `2026.11.2`; https://github.com/hacs/default/tree/d1d62ffd9ceba8320c6de4d49f9bc81a29e22dbd (master, 2026-11-19) |
| Catalog data feed the Marketplace downloads | `https://data-v2.hacs.xyz` (default download profile; mirrors in the China profile) | `profiles.py` L88-92 at tag `2026.11.2` |
| Who builds that feed | Workflow `generate-hacs-data.yml` in `hacs/integration`, cron `0 */4 * * *` (every 4 hours), reading the `hacs/default` lists | https://github.com/hacs/integration/blob/8a543828351b963438a1613a6f06332138e4f4d6/.github/workflows/generate-hacs-data.yml L31-32, L128-148 |
| Validation action | `hacs/action` (Docker action, image `ghcr.io/hacs/action:main`, built from `action/Dockerfile` of `hacs/integration`) | see « Validation action » below |
| Developer documentation for publishers on home-assistant.io / developers / contributors | **None found.** The Marketplace page has no publisher section (no `hacs.json` fields, no file rules, no submission process); the 2026.11 release post only links to that page. `hacs/default` README and PR template still point to `hacs.xyz/docs/publish/*` | release post https://www.home-assistant.io/blog/2026/11/04/release-202611/ (read 2026-11-20); `hacs/default` `README.md` and `.github/PULL_REQUEST_TEMPLATE.md` at `d1d62ff` |

All core paths below are relative to `homeassistant/components/marketplace/` at tag `2026.11.2`; URL form `https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/components/marketplace/<file>#L<a>-L<b>`. Read on 2026-11-20. The folder holds two `base.py` files: a bare `base.py` means the top-level `marketplace/base.py`; `repositories/base.py` is named in full.

## What the documentation says (source 1)

From https://www.home-assistant.io/integrations/marketplace/ (read 2026-11-20):

| Fact | Section |
|---|---|
| « A custom repository must meet the same requirements as the repositories in the catalog: it is a public repository on GitHub; it includes a `hacs.json` file that describes it; it holds an integration, dashboard, theme, or template and uses the folder structure required for its content type. » | Custom repositories |
| Adding a custom repository needs a GitHub connection (Settings > Marketplace > « Add from link », URL or `owner/repository`); the type can be chosen when it cannot be detected. | Custom repositories |
| A dashboard is installed in `www/community` and added as a dashboard resource; with YAML-managed resources the user adds it. Resources are served from `/local/community/`; old `/hacsfiles/` paths keep working. | Folder structure, Coming from HACS |
| « A custom repository without a `hacs.json` file stays installed, but the Marketplace cannot update it. » | Coming from HACS |
| Each installed repository gets an update entity. The catalog is checked every 6 hours; custom repositories with a GitHub connection every 48 hours. | Updates |
| Only stable releases are offered by default; a per-repository « Pre-release » switch (off by default) offers pre-releases. « Install another version » picks another version. | Updates |
| When the latest version needs a newer Home Assistant, the install dialog lists earlier versions. | Install |
| Not documented: `hacs.json` fields, file lookup, release rules, catalog submission. | — |

## `hacs.json` (source 2)

**Location**: must be at the repository root, at the ref being installed (the latest release tag when releases exist). The presence check in `common_validate` matches the file name anywhere in the tree (`repositories/base.py` L641-643, base name only), but the content is read from the root path only (L952): a `hacs.json` in a sub-folder passes the check and its keys are silently not applied. The file name is `RepositoryFile.REPOSITORY_MANIFEST = "hacs.json"` (`enums.py` L32-35). It is fetched with path `hacs.json` (root only) through the contents API at `version_to_install()` (`repositories/base.py` L945-959) or from raw at the catalog version (`repositories/base.py` L1964-1979, L2190-2195). Missing from the tree: validation error `repository_manifest_not_in_root` (« {repository} has no hacs.json in its root, the Marketplace needs one to install it. », `strings.json`), raised in `common_validate` (`repositories/base.py` L634-654); a repository with validation errors is not registered as a custom repository (`base.py` L872-879). Installing a version whose tree has no `hacs.json` fails with `version_without_repository_manifest` (`repositories/base.py` L2043-2051).

**Parsing**: only the keys of `REPOSITORY_MANIFEST_VALUES` are read; any other key is ignored silently; a value of the wrong type is ignored with a log warning « Ignoring <key> in hacs.json, <value> is not valid » (`utils/validate.py` L60-70; `repositories/base.py` L398-416). No key is required by the Marketplace itself.

| Key | Type | Default | Effect for a dashboard card | Source |
|---|---|---|---|---|
| `name` | string | none | Display name. Without it: repository name with `-` and `_` replaced by spaces, title-cased (`vacuum-map-card` gives « Vacuum Map Card »). For catalog repositories the feed's `manifest.name` overwrites it. | `repositories/base.py` L500-514, L152; `base.py` L1248-1251 |
| `filename` | string | none | When set, the **only** accepted card file name (release asset or tree file). When not set, see « Card file » below. A `/` in the name is cut to its last part with a warning when building the resource URL. | `repositories/plugin.py` L283-294, L384-396 |
| `homeassistant` | string, valid AwesomeVersion | none | Minimum Home Assistant version. Install of a version whose `hacs.json` names a newer one fails with « This version requires Home Assistant {version} or newer. ». The list's `can_install` flag uses it only when the repository has releases; the frontend then offers earlier versions. | `utils/validate.py` L53-57; `repositories/base.py` L586-594, L2055-2067; frontend `src/panels/marketplace/dialogs/dialog-marketplace-install.ts` L126-132 at tag `20261028.6` |
| `content_in_root` | bool | `false` | `true`: release assets are never looked at and `dist/` is never looked at; only root files. | `repositories/plugin.py` L231, L321, L340-350 |
| `zip_release` | bool | `false` | With `filename` ending in `.zip`, the content comes from that ZIP release asset, extracted into the card folder. Catalog installs of such a repository fall back to the GitHub API path. Not needed for a single `.js`. | `repositories/base.py` L601-611, L728-753, L1262-1267, L2217-2220 |
| `persistent_directory` | string | none | A sub-folder kept across updates (backed up and restored). | `repositories/base.py` L1376-1408 |
| `hide_default_branch` | bool | `false` | Sent to the frontend in the repository info (`websocket/repository.py` L126) but not referenced by the frontend Marketplace files at tag `20261028.6`. Visible effect: none, settled on 2026-11-27 (see « Re-check on 2026-11-27 », « Frontend »). | as cited |
| `hacs` | string | none | Read and kept, never compared (« names a version of the custom integration »). | `repositories/base.py` L386, L2057-2058 |
| `render_readme` | — | — | **Not read** by the Marketplace (not in `REPOSITORY_MANIFEST_VALUES`). The README is always shown, see below. | `utils/validate.py` L61-70 |
| `country` | — | — | **Not read** from `hacs.json`; accepted but ignored in catalog data (« Accepted for existing repositories, the Marketplace ignores it »). | `utils/validate.py` L61-70, L133-137 |

**README rendering**: the repository page shows the first of `README.md`, `readme.md`, `readme.MD`, `README.MD`, `README`, `readme` found in the root, at the installed version (or the available one when not installed); `<svg` tags are disabled (`repositories/base.py` L79-86, L961-976, L1911-1953). `info.md` is not read. The frontend renders it with `ha-markdown`; relative links and images resolve against the repository at that version (`.md` files open on GitHub, others come from raw) (frontend `src/panels/marketplace/dashboards/ha-marketplace-repository-dashboard.ts` L462, L492, L543-547 and `src/panels/marketplace/tools/markdown.ts` at tag `20261028.6`).

**The validation action is stricter than the Marketplace** (see below): it requires `name` and rejects unknown keys.

## Card file (source 2)

A dashboard card is category `plugin` (« Dashboard resources, the catalog calls them plugins », `enums.py` L11).

**Accepted names**, in order (`repositories/plugin.py` L283-294): `filename` from `hacs.json` if set, otherwise, with `<name>` the repository name (the part after `/`, `repositories/base.py` L338-343):
1. `<name without "lovelace-">.js`
2. `<name>.js`
3. `<name>.umd.js`
4. `<name>-bundle.js`

**Where it is looked for** (custom repository, `update_filenames`, `repositories/plugin.py` L313-350):
1. **Assets of the latest release** (the newest stable release, or pre-release when the Pre-release switch is on), unless `content_in_root` is `true`. First accepted name present as an asset wins; content is then « release » (single file mode).
2. Otherwise the **tree at the installed ref**: for each accepted name in order, the **root** first, then **`dist/`** (skipped when `content_in_root` is `true`).
3. Nothing found: error `structure_not_compliant` (« {repository} has no content the Marketplace can install in version {version}. ») (`repositories/plugin.py` L163-188, L211-224).

Type detection for « Add from link » uses the same lookup, and a dashboard is only detected when the resolved file ends in `.js` (`base.py` L797-836; `repositories/plugin.py` L190-196).

**Catalog installs** of the version named by the feed first probe `https://github.com/<repo>/releases/download/<tag>/<name>` for each accepted name (not with `content_in_root`); found, every asset of that release is downloaded. Otherwise the tag archive is downloaded and the same root/`dist/` lookup runs on it; files marked `export-ignore` are not in the archive (`repositories/plugin.py` L226-281; `repositories/base.py` L2131-2251).

**Several files**:
- Release: **every asset of the release** is downloaded into the card folder, the resource points at the matched one (`repositories/plugin.py` L248-281; `repositories/base.py` L810-830, L1742-1779). Total asset size limit 100 MiB (`const.py` L34-36; `release_too_large`).
- Root: every `.js` file of the root is downloaded (`repositories/plugin.py` L81-96).
- `dist/`: every file below `dist/`, sub-folders included, is downloaded (falls through to `gather_tree_files_to_download`, `repositories/base.py` L1715-1733).
- Only one dashboard resource is registered, for the matched file.

**Install target and resource** (`repositories/plugin.py`, `const.py` L15-18):
- Folder `<config>/www/community/<repository name>` (owner left out; a second installed repository with the same name is refused, `plugin_owned`). The folder name is kept after a GitHub rename (L47-56, L99-118).
- After install, the file must exist, else `installed_resource_missing` (L120-132).
- In storage mode the resource `{"res_type": "module", "url": "/local/community/<name>/<file>?v=<repository id>-<url-encoded version>"}` is added or updated; in YAML mode nothing is written (L352-463). If `www/` did not exist at startup, a repair asks for a restart (L140-152).

## Releases (source 2, and source 1 for pre-releases)

| Fact | Source |
|---|---|
| Releases are **not required** by the Marketplace: without releases the repository follows the default branch and the version shown is the short commit SHA (7 chars). | `repositories/base.py` L542-556, L1888-1909, L2321-2329 |
| Releases are read from the GitHub releases API (latest 30); **drafts are skipped**; a tag containing `?`, `#`, `%`, `\`, whitespace or a `.`-starting segment is skipped. | `repositories/base.py` L1478-1495, L1592-1627; `utils/validate.py` L31-41 |
| `last_version` = **tag name** (not the release title) of the newest non-pre-release. `prerelease` = newest pre-release when it is newer than that stable one. | `repositories/base.py` L1610-1617 |
| Version shown as « available » = `prerelease` when the repository's Pre-release switch is on and one exists, else `last_version`, else the last commit. The update entity's `latest_version` is that value; its release URL is `https://github.com/<repo>/releases/tag/<version>`. | `repositories/base.py` L542-551; `update.py` L75-91 |
| Update detection compares installed and available versions with AwesomeVersion (newer only when both strategies are known; else « different »). AwesomeVersion 25.8.0 (pinned in core 2026.11.2 `package_constraints.txt`) recognises a `v`/`V` prefix. | `utils/version.py` L12-34; `repositories/base.py` L558-584; `ludeeus/awesomeversion` `awesomeversion/awesomeversion.py` L251-257 at tag `25.8.0` |
| Release notes of up to 5 releases feed the update entity. | `const.py` L31-32; `update.py` L167-209 |
| When only pre-releases exist and the switch is off, the version to install is the default branch; a card whose built file only exists as a release asset then has nothing to install (`structure_not_compliant`). Consequence derived from the code above, not tested. | `repositories/base.py` L1888-1909, L1620-1624; `repositories/plugin.py` L319-350 |
| The catalog (and so the feed) only names a version for repositories with releases. | `repositories/base.py` L2160-2161, L2304-2306 |

## Catalog submission (source 2 for the catalog repository; process only documented on hacs.xyz)

Facts from `hacs/default` at commit `d1d62ffd9ceba8320c6de4d49f9bc81a29e22dbd` (read 2026-11-20):

| Fact | Source file |
|---|---|
| Submission = pull request to `hacs/default` (branch `master`) adding `"owner/repo"` to the JSON array in the file `plugin`. The arrays must stay sorted with `str.casefold`. | `plugin`; `scripts/is_sorted.py`; `.github/workflows/lint.yml` L27, L56-71 |
| PR template checklist: read the publishing docs (hacs.xyz); HACS action added to the repository and passing **without disabled checks**; link to the current release; link to the successful HACS action run (without `ignore`); a new release created after the actions passed. Template last changed 2025-12-15 (`ab3e23f`). | `.github/PULL_REQUEST_TEMPLATE.md` |
| Checks on pull requests to `hacs/default`: **Editable PR** runs on every pull request; the others run on pull requests labelled « New default repository »: **Owner** (submitter is the repository owner, or a non-bot contributor with at least a third of the top contributor's commits); **Editable PR** (« Allow edits by maintainers » on, unless the branch is in `hacs/default`, see above); **Releases** (`/releases` not empty); **Removed** (not in the removed list); **Existing** (not already listed); **HACS action** (`hacs/action@main` with the detected category). Hassfest and core domain conflict run for integrations only. | `.github/workflows/checks.yml`; `scripts/check/owner.py`, `edits.py`, `releases.py`, `removed.py`, `existing.py` |

How long reviews take, and whether Home Assistant staff now review submissions: « à vérifier » (no source 1 or 2 statement; confirm with an official publisher page or the `hacs/default` contributing rules). Partly settled by observation on 2026-11-27, see « Re-check on 2026-11-27 », « `hacs/default` ».

### Validation action

| Fact | Source |
|---|---|
| Name « HACS Action », repository `hacs/action`, default branch `main`, inputs `category` (required), `repository`, `ignore`, `comment`, `github_token`; runs the Docker image `ghcr.io/hacs/action:main`. | `action.yml` at `hacs/action` commit `1ebf01c408f29afcb6406bd431bc98fd8cbb15aa` (2026-06-08, latest commit on `main` on 2026-11-20) |
| **Latest release: `22.5.0`**, published 2022-05-28, tag commit `d556e736723344f83838d08488c983a15381059a`. The catalog itself runs `hacs/action@main`. Pinning `hacs/action` to a SHA does not pin the image, which is always `:main`. | `gh api repos/hacs/action/releases/latest`, `.../git/ref/tags/22.5.0`; `hacs/default` `checks.yml` |
| The image is built from `hacs/integration` (`action/Dockerfile`, `action/action.py`, the HACS custom integration code) on every push to `main` touching it. So the action validates with the **HACS** code, not with the Marketplace code in core. | `hacs/integration` at `8a543828351b963438a1613a6f06332138e4f4d6`: `.github/workflows/action-container.yml` L1-20, L51-64; `action/Dockerfile` |

Checks the action runs for category `plugin` (`custom_components/hacs/validate/*.py` at `hacs/integration` `8a54382`; `manager.py` drops checks of other categories and the ones named in `ignore`):

| Check | Rule |
|---|---|
| `archived` | Repository not archived |
| `description` | GitHub repository description set |
| `topics` | At least one topic. In action mode the topics are **not** filtered (`custom_components/hacs/repositories/base.py` L207-208 filters `TOPIC_FILTER` only when not running as the action; `action/action.py` sets it), so any topic passes. `TOPIC_FILTER` (`home-assistant`, `homeassistant`, `hacs`, `lovelace`, `lovelace-ui`, `custom-card`, `custom-cards`, `plugin`, `smart-home`, `home-automation`, ...; full list L57-102) only hides topics from what is displayed; the Marketplace applies an almost identical filter before showing topics (`repositories/base.py` L88-131, L371-374 in core). Corrected in #11 |
| `issues` | Issues enabled |
| `information` | A `README`, `README.md`, `info` or `info.md` in the tree |
| `images` | The README has a line with `<img` or `![` that is not a shield (`-shield`, `img.shields.io`) or `buymeacoffee.com` |
| `hacsjson` | `hacs.json` in the tree and valid against `HACS_MANIFEST_JSON_SCHEMA`: **`name` required (string)**; optional `content_in_root`, `country`, `filename`, `hacs`, `hide_default_branch`, `homeassistant` (string), `persistent_directory`, `render_readme`, `zip_release`; **extra keys rejected** (`PREVENT_EXTRA`) (`custom_components/hacs/utils/validate.py` L78-92) |
| `license` | GitHub detects a licence with an SPDX id that is OSI-approved (`MIT` is in the built-in list) |
| `brands` | Integrations only: not a requirement for a card |
| `integration_manifest`, `integration_categories` | Integrations only |

The action also registers the repository with HACS, which resolves the card file with HACS's own plugin logic. That lookup is the same as the Marketplace's: the same four accepted names in the same order (or only `filename` when set), the assets of the newest release first unless `content_in_root`, then root before `dist/` for each name (`custom_components/hacs/repositories/plugin.py` L99-135 at `hacs/integration` `8a543828351b963438a1613a6f06332138e4f4d6`). When no file is found, registration raises « Repository structure ... is not compliant » (L38-49) and the action exits with « not loaded properly » (`action/action.py`); this consequence is read from the code, not from a run.

## Pre-Marketplace rules (hacs.xyz, not current facts)

Read 2026-11-20; every page carries the banner « HACS is built into Home Assistant as the Marketplace, starting with 2026.11 ».

| Page | Old rule | Marketplace code (2026.11.2) |
|---|---|---|
| https://www.hacs.xyz/docs/publish/plugin/ | `.js` in `dist/` or root, named after the repository (or without `lovelace-`); lookup `dist`, latest release, root; all `.js` files of the first matching location are downloaded; users pick from the last 5 releases or the default branch | Lookup is **release assets first**, then per name root before `dist/`; accepted names add `.umd.js` and `-bundle.js`; release installs take every asset; the version list is up to 30 releases |
| https://www.hacs.xyz/docs/publish/include/ | Default repository requirements: works as a custom repository, public on GitHub, HACS action (no ignored checks), full GitHub release after the actions pass, owner or major contributor, description, issues, topics, README images for plugins, OSI licence, `hacs.json` with at least `name`, PR to `hacs/default` in alphabetical order from a personal account, editable | Matches the checks in `hacs/default` at `d1d62ff` listed above |

## Re-check on 2026-11-27 (#147)

Method: `gh api` on 2026-11-27. Core: blob SHAs of the 51 files of `homeassistant/components/marketplace/` compared between tags with the git trees API, changed files downloaded with `contents?ref=<tag>` and diffed, and every line range cited above mapped to the new tags with Python `difflib` (a range is « same text » when every line of it is matched). Frontend: blob SHAs of `src/panels/marketplace/`, `src/data/marketplace/` and `src/resources/markdown-worker.ts` compared, changed files diffed, and the whole `src/` of both tarballs searched with `grep`. Nothing comes from a real installation.

### Versions read

| What | Stable | Beta |
|---|---|---|
| Core tag (commit) | `2026.11.3` (`92da9f154079459b9e547126f9bd9fce726de16a`), released 2026-11-23 | `2026.12.0b2` (`78677c03648d72fb96e04fc7ea894502d3f0582c`), released 2026-11-26. The issue named 2026.12.0b1; b2 was the current beta at the time of work |
| Frontend (`home-assistant-frontend` requirement of `frontend/manifest.json` at the core tag) | `20261028.8` | `20261125.1` |
| `marketplace/manifest.json` (`aiogithubapi==26.0.0`) | unchanged | unchanged |
| AwesomeVersion in `homeassistant/package_constraints.txt` | `25.8.0` | `25.8.0` |

### Core `marketplace/` at the stable tag

Two files changed since `2026.11.2`; neither changes a rule this card depends on.

| File | Change | Effect for this card |
|---|---|---|
| `base.py` L590-591 | The `.gz` copy written next to an installed file now keeps the file's permissions (`shutil.copymode`). | None |
| `repositories/base.py` L2199-2226 | A catalog install that fails while resolving its content restores the whole previous state (manifest, ref, remote path, single file mode, tree, tree ref, tree files), not only the manifest. | None: error handling only |

Topic by topic: `hacs.json` keys, card file lookup, release and pre-release rules, README rendering and the update entity are **unchanged** (`utils/validate.py`, `repositories/plugin.py`, `update.py`, `utils/version.py`, `enums.py` identical; the README lookup L79-86, L961-976, L1911-1953 of `repositories/base.py` same text at the same lines).

### Core `marketplace/` at the beta tag

| Topic | At `2026.12.0b2` | Effect for this card |
|---|---|---|
| Card file: ZIP of the resource (new) | A dashboard resource may also ship as a release asset named after its file with `.zip` for `.js` (`vacuum-map-card.zip` here) (`repositories/plugin.py` L43-47). Name matching prefers the `.js` asset and uses the ZIP only when no `.js` matches (L500-510, used by `update_filenames` L513-545 and `release_contents` L485-498). When both are assets, the ZIP is the one downloaded and extracted (`_async_try_resource_archive` L121-149, called by `_async_download_files` L116-119 for release downloads and for catalog installs in `_async_download_release_assets` L453-469); the `.js` is used only if the ZIP is unusable. `_find_target_asset` (L101-113) only picks the asset whose download count is shown (`repositories/base.py` L1629-1639). The ZIP must hold the file at its root or in a single top folder (`_resource_folder` L221-233), else « {file} has no {resource} in its root or in a folder at its root. » (`strings.json` L278). Catalog installs probe the `.js` names first, then the ZIP names (L389-418). | None while the release carries only `vacuum-map-card.js` and its map: `release.yml` L148 refuses to publish any other asset set. Never attach an asset named `vacuum-map-card.zip`: from this version it would be installed instead of the `.js`. |
| Catalog install probe | Each release asset probe is now limited to `MAX_DOWNLOAD_SIZE` (100 MiB, `const.py` L34) (`repositories/plugin.py` L420-430). | None (card about 16 kB) |
| `hacs.json` parsing | The validated value is now the one kept (`repositories/base.py` L407). Booleans also accept the strings `"true"` and `"false"`; optional strings (`filename`, `hacs`, `persistent_directory`) read `false` or `null` as not set (`utils/validate.py` L60-86, L90-99). `render_readme` and `country` are still not read. | None: this card's three keys are plain strings |
| Release and pre-release rules, README lookup, update entity | Same text (only line shifts, table below; `update.py` identical). | None |
| Other changes | Mirrors renamed « relays » in text and code (`profiles.py`, `strings.json`); the download-source repair is tied to its config entry (`repairs.py`); a corrupt storage file is no longer taken as a first setup (`utils/data.py`, `utils/storage.py`); catalog repositories stay marked default until the catalog stops listing them (`base.py` L331-339). | None |

### Moved line ranges

Ranges cited in this document whose position changed; every other cited range is at the same lines. « Same text » unless stated.

| File (at `2026.11.2`) | Stable `2026.11.3` | Beta `2026.12.0b2` |
|---|---|---|
| `const.py` L31-32, L34-36, L43-45 | unchanged | L29-30, L32-34, L41-43 |
| `base.py` L797-836, L872-879, L1248-1251 | L799-838, L874-881, L1250-1253 | L808-847, L883-890, L1266-1269 |
| `utils/validate.py` L60-70 (manifest keys), L133-137 | unchanged | L90-99 (text changed, see above), L163-167 |
| `repositories/base.py` L398-416 | unchanged | same lines, L407 changed (see above) |
| `repositories/base.py` L2131-2251 (catalog install), L2217-2220, L2304-2306, L2321-2329 | L2131-2267 (text changed, see above), L2233-2236, L2320-2322, L2337-2345 | same as stable |
| `repositories/plugin.py` L47-56, L81-96, L99-118, L120-132, L140-152, L161-196 (L163-188, L190-196), L211-224 | unchanged | L74-83, L243-258, L261-280, L282-294, L302-314, L323-358 (L325-350, L352-358), L373-386 |
| `repositories/plugin.py` L226-281 (catalog probe; L231, L248-281), L283-294 (accepted names) | unchanged | L388-469 (text changed: ZIP probe; L393 same), L471-482 |
| `repositories/plugin.py` L313-350 (lookup; L321, L340-350), L352-463 (resource), L384-396 (`/` in `filename`) | unchanged | L512-545 (text changed: ZIP names; L520 and L535-545 same), L547-658, L579-591 |

### Frontend

| Fact | Stable `20261028.8` | Beta `20261125.1` |
|---|---|---|
| Marketplace files | The 29 files are identical to `20261028.6`: every frontend citation above holds. | Changed: discover, repositories, custom repositories, dashboard, repository dashboard, install dialog, panel, `tools/markdown.ts`, `data/marketplace/repository.ts`, `markdown-worker.ts`. |
| Earlier versions offered when the latest needs a newer Home Assistant | `dialog-marketplace-install.ts` L126-132 | Same lines; the version list now shows a loading state instead of a « fetching » text (L436-451). |
| README rendering | `ha-marketplace-repository-dashboard.ts` L462, L492, L543-547 | Same code at L507, L537, L588-592 |
| Relative `src`/`srcset` kept only with `./` | `markdown-worker.ts` (`allowRelativeUrls`, `safeAttrValue`) | Same rule (L164-168); `data:` link addresses are now escaped and the `download` attribute list is copied (L110-113, L161) |
| README sections hidden from the Marketplace (new) | — | Text between `<!-- ha-marketplace:exclude-start -->` and `<!-- ha-marketplace:exclude-end -->` (or to the end without an end marker) is left out of the repository page; markers inside code are text (`tools/markdown.ts` L300-327, applied in `markdownWithRepositoryContext` L332-362). Optional for this card: it could hide the README install steps the page header already covers. |
| `hide_default_branch` | Not in any file of `src/` | Not in any file of `src/`. In core it is only parsed (`repositories/base.py` L387) and sent by `websocket/repository.py` L126 at both tags. |

### Documentation (home-assistant.io and developers)

| Fact | Source |
|---|---|
| The Marketplace page on the live branch `current` has not changed since `dc7a694` (2026-11-11). | `gh api repos/home-assistant/home-assistant.io/commits?path=source/_integrations/marketplace.markdown&sha=current` |
| The 2026.11 release post says, in present tense: « Custom repositories require a GitHub connection. The Marketplace uses GitHub device sign-in [...] ». No « in the future ». | `source/_posts/2026-11-04-release-202611.markdown` L134 on `current`, last changed in `d6eccdb` (2026-11-23) |
| **Translated READMEs (not released yet)**: the page on branch `next` (commit `3bbb4fe`, 2026-11-26) adds « If the repository has a README in the language of Home Assistant next to `README.md`, such as `README.de.md` or `README.pt-BR.md`, the page shows that one instead. » The core change is PR home-assistant/core#189842, merged into `dev` on 2026-11-26 (`9145f86`): `README.<language>.md` files at the root are matched to the language with `homeassistant.util.language.matches`, `README.md` is the fallback, nothing is declared in `hacs.json`. It is **not** in `2026.12.0b2`: `repositories/base.py` there has no language matching, only the fixed `README_FILENAMES` (L79-86) and its lookup (L961-976), and `9145f86` is not an ancestor of the tag (`compare/9145f86...2026.12.0b2`: diverged; a cherry-pick would have another SHA, so the code is the proof). A follow-up, home-assistant/core#194898 (cache per version), is open. | as cited |
| Consequence for this card, once released: French users would see `README.fr.md` on the repository page, so it needs the same image block with `./docs/images/...` paths as `README.md` (it already has one). Not tested. | derived from the PR description |
| No publisher guide: `developers.home-assistant` (`master`, `50b5188`) has no file named after the Marketplace or HACS, and GitHub code search finds neither « marketplace » nor « hacs.json » in it; on home-assistant.io the only page naming `hacs.json` is the Marketplace page. | `git/trees?recursive=1` on both repositories; `gh search code` (default branch only) |

### `hacs/default` at `f6292f23e07d4dfaefbe60f8ec9bbcbd00114858` (`master`, 2026-11-27)

| Fact | Source |
|---|---|
| 572 commits since `d1d62ff`; the changed files are the category lists (`plugin`, `integration`, `theme`, `appdaemon`), `removed`, `blacklist` and `scripts/helpers/integration_path.py` (integrations only). | `compare/d1d62ff...master` |
| Unchanged: `plugin` is still one JSON array of `owner/repo`, sorted with `str.casefold` (1316 entries, sorted on read); `.github/PULL_REQUEST_TEMPLATE.md` (last change `ab3e23f`, 2025-12-15); `.github/workflows/checks.yml` (last change `e751d99`, 2026-11-05) and `scripts/check/*`; `lint.yml`; `scripts/is_sorted.py`. The rules in « Catalog submission » above hold. | as cited |
| The template also says « DO NOT REQUEST REVIEWS [...] IF YOU DO THE PULL REQUEST WILL BE CLOSED » and « Do not open a pull request before you have completed all these ». | `.github/PULL_REQUEST_TEMPLATE.md` |
| A bot adds the label of new pull requests; the checks read the labels from the API. | `checks.yml` L37-40 (comment) |
| No entry named `vacuum-map-card`; nearest names: `PiotrMachowski/lovelace-xiaomi-vacuum-map-card`, `Igloczek/lovelace-better-xiaomi-vacuum-map-card`, `noambergauz/dreame-vacuum-map-card`. `EnO33/vacuum-map-card` is in neither `removed` nor `blacklist`. Its sorted place is between `EnkodoNL/tabbed-card-programmable` and `enricodeleo/candy-dishwasher-card`. | `plugin`, `removed`, `blacklist` at `f6292f2` |
| Observed, not a rule: the last 40 merged pull requests labelled « New default repository » (merged 2026-11-26 and 27) were all merged by one account, `frenck`, 0 or 1 day after they were opened. From 2026-11-01 to 2026-11-27, 2069 such pull requests were merged and 214 closed without merge; 533 were open on 2026-11-27. | `gh pr list -R hacs/default --state merged --label "New default repository" --limit 40`; `gh api search/issues` |

### Validation action

`hacs/action` `main` is still `1ebf01c` (2026-06-08), latest release still `22.5.0`. `hacs/integration` `main` is still `8a54382` (2026-11-10, `compare` ahead by 0), so the image validates with the same code and the checks listed above are unchanged. Run `45887463575` of this repository's HACS workflow on `main` (2026-11-26) logs « All (8) checks passed » for `archived`, `description`, `topics`, `issues`, `information`, `images`, `hacsjson`, `license`.

## Catalog submission checklist for this card

State on 2026-11-27. #156 re-checks every row the day of the submission.

| Requirement | Required by | How this card meets it | Still missing |
|---|---|---|---|
| Read the publishing documentation (`hacs.xyz/docs/publish/start`) | template (first checkbox) | — | The owner ticks it, at submission |
| Public GitHub repository, not archived | template, `archived` check | `EnO33/vacuum-map-card`, public, not archived | — |
| Submitter is the owner (or a major contributor) | `Owner` check | Owner account `EnO33` (a user, not an organisation) opens the pull request | At submission |
| Description | `description` check | « Home Assistant dashboard card: every floor plan side by side, tap a room, pick a robot, confirm » | — |
| At least one topic | `topics` check | 9 topics (`dashboard`, `floor-plan`, `hacs`, `home-assistant`, `lovelace`, `lovelace-card`, `robot-vacuum`, `roomba`, `vacuum`) | — |
| Issues enabled | `issues` check | Enabled | — |
| OSI licence | `license` check | MIT, detected by GitHub | — |
| README with a non-badge image | `information`, `images` checks | `README.md` with a `<picture>`/`<img>` of the card; checks passed | #152 replaces the pictures; the check runs again on its pull request |
| `hacs.json` at the root: `name`, no extra keys | `hacsjson` check, Marketplace | `name`, `filename: "vacuum-map-card.js"`, `homeassistant: "2026.3.0"` | — |
| Card file found as a release asset | action registration, Marketplace lookup | `v0.1.0` assets `vacuum-map-card.js` (16149 bytes) and `vacuum-map-card.js.map`; no `vacuum-map-card.zip` | — |
| At least one release | `Releases` check | `v0.1.0`, published, not a draft, not a pre-release | — |
| HACS action in the repository, passing without disabled checks | template | `.github/workflows/hacs.yml`, `category: plugin`, no `ignore`; green on `main` since 2026-11-23 (run `45887463575`, 2026-11-26) | Link to a green run on the release commit, at submission |
| A new release created **after** the actions passed | template | Not met by `v0.1.0`: published 2026-11-23 09:47:57 UTC, first green HACS run 09:54:17 UTC (`workflow_dispatch`) | The MVP release (#155), tagged from a `main` commit whose HACS run is green |
| Link to the current release | template | — | The MVP release URL (#155) |
| Not already listed, not removed | `Existing`, `Removed` checks | Absent from `plugin`, `removed`, `blacklist` at `f6292f2` | — |
| One line `"EnO33/vacuum-map-card"` in `plugin`, sorted with `str.casefold` | `lint.yml`, `is_sorted.py` | Between `EnkodoNL/tabbed-card-programmable` and `enricodeleo/candy-dishwasher-card` at `f6292f2` | Recompute on the day: the list grows daily |
| Pull request from the owner's fork with « Allow edits by maintainers » | `Editable PR` check, owner decision | — | The owner, at submission (#156) |
| No review requested | template | — | The owner, at submission |
| Hassfest | template | Integrations only: not applicable | — |

No change to `hacs.json`, `release.yml` or the README is **required** by this re-check, so no task issue is filed. Optional, for the README work of this epic: the exclusion markers (beta frontend only) could hide install steps on the Marketplace page, and `README.fr.md` will matter on the repository page once translated READMEs ship.

## « à vérifier »

| Item | What would confirm it |
|---|---|
| An official publisher guide for the Marketplace (home-assistant.io, developers, contributors) | Still none on 2026-11-27 (see « Documentation »). A page on those sites |
| Effect of `hide_default_branch` | **Settled 2026-11-27**: no visible effect at stable and beta; parsed and sent, never read by the frontend (see « Frontend »). This card does not set it |
| Review time and reviewers of `hacs/default` submissions | Partly settled 2026-11-27 by observation only (see « `hacs/default` »). Still no official statement: a publisher page or `hacs/default` contributing rules |
| The release post's GitHub connection wording | **Settled 2026-11-27**: the post says custom repositories require a GitHub connection, present tense, like the doc page (see « Documentation ») |
| Minimum Home Assistant version of this card | Resolved 2026-11-23 (#28): 2026.3.0, see `docs/standards.md` |
| Translated READMEs: the release that ships core#189842, and that `README.fr.md` and its `./docs/images/...` pictures show for a French Home Assistant | A core tag whose `repositories/base.py` matches `README.<language>.md` to the language (a 2026.12 beta may carry it as a cherry-pick), then a look at the repository page with French selected |
| The README exclusion markers in a stable frontend | A stable frontend tag whose `tools/markdown.ts` has `EXCLUSION_MARKER` |

## Gaps for this card

Current state: public MIT repository; the build writes exactly `dist/vacuum-map-card.js` and its source map `dist/vacuum-map-card.js.map` (owner decision, #9); `dist/` is Git-ignored, so the tree never holds the card file and both the Marketplace and the HACS action can **only** find it as a release asset.

### Order of work

Until a stable release carrying `vacuum-map-card.js` exists, from a commit that already contains `hacs.json`:

- « Add from link » cannot detect the type, and choosing « Dashboard » by hand fails with `structure_not_compliant` (core `base.py` L797-836, L872-879; `repositories/plugin.py` L161-196).
- The HACS action fails (see « Validation action »).

So the order is:

1. Merge #9 (release workflow).
2. Merge #11 (`hacs.json`, action workflow).
3. Cut the first stable release `vX.Y.Z`.
4. Then run the « Add from link » check and expect the action to go green.

Proposed amendment to #11: move its manual « Add from link » check after the first release, and do not make the HACS action a required status check before then.

### What #9 (release workflow) must do

1. On tag `vX.Y.Z`, publish a **full GitHub release** from that tag, with the asset named exactly **`vacuum-map-card.js`**. It must match `filename` in `hacs.json` (owner decision: set explicitly).
2. Create the release as a **draft**, upload the assets, then publish it, or use one command that publishes only once the uploads succeed.
   - Drafts are skipped (`repositories/base.py` L1490).
   - A published stable release without its card file makes the lookup fall back to the tree, which has no built file. Every install and update then fails with `structure_not_compliant` until the release is fixed (`repositories/plugin.py` L313-350).
3. Assets: every asset is downloaded into `www/community/vacuum-map-card/` (100 MiB total).
   - Owner decision: also ship the source map `vacuum-map-card.js.map`. It is served next to the card, so browsers can load it. Attach nothing else.
4. The **first** release must be a stable release, not a pre-release: with only pre-releases the Marketplace falls back to the default branch, which has no built file.
5. The tagged commit must already contain `hacs.json` (#11) and the README: both are read at the tag.
6. The version users see is the **tag name**, `v` included (`v0.1.0`; owner decision: keep the `v` prefix).
   - The release body becomes the update entity's release notes; keep it ASCII (project rule).
7. Tag names must avoid `?`, `#`, `%`, `\`, whitespace and dot-starting segments (`vX.Y.Z` is fine).
8. Catalog prerequisite: create a new release **after** the HACS action is green (PR template).

### What #11 (Marketplace metadata) must do

1. Add `hacs.json` at the repository root, with only keys of the action's schema (extra keys fail it):
   - `name` (required by the HACS action);
   - `filename: "vacuum-map-card.js"` (owner decision);
   - `homeassistant`: set to `2026.3.0` in #28 (see `docs/standards.md`).
   - Do **not** set `content_in_root` (it disables the release lookup) or `zip_release`. `render_readme` is ignored by the Marketplace; leave it out.
2. Repository settings (owner, not a file): description; topics with at least one outside the filter list; issues enabled. The MIT licence is already detectable.
3. Add a workflow running `hacs/action` with `category: plugin` on push, pull request and a schedule, and no `ignore`.
   - Owner decision: pin it by commit SHA, knowing the image is always `ghcr.io/hacs/action:main`.
   - It goes green only after the first release (see « Order of work »).
4. The `images` check needs a non-badge image in the README, and #11 currently lists README changes as out of scope.
   - Owner decision: an image of the card in the README, added in #11. While the card only shows its title, it is a capture of the current card (nothing from a real home), with a visible caption saying so. Epic 6 replaces it with a capture of the working card built from anonymised fixture data, in the default theme, at 2x.
   - The Marketplace frontend keeps a relative `src`/`srcset` only with a `./` prefix (`src/resources/markdown-worker.ts`, xss `safeAttrValue`, frontend `20261028.6`) and rewrites it to the repository's raw URL at the version (`src/panels/marketplace/tools/markdown.ts`): use `./docs/...` paths.
   - The README install instructions stay in Epic 6.

### Owner decisions (2026-11-20)

| Question | Decision |
|---|---|
| `v` prefix in tags | Keep it (`v0.1.0`) |
| Minimum Home Assistant version | **Superseded on 2026-11-23 by #28: 2026.3.0** (`docs/standards.md`). Original note: « 2025 », read as `2025.1.0`, to confirm by the owner and by Epic 2: the card must then fall back to the integration's room action where `vacuum.clean_area` does not exist yet, and every Home Assistant API it uses must exist in 2025.1. Note: the Marketplace itself exists from 2026.11; older versions install through HACS. |
| `filename` in `hacs.json` | Set explicitly |
| HACS action pinning | Pin by commit SHA |
| Repository topics | Open: proposal in #11, set by the owner |
| README image | Capture of the current card in #11 (2026-11-20 follow-up decision); real card from fixture data in Epic 6 |
| Source map as a release asset | Yes |
| Catalog submission (Epic 6) | When the card is ready. PR to `hacs/default` from the owner's personal account with « Allow edits by maintainers », after a release made once the action is green |

No upstream issue is drafted: nothing blocks this card in the Marketplace code; the missing publisher documentation could be raised with `home-assistant/home-assistant.io` if the owner wishes.
