# Data pin notes — nflverse PBP

**Purpose:** Explain pinned sha256 values and digest drift so Phase 3+ never silently replaces the lake.

## Mutable upstream

Release assets under GitHub tag [`pbp`](https://github.com/nflverse/nflverse-data/releases/tag/pbp) are **mutable**. The same URL can yield a new file digest without a version bump. Phase 2 therefore stores immutable local raw Parquet + `manifest.json` (URL, UTC retrieval time, `nflreadpy` version, sha256, row count) and **refuses overwrite** when bytes differ.

## Active lake pins (`nfl_sim.ingest.manifest.PINNED_SEASON_SHA256`)

| Season | Active sha256 (lake) | Rows | Notes |
| ---: | --- | ---: | --- |
| 2019 | `d14de5d1beebf2235040dec8f50f5cba0e4921bcf2b1a82e69c182abef16d56b` | 47,260 | Phase 3 backfill 2026-10-11 |
| 2020 | `324cef331f3c6b91726450ef2c55f1ec8a619f23a8c4c329191ec15cdfc43b76` | 47,705 | Phase 3 backfill |
| 2021 | `e4dd2e160522ed3534f58e788c03365ad436268605950e864663c6a5161718c8` | 49,922 | Phase 3 backfill |
| 2022 | `e7c1b53b14afd073c209e0a90f8593058fb77c38583c4bc9593885fa67d133c7` | 49,434 | Phase 3 backfill |
| 2023 | `b8417df9501f7f966eaccfffe463425fc06153f7bd58e075f5fa8f900e67460d` | 49,665 | **Phase 2 pin — preserved through backfill** |

Phase 1 DATA_EXPERIMENT digests (same row counts) are kept in `PREVIOUS_PINNED_SEASON_SHA256` for provenance.

## Why digests changed at the same row counts

nflverse republished Parquet files under the mutable `pbp` tag between Phase 1 measurement and later ingests. **Row counts matched DATA_EXPERIMENT exactly** for all five seasons; only bytes/sha256 drifted.

### 2023 (documented in Phase 2)

| Field | Phase 1 DATA_EXPERIMENT | Phase 2 / current lake |
| --- | --- | --- |
| sha256 | `bd348473…` | `b8417df9…` |
| bytes | 20,534,088 | 20,624,417 |
| rows | **49,665** | **49,665** |

`timestamp.json` at Phase 2 retrieval: `last_updated: 2026-10-11 11:37:06 EDT`.

### 2019–2022 (Phase 3 backfill)

Same pattern: Phase 1 digests ≠ lake digests; rows identical (47,260 / 47,705 / 49,922 / 49,434). Manifests record actual sha256 + `pinned_sha256` + match flag. Immutable raw policy blocked any overwrite of the preserved 2023 file (verified `b8417df9…` before and after backfill).

## Policy

* Never delete/replace local raw when upstream drifts; ingest refuses mismatched overwrite.
* Models/reports record **manifest sha256 actually used**.
* Keep Phase 1 digests in `PREVIOUS_*` — do not erase history.

## Chronological experiment split (enforced in code)

| Split | Seasons | Role |
| --- | --- | --- |
| Train | 2019–2021 | Fit preprocess + model only |
| Validate | 2022 | Hyperparameters / selection only |
| Test | 2023 | Held-out report only — **never tune** |

Module: `nfl_sim.models.split` (`forbid_test_season_in_fit`, `assert_split_integrity`).

## Validation artifact

`reports/data/backfill_validation.json` — season coverage, schema (372 cols), IDs, missingness (~0% on REG scrimmage keys), REG scrimmage n matching DATA_EXPERIMENT (116,218 / 39,704 / 40,031).
