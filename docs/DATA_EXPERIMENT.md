# DATA EXPERIMENT — NFL Historical Play-by-Play (Phase 1)

**Scope:** NFL only. Seasons **2019–2023**.  
**Access verification date:** 2026-10-11  
**Workstream:** Data (Phase 1)  
**Verdict:** Source **supports** the planned chronological experiment. No season-window change required.

---

## 1. Python access method (verified)

| Item | Verified value |
| --- | --- |
| **Maintained package** | [`nflreadpy`](https://github.com/nflverse/nflreadpy) — official Python port of R `nflreadr` |
| **PyPI** | https://pypi.org/project/nflreadpy/ |
| **Docs** | https://nflreadpy.nflverse.com/ |
| **Latest on PyPI (2026-10-11)** | **0.1.5** (releases 0.1.0–0.1.5). `main` `pyproject.toml` shows **0.1.7** not yet published to PyPI |
| **Requires Python** | `>=3.10` (classifiers: 3.10–3.13) |
| **Package license** | MIT |
| **Lifecycle** | Marked **experimental** / Beta — usable, pin a version |
| **Runtime deps** | `requests`, `polars`, `platformdirs`, `tqdm`, `pydantic`, `pydantic-settings` |
| **Return type** | Polars `DataFrame` (`to_pandas()` optional) |

### Install

```bash
pip install nflreadpy==0.1.5
# or: uv add nflreadpy
```

### Load PBP

```python
import nflreadpy as nfl
from pathlib import Path
from nflreadpy.config import update_config

update_config(
    cache_mode="filesystem",
    cache_dir=Path(".cache/nflreadpy"),  # use Path, not str (0.1.5 quirk)
    cache_duration=86400,
)

pbp = nfl.load_pbp([2019, 2020, 2021, 2022, 2023])
```

API (docs): `seasons=None` → current season; `int` / `list[int]` → those seasons; `True` → all since 1999.

### Underlying files

`load_pbp` downloads season Parquet from:

`https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_{season}.parquet`

Also published: `.csv`, `.csv.gz`, `.rds`, `.qs`. Prefer **Parquet** for DuckDB/local cache.

Direct download (no package) is valid for offline/pin workflows; package adds cache + concat.

### Cache plan (recommended)

| Layer | Location | Purpose |
| --- | --- | --- |
| **L1 — nflreadpy filesystem cache** | project `.cache/nflreadpy/` | Avoid re-download during interactive work |
| **L2 — project Parquet lake** | e.g. `data/raw/pbp/season={YYYY}/play_by_play.parquet` | Stable local copy; DuckDB reads this |
| **L3 — provenance sidecar** | `manifest.json` per season | URL, sha256, `timestamp.json` `last_updated`, package version, access date |

Env vars (docs): `NFLREADPY_CACHE` (`memory` \| `filesystem` \| `off`), `NFLREADPY_CACHE_DIR`, `NFLREADPY_CACHE_DURATION`, `NFLREADPY_TIMEOUT`, `NFLREADPY_VERBOSE`.

**Pinning:** store file sha256 (see §3). Releases under tag `pbp` are mutable; `timestamp.json` on 2026-10-11 read `{"last_updated":"2026-10-11 11:37:06 EDT"}`.

**Fallback if package regressions:** curl/wget the five Parquet assets into L2; load with Polars/DuckDB. Same schema.

---

## 2. Season coverage and split verification

Release tag [`pbp`](https://github.com/nflverse/nflverse-data/releases/tag/pbp) includes `play_by_play_{2019..2023}.parquet` (HTTP 200 confirmed).

### Observed file digests (local download 2026-10-11)

| Season | Bytes | SHA-256 |
| --- | --- | ---: |
| 2019 | 19,119,729 | `60c3067017db2d28a78f66a79b657268be8578d9a5288e6a827efdcd7fe42540` |
| 2020 | 19,286,459 | `8889f5d8782b5c5dce3c3644acdc0322b228a7e9cb13fa36cbac250e260e9f60` |
| 2021 | 20,249,925 | `333ad34378e5339d5172717cc83378e908daf02c8699416ab3e17c2ec10f78d8` |
| 2022 | 20,426,548 | `931121d8897779d7944e2a293e92ed8799c8e5cceef84096ac42339003fedc09` |
| 2023 | 20,534,088 | `bd3484731408def6b0ec93225bba2bd7b2c65769ca707a2b9444d891abdc6776` |

**2023 pin drift (same row count):** Phase 2 lake uses operational pin `b8417df9501f7f966eaccfffe463425fc06153f7bd58e075f5fa8f900e67460d` (20,624,417 bytes, still **49,665** rows). Cause: mutable nflverse `pbp` tag republish. Keep both digests; see [`DATA_PIN_NOTES.md`](DATA_PIN_NOTES.md). Do not silently replace local raw.

Schema: **372 columns**, identical across all five seasons. Row counts: 47,260 / 47,705 / 49,922 / 49,434 / 49,665.

### Chronological split (regular season, scrimmage = `down` not null)

| Split | Seasons | REG games | REG scrimmage plays |
| --- | --- | ---: | ---: |
| **Train** | 2019–2021 | 784 | 116,218 |
| **Validate** | 2022 | 271 | 39,704 |
| **Test** | 2023 | 272 | 40,031 |

Notes:

- 2019–2020: 17 REG weeks, 256 games each. 2021–2023: 18 REG weeks; 2021/2023 = 272 games; **2022 = 271** in both PBP and `load_schedules` (no orphan PBP gap vs schedules — cancelled BUF–CIN W17 never present as a completed REG game).
- Postseason rows exist (`season_type == "POST"`) but are **out of the default train/val/test counts** above; keep them available for reconstruction, exclude from EP/WP fit unless explicitly decided later.
- **No adjustment** to the 2019–2023 window is justified: all EP/WP pre-play inputs are present with ~0% null on scrimmage REG plays (see §4).

---

## 3. Source schema → proposed canonical fields (MVP)

Lead architect owns final contracts. Below is the **smallest** mapping that supports game reconstruction + pre-play EP/WP features.

Conventions observed in nflverse PBP:

- **Field position:** `yardline_100` = yards from opponent end zone (1–99); string `yrdln` is human-readable.
- **Clock:** `half_seconds_remaining`, `game_seconds_remaining`, `quarter_seconds_remaining`; `qtr` with `5` = OT; wall `time` is MM:SS string.
- **Score differential:** `posteam − defteam` at **start of play**.
- **IDs:** `game_id` (e.g. `2023_01_ARI_WAS`) + `play_id` identify a play; use both.

### 3.1 Game metadata

| Canonical field | Source column(s) | Kind | Notes |
| --- | --- | --- | --- |
| `game_id` | `game_id` | observed | Stable nflverse game key |
| `season` | `season` | observed | |
| `week` | `week` | observed | |
| `season_type` | `season_type` | observed | `REG` / `POST` |
| `game_date` | `game_date` | observed | |
| `home_team_id` | `home_team` | observed | Keep abbreviation as MVP team ID |
| `away_team_id` | `away_team` | observed | |
| `roof` | `roof` | observed | `dome` / `outdoors` / `closed` / `open` |
| `surface` | `surface` | observed | Optional context |
| `stadium` | `stadium` | observed | Optional |
| `home_opening_kickoff` | `home_opening_kickoff` | observed | 0/1; used to derive 2H KO receiver |

### 3.2 Pre-play state (inputs for EP / situation WP)

| Canonical field | Source column(s) | Kind | EP | WP |
| --- | --- | --- | --- | --- |
| `play_id` | `play_id` | observed | id | id |
| `possession_team_id` | `posteam` | observed | ✓ | ✓ |
| `defense_team_id` | `defteam` | observed | | |
| `is_home_possession` | `posteam` vs `home_team` (or `posteam_type`) | derived | ✓ | ✓ |
| `down` | `down` | observed | ✓ | ✓ |
| `distance` | `ydstogo` | observed | ✓ | ✓ |
| `yardline_100` | `yardline_100` | observed | ✓ | ✓ |
| `quarter` | `qtr` | observed | | ✓ |
| `half_seconds_remaining` | `half_seconds_remaining` | observed | ✓ | ✓ |
| `game_seconds_remaining` | `game_seconds_remaining` | observed | | ✓ |
| `score_differential` | `score_differential` | observed | | ✓ |
| `posteam_score` | `posteam_score` | observed | | display |
| `defteam_score` | `defteam_score` | observed | | display |
| `posteam_timeouts` | `posteam_timeouts_remaining` | observed | ✓ | ✓ |
| `defteam_timeouts` | `defteam_timeouts_remaining` | observed | ✓ | ✓ |
| `roof` | `roof` | observed | ✓ | |
| `receive_2h_ko` | **not in published columns** | derived | | ✓ |
| `spread_line` | `spread_line` | observed | | vegas-WP only |

**`receive_2h_ko` derivation** (from nflfastR `helper_add_ep_wp.R`, not stored in release Parquet): within each `game_id`, for `qtr <= 2`, set 1 when `posteam == first(non-null defteam)` (i.e. possession team will receive the 2nd-half kickoff), else 0. Required to call nflfastR-compatible WP; store as **derived**, not observed.

### 3.3 Play / post-play (reconstruction + EPA targets)

| Canonical field | Source column(s) | Kind |
| --- | --- | --- |
| `description` | `desc` | observed |
| `play_type` | `play_type` | observed |
| `yards_gained` | `yards_gained` | observed |
| `score_differential_post` | `score_differential_post` | observed |
| `posteam_score_post` | `posteam_score_post` | observed |
| `defteam_score_post` | `defteam_score_post` | observed |
| `fixed_drive` | `fixed_drive` | derived (nflverse) |
| `fixed_drive_result` | `fixed_drive_result` | derived (nflverse) |

### 3.4 Reference model columns (do not treat as raw observations)

Present in every sampled season; useful as **baselines / labels for parity tests**, not as features for training our own EP/WP:

`ep`, `epa`, `wp`, `wpa`, `vegas_wp`, `vegas_wpa`, `home_wp`, `away_wp`, `home_wp_post`, `away_wp_post`, next-score probs (`td_prob`, `fg_prob`, …), `cp`, `cpoe`, `xpass`, `success`, xyac_*.

Store under a separate `source_model_*` or `reference_*` namespace in the canonical layer so they never leak into feature matrices silently.

### 3.5 Explicitly deferred (not MVP canonical)

Player IDs/routes, participation/FTN charting, Next Gen Stats, weather beyond `roof`, betting products as user-facing features, full 372-column dump.

---

## 4. Missing data and quality (sampled)

On **REG scrimmage plays** (`down` not null), seasons 2019–2023:

| Field | Null % |
| --- | ---: |
| `down`, `ydstogo`, `yardline_100` | 0.0 |
| `half_seconds_remaining`, `game_seconds_remaining` | 0.0 |
| `posteam`, `home_team`, `roof` | 0.0 |
| timeouts, `score_differential` | 0.0 |
| `ep`, `wp`, `vegas_wp` | 0.0 |
| `epa` | ≈0–0.005 |
| `wpa` | ≈1.0 (expected on some terminal/edge plays) |

Non-scrimmage rows (`down` null): mostly kickoffs, extras, `no_play`, admin — EP/WP often still filled but **filter to scrimmage (or documented play_type set)** for model training.

**Handling policy (recommendation):**

1. Keep source nulls as null; do not invent downs or yardlines.
2. Training frame: `season_type == "REG"` and `down` in {1,2,3,4}.
3. Drop or flag rows missing any required pre-play feature (should be rare after filter).
4. Never overwrite observed scores/clock with simulated values in the historical store.
5. If rebuilding EP/WP with nflfastR calculators, compute `receive_2h_ko` in the feature pipeline; do not expect it in raw Parquet.

---

## 5. Redistribution / storage (factual evidence for licensing workstream)

| Artifact | Evidence | Constraint theme |
| --- | --- | --- |
| **PBP release data** | `nflverse-data` DESCRIPTION / GitHub license: **CC BY 4.0** | Attribution required for Share; commercial use generally allowed under CC BY — research agent owns final LICENSING doc |
| **nflreadpy package** | MIT | Code license ≠ data license |
| **FTN charting / some participation** | nflreadr docs: **CC BY-SA 4.0**, attribute “FTN Data via nflverse” | **Out of MVP** — do not bundle into default lake |
| **Mutability** | GitHub release assets under tag `pbp` update in place | Local pin via sha256 + timestamp |

**Storage recommendation:** keep full season Parquet **local-only** in the project lake for MVP; if redistributing samples or derived tables publicly, attach CC BY attribution to nflverse and document transformations. Do not ship FTN/participation in the default bundle.

Sports betting / odds product features remain **out of product scope**; `spread_line` / `vegas_wp` may be retained only for optional research baselines, gated from user-facing MVP.

---

## 6. Download / cache plan (Phase 2-ready, not implemented here)

1. Pin `nflreadpy==0.1.5` (or newer PyPI when validated).
2. Download seasons 2019–2023 Parquet → `data/raw/pbp/`.
3. Write `manifest.json` with URL, sha256, bytes, `timestamp.json`, access UTC time, package version.
4. Ingest to DuckDB views: `raw_pbp`, then `canonical_pre_play` / `canonical_play` projecting §3 fields.
5. Materialize split flags: `split ∈ {train, val, test}` from `season` (REG filter at train time).
6. Unit tests: column presence, null thresholds on scrimmage REG, split row counts within tolerance of §2, sha256 match to pinned manifest.

Approximate raw footprint: **~100 MB** Parquet for five seasons (comfortable for local CPU).

---

## 7. Recommendation to lead architect

1. **Adopt nflverse PBP via `nflreadpy` + pinned Parquet** as the historical source. Experiment window **unchanged**.
2. Canonical MVP = §3 tables; treat nflfastR `ep`/`wp`/`epa` as **reference**, not observed state.
3. Add derived `receive_2h_ko` and `is_home_possession` in the feature/contract layer.
4. Default metrics/training on **REG scrimmage**; keep POST for replay UI.
5. No paid API. No FTN/participation in MVP lake.
6. Smallest justified adjustment if any future issue arises: fall back to direct GitHub Parquet download (same files) — **not** a different data vendor or season cut.
