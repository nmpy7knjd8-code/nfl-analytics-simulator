# Data Dictionary (MVP canonical)

**Source of truth for mapping:** `DATA_EXPERIMENT.md` §3 (verified 2026-10-11).  
**Client:** `nflreadpy==0.1.5` (cache_dir must be `pathlib.Path`).  
**Scope:** NFL only. FTN/participation **excluded** from MVP lake.

Conventions:

* `yardline_100`: yards from opponent end zone (typically 1–99 on scrimmage).
* Clock: prefer `half_seconds_remaining` / `game_seconds_remaining` (nflfastR-compatible).
* `score_differential`: posteam − defteam at **start of play**.
* Missing values stay null in the canonical layer.
* Published `ep` / `epa` / `wp` / `vegas_wp` are **reference model columns**, not observed state.

## game (`GameSummary`)

| Canonical | Source | Kind |
| --- | --- | --- |
| game_id | game_id | observed |
| league | — | always NFL |
| season | season | observed |
| week | week | observed |
| season_type | season_type | observed (REG/POST) |
| game_type | game_type | observed (optional) |
| game_date | game_date | observed |
| home_team_id | home_team | observed (abbrev = MVP team ID) |
| away_team_id | away_team | observed |
| roof | roof | observed |
| surface | surface | observed (optional) |
| stadium | stadium | observed (optional) |
| home_opening_kickoff | home_opening_kickoff | observed 0/1 |
| home_score / away_score | finals if available | observed |

## pre-play (`GameSituation`)

| Canonical | Source | Kind | EP | WP |
| --- | --- | --- | --- | --- |
| play_id | play_id | observed | id | id |
| possession_team_id | posteam | observed | ✓ | ✓ |
| defense_team_id | defteam | observed | | |
| is_home_possession | posteam vs home_team | **derived** | ✓ | ✓ |
| down | down | observed | ✓ | ✓ |
| distance | ydstogo | observed | ✓ | ✓ |
| yardline_100 | yardline_100 | observed | ✓ | ✓ |
| quarter | qtr | observed | | ✓ |
| half_seconds_remaining | half_seconds_remaining | observed | ✓ | ✓ |
| game_seconds_remaining | game_seconds_remaining | observed | | ✓ |
| score_differential | score_differential | observed | | ✓ |
| posteam_score / defteam_score | posteam_score / defteam_score | observed | | display |
| posteam_timeouts / defteam_timeouts | *_timeouts_remaining | observed | ✓ | ✓ |
| roof | roof | observed | ✓ | |
| receive_2h_ko | **derived** (absent in Parquet) | **derived** | | ✓ |
| reference_ep / reference_wp | ep / wp | **reference** | | |

`receive_2h_ko` derivation (nflfastR): within each `game_id`, for `qtr <= 2`, 1 when possession team will receive 2H KO (posteam == first non-null defteam in first half), else 0.

**MVP WP models must not use** `spread_line` or `vegas_wp` as features.

## play / post-play (`CanonicalPlay`)

| Canonical | Source | Kind |
| --- | --- | --- |
| description | desc | observed |
| play_type | play_type → enum | observed |
| yards_gained | yards_gained | observed |
| score_differential_post | score_differential_post | observed |
| posteam_score_post / defteam_score_post | *_post | observed |
| fixed_drive / fixed_drive_result | fixed_drive* | derived (nflverse) |
| reference.* | ep, epa, wp, wpa, vegas_wp, … | **reference** |

## predictions / simulations

Separate objects (`ModelPrediction`, `SimulationRequest`/`Result`) with `Provenance` and truth labels. Never overwrite historical play rows with counterfactuals.

## Experiment split (REG scrimmage)

| Split | Seasons | REG games | REG scrimmage plays |
| --- | --- | ---: | ---: |
| Train | 2019–2021 | 784 | 116,218 |
| Validate | 2022 | 271 | 39,704 |
| Test | 2023 | 272 | 40,031 |

No window change. POST retained for reconstruction; exclude from default EP/WP fit.

## Licensing / redistribution

* PBP: CC BY 4.0 (attribute nflverse). Pin sha256 (see DATA_EXPERIMENT).
* FTN/participation: CC BY-SA — **out of MVP**.
* Local lake only for MVP; see `LICENSING_AND_DATA_SOURCES.md`.
