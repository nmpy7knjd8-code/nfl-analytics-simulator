# LICENSING AND DATA SOURCES — Phase 1

**Access date:** 2026-10-11  
**Rule:** Publicly accessible ≠ unrestricted commercial use. Pin snapshots. NFL only.  
**Historical MVP:** no paid credentials required.

Lead: copy into GitHub repo `docs/` when available.

---

## Primary historical path (required for MVP)

| Item | Detail | Verified |
| --- | --- | --- |
| **Data** | nflverse play-by-play GitHub Releases (`pbp` tag) | Release listing exists; seasons 1999+ published as files |
| **Python client** | [`nflreadpy`](https://pypi.org/project/nflreadpy/) **0.1.5** | Installed and used in this research env (2026-10-11) |
| **Client license** | **MIT** (`License-Expression: MIT` on PyPI wheel METADATA) | Yes |
| **Client requires** | Python ≥3.10; deps include `polars`, `requests`, `pydantic`, … | Yes |
| **Usage** | `import nflreadpy as nfl` then `nfl.load_pbp([2019,2020,2021,2022,2023])` → Polars DataFrame | Yes |
| **Data license** | nflverse-data package declares **CC BY 4.0** ([DESCRIPTION](https://raw.githubusercontent.com/nflverse/nflverse-data/master/DESCRIPTION)) | Yes |
| **Attribution** | Credit nflverse; retain license notice on redistribution of data derivatives per CC BY | Required |
| **Freshness** | Batch / scheduled updates — **not live play-by-play** | Documented + observed |
| **Experiment support** | Schedules for 2019–2023 load; PBP row counts observed for each season | Yes (see register) |

**Do not claim:** free nflverse/nflreadpy PBP is a live game feed.

**Deprecated client:** [`nfl_data_py`](https://github.com/nflverse/nfl_data_py) (MIT, archived → use nflreadpy).

---

## Subsets with stricter terms

| Dataset | Access | License / condition | MVP? |
| --- | --- | --- | --- |
| FTN charting | `load_ftn_charting` | **CC-BY-SA 4.0**; attribute FTN Data via nflverse ([nflreadpy license notes](https://nflreadpy.nflverse.com/)) | Optional; not required for EP/EPA/WP Stage A |
| Participation 2023+ | `load_participation` | **CC-BY-SA 4.0**; FTN attribution; docs say postseason completion for FTN era | Defer |
| Participation ≤2022 | `load_participation` | Attribute NFL NextGenStats via nflverse (per nflreadr docs) | Defer |

---

## Model / code sources (reference, not required runtime)

| Source | Role | License (verified) | Notes |
| --- | --- | --- | --- |
| [nflfastR](https://cran.r-project.org/web/packages/nflfastR/) | EP/WP calculators, methodology | **MIT** (CRAN) | R; not required if we train sklearn on labels from PBP |
| [fastrmodels](https://cran.r-project.org/web/packages/fastrmodels/) | Serialized XGBoost models | **MIT** (CRAN) | Use only if XGBoost later justified |
| [nfl4th](https://cran.r-project.org/web/packages/nfl4th/) | Fourth-down decisions | **MIT** (CRAN) | Phase 6 design reference |
| Yurko et al. arXiv:1802.00998 | EP/WP academic lineage | arXiv license terms | Cite; journal may be paywalled |
| Open Source Football EP/WP post | Feature lists + calibration narrative | CC BY-SA 4.0 text/figures (site footer) | Cite; do not treat plots as our results |

---

## Context tables (free, non-live)

| Source | Loader | Use | Caveat |
| --- | --- | --- | --- |
| Schedules / roof / temp / wind | `nfl.load_schedules` | Game metadata, roof for models | Also contains betting lines — **do not use odds fields in MVP models** |
| Injuries | `nfl.load_injuries` | Future context | Weekly reports, not play-clock live |
| Rosters / teams | `load_rosters`, `load_teams` | IDs | Snapshot pin |

---

## Live / commercial (non-blocking; not required)

| Provider | What docs say | Status for MVP |
| --- | --- | --- |
| Sportradar NFL API | Commercial live PBP; documented ~3s refresh when in-progress; pricing via order form; marketplace notes no official league partnership for that product | **Optional later**; paid; unknown ToS fit |
| ESPN unofficial CDN/API lists | Community-documented endpoints | **Unknown** licensing; not for MVP historical path |

Historical simulation **must not** depend on these.

---

## Redistribution & provenance checklist

1. Pin `nflreadpy` version and nflverse release/timestamp in every dataset snapshot.  
2. Store raw Parquet + checksum; do not mutate historical rows with simulations.  
3. CC BY: attribution in README/docs; SA applies if redistributing FTN-derived data.  
4. Separate columns: observed vs derived vs model prediction vs simulated.  
5. No sports-betting product features in MVP (AGENTS.md).

---

## Gaps (honest)

- Full commercial-use legal review of CC BY for this product’s distribution model: **not done** (engineering attribution plan only).  
- Bit-level rebuild of nflverse PBP from nfl.com: **not verified**.  
- Live provider contract/ToS: **unknown**.  
- Exact LICENSE file path in nflreadpy GitHub tree returned 404 in fetch; **PyPI METADATA License-Expression MIT** used as verification.
